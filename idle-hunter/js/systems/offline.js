import { computePlayerStats } from './stats.js';
import { monsterMaxHp, monsterGoldReward, rollDrops } from './combat.js';

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
  for (let i = 0; i < simulatedKills; i++) {
    const drops = rollDrops(state.stage, stats.dropMult);
    for (const drop of drops) {
      materialsGained[drop.id] = (materialsGained[drop.id] || 0) + drop.qty;
    }
  }
  for (const id of Object.keys(materialsGained)) {
    materialsGained[id] = Math.round(materialsGained[id] * scale);
  }

  return { elapsedSeconds, kills, goldGained, materialsGained };
}

export function applyOfflineProgress(state, progress) {
  state.gold += progress.goldGained;
  for (const [id, qty] of Object.entries(progress.materialsGained)) {
    state.materials[id] = (state.materials[id] || 0) + qty;
  }
  state.totalKills += progress.kills;
}
