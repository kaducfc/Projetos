// Campeão Oculto: um campeão de LoL por dia, igual para todos, descoberto
// pelas pistas de cada tentativa.
import {
  COLUMNS, MAX_TRIES, compare, search, exactMatch, pickHint, formatValue, computeStats, championFor, dayIndex, shareText,
} from './logic.js';
import { msToNextDay, fmtCountdown } from '../../../shared/diario.js';
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import { vantagens } from '../../../shared/ranked.js';

const GAME_ID = 'campeao';
const NAME = gameById(GAME_ID)?.name || 'Campeão Oculto';
const SEEN_HELP = 'campeao.ajuda';
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
let sel = -1; // sugestão marcada com as setas do teclado (-1 = nenhuma)

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function loadSave() {
  const s = platform.loadLocalSave(GAME_ID);
  save = { v: 1, day: today, guesses: [], hint: null, history: {}, ...(s && s.v === 1 ? s : {}) };
  if (save.day !== today) save = { ...save, day: today, guesses: [], hint: null, hint2: null, maxTries: undefined };
  save.guesses = save.guesses.filter((n) => byName.has(n));
}
const persist = (urgent = false) => platform.writeSave(GAME_ID, save, { urgent });
const won = () => save.guesses.includes(answer.nome);
// Benefícios do elo da ranqueada (Platina: 2 dicas; Desafiante: +1
// tentativa). O número de tentativas fica fixo no dia depois da 1ª jogada.
const vant = () => vantagens(platform.getUser()?.elo);
const maxTries = () => save.maxTries || vant().tentativasCampeao;
const dicas = () => [save.hint, save.hint2].filter(Boolean);
// Cada dica gasta uma tentativa.
const used = () => save.guesses.length + dicas().length;
const finished = () => won() || used() >= maxTries();
const comecar = () => { if (!used()) save.maxTries = vant().tentativasCampeao; };
const labelOf = (key) => COLUMNS.find((c) => c.key === key)?.label || key;

// ------------------------------------------------------------------ tela

const ICON_HELP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9.1 9a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1.1-1.3 2v.7"/><circle cx="12" cy="18" r=".6" fill="currentColor"/></svg>';
const ICON_STATS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 20V12M10 20V5M15 20v-9M20 20v-5"/></svg>';

// Seta cheia (haste + ponta), virada para baixo com CSS quando precisa.
const ARROW = '<svg viewBox="0 0 40 60" preserveAspectRatio="none"><path d="M20 2 L38 26 H27 V58 H13 V26 H2 Z" fill="currentColor"/></svg>';

const champIcon = (c) => `<span class="champ-ic" data-fallback="${esc(c.nome[0])}">${ddVersion ? `<img src="${iconUrl(c)}" alt="" loading="lazy" />` : esc(c.nome[0])}</span>`;

function cellHtml(col, c, res, i) {
  const v = c[col.key];
  if (col.kind === 'year') {
    const arrow = res.arrow ? `<span class="arrow ${res.arrow}" aria-hidden="true">${ARROW}</span>` : '';
    const say = res.arrow ? (res.arrow === 'up' ? ', o campeão do dia é mais novo' : ', o campeão do dia é mais antigo') : '';
    return `<div class="cell year ${res.state}" style="--i:${i}" aria-label="${col.label}: ${v}${say}">${arrow}<span class="val">${v}</span></div>`;
  }
  const text = col.key === 'genero' ? ({ M: 'Masculino', F: 'Feminino' }[v] || v) : v.join('<br>');
  const plain = col.key === 'genero' ? text : v.join(', ');
  const state = { ok: 'certo', part: 'parcial', miss: 'errado' }[res.state];
  return `<div class="cell ${res.state}" style="--i:${i}" aria-label="${col.label}: ${esc(plain)} (${state})"><span class="val">${text}</span></div>`;
}

