import { UPGRADES, upgradeCost } from '../data/upgrades.js';

export function getUpgradeLevel(state, id) {
  return state.upgrades[id] || 0;
}

export function getUpgradeCost(state, id) {
  const upgrade = UPGRADES.find((u) => u.id === id);
  return upgradeCost(upgrade, getUpgradeLevel(state, id));
}

export function buyUpgrade(state, id) {
  const upgrade = UPGRADES.find((u) => u.id === id);
  if (!upgrade) return false;
  const cost = getUpgradeCost(state, id);
  if (state.gold < cost) return false;
  state.gold -= cost;
  state.upgrades[id] = getUpgradeLevel(state, id) + 1;
  return true;
}
