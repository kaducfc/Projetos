import { ZONES } from '../data/monsters.js';

// Curva de XP pra próximo nível — cada monstro derrotado dá XP igual ao
// número da sua zona (1-based, ver xpForZone abaixo: Zona 1 = 1 XP, Zona 10
// = 10 XP), então caçar em zonas mais altas rende nível mais rápido, não só
// mais ouro/material. Reformulada do zero (pedido do usuário: nível 100
// chegava em menos de 1 dia, rápido demais) — 2 fases de crescimento
// exponencial (base * growth^(nível-1)), calibradas por simulação
// assumindo 6s por kill:
// - Nível 1-19 (HUNTER_XP_GROWTH_EARLY): começo rápido, ~1h até o nível 10
//   e ~3h até o 20 jogando ativo sem parar.
// - Nível 20-200 (HUNTER_XP_GROWTH_MID): uma única taxa uniforme (mais
//   dura que a de antes) — nível 150 em ~10 dias e nível 200 em ~3 semanas,
//   num ritmo de 3h ativas + 4h offline por dia.
const HUNTER_XP_BASE = 30;
const HUNTER_XP_GROWTH_EARLY = 1.115;
const HUNTER_XP_EARLY_CAP_LEVEL = 19;
const HUNTER_XP_GROWTH_MID = 1.0222693465578296;

// Sem cap de nível — sobe indefinidamente. A partir do nível 201 a curva
// fica consideravelmente mais dura: continua a mesma taxa da fase
// 20-200 (HUNTER_XP_GROWTH_MID), só que quintuplicada — pedido explícito
// do usuário, ~5x mais difícil que o salto do 190 ao 200.
const HUNTER_XP_QUINTUPLE_FROM_LEVEL = 201;

function baseXpToNextLevel(level) {
  if (level <= HUNTER_XP_EARLY_CAP_LEVEL) {
    return HUNTER_XP_BASE * Math.pow(HUNTER_XP_GROWTH_EARLY, level - 1);
  }
  const xpAtEarlyCap = HUNTER_XP_BASE * Math.pow(HUNTER_XP_GROWTH_EARLY, HUNTER_XP_EARLY_CAP_LEVEL - 1);
  return xpAtEarlyCap * Math.pow(HUNTER_XP_GROWTH_MID, level - HUNTER_XP_EARLY_CAP_LEVEL);
}

export function xpToNextLevel(level) {
  const base = Math.round(baseXpToNextLevel(level));
  return level >= HUNTER_XP_QUINTUPLE_FROM_LEVEL ? base * 5 : base;
}

// XP por kill: igual ao número da zona (1-based) onde o monstro está, não
// importa se é chefe ou monstro fraco — Zona 1 dá 1 XP, Zona 2 dá 2 XP,
// ..., Zona 10 dá 10 XP.
export function xpForZone(zoneIndex, _isBoss) {
  return zoneIndex + 1;
}

/// Soma XP e resolve quantos níveis isso rende (pode subir mais de 1 de uma
/// vez). Retorna o número de níveis ganhos (0 se não subiu nenhum) — o
/// chamador usa isso pra mostrar um toast de "Level Up!". Sem cap de nível
/// — sobe indefinidamente (ver xpToNextLevel acima pra curva além do 200).
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
