import { getItem, ENHANCE_MAX_LEVEL } from '../data/items.js';

export function canCraft(state, itemId) {
  const item = getItem(itemId);
  if (!item) return false;
  // unlockStage is null for legacy (pre-boss-roster) items, which are no
  // longer offered for crafting at all — see data/items.js.
  if (item.unlockStage == null || state.maxStage < item.unlockStage) return false;
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
  // cardIds: every crafted piece starts with 1 card slot already unlocked
  // (cardIds[0]) — no separate unlock step anymore. Reaching Rank Master
  // grants a 2nd slot (see upgradeToMaster/ensureCardIds below).
  // enhanceLevel/isMaster: this specific instance's upgrade progress, see
  // enhanceItem()/upgradeToMaster() below.
  state.inventory.push({ uid, itemId, cardIds: [null], enhanceLevel: 0, isMaster: false });
  state.equipped[item.slotId] = uid;
  return uid;
}

function getEntry(state, uid) {
  return state.inventory.find((i) => i.uid === uid) || null;
}

/// How many card slots this item has: 1 normally, 2 once it's Rank Master.
export function maxCardSlots(entry) {
  return entry.isMaster ? 2 : 1;
}

/// Lazily grows entry.cardIds to match maxCardSlots (also covers saves
/// from before this array existed, or from before the 2nd Master slot was
/// added to an already-Master item) — always the single source of truth
/// for "this entry's card slot array", never read/write entry.cardIds
/// directly anywhere else.
export function ensureCardIds(entry) {
  if (!entry.cardIds) entry.cardIds = [];
  const slots = maxCardSlots(entry);
  while (entry.cardIds.length < slots) entry.cardIds.push(null);
  return entry.cardIds;
}

/// At most this many equipped items (across all 6 slots) may carry the same
/// card at once — copies sitting on unequipped inventory items don't count.
/// Enforced two ways: canSocketCard() below refuses to socket a 3rd
/// equipped copy directly, while equipItem() (systems/equipment.js) instead
/// lets the *item* get equipped but auto-unsockets its card back to
/// state.cards if doing so would push an already-at-cap card over the line.
export const MAX_EQUIPPED_CARD_COPIES = 2;

/// excludeSlotIndex only excludes that one specific slot on excludeUid — the
/// *other* slot of a 2-slot Master item still counts toward the cap, since
/// it's a genuinely separate equipped copy.
export function countEquippedCardCopies(state, cardId, excludeUid = null, excludeSlotIndex = null) {
  let count = 0;
  for (const uid of Object.values(state.equipped)) {
    if (!uid) continue;
    const entry = getEntry(state, uid);
    if (!entry) continue;
    ensureCardIds(entry).forEach((id, idx) => {
      if (id !== cardId) return;
      if (uid === excludeUid && idx === excludeSlotIndex) return;
      count += 1;
    });
  }
  return count;
}

/// A card is consumed from state.cards (a stackable count, like a material)
/// the moment it's socketed into the given slot (0-based, must be within
/// maxCardSlots(entry)) — unsocketCard() below frees it back up. If the
/// item is currently equipped, also blocks a 3rd equipped copy of the same
/// card (see MAX_EQUIPPED_CARD_COPIES above).
export function canSocketCard(state, uid, slotIndex, cardId) {
  const entry = getEntry(state, uid);
  if (!entry) return false;
  const cardIds = ensureCardIds(entry);
  if (slotIndex < 0 || slotIndex >= cardIds.length || cardIds[slotIndex]) return false;
  if ((state.cards[cardId] || 0) < 1) return false;
  const isEquipped = Object.values(state.equipped).includes(uid);
  if (isEquipped && countEquippedCardCopies(state, cardId, uid, slotIndex) >= MAX_EQUIPPED_CARD_COPIES) return false;
  return true;
}

export function socketCard(state, uid, slotIndex, cardId) {
  if (!canSocketCard(state, uid, slotIndex, cardId)) return false;
  const entry = getEntry(state, uid);
  state.cards[cardId] -= 1;
  entry.cardIds[slotIndex] = cardId;
  return true;
}

