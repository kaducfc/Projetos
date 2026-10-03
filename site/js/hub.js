// Página inicial: cards dos jogos com a situação de hoje, mini painel da
// ranqueada (elos, minha divisão, top 3 do dia) e microanimações.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { GAMES, SITE_NAME } from '../shared/config.js';
import { mountSiteFooter } from '../shared/footer.js';
import {
  ELOS, PARTIDAS_POR_DIA, PDR_DIVISAO, INATIVIDADE,
  eloInfo, nivelElo, emblemaHtml, divisaoDe, nomeDivisao,
} from '../shared/ranked.js';
import { avatarHtml } from '../shared/avatar.js';
import { nickHtml } from '../shared/apoio.js';
import { dayIndex, msToNextDay, fmtCountdown } from '../shared/diario.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const fmtSinal = (n) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtNum(Math.abs(Math.round(n || 0)))}`;
const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Número que conta do zero quando a página abre (data-conta; data-sinal = com +/−).
const conta = (n, sinal = false) => `<b data-conta="${Number(n) || 0}"${sinal ? ' data-sinal' : ''}>${sinal ? fmtSinal(n) : fmtNum(n)}</b>`;
const pdrTxt = (n) => `<span class="${n > 0 ? 'pdr-mais' : n < 0 ? 'pdr-menos' : ''}">${conta(n, true)} PDR</span>`;

document.title = SITE_NAME;
mountSiteBar(document.getElementById('site-bar'), { showBrand: true });
mountSiteFooter(document.getElementById('site-footer'));

// Capas dos jogos, montadas com as imagens do site.
const A = '/shared/assets';
const CAPAS = {
  // Um pedaço da tela da carreira: escudo do OVR (diamante, 91) e o resumo.
  'carreira-no-rift': `<div class="cv cv-mapa cv-car" style="--img:url(${A}/mapa/summoners-rift-640.webp)">
      <div class="cv-car-ovr"><img src="${A}/trofeus/diamante.png" alt="" loading="lazy" /><small>OVR</small><b>91</b></div>
      <div class="cv-car-info">
        <b class="cv-car-nick">GOAT</b>
        <span class="cv-car-chips"><i>🇧🇷 BR</i><i>MID</i><i class="tit">Titular</i></span>
        <span class="cv-car-trofeus">${['circuito-desafiante', 'cblol', 'first-stand', 'mvp', 'msi', 'lck', 'mundial']
          .map((t) => `<img src="${A}/trofeus/${t}.png${t === 'cblol' ? '?v=2' : ''}" alt="" loading="lazy" />`).join('')}</span>
      </div></div>`,
  runetermo: `<div class="cv cv-runas"><div class="cv-letras">${[['B', 'ok'], ['A', 'quase'], ['R', 'nao'], ['O', 'ok'], ['N', 'ok']]
    .map(([l, c]) => `<span class="${c}">${l}</span>`).join('')}</div></div>`,
  // Três chutes do Campeão Oculto (ano, gênero, região, posição, classe, espécie,
  // alcance), o mais recente em cima, como no jogo: o último acertou tudo.
  campeao: `<div class="cv cv-oculto" style="--img:url(${A}/icones/raposa-encantada.webp)"><div class="cv-chutes">${[
    ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
    [['miss', '↓'], 'ok', 'ok', 'part', 'ok', 'miss', 'ok'],
    [['miss', '↑'], 'miss', 'part', 'miss', 'ok', 'miss', 'part'],
  ].map((linha) => `<div>${linha.map((c) => (Array.isArray(c) ? `<span class="${c[0]}">${c[1]}</span>` : `<span class="${c}"></span>`)).join('')}</div>`).join('')}</div></div>`,
  escala: `<div class="cv cv-escala"><span class="cv-sil azul" style="--img:url(/jogos/escala/dados/silhuetas/garen.webp)"></span>
      <span class="cv-sil verm" style="--img:url(/jogos/escala/dados/silhuetas/teemo.webp)"></span></div>`,
  // O time dos sonhos, como na tela do Lendas (melhor OVR de cada um no jogo).
  cblol: `<div class="cv cv-cblol cv-dream">
      <div class="cv-dream-esq"><div class="cv-dream-ovr"><img src="${A}/trofeus/challenger.png" alt="" loading="lazy" /><small>OVR</small><b>96</b></div>
        <b class="cv-dream-nome">Dream Team</b></div>
      <div class="cv-dream-lista">
        ${[['Top', 'Mylon', 97], ['Jungle', 'Revolta', 96], ['Mid', 'Kami', 96], ['ADC', 'brTT', 96], ['Suporte', 'Loop', 95], ['Reserva', 'Rakin', 88], ['Técnico', 'Abaxial', 94]]
          .map(([r, n, o]) => `<span><i>${r}</i>${n}<b>${o}</b></span>`).join('')}</div></div>`,
};
// Etiqueta no canto da capa: [texto, classe].
const SELOS = { 'carreira-no-rift': ['Ranqueada', 'rk'], runetermo: ['Diário · Ranqueada', 'rk'], campeao: ['Diário · Ranqueada', 'rk'], escala: ['Diário · Ranqueada', 'rk'], cblol: ['Ranqueada (Oculto)', 'rk'] };
// Largura ÷ altura de cada emblema recortado (shared/assets/elos/*-recorte.webp).
const PROPORCAO_EMBLEMA = { ferro: 1.06, bronze: 0.96, prata: 0.98, ouro: 0.97, platina: 0.97, esmeralda: 0.99, diamante: 0.92, mestre: 0.91, 'grao-mestre': 1.02, desafiante: 1 };
const TAMANHO_FILA = [32.4, 37, 38, 39, 40, 41, 42, 46, 49, 52];
const JOGOS_DO_DIA = ['carreira-no-rift', 'runetermo', 'campeao', 'escala', 'cblol'];

