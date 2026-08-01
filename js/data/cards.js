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

// Real card art now exists for all 10 bosses (see assets/cards/*.png) —
// any boss missing here would fall back to the 🃏 emoji, same as every
// weak-monster card for now.
const CARD_IMAGES = {
  // Reusa o sprite de batalha (não tem arte de carta dedicada pro reskin
  // Thornak, ver data/monsters.js BOSSES[0]) — melhor que continuar
  // mostrando o Chispim antigo numa carta que agora se chama "Carta de
  // Thornak".
  chispim: 'assets/thornak/monster.png',
  // Mesmo motivo do Thornak acima — reskin Marokar (ver data/monsters.js
  // BOSSES[1]) sem arte de carta dedicada, reusa o sprite de batalha.
  solkaiser: 'assets/marokar/monster.png',
  // Mesmo motivo acima — reskin Vorlith (ver data/monsters.js BOSSES[2]).
  tartarok: 'assets/vorlith/monster.png',
  // Mesmo motivo acima — reskin Eletyra (ver data/monsters.js BOSSES[3]).
  colhedor_carmesim: 'assets/eletyra/monster.png',
  // Mesmo motivo acima — reskin Pyravalis (ver data/monsters.js BOSSES[4]).
  grommuk: 'assets/pyravalis/monster.png',
  // Mesmo motivo acima — reskin Vortexor (ver data/monsters.js BOSSES[5]).
  vulkarion: 'assets/vortexor/monster.png',
  // Mesmo motivo acima — reskin Magmarok (ver data/monsters.js BOSSES[6]).
  leviargon: 'assets/magmarok/monster.png',
  tempestron: 'assets/cards/tempestron.png',
  gaiatron: 'assets/cards/gaiatron.png',
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
    image: null,
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
