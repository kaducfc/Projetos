// Simple 4-element cycle (Fogo > Planta > Elétrico > Água > Fogo) plus a
// Neutro element that never has advantage/disadvantage either way.
export const ELEMENTS = [
  { id: 'neutro', name: 'Neutro', emoji: '⚪', image: 'assets/ui/elements/neutro.png' },
  { id: 'fogo', name: 'Fogo', emoji: '🔥', image: 'assets/ui/elements/fogo.png' },
  { id: 'planta', name: 'Planta', emoji: '🌿', image: 'assets/ui/elements/planta.png' },
  { id: 'eletrico', name: 'Elétrico', emoji: '⚡', image: 'assets/ui/elements/eletrico.png' },
  { id: 'agua', name: 'Água', emoji: '💧', image: 'assets/ui/elements/agua.png' },
];

// attackerElement -> the element it has advantage against
const ADVANTAGE = {
  fogo: 'planta',
  planta: 'eletrico',
  eletrico: 'agua',
  agua: 'fogo',
};

export const ELEMENT_DAMAGE_BONUS = 0.25;
export const ELEMENT_RESISTANCE_PER_PIECE = 0.05;

export function getElement(id) {
  return ELEMENTS.find((e) => e.id === id) || ELEMENTS[0];
}

/// Damage modifier (added to 1x, so +0.25/-0.25/0 — not the full multiplier)
/// an attacker of attackerElement gets against a defender of defenderElement.
/// Neutro on either side always means 0, matching "0% caso o monstro ou a
/// arma seja neutro".
export function elementDamageModifier(attackerElement, defenderElement) {
  if (attackerElement === 'neutro' || defenderElement === 'neutro') return 0;
  if (ADVANTAGE[attackerElement] === defenderElement) return ELEMENT_DAMAGE_BONUS;
  if (ADVANTAGE[defenderElement] === attackerElement) return -ELEMENT_DAMAGE_BONUS;
  return 0;
}
