import { getItem, getEnhancedStats, SLOTS, ENHANCE_MAX_LEVEL, computeSetBonus } from '../data/items.js';
import { UPGRADES } from '../data/upgrades.js';
import { ELEMENT_RESISTANCE_PER_PIECE } from '../data/elements.js';
import { getCard, CARD_DAMAGE_BONUS } from '../data/cards.js';

const BASE_CLICK_DAMAGE = 5;
const BASE_DPS = 0;
const BASE_MAX_HP = 100;
const BASE_ARMOR = 0;
const DEFAULT_WEAPON_ELEMENT = 'neutro';

// Every hit (click or DPS tick alike) has this baseline chance to crit for
// this much extra damage, before the full-set bonus (see computeSetBonus in
// data/items.js — currently the only source of a crit bonus) adds more.
const BASE_CRIT_CHANCE = 5;
const BASE_CRIT_DAMAGE = 50;

/// Effective level for set-bonus purposes: 0-5 for +1..+5, ENHANCE_MAX_LEVEL+1
/// (6) for Rank Master — so a Rank Master piece always outranks a merely
/// maxed +5 one when it's the weakest link in the set.
function effectiveLevel(invEntry) {
  return invEntry.isMaster ? ENHANCE_MAX_LEVEL + 1 : (invEntry.enhanceLevel || 0);
}

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
  let critChancePercent = 0;
  let critDamagePercent = 0;
  let weaponElement = DEFAULT_WEAPON_ELEMENT;

  // Tracks each equipped slot's bossId + effective level, so a full-set
  // bonus (see below) can be detected without a second inventory scan.
  const equippedByBoss = {};

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

    if (item.bossId) {
      if (!equippedByBoss[item.bossId]) equippedByBoss[item.bossId] = [];
      equippedByBoss[item.bossId].push(effectiveLevel(invEntry));
    }
  }

  // Full set: all 6 slots (SLOTS = weapon + the 5 defense pieces) equipped
  // with items from the very same boss. Its level is the lowest effective
  // level among those 6 pieces — see computeSetBonus in data/items.js.
  let activeSetBonus = null;
  for (const [bossId, levels] of Object.entries(equippedByBoss)) {
    if (levels.length !== SLOTS.length) continue;
    const setLevel = Math.min(...levels);
    const bonus = computeSetBonus(bossId, setLevel);
    if (!bonus) continue;
    hpFlat += bonus.hpFlat;
    armorFlat += bonus.armorFlat;
    critChancePercent += bonus.critChancePercent;
    critDamagePercent += bonus.critDamagePercent;
    activeSetBonus = { bossId, setLevel, ...bonus };
    break; // only one boss can occupy all 6 slots at once
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
    else if (stat === 'critChancePercent') critChancePercent += total;
    else if (stat === 'critDamagePercent') critDamagePercent += total;
  }

  const clickDamage = clickFlat * (1 + clickPercent / 100);
  const dps = dpsFlat * (1 + dpsPercent / 100);
  const goldMult = 1 + goldPercent / 100;
  const dropMult = 1 + dropPercent / 100;
  const critChance = Math.max(0, Math.min(100, BASE_CRIT_CHANCE + critChancePercent));
  const critDamage = Math.max(0, BASE_CRIT_DAMAGE + critDamagePercent);

  return {
    clickDamage, dps, goldMult, dropMult,
    maxHp: hpFlat, armor: armorFlat, weaponElement,
    critChance, critDamage, activeSetBonus,
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
