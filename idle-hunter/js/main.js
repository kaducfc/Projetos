import { createDefaultState, loadState, saveState, hardResetState } from './state.js';
import { computePlayerStats } from './systems/stats.js';
import { getCurrentMonster, applyDamage, setViewedStage, ensureMonsterSpawned, armorReduction } from './systems/combat.js';
import { isBossStage } from './data/monsters.js';
import { equipItem, unequipSlot } from './systems/equipment.js';
import { craftItem, enhanceItem, upgradeToMaster } from './systems/crafting.js';
import { buyUpgrade, buyPrestigeUpgrade } from './systems/upgrades.js';
import { doRebirth } from './systems/prestige.js';
import { computeOfflineProgress, applyOfflineProgress } from './systems/offline.js';
import { formatNumber } from './format.js';
import {
  renderAll, renderTopBar, renderCombatStats, renderMonster, renderEquipmentTab,
  renderForgeTab, renderUpgradesTab, renderPrestigeTab, renderMaterialsTab, renderBossTimer,
  renderPlayerHp, spawnDamagePopup, pulseMonster, showToast, showModal, hideModal,
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
// instead of calling refreshAll() directly.
function fullRefresh() {
  refreshAll();
  wireAllPanelButtons();
}

function refreshCombatOnly() {
  const monster = getCurrentMonster(state.stage);
  const stats = computePlayerStats(state);
  currentHp = Math.min(currentHp, stats.maxHp);
  renderCombatStats(stats);
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
  renderForgeTab(state);
  renderMaterialsTab(state);
  renderUpgradesTab(state);
  renderPrestigeTab(state);
  wireAllPanelButtons();
  resetPlayerHp(); // a fresh monster just spawned — full heal for the new fight
  armBossTimer(); // stage may have just advanced onto (or off of) a boss
}

function onClickMonster() {
  if (bossDeadline != null && Date.now() >= bossDeadline) {
    retreat('timeout');
    return;
  }
  const stats = computePlayerStats(state);
  const event = applyDamage(state, stats.clickDamage, stats);
  spawnDamagePopup(stats.clickDamage);
  pulseMonster();
  if (event) {
    refreshCombatOnly();
    handleKillEvent(event);
  } else {
    renderMonster(state, getCurrentMonster(state.stage));
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

  if (stats.dps > 0) {
    const event = applyDamage(state, stats.dps * (TICK_MS / 1000), stats);
    if (event) {
      refreshCombatOnly();
      handleKillEvent(event);
      return;
    }
  }

  const monster = getCurrentMonster(state.stage);
  const incoming = monster.dps * (1 - armorReduction(stats.armor)) * (TICK_MS / 1000);
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
// Equipment tab
// ---------------------------------------------------------------

// The <select> elements are recreated on every renderEquipmentTab() call, but
// this listener is delegated on the tab container (which is never recreated),
// so it only ever needs to be attached once — see init().
function wireEquipmentEvents() {
  const container = document.getElementById('tab-equipment');

  container.addEventListener('equip-change', (e) => {
    const { slotId, uid } = e.detail;
    if (uid == null) unequipSlot(state, slotId);
    else equipItem(state, uid);
    fullRefresh();
  });

  container.addEventListener('item-enhance', (e) => {
    if (enhanceItem(state, e.detail.uid)) {
      showToast('⬆️ Item aprimorado!');
      fullRefresh();
    }
  });

  container.addEventListener('item-master-upgrade', (e) => {
    if (upgradeToMaster(state, e.detail.uid)) {
      showToast('✨ Item evoluiu para Rank Master!');
      fullRefresh();
    }
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
  resetPlayerHp();
  fullRefresh();
  armBossTimer();

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
    getBossDeadline: () => bossDeadline,
    forceBossTimeout: () => { if (bossDeadline != null) bossDeadline = Date.now() - 1; },
    getCurrentHp: () => currentHp,
    setCurrentHp: (v) => { currentHp = v; renderPlayerHp(currentHp, computePlayerStats(state).maxHp); },
  };
}

init();
