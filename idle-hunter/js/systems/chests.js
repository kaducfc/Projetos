import { CHEST_DAILY_LIMIT, getChest } from '../data/chests.js';
import { PETS } from '../data/pets.js';
import { addPetToInventory } from './pets.js';
import { CARDS, CARD_FRAGMENT_ID } from '../data/cards.js';
import { recordCardDiscovered } from './cards.js';

// Mesma conta de reset diário 00:00 UTC (= 21h de Brasília) já usada por
// Missões Diárias (ver nextDailyMissionResetAt em systems/dailyMissions.js)
// e Arena (systems/pvp.js) — duplicada aqui de propósito, mesma razão: Baús
// não deveria depender de outro módulo só por uma conta de horário que os
// dois compartilham por coincidência.
function nextChestResetAt(now = Date.now()) {
  const d = new Date(now);
  const todayReset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  return todayReset > now ? todayReset : todayReset + 24 * 60 * 60 * 1000;
}

/// Garante que state.chestPurchases existe e não passou do reset — chamada
/// sempre que a aba/contagem é lida ou um baú é comprado. Zera as 4
/// contagens (3/3 -> 0/3) sempre que o reset já passou.
export function ensureChestPurchasesFresh(state, now = Date.now()) {
  if (!state.chestPurchases || now >= state.chestPurchases.resetAt) {
    state.chestPurchases = { resetAt: nextChestResetAt(now), counts: {} };
    return true;
  }
  return false;
}

export function getChestPurchasesToday(state, chestId) {
  ensureChestPurchasesFresh(state);
  return state.chestPurchases.counts[chestId] || 0;
}

export function getChestPurchasesRemaining(state, chestId) {
  return Math.max(0, CHEST_DAILY_LIMIT - getChestPurchasesToday(state, chestId));
}

function chestCurrencyBalance(state, chest) {
  if (chest.costType === 'gold') return state.gold;
  if (chest.costType === 'event') return state.eventCurrency;
  if (chest.costType === 'cash') return state.cash;
  return 0;
}

export function canBuyChest(state, chestId) {
  const chest = getChest(chestId);
  if (!chest) return false;
  if (getChestPurchasesRemaining(state, chestId) <= 0) return false;
  return chestCurrencyBalance(state, chest) >= chest.cost;
}

function pickWeightedEntry(pool) {
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return pool[pool.length - 1];
}

/// Sorteia 1 espécie de mascote Tier 5 (1 das 4, uma por elemento — ver
/// PETS/PET_SPECIES_BY_ELEMENT em data/pets.js) com a raridade FORÇADA pelo
/// pool do baú (ver data/chests.js) — diferente de rollPetCandidate (usada
/// no choco de ovo normal), que sorteia entre as 20 espécies de qualquer
/// tier.
function rollTier5PetCandidate(rarityId) {
  const tier5Species = PETS.filter((p) => p.tier === 5);
  const species = tier5Species[Math.floor(Math.random() * tier5Species.length)];
  return { speciesId: species.id, rarityId, level: 1 };
}

function grantCardRandom(state, entry) {
  const candidates = CARDS.filter((c) => !c.isGodCard
    && c.zoneIndex >= entry.zoneMin && c.zoneIndex <= entry.zoneMax
    && c.isBossCard === entry.bossOnly);
  if (candidates.length === 0) return null;
  const card = candidates[Math.floor(Math.random() * candidates.length)];
  state.cards[card.id] = (state.cards[card.id] || 0) + 1;
  recordCardDiscovered(state, card.id);
  return card;
}

/// Aplica a recompensa sorteada (1 entrada do pool, ver pickWeightedEntry)
/// ao state e devolve um descritor pro popup de resultado (ver openChest
/// abaixo) — cada `type` resolve sozinho onde a recompensa vai (moeda
/// solta, inventário de pets/cartas...), quem chama não precisa saber a
/// mecânica de nenhum sistema por trás.
function applyReward(state, entry) {
  switch (entry.type) {
    case 'egg':
      state.eggCount = (state.eggCount || 0) + entry.amount;
      return { type: 'egg', amount: entry.amount };
    case 'petFragment':
      state.petFragments = (state.petFragments || 0) + entry.amount;
      return { type: 'petFragment', amount: entry.amount };
    case 'cardFragment':
      state.materials[CARD_FRAGMENT_ID] = (state.materials[CARD_FRAGMENT_ID] || 0) + entry.amount;
      return { type: 'cardFragment', amount: entry.amount };
    case 'awakeningShard':
      state.awakeningShards = (state.awakeningShards || 0) + entry.amount;
      return { type: 'awakeningShard', amount: entry.amount };
    case 'petTier5': {
      const candidate = rollTier5PetCandidate(entry.rarityId);
      const result = addPetToInventory(state, candidate);
      return {
        type: 'pet', rarityId: entry.rarityId, speciesId: candidate.speciesId,
        discarded: result.discarded, fragments: result.fragments,
      };
    }
    case 'cardRandom': {
      const card = grantCardRandom(state, entry);
      return card ? { type: 'card', card } : null;
    }
    default:
      return null;
  }
}

/// Abre 1 Baú: cobra o custo (ouro/Moeda de Evento/Esmeralda conforme
/// chest.costType), soma 1 na contagem diária e sorteia+aplica 1
/// recompensa do pool. Retorna null se não pôde comprar (limite diário
/// batido ou moeda insuficiente — ver canBuyChest) sem cobrar nada.
export function openChest(state, chestId) {
  if (!canBuyChest(state, chestId)) return null;
  const chest = getChest(chestId);
  if (chest.costType === 'gold') state.gold -= chest.cost;
  else if (chest.costType === 'event') state.eventCurrency -= chest.cost;
  else if (chest.costType === 'cash') state.cash -= chest.cost;
  ensureChestPurchasesFresh(state);
  state.chestPurchases.counts[chestId] = (state.chestPurchases.counts[chestId] || 0) + 1;
  const entry = pickWeightedEntry(chest.pool);
  return applyReward(state, entry);
}
