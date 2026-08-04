import { RARITIES, getRarity, VIP_INVENTORY_BONUS } from './items.js';

// Mascotes causam um dano ELEMENTAL à parte do dano do personagem (que
// agora é sempre Neutro, ver systems/stats.js) — só os 4 elementos "de
// verdade" existem aqui, sem Neutro (não faria sentido um mascote neutro,
// já que a mecânica inteira gira em torno de vantagem/desvantagem contra o
// elemento do monstro).
export const PET_ELEMENTS = ['fogo', 'planta', 'eletrico', 'agua'];

// elements.js não tem cor por elemento (só emoji/imagem) — os pets são o
// primeiro lugar que precisa de uma cor (popup de dano, badge na UI), então
// o mapa fica aqui em vez de mexer no arquivo compartilhado.
const PET_ELEMENT_COLORS = {
  fogo: '#e25822',
  planta: '#4caf50',
  eletrico: '#f5c518',
  agua: '#2196f3',
};

export function getPetElementColor(elementId) {
  return PET_ELEMENT_COLORS[elementId] || '#ffffff';
}

export const PET_TIER_COUNT = 5;

// Crescimento bem achatado entre os 5 tiers do mesmo elemento (pedido
// explícito: "pouca diferença entre os tiers") — é a raridade sorteada e o
// nível de fusão (+1 a +10) que fazem a diferença real de poder, não qual
// dos 5 pets do elemento você tirou.
const PET_TIER_BASE = 10;
const PET_TIER_GROWTH = 1.12;

function petTierDamage(tier) {
  return Math.round(PET_TIER_BASE * Math.pow(PET_TIER_GROWTH, tier - 1));
}

// Nome + arte real (assets/pets/<elemento>/tN.png) por espécie — recebidas
// já nomeadas/tieradas pelo arquivo de origem (ex: "t3 Magmox - Fogo.png").
// emoji fica só de fallback (iconMarkup() em ui/render.js cai nele se
// image alguma vez faltar).
const PET_SPECIES_BY_ELEMENT = {
  fogo: [
    { name: 'Emberu', emoji: '🦎' },
    { name: 'Salaflame', emoji: '🦊' },
    { name: 'Magmox', emoji: '🐉' },
    { name: 'Sunko', emoji: '☀️' },
    { name: 'Kitsara', emoji: '🔥' },
  ],
  planta: [
    { name: 'Spriggo', emoji: '🐛' },
    { name: 'Folhito', emoji: '🦋' },
    { name: 'Galharis', emoji: '🌳' },
    { name: 'Floriel', emoji: '🌸' },
    { name: 'Pandrion', emoji: '🌲' },
  ],
  eletrico: [
    { name: 'Sparko', emoji: '🐭' },
    { name: 'Zappin', emoji: '🐿️' },
    { name: 'Raion', emoji: '🐺' },
    { name: 'Thundor', emoji: '⚡' },
    { name: 'Zephryx', emoji: '🦅' },
  ],
  agua: [
    { name: 'Conchy', emoji: '🐸' },
    { name: 'Croakus', emoji: '🐟' },
    { name: 'Glacik', emoji: '🐢' },
    { name: 'Tideon', emoji: '🐬' },
    { name: 'Nerivor', emoji: '🐍' },
  ],
};

// 20 espécies no total (4 elementos × 5 tiers).
export const PETS = [];
PET_ELEMENTS.forEach((element) => {
  PET_SPECIES_BY_ELEMENT[element].forEach((sp, i) => {
    const tier = i + 1;
    PETS.push({
      id: `${element}_${tier}`,
      name: sp.name,
      emoji: sp.emoji,
      image: `assets/pets/${element}/t${tier}.png`,
      element,
      tier,
      baseDamage: petTierDamage(tier),
    });
  });
});

export function getPetSpecies(speciesId) {
  return PETS.find((p) => p.id === speciesId) || null;
}

