import { ATTRS, ROLES, STYLES } from '../data/world.js';
import { clamp, rand, randInt } from '../util.js';

export function calcOvr(attrs, role) {
  const w = ROLES[role].w;
  let s = 0;
  for (const a of ATTRS) s += attrs[a.id] * w[a.id];
  return Math.round(s);
}

export const ovrOf = (p) => calcOvr(p.attrs, p.role);

// Atributos iniciais coerentes com a rota: o que pesa mais nela vem mais alto.
export function rollAttrs(role, style) {
  const w = ROLES[role].w;
  const fx = STYLES[style]?.fx || {};
  const attrs = {};
  for (const a of ATTRS) {
    attrs[a.id] = clamp(Math.round(57 + (w[a.id] - 0.2) * 70 + randInt(-3, 3) + (fx[a.id] || 0)), 30, 99);
  }
  return attrs;
}

export function createPlayer({ nick, nat, region, role, style, attrs }) {
  return {
    nick, nat, role, style, region,
    attrs: { ...attrs },
    // Mediana ~77; 90+ só para ~6%; potencial de lenda (93+) é bem raro.
    potential: 74 + Math.round(21 * Math.pow(Math.random(), 1.9)),
    age: 16,
    morale: 55,
    fame: 5,
    teamId: null,
    contract: null,
    status: 'titular',
    stats: { games: 0, wins: 0, k: 0, d: 0, a: 0, pog: 0 },
    earnings: { salary: 0, prizes: 0 },
    history: [],
    trophies: [],
    usedEvents: [],
    peakOvr: calcOvr(attrs, role),
  };
}

export function applyFx(p, fx) {
  // Ganhos rendem menos quando o jogador já está perto do teto (potencial).
  const room = clamp((p.potential - ovrOf(p)) / 8, 0.1, 1);
  for (const a of ATTRS) {
    const v = fx[a.id];
    if (v) p.attrs[a.id] = clamp(p.attrs[a.id] + (v > 0 ? v * room : v), 30, 99);
  }
  if (fx.morale) p.morale = clamp(p.morale + fx.morale, 0, 100);
  if (fx.fame) p.fame = clamp(p.fame + fx.fame, 0, 100);
  p.peakOvr = Math.max(p.peakOvr, ovrOf(p));
}

// Desempenho em jogo leva em conta o momento (confiança do técnico).
export const effectiveOvr = (p) => ovrOf(p) + (p.morale - 50) / 12;

// Evolução de fim de temporada: jovens crescem em direção ao potencial,
// veteranos perdem mecânica mas ganham leitura de jogo.
export function seasonGrowth(p, perf) {
  const before = ovrOf(p);
  const gap = Math.max(0, p.potential - before);
  let g;
  // Curva de carreira (auge do LoL é cedo): começa devagar aos 16-17, cresce
  // forte dos 18 aos 22, chega ao auge entre 19 e 24, depois mantém ou
  // cresce pouco e começa a cair por volta dos 27. Ter 75+ aos 17-18 é raro
  // (só com potencial altíssimo).
  // A parte aleatória do crescimento some quando o jogador chega ao teto.
  const r = clamp(gap / 4, 0, 1);
  if (p.age <= 17) g = gap * 0.07 + rand(0, 0.8) * r;
  else if (p.age <= 22) g = gap * 0.17 + rand(0, 1.2) * r;
  else if (p.age <= 24) g = gap * 0.1 + rand(-0.3, 0.8 * r);
  else if (p.age <= 26) g = gap * 0.03 + rand(-0.8, 0.5 * r);
  else if (p.age === 27) g = -rand(0.3, 1.3);
  else g = -rand(1, 2.5) - (p.age - 28) * 0.5;

  // Quem joga e vence evolui mais; quem fica no banco estagna.
  const bonus = (perf.playedRatio - 0.6) * 1.5 + (perf.winRate - 0.5) * 1.5 + (p.morale - 50) / 60;
  g += bonus > 0 ? bonus * clamp(gap / 6, 0, 1) : bonus;

  // Liga forte = treino e adversários melhores = evolução maior.
  if (g > 0) g *= perf.env ?? 1;

  if (g >= 0) {
    for (const a of ATTRS) p.attrs[a.id] = clamp(p.attrs[a.id] + g * rand(0.7, 1.3), 30, 99);
  } else {
    const loss = -g;
    const mult = { mec: 1.6, rota: 1.2, tf: 0.9, macro: -0.3, mental: -0.2 };
    for (const a of ATTRS) p.attrs[a.id] = clamp(p.attrs[a.id] - loss * mult[a.id], 30, 99);
  }
  for (const a of ATTRS) p.attrs[a.id] = Math.round(p.attrs[a.id] * 10) / 10;
  p.peakOvr = Math.max(p.peakOvr, ovrOf(p));
  return ovrOf(p) - before;
}

export function marketValue(p) {
  const ovr = ovrOf(p);
  const ageMult = p.age <= 20 ? 1.4 : p.age <= 24 ? 1.15 : p.age <= 27 ? 0.9 : 0.55;
  return Math.round(20000 * Math.exp((ovr - 50) / 7) * ageMult * (1 + p.fame / 200));
}

// Salário mensal (US$). Depende do OVR, da divisão e de quanto cada liga
// paga: LPL e LCS pagam mais, CBLOL bem menos. Cada divisão tem um piso.
const REGION_PAY = { cn: 1.1, na: 1, kr: 0.9, eu: 0.8, br: 0.35, wc: 0.5 };
const TIER_PAY = { 1: 1, 2: 0.4, 3: 0.2 };
const TIER_FLOOR = { 1: 2500, 2: 800, 3: 400 };

export function salaryFor(ovr, team) {
  const pay = 1000 * Math.exp((ovr - 55) / 9) * TIER_PAY[team.tier] * (REGION_PAY[team.region] ?? 1);
  return Math.round(Math.max(TIER_FLOOR[team.tier], pay) * rand(0.9, 1.15));
}

// Titular / disputa / reserva conforme o OVR em relação ao nível do time.
export function statusFor(ovr, teamRating, morale = 50) {
  const diff = ovr - teamRating + (morale - 50) / 10;
  if (diff >= -4) return 'titular';
  if (diff >= -9) return 'disputa';
  return 'reserva';
}

export const STATUS = {
  titular: { name: 'Titular', play: 1 },
  disputa: { name: 'Disputa de vaga', play: 0.6 },
  reserva: { name: 'Reserva', play: 0.25 },
};
