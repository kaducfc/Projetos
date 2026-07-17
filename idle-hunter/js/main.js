import { createDefaultState, loadState, saveState, hardResetState } from './state.js';
import { computePlayerStats, getElementalResistance, getCardDamageBonus } from './systems/stats.js';
import { getCurrentMonster, applyDamage, setViewedStage, ensureMonsterSpawned, armorReduction, rollCrit, resolveClickHit } from './systems/combat.js';
import { isBossStage, findMaterialInfo, BOSSES } from './data/monsters.js';
import { elementDamageModifier } from './data/elements.js';
import { equipItem, unequipSlot } from './systems/equipment.js';
import { craftItem, enhanceItem, upgradeToMaster, socketCard, unsocketCard, attemptCardSlotUnlock, destroyItem, countEquippedCardCopies, MAX_EQUIPPED_CARD_COPIES } from './systems/crafting.js';
import { getItem } from './data/items.js';
import { buyUpgrade } from './systems/upgrades.js';
import { computeOfflineProgress, applyOfflineProgress, OFFLINE_EFFICIENCY } from './systems/offline.js';
import { formatNumber } from './format.js';
import { getTowerWindow, TOWER_RUN_DURATION_MS } from './data/events.js';
import { applyEventDamage, claimEventVictory, startEvent } from './systems/events.js';
import { canEnterTower, startTowerRun, ensureTowerMonsterSpawned, getTowerMonster, applyTowerDamage, endTowerRun } from './systems/tower.js';
import { claimAchievement } from './systems/achievements.js';
import { watchAd, buyCashItem, buyEventItem } from './systems/shop.js';
import { AD_WATCH_CASH_REWARD } from './data/shop.js';
import { claimCardReward } from './systems/cards.js';
import { CARD_DISCOVERY_CASH_REWARD, getCard } from './data/cards.js';
import { GAME_BUILD } from './version.js';
import {
  renderAll, renderTopBar, renderCombatStats, renderMonster, renderInventoryTab, renderForgeTab,
  renderUpgradesTab, renderBossTimer,
  renderPlayerHp, spawnDamagePopup, pulseMonster, showToast, showLootPopup, showModal, hideModal,
  showItemDetailModal, showEquipSlotModal, renderEventsTab, renderShopTab, pulseEventBoss,
  renderCardsTab, showCardDetailModal, iconMarkup, pulseTowerMonster,
  GOLD_ICON, EVENT_ICON, ESMERALDA_ICON,
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

// Torre Infinita run clock + the player's HP pool while inside it — both
// transient, same "a reload gives a fresh attempt" trade-off already made
// for the boss timer and the Caça Aprimorada attempt above. Re-armed from
// state.towerRunActive on init() if a run was mid-flight at save time.
let towerDeadline = null;
let towerHp = null;

function currentTowerRunRemainingMs() {
  return towerDeadline == null ? null : Math.max(0, towerDeadline - Date.now());
}

// Which sub-tab is showing in Forja (Receitas/Materiais) and Loja
// (Cash/Evento/Conquistas), plus which element the Inventário grid is
// filtered to (null = Todos) — pure UI state, not part of the save.
let activeForgeSubTab = 'recipes';
let activeShopSubTab = 'cash';
let inventoryFilterElement = null;

// Forja groups start collapsed (one boss's worth of recipe cards is a lot of
// screen) — a bossId in this set means the player explicitly expanded it.
let expandedForgeBosses = new Set();

// Inventário and Forja are separate bottom-nav tabs but share underlying
// data (equipping something changes what Forja shows as "already
// craftado"), so most mutations refresh both regardless of which is
// actually visible right now — cheap enough, and simpler than tracking
// which tab is active just to skip a redundant render.
function renderInventoryAndForge() {
  renderInventoryTab(state, inventoryFilterElement);
  renderForgeTab(state, activeForgeSubTab, expandedForgeBosses);
}

function renderEventsTabNow() {
  const towerMaxHp = state.towerRunActive ? computePlayerStats(state).maxHp : null;
  if (towerHp != null && towerMaxHp != null) towerHp = Math.min(towerHp, towerMaxHp);
  renderEventsTab(state, currentTowerRunRemainingMs(), towerHp, towerMaxHp);
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
  const stats = computePlayerStats(state, currentHp);
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
  renderInventoryAndForge();
  renderCardsTab(state);
  renderEventsTabNow();
  renderShopTab(state, activeShopSubTab);
  wireAllPanelButtons();
}

function refreshCombatOnly() {
  const monster = getCurrentMonster(state.stage, state.weakMonsterId);
  const stats = computePlayerStats(state, currentHp);
  currentHp = Math.min(currentHp, stats.maxHp);
  renderCombatStats(stats, monster);
  renderMonster(state, monster);
  renderPlayerHp(currentHp, stats.maxHp);
  return { monster, stats };
}

function handleKillEvent(event) {
  if (!event) return;
  showLootPopup(event.goldGained, event.drops);
  if (event.reprocced) showToast('🔁 Gaiatron: o chefe caiu de novo instantaneamente! Recompensas dobradas.');
  renderTopBar(state);
  // Gold/materials just changed, so refresh whatever depends on affordability
  // even if the player isn't actively interacting with those tabs right now.
  // One call covers Equipar/Forjar/Materiais, whichever sub-tab is showing.
  renderInventoryAndForge();
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
  const stats = computePlayerStats(state, currentHp);
  const monster = getCurrentMonster(state.stage, state.weakMonsterId);
  const hit = resolveClickHit(state, stats, 1 + elementDamageModifier(stats.weaponElement, monster.element) + getCardDamageBonus(state, monster.element));
  const event = applyDamage(state, hit.dealt, stats);
  spawnDamagePopup(hit.dealt, hit.isCrit, hit.isBurst);
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

  const stats = computePlayerStats(state, currentHp);
  currentHp = Math.min(currentHp, stats.maxHp);
  const monster = getCurrentMonster(state.stage, state.weakMonsterId);

  // Runs unconditionally, before the normal-stage combat below — that
  // block can `return` early on a kill, and at high DPS a stage-1 monster
  // dies almost every single tick, which would otherwise starve the event
  // boss of its DPS ticks entirely.
  tickEventBoss(stats);
  tickTower();

  if (stats.dps > 0) {
    const crit = rollCrit(stats);
    const dealt = stats.dps * (1 + elementDamageModifier(stats.weaponElement, monster.element) + getCardDamageBonus(state, monster.element)) * crit.multiplier;
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
  // pointerdown, not click: click only fires if pointerup lands on the same
  // element the browser considers "the target" at that instant, and this
  // button's own contents (the monster's <img>) get replaced by
  // renderMonster() on every single tick (100ms) — a fast clicker can
  // easily have a re-render land in the few ms between their mousedown and
  // mouseup, which silently drops that click. Firing on pointerdown instead
  // means every physical press counts, independent of any render race.
  document.getElementById('monster-sprite').addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    onClickMonster();
  });
  // Same attack, just a second (bigger, thumb-friendly) tap target — real
  // mobile layouts want a dedicated CTA button below the fold, not just the
  // sprite itself.
  document.getElementById('attack-button').addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    onClickMonster();
  });
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
        const uid = Number(equipBtn.dataset.modalEquip);
        const entry = state.inventory.find((i) => i.uid === uid);
        const cardId = entry?.cardId;
        const cardWillBeStripped = cardId && countEquippedCardCopies(state, cardId, uid) >= MAX_EQUIPPED_CARD_COPIES;
        equipItem(state, uid);
        hideModal();
        if (cardWillBeStripped) {
          showToast(`🃏 Já havia ${MAX_EQUIPPED_CARD_COPIES} cartas dessa equipadas — a carta voltou pro inventário.`);
        }
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
        const cardId = socketBtn.dataset.socketCardId;
        const isEquipped = Object.values(state.equipped).includes(uid);
        if (isEquipped && countEquippedCardCopies(state, cardId, uid) >= MAX_EQUIPPED_CARD_COPIES) {
          showToast(`❌ Você só pode ter ${MAX_EQUIPPED_CARD_COPIES} cartas iguais equipadas ao mesmo tempo.`);
          return;
        }
        if (socketCard(state, uid, cardId)) {
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
          showToast(`🎁 +${formatNumber(CARD_DISCOVERY_CASH_REWARD)} ${ESMERALDA_ICON} Esmeralda!`);
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

function wireInventoryTabEvents() {
  document.getElementById('tab-inventory').addEventListener('click', (e) => {
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

    const filterBtn = e.target.closest('[data-filter-element]');
    if (filterBtn) {
      inventoryFilterElement = filterBtn.dataset.filterElement || null;
      renderInventoryTab(state, inventoryFilterElement);
      return;
    }
  });
}

function wireForgeTabEvents() {
  document.getElementById('tab-forge').addEventListener('click', (e) => {
    const subtabBtn = e.target.closest('[data-forge-subtab]');
    if (subtabBtn) {
      activeForgeSubTab = subtabBtn.dataset.forgeSubtab;
      renderInventoryAndForge();
      return;
    }

    const forgeToggleBtn = e.target.closest('[data-toggle-forge]');
    if (forgeToggleBtn) {
      const bossId = forgeToggleBtn.dataset.toggleForge;
      if (expandedForgeBosses.has(bossId)) expandedForgeBosses.delete(bossId);
      else expandedForgeBosses.add(bossId);
      renderInventoryAndForge();
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
// Events tab — Caça Aprimorada: click "Entrar" during the window (see
// data/events.js) to roll a random eligible boss and start fighting it
// immediately — both clicks (here) and passive DPS (tickEventBoss(),
// called from the main tick() loop below) chip away at it, same as normal
// combat. The only difference from a normal monster: no damage comes back
// to the player, and there's no clock on the fight itself once entered —
// only entry (once per window) is time-gated. #tab-events is never
// recreated by innerHTML wholesale during a fight (renderEventsTab only
// ever replaces its own contents, same container), so the delegated
// listener from wireEventTabEvents() (see init()) is wired once and keeps
// working across every re-render.
// ---------------------------------------------------------------

function enterEvent() {
  const boss = startEvent(state);
  if (!boss) return;
  showToast(`🎪 Você entrou na Invasão de Chefes! Enfrentando ${boss.name}.`);
  renderEventsTabNow();
  renderTopBar(state);
}

/// Shared by the click and DPS-tick paths — whichever one lands the
/// killing blow reports the same way.
function handleEventBossVictory(boss) {
  const { gained, currency, cardDropped } = claimEventVictory(state, state.eventEnteredCycle, boss);
  showEventRewardModal(boss, gained, currency, cardDropped);
  renderTopBar(state);
  renderInventoryAndForge();
  renderCardsTab(state);
  renderShopTab(state, activeShopSubTab);
  renderEventsTabNow();
}

function showEventRewardModal(boss, gained, currency, cardDropped) {
  const lootLines = Object.values(gained)
    .map((g) => `<div class="offline-item-lines">+${g.qty} <span class="icon">${iconMarkup(g.image, g.emoji, g.name)}</span> ${g.name}</div>`)
    .join('');
  const cardBanner = cardDropped
    ? `<div class="mega-drop-banner">🌟 MEGA DROP! 🌟<br><span class="icon">${iconMarkup(cardDropped.image, cardDropped.emoji, cardDropped.name)}</span> +1 ${cardDropped.name}</div>`
    : '';
  showModal(`🎉 ${boss.name} derrotado!`, `
    ${cardBanner}
    <p><strong>Recompensas:</strong></p>
    ${lootLines}
    <p class="offline-item-lines">+${formatNumber(currency)} ${EVENT_ICON} Moeda de Evento</p>
  `);
}

function onClickEventBoss() {
  if (state.eventBossHp == null) return; // no fight in progress — must Entrar first
  const boss = BOSSES.find((b) => b.id === state.eventBossId);
  if (!boss) return;

  const stats = computePlayerStats(state, currentHp);
  const hit = resolveClickHit(state, stats, 1 + elementDamageModifier(stats.weaponElement, boss.element) + getCardDamageBonus(state, boss.element));
  const killed = applyEventDamage(state, hit.dealt);

  if (killed) {
    handleEventBossVictory(boss);
  } else {
    pulseEventBoss();
  }

  renderEventsTabNow();
}

/// Called every game tick (see tick() below) — applies passive DPS to the
/// event boss while a fight is in progress.
function tickEventBoss(stats) {
  if (state.eventBossHp == null) return;
  const boss = BOSSES.find((b) => b.id === state.eventBossId);
  if (!boss || stats.dps <= 0) return;

  const crit = rollCrit(stats);
  const dealt = stats.dps * (1 + elementDamageModifier(stats.weaponElement, boss.element) + getCardDamageBonus(state, boss.element)) * crit.multiplier;
  const killed = applyEventDamage(state, dealt * (TICK_MS / 1000));
  if (killed) handleEventBossVictory(boss);
  renderEventsTabNow();
}

// ---------------------------------------------------------------
// Torre Infinita — a continuous climb through 200 levels, entered from a
// recurring window (see data/events.js) and fought the same way as normal
// combat (click + passive DPS out, monster DPS in), but against its own
// separate HP pool (towerHp) so it never touches the player's main-stage
// fight. Ends on death, on the run's own 5-minute clock running out, or on
// clearing the level 200 boss — see endTowerRun() in systems/tower.js for
// the reward calculation.
// ---------------------------------------------------------------

function enterTower() {
  if (!startTowerRun(state)) return;
  towerDeadline = Date.now() + TOWER_RUN_DURATION_MS;
  towerHp = computePlayerStats(state).maxHp;
  showToast('🗼 Você entrou na Torre das Provações! Suba o quanto conseguir em 5 minutos.');
  renderEventsTabNow();
  renderTopBar(state);
}

function finishTowerRun(cleared200) {
  const { level, currency } = endTowerRun(state, cleared200);
  towerDeadline = null;
  towerHp = null;
  const msg = cleared200
    ? `👑 Torre conquistada! Você derrotou o chefe do nível 200 e ganhou +${formatNumber(currency)} ${EVENT_ICON}`
    : `🗼 Torre encerrada no nível ${level}. +${formatNumber(currency)} ${EVENT_ICON}`;
  showToast(msg);
  renderEventsTabNow();
  renderTopBar(state);
}

function onClickTowerMonster() {
  if (!state.towerRunActive) return;
  if (Date.now() >= towerDeadline) {
    finishTowerRun(false);
    return;
  }

  const stats = computePlayerStats(state, towerHp);
  ensureTowerMonsterSpawned(state);
  const monster = getTowerMonster(state.towerLevel, state.towerWeakMonsterId);
  const hit = resolveClickHit(state, stats, 1 + elementDamageModifier(stats.weaponElement, monster.element) + getCardDamageBonus(state, monster.element));
  const event = applyTowerDamage(state, hit.dealt);
  pulseTowerMonster();

  if (event) {
    if (event.cleared200) {
      finishTowerRun(true);
    } else {
      renderEventsTabNow();
    }
    return;
  }
  renderEventsTabNow();
}

/// Called every game tick — applies passive DPS out and monster DPS back
/// into towerHp while a run is active, and closes out the run if its clock
/// runs out or the player's tower HP hits 0.
function tickTower() {
  if (!state.towerRunActive) return;

  if (Date.now() >= towerDeadline) {
    finishTowerRun(false);
    return;
  }

  const stats = computePlayerStats(state, towerHp);
  towerHp = Math.min(towerHp, stats.maxHp);
  ensureTowerMonsterSpawned(state);
  const monster = getTowerMonster(state.towerLevel, state.towerWeakMonsterId);

  if (stats.dps > 0) {
    const crit = rollCrit(stats);
    const dealt = stats.dps * (1 + elementDamageModifier(stats.weaponElement, monster.element) + getCardDamageBonus(state, monster.element)) * crit.multiplier;
    const event = applyTowerDamage(state, dealt * (TICK_MS / 1000));
    if (event) {
      if (event.cleared200) finishTowerRun(true);
      else renderEventsTabNow();
      return;
    }
  }

  const reduction = totalIncomingReduction(stats, monster.element);
  const incoming = monster.dps * (1 - reduction) * (TICK_MS / 1000);
  towerHp -= incoming;

  if (towerHp <= 0) {
    finishTowerRun(false);
    return;
  }

  renderEventsTabNow();
}

function wireEventTabEvents() {
  const container = document.getElementById('tab-events');

  // pointerdown, not click, for the same reason as the main monster sprite
  // (see setupStageControls): renderEventsTabNow() replaces #tab-events'
  // entire innerHTML on every tick/second-refresh, and a fast clicker can
  // easily straddle one of those re-renders between mousedown and mouseup —
  // click would silently miss, pointerdown never does.
  container.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('#event-boss-sprite')) {
      onClickEventBoss();
      return;
    }
    if (e.target.closest('#tower-monster-sprite')) {
      onClickTowerMonster();
      return;
    }
  });

  container.addEventListener('click', (e) => {
    if (e.target.closest('[data-tower-enter]')) {
      enterTower();
      return;
    }

    if (e.target.closest('[data-event-enter]')) {
      enterEvent();
      return;
    }
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

// ---------------------------------------------------------------
// Shop tab — same delegation pattern as the modal (see wireModalEvents()
// above): #tab-shop itself is never recreated, only its innerHTML, so this
// is wired once in init() and survives every renderShopTab() call. Also
// covers the Conquistas sub-tab's claim/ad-watch buttons — Conquistas is
// folded into Shop for now (see renderShopTab in ui/render.js) rather than
// getting its own bottom-nav slot.
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
        renderInventoryAndForge(); // Materiais just changed
      }
      return;
    }

    const claimBtn = e.target.closest('[data-claim-achievement]');
    if (claimBtn) {
      if (claimAchievement(state, claimBtn.dataset.claimAchievement)) {
        showToast('🏆 Conquista resgatada!');
        renderTopBar(state);
        renderShopTab(state, activeShopSubTab);
      }
      return;
    }

    const adBtn = e.target.closest('#watch-ad-btn');
    if (adBtn) {
      if (watchAd(state)) {
        showToast(`🎬 +${formatNumber(AD_WATCH_CASH_REWARD)} ${ESMERALDA_ICON} Esmeralda!`);
        renderTopBar(state);
        renderShopTab(state, activeShopSubTab);
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
// re-renders. Inventário/Forja/Events/Shop (incl. Conquistas) use event
// delegation instead, wired once in init() (see wireModalEvents(),
// wireInventoryTabEvents(), wireForgeTabEvents(), wireEventTabEvents(),
// wireShopTabEvents()).
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

  const materialLines = Object.entries(progress.materialsGained).map(([id, qty]) => {
    const info = findMaterialInfo(id);
    const icon = iconMarkup(info?.image, info?.emoji ?? '', info?.name ?? id);
    return `+${formatNumber(qty)} <span class="icon">${icon}</span> ${info?.name ?? id}`;
  });
  const cardLines = Object.entries(progress.cardsGained).map(([id, qty]) => {
    const card = getCard(id);
    const icon = iconMarkup(card?.image, card?.emoji ?? '🃏', card?.name ?? id);
    return `+${formatNumber(qty)} <span class="icon">${icon}</span> ${card?.name ?? id}`;
  });
  const itemsHtml = [...materialLines, ...cardLines].length
    ? `<p class="offline-item-lines">${[...materialLines, ...cardLines].join('<br>')}</p>`
    : '';

  showModal('Bem-vindo de volta!', `
    <p>Você ficou fora por <strong>${timeStr}</strong> (máximo 8h de recompensa offline).</p>
    <p>Seu personagem continuou lutando sozinho, a ${Math.round(OFFLINE_EFFICIENCY * 100)}% de eficiência, e conseguiu:</p>
    <p>💀 ${formatNumber(progress.kills)} monstros derrotados<br>
       ${GOLD_ICON} +${formatNumber(progress.goldGained)} ouro</p>
    ${itemsHtml}
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
  wireInventoryTabEvents();
  wireForgeTabEvents();
  wireCardsTabEvents();
  wireEventTabEvents();
  wireShopTabEvents();
  resetPlayerHp();
  if (state.towerRunActive) {
    towerDeadline = Date.now() + TOWER_RUN_DURATION_MS;
    towerHp = computePlayerStats(state).maxHp;
    ensureTowerMonsterSpawned(state);
  }
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
    getTowerDeadline: () => towerDeadline,
    getTowerHp: () => towerHp,
    setTowerHp: (v) => { towerHp = v; renderEventsTabNow(); },
    forceTowerTimeout: () => { if (towerDeadline != null) towerDeadline = Date.now() - 1; },
  };
}

init();
