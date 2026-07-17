import { computePlayerStats } from './stats.js';
import { monsterMaxHp, monsterGoldReward, rollDrops } from './combat.js';
import { pickRandomWeakMonster, isBossStage, BOSS_INTERVAL } from '../data/monsters.js';
import { recordCardDiscovered } from './cards.js';

export const MAX_OFFLINE_SECONDS = 8 * 60 * 60; // cap idle gains at 8 hours
export const OFFLINE_EFFICIENCY = 0.7; // offline kills/drops run at 70% of online output
const SIMULATION_CAP = 2000; // roll drops for at most this many kills, then scale up

// How far back (below the reference stage) the "recent" band reaches — see
// pickOfflineStage() below. The resulting band is inclusive of the
// reference stage itself: maxStage 41 -> reference 40 -> band 20-40.
const RECENT_BAND_SPAN = 20;
const RECENT_BAND_SHARE = 0.8; // 80% of kills land in the recent band
const BOSS_STAGE_SHARE = 0.3; // 30% of kills are rolled against a boss stage, 70% weak

function randomBossStageIn(lo, hi) {
  const firstBoss = Math.ceil(lo / BOSS_INTERVAL) * BOSS_INTERVAL;
  if (firstBoss > hi) return null;
  const count = Math.floor((hi - firstBoss) / BOSS_INTERVAL) + 1;
  return firstBoss + BOSS_INTERVAL * Math.floor(Math.random() * count);
}

function randomWeakStageIn(lo, hi) {
  const total = hi - lo + 1;
  const bossCount = Math.floor(hi / BOSS_INTERVAL) - Math.floor((lo - 1) / BOSS_INTERVAL);
  const weakCount = total - bossCount;
  if (weakCount <= 0) return randomBossStageIn(lo, hi) ?? lo; // range is all boss stages — nothing else to pick
  let idx = Math.floor(Math.random() * weakCount);
  for (let s = lo; s <= hi; s++) {
    if (isBossStage(s)) continue;
    if (idx === 0) return s;
    idx--;
  }
  return lo; // unreachable
}

/// Offline kills aren't all rolled against the player's current stage —
/// they're spread across the player's whole climb so far, weighted toward
/// recent progress: 80% land in the last ~20 stages below (and including)
/// the reference stage, the other 20% spread uniformly across every stage
/// from 1 up to the reference stage. Independently of that, 30% of kills
/// are rolled against a boss stage and 70% against a weak-monster stage
/// within whichever range got picked (falling back to whichever kind the
/// range actually has, for narrow low-stage ranges with no boss in them).
function pickOfflineStage(referenceStage) {
  const bandStart = Math.max(1, referenceStage - RECENT_BAND_SPAN);
  const [lo, hi] = Math.random() < RECENT_BAND_SHARE
    ? [bandStart, referenceStage]
    : [1, referenceStage];

  if (Math.random() < BOSS_STAGE_SHARE) {
    const boss = randomBossStageIn(lo, hi);
    if (boss != null) return boss;
  }
  return randomWeakStageIn(lo, hi);
}

/// Approximates progress made while the tab was closed, capped at
/// MAX_OFFLINE_SECONDS and run at OFFLINE_EFFICIENCY of the player's real
/// DPS. The reference stage for "how many kills fit in the time budget" is
/// always maxStage - 1 (the highest stage the player has actually cleared),
/// but each individual kill's loot table is re-rolled against a stage drawn
/// from pickOfflineStage() above, so drops reflect the player's whole
/// journey, not just their current stage.
export function computeOfflineProgress(state) {
  const elapsedMs = Date.now() - (state.lastSaveTime || Date.now());
  let elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 30) return null;
  elapsedSeconds = Math.min(elapsedSeconds, MAX_OFFLINE_SECONDS);

  const stats = computePlayerStats(state);
  const effectiveDps = stats.dps * OFFLINE_EFFICIENCY;
  if (effectiveDps <= 0) return null;

  const referenceStage = state.maxStage - 1;
  if (referenceStage < 1) return null;

  const referenceHp = monsterMaxHp(referenceStage);
  const totalDamage = effectiveDps * elapsedSeconds;
  const kills = Math.floor(totalDamage / referenceHp);
  if (kills <= 0) return null;

  const simulatedKills = Math.min(kills, SIMULATION_CAP);
  const scale = kills / simulatedKills;

  let goldGainedSim = 0;
  const materialsGained = {};
  const cardsGained = {};
  for (let i = 0; i < simulatedKills; i++) {
    const stage = pickOfflineStage(referenceStage);
    goldGainedSim += monsterGoldReward(stage) * stats.goldMult;
    // Offline doesn't track a persisted monster identity per kill (unlike
    // live combat's state.weakMonsterId) — each simulated kill just rolls
    // its own; rollDrops ignores this on boss stages anyway.
    const drops = rollDrops(stage, stats.dropMult, pickRandomWeakMonster(stage).id);
    for (const drop of drops) {
      const bucket = drop.isCard ? cardsGained : materialsGained;
      bucket[drop.id] = (bucket[drop.id] || 0) + drop.qty;
    }
  }
  const goldGained = Math.round(goldGainedSim * scale);
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
    recordCardDiscovered(state, id);
  }
  state.totalKills += progress.kills;
}
