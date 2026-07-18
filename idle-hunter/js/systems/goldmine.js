import { getGoldMineWindow, GOLDMINE_BOSS_HP, GOLDMINE_GOLD_PER_DAMAGE } from '../data/events.js';

export function canEnterGoldMine(state, now = Date.now()) {
  if (state.goldMineRunActive) return false;
  const win = getGoldMineWindow(now);
  if (!win.active) return false;
  return state.goldMineEnteredCycle !== win.cycleIndex;
}

/// Returns true if the run actually started.
export function startGoldMineRun(state, now = Date.now()) {
  if (!canEnterGoldMine(state, now)) return false;
  const win = getGoldMineWindow(now);
  state.goldMineRunActive = true;
  state.goldMineBossHp = GOLDMINE_BOSS_HP;
  state.goldMineDamageDealt = 0;
  state.goldMineEnteredCycle = win.cycleIndex;
  return true;
}

/// Applies a hit; returns true if this hit killed the Gold Boss. Damage
/// counted toward the reward is capped at however much HP the boss
/// actually had left, so a huge overkill hit doesn't inflate the reward
/// beyond "the boss's full HP in gold".
export function applyGoldMineDamage(state, amount) {
  const applied = Math.min(amount, state.goldMineBossHp);
  state.goldMineBossHp = Math.max(0, state.goldMineBossHp - amount);
  state.goldMineDamageDealt += applied;
  return state.goldMineBossHp <= 0;
}

export function computeGoldMineReward(damageDealt) {
  return Math.round(damageDealt * GOLDMINE_GOLD_PER_DAMAGE);
}

/// Ends the run (boss killed or the 35s clock ran out — always a reward,
/// never a "loss") and resets the persisted run state so the next
/// "Entrar" starts clean. Returns the reward summary for the modal.
export function endGoldMineRun(state) {
  const goldGained = computeGoldMineReward(state.goldMineDamageDealt);
  state.gold += goldGained;
  state.goldMineRunActive = false;
  state.goldMineBossHp = 0;
  state.goldMineDamageDealt = 0;
  return { goldGained };
}
