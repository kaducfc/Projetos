import {
  EVENT_CURRENCY_BASE, EVENT_CURRENCY_PER_STAGE, EVENT_DIFFICULTY_MULT,
  EVENT_DROP_ROLLS, EVENT_DROP_PRIMARY1_CHANCE, EVENT_DROP_PRIMARY2_CHANCE, EVENT_CARD_DROP_CHANCE,
  getEventWindow,
} from '../data/events.js';
import { BOSSES } from '../data/monsters.js';
import { getCardForMonster } from '../data/cards.js';
import { monsterMaxHp } from './combat.js';
import { recordCardDiscovered } from './cards.js';
import { isBossUnlocked } from './leveling.js';

export function isEventClaimed(state, cycleIndex) {
  return state.eventClaimedCycle === cycleIndex;
}

/// Only bosses whose zone-boss is already unlocked (see ZONES[].bossUnlockLevel
/// in data/monsters.js, gated by state.hunterLevel) can show up — a fresh
/// account can't roll Bahamorth on their first-ever window. Returns null if
/// no boss is eligible yet. BOSSES is ordered the same as ZONES, so a boss's
/// own array index doubles as its zoneIndex.
export function pickEligibleEventBoss(state) {
  const eligible = BOSSES.filter((b, zoneIndex) => isBossUnlocked(state, zoneIndex));
  if (!eligible.length) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function canEnterEvent(state, now = Date.now()) {
  const win = getEventWindow(now);
  if (!win.active) return false;
  if (state.eventEnteredCycle === win.cycleIndex) return false;
  if (isEventClaimed(state, win.cycleIndex)) return false;
  return pickEligibleEventBoss(state) != null;
}

/// Rolls the random eligible boss, marks this cycle "entered" (blocking a
/// second entry) and spawns the fight. Returns the boss just rolled, or
/// null if entry wasn't allowed right now.
export function startEvent(state, now = Date.now()) {
  if (!canEnterEvent(state, now)) return null;
  const win = getEventWindow(now);
  const boss = pickEligibleEventBoss(state);
  state.eventEnteredCycle = win.cycleIndex;
  state.eventBossId = boss.id;
  state.eventBossHp = null;
  state.eventBossMaxHp = null;
  ensureEventBossSpawned(state, boss);
  return boss;
}

/// boss.stage is that boss's zone's canonical stage (10, 20, ...100) — this
/// is "that boss's own real-combat fight" HP, scaled up by
/// EVENT_DIFFICULTY_MULT. Fixed per boss, independent of the player's own
/// stats/gear.
export function computeEventBossMaxHp(boss) {
  return Math.max(10, Math.round(monsterMaxHp(boss.stage, true) * EVENT_DIFFICULTY_MULT));
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

  const currency = Math.round(EVENT_CURRENCY_BASE + (state.hunterLevel || 1) * EVENT_CURRENCY_PER_STAGE);
  state.eventCurrency += currency;
  state.eventClaimedCycle = cycleIndex;
  state.eventWins = (state.eventWins || 0) + 1;
  resetEventEncounter(state);

  return { gained, currency, cardDropped };
}
