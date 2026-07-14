import {
  EVENT_CURRENCY_BASE, EVENT_CURRENCY_PER_STAGE, EVENT_DIFFICULTY_MULT,
  EVENT_DROP_ROLLS, EVENT_DROP_PRIMARY1_CHANCE, EVENT_DROP_PRIMARY2_CHANCE, EVENT_CARD_DROP_CHANCE,
  getEventWindow, TRADE_COST, TRADE_YIELD, getTradeUnlockCost, getTradeCycleInfo,
} from '../data/events.js';
import { BOSSES } from '../data/monsters.js';
import { getCardForMonster } from '../data/cards.js';
import { monsterMaxHp } from './combat.js';
import { recordCardDiscovered } from './cards.js';

export function isEventClaimed(state, cycleIndex) {
  return state.eventClaimedCycle === cycleIndex;
}

/// Only bosses the player has already reached in real combat (stage <=
/// maxStage) can show up — a fresh account can't roll Bahamorth on their
/// first-ever window. Returns null if no boss is eligible yet (maxStage
/// hasn't reached the first boss's stage, 10).
export function pickEligibleEventBoss(maxStage) {
  const eligible = BOSSES.filter((b) => b.stage <= maxStage);
  if (!eligible.length) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function canEnterEvent(state, now = Date.now()) {
  const win = getEventWindow(now);
  if (!win.active) return false;
  if (state.eventEnteredCycle === win.cycleIndex) return false;
  if (isEventClaimed(state, win.cycleIndex)) return false;
  return pickEligibleEventBoss(state.maxStage) != null;
}

/// Rolls the random eligible boss, marks this cycle "entered" (blocking a
/// second entry) and spawns the fight. Returns the boss just rolled, or
/// null if entry wasn't allowed right now.
export function startEvent(state, now = Date.now()) {
  if (!canEnterEvent(state, now)) return null;
  const win = getEventWindow(now);
  const boss = pickEligibleEventBoss(state.maxStage);
  state.eventEnteredCycle = win.cycleIndex;
  state.eventBossId = boss.id;
  state.eventBossHp = null;
  state.eventBossMaxHp = null;
  ensureEventBossSpawned(state, boss);
  return boss;
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

// "Increased drop chance" is now EVENT_DROP_ROLLS independent picks, each
// landing on primary1/primary2/crystal per the weights in data/events.js
// (which sum to 1 — every roll always lands on something, an event kill
// never whiffs on any of its 10). The boss's own card is a wholly separate
// roll (see claimEventVictory below), not one of these 10.
function rollEventDrops(boss) {
  const drops = [];
  for (let i = 0; i < EVENT_DROP_ROLLS; i++) {
    const roll = Math.random();
    const mat = roll < EVENT_DROP_PRIMARY1_CHANCE
      ? boss.materials.primary1
      : roll < EVENT_DROP_PRIMARY1_CHANCE + EVENT_DROP_PRIMARY2_CHANCE
        ? boss.materials.primary2
        : boss.crystal;
    drops.push(mat);
  }
  return drops;
}

/// Grants rewards, marks this cycle claimed (blocks re-farming/re-entering
/// it) and clears the encounter. Returns a summary for the reward modal —
/// cardDropped is null unless the separate 5% card roll hit.
export function claimEventVictory(state, cycleIndex, boss) {
  const drops = rollEventDrops(boss);
  const gained = {};
  for (const mat of drops) {
    state.materials[mat.id] = (state.materials[mat.id] || 0) + 1;
    if (!gained[mat.id]) gained[mat.id] = { qty: 0, emoji: mat.emoji, name: mat.name, image: mat.image || null };
    gained[mat.id].qty += 1;
  }

  let cardDropped = null;
  if (Math.random() < EVENT_CARD_DROP_CHANCE) {
    const card = getCardForMonster(boss.id);
    state.cards[card.id] = (state.cards[card.id] || 0) + 1;
    recordCardDiscovered(state, card.id);
    cardDropped = card;
  }

  const currency = Math.round(EVENT_CURRENCY_BASE + state.maxStage * EVENT_CURRENCY_PER_STAGE);
  state.eventCurrency += currency;
  state.eventClaimedCycle = cycleIndex;
  state.eventWins = (state.eventWins || 0) + 1;
  resetEventEncounter(state);

  return { gained, currency, cardDropped };
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
