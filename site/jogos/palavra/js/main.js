// Palavra do Rift: uma palavra do universo de LoL por dia, igual para todos.
import {
  MAX_TRIES, norm, displayLetters, evaluate, dayIndex, answerFor, msToNextDay, computeStats, keyboardState, shareText,
} from './logic.js';
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';

const GAME_ID = 'palavra';
const NAME = gameById(GAME_ID)?.name || 'Palavra do Rift';
const SEEN_HELP = 'palavra.ajuda';
const CATEGORIES = {
  campeao: 'Campeão', regiao: 'Região de Runeterra', item: 'Item', mapa: 'Mapa e objetivos', feitico: 'Feitiço de invocador',
  elo: 'Elo', termo: 'Termo do jogo', universo: 'Universo de Runeterra', cenario: 'Cenário competitivo',
};
const PRAISE = ['Pentakill!', 'Lendário!', 'Imparável!', 'Dominando!', 'Boa!', 'Por pouco!'];

const app = document.getElementById('app');
mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

let answers = [];
let valid = new Set(); // chaves aceitas como tentativa
const accents = new Map(); // chave → forma com acento (para mostrar nas peças)
let today = dayIndex();
let answer = null; // { palavra, chave, categoria }
let save = { v: 1, day: today, guesses: [], history: {} };
let input = [];
let busy = false;
let modal = null;
let timer = null;

// ------------------------------------------------------------------ dados

async function loadData() {
  const [pal, dic] = await Promise.all([
    fetch('dados/palavras.json').then((r) => r.json()),
    fetch('dados/dicionario.txt').then((r) => r.text()),
  ]);
  answers = pal.respostas;
  for (const w of dic.split('\n')) {
    if (!w) continue;
    const k = norm(w);
    valid.add(k);
    if (!accents.has(k)) accents.set(k, w);
  }
  for (const k of pal.extras) valid.add(k);
  for (const a of answers) {
    valid.add(a.chave);
    accents.set(a.chave, a.palavra);
  }
}

function loadSave() {
  const s = platform.loadLocalSave(GAME_ID);
  save = { v: 1, day: today, guesses: [], history: {}, ...(s && s.v === 1 ? s : {}) };
  if (save.day !== today) save = { ...save, day: today, guesses: [] };
  input = [];
}

const persist = (urgent = false) => platform.writeSave(GAME_ID, save, { urgent });

const finished = () => save.guesses.at(-1) === answer.chave || save.guesses.length >= MAX_TRIES;
const won = () => save.guesses.at(-1) === answer.chave;
const shown = (key) => displayLetters(accents.get(key) || key);

// ------------------------------------------------------------------ tela

const ICON_HELP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9.1 9a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1.1-1.3 2v.7"/><circle cx="12" cy="18" r=".6" fill="currentColor"/></svg>';
const ICON_STATS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 20V12M10 20V5M15 20v-9M20 20v-5"/></svg>';
const ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M17 9l-5 6M12 9l5 6"/></svg>';
const KEYS = ['QWERTYUIOP', 'ASDFGHJKL⌫', 'ZXCVBNM↵'];