function render({ fresh = false } = {}) {
  const done = finished();
  const ok = won();
  const n = used();
  const rows = save.guesses.slice().reverse().map((name, idx) => {
    const c = byName.get(name);
    const res = compare(c, answer);
    return `<div class="grid-row${fresh && idx === 0 ? ' row-new' : ''}" style="display:contents">
      <div class="cell name" style="--i:0">${champIcon(c)}<span>${esc(c.nome)}</span></div>
      ${COLUMNS.map((col, i) => cellHtml(col, c, res[i], i + 1)).join('')}
    </div>`;
  }).join('');
  const podeDica = !done && dicas().length < vant().dicasCampeao && maxTries() - n > 1;
  const hint = dicas().map((k) => `<div class="hint open">Dica: <span>${esc(labelOf(k))}</span> <b>${esc(formatValue(k, answer))}</b></div>`).join('')
    + (podeDica ? `<button type="button" class="hint-btn" data-act="hint">💡 Pedir ${dicas().length ? 'outra dica' : 'dica'} (gasta 1 tentativa)</button>` : '');
  const left = maxTries() - n;
  app.innerHTML = `
    <header class="adv-head">
      <div><button class="icon-btn" data-act="help" aria-label="Como jogar">${ICON_HELP}</button></div>
      <div class="adv-title">
        <p class="eyebrow">◆ Campeão do dia</p>
        <h1>${esc(NAME)}</h1>
        <p class="sub">#${today + 1} · tentativa ${Math.min(n + (done ? 0 : 1), maxTries())} de ${maxTries()}</p>
      </div>
      <div class="right"><button class="icon-btn" data-act="stats" aria-label="Estatísticas">${ICON_STATS}</button></div>
    </header>
    ${done ? `<section class="win${ok ? '' : ' lost'}" aria-live="polite">
        ${champIcon(answer)}
        <div class="w-text"><p class="w-label">${ok ? 'Você acertou' : 'O campeão era'}</p><p class="w-name">${esc(answer.nome)}</p>
          <p class="w-sub">${ok ? `em ${n} ${n === 1 ? 'tentativa' : 'tentativas'}` : `As ${maxTries()} tentativas acabaram.`}</p></div>
        <div class="w-next"><span>Próximo campeão em</span><b id="next-time">${fmtCountdown(msToNextDay())}</b></div>
        <div class="w-actions"><button class="btn" data-act="share">Compartilhar</button>
          <button class="btn btn-ghost" data-act="stats">Estatísticas</button></div>
      </section>` : `<form class="guess" autocomplete="off">
        <input id="q" type="text" placeholder="Digite o nome de um campeão…" aria-label="Nome do campeão" aria-autocomplete="list" aria-controls="suggest" />
        <button class="go" type="submit">Adivinhar</button>
        <ul class="suggest" id="suggest" role="listbox" hidden></ul>
      </form>
      <div class="info"><span><b>${left}</b> ${left === 1 ? 'tentativa restante' : 'tentativas restantes'}</span>${hint}</div>`}
    ${done && dicas().length ? `<div class="info">${hint}</div>` : ''}
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
  if (sel >= items.length) sel = items.length - 1;
  list.hidden = !items.length;
  list.innerHTML = items.map((c, i) => `<li role="option" data-name="${esc(c.nome)}" class="${i === sel ? 'on' : ''}" aria-selected="${i === sel}">${champIcon(c)}${esc(c.nome)}</li>`).join('');
  fixIcons(list);
}

function guess(name) {
  const c = byName.get(name);
  if (!c || finished()) return;
  if (save.guesses.includes(c.nome)) {
    toast('Você já tentou esse campeão');
    return;
  }
  if (!used()) platform.track('game_start', GAME_ID, { day: today });
  comecar();
  save.guesses.push(c.nome);
  const done = finished();
  if (done) save.history = { ...save.history, [today]: { tries: used(), won: won() } };
  persist(done);
  sel = -1;
  render({ fresh: true });
  if (done) finish();
}

function finish() {
  const tries = used();
  const ok = won();
  platform.track('game_end', GAME_ID, { day: today, won: ok, tries, hint: Boolean(save.hint), dicas: dicas().length, campeao: answer.nome });
  platform.recordResult(GAME_ID, {
    score: ok ? Math.max(1, MAX_TRIES + 1 - tries) : 0,
    summary: {
      text: `#${today + 1} · ${answer.nome} · ${ok ? `acertou em ${tries}/${maxTries()}` : `não acertou (X/${maxTries()})`}`,
      day: today + 1, champion: answer.nome, won: ok, tries,
    },
  });
  setTimeout(() => toast(ok ? (tries === 1 ? 'De primeira! Lendário!' : 'Acertou!') : `Era ${answer.nome}!`, 1800), 1300);
}

