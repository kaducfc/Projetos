import { BOSSES, WEAK_MONSTER_GROUPS } from './monsters.js';

// One collectible card per monster in the live roster (bosses + weak
// monsters — see monsters.js) — a rare drop from that specific monster
// (BOSS_CARD_DROP_CHANCE / WEAK_CARD_DROP_CHANCE in systems/combat.js —
// fixed rates that drop-bonus upgrades never touch). Socketing one into an
// equipped item's card slot (see socketCard()/unsocketCard() in
// systems/crafting.js) consumes it from state.cards. A card's only effect
// is its own `bonuses` list (ver CARD_EFFECTS abaixo) — sem bônus elemental
// automático nem qualquer outro efeito implícito.

// One-time Cash bonus for finding any given card for the first time ever —
// claimed from the Cartas tab, same "claim once" shape as an achievement
// (see systems/cards.js).
export const CARD_DISCOVERY_CASH_REWARD = 5;

// Arte de carta real pra TODOS os 50 monstros do roster (10 chefes + 40
// fracos, ver assets/cards/*.png) — recebida como c1..c50.png, na ordem
// m1..m50 (ver data/monsters.js): dentro de cada zona de 5, as 4 primeiras
// são os fracos (na mesma ordem de WEAK_MONSTER_GROUPS) e a 5ª (múltiplo de
// 5: c5, c10, ..., c50) é o chefe daquela zona. Chave = monsterId (mesmo id
// usado tanto por BOSSES quanto pelos grupos de fraco), então um mapa único
// cobre os dois — sem essa arte, getCardForMonster() cai no emoji 🃏.
const CARD_IMAGES = {
  // Zona 1
  sylkar: 'assets/cards/sylkar.png',
  musgorn: 'assets/cards/musgorn.png',
  guardiao_druida: 'assets/cards/guardiao_druida.png',
  granclaw: 'assets/cards/granclaw.png',
  chispim: 'assets/cards/chispim.png',
  // Zona 2
  marfang: 'assets/cards/marfang.png',
  mizan: 'assets/cards/mizan.png',
  lyria: 'assets/cards/lyria.png',
  hydrakon: 'assets/cards/hydrakon.png',
  solkaiser: 'assets/cards/solkaiser.png',
  // Zona 3
  esqueleto_guerreiro: 'assets/cards/esqueleto_guerreiro.png',
  assassino_sombrio: 'assets/cards/assassino_sombrio.png',
  garruk: 'assets/cards/garruk.png',
  mimicus: 'assets/cards/mimicus.png',
  tartarok: 'assets/cards/tartarok.png',
  // Zona 4
  plasmion: 'assets/cards/plasmion.png',
  corcel_tempestade: 'assets/cards/corcel_tempestade.png',
  sabion: 'assets/cards/sabion.png',
  serpentorax: 'assets/cards/serpentorax.png',
  colhedor_carmesim: 'assets/cards/colhedor_carmesim.png',
  // Zona 5
  lavasalam: 'assets/cards/lavasalam.png',
  fornitus: 'assets/cards/fornitus.png',
  emberimp: 'assets/cards/emberimp.png',
  ember_warden: 'assets/cards/ember_warden.png',
  grommuk: 'assets/cards/grommuk.png',
  // Zona 6
  luxoris: 'assets/cards/luxoris.png',
  ecliptor: 'assets/cards/ecliptor.png',
  thundrak: 'assets/cards/thundrak.png',
  minotauro_trovao: 'assets/cards/minotauro_trovao.png',
  vulkarion: 'assets/cards/vulkarion.png',
  // Zona 7
  pyrorian: 'assets/cards/pyrorian.png',
  infernus: 'assets/cards/infernus.png',
  sentinela_magma: 'assets/cards/sentinela_magma.png',
  ignivoran: 'assets/cards/ignivoran.png',
  leviargon: 'assets/cards/leviargon.png',
  // Zona 8
  capitao_marvik: 'assets/cards/capitao_marvik.png',
  abissorrok: 'assets/cards/abissorrok.png',
  thalassok: 'assets/cards/thalassok.png',
  serpentyra: 'assets/cards/serpentyra.png',
  tempestron: 'assets/cards/tempestron.png',
  // Zona 9
  thornviel: 'assets/cards/thornviel.png',
  verdanthra: 'assets/cards/verdanthra.png',
  guardiao_verdor: 'assets/cards/guardiao_verdor.png',
  granvorok: 'assets/cards/granvorok.png',
  gaiatron: 'assets/cards/gaiatron.png',
  // Zona 10
  draxorian: 'assets/cards/draxorian.png',
  grommash: 'assets/cards/grommash.png',
  morvanthal: 'assets/cards/morvanthal.png',
  aurelion: 'assets/cards/aurelion.png',
  bahamorth: 'assets/cards/bahamorth.png',
};

