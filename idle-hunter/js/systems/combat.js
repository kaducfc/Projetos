import { isBossStage, getMonsterInfo, getBossForStage, pickRandomWeakMonster, getWeakMonster } from '../data/monsters.js';
import { getCardForMonster } from '../data/cards.js';
import { recordCardDiscovered } from './cards.js';

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

// Base chance for a "regular" material drop — the weak monster's one
// material, or each of a boss's two "drop principal" materials. Scaled by
// dropMult (Drop upgrades/gear), same as before.
const COMMON_DROP_CHANCE = 0.35;

// Boss-only Crystal and any monster/boss card are both *fixed* rates —
// explicitly never scaled by dropMult. Drop bonuses only affect the
// "regular" materials above; the rare stuff always stays this rare.
export const CRYSTAL_DROP_CHANCE = 0.002; // 0.2%
export const MONSTER_CARD_DROP_CHANCE = 0.02; // 2%

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

export function getCurrentMonster(stage, weakMonsterId) {
  const info = getMonsterInfo(stage, weakMonsterId);
  return { ...info, maxHp: monsterMaxHp(stage), dps: monsterDamagePerSecond(stage) };
}

/// weakMonsterId: the currently-spawned weak monster (see
/// ensureMonsterSpawned below) — only consulted on non-boss stages.
///
/// Boss: rolls each of the two "drop principal" materials independently
/// (dropMult-scaled), plus the boss's own Crystal and its card, both at a
/// fixed rate dropMult never touches.
/// Weak monster: rolls its one material (dropMult-scaled) plus its own
/// card, also at that same fixed rate.
export function rollDrops(stage, dropMult, weakMonsterId) {
  const boss = isBossStage(stage);
  const drops = [];
  const chance = Math.min(0.95, COMMON_DROP_CHANCE * dropMult);

  if (boss) {
    const b = getBossForStage(stage);
    for (const mat of [b.materials.primary1, b.materials.primary2]) {
      if (Math.random() < chance) {
        drops.push({ id: mat.id, name: mat.name, emoji: mat.emoji, qty: 1 });
      }
    }
    if (Math.random() < CRYSTAL_DROP_CHANCE) {
      drops.push({ id: b.crystal.id, name: b.crystal.name, emoji: b.crystal.emoji, qty: 1 });
    }
    if (Math.random() < MONSTER_CARD_DROP_CHANCE) {
      const card = getCardForMonster(b.id);
      drops.push({ id: card.id, name: card.name, emoji: card.emoji, qty: 1, isCard: true });
    }
    return drops;
  }

  const weak = getWeakMonster(weakMonsterId);
  if (Math.random() < chance) {
    drops.push({ id: weak.material.id, name: weak.material.name, emoji: weak.material.emoji, qty: 1 });
  }
  if (Math.random() < MONSTER_CARD_DROP_CHANCE) {
    const card = getCardForMonster(weak.id);
    drops.push({ id: card.id, name: card.name, emoji: card.emoji, qty: 1, isCard: true });
  }
  return drops;
}

/// Also rolls which weak monster is showing (persisted on state, since a
/// weak monster's identity has to stay fixed for the life of that HP pool
/// — re-rolling on every render would make the sprite flicker between
/// monsters mid-fight). null on boss stages, where that decade's boss is
/// always shown instead.
export function ensureMonsterSpawned(state) {
  if (state.monsterHp == null) {
    state.monsterHp = monsterMaxHp(state.stage);
    state.weakMonsterId = isBossStage(state.stage) ? null : pickRandomWeakMonster(state.stage).id;
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
  const drops = rollDrops(stage, stats.dropMult, state.weakMonsterId);
  const wasBoss = isBossStage(stage);

  state.gold += goldGained;
  for (const drop of drops) {
    const bucket = drop.isCard ? state.cards : state.materials;
    bucket[drop.id] = (bucket[drop.id] || 0) + drop.qty;
    if (drop.isCard) recordCardDiscovered(state, drop.id);
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
