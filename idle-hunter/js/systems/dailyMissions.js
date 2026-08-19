import { DAILY_MISSION_TYPES, getDailyMissionType } from '../data/dailyMissions.js';
import { RARITIES, DROP_CATEGORIES } from '../data/items.js';
import { CARD_FRAGMENT_ID, CARDS } from '../data/cards.js';
import { recordCardDiscovered } from './cards.js';
import { addDroppedItem } from './crafting.js';
import { highestUnlockedZoneIndex } from './leveling.js';

// Mesma conta de sempre (ver systems/pvp.js msUntilNextDailyArenaReset):
// Brasília não tem mais horário de verão desde 2019 (sempre UTC-3), então
// 00:00 UTC = 21h de Brasília todo dia. Duplicado aqui em vez de
// importado de pvp.js de propósito — Missões Diárias são 100% locais
// (sem Supabase), não deveriam depender do módulo de PvP só por causa de
// uma conta de horário que os dois compartilham por coincidência.
function nextDailyMissionResetAt(now = Date.now()) {
  const d = new Date(now);
  const todayReset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  return todayReset > now ? todayReset : todayReset + 24 * 60 * 60 * 1000;
}

export function msUntilNextDailyMissionReset(now = Date.now()) {
  return nextDailyMissionResetAt(now) - now;
}

function pickWeightedTierIndex(type) {
  const weights = type.tierWeights || type.tiers.map(() => 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if (roll < weights[i]) return i;
    roll -= weights[i];
  }
  return weights.length - 1;
}

function rollSlot() {
  const type = DAILY_MISSION_TYPES[Math.floor(Math.random() * DAILY_MISSION_TYPES.length)];
  return {
    typeId: type.id,
    tierIndex: pickWeightedTierIndex(type),
    status: 'idle', // 'idle' | 'active' | 'completed' | 'abandoned'
    progress: 0,
    rerollUsed: false,
  };
}

/// Garante que state.dailyMissions existe e não passou do reset (21h de
/// Brasília) — chamada no boot do jogo e sempre que a aba é aberta/
/// renderizada. Sorteia 3 missões novas (e zera o "1 concluída hoje")
/// sempre que o reset já passou. Retorna true se regenerou (útil pro
/// chamador saber se precisa re-renderizar do zero).
export function ensureDailyMissionsFresh(state, now = Date.now()) {
  if (!state.dailyMissions || now >= state.dailyMissions.resetAt) {
    state.dailyMissions = {
      resetAt: nextDailyMissionResetAt(now),
      slots: [rollSlot(), rollSlot(), rollSlot()],
    };
    return true;
  }
  return false;
}

export function getActiveMissionSlotIndex(state) {
  return state.dailyMissions.slots.findIndex((s) => s.status === 'active');
}

function anyMissionCompletedToday(state) {
  return state.dailyMissions.slots.some((s) => s.status === 'completed');
}

export function canSelectMission(state, slotIndex) {
  const slot = state.dailyMissions.slots[slotIndex];
  return !!slot && slot.status === 'idle' && getActiveMissionSlotIndex(state) === -1 && !anyMissionCompletedToday(state);
}

export function selectMission(state, slotIndex) {
  if (!canSelectMission(state, slotIndex)) return false;
  const slot = state.dailyMissions.slots[slotIndex];
  slot.status = 'active';
  slot.progress = 0;
  return true;
}

export function canAbandonMission(state, slotIndex) {
  return state.dailyMissions.slots[slotIndex]?.status === 'active';
}

/// Desiste da missão ativa — ela fica "apagada" (status 'abandoned') pro
/// resto do dia, sem volta. As outras 2 (se ainda 'idle') voltam a poder
/// ser escolhidas.
export function abandonMission(state, slotIndex) {
  if (!canAbandonMission(state, slotIndex)) return false;
  state.dailyMissions.slots[slotIndex].status = 'abandoned';
  return true;
}

export function canRerollMission(state, slotIndex) {
  const slot = state.dailyMissions.slots[slotIndex];
  return !!slot && slot.status === 'idle' && !slot.rerollUsed && !anyMissionCompletedToday(state);
}

/// Cada uma das 3 missões tem seu PRÓPRIO reroll (1x/dia cada, não 1
/// compartilhado) — pedido explícito do usuário.
export function rerollMission(state, slotIndex) {
  if (!canRerollMission(state, slotIndex)) return false;
  state.dailyMissions.slots[slotIndex] = { ...rollSlot(), rerollUsed: true };
  return true;
}

function pickRarityAtLeast(minRarityId) {
  const minIndex = RARITIES.findIndex((r) => r.id === minRarityId);
  const pool = minIndex >= 0 ? RARITIES.slice(minIndex) : RARITIES;
  const totalWeight = pool.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const r of pool) {
    if (roll < r.weight) return r.id;
    roll -= r.weight;
  }
  return pool[pool.length - 1].id;
}

function grantDailyMissionReward(state, reward) {
  if (reward.type === 'card_fragment') {
    state.materials = state.materials || {};
    state.materials[CARD_FRAGMENT_ID] = (state.materials[CARD_FRAGMENT_ID] || 0) + reward.amount;
  } else if (reward.type === 'egg') {
    state.eggCount = (state.eggCount || 0) + reward.amount;
  } else if (reward.type === 'random_card') {
    const card = CARDS[Math.floor(Math.random() * CARDS.length)];
    if (card) {
      state.cards = state.cards || {};
      state.cards[card.id] = (state.cards[card.id] || 0) + 1;
      recordCardDiscovered(state, card.id);
    }
  } else if (reward.type === 'equipment') {
    // Sempre cai na zona mais alta já desbloqueada (ver
    // highestUnlockedZoneIndex em systems/leveling.js) — é assim que
    // "baseado no nível do jogador" foi pedido: mesma força de item que
    // ele já enfrenta em combate, não uma tabela própria por nível.
    const zoneIndex = highestUnlockedZoneIndex(state);
    for (let i = 0; i < reward.count; i++) {
      const category = DROP_CATEGORIES[Math.floor(Math.random() * DROP_CATEGORIES.length)];
      const rarityId = pickRarityAtLeast(reward.minRarity);
      addDroppedItem(state, zoneIndex, category, rarityId);
    }
  }
}

/// Chamada pelos sistemas de jogo (combate, forja, chocar ovo, PvP) toda
/// vez que um evento relevante acontece — se a missão ATIVA hoje for
/// desse mesmo tipo, soma progresso; ao bater o alvo, conclui na hora:
/// concede a recompensa, marca a etapa (ver data/achievements.js
/// "daily_missions", ainda pendente) e devolve { completed: true, reward }
/// pro chamador mostrar a janela de "recompensa recebida" (ver main.js).
/// null se não havia missão ativa desse tipo agora (não faz nada).
export function recordDailyMissionProgress(state, typeId, amount = 1) {
  ensureDailyMissionsFresh(state);
  const idx = getActiveMissionSlotIndex(state);
  if (idx === -1) return null;
  const slot = state.dailyMissions.slots[idx];
  if (slot.typeId !== typeId) return null;

  const type = getDailyMissionType(slot.typeId);
  const tier = type.tiers[slot.tierIndex];
  slot.progress = Math.min(tier.target, slot.progress + amount);
  if (slot.progress < tier.target) return { completed: false };

  slot.status = 'completed';
  grantDailyMissionReward(state, tier.reward);
  state.dailyMissionsCompletedTotal = (state.dailyMissionsCompletedTotal || 0) + 1;
  return { completed: true, reward: tier.reward, missionName: type.name };
}