// Dica (uma por dia, a qualquer momento): confirma uma característica que
// ainda não ficou verde, sorteada entre as que faltam.
function useHint() {
  // Não deixa a dica gastar a última tentativa.
  if (dicas().length >= vant().dicasCampeao || finished() || maxTries() - used() <= 1) return;
  // Sorteia entre as características que ainda faltam e não viraram dica.
  let key = null;
  for (let i = 0; i < 40 && (!key || dicas().includes(key)); i++) key = pickHint(save.guesses.map((n) => byName.get(n)), answer);
  if (dicas().includes(key)) key = null;
  if (!key) {
    toast('Todas as características já estão confirmadas');
    return;
  }
  if (!used()) platform.track('game_start', GAME_ID, { day: today });
  comecar();
  if (save.hint) save.hint2 = key; else save.hint = key;
  persist();
  render();
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
    <p class="help-note">Você tem ${maxTries()} tentativas. Só valem nomes de campeões: comece a digitar e escolha
      na lista. Uma vez por dia, a qualquer momento, dá para pedir uma dica, que revela uma característica
      que você ainda não acertou. A dica gasta uma tentativa. Um campeão novo aparece todo dia à meia-noite (horário de Brasília), o mesmo para todo mundo.</p>`,
  { onClose: () => { try { localStorage.setItem(SEEN_HELP, '1'); } catch { /* sem storage */ } } });
}

function openStats() {
  const st = computeStats(save.history, today);
  const max = Math.max(1, ...st.dist, st.losses);
  const done = finished();
  const cur = won() ? used() : null;
  const bar = (label, n, now) => `<div class="dist-row"><span>${label}</span><span><i class="bar${now ? ' now' : ''}" style="width:${Math.max(8, (n / max) * 100)}%">${n}</i></span></div>`;
  openModal(`
    <h2>Progresso</h2>
    <div class="stats-nums">
      <div><b>${st.played}</b><span>jogos</span></div>
      <div><b>${st.pct}%</b><span>de vitórias</span></div>
      <div><b>${st.streak}</b><span>sequência de vitórias</span></div>
      <div><b>${st.best}</b><span>melhor sequência</span></div>
    </div>
    <h3>Distribuição de tentativas</h3>
    <div class="dist">
      ${st.dist.map((n, i) => bar(i + 1, n, cur === i + 1)).join('')}
      ${bar('💀', st.losses, done && !won())}
    </div>
    ${done ? '<p style="margin-top:16px"><button class="btn" data-act="share">Compartilhar resultado</button></p>' : ''}`);
}

async function share() {
  const text = shareText({
    name: NAME, number: today + 1, guesses: save.guesses.map((n) => byName.get(n)), answer, won: won(), hint: dicas().length, max: maxTries(), url: 'riftarcade.com.br/jogos/campeao',
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
  if (e.target.id === 'q') { sel = -1; renderSuggest(); }
});
app.addEventListener('keydown', (e) => {
  if (e.target.id !== 'q') return;
  const items = suggestions();
  if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); renderSuggest(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(-1, sel - 1); renderSuggest(); }
  if (e.key === 'Escape') document.getElementById('suggest').hidden = true;
});
app.addEventListener('submit', (e) => {
  e.preventDefault();
  const items = suggestions();
  const q = document.getElementById('q').value;
  // Vale o nome completo digitado ou a opção marcada na lista.
  const exact = exactMatch(q, data.campeoes);
  if (items[sel]) guess(items[sel].nome);
  else if (exact) guess(exact.nome);
  else if (q.trim()) toast(items.length ? 'Escolha um campeão da lista' : 'Nenhum campeão com esse nome');
});
app.addEventListener('click', (e) => {
  const li = e.target.closest('.suggest li');
  if (li) { guess(li.dataset.name); return; }
  const a = e.target.closest('[data-act]');
  if (a?.dataset.act === 'help') openHelp();
  if (a?.dataset.act === 'stats') openStats();
  if (a?.dataset.act === 'share') share();
  if (a?.dataset.act === 'hint') useHint();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.guess')) { const l = document.getElementById('suggest'); if (l) l.hidden = true; }
});
document.addEventListener('keydown', (e) => { if (modal && e.key === 'Escape') closeModal(); });

// Progresso vindo da nuvem (entrou na conta em outro aparelho).
platform.onChange((evt) => {
  // Entrou na conta (ou o elo mudou): os benefícios podem mudar a tela.
  if (evt.type === 'auth' && answer && !modal && !document.activeElement?.matches?.('#q')) render();
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
