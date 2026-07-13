import { MONSTER_FAMILIES, BOSSES, getWeakMonsterGroupForStage } from './monsters.js';

// Slot definitions: which stat each equipment slot rolls, and how much
// weight it carries relative to the others (weapon is the capstone item).
export const SLOTS = [
  { id: 'weapon', name: 'Arma', emoji: '⚔️', kind: 'attack' },
  { id: 'helmet', name: 'Elmo', emoji: '🪖', kind: 'defense' },
  { id: 'armor', name: 'Peitoral', emoji: '🛡️', kind: 'defense' },
  { id: 'pants', name: 'Calça', emoji: '👖', kind: 'defense' },
  { id: 'gloves', name: 'Luvas', emoji: '🧤', kind: 'defense' },
  { id: 'boots', name: 'Botas', emoji: '👢', kind: 'defense' },
];

// Power ratio between one boss's items and the next boss's (tier+1).
// Reused by the enhancement system below so a fully-enhanced item lands a
// little above the next tier's base item, regardless of boss.
export const TIER_GROWTH = 2.15;

function tierBase(tier) {
  return 8 * Math.pow(TIER_GROWTH, tier);
}

// Enhancement: +1..+5 (grindable material, "little by little"), then a
// single big "Rank Master" jump gated by that boss's Crystal. Rank Master is
// defined as a fixed target relative to the tier's base power —
// TIER_GROWTH * MASTER_MARGIN — so it's always just a bit stronger than the
// next boss's own +0 item, whatever tier it is.
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

// ---------------------------------------------------------------------
// Live crafting roster: one 6-piece set per boss (see data/monsters.js).
// Only the boss's own weapon gets a flavor name; armor pieces follow the
// same "<Slot> de <Boss>" pattern the old family system used.
// ---------------------------------------------------------------------

const BOSS_WEAPONS = {
  chispim: { name: 'Dual Blade de Chispim', emoji: '⚔️' },
  solkaiser: { name: 'Arco Flamejante de Solkaiser', emoji: '🏹' },
  tartarok: { name: 'Espada e Escudo de Tartarok', emoji: '🗡️' },
  colhedor_carmesim: { name: 'Foice Carmesim', emoji: '🔪' },
  grommuk: { name: 'Macétula Tribal', emoji: '🪓' },
  vulkarion: { name: 'Espada Grande', emoji: '🗡️' },
  leviargon: { name: 'Chicote Gigante', emoji: '🔱' },
  tempestron: { name: 'Cetro da Tempestade', emoji: '⚡' },
  gaiatron: { name: 'Cajado Ancestral', emoji: '🌿' },
  bahamorth: { name: 'Espada Dracônica', emoji: '⚔️' },
};

// Chispim, Solkaiser, Tartarok, Colhedor Carmesim, Grommuk, Vulkarion and
// Leviargon have real reference art so far (see idle-hunter/assets/) — reused
// here under each boss id. Every other boss falls back to emoji, same as before.
const BOSS_EQUIP_IMAGES = {
  chispim: {
    weapon: 'assets/chispim/dualblade.png',
    helmet: 'assets/chispim/helm.png',
    armor: 'assets/chispim/armor.png',
    pants: 'assets/chispim/pants.png',
    gloves: 'assets/chispim/luvas.png',
    boots: 'assets/chispim/botas.png',
  },
  solkaiser: {
    weapon: 'assets/solkaiser/arco.png',
    helmet: 'assets/solkaiser/helm.png',
    armor: 'assets/solkaiser/armor.png',
    pants: 'assets/solkaiser/pants.png',
    gloves: 'assets/solkaiser/luvas.png',
    boots: 'assets/solkaiser/botas.png',
  },
  tartarok: {
    weapon: 'assets/tartarok/espada.png',
    helmet: 'assets/tartarok/helm.png',
    armor: 'assets/tartarok/armor.png',
    pants: 'assets/tartarok/pants.png',
    gloves: 'assets/tartarok/luvas.png',
    boots: 'assets/tartarok/botas.png',
  },
  colhedor_carmesim: {
    weapon: 'assets/colhedor_carmesim/foice.png',
    helmet: 'assets/colhedor_carmesim/helm.png',
    armor: 'assets/colhedor_carmesim/armor.png',
    pants: 'assets/colhedor_carmesim/pants.png',
    gloves: 'assets/colhedor_carmesim/luvas.png',
    boots: 'assets/colhedor_carmesim/botas.png',
  },
  grommuk: {
    weapon: 'assets/grommuk/macetula.png',
    helmet: 'assets/grommuk/helm.png',
    armor: 'assets/grommuk/armor.png',
    pants: 'assets/grommuk/pants.png',
    gloves: 'assets/grommuk/luvas.png',
    boots: 'assets/grommuk/botas.png',
  },
  vulkarion: {
    weapon: 'assets/vulkarion/espada.png',
    helmet: 'assets/vulkarion/helm.png',
    armor: 'assets/vulkarion/armor.png',
    pants: 'assets/vulkarion/pants.png',
    gloves: 'assets/vulkarion/luvas.png',
    boots: 'assets/vulkarion/botas.png',
  },
  leviargon: {
    weapon: 'assets/leviargon/chicote.png',
    helmet: 'assets/leviargon/helm.png',
    armor: 'assets/leviargon/armor.png',
    pants: 'assets/leviargon/pants.png',
    gloves: 'assets/leviargon/luvas.png',
    boots: 'assets/leviargon/botas.png',
  },
};

