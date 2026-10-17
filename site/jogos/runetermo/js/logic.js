// Regras do jogo da palavra (sem tela): comparação das letras, palavra do
// dia pelo horário de Brasília, estatísticas e texto para compartilhar.

export const MAX_TRIES = 6;
// Dia 1 do jogo. A palavra troca à meia-noite de Brasília.
export const FIRST_DAY = '2026-09-29';

// "Kai'Sa" → "KAISA"; "Poção" → "POCAO" (acentos e símbolos não contam).
export function norm(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}

// Letras para mostrar nas peças, com acento: "Poção" → ["P","O","Ç","Ã","O"].
export function displayLetters(word) {
  return [...String(word).normalize('NFC')].filter((ch) => /\p{L}/u.test(ch)).map((ch) => ch.toUpperCase());
}

// Resultado de cada letra: 'ok' (lugar certo), 'near' (está na palavra, em
// outro lugar) ou 'miss'. Letras repetidas só contam quantas vezes existem.
export function evaluate(guess, answer) {
  const g = [...norm(guess)];
  const a = [...norm(answer)];
  const res = g.map(() => 'miss');
  const left = {};
  a.forEach((ch, i) => {
    if (g[i] === ch) res[i] = 'ok';
    else left[ch] = (left[ch] || 0) + 1;
  });
  g.forEach((ch, i) => {
    if (res[i] !== 'ok' && left[ch]) {
      res[i] = 'near';
      left[ch]--;
    }
  });
  return res;
}

import { brDate, dayIndex as dayIndexFrom, msToNextDay, pickForDay } from '../../../shared/diario.js';

export { brDate, msToNextDay };

// Número do dia desde o lançamento (0 = primeiro dia).
export const dayIndex = (now = new Date()) => dayIndexFrom(FIRST_DAY, now);

export const answerFor = pickForDay;

// history: { [dia]: { tries, won } }
export function computeStats(history, today) {
  const days = Object.keys(history || {}).map(Number).sort((a, b) => a - b);
  const dist = Array(MAX_TRIES).fill(0);
  let wins = 0;
  let losses = 0;
  let best = 0;
  let run = 0;
  let prev = null;
  let lastWinDay = null;
  for (const d of days) {
    const h = history[d];
    if (h.won) {
      wins++;
      dist[Math.min(MAX_TRIES, h.tries) - 1]++;
      run = prev !== null && d === prev + 1 && run > 0 ? run + 1 : 1;
      lastWinDay = d;
    } else {
      losses++;
      run = 0;
    }
    best = Math.max(best, run);
    prev = d;
  }
  // A sequência atual vale se a última vitória foi hoje ou ontem.
  const streak = lastWinDay !== null && today - lastWinDay <= 1 && history[days.at(-1)]?.won ? run : 0;
  const played = wins + losses;
  return { played, wins, losses, pct: played ? Math.round((wins / played) * 100) : 0, streak, best, dist };
}

// Cor de cada tecla: a melhor informação que o jogador já tem da letra.
export function keyboardState(guesses, answer) {
  const rank = { miss: 1, near: 2, ok: 3 };
  const out = {};
  for (const g of guesses) {
    evaluate(g, answer).forEach((r, i) => {
      const ch = norm(g)[i];
      if (!out[ch] || rank[r] > rank[out[ch]]) out[ch] = r;
    });
  }
  return out;
}

export function shareText({ name, number, guesses, answer, won, url, max = MAX_TRIES }) {
  const icon = { ok: '🟩', near: '🟨', miss: '⬛' };
  const rows = guesses.map((g) => evaluate(g, answer).map((r) => icon[r]).join(''));
  return `${name} #${number} ${won ? guesses.length : 'X'}/${max}\n\n${rows.join('\n')}${url ? `\n\n${url}` : ''}`;
}

// Teclado a partir das linhas já avaliadas ([{ chute, resultado }]), sem
// precisar da resposta (com conta, quem avalia é o servidor).
export function keyboardFromRows(rows) {
  const rank = { miss: 1, near: 2, ok: 3 };
  const out = {};
  for (const { chute, resultado } of rows) {
    [...norm(chute)].forEach((ch, i) => {
      const r = resultado[i];
      if (!out[ch] || rank[r] > rank[out[ch]]) out[ch] = r;
    });
  }
  return out;
}

export function shareRows({ name, rows, won, url, max = MAX_TRIES, pdr = null }) {
  const icon = { ok: '🟩', near: '🟨', miss: '⬛' };
  const linhas = rows.map((r) => r.resultado.map((x) => icon[x]).join(''));
  const extra = pdr == null ? '' : ` · ${pdr > 0 ? '+' : ''}${pdr} PDR`;
  return `${name} ${won ? rows.length : 'X'}/${max}${extra}\n\n${linhas.join('\n')}${url ? `\n\n${url}` : ''}`;
}
