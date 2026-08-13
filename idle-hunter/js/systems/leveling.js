import { ZONES } from '../data/monsters.js';

// Curva de XP pra próximo nível — cada monstro derrotado dá XP igual ao
// número da sua zona (1-based, ver xpForZone abaixo: Zona 1 = 1 XP, Zona 10
// = 10 XP), então caçar em zonas mais altas rende nível mais rápido, não só
// mais ouro/material. Progressão de longo prazo, de propósito: a curva foi
// calibrada pra ~39 mil kills-equivalentes (assumindo 1 XP/kill) pra
// alcançar o nível 180 — a meta é levar pelo menos umas duas semanas de
// jogo pra zerar as zonas, não algumas horas. HUNTER_XP_BASE em 30 (era 5,
// pedido do usuário pra multiplicar por 6 o XP necessário de TODOS os
// níveis — multiplicar só a base escala a curva inteira igualmente, já
// que ela é base * growth^(nível-1)).
const HUNTER_XP_BASE = 30;
const HUNTER_XP_GROWTH = 1.031;

// Nível máximo do caçador — pedido explícito do usuário. Zona 10 (a mais
// avançada) já libera no nível 180 (ver zoneUnlockLevelFor em
// data/monsters.js), então o cap em 200 não trava nada do conteúdo.
export const HUNTER_MAX_LEVEL = 200;

export function xpToNextLevel(level) {
  return Math.round(HUNTER_XP_BASE * Math.pow(HUNTER_XP_GROWTH, level - 1));
}

// XP por kill: igual ao número da zona (1-based) onde o monstro está, não
// importa se é chefe ou monstro fraco — Zona 1 dá 1 XP, Zona 2 dá 2 XP,
// ..., Zona 10 dá 10 XP.
export function xpForZone(zoneIndex, _isBoss) {
  return zoneIndex + 1;
}

/// Soma XP e resolve quantos níveis isso rende (pode subir mais de 1 de uma
/// vez). Retorna o número de níveis ganhos (0 se não subiu nenhum) — o
/// chamador usa isso pra mostrar um toast de "Level Up!". Já no nível
/// máximo (HUNTER_MAX_LEVEL), XP extra é simplesmente descartado — nem
/// chega a acumular em hunterXp, pra barra de XP não ficar com progresso
/// "fantasma" que nunca vira nível.
export function grantXp(state, amount) {
  if ((state.hunterLevel || 1) >= HUNTER_MAX_LEVEL) return 0;
  state.hunterXp = (state.hunterXp || 0) + amount;
  let levelsGained = 0;
  while (state.hunterLevel < HUNTER_MAX_LEVEL && state.hunterXp >= xpToNextLevel(state.hunterLevel)) {
    state.hunterXp -= xpToNextLevel(state.hunterLevel);
    state.hunterLevel += 1;
    levelsGained += 1;
  }
  if (state.hunterLevel >= HUNTER_MAX_LEVEL) state.hunterXp = 0;
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
