import { ZONES } from '../data/monsters.js';

// Curva de "kills pra próximo nível" — cada monstro derrotado dá exatamente
// 1 XP (ver xpForZone abaixo), então esses valores já são uma contagem
// direta de kills, não uma quantia abstrata. Crescimento bem achatado de
// propósito (o nível de caça só existe pra liberar Zona/Chefe, não pra virar
// outra corrida exponencial em paralelo): ~4,5 mil kills no total pra
// alcançar o nível 180 (Zona 10), distribuídos pelos monstros selecionados.
const HUNTER_XP_BASE = 5;
const HUNTER_XP_GROWTH = 1.015;

export function xpToNextLevel(level) {
  return Math.round(HUNTER_XP_BASE * Math.pow(HUNTER_XP_GROWTH, level - 1));
}

// XP por kill: fixo em 1 por monstro derrotado, não importa a zona nem se
// é chefe — "nível de caça" agora é literalmente uma contagem de monstros
// derrotados (xpToNextLevel acima passa a ler como "quantos kills faltam").
export function xpForZone(_zoneIndex, _isBoss) {
  return 1;
}

/// Soma XP e resolve quantos níveis isso rende (pode subir mais de 1 de uma
/// vez). Retorna o número de níveis ganhos (0 se não subiu nenhum) — o
/// chamador usa isso pra mostrar um toast de "Level Up!".
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
