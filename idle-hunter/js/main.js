import { createDefaultState, loadState, saveState, hardResetState } from './state.js';
import { computePlayerStats, getElementalResistance } from './systems/stats.js';
import { getCurrentMonster, applyDamage, setViewedStage, ensureMonsterSpawned, armorReduction } from './systems/combat.js';
import { isBossStage } from './data/monsters.js';
import { elementDamageModifier } from './data/elements.js';
import { equipItem, unequipSlot } from './systems/equipment.js';
import { craftItem, enhanceItem, upgradeToMaster } from './systems/crafting.js';
import { buyUpgrade, buyPrestigeUpgrade } from './systems/upgrades.js';
import { doRebirth } from './systems/prestige.js';
import { computeOfflineProgress, applyOfflineProgress } from './systems/offline.js';
import { formatNumber } from './format.js';
import { getEventWindow, EVENT_TIME_LIMIT_MS } from './data/events.js';
import { isEventClaimed, ensureEventBossSpawned, applyEventDamage, claimEventVictory, resetEventEncounter } from './systems/events.js';
import { claimAchievement } from './systems/achievements.js';
import { watchAd, buyCashItem, buyEventItem } from './systems/shop.js';
import { AD_WATCH_CASH_REWARD } from './data/shop.js';
import {
  renderAll, renderTopBar, renderCombatStats, renderMonster, renderEquipmentTab,
  renderUpgradesTab, renderPrestigeTab, renderBossTimer,
  renderPlayerHp, spawnDamagePopup, pulseMonster, showToast, showModal, hideModal,
  showItemDetailModal, showEquipSlotModal, renderEventsTab, renderAchievementsTab, renderShopTab, pulseEventBoss,
} from './ui/render.js';

const TICK_MS = 100;
const SAVE_INTERVAL_MS = 10000;
const BOSS_TIME_LIMIT_MS = 30000;

let state = loadState() || createDefaultState();
ensureMonsterSpawned(state);

// Not persisted on purpose — a short combat timer shouldn't survive a reload
// or an offline gap, so every fresh session gives a clean 30s attempt.
let bossDeadline = null;

// Also not persisted: HP fully refills whenever a new monster/stage is
// entered (see resetPlayerHp()), so it's a fresh "can I survive this one
// fight" check each time rather than cumulative chip damage across many
// trivial monsters while idling — and closing the tab never costs you HP.
let currentHp = null;

function resetPlayerHp() {
  currentHp = computePlayerStats(state).maxHp;
}

// Event boss "attempt" clock — also transient, also cycle-scoped: a stale
// deadline from a previous cycle (e.g. the player left the tab open across
// a window change) must not carry over, hence the cycle check everywhere
// it's read (see currentEventEngagementMs()).
let eventDeadline = null;
let eventDeadlineCycle = null;

// Which sub-tab is showing in Equipamento (Equipar/Forjar/Materiais) and
// Loja (Cash/Moeda de Evento) — pure UI state, not part of the save.
let activeEquipSubTab = 'equip';
let activeShopSubTab = 'cash';

function currentEventEngagementMs() {
  const win = getEventWindow();
  if (eventDeadline == null || eventDeadlineCycle !== win.cycleIndex) return null;
  return Math.max(0, eventDeadline - Date.now());
}

// A boss only has a timer while it's still blocking progress (the frontier
// stage). Revisiting an already-beaten boss to farm materials is timer-free.
function isActiveBossFight() {
  return isBossStage(state.stage) && state.stage === state.maxStage;
}

function armBossTimer() {
  const shouldArm = isActiveBossFight();
  const wasArmed = bossDeadline != null;
  bossDeadline = shouldArm ? Date.now() + BOSS_TIME_LIMIT_MS : null;
  if (shouldArm && !wasArmed) {
    showToast('⚔️ Chefe! 30 segundos para derrotá-lo, ou você recua um estágio.');
  }
  renderBossTimer(bossDeadline != null ? bossDeadline - Date.now() : null);
}

/// Shared "you failed this stage" consequence for both the boss timer
/// running out and the player's HP hitting 0: step back one stage (never
/// below 1) without losing the maxStage record, and get a clean restart.
function retreat(reason) {
  const failedStage = state.stage;
  state.stage = Math.max(1, state.stage - 1);
  state.monsterHp = null;
  ensureMonsterSpawned(state);
  resetPlayerHp();
  const message = reason === 'death'
    ? `💀 Seu personagem morreu! Recuou do estágio ${failedStage} para o ${state.stage}.`
    : `⏳ Tempo esgotado! Você recuou do estágio ${failedStage} para o ${state.stage}.`;
  showToast(message);
  refreshCombatOnly();
  armBossTimer();
}

