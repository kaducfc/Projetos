// Painel do administrador: acessos do site e estatísticas dos jogos.
// Os números vêm da função site_admin_stats do Supabase, que só responde
// para contas cadastradas em site_admins.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { ROLES, REGIONS } from '../jogos/carreira-no-rift/js/data/world.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../' });
mountSiteFooter(document.getElementById('site-footer'));

const body = document.getElementById('panel-body');
const range = document.querySelector('.range');
const tip = document.getElementById('chart-tip');
let days = 30;
try { days = Number(localStorage.getItem('site.painel.dias')) || 30; } catch { /* sem storage */ }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const dec = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
const dia = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
};
const diaLongo = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

const roleName = (id) => Object.values(ROLES).find((r) => r.id === id || r.short?.toLowerCase() === id)?.name || id;
const regionName = (id) => REGIONS[id]?.name || (id === 'wc' ? 'Wildcard' : id);
const speedName = (id) => (id === 'rapido' ? 'Rápido' : id === 'normal' ? 'Normal' : id);

function tile(label, value, sub = '') {
  return `<div class="tile"><span class="t-label">${esc(label)}</span><span class="t-value">${value}</span>${sub ? `<span class="t-sub">${sub}</span>` : ''}</div>`;
}

// Colunas por dia (uma série só: o título diz o que é, sem legenda).
function columns(rows, key, unit) {
  const max = Math.max(1, ...rows.map((r) => r[key]));
  const total = rows.reduce((s, r) => s + r[key], 0);
  const cols = rows.map((r) => {
    const v = r[key];
    const h = v ? Math.max(2, (v / max) * 100) : 0;
    return `<div class="col${v ? '' : ' zero'}" data-tip="${esc(diaLongo(r.dia))}: <b>${num(v)}</b> ${unit}"><i style="height:${h}%"></i></div>`;
  }).join('');
  const mid = rows[Math.floor(rows.length / 2)];
  return {
    total,
    html: `<div class="cols" role="img" aria-label="${esc(`${num(total)} ${unit} no período`)}">
      <span class="max">${num(max)}</span><span class="gridline"></span>${cols}</div>
      <div class="cols-x"><span>${dia(rows[0].dia)}</span>${rows.length > 2 ? `<span>${dia(mid.dia)}</span>` : ''}<span>${dia(rows.at(-1).dia)}</span></div>`,
  };
}

// Distribuição em barras horizontais, da maior para a menor.
function hbars(entries, nameOf = (x) => x, { sort = true } = {}) {
  const list = sort ? entries.slice().sort((a, b) => b[1] - a[1]) : entries;
  const total = list.reduce((s, [, n]) => s + n, 0);
  if (!total) return '<p class="p-empty">Sem dados no período.</p>';
  const max = Math.max(...list.map(([, n]) => n));
  return `<div class="hbars">${list.map(([k, n]) => `
    <div class="hbar"><span class="h-label">${esc(nameOf(k))}</span>
      <span class="h-val">${num(n)} <small>${Math.round((n / total) * 100)}%</small></span>
      <span class="h-track"><i class="h-fill" style="width:${(n / max) * 100}%"></i></span></div>`).join('')}</div>`;
}

