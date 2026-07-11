// Each achievement grants Cash exactly once, the moment `check(state)`
// first becomes true — see systems/achievements.js for claim logic.
export const ACHIEVEMENTS = [
  { id: 'stage_10', name: 'Primeiros Passos', emoji: '🚩', description: 'Alcance o estágio 10.', cashReward: 10, check: (s) => s.maxStage >= 10 },
  { id: 'stage_25', name: 'Explorador', emoji: '🗺️', description: 'Alcance o estágio 25.', cashReward: 20, check: (s) => s.maxStage >= 25 },
  { id: 'stage_50', name: 'Veterano', emoji: '⚔️', description: 'Alcance o estágio 50.', cashReward: 35, check: (s) => s.maxStage >= 50 },
  { id: 'stage_100', name: 'Lenda', emoji: '👑', description: 'Alcance o estágio 100.', cashReward: 75, check: (s) => s.maxStage >= 100 },
  { id: 'first_craft', name: 'Ferreiro Iniciante', emoji: '🔨', description: 'Crafte seu primeiro item.', cashReward: 10, check: (s) => s.inventory.length >= 1 },
  { id: 'full_set', name: 'Equipado', emoji: '🎽', description: 'Equipe os 6 slots ao mesmo tempo.', cashReward: 20, check: (s) => Object.values(s.equipped).every(Boolean) },
  { id: 'first_master', name: 'Rank Master', emoji: '✨', description: 'Evolua um item para Rank Master.', cashReward: 30, check: (s) => s.inventory.some((i) => i.isMaster) },
  { id: 'first_rebirth', name: 'Renascido', emoji: '🔮', description: 'Renasça pela primeira vez.', cashReward: 25, check: (s) => (s.rebirthCount || 0) >= 1 },
  { id: 'kills_100', name: 'Caçador', emoji: '🎯', description: 'Derrote 100 monstros.', cashReward: 15, check: (s) => s.totalKills >= 100 },
  { id: 'kills_1000', name: 'Exterminador', emoji: '💀', description: 'Derrote 1.000 monstros.', cashReward: 50, check: (s) => s.totalKills >= 1000 },
  { id: 'first_event_win', name: 'Caçador de Elite', emoji: '🎪', description: 'Derrote um chefe de evento.', cashReward: 20, check: (s) => (s.eventWins || 0) >= 1 },
];
