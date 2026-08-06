import { WEAK_MONSTER_GROUPS } from './monsters.js';

// "Combate Permanente": um saco de pancada que nunca revida, por
// ARENA_RUN_DURATION_MS (30s) — o dano total causado no fim do tempo decide
// em qual Rank o caçador termina (ver getArenaRankForDamage abaixo e
// systems/arena.js endArenaRun). Sem janela por ciclo nem cooldown — o nome
// "Permanente" é literal, dá pra tentar de novo assim que o combate atual
// terminar (ver canEnterArena em systems/arena.js).
export const ARENA_RUN_DURATION_MS = 30 * 1000;

// 7 tiers x 5 ranks cada = 35 degraus, do Ferro 5 (índice 0, 0 de dano) ao
// Lendário 1 (índice 34, ARENA_MAX_DAMAGE de dano) — dentro de um tier o
// número DIMINUI conforme sobe (5 é o mais fraco, 1 o mais forte do tier),
// espelhando convenção comum de ranking (Ouro 1 > Ouro 5).
export const ARENA_TIER_NAMES = ['Ferro', 'Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Lendário'];
export const ARENA_RANKS_PER_TIER = 5;
export const ARENA_RANK_COUNT = ARENA_TIER_NAMES.length * ARENA_RANKS_PER_TIER; // 35
export const ARENA_MAX_DAMAGE = 50_000_000;

// Curva de dano por degrau: >1 faz o crescimento se acumular mais no fim
// (ranks baixos pedem pouco dano — quase todo mundo avança rápido no
// início — ranks altos exigem uma explosão real de DPS), uma curva de
// potência contínua de 0 (Ferro 5) até ARENA_MAX_DAMAGE (Lendário 1).
const ARENA_DAMAGE_CURVE_POWER = 2.3;

function roundNiceDamage(value) {
  if (value <= 0) return 0;
  if (value < 1000) return Math.round(value / 10) * 10;
  if (value < 10000) return Math.round(value / 100) * 100;
  if (value < 100000) return Math.round(value / 1000) * 1000;
  if (value < 1000000) return Math.round(value / 10000) * 10000;
  return Math.round(value / 50000) * 50000;
}

function damageThresholdForIndex(index) {
  if (index <= 0) return 0;
  if (index >= ARENA_RANK_COUNT - 1) return ARENA_MAX_DAMAGE;
  const t = index / (ARENA_RANK_COUNT - 1);
  return roundNiceDamage(ARENA_MAX_DAMAGE * Math.pow(t, ARENA_DAMAGE_CURVE_POWER));
}

// Nem toda recompensa aparece desde o Rank 0 (pedido explícito do usuário)
// — cada uma "liga" a partir de um índice de rank (unlockIndex) e cresce
// suavemente (power baixo = quase linear, sem saltos grandes de um rank
// pro seguinte) até o valor máximo no Lendário 1. Ordem de entrada: Gold
// (desde o início) -> Moeda de Evento (Bronze 5) -> Ovo de Mascote (Prata
// 5) -> Material de Monstro (Ouro 5) -> Fragmento de Carta (Diamante 5).
const ARENA_REWARD_CONFIG = {
  gold: { unlockIndex: 0, min: 3000, max: 200000, power: 1.35 },
  eventCurrency: { unlockIndex: 5, min: 15, max: 300, power: 1.25 },
  eggs: { unlockIndex: 10, min: 4, max: 40, power: 1.2 },
  material: { unlockIndex: 15, min: 10, max: 150, power: 1.2 },
  cardFragments: { unlockIndex: 25, min: 400, max: 3000, power: 1.2 },
};

function rewardValueForIndex(index, cfg) {
  if (index < cfg.unlockIndex) return 0;
  const span = ARENA_RANK_COUNT - 1 - cfg.unlockIndex;
  const t = span <= 0 ? 1 : (index - cfg.unlockIndex) / span;
  return Math.round(cfg.min + (cfg.max - cfg.min) * Math.pow(t, cfg.power));
}

// O material concedido (Ouro 5 em diante) vem de uma zona escalada com a
// posição global do rank — Ouro 5 sorteia perto da Zona 4, Lendário 1
// fecha na Zona 10 — "proporcional à dificuldade (Rank) com nível do
// monstro" (pedido do usuário). Sempre o 1º monstro do grupo daquela zona,
// pra ser um material previsível/consultável (não sorteado por run).
function materialForIndex(index) {
  const zoneIdx = Math.min(
    WEAK_MONSTER_GROUPS.length - 1,
    Math.floor((index / (ARENA_RANK_COUNT - 1)) * (WEAK_MONSTER_GROUPS.length - 1)),
  );
  return WEAK_MONSTER_GROUPS[zoneIdx].monsters[0].material;
}

export const ARENA_RANKS = (() => {
  const ranks = [];
  let prevThreshold = -1;
  for (let i = 0; i < ARENA_RANK_COUNT; i++) {
    const tierIndex = Math.floor(i / ARENA_RANKS_PER_TIER);
    const rankNum = ARENA_RANKS_PER_TIER - (i % ARENA_RANKS_PER_TIER);
    let threshold = damageThresholdForIndex(i);
    // roundNiceDamage pode empatar 2 índices vizinhos quando a diferença
    // "crua" é pequena (só acontece nos primeiríssimos ranks) — força
    // estritamente crescente pra nunca 2 ranks pedirem o mesmo dano.
    if (threshold <= prevThreshold) threshold = prevThreshold + 1;
    prevThreshold = threshold;

    const materialUnlocked = i >= ARENA_REWARD_CONFIG.material.unlockIndex;
    ranks.push({
      index: i,
      tier: ARENA_TIER_NAMES[tierIndex],
      tierIndex,
      rank: rankNum,
      name: `${ARENA_TIER_NAMES[tierIndex]} ${rankNum}`,
      damageThreshold: threshold,
      rewards: {
        gold: rewardValueForIndex(i, ARENA_REWARD_CONFIG.gold),
        eventCurrency: rewardValueForIndex(i, ARENA_REWARD_CONFIG.eventCurrency),
        eggs: rewardValueForIndex(i, ARENA_REWARD_CONFIG.eggs),
        materialQty: rewardValueForIndex(i, ARENA_REWARD_CONFIG.material),
        material: materialUnlocked ? materialForIndex(i) : null,
        cardFragments: rewardValueForIndex(i, ARENA_REWARD_CONFIG.cardFragments),
      },
    });
  }
  return ranks;
})();

/// O rank mais alto cujo damageThreshold o dano causado já alcançou —
/// ARENA_RANKS[0] (Ferro 5, threshold 0) sempre serve de piso.
export function getArenaRankForDamage(damage) {
  let found = ARENA_RANKS[0];
  for (const rank of ARENA_RANKS) {
    if (damage >= rank.damageThreshold) found = rank;
    else break;
  }
  return found;
}

export function getArenaRankByIndex(index) {
  return ARENA_RANKS[index] || null;
}