function render(st) {
  const c = st.carreira || {};
  const rows = st.por_dia || [];
  const visits = columns(rows, 'visitantes', 'visitantes');
  const games = columns(rows, 'partidas', 'carreiras iniciadas');
  const conclusao = c.iniciadas ? Math.round((c.terminadas / c.iniciadas) * 100) : null;

  body.innerHTML = `
  <section class="p-section">
    <h2>Hoje</h2>
    <div class="tiles">
      ${tile('Visitantes', num(st.hoje.visitantes), 'navegadores diferentes')}
      ${tile('Carreiras iniciadas', num(st.hoje.partidas))}
      ${tile('Carreiras terminadas', num(st.hoje.terminadas))}
      ${tile('Contas novas', num(st.hoje.contas))}
    </div>
  </section>

  <section class="p-section">
    <h2>Últimos ${st.dias} dias</h2>
    <div class="tiles">
      ${tile('Visitantes', num(st.periodo.visitantes), 'navegadores diferentes')}
      ${tile('Jogadores', num(st.periodo.jogadores), 'começaram ao menos 1 carreira')}
      ${tile('Carreiras iniciadas', num(st.periodo.partidas))}
      ${tile('Carreiras terminadas', num(st.periodo.terminadas), conclusao != null ? `${conclusao}% das iniciadas` : '')}
      ${tile('Contas novas', num(st.periodo.contas), `${num(st.total.contas)} no total`)}
    </div>
    <div class="cards">
      <div class="card"><h3>Visitantes por dia</h3><p class="c-sub">${num(visits.total)} visitas diárias somadas</p>${visits.html}</div>
      <div class="card"><h3>Carreiras iniciadas por dia</h3><p class="c-sub">${num(games.total)} no período</p>${games.html}</div>
    </div>
    <details class="p-details"><summary>Ver tabela por dia</summary>
      <div class="table-wrap"><table class="p-table">
        <thead><tr><th>Dia</th><th class="n">Visitantes</th><th class="n">Iniciadas</th><th class="n">Terminadas</th><th class="n">Contas novas</th></tr></thead>
        <tbody>${rows.slice().reverse().map((r) => `<tr><td>${esc(diaLongo(r.dia))}</td><td class="n">${num(r.visitantes)}</td><td class="n">${num(r.partidas)}</td><td class="n">${num(r.terminadas)}</td><td class="n">${num(r.contas)}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>
  </section>

  <section class="p-section">
    <h2>Carreira no Rift · últimos ${st.dias} dias</h2>
    ${c.terminadas ? '' : '<p class="p-note">As médias aparecem quando alguém terminar uma carreira (aposentadoria).</p>'}
    <div class="tiles">
      ${tile('OVR máximo médio', dec(c.ovr_medio), c.ovr_mediana != null ? `mediana ${dec(c.ovr_mediana)}` : '')}
      ${tile('Temporadas por carreira', dec(c.temporadas_media))}
      ${tile('Troféus e prêmios', dec(c.trofeus_media), 'média por carreira')}
      ${tile('Ganharam Mundial', c.mundial_pct != null ? `${dec(c.mundial_pct)}%` : '—', 'das carreiras terminadas')}
      ${tile('Pontos de legado', num(c.legado_medio), 'média')}
    </div>
    <div class="cards">
      <div class="card"><h3>OVR máximo alcançado</h3><p class="c-sub">Carreiras terminadas por faixa</p>
        ${hbars((c.ovr_faixas || []).map((f) => [f.faixa, f.n]), undefined, { sort: false })}</div>
      <div class="card"><h3>Legado</h3><p class="c-sub">Título final das carreiras terminadas</p>${hbars(Object.entries(c.legados || {}))}</div>
      <div class="card"><h3>Rota escolhida</h3><p class="c-sub">Carreiras iniciadas</p>${hbars(Object.entries(c.rotas || {}), roleName)}</div>
      <div class="card"><h3>Região inicial</h3><p class="c-sub">Carreiras iniciadas</p>${hbars(Object.entries(c.regioes || {}), regionName)}</div>
      <div class="card"><h3>Velocidade</h3><p class="c-sub">Carreiras iniciadas</p>${hbars(Object.entries(c.velocidade || {}), speedName)}</div>
    </div>
    <div class="card"><h3>Melhores carreiras do período</h3>
      ${(c.top || []).length ? `<div class="table-wrap"><table class="p-table">
        <thead><tr><th>#</th><th>Jogador</th><th>Rota</th><th>Legado</th><th class="n">OVR máx.</th><th class="n">Troféus</th><th class="n">Pontos</th></tr></thead>
        <tbody>${c.top.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.nick)}${t.conta ? ` <small>@${esc(t.conta)}</small>` : ' <small>visitante</small>'}</td><td>${esc(roleName(t.rota))}</td><td>${esc(t.legado)}</td><td class="n">${num(t.ovr)}</td><td class="n">${num(t.trofeus)}</td><td class="n">${num(t.pontos)}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="p-empty">Nenhuma carreira terminada no período.</p>'}
    </div>
  </section>`;
}

function lock(msg, withLogin) {
  range.hidden = true;
  body.innerHTML = `<div class="p-lock"><p>${esc(msg)}</p>${withLogin ? '<button type="button" data-login>Entrar</button>' : ''}</div>`;
  body.querySelector('[data-login]')?.addEventListener('click', () => openAuthModal('login'));
}

let loadSeq = 0;
async function load() {
  const seq = ++loadSeq;
  await platform.init();
  if (seq !== loadSeq) return;
  if (!platform.cloudEnabled()) return lock('O painel só funciona no site publicado.', false);
  if (!platform.getUser()) return lock('Entre com a conta de administrador para ver o painel.', true);
  range.hidden = false;
  range.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.days) === days));
  body.innerHTML = '<p class="muted">Carregando…</p>';
  try {
    const st = await platform.adminStats(days);
    if (seq === loadSeq) render(st);
  } catch (err) {
    if (seq === loadSeq) lock(err.message, false);
  }
}

range.addEventListener('click', (e) => {
  const b = e.target.closest('[data-days]');
  if (!b) return;
  days = Number(b.dataset.days);
  try { localStorage.setItem('site.painel.dias', String(days)); } catch { /* sem storage */ }
  load();
});

// Dica ao passar o mouse (ou tocar) numa coluna.
function showTip(col, x, y) {
  tip.innerHTML = col.dataset.tip;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2))}px`;
  tip.style.top = `${Math.max(8, y - r.height - 12)}px`;
}
body.addEventListener('pointermove', (e) => {
  const col = e.target.closest('.col');
  document.querySelectorAll('.col.on').forEach((c) => c !== col && c.classList.remove('on'));
  if (!col) { tip.hidden = true; return; }
  col.classList.add('on');
  showTip(col, e.clientX, col.getBoundingClientRect().top + 18);
});
body.addEventListener('pointerleave', () => { tip.hidden = true; });

platform.onChange((evt) => { if (evt.type === 'auth') load(); });
load();
