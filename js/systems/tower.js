import {
  isBossStage, getBossForStage, pickRandomWeakMonster, getWeakMonster, getWeakMonsterGroupForStage,
  BOSSES, WEAK_MONSTER_GROUPS,
} from '../data/monsters.js';
import { monsterMaxHp, monsterDamagePerSecond, monsterGoldReward } from './combat.js';
import { getTowerWindow, TOWER_MAX_LEVEL, TOWER_CURRENCY_BASE, TOWER_CURRENCY_PER_LEVEL, TOWER_CLEAR_BONUS } from '../data/events.js';
import { EVENT_EGG_DROP_CHANCE } from '../data/pets.js';

// End-of-run rewards (see endTowerRun) also include a batch of weak-monster
// materials — this many rolls, each landing on a random material from the
// weak-monster band matching how far the run reached (same band used to
// spawn the run's own weak monsters, via resolveWeakPowerStage below).
const TOWER_MATERIAL_DROPS = 20;

// --- TEMP DEBUG OVERRIDE (pedido do usuário pra facilitar testar outras
// mecânicas do jogo) --------------------------------------------------
// Enquanto true, endTowerRun ignora computeTowerReward/rollTowerMaterials e
// sempre dá DEBUG_TOWER_CURRENCY de Moeda de Evento + DEBUG_TOWER_MATERIAL_QTY
// de CADA material de monstro existente, não importa o andar alcançado.
// Pra reverter pro balanceamento normal, é só voltar essa flag pra false —
// computeTowerReward/rollTowerMaterials continuam intactas logo abaixo.
const DEBUG_FLAT_TOWER_REWARDS = true;
const DEBUG_TOWER_CURRENCY = 50000;
const DEBUG_TOWER_MATERIAL_QTY = 2000;

/// Todo material de monstro que existe no jogo (drop principal 1/2 e
/// Cristal de cada chefe, material de cada monstro fraco), sem duplicar —
/// usado só pelo override de debug acima.
function allMonsterMaterials() {
  const seen = new Map();
  for (const boss of BOSSES) {
    for (const mat of [boss.materials.primary1, boss.materials.primary2, boss.crystal]) {
      if (!seen.has(mat.id)) seen.set(mat.id, mat);
    }
  }
  for (const group of WEAK_MONSTER_GROUPS) {
    for (const monster of group.monsters) {
      if (!seen.has(monster.material.id)) seen.set(monster.material.id, monster.material);
    }
  }
  return [...seen.values()];
}
// --- fim do override de debug -----------------------------------------

/// Level 20*k -> real boss stage 10*k (Chispim@20, Solkaiser@40, ...,
/// Bahamorth@200); every other level -> the real stage "in between" two
/// bosses, at half the pace (2 tower levels per real stage). Simple
/// Math.floor(level/2) matches every example in the spec (1-19 -> 1-9,
/// 20 -> 10, 40 -> 20, 200 -> 100) but ALSO lands exactly on a multiple of
/// 10 for plenty of non-boss levels (e.g. level 21 -> 10, level 41 -> 20)
/// — that's fine for HP/DPS scaling (continuous growth either way), but it
/// would wrongly look like a boss stage to isBossStage() for a level that
/// isn't actually a tower boss. towerIsBossLevel() below is the only
/// source of truth for "is this level a boss" — never re-derive it from
/// isBossStage(towerPowerStage(level)).
export function towerPowerStage(level) {
  return Math.max(1, Math.floor(level / 2));
}

export function towerIsBossLevel(level) {
  return level > 0 && level % 20 === 0;
}

/// Weak-monster flavor/band lookup has the same hazard in reverse: a
/// power stage that happens to be an exact multiple of 10 (see above) has
/// no weak-monster band of its own (real stage 10/20/.../100 are boss-only
/// stages) — getWeakMonsterGroupForStage would silently fall back to the
/// wrong (last) band for those. Nudging down by one sidesteps it without
/// needing a tower-specific band table.
function resolveWeakPowerStage(powerStage) {
  return isBossStage(powerStage) ? powerStage - 1 : powerStage;
}

/// Everything the UI/combat loop needs to display and fight the current
/// tower level's monster — mirrors getCurrentMonster()'s shape (data/
/// monsters.js + systems/combat.js) but resolved through the level->stage
/// mapping above instead of a real stage number.
export function getTowerMonster(level, weakMonsterId) {
  if (towerIsBossLevel(level)) {
    const stage = towerPowerStage(level);
    const boss = getBossForStage(stage);
    return {
      name: boss.name, emoji: boss.emoji, image: boss.image || null, element: boss.element,
      isBoss: true,
      maxHp: monsterMaxHp(stage, true),
      dps: monsterDamagePerSecond(stage, true),
    };
  }

  const stage = resolveWeakPowerStage(towerPowerStage(level));
  const weak = weakMonsterId ? getWeakMonster(weakMonsterId) : pickRandomWeakMonster(stage);
  return {
    name: weak.name, emoji: weak.emoji, image: weak.image || null, element: weak.element,
    isBoss: false,
    maxHp: monsterMaxHp(stage, false),
    dps: monsterDamagePerSecond(stage, false),
  };
}