function render({ reveal = false, shake = false, win = false } = {}) {
  const n = answer.chave.length;
  const kb = keyboardState(save.guesses, answer.chave);
  const rows = [];
  for (let r = 0; r < MAX_TRIES; r++) {
    const g = save.guesses[r];
    if (g) {
      const res = evaluate(g, answer.chave);
      const letters = shown(g);
      const last = r === save.guesses.length - 1;
      const cls = `row${last && reveal ? ' just' : ''}${last && win ? ' win' : ''}`;
      rows.push(`<div class="${cls}" role="row" aria-label="Tentativa ${r + 1}: ${esc(letters.join(''))}">${letters.map((ch, i) =>
        `<div class="tile ${res[i]}" style="--i:${i}" role="cell" aria-label="${ch}, ${res[i] === 'ok' ? 'lugar certo' : res[i] === 'near' ? 'outro lugar' : 'não tem'}">${ch}</div>`).join('')}</div>`);
    } else if (r === save.guesses.length && !finished()) {
      rows.push(`<div class="row current${shake ? ' shake' : ''}" role="row">${Array.from({ length: n }, (_, i) =>
        `<div class="tile${input[i] ? ' filled' : ''}${i === input.length ? ' cursor' : ''}" role="cell">${input[i] || ''}</div>`).join('')}</div>`);
    } else {
      rows.push(`<div class="row future" role="row">${'<div class="tile" role="cell"></div>'.repeat(n)}</div>`);
    }
  }
  const key = (k) => {
    if (k === '⌫') return `<button class="key wide" data-key="Backspace" aria-label="Apagar">${ICON_BACK}</button>`;
    if (k === '↵') return '<button class="key wide" data-key="Enter">ENTER</button>';
    return `<button class="key ${kb[k] || ''}" data-key="${k}">${k}</button>`;
  };
  app.innerHTML = `
    <header class="pal-head">
      <div class="left"><button class="icon-btn" data-act="help" aria-label="Como jogar">${ICON_HELP}</button></div>
      <div class="pal-title">
        <p class="eyebrow">◆ Palavra do dia</p>
        <h1>${esc(NAME)}</h1>
        <p class="sub">#${today + 1} · ${n} letras</p>
      </div>
      <div class="right"><button class="icon-btn" data-act="stats" aria-label="Estatísticas">${ICON_STATS}</button></div>
    </header>
    <div class="board" style="--n:${n}" role="grid" aria-label="Tentativas">${rows.join('')}</div>
    <div class="kb" aria-label="Teclado">${KEYS.map((row) => `<div class="kb-row">${[...row].map(key).join('')}</div>`).join('')}</div>
    <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

let toastTimer = null;
function toast(msg, ms = 1600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ------------------------------------------------------------------ jogadas

function type(ch) {
  if (busy || finished() || modal) return;
  if (input.length < answer.chave.length) {
    input.push(ch);
    render();
  }
}

function erase() {
  if (busy || finished() || modal) return;
  input.pop();
  render();
}

function submit() {
  if (busy || finished() || modal) return;
  const n = answer.chave.length;
  const guess = input.join('');
  if (guess.length < n) {
    render({ shake: true });
    toast(`A palavra tem ${n} letras`);
    return;
  }
  if (!valid.has(guess)) {
    render({ shake: true });
    toast('Palavra não aceita');
    return;
  }
  if (!save.guesses.length) platform.track('game_start', GAME_ID, { day: today, length: n, categoria: answer.categoria });
  save.guesses.push(guess);
  input = [];
  const done = finished();
  if (done) {
    save.history = { ...save.history, [today]: { tries: save.guesses.length, won: won() } };
  }
  persist(done);
  busy = true;
  render({ reveal: true });
  const flipTime = 110 * (n - 1) + 520;
  setTimeout(() => {
    busy = false;
    if (!done) return;
    if (won()) {
      render({ win: true });
      toast(PRAISE[save.guesses.length - 1], 1800);
    } else {
      toast(accents.get(answer.chave) || answer.palavra, 2200);
    }
    finish();
    setTimeout(() => openStats(), won() ? 1500 : 1900);
  }, flipTime);
}

function finish() {
  const tries = save.guesses.length;
  const ok = won();
  platform.track('game_end', GAME_ID, { day: today, won: ok, tries, length: answer.chave.length, categoria: answer.categoria });
  platform.recordResult(GAME_ID, {
    score: ok ? MAX_TRIES + 1 - tries : 0,
    summary: {
      text: `#${today + 1} · ${answer.palavra} · ${ok ? `acertou em ${tries}/${MAX_TRIES}` : `não acertou (X/${MAX_TRIES})`}`,
      day: today + 1, word: answer.palavra, won: ok, tries,
    },
  });
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
  clearInterval(timer);
  if (!modal) return;
  const fn = modal._onClose;
  modal.remove();
  modal = null;
  fn?.();
}

const exampleRow = (word, idx, cls) => `<div class="example">${[...word].map((ch, i) =>
  `<div class="tile${i === idx ? ` ${cls}` : ''}">${ch}</div>`).join('')}</div>`;