function refreshAll() {
  const monster = getCurrentMonster(state.stage);
  const stats = computePlayerStats(state);
  currentHp = Math.min(currentHp, stats.maxHp);
  renderAll(state, monster, stats);
  renderPlayerHp(currentHp, stats.maxHp);
  return { monster, stats };
}

// renderAll() replaces every tab's innerHTML, which destroys any listeners
// attached to their buttons — always re-wire right after, via this helper,
// instead of calling refreshAll() directly. Equipment/Events/Shop/
// Achievements aren't part of renderAll() (they need main.js-owned
// transient UI state — the attempt clock, which sub-tab is active — that
// render.js has no business knowing about) but use event delegation, so no
// re-wiring is needed for them.
function fullRefresh() {
  refreshAll();
  renderEquipmentTab(state, activeEquipSubTab);
  renderEventsTab(state, currentEventEngagementMs());
  renderAchievementsTab(state);
  renderShopTab(state, activeShopSubTab);
  wireAllPanelButtons();
}

function refreshCombatOnly() {
  const monster = getCurrentMonster(state.stage);
  const stats = computePlayerStats(state);
  currentHp = Math.min(currentHp, stats.maxHp);
  renderCombatStats(stats, monster);
  renderMonster(state, monster);
  renderPlayerHp(currentHp, stats.maxHp);
  return { monster, stats };
}

function handleKillEvent(event) {
  if (!event) return;
  showToast(`💀 Derrotado! +${formatNumber(event.goldGained)} 💰${
    event.drops.map((d) => ` +${d.qty} ${d.emoji}`).join('')
  }`);
  renderTopBar(state);
  // Gold/materials just changed, so refresh whatever depends on affordability
  // even if the player isn't actively interacting with those tabs right now.
  // One call covers Equipar/Forjar/Materiais, whichever sub-tab is showing.
  renderEquipmentTab(state, activeEquipSubTab);
  renderUpgradesTab(state);
  renderPrestigeTab(state);
  wireAllPanelButtons();
  resetPlayerHp(); // a fresh monster just spawned — full heal for the new fight
  armBossTimer(); // stage may have just advanced onto (or off of) a boss
}

// Combined reduction from armor (diminishing returns) and elemental
// resistance (flat 5% per matching defense piece), layered multiplicatively
// so neither can push the other's contribution to/past 100%.
function totalIncomingReduction(stats, monsterElement) {
  const armorRed = armorReduction(stats.armor);
  const elemRes = getElementalResistance(state, monsterElement);
  return 1 - (1 - armorRed) * (1 - elemRes);
}

function onClickMonster() {
  if (bossDeadline != null && Date.now() >= bossDeadline) {
    retreat('timeout');
    return;
  }
  const stats = computePlayerStats(state);
  const monster = getCurrentMonster(state.stage);
  const dealt = stats.clickDamage * (1 + elementDamageModifier(stats.weaponElement, monster.element));
  const event = applyDamage(state, dealt, stats);
  spawnDamagePopup(dealt);
  pulseMonster();
  if (event) {
    refreshCombatOnly();
    handleKillEvent(event);
  } else {
    renderMonster(state, monster);
    renderBossTimer(bossDeadline != null ? bossDeadline - Date.now() : null);
    renderPlayerHp(currentHp, stats.maxHp);
  }
}

function tick() {
  if (bossDeadline != null && Date.now() >= bossDeadline) {
    retreat('timeout');
    return;
  }

  const stats = computePlayerStats(state);
  currentHp = Math.min(currentHp, stats.maxHp);
  const monster = getCurrentMonster(state.stage);

  if (stats.dps > 0) {
    const dealt = stats.dps * (1 + elementDamageModifier(stats.weaponElement, monster.element));
    const event = applyDamage(state, dealt * (TICK_MS / 1000), stats);
    if (event) {
      refreshCombatOnly();
      handleKillEvent(event);
      return;
    }
  }

  const reduction = totalIncomingReduction(stats, monster.element);
  const incoming = monster.dps * (1 - reduction) * (TICK_MS / 1000);
  currentHp -= incoming;

  if (currentHp <= 0) {
    retreat('death');
    return;
  }

  renderMonster(state, monster);
  renderBossTimer(bossDeadline != null ? bossDeadline - Date.now() : null);
  renderPlayerHp(currentHp, stats.maxHp);
}

