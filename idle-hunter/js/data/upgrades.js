// Upgrades: bought with gold, permanent (progress is linear — no resets).
export const UPGRADES = [
  {
    id: 'training',
    name: 'Dedo de Ferro',
    emoji: '💪',
    description: 'Aumenta o dano de clique.',
    baseCost: 15,
    costGrowth: 1.16,
    stat: 'clickFlat',
    valuePerLevel: 4,
  },
  {
    id: 'adrenaline',
    name: 'Fúria de Batalha',
    emoji: '💉',
    description: 'Aumenta o dano por segundo (DPS).',
    baseCost: 20,
    costGrowth: 1.16,
    stat: 'dpsFlat',
    valuePerLevel: 3,
  },
  {
    id: 'fury',
    name: 'Maestria do Golpe',
    emoji: '🔥',
    description: 'Aumenta o dano de clique em %.',
    baseCost: 60,
    costGrowth: 1.22,
    stat: 'clickPercent',
    valuePerLevel: 1,
  },
  {
    id: 'vigor',
    name: 'Maestria de Combate',
    emoji: '⚡',
    description: 'Aumenta o DPS em %.',
    baseCost: 60,
    costGrowth: 1.22,
    stat: 'dpsPercent',
    valuePerLevel: 1,
  },
  {
    id: 'luck',
    name: 'Fortuna',
    emoji: '🍀',
    description: 'Aumenta o ouro obtido.',
    baseCost: 40,
    costGrowth: 1.2,
    stat: 'goldPercent',
    valuePerLevel: 2,
  },
  {
    id: 'tracking',
    name: 'Caçador Experiente',
    emoji: '👣',
    description: 'Aumenta a chance de obter materiais.',
    baseCost: 80,
    costGrowth: 1.25,
    stat: 'dropPercent',
    valuePerLevel: 1,
  },
  {
    id: 'vitality',
    name: 'Constituição',
    emoji: '❤️',
    description: 'Aumenta sua Vida Máxima.',
    baseCost: 15,
    costGrowth: 1.16,
    stat: 'hpFlat',
    valuePerLevel: 20,
  },
  {
    id: 'fortification',
    name: 'Armadura Reforçada',
    emoji: '🛡️',
    description: 'Aumenta sua Armadura.',
    baseCost: 20,
    costGrowth: 1.18,
    stat: 'armorFlat',
    valuePerLevel: 5,
  },
];

// Every upgrade's gold cost is 10% cheaper than the raw exponential curve,
// always rounded DOWN so it reads as a clean whole number.
export const UPGRADE_COST_SCALE = 0.90;

export function upgradeCost(upgrade, level) {
  const rawCost = upgrade.baseCost * Math.pow(upgrade.costGrowth, level);
  return Math.max(1, Math.floor(rawCost * UPGRADE_COST_SCALE));
}
