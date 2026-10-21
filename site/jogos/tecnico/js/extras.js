// Treinamento, Amistoso e Recrutar (baús de Legados). Telas e ações do menu lateral.
// Recebe de main.js (iniciarExtras) o estado e os ajudantes; tudo que vale (custos, sorteio, XP) vem do servidor.
import * as platform from '../../../shared/platform.js';
import { localeAtual } from '../../../shared/i18n.js';
import { escudoPoder } from './regras.js';
import { retratoSvg, escudoOrg, iconeVaga } from './art.js';
import { abrirBau } from './bau-anim.js';

const api = platform.tecnico;
let C = null; // contexto de main.js: { S, esc, fmt, IMG, agir, toast, render, novaChave, escudoHtml }
export const iniciarExtras = (ctx) => { C = ctx; };

const ATRIBUTOS = [['mec', 'Mecânica'], ['rotas', 'Fase de rotas'], ['macro', 'Macro'], ['tf', 'Teamfight'], ['mental', 'Mental']];
export const RARIDADES = {
  comum: { nome: 'Comum', cor: '#a3a3b8' }, raro: { nome: 'Raro', cor: '#60a5fa' }, epico: { nome: 'Épico', cor: '#c084fc' },
  lendario: { nome: 'Lendário', cor: '#f5cf5a' }, mitico: { nome: 'Mítico', cor: '#fb7185' },
};
const ORDEM_RAR = ['comum', 'raro', 'epico', 'lendario', 'mitico'];

const X = {
  treino: null, // { ...estado do servidor }
  amistoso: { oponentes: null, hist: null },
  recrutar: null,
  timer: null,
  abertos: new Set(), // jogadores não titulares com o cartão de treino aberto
};

// ------------------------------------------------------------------ carga
export async function carregarExtras(aba) {
  if (aba === 'treino') X.treino = await api.treinoEstado();
  if (aba === 'amistoso') [X.amistoso.oponentes, X.amistoso.hist] = await Promise.all([api.amistosoOponentes(), api.amistosoHistorico()]);
  if (aba === 'recrutar') X.recrutar = await api.recrutarInfo();
  ligarRelogio();
}
export const limparExtras = () => { clearInterval(X.timer); X.treino = null; X.amistoso = { oponentes: null, hist: null }; X.recrutar = null; };

