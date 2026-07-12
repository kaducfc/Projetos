import { ACHIEVEMENTS } from '../data/achievements.js';

export function isAchievementClaimed(state, id) {
  return !!state.achievementsClaimed[id];
}

export function isAchievementReady(state, achievement) {
  return !isAchievementClaimed(state, achievement.id) && achievement.check(state);
}

export function claimAchievement(state, id) {
  const achievement = ACHIEVEMENTS.find((a) => a.id === id);
  if (!achievement || !isAchievementReady(state, achievement)) return false;
  state.achievementsClaimed[id] = true;
  state.cash += achievement.cashReward;
  return true;
}
