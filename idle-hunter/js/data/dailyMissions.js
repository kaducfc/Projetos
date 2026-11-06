// Missões Diárias — página própria em "Outros". 3 missões sorteadas por
// dia (reset 21h de Brasília, ver systems/dailyMissions.js), o jogador
// escolhe 1 pra "ativar" (só aí a contagem começa) e pode concluir só 1
// por dia. Cada tipo de missão tem 3 níveis de dificuldade OCULTOS (o
// jogador só vê o alvo/recompensa sorteado, nunca sabe se caiu no
// fácil/médio/difícil) — dificuldade maior = alvo maior = recompensa
// melhor. Sem Esmeralda em recompensa nenhuma (pedido explícito do
// usuário — Esmeralda só vem de Conquistas/anúncio).
//
// `tierWeights` (opcional): peso de sorteio de cada nível de dificuldade
// (índice 0/1/2) — default é peso igual pros 3. `arena_wins` usa
// [45, 45, 10] pra deixar o nível 2 (recompensa Carta Aleatória) raro de
// verdade (~10% das vezes que esse TIPO de missão é sorteado).
export const DAILY_MISSION_TYPES = [
  {
    id: 'kill_monsters',
    name: 'Derrote Monstros',
    emoji: '🎯',
    describe: (target) => `Derrote ${target} monstros.`,
    tiers: [
      { target: 100, reward: { type: 'card_fragment', amount: 10 } },
      { target: 300, reward: { type: 'card_fragment', amount: 30 } },
      { target: 500, reward: { type: 'card_fragment', amount: 50 } },
    ],
  },
  {
    id: 'enhance_items',
    name: 'Aprimore Equipamentos',
    emoji: '🔨',
    describe: (target) => `Aprimore itens ${target} vezes.`,
    tiers: [
      { target: 5, reward: { type: 'card_fragment', amount: 10 } },
      { target: 10, reward: { type: 'card_fragment', amount: 30 } },
      { target: 15, reward: { type: 'card_fragment', amount: 50 } },
    ],
  },
  {
    id: 'rank_master_items',
    name: 'Evolua pra Rank Master',
    emoji: '✨',
    describe: (target) => `Evolua ${target} ${target === 1 ? 'item' : 'itens'} pra Rank Master.`,
    tiers: [
      { target: 1, reward: { type: 'equipment', count: 2, minRarity: 'raro' } },
      { target: 3, reward: { type: 'equipment', count: 2, minRarity: 'epico' } },
      { target: 5, reward: { type: 'equipment', count: 2, minRarity: 'lendario' } },
    ],
  },
  {
    id: 'hatch_eggs',
    name: 'Choque Ovos',
    emoji: '🥚',
    describe: (target) => `Choque ${target} ovos de mascote.`,
    tiers: [
      { target: 10, reward: { type: 'egg', amount: 10 } },
      { target: 20, reward: { type: 'egg', amount: 20 } },
      { target: 50, reward: { type: 'egg', amount: 50 } },
    ],
  },
  {
    id: 'arena_wins',
    name: 'Vença na Arena',
    emoji: '⚔️',
    describe: (target) => `Vença ${target} combates na Arena.`,
    tierWeights: [45, 45, 10],
    tiers: [
      { target: 4, reward: { type: 'card_fragment', amount: 20 } },
      { target: 8, reward: { type: 'card_fragment', amount: 40 } },
      { target: 15, reward: { type: 'random_card', amount: 1 } },
    ],
  },
  {
    id: 'arena_attacks',
    name: 'Ataque na Arena',
    emoji: '🛡️',
    describe: (target) => `Ataque ${target} vezes na Arena (vencendo ou não).`,
    tiers: [
      { target: 4, reward: { type: 'egg', amount: 10 } },
      { target: 8, reward: { type: 'egg', amount: 20 } },
      { target: 14, reward: { type: 'egg', amount: 30 } },
    ],
  },
];

export function getDailyMissionType(id) {
  return DAILY_MISSION_TYPES.find((t) => t.id === id) || null;
}
