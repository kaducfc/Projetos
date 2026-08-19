import { createDefaultState } from '../state.js';
import { AWAKENING_SHOP_ITEMS } from '../data/awakening.js';
import { recordCardDiscovered } from './cards.js';

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
// (nick/ícone/som) e os pequenos bônus de anúncio em andamento. Fragmento
// do Despertar NÃO entra aqui — transcend() abaixo já soma +1 em cima do
// que sobrou, então também sobrevive, só por um caminho separado.
const PRESERVED_KEYS = [
  'cards', 'cardsDiscovered', 'cardsRewardClaimed',
  'cash', 'lastAdWatchTime', 'vipExpiresAt', 'achievementsClaimed',
  'playerName', 'nameChangesUsed', 'profileIconId', 'unlockedProfileIconIds',
  'settings', 'dpsBoostExpiresAt', 'offlineBonusSeconds',
  // Contadores lifetime das Conquistas (ver data/achievements.js) — têm
  // que sobreviver ao reset abaixo, senão nenhuma conquista de etapa alta
  // seria alcançável (hunterLevel/totalKills/gold/etc voltam a zero a
  // cada Transcender).
  'lifetimeHunterLevel', 'lifetimeTotalKills', 'lifetimeGoldEarned',
  'lifetimeEggsHatched', 'lifetimeRankMasterCount',
  'pvpHighestTierIndex', 'pvpWinsTotal',
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
  // não sobra referência pro uid antigo em lugar nenhum). Hoje a loja só
  // vende carta (sem inventário/uid próprio), mas o código fica pronto pra
  // quando itens de equipamento/mascote entrarem de novo.
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
// Loja do Despertar — comprada com Fragmento do Despertar. Ver
// data/awakening.js AWAKENING_SHOP_ITEMS pro catálogo (por enquanto só a
// carta Supremo — o usuário vai adicionar itens personalizados depois).
// ---------------------------------------------------------------

export function canBuyAwakeningItem(state, itemId) {
  const item = AWAKENING_SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return false;
  return getAwakeningShards(state) >= item.cost;
}

/// Retorna um resumo do que foi concedido ({kind, ...}) pra UI mostrar um
/// toast específico, ou null se a compra foi recusada (canBuyAwakeningItem
/// já bloqueou o botão nesse caso — defensivo).
export function buyAwakeningItem(state, itemId) {
  if (!canBuyAwakeningItem(state, itemId)) return null;
  const item = AWAKENING_SHOP_ITEMS.find((i) => i.id === itemId);
  state.awakeningShards = getAwakeningShards(state) - item.cost;

  if (item.kind === 'card') {
    state.cards[item.cardId] = (state.cards[item.cardId] || 0) + 1;
    recordCardDiscovered(state, item.cardId);
    return { kind: 'card', cardId: item.cardId };
  }

  return null;
}
