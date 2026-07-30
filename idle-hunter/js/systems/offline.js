import { computePlayerStats } from './stats.js';
import { monsterMaxHp, monsterGoldReward, rollDrops, MONSTER_RESPAWN_DELAY_MS } from './combat.js';
import { getZone } from '../data/monsters.js';
import { xpForZone, grantXp } from './leveling.js';
import { recordCardDiscovered } from './cards.js';

export const MAX_OFFLINE_SECONDS = 8 * 60 * 60; // cap idle gains at 8 hours
export const OFFLINE_EFFICIENCY = 0.7; // offline kills/drops run at 70% of online output
const SIMULATION_CAP = 2000; // roll drops for at most this many kills, then scale up

/// Sorteia um dos state.selectedMonsters — mesma lógica de
/// systems/combat.js ensureMonsterSpawned, cada kill offline simulado rola
/// contra um dos monstros escolhidos, igual ao combate ao vivo.
function pickOfflineMonster(state) {
  const pool = state.selectedMonsters || [];
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/// Approximates progress made while the tab was closed, capped at
/// MAX_OFFLINE_SECONDS and run at OFFLINE_EFFICIENCY of the player's real
/// throughput (dps * attackSpeedPerSec). Each individual simulated kill
/// re-rolls its own monster from state.selectedMonsters, so gold/materials/
/// XP reflect the player's whole chosen roster, not just one of them.
export function computeOfflineProgress(state) {
  const elapsedMs = Date.now() - (state.lastSaveTime || Date.now());
  let elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 30) return null;
  elapsedSeconds = Math.min(elapsedSeconds, MAX_OFFLINE_SECONDS);

  const stats = computePlayerStats(state);
  const effectiveDps = stats.dps * stats.attackSpeedPerSec * OFFLINE_EFFICIENCY;
  if (effectiveDps <= 0) return null;

  const pool = state.selectedMonsters || [];
  if (!pool.length) return null;

  // Referência de HP: usa o primeiro selecionado só pra estimar quantos
  // kills cabem no tempo disponível — cada kill simulado individualmente
  // ainda sorteia seu próprio monstro/zona no loop abaixo.
  const sample = pool[0];
  const sampleZone = getZone(sample.zoneIndex);
  const referenceHp = monsterMaxHp(sampleZone.canonicalStage, sample.kind === 'boss');
  // Cada kill também gasta a pausa de respawn (ver MONSTER_RESPAWN_DELAY_MS
  // em systems/combat.js) — sem isso, o offline ficaria mais rápido que
  // jogar ao vivo.
  const timePerKillSeconds = referenceHp / effectiveDps + MONSTER_RESPAWN_DELAY_MS / 1000;
  const kills = Math.floor(elapsedSeconds / timePerKillSeconds);
  if (kills <= 0) return null;

  const simulatedKills = Math.min(kills, SIMULATION_CAP);
  const scale = kills / simulatedKills;

  let goldGainedSim = 0;
  let xpGainedSim = 0;
  const materialsGained = {};
  const cardsGained = {};
  for (let i = 0; i < simulatedKills; i++) {
    const pick = pickOfflineMonster(state);
    const zone = getZone(pick.zoneIndex);
    const isBoss = pick.kind === 'boss';
    const powerRank = isBoss ? zone.boss.powerRank : zone.weakMonsters.find((m) => m.id === pick.monsterId)?.powerRank;
    goldGainedSim += monsterGoldReward(zone.canonicalStage, isBoss, powerRank) * stats.goldMult;
    xpGainedSim += xpForZone(pick.zoneIndex, isBoss);
    const drops = rollDrops(pick.zoneIndex, isBoss, stats.dropMult, pick.monsterId);
    for (const drop of drops) {
      const bucket = drop.isCard ? cardsGained : materialsGained;
      bucket[drop.id] = (bucket[drop.id] || 0) + drop.qty;
    }
  }
  const goldGained = Math.round(goldGainedSim * scale);
  const xpGained = Math.round(xpGainedSim * scale);
  for (const id of Object.keys(materialsGained)) {
    materialsGained[id] = Math.round(materialsGained[id] * scale);
  }
  for (const id of Object.keys(cardsGained)) {
    cardsGained[id] = Math.round(cardsGained[id] * scale);
  }

  return { elapsedSeconds, kills, goldGained, xpGained, materialsGained, cardsGained };
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
  grantXp(state, progress.xpGained || 0);
}
