import { MONSTER_FAMILIES } from './monsters.js';

// Slot definitions: which stat each equipment slot rolls, and how much
// weight it carries relative to the others (weapon is the capstone item).
export const SLOTS = [
  { id: 'weapon', name: 'Arma', emoji: '⚔️', kind: 'attack' },
  { id: 'helmet', name: 'Elmo', emoji: '🪖', kind: 'defense' },
  { id: 'armor', name: 'Armadura', emoji: '🛡️', kind: 'defense' },
  { id: 'pants', name: 'Calça', emoji: '👖', kind: 'defense' },
  { id: 'gloves', name: 'Luvas', emoji: '🧤', kind: 'defense' },
  { id: 'boots', name: 'Botas', emoji: '👢', kind: 'defense' },
];

// Power ratio between one family's items and the next family's (tier+1).
// Reused by the enhancement system below so a fully-enhanced item lands a
// little above the next tier's base item, regardless of family.
export const TIER_GROWTH = 2.15;

function tierBase(tier) {
  return 8 * Math.pow(TIER_GROWTH, tier);
}

// Enhancement: +1..+5 (common material, grindable, "little by little"),
// then a single big "Rank Master" jump gated by that family's Gem. Rank
// Master is defined as a fixed target relative to the tier's base power —
// TIER_GROWTH * MASTER_MARGIN — so it's always just a bit stronger than the
// next family's own +0 item, whatever tier it is.
export const ENHANCE_MAX_LEVEL = 5;
export const ENHANCE_PER_LEVEL_MULT = 1.09;
export const MASTER_MARGIN = 1.03;

export function enhancementMultiplier(level, isMaster) {
  if (isMaster) return TIER_GROWTH * MASTER_MARGIN;
  const clamped = Math.max(0, Math.min(level, ENHANCE_MAX_LEVEL));
  return Math.pow(ENHANCE_PER_LEVEL_MULT, clamped);
}

export function getEnhancedStats(item, level, isMaster) {
  const mult = enhancementMultiplier(level, isMaster);
  const result = {};
  for (const [key, value] of Object.entries(item.stats)) {
    const scaled = value * mult;
    result[key] = key.endsWith('Percent') ? Math.round(scaled * 10) / 10 : Math.round(scaled);
  }
  return result;
}

export function getEnhanceLabel(level, isMaster) {
  return isMaster ? 'Rank Master' : `+${level}`;
}

function buildItem(family, tier, slot) {
  const base = tierBase(tier);
  const id = `${family.id}_${slot.id}`;
  const stats = {};
  let name;
  let emoji;

  switch (slot.id) {
    case 'weapon':
      stats.clickFlat = Math.round(base * 2.6);
      stats.dpsFlat = Math.round(base * 2.6);
      name = family.weapon.name;
      emoji = family.weapon.emoji;
      break;
    case 'helmet':
      stats.dpsPercent = Math.round((5 + tier * 3) * 10) / 10;
      stats.hpFlat = Math.round(base * 5);
      name = `Elmo de ${family.name}`;
      emoji = '🪖';
      break;
    case 'armor':
      stats.clickPercent = Math.round((5 + tier * 3) * 10) / 10;
      stats.armorFlat = Math.round(base * 1.2);
      name = `Armadura de ${family.name}`;
      emoji = '🛡️';
      break;
    case 'pants':
      stats.goldPercent = Math.round((8 + tier * 4) * 10) / 10;
      stats.hpFlat = Math.round(base * 4);
      name = `Calça de ${family.name}`;
      emoji = '👖';
      break;
    case 'gloves':
      stats.clickFlat = Math.round(base * 1.2);
      stats.armorFlat = Math.round(base * 1.2);
      name = `Luvas de ${family.name}`;
      emoji = '🧤';
      break;
    case 'boots':
      stats.dropPercent = Math.round((5 + tier * 2) * 10) / 10;
      stats.hpFlat = Math.round(base * 4);
      name = `Botas de ${family.name}`;
      emoji = '👢';
      break;
    default:
      throw new Error(`Unknown slot ${slot.id}`);
  }

  const goldCost = Math.round(20 * Math.pow(2.3, tier) * (slot.id === 'weapon' ? 3 : 1));
  const commonCost = Math.round((slot.id === 'weapon' ? 20 : slot.id === 'armor' ? 14 : 10) * (1 + tier * 0.4));
  const rareCost = slot.id === 'weapon' ? 3 + tier : 1 + Math.floor(tier / 2);

  // Cost (in the family's common material) to go from level-1 to level,
  // for level = 1..ENHANCE_MAX_LEVEL. Scales off the same commonCost used
  // to craft the item in the first place, growing steeper each level.
  const enhanceCostStep = (i) => Math.max(1, Math.round(commonCost * (0.5 + i * 0.5)));
  const enhanceCost = Array.from({ length: ENHANCE_MAX_LEVEL }, (_, i) => enhanceCostStep(i));

  // Rank Master continues that same progression one step further (as if it
  // were "+6" worth of common material) on top of the Gem requirement.
  const masterMaterialCost = enhanceCostStep(ENHANCE_MAX_LEVEL);

  return {
    id,
    slotId: slot.id,
    familyId: family.id,
    tier,
    name,
    emoji,
    stats,
    goldCost,
    commonMaterialId: family.materials.common.id,
    rareMaterialId: family.materials.rare.id,
    gemMaterialId: family.materials.gem.id,
    enhanceCost,
    masterMaterialCost,
    materialCost: {
      [family.materials.common.id]: commonCost,
      [family.materials.rare.id]: rareCost,
    },
  };
}

export const ITEMS = [];
MONSTER_FAMILIES.forEach((family, tier) => {
  SLOTS.forEach((slot) => {
    ITEMS.push(buildItem(family, tier, slot));
  });
});

export function getItem(itemId) {
  return ITEMS.find((i) => i.id === itemId);
}

export function getItemsForFamily(familyId) {
  return ITEMS.filter((i) => i.familyId === familyId);
}

export function getSlot(slotId) {
  return SLOTS.find((s) => s.id === slotId);
}
