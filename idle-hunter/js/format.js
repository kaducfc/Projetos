const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '0';
  const sign = value < 0 ? '-' : '';
  value = Math.abs(value);

  if (value < 1000) {
    return sign + (Number.isInteger(value) ? value.toString() : value.toFixed(1));
  }

  let tier = 0;
  while (value >= 1000 && tier < SUFFIXES.length - 1) {
    value /= 1000;
    tier++;
  }

  return `${sign}${value.toFixed(value < 10 ? 2 : value < 100 ? 1 : 0)}${SUFFIXES[tier]}`;
}

export function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/// Escapa texto vindo do jogador (hoje só o nick, ver systems/profile.js)
/// antes de injetar em innerHTML/atributo — os outros nomes exibidos no
/// jogo vêm sempre de data/* estático, nunca precisaram disso.
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}
