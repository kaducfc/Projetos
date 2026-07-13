import { createDefaultState, loadState, saveState, hardResetState } from './state.js';
import { computePlayerStats, getElementalResistance, getCardDamageBonus } from './systems/stats.js';
import { getCurrentMonster, applyDamage, setViewedStage, ensureMonsterSpawned, armorReduction } from './systems/combat.js';
import { isBossStage, findMaterialInfo, WEAK_MONSTER_GROUPS } from './data/monsters.js';
import { elementDamageModifier } from './data/elements.js';
import { equipItem, unequipSlot } from './systems/equipment.js';
import { craftItem, enhanceItem, upgradeToMaster, socketCard, unsocketCard, attemptCardSlotUnlock, destroyItem } from './systems/crafting.js';
import { getItem } from './data/items.js';
import { buyUpgrade } from './systems/upgrades.js';
import { computeOfflineProgress, applyOfflineProgress } from './systems/offline.js';
import { formatNumber } from './format.js';
import { getEventWindow, EVENT_TIME_LIMIT_MS, TRADE_COST } from './data/events.js';
import { isEventClaimed, ensureEventBossSpawned, applyEventDamage, claimEventVictory, resetEventEncounter, canTrade, performTrade, unlockTradeGroup, computeTradeReceiveQty } from './systems/events.js';
import { claimAchievement } from './systems/achievements.js';
import { watchAd, buyCashItem, buyEventItem } from './systems/shop.js';
import { AD_WATCH_CASH_REWARD } from './data/shop.js';
import { claimCardReward } from './systems/cards.js';
import { CARD_DISCOVERY_CASH_REWARD } from './data/cards.js';
import { GAME_BUILD } from './version.js';
import {
  renderAll, renderTopBar, renderCombatStats, renderMonster, renderEquipmentTab,
  renderUpgradesTab, renderBossTimer,
  renderPlayerHp, spawnDamagePopup, pulseMonster, showToast, showLootPopup, showModal, hideModal,
  showItemDetailModal, showEquipSlotModal, renderEventsTab, renderAchievementsTab, renderShopTab, pulseEventBoss,
  renderCardsTab, showCardDetailModal,
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

// Forja groups start collapsed (one boss's worth of recipe cards is a lot of
// screen) — a bossId in this set means the player explicitly expanded it.
let expandedForgeBosses = new Set();

// Same idea for the Eventos list — each entry is an event id ('caca' or
// 'mercador'). Which material the player picked as the trade-in for the
// Mercador event, how much of it they want to spend this trade, and which
// of its (now always-listed) stage bands are expanded, live here too,
// since it's all just as transient/UI-only.
let expandedEvents = new Set();
let tradeFromMaterialId = null;
let tradeQty = TRADE_COST;
let expandedTradeGroups = new Set();

function renderEquipTab() {
  renderEquipmentTab(state, activeEquipSubTab, expandedForgeBosses);
}

function renderEventsTabNow() {
  renderEventsTab(state, currentEventEngagementMs(), expandedEvents, tradeFromMaterialId, expandedTradeGroups, tradeQty);
}

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
  const monster = getCurrentMonster(state.stage, state.weakMonsterId);
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
  renderEquipTab();
  renderCardsTab(state);
  renderEventsTabNow();
  renderAchievementsTab(state);
  renderShopTab(state, activeShopSubTab);
  wireAllPanelButtons();
}

function refreshCombatOnly() {
  const monster = getCurrentMonster(state.stage, state.weakMonsterId);
  const stats = computePlayerStats(state);
  currentHp = Math.min(currentHp, stats.maxHp);
  renderCombatStats(stats, monster);
  renderMonster(state, monster);
  renderPlayerHp(currentHp, stats.maxHp);
  return { monster, stats };
}

