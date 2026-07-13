import { BOSSES } from './monsters.js';

// A boss rotates in as the "event boss" every EVENT_CYCLE_MS, and is only
// challengeable during the first EVENT_ACTIVE_MS of that cycle (then it's
// on cooldown until the next cycle). Both the boss and the timing are
// derived purely from wall-clock time — no schedule needs to be saved, so
// offline time and reloads just fall wherever they fall on the clock.
export const EVENT_CYCLE_MS = 15 * 60 * 1000;
export const EVENT_ACTIVE_MS = 5 * 60 * 1000;

// Once a player lands their first hit, they have this long to finish the
// fight (see systems/events.js) — a distinct, shorter "boss rush" clock
// from the window's overall availability above. Fixed at 50s regardless
// of which boss is up or how far the player has progressed.
export const EVENT_TIME_LIMIT_MS = 50 * 1000;

// The event boss's HP is anchored to that boss's own real-combat fight (its
// stage, see systems/events.js), scaled up by this multiplier. So it's
// always exactly 30% tougher than "the real version" of that boss,
// regardless of the player's current gear/stage.
export const EVENT_DIFFICULTY_MULT = 1.3;

export const EVENT_CURRENCY_BASE = 10;
export const EVENT_CURRENCY_PER_STAGE = 0.5;

export function getEventWindow(now = Date.now()) {
  const cycleIndex = Math.floor(now / EVENT_CYCLE_MS);
  const cycleStart = cycleIndex * EVENT_CYCLE_MS;
  const elapsed = now - cycleStart;
  const active = elapsed < EVENT_ACTIVE_MS;
  const boss = BOSSES[cycleIndex % BOSSES.length];
  return {
    cycleIndex,
    boss,
    active,
    remainingActiveMs: active ? EVENT_ACTIVE_MS - elapsed : 0,
    msUntilNextWindow: cycleStart + EVENT_CYCLE_MS - now,
  };
}

// ---------------------------------------------------------------------
// "Mercador" — every WEAK_MONSTER_GROUPS band (see data/monsters.js — 5
// elemental materials per band) is always visible, but starts locked. A new
// event starts every TRADE_CYCLE_MS (like the boss event above, always-on,
// derived purely from wall-clock time) and re-locks every band — the
// player spends Moeda de Evento to unlock whichever band(s) they want for
// *this* event, same as before. Cost is intentionally low (see
// TRADE_UNLOCK_BASE_COST) since it only buys access until the next cycle,
// not forever; it still climbs with the band's stage.
// ---------------------------------------------------------------------
export const TRADE_COST = 2;
export const TRADE_YIELD = 1;

export const TRADE_CYCLE_MS = 30 * 60 * 1000;
export const TRADE_UNLOCK_BASE_COST = 5;
export const TRADE_UNLOCK_COST_PER_STAGE = 0.4;

export function getTradeUnlockCost(group) {
  return Math.round(TRADE_UNLOCK_BASE_COST + group.startStage * TRADE_UNLOCK_COST_PER_STAGE);
}

export function getTradeCycleInfo(now = Date.now()) {
  const cycleIndex = Math.floor(now / TRADE_CYCLE_MS);
  const cycleStart = cycleIndex * TRADE_CYCLE_MS;
  return { cycleIndex, msUntilNextCycle: cycleStart + TRADE_CYCLE_MS - now };
}