function openHelp() {
  openModal(`
    <h2>Como jogar</h2>
    <p>Descubra a palavra do dia em ${MAX_TRIES} tentativas. Todas as respostas são do universo de League of Legends:
      campeões, regiões, itens, objetivos do mapa, feitiços, elos e termos do jogo.</p>
    <p>A palavra do dia pode ter de 5 a 10 letras. Depois de cada tentativa, as peças mostram o quão perto você está.</p>
    ${exampleRow('NOXUS', 0, 'ok')}
    <p>A letra <b>N</b> está na palavra e no lugar certo.</p>
    ${exampleRow('BRAUM', 2, 'near')}
    <p>A letra <b>A</b> está na palavra, mas em outro lugar.</p>
    ${exampleRow('TEEMO', 4, 'miss')}
    <p>A letra <b>O</b> não está na palavra.</p>
    <p class="help-note">Vale tentar qualquer palavra comum do português ou do universo de LoL com o mesmo número de letras.
      Acentos e apóstrofos são preenchidos sozinhos e não contam nas dicas. As palavras podem ter letras repetidas.</p>
    <p class="help-note">Uma palavra nova aparece todo dia à meia-noite (horário de Brasília), a mesma para todo mundo.</p>`,
  { onClose: () => { try { localStorage.setItem(SEEN_HELP, '1'); } catch { /* sem storage */ } } });
}

const fmtTime = (ms) => {
  const s = Math.ceil(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':');
};

function openStats() {
  const st = computeStats(save.history, today);
  const max = Math.max(1, ...st.dist, st.losses);
  const done = finished();
  const cur = done && won() ? save.guesses.length : null;
  const bar = (label, n, now) => `<div class="dist-row"><span>${label}</span><span><i class="bar${now ? ' now' : ''}" style="width:${Math.max(8, (n / max) * 100)}%">${n}</i></span></div>`;
  openModal(`
    ${done ? `<div class="result">
      <span class="r-label">${won() ? 'Você acertou' : 'A palavra era'}</span>
      <span class="r-word">${esc(answer.palavra)}</span>
      <span class="r-cat">${esc(CATEGORIES[answer.categoria] || '')}</span>
    </div>` : ''}
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
    ${done ? `<div class="next">
      <div><span class="n-label">Próxima palavra em</span><span class="n-time" id="next-time">${fmtTime(msToNextDay())}</span></div>
      <button class="btn-share" data-act="share">Compartilhar</button>
    </div>` : ''}`);
  if (done) {
    timer = setInterval(() => {
      const el = document.getElementById('next-time');
      if (el) el.textContent = fmtTime(msToNextDay());
      if (dayIndex() !== today) newDay();
    }, 1000);
  }
}

async function share() {
  const text = shareText({
    name: NAME, number: today + 1, guesses: save.guesses, answer: answer.chave, won: won(), url: 'riftarcade.com.br/jogos/palavra',
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
  closeModal();
  today = dayIndex();
  answer = answerFor(today, answers);
  loadSave();
  render();
}

app.addEventListener('click', (e) => {
  const k = e.target.closest('[data-key]');
  if (k) {
    const v = k.dataset.key;
    if (v === 'Enter') submit();
    else if (v === 'Backspace') erase();
    else type(v);
    k.blur();
    return;
  }
  const a = e.target.closest('[data-act]');
  if (a?.dataset.act === 'help') openHelp();
  if (a?.dataset.act === 'stats') openStats();
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (modal) {
    if (e.key === 'Escape') closeModal();
    return;
  }
  if (document.querySelector('.acc-backdrop')) return; // janela de login aberta
  if (!answer) return;
  if (e.key === 'Enter') { e.preventDefault(); submit(); }
  else if (e.key === 'Backspace') erase();
  else {
    const ch = norm(e.key);
    if (ch.length === 1 && e.key.length === 1) type(ch);
  }
});

// Progresso vindo da nuvem (entrou na conta em outro aparelho).
platform.onChange((evt) => {
  if (evt.type === 'save' && evt.gameId === GAME_ID && !busy) {
    loadSave();
    if (answer) render();
  }
});

// Voltou para a aba depois da meia-noite: carrega a palavra nova.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && answer && dayIndex() !== today) newDay();
});

(async () => {
  app.innerHTML = '<p class="loading">Carregando a palavra do dia…</p>';
  try {
    await loadData();
  } catch {
    app.innerHTML = '<p class="loading">Não foi possível carregar o jogo. Verifique a internet e recarregue a página.</p>';
    return;
  }
  answer = answerFor(today, answers);
  loadSave();
  render();
  let seen = false;
  try { seen = Boolean(localStorage.getItem(SEEN_HELP)); } catch { /* sem storage */ }
  if (!seen && !save.guesses.length) openHelp();
  else if (finished()) openStats();
})();
