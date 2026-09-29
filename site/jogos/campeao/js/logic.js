// Regras do "adivinhe o campeão" (sem tela): comparação das características,
// campeão do dia, busca pelo nome, estatísticas e texto para compartilhar.
import { dayIndex as dayIndexFrom, pickForDay } from '../../../shared/diario.js';

// Dia 1 do jogo. O campeão troca à meia-noite de Brasília.
export const FIRST_DAY = '2026-09-29';
export const dayIndex = (now = new Date()) => dayIndexFrom(FIRST_DAY, now);
export const championFor = (index, data) => {
  const nome = pickForDay(index, data.ordem);
  return data.campeoes.find((c) => c.nome === nome);
};

// Colunas na ordem da tela. "list": pode ter mais de um valor (acerto parcial).
export const COLUMNS = [
  { key: 'ano', label: 'Ano de lançamento', kind: 'year' },
  { key: 'genero', label: 'Gênero', kind: 'one' },
  { key: 'regioes', label: 'Região', kind: 'list' },
  { key: 'posicoes', label: 'Posição', kind: 'list' },
  { key: 'classes', label: 'Classe', kind: 'list' },
  { key: 'especies', label: 'Espécie', kind: 'list' },
  { key: 'alcance', label: 'Alcance', kind: 'list' },
];

// 'ok' = igual; 'part' = só parte bate; 'miss' = nada bate.
// No ano, quando erra, diz se o campeão do dia é mais novo ('up') ou mais antigo ('down').
export function compare(guess, answer) {
  return COLUMNS.map((col) => {
    const g = guess[col.key];
    const a = answer[col.key];
    if (col.kind === 'year') {
      if (g === a) return { state: 'ok' };
      return { state: 'miss', arrow: a > g ? 'up' : 'down' };
    }
    if (col.kind === 'one') return { state: g === a ? 'ok' : 'miss' };
    const gs = new Set(g);
    const as = new Set(a);
    const same = gs.size === as.size && [...gs].every((x) => as.has(x));
    if (same) return { state: 'ok' };
    return { state: [...gs].some((x) => as.has(x)) ? 'part' : 'miss' };
  });
}

// Busca sem acento nem símbolos; primeiro quem começa com o texto.
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function search(query, campeoes, exclude = new Set(), limit = 8) {
  const q = fold(query);
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const c of campeoes) {
    if (exclude.has(c.nome)) continue;
    const n = fold(c.nome);
    if (n.startsWith(q)) starts.push(c);
    else if (n.includes(q)) contains.push(c);
  }
  return [...starts, ...contains].slice(0, limit);
}

// history: { [dia]: número de tentativas até acertar }
export const DIST = [
  { label: '1', test: (n) => n === 1 },
  { label: '2', test: (n) => n === 2 },
  { label: '3', test: (n) => n === 3 },
  { label: '4', test: (n) => n === 4 },
  { label: '5', test: (n) => n === 5 },
  { label: '6–9', test: (n) => n >= 6 && n <= 9 },
  { label: '10+', test: (n) => n >= 10 },
];

export function computeStats(history, today) {
  const days = Object.keys(history || {}).map(Number).sort((a, b) => a - b);
  const tries = days.map((d) => history[d]);
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const streak = prev !== null && today - prev <= 1 ? run : 0;
  const avg = tries.length ? tries.reduce((s, n) => s + n, 0) / tries.length : null;
  return {
    played: days.length, avg, streak, best,
    dist: DIST.map((b) => tries.filter(b.test).length),
  };
}

export function shareText({ name, number, guesses, answer, url }) {
  const icon = { ok: '🟩', part: '🟨', miss: '🟥' };
  const rows = guesses.map((g) => compare(g, answer).map((r) => (r.arrow ? (r.arrow === 'up' ? '⬆️' : '⬇️') : icon[r.state])).join(''));
  const n = guesses.length;
  const shown = rows.length > 8 ? [...rows.slice(0, 7), `… +${rows.length - 7}`] : rows;
  return `${name} #${number}: acertei em ${n} ${n === 1 ? 'tentativa' : 'tentativas'}\n\n${shown.join('\n')}${url ? `\n\n${url}` : ''}`;
}
