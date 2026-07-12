import { EVENT_CURRENCY_BASE, EVENT_CURRENCY_PER_STAGE, EVENT_DIFFICULTY_MULT } from '../data/events.js';
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
