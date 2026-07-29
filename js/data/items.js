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
    forca: { name: 'Espada', emoji: '⚔️' },
    destreza: { name: 'Arco', emoji: '🏹' },
    inteligencia: { name: 'Cajado', emoji: '🔮' },
  },
  weapon2: {
    forca: { name: 'Escudo', emoji: '🛡️' },
    destreza: { name: 'Aljava', emoji: '🎒' },
    inteligencia: { name: 'Livro', emoji: '📖' },
  },
};

// Arco/Aljava têm nome e arte fixos por zona (tier), em vez de "Arco de
// <Boss>" como os demais arquétipos — pedido de design, não segue o padrão
// genérico das outras armas/atributos.
// Caminhos de imagem escritos como literais (não montados via template
// string) de propósito: o bundler de publicação do Artifact
// (idle-hunter-compressed/build-bundle.mjs) acha e embute os assets
// procurando por literais de caminho no código-fonte — um caminho montado
// dinamicamente não seria encontrado e ficaria quebrado no bundle.
const ZONE_BOW_NAMES = [
  { weapon1: 'Arco Novato', weapon2: 'Aljava Novato', image1: 'assets/chispim/arco.png', image2: 'assets/chispim/aljava.png' },
  { weapon1: 'Arco Iniciante', weapon2: 'Aljava Iniciante', image1: 'assets/solkaiser/arco.png', image2: 'assets/solkaiser/aljava.png' },
  { weapon1: 'Arco da Floresta', weapon2: 'Aljava da Floresta', image1: 'assets/tartarok/arco.png', image2: 'assets/tartarok/aljava.png' },
  { weapon1: 'Arco Élfico', weapon2: 'Aljava Élfica', image1: 'assets/colhedor_carmesim/arco.png', image2: 'assets/colhedor_carmesim/aljava.png' },
  { weapon1: 'Arco Real', weapon2: 'Aljava Real', image1: 'assets/grommuk/arco.png', image2: 'assets/grommuk/aljava.png' },
  { weapon1: 'Arco Sombrio', weapon2: 'Aljava Sombria', image1: 'assets/vulkarion/arco.png', image2: 'assets/vulkarion/aljava.png' },
  { weapon1: 'Arco Tempestuoso', weapon2: 'Aljava Tempestuosa', image1: 'assets/leviargon/arco.png', image2: 'assets/leviargon/aljava.png' },
  { weapon1: 'Arco do Vento', weapon2: 'Aljava do Vento', image1: 'assets/tempestron/arco.png', image2: 'assets/tempestron/aljava.png' },
  { weapon1: 'Arco Dracônico', weapon2: 'Aljava Dracônica', image1: 'assets/gaiatron/arco.png', image2: 'assets/gaiatron/aljava.png' },
  { weapon1: 'Arco Primordial', weapon2: 'Aljava Primordial', image1: 'assets/bahamorth/arco.png', image2: 'assets/bahamorth/aljava.png' },
];

const CATEGORY_LABELS = {
  head: { name: 'Cabeça', emoji: '🪖' },
  chest: { name: 'Peito', emoji: '🛡️' },
  legs: { name: 'Calça', emoji: '👖' },
  hands: { name: 'Mãos', emoji: '🧤' },
  boots: { name: 'Botas', emoji: '👢' },
  ring: { name: 'Anel', emoji: '💍' },
  necklace: { name: 'Colar', emoji: '📿' },
};