function handleKillEvent(event) {
  if (!event) return;
  showLootPopup(event.goldGained, event.drops);
  renderTopBar(state);
  // Gold/materials just changed, so refresh whatever depends on affordability
  // even if the player isn't actively interacting with those tabs right now.
  // One call covers Equipar/Forjar/Materiais, whichever sub-tab is showing.
  renderEquipTab();
  renderUpgradesTab(state);
  renderCardsTab(state); // a card drop just changed discovered/claimable state
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
  const monster = getCurrentMonster(state.stage, state.weakMonsterId);
  const dealt = stats.clickDamage * (1 + elementDamageModifier(stats.weaponElement, monster.element) + getCardDamageBonus(state, monster.element));
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
  const monster = getCurrentMonster(state.stage, state.weakMonsterId);

  // Runs unconditionally, before the normal-stage combat below — that
  // block can `return` early on a kill, and at high DPS a stage-1 monster
  // dies almost every single tick, which would otherwise starve the event
  // boss of its DPS ticks entirely.
  tickEventBoss(stats);

  if (stats.dps > 0) {
    const dealt = stats.dps * (1 + elementDamageModifier(stats.weaponElement, monster.element) + getCardDamageBonus(state, monster.element));
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

// A rapid second click right after a mutating action (double-tap "just to
// be sure", a mis-timed second tap, etc.) is a real hazard here: actions
// like socket/unsocket replace the clicked button with a *different*
// control (the card picker) at roughly the same screen position, so an
// immediate follow-up click can land on that new control and trigger an
// unintended second mutation (e.g. clicking "Remover" then immediately
// clicking again lands on the picker that appeared in its place, silently
// re-socketing the card you just removed). This short lock — armed right
// before any mutating action fires and released a beat later — makes the
// whole click-then-mutate-then-rerender sequence atomic from the user's
// perspective, without needing to redesign the layout to avoid every
// possible position collision.
let modalActionLocked = false;
function runModalAction(fn) {
  if (modalActionLocked) return;
  modalActionLocked = true;
  // finally, or a throw inside fn() leaves the lock stuck forever and every
  // modal button silently dead until reload — the worst possible failure
  // mode for a guard that exists to *improve* click reliability. With the
  // release always scheduled, an exception still surfaces in the console
  // but the UI heals itself 300ms later.
  try {
    fn();
  } finally {
    setTimeout(() => { modalActionLocked = false; }, 300);
  }
}

// #modal-overlay itself is never recreated (only #modal-body's innerHTML
// changes, via showModal()), so this delegated listener only needs wiring
// once — see init(). Covers equip/unequip plus the same enhance/Rank-Master
// buttons the modal content shares with the old inline panel.
function wireModalEvents() {
  const overlay = document.getElementById('modal-overlay');

  overlay.addEventListener('click', (e) => {
    const equipBtn = e.target.closest('[data-modal-equip]');
    if (equipBtn) {
      runModalAction(() => {
        equipItem(state, Number(equipBtn.dataset.modalEquip));
        hideModal();
        fullRefresh();
      });
      return;
    }

    const unequipBtn = e.target.closest('[data-modal-unequip]');
    if (unequipBtn) {
      runModalAction(() => {
        unequipSlot(state, unequipBtn.dataset.modalUnequip);
        hideModal();
        fullRefresh();
      });
      return;
    }

    // In the four keep-the-popup-open actions below, the modal re-render
    // comes BEFORE fullRefresh() on purpose: the popup is the feedback the
    // user is actually looking at, and rendering it first isolates it from
    // any failure in the much larger whole-UI refresh (if some other tab's
    // render ever throws, the popup has already updated correctly instead
    // of being left showing pre-mutation state). fullRefresh() never
    // touches #modal-body, so the order swap changes nothing else.

    const enhanceBtn = e.target.closest('[data-enhance]');
    if (enhanceBtn) {
      runModalAction(() => {
        const uid = Number(enhanceBtn.dataset.enhance);
        if (enhanceItem(state, uid)) {
          showItemDetailModal(state, uid); // keep the popup open, with fresh numbers
          showToast('⬆️ Item aprimorado!');
          fullRefresh();
        }
      });
      return;
    }

    const masterBtn = e.target.closest('[data-master-upgrade]');
    if (masterBtn) {
      runModalAction(() => {
        const uid = Number(masterBtn.dataset.masterUpgrade);
        if (upgradeToMaster(state, uid)) {
          showItemDetailModal(state, uid);
          showToast('✨ Item evoluiu para Rank Master!');
          fullRefresh();
        }
      });
      return;
    }

    const unlockBtn = e.target.closest('[data-unlock-card-slot]');
    if (unlockBtn) {
      runModalAction(() => {
        const uid = Number(unlockBtn.dataset.unlockCardSlot);
        const result = attemptCardSlotUnlock(state, uid);
        if (result) {
          showItemDetailModal(state, uid);
          showToast(result.success
            ? '🔓 Slot de carta desbloqueado! (-1 🔷 Cristal)'
            : '❌ Tentativa falhou... (-1 🔷 Cristal)');
          fullRefresh();
        }
      });
      return;
    }

    // Only opens the picker (no state mutation), but still goes through the
    // lock so a stray double-tap can't immediately land on a card option
    // that appears at the same spot once the picker renders.
    const openPickerBtn = e.target.closest('[data-open-card-picker]');
    if (openPickerBtn) {
      runModalAction(() => {
        const uid = Number(openPickerBtn.dataset.openCardPicker);
        showItemDetailModal(state, uid, true);
      });
      return;
    }

    const socketBtn = e.target.closest('[data-socket-uid]');
    if (socketBtn) {
      runModalAction(() => {
        const uid = Number(socketBtn.dataset.socketUid);
        if (socketCard(state, uid, socketBtn.dataset.socketCardId)) {
          showItemDetailModal(state, uid);
          showToast('🃏 Carta encaixada!');
          fullRefresh();
        }
      });
      return;
    }

    const unsocketBtn = e.target.closest('[data-unsocket-uid]');
    if (unsocketBtn) {
      runModalAction(() => {
        const uid = Number(unsocketBtn.dataset.unsocketUid);
        if (unsocketCard(state, uid)) {
          showItemDetailModal(state, uid);
          showToast('🃏 Carta removida.');
          fullRefresh();
        }
      });
      return;
    }

    // Destroying is a two-step confirm rendered inline in the modal (not a
    // native window.confirm dialog: those are blocked/silently swallowed
    // inside a sandboxed iframe, e.g. when this game runs as a Claude
    // Artifact, which made the button look completely dead).
    const destroyBtn = e.target.closest('[data-destroy-uid]');
    if (destroyBtn) {
      runModalAction(() => {
        const uid = Number(destroyBtn.dataset.destroyUid);
        showItemDetailModal(state, uid, false, true);
      });
      return;
    }

    const cancelDestroyBtn = e.target.closest('[data-cancel-destroy-uid]');
    if (cancelDestroyBtn) {
      runModalAction(() => {
        const uid = Number(cancelDestroyBtn.dataset.cancelDestroyUid);
        showItemDetailModal(state, uid, false, false);
      });
      return;
    }

    const confirmDestroyBtn = e.target.closest('[data-confirm-destroy-uid]');
    if (confirmDestroyBtn) {
      runModalAction(() => {
        const uid = Number(confirmDestroyBtn.dataset.confirmDestroyUid);
        const entry = state.inventory.find((i) => i.uid === uid);
        if (!entry) return;
        const itemName = getItem(entry.itemId).name;
        const refund = destroyItem(state, uid);
        if (refund) {
          hideModal();
          const refundStr = Object.entries(refund)
            .map(([matId, qty]) => `+${qty} ${findMaterialInfo(matId)?.emoji ?? ''}`)
            .join(' ');
          showToast(`🗑️ ${itemName} destruído! ${refundStr}`);
          fullRefresh();
        }
      });
      return;
    }

    const claimCardBtn = e.target.closest('[data-claim-card]');
    if (claimCardBtn) {
      runModalAction(() => {
        const cardId = claimCardBtn.dataset.claimCard;
        if (claimCardReward(state, cardId)) {
          showCardDetailModal(state, cardId); // keep the popup open, with fresh state
          showToast(`🎁 +${formatNumber(CARD_DISCOVERY_CASH_REWARD)} 💎 Cash!`);
          renderTopBar(state);
          renderCardsTab(state);
        }
      });
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
      renderEquipTab();
      return;
    }

    const forgeToggleBtn = e.target.closest('[data-toggle-forge]');
    if (forgeToggleBtn) {
      const bossId = forgeToggleBtn.dataset.toggleForge;
      if (expandedForgeBosses.has(bossId)) expandedForgeBosses.delete(bossId);
      else expandedForgeBosses.add(bossId);
      renderEquipTab();
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
// Events tab — a "boss rush": once the first click lands and the attempt
// clock starts, both clicks (here) AND passive DPS (tickEventBoss(), called
// from the main tick() loop below) chip away at it, same as normal combat.
// The only differences from a normal monster: no damage comes back to the
// player, and the attempt clock is a hard 50s regardless of DPS/clicks.
// #tab-events is never recreated by innerHTML wholesale during a fight
// (renderEventsTab only ever replaces its own contents, same container),
// so the delegated listener from wireEventTabEvents() (see init()) is
// wired once and keeps working across every re-render.
// ---------------------------------------------------------------

/// Shared by the click and DPS-tick paths — whichever one lands the
/// killing blow reports the same way.
function handleEventBossVictory(win) {
  const { gained, currency } = claimEventVictory(state, win.cycleIndex, win.boss);
  eventDeadline = null;
  const lootStr = Object.values(gained).map((g) => ` +${g.qty} ${g.emoji}`).join('');
  showToast(`🎉 Chefe de evento derrotado! +${formatNumber(currency)} 🎫${lootStr}`);
  renderTopBar(state);
  renderEquipTab();
  renderShopTab(state, activeShopSubTab);
}

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
    renderEventsTabNow();
    return;
  }

  const stats = computePlayerStats(state);
  ensureEventBossSpawned(state, win.boss);
  const dealt = stats.clickDamage * (1 + elementDamageModifier(stats.weaponElement, win.boss.element) + getCardDamageBonus(state, win.boss.element));
  const killed = applyEventDamage(state, dealt);

  if (killed) {
    handleEventBossVictory(win);
  } else {
    pulseEventBoss();
  }

  renderEventsTabNow();
}

/// Called every game tick (see tick() below) — applies passive DPS to the
/// event boss while an attempt is in progress, and proactively cleans up a
/// timed-out attempt even if the player never clicks again (mirroring how
/// the main boss timer is handled in tick()/retreat()).
function tickEventBoss(stats) {
  if (eventDeadline == null) return;
  const win = getEventWindow();
  if (eventDeadlineCycle !== win.cycleIndex) {
    eventDeadline = null; // stale — the window rotated past this attempt
    return;
  }

  if (Date.now() >= eventDeadline) {
    resetEventEncounter(state);
    eventDeadline = null;
    showToast('⏳ Tempo esgotado! O chefe de evento escapou — tente de novo.');
    renderEventsTabNow();
    return;
  }

  if (!win.active || isEventClaimed(state, win.cycleIndex)) return;
  if (stats.dps <= 0 || state.eventBossHp == null) return; // not engaged yet — only a click starts it

  const dealt = stats.dps * (1 + elementDamageModifier(stats.weaponElement, win.boss.element) + getCardDamageBonus(state, win.boss.element));
  const killed = applyEventDamage(state, dealt * (TICK_MS / 1000));
  if (killed) handleEventBossVictory(win);
  renderEventsTabNow();
}

// Clamps to [TRADE_COST, however much of the currently-selected trade-in
// material the player actually has, rounded down to a whole TRADE_COST
// batch] — shared by the +/- steppers and the free-typed number input.
function clampTradeQty(qty) {
  const have = state.materials[tradeFromMaterialId] || 0;
  const max = Math.max(TRADE_COST, Math.floor(have / TRADE_COST) * TRADE_COST);
  if (!Number.isFinite(qty) || qty < TRADE_COST) return TRADE_COST;
  return Math.min(max, qty);
}

function wireEventTabEvents() {
  const container = document.getElementById('tab-events');

  container.addEventListener('click', (e) => {
    if (e.target.closest('#event-boss-sprite')) {
      onClickEventBoss();
      return;
    }

    const toggleBtn = e.target.closest('[data-toggle-event]');
    if (toggleBtn) {
      const id = toggleBtn.dataset.toggleEvent;
      if (expandedEvents.has(id)) expandedEvents.delete(id);
      else expandedEvents.add(id);
      renderEventsTabNow();
      return;
    }

    const toggleTradeGroupBtn = e.target.closest('[data-toggle-trade-group]');
    if (toggleTradeGroupBtn) {
      const startStage = Number(toggleTradeGroupBtn.dataset.toggleTradeGroup);
      if (expandedTradeGroups.has(startStage)) expandedTradeGroups.delete(startStage);
      else expandedTradeGroups.add(startStage);
      tradeFromMaterialId = null; // avoid a stale selection from a now-hidden group
      tradeQty = TRADE_COST;
      renderEventsTabNow();
      return;
    }

    const unlockTradeBtn = e.target.closest('[data-unlock-trade-group]');
    if (unlockTradeBtn) {
      const startStage = Number(unlockTradeBtn.dataset.unlockTradeGroup);
      const group = WEAK_MONSTER_GROUPS.find((g) => g.startStage === startStage);
      if (group && unlockTradeGroup(state, group)) {
        expandedTradeGroups.add(startStage);
        showToast(`🧺 Estágio ${group.startStage}–${group.endStage} desbloqueado!`);
        renderEventsTabNow();
      }
      return;
    }

    const selectBtn = e.target.closest('[data-trade-select]');
    if (selectBtn) {
      tradeFromMaterialId = selectBtn.dataset.tradeSelect;
      tradeQty = TRADE_COST;
      renderEventsTabNow();
      return;
    }

    if (e.target.closest('[data-trade-cancel]')) {
      tradeFromMaterialId = null;
      tradeQty = TRADE_COST;
      renderEventsTabNow();
      return;
    }

    if (e.target.closest('[data-trade-qty-inc]')) {
      tradeQty = clampTradeQty(tradeQty + TRADE_COST);
      renderEventsTabNow();
      return;
    }

    if (e.target.closest('[data-trade-qty-dec]')) {
      tradeQty = clampTradeQty(tradeQty - TRADE_COST);
      renderEventsTabNow();
      return;
    }

    const targetBtn = e.target.closest('[data-trade-target]');
    if (targetBtn && tradeFromMaterialId != null) {
      const toMaterialId = targetBtn.dataset.tradeTarget;
      const group = WEAK_MONSTER_GROUPS.find((g) => g.monsters.some((m) => m.material.id === tradeFromMaterialId));
      const fromInfo = findMaterialInfo(tradeFromMaterialId);
      const toInfo = findMaterialInfo(toMaterialId);
      const usedQty = tradeQty;
      const receivedQty = computeTradeReceiveQty(usedQty);
      const ok = group && performTrade(state, group, tradeFromMaterialId, toMaterialId, usedQty);
      tradeFromMaterialId = null;
      tradeQty = TRADE_COST;
      if (ok) {
        showToast(`🧺 Trocado! -${usedQty} ${fromInfo?.emoji ?? ''} ${fromInfo?.name ?? ''} · +${receivedQty} ${toInfo?.emoji ?? ''} ${toInfo?.name ?? ''}`);
      }
      renderEventsTabNow();
      renderEquipTab(); // Materiais may be showing, and just changed
      return;
    }
  });

  // Separate from the click handler above: typing a value fires input/change
  // events, not click, so the free-typed quantity box needs its own listener.
  container.addEventListener('change', (e) => {
    const qtyInput = e.target.closest('[data-trade-qty-input]');
    if (!qtyInput || tradeFromMaterialId == null) return;
    const snapped = Math.round(Number(qtyInput.value) / TRADE_COST) * TRADE_COST;
    tradeQty = clampTradeQty(snapped);
    renderEventsTabNow();
  });
}

// ---------------------------------------------------------------
// Cartas tab — clicking any card tile (owned or not) opens its detail
// popup in the shared #modal-overlay; claiming the first-discovery Cash
// reward happens from inside that popup, so it's handled in
// wireModalEvents() below (data-claim-card), not here.
// ---------------------------------------------------------------

function wireCardsTabEvents() {
  document.getElementById('tab-cards').addEventListener('click', (e) => {
    const tile = e.target.closest('[data-view-card]');
    if (tile) showCardDetailModal(state, tile.dataset.viewCard);
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
        renderTopBar(state);
        renderAchievementsTab(state);
      }
      return;
    }

    const adBtn = e.target.closest('#watch-ad-btn');
    if (adBtn) {
      if (watchAd(state)) {
        showToast(`🎬 +${formatNumber(AD_WATCH_CASH_REWARD)} 💎 Cash!`);
        renderTopBar(state);
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
        renderTopBar(state);
        renderShopTab(state, activeShopSubTab);
        renderEquipTab(); // Materiais just changed
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

// Re-wires the buttons that get recreated (via innerHTML) whenever their tab
// re-renders. Equipment, Events, Achievements and Shop use event delegation
// instead, wired once in init() (see wireModalEvents(), wireEquipmentTabEvents(),
// wireEventTabEvents(), wireAchievementsTabEvents(), wireShopTabEvents()).
function wireAllPanelButtons() {
  wireUpgradeButtons();
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
  document.getElementById('build-tag').textContent = GAME_BUILD;
  setupTabs();
  setupStageControls();
  wireModalEvents(); // one-time delegated listener, see wireModalEvents()
  wireEquipmentTabEvents();
  wireCardsTabEvents();
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
    renderEventsTabNow();
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
