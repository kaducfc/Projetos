// Helpers genéricos de aleatoriedade e formatação.

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const roll = (pct) => Math.random() * 100 < pct;

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedPick(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return items[0];
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Poisson (Knuth) — usado pra abates/mortes/assistências por partida.
export function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

export function fmtMoney(usd) {
  if (usd >= 1e6) return `US$ ${(usd / 1e6).toFixed(1).replace('.', ',')} M`;
  if (usd >= 1e3) return `US$ ${Math.round(usd / 1e3)} mil`;
  return `US$ ${Math.round(usd)}`;
}

export function fmtSalary(usdMonth) {
  const k = usdMonth / 1000;
  return `US$ ${k >= 10 ? Math.round(k) : k.toFixed(1).replace('.', ',')}k/mês`;
}

export function fmtKda(k, d, a) {
  return ((k + a) / Math.max(1, d)).toFixed(1).replace('.', ',');
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
