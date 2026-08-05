import { RARITIES, getRarity } from './items.js';
import { isVipActive } from '../state.js';

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

// Dano do pet = uma % do DPS do próprio caçador (pedido explícito do
// usuário) — não mais um número absoluto independente. Os 2 pontos-âncora
// que fixam a curva inteira: Tier 1 Comum nível 1 = 1% do DPS; Tier 5
// Mítico nível 10 = 100% do DPS. TIER_BASE_PERCENT[tier-1] é a % de base
// (rarity.mult=1, petLevelMultiplier=1 aplicados por cima, ver
// getPetDamagePercent abaixo) — geometricamente interpolada entre esses 2
// pontos (rarity.mult vai de 1.0 a 2.5 entre Comum e Mítico, ver RARITIES
// em data/items.js; petLevelMultiplier(10) = PET_LEVEL_GROWTH^9, ver
// abaixo), então o crescimento entre tiers deixou de ser "achatado" —
// virou o que os 2 pontos-âncora exigem.
const PET_TIER_BASE_PERCENT = [1, 1.6077, 2.5847, 4.1554, 6.6807];

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

/// % do DPS do caçador que essa instância de pet representa como dano base
/// — já com raridade + nível de fusão aplicados (ver PET_TIER_BASE_PERCENT
/// acima pro porquê dos números). Independente de qualquer valor de DPS
/// real, só a % em si — getPetDamage abaixo é que converte isso num
/// número de dano de verdade.
export function getPetDamagePercent(petEntry) {
  const species = getPetSpecies(petEntry.speciesId);
  if (!species) return 0;
  const rarity = getRarity(petEntry.rarityId);
  return PET_TIER_BASE_PERCENT[species.tier - 1] * rarity.mult * petLevelMultiplier(petEntry.level);
}

/// Dano de uma instância específica de pet contra o DPS atual do caçador —
/// essa é a base "crua" (sem o bônus % de Dano de Mascote do equipamento/
/// carta ainda por cima, ver petDamageMult em resolvePetHit/systems/
/// combat.js, que multiplica isso depois).
export function getPetDamage(petEntry, hunterDps) {
  return (hunterDps || 0) * (getPetDamagePercent(petEntry) / 100);
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

/// forcedRarityId (opcional) força a raridade em vez de sortear — usado
/// pelo pity de choco (ver rollHatchCandidates em systems/pets.js), que
/// garante Lendário a cada 20 chocos e Mítico a cada 60 sem último obtido.
export function rollPetCandidate(forcedRarityId = null) {
  const species = PETS[Math.floor(Math.random() * PETS.length)];
  const rarity = forcedRarityId ? getRarity(forcedRarityId) : pickPetRarity();
  return { speciesId: species.id, rarityId: rarity.id, level: 1 };
}

/// Compara 2 candidatos recém-rolados (ver rollPetCandidate) pra decidir
/// qual escolher automaticamente no choco em lote (ver hatchAllEggs em
/// systems/pets.js) — raridade primeiro (RARITIES é ordenada Comum→Mítico,
/// então índice maior = melhor), Tier como desempate. Retorna true se `a`
/// é estritamente melhor que `b`.
export function isPetCandidateBetter(a, b) {
  const rarityRankA = RARITIES.findIndex((r) => r.id === a.rarityId);
  const rarityRankB = RARITIES.findIndex((r) => r.id === b.rarityId);
  if (rarityRankA !== rarityRankB) return rarityRankA > rarityRankB;
  const tierA = getPetSpecies(a.speciesId)?.tier || 0;
  const tierB = getPetSpecies(b.speciesId)?.tier || 0;
  return tierA > tierB;
}

// Base 200, +100 (300 no total) com VIP — bônus PRÓPRIO do inventário de
// mascotes, maior e independente do bônus de equipamentos (ver
// data/items.js ITEM_INVENTORY_CAP/VIP_INVENTORY_BONUS/getItemInventoryCap
// — esse aqui não muda).
export const PET_INVENTORY_CAP = 200;
export const PET_VIP_INVENTORY_BONUS = 100;

export function getPetInventoryCap(state) {
  return PET_INVENTORY_CAP + (isVipActive(state) ? PET_VIP_INVENTORY_BONUS : 0);
}

/// Valor de reciclagem em Fragmento de Mascote (ver systems/pets.js
/// recyclePet) — usado tanto pro auto-descarte ao bater o limite do
/// inventário quanto pra reciclagem manual. Escala com TIER, raridade e
/// nível de fusão — os 3 juntos, pedido explícito do usuário (antes só
/// escalava com raridade+nível).
const PET_RECYCLE_BASE = 5;

export function getPetRecycleValue(petEntry) {
  const species = getPetSpecies(petEntry.speciesId);
  if (!species) return 0;
  const rarity = getRarity(petEntry.rarityId);
  return Math.round(PET_RECYCLE_BASE * species.tier * rarity.mult * petLevelMultiplier(petEntry.level));
}

// ---------------------------------------------------------------------
// XP de mascote: 2º caminho pra evoluir nível, além de fundir 2 pets
// iguais — "doar" Fragmento de Mascote direto pra barra de XP (ver
// donatePetFragments em systems/pets.js). Custa PET_XP_TO_NEXT_MULTIPLIER×
// o valor de reciclagem de um pet idêntico (mesmo tier/raridade/nível no
// nível ATUAL, antes de subir) — pedido explícito do usuário pra aumentar
// esse custo em 5x (de 3x pra 15x o valor de reciclagem), deixando doar
// fragmentos uma alternativa bem mais cara que fundir 2 pets prontos.
// tier/raridade/nível influenciam os 2 lados (custo de XP E valor de
// reciclagem) pela mesma fórmula-base, então os dois sistemas ficam
// proporcionais entre si por construção.
// ---------------------------------------------------------------------
const PET_XP_TO_NEXT_MULTIPLIER = 15;

export function xpToNextPetLevel(petEntry) {
  return PET_XP_TO_NEXT_MULTIPLIER * getPetRecycleValue(petEntry);
}

/// Aplica XP a um pet "in-place" (muta level/xp), subindo quantos níveis o
/// total permitir em cascata — usado tanto pela doação de fragmentos
/// quanto pela soma de XP ao fundir 2 pets (ver fusePets/
/// fuseAllPossiblePets em systems/pets.js). Nunca passa de PET_MAX_LEVEL;
/// pet já no nível máximo não acumula XP à toa (fica sempre 0).
export function applyPetXp(pet, amount) {
  pet.xp = (pet.xp || 0) + Math.max(0, amount || 0);
  let levelsGained = 0;
  while (pet.level < PET_MAX_LEVEL && pet.xp >= xpToNextPetLevel(pet)) {
    pet.xp -= xpToNextPetLevel(pet);
    pet.level += 1;
    levelsGained += 1;
  }
  if (pet.level >= PET_MAX_LEVEL) pet.xp = 0;
  return levelsGained;
}

// Chances de drop de ovo — baixas em kill normal (parecido com carta),
// bem mais altas ao vencer um dos 3 eventos (Invasão/Torre/Mina de Ouro).
export const WEAK_EGG_DROP_CHANCE = 0.0004; // 0.04%
export const BOSS_EGG_DROP_CHANCE = 0.0012; // 0.12%
export const EVENT_EGG_DROP_CHANCE = 0.08; // 8%, por vitória de evento