const fmtTempo = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}min` : m ? `${m}min ${String(r).padStart(2, '0')}s` : `${r}s`;
};
// Contagem regressiva dos treinos: atualiza só o texto e recarrega a aba quando um termina.
function ligarRelogio() {
  clearInterval(X.timer);
  if (C.S.aba !== 'treino' || !X.treino) return;
  const desvio = X.treino.agora ? Date.now() - new Date(X.treino.agora).getTime() : 0; // relógio do aparelho x servidor
  X.timer = setInterval(async () => {
    if (C.S.aba !== 'treino' || !X.treino) { clearInterval(X.timer); return; }
    let acabou = false;
    document.querySelectorAll('[data-fim]').forEach((el) => {
      const resta = new Date(el.dataset.fim).getTime() - (Date.now() - desvio);
      if (resta <= 0) acabou = true; else el.textContent = fmtTempo(resta);
    });
    if (acabou) { clearInterval(X.timer); try { X.treino = await api.treinoEstado(); await C.atualizarMeu(); } catch { /* tenta no próximo clique */ } C.render(); ligarRelogio(); }
  }, 1000);
  X.timer.unref?.(); // em Node (testes) o relógio não segura o processo
}

// ------------------------------------------------------------------ peças
// Barra de XP (0 a 100): cheia, o jogador pode treinar um atributo.
const xpBarra = (j, custo = 100) => { const xp = Math.min(100, j.exp || 0); return `<div class="tc-treino-xp${xp >= custo ? ' cheia' : ''}"><span>XP <b>${xp}/100</b>${xp >= custo ? ' · pronto para treinar' : ''}</span><div class="tc-barra"><i style="width:${xp}%"></i></div></div>`; };
const poderBarra = (j) => {
  const lim = j.limite; const ini = j.poder_inicial; const pct = lim > ini ? Math.round(((j.poder - ini) / (lim - ini)) * 100) : 100;
  return `<div class="tc-treino-poder"><span>Poder <b>${j.poder}</b> <small>/ limite ${lim}</small></span><div class="tc-barra"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div><small class="tc-mudo">Início ${ini} · até +${lim - ini}</small></div>`;
};
const rar = (j) => (j.raridade && RARIDADES[j.raridade] ? j.raridade : '');
const miniCartao = (j, extra = '') => `<div class="tc-mini ${rar(j) ? `r-${rar(j)}` : ''}"><div class="foto">${retratoSvg(j, 110)}</div><div class="inf"><b>${C.esc(j.nome)}${j.legado ? ' <i class="tc-estrela">◆</i>' : ''}</b><small class="pos-rar">${iconeVaga(j.pos)}${rar(j) ? ` · <b class="rar-txt rt-${j.raridade}">${RARIDADES[j.raridade].nome}</b>` : ''}</small>${j.org_id ? C.estrelasHtml(j) : ''}${C.escudoHtml(j.poder)}${extra}</div></div>`;

// ------------------------------------------------------------------ Treinamento
export function viewTreino() {
  const t = X.treino; if (!t) return '<p class="tc-carregando">Carregando…</p>';
  const cfg = t.config; const xpCusto = cfg.exp_custo || 100;
  const cartao = (j) => {
    const tr = j.treino; const noLimite = j.poder >= j.limite;
    const linhas = ATRIBUTOS.map(([id, nome]) => {
      const v = j[id]; const custo = j.custos[id]; const falta = t.creditos < custo;
      const semXp = (j.exp || 0) < xpCusto; const bloq = tr || noLimite || v >= 100 || falta || semXp || t.em_andamento >= cfg.simultaneos || C.S.ocupado;
      const ativo = tr && tr.atributo === id;
      return `<div class="tc-attr${ativo ? ' ativo' : ''}"><span class="nm">${nome}</span><b>${v}</b><div class="tc-barra"><i style="width:${v}%"></i></div>
        ${ativo ? `<span class="tc-treinando">+${tr.pontos} em <b data-fim="${C.esc(tr.fim)}">…</b></span>`
          : `<button type="button" class="tc-btn peq" data-act="treinar" data-id="${j.id}" data-attr="${id}" ${bloq ? 'disabled' : ''} title="${semXp ? 'Barra de XP ainda não está cheia' : falta ? 'Créditos insuficientes' : ''}">+${cfg.pontos} · ${C.fmt(custo)}</button>`}</div>`;
    }).join('');
    return `<section class="tc-card tc-treino-jog ${rar(j) ? `r-${rar(j)}` : ''}">
      ${miniCartao(j)}
      <div class="tc-treino-corpo">${xpBarra(j, xpCusto)}${poderBarra(j)}${noLimite ? '<p class="tc-peq" style="color:var(--ouro2);margin:6px 0 0">Limite de treino atingido.</p>' : ''}${linhas}
      <small class="tc-mudo" style="margin-top:4px">${(j.exp || 0) < xpCusto ? `Você precisa de ${xpCusto} de XP para treinar.` : `Pronto para treinar! A sessão custa ${xpCusto} de XP e dura ${j.horas}h.`}</small></div></section>`;
  };
  const titulares = t.jogadores.filter((j) => j.slot); const outros = t.jogadores.filter((j) => !j.slot);
  const cards = titulares.map(cartao).join('');
  const min = (j) => { const aberto = X.abertos.has(j.id); const xp = Math.min(100, j.exp || 0);
    return `<div class="tc-min${aberto ? ' aberto' : ''}${rar(j) ? ` r-${rar(j)}` : ''}"><button type="button" class="tc-min-cab" data-act="treino-abrir" data-id="${j.id}" aria-expanded="${aberto}">
      <span class="ft">${retratoSvg(j, 44)}</span><span class="nm"><b>${C.esc(j.nome)}${j.legado ? ' <i class="tc-estrela">◆</i>' : ''}</b><small>${iconeVaga(j.pos)} ${C.NOME_VAGA ? '' : ''}${rar(j) ? `<b class="rar-txt rt-${j.raridade}">${RARIDADES[j.raridade].nome}</b>` : 'Comum'}</small></span>
      <span class="ov">${j.poder}</span><span class="xp" title="XP ${xp}/100"><i style="width:${xp}%"></i></span><span class="seta" aria-hidden="true">${aberto ? '▾' : '▸'}</span></button>${aberto ? cartao(j) : ''}</div>`; };
  const minimizados = outros.length ? `<section class="tc-card tc-treino-outros"><h3>Reservas e inventário<span class="dir">${outros.length} jogador(es) · clique para abrir</span></h3><div class="tc-mins">${outros.map(min).join('')}</div></section>` : '';
  return `<section class="tc-card"><h3>${C.IMG('ic-treino')}Treinamento<span class="dir">${t.em_andamento}/${cfg.simultaneos} treinos</span></h3>
    <p class="tc-mudo tc-peq" style="margin:0">Participe de amistosos e campeonatos para ganhar XP, treine seus jogadores e alcance seus limites.</p></section>
    <div class="tc-treino-lista">${cards || '<p class="tc-mudo">Sem titulares: escale jogadores para treinar.</p>'}</div>${minimizados}`;
}

// ------------------------------------------------------------------ Amistoso
export function viewAmistoso() {
  const a = X.amistoso; if (!a.oponentes || !a.hist) return '<p class="tc-carregando">Carregando…</p>';
  const h = a.hist; const meu = C.S.meu.poder;
  const ops = a.oponentes.map((o) => {
    const dif = Math.round((o.poder - meu) * 10) / 10;
    return `<div class="tc-oponente"><span class="esc">${escudoOrg(o, 44)}</span><div class="inf"><b>${C.esc(o.nome)}</b><small class="tc-mudo">${C.esc(o.sigla)} · ${o.tecnico ? 'técnico' : 'time do sistema'} · ${o.divisao === 'principal' ? C.esc(C.nomeLiga().principal || 'Liga principal') : C.esc(C.nomeLiga().acesso || 'Liga de acesso')}</small></div>
      <div class="pw-dif"><b>${o.poder}</b><small style="color:${dif > 3 ? 'var(--ruim)' : dif < -3 ? 'var(--bom)' : 'var(--mudo)'}">${dif > 0 ? '+' : ''}${dif}</small></div>
      <button type="button" class="tc-btn ouro peq" data-act="amistoso" data-id="${o.id}" ${C.S.ocupado ? 'disabled' : ''}>Desafiar</button></div>`;
  }).join('');
  const hist = h.lista.map((x) => `<tr><td>${C.dataCurta ? C.dataCurta(x.dia) : C.esc(x.dia)}</td><td>${C.esc(x.oponente.nome)}</td><td class="n"><b style="color:${x.a > x.b ? 'var(--bom)' : 'var(--ruim)'}">${x.a} × ${x.b}</b></td><td class="n">${x.exp ? `<span class="tc-exp">+${x.a > x.b ? h.exp_ganho : h.exp_derrota} XP</span>` : '<span class="tc-mudo">sem XP</span>'}</td></tr>`).join('');
  return `<section class="tc-card"><h3>${C.IMG('ic-amistoso')}Amistoso<span class="dir">hoje: ${h.feitos_hoje}</span></h3>
    <p class="tc-mudo tc-peq" style="margin:0">Desafie outro time para uma partida de treino (scrim) de verdade: picks e bans, depois a simulação com os campeões. Não vale pontos de campeonato. Você pode jogar quantos quiser por dia, mas só os <b>${h.exp_por_dia} primeiros</b> dão XP para os seus titulares (<b>+${h.exp_ganho} na vitória</b> e <b>+${h.exp_derrota ?? 5} na derrota</b>); os demais não contam para nada.</p>
    <div class="tc-exp-dia">${Array.from({ length: h.exp_por_dia }, (_, i) => `<i class="${i < h.feitos_hoje ? 'on' : ''}"></i>`).join('')}<span>${h.com_exp_restantes > 0 ? `${h.com_exp_restantes} amistoso(s) com XP e maestria restante(s) hoje` : 'XP e maestria de hoje já foram todos ganhos'}</span></div></section>
    <section class="tc-card"><h3>Adversários</h3><div class="tc-oponentes">${ops || '<p class="tc-mudo">Nenhum time disponível.</p>'}</div></section>
    <section class="tc-card"><h3>Seus últimos amistosos</h3>${hist ? `<table class="tc-tabela"><tbody>${hist}</tbody></table>` : '<p class="tc-mudo" style="margin:0">Você ainda não jogou nenhum amistoso.</p>'}</section>`;
}
// "Seus Legados" agrupados por raridade (do Mítico ao Comum); dentro de cada grupo, do maior OVR para o menor.
function legadosPorRaridade(lista) {
  const grupos = [...ORDEM_RAR].reverse().map((r) => [r, lista.filter((j) => (rar(j) || 'comum') === r).sort((a, b) => (b.poder || 0) - (a.poder || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))]).filter(([, l]) => l.length);
  return `<section class="tc-card"><h3>Seus Legados<span class="dir">${lista.length} jogador(es)</span></h3>
    ${grupos.map(([r, l]) => `<div class="tc-grupo-rar r-${r}"><h4><i class="bol" style="background:${RARIDADES[r].cor}"></i>${RARIDADES[r].nome}<small>${l.length}</small></h4><div class="tc-minis">${l.map((j) => miniCartao(j)).join('')}</div></div>`).join('')}</section>`;
}
// ------------------------------------------------------------------ Recrutar
export function viewRecrutar() {
  const r = X.recrutar; if (!r) return '<p class="tc-carregando">Carregando…</p>';
  const cfg = r.config; const livresN = r.elenco_max - r.elenco;
  const livresTxt = livresN <= 0 ? ' <b style="color:var(--ruim)">Inventário cheio: demita ou venda alguém para abrir espaço.</b>' : livresN < 5 ? ` <b style="color:#fbbf24">Espaço livre no inventário: ${livresN}. Abrir 5 baús exige 5 vagas.</b>` : '';
  const rc = (cfg.moeda || 'rc') === 'rc'; const unid = rc ? 'RC' : 'cr.'; const precoUn = (b) => (rc ? b.rc : b.creditos); const classe = rc ? 'rc' : 'cr';
  const preco5 = (b) => Math.round(precoUn(b) * 5 * (1 - cfg.desconto_5));
  const baus = Object.entries(cfg.baus).map(([id, b]) => {
    const odds = ORDEM_RAR.map((k) => `<li class="r-${k}"><span>${RARIDADES[k].nome}</span><b>${(b.odds[k] ?? 0).toLocaleString(localeAtual(), { maximumFractionDigits: 1 })}%</b></li>`).join('');
    const garantia = r.garantia?.[id] ?? 0;
    const bloq1 = r.saldo < precoUn(b) || livresN < 1 || C.S.ocupado; const bloq5 = r.saldo < preco5(b) || livresN < 5 || C.S.ocupado;
    return `<section class="tc-card tc-bau bau-${id}"><div class="arte"><img class="bau-img" src="img/baus/${id}-fechado.webp" alt="" /></div><h3>${C.esc(b.nome)}</h3>
      <ul class="tc-odds">${odds}</ul>
      <small class="tc-mudo">${b.garantia ? `Garantia: um ${RARIDADES[b.garantia.raridade].nome} a cada ${b.garantia.a_cada} baús (${Math.min(garantia, b.garantia.a_cada)}/${b.garantia.a_cada}).` : ''}</small>
      <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="recrutar" data-bau="${id}" data-qtd="1" ${bloq1 ? 'disabled' : ''}>Abrir 1 · <span class="tc-preco ${classe}">${C.fmt(precoUn(b))}</span></button>
      <button type="button" class="tc-btn ciano" data-act="recrutar" data-bau="${id}" data-qtd="5" ${bloq5 ? 'disabled' : ''}>Abrir 5 · <span class="tc-preco ${classe}">${C.fmt(preco5(b))}</span> <i class="tc-desc">-${Math.round(cfg.desconto_5 * 100)}%</i></button></div></section>`;
  }).join('');
  const livres = r.legados.por_raridade || {};
  return `<section class="tc-card"><h3>${C.IMG('ic-recrutar')}Recrutar<span class="dir">${C.fmt(r.saldo)} ${unid}</span></h3>
    <p class="tc-mudo tc-peq" style="margin:0">Recrute jogadores Legado, ídolos reais do cenário competitivo, e leve a sua equipe ao topo do mundo.${livresTxt}</p>
    <div class="tc-raras">${ORDEM_RAR.map((k) => `<span class="r-${k}">${RARIDADES[k].nome}: ${livres[k] ?? 0} no catálogo</span>`).join('')}</div></section>
    <div class="tc-baus">${baus}</div>
    ${r.meus_legados.length ? legadosPorRaridade(r.meus_legados) : ''}`;
}
export function modalRecrutar(m) {
  const itens = m.r.itens || [];
  return `<h2>${itens.length > 1 ? 'Você recrutou!' : 'Novo jogador Legado!'}</h2><p class="tc-mudo tc-peq">Pagamento: ${C.fmt(m.r.preco)} ${m.r.moeda === 'rc' ? 'RC' : 'créditos'}. Os jogadores já estão no seu elenco (Legados não têm contrato). Repetidos viram cópias para subir estrelas.</p>
    <div class="tc-revelar">${itens.map((x, i) => `<div class="tc-carta r-${x.raridade}" style="animation-delay:${i * 0.18}s"><div class="faixa">${RARIDADES[x.raridade]?.nome || ''}${x.repetida ? ' · repetido' : ''}</div>${miniCartao(x.jogador)}${x.repetida ? `<small class="tc-mudo">+1 cópia (você tem ${x.jogador.copias})</small>` : ''}</div>`).join('')}</div>
    <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="fechar">Fechar</button></div>`;
}

// ------------------------------------------------------------------ ações dos botões
export async function tratarAcao(act, b) {
  if (act === 'treino-abrir') { const id = Number(b.dataset.id); if (X.abertos.has(id)) X.abertos.delete(id); else X.abertos.add(id); return true; }
  if (act === 'treinar') {
    const r = await C.agir(() => api.treinar(Number(b.dataset.id), b.dataset.attr, C.novaChave()), { ok: 'Treino iniciado!', recarregar: false });
    if (r) { await C.agir(async () => { X.treino = await api.treinoEstado(); await C.atualizarMeu(); }, { recarregar: false }); ligarRelogio(); }
    return true;
  }
  if (act === 'amistoso') {
    const r = await C.agir(() => api.amistoso(Number(b.dataset.id), C.novaChave()), { recarregar: false });
    if (r && r !== true && r.id) location.href = `partida/?amistoso=${r.id}`; // a partida roda na tela da simulação, depois dos picks e bans
    return true;
  }
  if (act === 'recrutar') {
    const qtd = Number(b.dataset.qtd); const bau = b.dataset.bau;
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const pedido = C.agir(() => api.recrutar(bau, qtd, C.novaChave()), { recarregar: false });
    const atualizar = () => C.agir(async () => { await C.atualizarMeu(); X.recrutar = await api.recrutarInfo(); }, { recarregar: false });
    if (reduzido) {
      const r = await pedido;
      if (r && r !== true) { C.S.modal = { t: 'recrutar', r, contrato: 0 }; await atualizar(); }
      return true;
    }
    // abertura em tela cheia: o servidor já sorteou; a animação só apresenta o resultado
    await abrirBau({
      bau, qtd, resultado: pedido,
      renderCarta: (it) => `<div class="faixa">${RARIDADES[it.raridade]?.nome || ''}${it.repetida ? ' · repetido' : ''}</div>${miniCartao(it.jogador)}${it.repetida ? `<small class="tc-mudo">+1 cópia (você tem ${it.jogador.copias})</small>` : ''}`,
      titulo: (itens) => (itens.length > 1 ? 'Você recrutou!' : 'Novo jogador Legado!'),
      final: (itens) => { const rep = itens.filter((i) => i.repetida).length; return `${itens.length > 1 ? `${itens.length} jogadores` : 'Jogador'} no seu inventário${rep ? ` · ${rep} repetido(s) viraram cópia` : ''}`; },
    });
    await atualizar();
    return true;
  }
  return false;
}
