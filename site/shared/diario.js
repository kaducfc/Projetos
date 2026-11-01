// Jogos diários: o dia vira à meia-noite de Brasília (UTC−3, sem horário de
// verão), igual para todo mundo.
const TZ = 'America/Sao_Paulo';

// Data de hoje em Brasília, "AAAA-MM-DD".
export function brDate(now = new Date()) {
  try {
    return now.toLocaleDateString('sv-SE', { timeZone: TZ });
  } catch {
    return new Date(now.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
  }
}

const dayMs = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

// Número do dia desde firstDay (0 = primeiro dia).
export function dayIndex(firstDay, now = new Date()) {
  return Math.max(0, Math.round((dayMs(brDate(now)) - dayMs(firstDay)) / 864e5));
}

// Tempo até a próxima meia-noite de Brasília.
export function msToNextDay(now = new Date()) {
  const next = dayMs(brDate(now)) + 864e5 + 3 * 3600e3;
  return Math.max(0, next - now.getTime());
}

export const pickForDay = (index, list) => list[((index % list.length) + list.length) % list.length];

export function fmtCountdown(ms) {
  const s = Math.ceil(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':');
}
