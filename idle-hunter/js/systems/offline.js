import { computePlayerStats } from './stats.js';
import { monsterMaxHp, monsterGoldReward, rollDrops, MONSTER_RESPAWN_DELAY_MS, ITEM_DROP_CHANCE } from './combat.js';
import { getZone, ZONE_COUNT } from '../data/monsters.js';
import { xpForZone, grantXp } from './leveling.js';
import { recordCardDiscovered } from './cards.js';
import { addDroppedItem } from './crafting.js';
import { DROP_CATEGORIES } from '../data/items.js';
import { isVipActive } from '../state.js';
import { unlockTranscend } from './awakening.js';

// Limite base de recompensa offline: 4h sem VIP, +2h de bônus pra quem tem
// VIP ativo (6h no total) — ver getMaxOfflineSeconds abaixo. Em cima disso,
// o Bônus Idle via anúncio (ver data/shop.js OFFLINE_BONUS_*, systems/
// shop.js watchOfflineBonusAd) pode somar até +2h extras (30min x4 cargas),
// gastas só quando o jogador realmente fica offline além desse limite base
// — sem VIP dá até 6h no total, com VIP até 8h.
export const BASE_OFFLINE_SECONDS = 4 * 60 * 60;
export const VIP_OFFLINE_BONUS_SECONDS = 2 * 60 * 60;

export function getMaxOfflineSeconds(state) {
  return BASE_OFFLINE_SECONDS + (isVipActive(state) ? VIP_OFFLINE_BONUS_SECONDS : 0);
}

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
/// getMaxOfflineSeconds(state) + the Bônus Idle bank and run at OFFLINE_EFFICIENCY of the player's real
/// throughput (dps * attackSpeedPerSec). Each individual simulated kill
/// re-rolls its own monster from state.selectedMonsters, so gold/materials/
/// XP reflect the player's whole chosen roster, not just one of them.
export function computeOfflineProgress(state) {
  const elapsedMs = Date.now() - (state.lastSaveTime || Date.now());
  let elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 30) return null;

  // O banco de Bônus Idle (ver data/shop.js OFFLINE_BONUS_*) só entra em
  // jogo depois que o limite base (4h, +4h se VIP) já foi todo consumido —
  // "os minutos bônus são os últimos a serem contados". Ficar offline por
  // menos que o limite base não gasta nada do banco, ele continua cheio.
  const baseCapSeconds = getMaxOfflineSeconds(state);
  const bonusBankSeconds = state.offlineBonusSeconds || 0;
  elapsedSeconds = Math.min(elapsedSeconds, baseCapSeconds + bonusBankSeconds);
  const bonusSecondsUsed = Math.max(0, elapsedSeconds - baseCapSeconds);

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
  let itemDropsSim = 0;
  // Se um kill simulado for do chefe da última zona, o jogador pode ter
  // liberado Transcender enquanto estava offline (ver unlockTranscend em
  // applyOfflineProgress abaixo) — sem isso, a 1ª derrota dele só contaria
  // se acontecesse ao vivo (ver handleKillEvent em main.js).
  let killedFinalBoss = false;
  const materialsGained = {};
  const cardsGained = {};
  for (let i = 0; i < simulatedKills; i++) {
    const pick = pickOfflineMonster(state);
    const zone = getZone(pick.zoneIndex);
    const isBoss = pick.kind === 'boss';
    if (isBoss && pick.zoneIndex === ZONE_COUNT - 1) killedFinalBoss = true;
    const powerRank = isBoss ? zone.boss.powerRank : zone.weakMonsters.find((m) => m.id === pick.monsterId)?.powerRank;
    goldGainedSim += monsterGoldReward(zone.canonicalStage, isBoss, powerRank) * stats.goldMult;
    xpGainedSim += xpForZone(pick.zoneIndex, isBoss);
    const drops = rollDrops(pick.zoneIndex, isBoss, stats.dropMult, pick.monsterId);
    for (const drop of drops) {
      const bucket = drop.isCard ? cardsGained : materialsGained;
      bucket[drop.id] = (bucket[drop.id] || 0) + drop.qty;
    }
    // Mesma chance de dropar equipamento do combate ao vivo (ver
    // applyDamage em systems/combat.js) — só conta quantas vezes bateu
    // aqui; os itens de verdade só são criados em applyOfflineProgress
    // (ver itemDropCount abaixo), depois de escalar pro total de kills.
    if (Math.random() < Math.min(0.95, ITEM_DROP_CHANCE * stats.dropMult)) {
      itemDropsSim += 1;
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
  // Extrapola do mesmo jeito que ouro/materiais/XP (ver `scale` acima) —
  // simulatedKills já rolou sua parcela de drops de equipamento; o resto
  // dos kills (kills - simulatedKills, quando SIMULATION_CAP entra em
  // jogo) rende a mesma proporção.
  const itemDropCount = Math.round(itemDropsSim * scale);

  // Guardado pra UI conseguir mostrar "máximo Xh" na mensagem de boas-vindas
  // (ver main.js showOfflineProgressIfAny) mesmo depois que
  // applyOfflineProgress já tiver descontado bonusSecondsUsed do banco.
  const maxOfflineSeconds = baseCapSeconds + bonusBankSeconds;

  return {
    elapsedSeconds, kills, goldGained, xpGained, materialsGained, cardsGained, itemDropCount,
    bonusSecondsUsed, maxOfflineSeconds, killedFinalBoss,
  };
}

export function applyOfflineProgress(state, progress) {
  // Ver killedFinalBoss em computeOfflineProgress acima — unlockTranscend
  // já é no-op se já estava liberado (ver systems/awakening.js), e não
  // mostra toast nenhum aqui: showOfflineProgressIfAny (main.js) decide se
  // avisa, junto com o resto do resumo "Bem-vindo de volta!".
  if (progress.killedFinalBoss) unlockTranscend(state);
  // Gasta do banco de Bônus Idle só a parcela realmente usada (ver
  // bonusSecondsUsed em computeOfflineProgress acima) — cargas não usadas
  // continuam disponíveis pra próxima vez que o jogador ficar offline.
  if (progress.bonusSecondsUsed > 0) {
    state.offlineBonusSeconds = Math.max(0, (state.offlineBonusSeconds || 0) - progress.bonusSecondsUsed);
  }
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

  // Cria os itens de equipamento de verdade agora (addDroppedItem já rola
  // atributo/raridade e cuida do inventário cheio virando sucata sozinho,
  // ver systems/crafting.js) — cada um sorteia seu próprio monstro/zona do
  // pool selecionado, igual um kill ao vivo faria.
  for (let i = 0; i < (progress.itemDropCount || 0); i++) {
    const pick = pickOfflineMonster(state);
    if (!pick) break;
    const category = DROP_CATEGORIES[Math.floor(Math.random() * DROP_CATEGORIES.length)];
    addDroppedItem(state, pick.zoneIndex, category);
  }
}