// ---------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ---------------------------------------------------------------
// Stage controls
// ---------------------------------------------------------------

function setupStageControls() {
  document.getElementById('stage-prev').addEventListener('click', () => {
    if (setViewedStage(state, state.stage - 1)) { resetPlayerHp(); refreshCombatOnly(); armBossTimer(); }
  });
  document.getElementById('stage-next').addEventListener('click', () => {
    if (setViewedStage(state, state.stage + 1)) { resetPlayerHp(); refreshCombatOnly(); armBossTimer(); }
  });
  document.getElementById('stage-max').addEventListener('click', () => {
    if (setViewedStage(state, state.maxStage)) { resetPlayerHp(); refreshCombatOnly(); armBossTimer(); }
  });
  document.getElementById('monster-sprite').addEventListener('click', onClickMonster);
}

// ---------------------------------------------------------------
// Item detail modal (opened from equipment slots and inventory tiles)
// ---------------------------------------------------------------

// #modal-overlay itself is never recreated (only #modal-body's innerHTML
// changes, via showModal()), so this delegated listener only needs wiring
// once — see init(). Covers equip/unequip plus the same enhance/Rank-Master
// buttons the modal content shares with the old inline panel.
function wireModalEvents() {
  const overlay = document.getElementById('modal-overlay');

  overlay.addEventListener('click', (e) => {
    const equipBtn = e.target.closest('[data-modal-equip]');
    if (equipBtn) {
      equipItem(state, Number(equipBtn.dataset.modalEquip));
      hideModal();
      fullRefresh();
      return;
    }

    const unequipBtn = e.target.closest('[data-modal-unequip]');
    if (unequipBtn) {
      unequipSlot(state, unequipBtn.dataset.modalUnequip);
      hideModal();
      fullRefresh();
      return;
    }

    const enhanceBtn = e.target.closest('[data-enhance]');
    if (enhanceBtn) {
      const uid = Number(enhanceBtn.dataset.enhance);
      if (enhanceItem(state, uid)) {
        showToast('⬆️ Item aprimorado!');
        fullRefresh();
        showItemDetailModal(state, uid); // keep the popup open, with fresh numbers
      }
      return;
    }

    const masterBtn = e.target.closest('[data-master-upgrade]');
    if (masterBtn) {
      const uid = Number(masterBtn.dataset.masterUpgrade);
      if (upgradeToMaster(state, uid)) {
        showToast('✨ Item evoluiu para Rank Master!');
        fullRefresh();
        showItemDetailModal(state, uid);
      }
      return;
    }
  });
}

// ---------------------------------------------------------------
// Equipment tab — also covers the Forjar and Materiais sub-tabs (folded in
// so they're not separate top-level tabs anymore). One delegated listener
// on the stable #tab-equipment container, wired once in init(): this tab
// re-renders very often (every kill), so per-render re-wiring is exactly
// the duplicate-listener bug class that bit this project twice before.
// ---------------------------------------------------------------

function wireEquipmentTabEvents() {
  document.getElementById('tab-equipment').addEventListener('click', (e) => {
    const subtabBtn = e.target.closest('[data-equip-subtab]');
    if (subtabBtn) {
      activeEquipSubTab = subtabBtn.dataset.equipSubtab;
      renderEquipmentTab(state, activeEquipSubTab);
      return;
    }

    const slotBtn = e.target.closest('[data-equip-slot]');
    if (slotBtn) {
      showEquipSlotModal(state, slotBtn.dataset.equipSlot);
      return;
    }

    const itemBtn = e.target.closest('[data-equip-item]');
    if (itemBtn) {
      showItemDetailModal(state, Number(itemBtn.dataset.equipItem));
      return;
    }

    const craftBtn = e.target.closest('[data-craft]');
    if (craftBtn) {
      const uid = craftItem(state, craftBtn.dataset.craft);
      if (uid != null) {
        showToast('🔨 Item craftado e equipado!');
        fullRefresh();
      }
      return;
    }
  });
}

