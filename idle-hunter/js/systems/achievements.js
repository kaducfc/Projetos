import { ACHIEVEMENTS, ACHIEVEMENT_STAGE_CASH_REWARD } from '../data/achievements.js';

/// Quantas etapas dessa conquista já foram resgatadas (0..stages.length).
export function claimedStageCount(state, id) {
  return state.achievementsClaimed[id] || 0;
}

export function isAchievementFullyClaimed(state, achievement) {
  return claimedStageCount(state, achievement.id) >= achievement.stages.length;
}

/// A etapa pendente (ainda não resgatada) é sempre a de índice ==
/// claimedStageCount — etapas são resgatadas em ordem, nunca puladas.
/// null se já resgatou tudo (ou se `stages` está vazio — ver
/// data/achievements.js "daily_missions", pendente).
export function currentStageTarget(state, achievement) {
  const claimed = claimedStageCount(state, achievement.id);
  return achievement.stages[claimed] ?? null;
}

export function isAchievementStageReady(state, achievement) {
  const target = currentStageTarget(state, achievement);
  if (target === null) return false;
  return achievement.progress(state) >= target;
}

export function claimAchievementStage(state, id) {
  const achievement = ACHIEVEMENTS.find((a) => a.id === id);
  if (!achievement || !isAchievementStageReady(state, achievement)) return false;
  state.achievementsClaimed[id] = claimedStageCount(state, id) + 1;
  state.cash += ACHIEVEMENT_STAGE_CASH_REWARD;
  return true;
}
