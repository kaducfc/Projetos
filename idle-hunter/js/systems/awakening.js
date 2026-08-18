import { createDefaultState } from '../state.js';
import { AWAKENING_SHOP_ITEMS, AWAKENING_ITEM_ZONE_INDEX } from '../data/awakening.js';
import { rollDroppedItem, getItemInventoryCap, DROP_CATEGORIES } from '../data/items.js';
import { CARDS } from '../data/cards.js';
import { recordCardDiscovered } from './cards.js';
import { rollPetCandidate, getPetInventoryCap } from '../data/pets.js';

export function canTranscend(state) {
  return !!state.transcendUnlocked;
}

/// Chamado uma única vez, na 1ª morte do chefe da última zona (ver
/// handleKillEvent em main.js) — nunca desfeito por conta própria, só
/// volta a false depois de Transcender (transcend() abaixo cria um state
/// novo do zero, que exige derrotar o chefe de novo pra liberar outra vez).
export function unlockTranscend(state) {
  if (state.transcendUnlocked) return false;
  state.transcendUnlocked = true;
  return true;
}

export function getTranscendCount(state) {
  return state.transcendCount || 0;
}

export function getAwakeningShards(state) {
  return state.awakeningShards || 0;
}

// Campos que sobrevivem a um Transcender além de cartas e itens/mascotes
// "fromAwakening" (ver transcend() abaixo) — tratados como "conta", não
// "progresso de run": moeda premium/VIP, conquistas já resgatadas, Perfil
// (nick/ícone/som) e os pequenos bônus de anúncio em andamento.
const PRESERVED_KEYS = [
  'cards', 'cardsDiscovered', 'cardsRewardClaimed',
  'cash', 'lastAdWatchTime', 'vipExpiresAt', 'achievementsClaimed',
  'playerName', 'nameChangesUsed', 'profileIconId', 'unlockedProfileIconIds',
  'settings', 'dpsBoostExpiresAt', 'offlineBonusSeconds',
];

/// O reset de prestígio em si — retorna um state NOVO (não muta o
/// recebido); o chamador (main.js) é responsável por reatribuir sua
/// variável `state` local pro valor de retorno. Sem-op (retorna o mesmo
/// state) se Transcender ainda não estiver liberado (defensivo — a UI já
/// esconde o botão nesse caso).
export function transcend(state) {
  if (!canTranscend(state)) return state;

  const fresh = createDefaultState();
  for (const key of PRESERVED_KEYS) {
    fresh[key] = state[key];
  }
  fresh.transcendCount = getTranscendCount(state) + 1;
  fresh.awakeningShards = getAwakeningShards(state) + 1;

  // Itens/mascotes comprados na Loja do Despertar (fromAwakening: true) são
  // a ÚNICA exceção de progresso de run que sobrevive, além das cartas
  // acima — uids recomeçam do 1 (equipped já reseta pra tudo vazio, então
  // não sobra referência pro uid antigo em lugar nenhum).
  let nextUid = 1;
  for (const entry of state.inventory) {
    if (!entry.fromAwakening) continue;
    fresh.inventory.push({ ...entry, uid: nextUid++ });
  }
  fresh.nextUid = nextUid;

  let nextPetUid = 1;
  for (const pet of state.pets) {
    if (!pet.fromAwakening) continue;
    fresh.pets.push({ ...pet, uid: nextPetUid++ });
  }
  fresh.nextPetUid = nextPetUid;

  return fresh;
}

// ---------------------------------------------------------------
// Loja do Despertar — sempre o melhor resultado possível de cada sistema
// (Mítico garantido), comprado com Fragmento do Despertar. Ver
// data/awakening.js AWAKENING_SHOP_ITEMS pro catálogo.
// ---------------------------------------------------------------

/// Carta de chefe pra "Carta Ancestral": prioriza uma que o jogador ainda
/// não descobriu (máximo valor entregue); se já tiver todas, cai pra
/// qualquer carta de chefe (vira duplicata — ainda útil pra reciclar em
/// Fragmento de Carta, ver systems/cards.js).
function pickAwakeningCard(state) {
  const bossCards = CARDS.filter((c) => c.isBossCard);
  const undiscovered = bossCards.filter((c) => !state.cardsDiscovered?.[c.id]);
  const pool = undiscovered.length ? undiscovered : bossCards;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function canBuyAwakeningItem(state, itemId) {
  const item = AWAKENING_SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return false;
  if (getAwakeningShards(state) < item.cost) return false;
  if (item.kind === 'gear' && state.inventory.length >= getItemInventoryCap(state)) return false;
  if (item.kind === 'pet_egg' && state.pets.length >= getPetInventoryCap(state)) return false;
  return true;
}

/// Retorna um resumo do que foi concedido ({kind, ...}) pra UI mostrar um
/// toast específico, ou null se a compra foi recusada (canBuyAwakeningItem
/// já bloqueou o botão nesse caso — defensivo).
export function buyAwakeningItem(state, itemId) {
  if (!canBuyAwakeningItem(state, itemId)) return null;
  const item = AWAKENING_SHOP_ITEMS.find((i) => i.id === itemId);
  state.awakeningShards = getAwakeningShards(state) - item.cost;

  if (item.kind === 'gear') {
    const category = DROP_CATEGORIES[Math.floor(Math.random() * DROP_CATEGORIES.length)];
    const rolled = rollDroppedItem(AWAKENING_ITEM_ZONE_INDEX, category, 'mitico');
    if (!rolled) { state.awakeningShards += item.cost; return null; } // defensivo — não deveria acontecer (ver rollDroppedItem)
    const uid = state.nextUid++;
    state.inventory.push({ uid, ...rolled, fromAwakening: true });
    return { kind: 'gear', uid };
  }

  if (item.kind === 'card') {
    const card = pickAwakeningCard(state);
    state.cards[card.id] = (state.cards[card.id] || 0) + 1;
    recordCardDiscovered(state, card.id);
    return { kind: 'card', cardId: card.id };
  }

  // pet_egg: monta a entrada direto (mesmo shape de addPetToInventory em
  // systems/pets.js) em vez de chamar addPetToInventory, porque
  // canBuyAwakeningItem já garantiu que há vaga — sem isso, um inventário
  // cheio converteria silenciosamente esse mascote caríssimo em Fragmentos.
  const candidate = rollPetCandidate('mitico');
  const uid = state.nextPetUid++;
  state.pets.push({ uid, speciesId: candidate.speciesId, rarityId: candidate.rarityId, level: 1, xp: 0, fromAwakening: true });
  return { kind: 'pet_egg', uid, speciesId: candidate.speciesId };
}