/// A boss set needs 4 materials on average: the boss's own 2 ("drop
/// principal" 1/2) plus 2 from weak monsters — the Neutro one and the one
/// matching the boss's own element — both from the weak-monster band that
/// leads up to that boss (see getWeakMonsterGroupForStage(boss.stage - 1)).
/// A Neutro boss (Grommuk, Bahamorth) collapses to 3 distinct materials:
/// its "element match" IS the Neutro weak monster, so the two entries land
/// on the same material id and just sum into one bigger requirement.
function buildBossItem(boss, tier, slot, neutralWeak, elementalWeak) {
  const base = tierBase(tier);
  const id = `${boss.id}_${slot.id}`;
  const stats = {};
  let name;
  let emoji;

  switch (slot.id) {
    case 'weapon':
      stats.clickFlat = Math.round(base * 2.6);
      stats.dpsFlat = Math.round(base * 2.6);
      name = BOSS_WEAPONS[boss.id].name;
      emoji = BOSS_WEAPONS[boss.id].emoji;
      break;
    case 'helmet':
      stats.dpsPercent = Math.round((5 + tier * 3) * 10) / 10;
      stats.hpFlat = Math.round(base * 5);
      name = `Elmo de ${boss.name}`;
      emoji = '🪖';
      break;
    case 'armor':
      stats.clickPercent = Math.round((5 + tier * 3) * 10) / 10;
      stats.armorFlat = Math.round(base * 1.2);
      name = `Peitoral de ${boss.name}`;
      emoji = '🛡️';
      break;
    case 'pants':
      stats.goldPercent = Math.round((8 + tier * 4) * 10) / 10;
      stats.hpFlat = Math.round(base * 4);
      name = `Calça de ${boss.name}`;
      emoji = '👖';
      break;
    case 'gloves':
      stats.clickFlat = Math.round(base * 1.2);
      stats.armorFlat = Math.round(base * 1.2);
      name = `Luvas de ${boss.name}`;
      emoji = '🧤';
      break;
    case 'boots':
      stats.dropPercent = Math.round((5 + tier * 2) * 10) / 10;
      stats.hpFlat = Math.round(base * 4);
      name = `Botas de ${boss.name}`;
      emoji = '👢';
      break;
    default:
      throw new Error(`Unknown slot ${slot.id}`);
  }

  const goldCost = Math.round(20 * Math.pow(2.3, tier) * (slot.id === 'weapon' ? 3 : 1));

  // Boss materials are the scarcer half of the recipe (that decade's boss
  // fight is only 1 stage in 10) — smaller quantity. Weak-monster materials
  // are farmable on 9 stages out of 10 — larger quantity. Both still use
  // the same base per-slot weighting as the old common/rare split did.
  const bossQty = slot.id === 'weapon' ? 3 + tier : 1 + Math.floor(tier / 2);
  const weakQty = Math.round((slot.id === 'weapon' ? 20 : slot.id === 'armor' ? 14 : 10) * (1 + tier * 0.4));

  const materialCost = {};
  materialCost[boss.materials.primary1.id] = (materialCost[boss.materials.primary1.id] || 0) + bossQty;
  materialCost[boss.materials.primary2.id] = (materialCost[boss.materials.primary2.id] || 0) + bossQty;
  materialCost[neutralWeak.material.id] = (materialCost[neutralWeak.material.id] || 0) + weakQty;
  materialCost[elementalWeak.material.id] = (materialCost[elementalWeak.material.id] || 0) + weakQty;

  // Enhancement (+1..+5) grinds the Neutro weak material — the one
  // guaranteed-plentiful material in the recipe, same role the old
  // family's "common" material played. Rank Master needs the boss's
  // Crystal (see crystalMaterialId) instead of more of this.
  const enhanceCostStep = (i) => Math.max(1, Math.round(weakQty * (0.5 + i * 0.5)));
  const enhanceCost = Array.from({ length: ENHANCE_MAX_LEVEL }, (_, i) => enhanceCostStep(i));
  const masterMaterialCost = enhanceCostStep(ENHANCE_MAX_LEVEL);

  return {
    id,
    slotId: slot.id,
    bossId: boss.id,
    unlockStage: boss.stage,
    tier,
    name,
    emoji,
    image: BOSS_EQUIP_IMAGES[boss.id] ? BOSS_EQUIP_IMAGES[boss.id][slot.id] || null : null,
    element: boss.element,
    stats,
    goldCost,
    commonMaterialId: neutralWeak.material.id,
    crystalMaterialId: boss.crystal.id,
    enhanceCost,
    masterMaterialCost,
    materialCost,
  };
}

