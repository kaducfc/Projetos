// Each achievement grants Cash exactly once, the moment `check(state)`
// first becomes true — see systems/achievements.js for claim logic.
export const ACHIEVEMENTS = [
  { id: 'level_10', name: 'Primeiros Passos', emoji: '🚩', description: 'Alcance o nível de caça 10.', cashReward: 10, check: (s) => (s.hunterLevel || 1) >= 10 },
  { id: 'level_25', name: 'Explorador', emoji: '🗺️', description: 'Alcance o nível de caça 25.', cashReward: 20, check: (s) => (s.hunterLevel || 1) >= 25 },
  { id: 'level_50', name: 'Veterano', emoji: '⚔️', description: 'Alcance o nível de caça 50.', cashReward: 35, check: (s) => (s.hunterLevel || 1) >= 50 },
  { id: 'level_100', name: 'Lenda', emoji: '👑', description: 'Alcance o nível de caça 100.', cashReward: 75, check: (s) => (s.hunterLevel || 1) >= 100 },
  { id: 'first_drop', name: 'Caçador Equipado', emoji: '🔨', description: 'Obtenha seu primeiro item.', cashReward: 10, check: (s) => s.inventory.length >= 1 },
  { id: 'full_set', name: 'Equipado', emoji: '🎽', description: 'Equipe os 6 slots ao mesmo tempo.', cashReward: 20, check: (s) => Object.values(s.equipped).every(Boolean) },
  { id: 'first_master', name: 'Rank Master', emoji: '✨', description: 'Evolua um item para Rank Master.', cashReward: 30, check: (s) => s.inventory.some((i) => i.isMaster) },
  { id: 'kills_100', name: 'Caçador', emoji: '🎯', description: 'Derrote 100 monstros.', cashReward: 15, check: (s) => s.totalKills >= 100 },
  { id: 'kills_1000', name: 'Exterminador', emoji: '💀', description: 'Derrote 1.000 monstros.', cashReward: 50, check: (s) => s.totalKills >= 1000 },
  { id: 'first_event_win', name: 'Caçador de Elite', emoji: '🎪', description: 'Derrote um chefe de evento.', cashReward: 20, check: (s) => (s.eventWins || 0) >= 1 },
];
