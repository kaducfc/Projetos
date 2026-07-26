import { BOSSES, getWeakMonsterGroupForStage } from './monsters.js';

// 10 slots físicos, 9 categorias de drop — anel ocupa 2 slots mas é uma
// categoria só (mesmo item pode ser equipado nos dois, ver
// getSlotIdsForCategory abaixo). "kind" só importa pra resistência elemental
// (armor) e pro texto do popup de detalhe (attack vs. accessory).
export const SLOTS = [
  { id: 'weapon1', name: 'Arma Primária', emoji: '⚔️', kind: 'attack', category: 'weapon1' },
  { id: 'weapon2', name: 'Arma Secundária', emoji: '🗡️', kind: 'attack', category: 'weapon2' },
  { id: 'head', name: 'Cabeça', emoji: '🪖', kind: 'armor', category: 'head' },
  { id: 'chest', name: 'Peito', emoji: '🛡️', kind: 'armor', category: 'chest' },
  { id: 'legs', name: 'Calça', emoji: '👖', kind: 'armor', category: 'legs' },
  { id: 'hands', name: 'Mãos', emoji: '🧤', kind: 'armor', category: 'hands' },
  { id: 'boots', name: 'Botas', emoji: '👢', kind: 'armor', category: 'boots' },
  { id: 'ring1', name: 'Anel 1', emoji: '💍', kind: 'accessory', category: 'ring' },
  { id: 'ring2', name: 'Anel 2', emoji: '💍', kind: 'accessory', category: 'ring' },
  { id: 'necklace', name: 'Colar', emoji: '📿', kind: 'accessory', category: 'necklace' },
];

// As 9 categorias de drop (ring conta uma vez só — "só vai dropar um anel de
// cada atributo, podendo ser repetido" — ver combat.js, que sorteia desta
// lista, não de SLOTS, pra não dobrar a chance de anel).
export const DROP_CATEGORIES = ['weapon1', 'weapon2', 'head', 'chest', 'legs', 'hands', 'boots', 'ring', 'necklace'];

/// Pra categorias normais, o único slot físico é a própria categoria; pra
/// anel, os dois slots (equipItem em systems/equipment.js resolve qual deles
/// recebe o item — ver comentário lá).
export function getSlotIdsForCategory(category) {
  return category === 'ring' ? ['ring1', 'ring2'] : [category];
}

export function getSlot(slotId) {
  return SLOTS.find((s) => s.id === slotId);
}

/// Rótulo de exibição pra uma CATEGORIA (não um slot físico) — usado no
/// popup de detalhe do item, que não sabe (nem precisa saber) se um anel
/// está no ring1 ou ring2. Anel usa um nome genérico ("Anel") em vez de
/// "Anel 1"/"Anel 2", já que o item em si não pertence a nenhum dos dois
/// especificamente.
export function getCategoryLabel(category) {
  if (category === 'ring') {
    const ringSlot = getSlot('ring1');
    return { name: 'Anel', emoji: ringSlot.emoji, kind: ringSlot.kind };
  }
  const slot = getSlot(category);
  return slot ? { name: slot.name, emoji: slot.emoji, kind: slot.kind } : null;
}

// ---------------------------------------------------------------------
// Atributos: Força/Destreza/Inteligência são stats de personagem de verdade
// agora (ver systems/stats.js) — cada um dos 9 moldes de item por zona dropa
// em 3 variantes, uma por atributo, sorteada uniforme e independente da
// raridade. Pra armadura (head/chest/legs/hands/boots) o atributo também
// aparece como "categoria de peso" (pesada/leve/mágica) — é só um rótulo,
// não um campo à parte (ver armorCategoryLabel abaixo).
// ---------------------------------------------------------------------
export const ATTRIBUTES = [
  { id: 'forca', name: 'Força', armorLabel: 'Pesada', color: '#c0392b' },
  { id: 'destreza', name: 'Destreza', armorLabel: 'Leve', color: '#27ae60' },
  { id: 'inteligencia', name: 'Inteligência', armorLabel: 'Mágica', color: '#2980b9' },
];

// O tipo de dano do jogador é 1 dos 3, decidido pelo atributo da ARMA
// PRIMÁRIA equipada (weapon1) — só os pontos desse tipo específico (ver
// attributeBaseStats abaixo: danoFisicoFlat/danoPerfuracaoFlat/
// danoMagicoFlat) viram DPS de verdade; os outros dois continuam dando
// vida/armadura/crítico/ouro/drop normalmente, só não contam como dano.
export const DAMAGE_TYPES = [
  { id: 'fisico', name: 'Físico', emoji: '🗡️' },
  { id: 'perfuracao', name: 'Perfuração', emoji: '🏹' },
  { id: 'magico', name: 'Mágico', emoji: '🔮' },
];

const DAMAGE_TYPE_BY_ATTRIBUTE = { forca: 'fisico', destreza: 'perfuracao', inteligencia: 'magico' };

