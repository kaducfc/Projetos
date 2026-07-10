const SAVE_KEY = 'idleHunterSave.v1';

export function createDefaultState() {
  return {
    gold: 0,
    runas: 0,
    stage: 1,
    maxStage: 1,
    monsterHp: null, // current monster's remaining HP; null = needs (re)spawn
    materials: {}, // materialId -> count
    inventory: [], // { uid, itemId }
    nextUid: 1,
    equipped: { weapon: null, helmet: null, armor: null, pants: null, gloves: null, boots: null }, // uid or null
    upgrades: {}, // upgradeId -> level
    prestigeUpgrades: {}, // upgradeId -> level
    totalKills: 0,
    lastSaveTime: Date.now(),
  };
}

export function saveState(state) {
  state.lastSaveTime = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Falha ao salvar o jogo:', err);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Merge onto defaults so new fields introduced later don't crash old saves.
    return Object.assign(createDefaultState(), parsed);
  } catch (err) {
    console.warn('Falha ao carregar o save, começando um jogo novo:', err);
    return null;
  }
}

export function hardResetState() {
  localStorage.removeItem(SAVE_KEY);
}
