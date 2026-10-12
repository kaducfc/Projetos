// O Bar do Barão — controlador e tela. As regras vivem em motor.js e as decisões dos bots em bots.js;
// aqui só se desenha o estado e se repassam os cliques do jogador ao motor.
// Enquanto o jogo é "oculto" (gameById('bar-do-barao').soAdmin), só administradores conseguem jogar.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import { t, onLangChange } from '../../../shared/i18n.js';
import { novaPartida, aplicar, pedido, visao, jogador, ativas, colocacao, PONTOS_COLOCACAO, ACOES } from './motor.js';
import { decidir } from './bots.js';
import { aleatorio } from './rng.js';
import { PERSONAGENS, JOGADOR_HUMANO, MESA, CARTAS, RITMO, ARTE } from './config.js';
import { fala } from './falas.js';

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

// ------------------------------------------------------------------ nomes (traduzidos quando possível)
const nomeCarta = (inf) => ({ magnata: t('Magnata'), lamina: t('Lâmina'), cobrador: t('Cobrador'), corretor: t('Corretor'), sentinela: t('Sentinela') }[inf]);
const nomeAcao = (a) => ({ renda: t('Renda'), ajuda: t('Ajuda Externa'), tributos: t('Cobrar tributos'), roubo: t('Roubo'), troca: t('Troca de cartas'), assassinato: t('Assassinato'), golpe: t('Golpe') }[a]);
const descAcao = (a) => ({
  renda: t('Pega 1 moeda. Não pode ser contestada nem bloqueada.'),
  ajuda: t('Pega 2 moedas. Qualquer um pode bloquear dizendo ser o Magnata.'),
  tributos: t('Pega 3 moedas. Exige o Magnata e pode ser contestada.'),
  roubo: t('Rouba até 2 moedas de alguém. Exige o Cobrador; o alvo bloqueia com Cobrador ou Corretor.'),
  troca: t('Compra 2 cartas e devolve as que sobrarem. Exige o Corretor.'),
  assassinato: t('Paga 3 moedas e o alvo perde uma carta. Exige a Lâmina; o alvo bloqueia com a Sentinela.'),
  golpe: t('Paga 7 moedas e o alvo perde uma carta. Não pode ser bloqueado nem contestado.'),
}[a]);
const acaoCarta = (inf) => ({ magnata: t('Cobrar tributos'), lamina: t('Assassinato'), cobrador: t('Roubo'), corretor: t('Troca de cartas'), sentinela: t('Bloqueia assassinato') }[inf]);
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
        tributos: t('{a} declara o Magnata e cobra tributos (+3).', v), roubo: t('{a} declara o Cobrador e tenta roubar {b}.', v),
        troca: t('{a} declara o Corretor e quer trocar cartas.', v), assassinato: t('{a} paga 3 moedas e declara a Lâmina contra {b}.', v),
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
function falaDoEvento(e) {
  let id; let cat; let inf = null;
  switch (e.tipo) {
    case 'acao': id = e.quem; inf = ACOES[e.acao].alegacao; cat = ['renda', 'ajuda'].includes(e.acao) ? 'renda' : ['assassinato', 'golpe'].includes(e.acao) ? 'ataque' : 'acao'; break;
    case 'bloqueio': id = e.quem; cat = 'bloqueia'; inf = e.inf; break;
    case 'desafio': id = e.desafiante; cat = 'contesta'; break;
    case 'prova': id = e.quem; cat = 'provaOk'; break;
    case 'blefe': id = e.quem; cat = 'blefePego'; break;
    case 'perdeu': id = e.quem; cat = 'perdeu'; break;
    case 'eliminado': id = e.quem; cat = 'eliminado'; break;
    case 'vitoria': id = e.quem; cat = 'venceu'; break;
    default: return;
  }
  if (id === EU) return;
  const txt = fala(id, cat, contadorFala++, inf);
  if (txt) bolha = { id, txt };
}

