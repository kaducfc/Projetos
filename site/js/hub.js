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

function renderGames(results) {
  // Jogos em teste (oculto: true) funcionam pelo link, mas ainda não aparecem aqui.
  document.getElementById('games').innerHTML = GAMES.filter((g) => !g.oculto).map((g) => {
    const mine = results.filter((r) => r.gameId === g.id);
    const best = mine.reduce((m, r) => (r.score != null && (m == null || r.score > m) ? r.score : m), null);
    const stats = mine.length
      ? `<p class="game-stats">${mine.length} ${mine.length === 1 ? 'partida' : 'partidas'} · recorde <b>${fmtScore(best)}</b></p>`
      : '';
    const live = g.status === 'live';
    return `
    <article class="game${live ? '' : ' soon'}">
      <p class="game-kind">${esc(g.kind)}</p>
      <h3>${esc(g.name)}</h3>
      <p class="game-tag">${esc(g.tagline)}</p>
      ${stats}
      ${live ? `<a class="btn-primary" href="${g.path}">Jogar</a>` : '<span class="badge">Em breve</span>'}
    </article>`;
  }).join('');
}

async function refresh() {
  const results = await platform.listResults({ limit: 100 });
  renderGames(results);
}

renderGames([]);
platform.onChange((evt) => { if (evt.type === 'auth' || evt.type === 'results') refresh(); });
refresh();
