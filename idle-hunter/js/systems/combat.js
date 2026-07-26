import { getZone } from '../data/monsters.js';
import { getCardForMonster } from '../data/cards.js';
import { DROP_CATEGORIES } from '../data/items.js';
import { recordCardDiscovered } from './cards.js';
import { addDroppedItem } from './crafting.js';
import { xpForZone, grantXp, isZoneUnlocked, isBossUnlocked } from './leveling.js';

const HP_GROWTH = 1.145;
const HP_BASE = 20;
const BOSS_HP_MULT = 9;

const GOLD_GROWTH = 1.115;
const GOLD_BASE = 4;
const BOSS_GOLD_MULT = 6;
const GOLD_DROP_BONUS = 1.15; // +15% gold per kill across the board

// Damage per second the monster deals back to the player, scaling more
// gently than its own HP so gear (HP/armor) can realistically keep up.
const PLAYER_DPS_TAKEN_GROWTH = 1.13;
const PLAYER_DPS_TAKEN_BASE = 2;
const BOSS_DPS_TAKEN_MULT = 3;

// Diminishing-returns armor formula: reduction = armor / (armor + K).
// Never reaches 100%, so armor is always worth stacking but never trivializes
// combat outright.
const ARMOR_CONSTANT = 100;

// Base chance for a "regular" material drop — the weak monster's one
// material, or each of a boss's two "drop principal" materials. Scaled by
// dropMult (Drop upgrades/gear), same as before.
const COMMON_DROP_CHANCE = 0.35;

// Boss-only Crystal and any monster/boss card are both *fixed* rates —
// explicitly never scaled by dropMult. Drop bonuses only affect the
// "regular" materials above; the rare stuff always stays this rare.
export const CRYSTAL_DROP_CHANCE = 0.01; // 1%
export const BOSS_CARD_DROP_CHANCE = 0.0007; // 0.07% (~1 per 1,429 boss kills)
export const WEAK_CARD_DROP_CHANCE = 0.0003; // 0.03% (~1 per 3,333 kills)

// Chance a kill drops a piece of equipment (see rollDroppedItem in
// data/items.js), independent of materials/cards, scaled by the same
// dropMult as the "regular" material chance above.
export const ITEM_DROP_CHANCE = 0.08; // 8%

export function monsterMaxHp(canonicalStage, isBoss) {
  const base = HP_BASE * Math.pow(HP_GROWTH, canonicalStage - 1);
  return Math.max(1, Math.round(isBoss ? base * BOSS_HP_MULT : base));
}

export function monsterGoldReward(canonicalStage, isBoss) {
  const base = GOLD_BASE * Math.pow(GOLD_GROWTH, canonicalStage - 1);
  const withBossMult = isBoss ? base * BOSS_GOLD_MULT : base;
  return Math.max(1, Math.round(withBossMult * GOLD_DROP_BONUS));
}

export function monsterDamagePerSecond(canonicalStage, isBoss) {
  const base = PLAYER_DPS_TAKEN_BASE * Math.pow(PLAYER_DPS_TAKEN_GROWTH, canonicalStage - 1);
  return Math.max(0.1, isBoss ? base * BOSS_DPS_TAKEN_MULT : base);
}

/// Rolled independently for every single hit — so a fast-attack-speed build
/// gets many small independent chances at a crit rather than one roll "for
/// the whole second". Multiplier is 1 on a whiff, or 1 + critDamage% on a
/// crit; caller just multiplies the base damage by it.
export function rollCrit(stats) {
  const isCrit = Math.random() * 100 < (stats.critChance || 0);
  return { isCrit, multiplier: isCrit ? 1 + (stats.critDamage || 0) / 100 : 1 };
}

export function armorReduction(armor) {
  return armor / (armor + ARMOR_CONSTANT);
}

// ---------------------------------------------------------------------
// Relógio de hit discreto: em vez de aplicar dano fracionado a cada tick de
// 100ms, cada contexto de combate (Caça, Evento, Torre, Mina de Ouro) mantém
// seu próprio "nextHitAt" (timestamp) — main.js chama advanceHitClock() a
// cada tick e só resolve um hit de verdade quando o relógio vence, no ritmo
// de attackSpeedPerSec (base 1 hit/seg, escalado pelo atributo Velocidade
// de Ataque). Sem estado de módulo aqui de propósito — cada contexto guarda
// seu próprio nextHitAt como variável de closure em main.js, exatamente como
// já faz com bossDeadline/currentHp.
// ---------------------------------------------------------------------
export function hitIntervalMs(attackSpeedPerSec) {
  return 1000 / Math.max(0.05, attackSpeedPerSec);
}

export function advanceHitClock(nextHitAt, attackSpeedPerSec, now = Date.now()) {
  if (nextHitAt == null) return { hit: false, nextHitAt: now + hitIntervalMs(attackSpeedPerSec) };
  if (now < nextHitAt) return { hit: false, nextHitAt };
  return { hit: true, nextHitAt: now + hitIntervalMs(attackSpeedPerSec) };
}

