import { computePlayerStats } from './stats.js';
import { monsterMaxHp, monsterGoldReward, rollDrops } from './combat.js';
import { pickRandomWeakMonster } from '../data/monsters.js';

const MAX_OFFLINE_SECONDS = 4 * 60 * 60; // cap idle gains at 4 hours
const SIMULATION_CAP = 2000; // roll drops for at most this many kills, then scale up

/// Approximates progress made while the tab was closed: assumes the player
/// keeps killing the monster at their *current* stage (no stage advance,
/// no boss timing) at their current DPS. Good enough for an idle-gains
/// summary without simulating the whole run offline.
export function computeOfflineProgress(state) {
  const elapsedMs = Date.now() - (state.lastSaveTime || Date.now());
  let elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 30) return null;
  elapsedSeconds = Math.min(elapsedSeconds, MAX_OFFLINE_SECONDS);

  const stats = computePlayerStats(state);
  if (stats.dps <= 0) return null;

  const hp = monsterMaxHp(state.stage);
  const totalDamage = stats.dps * elapsedSeconds;
  const kills = Math.floor(totalDamage / hp);
  if (kills <= 0) return null;

  const simulatedKills = Math.min(kills, SIMULATION_CAP);
  const scale = kills / simulatedKills;

  const goldPerKill = monsterGoldReward(state.stage) * stats.goldMult;
  const goldGained = Math.round(goldPerKill * kills);

  const materialsGained = {};
  const cardsGained = {};
  for (let i = 0; i < simulatedKills; i++) {
    // Offline doesn't track a persisted monster identity per kill (unlike
    // live combat's state.weakMonsterId) — each simulated kill just rolls
    // its own; rollDrops ignores this on boss stages anyway.
    const drops = rollDrops(state.stage, stats.dropMult, pickRandomWeakMonster().id);
    for (const drop of drops) {
      const bucket = drop.isCard ? cardsGained : materialsGained;
      bucket[drop.id] = (bucket[drop.id] || 0) + drop.qty;
    }
  }
  for (const id of Object.keys(materialsGained)) {
    materialsGained[id] = Math.round(materialsGained[id] * scale);
  }
  for (const id of Object.keys(cardsGained)) {
    cardsGained[id] = Math.round(cardsGained[id] * scale);
  }

  return { elapsedSeconds, kills, goldGained, materialsGained, cardsGained };
}

export function applyOfflineProgress(state, progress) {
  state.gold += progress.goldGained;
  for (const [id, qty] of Object.entries(progress.materialsGained)) {
    state.materials[id] = (state.materials[id] || 0) + qty;
  }
  for (const [id, qty] of Object.entries(progress.cardsGained)) {
    state.cards[id] = (state.cards[id] || 0) + qty;
  }
  state.totalKills += progress.kills;
}
