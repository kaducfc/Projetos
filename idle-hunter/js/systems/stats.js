import { getItem, getEnhancedStats } from '../data/items.js';
import { UPGRADES } from '../data/upgrades.js';
import { ELEMENT_RESISTANCE_PER_PIECE } from '../data/elements.js';
import { getCard, CARD_DAMAGE_BONUS } from '../data/cards.js';

const BASE_CLICK_DAMAGE = 5;
const BASE_DPS = 0;
const BASE_MAX_HP = 100;
const BASE_ARMOR = 0;
const DEFAULT_WEAPON_ELEMENT = 'neutro';

/// Aggregates equipment + upgrades into the final combat stats used every
/// frame. Recomputed on demand (cheap enough to call whenever gear/upgrades
/// change, no need to cache).
export function computePlayerStats(state) {
  let clickFlat = BASE_CLICK_DAMAGE;
  let dpsFlat = BASE_DPS;
  let clickPercent = 0;
  let dpsPercent = 0;
  let goldPercent = 0;
  let dropPercent = 0;
  let hpFlat = BASE_MAX_HP;
  let armorFlat = BASE_ARMOR;
  let weaponElement = DEFAULT_WEAPON_ELEMENT;

  for (const [slotId, uid] of Object.entries(state.equipped)) {
    if (!uid) continue;
    const invEntry = state.inventory.find((i) => i.uid === uid);
    if (!invEntry) continue;

    if (invEntry.cardId) {
      const card = getCard(invEntry.cardId);
      if (card && card.bonus) addStat(card.bonus.stat, card.bonus.value);
    }

    const item = getItem(invEntry.itemId);
    if (!item) continue;
    const stats = getEnhancedStats(item, invEntry.enhanceLevel || 0, !!invEntry.isMaster);

    clickFlat += stats.clickFlat || 0;
    dpsFlat += stats.dpsFlat || 0;
    clickPercent += stats.clickPercent || 0;
    dpsPercent += stats.dpsPercent || 0;
    goldPercent += stats.goldPercent || 0;
    dropPercent += stats.dropPercent || 0;
    hpFlat += stats.hpFlat || 0;
    armorFlat += stats.armorFlat || 0;

    if (slotId === 'weapon') weaponElement = item.element || DEFAULT_WEAPON_ELEMENT;
  }

  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id] || 0;
    if (level <= 0) continue;
    const total = level * upgrade.valuePerLevel;
    addStat(upgrade.stat, total);
  }

  function addStat(stat, total) {
    if (stat === 'clickFlat') clickFlat += total;
    else if (stat === 'dpsFlat') dpsFlat += total;
    else if (stat === 'clickPercent') clickPercent += total;
    else if (stat === 'dpsPercent') dpsPercent += total;
    else if (stat === 'goldPercent') goldPercent += total;
    else if (stat === 'dropPercent') dropPercent += total;
    else if (stat === 'hpFlat') hpFlat += total;
    else if (stat === 'armorFlat') armorFlat += total;
  }

  const clickDamage = clickFlat * (1 + clickPercent / 100);
  const dps = dpsFlat * (1 + dpsPercent / 100);
  const goldMult = 1 + goldPercent / 100;
  const dropMult = 1 + dropPercent / 100;

  return {
    clickDamage, dps, goldMult, dropMult,
    maxHp: hpFlat, armor: armorFlat, weaponElement,
  };
}

const DEFENSE_SLOTS = ['helmet', 'armor', 'pants', 'gloves', 'boots'];

/// Resistance to a specific element, from equipped defense pieces whose own
/// monster family matches that element — 5% per matching piece. Computed
/// separately from computePlayerStats() because it depends on which
/// element is attacking (i.e. the current monster), not just on gear.
export function getElementalResistance(state, element) {
  let count = 0;
  for (const slotId of DEFENSE_SLOTS) {
    const uid = state.equipped[slotId];
    if (!uid) continue;
    const invEntry = state.inventory.find((i) => i.uid === uid);
    if (!invEntry) continue;
    const item = getItem(invEntry.itemId);
    if (item && item.element === element) count += 1;
  }
  return count * ELEMENT_RESISTANCE_PER_PIECE;
}

/// Sum of socketed-card bonuses against a specific element — +3% per
/// equipped item (any slot, not just defense) whose card matches that
/// element. Same "Neutro never has advantage" rule as elementDamageModifier,
/// and computed separately from computePlayerStats() for the same reason as
/// getElementalResistance() above: it depends on the current target.
export function getCardDamageBonus(state, element) {
  if (element === 'neutro') return 0;
  let bonus = 0;
  for (const uid of Object.values(state.equipped)) {
    if (!uid) continue;
    const invEntry = state.inventory.find((i) => i.uid === uid);
    if (!invEntry || !invEntry.cardId) continue;
    const card = getCard(invEntry.cardId);
    if (card && card.element === element) bonus += CARD_DAMAGE_BONUS;
  }
  return bonus;
}