/// Frees the slot and returns the card to state.cards — swapping cards is
/// meant to be cheap/reversible.
export function unsocketCard(state, uid, slotIndex) {
  const entry = getEntry(state, uid);
  if (!entry) return false;
  const cardIds = ensureCardIds(entry);
  const cardId = cardIds[slotIndex];
  if (!cardId) return false;
  state.cards[cardId] = (state.cards[cardId] || 0) + 1;
  cardIds[slotIndex] = null;
  return true;
}

/// Cost ({matId, qty}) to enhance this instance one level, or null if it's
/// not eligible for a normal +level enhancement right now (already at max
/// level, or already Rank Master). Which material varies by level (and by
/// slot) — see buildBossItem() in data/items.js.
export function getEnhanceCost(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry || entry.isMaster || entry.enhanceLevel >= ENHANCE_MAX_LEVEL) return null;
  const item = getItem(entry.itemId);
  return item.enhanceCost[entry.enhanceLevel];
}

export function canEnhance(state, uid) {
  const cost = getEnhanceCost(state, uid);
  if (cost == null) return false;
  return (state.materials[cost.matId] || 0) >= cost.qty;
}

export function enhanceItem(state, uid) {
  const cost = getEnhanceCost(state, uid);
  if (!canEnhance(state, uid)) return false;
  const entry = getEntry(state, uid);
  state.materials[cost.matId] -= cost.qty;
  entry.enhanceLevel += 1;
  return true;
}

export function canUpgradeToMaster(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry || entry.isMaster || entry.enhanceLevel < ENHANCE_MAX_LEVEL) return false;
  const item = getItem(entry.itemId);
  const m = item.masterMaterialCost;
  return (
    (state.materials[item.crystalMaterialId] || 0) >= 1 &&
    (state.materials[m.matId] || 0) >= m.qty
  );
}

export function upgradeToMaster(state, uid) {
  if (!canUpgradeToMaster(state, uid)) return false;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  const m = item.masterMaterialCost;
  state.materials[item.crystalMaterialId] -= 1;
  state.materials[m.matId] -= m.qty;
  entry.isMaster = true;
  ensureCardIds(entry); // grows to the 2nd card slot Rank Master grants
  return true;
}

/// Every material this instance has consumed so far: the initial craft
/// cost, plus one enhanceCost[i] per level already bought, plus the Rank
/// Master cost if it went through that upgrade. Doesn't include goldCost —
/// destroying refunds materials only, not gold.
function materialsSpentOn(item, entry) {
  const spent = { ...item.materialCost };
  for (let i = 0; i < entry.enhanceLevel; i++) {
    const step = item.enhanceCost[i];
    spent[step.matId] = (spent[step.matId] || 0) + step.qty;
  }
  if (entry.isMaster) {
    const m = item.masterMaterialCost;
    spent[m.matId] = (spent[m.matId] || 0) + m.qty;
    spent[item.crystalMaterialId] = (spent[item.crystalMaterialId] || 0) + 1;
  }
  return spent;
}

export const DESTROY_REFUND_RATE = 0.8;

/// Destroys an inventory instance, refunding DESTROY_REFUND_RATE (80%) of
/// every material it consumed across crafting and every enhance/master
/// upgrade since (rounded down per material). Any socketed cards are
/// unsocketed back into state.cards first — see unsocketCard() above.
/// Unequips the slot if this was the equipped piece. Returns the refunded
/// {materialId: qty} map, or null if uid doesn't exist.
export function destroyItem(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry) return null;
  const item = getItem(entry.itemId);

  ensureCardIds(entry).forEach((cardId, slotIndex) => {
    if (cardId) unsocketCard(state, uid, slotIndex);
  });

  const refund = {};
  for (const [matId, qty] of Object.entries(materialsSpentOn(item, entry))) {
    const amount = Math.floor(qty * DESTROY_REFUND_RATE);
    if (amount <= 0) continue;
    state.materials[matId] = (state.materials[matId] || 0) + amount;
    refund[matId] = amount;
  }

  if (state.equipped[item.slotId] === uid) state.equipped[item.slotId] = null;
  state.inventory = state.inventory.filter((i) => i.uid !== uid);
  return refund;
}