let resultados = [];
let rk = null; // platform.rankedStatus()
let diarios = null; // platform.diarioHoje()
let top = null; // ranking do dia

// ------------------------------------------------- situação de hoje por jogo

// Runetermo e Campeão Oculto começaram juntos (mesmo dia 0).
const HOJE = () => dayIndex('2026-09-29');

// { estado: 'novo' | 'jogando' | 'ganhou' | 'perdeu', tentativas, pdr }
function estadoDiario(id) {
  const srv = diarios?.[id];
  if (srv) {
    return { estado: srv.status === 'novo' ? (srv.tentativas ? 'jogando' : 'novo') : srv.status, tentativas: srv.tentativas, pdr: srv.pdr };
  }
  if (diarios) return { estado: 'novo' };
  // Sem conta (ou servidor fora): o que está salvo neste aparelho.
  const s = platform.loadLocalSave(id);
  const h = s?.history?.[HOJE()];
  if (h) return { estado: h.won ? 'ganhou' : 'perdeu', tentativas: h.tries };
  const n = s?.day === HOJE() ? (s.guesses?.length || 0) + (id === 'campeao' && s.hint ? 1 : 0) + (s.hint2 ? 1 : 0) : 0;
  return n ? { estado: 'jogando', tentativas: n } : { estado: 'novo' };
}

// Na Medida: { estado: 'novo' | 'jogando' | 'terminou', rodadas, media, pdr, total }.
function estadoEscala() {
  if (diarios) {
    const e = diarios.escala;
    return e ? { estado: e.status, rodadas: e.rodadas, media: e.media, pdr: e.pdr } : { estado: 'novo' };
  }
  const d = platform.loadLocalSave('escala')?.diario;
  if (!d || d.dia !== dayIndex('2026-10-01') || !Array.isArray(d.rodadas)) return { estado: 'novo' };
  const feitas = d.rodadas.filter((r) => r.pontos != null);
  const total = feitas.reduce((t, r) => t + r.pontos, 0);
  if (!feitas.length) return { estado: 'novo' };
  return { estado: feitas.length >= d.rodadas.length ? 'terminou' : 'jogando', rodadas: feitas.length, total, de: d.rodadas.length };
}

function vivoEscala() {
  const e = estadoEscala();
  if (e.estado === 'terminou') {
    const txt = e.media != null
      ? `✓ Média ${Number(e.media).toLocaleString('pt-BR')}/100${e.pdr != null ? ` · ${pdrTxt(e.pdr)}` : ''}`
      : `✓ ${conta(e.total)}/${e.de * 100} hoje`;
    return `<p class="hx-live ok">${txt}<span class="hx-cd">Próxima em <b data-cd>${fmtCountdown(msToNextDay())}</b></span></p>`;
  }
  if (e.estado === 'jogando') {
    return `<p class="hx-live meio"><i class="hx-dot"></i>Em andamento · rodada ${Math.min(5, (e.rodadas || 0) + 1)} de 5</p>`;
  }
  return `<p class="hx-live novo"><i class="hx-dot"></i>${diarios ? 'Ranqueada de hoje disponível' : 'Novas comparações disponíveis'}</p>`;
}

