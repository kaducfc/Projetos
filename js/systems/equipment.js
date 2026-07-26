import { getItem, getSlotIdsForCategory } from '../data/items.js';
import { countEquippedCardCopies, unsocketCard, MAX_EQUIPPED_CARD_COPIES, ensureCardIds } from './crafting.js';

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

/// Equips the item regardless of its socketed cards — but any socketed
/// card already at the equipped-copies cap on other gear
/// (MAX_EQUIPPED_CARD_COPIES in systems/crafting.js) is auto-unsocketed
/// back to state.cards first, rather than blocking the equip itself.
///
/// Every category maps to exactly one physical slot, except 'ring' (2
/// physical slots, same category — the same ring item can occupy both).
/// For a ring: fills the first empty of ring1/ring2, or overwrites ring1 if
/// both are already taken — no extra UI needed to pick which one.
export function equipItem(state, uid) {
  const entry = getInventoryEntry(state, uid);
  if (!entry) return false;
  const item = getItem(entry.itemId);
  if (!item) return false;

  ensureCardIds(entry).forEach((cardId, slotIndex) => {
    if (cardId && countEquippedCardCopies(state, cardId, uid, slotIndex) >= MAX_EQUIPPED_CARD_COPIES) {
      unsocketCard(state, uid, slotIndex);
    }
  });

  const candidateSlots = getSlotIdsForCategory(item.category);
  const targetSlotId = candidateSlots.find((slotId) => !state.equipped[slotId]) || candidateSlots[0];
  state.equipped[targetSlotId] = uid;
  return true;
}

export function unequipSlot(state, slotId) {
  state.equipped[slotId] = null;
}

/// Which physical slot (if any) currently holds this uid — needed because
/// an item's category alone doesn't say whether a ring is in ring1 or
/// ring2 (see equipItem above).
export function findEquippedSlotId(state, uid) {
  for (const [slotId, equippedUid] of Object.entries(state.equipped)) {
    if (equippedUid === uid) return slotId;
  }
  return null;
}
