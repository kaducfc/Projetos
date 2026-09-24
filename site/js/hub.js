import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { GAMES, SITE_NAME, gameById } from '../shared/config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const fmtDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtScore = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

document.getElementById('site-name').textContent = SITE_NAME;
document.title = SITE_NAME;
mountSiteBar(document.getElementById('site-bar'), { showBrand: true });

function renderGames(results) {
  document.getElementById('games').innerHTML = GAMES.map((g) => {
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

function renderHistory(results) {
  const u = platform.getUser();
  const note = document.getElementById('hist-note');
  if (!platform.cloudEnabled()) note.textContent = 'Salvo só neste navegador.';
  else if (u) note.textContent = `Conta de ${u.username}, salvo na nuvem.`;
  else note.innerHTML = 'Salvo só neste navegador. <button type="button" class="link" data-login>Entre</button> para guardar na sua conta.';

  const box = document.getElementById('history');
  if (!results.length) {
    box.innerHTML = '<p class="empty">Nenhuma partida ainda. Termine uma carreira no <b>Carreira no Rift</b> para ela aparecer aqui.</p>';
    return;
  }
  box.innerHTML = `
  <div class="table-wrap">
    <table class="history">
      <thead><tr><th>Jogo</th><th>Resultado</th><th class="num">Pontos</th><th>Data</th></tr></thead>
      <tbody>${results.map((r) => `
        <tr>
          <td class="game-name">${esc(gameById(r.gameId)?.name || r.gameId)}</td>
          <td>${esc(r.summary?.text || '—')}</td>
          <td class="num">${fmtScore(r.score)}</td>
          <td class="date">${fmtDate(r.playedAt)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

async function refresh() {
  const results = await platform.listResults({ limit: 100 });
  renderGames(results);
  renderHistory(results);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-login]')) openAuthModal('login');
});

renderGames([]);
renderHistory([]);
platform.onChange((evt) => { if (evt.type === 'auth' || evt.type === 'results') refresh(); });
refresh();
