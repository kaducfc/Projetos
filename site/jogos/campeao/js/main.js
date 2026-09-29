// Adivinhe o Campeão: um campeão de LoL por dia, igual para todos, descoberto
// pelas pistas de cada tentativa.
import {
  COLUMNS, DIST, compare, search, fold, computeStats, championFor, dayIndex, shareText,
} from './logic.js';
import { msToNextDay, fmtCountdown } from '../../../shared/diario.js';
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';

const GAME_ID = 'campeao';
const NAME = gameById(GAME_ID)?.name || 'Adivinhe o Campeão';
const SEEN_HELP = 'campeao.ajuda';
const HINT_AT = 6; // tentativas para liberar a dica (primeira letra)
// Ícones dos campeões: Data Dragon, o CDN oficial da Riot (uso permitido para
// projetos de fã). O endereço leva a versão atual do jogo, buscada ao abrir.
const DDRAGON = 'https://ddragon.leagueoflegends.com';
let ddVersion = null;
const iconUrl = (c) => (ddVersion ? `${DDRAGON}/cdn/${ddVersion}/img/champion/${encodeURIComponent(c.img)}.png` : '');

async function loadVersion() {
  try {
    const cached = JSON.parse(localStorage.getItem('campeao.ddragon') || 'null');
    if (cached && Date.now() - cached.at < 864e5) return cached.v;
  } catch { /* sem storage */ }
  try {
    const v = (await (await fetch(`${DDRAGON}/api/versions.json`)).json())[0];
    try { localStorage.setItem('campeao.ddragon', JSON.stringify({ v, at: Date.now() })); } catch { /* sem storage */ }
    return v;
  } catch {
    return null; // sem imagem: aparece a inicial do campeão
  }
}

const app = document.getElementById('app');
mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

let data = null;
let byName = new Map();
let today = dayIndex();
let answer = null;
let save = { v: 1, day: today, guesses: [], history: {} };
let modal = null;
let timer = null;
let sel = 0; // sugestão marcada na lista

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function loadSave() {
  const s = platform.loadLocalSave(GAME_ID);
  save = { v: 1, day: today, guesses: [], history: {}, ...(s && s.v === 1 ? s : {}) };
  if (save.day !== today) save = { ...save, day: today, guesses: [] };
  save.guesses = save.guesses.filter((n) => byName.has(n));
}
const persist = (urgent = false) => platform.writeSave(GAME_ID, save, { urgent });
const won = () => save.guesses.includes(answer.nome);

// ------------------------------------------------------------------ tela

const ICON_HELP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9.1 9a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1.1-1.3 2v.7"/><circle cx="12" cy="18" r=".6" fill="currentColor"/></svg>';
const ICON_STATS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 20V12M10 20V5M15 20v-9M20 20v-5"/></svg>';

const champIcon = (c) => `<span class="champ-ic" data-fallback="${esc(c.nome[0])}">${ddVersion ? `<img src="${iconUrl(c)}" alt="" loading="lazy" />` : esc(c.nome[0])}</span>`;

function cellHtml(col, c, res, i) {
  const v = c[col.key];
  if (col.kind === 'year') {
    const arrow = res.arrow ? `<span class="arrow" aria-hidden="true">${res.arrow === 'up' ? '▲' : '▼'}</span>` : '';
    const say = res.arrow ? (res.arrow === 'up' ? ', o campeão do dia é mais novo' : ', o campeão do dia é mais antigo') : '';
    return `<div class="cell year ${res.state}" style="--i:${i}" aria-label="${col.label}: ${v}${say}">${arrow}<span class="val">${v}</span></div>`;
  }
  const text = col.key === 'genero' ? ({ M: 'Masculino', F: 'Feminino' }[v] || v) : v.join('<br>');
  const plain = col.key === 'genero' ? text : v.join(', ');
  const state = { ok: 'certo', part: 'parcial', miss: 'errado' }[res.state];
  return `<div class="cell ${res.state}" style="--i:${i}" aria-label="${col.label}: ${esc(plain)} (${state})"><span class="val">${text}</span></div>`;
}