// ---------------------------------------------------------------
// Events tab — click-only "boss rush": no passive DPS applies here (see
// data/events.js), so damage happens exclusively in onClickEventBoss().
// #tab-events is never recreated by innerHTML wholesale during a fight
// (renderEventsTab only ever replaces its own contents, same container),
// so the delegated listener from wireEventTabEvents() (see init()) is
// wired once and keeps working across every re-render.
// ---------------------------------------------------------------

function onClickEventBoss() {
  const win = getEventWindow();
  if (!win.active || isEventClaimed(state, win.cycleIndex)) return;

  if (eventDeadline == null || eventDeadlineCycle !== win.cycleIndex) {
    eventDeadline = Date.now() + EVENT_TIME_LIMIT_MS;
    eventDeadlineCycle = win.cycleIndex;
    resetEventEncounter(state);
  }

  if (Date.now() >= eventDeadline) {
    resetEventEncounter(state);
    eventDeadline = null;
    showToast('⏳ Tempo esgotado! O chefe de evento escapou — tente de novo.');
    renderEventsTab(state, null);
    return;
  }

  const stats = computePlayerStats(state);
  ensureEventBossSpawned(state, win.family);
  const dealt = stats.clickDamage * (1 + elementDamageModifier(stats.weaponElement, win.family.element));
  const killed = applyEventDamage(state, dealt);

  if (killed) {
    const { gained, currency } = claimEventVictory(state, win.cycleIndex, win.family);
    eventDeadline = null;
    const lootStr = Object.values(gained).map((g) => ` +${g.qty} ${g.emoji}`).join('');
    showToast(`🎉 Chefe de evento derrotado! +${formatNumber(currency)} 🎫${lootStr}`);
    renderTopBar(state);
    renderEquipmentTab(state, activeEquipSubTab);
    renderShopTab(state, activeShopSubTab);
  } else {
    pulseEventBoss();
  }

  renderEventsTab(state, currentEventEngagementMs());
}

function wireEventTabEvents() {
  document.getElementById('tab-events').addEventListener('click', (e) => {
    if (e.target.closest('#event-boss-sprite')) onClickEventBoss();
  });
}

// ---------------------------------------------------------------
// Achievements tab — the "earn Cash" side, separate from the Shop (which is
// purely "spend Cash / spend Event Currency" now). Same delegation pattern.
// ---------------------------------------------------------------

function wireAchievementsTabEvents() {
  document.getElementById('tab-achievements').addEventListener('click', (e) => {
    const claimBtn = e.target.closest('[data-claim-achievement]');
    if (claimBtn) {
      if (claimAchievement(state, claimBtn.dataset.claimAchievement)) {
        showToast('🏆 Conquista resgatada!');
        renderAchievementsTab(state);
      }
      return;
    }

    const adBtn = e.target.closest('#watch-ad-btn');
    if (adBtn) {
      if (watchAd(state)) {
        showToast(`🎬 +${formatNumber(AD_WATCH_CASH_REWARD)} 💎 Cash!`);
        renderAchievementsTab(state);
      }
      return;
    }
  });
}

// ---------------------------------------------------------------
// Shop tab — same delegation pattern as the modal (see wireModalEvents()
// above): #tab-shop itself is never recreated, only its innerHTML, so this
// is wired once in init() and survives every renderShopTab() call.
// ---------------------------------------------------------------

function wireShopTabEvents() {
  document.getElementById('tab-shop').addEventListener('click', (e) => {
    const subtabBtn = e.target.closest('[data-shop-subtab]');
    if (subtabBtn) {
      activeShopSubTab = subtabBtn.dataset.shopSubtab;
      renderShopTab(state, activeShopSubTab);
      return;
    }

    const buyCashBtn = e.target.closest('[data-buy-cash]');
    if (buyCashBtn) {
      if (buyCashItem(state, buyCashBtn.dataset.buyCash)) {
        showToast('🛒 Compra realizada!');
        renderTopBar(state);
        renderShopTab(state, activeShopSubTab);
      }
      return;
    }

    const buyEventBtn = e.target.closest('[data-buy-event-mat]');
    if (buyEventBtn) {
      const item = {
        matId: buyEventBtn.dataset.buyEventMat,
        amount: Number(buyEventBtn.dataset.buyEventAmount),
        cost: Number(buyEventBtn.dataset.buyEventCost),
      };
      if (buyEventItem(state, item)) {
        showToast('🛒 Compra realizada!');
        renderShopTab(state, activeShopSubTab);
        renderEquipmentTab(state, activeEquipSubTab); // Materiais just changed
      }
      return;
    }
  });
}

