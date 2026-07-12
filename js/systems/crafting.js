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
  // cardSlotUnlocked: every crafted piece starts with its card slot LOCKED —
  // see attemptCardSlotUnlock() below. cardId: which card (if any) is
  // socketed once the slot is unlocked. enhanceLevel/isMaster: this specific
  // instance's upgrade progress, see enhanceItem()/upgradeToMaster() below.
  state.inventory.push({ uid, itemId, cardId: null, cardSlotUnlocked: false, enhanceLevel: 0, isMaster: false });
  state.equipped[item.slotId] = uid;
  return uid;
}

function getEntry(state, uid) {
  return state.inventory.find((i) => i.uid === uid) || null;
}

// Any inventory entry saved before this system existed has cardSlotUnlocked
// === undefined. Treat it as unlocked if it already had a card socketed
// (the old one-step flow), locked otherwise — nobody loses a socketed card
// on load, but nobody gets a free unlock either.
function isSlotUnlocked(entry) {
  return !!(entry.cardSlotUnlocked || entry.cardId);
}

export const CARD_SLOT_UNLOCK_CHANCE = 0.8;
export const CARD_SLOT_UNLOCK_GOLD_PERCENT = 0.1;

export function cardSlotUnlockCost(state) {
  return Math.max(1, Math.round(state.gold * CARD_SLOT_UNLOCK_GOLD_PERCENT));
}

export function canAttemptCardSlotUnlock(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry || isSlotUnlocked(entry)) return false;
  return state.gold >= cardSlotUnlockCost(state);
}

/// Gold is spent on every attempt, win or lose — each retry costs 10% of
/// whatever gold remains at that moment, so failing repeatedly gets
/// (gently) cheaper in absolute terms. Returns {success, cost}, or null if
/// the attempt couldn't be made at all (already unlocked / can't afford it).
export function attemptCardSlotUnlock(state, uid) {
  if (!canAttemptCardSlotUnlock(state, uid)) return null;
  const entry = getEntry(state, uid);
  const cost = cardSlotUnlockCost(state);
  state.gold -= cost;
  const success = Math.random() < CARD_SLOT_UNLOCK_CHANCE;
  if (success) entry.cardSlotUnlocked = true;
  return { success, cost };
}

/// A card is consumed from state.cards (a stackable count, like a material)
/// the moment it's socketed — the item's slot must be unlocked and empty
/// first (unsocketCard() below frees it back up, but keeps it unlocked).
export function canSocketCard(state, uid, cardId) {
  const entry = getEntry(state, uid);
  if (!entry || !isSlotUnlocked(entry) || entry.cardId) return false;
  return (state.cards[cardId] || 0) >= 1;
}

export function socketCard(state, uid, cardId) {
  if (!canSocketCard(state, uid, cardId)) return false;
  const entry = getEntry(state, uid);
  state.cards[cardId] -= 1;
  entry.cardId = cardId;
  return true;
}

/// Frees the slot (but leaves it unlocked) and returns the card to
/// state.cards — swapping cards is meant to be cheap/reversible, not a
/// one-way commitment. Only the initial unlock is the gated, risky step.
export function unsocketCard(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry || !entry.cardId) return false;
  state.cards[entry.cardId] = (state.cards[entry.cardId] || 0) + 1;
  entry.cardId = null;
  return true;
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
  return (
    (state.materials[item.gemMaterialId] || 0) >= 1 &&
    (state.materials[item.commonMaterialId] || 0) >= item.masterMaterialCost
  );
}

export function upgradeToMaster(state, uid) {
  if (!canUpgradeToMaster(state, uid)) return false;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  state.materials[item.gemMaterialId] -= 1;
  state.materials[item.commonMaterialId] -= item.masterMaterialCost;
  entry.isMaster = true;
  return true;
}
