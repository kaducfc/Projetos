import { getItem } from '../data/items.js';
import { countEquippedCardCopies, unsocketCard, MAX_EQUIPPED_CARD_COPIES } from './crafting.js';

export function getInventoryEntry(state, uid) {
  return state.inventory.find((i) => i.uid === uid) || null;
}

/// Returns { uid, entry, item } for whatever is equipped in slotId, or null.
export function getEquippedEntry(state, slotId) {
  const uid = state.equipped[slotId];
  if (!uid) return null;
  const entry = getInventoryEntry(state, uid);
  if (!entry) return null;
  const item = getItem(entry.itemId);
  if (!item) return null;
  return { uid, entry, item };
}

/// Equips the item regardless of its socketed card — but if that card is
/// already at the equipped-copies cap on other gear (MAX_EQUIPPED_CARD_COPIES
/// in systems/crafting.js), this card is auto-unsocketed back to
/// state.cards first, rather than blocking the equip itself.
export function equipItem(state, uid) {
  const entry = getInventoryEntry(state, uid);
  if (!entry) return false;
  const item = getItem(entry.itemId);
  if (!item) return false;

  if (entry.cardId && countEquippedCardCopies(state, entry.cardId, uid) >= MAX_EQUIPPED_CARD_COPIES) {
    unsocketCard(state, uid);
  }

  state.equipped[item.slotId] = uid;
  return true;
}

export function unequipSlot(state, slotId) {
  state.equipped[slotId] = null;
}
