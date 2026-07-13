import { EVENT_CURRENCY_BASE, EVENT_CURRENCY_PER_STAGE, EVENT_DIFFICULTY_MULT, TRADE_COST, TRADE_YIELD, getTradeUnlockCost, getTradeCycleInfo } from '../data/events.js';
import { monsterMaxHp } from './combat.js';

export function isEventClaimed(state, cycleIndex) {
  return state.eventClaimedCycle === cycleIndex;
}

/// boss.stage is always a boss stage by definition, so this is "that boss's
/// own real-combat fight" HP, scaled up by EVENT_DIFFICULTY_MULT. Fixed per
/// boss, independent of the player's own stats/gear.
export function computeEventBossMaxHp(boss) {
  return Math.max(10, Math.round(monsterMaxHp(boss.stage) * EVENT_DIFFICULTY_MULT));
}

/// Lazily spawns the event boss the first time it's hit in a cycle. Both HP
/// and maxHp are persisted (not recomputed live) so the target stays fixed
/// for the whole fight even if the player's gear changes mid-way.
export function ensureEventBossSpawned(state, boss) {
  if (state.eventBossHp == null) {
    state.eventBossMaxHp = computeEventBossMaxHp(boss);
    state.eventBossHp = state.eventBossMaxHp;
  }
}

export function resetEventEncounter(state) {
  state.eventBossHp = null;
  state.eventBossMaxHp = null;
}

/// Applies a hit; returns true if this hit killed the event boss.
export function applyEventDamage(state, amount) {
  state.eventBossHp = Math.max(0, (state.eventBossHp ?? 0) - amount);
  return state.eventBossHp <= 0;
}

// "Increased drop chance" is expressed directly as a guaranteed bundle of
// 1-6 material drops (mostly the two "drop principal" materials, rarely the
// Crystal) rather than as dice rolls that can whiff — a normal kill can
// drop nothing, an event kill never does.
function rollEventDrops(boss) {
  const count = 1 + Math.floor(Math.random() * 6);
  const drops = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    const mat = roll < 0.45 ? boss.materials.primary1 : roll < 0.9 ? boss.materials.primary2 : boss.crystal;
    drops.push(mat);
  }
  return drops;
}

/// Grants rewards, marks this cycle claimed (blocks re-farming it) and
/// clears the encounter. Returns a summary for the toast/UI.
export function claimEventVictory(state, cycleIndex, boss) {
  const drops = rollEventDrops(boss);
  const gained = {};
  for (const mat of drops) {
    state.materials[mat.id] = (state.materials[mat.id] || 0) + 1;
    if (!gained[mat.id]) gained[mat.id] = { qty: 0, emoji: mat.emoji, name: mat.name };
    gained[mat.id].qty += 1;
  }

  const currency = Math.round(EVENT_CURRENCY_BASE + state.maxStage * EVENT_CURRENCY_PER_STAGE);
  state.eventCurrency += currency;
  state.eventClaimedCycle = cycleIndex;
  state.eventWins = (state.eventWins || 0) + 1;
  resetEventEncounter(state);

  return { gained, currency };
}

// ---------------------------------------------------------------------
// "Mercador" — a new event starts every TRADE_CYCLE_MS (data/events.js),
// re-locking every WEAK_MONSTER_GROUPS band. The player spends Moeda de
// Evento to unlock whichever band(s) they want for the current event (see
// getTradeUnlockCost — pricier for higher-stage bands, but cheap overall
// since it only lasts until the next cycle), then can trade any quantity
// of one weak-monster material for TRADE_YIELD-per-TRADE_COST of another
// within that band (not, say, a stage 1-19 material for a stage 81-100
// one), as many times as they like until the event ends.
// ---------------------------------------------------------------------

export function isTradeGroupUnlocked(state, group, now = Date.now()) {
  const { cycleIndex } = getTradeCycleInfo(now);
  return (state.tradeUnlocks || {})[group.startStage] === cycleIndex;
}

export function canUnlockTradeGroup(state, group) {
  if (isTradeGroupUnlocked(state, group)) return false;
  return state.eventCurrency >= getTradeUnlockCost(group);
}

/// Returns true if the unlock went through.
export function unlockTradeGroup(state, group) {
  if (!canUnlockTradeGroup(state, group)) return false;
  state.eventCurrency -= getTradeUnlockCost(group);
  state.tradeUnlocks = state.tradeUnlocks || {};
  state.tradeUnlocks[group.startStage] = getTradeCycleInfo().cycleIndex;
  return true;
}

/// How much of fromMaterialId a trade actually spends for a requested qty
/// (rounds down to the nearest whole TRADE_COST batch, so an odd/uneven
/// qty never wastes part of the material — see performTrade).
export function computeTradeUsedQty(qty) {
  return Math.floor(qty / TRADE_COST) * TRADE_COST;
}

/// How much of toMaterialId a trade yields for a requested qty of
/// fromMaterialId — e.g. with the default 2-for-1 ratio, asking for 10
/// yields 5, so the UI can show the player exactly what they'll get.
export function computeTradeReceiveQty(qty) {
  return Math.floor(qty / TRADE_COST) * TRADE_YIELD;
}

export function canTrade(state, group, fromMaterialId, toMaterialId, qty) {
  if (!isTradeGroupUnlocked(state, group)) return false;
  if (fromMaterialId === toMaterialId) return false;
  const inGroup = (id) => group.monsters.some((m) => m.material.id === id);
  if (!inGroup(fromMaterialId) || !inGroup(toMaterialId)) return false;
  const used = computeTradeUsedQty(qty);
  if (used < TRADE_COST) return false;
  return (state.materials[fromMaterialId] || 0) >= used;
}

/// Returns true if the trade went through.
export function performTrade(state, group, fromMaterialId, toMaterialId, qty) {
  if (!canTrade(state, group, fromMaterialId, toMaterialId, qty)) return false;
  const used = computeTradeUsedQty(qty);
  const received = computeTradeReceiveQty(qty);
  state.materials[fromMaterialId] -= used;
  state.materials[toMaterialId] = (state.materials[toMaterialId] || 0) + received;
  return true;
}
