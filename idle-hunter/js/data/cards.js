import { BOSSES, WEAK_MONSTER_GROUPS } from './monsters.js';
import { getElement } from './elements.js';

// One collectible card per monster in the live roster (bosses + weak
// monsters — see monsters.js) — a rare drop from that specific monster
// (BOSS_CARD_DROP_CHANCE / WEAK_CARD_DROP_CHANCE in systems/combat.js —
// fixed rates that drop-bonus upgrades never touch). Socketing one into an
// equipped item's card slot (see socketCard()/unsocketCard() in
// systems/crafting.js) consumes it from state.cards.
//
// Every card (boss or weak monster) grants the same generic elemental-damage
// bonus via its `element`, exactly like elementDamageModifier() does for gear
// (see getCardDamageBonus() in systems/stats.js).
export const CARD_DAMAGE_BONUS = 0.03;

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

// One boss card's full effect = a list of simple, always-on stat bonuses
// (`bonuses` — same generic stat keys computePlayerStats() already knows,
// see systems/stats.js) plus at most one `special` — a named, hand-coded
// mechanic (conditional bonus, proc, hit-counter burst) that stats.js/
// combat.js/main.js implement individually by special.id, since none of
// these fit the generic stat-sum model. `text` is the exact effect
// description shown in the Cartas tab (kept as authored, not
// auto-generated, since the mechanics are too varied for one template).
// Socketing more than one copy of the same card (up to
// MAX_EQUIPPED_CARD_COPIES, see systems/crafting.js) stacks `bonuses`
// additively (ordinary addStat loop) and scales `special`'s magnitude by
// however many copies are equipped — see systems/stats.js.
const CARD_EFFECTS = {
  chispim: {
    text: '+8% DPS. Todo ouro coletado possui 20% de chance de ser dobrado.',
    bonuses: [{ stat: 'dpsPercent', value: 8 }],
    special: { id: 'gold_double_chance', chance: 20 },
  },
  solkaiser: {
    text: 'A cada 50 golpes, o próximo golpe causa 600% do dano normal e sempre é crítico.',
    bonuses: [],
    special: { id: 'hit_counter_burst', everyN: 50, damageMult: 6 },
  },
  tartarok: {
    text: 'Aumenta 20% da vida, 20% da armadura, +20% ouro.',
    bonuses: [
      { stat: 'hpPercent', value: 20 },
      { stat: 'armorPercent', value: 20 },
      { stat: 'goldPercent', value: 20 },
    ],
  },
  colhedor_carmesim: {
    text: 'Enquanto estiver com HP acima de 80%: +45% DPS.',
    bonuses: [],
    special: { id: 'hp_threshold_dps', threshold: 80, dpsPercent: 45 },
  },
  grommuk: {
    text: 'Enquanto todos os equipamentos forem do mesmo elemento: +60% DPS.',
    bonuses: [],
    special: { id: 'same_element_set', dpsPercent: 60 },
  },
  vulkarion: {
    text: 'Quanto menor sua vida, maior seu DPS. Bônus máximo: +60%.',
    bonuses: [],
    special: { id: 'low_hp_dps_scale', maxBonusPercent: 60 },
  },
  leviargon: {
    text: 'Chance de crítico +15%, dano crítico +50%.',
    bonuses: [
      { stat: 'critChancePercent', value: 15 },
      { stat: 'critDamagePercent', value: 50 },
    ],
  },
  tempestron: {
    text: '+35% Ouro, +35% Materiais, +15% DPS.',
    bonuses: [
      { stat: 'goldPercent', value: 35 },
      { stat: 'dropPercent', value: 35 },
      { stat: 'dpsPercent', value: 15 },
    ],
  },
  gaiatron: {
    text: 'DPS +10%. Ao derrotar um Boss: 10% de chance de derrotá-lo novamente instantaneamente, recebendo todas as recompensas outra vez.',
    bonuses: [{ stat: 'dpsPercent', value: 10 }],
    special: { id: 'boss_kill_reproc', chance: 10 },
  },
  bahamorth: {
    text: 'Todos os atributos aumentam em 15% (DPS, Velocidade de Ataque, Ouro, Drop, Crítico, Vida, Armadura).',
    bonuses: [
      { stat: 'dpsPercent', value: 15 },
      { stat: 'attackSpeedPercent', value: 15 },
      { stat: 'goldPercent', value: 15 },
      { stat: 'dropPercent', value: 15 },
      { stat: 'critChancePercent', value: 15 },
      { stat: 'critDamagePercent', value: 15 },
      { stat: 'hpPercent', value: 15 },
      { stat: 'armorPercent', value: 15 },
    ],
  },
};

function cardDescription(name, elementId, effect) {
  const element = getElement(elementId);
  const elementLine = element.id === 'neutro'
    ? ''
    : ` +${Math.round(CARD_DAMAGE_BONUS * 100)}% de dano contra inimigos do elemento ${element.name}.`;
  const effectLine = effect ? ` ${effect.text}` : ' Efeito adicional ainda não definido.';
  return `Poder selado de ${name}.${elementLine}${effectLine}`;
}

export const CARDS = [
  ...BOSSES.map((boss) => {
    const effect = CARD_EFFECTS[boss.id] || null;
    return {
      id: `${boss.id}_card`,
      monsterId: boss.id,
      isBossCard: true,
      name: `Carta de ${boss.name}`,
      emoji: '🃏',
      image: CARD_IMAGES[boss.id] || null,
      element: boss.element,
      bonuses: effect ? effect.bonuses : [],
      special: effect ? effect.special || null : null,
      description: cardDescription(boss.name, boss.element, effect),
    };
  }),
  ...WEAK_MONSTER_GROUPS.flatMap((group) => group.monsters).map((monster) => ({
    id: `${monster.id}_card`,
    monsterId: monster.id,
    isBossCard: false,
    name: `Carta de ${monster.name}`,
    emoji: '🃏',
    image: CARD_IMAGES[monster.id] || null,
    element: monster.element,
    bonuses: [],
    special: null,
    description: cardDescription(monster.name, monster.element, null),
  })),
];

export function getCard(cardId) {
  return CARDS.find((c) => c.id === cardId);
}

// monsterId is unique across bosses and weak monsters (no collisions), so
// one lookup covers both.
export function getCardForMonster(monsterId) {
  return CARDS.find((c) => c.monsterId === monsterId);
}
