import { BOSSES, WEAK_MONSTER_GROUPS } from './monsters.js';

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
// "Mercador" — every TRADE_CYCLE_MS, rotates which WEAK_MONSTER_GROUPS band
// (see data/monsters.js — 5 elemental materials per band) is tradeable.
// Always-on (no separate active/cooldown split like the boss event above):
// the only thing that changes over time is *which* band is up, derived
// purely from wall-clock time same as everything else here.
// ---------------------------------------------------------------------
export const TRADE_CYCLE_MS = 30 * 60 * 1000;
export const TRADE_COST = 2;
export const TRADE_YIELD = 1;

export function getTradeWindow(now = Date.now()) {
  const cycleIndex = Math.floor(now / TRADE_CYCLE_MS);
  const cycleStart = cycleIndex * TRADE_CYCLE_MS;
  const group = WEAK_MONSTER_GROUPS[cycleIndex % WEAK_MONSTER_GROUPS.length];
  return {
    cycleIndex,
    group,
    msUntilNextRotation: cycleStart + TRADE_CYCLE_MS - now,
  };
}
