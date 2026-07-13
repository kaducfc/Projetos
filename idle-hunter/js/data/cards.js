import { BOSSES, WEAK_MONSTER_GROUPS } from './monsters.js';
import { getElement } from './elements.js';

// One collectible card per monster in the live roster (bosses + weak
// monsters — see monsters.js) — a rare drop from that specific monster
// (MONSTER_CARD_DROP_CHANCE in systems/combat.js — one fixed rate for both
// bosses and weak monsters, that drop-bonus upgrades never touch). Socketing
// one into an equipped item's card slot (see socketCard()/unsocketCard() in
// systems/crafting.js) consumes it from state.cards.
//
// Every card (boss or weak monster) grants the same generic elemental-damage
// bonus via its `element`, exactly like elementDamageModifier() does for gear
// (see getCardDamageBonus() in systems/stats.js).
export const CARD_DAMAGE_BONUS = 0.03;

// Real card art exists so far for these 9 bosses only (see
// assets/cards/*.png) — any boss missing here just falls back to the 🃏
// emoji, same as every weak-monster card for now.
const CARD_IMAGES = {
  chispim: 'assets/cards/chispim.png',
  solkaiser: 'assets/cards/solkaiser.png',
  tartarok: 'assets/cards/tartarok.png',
  colhedor_carmesim: 'assets/cards/colhedor_carmesim.png',
  grommuk: 'assets/cards/grommuk.png',
  vulkarion: 'assets/cards/vulkarion.png',
  tempestron: 'assets/cards/tempestron.png',
  gaiatron: 'assets/cards/gaiatron.png',
  bahamorth: 'assets/cards/bahamorth.png',
};

// PLACEHOLDER bonuses, one per boss, just so each boss card actually feels
// different while the real roster of effects gets designed one by one —
// stat/value pairs picked arbitrarily (not runtime RNG, so they're stable
// across sessions), same stat keys computePlayerStats() already knows about
// (see systems/stats.js). Expect these to be replaced wholesale.
const CARD_BONUSES = {
  chispim: { stat: 'dpsPercent', value: 2 },
  solkaiser: { stat: 'clickPercent', value: 2 },
  tartarok: { stat: 'hpFlat', value: 50 },
  colhedor_carmesim: { stat: 'dropPercent', value: 2 },
  grommuk: { stat: 'armorFlat', value: 10 },
  vulkarion: { stat: 'clickFlat', value: 5 },
  leviargon: { stat: 'goldPercent', value: 3 },
  tempestron: { stat: 'dpsFlat', value: 5 },
  gaiatron: { stat: 'hpFlat', value: 50 },
  bahamorth: { stat: 'clickPercent', value: 3 },
};

function formatBonus(bonus) {
  if (!bonus) return '';
  const { stat, value } = bonus;
  switch (stat) {
    case 'clickFlat': return `+${value} de Dano de Clique`;
    case 'dpsFlat': return `+${value} de DPS`;
    case 'clickPercent': return `+${value}% de Dano de Clique`;
    case 'dpsPercent': return `+${value}% de DPS`;
    case 'goldPercent': return `+${value}% de Ouro`;
    case 'dropPercent': return `+${value}% de Chance de Drop`;
    case 'hpFlat': return `+${value} de Vida Máxima`;
    case 'armorFlat': return `+${value} de Armadura`;
    default: return '';
  }
}

function cardDescription(name, elementId, bonus) {
  const element = getElement(elementId);
  const elementLine = element.id === 'neutro'
    ? ''
    : ` +${Math.round(CARD_DAMAGE_BONUS * 100)}% de dano contra inimigos do elemento ${element.name}.`;
  const bonusLine = bonus
    ? ` ${formatBonus(bonus)} (provisório, será rebalanceado).`
    : ' Efeito adicional ainda não definido.';
  return `Poder selado de ${name}.${elementLine}${bonusLine}`;
}

export const CARDS = [
  ...BOSSES.map((boss) => {
    const bonus = CARD_BONUSES[boss.id] || null;
    return {
      id: `${boss.id}_card`,
      monsterId: boss.id,
      isBossCard: true,
      name: `Carta de ${boss.name}`,
      emoji: '🃏',
      image: CARD_IMAGES[boss.id] || null,
      element: boss.element,
      bonus,
      description: cardDescription(boss.name, boss.element, bonus),
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
    bonus: null,
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