export const ITEMS = [];
BOSSES.forEach((boss, tier) => {
  const weakGroup = getWeakMonsterGroupForStage(boss.stage - 1);
  const neutralWeak = weakGroup.monsters.find((m) => m.element === 'neutro');
  const elementalWeak = weakGroup.monsters.find((m) => m.element === boss.element) || neutralWeak;
  SLOTS.forEach((slot) => {
    ITEMS.push(buildBossItem(boss, tier, slot, neutralWeak, elementalWeak));
  });
});

// ---------------------------------------------------------------------
// Legacy items: the original 6-family roster, kept ONLY so a save from
// before the boss-roster rebuild can still resolve/display/equip whatever
// it already crafted (getItem() below checks both). Not offered for new
// crafting — the Forge tab only iterates the live BOSSES roster above.
// ---------------------------------------------------------------------

function buildLegacyItem(family, tier, slot) {
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
      name = `Peitoral de ${family.name}`;
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
  const enhanceCostStep = (i) => Math.max(1, Math.round(commonCost * (0.5 + i * 0.5)));
  const enhanceCost = Array.from({ length: ENHANCE_MAX_LEVEL }, (_, i) => enhanceCostStep(i));
  const masterMaterialCost = enhanceCostStep(ENHANCE_MAX_LEVEL);

  return {
    id,
    slotId: slot.id,
    bossId: null,
    legacyFamilyId: family.id,
    unlockStage: null, // no longer offered for crafting, so never "locked" either
    tier,
    name,
    emoji,
    image: family.images ? family.images[slot.id] || null : null,
    element: family.element,
    stats,
    goldCost,
    commonMaterialId: family.materials.common.id,
    crystalMaterialId: family.materials.gem.id,
    enhanceCost,
    masterMaterialCost,
    materialCost: {
      [family.materials.common.id]: commonCost,
      [family.materials.rare.id]: rareCost,
    },
  };
}

const LEGACY_ITEMS = [];
MONSTER_FAMILIES.forEach((family, tier) => {
  SLOTS.forEach((slot) => {
    LEGACY_ITEMS.push(buildLegacyItem(family, tier, slot));
  });
});

export function getItem(itemId) {
  return ITEMS.find((i) => i.id === itemId) || LEGACY_ITEMS.find((i) => i.id === itemId);
}

export function getItemsForBoss(bossId) {
  return ITEMS.filter((i) => i.bossId === bossId);
}

export function getSlot(slotId) {
  return SLOTS.find((s) => s.id === slotId);
}
