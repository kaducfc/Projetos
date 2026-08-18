import { ZONE_COUNT } from './monsters.js';

// Transcender (ver systems/awakening.js): um reset de prestígio liberado
// depois de derrotar pela 1ª vez o chefe da última zona. Cada Transcender
// concede 1 Fragmento do Despertar (acumulável) e reseta o jogo quase
// inteiro — só cartas e itens/mascotes comprados na Loja do Despertar
// sobrevivem (ver systems/awakening.js PRESERVED_KEYS).
export const AWAKENING_SHARD_ID = 'awakening_shard';
export const AWAKENING_SHARD_NAME = 'Fragmento do Despertar';
export const AWAKENING_SHARD_EMOJI = '🌌';

// Zona usada pra escalar o equipamento da Loja do Despertar — a última
// (mesmo poder-base do fim de jogo), sempre Mítico garantido (ver
// systems/awakening.js buyAwakeningItem/rollDroppedItem forcedRarityId).
export const AWAKENING_ITEM_ZONE_INDEX = ZONE_COUNT - 1;

// Catálogo inicial da Loja do Despertar — 3 tipos (equipamento/carta/
// mascote), cada um sempre no MELHOR resultado possível daquele sistema
// (Mítico garantido), por isso o preço alto em Fragmentos. Primeira
// leva, fácil de re-tunar/expandir depois (mesmo espírito de
// CASH_SHOP_ITEMS em data/shop.js).
export const AWAKENING_SHOP_ITEMS = [
  {
    id: 'awk_gear', name: 'Relíquia do Despertar', emoji: '🌌', kind: 'gear', cost: 5,
    description: 'Um equipamento Mítico garantido, do mesmo poder do fim de jogo.',
  },
  {
    id: 'awk_card', name: 'Carta Ancestral', emoji: '🃏', kind: 'card', cost: 8,
    description: 'Uma carta de chefe garantida — prioriza uma que você ainda não tem.',
  },
  {
    id: 'awk_pet_egg', name: 'Ovo Primordial', emoji: '🥚', kind: 'pet_egg', cost: 10,
    description: 'Um mascote Mítico garantido, pronto pra equipar.',
  },
];
