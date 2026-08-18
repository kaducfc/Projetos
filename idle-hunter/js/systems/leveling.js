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

// O cap de nível 200 (pedido antes) foi removido de novo — nível volta a
// ser ilimitado. Em troca, a partir do nível 201 a curva fica bem mais
// dura: mesma forma exponencial de sempre (base * growth^(nível-1)), só
// que triplicada — pedido explícito do usuário, usando o mesmo "formato"
// da curva 170-200 como referência, não uma curva nova.
const HUNTER_XP_TRIPLE_FROM_LEVEL = 201;

export function xpToNextLevel(level) {
  const base = Math.round(HUNTER_XP_BASE * Math.pow(HUNTER_XP_GROWTH, level - 1));
  return level >= HUNTER_XP_TRIPLE_FROM_LEVEL ? base * 3 : base;
}

// XP por kill: igual ao número da zona (1-based) onde o monstro está, não
// importa se é chefe ou monstro fraco — Zona 1 dá 1 XP, Zona 2 dá 2 XP,
// ..., Zona 10 dá 10 XP.
export function xpForZone(zoneIndex, _isBoss) {
  return zoneIndex + 1;
}

/// Soma XP e resolve quantos níveis isso rende (pode subir mais de 1 de uma
/// vez). Retorna o número de níveis ganhos (0 se não subiu nenhum) — o
/// chamador usa isso pra mostrar um toast de "Level Up!". Sem cap de nível
/// — sobe indefinidamente (ver xpToNextLevel acima pra curva além do 200).
export function grantXp(state, amount) {
  state.hunterXp = (state.hunterXp || 0) + amount;
  let levelsGained = 0;
  while (state.hunterXp >= xpToNextLevel(state.hunterLevel)) {
    state.hunterXp -= xpToNextLevel(state.hunterLevel);
    state.hunterLevel += 1;
    levelsGained += 1;
  }
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
