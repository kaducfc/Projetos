import { EXPEDITION_REWARDS, getExpeditionTier } from '../data/events.js';

export function canEnterExpedition(state, now = Date.now()) {
  return !state.expeditionReadyAt || state.expeditionReadyAt <= now;
}

export function expeditionRemainingMs(state, now = Date.now()) {
  return Math.max(0, (state.expeditionReadyAt || 0) - now);
}

/// Soma o qty de cada linha cujo roll deu certo (chance>=1 sempre conta) —
/// a lista inteira é somada, não é "pega a maior que bateu" (ver comentário
/// em data/events.js EXPEDITION_REWARDS). Retorna também quais linhas
/// bateram, pra UI destacar o que realmente saiu daquela expedição.
export function rollExpeditionRewardRows(rows) {
  let total = 0;
  const hits = [];
  for (const row of rows) {
    const hit = row.chance >= 1 || Math.random() < row.chance;
    if (hit) {
      total += row.qty;
      hits.push(row);
    }
  }
  return { total, hits };
}

/// Retorna null se ainda em cooldown ou tier inválido; senão concede a
/// recompensa na hora (Ouro + Moeda de Evento + Ovo de Mascote) e arma o
/// cooldown compartilhado pro tempo da expedição escolhida.
export function enterExpedition(state, tierId, now = Date.now()) {
  if (!canEnterExpedition(state, now)) return null;
  const tier = getExpeditionTier(tierId);
  const rewardTable = EXPEDITION_REWARDS[tierId];
  if (!tier || !rewardTable) return null;

  const goldResult = rollExpeditionRewardRows(rewardTable.gold);
  const currencyResult = rollExpeditionRewardRows(rewardTable.currency);
  const eggsResult = rollExpeditionRewardRows(rewardTable.eggs);

  state.gold = (state.gold || 0) + goldResult.total;
  state.eventCurrency = (state.eventCurrency || 0) + currencyResult.total;
  state.eggCount = (state.eggCount || 0) + eggsResult.total;
  state.expeditionReadyAt = now + tier.durationMs;
  state.expeditionLastTierId = tierId;

  return {
    tier,
    goldGained: goldResult.total,
    currencyGained: currencyResult.total,
    eggsGained: eggsResult.total,
    goldBonusHits: goldResult.hits.length - 1,
    currencyBonusHits: currencyResult.hits.length - 1,
    eggBonusHits: eggsResult.hits.length - 1,
  };
}
