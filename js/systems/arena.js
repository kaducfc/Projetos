import { ARENA_RUN_DURATION_MS, getArenaRankForDamage } from '../data/arena.js';
import { CARD_FRAGMENT_ID } from '../data/cards.js';

export function canEnterArena(state) {
  return !state.arenaRunActive;
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
  if (rewards.material && rewards.materialQty > 0) {
    state.materials[rewards.material.id] = (state.materials[rewards.material.id] || 0) + rewards.materialQty;
  }
  if (rewards.cardFragments > 0) {
    state.materials[CARD_FRAGMENT_ID] = (state.materials[CARD_FRAGMENT_ID] || 0) + rewards.cardFragments;
  }

  const damageDealt = state.arenaDamageDealt;
  state.arenaRunActive = false;
  state.arenaDamageDealt = 0;

  return { rank: finalRank, damageDealt };
}

export { ARENA_RUN_DURATION_MS };