// Feito hoje (para o contador do painel e a marca no card).
function feitoHoje(id) {
  if (id === 'escala') return estadoEscala().estado === 'terminou';
  if (id === 'runetermo' || id === 'campeao') return ['ganhou', 'perdeu'].includes(estadoDiario(id).estado);
  return Boolean(rk?.hoje?.jogos?.[id]);
}

function vivoDiario(id) {
  const e = estadoDiario(id);
  const campeao = id === 'campeao';
  if (e.estado === 'ganhou' || e.estado === 'perdeu') {
    const pdr = e.pdr != null ? ` · ${pdrTxt(e.pdr)}` : '';
    return `<p class="hx-live ${e.estado === 'ganhou' ? 'ok' : 'nao'}">${e.estado === 'ganhou' ? `✓ Acertou em ${e.tentativas}` : '✗ Não foi hoje'}${pdr}
      <span class="hx-cd">${campeao ? 'Próximo' : 'Próxima'} em <b data-cd>${fmtCountdown(msToNextDay())}</b></span></p>`;
  }
  if (e.estado === 'jogando') {
    return `<p class="hx-live meio"><i class="hx-dot"></i>Em andamento · ${e.tentativas} ${e.tentativas === 1 ? 'tentativa' : 'tentativas'}</p>`;
  }
  return `<p class="hx-live novo"><i class="hx-dot"></i>${campeao ? 'Novo campeão' : 'Nova palavra'} disponível</p>`;
}

// Carreira no Rift e Lendas do CBLOL: vagas ranqueadas do dia.
function vivoVagas(id) {
  const u = platform.getUser();
  let andamento = '';
  if (id === 'carreira-no-rift') {
    const p = platform.loadLocalSave(id)?.player;
    if (p && !p.retired && p.nick) andamento = `<span class="hx-sub">Carreira em andamento: <b>${esc(p.nick)}</b>, ${Number(p.age) || '?'} anos</span>`;
  }
  let linha = '';
  if (!platform.cloudEnabled()) linha = '';
  else if (!u) linha = '<span class="hx-sub"><i class="hx-dot dim"></i>Entre na conta para jogar a ranqueada</span>';
  else if (rk) {
    const vagas = Math.min(PARTIDAS_POR_DIA, rk.hoje?.vagas?.[id] ?? 0);
    const r = rk.hoje?.jogos?.[id];
    const d = divisaoDe(rk.pts, rk.elo);
    const rotulo = id === 'cblol' ? 'Oculto hoje' : 'Ranqueadas hoje';
    linha = `<span class="${vagas >= PARTIDAS_POR_DIA ? 'nao' : 'novo'}">${id === 'carreira-no-rift' ? emblemaHtml(rk.jogou ? d.elo : 'ferro', 18, { vazio: !rk.jogou }) : ''}${rotulo}: <b>${vagas} de ${PARTIDAS_POR_DIA}</b>${r ? ` · ${pdrTxt(r.pdr)}` : ''}</span>`;
  }
  const partes = [linha, andamento].filter(Boolean);
  return partes.length ? `<p class="hx-live">${partes.join('<br>')}</p>` : '';
}

const VIVO = {
  'carreira-no-rift': () => vivoVagas('carreira-no-rift'),
  cblol: () => vivoVagas('cblol'),
  runetermo: () => vivoDiario('runetermo'),
  campeao: () => vivoDiario('campeao'),
  escala: vivoEscala,
};

function renderGames() {
  const logado = Boolean(platform.getUser() && rk);
  // Jogos em teste (oculto: true) funcionam pelo link, mas ainda não aparecem aqui.
  document.getElementById('games').innerHTML = GAMES.filter((g) => !g.oculto).map((g, i) => {
    const mine = resultados.filter((r) => r.gameId === g.id);
    const best = mine.reduce((m, r) => (r.score != null && (m == null || r.score > m) ? r.score : m), null);
    const stats = mine.length
      ? `<p class="game-stats">${mine.length} ${mine.length === 1 ? 'partida' : 'partidas'} · recorde ${best == null ? '<b>—</b>' : conta(best)}</p>`
      : '';
    const live = g.status === 'live';
    const selo = SELOS[g.id];
    const feito = (logado || ['runetermo', 'campeao', 'escala'].includes(g.id)) && feitoHoje(g.id);
    const capa = `<div class="hx-cover">${CAPAS[g.id] || ''}${selo ? `<span class="hx-selo ${selo[1] || ''}">${selo[0]}</span>` : ''}
      ${feito ? '<span class="hx-feito" title="Já jogou hoje">✓ Hoje</span>' : ''}</div>`;
    const corpo = `<div class="hx-body">
        <p class="game-kind">${esc(g.kind)}</p>
        <h3>${esc(g.name)}</h3>
        <p class="game-tag">${esc(g.tagline)}</p>
        ${live ? VIVO[g.id]?.() || '' : ''}
        ${stats}
        ${live ? `<span class="btn-primary hx-play" style="--d:${(i * 1.4).toFixed(1)}s">Jogar</span>` : '<span class="badge">Em breve</span>'}
      </div>`;
    return live
      ? `<a class="game hx-card hx-frame" href="${g.path}" style="--i:${i}">${capa}${corpo}</a>`
      : `<article class="game hx-card hx-frame soon" style="--i:${i}">${capa}${corpo}</article>`;
  }).join('');
}

