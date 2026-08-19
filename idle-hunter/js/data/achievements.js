import { PVP_TIERS } from './pvpConfig.js';

// Conquistas por ETAPAS (reformulado — antes cada conquista era 1 marco
// único). Cada etapa concluída dá ACHIEVEMENT_STAGE_CASH_REWARD de
// Esmeralda (ver systems/achievements.js), "preenche uma bolinha" e libera
// a próxima etapa da mesma conquista — `stages` é a lista de alvos em
// ORDEM CRESCENTE, `progress(state)` devolve o valor atual a comparar
// contra o alvo da etapa pendente.
//
// A maioria usa um contador "lifetime" dedicado (ver state.js
// lifetimeHunterLevel/lifetimeTotalKills/etc) em vez da variável "de run"
// que ele espelha, porque hunterLevel/totalKills/gold/inventário resetam
// (ou nunca existiram como contador) a cada Transcender — sem isso,
// etapas altas (nível 500, 50.000 monstros, etc) nunca seriam alcançáveis
// de verdade. Ver comentário de PRESERVED_KEYS em systems/awakening.js.
export const ACHIEVEMENTS = [
  {
    id: 'hunter_level',
    name: 'Nível de Caçador',
    emoji: '🚩',
    stages: [10, 20, 30, 50, 75, 100, 130, 150, 175, 200, 300, 400, 500],
    progress: (s) => s.lifetimeHunterLevel || 1,
    stageDescription: (target) => `Alcance o nível de caça ${target}.`,
  },
  {
    id: 'monsters_killed',
    name: 'Monstros Caçados',
    emoji: '🎯',
    stages: [100, 500, 1000, 2500, 5000, 10000, 25000, 50000],
    progress: (s) => s.lifetimeTotalKills || 0,
    stageDescription: (target) => `Derrote ${target.toLocaleString('pt-BR')} monstros.`,
  },
  {
    id: 'cards_collected',
    name: 'Cartas Adquiridas',
    emoji: '🃏',
    stages: [5, 10, 20, 50, 75, 100, 150],
    progress: (s) => Object.keys(s.cardsDiscovered || {}).length,
    stageDescription: (target) => `Colecione ${target} cartas diferentes.`,
  },
  {
    id: 'transcend_count',
    name: 'Transcendências',
    emoji: '🌌',
    stages: [1, 3, 5, 10, 15, 20],
    progress: (s) => s.transcendCount || 0,
    stageDescription: (target) => `Transcenda ${target} ${target === 1 ? 'vez' : 'vezes'}.`,
  },
  {
    id: 'arena_tier',
    name: 'Tier da Arena',
    emoji: '🏟️',
    // Alvo = índice em PVP_TIERS (0 = Bronze, já começa nele, por isso a
    // 1ª etapa pedida é o 1 = Prata — ninguém "conquista" o tier inicial).
    stages: [1, 2, 3, 4, 5],
    progress: (s) => s.pvpHighestTierIndex || 0,
    stageDescription: (target) => `Alcance o tier ${PVP_TIERS[target]?.label ?? '?'} na Arena.`,
    // Mostra o nome do tier em vez do índice cru na barra de progresso
    // (ver renderAchievementsTab em ui/render.js).
    formatProgress: (value) => PVP_TIERS[value]?.label ?? PVP_TIERS[0].label,
  },
  {
    id: 'daily_missions',
    name: 'Missões Diárias Feitas',
    emoji: '📋',
    // Pendente — aguardando o sistema de Missões Diárias existir de
    // verdade. `stages` vazio faz a UI mostrar "Em breve" em vez de uma
    // etapa clicável (ver renderAchievementsTab em ui/render.js).
    stages: [],
    progress: (s) => s.dailyMissionsCompletedTotal || 0,
    stageDescription: (target) => `Complete ${target} missões diárias.`,
  },
  {
    id: 'rank_master_items',
    name: 'Itens Rank Master',
    emoji: '✨',
    stages: [10, 20, 50, 100],
    progress: (s) => s.lifetimeRankMasterCount || 0,
    stageDescription: (target) => `Evolua ${target} itens pra Rank Master.`,
  },
  {
    id: 'eggs_hatched',
    name: 'Ovos Chocados',
    emoji: '🥚',
    stages: [10, 30, 50, 100, 200, 300, 400, 500, 1000],
    progress: (s) => s.lifetimeEggsHatched || 0,
    stageDescription: (target) => `Choque ${target} ovos de mascote.`,
  },
  {
    id: 'gold_earned',
    name: 'Ouro Acumulado',
    emoji: '💰',
    stages: [100000, 1000000, 10000000, 100000000, 1000000000],
    progress: (s) => s.lifetimeGoldEarned || 0,
    stageDescription: (target) => `Acumule ${target.toLocaleString('pt-BR')} de ouro ao longo do jogo.`,
  },
  {
    id: 'arena_wins',
    name: 'Vitórias na Arena',
    emoji: '⚔️',
    stages: [5, 15, 30, 60, 100, 200],
    progress: (s) => s.pvpWinsTotal || 0,
    stageDescription: (target) => `Vença ${target} combates na Arena.`,
  },
];

export const ACHIEVEMENT_STAGE_CASH_REWARD = 10;
