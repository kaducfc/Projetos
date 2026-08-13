import { createDefaultState, loadState, saveState, hardResetState, isVipActive } from './state.js';
import { computePlayerStats, getElementalResistance } from './systems/stats.js';
import {
  getCurrentMonster, applyDamage, ensureMonsterSpawned, armorReduction, resolveHit,
  advanceHitClock, setSelectedMonsters, canSelectMonster, MAX_SELECTED_MONSTERS, resolvePetHit, rollDodge,
  resolveDoubleHit,
} from './systems/combat.js';
import { findMaterialInfo, BOSSES } from './data/monsters.js';
import { elementDamageModifier } from './data/elements.js';
import { equipItem, unequipSlot, findEquippedSlotId } from './systems/equipment.js';
import { enhanceItem, upgradeToMaster, rollAscensionCandidates, finalizeAscension, socketCard, unsocketCard, destroyItem, countEquippedCardCopies, MAX_EQUIPPED_CARD_COPIES, ensureCardIds } from './systems/crafting.js';
import { getItem, getRarity } from './data/items.js';
import { computeOfflineProgress, applyOfflineProgress, OFFLINE_EFFICIENCY } from './systems/offline.js';
import { formatNumber } from './format.js';
import { enterExpedition } from './systems/expedition.js';
import { ARENA_RUN_DURATION_MS, ARENA_COOLDOWN_MS, canEnterArena, startArenaRun, applyArenaDamage, endArenaRun } from './systems/arena.js';
import { claimAchievement } from './systems/achievements.js';
import { watchAd, buyCashItem, buyEventItem } from './systems/shop.js';
import { AD_WATCH_CASH_REWARD } from './data/shop.js';
import { claimCardReward, recycleCard, craftCard } from './systems/cards.js';
import {
  CARD_DISCOVERY_CASH_REWARD, getCard, CARD_FRAGMENT_NAME, getCardRecycleValue,
} from './data/cards.js';
import { GAME_BUILD } from './version.js';
import {
  equipPet, unequipPetSlot, recyclePet, canFusePets, fusePets, getFusePartners,
  addPetToInventory, getPetEntry, canChooseRightPet, useFreeRightPetChoice, getActivePetDpsMultiplier,
  fuseAllPossiblePets, hatchAllEggs, rollHatchCandidates, recordPetHatchOutcome, donatePetFragments,
} from './systems/pets.js';
import { buySkillLevel, buySpecial, resetSkillTree } from './systems/skills.js';
import {
  renderAll, renderTopBar, renderHunterLevel, renderCombatStats, renderMonster, renderNoMonsterSelected,
  renderInventoryTab, renderUpgradesTab, renderBossTimer,
  renderPlayerHp, spawnDamagePopup, spawnPetDamagePopup, pulseMonster, showToast, showLootPopup, showModal, hideModal,
  showItemDetailModal, showEquipSlotModal, showMonsterSelectModal, renderEventsTab, renderShopTab,
  renderCardsTab, showCardDetailModal, iconMarkup,
  renderPetsTab, showPetDetailModal, showHatchModal, showAscensionModal, showFullStatsModal,
  GOLD_ICON, EVENT_ICON, ESMERALDA_ICON, CARD_ICON, CARD_FRAGMENT_ICON, expeditionDurationLabel,
  EGG_ICON, PET_FRAGMENT_ICON,
  showArenaRanksModal, pulseArenaTarget, showVipBenefitsModal,
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

// Combate Permanente's own 30s fight clock — same "a reload gives a fresh
// attempt" trade-off already made for the boss timer and the Caça
// Aprimorada attempt above (not persisted).
let arenaDeadline = null;

function currentArenaRunRemainingMs() {
  return arenaDeadline == null ? null : Math.max(0, arenaDeadline - Date.now());
}

// Which sub-tab is showing in Loja (Cash/Evento/Conquistas), plus which
// equipment category the Inventário grid is filtered to (null = Todos),
// plus the monster-selection modal's in-progress edit (only committed to
// state.selectedMonsters on "Confirmar") — pure UI state, not part of the save.
let activeShopSubTab = 'cash';
let inventoryFilterCategory = null;
let pendingMonsterSelection = [];
// Seleção em massa no Inventário (segurar um item por 1s pra entrar no modo,
// ver wireInventoryTabEvents): selectedUids sobrevive a re-renders (a aba é
// recriada via innerHTML a cada kill) porque vive aqui fora, não no DOM.
// confirming é o segundo passo do "Destruir selecionados" (mesmo padrão
// non-blocking do destroy individual — window.confirm é bloqueado num
// iframe sandboxed, ver comentário mais abaixo).
let bulkSelectMode = false;
let bulkSelectedUids = new Set();
let bulkConfirmingDestroy = false;
// Os 2 candidatos rolados ao chocar um ovo (ver openHatchModal) — só
// commitados em state.pets quando o jogador escolhe um lado (data-hatch-choose
// no modal, ver wireModalEvents).
let pendingHatchCandidates = null;
// Os 3 candidatos de bônus adicional rolados ao ascender um item de Rank
// Master pra próxima raridade (ver rollAscensionCandidates em
// systems/crafting.js) — só commitado quando o jogador escolhe 1 dos 3
// (data-ascend-choose no modal, ver wireModalEvents). O restante do item
// (custo, raridade, baseStats novos) já veio junto no objeto pending; só
// falta saber qual dos 3 bônus vira o adicional novo.
let pendingAscension = null;
// "Resetar Pontos" da árvore de habilidades — mesmo padrão non-blocking de
// confirmação do bulkConfirmingDestroy acima. Precisa sobreviver a
// re-renders incidentais da aba (ver renderUpgradesTabNow abaixo, chamada
// a cada kill pra refletir XP/pontos novos) — sem isso, matar um monstro
// bem no meio da confirmação fecharia o diálogo sozinho.
let skillResetConfirming = false;
// Ordenação da grade de Inventário da aba Mascotes — null = ordem padrão
// (a de state.pets, ou seja, ordem de chocar/fundir); 'level'/'rarity'/
// 'element' reordenam só a EXIBIÇÃO (ver sortPetsForDisplay em
// ui/render.js), nunca mexem em state.pets em si.
let petSortMode = null;
// Os 3 cartões de duração da Expedição do Caçador ficam escondidos até o
// jogador clicar "Entrar" no banner — depois de escolher 1 e receber a
// recompensa (ver enterExpeditionTier abaixo), voltam a ficar escondidos,
// sobrando só o banner de vitrine. Pura UI state, não faz parte do save.
let expeditionCardsVisible = false;

function renderUpgradesTabNow() {
  renderUpgradesTab(state, skillResetConfirming);
}

function renderPetsTabNow() {
  renderPetsTab(state, petSortMode);
}

function renderInventoryTabNow() {
  renderInventoryTab(state, inventoryFilterCategory, {
    active: bulkSelectMode,
    selectedUids: bulkSelectedUids,
    confirming: bulkConfirmingDestroy,
  });
}

// uid opcional: chamado sem argumento pelo botão "☑️ Selecionar" (entra no
// modo com nada marcado ainda, ver data-bulk-toggle-select).
function enterBulkSelectMode(uid = null) {
  bulkSelectMode = true;
  bulkSelectedUids = uid != null ? new Set([uid]) : new Set();
  bulkConfirmingDestroy = false;
  renderInventoryTabNow();
}

function exitBulkSelectMode() {
  bulkSelectMode = false;
  bulkSelectedUids = new Set();
  bulkConfirmingDestroy = false;
  renderInventoryTabNow();
}

function toggleBulkSelected(uid) {
  if (bulkSelectedUids.has(uid)) bulkSelectedUids.delete(uid);
  else bulkSelectedUids.add(uid);
  renderInventoryTabNow();
}

/// "Selecionar Todos" — marca todo item elegível pra seleção em massa:
/// respeita o filtro de categoria ativo (mesmo conjunto mostrado na grade,
/// ver equipRingContentHtml em ui/render.js) e pula qualquer item já
/// equipado, exatamente como o clique individual já recusa (ver
/// bulkLocked em inventoryTileHtml) — um item equipado nunca entra na
/// seleção em massa.
function selectAllBulkEligible() {
  const filtered = inventoryFilterCategory
    ? state.inventory.filter((entry) => getItem(entry.itemId)?.category === inventoryFilterCategory)
    : state.inventory;
  bulkSelectedUids = new Set(
    filtered.filter((entry) => findEquippedSlotId(state, entry.uid) == null).map((entry) => entry.uid),
  );
  renderInventoryTabNow();
}

function renderEventsTabNow() {
  renderEventsTab(state, currentArenaRunRemainingMs(), expeditionCardsVisible);
}

// Um chefe só tem cronômetro quando é o monstro ativo agora — nunca "trava
// progresso" mais (não existe mais estágio linear), é só um desafio extra
// contra o relógio quando o sorteio calha nele.
function isActiveBossFight() {
  return state.currentMonster != null && state.currentMonster.kind === 'boss';
}

function armBossTimer() {
  const shouldArm = isActiveBossFight();
  const wasArmed = bossDeadline != null;
  bossDeadline = shouldArm ? Date.now() + BOSS_TIME_LIMIT_MS : null;
  if (shouldArm && !wasArmed) {
    showToast('⚔️ Chefe! 30 segundos para derrotá-lo, ou ele foge.');
  }
  renderBossTimer(bossDeadline != null ? bossDeadline - Date.now() : null);
}

/// Shared "you failed this fight" consequence for both the boss timer
/// running out and the player's HP hitting 0: full heal and a fresh monster
/// sorteado do mesmo pool de selecionados (sem retroceder progresso — não
/// existe mais estágio pra recuar).
function retreat(reason) {
  state.monsterHp = null;
  state.nextMonsterSpawnAt = null;
  ensureMonsterSpawned(state);
  resetPlayerHp();
  const message = reason === 'death'
    ? '💀 Seu personagem morreu! Recuperando e tentando novamente...'
    : '⏳ Tempo esgotado contra o chefe! Ele fugiu — tentando novamente...';
  showToast(message);
  refreshCombatOnly();
  armBossTimer();
}

/// Monstro pra exibir na tela: o de verdade quando há um vivo (monster);
/// senão o último que morreu (ver state.lastMonsterRef/applyDamage em
/// systems/combat.js), ainda mostrado (com a barra de vida zerada, ver
/// renderMonster) enquanto a pausa de respawn não vence — assim a Caça não
/// cai na tela de "?" (renderNoMonsterSelected) só porque o monstro acabou
/// de morrer. Essa tela de "?" fica reservada pro caso de não haver NENHUM
/// monstro selecionado pra caçar.
function getDisplayMonster(monster) {
  if (monster) return monster;
  if ((state.selectedMonsters || []).length > 0 && state.lastMonsterRef) {
    return getCurrentMonster(state.lastMonsterRef);
  }
  return null;
}

function refreshAll() {
  ensureMonsterSpawned(state);
  const monster = getCurrentMonster(state.currentMonster);
  const displayMonster = getDisplayMonster(monster);
  const stats = computePlayerStats(state, currentHp);
  currentHp = Math.min(currentHp, stats.maxHp);
  renderAll(state, displayMonster, stats);
  renderHunterLevel(state);
  if (!displayMonster) renderNoMonsterSelected();
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
  renderInventoryTabNow();
  renderCardsTab(state);
  renderEventsTabNow();
  renderShopTab(state, activeShopSubTab);
  renderPetsTabNow();
}

function refreshCombatOnly() {
  ensureMonsterSpawned(state);
  const monster = getCurrentMonster(state.currentMonster);
  const displayMonster = getDisplayMonster(monster);
  const stats = computePlayerStats(state, currentHp);
  currentHp = Math.min(currentHp, stats.maxHp);
  renderCombatStats(stats, displayMonster);
  if (displayMonster) renderMonster(state, displayMonster); else renderNoMonsterSelected();
  renderPlayerHp(currentHp, stats.maxHp);
  return { monster, stats };
}

function handleKillEvent(event) {
  if (!event) return;
  showLootPopup(event.goldGained, event.drops);
  if (event.itemDropResult?.discarded) {
    const { matId, qty } = event.itemDropResult.material;
    const matInfo = findMaterialInfo(matId);
    showToast(`🎒 Inventário de itens cheio! Item convertido em +${qty} ${matInfo?.emoji ?? ''} ${matInfo?.name ?? ''}.`);
  } else if (event.itemDropResult?.uid != null) {
    const dropped = state.inventory.find((i) => i.uid === event.itemDropResult.uid);
    if (dropped) {
      const item = getItem(dropped.itemId);
      showToast(`🎁 Item dropado: ${item.name} (${getRarity(dropped.rarityId).name})!`);
    }
  }
  if (event.levelsGained > 0) {
    showToast(`⭐ Nível de caça ${state.hunterLevel}! Novas zonas/chefes podem ter sido liberados.`);
  }
  if (event.eggGained) {
    showToast(`${EGG_ICON} Ovo de mascote encontrado!`);
    renderPetsTabNow();
  }
  renderTopBar(state);
  renderHunterLevel(state);
  // Gold/materials just changed, so refresh whatever depends on affordability
  // even if the player isn't actively interacting with those tabs right now.
  renderInventoryTabNow();
  renderUpgradesTabNow();
  renderCardsTab(state); // a card drop just changed discovered/claimable state
  resetPlayerHp(); // a fresh monster just spawned — full heal for the new fight
  armBossTimer(); // the new monster may (or may not) be a boss
}

// Combined reduction from armor (diminishing returns) and elemental
// resistance (flat 5% per matching defense piece), layered multiplicatively
// so neither can push the other's contribution to/past 100%.
function totalIncomingReduction(stats, monsterElement) {
  const armorRed = armorReduction(stats.armor);
  const elemRes = getElementalResistance(state, monsterElement);
  return 1 - (1 - armorRed) * (1 - elemRes);
}

// Relógio de hit discreto do combate principal (Caça) — cada contexto de
// combate tem o seu (ver tickArena abaixo), independente entre si. Sem
// clique: o personagem golpeia sozinho no ritmo de attackSpeedPerSec (ver
// systems/stats.js), e advanceHitClock() (ver systems/combat.js) decide a
// cada tick se já é hora do próximo golpe.
let nextHitAt = null;

function tick() {
  if (bossDeadline != null && Date.now() >= bossDeadline) {
    retreat('timeout');
    return;
  }

  const stats = computePlayerStats(state, currentHp);
  currentHp = Math.min(currentHp, stats.maxHp);

  tickArena();

  ensureMonsterSpawned(state);
  const monster = getCurrentMonster(state.currentMonster);
  if (!monster) return; // nenhum monstro selecionado ainda

  const clock = advanceHitClock(nextHitAt, stats.attackSpeedPerSec);
  nextHitAt = clock.nextHitAt;

  if (clock.hit) {
    const elementalMultiplier = (1 + elementDamageModifier(stats.weaponElement, monster.element))
      * getActivePetDpsMultiplier(state, monster.element);
    const hit = resolveHit(state, stats, elementalMultiplier);
    const petHit = resolvePetHit(state, monster.element, stats);
    const doubleHit = resolveDoubleHit(stats, elementalMultiplier);
    const totalDealt = hit.dealt + (petHit ? petHit.dealt : 0) + (doubleHit ? doubleHit.dealt : 0);
    const event = applyDamage(state, totalDealt, stats);
    spawnDamagePopup(hit.dealt, hit.isCrit);
    if (petHit) spawnPetDamagePopup(petHit.dealt, petHit.species, petHit.isCrit);
    if (doubleHit) spawnDamagePopup(doubleHit.dealt, doubleHit.isCrit);
    if (stats.lifesteal) currentHp = Math.min(currentHp + stats.lifesteal, stats.maxHp);
    pulseMonster();
    if (event) {
      refreshCombatOnly();
      handleKillEvent(event);
      return;
    }
  }

  const reduction = totalIncomingReduction(stats, monster.element);
  const incoming = rollDodge(stats) ? 0 : monster.dps * (1 - reduction) * (TICK_MS / 1000);
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

// "Outros" no menu de baixo abre um popup (#more-menu) com Cartas/Loja, que
// não cabem mais nas 6 vagas fixas do nav principal. Um clique num
// data-tab, seja no nav principal ou dentro do popup, ativa a aba do mesmo
// jeito de sempre — só que se veio do popup, o botão "Outros" (não a aba
// real) é quem fica marcado como ativo no nav principal, já que Cartas/Loja
// não têm mais vaga própria lá.
const MORE_MENU_TAB_IDS = ['cards', 'shop'];

function closeMoreMenu() {
  document.getElementById('more-menu').classList.add('hidden');
}

function setupTabs() {
  const moreToggleBtn = document.getElementById('more-toggle-btn');
  const moreMenu = document.getElementById('more-menu');

  function activateTab(tabId) {
    document.querySelectorAll('.tab-btn, .more-menu-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    if (MORE_MENU_TAB_IDS.includes(tabId)) {
      moreToggleBtn.classList.add('active');
      document.querySelector(`.more-menu-btn[data-tab="${tabId}"]`).classList.add('active');
    } else {
      document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    }
  }

  document.querySelectorAll('.tab-btn[data-tab], .more-menu-btn[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab);
      closeMoreMenu();
    });
  });

  moreToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    moreMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (moreMenu.classList.contains('hidden')) return;
    if (moreMenu.contains(e.target) || e.target === moreToggleBtn) return;
    closeMoreMenu();
  });
}