// ------------------------------------------------------ painel da ranqueada

function renderPainel() {
  const el = document.getElementById('rk-painel');
  const u = platform.getUser();
  const jogou = Boolean(u && rk?.jogou);
  const d = rk ? divisaoDe(rk.pts, rk.elo) : null;
  const nivel = jogou ? nivelElo(d.elo) : -1;
  // Emblemas recortados (sem sobra), do mesmo "tamanho visual" (área) e
  // crescendo de leve do Ferro ao Diamante; do Mestre para cima, um pouco mais.
  const fila = ELOS.map((e, i) => {
    const lado = TAMANHO_FILA[i] / Math.sqrt(PROPORCAO_EMBLEMA[e.id] || 1);
    return `<div class="rp-elo${i === nivel ? ' atual' : ''}${i < nivel ? ' passou' : ''}" title="${esc(e.nome)}" style="--cor:${e.cor}">
      <div class="rp-emb"><img class="emblema${i > nivel ? ' vazio' : ''}" src="/shared/assets/elos/${e.id}-recorte.webp" alt="" style="--h:${lado.toFixed(1)}" decoding="async" /></div>
      <span>${esc(e.nome)}</span></div>`;
  }).join('');

  let status = '';
  if (!platform.cloudEnabled()) {
    status = '<p class="rp-status">A ranqueada precisa de conexão com o servidor do site.</p>';
  } else if (!u) {
    status = `<p class="rp-status">Entre na sua conta e todos os jogos passam a valer PDR para subir do Ferro ao Desafiante.</p>
      <button type="button" class="hx-btn rp-entrar" data-act="entrar">Entrar para jogar a ranqueada</button>`;
  } else if (!rk) {
    status = '<p class="rp-status muted">Carregando…</p>';
  } else {
    const e = eloInfo(d.elo);
    const apex = nivelElo(d.elo) >= 7;
    let meta;
    if (apex) {
      meta = `${conta(d.pdr)} PDR${rk.posicao_topo ? ` · <b>#${rk.posicao_topo}</b> no topo` : ''}`;
    } else {
      const prox = d.divisao > 1 ? `${e.nome} ${d.divisao - 1}` : eloInfo(ELOS[nivelElo(d.elo) + 1].id).nome;
      meta = `${conta(d.pdr)} de ${PDR_DIVISAO} PDR para ${esc(prox)}`;
    }
    const hojePdr = rk.hoje?.pdr || 0;
    const feitos = JOGOS_DO_DIA.filter(feitoHoje).length;
    const pips = JOGOS_DO_DIA.map((id) => `<i class="${feitoHoje(id) ? 'on' : ''}" title="${esc(GAMES.find((g) => g.id === id)?.name || '')}"></i>`).join('');
    let inativo = '';
    if (rk.jogou && rk.pts > 900 && rk.ultima_atividade && !hojePdr) {
      const dias = Math.round((Date.parse(rk.hoje.dia) - Date.parse(rk.ultima_atividade)) / 864e5);
      if (dias > INATIVIDADE.dias) inativo = `<p class="rp-alerta">⚠ ${dias} dias sem jogar: você está perdendo ${Math.abs(INATIVIDADE.pdr)} PDR por dia. Jogue hoje para parar a queda.</p>`;
      else if (dias >= 2) inativo = `<p class="rp-alerta">⚠ ${dias} dias sem jogar: a partir do ${INATIVIDADE.dias + 1}º dia parado você perde ${Math.abs(INATIVIDADE.pdr)} PDR por dia. Jogue hoje para não perder PDR.</p>`;
    }
    status = `<p class="rp-status">Você é <b style="color:${e.cor}">${esc(rk.jogou ? nomeDivisao(d) : 'Ferro 3')}</b> · ${meta} · hoje: ${pdrTxt(hojePdr)}</p>
      ${apex ? '' : `<div class="rp-barra"><i style="width:${Math.min(100, d.pdr)}%;background:${e.cor}"></i></div>`}
      <p class="rp-hoje"><span class="rp-pips">${pips}</span>Hoje: <b>${feitos} de ${JOGOS_DO_DIA.length}</b> jogos feitos</p>
      ${inativo}`;
  }

  const lista = top?.lista?.filter((j) => j.valor > 0).slice(0, 3) || [];
  const podio = lista.length
    ? lista.map((j) => `<li class="rp-top p${j.pos}${j.eu ? ' eu' : ''}"><span class="rp-pos">${j.pos}</span>${avatarHtml(j.avatar, j.username, 34, `elo-${j.elo}`)}
        <span class="rp-nome">${nickHtml(j.username, j.apoiador)}</span><span class="rp-pts">${conta(j.valor, true)}<small>PDR</small></span></li>`).join('')
    : `<li class="rp-vazio">${top ? 'Ninguém ganhou PDR hoje ainda. Seja o primeiro!' : platform.cloudEnabled() ? 'Carregando…' : 'O ranking aparece aqui.'}</li>`;

  el.innerHTML = `
    <div class="rp-main">
      <p class="eyebrow">◆ Ranqueada · todos os jogos</p>
      <h2 class="rp-titulo">Do Ferro ao Desafiante</h2>
      <div class="rp-fila${jogou ? '' : ' apagada'}">${fila}</div>
      ${status}
    </div>
    <div class="rp-lado">
      <p class="rp-lado-tit">Top 3 de hoje</p>
      <ol class="rp-podio">${podio}</ol>
      <a class="rp-cta" href="ranking/">Ver ranking completo →</a>
    </div>`;
}

