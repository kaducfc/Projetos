// Barão da Sucata — controlador e tela. As regras vivem em motor.js e as decisões dos bots em bots.js;
// aqui só se desenha o estado e se repassam os cliques do jogador ao motor.
// Enquanto o jogo é "oculto" (gameById('bar-do-barao').soAdmin), só administradores conseguem jogar.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import { t, onLangChange } from '../../../shared/i18n.js';
import { novaPartida, aplicar, pedido, visao, jogador, ativas, colocacao, ACOES } from './motor.js';
import { pontuar, PONTOS_MIN, PONTOS_MAX } from './pontuacao.js';
import { decidir } from './bots.js';
import { aleatorio } from './rng.js';
import { PERSONAGENS, JOGADOR_HUMANO, MESA, CARTAS, RITMO, ARTE } from './config.js';
import { criarFalador } from './falas.js';
import { avisoInicio, avisoComeco, avisoFim } from '../../../shared/aviso-ranked.js';

const GAME_ID = 'bar-do-barao';
const EU = 'eu';
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const lerLS = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

let est = null;
let rngBots = {};
let token = 0; // muda a cada partida nova para cancelar o laço da anterior
let ui = { ped: null, acao: null, sel: [], ajuda: false };
let mensagens = []; // narração em texto
let bolha = null; // { id, txt } última fala de um personagem
let registrado = false;
let rapido = false;
let contadorFala = 0;
let timerBolha = 0;
let ranqueada = null; // ingresso da partida ranqueada (vale PDR nas 2 primeiras do dia; o servidor confere o resultado)
let naAbertura = false; // tela de abertura: a partida só começa (e só gasta ingresso) ao clicar em JOGAR
let falador = criarFalador();