// ------------------------------------------------------------------ andamento
function executar(quem, d) {
  const n0 = est.historico.length;
  aplicar(est, quem, d);
  for (const e of est.historico.slice(n0)) {
    const m = narrar(e); if (m) mensagens.push(m);
    falaDoEvento(e);
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
  token++; rapido = false; registrado = false; bolha = null; mensagens = []; ui = { ped: null, acao: null, sel: [], ajuda: ui.ajuda };
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
  const col = colocacao(est, EU);
  const pontos = PONTOS_COLOCACAO[col] ?? 0;
  platform.track('game_end', GAME_ID, { colocacao: col, turnos: est.numTurno });
  Promise.resolve(platform.recordResult(GAME_ID, {
    score: pontos,
    summary: { text: `${col}º ${t('lugar')} · ${est.numTurno} ${t('turnos')}`, colocacao: col, turnos: est.numTurno },
  })).catch(() => {});
}

// ------------------------------------------------------------------ desenho
function cartaFace(inf, extra = '', attrs = '') {
  const c = CARTAS[inf];
  return `<div class="bb-carta ${extra}" style="--cor:${c.cor}" ${attrs}><span class="bb-cs">${c.simbolo}</span><b>${esc(nomeCarta(inf))}</b><small>${esc(acaoCarta(inf))}</small></div>`;
}
const cartaVerso = (extra = '') => `<div class="bb-carta verso ${extra}"><span class="bb-cs">♦</span></div>`;

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
        const alvos = ui.acao.alvos.map((id) => bt('alvo', esc(nomeJ(id)) + ` <small>${jogador(est, id).moedas}◉</small>`, '', `data-id="${id}"`)).join('');
        return `<h3>${esc(t('Escolha o alvo: {acao}', { acao: nomeAcao(ui.acao.acao) }))}</h3><div class="bb-op">${alvos}</div><div class="bb-op">${bt('cancelar', esc(t('Voltar')))}</div>`;
      }
      const obrig = ped.acoes[0].obrigatoria;
      const lista = ped.acoes.map((a) => {
        const inf = ACOES[a.acao].alegacao;
        const sel = inf ? `<em>${esc(nomeCarta(inf))}</em>` : '';
        return `<button class="bb-acao" data-a="acao" data-k="${a.acao}"><b>${esc(nomeAcao(a.acao))}</b>${sel}<small>${esc(descAcao(a.acao))}</small></button>`;
      }).join('');
      return `<h3>${esc(t('Sua vez: escolha uma ação'))}</h3>${obrig ? `<p class="bb-aviso">${esc(t('Com 10 moedas ou mais o Golpe é obrigatório.'))}</p>` : ''}<div class="bb-acoes">${lista}</div>`;
    }
    case 'contestar': {
      const alvoTxt = ped.alvo ? ` ${t('contra {b}', { b: nomeJ(ped.alvo) })}` : '';
      return `<h3>${esc(t('{a} declara ter {c}', { a: nomeJ(ped.ator), c: nomeCarta(ped.influencia) }))}</h3>
        <p>${esc(nomeAcao(ped.acao) + alvoTxt)}. ${esc(t('Se você contestar e ele tiver a carta, você perde uma influência. Se estiver blefando, ele perde.'))}</p>
        <div class="bb-op">${bt('contestar', esc(t('Contestar')), 'perigo')}${bt('passar', esc(t('Deixar passar')))}</div>`;
    }
    case 'bloquear': {
      const botoes = ped.influencias.map((inf) => bt('bloquear', esc(t('Bloquear como {c}', { c: nomeCarta(inf) })), 'ouro', `data-inf="${inf}"`)).join('');
      return `<h3>${esc(t('{a} tenta {acao}', { a: nomeJ(ped.ator), acao: nomeAcao(ped.acao) }))}${ped.alvo === EU ? ` · ${esc(t('contra você'))}` : ''}</h3>
        <p>${esc(t('Você pode bloquear. Se não tiver a carta, o bloqueio pode ser contestado.'))}</p>
        <div class="bb-op">${botoes}${bt('naobloquear', esc(t('Não bloquear')))}</div>`;
    }
    case 'contestar_bloqueio':
      return `<h3>${esc(t('{a} bloqueia declarando {c}', { a: nomeJ(ped.bloqueador), c: nomeCarta(ped.influencia) }))}</h3>
        <p>${esc(t('Ação bloqueada: {acao} de {a}.', { acao: nomeAcao(ped.acao), a: nomeJ(ped.ator) }))}</p>
        <div class="bb-op">${bt('contestar', esc(t('Contestar o bloqueio')), 'perigo')}${bt('passar', esc(t('Aceitar o bloqueio')))}</div>`;
    case 'perder': return `<h3>${esc(motivoPerda(ped.motivo) || t('Escolha a carta que vai perder.'))}</h3><p>${esc(t('Toque em uma das suas cartas abaixo.'))}</p>`;
    case 'trocar': {
      const cartas = ped.cartas.map((inf, i) => cartaFace(inf, `clicavel ${ui.sel.includes(i) ? 'marcada' : ''}`, `data-a="trocar" data-i="${i}" role="button" tabindex="0"`)).join('');
      return `<h3>${esc(t('Troca de cartas: fique com {n}', { n: ped.manter }))}</h3><p>${esc(t('As demais voltam ao baralho embaralhado.'))}</p>
        <div class="bb-troca">${cartas}</div><div class="bb-op">${bt('confirmar', esc(t('Confirmar')), 'ouro', ui.sel.length === ped.manter ? '' : 'disabled')}</div>`;
    }
    default: return '';
  }
}