// Cada carta (chefe ou monstro fraco) concede uma lista fixa de bônus
// simples (`bonuses` — mesmas chaves de stat genéricas que
// computePlayerStats() já conhece, ver systems/stats.js), sem mais nenhuma
// mecânica "special" hand-coded (a antiga geração de cartas com proc/
// contador/threshold foi inteiramente substituída por esta lista, definida
// pelo usuário para as 50 cartas do roster). `text` é a descrição exata
// mostrada na aba Cartas. Socketar mais de uma cópia da mesma carta (até
// MAX_EQUIPPED_CARD_COPIES, ver systems/crafting.js) soma `bonuses`
// aditivamente (addStat, ver systems/stats.js).
const CARD_EFFECTS = {
  // Zona 1
  sylkar: {
    text: '+8% Velocidade de Ataque, +6 Destreza.',
    bonuses: [{ stat: 'attackSpeedPercent', value: 8 }, { stat: 'destreza', value: 6 }],
  },
  musgorn: {
    text: '+60 Vida, +4 Cura por Golpe.',
    bonuses: [{ stat: 'hpFlat', value: 60 }, { stat: 'lifestealFlat', value: 4 }],
  },
  guardiao_druida: {
    text: '+35 Armadura, +20 Inteligência.',
    bonuses: [{ stat: 'armorFlat', value: 35 }, { stat: 'inteligencia', value: 20 }],
  },
  granclaw: {
    text: '+12% Dano Perfurante, +8 Destreza.',
    bonuses: [{ stat: 'danoPerfuracaoPercent', value: 12 }, { stat: 'destreza', value: 8 }],
  },
  chispim: {
    text: '+10% DPS, +8% Vida, -5% Velocidade de Ataque.',
    bonuses: [
      { stat: 'dpsPercent', value: 10 },
      { stat: 'hpPercent', value: 8 },
      { stat: 'attackSpeedPercent', value: -5 },
    ],
  },
  // Zona 2
  marfang: {
    text: '+12% Dano Físico, +8 Força.',
    bonuses: [{ stat: 'danoFisicoPercent', value: 12 }, { stat: 'forca', value: 8 }],
  },
  mizan: {
    text: '+12% Esquiva, +10% Dano de Mascote.',
    bonuses: [{ stat: 'dodgePercent', value: 12 }, { stat: 'petDamagePercent', value: 10 }],
  },
  lyria: {
    text: '+20 Inteligência, +6 Cura por Golpe.',
    bonuses: [{ stat: 'inteligencia', value: 20 }, { stat: 'lifestealFlat', value: 6 }],
  },
  hydrakon: {
    text: '+15% Dano Mágico, +50 Vida.',
    bonuses: [{ stat: 'danoMagicoPercent', value: 15 }, { stat: 'hpFlat', value: 50 }],
  },
  solkaiser: {
    text: '+12% DPS, +15% Dano Perfurante.',
    bonuses: [{ stat: 'dpsPercent', value: 12 }, { stat: 'danoPerfuracaoPercent', value: 15 }],
  },
  // Zona 3
  esqueleto_guerreiro: {
    text: '+38 Força, -5 Inteligência.',
    bonuses: [{ stat: 'forca', value: 38 }, { stat: 'inteligencia', value: -5 }],
  },
  assassino_sombrio: {
    text: '+10% Chance Crítica, +10 Destreza.',
    bonuses: [{ stat: 'critChancePercent', value: 10 }, { stat: 'destreza', value: 10 }],
  },
  garruk: {
    text: '+15% Dano Físico, +30 Vida.',
    bonuses: [{ stat: 'danoFisicoPercent', value: 15 }, { stat: 'hpFlat', value: 30 }],
  },
  mimicus: {
    text: '+20% Ouro, -5% Vida.',
    bonuses: [{ stat: 'goldPercent', value: 20 }, { stat: 'hpPercent', value: -5 }],
  },
  tartarok: {
    text: '+18% Dano Mágico, +8% Esquiva.',
    bonuses: [{ stat: 'danoMagicoPercent', value: 18 }, { stat: 'dodgePercent', value: 8 }],
  },
  // Zona 4
  plasmion: {
    text: '+30 Inteligência, +10% Dano Mágico.',
    bonuses: [{ stat: 'inteligencia', value: 30 }, { stat: 'danoMagicoPercent', value: 10 }],
  },
  corcel_tempestade: {
    text: '+12% Velocidade de Ataque, +8% Esquiva.',
    bonuses: [{ stat: 'attackSpeedPercent', value: 12 }, { stat: 'dodgePercent', value: 8 }],
  },
  sabion: {
    text: '+20 Inteligência, +8% Chance Crítica.',
    bonuses: [{ stat: 'inteligencia', value: 20 }, { stat: 'critChancePercent', value: 8 }],
  },
  serpentorax: {
    text: '+15% Dano Perfurante, +10% Velocidade de Ataque.',
    bonuses: [{ stat: 'danoPerfuracaoPercent', value: 15 }, { stat: 'attackSpeedPercent', value: 10 }],
  },
  colhedor_carmesim: {
    text: '+18% DPS, +15 Inteligência.',
    bonuses: [{ stat: 'dpsPercent', value: 18 }, { stat: 'inteligencia', value: 15 }],
  },
  // Zona 5
  lavasalam: {
    text: '+15% Dano Físico, +35 Força.',
    bonuses: [{ stat: 'danoFisicoPercent', value: 15 }, { stat: 'forca', value: 35 }],
  },
  fornitus: {
    text: '+50 Armadura, -6% Esquiva.',
    bonuses: [{ stat: 'armorFlat', value: 50 }, { stat: 'dodgePercent', value: -6 }],
  },
  emberimp: {
    text: '+18% Ouro, +8% Drop, +15% Dano de Mascote.',
    bonuses: [
      { stat: 'goldPercent', value: 18 },
      { stat: 'dropPercent', value: 8 },
      { stat: 'petDamagePercent', value: 15 },
    ],
  },
  ember_warden: {
    text: '+35 Armadura, +60 Vida.',
    bonuses: [{ stat: 'armorFlat', value: 35 }, { stat: 'hpFlat', value: 60 }],
  },
  grommuk: {
    text: '+25% Dano Crítico, 5% de Golpe Duplo.',
    bonuses: [{ stat: 'critDamagePercent', value: 25 }, { stat: 'doubleHitChance', value: 5 }],
  },
  // Zona 6
  luxoris: {
    text: '+35 Inteligência, +15% Drop.',
    bonuses: [{ stat: 'inteligencia', value: 35 }, { stat: 'dropPercent', value: 15 }],
  },
  ecliptor: {
    text: '+12% Chance Crítica, +10% Esquiva.',
    bonuses: [{ stat: 'critChancePercent', value: 12 }, { stat: 'dodgePercent', value: 10 }],
  },
  thundrak: {
    text: '+18% DPS, +15 Força.',
    bonuses: [{ stat: 'dpsPercent', value: 18 }, { stat: 'forca', value: 15 }],
  },
  minotauro_trovao: {
    text: '+60 Força, -5% Esquiva.',
    bonuses: [{ stat: 'forca', value: 60 }, { stat: 'dodgePercent', value: -5 }],
  },
  vulkarion: {
    text: '+15% Velocidade de Ataque, +20% Dano de Mascote.',
    bonuses: [{ stat: 'attackSpeedPercent', value: 15 }, { stat: 'petDamagePercent', value: 20 }],
  },
  // Zona 7
  pyrorian: {
    text: '+50 Inteligência, +15% Dano Mágico.',
    bonuses: [{ stat: 'inteligencia', value: 50 }, { stat: 'danoMagicoPercent', value: 15 }],
  },
  infernus: {
    text: '+20% Dano Físico, -50 Vida.',
    bonuses: [{ stat: 'danoFisicoPercent', value: 20 }, { stat: 'hpFlat', value: -50 }],
  },
  sentinela_magma: {
    text: '+60 Armadura, +30 Força.',
    bonuses: [{ stat: 'armorFlat', value: 60 }, { stat: 'forca', value: 30 }],
  },
  ignivoran: {
    text: '+10% Chance Crítica, +15% Velocidade de Ataque.',
    bonuses: [{ stat: 'critChancePercent', value: 10 }, { stat: 'attackSpeedPercent', value: 15 }],
  },
  leviargon: {
    text: '+20% DPS, +60 Armadura.',
    bonuses: [{ stat: 'dpsPercent', value: 20 }, { stat: 'armorFlat', value: 60 }],
  },
  // Zona 8
  capitao_marvik: {
    text: '+25% Ouro, +10% Vida.',
    bonuses: [{ stat: 'goldPercent', value: 25 }, { stat: 'hpPercent', value: 10 }],
  },
  abissorrok: {
    text: '+110 Vida, +20% Dano de Mascote.',
    bonuses: [{ stat: 'hpFlat', value: 110 }, { stat: 'petDamagePercent', value: 20 }],
  },
  thalassok: {
    text: '+15% DPS, +12% Vida.',
    bonuses: [{ stat: 'dpsPercent', value: 15 }, { stat: 'hpPercent', value: 12 }],
  },
  serpentyra: {
    text: '+15% Dano Crítico, +20% Dano de Mascote.',
    bonuses: [{ stat: 'critDamagePercent', value: 15 }, { stat: 'petDamagePercent', value: 20 }],
  },
  tempestron: {
    text: '+15% Vida, +20% DPS.',
    bonuses: [{ stat: 'hpPercent', value: 15 }, { stat: 'dpsPercent', value: 20 }],
  },
  // Zona 9
  thornviel: {
    text: '+15% Esquiva, +62 Destreza.',
    bonuses: [{ stat: 'dodgePercent', value: 15 }, { stat: 'destreza', value: 62 }],
  },
  verdanthra: {
    text: '+30% Drop.',
    bonuses: [{ stat: 'dropPercent', value: 30 }],
  },
  guardiao_verdor: {
    text: '+150 Vida, +18% Drop.',
    bonuses: [{ stat: 'hpFlat', value: 150 }, { stat: 'dropPercent', value: 18 }],
  },
  granvorok: {
    text: '+60 Força, +15% Vida.',
    bonuses: [{ stat: 'forca', value: 60 }, { stat: 'hpPercent', value: 15 }],
  },
  gaiatron: {
    text: '+15% Vida, +10% de Golpe Duplo, +15 Cura por Golpe.',
    bonuses: [
      { stat: 'hpPercent', value: 15 },
      { stat: 'doubleHitChance', value: 10 },
      { stat: 'lifestealFlat', value: 15 },
    ],
  },
  // Zona 10
  draxorian: {
    text: '+18% DPS, +15% Armadura.',
    bonuses: [{ stat: 'dpsPercent', value: 18 }, { stat: 'armorPercent', value: 15 }],
  },
  grommash: {
    text: '+100 Força, -8% Velocidade de Ataque.',
    bonuses: [{ stat: 'forca', value: 100 }, { stat: 'attackSpeedPercent', value: -8 }],
  },
  morvanthal: {
    text: '+25% Dano Mágico, +15% Dano Crítico.',
    bonuses: [{ stat: 'danoMagicoPercent', value: 25 }, { stat: 'critDamagePercent', value: 15 }],
  },
  aurelion: {
    text: '+15% Vida, +250 Vida, +12% de Golpe Duplo.',
    bonuses: [
      { stat: 'hpPercent', value: 15 },
      { stat: 'hpFlat', value: 250 },
      { stat: 'doubleHitChance', value: 12 },
    ],
  },
  bahamorth: {
    text: '+25% DPS, +15% de Golpe Duplo, +15% Dano Crítico, +20% Dano de Mascote.',
    bonuses: [
      { stat: 'dpsPercent', value: 25 },
      { stat: 'doubleHitChance', value: 15 },
      { stat: 'critDamagePercent', value: 15 },
      { stat: 'petDamagePercent', value: 20 },
    ],
  },
};

