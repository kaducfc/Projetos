// Runetermo: uma palavra do universo de LoL por dia, igual para todos.
import {
  MAX_TRIES, norm, displayLetters, evaluate, dayIndex, answerFor, msToNextDay, computeStats, keyboardState, shareText,
} from './logic.js';
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import { vantagens, eloInfo } from '../../../shared/ranked.js';

const GAME_ID = 'runetermo';
const NAME = gameById(GAME_ID)?.name || 'Runetermo';
const SEEN_HELP = 'runetermo.ajuda';
const CATEGORIES = {
  campeao: 'Campeão', regiao: 'Região de Runeterra', item: 'Item', mapa: 'Mapa e objetivos', feitico: 'Feitiço de invocador',
  elo: 'Elo', termo: 'Termo do jogo', universo: 'Universo de Runeterra', cenario: 'Cenário competitivo',
};
const PRAISE = ['Pentakill!', 'Lendário!', 'Imparável!', 'Dominando!', 'Boa!', 'Por pouco!'];

const app = document.getElementById('app');
mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

let answers = [];
const accents = new Map(); // chave → forma com acento (para mostrar nas peças)
let today = dayIndex();
let answer = null; // { palavra, chave, categoria }
let save = { v: 1, day: today, guesses: [], history: {} };
let input = []; // letras da linha atual (pode ter buracos: o jogador escolhe o quadrado)
let cursor = 0; // quadrado selecionado na linha atual
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
    if (!accents.has(k)) accents.set(k, w);
  }
  for (const a of answers) {
    accents.set(a.chave, a.palavra);
  }
}

function loadSave() {
  const s = platform.loadLocalSave(GAME_ID);
  save = { v: 1, day: today, guesses: [], history: {}, ...(s && s.v === 1 ? s : {}) };
  if (save.day !== today) save = { ...save, day: today, guesses: [], maxTries: undefined };
  input = [];
  cursor = 0;
}

const persist = (urgent = false) => platform.writeSave(GAME_ID, save, { urgent });

// Benefícios do elo da ranqueada (Prata: categoria visível; Diamante: +1
// tentativa). O número de tentativas fica fixo no dia depois do 1º chute.
const vant = () => vantagens(platform.getUser()?.elo);
const maxTries = () => save.maxTries || vant().tentativasRunetermo;
const finished = () => save.guesses.at(-1) === answer.chave || save.guesses.length >= maxTries();
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
  for (let r = 0; r < maxTries(); r++) {
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
        `<button type="button" class="tile${input[i] ? ' filled' : ''}${i === cursor ? ' cursor' : ''}" data-pos="${i}" role="gridcell" aria-label="Quadrado ${i + 1}${input[i] ? `: ${input[i]}` : ', vazio'}${i === cursor ? ' (selecionado)' : ''}">${input[i] || ''}</button>`).join('')}</div>`);
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
        <p class="sub">#${today + 1} · ${n} letras${maxTries() > MAX_TRIES ? ` · ${maxTries()} tentativas` : ''}</p>
        ${vant().categoriaRunetermo && !finished() ? `<p class="cat-elo" title="Benefício do elo ${esc(eloInfo(platform.getUser()?.elo).nome)} na ranqueada">Categoria: <b>${esc(CATEGORIES[answer.categoria] || '')}</b></p>` : ''}
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

// O jogador escreve no quadrado selecionado (clicando num quadrado ou com
// as setas ele escolhe qual); depois o cursor vai para o próximo vazio.
function type(ch) {
  if (busy || finished() || modal) return;
  const n = answer.chave.length;
  input[cursor] = ch;
  const prox = [...Array(n).keys()].map((k) => (cursor + 1 + k) % n).find((k) => !input[k]);
  cursor = prox ?? Math.min(cursor + 1, n - 1);
  render();
}

function erase() {
  if (busy || finished() || modal) return;
  if (input[cursor]) input[cursor] = undefined;
  else if (cursor > 0) {
    cursor--;
    input[cursor] = undefined;
  }
  render();
}

function moveCursor(pos) {
  if (busy || finished() || modal) return;
  cursor = Math.max(0, Math.min(answer.chave.length - 1, pos));
  render();
}

function submit() {
  if (busy || finished() || modal) return;
  const n = answer.chave.length;
  const guess = Array.from({ length: n }, (_, i) => input[i] || '').join('');
  if (guess.length < n) {
    render({ shake: true });
    toast(`Preencha os ${n} quadrados`);
    return;
  }
  if (!save.guesses.length) {
    platform.track('game_start', GAME_ID, { day: today, length: n, categoria: answer.categoria });
    save.maxTries = vant().tentativasRunetermo;
  }
  save.guesses.push(guess);
  input = [];
  cursor = 0;
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
      toast(PRAISE[Math.min(save.guesses.length, PRAISE.length) - 1], 1800);
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
    score: ok ? Math.max(1, MAX_TRIES + 1 - tries) : 0,
    summary: {
      text: `#${today + 1} · ${answer.palavra} · ${ok ? `acertou em ${tries}/${maxTries()}` : `não acertou (X/${maxTries()})`}`,
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
    <p>Descubra a palavra do dia em ${MAX_TRIES} tentativas. Todas as respostas são nomes do universo de League of Legends:
      campeões, regiões e lugares de Runeterra, itens, monstros do mapa e personagens da lore.</p>
    <p>A palavra do dia pode ter de 5 a 7 letras. Depois de cada tentativa, as peças mostram o quão perto você está.</p>
    <p>Toque num quadrado para escolher onde escrever: dá para preencher primeiro as letras que você já sabe, em qualquer posição.</p>
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
    name: NAME, number: today + 1, guesses: save.guesses, answer: answer.chave, won: won(), max: maxTries(), url: 'riftarcade.com.br/jogos/runetermo',
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
  const t = e.target.closest('[data-pos]');
  if (t) {
    moveCursor(Number(t.dataset.pos));
    return;
  }
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
  else if (e.key === 'Delete') { if (input[cursor]) { input[cursor] = undefined; render(); } }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); moveCursor(cursor - 1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); moveCursor(cursor + 1); }
  else {
    const ch = norm(e.key);
    if (ch.length === 1 && e.key.length === 1) type(ch);
  }
});

// Progresso vindo da nuvem (entrou na conta em outro aparelho) ou elo novo.
platform.onChange((evt) => {
  if (evt.type === 'auth' && answer && !busy && !modal) render();
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