// Nível de fusão: +1 (recém-chocado) até +10. Cada nível exige fundir 2
// cópias idênticas (mesma espécie + raridade + nível) do nível anterior —
// 2^(N-1) pets base pro nível N (512 pets base pro +10). Crescimento de
// poder por nível moderado — o custo já é exponencial por conta própria.
export const PET_MAX_LEVEL = 10;
const PET_LEVEL_GROWTH = 1.22;

export function petLevelMultiplier(level) {
  return Math.pow(PET_LEVEL_GROWTH, Math.max(0, (level || 1) - 1));
}

/// Dano de uma instância específica de pet, já com raridade + nível de fusão
/// aplicados.
export function getPetDamage(petEntry) {
  const species = getPetSpecies(petEntry.speciesId);
  if (!species) return 0;
  const rarity = getRarity(petEntry.rarityId);
  return Math.round(species.baseDamage * rarity.mult * petLevelMultiplier(petEntry.level));
}

// % de DPS que o pet ATIVO (ver getBestEquippedPet/getActivePetDpsMultiplier
// em systems/pets.js) empresta ao caçador, além do próprio dano do pet —
// escala só com raridade + nível de fusão (não com tier/espécie, que já é
// só o que diferencia o dano base do pet). Nível 1 Comum = +2% DPS; nível
// 10 Mítico = +2 * 2.5 * 1.22^9 ≈ +30.5% DPS.
const PET_DPS_BONUS_BASE_PERCENT = 2;

export function getPetDpsBonusPercent(petEntry) {
  const rarity = getRarity(petEntry.rarityId);
  return PET_DPS_BONUS_BASE_PERCENT * rarity.mult * petLevelMultiplier(petEntry.level);
}

// ---------------------------------------------------------------------
// Ovo: um tipo só, genérico — ao chocar, sorteia 2 candidatos
// independentes (espécie + raridade cada, ver rollPetCandidate), e o
// jogador escolhe um dos dois (ver systems/pets.js + o fluxo de VIP/escolha
// grátis diária). Raridade usa o mesmo peso/cores de RARITIES
// (data/items.js) — Comum 60% / Incomum 24% / Raro 10% / Épico 4% /
// Lendário 1.5% / Mítico 0.5%.
// ---------------------------------------------------------------------

function pickPetRarity() {
  const totalWeight = RARITIES.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const rarity of RARITIES) {
    roll -= rarity.weight;
    if (roll <= 0) return rarity;
  }
  return RARITIES[0];
}

export function rollPetCandidate() {
  const species = PETS[Math.floor(Math.random() * PETS.length)];
  const rarity = pickPetRarity();
  return { speciesId: species.id, rarityId: rarity.id, level: 1 };
}

// Base 100, +50 (150 no total) com VIP — mesmo bônus do inventário de
// equipamentos (ver data/items.js ITEM_INVENTORY_CAP/getItemInventoryCap).
export const PET_INVENTORY_CAP = 100;

export function getPetInventoryCap(state) {
  return PET_INVENTORY_CAP + (state.vip ? VIP_INVENTORY_BONUS : 0);
}

/// Valor de venda em ouro — usado tanto pro auto-sell ao bater o limite do
/// inventário quanto pra venda manual. Escala com raridade e nível de fusão.
export function getPetSellValue(petEntry) {
  const rarityIdx = RARITIES.findIndex((r) => r.id === petEntry.rarityId);
  const base = 20 * (Math.max(0, rarityIdx) + 1);
  return Math.round(base * petLevelMultiplier(petEntry.level));
}

// Chances de drop de ovo — baixas em kill normal (parecido com carta),
// bem mais altas ao vencer um dos 3 eventos (Invasão/Torre/Mina de Ouro).
export const WEAK_EGG_DROP_CHANCE = 0.0004; // 0.04%
export const BOSS_EGG_DROP_CHANCE = 0.0012; // 0.12%
export const EVENT_EGG_DROP_CHANCE = 0.08; // 8%, por vitória de evento
