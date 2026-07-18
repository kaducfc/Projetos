import { getCard } from './data/cards.js';

const SAVE_KEY = 'idleHunterSave.v1';

export function createDefaultState() {
  return {
    gold: 0,
    stage: 1,
    maxStage: 1,
    monsterHp: null, // current monster's remaining HP; null = needs (re)spawn
    weakMonsterId: null, // which WEAK_MONSTER_GROUPS entry is spawned (non-boss stages only)
    sceneIndex: null, // which background scene is behind the monster (non-boss stages only, see ensureMonsterSpawned)
    materials: {}, // materialId -> count
    cards: {}, // cardId -> count (see data/cards.js)
    // Cartas tab collection tracking (see systems/cards.js): cardsDiscovered
    // marks a card as "ever obtained" forever, even after its count in
    // `cards` above drops back to 0 (e.g. once socketed into gear).
    // cardsRewardClaimed blocks re-claiming that card's one-time Cash bonus.
    cardsDiscovered: {}, // cardId -> true
    cardsRewardClaimed: {}, // cardId -> true
    inventory: [], // { uid, itemId }
    nextUid: 1,
    equipped: { weapon: null, helmet: null, armor: null, pants: null, gloves: null, boots: null }, // uid or null
    upgrades: {}, // upgradeId -> level
    totalKills: 0,
    lastSaveTime: Date.now(),

    // Solkaiser card's "every 50 clicks" burst counter — see
    // resolveClickHit() in systems/combat.js. Persisted so the countdown
    // survives a reload instead of quietly resetting.
    solkaiserClickCounter: 0,

    // Premium currency: earned via achievements or the (simulated) ad-watch
    // reward for now; a real-money purchase flow is a future integration.
    cash: 0,
    lastAdWatchTime: null,
    achievementsClaimed: {}, // achievementId -> true

    // Caça Aprimorada: a random boss (among those the player has already
    // reached, see pickEligibleEventBoss in systems/events.js) is rolled
    // the moment the player clicks "Entrar" during the window (see
    // data/events.js) — eventEnteredCycle blocks a second entry that same
    // window (even across a reload). eventBossId records which boss this
    // run's fight is against; eventBossHp/eventBossMaxHp persist so an
    // in-progress fight survives a reload (it has no timer of its own —
    // only clicking "Entrar" is time-gated); eventClaimedCycle blocks
    // re-entering after a win, same window.
    eventCurrency: 0,
    eventBossId: null,
    eventBossHp: null,
    eventBossMaxHp: null,
    eventEnteredCycle: null,
    eventClaimedCycle: null,
    eventWins: 0,

    // Torre Infinita (see data/events.js + systems/tower.js): a single
    // continuous run through 200 levels, entered once per TOWER_ACTIVE_MS
    // window. towerEnteredCycle blocks a second entry within that same
    // window (even across a reload); towerRunActive/towerLevel/
    // towerMonsterHp/towerWeakMonsterId are the persisted run state so an
    // in-progress climb survives a reload the same way normal combat does.
    // The run's own 5-minute clock is intentionally NOT persisted (see
    // main.js) — same "a reload gives a fresh attempt clock" trade-off
    // already made for the boss timer and the Caça Aprimorada attempt.
    towerRunActive: false,
    towerLevel: 1,
    towerMonsterHp: null,
    towerWeakMonsterId: null,
    towerEnteredCycle: null,
    towerBestLevel: 0,
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
    const state = Object.assign(createDefaultState(), parsed);
    // Card slots moved from a single locked/unlocked cardId field to an
    // always-unlocked cardIds array (1 slot normally, 2 once Rank Master —
    // see systems/crafting.js's ensureCardIds/maxCardSlots). Migrate any
    // pre-existing save's old single cardId into that array once here.
    for (const entry of state.inventory) {
      if (!entry.cardIds) {
        entry.cardIds = [entry.cardId ?? null];
        delete entry.cardId;
        delete entry.cardSlotUnlocked;
      }
    }
    // A monster/boss roster replacement (see data/cards.js) can leave an old
    // save's socketed card pointing at a card that no longer exists.
    // Rendering already falls back gracefully for this (see cardSlotHtml in
    // ui/render.js), but leaving it set would permanently block re-socketing
    // that slot (canSocketCard requires an empty slot) — clear it here
    // instead, once, so the slot is usable again.
    for (const entry of state.inventory) {
      entry.cardIds = entry.cardIds.map((id) => (id && !getCard(id) ? null : id));
    }
    return state;
  } catch (err) {
    console.warn('Falha ao carregar o save, começando um jogo novo:', err);
    return null;
  }
}

export function hardResetState() {
  localStorage.removeItem(SAVE_KEY);
}