// ---------------------------------------------------------------
// Upgrades tab
// ---------------------------------------------------------------

function wireUpgradeButtons() {
  document.querySelectorAll('[data-upgrade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (buyUpgrade(state, btn.dataset.upgrade)) {
        renderTopBar(state);
        renderUpgradesTab(state);
        wireUpgradeButtons();
      }
    });
  });
}

// ---------------------------------------------------------------
// Prestige tab
// ---------------------------------------------------------------

function wirePrestigeButtons() {
  const rebirthBtn = document.getElementById('rebirth-btn');
  if (rebirthBtn) {
    rebirthBtn.addEventListener('click', () => {
      const gained = doRebirth(state);
      if (gained > 0) {
        showToast(`🔮 Você renasceu e ganhou ${formatNumber(gained)} Runas!`);
        fullRefresh();
      }
    });
  }
  document.querySelectorAll('[data-prestige-upgrade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (buyPrestigeUpgrade(state, btn.dataset.prestigeUpgrade)) {
        renderTopBar(state);
        renderPrestigeTab(state);
        wirePrestigeButtons();
      }
    });
  });
}

// Re-wires the buttons that get recreated (via innerHTML) whenever their tab
// re-renders. Equipment, Events, Achievements and Shop use event delegation
// instead, wired once in init() (see wireModalEvents(), wireEquipmentTabEvents(),
// wireEventTabEvents(), wireAchievementsTabEvents(), wireShopTabEvents()).
function wireAllPanelButtons() {
  wireUpgradeButtons();
  wirePrestigeButtons();
}

// ---------------------------------------------------------------
// Offline progress
// ---------------------------------------------------------------

function showOfflineProgressIfAny() {
  const progress = computeOfflineProgress(state);
  if (!progress) return;
  applyOfflineProgress(state, progress);

  const hours = Math.floor(progress.elapsedSeconds / 3600);
  const minutes = Math.floor((progress.elapsedSeconds % 3600) / 60);
  const timeStr = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
  const materialsStr = Object.entries(progress.materialsGained)
    .map(([id, qty]) => `+${formatNumber(qty)} de material`).length
    ? ' e alguns materiais' : '';

  showModal('Bem-vindo de volta!', `
    <p>Você ficou fora por <strong>${timeStr}</strong>.</p>
    <p>Seu personagem continuou lutando no estágio ${state.stage} e conseguiu:</p>
    <p>💀 ${formatNumber(progress.kills)} monstros derrotados<br>
       💰 +${formatNumber(progress.goldGained)} ouro${materialsStr}</p>
  `);
}

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------

function init() {
  setupTabs();
  setupStageControls();
  wireModalEvents(); // one-time delegated listener, see wireModalEvents()
  wireEquipmentTabEvents();
  wireEventTabEvents();
  wireAchievementsTabEvents();
  wireShopTabEvents();
  resetPlayerHp();
  fullRefresh();
  armBossTimer();

  document.getElementById('modal-close').addEventListener('click', hideModal);

  showOfflineProgressIfAny();

  setInterval(tick, TICK_MS);
  // Events/Achievements/Shop have their own slow clocks (window countdown,
  // ad cooldown, achievement eligibility) that nothing else drives a
  // re-render for — a plain 1s refresh is cheap and keeps them live without
  // hooking into every place stage/kills/materials could change.
  setInterval(() => {
    renderEventsTab(state, currentEventEngagementMs());
    renderAchievementsTab(state);
    renderShopTab(state, activeShopSubTab);
  }, 1000);
  setInterval(() => saveState(state), SAVE_INTERVAL_MS);
  window.addEventListener('beforeunload', () => saveState(state));

  // Handy for manual testing from the browser console.
  window.__idleHunter = {
    state,
    refresh: fullRefresh,
    save: () => saveState(state),
    hardReset: () => { hardResetState(); location.reload(); },
    getBossDeadline: () => bossDeadline,
    forceBossTimeout: () => { if (bossDeadline != null) bossDeadline = Date.now() - 1; },
    getCurrentHp: () => currentHp,
    setCurrentHp: (v) => { currentHp = v; renderPlayerHp(currentHp, computePlayerStats(state).maxHp); },
    getEventDeadline: () => eventDeadline,
    forceEventTimeout: () => { if (eventDeadline != null) eventDeadline = Date.now() - 1; },
  };
}

init();
