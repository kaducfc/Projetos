import {
  CARD_DISCOVERY_CASH_REWARD, CARDS, getCard, CARD_FRAGMENT_ID,
  getCardRecycleValue, getCardCraftCost,
} from '../data/cards.js';

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
// Cartas Deus (ver GOD_CARDS em data/cards.js): 5% de DPS cada, 5 cartas no
// total — coleção completa (5/5) dá +25% de DPS, pedido explícito do
// usuário.
const GOD_CARD_DPS_BONUS_PERCENT = 5;

export function getCardCollectionDpsBonusPercent(state) {
  let bonus = 0;
  for (const card of CARDS) {
    if (!isCardDiscovered(state, card.id)) continue;
    bonus += card.isGodCard
      ? GOD_CARD_DPS_BONUS_PERCENT
      : card.isBossCard ? BOSS_CARD_DPS_BONUS_PERCENT : NORMAL_CARD_DPS_BONUS_PERCENT;
  }
  return bonus;
}

// ---------------------------------------------------------------------
// Fragmento de Carta (ver CARD_FRAGMENT_ID/getCardRecycleValue/
// getCardCraftCost em data/cards.js): reciclar consome 1 cópia de uma
// carta que o jogador tem e devolve fragmentos (mais por carta de zona
// avançada, mais ainda se for carta de chefe); craftar faz o caminho
// inverso, gastando fragmentos pra ganhar 1 cópia de uma carta qualquer
// (mesmo que ainda não descoberta — craftar também conta como descoberta,
// igual um drop).
// ---------------------------------------------------------------------

export function canRecycleCard(state, cardId) {
  return (state.cards[cardId] || 0) >= 1;
}

/// Retorna true se reciclou. Consome 1 cópia da carta e devolve fragmentos
/// (ver getCardRecycleValue).
export function recycleCard(state, cardId) {
  if (!canRecycleCard(state, cardId)) return false;
  const card = getCard(cardId);
  if (!card) return false;
  state.cards[cardId] -= 1;
  state.materials[CARD_FRAGMENT_ID] = (state.materials[CARD_FRAGMENT_ID] || 0) + getCardRecycleValue(card);
  return true;
}

export function canCraftCard(state, cardId) {
  const card = getCard(cardId);
  if (!card || card.noCraft) return false;
  return (state.materials[CARD_FRAGMENT_ID] || 0) >= getCardCraftCost(card);
}

/// Retorna true se craftou. Consome os fragmentos (ver getCardCraftCost) e
/// entrega 1 cópia da carta, marcando-a como descoberta (mesmo tratamento
/// de uma carta obtida por drop).
export function craftCard(state, cardId) {
  if (!canCraftCard(state, cardId)) return false;
  const card = getCard(cardId);
  state.materials[CARD_FRAGMENT_ID] -= getCardCraftCost(card);
  state.cards[cardId] = (state.cards[cardId] || 0) + 1;
  recordCardDiscovered(state, cardId);
  return true;
}
