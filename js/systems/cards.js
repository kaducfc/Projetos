import { CARD_DISCOVERY_CASH_REWARD, CARDS } from '../data/cards.js';

/// True forever once the player has ever obtained at least one copy of
/// this card — independent of the live count in state.cards, which can
/// drop back to 0 once the card is socketed into an item (see
/// socketCard() in systems/crafting.js). Drives the dim/lit look of the
/// card in the Cartas tab.
export function isCardDiscovered(state, cardId) {
  return !!(state.cardsDiscovered && state.cardsDiscovered[cardId]);
}

/// Called once from every place a card is actually granted to the player
/// (a kill drop or offline-progress drop — see applyDamage() in
/// systems/combat.js and applyOfflineProgress() in systems/offline.js).
export function recordCardDiscovered(state, cardId) {
  state.cardsDiscovered = state.cardsDiscovered || {};
  state.cardsDiscovered[cardId] = true;
}

export function isCardRewardClaimed(state, cardId) {
  return !!(state.cardsRewardClaimed && state.cardsRewardClaimed[cardId]);
}

export function canClaimCardReward(state, cardId) {
  return isCardDiscovered(state, cardId) && !isCardRewardClaimed(state, cardId);
}

/// Returns true if the reward was granted.
export function claimCardReward(state, cardId) {
  if (!canClaimCardReward(state, cardId)) return false;
  state.cardsRewardClaimed = state.cardsRewardClaimed || {};
  state.cardsRewardClaimed[cardId] = true;
  state.cash += CARD_DISCOVERY_CASH_REWARD;
  return true;
}

// ---------------------------------------------------------------------
// Bônus de DPS por COLECIONAR — permanente assim que uma carta é descoberta
// pela 1ª vez (isCardDiscovered acima), independente de ela ainda estar na
// mão ou já ter sido socketada num item (diferente do bônus de carta
// socketada, ver getCard/CARD_EFFECTS em stats.js — os dois se somam).
// Nunca diminui: uma carta descoberta continua contando pra sempre, mesmo
// se o jogador nunca mais tiver uma cópia dela em mãos.
// ---------------------------------------------------------------------
const NORMAL_CARD_DPS_BONUS_PERCENT = 1;
const BOSS_CARD_DPS_BONUS_PERCENT = 5;

export function getCardCollectionDpsBonusPercent(state) {
  let bonus = 0;
  for (const card of CARDS) {
    if (!isCardDiscovered(state, card.id)) continue;
    bonus += card.isBossCard ? BOSS_CARD_DPS_BONUS_PERCENT : NORMAL_CARD_DPS_BONUS_PERCENT;
  }
  return bonus;
}
