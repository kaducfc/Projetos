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
  return isMaster ? 'M' : `+${level}`;
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
  tempestron: { name: 'Martelo Tempestuoso', emoji: '🔨' },
  gaiatron: { name: 'Machado de 2 Gumes', emoji: '🪓' },
  bahamorth: { name: 'Mace Dracônica', emoji: '🔨' },
};

// Every boss in the current 10-boss roster now has real reference art (see
// idle-hunter/assets/) — reused here under each boss id.
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
  tempestron: {
    weapon: 'assets/tempestron/martelo.png',
    helmet: 'assets/tempestron/helm.png',
    armor: 'assets/tempestron/armor.png',
    pants: 'assets/tempestron/pants.png',
    gloves: 'assets/tempestron/luvas.png',
    boots: 'assets/tempestron/botas.png',
  },
  gaiatron: {
    weapon: 'assets/gaiatron/machado.png',
    helmet: 'assets/gaiatron/helm.png',
    armor: 'assets/gaiatron/armor.png',
    pants: 'assets/gaiatron/pants.png',
    gloves: 'assets/gaiatron/luvas.png',
    boots: 'assets/gaiatron/botas.png',
  },
  bahamorth: {
    weapon: 'assets/bahamorth/mace.png',
    helmet: 'assets/bahamorth/helm.png',
    armor: 'assets/bahamorth/armor.png',
    pants: 'assets/bahamorth/pants.png',
    gloves: 'assets/bahamorth/luvas.png',
    boots: 'assets/bahamorth/botas.png',
  },
};

/// Every piece needs 4 materials: the boss's own 2 ("drop principal" 1/2)
/// plus 2 from that boss's weak-monster band (see
/// getWeakMonsterGroupForStage(boss.stage - 1), 5 weak monsters per band —
/// one per element). Which 2 of the 5 depends on slotIndex (the piece's
/// position in SLOTS), cycling one further along the band for every slot —
/// weapon uses band[0]+band[1], helmet uses band[1]+band[2], and so on
/// wrapping around — so across a full 6-piece set every weak monster in the
/// band gets used by at least one piece, instead of always the same two
/// (previously always Neutro + the boss's own element) leaving the other
/// three permanently unfarmed for that boss's gear.
function buildBossItem(boss, tier, slot, slotIndex, weakGroup) {
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

  const bandSize = weakGroup.monsters.length;
  const weakAt = (offset) => weakGroup.monsters[(slotIndex + offset) % bandSize];
  const weakA = weakAt(0);
  const weakB = weakAt(1);

  const materialCost = {};
  materialCost[boss.materials.primary1.id] = (materialCost[boss.materials.primary1.id] || 0) + bossQty;
  materialCost[boss.materials.primary2.id] = (materialCost[boss.materials.primary2.id] || 0) + bossQty;
  materialCost[weakA.material.id] = (materialCost[weakA.material.id] || 0) + weakQty;
  materialCost[weakB.material.id] = (materialCost[weakB.material.id] || 0) + weakQty;

  // Enhancement (+1..+5, then Rank Master) keeps cycling through the same
  // band, one further along per level — so upgrading one piece all the way
  // to Rank Master also spreads across several weak monsters instead of
  // grinding a single material 6 times over.
  const enhanceCostStep = (i) => Math.max(1, Math.round(weakQty * (0.5 + i * 0.5)));
  const enhanceCost = Array.from({ length: ENHANCE_MAX_LEVEL }, (_, i) => ({
    matId: weakAt(2 + i).material.id,
    qty: enhanceCostStep(i),
  }));
  const masterMaterialCost = {
    matId: weakAt(2 + ENHANCE_MAX_LEVEL).material.id,
    qty: enhanceCostStep(ENHANCE_MAX_LEVEL),
  };

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
    crystalMaterialId: boss.crystal.id,
    enhanceCost,
    masterMaterialCost,
    materialCost,
  };
}

export const ITEMS = [];
BOSSES.forEach((boss, tier) => {
  const weakGroup = getWeakMonsterGroupForStage(boss.stage - 1);
  SLOTS.forEach((slot, slotIndex) => {
    ITEMS.push(buildBossItem(boss, tier, slot, slotIndex, weakGroup));
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
  // Kept as a single material across the whole ladder (unlike the current
  // boss roster's diversified version above) — this is frozen legacy data,
  // only ever read back for a save that already has one of these crafted.
  const enhanceCost = Array.from({ length: ENHANCE_MAX_LEVEL }, (_, i) => ({
    matId: family.materials.common.id,
    qty: enhanceCostStep(i),
  }));
  const masterMaterialCost = { matId: family.materials.common.id, qty: enhanceCostStep(ENHANCE_MAX_LEVEL) };

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

// ---------------------------------------------------------------------
// Set bonus: equipping all 6 slots (weapon + 5 defense pieces) from the
// same boss grants a small extra bump on top of each piece's own stats —
// a little HP, a little armor, and a little crit chance/damage. It scales
// with "the set's level": the LOWEST effective enhancement level among the
// 6 equipped pieces (0-5 for +1..+5, 6 for Rank Master), so upgrading every
// piece together is what pays off, not just one.
// ---------------------------------------------------------------------
export const SET_BONUS_HP_MULT = 3;
export const SET_BONUS_ARMOR_MULT = 0.8;
export const SET_BONUS_CRIT_CHANCE_BASE = 2;
export const SET_BONUS_CRIT_CHANCE_PER_LEVEL = 0.5;
export const SET_BONUS_CRIT_DAMAGE_BASE = 5;
export const SET_BONUS_CRIT_DAMAGE_PER_LEVEL = 2;
export const SET_BONUS_LEVEL_SCALE = 0.15;

export function computeSetBonus(bossId, setLevel) {
  const tier = BOSSES.findIndex((b) => b.id === bossId);
  if (tier < 0) return null;
  const base = tierBase(tier);
  const growth = 1 + setLevel * SET_BONUS_LEVEL_SCALE;
  return {
    hpFlat: Math.round(base * SET_BONUS_HP_MULT * growth),
    armorFlat: Math.round(base * SET_BONUS_ARMOR_MULT * growth),
    critChancePercent: Math.round((SET_BONUS_CRIT_CHANCE_BASE + setLevel * SET_BONUS_CRIT_CHANCE_PER_LEVEL) * 10) / 10,
    critDamagePercent: Math.round((SET_BONUS_CRIT_DAMAGE_BASE + setLevel * SET_BONUS_CRIT_DAMAGE_PER_LEVEL) * 10) / 10,
  };
}

export function getItem(itemId) {
  return ITEMS.find((i) => i.id === itemId) || LEGACY_ITEMS.find((i) => i.id === itemId);
}

export function getItemsForBoss(bossId) {
  return ITEMS.filter((i) => i.bossId === bossId);
}

export function getSlot(slotId) {
  return SLOTS.find((s) => s.id === slotId);
}