function render({ fresh = false } = {}) {
  const done = won();
  const n = save.guesses.length;
  const rows = save.guesses.slice().reverse().map((name, idx) => {
    const c = byName.get(name);
    const res = compare(c, answer);
    return `<div class="grid-row${fresh && idx === 0 ? ' row-new' : ''}" style="display:contents">
      <div class="cell name" style="--i:0">${champIcon(c)}<span>${esc(c.nome)}</span></div>
      ${COLUMNS.map((col, i) => cellHtml(col, c, res[i], i + 1)).join('')}
    </div>`;
  }).join('');
  const hint = n >= HINT_AT || done
    ? `<div class="hint open">Dica: o nome começa com <b>${esc(answer.nome[0])}</b></div>`
    : `<div class="hint">Dica em ${HINT_AT - n} ${HINT_AT - n === 1 ? 'tentativa' : 'tentativas'}</div>`;
  app.innerHTML = `
    <header class="adv-head">
      <div><button class="icon-btn" data-act="help" aria-label="Como jogar">${ICON_HELP}</button></div>
      <div class="adv-title">
        <p class="eyebrow">◆ Campeão do dia</p>
        <h1>${esc(NAME)}</h1>
        <p class="sub">#${today + 1} · ${n} ${n === 1 ? 'tentativa' : 'tentativas'}</p>
      </div>
      <div class="right"><button class="icon-btn" data-act="stats" aria-label="Estatísticas">${ICON_STATS}</button></div>
    </header>
    ${done ? `<section class="win" aria-live="polite">
        ${champIcon(answer)}
        <div class="w-text"><p class="w-label">Você acertou</p><p class="w-name">${esc(answer.nome)}</p>
          <p class="w-sub">em ${n} ${n === 1 ? 'tentativa' : 'tentativas'}</p></div>
        <div class="w-next"><span>Próximo campeão em</span><b id="next-time">${fmtCountdown(msToNextDay())}</b></div>
        <div class="w-actions"><button class="btn" data-act="share">Compartilhar</button>
          <button class="btn btn-ghost" data-act="stats">Estatísticas</button></div>
      </section>` : `<form class="guess" autocomplete="off">
        <input id="q" type="text" placeholder="Digite o nome de um campeão…" aria-label="Nome do campeão" aria-autocomplete="list" aria-controls="suggest" />
        <button class="go" type="submit">Adivinhar</button>
        <ul class="suggest" id="suggest" role="listbox" hidden></ul>
      </form>
      ${hint}`}
    ${n ? `<div class="table-scroll"><div class="grid" role="table" aria-label="Tentativas">
      <div class="th">Campeão</div>${COLUMNS.map((c) => `<div class="th">${c.label}</div>`).join('')}
      ${rows}
    </div></div>` : '<p class="info">Cada tentativa mostra o que o seu palpite tem em comum com o campeão do dia.</p>'}
    <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>`;
  fixIcons();
  if (done) startTimer();
  else if (!modal) document.getElementById('q')?.focus({ preventScroll: true });
}

// Imagem que não carregou vira a inicial do campeão.
function fixIcons(root = app) {
  root.querySelectorAll('.champ-ic img').forEach((img) => {
    img.addEventListener('error', () => {
      const box = img.parentElement;
      box.textContent = box.dataset.fallback;
    }, { once: true });
  });
}

let toastTimer = null;
function toast(msg, ms = 1600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    const el = document.getElementById('next-time');
    if (el) el.textContent = fmtCountdown(msToNextDay());
    if (dayIndex() !== today) newDay();
  }, 1000);
}

// ------------------------------------------------------------------ busca e palpite

function suggestions() {
  const q = document.getElementById('q')?.value || '';
  return search(q, data.campeoes, new Set(save.guesses));
}

function renderSuggest() {
  const list = document.getElementById('suggest');
  if (!list) return;
  const items = suggestions();
  sel = Math.min(sel, Math.max(0, items.length - 1));
  list.hidden = !items.length;
  list.innerHTML = items.map((c, i) => `<li role="option" data-name="${esc(c.nome)}" class="${i === sel ? 'on' : ''}" aria-selected="${i === sel}">${champIcon(c)}${esc(c.nome)}</li>`).join('');
  fixIcons(list);
}

function guess(name) {
  const c = byName.get(name);
  if (!c || won()) return;
  if (save.guesses.includes(c.nome)) {
    toast('Você já tentou esse campeão');
    return;
  }
  if (!save.guesses.length) platform.track('game_start', GAME_ID, { day: today });
  save.guesses.push(c.nome);
  const done = c.nome === answer.nome;
  if (done) save.history = { ...save.history, [today]: save.guesses.length };
  persist(done);
  sel = 0;
  render({ fresh: true });
  if (done) finish();
}

function finish() {
  const tries = save.guesses.length;
  platform.track('game_end', GAME_ID, { day: today, won: true, tries, campeao: answer.nome });
  platform.recordResult(GAME_ID, {
    score: Math.max(1, 11 - tries),
    summary: { text: `#${today + 1} · ${answer.nome} · acertou em ${tries} ${tries === 1 ? 'tentativa' : 'tentativas'}`, day: today + 1, champion: answer.nome, tries },
  });
  setTimeout(() => toast(tries === 1 ? 'De primeira! Lendário!' : 'Acertou!', 1800), 1300);
}

// ------------------------------------------------------------------ janelas

