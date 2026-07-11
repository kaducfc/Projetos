import { MONSTER_FAMILIES } from './monsters.js';
import { getElement } from './elements.js';

// One collectible card per monster family (Ragnarok Online style) — a rare
// drop from any monster of that family, regular or boss. This is the
// "inventory" half of the card system: collecting and viewing them. The
// other half (actually socketing one into an equipped item's card slot —
// see `cardId`/`socketCard()` in systems/crafting.js and the "Slot de
// Carta" badge in the item detail popup) isn't wired up yet, so the bonus
// described here is flavor text for now, not a live stat.
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
      : `Poder selado de ${family.name}: quando encaixada, daria +3% de dano contra inimigos do elemento ${element.name}.`,
  };
});

export function getCard(cardId) {
  return CARDS.find((c) => c.id === cardId);
}

export function getCardForFamily(familyId) {
  return CARDS.find((c) => c.familyId === familyId);
}
