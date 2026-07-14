import { isBossStage, getMonsterInfo, getBossForStage, pickRandomWeakMonster, getWeakMonster } from '../data/monsters.js';
import { getCardForMonster } from '../data/cards.js';
import { recordCardDiscovered } from './cards.js';

const HP_GROWTH = 1.145;
const HP_BASE = 20;
const BOSS_HP_MULT = 9;

const GOLD_GROWTH = 1.115;
const GOLD_BASE = 4;
const BOSS_GOLD_MULT = 6;
const GOLD_DROP_BONUS = 1.15; // +15% gold per kill across the board

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
export const CRYSTAL_DROP_CHANCE = 0.01; // 1%
export const BOSS_CARD_DROP_CHANCE = 0.0007; // 0.07% (~1 per 1,429 boss kills)
export const WEAK_CARD_DROP_CHANCE = 0.0003; // 0.03% (~1 per 3,333 kills)

// isBoss defaults to a plain stage% lookup, but callers whose own notion of
// "boss" doesn't line up 1:1 with real stage numbers (e.g. the Torre
// Infinita, see systems/tower.js) can pass it explicitly instead — passing
// isBossStage(someDerivedStageNumber) here would silently miscount a
// "weak" fight as a boss fight whenever that derived number happened to
// land on a multiple of BOSS_INTERVAL.
export function monsterMaxHp(stage, isBoss = isBossStage(stage)) {
  const base = HP_BASE * Math.pow(HP_GROWTH, stage - 1);
  return Math.max(1, Math.round(isBoss ? base * BOSS_HP_MULT : base));
}

export function monsterGoldReward(stage, isBoss = isBossStage(stage)) {
  const base = GOLD_BASE * Math.pow(GOLD_GROWTH, stage - 1);
  const withBossMult = isBoss ? base * BOSS_GOLD_MULT : base;
  return Math.max(1, Math.round(withBossMult * GOLD_DROP_BONUS));
}

export function monsterDamagePerSecond(stage, isBoss = isBossStage(stage)) {
  const base = PLAYER_DPS_TAKEN_BASE * Math.pow(PLAYER_DPS_TAKEN_GROWTH, stage - 1);
  return Math.max(0.1, isBoss ? base * BOSS_DPS_TAKEN_MULT : base);
}

/// Rolled independently for every single hit — a click, or each DPS tick —
/// so a fast-DPS build gets many small independent chances at a crit
/// rather than one roll "for the whole second". Multiplier is 1 on a
/// whiff, or 1 + critDamage% on a crit; caller just multiplies the base
/// damage by it.
export function rollCrit(stats) {
  const isCrit = Math.random() * 100 < (stats.critChance || 0);
  return { isCrit, multiplier: isCrit ? 1 + (stats.critDamage || 0) / 100 : 1 };
}

/// Shared by every deliberate click (main monster, event boss, Torre
/// Infinita) — not DPS ticks, since the Solkaiser card's burst is
/// specifically "o próximo CLIQUE". elementalMultiplier is the caller's
/// precomputed `1 + elementDamageModifier(...) + getCardDamageBonus(...)`.
/// state.solkaiserClickCounter is persisted (state.js) so the countdown
/// survives a reload; only advances/resets when the card is actually
/// socketed (stats.clickBurstEveryN is null otherwise, see stats.js).
export function resolveClickHit(state, stats, elementalMultiplier) {
  if (stats.clickBurstEveryN) {
    state.solkaiserClickCounter = (state.solkaiserClickCounter || 0) + 1;
    if (state.solkaiserClickCounter > stats.clickBurstEveryN) {
      state.solkaiserClickCounter = 0;
      const dealt = stats.clickDamage * elementalMultiplier * stats.clickBurstDamageMult;
      return { dealt, isCrit: true, isBurst: true };
    }
  }
  const crit = rollCrit(stats);
  return { dealt: stats.clickDamage * elementalMultiplier * crit.multiplier, isCrit: crit.isCrit, isBurst: false };
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
    if (Math.random() < BOSS_CARD_DROP_CHANCE) {
      const card = getCardForMonster(b.id);
      drops.push({ id: card.id, name: card.name, emoji: card.emoji, qty: 1, isCard: true });
    }
    return drops;
  }

  const weak = getWeakMonster(weakMonsterId);
  if (Math.random() < chance) {
    drops.push({ id: weak.material.id, name: weak.material.name, emoji: weak.material.emoji, qty: 1 });
  }
  if (Math.random() < WEAK_CARD_DROP_CHANCE) {
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
  const wasBoss = isBossStage(stage);

  // Rolls one kill's worth of gold (Chispim card: independent chance to
  // double it) + drops — factored out so the Gaiatron reproc below can
  // reuse it for "all the same rewards, a second time" without duplicating
  // the roll logic.
  const rollReward = () => {
    let gold = Math.round(monsterGoldReward(stage) * stats.goldMult);
    if (Math.random() * 100 < (stats.goldDoubleChance || 0)) gold *= 2;
    return { gold, drops: rollDrops(stage, stats.dropMult, state.weakMonsterId) };
  };

  let goldGained = 0;
  let drops = [];
  let reprocced = false;
  const first = rollReward();
  goldGained += first.gold;
  drops = drops.concat(first.drops);

  if (wasBoss && Math.random() * 100 < (stats.bossReprocChance || 0)) {
    reprocced = true;
    const second = rollReward();
    goldGained += second.gold;
    drops = drops.concat(second.drops);
  }

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

  return { stage, goldGained, drops, wasBoss, advanced, newStage: state.stage, reprocced };
}

export function setViewedStage(state, stage) {
  const clamped = Math.max(1, Math.min(stage, state.maxStage));
  if (clamped === state.stage) return false;
  state.stage = clamped;
  state.monsterHp = null;
  ensureMonsterSpawned(state);
  return true;
}