function openModal(html, { onClose } = {}) {
  closeModal();
  modal = document.createElement('div');
  modal.className = 'modal-back';
  modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="close" data-act="close" aria-label="Fechar">×</button>${html}</div>`;
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-act="close"]')) closeModal();
    if (e.target.closest('[data-act="share"]')) share();
  });
  modal._onClose = onClose;
  document.body.appendChild(modal);
  modal.querySelector('.close').focus();
}

function closeModal() {
  if (!modal) return;
  const fn = modal._onClose;
  modal.remove();
  modal = null;
  fn?.();
  document.getElementById('q')?.focus({ preventScroll: true });
}

function openHelp() {
  openModal(`
    <h2>Como jogar</h2>
    <p>Descubra o campeão do dia. Digite o nome de qualquer campeão: cada tentativa mostra as características
      dele comparadas com as do campeão do dia.</p>
    <div class="legend">
      <div><b><i style="background:var(--miss)"></i>Vermelho</b>Nada em comum.</div>
      <div><b><i style="background:var(--part)"></i>Amarelo</b>Parte em comum (ex.: uma das posições).</div>
      <div><b><i style="background:var(--ok)"></i>Verde</b>Igual ao campeão do dia.</div>
    </div>
    <h3>Ano de lançamento</h3>
    <p><b>▲</b> O campeão do dia é mais novo. &nbsp; <b>▼</b> O campeão do dia é mais antigo.</p>
    <h3>Características</h3>
    <p class="help-note">Ano de lançamento, gênero, região, posição (rota), classe, espécie e alcance
      (corpo a corpo ou à distância). Alguns campeões têm mais de uma posição, classe ou espécie.</p>
    <p class="help-note">Depois de ${HINT_AT} tentativas aparece uma dica: a primeira letra do nome.
      Um campeão novo aparece todo dia à meia-noite (horário de Brasília), o mesmo para todo mundo.</p>`,
  { onClose: () => { try { localStorage.setItem(SEEN_HELP, '1'); } catch { /* sem storage */ } } });
}

function openStats() {
  const st = computeStats(save.history, today);
  const max = Math.max(1, ...st.dist);
  const cur = won() ? save.guesses.length : null;
  openModal(`
    <h2>Progresso</h2>
    <div class="stats-nums">
      <div><b>${st.played}</b><span>jogos</span></div>
      <div><b>${st.avg == null ? '—' : st.avg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b><span>média de tentativas</span></div>
      <div><b>${st.streak}</b><span>dias seguidos</span></div>
      <div><b>${st.best}</b><span>melhor sequência</span></div>
    </div>
    <h3>Acertos por número de tentativas</h3>
    <div class="dist">${DIST.map((b, i) => `<div class="dist-row"><span>${b.label}</span><span><i class="bar${cur && b.test(cur) ? ' now' : ''}" style="width:${Math.max(8, (st.dist[i] / max) * 100)}%">${st.dist[i]}</i></span></div>`).join('')}</div>
    ${won() ? '<p style="margin-top:16px"><button class="btn" data-act="share">Compartilhar resultado</button></p>' : ''}`);
}

async function share() {
  const text = shareText({
    name: NAME, number: today + 1, guesses: save.guesses.map((n) => byName.get(n)), answer, url: 'riftarcade.com.br/jogos/campeao',
  });
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      toast('Resultado copiado!');
    }
  } catch {
    toast('Não foi possível compartilhar');
  }
}

// ------------------------------------------------------------------ eventos

function newDay() {
  clearInterval(timer);
  closeModal();
  today = dayIndex();
  answer = championFor(today, data);
  loadSave();
  render();
}

app.addEventListener('input', (e) => {
  if (e.target.id === 'q') { sel = 0; renderSuggest(); }
});
app.addEventListener('keydown', (e) => {
  if (e.target.id !== 'q') return;
  const items = suggestions();
  if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); renderSuggest(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); renderSuggest(); }
  if (e.key === 'Escape') document.getElementById('suggest').hidden = true;
});
app.addEventListener('submit', (e) => {
  e.preventDefault();
  const items = suggestions();
  const q = document.getElementById('q').value;
  if (items[sel]) guess(items[sel].nome);
  else if (save.guesses.some((n) => fold(n) === fold(q))) toast('Você já tentou esse campeão');
  else if (q.trim()) toast('Campeão não encontrado');
});
app.addEventListener('click', (e) => {
  const li = e.target.closest('.suggest li');
  if (li) { guess(li.dataset.name); return; }
  const a = e.target.closest('[data-act]');
  if (a?.dataset.act === 'help') openHelp();
  if (a?.dataset.act === 'stats') openStats();
  if (a?.dataset.act === 'share') share();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.guess')) { const l = document.getElementById('suggest'); if (l) l.hidden = true; }
});
document.addEventListener('keydown', (e) => { if (modal && e.key === 'Escape') closeModal(); });

// Progresso vindo da nuvem (entrou na conta em outro aparelho).
platform.onChange((evt) => {
  if (evt.type === 'save' && evt.gameId === GAME_ID && answer) {
    loadSave();
    render();
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && answer && dayIndex() !== today) newDay();
});

(async () => {
  app.innerHTML = '<p class="loading">Carregando o campeão do dia…</p>';
  try {
    [data, ddVersion] = await Promise.all([(await fetch('dados/campeoes.json')).json(), loadVersion()]);
  } catch {
    app.innerHTML = '<p class="loading">Não foi possível carregar o jogo. Verifique a internet e recarregue a página.</p>';
    return;
  }
  byName = new Map(data.campeoes.map((c) => [c.nome, c]));
  answer = championFor(today, data);
  loadSave();
  render();
  let seen = false;
  try { seen = Boolean(localStorage.getItem(SEEN_HELP)); } catch { /* sem storage */ }
  if (!seen && !save.guesses.length) openHelp();
})();