// ------------------------------------------------------------------ nomes (traduzidos quando possível)
const nomeCarta = (inf) => ({ magnata: t('Magnata'), lamina: t('Lâmina'), cobrador: t('Ladrão'), corretor: t('Reciclador'), sentinela: t('Sentinela') }[inf]);
const nomeAcao = (a) => ({ renda: t('Renda'), ajuda: t('Ajuda Externa'), tributos: t('Cobrar tributos'), roubo: t('Roubo'), troca: t('Troca de cartas'), assassinato: t('Assassinato'), golpe: t('Golpe') }[a]);
const descAcao = (a) => ({
  renda: t('Pega 1 moeda. Não pode ser contestada nem bloqueada.'),
  ajuda: t('Pega 2 moedas. Qualquer um pode bloquear dizendo ser o Magnata.'),
  tributos: t('Pega 3 moedas. Exige o Magnata e pode ser contestada.'),
  roubo: t('Rouba até 2 moedas de alguém. Exige o Ladrão; o alvo bloqueia com Ladrão ou Reciclador.'),
  troca: t('Compra 2 cartas e devolve as que sobrarem. Exige o Reciclador.'),
  assassinato: t('Paga 3 moedas e o alvo perde uma carta. Exige a Lâmina; o alvo bloqueia com a Sentinela.'),
  golpe: t('Paga 7 moedas e o alvo perde uma carta. Não pode ser bloqueado nem contestado.'),
}[a]);
const acaoCarta = (inf) => ({ magnata: t('Cobrar tributos'), lamina: t('Assassinato'), cobrador: t('Roubo'), corretor: t('Troca de cartas'), sentinela: t('Bloqueia assassinato') }[inf]);
const INFS = ['magnata', 'lamina', 'cobrador', 'corretor', 'sentinela'];
// Texto escapado em que cada nome de influência recebe a sua cor (azul Magnata, vermelha Lâmina, amarelo Ladrão, roxo Reciclador, verde Sentinela).
const ec = (txt) => {
  let h = esc(txt);
  for (const inf of INFS) {
    const nome = esc(nomeCarta(inf)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    h = h.replace(new RegExp(`(?<![\\p{L}])(${nome})(?![\\p{L}])`, 'gu'), `<span class="inf i-${inf}">$1</span>`);
  }
  return h;
};
// Igual a `ec`, mas também pinta o nome de cada jogador com a cor dele (nos avisos da mesa e no histórico).
const ej = (txt) => {
  let h = ec(txt);
  for (const id of MESA) {
    const nome = esc(nomeJ(id)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    h = h.replace(new RegExp(`(?<![\\p{L}>])(${nome})(?![\\p{L}])`, 'gu'), `<span class="jg" style="color:${pers(id).cor}">$1</span>`);
  }
  return h;
};
const pers = (id) => (id === EU ? JOGADOR_HUMANO : PERSONAGENS[id]);
const nomeJ = (id) => (id === EU ? t('Você') : PERSONAGENS[id]?.nome ?? '');
const motivoPerda = (m) => ({
  desafio_perdido: t('Você contestou e errou: escolha a carta que vai perder.'),
  blefe_descoberto: t('Seu blefe foi descoberto: escolha a carta que vai perder.'),
  assassinato: t('Você foi assassinado: escolha a carta que vai perder.'),
  golpe: t('Você levou um Golpe: escolha a carta que vai perder.'),
}[m]);

// ------------------------------------------------------------------ narração
function narrar(e) {
  const a = nomeJ(e.quem ?? e.ator ?? e.desafiante ?? e.bloqueador);
  switch (e.tipo) {
    case 'inicio': return t('{a} começa a rodada.', { a: nomeJ(e.primeiro) });
    case 'acao': {
      const v = { a, b: e.alvo ? nomeJ(e.alvo) : '' };
      return ({
        renda: t('{a} pega Renda (+1 moeda).', v), ajuda: t('{a} tenta a Ajuda Externa (+2 moedas).', v),
        tributos: t('{a} declara o Magnata e cobra tributos (+3).', v), roubo: t('{a} declara o Ladrão e tenta roubar {b}.', v),
        troca: t('{a} declara o Reciclador e quer trocar cartas.', v), assassinato: t('{a} paga 3 moedas e declara a Lâmina contra {b}.', v),
        golpe: t('{a} paga 7 moedas e dá um Golpe em {b}.', v),
      })[e.acao];
    }
    case 'bloqueio': return t('{a} bloqueia declarando {c}.', { a: nomeJ(e.quem), c: nomeCarta(e.inf) });
    case 'desafio': return t('{a} contesta {b}!', { a: nomeJ(e.desafiante), b: nomeJ(e.claimante) });
    case 'prova': return t('{a} mostra {c}: dizia a verdade! A carta volta ao baralho e outra é comprada.', { a: nomeJ(e.quem), c: nomeCarta(e.inf) });
    case 'blefe': return t('{a} não tem {c}: era blefe!', { a: nomeJ(e.quem), c: nomeCarta(e.inf) });
    case 'perdeu': return t('{a} perdeu a influência {c}.', { a: nomeJ(e.quem), c: nomeCarta(e.inf) });
    case 'eliminado': return t('{a} foi eliminado do bar.', { a: nomeJ(e.quem) });
    case 'vitoria': return t('{a} venceu o Bar!', { a: nomeJ(e.quem) });
    case 'efeito':
      if (e.acao === 'roubo') return t('{a} roubou {n} moeda(s) de {b}.', { a: nomeJ(e.quem), n: e.moedas, b: nomeJ(e.alvo) });
      if (e.moedas) return t('{a} ganhou {n} moeda(s).', { a: nomeJ(e.quem), n: e.moedas });
      return null;
    case 'acao_bloqueada': return t('A ação de {a} foi bloqueada.', { a: nomeJ(e.ator) });
    case 'acao_falhou': return t('A ação de {a} falhou.', { a: nomeJ(e.ator) });
    case 'bloqueio_falhou': return t('O bloqueio de {b} caiu: a ação de {a} acontece.', { a: nomeJ(e.ator), b: nomeJ(e.bloqueador) });
    case 'sem_efeito': return t('A ação não teve efeito.');
    case 'troca_inicio': return t('{a} olha as cartas do baralho…', { a: nomeJ(e.quem) });
    case 'troca_feita': return t('{a} terminou a troca de cartas.', { a: nomeJ(e.quem) });
    default: return null;
  }
}
const BOLHA_MS = 4200; // a fala some sozinha depois de alguns segundos
function mostrarFala(f) {
  bolha = { id: f.id, txt: f.txt, n: ++contadorFala };
  const n = bolha.n;
  clearTimeout(timerBolha);
  timerBolha = setTimeout(() => { if (bolha && bolha.n === n) { bolha = null; desenhar(); } }, BOLHA_MS);
}

// ------------------------------------------------------------------ andamento
function executar(quem, d) {
  const n0 = est.historico.length;
  aplicar(est, quem, d);
  for (const e of est.historico.slice(n0)) {
    const m = narrar(e); if (m) mensagens.push(m);
    const f = falador.comentar(e, EU); if (f) mostrarFala(f);
  }
  if (mensagens.length > 60) mensagens = mensagens.slice(-60);
}

async function rodar(meu) {
  while (meu === token && !est.vencedor) {
    const ped = pedido(est);
    if (ped.jogador === EU) { ui.ped = ped; ui.acao = null; ui.sel = []; desenhar(); return; }
    ui.ped = null; desenhar();
    if (!rapido) await esperar(RITMO.pensar);
    if (meu !== token) return;
    executar(ped.jogador, decidir(visao(est, ped.jogador), ped, PERSONAGENS[ped.jogador].perfil, rngBots[ped.jogador]));
    desenhar();
    if (!rapido) await esperar(RITMO.evento);
  }
  if (meu === token && est.vencedor) { ui.ped = null; terminar(); desenhar(); }
}

function novaRodada() {
  naAbertura = false; ranqueada = null;
  platform.rankedIniciar(GAME_ID).then((r) => { ranqueada = r; avisoComeco(r, GAME_ID); }).catch(() => {});
  token++; rapido = false; registrado = false; bolha = null; falador = criarFalador(); clearTimeout(timerBolha); mensagens = []; ui = { ped: null, acao: null, sel: [], ajuda: ui.ajuda };
  const seed = (Date.now() ^ 0x5bd1e995) >>> 0;
  est = novaPartida({ jogadores: MESA.map((id) => ({ id, nome: nomeJ(id), humano: id === EU })), seed });
  rngBots = Object.fromEntries(Object.keys(PERSONAGENS).map((id, k) => [id, aleatorio(seed + 101 * (k + 1))]));
  mensagens.push(narrar(est.historico[0]));
  platform.track('game_start', GAME_ID, {});
  desenhar();
  rodar(token);
}

function terminar() {
  if (registrado) return;
  registrado = true;
  const r = pontuar(est, EU); const col = r.colocacao;
  const ingresso = ranqueada;
  platform.track('game_end', GAME_ID, { colocacao: col, turnos: est.numTurno, pontos: r.total });
  Promise.resolve(platform.recordResult(GAME_ID, {
    score: r.total,
    summary: { text: `${col}º ${t('lugar')} · ${est.numTurno} ${t('turnos')}`, colocacao: col, turnos: est.numTurno, detalhe: r.itens, ranked: ingresso?.token || undefined },
  })).then((entry) => avisoFim(entry, ingresso, GAME_ID)).catch(() => {});
}

// ------------------------------------------------------------------ desenho
function cartaFace(inf, extra = '', attrs = '') {
  const c = CARTAS[inf];
  return `<div class="bb-carta ${extra}" style="--cor:${c.cor};background-image:url(img/carta-${inf}.webp)" ${attrs} aria-label="${esc(nomeCarta(inf))}"><b>${esc(nomeCarta(inf))}</b><small>${esc(acaoCarta(inf))}</small></div>`;
}
const cartaVerso = (extra = '') => `<div class="bb-carta verso ${extra}"></div>`;

function bloco(id) {
  const j = jogador(est, id); const p = pers(id);
  const vez = est.turno === MESA.indexOf(id) && !est.vencedor;
  const esperando = !ui.ped && !est.vencedor && pedido(est)?.jogador === id;
  const cartas = j.cartas.map((c) => (c.revelada ? cartaFace(c.inf, 'perdida mini') : cartaVerso('mini'))).join('');
  const alvoOk = ui.acao && ui.acao.alvos.includes(id);
  const fal = bolha && bolha.id === id ? `<div class="bb-fala" aria-hidden="true">${esc(bolha.txt)}</div>` : '';
  const tag = alvoOk ? 'button' : 'div';
  return `<${tag} class="bb-jog ${vez ? 'vez' : ''} ${j.vivo ? '' : 'fora'} ${alvoOk ? 'alvo' : ''}" style="--cor:${p.cor}" ${alvoOk ? `data-a="alvo" data-id="${id}"` : ''}>
    ${fal}<div class="bb-ret">${p.retrato ? `<img src="${esc(p.retrato)}" alt="" />` : `<span>${p.simbolo}</span>`}</div>
    <div class="bb-nm"><b data-no-i18n>${esc(p.nome)}</b><small data-no-i18n>${esc(p.titulo)}</small></div>
    <div class="bb-moedas" title="${esc(t('Moedas'))}"><i></i>${j.moedas}</div>
    <div class="bb-maos">${cartas}</div>
    ${esperando ? `<div class="bb-pensa">${esc(t('pensando…'))}</div>` : ''}
    ${j.vivo ? '' : `<div class="bb-pensa">${esc(t('eliminado'))}</div>`}
  </${tag}>`;
}

function minhaMao() {
  const j = jogador(est, EU); const ped = ui.ped;
  const escolhe = ped && ped.tipo === 'perder';
  return j.cartas.map((c, i) => {
    if (c.revelada) return cartaFace(c.inf, 'perdida');
    return cartaFace(c.inf, escolhe ? 'clicavel' : '', escolhe ? `data-a="perder" data-i="${i}" role="button" tabindex="0"` : '');
  }).join('');
}

function painelPedido() {
  const ped = ui.ped;
  if (est.vencedor) return '';
  if (!ped) {
    const q = pedido(est);
    const nome = q ? nomeJ(q.jogador) : '';
    return `<p class="bb-aguarda">${esc(t('{a} está decidindo…', { a: nome }))}</p>`;
  }
  const bt = (a, rot, cls = '', extra = '') => `<button class="bb-bt ${cls}" data-a="${a}" ${extra}>${rot}</button>`;
  switch (ped.tipo) {
    case 'acao': {
      if (ui.acao) {
        const alvos = ui.acao.alvos.map((id) => bt('alvo', `<span class="jg" style="color:${pers(id).cor}">${esc(nomeJ(id))}</span>` + ` <small>${jogador(est, id).moedas}◉</small>`, '', `data-id="${id}"`)).join('');
        return `<h3>${ej(t('Escolha o alvo: {acao}', { acao: nomeAcao(ui.acao.acao) }))}</h3><div class="bb-op">${alvos}</div><div class="bb-op">${bt('cancelar', esc(t('Voltar')))}</div>`;
      }
      const obrig = ped.acoes[0].obrigatoria;
      const lista = ped.acoes.map((a) => {
        const inf = ACOES[a.acao].alegacao;
        const sel = inf ? `<em class="inf i-${inf}">${esc(nomeCarta(inf))}</em>` : '';
        return `<button class="bb-acao" data-a="acao" data-k="${a.acao}"><b>${ec(nomeAcao(a.acao))}</b>${sel}<small>${ec(descAcao(a.acao))}</small></button>`;
      }).join('');
      return `<h3>${ej(t('Sua vez: escolha uma ação'))}</h3>${obrig ? `<p class="bb-aviso">${ec(t('Com 10 moedas ou mais o Golpe é obrigatório.'))}</p>` : ''}<div class="bb-acoes">${lista}</div>`;
    }
    case 'contestar': {
      const alvoTxt = ped.alvo ? ` ${t('contra {b}', { b: nomeJ(ped.alvo) })}` : '';
      return `<h3>${ej(t('{a} declara ter {c}', { a: nomeJ(ped.ator), c: nomeCarta(ped.influencia) }))}</h3>
        <p>${ej(nomeAcao(ped.acao) + alvoTxt)}. ${ec(t('Se você contestar e ele tiver a carta, você perde uma influência. Se estiver blefando, ele perde.'))}</p>
        <div class="bb-op">${bt('contestar', esc(t('Contestar')), 'perigo')}${bt('passar', esc(t('Deixar passar')))}</div>`;
    }
    case 'bloquear': {
      const botoes = ped.influencias.map((inf) => bt('bloquear', esc(t('Bloquear como {c}', { c: nomeCarta(inf) })), 'ouro', `data-inf="${inf}"`)).join('');
      return `<h3>${ej(t('{a} tenta {acao}', { a: nomeJ(ped.ator), acao: nomeAcao(ped.acao) }))}${ped.alvo === EU ? ` · ${ec(t('contra você'))}` : ''}</h3>
        <p>${ec(t('Você pode bloquear. Se não tiver a carta, o bloqueio pode ser contestado.'))}</p>
        <div class="bb-op">${botoes}${bt('naobloquear', esc(t('Não bloquear')))}</div>`;
    }
    case 'contestar_bloqueio':
      return `<h3>${ej(t('{a} bloqueia declarando {c}', { a: nomeJ(ped.bloqueador), c: nomeCarta(ped.influencia) }))}</h3>
        <p>${ej(t('Ação bloqueada: {acao} de {a}.', { acao: nomeAcao(ped.acao), a: nomeJ(ped.ator) }))}</p>
        <div class="bb-op">${bt('contestar', esc(t('Contestar o bloqueio')), 'perigo')}${bt('passar', esc(t('Aceitar o bloqueio')))}</div>`;
    case 'perder': return `<h3>${ej(motivoPerda(ped.motivo) || t('Escolha a carta que vai perder.'))}</h3><p>${ec(t('Toque em uma das suas cartas abaixo.'))}</p>`;
    case 'trocar': {
      const cartas = ped.cartas.map((inf, i) => cartaFace(inf, `clicavel ${ui.sel.includes(i) ? 'marcada' : ''}`, `data-a="trocar" data-i="${i}" role="button" tabindex="0"`)).join('');
      return `<h3>${ej(t('Troca de cartas: fique com {n}', { n: ped.manter }))}</h3><p>${ec(t('As demais voltam ao baralho embaralhado.'))}</p>
        <div class="bb-troca">${cartas}</div><div class="bb-op">${bt('confirmar', esc(t('Confirmar')), 'ouro', ui.sel.length === ped.manter ? '' : 'disabled')}</div>`;
    }
    default: return '';
  }
}

const ROTULO_PONTO = {
  colocacao: (n) => t('Colocação: {n}º lugar', { n }),
  cartas_finais: (n) => t('Terminou com {n} carta(s)', { n }),
  cartas_tiradas: (n) => t('{n} carta(s) tirada(s) dos adversários', { n }),
  eliminacoes: (n) => t('{n} adversário(s) eliminado(s)', { n }),
  blefes: (n) => t('{n} blefe(s) que passaram', { n }),
  cofre: (n) => t('Cofre: {n} moedas', { n }),
  sobrevivencia: () => t('Tempo na mesa'),
  duvida_errada: (n) => t('{n} dúvida(s) errada(s)', { n }),
  blefe_descoberto: (n) => t('{n} blefe(s) descoberto(s)', { n }),
};
function telaFim() {
  const r = pontuar(est, EU); const col = r.colocacao;
  const linhas = r.itens.map((x) => `<li class="${x.valor < 0 ? 'neg' : ''}"><span>${esc(ROTULO_PONTO[x.chave](x.qtd))}</span><b>${x.valor > 0 ? '+' : ''}${x.valor}</b></li>`).join('');
  const ajuste = r.total !== r.bruto ? `<li class="aj"><span>${esc(r.total > r.bruto ? t('Mínimo da partida') : t('Máximo da partida'))}</span><b>${r.total}</b></li>` : '';
  const ganhou = est.vencedor === EU;
  return `<div class="bb-fim"><h2>${esc(ganhou ? t('Você dominou o Barão da Sucata!') : t('{a} venceu o Barão da Sucata', { a: nomeJ(est.vencedor) }))}</h2>
    <p class="bb-col">${esc(t('Sua colocação'))}: <b>${col}º</b> · <b>${r.total}</b> ${esc(t('pontos'))}</p>
    <ul class="bb-pts" aria-label="${esc(t('Sua pontuação'))}">${linhas}${ajuste}<li class="tot"><span>${esc(t('Total'))} (${PONTOS_MIN}–${PONTOS_MAX})</span><b>${r.total}</b></li></ul>
    <div class="bb-op"><button class="bb-bt ouro" data-a="novo">${esc(t('JOGAR NOVAMENTE'))}</button><a class="bb-bt" href="../../">${esc(t('VOLTAR AO INÍCIO'))}</a></div></div>`;
}

function ajuda() {
  const linhas = ['renda', 'ajuda', 'tributos', 'roubo', 'troca', 'assassinato', 'golpe'].map((a) => `<li><b>${ec(nomeAcao(a))}</b> ${ec(descAcao(a))}</li>`).join('');
  const cartas = Object.keys(CARTAS).map((i) => `<li><b>${ec(nomeCarta(i))}</b> — ${ec(acaoCarta(i))}</li>`).join('');
  return `<div class="bb-modal" data-a="fechar"><div class="bb-quadro bb-caixa" role="dialog" aria-modal="true">
    <h2>${ec(t('Como jogar'))}</h2>
    <p>${ec(t('Cada um começa com 2 cartas (influências) e 2 moedas. Perdeu as duas cartas, está fora. O último de pé vence.'))}</p>
    <p>${ec(t('Você pode declarar qualquer carta, mesmo sem tê-la (blefar). Os outros podem contestar: quem mentiu perde uma influência; quem contestou errado também perde.'))}</p>
    <ul>${linhas}</ul><h3>${ej(t('As cinco influências'))}</h3><ul>${cartas}</ul>
    <p>${ec(t('Com 10 moedas ou mais, o Golpe é obrigatório.'))}</p>
    <div class="bb-op"><button class="bb-bt ouro" data-a="fechar">${ec(t('Entendi'))}</button></div></div></div>`;
}

function telaInicio() {
  naAbertura = true;
  const cenario = ARTE.cenario ? `style="background-image:linear-gradient(180deg,rgba(8,6,4,.1),rgba(8,6,4,.62)),url(${esc(ARTE.cenario)})"` : '';
  app.innerHTML = `<div class="bb-mesa bb-abertura" ${cenario}>
    <div class="bb-quadro bb-cartao"><h1 class="bb-logo">${esc('BARÃO DA SUCATA')}</h1>
      <p>${esc(t('Blefe, intriga e traição numa taverna clandestina de Zaun: sobreviva com ao menos uma influência.'))}</p>
      <div class="bb-op"><button class="bb-bt ouro" data-a="novo">${esc(t('JOGAR'))}</button><button class="bb-bt" data-a="ajuda">${esc(t('Como jogar'))}</button></div></div>
    </div>${ui.ajuda ? ajuda() : ''}`;
}

function desenhar() {
  if (!est) { if (naAbertura) telaInicio(); return; }
  const opp = MESA.filter((id) => id !== EU).map(bloco).join('');
  const logHtml = mensagens.slice(-12).map((m, i, a) => `<li class="${i === a.length - 1 ? 'novo' : ''}">${ej(m)}</li>`).join('');
  const eliminado = !jogador(est, EU).vivo && !est.vencedor;
  const eu = jogador(est, EU);
  const vez = est.turno === MESA.indexOf(EU) && !est.vencedor;
  const cenario = ARTE.cenario ? `style="background-image:linear-gradient(180deg,rgba(8,6,4,.1),rgba(8,6,4,.62)),url(${esc(ARTE.cenario)})"` : '';
  const logo = ARTE.logo ? `<img class="bb-logo-img" src="${esc(ARTE.logo)}" alt="Barão da Sucata" />` : `<h1 class="bb-logo">${esc('BARÃO DA SUCATA')}</h1>`;
  app.innerHTML = `<div class="bb-mesa" ${cenario}>
    <header class="bb-topo">${logo}<div class="bb-ferr"><span class="bb-turno">${esc(t('Turno {n}', { n: est.numTurno }))} · ${esc(t('Baralho: {n}', { n: est.baralho.length }))}</span>
      <button class="bb-bt peq" data-a="ajuda">${esc(t('Como jogar'))}</button></div></header>
    <section class="bb-opps">${opp}</section>
    <section class="bb-centro">
      <ul class="bb-log" aria-live="polite">${logHtml}</ul>
      <div class="bb-pedido bb-quadro">${est.vencedor ? telaFim() : painelPedido()}${eliminado ? `<div class="bb-op"><button class="bb-bt" data-a="pular">${esc(t('Pular para o fim'))}</button></div>` : ''}</div>
    </section>
    <section class="bb-eu ${vez ? 'vez' : ''} ${eu.vivo ? '' : 'fora'}" style="--cor:${JOGADOR_HUMANO.cor}">
      <div class="bb-eu-info"><b>${esc(t('Você'))}</b><div class="bb-moedas"><i></i>${eu.moedas}</div></div>
      <div class="bb-maos eu">${minhaMao()}</div>
    </section></div>${ui.ajuda ? ajuda() : ''}`;
  const lg = app.querySelector('.bb-log'); if (lg) lg.scrollTop = lg.scrollHeight;
}

// ------------------------------------------------------------------ cliques
function agir(d) { if (!ui.ped || est.vencedor) return; const meu = token; executar(EU, d); ui.ped = null; desenhar(); rodar(meu); }
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a; const ped = ui.ped;
  if (a === 'ajuda') { ui.ajuda = true; desenhar(); return; }
  if (a === 'fechar') { if (b.classList.contains('bb-modal') && e.target !== b) return; ui.ajuda = false; gravarLS('bar-do-barao.ajuda', true); desenhar(); return; }
  if (a === 'novo') { novaRodada(); return; }
  if (a === 'pular') { rapido = true; return; }
  if (!ped) return;
  if (a === 'acao') {
    const opc = ped.acoes.find((x) => x.acao === b.dataset.k); if (!opc) return;
    if (opc.alvos) { ui.acao = opc; desenhar(); } else agir({ acao: opc.acao });
  } else if (a === 'alvo' && ui.acao) agir({ acao: ui.acao.acao, alvo: b.dataset.id });
  else if (a === 'cancelar') { ui.acao = null; desenhar(); }
  else if (a === 'contestar') agir({ contestar: true });
  else if (a === 'passar') agir({ contestar: false });
  else if (a === 'bloquear') agir({ influencia: b.dataset.inf });
  else if (a === 'naobloquear') agir({ influencia: null });
  else if (a === 'perder') agir({ indice: Number(b.dataset.i) });
  else if (a === 'trocar') {
    const i = Number(b.dataset.i);
    ui.sel = ui.sel.includes(i) ? ui.sel.filter((x) => x !== i) : [...ui.sel, i].slice(-ped.manter);
    desenhar();
  } else if (a === 'confirmar' && ui.sel.length === ped.manter) agir({ manter: [...ui.sel].sort((x, y) => x - y) });
});
app.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-a]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.ajuda) { ui.ajuda = false; desenhar(); } });

function telaBloqueada() {
  app.innerHTML = `<div class="bb-fim bb-quadro" style="margin:40px auto"><h2>${t('Em desenvolvimento')}</h2>
    <p>${t('Este jogo ainda está sendo construído e chega em breve. Enquanto isso, o resto do Rift Arcade está aberto!')}</p>
    <div class="bb-op"><a class="bb-bt ouro" href="../../">${t('VOLTAR AO INÍCIO')}</a></div></div>`;
}

onLangChange(() => { desenhar(); });

(async function iniciar() {
  await platform.init();
  const teste = ['localhost', '127.0.0.1'].includes(location.hostname) && /[?&]teste=1/.test(location.search);
  const souAdmin = await platform.isAdmin();
  const aberto = !gameById(GAME_ID)?.soAdmin;
  if (!souAdmin && !teste && !aberto) { telaBloqueada(); return; }
  ui.ajuda = !lerLS('bar-do-barao.ajuda', false);
  telaInicio();
  avisoInicio(GAME_ID);
})();
