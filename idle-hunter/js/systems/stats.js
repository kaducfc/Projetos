import { getItem, getEnhancedStats } from '../data/items.js';
import { UPGRADES, PRESTIGE_UPGRADES } from '../data/upgrades.js';

const BASE_CLICK_DAMAGE = 5;
const BASE_DPS = 0;
const BASE_MAX_HP = 100;
const BASE_ARMOR = 0;

/// Aggregates equipment + regular upgrades + prestige upgrades into the
/// final combat stats used every frame. Recomputed on demand (cheap enough
/// to call whenever gear/upgrades change, no need to cache).
export function computePlayerStats(state) {
  let clickFlat = BASE_CLICK_DAMAGE;
  let dpsFlat = BASE_DPS;
  let clickPercent = 0;
  let dpsPercent = 0;
  let goldPercent = 0;
  let dropPercent = 0;
  let hpFlat = BASE_MAX_HP;
  let armorFlat = BASE_ARMOR;

  for (const uid of Object.values(state.equipped)) {
    if (!uid) continue;
    const invEntry = state.inventory.find((i) => i.uid === uid);
    if (!invEntry) continue;
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
  }

  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id] || 0;
    if (level <= 0) continue;
    const total = level * upgrade.valuePerLevel;
    addStat(upgrade.stat, total);
  }

  let allDamagePercent = 0;
  let startStageBonus = 0;

  for (const upgrade of PRESTIGE_UPGRADES) {
    const level = state.prestigeUpgrades[upgrade.id] || 0;
    if (level <= 0) continue;
    const total = level * upgrade.valuePerLevel;
    if (upgrade.stat === 'allDamagePercent') allDamagePercent += total;
    else if (upgrade.stat === 'startStage') startStageBonus += total;
    else addStat(upgrade.stat, total);
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

  const damageMult = 1 + allDamagePercent / 100;
  const clickDamage = clickFlat * (1 + clickPercent / 100) * damageMult;
  const dps = dpsFlat * (1 + dpsPercent / 100) * damageMult;
  const goldMult = 1 + goldPercent / 100;
  const dropMult = 1 + dropPercent / 100;

  return { clickDamage, dps, goldMult, dropMult, startStageBonus, maxHp: hpFlat, armor: armorFlat };
}