// ---------------------------------------------------------------
// Seleção de monstros (estilo IdleArc) — até 4, de qualquer zona liberada,
// sorteados uniformemente a cada spawn (ver systems/combat.js). Sem clique
// no monstro: o combate é 100% automático (ver tick() acima), o botão
// #select-monsters-btn só abre a tela de escolha.
// ---------------------------------------------------------------

function openMonsterSelectModal() {
  pendingMonsterSelection = state.selectedMonsters.map((m) => ({ ...m }));
  showMonsterSelectModal(state, pendingMonsterSelection);
}

function toggleMonsterSelection(zoneIndex, kind, monsterId) {
  if (!canSelectMonster(state, zoneIndex, kind)) return;
  const idx = pendingMonsterSelection.findIndex((m) => m.zoneIndex === zoneIndex && m.kind === kind && m.monsterId === monsterId);
  if (idx >= 0) {
    pendingMonsterSelection.splice(idx, 1);
  } else if (pendingMonsterSelection.length < MAX_SELECTED_MONSTERS) {
    pendingMonsterSelection.push({ zoneIndex, kind, monsterId });
  } else {
    // Já no máximo — em vez de bloquear, troca por FIFO: tira o mais
    // antigo (índice 0, o primeiro escolhido) e bota o novo no final.
    pendingMonsterSelection.shift();
    pendingMonsterSelection.push({ zoneIndex, kind, monsterId });
  }
  showMonsterSelectModal(state, pendingMonsterSelection);
}

