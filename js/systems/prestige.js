import { computePlayerStats } from './stats.js';
import { ensureMonsterSpawned } from './combat.js';

export const REBIRTH_MIN_STAGE = 20;

export function runasGain(maxStage) {
  if (maxStage < REBIRTH_MIN_STAGE) return 0;
  return Math.floor(Math.pow(maxStage / 15, 1.3));
}

export function canRebirth(state) {
  return state.maxStage >= REBIRTH_MIN_STAGE && runasGain(state.maxStage) > 0;
}

/// Rebirth resets soft progress (stage, gold, regular upgrades) but keeps
/// crafted equipment, materials and prestige upgrades — the crafting grind
/// is meant to be a permanent collection, not something you lose on reset.
export function doRebirth(state) {
  if (!canRebirth(state)) return 0;

  const gained = runasGain(state.maxStage);
  state.runas += gained;
  state.rebirthCount = (state.rebirthCount || 0) + 1;

  const stats = computePlayerStats(state);
  const startStage = 1 + Math.round(stats.startStageBonus);

  state.gold = 0;
  state.upgrades = {};
  state.stage = startStage;
  state.maxStage = startStage;
  state.monsterHp = null;
  ensureMonsterSpawned(state);

  return gained;
}