function telaFim() {
  const col = colocacao(est, EU); const pts = PONTOS_COLOCACAO[col] ?? 0;
  const ganhou = est.vencedor === EU;
  return `<div class="bb-fim"><h2>${esc(ganhou ? t('Você dominou o Bar do Barão!') : t('{a} venceu o Bar do Barão', { a: nomeJ(est.vencedor) }))}</h2>
    <p class="bb-col">${esc(t('Sua colocação'))}: <b>${col}º</b> · +${pts} ${esc(t('pontos'))}</p>
    <div class="bb-op"><button class="bb-bt ouro" data-a="novo">${esc(t('JOGAR NOVAMENTE'))}</button><a class="bb-bt" href="../../">${esc(t('VOLTAR AO INÍCIO'))}</a></div></div>`;
}

function ajuda() {
  const linhas = ['renda', 'ajuda', 'tributos', 'roubo', 'troca', 'assassinato', 'golpe'].map((a) => `<li><b>${esc(nomeAcao(a))}</b> ${esc(descAcao(a))}</li>`).join('');
  const cartas = Object.keys(CARTAS).map((i) => `<li><b>${esc(nomeCarta(i))}</b> — ${esc(acaoCarta(i))}</li>`).join('');
  return `<div class="bb-modal" data-a="fechar"><div class="bb-quadro bb-caixa" role="dialog" aria-modal="true">
    <h2>${esc(t('Como jogar'))}</h2>
    <p>${esc(t('Cada um começa com 2 cartas (influências) e 2 moedas. Perdeu as duas cartas, está fora. O último de pé vence.'))}</p>
    <p>${esc(t('Você pode declarar qualquer carta, mesmo sem tê-la (blefar). Os outros podem contestar: quem mentiu perde uma influência; quem contestou errado também perde.'))}</p>
    <ul>${linhas}</ul><h3>${esc(t('As cinco influências'))}</h3><ul>${cartas}</ul>
    <p>${esc(t('Com 10 moedas ou mais, o Golpe é obrigatório.'))}</p>
    <div class="bb-op"><button class="bb-bt ouro" data-a="fechar">${esc(t('Entendi'))}</button></div></div></div>`;
}

function desenhar() {
  if (!est) return;
  const opp = MESA.filter((id) => id !== EU).map(bloco).join('');
  const logHtml = mensagens.slice(-12).map((m, i, a) => `<li class="${i === a.length - 1 ? 'novo' : ''}">${esc(m)}</li>`).join('');
  const eliminado = !jogador(est, EU).vivo && !est.vencedor;
  const eu = jogador(est, EU);
  const vez = est.turno === MESA.indexOf(EU) && !est.vencedor;
  const cenario = ARTE.cenario ? `style="background-image:linear-gradient(180deg,rgba(8,6,4,.1),rgba(8,6,4,.62)),url(${esc(ARTE.cenario)})"` : '';
  const logo = ARTE.logo ? `<img class="bb-logo-img" src="${esc(ARTE.logo)}" alt="O Bar do Barão" />` : `<h1 class="bb-logo">${esc('O BAR DO BARÃO')}</h1>`;
  app.innerHTML = `<div class="bb-mesa" ${cenario}>
    <header class="bb-topo">${logo}<div class="bb-ferr"><span class="bb-turno">${esc(t('Turno {n}', { n: est.numTurno }))} · ${esc(t('Baralho: {n}', { n: est.baralho.length }))}</span>
      <button class="bb-bt peq" data-a="ajuda">${esc(t('Como jogar'))}</button></div></header>
    <section class="bb-opps">${opp}</section>
    <section class="bb-centro">
      <ul class="bb-log" aria-live="polite">${logHtml}</ul>
      <div class="bb-pedido bb-quadro">${est.vencedor ? telaFim() : painelPedido()}${eliminado ? `<div class="bb-op"><button class="bb-bt" data-a="pular">${esc(t('Pular para o fim'))}</button></div>` : ''}</div>
    </section>
    <section class="bb-eu ${vez ? 'vez' : ''} ${eu.vivo ? '' : 'fora'}">
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

onLangChange(() => { if (est) desenhar(); });

(async function iniciar() {
  await platform.init();
  const teste = ['localhost', '127.0.0.1'].includes(location.hostname) && /[?&]teste=1/.test(location.search);
  const souAdmin = await platform.isAdmin();
  const aberto = !gameById(GAME_ID)?.soAdmin;
  if (!souAdmin && !teste && !aberto) { telaBloqueada(); return; }
  ui.ajuda = !lerLS('bar-do-barao.ajuda', false);
  novaRodada();
})();
