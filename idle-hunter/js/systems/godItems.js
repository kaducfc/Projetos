import {
  getItem, GOD_MIN_LEVEL, GOD_BONUS_SLOTS, godAttributeBaseValue, rollGodBonusCandidates, ATTRIBUTES,
} from '../data/items.js';

export { GOD_MIN_LEVEL, GOD_BONUS_SLOTS };

function getEntry(state, uid) {
  return state.inventory.find((i) => i.uid === uid) || null;
}

/// Atributo "efetivo" de uma instância Deus — pras armas (attribute preso
/// no molde, ver GOD_ITEMS em data/items.js) é sempre o mesmo pra qualquer
/// cópia; pras demais categorias (attribute: null no molde, escolhido pelo
/// jogador na hora de montar o item) vem de entry.godAttribute. Único jeito
/// de saber "qual dos 3 atributos essa cópia específica ficou", já que o
/// molde (item) é compartilhado por toda instância do mesmo itemId.
export function getGodAttribute(entry, item) {
  return item.attribute || entry.godAttribute || null;
}

/// Só as categorias sem atributo preso (armadura/anel/colar) e só antes da
/// escolha ter sido feita — armas nunca passam por aqui (isGodTier +
/// attribute já vem definido no molde).
export function needsGodAttributeChoice(entry, item) {
  return !!item.isGodTier && !item.attribute && !entry.godAttribute;
}

export function canChooseGodAttribute(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry) return false;
  const item = getItem(entry.itemId);
  return !!item && needsGodAttributeChoice(entry, item);
}

/// 1º dos 9 atributos de um item Deus sem atributo preso — não é rolado
/// (o jogador escolhe direto entre os 3), diferente dos 8 bônus seguintes
/// (ver rollGodBonusChoice abaixo). Define de uma vez o atributo da
/// instância E sua base (godAttributeBaseValue, já 30% mais forte que o
/// Tier 10 — ver data/items.js).
export function chooseGodAttribute(state, uid, attributeId) {
  if (!canChooseGodAttribute(state, uid)) return false;
  if (!ATTRIBUTES.some((a) => a.id === attributeId)) return false;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  entry.godAttribute = attributeId;
  entry.baseStats = { [attributeId]: godAttributeBaseValue(item.category) };
  return true;
}

/// Completo = atributo definido (preso no molde ou já escolhido) + os 8
/// slots de bônus todos preenchidos — só um item completo pode ser
/// equipado (ver canEquipItem em systems/equipment.js).
export function isGodItemComplete(entry, item) {
  if (!item.isGodTier) return false;
  return !needsGodAttributeChoice(entry, item) && (entry.additionalStats?.length || 0) >= GOD_BONUS_SLOTS;
}

export function canRollGodBonus(state, uid) {
  const entry = getEntry(state, uid);
  if (!entry) return false;
  const item = getItem(entry.itemId);
  if (!item?.isGodTier) return false;
  if (needsGodAttributeChoice(entry, item)) return false;
  return (entry.additionalStats?.length || 0) < GOD_BONUS_SLOTS;
}

/// Etapa 1 de "escolher o próximo dos 8 bônus" — rola 3 candidatos (mesma
/// mecânica de rollAscensionCandidates em systems/crafting.js: rola 3, o
/// jogador escolhe 1), sem mutar o state ainda. O chamador (main.js) guarda
/// o retorno até o clique de escolha (ver finalizeGodBonus abaixo).
export function rollGodBonusChoice(state, uid) {
  if (!canRollGodBonus(state, uid)) return null;
  const entry = getEntry(state, uid);
  const item = getItem(entry.itemId);
  const attributeId = getGodAttribute(entry, item);
  const ownBaseValue = entry.baseStats[attributeId];
  const candidates = rollGodBonusCandidates(attributeId, ownBaseValue, entry.additionalStats || []);
  return { uid, candidates };
}

export function finalizeGodBonus(state, uid, pending, chosenIndex) {
  if (!pending || pending.uid !== uid) return false;
  if (!canRollGodBonus(state, uid)) return false;
  const chosen = pending.candidates[chosenIndex];
  if (!chosen) return false;
  const entry = getEntry(state, uid);
  entry.additionalStats = [...(entry.additionalStats || []), chosen];
  return true;
}
