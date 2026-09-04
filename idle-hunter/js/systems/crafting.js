import {
  getItem, ENHANCE_MAX_LEVEL, rollDroppedItem, getRarity, getSlotIdsForCategory,
  getAscensionCost, rollBaseStatsFromTemplate, rollAscensionBonusCandidates,
  getItemInventoryCap, getItemScrapMaterial, RARITIES,
  MYSTIC_DIE_ID, rollBonusRerollCandidates,
} from '../data/items.js';
import { ZONES } from '../data/monsters.js';

/// Adiciona ao inventário um item recém-dropado (ver
/// systems/combat.js rollItemDropOnKill / data/items.js rollDroppedItem) —
/// não craft, não custo: o item já nasce pronto, sem auto-equipar (o
/// jogador equipa manualmente, mesmo fluxo de sempre via equipItem). Se o
/// inventário já estiver no limite (100, ou 150 com VIP, ver
/// getItemInventoryCap), o item NOVO é descartado automaticamente em vez de
/// entrar, e vira material (ver getItemScrapMaterial) direto pro jogador.
/// Retorna { uid, discarded, material? }, ou null se a rolagem de drop
/// falhar por algum motivo.
export function addDroppedItem(state, zoneIndex, slotId, forcedRarityId = null) {
  const rolled = rollDroppedItem(zoneIndex, slotId, forcedRarityId);
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
/// Ascensão — simplified from the old "2 slots once Master" rule. Itens
/// Tier God (ver data/items.js GOD_ITEMS) são a única exceção, com 2 slots
/// fixos desde a compra (item.cardSlots), pedido explícito do usuário.
export function maxCardSlots(entry) {
  const item = getItem(entry.itemId);
  return item?.cardSlots || 1;
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
  // Item Tier God não aprimora/evolui/ascende — já nasce no auge, montado
  // atributo a atributo na compra (ver systems/godItems.js).
  if (item.isGodTier) return null;
  return item.enhanceCost[entry.enhanceLevel];
}

export function canEnhance(state, uid) {
  const cost = getEnhanceCost(state, uid);
  if (cost == null) return false;
  return (state.materials[cost.matId] || 0) >= cost.qty && (state.gold || 0) >= cost.gold;
}

export function enhanceItem(state, uid) {
  const cost = getEnhanceCost(state, uid);
  if (!canEnhance(state, uid)) return false;
  const entry = getEntry(state, uid);
  state.materials[cost.matId] -= cost.qty;
  state.gold -= cost.gold;
  entry.enhanceLevel += 1;
  return true;
}

export function canUpgradeToMaster(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry || entry.isMaster || entry.enhanceLevel < ENHANCE_MAX_LEVEL) return false;
  const item = getItem(entry.itemId);
  if (item.isGodTier) return false;
  const m = item.masterMaterialCost;
  return (
    (state.materials[m.matId] || 0) >= m.qty &&
    (state.gold || 0) >= m.gold
  );
}

export function upgradeToMaster(state, uid) {
  if (!canUpgradeToMaster(state, uid)) return false;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  const m = item.masterMaterialCost;
  state.materials[m.matId] -= m.qty;
  state.gold -= m.gold;
  entry.isMaster = true;
  // Conquista "Itens Rank Master" (ver data/achievements.js) — contagem
  // histórica de itens já evoluídos, não quantos estão em Rank Master
  // agora (sobrevive a descarte/substituição e a Transcender).
  state.lifetimeRankMasterCount = (state.lifetimeRankMasterCount || 0) + 1;
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
  if (item.isGodTier) return false;
  const cost = getAscensionCost(item, entry.rarityId);
  if (!cost) return false;
  return (state.materials[cost.matId] || 0) >= cost.qty;
}

/// Etapa 1 da Ascensão: rerola baseStats pra magnitude da raridade seguinte
/// (sem mutar o state ainda) e sorteia 3 candidatos de bônus adicional pro
/// jogador escolher — o novo bônus da raridade seguinte (que sempre tem
/// exatamente +1 slot de adicional a mais que a atual, ver RARITIES em
/// data/items.js) não é mais rerolado sozinho como os demais adicionais já
/// existentes, que continuam intactos. Retorna null se a ascensão não for
/// possível agora (rank/material insuficiente); o chamador (main.js) guarda
/// o resultado até o jogador clicar num dos 3 candidatos, aí sim chama
/// finalizeAscension.
export function rollAscensionCandidates(state, uid) {
  if (!canAscendItem(state, uid)) return null;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  const cost = getAscensionCost(item, entry.rarityId);
  const nextRarity = getRarity(cost.nextRarityId);
  const newBaseStats = rollBaseStatsFromTemplate(item.stats, nextRarity, item.attribute);
  const candidates = rollAscensionBonusCandidates(
    item.zoneIndex, item.attribute, newBaseStats[item.attribute],
    entry.additionalStats, nextRarity.mult,
  );
  return { uid, nextRarityId: nextRarity.id, newBaseStats, candidates };
}

