import { getItem, ENHANCE_MAX_LEVEL } from '../data/items.js';

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
  // cardId: reserved slot for a future Ragnarok-style card socket system —
  // every crafted piece (attack or defense) has exactly one, unused for now.
  // enhanceLevel/isMaster: this specific instance's upgrade progress, see
  // enhanceItem()/upgradeToMaster() below.
  state.inventory.push({ uid, itemId, cardId: null, enhanceLevel: 0, isMaster: false });
  state.equipped[item.slotId] = uid;
  return uid;
}

export function socketCard(state, uid, cardId) {
  const entry = state.inventory.find((i) => i.uid === uid);
  if (!entry) return false;
  entry.cardId = cardId;
  return true;
}

function getEntry(state, uid) {
  return state.inventory.find((i) => i.uid === uid) || null;
}

/// Cost (in the item's common material) to enhance this instance one level,
/// or null if it's not eligible for a normal +level enhancement right now
/// (already at max level, or already Rank Master).
export function getEnhanceCost(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry || entry.isMaster || entry.enhanceLevel >= ENHANCE_MAX_LEVEL) return null;
  const item = getItem(entry.itemId);
  return item.enhanceCost[entry.enhanceLevel];
}

export function canEnhance(state, uid) {
  const cost = getEnhanceCost(state, uid);
  if (cost == null) return false;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  return (state.materials[item.commonMaterialId] || 0) >= cost;
}

export function enhanceItem(state, uid) {
  if (!canEnhance(state, uid)) return false;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  const cost = item.enhanceCost[entry.enhanceLevel];
  state.materials[item.commonMaterialId] -= cost;
  entry.enhanceLevel += 1;
  return true;
}

export function canUpgradeToMaster(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry || entry.isMaster || entry.enhanceLevel < ENHANCE_MAX_LEVEL) return false;
  const item = getItem(entry.itemId);
  return (state.materials[item.gemMaterialId] || 0) >= 1;
}

export function upgradeToMaster(state, uid) {
  if (!canUpgradeToMaster(state, uid)) return false;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  state.materials[item.gemMaterialId] -= 1;
  entry.isMaster = true;
  return true;
}
