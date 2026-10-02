// PRÉVIA (itens 4, 5 e 6) da página inicial: informação viva nos cards,
// mini painel da ranqueada e microanimações. Não é a página publicada.
import * as platform from '/shared/platform.js';
import { mountSiteBar } from '/shared/account.js';
import { GAMES, SITE_NAME } from '/shared/config.js';
import { mountSiteFooter } from '/shared/footer.js';
import { ELOS, PARTIDAS_POR_DIA, eloInfo, emblemaHtml } from '/shared/ranked.js';
import { avatarHtml } from '/shared/avatar.js';
import { nickHtml } from '/shared/apoio.js';
import { dayIndex, msToNextDay, fmtCountdown } from '/shared/diario.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const fmtScore = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

document.title = `${SITE_NAME} · prévia`;
mountSiteBar(document.getElementById('site-bar'), { showBrand: true, hubHref: '/' });
mountSiteFooter(document.getElementById('site-footer'));

const A = '/shared/assets';
const CAPAS = {
  'carreira-no-rift': `<div class="cv cv-mapa" style="--img:url(${A}/mapa/summoners-rift-640.webp)">
      <img class="cv-trofeu" src="${A}/trofeus/mundial.png" alt="" loading="lazy" /></div>`,
  runetermo: `<div class="cv cv-runas"><div class="cv-letras">${[['B', 'ok'], ['A', 'quase'], ['R', 'nao'], ['O', 'ok'], ['N', 'ok']]
    .map(([l, c]) => `<span class="${c}">${l}</span>`).join('')}</div></div>`,
  campeao: `<div class="cv cv-oculto" style="--img:url(${A}/icones/raposa-encantada.webp)"><span class="cv-q">?</span></div>`,
  cblol: `<div class="cv cv-cblol"><img class="cv-trofeu grande" src="${A}/trofeus/cblol.png?v=2" alt="" loading="lazy" /></div>`,
};
const SELOS = { 'carreira-no-rift': ['Ranqueada', 'rk'], runetermo: ['Diário'], campeao: ['Diário'], cblol: ['Novo', 'novo'] };

let rk = null; // platform.rankedStatus()
let top = null; // ranking diário (top 3)

// ------------------------------------------------------------ 4) info viva

const HOJE = dayIndex('2026-09-29'); // Runetermo e Campeão Oculto começaram juntos

// Jogo diário: já jogou hoje? ganhou? quanto falta para o próximo?
function vivoDiario(id, palavra) {
  const s = platform.loadLocalSave(id);
  const h = s?.history?.[HOJE];
  if (h) {
    return `<p class="hx-live ${h.won ? 'ok' : 'nao'}">${h.won ? `✓ Acertou em ${h.tries}` : `✗ Não foi hoje`}
      <span class="hx-cd">${palavra === 'campeão' ? 'Próximo' : 'Próxima'} em <b data-cd>${fmtCountdown(msToNextDay())}</b></span></p>`;
  }
  if (s?.day === HOJE && s.guesses?.length) {
    return `<p class="hx-live meio"><i class="hx-dot"></i> Em andamento · ${s.guesses.length} ${s.guesses.length === 1 ? 'tentativa' : 'tentativas'}</p>`;
  }
  return `<p class="hx-live novo"><i class="hx-dot"></i> ${palavra === 'campeão' ? 'Novo campeão' : 'Nova palavra'} disponível</p>`;
}

function vivoCarreira() {
  const st = platform.loadLocalSave('carreira-no-rift');
  const p = st?.player;
  const andamento = p && !p.retired ? `<span class="hx-sub">Carreira em andamento: <b>${esc(p.nick)}</b>, ${p.age} anos</span>` : '';
  if (!platform.getUser()) return `<p class="hx-live"><i class="hx-dot dim"></i> Entre na conta para jogar a ranqueada${andamento ? `<br>${andamento}` : ''}</p>`;
  if (!rk) return andamento ? `<p class="hx-live">${andamento}</p>` : '';
  const lim = rk.hoje.limite ?? PARTIDAS_POR_DIA;
  const feitas = rk.hoje.iniciadas ?? rk.hoje.partidas;
  return `<p class="hx-live ${feitas >= lim ? 'nao' : 'novo'}">${emblemaHtml(rk.jogou ? rk.elo : 'bronze', 18, { vazio: !rk.jogou })}
    Ranqueadas hoje: <b>${feitas} de ${lim}</b>${rk.hoje.melhor != null ? ` · nota <b>${fmtScore(rk.hoje.melhor)}</b>` : ''}${andamento ? `<br>${andamento}` : ''}</p>`;
}

const VIVO = {
  'carreira-no-rift': vivoCarreira,
  runetermo: () => vivoDiario('runetermo', 'palavra'),
  campeao: () => vivoDiario('campeao', 'campeão'),
};