/// Resolves one discrete hit's damage — shared by every combat context (Caça,
/// Evento, Torre, Mina de Ouro). elementalMultiplier is the caller's
/// precomputed `1 + elementDamageModifier(...) + getCardDamageBonus(...)`.
/// state.solkaiserHitCounter is persisted (state.js) so the countdown
/// survives a reload; only advances/resets when the card is actually
/// socketed (stats.hitBurstEveryN is null otherwise, see stats.js).
export function resolveHit(state, stats, elementalMultiplier) {
  if (stats.hitBurstEveryN) {
    state.solkaiserHitCounter = (state.solkaiserHitCounter || 0) + 1;
    if (state.solkaiserHitCounter > stats.hitBurstEveryN) {
      state.solkaiserHitCounter = 0;
      const dealt = stats.dps * elementalMultiplier * stats.hitBurstDamageMult;
      return { dealt, isCrit: true, isBurst: true };
    }
  }
  const crit = rollCrit(stats);
  return { dealt: stats.dps * elementalMultiplier * crit.multiplier, isCrit: crit.isCrit, isBurst: false };
}

// ---------------------------------------------------------------------
// Monstro atual: resolvido a partir de state.currentMonster ({ zoneIndex,
// kind: 'weak'|'boss', monsterId, sceneIndex }), que por sua vez é sorteado
// uniformemente entre state.selectedMonsters a cada respawn (ver
// ensureMonsterSpawned). O "estágio canônico" da zona (10, 20, ...100)
// escala HP/Ouro/Dano de TODOS os monstros daquela zona, fraco ou chefe —
// o chefe ainda aplica seu próprio multiplicador BOSS_* por cima.
// ---------------------------------------------------------------------

export function getCurrentMonster(currentMonsterRef) {
  if (!currentMonsterRef) return null;
  const { zoneIndex, kind, monsterId, sceneIndex } = currentMonsterRef;
  const zone = getZone(zoneIndex);
  if (!zone) return null;
  const isBoss = kind === 'boss';
  const canonicalStage = zone.canonicalStage;

  if (isBoss) {
    const b = zone.boss;
    return {
      zoneIndex, isBoss: true, isWeak: false,
      bossId: b.id, weakMonsterId: null,
      name: b.name, emoji: b.emoji, image: b.image || null,
      animFrames: b.animFrames || null, scene: b.scene || null, scenePosition: b.scenePosition || null,
      spriteScale: b.spriteScale || 1, element: b.element,
      maxHp: monsterMaxHp(canonicalStage, true),
      dps: monsterDamagePerSecond(canonicalStage, true),
      sceneIndex: null,
    };
  }

  const weak = zone.weakMonsters.find((m) => m.id === monsterId) || zone.weakMonsters[0];
  return {
    zoneIndex, isBoss: false, isWeak: true,
    bossId: null, weakMonsterId: weak.id,
    name: weak.name, emoji: weak.emoji, image: weak.image || null,
    animFrames: weak.animFrames || null, element: weak.element,
    maxHp: monsterMaxHp(canonicalStage, false),
    dps: monsterDamagePerSecond(canonicalStage, false),
    sceneIndex: sceneIndex ?? 0,
  };
}

/// Boss: rolls each of the two "drop principal" materials independently
/// (dropMult-scaled), plus the boss's own Crystal and its card, both at a
/// fixed rate dropMult never touches.
/// Weak monster: rolls its one material (dropMult-scaled) plus its own
/// card, also at that same fixed rate.
export function rollDrops(zoneIndex, isBoss, dropMult, monsterId) {
  const zone = getZone(zoneIndex);
  const drops = [];
  const chance = Math.min(0.95, COMMON_DROP_CHANCE * dropMult);

  if (isBoss) {
    const b = zone.boss;
    for (const mat of [b.materials.primary1, b.materials.primary2]) {
      if (Math.random() < chance) {
        drops.push({ id: mat.id, name: mat.name, emoji: mat.emoji, image: mat.image || null, qty: 1 });
      }
    }
    if (Math.random() < CRYSTAL_DROP_CHANCE) {
      drops.push({ id: b.crystal.id, name: b.crystal.name, emoji: b.crystal.emoji, image: b.crystal.image || null, qty: 1 });
    }
    if (Math.random() < BOSS_CARD_DROP_CHANCE) {
      const card = getCardForMonster(b.id);
      drops.push({ id: card.id, name: card.name, emoji: card.emoji, image: card.image || null, qty: 1, isCard: true });
    }
    return drops;
  }

  const weak = zone.weakMonsters.find((m) => m.id === monsterId) || zone.weakMonsters[0];
  if (Math.random() < chance) {
    drops.push({ id: weak.material.id, name: weak.material.name, emoji: weak.material.emoji, image: weak.material.image || null, qty: 1 });
  }
  if (Math.random() < WEAK_CARD_DROP_CHANCE) {
    const card = getCardForMonster(weak.id);
    drops.push({ id: card.id, name: card.name, emoji: card.emoji, image: card.image || null, qty: 1, isCard: true });
  }
  return drops;
}

