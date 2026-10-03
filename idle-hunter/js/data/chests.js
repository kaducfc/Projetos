// Baús: gacha da sub-aba "Baús" da Loja (substituiu a antiga sub-aba
// "Evento", que vendia material de chefe direto por Moeda de Evento — ver
// ui/render.js chestsShopHtml / systems/chests.js openChest). 4 baús fixos,
// cada um com custo/moeda própria e limite de compra diário
// (CHEST_DAILY_LIMIT). Cada pool é uma lista de recompensas com peso
// relativo (`weight`) — a soma de cada pool bate ~100 só por clareza de
// leitura (não precisa bater exato, pickWeightedEntry em systems/chests.js
// normaliza pelo total de qualquer jeito).
//
// Ordem de qualidade pedida pelo usuário: Premium > Evento > Cartas >
// Mascote — Premium é o único com Fragmento do Despertar no pool e foca as
// cartas só em Zona 9-10; Evento mistura mascote+carta com odds boas;
// Cartas/Mascote ficam restritos ao próprio tema, com os prêmios de topo
// (Mítico/Super Raro) bem raros.
//
// `type` de cada entrada do pool (ver applyReward em systems/chests.js):
//   'egg'            { amount }                        -> +N Ovo de Mascote
//   'petFragment'    { amount }                         -> +N Fragmento de Mascote
//   'cardFragment'   { amount }                         -> +N Fragmento de Carta
//   'petTier5'       { rarityId }                        -> 1 mascote Tier 5 aleatório, raridade forçada
//   'cardRandom'     { zoneMin, zoneMax, bossOnly }       -> 1 carta aleatória nesse range de zona
//   'awakeningShard' { amount }                          -> +N Fragmento do Despertar

export const CHEST_DAILY_LIMIT = 3;

export const CHESTS = {
  mascote: {
    id: 'mascote',
    name: 'Baú de Mascote',
    image: 'assets/ui/chests/mascote.png',
    costType: 'gold',
    cost: 500000,
    pool: [
      { type: 'egg', amount: 5, weight: 25 },
      { type: 'egg', amount: 10, weight: 20 },
      { type: 'egg', amount: 20, weight: 15 },
      { type: 'egg', amount: 35, weight: 8 },
      { type: 'egg', amount: 50, weight: 4 },
      { type: 'petFragment', amount: 50, weight: 10 },
      { type: 'petFragment', amount: 120, weight: 8 },
      { type: 'petFragment', amount: 250, weight: 5 },
      { type: 'petFragment', amount: 500, weight: 2 },
      { type: 'petTier5', rarityId: 'mitico', weight: 3 },
    ],
  },
  cartas: {
    id: 'cartas',
    name: 'Baú de Cartas',
    image: 'assets/ui/chests/cartas.png',
    costType: 'gold',
    cost: 1000000,
    pool: [
      { type: 'cardFragment', amount: 100, weight: 32.7 },
      { type: 'cardFragment', amount: 250, weight: 23.3 },
      { type: 'cardFragment', amount: 500, weight: 14 },
      { type: 'cardFragment', amount: 1000, weight: 7 },
      { type: 'cardRandom', zoneMin: 0, zoneMax: 7, bossOnly: false, weight: 10.5 },
      { type: 'cardRandom', zoneMin: 0, zoneMax: 7, bossOnly: true, weight: 5.6 },
      { type: 'cardRandom', zoneMin: 8, zoneMax: 9, bossOnly: false, weight: 4.5 },
      { type: 'cardRandom', zoneMin: 8, zoneMax: 9, bossOnly: true, weight: 1.4 },
      { type: 'cardFragment', amount: 3000, weight: 1 },
    ],
  },
  evento: {
    id: 'evento',
    name: 'Baú de Evento',
    image: 'assets/ui/chests/evento.png',
    costType: 'event',
    cost: 300,
    pool: [
      { type: 'egg', amount: 20, weight: 20 },
      { type: 'egg', amount: 50, weight: 10 },
      { type: 'petFragment', amount: 300, weight: 18.5 },
      { type: 'petFragment', amount: 600, weight: 13 },
      { type: 'petTier5', rarityId: 'epico', weight: 7 },
      { type: 'petTier5', rarityId: 'lendario', weight: 3 },
      { type: 'petTier5', rarityId: 'mitico', weight: 1 },
      { type: 'cardFragment', amount: 500, weight: 7.5 },
      { type: 'cardFragment', amount: 1000, weight: 5 },
      { type: 'cardRandom', zoneMin: 0, zoneMax: 7, bossOnly: false, weight: 6 },
      { type: 'cardRandom', zoneMin: 0, zoneMax: 7, bossOnly: true, weight: 4 },
      { type: 'cardRandom', zoneMin: 8, zoneMax: 9, bossOnly: false, weight: 3 },
      { type: 'cardRandom', zoneMin: 8, zoneMax: 9, bossOnly: true, weight: 1.5 },
      { type: 'awakeningShard', amount: 1, weight: 0.5 },
    ],
  },
  premium: {
    id: 'premium',
    name: 'Baú Premium',
    image: 'assets/ui/chests/premium.png',
    costType: 'cash',
    cost: 100,
    pool: [
      { type: 'egg', amount: 50, weight: 14 },
      { type: 'egg', amount: 100, weight: 6 },
      { type: 'petFragment', amount: 800, weight: 15 },
      { type: 'petFragment', amount: 1500, weight: 7 },
      { type: 'petTier5', rarityId: 'epico', weight: 7.5 },
      { type: 'petTier5', rarityId: 'lendario', weight: 5 },
      { type: 'petTier5', rarityId: 'mitico', weight: 1.5 },
      { type: 'cardFragment', amount: 1500, weight: 15 },
      { type: 'cardFragment', amount: 3000, weight: 8 },
      { type: 'cardRandom', zoneMin: 8, zoneMax: 9, bossOnly: false, weight: 12 },
      { type: 'cardRandom', zoneMin: 8, zoneMax: 9, bossOnly: true, weight: 8 },
      { type: 'awakeningShard', amount: 1, weight: 1 },
    ],
  },
};

export const CHEST_ORDER = ['mascote', 'cartas', 'evento', 'premium'];

export function getChest(chestId) {
  return CHESTS[chestId] || null;
}
