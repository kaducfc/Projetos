const SAVE_KEY = 'idleHunterSave.v1';

export function createDefaultState() {
  return {
    gold: 0,
    runas: 0,
    stage: 1,
    maxStage: 1,
    monsterHp: null, // current monster's remaining HP; null = needs (re)spawn
    weakMonsterId: null, // which WEAK_MONSTERS entry is spawned (non-boss stages only)
    materials: {}, // materialId -> count
    cards: {}, // cardId -> count (see data/cards.js)
    inventory: [], // { uid, itemId }
    nextUid: 1,
    equipped: { weapon: null, helmet: null, armor: null, pants: null, gloves: null, boots: null }, // uid or null
    upgrades: {}, // upgradeId -> level
    prestigeUpgrades: {}, // upgradeId -> level
    totalKills: 0,
    rebirthCount: 0,
    lastSaveTime: Date.now(),

    // Premium currency: earned via achievements or the (simulated) ad-watch
    // reward for now; a real-money purchase flow is a future integration.
    cash: 0,
    lastAdWatchTime: null,
    achievementsClaimed: {}, // achievementId -> true

    // Event boss: a specific monster family rotates in as an "event boss"
    // for a limited window (see data/events.js), fought by clicking only.
    // eventBossHp/eventBossMaxHp persist so an in-progress fight survives a
    // reload; eventClaimedCycle blocks re-farming the same window.
    eventCurrency: 0,
    eventBossHp: null,
    eventBossMaxHp: null,
    eventClaimedCycle: null,
    eventWins: 0,
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
