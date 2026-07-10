import { getFamilyForStage, isBossStage, getMonsterInfo } from '../data/monsters.js';

const HP_GROWTH = 1.145;
const HP_BASE = 20;
const BOSS_HP_MULT = 9;

const GOLD_GROWTH = 1.115;
const GOLD_BASE = 4;
const BOSS_GOLD_MULT = 6;

// Damage per second the monster deals back to the player, scaling more
// gently than its own HP so gear (HP/armor) can realistically keep up.
const PLAYER_DPS_TAKEN_GROWTH = 1.13;
const PLAYER_DPS_TAKEN_BASE = 2;
const BOSS_DPS_TAKEN_MULT = 3;

// Diminishing-returns armor formula: reduction = armor / (armor + K).
// Never reaches 100%, so armor is always worth stacking but never trivializes
// combat outright.
const ARMOR_CONSTANT = 100;

const COMMON_DROP_CHANCE = 0.35;
const RARE_DROP_CHANCE = 0.06;
const BOSS_RARE_DROP_CHANCE = 0.9;

// Same flat chance for every monster of a family, regular or boss — the Gem
// is the rare "jackpot" material needed for the Rank Master upgrade.
const GEM_DROP_CHANCE = 0.005;

export function monsterMaxHp(stage) {
  const base = HP_BASE * Math.pow(HP_GROWTH, stage - 1);
  return Math.max(1, Math.round(isBossStage(stage) ? base * BOSS_HP_MULT : base));
}

export function monsterGoldReward(stage) {
  const base = GOLD_BASE * Math.pow(GOLD_GROWTH, stage - 1);
  return Math.max(1, Math.round(isBossStage(stage) ? base * BOSS_GOLD_MULT : base));
}

export function monsterDamagePerSecond(stage) {
  const base = PLAYER_DPS_TAKEN_BASE * Math.pow(PLAYER_DPS_TAKEN_GROWTH, stage - 1);
  return Math.max(0.1, isBossStage(stage) ? base * BOSS_DPS_TAKEN_MULT : base);
}

export function armorReduction(armor) {
  return armor / (armor + ARMOR_CONSTANT);
}

export function getCurrentMonster(stage) {
  const info = getMonsterInfo(stage);
  return { ...info, maxHp: monsterMaxHp(stage), dps: monsterDamagePerSecond(stage) };
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

  const gemChance = Math.min(0.5, GEM_DROP_CHANCE * dropMult);
  if (Math.random() < gemChance) {
    drops.push({ id: family.materials.gem.id, name: family.materials.gem.name, emoji: family.materials.gem.emoji, qty: 1 });
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