// Reformulação por "conjunto": overrides nome+arte de TODAS as 9 categorias
// de um (zona, atributo) só, num lugar só — em vez do nome genérico
// "<Categoria> da <Atributo> de <Boss>" e sem imagem (só emoji) que os
// outros moldes ainda usam. Cobre um (zoneIndex, attributeId) por vez; só
// as zonas/atributos aqui presentes saem do esquema genérico — as demais
// continuam como antes. Ganha prioridade sobre ZONE_BOW_NAMES/
// WEAPON_ARCHETYPES/CATEGORY_LABELS em buildItemTemplate.
// Caminhos de imagem em literais de propósito — mesmo motivo do
// ZONE_BOW_NAMES acima (bundler do Artifact procura por literais).
const ITEM_SET_OVERRIDES = {
  '0_destreza': {
    weapon1: { name: 'Arco da Floresta', image: 'assets/sets/floresta/arco.webp' },
    weapon2: { name: 'Aljava da Floresta', image: 'assets/sets/floresta/aljava.webp' },
    head: { name: 'Capuz da Floresta', image: 'assets/sets/floresta/capuz.webp' },
    chest: { name: 'Armadura da Floresta', image: 'assets/sets/floresta/armadura.webp' },
    legs: { name: 'Calça da Floresta', image: 'assets/sets/floresta/calca.webp' },
    hands: { name: 'Luvas da Floresta', image: 'assets/sets/floresta/luvas.webp' },
    boots: { name: 'Sapatos da Floresta', image: 'assets/sets/floresta/sapatos.webp' },
    ring: { name: 'Anel da Floresta', image: 'assets/sets/floresta/anel.webp' },
    necklace: { name: 'Colar da Floresta', image: 'assets/sets/floresta/colar.webp' },
  },
  '1_destreza': {
    weapon1: { name: 'Arco da Montanha', image: 'assets/sets/montanha/arco.webp' },
    weapon2: { name: 'Aljava da Montanha', image: 'assets/sets/montanha/aljava.webp' },
    head: { name: 'Capuz da Montanha', image: 'assets/sets/montanha/capuz.webp' },
    chest: { name: 'Armadura da Montanha', image: 'assets/sets/montanha/armadura.webp' },
    legs: { name: 'Calça da Montanha', image: 'assets/sets/montanha/calca.webp' },
    hands: { name: 'Luva da Montanha', image: 'assets/sets/montanha/luvas.webp' },
    boots: { name: 'Bota da Montanha', image: 'assets/sets/montanha/sapatos.webp' },
    ring: { name: 'Anel da Montanha', image: 'assets/sets/montanha/anel.webp' },
    necklace: { name: 'Colar da Montanha', image: 'assets/sets/montanha/colar.webp' },
  },
  '2_destreza': {
    weapon1: { name: 'Arco de Esmeralda', image: 'assets/sets/esmeralda/arco.webp' },
    weapon2: { name: 'Aljava de Esmeralda', image: 'assets/sets/esmeralda/aljava.webp' },
    head: { name: 'Capuz de Esmeralda', image: 'assets/sets/esmeralda/capuz.webp' },
    chest: { name: 'Armadura de Esmeralda', image: 'assets/sets/esmeralda/armadura.webp' },
    legs: { name: 'Calça de Esmeralda', image: 'assets/sets/esmeralda/calca.webp' },
    hands: { name: 'Luva de Esmeralda', image: 'assets/sets/esmeralda/luvas.webp' },
    boots: { name: 'Botas de Esmeralda', image: 'assets/sets/esmeralda/sapatos.webp' },
    ring: { name: 'Anel de Esmeralda', image: 'assets/sets/esmeralda/anel.webp' },
    necklace: { name: 'Colar de Esmeralda', image: 'assets/sets/esmeralda/colar.webp' },
  },
  '3_destreza': {
    weapon1: { name: 'Arco Sombrio', image: 'assets/sets/sombrio/arco.webp' },
    weapon2: { name: 'Aljava Sombria', image: 'assets/sets/sombrio/aljava.webp' },
    head: { name: 'Capuz Sombrio', image: 'assets/sets/sombrio/capuz.webp' },
    chest: { name: 'Armadura Sombria', image: 'assets/sets/sombrio/armadura.webp' },
    legs: { name: 'Calça Sombria', image: 'assets/sets/sombrio/calca.webp' },
    hands: { name: 'Luva Sombria', image: 'assets/sets/sombrio/luvas.webp' },
    boots: { name: 'Botas Sombrias', image: 'assets/sets/sombrio/sapatos.webp' },
    ring: { name: 'Anel Sombrio', image: 'assets/sets/sombrio/anel.webp' },
    necklace: { name: 'Colar Sombrio', image: 'assets/sets/sombrio/colar.webp' },
  },
  '4_destreza': {
    weapon1: { name: 'Arco Real', image: 'assets/sets/real/arco.webp' },
    weapon2: { name: 'Aljava Real', image: 'assets/sets/real/aljava.webp' },
    head: { name: 'Capuz Real', image: 'assets/sets/real/capuz.webp' },
    chest: { name: 'Armadura Real', image: 'assets/sets/real/armadura.webp' },
    legs: { name: 'Calça Real', image: 'assets/sets/real/calca.webp' },
    hands: { name: 'Luva Real', image: 'assets/sets/real/luvas.webp' },
    boots: { name: 'Bota Real', image: 'assets/sets/real/sapatos.webp' },
    ring: { name: 'Anel Real', image: 'assets/sets/real/anel.webp' },
    necklace: { name: 'Colar Real', image: 'assets/sets/real/colar.webp' },
  },
  '5_destreza': {
    weapon1: { name: 'Arco Selvagem', image: 'assets/sets/selvagem/arco.webp' },
    weapon2: { name: 'Aljava Selvagem', image: 'assets/sets/selvagem/aljava.webp' },
    head: { name: 'Capuz Selvagem', image: 'assets/sets/selvagem/capuz.webp' },
    chest: { name: 'Armadura Selvagem', image: 'assets/sets/selvagem/armadura.webp' },
    legs: { name: 'Calça Selvagem', image: 'assets/sets/selvagem/calca.webp' },
    hands: { name: 'Luva Selvagem', image: 'assets/sets/selvagem/luvas.webp' },
    boots: { name: 'Bota Selvagem', image: 'assets/sets/selvagem/sapatos.webp' },
    ring: { name: 'Anel Selvagem', image: 'assets/sets/selvagem/anel.webp' },
    necklace: { name: 'Colar Selvagem', image: 'assets/sets/selvagem/colar.webp' },
  },
  '6_destreza': {
    weapon1: { name: 'Arco da Tempestade', image: 'assets/sets/tempestade/arco.webp' },
    weapon2: { name: 'Aljava da Tempestade', image: 'assets/sets/tempestade/aljava.webp' },
    head: { name: 'Capuz da Tempestade', image: 'assets/sets/tempestade/capuz.webp' },
    chest: { name: 'Armadura da Tempestade', image: 'assets/sets/tempestade/armadura.webp' },
    legs: { name: 'Calça da Tempestade', image: 'assets/sets/tempestade/calca.webp' },
    hands: { name: 'Luva da Tempestade', image: 'assets/sets/tempestade/luvas.webp' },
    boots: { name: 'Bota da Tempestade', image: 'assets/sets/tempestade/sapatos.webp' },
    ring: { name: 'Anel da Tempestade', image: 'assets/sets/tempestade/anel.webp' },
    necklace: { name: 'Colar da Tempestade', image: 'assets/sets/tempestade/colar.webp' },
  },
  '7_destreza': {
    weapon1: { name: 'Arco de Cristal', image: 'assets/sets/cristal/arco.webp' },
    weapon2: { name: 'Aljava de Cristal', image: 'assets/sets/cristal/aljava.webp' },
    head: { name: 'Capuz de Cristal', image: 'assets/sets/cristal/capuz.webp' },
    chest: { name: 'Armadura de Cristal', image: 'assets/sets/cristal/armadura.webp' },
    legs: { name: 'Calça de Cristal', image: 'assets/sets/cristal/calca.webp' },
    hands: { name: 'Luva de Cristal', image: 'assets/sets/cristal/luvas.webp' },
    boots: { name: 'Bota de Cristal', image: 'assets/sets/cristal/sapatos.webp' },
    ring: { name: 'Anel de Cristal', image: 'assets/sets/cristal/anel.webp' },
    necklace: { name: 'Colar de Cristal', image: 'assets/sets/cristal/colar.webp' },
  },
  '8_destreza': {
    weapon1: { name: 'Arco Ancestral', image: 'assets/sets/ancestral/arco.webp' },
    weapon2: { name: 'Aljava Ancestral', image: 'assets/sets/ancestral/aljava.webp' },
    head: { name: 'Capuz Ancestral', image: 'assets/sets/ancestral/capuz.webp' },
    chest: { name: 'Armadura Ancestral', image: 'assets/sets/ancestral/armadura.webp' },
    legs: { name: 'Calça Ancestral', image: 'assets/sets/ancestral/calca.webp' },
    hands: { name: 'Luva Ancestral', image: 'assets/sets/ancestral/luvas.webp' },
    boots: { name: 'Bota Ancestral', image: 'assets/sets/ancestral/sapatos.webp' },
    ring: { name: 'Anel Ancestral', image: 'assets/sets/ancestral/anel.webp' },
    necklace: { name: 'Colar Ancestral', image: 'assets/sets/ancestral/colar.webp' },
  },
  '9_destreza': {
    weapon1: { name: 'Arco do Arqueiro Primordial', image: 'assets/sets/primordial/arco.webp' },
    weapon2: { name: 'Aljava do Arqueiro Primordial', image: 'assets/sets/primordial/aljava.webp' },
    head: { name: 'Capuz do Arqueiro Primordial', image: 'assets/sets/primordial/capuz.webp' },
    chest: { name: 'Armadura do Arqueiro Primordial', image: 'assets/sets/primordial/armadura.webp' },
    legs: { name: 'Calça do Arqueiro Primordial', image: 'assets/sets/primordial/calca.webp' },
    hands: { name: 'Luva do Arqueiro Primordial', image: 'assets/sets/primordial/luvas.webp' },
    boots: { name: 'Bota do Arqueiro Primordial', image: 'assets/sets/primordial/sapatos.webp' },
    ring: { name: 'Anel do Arqueiro Primordial', image: 'assets/sets/primordial/anel.webp' },
    necklace: { name: 'Colar do Arqueiro Primordial', image: 'assets/sets/primordial/colar.webp' },
  },
  '0_inteligencia': {
    weapon1: { name: 'Cajado do Aprendiz', image: 'assets/sets/aprendiz/cajado.webp' },
    weapon2: { name: 'Grimório do Aprendiz', image: 'assets/sets/aprendiz/livro.webp' },
    head: { name: 'Capuz do Aprendiz', image: 'assets/sets/aprendiz/capuz.webp' },
    chest: { name: 'Túnica do Aprendiz', image: 'assets/sets/aprendiz/armadura.webp' },
    legs: { name: 'Calça do Aprendiz', image: 'assets/sets/aprendiz/calca.webp' },
    hands: { name: 'Luva do Aprendiz', image: 'assets/sets/aprendiz/luvas.webp' },
    boots: { name: 'Bota do Aprendiz', image: 'assets/sets/aprendiz/sapatos.webp' },
    ring: { name: 'Anel do Aprendiz', image: 'assets/sets/aprendiz/anel.webp' },
    necklace: { name: 'Colar do Aprendiz', image: 'assets/sets/aprendiz/colar.webp' },
  },
  '1_inteligencia': {
    weapon1: { name: 'Cajado Gelado', image: 'assets/sets/gelado/cajado.webp' },
    weapon2: { name: 'Grimório Gelado', image: 'assets/sets/gelado/livro.webp' },
    head: { name: 'Capuz Gelado', image: 'assets/sets/gelado/capuz.webp' },
    chest: { name: 'Túnica Gelada', image: 'assets/sets/gelado/armadura.webp' },
    legs: { name: 'Calça Gelada', image: 'assets/sets/gelado/calca.webp' },
    hands: { name: 'Luva Gelada', image: 'assets/sets/gelado/luvas.webp' },
    boots: { name: 'Bota Gelada', image: 'assets/sets/gelado/sapatos.webp' },
    ring: { name: 'Anel Gelado', image: 'assets/sets/gelado/anel.webp' },
    necklace: { name: 'Colar Gelado', image: 'assets/sets/gelado/colar.webp' },
  },
  '2_inteligencia': {
    weapon1: { name: 'Cajado Místico', image: 'assets/sets/mistico/cajado.webp' },
    weapon2: { name: 'Grimório Místico', image: 'assets/sets/mistico/livro.webp' },
    head: { name: 'Capuz Místico', image: 'assets/sets/mistico/capuz.webp' },
    chest: { name: 'Túnica Mística', image: 'assets/sets/mistico/armadura.webp' },
    legs: { name: 'Calça Mística', image: 'assets/sets/mistico/calca.webp' },
    hands: { name: 'Luva Mística', image: 'assets/sets/mistico/luvas.webp' },
    boots: { name: 'Bota Mística', image: 'assets/sets/mistico/sapatos.webp' },
    ring: { name: 'Anel Místico', image: 'assets/sets/mistico/anel.webp' },
    necklace: { name: 'Colar Místico', image: 'assets/sets/mistico/colar.webp' },
  },
  '3_inteligencia': {
    weapon1: { name: 'Cajado Rúnico', image: 'assets/sets/runico/cajado.webp' },
    weapon2: { name: 'Grimório Rúnico', image: 'assets/sets/runico/livro.webp' },
    head: { name: 'Capuz Rúnico', image: 'assets/sets/runico/capuz.webp' },
    chest: { name: 'Túnica Rúnica', image: 'assets/sets/runico/armadura.webp' },
    legs: { name: 'Calça Rúnica', image: 'assets/sets/runico/calca.webp' },
    hands: { name: 'Luva Rúnica', image: 'assets/sets/runico/luvas.webp' },
    boots: { name: 'Bota Rúnica', image: 'assets/sets/runico/sapatos.webp' },
    ring: { name: 'Anel Rúnico', image: 'assets/sets/runico/anel.webp' },
    necklace: { name: 'Colar Rúnico', image: 'assets/sets/runico/colar.webp' },
  },
  '4_inteligencia': {
    weapon1: { name: 'Cajado Nobre', image: 'assets/sets/nobre/cajado.webp' },
    weapon2: { name: 'Grimório Nobre', image: 'assets/sets/nobre/livro.webp' },
    head: { name: 'Capuz Nobre', image: 'assets/sets/nobre/capuz.webp' },
    chest: { name: 'Túnica Nobre', image: 'assets/sets/nobre/armadura.webp' },
    legs: { name: 'Calça Nobre', image: 'assets/sets/nobre/calca.webp' },
    hands: { name: 'Luva Nobre', image: 'assets/sets/nobre/luvas.webp' },
    boots: { name: 'Bota Nobre', image: 'assets/sets/nobre/sapatos.webp' },
    ring: { name: 'Anel Nobre', image: 'assets/sets/nobre/anel.webp' },
    necklace: { name: 'Colar Nobre', image: 'assets/sets/nobre/colar.webp' },
  },
  '5_inteligencia': {
    weapon1: { name: 'Cajado Astral', image: 'assets/sets/astral/cajado.webp' },
    weapon2: { name: 'Grimório Astral', image: 'assets/sets/astral/livro.webp' },
    head: { name: 'Capuz Astral', image: 'assets/sets/astral/capuz.webp' },
    chest: { name: 'Túnica Astral', image: 'assets/sets/astral/armadura.webp' },
    legs: { name: 'Calça Astral', image: 'assets/sets/astral/calca.webp' },
    hands: { name: 'Luva Astral', image: 'assets/sets/astral/luvas.webp' },
    boots: { name: 'Bota Astral', image: 'assets/sets/astral/sapatos.webp' },
    ring: { name: 'Anel Astral', image: 'assets/sets/astral/anel.webp' },
    necklace: { name: 'Colar Astral', image: 'assets/sets/astral/colar.webp' },
  },
  '6_inteligencia': {
    weapon1: { name: 'Cajado do Alquimista', image: 'assets/sets/alquimista/cajado.webp' },
    weapon2: { name: 'Grimório do Alquimista', image: 'assets/sets/alquimista/livro.webp' },
    head: { name: 'Capuz do Alquimista', image: 'assets/sets/alquimista/capuz.webp' },
    chest: { name: 'Túnica do Alquimista', image: 'assets/sets/alquimista/armadura.webp' },
    legs: { name: 'Calça do Alquimista', image: 'assets/sets/alquimista/calca.webp' },
    hands: { name: 'Luva do Alquimista', image: 'assets/sets/alquimista/luvas.webp' },
    boots: { name: 'Bota do Alquimista', image: 'assets/sets/alquimista/sapatos.webp' },
    ring: { name: 'Anel do Alquimista', image: 'assets/sets/alquimista/anel.webp' },
    necklace: { name: 'Colar do Alquimista', image: 'assets/sets/alquimista/colar.webp' },
  },
  '7_inteligencia': {
    weapon1: { name: 'Cajado do Cronomante', image: 'assets/sets/cronomante/cajado.webp' },
    weapon2: { name: 'Grimório do Cronomante', image: 'assets/sets/cronomante/livro.webp' },
    head: { name: 'Capuz do Cronomante', image: 'assets/sets/cronomante/capuz.webp' },
    chest: { name: 'Túnica do Cronomante', image: 'assets/sets/cronomante/armadura.webp' },
    legs: { name: 'Calça do Cronomante', image: 'assets/sets/cronomante/calca.webp' },
    hands: { name: 'Luva do Cronomante', image: 'assets/sets/cronomante/luvas.webp' },
    boots: { name: 'Bota do Cronomante', image: 'assets/sets/cronomante/sapatos.webp' },
    ring: { name: 'Anel do Cronomante', image: 'assets/sets/cronomante/anel.webp' },
    necklace: { name: 'Colar do Cronomante', image: 'assets/sets/cronomante/colar.webp' },
  },
  '8_inteligencia': {
    weapon1: { name: 'Cajado Dimensional', image: 'assets/sets/dimensional/cajado.webp' },
    weapon2: { name: 'Grimório Dimensional', image: 'assets/sets/dimensional/livro.webp' },
    head: { name: 'Capuz Dimensional', image: 'assets/sets/dimensional/capuz.webp' },
    chest: { name: 'Túnica Dimensional', image: 'assets/sets/dimensional/armadura.webp' },
    legs: { name: 'Calça Dimensional', image: 'assets/sets/dimensional/calca.webp' },
    hands: { name: 'Luva Dimensional', image: 'assets/sets/dimensional/luvas.webp' },
    boots: { name: 'Bota Dimensional', image: 'assets/sets/dimensional/sapatos.webp' },
    ring: { name: 'Anel Dimensional', image: 'assets/sets/dimensional/anel.webp' },
    necklace: { name: 'Colar Dimensional', image: 'assets/sets/dimensional/colar.webp' },
  },
  '9_inteligencia': {
    weapon1: { name: 'Cajado do Mago Primordial', image: 'assets/sets/mago_primordial/cajado.webp' },
    weapon2: { name: 'Grimório do Mago Primordial', image: 'assets/sets/mago_primordial/livro.webp' },
    head: { name: 'Capuz do Mago Primordial', image: 'assets/sets/mago_primordial/capuz.webp' },
    chest: { name: 'Túnica do Mago Primordial', image: 'assets/sets/mago_primordial/armadura.webp' },
    legs: { name: 'Calça do Mago Primordial', image: 'assets/sets/mago_primordial/calca.webp' },
    hands: { name: 'Luva do Mago Primordial', image: 'assets/sets/mago_primordial/luvas.webp' },
    boots: { name: 'Bota do Mago Primordial', image: 'assets/sets/mago_primordial/sapatos.webp' },
    ring: { name: 'Anel do Mago Primordial', image: 'assets/sets/mago_primordial/anel.webp' },
    necklace: { name: 'Colar do Mago Primordial', image: 'assets/sets/mago_primordial/colar.webp' },
  },
  '0_forca': {
    weapon1: { name: 'Espada do Patrulheiro', image: 'assets/sets/patrulheiro/espada.webp' },
    weapon2: { name: 'Escudo do Patrulheiro', image: 'assets/sets/patrulheiro/escudo.webp' },
    head: { name: 'Elmo do Patrulheiro', image: 'assets/sets/patrulheiro/elmo.webp' },
    chest: { name: 'Armadura do Patrulheiro', image: 'assets/sets/patrulheiro/armadura.webp' },
    legs: { name: 'Calça do Patrulheiro', image: 'assets/sets/patrulheiro/calca.webp' },
    hands: { name: 'Luva do Patrulheiro', image: 'assets/sets/patrulheiro/luvas.webp' },
    boots: { name: 'Bota do Patrulheiro', image: 'assets/sets/patrulheiro/sapatos.webp' },
    ring: { name: 'Anel do Patrulheiro', image: 'assets/sets/patrulheiro/anel.webp' },
    necklace: { name: 'Colar do Patrulheiro', image: 'assets/sets/patrulheiro/colar.webp' },
  },
  '1_forca': {
    weapon1: { name: 'Espada do Lobo', image: 'assets/sets/lobo/espada.webp' },
    weapon2: { name: 'Escudo do Lobo', image: 'assets/sets/lobo/escudo.webp' },
    head: { name: 'Elmo do Lobo', image: 'assets/sets/lobo/elmo.webp' },
    chest: { name: 'Armadura do Lobo', image: 'assets/sets/lobo/armadura.webp' },
    legs: { name: 'Calça do Lobo', image: 'assets/sets/lobo/calca.webp' },
    hands: { name: 'Luva do Lobo', image: 'assets/sets/lobo/luvas.webp' },
    boots: { name: 'Bota do Lobo', image: 'assets/sets/lobo/sapatos.webp' },
    ring: { name: 'Anel do Lobo', image: 'assets/sets/lobo/anel.webp' },
    necklace: { name: 'Colar do Lobo', image: 'assets/sets/lobo/colar.webp' },
  },
  '2_forca': {
    weapon1: { name: 'Espada do Grifo', image: 'assets/sets/grifo/espada.webp' },
    weapon2: { name: 'Escudo do Grifo', image: 'assets/sets/grifo/escudo.webp' },
    head: { name: 'Elmo do Grifo', image: 'assets/sets/grifo/elmo.webp' },
    chest: { name: 'Armadura do Grifo', image: 'assets/sets/grifo/armadura.webp' },
    legs: { name: 'Calça do Grifo', image: 'assets/sets/grifo/calca.webp' },
    hands: { name: 'Luva do Grifo', image: 'assets/sets/grifo/luvas.webp' },
    boots: { name: 'Bota do Grifo', image: 'assets/sets/grifo/sapatos.webp' },
    ring: { name: 'Anel do Grifo', image: 'assets/sets/grifo/anel.webp' },
    necklace: { name: 'Colar do Grifo', image: 'assets/sets/grifo/colar.webp' },
  },
  '3_forca': {
    weapon1: { name: 'Espada do Bastião', image: 'assets/sets/bastiao/espada.webp' },
    weapon2: { name: 'Escudo do Bastião', image: 'assets/sets/bastiao/escudo.webp' },
    head: { name: 'Elmo do Bastião', image: 'assets/sets/bastiao/elmo.webp' },
    chest: { name: 'Armadura do Bastião', image: 'assets/sets/bastiao/armadura.webp' },
    legs: { name: 'Calça do Bastião', image: 'assets/sets/bastiao/calca.webp' },
    hands: { name: 'Luva do Bastião', image: 'assets/sets/bastiao/luvas.webp' },
    boots: { name: 'Bota do Bastião', image: 'assets/sets/bastiao/sapatos.webp' },
    ring: { name: 'Anel do Bastião', image: 'assets/sets/bastiao/anel.webp' },
    necklace: { name: 'Colar do Bastião', image: 'assets/sets/bastiao/colar.webp' },
  },
  '4_forca': {
    weapon1: { name: 'Espada do Caçador de Dragão', image: 'assets/sets/cacador_dragao/espada.webp' },
    weapon2: { name: 'Escudo do Caçador de Dragão', image: 'assets/sets/cacador_dragao/escudo.webp' },
    head: { name: 'Elmo do Caçador de Dragão', image: 'assets/sets/cacador_dragao/elmo.webp' },
    chest: { name: 'Armadura do Caçador de Dragão', image: 'assets/sets/cacador_dragao/armadura.webp' },
    legs: { name: 'Calça do Caçador de Dragão', image: 'assets/sets/cacador_dragao/calca.webp' },
    hands: { name: 'Luva do Caçador de Dragão', image: 'assets/sets/cacador_dragao/luvas.webp' },
    boots: { name: 'Bota do Caçador de Dragão', image: 'assets/sets/cacador_dragao/sapatos.webp' },
    ring: { name: 'Anel do Caçador de Dragão', image: 'assets/sets/cacador_dragao/anel.webp' },
    necklace: { name: 'Colar do Caçador de Dragão', image: 'assets/sets/cacador_dragao/colar.webp' },
  },
  '5_forca': {
    weapon1: { name: 'Espada do Cavaleiro Rúnico', image: 'assets/sets/cavaleiro_runico/espada.webp' },
    weapon2: { name: 'Escudo do Cavaleiro Rúnico', image: 'assets/sets/cavaleiro_runico/escudo.webp' },
    head: { name: 'Elmo do Cavaleiro Rúnico', image: 'assets/sets/cavaleiro_runico/elmo.webp' },
    chest: { name: 'Armadura do Cavaleiro Rúnico', image: 'assets/sets/cavaleiro_runico/armadura.webp' },
    legs: { name: 'Calça do Cavaleiro Rúnico', image: 'assets/sets/cavaleiro_runico/calca.webp' },
    hands: { name: 'Luva do Cavaleiro Rúnico', image: 'assets/sets/cavaleiro_runico/luvas.webp' },
    boots: { name: 'Bota do Cavaleiro Rúnico', image: 'assets/sets/cavaleiro_runico/sapatos.webp' },
    ring: { name: 'Anel do Cavaleiro Rúnico', image: 'assets/sets/cavaleiro_runico/anel.webp' },
    necklace: { name: 'Colar do Cavaleiro Rúnico', image: 'assets/sets/cavaleiro_runico/colar.webp' },
  },
  '6_forca': {
    weapon1: { name: 'Espada do Ferreiro', image: 'assets/sets/ferreiro/espada.webp' },
    weapon2: { name: 'Escudo do Ferreiro', image: 'assets/sets/ferreiro/escudo.webp' },
    head: { name: 'Elmo do Ferreiro', image: 'assets/sets/ferreiro/elmo.webp' },
    chest: { name: 'Armadura do Ferreiro', image: 'assets/sets/ferreiro/armadura.webp' },
    legs: { name: 'Calça do Ferreiro', image: 'assets/sets/ferreiro/calca.webp' },
    hands: { name: 'Luva do Ferreiro', image: 'assets/sets/ferreiro/luvas.webp' },
    boots: { name: 'Bota do Ferreiro', image: 'assets/sets/ferreiro/sapatos.webp' },
    ring: { name: 'Anel do Ferreiro', image: 'assets/sets/ferreiro/anel.webp' },
    necklace: { name: 'Colar do Ferreiro', image: 'assets/sets/ferreiro/colar.webp' },
  },
  '7_forca': {
    weapon1: { name: 'Espada da Tempestade', image: 'assets/sets/tempestade_forca/espada.webp' },
    weapon2: { name: 'Escudo da Tempestade', image: 'assets/sets/tempestade_forca/escudo.webp' },
    head: { name: 'Elmo da Tempestade', image: 'assets/sets/tempestade_forca/elmo.webp' },
    chest: { name: 'Armadura da Tempestade', image: 'assets/sets/tempestade_forca/armadura.webp' },
    legs: { name: 'Calça da Tempestade', image: 'assets/sets/tempestade_forca/calca.webp' },
    hands: { name: 'Luva da Tempestade', image: 'assets/sets/tempestade_forca/luvas.webp' },
    boots: { name: 'Bota da Tempestade', image: 'assets/sets/tempestade_forca/sapatos.webp' },
    ring: { name: 'Anel da Tempestade', image: 'assets/sets/tempestade_forca/anel.webp' },
    necklace: { name: 'Colar da Tempestade', image: 'assets/sets/tempestade_forca/colar.webp' },
  },
  '8_forca': {
    weapon1: { name: 'Espada Dracônica', image: 'assets/sets/draconico/espada.webp' },
    weapon2: { name: 'Escudo Dracônico', image: 'assets/sets/draconico/escudo.webp' },
    head: { name: 'Elmo Dracônico', image: 'assets/sets/draconico/elmo.webp' },
    chest: { name: 'Armadura Dracônica', image: 'assets/sets/draconico/armadura.webp' },
    legs: { name: 'Calça Dracônica', image: 'assets/sets/draconico/calca.webp' },
    hands: { name: 'Luva Dracônica', image: 'assets/sets/draconico/luvas.webp' },
    boots: { name: 'Bota Dracônica', image: 'assets/sets/draconico/sapatos.webp' },
    ring: { name: 'Anel Dracônico', image: 'assets/sets/draconico/anel.webp' },
    necklace: { name: 'Colar Dracônico', image: 'assets/sets/draconico/colar.webp' },
  },
  '9_forca': {
    weapon1: { name: 'Espada do Guerreiro Primordial', image: 'assets/sets/guerreiro_primordial/espada.webp' },
    weapon2: { name: 'Escudo do Guerreiro Primordial', image: 'assets/sets/guerreiro_primordial/escudo.webp' },
    head: { name: 'Elmo do Guerreiro Primordial', image: 'assets/sets/guerreiro_primordial/elmo.webp' },
    chest: { name: 'Armadura do Guerreiro Primordial', image: 'assets/sets/guerreiro_primordial/armadura.webp' },
    legs: { name: 'Calça do Guerreiro Primordial', image: 'assets/sets/guerreiro_primordial/calca.webp' },
    hands: { name: 'Luva do Guerreiro Primordial', image: 'assets/sets/guerreiro_primordial/luvas.webp' },
    boots: { name: 'Bota do Guerreiro Primordial', image: 'assets/sets/guerreiro_primordial/sapatos.webp' },
    ring: { name: 'Anel do Guerreiro Primordial', image: 'assets/sets/guerreiro_primordial/anel.webp' },
    necklace: { name: 'Colar do Guerreiro Primordial', image: 'assets/sets/guerreiro_primordial/colar.webp' },
  },
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
  let image = null;

  const setOverride = ITEM_SET_OVERRIDES[`${tier}_${attributeId}`]?.[category];
  if (setOverride) {
    name = setOverride.name;
    image = setOverride.image;
    emoji = (category === 'weapon1' || category === 'weapon2')
      ? WEAPON_ARCHETYPES[category][attributeId].emoji
      : CATEGORY_LABELS[category].emoji;
  } else if ((category === 'weapon1' || category === 'weapon2') && attributeId === 'destreza') {
    name = ZONE_BOW_NAMES[tier][category];
    emoji = WEAPON_ARCHETYPES[category][attributeId].emoji;
    image = ZONE_BOW_NAMES[tier][category === 'weapon1' ? 'image1' : 'image2'];
  } else if (category === 'weapon1' || category === 'weapon2') {
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
    image,
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
