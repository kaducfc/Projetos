import { EVENT_CURRENCY_BASE, EVENT_CURRENCY_PER_STAGE, EVENT_DIFFICULTY_MULT } from '../data/events.js';
import { monsterMaxHp } from './combat.js';

export function isEventClaimed(state, cycleIndex) {
  return state.eventClaimedCycle === cycleIndex;
}

/// family.endStage is always a boss stage (block sizes are multiples of the
/// boss interval — see data/monsters.js), so this is "that family's own
/// boss fight" HP, scaled up by EVENT_DIFFICULTY_MULT. Fixed per family,
/// independent of the player's own stats/gear.
export function computeEventBossMaxHp(family) {
  return Math.max(10, Math.round(monsterMaxHp(family.endStage) * EVENT_DIFFICULTY_MULT));
}

/// Lazily spawns the event boss the first time it's hit in a cycle. Both HP
/// and maxHp are persisted (not recomputed live) so the target stays fixed
/// for the whole fight even if the player's gear changes mid-way.
export function ensureEventBossSpawned(state, family) {
  if (state.eventBossHp == null) {
    state.eventBossMaxHp = computeEventBossMaxHp(family);
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
// 1-6 material drops (mostly common, sometimes rare, rarely the Gem) rather
// than as dice rolls that can whiff — a normal kill can drop nothing, an
// event kill never does.
function rollEventDrops(family) {
  const count = 1 + Math.floor(Math.random() * 6);
  const drops = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    const mat = roll < 0.6 ? family.materials.common : roll < 0.92 ? family.materials.rare : family.materials.gem;
    drops.push(mat);
  }
  return drops;
}

/// Grants rewards, marks this cycle claimed (blocks re-farming it) and
/// clears the encounter. Returns a summary for the toast/UI.
export function claimEventVictory(state, cycleIndex, family) {
  const drops = rollEventDrops(family);
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