function confirmMonsterSelection() {
  if (setSelectedMonsters(state, pendingMonsterSelection)) {
    hideModal();
    resetPlayerHp();
    fullRefresh();
    armBossTimer();
  } else {
    showToast('❌ Selecione ao menos 1 monstro.');
  }
}

function setupMonsterSelection() {
  document.getElementById('select-monsters-btn').addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    openMonsterSelectModal();
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
    const monsterChip = e.target.closest('[data-select-monster-zone]');
    if (monsterChip) {
      runModalAction(() => {
        toggleMonsterSelection(
          Number(monsterChip.dataset.selectMonsterZone),
          monsterChip.dataset.selectMonsterKind,
          monsterChip.dataset.selectMonsterId,
        );
      });
      return;
    }
    const confirmSelectionBtn = e.target.closest('[data-confirm-monster-selection]');
    if (confirmSelectionBtn) {
      runModalAction(() => confirmMonsterSelection());
      return;
    }
    const equipBtn = e.target.closest('[data-modal-equip]');
    if (equipBtn) {
      runModalAction(() => {
        const uid = Number(equipBtn.dataset.modalEquip);
        const entry = state.inventory.find((i) => i.uid === uid);
        const cardWillBeStripped = entry && ensureCardIds(entry).some(
          (cardId, slotIndex) => cardId && countEquippedCardCopies(state, cardId, uid, slotIndex) >= MAX_EQUIPPED_CARD_COPIES
        );
        if (!equipItem(state, uid)) return; // bloqueado (ver canEquipItem) — botão já vem disabled, defensivo
        hideModal();
        if (cardWillBeStripped) {
          showToast(`${CARD_ICON} Já havia ${MAX_EQUIPPED_CARD_COPIES} cartas dessa equipadas — a carta voltou pro inventário.`);
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

    const ascendBtn = e.target.closest('[data-ascend-uid]');
    if (ascendBtn) {
      runModalAction(() => {
        const uid = Number(ascendBtn.dataset.ascendUid);
        const pending = rollAscensionCandidates(state, uid);
        if (pending) {
          pendingAscension = pending;
          showAscensionModal(state, uid, pending);
        }
      });
      return;
    }

    const ascendChooseBtn = e.target.closest('[data-ascend-choose]');
    if (ascendChooseBtn) {
      runModalAction(() => {
        const uid = Number(ascendChooseBtn.dataset.ascendChoose);
        const chosenIndex = Number(ascendChooseBtn.dataset.ascendChooseIndex);
        if (!pendingAscension) return;
        const pending = pendingAscension;
        pendingAscension = null;
        if (finalizeAscension(state, uid, pending, chosenIndex)) {
          showItemDetailModal(state, uid);
          showToast('🌟 Item ascendeu de raridade!');
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
        const slotIndex = Number(openPickerBtn.dataset.openCardPickerSlot);
        showItemDetailModal(state, uid, slotIndex);
      });
      return;
    }

    const socketBtn = e.target.closest('[data-socket-uid]');
    if (socketBtn) {
      runModalAction(() => {
        const uid = Number(socketBtn.dataset.socketUid);
        const slotIndex = Number(socketBtn.dataset.socketSlot);
        const cardId = socketBtn.dataset.socketCardId;
        const isEquipped = Object.values(state.equipped).includes(uid);
        if (isEquipped && countEquippedCardCopies(state, cardId, uid, slotIndex) >= MAX_EQUIPPED_CARD_COPIES) {
          showToast(`❌ Você só pode ter ${MAX_EQUIPPED_CARD_COPIES} cartas iguais equipadas ao mesmo tempo.`);
          return;
        }
        if (socketCard(state, uid, slotIndex, cardId)) {
          showItemDetailModal(state, uid);
          showToast(`${CARD_ICON} Carta encaixada!`);
          fullRefresh();
        }
      });
      return;
    }

    const unsocketBtn = e.target.closest('[data-unsocket-uid]');
    if (unsocketBtn) {
      runModalAction(() => {
        const uid = Number(unsocketBtn.dataset.unsocketUid);
        const slotIndex = Number(unsocketBtn.dataset.unsocketSlot);
        if (unsocketCard(state, uid, slotIndex)) {
          showItemDetailModal(state, uid);
          showToast(`${CARD_ICON} Carta removida.`);
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

    const recycleCardBtn = e.target.closest('[data-recycle-card]');
    if (recycleCardBtn) {
      runModalAction(() => {
        const cardId = recycleCardBtn.dataset.recycleCard;
        const card = getCard(cardId);
        if (card && recycleCard(state, cardId)) {
          showCardDetailModal(state, cardId); // keep the popup open, with fresh state
          showToast(`♻️ ${card.name} reciclada: +${getCardRecycleValue(card)} ${CARD_FRAGMENT_ICON} ${CARD_FRAGMENT_NAME}!`);
          renderCardsTab(state);
        }
      });
      return;
    }

    const craftCardBtn = e.target.closest('[data-craft-card]');
    if (craftCardBtn) {
      runModalAction(() => {
        const cardId = craftCardBtn.dataset.craftCard;
        const card = getCard(cardId);
        if (card && craftCard(state, cardId)) {
          showCardDetailModal(state, cardId); // keep the popup open, with fresh state
          showToast(`🛠️ ${card.name} craftada!`);
          renderCardsTab(state);
        }
      });
      return;
    }

    // Mascotes — ver systems/pets.js. equipPet() já resolve sozinho qual dos
    // 4 slots recebe o pet (primeiro vazio, ou sobrescreve o 0), então não
    // precisa de um seletor de slot aqui.
    const equipPetBtn = e.target.closest('[data-equip-pet-uid]');
    if (equipPetBtn) {
      runModalAction(() => {
        const uid = Number(equipPetBtn.dataset.equipPetUid);
        if (!equipPet(state, uid)) {
          showToast('🔒 Só dá pra equipar 1 mascote por elemento — desequipe o outro do mesmo elemento primeiro.');
          return;
        }
        showPetDetailModal(state, uid);
        renderPetsTabNow();
      });
      return;
    }

    const unequipPetBtn = e.target.closest('[data-unequip-pet-uid]');
    if (unequipPetBtn) {
      runModalAction(() => {
        const uid = Number(unequipPetBtn.dataset.unequipPetUid);
        const slotIndex = state.equippedPetUids.indexOf(uid);
        if (slotIndex !== -1) unequipPetSlot(state, slotIndex);
        showPetDetailModal(state, uid);
        renderPetsTabNow();
      });
      return;
    }

    const recyclePetBtn = e.target.closest('[data-recycle-pet-uid]');
    if (recyclePetBtn) {
      runModalAction(() => {
        const uid = Number(recyclePetBtn.dataset.recyclePetUid);
        const value = recyclePet(state, uid);
        if (value != null) {
          hideModal();
          showToast(`♻️ Mascote reciclado: +${formatNumber(value)} ${PET_FRAGMENT_ICON} Fragmentos.`);
          renderPetsTabNow();
        }
      });
      return;
    }

    const donatePetFragmentsBtn = e.target.closest('[data-donate-pet-fragments-uid]');
    if (donatePetFragmentsBtn) {
      runModalAction(() => {
        const uid = Number(donatePetFragmentsBtn.dataset.donatePetFragmentsUid);
        const result = donatePetFragments(state, uid);
        if (result) {
          showToast(result.levelsGained > 0
            ? `${PET_FRAGMENT_ICON} +${formatNumber(result.fragmentsSpent)} XP doado — subiu ${result.levelsGained} nível${result.levelsGained === 1 ? '' : 'is'}!`
            : `${PET_FRAGMENT_ICON} +${formatNumber(result.fragmentsSpent)} XP doado.`);
          showPetDetailModal(state, uid); // keep the popup open, with fresh state
          renderPetsTabNow();
        }
      });
      return;
    }

    const openPetFuseBtn = e.target.closest('[data-open-pet-fuse]');
    if (openPetFuseBtn) {
      runModalAction(() => {
        showPetDetailModal(state, Number(openPetFuseBtn.dataset.openPetFuse), true);
      });
      return;
    }

    const fuseWithBtn = e.target.closest('[data-fuse-with]');
    if (fuseWithBtn) {
      runModalAction(() => {
        const baseUid = Number(fuseWithBtn.dataset.fuseBase);
        const withUid = Number(fuseWithBtn.dataset.fuseWith);
        const fused = fusePets(state, baseUid, withUid);
        if (fused) {
          showToast(`✨ Mascotes fundidos! Novo nível: +${fused.level}`);
          showPetDetailModal(state, fused.uid);
          renderPetsTabNow();
        }
      });
      return;
    }

    const hatchChooseBtn = e.target.closest('[data-hatch-choose]');
    if (hatchChooseBtn) {
      runModalAction(() => {
        const side = hatchChooseBtn.dataset.hatchChoose;
        if (!pendingHatchCandidates) return;
        if (side === 'right' && !canChooseRightPet(state)) return; // defensivo — botão já vem disabled
        if (side === 'right' && !isVipActive(state)) useFreeRightPetChoice(state);
        const chosen = pendingHatchCandidates[side === 'left' ? 0 : 1];
        pendingHatchCandidates = null;
        state.eggCount = Math.max(0, (state.eggCount || 0) - 1);
        const { discarded, fragments } = addPetToInventory(state, chosen);
        recordPetHatchOutcome(state, chosen.rarityId);
        hideModal();
        showToast(discarded
          ? `🎒 Inventário de mascotes cheio! Mascote convertido em +${formatNumber(fragments)} ${PET_FRAGMENT_ICON} Fragmentos.`
          : '🐣 Novo mascote chocado!');
        renderTopBar(state);
        renderPetsTabNow();
      });
      return;
    }
  });
}

// ---------------------------------------------------------------
// Equipment tab. One delegated listener
// on the stable #tab-equipment container, wired once in init(): this tab
// re-renders very often (every kill), so per-render re-wiring is exactly
// the duplicate-listener bug class that bit this project twice before.
// ---------------------------------------------------------------

function wireInventoryTabEvents() {
  const container = document.getElementById('tab-inventory');

  container.addEventListener('click', (e) => {
    const bulkToggleBtn = e.target.closest('[data-bulk-toggle-select]');
    if (bulkToggleBtn) {
      enterBulkSelectMode();
      return;
    }

    const bulkSelectAllBtn = e.target.closest('[data-bulk-select-all]');
    if (bulkSelectAllBtn) {
      selectAllBulkEligible();
      return;
    }

    const bulkDestroyBtn = e.target.closest('[data-bulk-destroy-selected]');
    if (bulkDestroyBtn) {
      if (bulkSelectedUids.size < 1) return;
      bulkConfirmingDestroy = true;
      renderInventoryTabNow();
      return;
    }

    const bulkCancelConfirmBtn = e.target.closest('[data-bulk-cancel-confirm]');
    if (bulkCancelConfirmBtn) {
      bulkConfirmingDestroy = false;
      renderInventoryTabNow();
      return;
    }

    // Mesmo padrão non-blocking de confirmação usado no destroy individual
    // (ver data-confirm-destroy-uid acima) — window.confirm fica bloqueado
    // dentro do iframe sandboxed do Artifact.
    const bulkConfirmBtn = e.target.closest('[data-bulk-confirm-destroy]');
    if (bulkConfirmBtn) {
      const totalRefund = {};
      let destroyedCount = 0;
      for (const uid of bulkSelectedUids) {
        const refund = destroyItem(state, uid);
        if (!refund) continue;
        destroyedCount += 1;
        for (const [matId, qty] of Object.entries(refund)) {
          totalRefund[matId] = (totalRefund[matId] || 0) + qty;
        }
      }
      exitBulkSelectMode();
      const refundStr = Object.entries(totalRefund)
        .map(([matId, qty]) => `+${qty} ${findMaterialInfo(matId)?.emoji ?? ''}`)
        .join(' ');
      showToast(`🗑️ ${destroyedCount} ${destroyedCount === 1 ? 'item destruído' : 'itens destruídos'}! ${refundStr}`);
      renderTopBar(state);
      return;
    }

    const bulkExitBtn = e.target.closest('[data-bulk-exit-select]');
    if (bulkExitBtn) {
      exitBulkSelectMode();
      return;
    }

    const slotBtn = e.target.closest('[data-equip-slot]');
    if (slotBtn) {
      showEquipSlotModal(state, slotBtn.dataset.equipSlot);
      return;
    }

    const viewFullStatsBtn = e.target.closest('[data-view-full-stats]');
    if (viewFullStatsBtn) {
      showFullStatsModal(state);
      return;
    }

    const itemBtn = e.target.closest('[data-equip-item]');
    if (itemBtn) {
      const uid = Number(itemBtn.dataset.equipItem);
      if (bulkSelectMode) {
        toggleBulkSelected(uid);
      } else {
        showItemDetailModal(state, uid);
      }
      return;
    }

    const filterBtn = e.target.closest('[data-filter-category]');
    if (filterBtn) {
      inventoryFilterCategory = filterBtn.dataset.filterCategory || null;
      renderInventoryTabNow();
      return;
    }
  });
}

// ---------------------------------------------------------------
// Combate Permanente (ver systems/arena.js) — saco de pancada que nunca
// revida, num clock fixo de 30s (ARENA_RUN_DURATION_MS). Ao terminar, um
// cooldown de 5min (ARENA_COOLDOWN_MS) trava uma nova entrada — ver
// canEnterArena. A cada tick só se resolve o dano do próprio caçador
// (+pet/Golpe Duplo) contra o alvo fictício 'neutro' — nada de HP
// descendo, applyArenaDamage só acumula o total causado.
// ---------------------------------------------------------------

let nextArenaHitAt = null;

function enterArena() {
  if (!startArenaRun(state)) return;
  arenaDeadline = Date.now() + ARENA_RUN_DURATION_MS;
  showToast('⚔️ Combate Permanente iniciado! Cause o máximo de dano possível em 30 segundos.');
  renderEventsTabNow();
}

function finishArenaRun() {
  const { rank, damageDealt, materialsGranted } = endArenaRun(state);
  arenaDeadline = null;
  showArenaRewardModal(rank, damageDealt, materialsGranted);
  renderEventsTabNow();
  renderTopBar(state);
  renderPetsTabNow();
  renderInventoryTabNow();
}

function showArenaRewardModal(rank, damageDealt, materialsGranted) {
  const { rewards } = rank;
  const lines = [`<p class="offline-item-lines">+${formatNumber(rewards.gold)} ${GOLD_ICON} Ouro</p>`];
  if (rewards.eventCurrency > 0) lines.push(`<p class="offline-item-lines">+${formatNumber(rewards.eventCurrency)} ${EVENT_ICON} Moeda de Evento</p>`);
  if (rewards.eggs > 0) lines.push(`<p class="offline-item-lines">+${formatNumber(rewards.eggs)} ${EGG_ICON} Ovo${rewards.eggs === 1 ? '' : 's'} de Mascote</p>`);
  if (materialsGranted && materialsGranted.length > 0) {
    const materialLines = materialsGranted
      .map((entry) => `<span class="icon">${iconMarkup(entry.material.image, entry.material.emoji, entry.material.name)}</span> ${entry.material.name} (+${formatNumber(entry.qty)})`)
      .join('<br>');
    lines.push(`<p class="offline-item-lines">+${formatNumber(rewards.materialsTotal)} Materiais de Monstros:</p><p class="offline-item-lines">${materialLines}</p>`);
  }
  if (rewards.cardFragments > 0) lines.push(`<p class="offline-item-lines">+${formatNumber(rewards.cardFragments)} ${CARD_FRAGMENT_ICON} ${CARD_FRAGMENT_NAME}</p>`);

  showModal(`⚔️ Combate encerrado — ${rank.name}`, `
    <p>Dano total causado: <strong>${formatNumber(damageDealt)}</strong></p>
    <p><strong>Recompensas:</strong></p>
    ${lines.join('')}
    <p class="event-sub">Você poderá entrar em outro combate em ${expeditionDurationLabel(ARENA_COOLDOWN_MS)}.</p>
  `);
}

function tickArena() {
  if (!state.arenaRunActive) return;

  if (Date.now() >= arenaDeadline) {
    finishArenaRun();
    return;
  }

  const stats = computePlayerStats(state);
  const clock = advanceHitClock(nextArenaHitAt, stats.attackSpeedPerSec);
  nextArenaHitAt = clock.nextHitAt;
  if (clock.hit && stats.dps > 0) {
    const hit = resolveHit(state, stats, getActivePetDpsMultiplier(state, 'neutro'));
    const petHit = resolvePetHit(state, 'neutro', stats);
    const doubleHit = resolveDoubleHit(stats, getActivePetDpsMultiplier(state, 'neutro'));
    applyArenaDamage(state, hit.dealt + (petHit ? petHit.dealt : 0) + (doubleHit ? doubleHit.dealt : 0));
    if (stats.lifesteal) currentHp = Math.min(currentHp + stats.lifesteal, stats.maxHp);
    pulseArenaTarget();
  }

  renderEventsTabNow();
}

// ---------------------------------------------------------------
// Expedição do Caçador (ver systems/expedition.js) — sem luta e sem
// cronômetro próprio de tick: um clique concede a recompensa na hora e
// arma o cooldown compartilhado. O relógio na tela só precisa do refresh
// periódico já existente (ver setInterval(renderEventsTabNow) mais abaixo),
// não precisa de nenhum tick dedicado como Torre/Mina.
// ---------------------------------------------------------------

function enterExpeditionTier(tierId) {
  const result = enterExpedition(state, tierId);
  if (!result) return;
  expeditionCardsVisible = false;
  showExpeditionRewardModal(result);
  renderEventsTabNow();
  renderTopBar(state);
  renderPetsTabNow();
}

/// Botão "Entrar" do banner da Expedição — não inicia nada sozinho, só
/// abre/fecha os 3 cartões de duração abaixo (ver expeditionCardsVisible).
function toggleExpeditionCards() {
  expeditionCardsVisible = !expeditionCardsVisible;
  renderEventsTabNow();
}

function showExpeditionRewardModal(result) {
  const { tier, goldGained, currencyGained, eggsGained, goldBonusHits, currencyBonusHits, eggBonusHits } = result;
  const goldBonusNote = goldBonusHits > 0 ? ` <span class="offline-item-lines">(+${goldBonusHits} bônus!)</span>` : '';
  const currencyBonusNote = currencyBonusHits > 0 ? ` <span class="offline-item-lines">(+${currencyBonusHits} bônus!)</span>` : '';
  const eggBonusNote = eggBonusHits > 0 ? ` <span class="offline-item-lines">(+${eggBonusHits} bônus!)</span>` : '';
  showModal(`🧭 Expedição de ${tier.label}`, `
    <p><strong>Recompensas:</strong></p>
    <p class="offline-item-lines">+${formatNumber(goldGained)} ${GOLD_ICON} Ouro${goldBonusNote}</p>
    <p class="offline-item-lines">+${formatNumber(currencyGained)} ${EVENT_ICON} Moeda de Evento${currencyBonusNote}</p>
    <p class="offline-item-lines">+${formatNumber(eggsGained)} ${EGG_ICON} Ovo${eggsGained === 1 ? '' : 's'} de Mascote${eggBonusNote}</p>
    <p class="event-sub">Você poderá entrar em outra expedição em ${expeditionDurationLabel(tier.durationMs)}.</p>
  `);
}

function wireEventTabEvents() {
  const container = document.getElementById('tab-events');

  container.addEventListener('click', (e) => {
    if (e.target.closest('[data-expedition-banner-enter]')) {
      toggleExpeditionCards();
      return;
    }

    const expeditionBtn = e.target.closest('[data-expedition-enter]');
    if (expeditionBtn) {
      enterExpeditionTier(expeditionBtn.dataset.expeditionEnter);
      return;
    }

    if (e.target.closest('[data-arena-enter]')) {
      enterArena();
      return;
    }

    if (e.target.closest('[data-arena-view-ranks]')) {
      showArenaRanksModal();
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
// Mascotes — mesmo padrão de listener único delegado das outras abas.
// Equipar/desequipar/vender/fundir e a escolha do choco em si acontecem no
// popup compartilhado (#modal-overlay, ver wireModalEvents()).
// ---------------------------------------------------------------

function openHatchModal() {
  if ((state.eggCount || 0) < 1) return;
  pendingHatchCandidates = rollHatchCandidates(state);
  showHatchModal(state, pendingHatchCandidates);
}

function hatchAllEggsNow() {
  if (!isVipActive(state)) { showToast('👑 Chocar Todos é uma funcionalidade exclusiva de VIP — compre na loja de Cash.'); return; }
  if ((state.eggCount || 0) < 1) return;
  const summary = hatchAllEggs(state);
  const rarityBreakdown = Object.entries(summary.byRarity)
    .sort((a, b) => b[1] - a[1])
    .map(([rarityId, qty]) => `${qty}x ${getRarity(rarityId).name}`)
    .join(', ');
  let msg = summary.hatched > 0
    ? `🐣 ${summary.hatched} ovo${summary.hatched === 1 ? '' : 's'} chocado${summary.hatched === 1 ? '' : 's'}! ${rarityBreakdown}`
    : '🎒 Inventário de mascotes já está cheio — nenhum ovo chocado.';
  if (summary.discardedCount > 0) {
    msg += ` — inventário cheio: ${summary.discardedCount} viraram +${formatNumber(summary.fragmentsGained)} ${PET_FRAGMENT_ICON} Fragmentos.`;
  } else if (summary.stoppedInventoryFull) {
    const remaining = state.eggCount || 0;
    msg += ` Parou no limite do inventário — ${formatNumber(remaining)} ovo${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'} guardado${remaining === 1 ? '' : 's'} pra depois.`;
  }
  showToast(msg);
  renderTopBar(state);
  renderPetsTabNow();
}

function fuseAllPetsNow() {
  const { fusionsPerformed, resultingPets } = fuseAllPossiblePets(state);
  if (fusionsPerformed < 1) {
    showToast('🌟 Nenhum par de mascotes iguais (mesma espécie/raridade/nível) disponível pra fundir agora.');
    return;
  }
  showToast(`🌟 ${fusionsPerformed} fusão${fusionsPerformed === 1 ? '' : 'ões'} realizada${fusionsPerformed === 1 ? '' : 's'}, resultando em ${resultingPets} mascote${resultingPets === 1 ? '' : 's'}!`);
  renderPetsTabNow();
}

function wirePetsTabEvents() {
  document.getElementById('tab-pets').addEventListener('click', (e) => {
    const hatchBtn = e.target.closest('[data-hatch-egg-btn]');
    if (hatchBtn) { openHatchModal(); return; }

    const hatchAllBtn = e.target.closest('[data-hatch-all-btn]');
    if (hatchAllBtn) { hatchAllEggsNow(); return; }

    const fuseAllBtn = e.target.closest('[data-fuse-all-btn]');
    if (fuseAllBtn) { fuseAllPetsNow(); return; }

    const sortBtn = e.target.closest('[data-pet-sort]');
    if (sortBtn) {
      petSortMode = sortBtn.dataset.petSort || null;
      renderPetsTabNow();
      return;
    }

    const slotBtn = e.target.closest('[data-pet-slot]');
    if (slotBtn) {
      const uid = state.equippedPetUids[Number(slotBtn.dataset.petSlot)];
      if (uid) {
        showPetDetailModal(state, uid);
      } else {
        showModal('🐾 Slot vazio', `
          <div class="item-detail">
            <div class="item-detail-icon">🐾</div>
            <p style="color:var(--text-dim); font-size:12.5px;">Nenhum mascote equipado aqui ainda.</p>
          </div>
        `);
      }
      return;
    }

    const tile = e.target.closest('[data-view-pet]');
    if (tile) showPetDetailModal(state, Number(tile.dataset.viewPet));
  });
}

// ---------------------------------------------------------------
// Árvore de habilidades passivas ÚNICA (ver data/skills.js + systems/
// skills.js — era 3 árvores por classe, agora uma só, sem seleção nenhuma)
// — mesmo padrão de listener único delegado das outras abas.
// ---------------------------------------------------------------

function wireSkillsTabEvents() {
  document.getElementById('tab-upgrades').addEventListener('click', (e) => {
    const buySkillBtn = e.target.closest('[data-buy-skill]');
    if (buySkillBtn) {
      if (buySkillLevel(state, buySkillBtn.dataset.buySkill)) renderUpgradesTabNow();
      return;
    }

    const buySpecialBtn = e.target.closest('[data-buy-special]');
    if (buySpecialBtn) {
      if (buySpecial(state, buySpecialBtn.dataset.buySpecial)) renderUpgradesTabNow();
      return;
    }

    const resetStartBtn = e.target.closest('[data-skill-reset-start]');
    if (resetStartBtn) {
      skillResetConfirming = true;
      renderUpgradesTabNow();
      return;
    }

    const resetCancelBtn = e.target.closest('[data-skill-reset-cancel]');
    if (resetCancelBtn) {
      skillResetConfirming = false;
      renderUpgradesTabNow();
      return;
    }

    const resetConfirmBtn = e.target.closest('[data-skill-reset-confirm]');
    if (resetConfirmBtn) {
      resetSkillTree(state);
      skillResetConfirming = false;
      renderUpgradesTabNow();
      showToast('🔄 Pontos de habilidade resetados!');
    }
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

    const vipBenefitsBtn = e.target.closest('[data-vip-benefits]');
    if (vipBenefitsBtn) {
      showVipBenefitsModal();
      return;
    }

    const buyCashBtn = e.target.closest('[data-buy-cash]');
    if (buyCashBtn) {
      if (buyCashItem(state, buyCashBtn.dataset.buyCash)) {
        showToast('🛒 Compra realizada!');
        renderTopBar(state);
        renderShopTab(state, activeShopSubTab);
        // VIP muda o limite de inventário (itens/mascotes) e libera "Chocar
        // Todos" — essas 2 abas ficariam com dado velho até a próxima ação
        // nelas se não fossem re-renderizadas aqui também (nenhuma das duas
        // é a Loja, então o tick normal de combate não as toca).
        renderInventoryTabNow();
        renderPetsTabNow();
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
        renderInventoryTabNow();
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
// Offline progress
// ---------------------------------------------------------------

function showOfflineProgressIfAny() {
  const progress = computeOfflineProgress(state);
  if (!progress) return;
  applyOfflineProgress(state, progress);
  // applyOfflineProgress pode ter empurrado itens novos pro inventário
  // (ver itemDropCount) depois que fullRefresh() já rodou no init() — sem
  // isso a aba Equipamentos ficaria mostrando o inventário desatualizado
  // até a próxima ação disparar um re-render.
  if (progress.itemDropCount > 0) renderInventoryTabNow();

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
    const icon = iconMarkup(card?.image, CARD_ICON, card?.name ?? id);
    return `+${formatNumber(qty)} <span class="icon">${icon}</span> ${card?.name ?? id}`;
  });
  const equipmentLine = progress.itemDropCount > 0
    ? `+${formatNumber(progress.itemDropCount)} <span class="icon">🎒</span> ${progress.itemDropCount === 1 ? 'equipamento' : 'equipamentos'} (ver aba Equipamentos)`
    : null;
  const itemsHtml = [...materialLines, ...cardLines, ...(equipmentLine ? [equipmentLine] : [])].length
    ? `<p class="offline-item-lines">${[...materialLines, ...cardLines, ...(equipmentLine ? [equipmentLine] : [])].join('<br>')}</p>`
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
  setupMonsterSelection();
  wireModalEvents(); // one-time delegated listener, see wireModalEvents()
  wireInventoryTabEvents();
  wireCardsTabEvents();
  wireEventTabEvents();
  wireShopTabEvents();
  wirePetsTabEvents();
  wireSkillsTabEvents();
  resetPlayerHp();
  if (state.arenaRunActive) {
    arenaDeadline = Date.now() + ARENA_RUN_DURATION_MS;
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
    forceArenaTimeout: () => { if (arenaDeadline != null) arenaDeadline = Date.now() - 1; },
  };
}

init();
