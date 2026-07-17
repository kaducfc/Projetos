// A fresh window opens every EVENT_CYCLE_MS, staying open (i.e. clickable
// "Entrar") for EVENT_ACTIVE_MS — miss it and it's gone until the next
// cycle (see canEnterEvent in systems/events.js, which also blocks a
// second entry once the player has already used this cycle's window).
// Once entered, the fight itself has no separate clock: it just runs
// (clicks + passive DPS, see main.js) until the boss falls, since the
// event boss never damages the player back. Timing is derived purely from
// wall-clock time — no schedule needs to be saved, so offline time and
// reloads just fall wherever they land on the clock.
export const EVENT_CYCLE_MS = 6 * 60 * 1000;
export const EVENT_ACTIVE_MS = 5 * 60 * 1000;

// The event boss's HP is anchored to that boss's own real-combat fight (its
// stage, see systems/events.js), scaled up by this multiplier. So it's
// always exactly 30% tougher than "the real version" of that boss,
// regardless of the player's current gear/stage.
export const EVENT_DIFFICULTY_MULT = 1.3;

export const EVENT_CURRENCY_BASE = 10;
export const EVENT_CURRENCY_PER_STAGE = 0.5;

// Reward roll on a kill: EVENT_DROP_ROLLS independent picks, each landing
// on primary1/primary2/crystal at these weights (they sum to 1 — every
// roll always gives something, never a whiff). Separately, a 5% chance for
// the boss's own card, on top of (not counted among) those 10 rolls.
export const EVENT_DROP_ROLLS = 10;
export const EVENT_DROP_PRIMARY1_CHANCE = 0.47;
export const EVENT_DROP_PRIMARY2_CHANCE = 0.47;
export const EVENT_DROP_CRYSTAL_CHANCE = 0.06;
export const EVENT_CARD_DROP_CHANCE = 0.05;

export function getEventWindow(now = Date.now()) {
  const cycleIndex = Math.floor(now / EVENT_CYCLE_MS);
  const cycleStart = cycleIndex * EVENT_CYCLE_MS;
  const elapsed = now - cycleStart;
  const active = elapsed < EVENT_ACTIVE_MS;
  return {
    cycleIndex,
    active,
    remainingActiveMs: active ? EVENT_ACTIVE_MS - elapsed : 0,
    msUntilNextWindow: cycleStart + EVENT_CYCLE_MS - now,
  };
}

// ---------------------------------------------------------------------
// "Torre Infinita" — every TOWER_CYCLE_MS a fresh window opens, staying
// open (i.e. clickable "Entrar") for TOWER_ACTIVE_MS. Missing that window
// means waiting for the next one (see canEnterTower in systems/tower.js,
// which also blocks a second entry once the player has already used this
// cycle's window). Once entered, the run itself is a separate, shorter
// clock (TOWER_RUN_DURATION_MS) that starts ticking from the moment of
// entry, independent of how much of the entry window is left.
// ---------------------------------------------------------------------
export const TOWER_CYCLE_MS = 6 * 60 * 1000;
export const TOWER_ACTIVE_MS = 5 * 60 * 1000;
export const TOWER_RUN_DURATION_MS = 5 * 60 * 1000;

// Level 20/40/.../200 is a boss, matching real stage 10/20/.../100 (i.e.
// every 2 tower levels = 1 real stage) — see towerPowerStage() in
// systems/tower.js for the full level->stage mapping, including how it
// sidesteps the boss-detection hazards that a naive stage lookup would hit.
export const TOWER_MAX_LEVEL = 200;

// Reward is a flat amount plus a per-level scale of how far the player got,
// with a completion bonus for actually clearing the level 200 boss instead
// of just reaching it.
export const TOWER_CURRENCY_BASE = 5;
export const TOWER_CURRENCY_PER_LEVEL = 0.8;
export const TOWER_CLEAR_BONUS = 100;

export function getTowerWindow(now = Date.now()) {
  const cycleIndex = Math.floor(now / TOWER_CYCLE_MS);
  const cycleStart = cycleIndex * TOWER_CYCLE_MS;
  const elapsed = now - cycleStart;
  const active = elapsed < TOWER_ACTIVE_MS;
  return {
    cycleIndex,
    active,
    remainingActiveMs: active ? TOWER_ACTIVE_MS - elapsed : 0,
    msUntilNextWindow: cycleStart + TOWER_CYCLE_MS - now,
  };
}
