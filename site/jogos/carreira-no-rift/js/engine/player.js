import { ATTRS, ROLES, STYLES, REGION_LEVEL } from '../data/world.js';
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
    attrs[a.id] = clamp(Math.round(50 + (w[a.id] - 0.2) * 70 + randInt(-3, 3) + (fx[a.id] || 0)), ATTR_MIN, ATTR_DIFICIL);
  }
  return attrs;
}

export function createPlayer({ nick, nat, region, role, style, attrs }) {
  return {
    nick, nat, role, style, region,
    attrs: { ...attrs },
    // Teto sorteado (potencial de lenda, 93+, é bem raro). Quem começa na
    // Coreia ou na China cresce no ambiente mais competitivo: +3 de teto.
    potential: 73 + Math.round(21 * Math.pow(Math.random(), 1.9))
      + (REGION_LEVEL[region]?.rank === 3 ? 3 : 0),
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

// Limites dos atributos. Até 93 o ganho é normal; daí para cima cada ponto
// fica cada vez mais difícil (e o 100 é o teto, nunca passa).
export const ATTR_MIN = 30;
export const ATTR_MAX = 100;
export const ATTR_DIFICIL = 93;
const round1 = (x) => Math.round(x * 10) / 10;

// Quanto de um ganho "entra" estando em `x` (1 até 93, cai até 0 no 100).
export function fatorGanho(x) {
  if (x < ATTR_DIFICIL) return 1;
  return Math.max(0, 0.45 * ((ATTR_MAX - x) / (ATTR_MAX - ATTR_DIFICIL)));
}

// Ganho de decisão: `pontos` inteiros. Abaixo de 93 cada ponto entra; acima,
// cada ponto só entra com a chance de fatorGanho (e para no primeiro que falha).
export function ganharPontos(x, pontos) {
  let cur = x;
  for (let i = 0; i < pontos && cur < ATTR_MAX; i++) {
    if (cur >= ATTR_DIFICIL && Math.random() >= fatorGanho(cur)) break;
    cur = Math.min(ATTR_MAX, cur + 1);
  }
  return cur;
}

// Ganho contínuo (evolução de fim de temporada): acima de 93 rende cada vez menos.
export function ganharContinuo(x, g) {
  let cur = x;
  let resto = g;
  while (resto > 1e-9 && cur < ATTR_MAX) {
    const passo = Math.min(resto, 0.25);
    cur = Math.min(ATTR_MAX, cur + passo * fatorGanho(cur));
    resto -= passo;
  }
  return cur;
}

// Aplica os efeitos de uma decisão e devolve o que mudou DE VERDADE (é isso
// que aparece na tela). `garantia`: 'ganho' (acertou) ou 'mudanca' (errou):
// se nenhum atributo mudou (efeito sem atributo ou atributo no teto), mexe em
// 1 ponto de `attrPadrao` ou, no acerto, no atributo mais baixo que ainda dá
// para subir.
export function applyFx(p, fx, { garantia = null, attrPadrao = null } = {}) {
  // Ganhos rendem menos quando o jogador já está perto do teto (potencial),
  // mas uma decisão certa sempre rende pelo menos 1 ponto.
  const room = clamp((p.potential - ovrOf(p)) / 8, 0.1, 1);
  const real = {};
  const mexer = (id, novo) => {
    const antes = p.attrs[id];
    p.attrs[id] = round1(clamp(novo, ATTR_MIN, ATTR_MAX));
    const d = round1(p.attrs[id] - antes);
    if (d) real[id] = round1((real[id] || 0) + d);
  };
  for (const a of ATTRS) {
    const v = fx[a.id];
    if (!v) continue;
    if (v > 0) mexer(a.id, ganharPontos(p.attrs[a.id], Math.max(1, Math.round(v * room))));
    else mexer(a.id, p.attrs[a.id] + v);
  }
  const subiu = ATTRS.some((a) => real[a.id] > 0);
  const mudou = ATTRS.some((a) => real[a.id]);
  if (garantia === 'ganho' && !subiu) {
    // O atributo da decisão, se ainda dá para subir sem dificuldade; senão o
    // mais baixo do jogador (que ainda não está no 100).
    const livres = ATTRS.map((a) => a.id).filter((id) => p.attrs[id] < ATTR_MAX);
    const alvo = attrPadrao && p.attrs[attrPadrao] < ATTR_DIFICIL ? attrPadrao
      : livres.sort((x, y) => p.attrs[x] - p.attrs[y])[0];
    if (alvo) mexer(alvo, Math.min(ATTR_MAX, p.attrs[alvo] + 1));
  } else if (garantia === 'mudanca' && !mudou) {
    const alvo = attrPadrao && p.attrs[attrPadrao] > ATTR_MIN ? attrPadrao
      : ATTRS.map((a) => a.id).sort((x, y) => p.attrs[y] - p.attrs[x])[0];
    mexer(alvo, p.attrs[alvo] - 1);
  }
  for (const k of ['morale', 'fame']) {
    if (!fx[k]) continue;
    const antes = p[k];
    p[k] = clamp(p[k] + fx[k], 0, 100);
    if (p[k] !== antes) real[k] = p[k] - antes;
  }
  p.peakOvr = Math.max(p.peakOvr, ovrOf(p));
  return real;
}

// Desempenho em jogo leva em conta o momento (confiança do técnico).
export const effectiveOvr = (p) => ovrOf(p) + (p.morale - 50) / 12;

// Volta ao potencial por temporada (fração do quanto passou dele). Junto com
// o teto base 73 (era 74), compensa o ponto garantido das decisões certas:
// a distribuição de OVR máximo ficou igual à de antes (scripts/simulate.mjs).
const REGRESSAO = 0.5;

// Crescimento extra por idade (soma ≈ diferença do OVR inicial mais baixo).
const YOUTH_BOOST = { 16: 1.2, 17: 1.6, 18: 1.6, 19: 1.3, 20: 1.0, 21: 0.7 };

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
  // Jovem começa com OVR baixo (~50-55) e tem um impulso extra de evolução
  // até os 21, para alcançar o mesmo nível de antes na fase adulta.
  g += (YOUTH_BOOST[p.age] || 0) * clamp(gap / 4, 0, 1);
  // Decisões da temporada: acertos (principalmente os arriscados) ajudam.
  g += perf.decisions || 0;
  // Quem passou do próprio teto (potencial) com os pontos garantidos das
  // decisões volta aos poucos para perto dele.
  if (before > p.potential) g -= (before - p.potential) * REGRESSAO;

  // Liga forte = treino e adversários melhores = evolução maior.
  if (g > 0) g *= perf.env ?? 1;

  if (g >= 0) {
    for (const a of ATTRS) p.attrs[a.id] = ganharContinuo(p.attrs[a.id], g * rand(0.7, 1.3));
  } else {
    const loss = -g;
    const mult = { mec: 1.6, rota: 1.2, tf: 0.9, macro: -0.3, mental: -0.2 };
    for (const a of ATTRS) {
      const d = -loss * mult[a.id]; // macro e mental ainda sobem um pouco com a idade
      p.attrs[a.id] = d > 0 ? ganharContinuo(p.attrs[a.id], d) : clamp(p.attrs[a.id] + d, ATTR_MIN, ATTR_MAX);
    }
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
