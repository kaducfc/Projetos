import { BOSSES, getWeakMonsterGroupForStage } from './monsters.js';

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

// Power ratio between one zone's items and the next zone's (tier+1). Reused
// by the enhancement system below so a fully-enhanced item lands a little
// above the next tier's base item, regardless of zone.
export const TIER_GROWTH = 2.15;

function tierBase(tier) {
  return 8 * Math.pow(TIER_GROWTH, tier);
}

// Enhancement: +1..+5 (grindable material, "little by little"), then a
// single big "Rank Master" jump gated by that zone's Crystal. Rank Master is
// defined as a fixed target relative to the tier's base power —
// TIER_GROWTH * MASTER_MARGIN — so it's always just a bit stronger than the
// next zone's own +0 item, whatever tier it is.
export const ENHANCE_MAX_LEVEL = 5;
export const ENHANCE_PER_LEVEL_MULT = 1.09;
export const MASTER_MARGIN = 1.03;

export function enhancementMultiplier(level, isMaster) {
  if (isMaster) return TIER_GROWTH * MASTER_MARGIN;
  const clamped = Math.max(0, Math.min(level, ENHANCE_MAX_LEVEL));
  return Math.pow(ENHANCE_PER_LEVEL_MULT, clamped);
}

/// Applies this instance's enhance level/Master on top of its own rolled
/// baseStats (see rollDroppedItem below), then adds its rolled
/// additionalStats flat (additionals are rolled once at drop time and don't
/// scale further with enhance — keeps the enhance power budget close to
/// what it was pre-rarity). invEntry is the inventory entry itself, not the
/// static item template — every dropped instance rolls its own baseStats/
/// additionalStats, so two drops of the same itemId can differ.
export function getEnhancedStats(invEntry) {
  const mult = enhancementMultiplier(invEntry.enhanceLevel || 0, !!invEntry.isMaster);
  const result = {};
  for (const [key, value] of Object.entries(invEntry.baseStats || {})) {
    const scaled = value * mult;
    result[key] = key.endsWith('Percent') ? Math.round(scaled * 10) / 10 : Math.round(scaled);
  }
  for (const add of invEntry.additionalStats || []) {
    result[add.stat] = (result[add.stat] || 0) + add.value;
  }
  return result;
}

export function getEnhanceLabel(level, isMaster) {
  return isMaster ? 'M' : `+${level}`;
}

// ---------------------------------------------------------------------
// Raridade: cada tier acima de Comum ganha bônus "adicionais" extras (rolados
// do ADDITIONAL_STAT_POOL abaixo), além de atributos base mais fortes
// (rarity.mult) e uma pequena variação aleatória por drop. Valores de
// partida — fáceis de re-tunar depois.
// ---------------------------------------------------------------------
export const RARITIES = [
  { id: 'comum', name: 'Comum', mult: 1.0, additionals: 0, weight: 60, color: '#9e9e9e' },
  { id: 'incomum', name: 'Incomum', mult: 1.15, additionals: 1, weight: 24, color: '#4caf50' },
  { id: 'raro', name: 'Raro', mult: 1.35, additionals: 2, weight: 10, color: '#2196f3' },
  { id: 'epico', name: 'Épico', mult: 1.6, additionals: 3, weight: 4, color: '#9c27b0' },
  { id: 'lendario', name: 'Lendário', mult: 2.0, additionals: 4, weight: 1.5, color: '#ffd700' },
  { id: 'mitico', name: 'Mítico', mult: 2.5, additionals: 5, weight: 0.5, color: '#f44336' },
];

export function getRarity(rarityId) {
  return RARITIES.find((r) => r.id === rarityId) || RARITIES[0];
}

function pickRarity() {
  const totalWeight = RARITIES.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const rarity of RARITIES) {
    roll -= rarity.weight;
    if (roll <= 0) return rarity;
  }
  return RARITIES[0];
}

// Pool de bônus "adicionais" — cada raridade acima de Comum rola N destes
// (com repetição possível), magnitude cresce um pouco por tier.
const ADDITIONAL_STAT_POOL = [
  'critChancePercent', 'critDamagePercent', 'hpPercent', 'armorPercent',
  'goldPercent', 'dropPercent', 'attackSpeedPercent', 'dpsPercent',
];

