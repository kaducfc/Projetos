import { createDefaultState, loadState, saveState, hardResetState } from './state.js';
import { computePlayerStats } from './systems/stats.js';
import { getCurrentMonster, applyDamage, setViewedStage, ensureMonsterSpawned } from './systems/combat.js';
import { equipItem, unequipSlot } from './systems/equipment.js';
import { craftItem } from './systems/crafting.js';
import { buyUpgrade, buyPrestigeUpgrade } from './systems/upgrades.js';
import { doRebirth } from './systems/prestige.js';
import { computeOfflineProgress, applyOfflineProgress } from './systems/offline.js';
import { formatNumber } from './format.js';
import {
  renderAll, renderTopBar, renderCombatStats, renderMonster, renderEquipmentTab,
  renderForgeTab, renderUpgradesTab, renderPrestigeTab, renderMaterialsTab,
  spawnDamagePopup, pulseMonster, showToast, showModal, hideModal,
} from './ui/render.js';

const TICK_MS = 100;
const SAVE_INTERVAL_MS = 10000;

let state = loadState() || createDefaultState();
ensureMonsterSpawned(state);

function refreshAll() {
  const monster = getCurrentMonster(state.stage);
  const stats = computePlayerStats(state);
  renderAll(state, monster, stats);
  return { monster, stats };
}

// renderAll() replaces every tab's innerHTML, which destroys any listeners
// attached to their buttons — always re-wire right after, via this helper,
// instead of calling refreshAll() directly.
function fullRefresh() {
  refreshAll();
  wireAllPanelButtons();
}

function refreshCombatOnly() {
  const monster = getCurrentMonster(state.stage);
  const stats = computePlayerStats(state);
  renderCombatStats(stats);
  renderMonster(state, monster);
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
  renderForgeTab(state);
  renderMaterialsTab(state);
  renderUpgradesTab(state);
  renderPrestigeTab(state);
  wireAllPanelButtons();
}

function onClickMonster() {
  const stats = computePlayerStats(state);
  const event = applyDamage(state, stats.clickDamage, stats);
  spawnDamagePopup(stats.clickDamage);
  pulseMonster();
  if (event) {
    refreshCombatOnly();
    handleKillEvent(event);
  } else {
    renderMonster(state, getCurrentMonster(state.stage));
  }
}

function tick() {
  const stats = computePlayerStats(state);
  if (stats.dps > 0) {
    const event = applyDamage(state, stats.dps * (TICK_MS / 1000), stats);
    if (event) {
      refreshCombatOnly();
      handleKillEvent(event);
      return;
    }
  }
  renderMonster(state, getCurrentMonster(state.stage));
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
    if (setViewedStage(state, state.stage - 1)) refreshCombatOnly();
  });
  document.getElementById('stage-next').addEventListener('click', () => {
    if (setViewedStage(state, state.stage + 1)) refreshCombatOnly();
  });
  document.getElementById('stage-max').addEventListener('click', () => {
    if (setViewedStage(state, state.maxStage)) refreshCombatOnly();
  });
  document.getElementById('monster-sprite').addEventListener('click', onClickMonster);
}

// ---------------------------------------------------------------
// Equipment tab
// ---------------------------------------------------------------

// The <select> elements are recreated on every renderEquipmentTab() call, but
// this listener is delegated on the tab container (which is never recreated),
// so it only ever needs to be attached once — see init().
function wireEquipmentEvents() {
  document.getElementById('tab-equipment').addEventListener('equip-change', (e) => {
    const { slotId, uid } = e.detail;
    if (uid == null) unequipSlot(state, slotId);
    else equipItem(state, uid);
    fullRefresh();
  });
}

// ---------------------------------------------------------------
// Forge tab
// ---------------------------------------------------------------

function wireForgeButtons() {
  document.querySelectorAll('[data-craft]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.craft;
      const uid = craftItem(state, itemId);
      if (uid != null) {
        showToast('🔨 Item craftado e equipado!');
        fullRefresh();
      }
    });
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
// re-renders. Equipment uses event delegation instead, wired once in init().
function wireAllPanelButtons() {
  wireForgeButtons();
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
  wireEquipmentEvents(); // one-time delegated listener, see wireEquipmentEvents()
  fullRefresh();

  document.getElementById('modal-close').addEventListener('click', hideModal);

  showOfflineProgressIfAny();

  setInterval(tick, TICK_MS);
  setInterval(() => saveState(state), SAVE_INTERVAL_MS);
  window.addEventListener('beforeunload', () => saveState(state));

  // Handy for manual testing from the browser console.
  window.__idleHunter = {
    state,
    refresh: fullRefresh,
    save: () => saveState(state),
    hardReset: () => { hardResetState(); location.reload(); },
  };
}

init();
