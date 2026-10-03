import * as platform from '../shared/platform.js';
import { mountSiteBar } from '../shared/account.js';
import { GAMES, SITE_NAME } from '../shared/config.js';
import { mountSiteFooter } from '../shared/footer.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmtScore = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

document.title = SITE_NAME;
mountSiteBar(document.getElementById('site-bar'), { showBrand: true });
mountSiteFooter(document.getElementById('site-footer'));

// Capas dos jogos, montadas com as imagens do site.
const A = '/shared/assets';
const CAPAS = {
  'carreira-no-rift': `<div class="cv cv-mapa" style="--img:url(${A}/mapa/summoners-rift-640.webp)">
      <img class="cv-trofeu" src="${A}/trofeus/mundial.png" alt="" loading="lazy" /></div>`,
  runetermo: `<div class="cv cv-runas"><div class="cv-letras">${[['B', 'ok'], ['A', 'quase'], ['R', 'nao'], ['O', 'ok'], ['N', 'ok']]
    .map(([l, c]) => `<span class="${c}">${l}</span>`).join('')}</div></div>`,
  campeao: `<div class="cv cv-oculto" style="--img:url(${A}/icones/raposa-encantada.webp)"><span class="cv-q">?</span></div>`,
  cblol: `<div class="cv cv-cblol"><img class="cv-trofeu grande" src="${A}/trofeus/cblol.png?v=2" alt="" loading="lazy" /></div>`,
};
// Etiqueta no canto da capa: [texto, classe].
const SELOS = { 'carreira-no-rift': ['Ranqueada', 'rk'], runetermo: ['Diário · Ranqueada', 'rk'], campeao: ['Diário · Ranqueada', 'rk'], cblol: ['Ranqueada (Oculto)', 'rk'] };

function renderGames(results) {
  // Jogos em teste (oculto: true) funcionam pelo link, mas ainda não aparecem aqui.
  document.getElementById('games').innerHTML = GAMES.filter((g) => !g.oculto).map((g, i) => {
    const mine = results.filter((r) => r.gameId === g.id);
    const best = mine.reduce((m, r) => (r.score != null && (m == null || r.score > m) ? r.score : m), null);
    const stats = mine.length
      ? `<p class="game-stats">${mine.length} ${mine.length === 1 ? 'partida' : 'partidas'} · recorde <b>${fmtScore(best)}</b></p>`
      : '';
    const live = g.status === 'live';
    const selo = SELOS[g.id];
    const capa = `<div class="hx-cover">${CAPAS[g.id] || ''}${selo ? `<span class="hx-selo ${selo[1] || ''}">${selo[0]}</span>` : ''}</div>`;
    const corpo = `<div class="hx-body">
        <p class="game-kind">${esc(g.kind)}</p>
        <h3>${esc(g.name)}</h3>
        <p class="game-tag">${esc(g.tagline)}</p>
        ${stats}
        ${live ? '<span class="btn-primary hx-play">Jogar</span>' : '<span class="badge">Em breve</span>'}
      </div>`;
    return live
      ? `<a class="game hx-card hx-frame" href="${g.path}" style="--i:${i}">${capa}${corpo}</a>`
      : `<article class="game hx-card hx-frame soon" style="--i:${i}">${capa}${corpo}</article>`;
  }).join('');
}

async function refresh() {
  const results = await platform.listResults({ limit: 100 });
  renderGames(results);
}

renderGames([]);
platform.onChange((evt) => { if (evt.type === 'auth' || evt.type === 'results') refresh(); });
refresh();
