// Regras do "adivinhe o campeão" (sem tela): comparação das características,
// campeão do dia, busca pelo nome, estatísticas e texto para compartilhar.
import { dayIndex as dayIndexFrom, pickForDay } from '../../../shared/diario.js';

// Dia 1 do jogo. O campeão troca à meia-noite de Brasília.
export const FIRST_DAY = '2026-09-29';
export const MAX_TRIES = 8;
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

// Comparação de nomes sem acento, maiúscula nem símbolos.
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Sugestões: só campeões cujo nome começa com o que foi digitado
// (sem contar acento, maiúscula nem apóstrofo), em ordem alfabética.
export function search(query, campeoes, exclude = new Set()) {
  const q = fold(query);
  if (!q) return [];
  return campeoes.filter((c) => !exclude.has(c.nome) && fold(c.nome).startsWith(q));
}

// O nome digitado por completo (ou null se não for um dos campeões).
export const exactMatch = (query, campeoes) => campeoes.find((c) => fold(c.nome) === fold(query)) || null;

// Dica: confirma uma característica que ainda não ficou verde em nenhuma
// tentativa (sorteada). Sem nenhuma sobrando, devolve null.
export function pickHint(guesses, answer, rnd = Math.random) {
  const green = new Set();
  for (const g of guesses) compare(g, answer).forEach((r, i) => { if (r.state === 'ok') green.add(COLUMNS[i].key); });
  const left = COLUMNS.filter((c) => !green.has(c.key));
  return left.length ? left[Math.floor(rnd() * left.length)].key : null;
}

export function formatValue(key, answer) {
  const v = answer[key];
  if (key === 'genero') return { M: 'Masculino', F: 'Feminino' }[v] || v;
  return Array.isArray(v) ? v.join(', ') : String(v);
}

// history: { [dia]: { tries, won } } (saves antigos guardavam só o número de tentativas).
const entry = (h) => (typeof h === 'number' ? { tries: h, won: true } : h);

export function computeStats(history, today) {
  const days = Object.keys(history || {}).map(Number).sort((a, b) => a - b);
  const dist = Array(MAX_TRIES).fill(0);
  let wins = 0;
  let losses = 0;
  let best = 0;
  let run = 0;
  let prev = null;
  let triesSum = 0;
  for (const d of days) {
    const h = entry(history[d]);
    if (h.won) {
      wins++;
      triesSum += h.tries;
      dist[Math.min(MAX_TRIES, h.tries) - 1]++;
      run = prev !== null && d === prev + 1 && run > 0 ? run + 1 : 1;
    } else {
      losses++;
      run = 0;
    }
    best = Math.max(best, run);
    prev = d;
  }
  const last = days.length ? entry(history[days.at(-1)]) : null;
  const streak = last?.won && today - days.at(-1) <= 1 ? run : 0;
  const played = wins + losses;
  return {
    played, wins, losses, pct: played ? Math.round((wins / played) * 100) : 0,
    avg: wins ? triesSum / wins : null, streak, best, dist,
  };
}

// A dica conta como tentativa (aparece como 💡 no fim).
export function shareText({ name, number, guesses, answer, won, hint = false, url, max = MAX_TRIES }) {
  const icon = { ok: '🟩', part: '🟨', miss: '🟥' };
  const rows = guesses.map((g) => compare(g, answer).map((r) => (r.arrow ? (r.arrow === 'up' ? '⬆️' : '⬇️') : icon[r.state])).join(''));
  const dicas = Number(hint) || 0; // true/false (1 dica) ou o número de dicas
  const used = guesses.length + dicas;
  return `${name} #${number} ${won ? used : 'X'}/${max}${dicas ? ` ${'💡'.repeat(dicas)}` : ''}\n\n${rows.join('\n')}${url ? `\n\n${url}` : ''}`;
}

// Igual ao shareText, mas a partir dos resultados já avaliados (com conta,
// quem avalia é o servidor): rows = [[{ state, arrow }, …], …].
export function shareRows({ name, rows, won, dicas = 0, url, max = MAX_TRIES, pdr = null }) {
  const icon = { ok: '🟩', part: '🟨', miss: '🟥' };
  const linhas = rows.map((res) => res.map((r) => (r.arrow ? (r.arrow === 'up' ? '⬆️' : '⬇️') : icon[r.state])).join(''));
  const used = rows.length + dicas;
  const extra = pdr == null ? '' : ` · ${pdr > 0 ? '+' : ''}${pdr} PDR`;
  return `${name} ${won ? used : 'X'}/${max}${dicas ? ` ${'💡'.repeat(dicas)}` : ''}${extra}\n\n${linhas.join('\n')}${url ? `\n\n${url}` : ''}`;
}
