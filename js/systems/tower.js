import { isBossStage, getBossForStage, pickRandomWeakMonster, getWeakMonster } from '../data/monsters.js';
import { monsterMaxHp, monsterDamagePerSecond } from './combat.js';
import { getTowerWindow, TOWER_MAX_LEVEL, TOWER_CURRENCY_BASE, TOWER_CURRENCY_PER_LEVEL, TOWER_CLEAR_BONUS } from '../data/events.js';

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

/// Ends the run (death, timeout, or a level-200 clear), grants the reward
/// and resets the persisted run state so the next "Entrar" starts clean.
/// Returns the reward summary for the toast/UI.
export function endTowerRun(state, cleared200 = false) {
  const level = state.towerLevel;
  state.towerBestLevel = Math.max(state.towerBestLevel, level);
  const currency = computeTowerReward(level, cleared200);
  state.eventCurrency += currency;
  state.towerRunActive = false;
  state.towerLevel = 1;
  state.towerMonsterHp = null;
  state.towerWeakMonsterId = null;
  return { level, cleared200, currency };
}
