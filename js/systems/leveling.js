import { ZONES } from '../data/monsters.js';

// Curva de XP pra próximo nível — cada monstro derrotado dá XP igual ao
// número da sua zona (1-based, ver xpForZone abaixo: Zona 1 = 1 XP, Zona 10
// = 10 XP), então caçar em zonas mais altas rende nível mais rápido, não só
// mais ouro/material. Reformulada do zero (pedido do usuário: nível 100
// chegava em menos de 1 dia, rápido demais) — 2 fases de crescimento
// exponencial (base * growth^(nível-1)), calibradas por simulação
// assumindo 6s por kill:
// - Nível 1-19 (HUNTER_XP_GROWTH_EARLY): começo rápido, ~1h até o nível 10
//   e ~3h até o 20 jogando ativo sem parar.
// - Nível 20-200 (HUNTER_XP_GROWTH_MID): uma única taxa uniforme (mais
//   dura que a de antes) — nível 150 em ~10 dias e nível 200 em ~3 semanas,
//   num ritmo de 3h ativas + 4h offline por dia.
// HUNTER_XP_BASE em (40/3)*0.7 (era 40/3, antes 20, antes disso 30 — pedido
// do usuário pra reduzir 30% do XP necessário de TODOS os níveis igualmente,
// de novo — reduzir só a base encolhe a curva inteira na mesma proporção,
// já que ela é base * growth^(nível-1)).
const HUNTER_XP_BASE = (40 / 3) * 0.7;
const HUNTER_XP_GROWTH_EARLY = 1.115;
const HUNTER_XP_EARLY_CAP_LEVEL = 19;
const HUNTER_XP_GROWTH_MID = 1.0222693465578296;

// Sem cap de nível — sobe indefinidamente. A partir do nível 201 a curva
// fica consideravelmente mais dura: continua a mesma taxa da fase
// 20-200 (HUNTER_XP_GROWTH_MID), só que quintuplicada — pedido explícito
// do usuário, ~5x mais difícil que o salto do 190 ao 200.
const HUNTER_XP_QUINTUPLE_FROM_LEVEL = 201;

function baseXpToNextLevel(level) {
  if (level <= HUNTER_XP_EARLY_CAP_LEVEL) {
    return HUNTER_XP_BASE * Math.pow(HUNTER_XP_GROWTH_EARLY, level - 1);
  }
  const xpAtEarlyCap = HUNTER_XP_BASE * Math.pow(HUNTER_XP_GROWTH_EARLY, HUNTER_XP_EARLY_CAP_LEVEL - 1);
  return xpAtEarlyCap * Math.pow(HUNTER_XP_GROWTH_MID, level - HUNTER_XP_EARLY_CAP_LEVEL);
}

export function xpToNextLevel(level) {
  const base = Math.round(baseXpToNextLevel(level));
  return level >= HUNTER_XP_QUINTUPLE_FROM_LEVEL ? base * 5 : base;
}

// XP por kill: igual ao número da zona (1-based) onde o monstro está, não
// importa se é chefe ou monstro fraco — Zona 1 dá 1 XP, Zona 2 dá 2 XP,
// ..., Zona 10 dá 10 XP.
export function xpForZone(zoneIndex, _isBoss) {
  return zoneIndex + 1;
}

// ---------------------------------------------------------------
// XP de Expedição (Eventos > Expedição do Caçador, ver systems/expedition.js)
// ---------------------------------------------------------------
// Pedido do usuário: a recompensa de XP da Expedição depende só do NÍVEL do
// jogador e da DURAÇÃO escolhida — nada de gear/DPS real, pra não precisar
// simular combate de verdade. A referência é "quanto XP por hora um
// jogador daquele nível ganharia caçando ativamente", assumindo:
//   - Mata cada monstro em 6 hits (valor revisado pelo usuário, era 3) +
//     o tempo de respawn do próximo monstro (MONSTER_RESPAWN_DELAY_MS em
//     systems/combat.js = 1,5s — hardcoded aqui em vez de importado, pra
//     não criar import circular com combat.js, que já importa daqui).
//   - EXPEDITION_SECONDS_PER_HIT: calibrado (não é a velocidade de ataque
//     BASE de stats.js) pra bater com o relato do usuário na conta real
//     dele — nível 175, ~8h jogadas por dia, ~4.000 e poucos de XP/dia —
//     ou seja, XP/hora ≈ 500-550 no nível 175 (Zona 9, 9 XP/kill). Com 6
//     hits + 1,5s de respawn, isso exige ~10s por hit (bem mais lento que
//     a velocidade base de combate de verdade — é só uma constante de
//     calibração da tabela, não uma alegação sobre a velocidade real).
//   - Caça na zona mais alta já desbloqueada nesse nível (zoneUnlockLevel =
//     20*zoneIndex, ver data/monsters.js) -> xpForZone(zoneIndex) por kill.
// EXPEDITION_XP_PER_HOUR_BY_LEVEL[nível] guarda esse valor pra cada nível de
// 1 a 200 (nível 0 fica null, não existe) — calculado uma vez aqui e
// reaproveitado por getExpeditionXpReward, em vez de recalculado a cada
// expedição.
const EXPEDITION_HITS_PER_KILL = 6;
const EXPEDITION_SECONDS_PER_HIT = 10;
const EXPEDITION_RESPAWN_DELAY_SECONDS = 1.5;
const EXPEDITION_SECONDS_PER_KILL = EXPEDITION_HITS_PER_KILL * EXPEDITION_SECONDS_PER_HIT + EXPEDITION_RESPAWN_DELAY_SECONDS;
const EXPEDITION_KILLS_PER_HOUR = 3600 / EXPEDITION_SECONDS_PER_KILL;

