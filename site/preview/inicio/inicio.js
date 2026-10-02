// PRÉVIA do visual novo da página inicial (não é a página publicada).
// Mesma lógica do js/hub.js, com capa ilustrada em cada jogo.
import * as platform from '../../shared/platform.js';
import { mountSiteBar } from '../../shared/account.js';
import { GAMES, SITE_NAME } from '../../shared/config.js';
import { mountSiteFooter } from '../../shared/footer.js';

const A = '../../shared/assets';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const fmtScore = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

document.title = `${SITE_NAME} · prévia`;
mountSiteBar(document.getElementById('site-bar'), { showBrand: true, hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

// Capas montadas com as imagens que o site já tem.
const CAPAS = {
  'carreira-no-rift': `<div class="cv cv-mapa" style="--img:url(${A}/mapa/summoners-rift-640.webp)">
      <img class="cv-trofeu" src="${A}/trofeus/mundial.png" alt="" loading="lazy" /></div>`,
  runetermo: `<div class="cv cv-runas"><div class="cv-letras">${[['B', 'ok'], ['A', 'quase'], ['R', 'nao'], ['O', 'ok'], ['N', 'ok']]
    .map(([l, c]) => `<span class="${c}">${l}</span>`).join('')}</div></div>`,
  campeao: `<div class="cv cv-oculto" style="--img:url(${A}/icones/raposa-encantada.webp)"><span class="cv-q">?</span></div>`,
  cblol: `<div class="cv cv-cblol"><img class="cv-trofeu grande" src="${A}/trofeus/cblol.png" alt="" loading="lazy" /></div>`,
};
const SELOS = { 'carreira-no-rift': ['Ranqueada', 'rk'], runetermo: ['Diário'], campeao: ['Diário'], cblol: ['Novo', 'novo'] };

function renderGames(results) {
  document.getElementById('games').innerHTML = GAMES.filter((g) => !g.oculto).map((g, i) => {
    const mine = results.filter((r) => r.gameId === g.id);
    const best = mine.reduce((m, r) => (r.score != null && (m == null || r.score > m) ? r.score : m), null);
    const stats = mine.length
      ? `<p class="game-stats">${mine.length} ${mine.length === 1 ? 'partida' : 'partidas'} · recorde <b>${fmtScore(best)}</b></p>` : '';
    const selo = SELOS[g.id];
    const href = `../../${g.path}`;
    return `
    <a class="game hx-card hx-frame" href="${href}" style="--i:${i}">
      <div class="hx-cover">${CAPAS[g.id] || ''}${selo ? `<span class="hx-selo ${selo[1] || ''}">${selo[0]}</span>` : ''}</div>
      <div class="hx-body">
        <p class="game-kind">${esc(g.kind)}</p>
        <h3>${esc(g.name)}</h3>
        <p class="game-tag">${esc(g.tagline)}</p>
        ${stats}
        <span class="btn-primary hx-play">Jogar</span>
      </div>
    </a>`;
  }).join('');
}

async function refresh() {
  renderGames(await platform.listResults({ limit: 100 }));
}
renderGames([]);
platform.onChange((evt) => { if (evt.type === 'auth' || evt.type === 'results') refresh(); });
refresh();
