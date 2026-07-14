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

/// currentHp: the caller's current HP in whatever fight this is for (main
/// combat, Torre Infinita — each has its own separate pool, see main.js).
/// Only consulted by HP-conditional card specials (Colhedor Carmesim,
/// Vulkarion, below); null means "unknown/not applicable" and is treated
/// as full HP, which is the safe default for every non-combat caller (UI
/// previews, offline-progress math, achievement checks, etc.) — full HP
/// activates Colhedor Carmesim's bonus and gives Vulkarion's zero, neither
/// of which hands out an undeserved buff.
export function computePlayerStats(state, currentHp = null) {
  let clickFlat = BASE_CLICK_DAMAGE;
  let dpsFlat = BASE_DPS;
  let clickPercent = 0;
  let dpsPercent = 0;
  let goldPercent = 0;
  let dropPercent = 0;
  let hpFlat = BASE_MAX_HP;
  let armorFlat = BASE_ARMOR;
  let hpPercent = 0;
  let armorPercent = 0;
  let critChancePercent = 0;
  let critDamagePercent = 0;
  let weaponElement = DEFAULT_WEAPON_ELEMENT;

  // Tracks each equipped slot's bossId + effective level, so a full-set
  // bonus (see below) can be detected without a second inventory scan.
  const equippedByBoss = {};
  // How many equipped cards carry each special.id — most specials scale
  // their magnitude linearly with this count (see applySpecials below).
  const specialCounts = {};
  let equippedSlotCount = 0;
  let equippedElements = new Set();

  for (const [slotId, uid] of Object.entries(state.equipped)) {
    if (!uid) continue;
    const invEntry = state.inventory.find((i) => i.uid === uid);
    if (!invEntry) continue;

    if (invEntry.cardId) {
      const card = getCard(invEntry.cardId);
      if (card) {
        for (const b of card.bonuses || []) addStat(b.stat, b.value);
        if (card.special) specialCounts[card.special.id] = (specialCounts[card.special.id] || 0) + 1;
      }
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

    equippedSlotCount += 1;
    equippedElements.add(item.element || DEFAULT_WEAPON_ELEMENT);

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
    else if (stat === 'hpPercent') hpPercent += total;
    else if (stat === 'armorPercent') armorPercent += total;
    else if (stat === 'critChancePercent') critChancePercent += total;
    else if (stat === 'critDamagePercent') critDamagePercent += total;
  }

  // maxHp/armor need to be final before HP-conditional specials below can
  // check the player's HP fraction against them.
  const maxHp = Math.round(hpFlat * (1 + hpPercent / 100));
  const armor = Math.round(armorFlat * (1 + armorPercent / 100));
  const hpFraction = currentHp == null ? 1 : Math.max(0, Math.min(1, currentHp / maxHp));

  // Card specials that aren't a plain stat sum — each reads its own count
  // from specialCounts (0 if that card isn't socketed at all) and folds its
  // effect into clickPercent/dpsPercent, or exposes a proc chance/multiplier
  // on the returned stats object for combat.js/main.js to act on directly.
  const colhedorCount = specialCounts.hp_threshold_dps || 0;
  if (colhedorCount > 0 && hpFraction >= 0.8) {
    dpsPercent += 45 * colhedorCount;
  }

  const grommukCount = specialCounts.same_element_set || 0;
  if (grommukCount > 0 && equippedSlotCount === SLOTS.length && equippedElements.size === 1) {
    dpsPercent += 30 * grommukCount;
    clickPercent += 30 * grommukCount;
  }

  const vulkarionCount = specialCounts.low_hp_dps_scale || 0;
  if (vulkarionCount > 0) {
    dpsPercent += (1 - hpFraction) * 60 * vulkarionCount;
  }

  const goldDoubleChance = Math.min(100, 20 * (specialCounts.gold_double_chance || 0));
  const bossReprocChance = Math.min(100, 10 * (specialCounts.boss_kill_reproc || 0));
  const solkaiserCount = specialCounts.click_counter_burst || 0;
  // More copies make the burst land sooner rather than hit harder — see
  // resolveClickHit() in systems/combat.js, which is what actually reads
  // these two.
  const clickBurstEveryN = solkaiserCount > 0 ? Math.max(1, Math.round(50 / solkaiserCount)) : null;
  const clickBurstDamageMult = solkaiserCount > 0 ? 6 : null;

  const clickDamage = clickFlat * (1 + clickPercent / 100);
  const dps = dpsFlat * (1 + dpsPercent / 100);
  const goldMult = 1 + goldPercent / 100;
  const dropMult = 1 + dropPercent / 100;
  const critChance = Math.max(0, Math.min(100, BASE_CRIT_CHANCE + critChancePercent));
  const critDamage = Math.max(0, BASE_CRIT_DAMAGE + critDamagePercent);

  return {
    clickDamage, dps, goldMult, dropMult,
    maxHp, armor, weaponElement,
    critChance, critDamage, activeSetBonus,
    goldDoubleChance, bossReprocChance, clickBurstEveryN, clickBurstDamageMult,
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
