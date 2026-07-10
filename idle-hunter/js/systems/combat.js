import { getFamilyForStage, isBossStage, getMonsterInfo } from '../data/monsters.js';

const HP_GROWTH = 1.145;
const HP_BASE = 20;
const BOSS_HP_MULT = 9;

const GOLD_GROWTH = 1.115;
const GOLD_BASE = 4;
const BOSS_GOLD_MULT = 6;

const COMMON_DROP_CHANCE = 0.35;
const RARE_DROP_CHANCE = 0.06;
const BOSS_RARE_DROP_CHANCE = 0.9;

export function monsterMaxHp(stage) {
  const base = HP_BASE * Math.pow(HP_GROWTH, stage - 1);
  return Math.max(1, Math.round(isBossStage(stage) ? base * BOSS_HP_MULT : base));
}

export function monsterGoldReward(stage) {
  const base = GOLD_BASE * Math.pow(GOLD_GROWTH, stage - 1);
  return Math.max(1, Math.round(isBossStage(stage) ? base * BOSS_GOLD_MULT : base));
}

export function getCurrentMonster(stage) {
  const info = getMonsterInfo(stage);
  return { ...info, maxHp: monsterMaxHp(stage) };
}

export function rollDrops(stage, dropMult) {
  const family = getFamilyForStage(stage);
  const boss = isBossStage(stage);
  const drops = [];

  const commonChance = Math.min(0.95, COMMON_DROP_CHANCE * dropMult);
  if (Math.random() < commonChance) {
    drops.push({ id: family.materials.common.id, name: family.materials.common.name, emoji: family.materials.common.emoji, qty: boss ? 3 : 1 });
  }

  const rareChance = Math.min(0.98, (boss ? BOSS_RARE_DROP_CHANCE : RARE_DROP_CHANCE) * dropMult);
  if (Math.random() < rareChance) {
    drops.push({ id: family.materials.rare.id, name: family.materials.rare.name, emoji: family.materials.rare.emoji, qty: 1 });
  }

  return drops;
}

export function ensureMonsterSpawned(state) {
  if (state.monsterHp == null) {
    state.monsterHp = monsterMaxHp(state.stage);
  }
}

/// Applies damage to the current monster. Returns a kill event (or null if
/// the monster survived) describing gold/drops/stage-advance so the UI layer
/// can react without this module knowing about the DOM.
export function applyDamage(state, amount, stats) {
  ensureMonsterSpawned(state);
  state.monsterHp -= amount;

  if (state.monsterHp > 0) return null;

  const stage = state.stage;
  const goldGained = Math.round(monsterGoldReward(stage) * stats.goldMult);
  const drops = rollDrops(stage, stats.dropMult);
  const wasBoss = isBossStage(stage);

  state.gold += goldGained;
  for (const drop of drops) {
    state.materials[drop.id] = (state.materials[drop.id] || 0) + drop.qty;
  }
  state.totalKills += 1;

  const advanced = state.stage >= state.maxStage;
  if (advanced) {
    state.maxStage = state.stage + 1;
    state.stage = state.stage + 1;
  }
  state.monsterHp = null;
  ensureMonsterSpawned(state);

  return { stage, goldGained, drops, wasBoss, advanced, newStage: state.stage };
}

export function setViewedStage(state, stage) {
  const clamped = Math.max(1, Math.min(stage, state.maxStage));
  if (clamped === state.stage) return false;
  state.stage = clamped;
  state.monsterHp = null;
  ensureMonsterSpawned(state);
  return true;
}