export function ensureTowerMonsterSpawned(state) {
  if (state.towerMonsterHp == null) {
    const level = state.towerLevel;
    state.towerWeakMonsterId = towerIsBossLevel(level) ? null : pickRandomWeakMonster(resolveWeakPowerStage(towerPowerStage(level))).id;
    state.towerMonsterHp = getTowerMonster(level, state.towerWeakMonsterId).maxHp;
  }
}

export function canEnterTower(state, now = Date.now()) {
  if (state.towerRunActive) return false;
  const win = getTowerWindow(now);
  if (!win.active) return false;
  return state.towerEnteredCycle !== win.cycleIndex;
}

/// Returns true if the run actually started.
export function startTowerRun(state, now = Date.now()) {
  if (!canEnterTower(state, now)) return false;
  const win = getTowerWindow(now);
  state.towerRunActive = true;
  state.towerLevel = 1;
  state.towerMonsterHp = null;
  state.towerWeakMonsterId = null;
  state.towerEnteredCycle = win.cycleIndex;
  ensureTowerMonsterSpawned(state);
  return true;
}

/// Applies damage to the current tower monster. Returns a kill event (with
/// whether the level-200 boss itself just fell, ending the run in a full
/// clear) or null if it survived.
export function applyTowerDamage(state, amount) {
  ensureTowerMonsterSpawned(state);
  state.towerMonsterHp -= amount;
  if (state.towerMonsterHp > 0) return null;

  const clearedLevel = state.towerLevel;
  const cleared200 = clearedLevel >= TOWER_MAX_LEVEL;
  state.towerBestLevel = Math.max(state.towerBestLevel, clearedLevel);

  if (cleared200) {
    return { clearedLevel, cleared200: true };
  }

  state.towerLevel += 1;
  state.towerMonsterHp = null;
  ensureTowerMonsterSpawned(state);
  return { clearedLevel, cleared200: false, newLevel: state.towerLevel };
}

/// Currency reward is based on the furthest level the player was on when
/// the run ended, whether or not they beat it — dying to level 47's
/// monster still counts as "reached 47". Actually clearing level 200's
/// boss adds a flat completion bonus on top.
export function computeTowerReward(level, cleared200) {
  const base = Math.round(TOWER_CURRENCY_BASE + level * TOWER_CURRENCY_PER_LEVEL);
  return cleared200 ? base + TOWER_CLEAR_BONUS : base;
}

/// Gold reward: as if the player had just killed TOWER_MATERIAL_DROPS weak
/// monsters at the reached level's power stage — same scaling curve as
/// real combat (monsterGoldReward), just a lump sum instead of per-kill.
function computeTowerGoldReward(level) {
  const stage = resolveWeakPowerStage(towerPowerStage(level));
  return Math.round(monsterGoldReward(stage, false) * TOWER_MATERIAL_DROPS);
}

/// TOWER_MATERIAL_DROPS independent rolls, each landing on a random
/// material from the weak-monster band matching the reached level — same
/// band the run itself was drawing weak monsters from.
function rollTowerMaterials(level) {
  const stage = resolveWeakPowerStage(towerPowerStage(level));
  const group = getWeakMonsterGroupForStage(stage);
  const drops = [];
  for (let i = 0; i < TOWER_MATERIAL_DROPS; i++) {
    const monster = group.monsters[Math.floor(Math.random() * group.monsters.length)];
    drops.push(monster.material);
  }
  return drops;
}

/// Ends the run (death, timeout, or a level-200 clear), grants the rewards
/// (event currency, gold, and a batch of weak-monster materials — all
/// scaled to how far the run reached) and resets the persisted run state
/// so the next "Entrar" starts clean. Returns the reward summary for the
/// modal/UI.
export function endTowerRun(state, cleared200 = false) {
  const level = state.towerLevel;
  state.towerBestLevel = Math.max(state.towerBestLevel, level);
  const currency = DEBUG_FLAT_TOWER_REWARDS ? DEBUG_TOWER_CURRENCY : computeTowerReward(level, cleared200);
  const goldGained = computeTowerGoldReward(level);

  const gained = {};
  if (DEBUG_FLAT_TOWER_REWARDS) {
    for (const mat of allMonsterMaterials()) {
      state.materials[mat.id] = (state.materials[mat.id] || 0) + DEBUG_TOWER_MATERIAL_QTY;
      gained[mat.id] = { qty: DEBUG_TOWER_MATERIAL_QTY, emoji: mat.emoji, name: mat.name, image: mat.image || null };
    }
  } else {
    const materialDrops = rollTowerMaterials(level);
    for (const mat of materialDrops) {
      state.materials[mat.id] = (state.materials[mat.id] || 0) + 1;
      if (!gained[mat.id]) gained[mat.id] = { qty: 0, emoji: mat.emoji, name: mat.name, image: mat.image || null };
      gained[mat.id].qty += 1;
    }
  }

  state.eventCurrency += currency;
  state.gold += goldGained;
  state.towerRunActive = false;
  state.towerLevel = 1;
  state.towerMonsterHp = null;
  state.towerWeakMonsterId = null;

  const eggGained = Math.random() < EVENT_EGG_DROP_CHANCE;
  if (eggGained) state.eggCount = (state.eggCount || 0) + 1;

  return { level, cleared200, currency, goldGained, gained, eggGained };
}
