import { SUPREMO_CARD_ID } from './cards.js';

// Transcender (ver systems/awakening.js): um reset de prestígio liberado
// depois de derrotar pela 1ª vez o chefe da última zona. Cada Transcender
// concede 1 Fragmento do Despertar (acumulável) e reseta o jogo quase
// inteiro — só cartas e itens/mascotes comprados na Loja do Despertar
// sobrevivem (ver systems/awakening.js PRESERVED_KEYS).
export const AWAKENING_SHARD_ID = 'awakening_shard';
export const AWAKENING_SHARD_NAME = 'Fragmento do Despertar';
export const AWAKENING_SHARD_EMOJI = '🌌';

// Catálogo da Loja do Despertar — por enquanto só a carta Supremo
// (placeholder; o usuário vai criar os itens personalizados depois). Cada
// entrada carrega `kind` + o id do que ela concede, lido por
// systems/awakening.js buyAwakeningItem.
export const AWAKENING_SHOP_ITEMS = [
  {
    id: 'awk_supremo_card', name: 'Supremo', emoji: '🌌', kind: 'card', cardId: SUPREMO_CARD_ID, cost: 1,
    description: '+50% de DPS quando equipada.',
  },
];