function rollAdditionalStat(tier) {
  const stat = ADDITIONAL_STAT_POOL[Math.floor(Math.random() * ADDITIONAL_STAT_POOL.length)];
  const value = Math.round((2 + Math.random() * 4) * (1 + tier * 0.12) * 10) / 10;
  return { stat, value };
}

// ---------------------------------------------------------------------
// Catálogo de itens: um set de 6 peças por zona (mesmo boss/tier de antes),
// usado como TEMPLATE — o slot/nome/emoji/imagem/elemento e a base "pré-
// raridade" de cada stat vêm daqui, mas cada drop rola sua própria instância
// (ver rollDroppedItem), então dois drops do mesmo itemId podem ter
// baseStats/raridade/additionalStats diferentes.
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

const BOSS_EQUIP_IMAGES = {
  chispim: {
    weapon: 'assets/chispim/dualblade.png', helmet: 'assets/chispim/helm.png', armor: 'assets/chispim/armor.png',
    pants: 'assets/chispim/pants.png', gloves: 'assets/chispim/luvas.png', boots: 'assets/chispim/botas.png',
  },
  solkaiser: {
    weapon: 'assets/solkaiser/arco.png', helmet: 'assets/solkaiser/helm.png', armor: 'assets/solkaiser/armor.png',
    pants: 'assets/solkaiser/pants.png', gloves: 'assets/solkaiser/luvas.png', boots: 'assets/solkaiser/botas.png',
  },
  tartarok: {
    weapon: 'assets/tartarok/espada.png', helmet: 'assets/tartarok/helm.png', armor: 'assets/tartarok/armor.png',
    pants: 'assets/tartarok/pants.png', gloves: 'assets/tartarok/luvas.png', boots: 'assets/tartarok/botas.png',
  },
  colhedor_carmesim: {
    weapon: 'assets/colhedor_carmesim/foice.png', helmet: 'assets/colhedor_carmesim/helm.png', armor: 'assets/colhedor_carmesim/armor.png',
    pants: 'assets/colhedor_carmesim/pants.png', gloves: 'assets/colhedor_carmesim/luvas.png', boots: 'assets/colhedor_carmesim/botas.png',
  },
  grommuk: {
    weapon: 'assets/grommuk/macetula.png', helmet: 'assets/grommuk/helm.png', armor: 'assets/grommuk/armor.png',
    pants: 'assets/grommuk/pants.png', gloves: 'assets/grommuk/luvas.png', boots: 'assets/grommuk/botas.png',
  },
  vulkarion: {
    weapon: 'assets/vulkarion/espada.png', helmet: 'assets/vulkarion/helm.png', armor: 'assets/vulkarion/armor.png',
    pants: 'assets/vulkarion/pants.png', gloves: 'assets/vulkarion/luvas.png', boots: 'assets/vulkarion/botas.png',
  },
  leviargon: {
    weapon: 'assets/leviargon/chicote.png', helmet: 'assets/leviargon/helm.png', armor: 'assets/leviargon/armor.png',
    pants: 'assets/leviargon/pants.png', gloves: 'assets/leviargon/luvas.png', boots: 'assets/leviargon/botas.png',
  },
  tempestron: {
    weapon: 'assets/tempestron/martelo.png', helmet: 'assets/tempestron/helm.png', armor: 'assets/tempestron/armor.png',
    pants: 'assets/tempestron/pants.png', gloves: 'assets/tempestron/luvas.png', boots: 'assets/tempestron/botas.png',
  },
  gaiatron: {
    weapon: 'assets/gaiatron/machado.png', helmet: 'assets/gaiatron/helm.png', armor: 'assets/gaiatron/armor.png',
    pants: 'assets/gaiatron/pants.png', gloves: 'assets/gaiatron/luvas.png', boots: 'assets/gaiatron/botas.png',
  },
  bahamorth: {
    weapon: 'assets/bahamorth/mace.png', helmet: 'assets/bahamorth/helm.png', armor: 'assets/bahamorth/armor.png',
    pants: 'assets/bahamorth/pants.png', gloves: 'assets/bahamorth/luvas.png', boots: 'assets/bahamorth/botas.png',
  },
};

