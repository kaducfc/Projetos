import { CARD_DISCOVERY_CASH_REWARD } from '../data/cards.js';

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