function zoneIndexForLevel(level) {
  let idx = 0;
  for (let i = 0; i < ZONES.length; i++) {
    if (level >= ZONES[i].zoneUnlockLevel) idx = i; else break;
  }
  return idx;
}

export const EXPEDITION_XP_MAX_LEVEL = 200;

export const EXPEDITION_XP_PER_HOUR_BY_LEVEL = (() => {
  const table = [null]; // índice 0 não existe (nível mínimo é 1)
  for (let level = 1; level <= EXPEDITION_XP_MAX_LEVEL; level++) {
    const zoneIndex = zoneIndexForLevel(level);
    table.push(EXPEDITION_KILLS_PER_HOUR * xpForZone(zoneIndex));
  }
  return table;
})();

/// XP médio por hora pro nível dado — nível acima de 200 usa o valor do 200
/// (zona 10 já é a última mesmo, o valor não mudaria de qualquer forma).
export function getExpeditionXpPerHour(level) {
  const clamped = Math.max(1, Math.min(EXPEDITION_XP_MAX_LEVEL, Math.round(level)));
  return EXPEDITION_XP_PER_HOUR_BY_LEVEL[clamped];
}

/// Recompensa de XP de uma Expedição: metade do tempo escolhido "conta"
/// como caçada ativa (pedido do usuário — 8h de expedição rende o mesmo XP
/// que 4h de caçada ativa, 4h rende o de 2h, 1h rende o de 30min).
export function getExpeditionXpReward(level, durationMs) {
  const activeHoursEquivalent = (durationMs / (60 * 60 * 1000)) / 2;
  return Math.round(getExpeditionXpPerHour(level) * activeHoursEquivalent);
}

// +20% de XP por Transcender já feito (acumulativo, nunca reseta — ver
// PRESERVED_KEYS em systems/awakening.js: transcendCount sobrevive ao
// próprio Transcender). Pedido explícito do usuário, mostrado na aba
// Transcender (ver transcendXpBonusLineHtml em ui/render.js).
export const TRANSCEND_XP_BONUS_PERCENT_PER_COUNT = 20;

export function getTranscendXpBonusPercent(state) {
  return (state.transcendCount || 0) * TRANSCEND_XP_BONUS_PERCENT_PER_COUNT;
}

/// Soma XP e resolve quantos níveis isso rende (pode subir mais de 1 de uma
/// vez). Retorna o número de níveis ganhos (0 se não subiu nenhum) — o
/// chamador usa isso pra mostrar um toast de "Level Up!". Sem cap de nível
/// — sobe indefinidamente (ver xpToNextLevel acima pra curva além do 200).
/// `amount` já sai com o bônus de Transcender aplicado (getTranscendXpBonusPercent
/// acima) — cobre tanto XP de kill ao vivo (combat.js) quanto XP offline
/// simulado (offline.js), já que os dois só chamam grantXp no fim.
export function grantXp(state, amount) {
  const bonusMult = 1 + getTranscendXpBonusPercent(state) / 100;
  state.hunterXp = (state.hunterXp || 0) + amount * bonusMult;
  let levelsGained = 0;
  while (state.hunterXp >= xpToNextLevel(state.hunterLevel)) {
    state.hunterXp -= xpToNextLevel(state.hunterLevel);
    state.hunterLevel += 1;
    levelsGained += 1;
  }
  // Conquista "Nível de Caçador" (ver data/achievements.js) — maior nível
  // já alcançado, não o atual (que volta a 1 a cada Transcender).
  if (state.hunterLevel > (state.lifetimeHunterLevel || 1)) state.lifetimeHunterLevel = state.hunterLevel;
  return levelsGained;
}

export function isZoneUnlocked(state, zoneIndex) {
  const zone = ZONES[zoneIndex];
  if (!zone) return false;
  return (state.hunterLevel || 1) >= zone.zoneUnlockLevel;
}

export function isBossUnlocked(state, zoneIndex) {
  const zone = ZONES[zoneIndex];
  if (!zone) return false;
  return (state.hunterLevel || 1) >= zone.bossUnlockLevel;
}

/// Zona mais alta já desbloqueada (0-based) — usada pra recompensa de
/// equipamento das Missões Diárias (ver systems/dailyMissions.js), que
/// precisa "cair" na mesma força de item que o jogador já enfrenta.
export function highestUnlockedZoneIndex(state) {
  let idx = 0;
  for (let i = 0; i < ZONES.length; i++) {
    if (isZoneUnlocked(state, i)) idx = i; else break;
  }
  return idx;
}