export function getDamageTypeForAttribute(attributeId) {
  return DAMAGE_TYPE_BY_ATTRIBUTE[attributeId] || 'fisico';
}

export function getDamageType(damageTypeId) {
  return DAMAGE_TYPES.find((d) => d.id === damageTypeId) || DAMAGE_TYPES[0];
}

export function getAttribute(attributeId) {
  return ATTRIBUTES.find((a) => a.id === attributeId) || ATTRIBUTES[0];
}

export function armorCategoryLabel(attributeId) {
  return getAttribute(attributeId).armorLabel;
}

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
/// additionalStats flat (additionals are rolled once at drop time — or at
/// Ascensão, ver ascendItem em systems/crafting.js — and don't scale further
/// with enhance). invEntry is the inventory entry itself, not a static
/// template — every dropped instance rolls its own baseStats/
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
// Catálogo de itens: 9 moldes por zona (um por categoria), cada um em 3
// variantes de atributo — 270 combinações no total (10 zonas × 9 × 3).
// Nomes/emoji são gerados por template (sem arte nova ainda; cai no emoji
// via iconMarkup quando não há `image`). Cada molde é um TEMPLATE — a base
// "pré-raridade" de cada stat vem daqui, mas cada drop rola sua própria
// instância (ver rollDroppedItem), então dois drops do mesmo itemId podem
// ter baseStats/raridade/additionalStats diferentes.
// ---------------------------------------------------------------------

// Peso relativo de cada categoria na magnitude do atributo principal — arma
// primária bate mais forte, acessórios são mais discretos, o resto fica no
// meio. Fácil de re-tunar depois.
const CATEGORY_POWER = {
  weapon1: 1.0,
  weapon2: 0.8,
  head: 0.7,
  chest: 0.9,
  legs: 0.7,
  hands: 0.6,
  boots: 0.6,
  ring: 0.4,
  necklace: 0.4,
};

// Arquétipos de arma por atributo — evita precisar de 60 nomes de arma
// escritos à mão (10 zonas × 2 slots × 3 atributos).
const WEAPON_ARCHETYPES = {
  weapon1: {
    forca: { name: 'Machado', emoji: '🪓' },
    destreza: { name: 'Adagas', emoji: '🗡️' },
    inteligencia: { name: 'Cajado', emoji: '🔮' },
  },
  weapon2: {
    forca: { name: 'Escudo', emoji: '🛡️' },
    destreza: { name: 'Adaga', emoji: '🗡️' },
    inteligencia: { name: 'Grimório', emoji: '📖' },
  },
};

const CATEGORY_LABELS = {
  head: { name: 'Cabeça', emoji: '🪖' },
  chest: { name: 'Peito', emoji: '🛡️' },
  legs: { name: 'Calça', emoji: '👖' },
  hands: { name: 'Mãos', emoji: '🧤' },
  boots: { name: 'Botas', emoji: '👢' },
  ring: { name: 'Anel', emoji: '💍' },
  necklace: { name: 'Colar', emoji: '📿' },
};

/// Pontos de atributo → 2 stats finais fixos por atributo (ver
/// systems/stats.js pra como isso se converte em vida/armadura/dps/
/// velocidade/crítico no final). tier é o zoneIndex (0-based); categoryPower
/// escala a magnitude por categoria (arma bate mais que colar, etc).
function attributeBaseStats(attributeId, tier, categoryPower) {
  const base = tierBase(tier);
  switch (attributeId) {
    case 'forca':
      return {
        danoFisicoFlat: Math.round(base * 2.6 * categoryPower),
        hpFlat: Math.round(base * 3 * categoryPower),
        armorFlat: Math.round(base * 0.8 * categoryPower),
      };
    case 'destreza':
      return {
        danoPerfuracaoFlat: Math.round(base * 2.6 * categoryPower),
        critChancePercent: Math.round((3 + tier * 1.5) * categoryPower * 10) / 10,
        critDamagePercent: Math.round((5 + tier * 2.5) * categoryPower * 10) / 10,
      };
    case 'inteligencia':
      return {
        danoMagicoFlat: Math.round(base * 2.6 * categoryPower),
        goldPercent: Math.round((8 + tier * 4) * categoryPower * 10) / 10,
        dropPercent: Math.round((5 + tier * 2) * categoryPower * 10) / 10,
      };
    default:
      throw new Error(`Unknown attribute ${attributeId}`);
  }
}

