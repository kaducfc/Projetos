import { MONSTER_FAMILIES } from './monsters.js';

// A new family rotates in as the "event boss" every EVENT_CYCLE_MS, and is
// only challengeable during the first EVENT_ACTIVE_MS of that cycle (then
// it's on cooldown until the next cycle). Both the family and the timing
// are derived purely from wall-clock time — no schedule needs to be saved,
// so offline time and reloads just fall wherever they fall on the clock.
export const EVENT_CYCLE_MS = 15 * 60 * 1000;
export const EVENT_ACTIVE_MS = 5 * 60 * 1000;

// Once a player lands their first hit, they have this long to finish the
// fight (see systems/events.js) — a distinct, shorter "boss rush" clock
// from the window's overall availability above. Fixed at 50s regardless
// of which family is up or how far the player has progressed.
export const EVENT_TIME_LIMIT_MS = 50 * 1000;

// The event boss's HP is anchored to that family's own boss (the fight at
// family.endStage, always a boss stage — see systems/events.js), scaled up
// by this multiplier. So it's always exactly 30% tougher than "the real
// version" of that boss, regardless of the player's current gear/stage.
export const EVENT_DIFFICULTY_MULT = 1.3;

export const EVENT_CURRENCY_BASE = 10;
export const EVENT_CURRENCY_PER_STAGE = 0.5;

export function getEventWindow(now = Date.now()) {
  const cycleIndex = Math.floor(now / EVENT_CYCLE_MS);
  const cycleStart = cycleIndex * EVENT_CYCLE_MS;
  const elapsed = now - cycleStart;
  const active = elapsed < EVENT_ACTIVE_MS;
  const family = MONSTER_FAMILIES[cycleIndex % MONSTER_FAMILIES.length];
  return {
    cycleIndex,
    family,
    active,
    remainingActiveMs: active ? EVENT_ACTIVE_MS - elapsed : 0,
    msUntilNextWindow: cycleStart + EVENT_CYCLE_MS - now,
  };
}