// ------------------------------------------------------------ microanimações

const jaContou = new Set();
// Números contam do zero até o valor (cada número só na primeira vez que aparece).
function contar() {
  const vistos = new Map();
  document.querySelectorAll('[data-conta]').forEach((el) => {
    const alvo = Number(el.dataset.conta);
    const lugar = el.closest('.hx-card')?.getAttribute('href') || 'painel';
    const base = `${lugar}|${alvo}`;
    const n = (vistos.get(base) || 0) + 1;
    vistos.set(base, n);
    const chave = `${base}|${n}`;
    if (reduzido || !alvo || jaContou.has(chave)) return;
    jaContou.add(chave);
    const sinal = 'sinal' in el.dataset;
    const ini = performance.now();
    const passo = (t) => {
      const k = Math.min(1, (t - ini) / 900);
      const v = Math.round(alvo * (1 - (1 - k) ** 3));
      el.textContent = sinal ? fmtSinal(v) : fmtNum(v);
      if (k < 1) requestAnimationFrame(passo);
    };
    el.textContent = sinal ? fmtSinal(0) : '0';
    requestAnimationFrame(passo);
  });
}

function render() {
  renderGames();
  renderPainel();
  contar();
}

// Relógio dos jogos diários; na virada do dia, recarrega a situação.
let dia = HOJE();
setInterval(() => {
  const ms = msToNextDay();
  document.querySelectorAll('[data-cd]').forEach((el) => { el.textContent = fmtCountdown(ms); });
  if (HOJE() !== dia) {
    dia = HOJE();
    refresh();
  }
}, 1000);

// ---------------------------------------------------------------------- dados

let carregando = null;
async function refresh() {
  if (carregando) return carregando;
  carregando = (async () => {
    await platform.init();
    const logado = Boolean(platform.getUser());
    const [res, status, dh, rank] = await Promise.all([
      platform.listResults({ limit: 100 }),
      logado ? platform.rankedStatus() : null,
      logado ? platform.diarioHoje() : null,
      platform.cloudEnabled() ? platform.ranking('diario').catch(() => null) : null,
    ]);
    resultados = res;
    rk = status;
    diarios = dh;
    top = rank;
    render();
  })();
  try {
    await carregando;
  } finally {
    carregando = null;
  }
}

document.getElementById('rk-painel').addEventListener('click', (e) => {
  if (e.target.closest('[data-act="entrar"]')) openAuthModal('login');
});
platform.onChange((evt) => {
  if (evt.type === 'auth' && !evt.user) {
    rk = null;
    diarios = null;
  }
  if (evt.type === 'auth' || evt.type === 'results') refresh();
});
// Voltando de um jogo pelo "voltar" do navegador: atualiza a situação.
addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });

render();
refresh();