/// Custo de enhance (+1..+5, depois Rank Master) continua vindo de
/// state.materials — agora dropados diretamente pelos monstros da zona (ver
/// combat.js rollDrops), sem receita de craft por trás. Cicla pelos 5
/// monstros fracos da zona, um mais adiante por nível, igual antes.
function buildEnhanceCosts(boss, slotIndex, weakGroup) {
  const bandSize = weakGroup.monsters.length;
  const weakAt = (offset) => weakGroup.monsters[(slotIndex + offset) % bandSize];
  const baseQty = 10;
  const enhanceCostStep = (i) => Math.max(1, Math.round(baseQty * (0.5 + i * 0.5)));
  const enhanceCost = Array.from({ length: ENHANCE_MAX_LEVEL }, (_, i) => ({
    matId: weakAt(2 + i).material.id,
    qty: enhanceCostStep(i),
  }));
  const masterMaterialCost = {
    matId: weakAt(2 + ENHANCE_MAX_LEVEL).material.id,
    qty: enhanceCostStep(ENHANCE_MAX_LEVEL),
  };
  return { enhanceCost, masterMaterialCost };
}

function buildBossItem(boss, tier, slot, slotIndex, weakGroup) {
  const base = tierBase(tier);
  const id = `${boss.id}_${slot.id}`;
  const stats = {};
  let name;
  let emoji;

  switch (slot.id) {
    case 'weapon':
      stats.dpsFlat = Math.round(base * 2.6);
      stats.attackSpeedPercent = Math.round((5 + tier * 2) * 10) / 10;
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
      stats.critChancePercent = Math.round((3 + tier * 1.5) * 10) / 10;
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
      stats.critDamagePercent = Math.round((5 + tier * 2.5) * 10) / 10;
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

  const { enhanceCost, masterMaterialCost } = buildEnhanceCosts(boss, slotIndex, weakGroup);

  return {
    id,
    slotId: slot.id,
    bossId: boss.id,
    tier,
    name,
    emoji,
    image: BOSS_EQUIP_IMAGES[boss.id] ? BOSS_EQUIP_IMAGES[boss.id][slot.id] || null : null,
    element: boss.element,
    stats,
    crystalMaterialId: boss.crystal.id,
    enhanceCost,
    masterMaterialCost,
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
// Bônus de set: equipar as 6 peças (arma + 5 defesa) da mesma zona/tier
// concede um pequeno extra por cima de cada peça — um pouco de HP, um pouco
// de armadura, e um pouco de chance/dano crítico. Escala com "o nível do
// set": o MENOR nível efetivo de enhance entre as 6 peças equipadas (0-5
// pra +1..+5, 6 pra Rank Master) — upar todas as peças juntas é o que
// compensa, não só uma.
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
  return ITEMS.find((i) => i.id === itemId) || null;
}

export function getItemsForBoss(bossId) {
  return ITEMS.filter((i) => i.bossId === bossId);
}

export function getSlot(slotId) {
  return SLOTS.find((s) => s.id === slotId);
}

/// Rola uma instância de item dropada por um monstro da zona `zoneIndex`
/// (0-based), no slot `slotId` — chamada por combat.js quando um kill rola
/// um drop de equipamento. Não craft, não custo: o item já nasce pronto pra
/// entrar no inventário (ensureCardIds/enhanceLevel/isMaster iguais a um
/// item novo). Cada chamada rola raridade + variação independente, então
/// dois drops do mesmo slot/zona quase nunca saem idênticos.
export function rollDroppedItem(zoneIndex, slotId) {
  const boss = BOSSES[zoneIndex] || BOSSES[BOSSES.length - 1];
  const item = getItem(`${boss.id}_${slotId}`);
  if (!item) return null;

  const rarity = pickRarity();
  const variance = () => 0.9 + Math.random() * 0.2; // ±10%
  const baseStats = {};
  for (const [key, value] of Object.entries(item.stats)) {
    const scaled = value * rarity.mult * variance();
    baseStats[key] = key.endsWith('Percent') ? Math.round(scaled * 10) / 10 : Math.round(scaled);
  }
  const additionalStats = Array.from({ length: rarity.additionals }, () => rollAdditionalStat(zoneIndex));

  return {
    itemId: item.id,
    rarityId: rarity.id,
    baseStats,
    additionalStats,
    enhanceLevel: 0,
    isMaster: false,
    cardIds: [null],
  };
}
