// Regular upgrades: bought with gold, reset on rebirth.
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

export function upgradeCost(upgrade, level) {
  return Math.round(upgrade.baseCost * Math.pow(upgrade.costGrowth, level));
}

// Prestige upgrades: bought with Runas, persist across rebirths forever.
export const PRESTIGE_UPGRADES = [
  {
    id: 'ancestral_power',
    name: 'Poder Ancestral',
    emoji: '🌟',
    description: '+2% de dano total (clique + DPS) por nível.',
    baseCost: 1,
    costGrowth: 1.35,
    stat: 'allDamagePercent',
    valuePerLevel: 2,
  },
  {
    id: 'eternal_fortune',
    name: 'Fortuna Eterna',
    emoji: '💰',
    description: '+3% de ouro obtido por nível.',
    baseCost: 1,
    costGrowth: 1.3,
    stat: 'goldPercent',
    valuePerLevel: 3,
  },
  {
    id: 'keen_scent',
    name: 'Faro Apurado',
    emoji: '🐾',
    description: '+2% de chance de material por nível.',
    baseCost: 1,
    costGrowth: 1.3,
    stat: 'dropPercent',
    valuePerLevel: 2,
  },
  {
    id: 'head_start',
    name: 'Início Avançado',
    emoji: '🚀',
    description: 'Começa cada renascimento 2 estágios mais à frente.',
    baseCost: 2,
    costGrowth: 1.4,
    stat: 'startStage',
    valuePerLevel: 2,
  },
];

export function prestigeUpgradeCost(upgrade, level) {
  return Math.round(upgrade.baseCost * Math.pow(upgrade.costGrowth, level));
}
