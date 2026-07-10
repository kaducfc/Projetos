import { getItem } from '../data/items.js';

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

export function equipItem(state, uid) {
  const entry = getInventoryEntry(state, uid);
  if (!entry) return false;
  const item = getItem(entry.itemId);
  if (!item) return false;
  state.equipped[item.slotId] = uid;
  return true;
}

export function unequipSlot(state, slotId) {
  state.equipped[slotId] = null;
}

export function getInventoryForSlot(state, slotId) {
  return state.inventory
    .filter((entry) => getItem(entry.itemId)?.slotId === slotId)
    .map((entry) => ({ uid: entry.uid, entry, item: getItem(entry.itemId) }));
}