function cardDescription(effect) {
  return effect ? effect.text : 'Efeito adicional ainda não definido.';
}

export const CARDS = [
  ...BOSSES.map((boss, zoneIndex) => {
    const effect = CARD_EFFECTS[boss.id] || null;
    return {
      id: `${boss.id}_card`,
      monsterId: boss.id,
      isBossCard: true,
      zoneIndex,
      name: `Carta de ${boss.name}`,
      emoji: '🃏',
      image: CARD_IMAGES[boss.id] || null,
      element: boss.element,
      bonuses: effect ? effect.bonuses : [],
      description: cardDescription(effect),
    };
  }),
  ...WEAK_MONSTER_GROUPS.flatMap((group, zoneIndex) => group.monsters.map((monster) => ({ monster, zoneIndex }))).map(({ monster, zoneIndex }) => {
    const effect = CARD_EFFECTS[monster.id] || null;
    return {
      id: `${monster.id}_card`,
      monsterId: monster.id,
      isBossCard: false,
      zoneIndex,
      name: `Carta de ${monster.name}`,
      emoji: '🃏',
      image: CARD_IMAGES[monster.id] || null,
      element: monster.element,
      bonuses: effect ? effect.bonuses : [],
      description: cardDescription(effect),
    };
  }),
];

// Fragmento de Carta (ver systems/cards.js recycleCard/craftCard): quanto
// mais avançada a zona da carta, mais fragmentos ela dá ao ser reciclada —
// 10 por zona pra carta de monstro fraco, 20 por zona pra carta de chefe
// (Zona 1: 10/20, Zona 2: 20/40, ..., Zona 10: 100/200). Craftar essa
// mesma carta de volta custa 10x o valor de reciclagem dela.
export const CARD_FRAGMENT_ID = 'card_fragment';
export const CARD_FRAGMENT_NAME = 'Fragmento de Carta';
export const CARD_FRAGMENT_EMOJI = '🧩';
const CARD_CRAFT_COST_MULTIPLIER = 10;

export function getCardRecycleValue(card) {
  const zoneNumber = card.zoneIndex + 1;
  return (card.isBossCard ? 20 : 10) * zoneNumber;
}

export function getCardCraftCost(card) {
  return getCardRecycleValue(card) * CARD_CRAFT_COST_MULTIPLIER;
}

export function getCard(cardId) {
  return CARDS.find((c) => c.id === cardId);
}

// monsterId is unique across bosses and weak monsters (no collisions), so
// one lookup covers both.
export function getCardForMonster(monsterId) {
  return CARDS.find((c) => c.monsterId === monsterId);
}
