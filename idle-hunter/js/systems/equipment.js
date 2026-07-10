import { getItem } from '../data/items.js';

export function getInventoryEntry(state, uid) {
  return state.inventory.find((i) => i.uid === uid) || null;
}

export function getEquippedItem(state, slotId) {
  const uid = state.equipped[slotId];
  if (!uid) return null;
  const entry = getInventoryEntry(state, uid);
  return entry ? getItem(entry.itemId) : null;
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
    .map((entry) => ({ uid: entry.uid, item: getItem(entry.itemId) }));
}
