import { getItem, getSlotIdsForCategory, GOD_MIN_LEVEL } from '../data/items.js';
import { countEquippedCardCopies, unsocketCard, MAX_EQUIPPED_CARD_COPIES, ensureCardIds } from './crafting.js';
import { isGodItemComplete } from './godItems.js';

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

/// A arma secundária (weapon2: Aljava/Livro/Escudo) só pode ser equipada se
/// a arma primária (weapon1) já equipada for do MESMO atributo — Aljava com
/// Arco, Livro com Cajado, Escudo com Espada. Únicas 2 categorias com essa
/// trava; todo o resto equipa livremente. Sempre true pra qualquer item que
/// não seja weapon2.
export function canEquipItem(state, uid) {
  const entry = getInventoryEntry(state, uid);
  if (!entry) return false;
  const item = getItem(entry.itemId);
  if (!item) return false;
  // Item Tier God: só equipa completo (9 atributos escolhidos, ver
  // isGodItemComplete em systems/godItems.js) e com Nível de Caçador >=
  // GOD_MIN_LEVEL — abaixo disso fica no inventário com o botão
  // desabilitado, sem mensagem de erro (ver godRequirementNote em
  // ui/render.js pro aviso).
  if (item.isGodTier) {
    if (!isGodItemComplete(entry, item)) return false;
    if ((state.hunterLevel || 1) < GOD_MIN_LEVEL) return false;
  }
  if (item.category !== 'weapon2') return true;
  const primary = getEquippedEntry(state, 'weapon1');
  return !!primary && primary.item.attribute === item.attribute;
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
  if (!canEquipItem(state, uid)) return false;

  ensureCardIds(entry).forEach((cardId, slotIndex) => {
    if (cardId && countEquippedCardCopies(state, cardId, uid, slotIndex) >= MAX_EQUIPPED_CARD_COPIES) {
      unsocketCard(state, uid, slotIndex);
    }
  });

  const candidateSlots = getSlotIdsForCategory(item.category);
  const targetSlotId = candidateSlots.find((slotId) => !state.equipped[slotId]) || candidateSlots[0];
  state.equipped[targetSlotId] = uid;

  // Trocar a arma primária por uma de outro atributo invalida a arma
  // secundária que estava equipada (ela só existe pareada com a mesma
  // primária que a libera, ver canEquipItem acima) — sai sozinha do slot
  // em vez de ficar num pareamento que não seria permitido do zero.
  if (item.category === 'weapon1') {
    const secondary = getEquippedEntry(state, 'weapon2');
    if (secondary && secondary.item.attribute !== item.attribute) {
      state.equipped.weapon2 = null;
    }
  }

  return true;
}

export function unequipSlot(state, slotId) {
  state.equipped[slotId] = null;
  // Arma secundária só existe pareada com a primária (ver canEquipItem
  // acima) — sem primária, ela sai junto.
  if (slotId === 'weapon1') state.equipped.weapon2 = null;
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
