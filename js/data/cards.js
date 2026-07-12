import { MONSTER_FAMILIES } from './monsters.js';
import { getElement } from './elements.js';

// One collectible card per monster family (Ragnarok Online style) — a rare
// drop from any monster of that family, regular or boss. Socketing one into
// an equipped item's card slot (see socketCard()/unsocketCard() in
// systems/crafting.js) consumes it from state.cards and grants the bonus
// described here for real — see getCardDamageBonus() in systems/stats.js,
// applied the same way elementDamageModifier() is (per-hit, against
// whatever the current target's element is, not a flat aggregated stat).
export const CARDS = MONSTER_FAMILIES.map((family) => {
  const element = getElement(family.element);
  return {
    id: `${family.id}_card`,
    familyId: family.id,
    name: `Carta de ${family.name}`,
    emoji: '🃏',
    element: family.element,
    description: element.id === 'neutro'
      ? `Poder selado de ${family.name}.`
      : `Poder selado de ${family.name}: +3% de dano contra inimigos do elemento ${element.name}.`,
  };
});

export function getCard(cardId) {
  return CARDS.find((c) => c.id === cardId);
}

export function getCardForFamily(familyId) {
  return CARDS.find((c) => c.familyId === familyId);
}
