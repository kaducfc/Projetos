import {
  getItem, ENHANCE_MAX_LEVEL, rollDroppedItem, getRarity, getSlotIdsForCategory,
  getAscensionCost, rollBaseStatsFromTemplate, rollAdditionalStats,
  getItemInventoryCap, getItemScrapMaterial,
} from '../data/items.js';

/// Adiciona ao inventário um item recém-dropado (ver
/// systems/combat.js rollItemDropOnKill / data/items.js rollDroppedItem) —
/// não craft, não custo: o item já nasce pronto, sem auto-equipar (o
/// jogador equipa manualmente, mesmo fluxo de sempre via equipItem). Se o
/// inventário já estiver no limite (70, ou 100 com VIP, ver
/// getItemInventoryCap), o item NOVO é descartado automaticamente em vez de
/// entrar, e vira material (ver getItemScrapMaterial) direto pro jogador.
/// Retorna { uid, discarded, material? }, ou null se a rolagem de drop
/// falhar por algum motivo.
export function addDroppedItem(state, zoneIndex, slotId) {
  const rolled = rollDroppedItem(zoneIndex, slotId);
  if (!rolled) return null;
  if (state.inventory.length >= getItemInventoryCap(state)) {
    const item = getItem(rolled.itemId);
    const material = getItemScrapMaterial(item, rolled.rarityId);
    state.materials[material.matId] = (state.materials[material.matId] || 0) + material.qty;
    return { uid: null, discarded: true, material };
  }
  const uid = state.nextUid++;
  state.inventory.push({ uid, ...rolled });
  return { uid, discarded: false };
}

function getEntry(state, uid) {
  return state.inventory.find((i) => i.uid === uid) || null;
}

/// Every item has exactly 1 card slot, regardless of enhance/Master/
/// Ascensão — simplified from the old "2 slots once Master" rule.
export function maxCardSlots(_entry) {
  return 1;
}

/// Lazily grows entry.cardIds to match maxCardSlots (also covers saves from
/// before this array existed) — always the single source of truth for
/// "this entry's card slot array", never read/write entry.cardIds directly
/// anywhere else.
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
  return true;
}

/// Ascensão: uma vez em Rank Master, sobe de raridade (mesmo item, mesma
/// zona/categoria/atributo), voltando pra +0 — rerola baseStats e
/// additionalStats do zero pra magnitude da raridade nova (que também ganha
/// mais slots de atributo bônus, ver RARITIES em data/items.js). null se o
/// item já está em Mítico (última raridade, nada pra onde ascender).
export function canAscendItem(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry || !entry.isMaster) return false;
  const item = getItem(entry.itemId);
  const cost = getAscensionCost(item, entry.rarityId);
  if (!cost) return false;
  return (
    (state.materials[cost.crystalMaterialId] || 0) >= 1 &&
    (state.materials[cost.matId] || 0) >= cost.qty
  );
}

export function ascendItem(state, uid) {
  if (!canAscendItem(state, uid)) return false;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  const cost = getAscensionCost(item, entry.rarityId);
  state.materials[cost.crystalMaterialId] -= 1;
  state.materials[cost.matId] -= cost.qty;

  const nextRarity = getRarity(cost.nextRarityId);
  entry.rarityId = nextRarity.id;
  entry.baseStats = rollBaseStatsFromTemplate(item.stats, nextRarity, item.attribute);
  entry.additionalStats = rollAdditionalStats(nextRarity.additionals, item.zoneIndex, item.attribute, entry.baseStats[item.attribute], nextRarity.mult);
  entry.enhanceLevel = 0;
  entry.isMaster = false;
  return true;
}

/// Every material this instance has consumed so far via enhance/Master
/// (there's no craft cost anymore — the item itself was a free drop): one
/// enhanceCost[i] per level already bought, plus the Rank Master cost if it
/// went through that upgrade.
function materialsSpentOn(item, entry) {
  const spent = {};
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
/// every material it consumed across enhance/master upgrades so far
/// (rounded down per material). Any socketed cards are
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

  for (const slotId of getSlotIdsForCategory(item.category)) {
    if (state.equipped[slotId] === uid) state.equipped[slotId] = null;
  }
  state.inventory = state.inventory.filter((i) => i.uid !== uid);
  return refund;
}