function renderGames(results) {
  document.getElementById('games').innerHTML = GAMES.filter((g) => !g.oculto).map((g, i) => {
    const mine = results.filter((r) => r.gameId === g.id);
    const best = mine.reduce((m, r) => (r.score != null && (m == null || r.score > m) ? r.score : m), null);
    const stats = mine.length
      ? `<p class="game-stats">${mine.length} ${mine.length === 1 ? 'partida' : 'partidas'} · recorde <b data-conta="${best ?? ''}">${fmtScore(best)}</b></p>` : '';
    const selo = SELOS[g.id];
    return `<a class="game hx-card hx-frame" href="/${g.path}" style="--i:${i}">
      <div class="hx-cover">${CAPAS[g.id] || ''}${selo ? `<span class="hx-selo ${selo[1] || ''}">${selo[0]}</span>` : ''}</div>
      <div class="hx-body">
        <p class="game-kind">${esc(g.kind)}</p>
        <h3>${esc(g.name)}</h3>
        <p class="game-tag">${esc(g.tagline)}</p>
        ${VIVO[g.id]?.() || ''}
        ${stats}
        <span class="btn-primary hx-play" style="--d:${i * 1.3}s">Jogar</span>
      </div>
    </a>`;
  }).join('');
}

// ----------------------------------------------------- 5) painel da ranqueada

function renderPainel() {
  const u = platform.getUser();
  const meu = rk?.jogou ? rk.elo : null;
  const nivel = meu ? ELOS.findIndex((e) => e.id === meu) : -1;
  const fila = ELOS.map((e, i) => `<div class="rp-elo${i === nivel ? ' atual' : ''}${i < nivel ? ' passou' : ''}" title="${esc(e.nome)}" style="--cor:${e.cor}">
      ${emblemaHtml(e.id, 52, { vazio: i > nivel })}<span>${esc(e.nome)}</span></div>`).join('<i class="rp-seta" aria-hidden="true"></i>');
  let status;
  if (!platform.cloudEnabled()) status = '';
  else if (!u) status = '<p class="rp-status">Entre na sua conta e termine carreiras na Carreira no Rift para ganhar um elo.</p>';
  else if (!rk) status = '<p class="rp-status">Carregando…</p>';
  else {
    const lim = rk.hoje.limite ?? PARTIDAS_POR_DIA;
    status = `<p class="rp-status">${meu ? `Você é <b style="color:${eloInfo(meu).cor}">${esc(eloInfo(meu).nome)}</b>` : 'Você ainda não tem elo'}
      · hoje: <b>${rk.hoje.iniciadas ?? rk.hoje.partidas} de ${lim}</b> carreiras ranqueadas
      ${rk.proximo ? `· ciclo: <b data-conta="${rk.ciclo.total ?? 0}">${fmtScore(rk.ciclo.total ?? 0)}</b> de ${fmtScore(rk.proximo.pontos)} para ${esc(eloInfo(rk.proximo.elo).nome)}` : ''}</p>`;
  }
  const lista = top?.lista?.slice(0, 3) || [];
  const podio = lista.length
    ? lista.map((j) => `<li class="rp-top p${j.pos}"><span class="rp-pos">${j.pos}</span>${avatarHtml(j.avatar, j.username, 34, `elo-${j.elo}`)}
        <span class="rp-nome">${nickHtml(j.username, j.apoiador)}</span><b data-conta="${j.pontos}">${fmtScore(j.pontos)}</b></li>`).join('')
    : `<li class="rp-vazio">${top ? 'Ninguém pontuou hoje ainda. Seja o primeiro!' : 'O ranking aparece aqui.'}</li>`;
  document.getElementById('rk-painel').innerHTML = `
    <div class="rp-main">
      <p class="eyebrow">◆ Ranqueada · Carreira no Rift</p>
      <h2 class="rp-titulo">Do Bronze ao Desafiante</h2>
      <div class="rp-fila">${fila}</div>
      ${status}
    </div>
    <div class="rp-lado">
      <p class="rp-lado-tit">Top 3 de hoje</p>
      <ol class="rp-podio">${podio}</ol>
      <a class="rp-cta" href="/ranking/">Ver ranking completo →</a>
    </div>`;
}

// ------------------------------------------------------- 6) microanimações

// Números contam do zero até o valor quando aparecem.
function contar(root = document) {
  if (reduzido) return;
  root.querySelectorAll('[data-conta]').forEach((el) => {
    const alvo = Number(el.dataset.conta);
    if (!Number.isFinite(alvo) || !alvo || el.dataset.contado) return;
    el.dataset.contado = '1';
    const ini = performance.now();
    const passo = (t) => {
      const k = Math.min(1, (t - ini) / 900);
      el.textContent = fmtScore(Math.round(alvo * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}

// Relógio dos jogos diários.
setInterval(() => {
  document.querySelectorAll('[data-cd]').forEach((el) => { el.textContent = fmtCountdown(msToNextDay()); });
}, 1000);

// ------------------------------------------------------------------ dados

async function refresh() {
  await platform.init();
  const [results, status, rank] = await Promise.all([
    platform.listResults({ limit: 100 }),
    platform.getUser() ? platform.rankedStatus() : null,
    platform.cloudEnabled() ? platform.ranking('diario').catch(() => null) : null,
  ]);
  rk = status;
  top = rank;
  renderGames(results);
  renderPainel();
  contar();
}

renderGames([]);
renderPainel();
platform.onChange((evt) => { if (evt.type === 'auth' || evt.type === 'results') refresh(); });
refresh();