// How many background scenes exist for weak-monster stages (see
// assets/ui/scenes/scene1..N.png and ui/render.js).
export const WEAK_MONSTER_SCENE_COUNT = 3;

/// Sorteia um dos state.selectedMonsters (uniforme) e monta o monstro atual
/// — chamado sempre que monsterHp está null (precisa (re)spawnar). Sem
/// monstro selecionado, deixa currentMonster null (a UI mostra a tela de
/// "escolha seus monstros" nesse caso).
export function ensureMonsterSpawned(state) {
  if (state.monsterHp != null) return;
  const pool = state.selectedMonsters || [];
  if (!pool.length) {
    state.currentMonster = null;
    return;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  state.currentMonster = {
    zoneIndex: pick.zoneIndex,
    kind: pick.kind,
    monsterId: pick.monsterId,
    sceneIndex: pick.kind === 'weak' ? Math.floor(Math.random() * WEAK_MONSTER_SCENE_COUNT) : null,
  };
  const monster = getCurrentMonster(state.currentMonster);
  state.monsterHp = monster.maxHp;
}


/// Applies damage to the current monster. Returns a kill event (or null if
/// the monster survived) describing gold/drops/xp/level-up/item-drop so the
/// UI layer can react without this module knowing about the DOM.
export function applyDamage(state, amount, stats) {
  ensureMonsterSpawned(state);
  if (!state.currentMonster) return null;
  state.monsterHp -= amount;

  if (state.monsterHp > 0) return null;

  const ref = state.currentMonster;
  const zoneIndex = ref.zoneIndex;
  const zone = getZone(zoneIndex);
  const wasBoss = ref.kind === 'boss';

  // Rolls one kill's worth of gold (Chispim card: independent chance to
  // double it) + drops — factored out so the Gaiatron reproc below can
  // reuse it for "all the same rewards, a second time" without duplicating
  // the roll logic.
  const rollReward = () => {
    let gold = Math.round(monsterGoldReward(zone.canonicalStage, wasBoss) * stats.goldMult);
    if (Math.random() * 100 < (stats.goldDoubleChance || 0)) gold *= 2;
    return { gold, drops: rollDrops(zoneIndex, wasBoss, stats.dropMult, ref.monsterId) };
  };

  let goldGained = 0;
  let drops = [];
  let reprocced = false;
  const first = rollReward();
  goldGained += first.gold;
  drops = drops.concat(first.drops);

  if (wasBoss && Math.random() * 100 < (stats.bossReprocChance || 0)) {
    reprocced = true;
    const second = rollReward();
    goldGained += second.gold;
    drops = drops.concat(second.drops);
  }

  state.gold += goldGained;
  for (const drop of drops) {
    const bucket = drop.isCard ? state.cards : state.materials;
    bucket[drop.id] = (bucket[drop.id] || 0) + drop.qty;
    if (drop.isCard) recordCardDiscovered(state, drop.id);
  }
  state.totalKills += 1;

  let droppedItemUid = null;
  if (Math.random() < Math.min(0.95, ITEM_DROP_CHANCE * stats.dropMult)) {
    // 9 categorias de drop (não SLOTS — ring ocupa 2 slots físicos mas é 1
    // categoria só, ver data/items.js).
    const category = DROP_CATEGORIES[Math.floor(Math.random() * DROP_CATEGORIES.length)];
    droppedItemUid = addDroppedItem(state, zoneIndex, category);
  }

  const xpGained = xpForZone(zoneIndex, wasBoss);
  const levelsGained = grantXp(state, xpGained);

  state.monsterHp = null;
  ensureMonsterSpawned(state);

  return { zoneIndex, wasBoss, goldGained, drops, reprocced, xpGained, levelsGained, droppedItemUid };
}

// ---------------------------------------------------------------------
// Seleção de monstros (estilo IdleArc): até 4, de qualquer zona liberada,
// podendo misturar zonas — só esses aparecem sorteados na Caça.
// ---------------------------------------------------------------------
export const MAX_SELECTED_MONSTERS = 4;

export function canSelectMonster(state, zoneIndex, kind) {
  return kind === 'boss' ? isBossUnlocked(state, zoneIndex) : isZoneUnlocked(state, zoneIndex);
}

/// Substitui a lista inteira de selecionados (a tela de seleção sempre manda
/// o conjunto completo desejado). Filtra qualquer entrada que não esteja
/// mais liberada e trunca em MAX_SELECTED_MONSTERS. Força um respawn a partir
/// do novo conjunto. Retorna false (sem aplicar nada) se a lista filtrada
/// ficar vazia — sempre precisa sobrar ao menos 1 selecionado.
export function setSelectedMonsters(state, list) {
  const filtered = list
    .filter((m) => canSelectMonster(state, m.zoneIndex, m.kind))
    .slice(0, MAX_SELECTED_MONSTERS);
  if (!filtered.length) return false;
  state.selectedMonsters = filtered;
  state.monsterHp = null;
  ensureMonsterSpawned(state);
  return true;
}
