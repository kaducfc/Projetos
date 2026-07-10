import { getItem } from '../data/items.js';

export function canCraft(state, itemId) {
  const item = getItem(itemId);
  if (!item) return false;
  if (state.gold < item.goldCost) return false;
  for (const [matId, qty] of Object.entries(item.materialCost)) {
    if ((state.materials[matId] || 0) < qty) return false;
  }
  return true;
}

export function hasCraftedItem(state, itemId) {
  return state.inventory.some((i) => i.itemId === itemId);
}

/// Crafts and auto-equips the item (replacing whatever was in that slot).
/// Returns the new inventory uid, or null if requirements weren't met.
export function craftItem(state, itemId) {
  if (!canCraft(state, itemId)) return null;
  const item = getItem(itemId);

  state.gold -= item.goldCost;
  for (const [matId, qty] of Object.entries(item.materialCost)) {
    state.materials[matId] -= qty;
  }

  const uid = state.nextUid++;
  state.inventory.push({ uid, itemId });
  state.equipped[item.slotId] = uid;
  return uid;
}
