import { ROLES, STYLES } from '../data/world.js';
import { poisson, rand, shuffle } from '../util.js';

// Diferença de 10 pontos de força ≈ 74% de vitória por partida.
export const winProb = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 22));

export function simGame(powerA, powerB) {
  return Math.random() < winProb(powerA + rand(-3, 3), powerB + rand(-3, 3));
}

export function simSeries(powerA, powerB, bestOf) {
  const need = Math.ceil(bestOf / 2);
  let a = 0;
  let b = 0;
  while (a < need && b < need) {
    if (simGame(powerA, powerB)) a++; else b++;
  }
  return { a, b };
}

// Tabela de turno único pelo método do círculo.
export function roundRobin(ids) {
  const list = shuffle(ids);
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) pairs.push([a, b]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

// Estatística individual de uma partida.
export function gameStats(player, ovr, win) {
  const r = ROLES[player.role].kda;
  const s = STYLES[player.style].kda;
  const perf = 1 + (ovr - 70) / 70;
  const k = poisson(Math.max(0.2, r.k * s.k * perf * (win ? 1.35 : 0.6)));
  const d = poisson(Math.max(0.3, (r.d * s.d) / perf * (win ? 0.65 : 1.35)));
  const a = poisson(Math.max(0.5, r.a * s.a * perf * (win ? 1.3 : 0.65)));
  const score = (k * 2 + a) / Math.max(1, d);
  const pog = win && Math.random() < Math.min(0.6, 0.08 + score / 30 + (ovr - 75) / 100);
  return { k, d, a, pog };
}
