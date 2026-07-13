// Upgrades: bought with gold, permanent (progress is linear — no resets).
export const UPGRADES = [
  {
    id: 'training',
    name: 'Treino de Força',
    emoji: '💪',
    description: 'Aumenta o dano de clique.',
    baseCost: 15,
    costGrowth: 1.16,
    stat: 'clickFlat',
    valuePerLevel: 4,
  },
  {
    id: 'adrenaline',
    name: 'Adrenalina',
    emoji: '💉',
    description: 'Aumenta o dano por segundo (DPS).',
    baseCost: 20,
    costGrowth: 1.16,
    stat: 'dpsFlat',
    valuePerLevel: 3,
  },
  {
    id: 'fury',
    name: 'Fúria',
    emoji: '🔥',
    description: '+1% de dano de clique por nível.',
    baseCost: 60,
    costGrowth: 1.22,
    stat: 'clickPercent',
    valuePerLevel: 1,
  },
  {
    id: 'vigor',
    name: 'Vigor',
    emoji: '⚡',
    description: '+1% de DPS por nível.',
    baseCost: 60,
    costGrowth: 1.22,
    stat: 'dpsPercent',
    valuePerLevel: 1,
  },
  {
    id: 'luck',
    name: 'Sorte do Caçador',
    emoji: '🍀',
    description: '+2% de ouro obtido por nível.',
    baseCost: 40,
    costGrowth: 1.2,
    stat: 'goldPercent',
    valuePerLevel: 2,
  },
  {
    id: 'tracking',
    name: 'Instinto de Rastreio',
    emoji: '👣',
    description: '+1% de chance de material por nível.',
    baseCost: 80,
    costGrowth: 1.25,
    stat: 'dropPercent',
    valuePerLevel: 1,
  },
  {
    id: 'vitality',
    name: 'Vitalidade',
    emoji: '❤️',
    description: 'Aumenta sua vida máxima.',
    baseCost: 15,
    costGrowth: 1.16,
    stat: 'hpFlat',
    valuePerLevel: 20,
  },
  {
    id: 'fortification',
    name: 'Fortificação',
    emoji: '🛡️',
    description: 'Aumenta sua armadura (reduz o dano recebido dos monstros).',
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
