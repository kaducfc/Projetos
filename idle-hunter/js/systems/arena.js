import { ARENA_RUN_DURATION_MS, ARENA_COOLDOWN_MS, getArenaRankForDamage } from '../data/arena.js';
import { CARD_FRAGMENT_ID } from '../data/cards.js';
import { WEAK_MONSTER_GROUPS } from '../data/monsters.js';
import { isZoneUnlocked } from './leveling.js';

export function canEnterArena(state, now = Date.now()) {
  if (state.arenaRunActive) return false;
  return !state.arenaReadyAt || state.arenaReadyAt <= now;
}

export function arenaRemainingMs(state, now = Date.now()) {
  return Math.max(0, (state.arenaReadyAt || 0) - now);
}

export function startArenaRun(state) {
  if (!canEnterArena(state)) return false;
  state.arenaRunActive = true;
  state.arenaDamageDealt = 0;
  return true;
}

export function applyArenaDamage(state, amount) {
  if (!state.arenaRunActive || !(amount > 0)) return;
  state.arenaDamageDealt += amount;
}

const ARENA_MATERIAL_BASKET_MIN_KINDS = 5;
const ARENA_MATERIAL_BASKET_MAX_KINDS = 20;

/// Monta o "cesto" de materiais da recompensa (ver ARENA_REWARD_CONFIG em
/// data/arena.js — materialsTotal é só o TOTAL de itens, não uma lista
/// fixa): sorteia entre 5 e 20 materiais DIFERENTES, só das zonas já
/// liberadas pro jogador (nunca dropa material de uma zona ainda travada),
/// com peso maior pras zonas mais avançadas (as últimas liberadas) —
/// pedido explícito do usuário. A soma das quantidades sempre bate
/// exatamente com totalQty.
export function rollArenaMaterialBasket(state, totalQty) {
  if (!(totalQty > 0)) return [];

  const pool = [];
  for (let zoneIndex = 0; zoneIndex < WEAK_MONSTER_GROUPS.length; zoneIndex++) {
    if (!isZoneUnlocked(state, zoneIndex)) continue;
    const weight = zoneIndex + 1; // zonas mais avançadas pesam mais
    for (const monster of WEAK_MONSTER_GROUPS[zoneIndex].monsters) {
      pool.push({ material: monster.material, weight });
    }
  }
  if (pool.length === 0) return [];

  const kinds = Math.min(pool.length, totalQty, ARENA_MATERIAL_BASKET_MIN_KINDS + Math.floor(
    Math.random() * (ARENA_MATERIAL_BASKET_MAX_KINDS - ARENA_MATERIAL_BASKET_MIN_KINDS + 1),
  ));

  // Amostragem ponderada sem reposição (roleta simples).
  const remaining = [...pool];
  const chosen = [];
  for (let i = 0; i < kinds; i++) {
    const totalWeight = remaining.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    let idx = 0;
    for (; idx < remaining.length - 1; idx++) {
      roll -= remaining[idx].weight;
      if (roll <= 0) break;
    }
    chosen.push(remaining[idx].material);
    remaining.splice(idx, 1);
  }

  // Distribui totalQty entre os `kinds` materiais escolhidos, cada um
  // recebendo pelo menos 1 (kinds <= totalQty garante que sempre cabe).
  const shares = new Array(kinds).fill(1);
  let leftover = totalQty - kinds;
  const splitWeights = Array.from({ length: kinds }, () => Math.random());
  const splitWeightSum = splitWeights.reduce((sum, w) => sum + w, 0) || 1;
  let distributed = 0;
  for (let i = 0; i < kinds; i++) {
    const add = i === kinds - 1 ? leftover - distributed : Math.round((splitWeights[i] / splitWeightSum) * leftover);
    shares[i] += Math.max(0, add);
    distributed += add;
  }

  return chosen.map((material, i) => ({ material, qty: shares[i] }));
}

/// Fecha o combate (chamado quando o clock de ARENA_RUN_DURATION_MS
/// zera — ver tickArena em main.js): resolve o rank final a partir do
/// dano total acumulado, concede a recompensa daquele rank e reseta o
/// estado do combate. Retorna o rank + o que foi concedido, pra UI.
export function endArenaRun(state) {
  const finalRank = getArenaRankForDamage(state.arenaDamageDealt);
  const { rewards } = finalRank;

  state.gold += rewards.gold;
  if (rewards.eventCurrency > 0) state.eventCurrency = (state.eventCurrency || 0) + rewards.eventCurrency;
  if (rewards.eggs > 0) state.eggCount = (state.eggCount || 0) + rewards.eggs;

  const materialsGranted = rollArenaMaterialBasket(state, rewards.materialsTotal);
  for (const entry of materialsGranted) {
    state.materials[entry.material.id] = (state.materials[entry.material.id] || 0) + entry.qty;
  }

  if (rewards.cardFragments > 0) {
    state.materials[CARD_FRAGMENT_ID] = (state.materials[CARD_FRAGMENT_ID] || 0) + rewards.cardFragments;
  }

  const damageDealt = state.arenaDamageDealt;
  state.arenaRunActive = false;
  state.arenaDamageDealt = 0;
  state.arenaReadyAt = Date.now() + ARENA_COOLDOWN_MS;

  return { rank: finalRank, damageDealt, materialsGranted };
}

export { ARENA_RUN_DURATION_MS, ARENA_COOLDOWN_MS };