/// Etapa 2 da Ascensão: cobra o custo e commita a escolha do jogador (um dos
/// `pending.candidates` de rollAscensionCandidates) como o único bônus NOVO
/// — os adicionais que o item já tinha são mantidos como estavam. Confere de
/// novo se a ascensão ainda é possível e se `pending` ainda bate com a
/// raridade atual do item (guarda contra o item ter mudado entre abrir o
/// modal e escolher, ex: outra aba/ação nesse meio tempo).
export function finalizeAscension(state, uid, pending, chosenIndex) {
  if (!pending || pending.uid !== uid) return false;
  if (!canAscendItem(state, uid)) return false;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  const cost = getAscensionCost(item, entry.rarityId);
  if (!cost || cost.nextRarityId !== pending.nextRarityId) return false;
  const chosen = pending.candidates[chosenIndex];
  if (!chosen) return false;

  state.materials[cost.matId] -= cost.qty;

  entry.rarityId = pending.nextRarityId;
  entry.baseStats = pending.newBaseStats;
  entry.additionalStats = [...entry.additionalStats, chosen];
  entry.enhanceLevel = 0;
  entry.isMaster = false;
  return true;
}

// ---------------------------------------------------------------------
// Reroll de bônus com Dado Místico (ver MYSTIC_DIE_ID em data/items.js):
// substitui UM bônus adicional já existente de um item normal (não Tier
// God, que tem seu próprio fluxo de montagem em systems/godItems.js) por 1
// de 3 candidatos sorteados na raridade ATUAL do item. Diferente da
// Ascensão (que cobra o custo só ao ESCOLHER um dos 3), o Dado Místico é
// consumido na hora de ROLAR os 3 candidatos (pedido explícito do
// usuário) — o chamador (main.js) guarda o resultado em memória até o
// jogador escolher, e reabrir sem escolher NÃO rola de novo nem cobra
// outro dado (ver reuso de `pendingBonusReroll` em main.js).
// ---------------------------------------------------------------------

export function canRerollBonus(state, uid, statIndex) {
  const entry = getEntry(state, uid);
  if (!entry) return false;
  const item = getItem(entry.itemId);
  if (item.isGodTier) return false;
  if (statIndex < 0 || statIndex >= (entry.additionalStats || []).length) return false;
  return (state.materials[MYSTIC_DIE_ID] || 0) >= 1;
}

/// Retorna null (sem cobrar nada) se não puder rerolar agora — index
/// inválido, item Tier God ou sem Dado Místico.
export function rollBonusReroll(state, uid, statIndex) {
  if (!canRerollBonus(state, uid, statIndex)) return null;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  state.materials[MYSTIC_DIE_ID] -= 1;
  const candidates = rollBonusRerollCandidates(item, entry, statIndex);
  return { uid, statIndex, candidates };
}

/// Commita a escolha de 1 dos 3 candidatos de rollBonusReroll — não cobra
/// nada (o Dado Místico já foi gasto na rolagem). `pending` é o retorno de
/// rollBonusReroll, guardado em main.js até o clique de escolha.
export function finalizeBonusReroll(state, uid, pending, chosenIndex) {
  if (!pending || pending.uid !== uid) return false;
  const entry = getEntry(state, uid);
  if (!entry) return false;
  if (pending.statIndex < 0 || pending.statIndex >= (entry.additionalStats || []).length) return false;
  const chosen = pending.candidates[chosenIndex];
  if (!chosen) return false;
  entry.additionalStats[pending.statIndex] = chosen;
  return true;
}

/// Every material this instance has consumed so far via enhance/Master
/// (there's no craft cost anymore — the item itself was a free drop): one
/// enhanceCost[i] per level already bought, plus the Rank Master cost if it
/// went through that upgrade.
/// Destroys an inventory instance, refunding 1 material per monster of the
/// item's own zone (the 4 "weak" monsters + the zone boss, ZONES[zoneIndex]
/// — ver data/monsters.js), multiplicado pela posição da raridade do item
/// na lista RARITIES (Comum = índice 0 -> x1, Épico = índice 3 -> x4, etc,
/// pedido explícito do usuário: "Item Tier 1 comum" = 1 material de cada
/// monstro da Zona 1; "item Épico do Tier 5" = 4 materiais de cada monstro
/// da Zona 5). Substitui o antigo reembolso de 80% do material GASTO no
/// aprimoramento — agora não depende de quanto foi gasto, só da zona/
/// raridade do item em si. Any socketed cards are unsocketed back into
/// state.cards first — see unsocketCard() above. Unequips the slot if this
/// was the equipped piece. Returns the refunded {materialId: qty} map, or
/// null if uid doesn't exist.
export function destroyItem(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry) return null;
  const item = getItem(entry.itemId);
  // Item Tier God nunca pode ser destruído/vendido — fica pra sempre na
  // conta uma vez comprado (pedido explícito do usuário).
  if (item.isGodTier) return null;

  ensureCardIds(entry).forEach((cardId, slotIndex) => {
    if (cardId) unsocketCard(state, uid, slotIndex);
  });

  const rarityIndex = Math.max(0, RARITIES.findIndex((r) => r.id === entry.rarityId));
  const qtyPerMonster = rarityIndex + 1;
  const zone = ZONES[item.zoneIndex];
  const matIds = [
    ...(zone?.weakMonsters || []).map((m) => m.material?.id),
    zone?.boss?.materials?.primary1?.id,
  ].filter(Boolean);

  const refund = {};
  for (const matId of matIds) {
    state.materials[matId] = (state.materials[matId] || 0) + qtyPerMonster;
    refund[matId] = (refund[matId] || 0) + qtyPerMonster;
  }

  for (const slotId of getSlotIdsForCategory(item.category)) {
    if (state.equipped[slotId] === uid) state.equipped[slotId] = null;
  }
  state.inventory = state.inventory.filter((i) => i.uid !== uid);
  return refund;
}
