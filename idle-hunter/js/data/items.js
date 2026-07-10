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

function tierBase(tier) {
  return 8 * Math.pow(2.15, tier);
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
      name = `Elmo de ${family.name}`;
      emoji = '🪖';
      break;
    case 'armor':
      stats.clickPercent = Math.round((5 + tier * 3) * 10) / 10;
      name = `Armadura de ${family.name}`;
      emoji = '🛡️';
      break;
    case 'pants':
      stats.goldPercent = Math.round((8 + tier * 4) * 10) / 10;
      name = `Calça de ${family.name}`;
      emoji = '👖';
      break;
    case 'gloves':
      stats.clickFlat = Math.round(base * 1.2);
      name = `Luvas de ${family.name}`;
      emoji = '🧤';
      break;
    case 'boots':
      stats.dropPercent = Math.round((5 + tier * 2) * 10) / 10;
      name = `Botas de ${family.name}`;
      emoji = '👢';
      break;
    default:
      throw new Error(`Unknown slot ${slot.id}`);
  }

  const goldCost = Math.round(20 * Math.pow(2.3, tier) * (slot.id === 'weapon' ? 3 : 1));
  const commonCost = Math.round((slot.id === 'weapon' ? 20 : slot.id === 'armor' ? 14 : 10) * (1 + tier * 0.4));
  const rareCost = slot.id === 'weapon' ? 3 + tier : 1 + Math.floor(tier / 2);

  return {
    id,
    slotId: slot.id,
    familyId: family.id,
    tier,
    name,
    emoji,
    stats,
    goldCost,
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
