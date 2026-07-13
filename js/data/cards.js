import { BOSSES, WEAK_MONSTER_GROUPS } from './monsters.js';
import { getElement } from './elements.js';

// One collectible card per monster in the live roster (bosses + weak
// monsters — see monsters.js) — a rare drop from that specific monster
// (MONSTER_CARD_DROP_CHANCE in systems/combat.js — one fixed rate for both
// bosses and weak monsters, that drop-bonus upgrades never touch). Socketing
// one into
// an equipped item's card slot (see socketCard()/unsocketCard() in
// systems/crafting.js) consumes it from state.cards.
//
// Effects aren't customized per card yet (the roster itself is still being
// defined) — every card grants the same generic +3% elemental damage bonus
// via its `element`, exactly like elementDamageModifier() does for gear
// (see getCardDamageBonus() in systems/stats.js). That's a placeholder:
// once each card gets its own defined effect, this is the file to extend.
function cardDescription(name, elementId) {
  const element = getElement(elementId);
  return element.id === 'neutro'
    ? `Poder selado de ${name}. Efeito ainda não definido.`
    : `Poder selado de ${name}: +3% de dano contra inimigos do elemento ${element.name}. Efeito adicional ainda não definido.`;
}

export const CARDS = [
  ...BOSSES.map((boss) => ({
    id: `${boss.id}_card`,
    monsterId: boss.id,
    isBossCard: true,
    name: `Carta de ${boss.name}`,
    emoji: '🃏',
    element: boss.element,
    description: cardDescription(boss.name, boss.element),
  })),
  ...WEAK_MONSTER_GROUPS.flatMap((group) => group.monsters).map((monster) => ({
    id: `${monster.id}_card`,
    monsterId: monster.id,
    isBossCard: false,
    name: `Carta de ${monster.name}`,
    emoji: '🃏',
    element: monster.element,
    description: cardDescription(monster.name, monster.element),
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
