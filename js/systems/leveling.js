import { ZONES } from '../data/monsters.js';

// Curva de XP suave — bem mais achatada que o crescimento de HP/Ouro dos
// monstros (ver HP_GROWTH/GOLD_GROWTH em combat.js), de propósito: o nível
// de caça só existe pra liberar Zona/Chefe, não pra virar outra corrida
// exponencial em paralelo.
const HUNTER_XP_BASE = 20;
const HUNTER_XP_GROWTH = 1.08;

export function xpToNextLevel(level) {
  return Math.round(HUNTER_XP_BASE * Math.pow(HUNTER_XP_GROWTH, level - 1));
}

// XP por kill: cresce só um pouco por zona (linear, não exponencial) — bem
// menos disparidade entre a Zona 1 e a Zona 10 do que HP/dano têm entre si.
// Chefe vale um bônus fixo em cima do valor da zona, não uma escala à parte.
const XP_BASE = 5;
const XP_PER_ZONE = 3;
const XP_BOSS_MULT = 6;

export function xpForZone(zoneIndex, isBoss) {
  const base = XP_BASE + zoneIndex * XP_PER_ZONE;
  return Math.round(isBoss ? base * XP_BOSS_MULT : base);
}

/// Soma XP e resolve quantos níveis isso rende (pode subir mais de 1 de uma
/// vez). Retorna o número de níveis ganhos (0 se não subiu nenhum) — o
/// chamador usa isso pra mostrar um toast de "Level Up!".
export function grantXp(state, amount) {
  state.hunterXp = (state.hunterXp || 0) + amount;
  let levelsGained = 0;
  while (state.hunterXp >= xpToNextLevel(state.hunterLevel)) {
    state.hunterXp -= xpToNextLevel(state.hunterLevel);
    state.hunterLevel += 1;
    levelsGained += 1;
  }
  return levelsGained;
}

export function isZoneUnlocked(state, zoneIndex) {
  const zone = ZONES[zoneIndex];
  if (!zone) return false;
  return (state.hunterLevel || 1) >= zone.zoneUnlockLevel;
}

export function isBossUnlocked(state, zoneIndex) {
  const zone = ZONES[zoneIndex];
  if (!zone) return false;
  return (state.hunterLevel || 1) >= zone.bossUnlockLevel;
}
