import { UPGRADES, upgradeCost, PRESTIGE_UPGRADES, prestigeUpgradeCost } from '../data/upgrades.js';

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

export function getPrestigeUpgradeLevel(state, id) {
  return state.prestigeUpgrades[id] || 0;
}

export function getPrestigeUpgradeCost(state, id) {
  const upgrade = PRESTIGE_UPGRADES.find((u) => u.id === id);
  return prestigeUpgradeCost(upgrade, getPrestigeUpgradeLevel(state, id));
}

export function buyPrestigeUpgrade(state, id) {
  const upgrade = PRESTIGE_UPGRADES.find((u) => u.id === id);
  if (!upgrade) return false;
  const cost = getPrestigeUpgradeCost(state, id);
  if (state.runas < cost) return false;
  state.runas -= cost;
  state.prestigeUpgrades[id] = getPrestigeUpgradeLevel(state, id) + 1;
  return true;
}