/// Custo de enhance (+1..+5, depois Rank Master) continua vindo de
/// state.materials — agora dropados diretamente pelos monstros da zona (ver
/// combat.js rollDrops), sem receita de craft por trás. Cicla pelos 5
/// monstros fracos da zona, um mais adiante por categoria, igual antes.
function buildEnhanceCosts(categoryIndex, weakGroup) {
  const bandSize = weakGroup.monsters.length;
  const weakAt = (offset) => weakGroup.monsters[(categoryIndex + offset) % bandSize];
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

function buildItemTemplate(boss, tier, category, attributeId, categoryIndex, weakGroup) {
  const power = CATEGORY_POWER[category];
  const stats = attributeBaseStats(attributeId, tier, power);
  const attr = getAttribute(attributeId);
  let name;
  let emoji;

  if (category === 'weapon1' || category === 'weapon2') {
    const archetype = WEAPON_ARCHETYPES[category][attributeId];
    name = `${archetype.name} de ${boss.name}`;
    emoji = archetype.emoji;
  } else {
    const label = CATEGORY_LABELS[category];
    name = `${label.name} da ${attr.name} de ${boss.name}`;
    emoji = label.emoji;
  }

  const { enhanceCost, masterMaterialCost } = buildEnhanceCosts(categoryIndex, weakGroup);

  return {
    id: `${boss.id}_${category}_${attributeId}`,
    category,
    attribute: attributeId,
    bossId: boss.id,
    zoneIndex: tier,
    name,
    emoji,
    image: null,
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
  DROP_CATEGORIES.forEach((category, categoryIndex) => {
    ATTRIBUTES.forEach((attr) => {
      ITEMS.push(buildItemTemplate(boss, tier, category, attr.id, categoryIndex, weakGroup));
    });
  });
});

export function getItem(itemId) {
  return ITEMS.find((i) => i.id === itemId) || null;
}

export function getItemsForBoss(bossId) {
  return ITEMS.filter((i) => i.bossId === bossId);
}

/// Rola baseStats a partir do template de um item + uma raridade já
/// escolhida — compartilhado por rollDroppedItem (drop normal) e ascendItem
/// (systems/crafting.js: ascensão pra próxima zona mantém a raridade, só
/// recalcula os números pra magnitude da nova zona).
function rollBaseStatsFromTemplate(templateStats, rarity) {
  const variance = () => 0.9 + Math.random() * 0.2; // ±10%
  const baseStats = {};
  for (const [key, value] of Object.entries(templateStats)) {
    const scaled = value * rarity.mult * variance();
    baseStats[key] = key.endsWith('Percent') ? Math.round(scaled * 10) / 10 : Math.round(scaled);
  }
  return baseStats;
}

/// Rola uma instância de item dropada por um monstro da zona `zoneIndex`
/// (0-based), na categoria `category` (uma de DROP_CATEGORIES) — chamada por
/// combat.js quando um kill rola um drop de equipamento. Sorteia o atributo
/// (uniforme, 1 dos 3) e a raridade de forma independente. Não craft, não
/// custo: o item já nasce pronto pra entrar no inventário. Cada chamada rola
/// tudo de novo, então dois drops da mesma zona/categoria quase nunca saem
/// idênticos.
export function rollDroppedItem(zoneIndex, category) {
  const boss = BOSSES[zoneIndex] || BOSSES[BOSSES.length - 1];
  const attributeId = ATTRIBUTES[Math.floor(Math.random() * ATTRIBUTES.length)].id;
  const item = getItem(`${boss.id}_${category}_${attributeId}`);
  if (!item) return null;

  const rarity = pickRarity();
  const baseStats = rollBaseStatsFromTemplate(item.stats, rarity);
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

/// O molde equivalente (mesma categoria/atributo) na zona seguinte — null se
/// já está na última zona (Zona 10, sem mais pra onde ascender). Ver
/// ascendItem em systems/crafting.js.
export function getNextItemTemplate(item) {
  const nextBoss = BOSSES[item.zoneIndex + 1];
  if (!nextBoss) return null;
  return getItem(`${nextBoss.id}_${item.category}_${item.attribute}`);
}

/// Custo de Ascensão (Rank Master → +0 da próxima zona): 1 Cristal do chefe
/// da PRÓXIMA zona + uma quantidade de material daquela zona — mais caro que
/// o passo de Rank Master (mesmo padrão de fórmula, um passo além), pra criar
/// incentivo real de já estar farmando a zona seguinte antes de ascender.
/// Retorna null se o item já está na última zona.
export function getAscensionCost(item) {
  const nextZoneIndex = item.zoneIndex + 1;
  const nextBoss = BOSSES[nextZoneIndex];
  if (!nextBoss) return null;
  const weakGroup = getWeakMonsterGroupForStage(nextBoss.stage - 1);
  const categoryIndex = DROP_CATEGORIES.indexOf(item.category);
  const bandSize = weakGroup.monsters.length;
  const step = ENHANCE_MAX_LEVEL + 1;
  const weakAt = weakGroup.monsters[(categoryIndex + 2 + step) % bandSize];
  const qty = Math.max(1, Math.round(10 * (0.5 + step * 0.5) * 1.5));
  return {
    crystalMaterialId: nextBoss.crystal.id,
    matId: weakAt.material.id,
    qty,
  };
}

/// rollBaseStatsFromTemplate exportada só pra ascendItem (systems/crafting.js)
/// reusar a mesma rolagem ±10% ao recalcular os números da nova zona.
export { rollBaseStatsFromTemplate };
