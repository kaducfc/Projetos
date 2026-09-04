import { createDefaultState, loadState, saveState, hardResetState, isVipActive } from './state.js';
import { computePlayerStats, getElementalResistance } from './systems/stats.js';
import {
  getCurrentMonster, applyDamage, ensureMonsterSpawned, armorReduction, resolveHit,
  advanceHitClock, setSelectedMonsters, canSelectMonster, MAX_SELECTED_MONSTERS, resolvePetHit, rollDodge,
  resolveDoubleHit, rollCrit,
} from './systems/combat.js';
import { findMaterialInfo, findMonsterSourceForMaterial, BOSSES, ZONES, ZONE_COUNT } from './data/monsters.js';
import { canTranscend, unlockTranscend, transcend, buyAwakeningItem } from './systems/awakening.js';
import {
  syncProfile, getMyPvpProfile, fetchTierBoard, attackOpponent,
  pickRandomPvpOpponents, previewPvpAttackSwing,
  fetchArenaRank, fetchLevelRank, fetchTranscendRank, isNickAvailable, claimNick, fetchPlayerEquipment,
} from './systems/pvp.js';
import { getPvpTierInfo, PVP_TIERS } from './data/pvpConfig.js';
import { fetchMailbox, claimMailReward, deleteMail, mailHasReward, hasUnreadMail, markMailRead } from './systems/mailbox.js';
import { elementDamageModifier } from './data/elements.js';
import { equipItem, unequipSlot, findEquippedSlotId } from './systems/equipment.js';
import {
  enhanceItem, upgradeToMaster, rollAscensionCandidates, finalizeAscension, socketCard, unsocketCard,
  destroyItem, countEquippedCardCopies, MAX_EQUIPPED_CARD_COPIES, ensureCardIds,
  rollBonusReroll, finalizeBonusReroll, toggleItemLock,
} from './systems/crafting.js';
import { getItem, getRarity, MYSTIC_DIE_ID, MYSTIC_DIE_NAME } from './data/items.js';
import { chooseGodAttribute, rollGodBonusChoice, finalizeGodBonus } from './systems/godItems.js';
import { computeOfflineProgress, applyOfflineProgress, OFFLINE_EFFICIENCY } from './systems/offline.js';
import { formatNumber } from './format.js';
import { enterExpedition } from './systems/expedition.js';
import { ARENA_RUN_DURATION_MS, ARENA_COOLDOWN_MS, canEnterArena, startArenaRun, applyArenaDamage, endArenaRun } from './systems/arena.js';
import { claimAchievementStage } from './systems/achievements.js';
import {
  ensureDailyMissionsFresh, recordDailyMissionProgress, selectMission, abandonMission, rerollMission,
  claimDailyMission,
} from './systems/dailyMissions.js';
import { watchAd, buyCashItem, watchDpsBoostAd, watchOfflineBonusAd } from './systems/shop.js';
import { openChest } from './systems/chests.js';
import { CHESTS } from './data/chests.js';
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
  getBestEquippedPet,
} from './systems/pets.js';
import { getPetSpecies } from './data/pets.js';
import { buySkillLevel, buySpecial, resetSkillTree } from './systems/skills.js';
import { setPlayerName, toggleSound, toggleMusic, selectProfileIcon, isValidPlayerName, getPlayerName, setLanguage as setLanguageSetting } from './systems/profile.js';
import { initLanguage, setLanguage as setUiLanguage, translateContainer } from './i18n.js';
import { DEFAULT_PLAYER_NAME } from './data/profile.js';
import {
  renderAll, renderTopBar, renderHunterLevel, renderCombatStats, renderMonster, renderNoMonsterSelected,
  renderInventoryTab, renderUpgradesTab, renderBossTimer,
  renderPlayerHp, spawnDamagePopup, spawnPetDamagePopup, spawnReflectDamagePopup, pulseMonster, showToast, showLootPopup, showModal, hideModal,
  showItemDetailModal, showEquipSlotModal, showMonsterSelectModal, renderEventsTab, renderShopTab,
  renderCardsTab, showCardDetailModal, iconMarkup,
  renderPetsTab, showPetDetailModal, showHatchModal, showAscensionModal, showFullStatsModal,
  showGodBonusModal, showGodItemShopDetailModal, showCardShopDetailModal, showBonusRerollModal,
  GOLD_ICON, EVENT_ICON, ESMERALDA_ICON, CARD_ICON, CARD_FRAGMENT_ICON, expeditionDurationLabel,
  ACHIEVEMENT_ICON, GIFT_ICON, TRANSCEND_ICON,
  EGG_ICON, PET_FRAGMENT_ICON, AWAKENING_SHARD_ICON,
  showArenaRanksModal, pulseArenaTarget, showVipBenefitsModal, showProfileModal, showTranscendConfirmModal,
  showForeignEquipmentModal, showForeignItemDetailModal,
  renderTranscendTab, renderPvpTab, showPvpBattleModal, showPvpCombatPickerModal, renderRanksTab,
  renderMailboxTab, showMailDetailModal, renderAchievementsTab,
  renderDailyMissionsTab, showDailyMissionCompleteModal, DAILY_MISSION_ICON,
  REFRESH_ICON,
} from './ui/render.js';

const TICK_MS = 100;
const SAVE_INTERVAL_MS = 10000;
const BOSS_TIME_LIMIT_MS = 30000;
// Arena PvP (ver systems/pvp.js): de quanto em quanto tempo o jogo re-sobe
// sozinho as stats de combate atuais pro Supabase (ver refreshPvpTab em
// init() abaixo) — mantém o snapshot que outros jogadores atacam
// razoavelmente fresco sem precisar de clique manual.
const PVP_AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

let state = loadState() || createDefaultState();
ensureMonsterSpawned(state);
initLanguage(state);

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
let inventorySortByTier = null;
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
// Mesmo padrão de pendingAscension acima, pro fluxo de montar um item Tier
// God (ver rollGodBonusChoice/finalizeGodBonus em systems/godItems.js) —
// os 3 candidatos do bônus atual (1 dos 8), até o jogador escolher 1
// (data-god-bonus-choose, ver wireModalEvents).
let pendingGodBonus = null;
// Mesmo padrão de pendingAscension acima, pro reroll de bônus com Dado
// Místico (ver rollBonusReroll/finalizeBonusReroll em systems/crafting.js)
// — os 3 candidatos pro bônus `statIndex` sendo trocado, até o jogador
// escolher 1 (data-reroll-bonus-choose, ver wireModalEvents). O Dado
// Místico já foi gasto no momento de rolar, não aqui.
let pendingBonusReroll = null;
// Equipamento de outro jogador, aberto a partir de um clique numa linha da
// aba Ranks (ver wireRanksTabEvents abaixo e showForeignEquipmentModal em
// ui/render.js) — o objeto {slotId: entry} devolvido por
// fetchPlayerEquipment (systems/pvp.js), guardado só pra resolver o clique
// num item preenchido (data-view-foreign-item) sem precisar buscar de
// novo do servidor.
let viewingForeignEquipment = null;
// Jogador atualmente sendo observado (mesmo fluxo acima) — guardado pra dar
// pra reabrir showForeignEquipmentModal quando o modal de detalhe do item
// (data-view-foreign-item) for fechado, ver modalBackHandler.
let viewingForeignPlayer = null;
// Se setado, o botão de fechar do modal (#modal-close) chama isso em vez de
// hideModal() — usado pra "voltar" ao modal anterior de uma cadeia (ex:
// detalhe de item de outro jogador -> volta pro boneco de equipamento dele)
// em vez de fechar tudo de uma vez. Sempre limpo antes de decidir o próximo
// valor, pra não vazar entre cadeias diferentes de modal.
let modalBackHandler = null;
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
// Arena PvP (ver systems/pvp.js): dados vivem no Supabase, não no save
// local — esse cache só existe em memória, refeito a cada sessão (ver
// refreshPvpTab). `board` é a prancheta inteira do tier atual do jogador
// (ranking + oponentes num só lugar, ver fetchTierBoard). loading trava o
// botão "Atualizar" contra clique duplo; attackingId identifica qual
// linha está com o botão "Atacar" desabilitado no momento (evita atacar
// 2x o mesmo antes da resposta voltar, sem travar o resto da lista).
let pvpData = { myProfile: null, board: [], loading: false, attackingId: null };

// Página "Ranks" (menu Outros, ver refreshRanksTab): 3 listas globais
// (Arena/Nível/Transcender), cada uma já vindo pronta do Supabase (top
// 100 + a própria linha do jogador se estiver fora — ver
// supabase/migrations/0008_pvp_ranks.sql). `loaded` marca que já buscou
// pelo menos uma vez nessa sessão (só refaz no clique manual em
// "Atualizar", não toda vez que a aba abre de novo).
let ranksData = { arena: [], level: [], transcend: [], loading: false, loaded: false, activeSection: 'arena' };

// Correio (ver systems/mailbox.js): dados vivem no Supabase, igual
// Arena/Ranks — esse cache só existe em memória, refeito a cada sessão.
let mailboxData = { messages: [], loading: false };

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
  }, inventorySortByTier);
}

/// Botão de seta no cabeçalho do Inventário (ver data-toggle-tier-sort em
/// equipRingContentHtml/ui/render.js) — 1º clique ordena por Tier do maior
/// pro menor, clicar de novo no mesmo botão inverte (menor pro maior).
function toggleInventoryTierSort() {
  inventorySortByTier = inventorySortByTier === 'desc' ? 'asc' : 'desc';
  renderInventoryTabNow();
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
/// equipado OU travado, exatamente como o clique individual já recusa
/// (ver bulkLocked em inventoryTileHtml) — nenhum dos dois entra na
/// seleção em massa.
function selectAllBulkEligible() {
  const filtered = inventoryFilterCategory
    ? state.inventory.filter((entry) => getItem(entry.itemId)?.category === inventoryFilterCategory)
    : state.inventory;
  bulkSelectedUids = new Set(
    filtered.filter((entry) => findEquippedSlotId(state, entry.uid) == null && !entry.locked).map((entry) => entry.uid),
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
  renderAchievementsTab(state);
  renderPetsTabNow();
  renderTranscendTab(state);
  renderPvpTab(state, pvpData);
  refreshDailyMissionsTab();
}

// Missão Diária (ver systems/dailyMissions.js): 100% local, sem Supabase —
// ensureDailyMissionsFresh só regenera as 3 missões se o reset (21h de
// Brasília) já passou, então é seguro/barato chamar toda vez.
function refreshDailyMissionsTab() {
  ensureDailyMissionsFresh(state);
  renderDailyMissionsTab(state);
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
  // 1ª morte do chefe da última zona libera Transcender pro resto da run
  // atual (ver systems/awakening.js unlockTranscend/canTranscend) — só
  // dispara uma vez (unlockTranscend já é no-op se já tiver liberado).
  if (event.wasBoss && event.zoneIndex === ZONE_COUNT - 1 && unlockTranscend(state)) {
    showToast(`${TRANSCEND_ICON} Transcender desbloqueado! Veja a aba Transcender em Outros.`);
    renderTranscendTab(state);
  }
  recordDailyMissionProgress(state, 'kill_monsters');
  refreshDailyMissionsTab();
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
  const dodged = rollDodge(stats);
  const rawAttack = monster.dps * (TICK_MS / 1000);
  const incoming = dodged ? 0 : rawAttack * (1 - reduction);
  currentHp -= incoming;

  if (currentHp <= 0) {
    retreat('death');
    return;
  }

  // Reflexo de Dano (ver reflectChance em systems/stats.js, concedido por
  // carta — ex: Caeloryx, Tier God): pedido explícito do usuário — baseado
  // no ATAQUE TOTAL do monstro (rawAttack, sem descontar armadura/
  // resistência elemental — a mesma redução que já protegeu o jogador não
  // desconta de novo aqui), não no `incoming` (que já foi reduzido). Só
  // esquivar zera o reflexo (não houve golpe nenhum pra refletir). Mesmo
  // esquema de applyDamage() que um hit normal usa (então pode matar o
  // monstro sozinho, com ouro/drop/XP normais). Checado DEPOIS do "morreu"
  // acima de propósito: um golpe letal mata o jogador mesmo se o reflexo
  // também mataria o monstro no mesmo tick (reflexo nunca salva de um
  // golpe fatal). Também pode critar — mesma chance/dano crítico do
  // jogador (ver rollCrit em systems/combat.js), pedido explícito do
  // usuário.
  if (!dodged && stats.reflectChance > 0) {
    const crit = rollCrit(stats);
    const reflected = rawAttack * (stats.reflectChance / 100) * crit.multiplier;
    const reflectEvent = applyDamage(state, reflected, stats);
    spawnReflectDamagePopup(reflected, crit.isCrit);
    if (reflectEvent) {
      pulseMonster();
      refreshCombatOnly();
      handleKillEvent(reflectEvent);
      return;
    }
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
const MORE_MENU_TAB_IDS = ['cards', 'shop', 'transcend', 'pvp', 'ranks', 'mailbox', 'achievements', 'daily-missions'];

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
      // Arena PvP não é parte de state/fullRefresh (dados vivem no
      // Supabase, não no save local) — só busca na 1ª vez que a aba abre
      // nessa sessão (ver refreshPvpTab, cacheia em pvpData).
      if (btn.dataset.tab === 'pvp' && !pvpData.myProfile && !pvpData.loading) refreshPvpTab();
      // Mesma lógica pra Ranks (também vive no Supabase, ver refreshRanksTab).
      if (btn.dataset.tab === 'ranks' && !ranksData.loaded && !ranksData.loading) refreshRanksTab();
      // Correio (ver refreshMailboxTab): busca de novo toda vez que a aba
      // abre (diferente de Ranks) — mensagem nova pode ter chegado a
      // qualquer momento (recompensa automática da Arena, aviso do
      // Admin), não faz sentido cachear por sessão inteira igual o rank.
      if (btn.dataset.tab === 'mailbox' && !mailboxData.loading) refreshMailboxTab();
      // Missão Diária: local, sem loading assíncrono — só reconfere o
      // reset toda vez que a aba abre (ver refreshDailyMissionsTab).
      if (btn.dataset.tab === 'daily-missions') refreshDailyMissionsTab();
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

// Botão "Selecionar" do lado do NOME do material, no popup de detalhe do
// item (ver materialCostRowHtml em ui/render.js) — atalho pra já ir
// direto caçar o monstro que dropa aquele material, seja ele fraco ou
// chefe (ver findMonsterSourceForMaterial em data/monsters.js), sem
// passar pela tela de seleção manual. Mesma regra de sempre (até 4, FIFO
// troca o mais antigo) — só que aplicada direto em state.selectedMonsters,
// não em pendingMonsterSelection (esse popup não tem etapa de "Confirmar"
// separada).
function selectMonsterForMaterial(materialId) {
  const source = findMonsterSourceForMaterial(materialId);
  if (!source) return; // material sem monstro de origem (ex: evento) — botão nem deveria estar aqui
  const { zoneIndex, kind, monsterId } = source;
  if (!canSelectMonster(state, zoneIndex, kind)) {
    showToast('🔒 Monstro ainda não liberado nesse nível.');
    return;
  }
  const current = state.selectedMonsters.map((m) => ({ ...m }));
  const alreadySelected = current.some((m) => m.zoneIndex === zoneIndex && m.kind === kind && m.monsterId === monsterId);
  if (alreadySelected) {
    showToast('✅ Esse monstro já está selecionado pra caça.');
    return;
  }
  if (current.length >= MAX_SELECTED_MONSTERS) current.shift();
  current.push({ zoneIndex, kind, monsterId });
  if (setSelectedMonsters(state, current)) {
    const monsterName = kind === 'boss' ? BOSSES[zoneIndex].name : ZONES[zoneIndex].weakMonsters.find((m) => m.id === monsterId)?.name ?? monsterId;
    showToast(`🎯 ${monsterName} selecionado pra caça!`);
    resetPlayerHp();
    fullRefresh();
    armBossTimer();
  }
}

function setupMonsterSelection() {
  document.getElementById('select-monsters-btn').addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    openMonsterSelectModal();
  });
}

// ---------------------------------------------------------------
// Perfil (botão no canto superior esquerdo da barra, ver #profile-btn em
// index.html) — só abre o modal; as ações de dentro dele (salvar nick,
// trocar ícone, toggles de som/música) são tratadas em wireModalEvents,
// junto com todo resto que usa o #modal-overlay compartilhado.
// ---------------------------------------------------------------

function setupProfile() {
  document.getElementById('profile-btn').addEventListener('click', () => {
    showProfileModal(state);
  });
}

/// Botão "Salvar" do nick (ver profileModalHtml em ui/render.js) — 3
/// regras, nessa ordem: (1) formato (letras/números/1 espaço entre
/// palavras, 3-16 chars — ver isValidPlayerName em systems/profile.js),
/// (2) nada mudou (sem-op, não cobra), (3) nick já em uso por OUTRO
/// jogador (ver isNickAvailable em systems/pvp.js — pulado se o nome for
/// o padrão "Caçador", todo jogador novo já começa com ele). Qualquer
/// violação mostra "Nick Impossibilitado" em vermelho (ver
/// #profile-name-error) — o jogador tenta outro nick até passar em todas.
///
/// isNickAvailable acima é só a checagem RÁPIDA (evita a maioria dos
/// conflitos na hora); depois de aplicar a troca local, claimNick grava o
/// nick no servidor IMEDIATAMENTE (não espera o próximo ciclo periódico
/// de syncProfile) — é essa escrita que é autoritativa de verdade (índice
/// único no banco, ver 0025_pvp_profiles_nick_unique.sql). Se outra sessão
/// venceu a corrida nesse meio-tempo (reason 'taken'), desfaz a troca
/// local (nome, custo cobrado, contador de trocas) e avisa o jogador.
/// Falha de rede (reason 'network') não desfaz nada — mesmo espírito do
/// resto do PvP, o próximo syncProfile periódico tenta de novo sozinho.
async function saveProfileNameFlow() {
  const input = document.getElementById('profile-name-input');
  const errorEl = document.getElementById('profile-name-error');
  const rawName = input ? input.value : '';
  const trimmed = rawName.trim();

  if (!isValidPlayerName(rawName)) {
    if (errorEl) errorEl.textContent = '❌ Nick Impossibilitado';
    return;
  }
  if (trimmed === getPlayerName(state)) return; // nada mudou, não cobra

  const isDefaultName = trimmed.toLowerCase() === DEFAULT_PLAYER_NAME.toLowerCase();
  if (!isDefaultName) {
    const available = await isNickAvailable(trimmed);
    if (!available) {
      if (errorEl) errorEl.textContent = '❌ Nick Impossibilitado';
      return;
    }
  }

  const prevName = getPlayerName(state);
  const prevCash = state.cash;
  const prevChangesUsed = state.nameChangesUsed || 0;

  if (!setPlayerName(state, rawName)) {
    showToast(`❌ ${ESMERALDA_ICON} insuficiente pra trocar o nick.`);
    return;
  }

  if (!isDefaultName) {
    const result = await claimNick(trimmed);
    if (!result.ok && result.reason === 'taken') {
      state.playerName = prevName;
      state.cash = prevCash;
      state.nameChangesUsed = prevChangesUsed;
      // showProfileModal recria o HTML do modal (incluindo um
      // #profile-name-error novo e vazio) — setar o texto ANTES seria
      // apagado por esse re-render, então a mensagem entra DEPOIS, no
      // elemento novo.
      showProfileModal(state);
      const newErrorEl = document.getElementById('profile-name-error');
      if (newErrorEl) newErrorEl.textContent = '❌ Nick Impossibilitado';
      return;
    }
  }

  showToast('✅ Nick atualizado!');
  renderTopBar(state);
  showProfileModal(state);
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
    // Slot preenchido no boneco de equipamentos de OUTRO jogador (ver
    // showForeignEquipmentModal, aberto a partir da aba Ranks) — mostra os
    // bônus/cartas daquele item, sempre somente-leitura (viewingForeignEquipment
    // é o {slotId: entry} guardado no clique da linha, ver wireRanksTabEvents).
    const foreignItemBtn = e.target.closest('[data-view-foreign-item]');
    if (foreignItemBtn) {
      const entry = viewingForeignEquipment?.[foreignItemBtn.dataset.viewForeignItem];
      if (entry) {
        showForeignItemDetailModal(entry);
        modalBackHandler = () => {
          modalBackHandler = null;
          if (viewingForeignPlayer) showForeignEquipmentModal(viewingForeignPlayer);
        };
      }
      return;
    }

    // Janela de "Combate" (ver showPvpCombatPickerModal em ui/render.js) —
    // fora do padrão runModalAction porque handlePvpAttack já tem seu
    // próprio guard (pvpData.attackingId) e é assíncrona; ela mesma troca
    // o conteúdo do modal pro resultado da luta ao terminar.
    const pvpAttackBtn = e.target.closest('[data-pvp-attack]');
    if (pvpAttackBtn && !pvpData.attackingId) {
      handlePvpAttack(pvpAttackBtn.dataset.pvpAttack, pvpAttackBtn.dataset.pvpAttackBot === '1');
      return;
    }

    // Correio: botões "Resgatar Item"/"Apagar" dentro do modal de detalhe
    // de UMA mensagem (ver showMailDetailModal em ui/render.js).
    const mailClaimBtn = e.target.closest('[data-mail-claim]');
    if (mailClaimBtn) {
      runModalAction(() => {
        const message = mailboxData.messages.find((m) => String(m.id) === mailClaimBtn.dataset.mailClaim);
        if (!message) return;
        claimMailReward(state, message).then((claimed) => {
          if (!claimed) return;
          mailboxData = {
            ...mailboxData,
            messages: mailboxData.messages.map((m) => (m.id === message.id ? { ...m, claimed: true } : m)),
          };
          renderMailboxTab(mailboxData);
          fullRefresh();
          hideModal();
          showToast(`${GIFT_ICON} Recompensa resgatada!`);
        });
      });
      return;
    }
    const mailDeleteBtn = e.target.closest('[data-mail-delete]');
    if (mailDeleteBtn) {
      runModalAction(() => {
        const id = mailDeleteBtn.dataset.mailDelete;
        deleteMail(id).then((deleted) => {
          if (!deleted) return;
          mailboxData = { ...mailboxData, messages: mailboxData.messages.filter((m) => String(m.id) !== id) };
          renderMailboxTab(mailboxData);
          hideModal();
        });
      });
      return;
    }

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
    const selectMaterialBtn = e.target.closest('[data-select-material]');
    if (selectMaterialBtn) {
      runModalAction(() => selectMonsterForMaterial(selectMaterialBtn.dataset.selectMaterial));
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
        syncPvpEquipmentSilently();
      });
      return;
    }

    const unequipBtn = e.target.closest('[data-modal-unequip]');
    if (unequipBtn) {
      runModalAction(() => {
        unequipSlot(state, unequipBtn.dataset.modalUnequip);
        hideModal();
        fullRefresh();
        syncPvpEquipmentSilently();
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
          recordDailyMissionProgress(state, 'enhance_items');
          fullRefresh();
          syncPvpIfEquipped(uid);
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
          recordDailyMissionProgress(state, 'rank_master_items');
          fullRefresh();
          syncPvpIfEquipped(uid);
        }
      });
      return;
    }

    const ascendBtn = e.target.closest('[data-ascend-uid]');
    if (ascendBtn) {
      runModalAction(() => {
        const uid = Number(ascendBtn.dataset.ascendUid);
        // Reabrir o modal (fechou sem escolher e clicou em Ascender de
        // novo) reusa os MESMOS 3 candidatos em vez de rerolar — bug
        // corrigido a pedido do usuário: as opções só mudam quando de
        // fato rerola (item diferente, ou depois de escolher).
        let pending = pendingAscension && pendingAscension.uid === uid ? pendingAscension : null;
        if (!pending) {
          pending = rollAscensionCandidates(state, uid);
          pendingAscension = pending;
        }
        if (pending) showAscensionModal(state, uid, pending);
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
          syncPvpIfEquipped(uid);
        }
      });
      return;
    }

    // Fluxo de montar um item Tier God (ver systems/godItems.js): 1)
    // escolher o atributo base (só armadura/anel/colar, arma já vem
    // pronta), 2) rolar+escolher cada um dos 8 bônus, um de cada vez.
    const godChooseAttrBtn = e.target.closest('[data-god-choose-attr]');
    if (godChooseAttrBtn) {
      runModalAction(() => {
        const uid = Number(godChooseAttrBtn.dataset.godChooseAttr);
        const attributeId = godChooseAttrBtn.dataset.godChooseAttrValue;
        if (chooseGodAttribute(state, uid, attributeId)) {
          showItemDetailModal(state, uid);
          fullRefresh();
          syncPvpIfEquipped(uid);
        }
      });
      return;
    }

    const godRollBonusBtn = e.target.closest('[data-god-roll-bonus]');
    if (godRollBonusBtn) {
      runModalAction(() => {
        const uid = Number(godRollBonusBtn.dataset.godRollBonus);
        // Mesmo fix de pendingAscension acima: reabrir sem ter escolhido
        // reusa os mesmos 3 candidatos em vez de rerolar.
        let pending = pendingGodBonus && pendingGodBonus.uid === uid ? pendingGodBonus : null;
        if (!pending) {
          pending = rollGodBonusChoice(state, uid);
          pendingGodBonus = pending;
        }
        if (pending) showGodBonusModal(state, uid, pending);
      });
      return;
    }

    const rerollBonusBtn = e.target.closest('[data-reroll-bonus-uid]');
    if (rerollBonusBtn) {
      runModalAction(() => {
        const uid = Number(rerollBonusBtn.dataset.rerollBonusUid);
        const statIndex = Number(rerollBonusBtn.dataset.rerollBonusIndex);
        // Mesmo fix de pendingAscension acima: reabrir sem ter escolhido
        // reusa os mesmos 3 candidatos, sem gastar outro Dado Místico.
        let pending = pendingBonusReroll
          && pendingBonusReroll.uid === uid && pendingBonusReroll.statIndex === statIndex
          ? pendingBonusReroll : null;
        if (!pending) {
          if ((state.materials[MYSTIC_DIE_ID] || 0) < 1) {
            showToast(`🎲 Você não tem ${MYSTIC_DIE_NAME}.`);
            return;
          }
          pending = rollBonusReroll(state, uid, statIndex);
          pendingBonusReroll = pending;
        }
        if (pending) showBonusRerollModal(state, uid, pending);
      });
      return;
    }

    const rerollBonusAgainBtn = e.target.closest('[data-reroll-bonus-again]');
    if (rerollBonusAgainBtn) {
      runModalAction(() => {
        const uid = Number(rerollBonusAgainBtn.dataset.rerollBonusAgain);
        const statIndex = Number(rerollBonusAgainBtn.dataset.rerollBonusAgainIndex);
        if ((state.materials[MYSTIC_DIE_ID] || 0) < 1) {
          showToast(`🎲 Você não tem ${MYSTIC_DIE_NAME}.`);
          return;
        }
        const pending = rollBonusReroll(state, uid, statIndex);
        if (!pending) return;
        pendingBonusReroll = pending;
        showBonusRerollModal(state, uid, pending);
      });
      return;
    }

    const rerollBonusChooseBtn = e.target.closest('[data-reroll-bonus-choose]');
    if (rerollBonusChooseBtn) {
      runModalAction(() => {
        const uid = Number(rerollBonusChooseBtn.dataset.rerollBonusChoose);
        const chosenIndex = Number(rerollBonusChooseBtn.dataset.rerollBonusChooseIndex);
        if (!pendingBonusReroll) return;
        const pending = pendingBonusReroll;
        pendingBonusReroll = null;
        if (finalizeBonusReroll(state, uid, pending, chosenIndex)) {
          showItemDetailModal(state, uid);
          showToast('🎲 Bônus rerolado!');
          fullRefresh();
          syncPvpIfEquipped(uid);
        }
      });
      return;
    }

    const godBonusChooseBtn = e.target.closest('[data-god-bonus-choose]');
    if (godBonusChooseBtn) {
      runModalAction(() => {
        const uid = Number(godBonusChooseBtn.dataset.godBonusChoose);
        const chosenIndex = Number(godBonusChooseBtn.dataset.godBonusChooseIndex);
        if (!pendingGodBonus) return;
        const pending = pendingGodBonus;
        pendingGodBonus = null;
        if (finalizeGodBonus(state, uid, pending, chosenIndex)) {
          showItemDetailModal(state, uid);
          showToast('✨ Bônus escolhido!');
          fullRefresh();
          syncPvpIfEquipped(uid);
        }
      });
      return;
    }

    // Botão "Comprar" dentro da janela de especificações de um item Tier
    // God (showGodItemShopDetailModal, ver ui/render.js) — o modal não é
    // filho de #tab-shop no DOM, então o listener de lá (wireShopTabEvents)
    // não alcança esse clique; handleBuyAwakeningItem é compartilhado com
    // ele.
    const modalBuyAwakeningBtn = e.target.closest('[data-buy-awakening]');
    if (modalBuyAwakeningBtn) {
      runModalAction(() => {
        handleBuyAwakeningItem(modalBuyAwakeningBtn.dataset.buyAwakening);
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
          if (isEquipped) syncPvpEquipmentSilently();
        }
      });
      return;
    }

    const unsocketBtn = e.target.closest('[data-unsocket-uid]');
    if (unsocketBtn) {
      runModalAction(() => {
        const uid = Number(unsocketBtn.dataset.unsocketUid);
        const slotIndex = Number(unsocketBtn.dataset.unsocketSlot);
        const isEquipped = Object.values(state.equipped).includes(uid);
        if (unsocketCard(state, uid, slotIndex)) {
          showItemDetailModal(state, uid);
          showToast(`${CARD_ICON} Carta removida.`);
          fullRefresh();
          if (isEquipped) syncPvpEquipmentSilently();
        }
      });
      return;
    }

    // Destroying is a two-step confirm rendered inline in the modal (not a
    // native window.confirm dialog: those are blocked/silently swallowed
    // inside a sandboxed iframe, e.g. when this game runs as a Claude
    // Artifact, which made the button look completely dead).
    const toggleLockBtn = e.target.closest('[data-toggle-item-lock]');
    if (toggleLockBtn) {
      runModalAction(() => {
        const uid = Number(toggleLockBtn.dataset.toggleItemLock);
        if (toggleItemLock(state, uid)) {
          showItemDetailModal(state, uid);
          renderInventoryTabNow();
        }
      });
      return;
    }

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
            .map(([matId, qty]) => {
              const info = findMaterialInfo(matId);
              return `+${qty} <span class="icon">${iconMarkup(info?.image, info?.emoji ?? '', info?.name ?? '')}</span>`;
            })
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
          showToast(`${GIFT_ICON} +${formatNumber(CARD_DISCOVERY_CASH_REWARD)} ${ESMERALDA_ICON} Esmeralda!`);
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
        recordDailyMissionProgress(state, 'hatch_eggs');
        hideModal();
        showToast(discarded
          ? `🎒 Inventário de mascotes cheio! Mascote convertido em +${formatNumber(fragments)} ${PET_FRAGMENT_ICON} Fragmentos.`
          : '🐣 Novo mascote chocado!');
        renderTopBar(state);
        renderPetsTabNow();
        refreshDailyMissionsTab();
      });
      return;
    }

    const saveNameBtn = e.target.closest('[data-save-profile-name]');
    if (saveNameBtn) {
      runModalAction(() => saveProfileNameFlow());
      return;
    }

    const toggleSoundBtn = e.target.closest('[data-toggle-sound]');
    if (toggleSoundBtn) {
      runModalAction(() => {
        toggleSound(state);
        showProfileModal(state);
      });
      return;
    }

    const toggleMusicBtn = e.target.closest('[data-toggle-music]');
    if (toggleMusicBtn) {
      runModalAction(() => {
        toggleMusic(state);
        showProfileModal(state);
      });
      return;
    }

    const setLanguageBtn = e.target.closest('[data-set-language]');
    if (setLanguageBtn) {
      runModalAction(() => {
        setUiLanguage(setLanguageBtn.dataset.setLanguage);
        setLanguageSetting(state, setLanguageBtn.dataset.setLanguage);
        translateContainer(document.body);
        renderTopBar(state);
        fullRefresh();
        showProfileModal(state);
      });
      return;
    }

    const selectIconBtn = e.target.closest('[data-select-profile-icon]');
    if (selectIconBtn) {
      runModalAction(() => {
        if (selectProfileIcon(state, selectIconBtn.dataset.selectProfileIcon)) {
          renderTopBar(state);
          showProfileModal(state);
        }
      });
      return;
    }

    const confirmTranscendBtn = e.target.closest('[data-confirm-transcend]');
    if (confirmTranscendBtn) {
      runModalAction(() => performTranscend());
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
        .map(([matId, qty]) => {
          const info = findMaterialInfo(matId);
          return `+${qty} <span class="icon">${iconMarkup(info?.image, info?.emoji ?? '', info?.name ?? '')}</span>`;
        })
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

    const tierSortBtn = e.target.closest('[data-toggle-tier-sort]');
    if (tierSortBtn) {
      toggleInventoryTierSort();
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
  if (rewards.mysticDice > 0) lines.push(`<p class="offline-item-lines">+${formatNumber(rewards.mysticDice)} 🎲 ${MYSTIC_DIE_NAME}</p>`);

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
  renderHunterLevel(state);
  renderPetsTabNow();
}

/// Botão "Entrar" do banner da Expedição — não inicia nada sozinho, só
/// abre/fecha os 3 cartões de duração abaixo (ver expeditionCardsVisible).
function toggleExpeditionCards() {
  expeditionCardsVisible = !expeditionCardsVisible;
  renderEventsTabNow();
}

function showExpeditionRewardModal(result) {
  const { tier, goldGained, currencyGained, eggsGained, xpGained, levelsGained, goldBonusHits, currencyBonusHits, eggBonusHits } = result;
  const goldBonusNote = goldBonusHits > 0 ? ` <span class="offline-item-lines">(+${goldBonusHits} bônus!)</span>` : '';
  const currencyBonusNote = currencyBonusHits > 0 ? ` <span class="offline-item-lines">(+${currencyBonusHits} bônus!)</span>` : '';
  const eggBonusNote = eggBonusHits > 0 ? ` <span class="offline-item-lines">(+${eggBonusHits} bônus!)</span>` : '';
  const levelUpNote = levelsGained > 0 ? ` <span class="offline-item-lines">(+${levelsGained} ${levelsGained === 1 ? 'nível' : 'níveis'}!)</span>` : '';
  showModal(`🧭 Expedição de ${tier.label}`, `
    <p><strong>Recompensas:</strong></p>
    <p class="offline-item-lines">+${formatNumber(goldGained)} ${GOLD_ICON} Ouro${goldBonusNote}</p>
    <p class="offline-item-lines">+${formatNumber(currencyGained)} ${EVENT_ICON} Moeda de Evento${currencyBonusNote}</p>
    <p class="offline-item-lines">+${formatNumber(eggsGained)} ${EGG_ICON} Ovo${eggsGained === 1 ? '' : 's'} de Mascote${eggBonusNote}</p>
    <p class="offline-item-lines">✨ +${formatNumber(xpGained)} XP${levelUpNote}</p>
    <p class="event-sub">Você poderá entrar em outra expedição em ${expeditionDurationLabel(tier.durationMs)}.</p>
  `);
}

/// Popup de resultado ao abrir 1 Baú (ver openChest em systems/chests.js) —
/// cada `reward.type` sabe montar sua própria linha (ícone + texto), igual
/// showExpeditionRewardModal acima.
function chestRewardLineHtml(reward) {
  if (reward.type === 'egg') return `+${formatNumber(reward.amount)} ${EGG_ICON} Ovo${reward.amount === 1 ? '' : 's'} de Mascote`;
  if (reward.type === 'petFragment') return `+${formatNumber(reward.amount)} ${PET_FRAGMENT_ICON} Fragmento${reward.amount === 1 ? '' : 's'} de Mascote`;
  if (reward.type === 'cardFragment') return `+${formatNumber(reward.amount)} ${CARD_FRAGMENT_ICON} Fragmento${reward.amount === 1 ? '' : 's'} de Carta`;
  if (reward.type === 'awakeningShard') return `+${formatNumber(reward.amount)} ${AWAKENING_SHARD_ICON} Fragmento${reward.amount === 1 ? '' : 's'} do Despertar`;
  if (reward.type === 'pet') {
    const species = getPetSpecies(reward.speciesId);
    const rarity = getRarity(reward.rarityId);
    const label = `${species?.name ?? 'Mascote'} Tier 5 — ${rarity.name}`;
    if (reward.discarded) {
      return `🐾 ${label} (inventário cheio, virou +${formatNumber(reward.fragments)} ${PET_FRAGMENT_ICON} Fragmentos)`;
    }
    return `🐾 Novo Mascote: <span class="chest-reward-pet-img">${iconMarkup(species?.image, species?.emoji ?? '🐾', species?.name ?? '')}</span> ${label}`;
  }
  if (reward.type === 'card') {
    return `${CARD_ICON} Nova Carta: <span class="chest-reward-card-img">${iconMarkup(reward.card.image, reward.card.emoji ?? '', reward.card.name)}</span> ${reward.card.name}`;
  }
  return '';
}

/// Descrição de 1 entrada do pool de um Baú (ver data/chests.js) pro popup
/// de chances (showChestInfoModal abaixo) — mesma cara de
/// chestRewardLineHtml acima, mas descrevendo a entrada em si (antes de
/// sortear), não uma recompensa já aplicada ao state.
function chestPoolEntryLabel(entry) {
  if (entry.type === 'egg') return `${EGG_ICON} Ovo de Mascote x${entry.amount}`;
  if (entry.type === 'petFragment') return `${PET_FRAGMENT_ICON} Fragmento de Mascote x${entry.amount}`;
  if (entry.type === 'cardFragment') return `${CARD_FRAGMENT_ICON} Fragmento de Carta x${entry.amount}`;
  if (entry.type === 'awakeningShard') return `${AWAKENING_SHARD_ICON} Fragmento do Despertar x${entry.amount}`;
  if (entry.type === 'petTier5') return `🐾 Mascote Tier 5 aleatório — ${getRarity(entry.rarityId).name}`;
  if (entry.type === 'cardRandom') {
    const zoneLabel = `Zona ${entry.zoneMin + 1}-${entry.zoneMax + 1}`;
    return `${CARD_ICON} Carta${entry.bossOnly ? ' de Chefe' : ''} aleatória (${zoneLabel})`;
  }
  return '';
}

function showChestInfoModal(chestId) {
  const chest = CHESTS[chestId];
  const total = chest.pool.reduce((sum, e) => sum + e.weight, 0);
  const rows = chest.pool
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => {
      const pct = (entry.weight / total) * 100;
      const pctLabel = Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
      return `<p class="offline-item-lines">${chestPoolEntryLabel(entry)} — <strong>${pctLabel}</strong></p>`;
    }).join('');
  showModal(`ℹ️ ${chest.name}`, `<p><strong>Chances de recompensa:</strong></p>${rows}`);
}

function showChestRewardModal(chestId, reward) {
  const chest = CHESTS[chestId];
  showModal(`🎁 ${chest.name}`, `
    <p><strong>Você recebeu:</strong></p>
    <p class="offline-item-lines">${chestRewardLineHtml(reward)}</p>
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
  if (summary.hatched > 0) {
    recordDailyMissionProgress(state, 'hatch_eggs', summary.hatched);
    refreshDailyMissionsTab();
  }
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
      showToast(`${REFRESH_ICON} Pontos de habilidade resetados!`);
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

    const chestInfoBtn = e.target.closest('[data-chest-info]');
    if (chestInfoBtn) {
      showChestInfoModal(chestInfoBtn.dataset.chestInfo);
      return;
    }

    const openChestBtn = e.target.closest('[data-open-chest]');
    if (openChestBtn) {
      const chestId = openChestBtn.dataset.openChest;
      const reward = openChest(state, chestId);
      if (reward) {
        showChestRewardModal(chestId, reward);
        renderTopBar(state);
        renderShopTab(state, activeShopSubTab);
        renderInventoryTabNow();
        renderPetsTabNow();
      }
      return;
    }

    const dpsAdBtn = e.target.closest('[data-watch-dps-ad]');
    if (dpsAdBtn) {
      if (watchDpsBoostAd(state)) {
        showToast('⚡ Turbo de DPS ativado! +30% de DPS por 30 min.');
        renderShopTab(state, activeShopSubTab);
      }
      return;
    }

    const offlineAdBtn = e.target.closest('[data-watch-offline-ad]');
    if (offlineAdBtn) {
      if (watchOfflineBonusAd(state)) {
        showToast('⏰ +30 min no limite de recompensa offline!');
        renderShopTab(state, activeShopSubTab);
      }
      return;
    }

    const buyAwakeningBtn = e.target.closest('[data-buy-awakening]');
    if (buyAwakeningBtn) {
      handleBuyAwakeningItem(buyAwakeningBtn.dataset.buyAwakening);
      return;
    }

    const openGodItemBtn = e.target.closest('[data-open-god-item]');
    if (openGodItemBtn) {
      showGodItemShopDetailModal(state, openGodItemBtn.dataset.openGodItem);
      return;
    }

    const openCardShopBtn = e.target.closest('[data-open-card-shop-item]');
    if (openCardShopBtn) {
      showCardShopDetailModal(state, openCardShopBtn.dataset.openCardShopItem);
      return;
    }
  });
}

/// Compartilhado entre o clique direto na Loja (carta Supremo) e o botão
/// "Comprar" dentro da janela de especificações de um item Tier God
/// (showGodItemShopDetailModal, ver ui/render.js) — os 2 lugares chamam
/// isso, um pelo listener da aba (#tab-shop), outro pelo do modal
/// (wireModalEvents), já que o modal não é filho de #tab-shop no DOM.
function handleBuyAwakeningItem(shopItemId) {
  const result = buyAwakeningItem(state, shopItemId);
  if (result?.kind === 'card') {
    const card = getCard(result.cardId);
    showToast(`🌌 Carta recebida: ${card?.name ?? ''}!`);
    renderShopTab(state, activeShopSubTab);
    renderCardsTab(state);
  } else if (result?.kind === 'god_item') {
    hideModal();
    showToast(`✨ ${result.itemName} comprado! Escolha os atributos no inventário.`);
    renderShopTab(state, activeShopSubTab);
    renderInventoryTabNow();
  }
}

// Conquistas — aba própria dentro de "Outros" (antes era uma sub-aba da
// Loja, ver renderAchievementsTab em ui/render.js).
function wireAchievementsTabEvents() {
  document.getElementById('tab-achievements').addEventListener('click', (e) => {
    const claimBtn = e.target.closest('[data-claim-achievement]');
    if (claimBtn) {
      if (claimAchievementStage(state, claimBtn.dataset.claimAchievement)) {
        showToast(`${ACHIEVEMENT_ICON} Conquista resgatada!`);
        renderTopBar(state);
        renderAchievementsTab(state);
      }
      return;
    }

    const adBtn = e.target.closest('#watch-ad-btn');
    if (adBtn) {
      if (watchAd(state)) {
        showToast(`🎬 +${formatNumber(AD_WATCH_CASH_REWARD)} ${ESMERALDA_ICON} Esmeralda!`);
        renderTopBar(state);
        renderAchievementsTab(state);
      }
    }
  });
}

// Missão Diária — aba própria dentro de "Outros" (ver
// systems/dailyMissions.js pro fluxo completo). Só 1 pode estar ativa por
// vez: selecionar já falha sozinho (retorna false) se outra já estiver
// ativa ou se a missão do dia já tiver sido concluída — o botão nem
// deveria aparecer nesse caso (ver dailyMissionSlotHtml em ui/render.js),
// isso aqui é só a defesa de qualquer forma.
function wireDailyMissionsTabEvents() {
  document.getElementById('tab-daily-missions').addEventListener('click', (e) => {
    const claimBtn = e.target.closest('[data-mission-claim]');
    if (claimBtn) {
      const result = claimDailyMission(state, Number(claimBtn.dataset.missionClaim));
      if (result) {
        showDailyMissionCompleteModal(result);
        fullRefresh();
      }
      return;
    }

    const selectBtn = e.target.closest('[data-mission-select]');
    if (selectBtn) {
      if (selectMission(state, Number(selectBtn.dataset.missionSelect))) {
        showToast(`${DAILY_MISSION_ICON} Missão selecionada — boa sorte!`);
        refreshDailyMissionsTab();
      }
      return;
    }

    const abandonBtn = e.target.closest('[data-mission-abandon]');
    if (abandonBtn) {
      if (abandonMission(state, Number(abandonBtn.dataset.missionAbandon))) {
        showToast('🚫 Missão abandonada.');
        refreshDailyMissionsTab();
      }
      return;
    }

    const rerollBtn = e.target.closest('[data-mission-reroll]');
    if (rerollBtn) {
      if (rerollMission(state, Number(rerollBtn.dataset.missionReroll))) {
        showToast(`${REFRESH_ICON} Nova missão sorteada!`);
        refreshDailyMissionsTab();
      }
    }
  });
}

// ---------------------------------------------------------------
// Transcender: aba própria dentro de "Outros" (ver #tab-transcend em
// index.html + MORE_MENU_TAB_IDS acima) — só o botão de abrir o modal de
// confirmação; a compra na Loja do Despertar continua em
// wireShopTabEvents acima (aba "Despertar" da Loja).
// ---------------------------------------------------------------

function wireTranscendTabEvents() {
  document.getElementById('tab-transcend').addEventListener('click', (e) => {
    const openTranscendBtn = e.target.closest('[data-open-transcend-confirm]');
    if (openTranscendBtn) {
      if (canTranscend(state)) showTranscendConfirmModal(state);
    }
  });
}

// ---------------------------------------------------------------
// Arena PvP (ver systems/pvp.js + supabase/): tudo aqui é assíncrono (dados
// vivem no Supabase, não no save local) — pvpData é o cache em memória que
// renderPvpTab só LÊ de forma síncrona; refreshPvpTab é quem busca de
// verdade e reatribui esse cache antes de re-renderizar.
// ---------------------------------------------------------------

// Tudo aqui depende de rede/config externa (Supabase — ver supabase/README.md)
// que pode estar incompleta ou fora do ar; o try/catch é o que impede um
// erro de rede de deixar pvpData.loading travado em true pra sempre (botão
// desabilitado, "Conectando..." eterno) sem nenhum feedback pro jogador.
// `silent`: usado pela sincronização automática (ao abrir o jogo e a cada
// PVP_AUTO_SYNC_INTERVAL_MS, ver init() abaixo) — falha calada (só
// console.warn), sem toast de erro incomodando o jogador por algo que ele
// nem pediu pra acontecer agora. O clique manual em "Sincronizar"/"Conectar
// à Arena" (wirePvpTabEvents) sempre chama sem silent, então esse SIM avisa
// se der errado.
async function refreshPvpTab({ silent = false } = {}) {
  pvpData.loading = true;
  if (!silent) renderPvpTab(state, pvpData);

  let myProfile = null;
  let board = [];
  try {
    const stats = computePlayerStats(state);
    // 'neutro': PvP não tem "elemento do monstro" — mesma convenção do
    // próprio dano do caçador (weaponElement em stats.js), só decide qual
    // pet equipado bate mais forte, sem vantagem/desvantagem elemental.
    const bestPet = getBestEquippedPet(state, 'neutro', stats.dps);
    const petDps = bestPet ? bestPet.damage * (stats.petDamageMult || 1) : 0;
    await syncProfile(state, { ...stats, petDps }, getPlayerName(state), state.profileIconId);
    myProfile = await getMyPvpProfile();
    if (myProfile) {
      board = await fetchTierBoard(myProfile.tier, myProfile.group_index);
      // Conquista "Tier da Arena" (ver data/achievements.js): maior tier já
      // alcançado, não o atual — não pode regredir se um reset semanal
      // rebaixar o jogador de novo.
      const tierIndex = PVP_TIERS.findIndex((t) => t.name === myProfile.tier);
      if (tierIndex > (state.pvpHighestTierIndex || 0)) state.pvpHighestTierIndex = tierIndex;
    }
  } catch (err) {
    console.warn('Arena PvP: falha ao conectar:', err);
  }

  pvpData = { ...pvpData, loading: false, myProfile, board };
  renderPvpTab(state, pvpData);
  if (!myProfile && !silent) {
    showToast('❌ Não foi possível conectar à Arena PvP agora. Tente de novo mais tarde.');
  }
}

// Equipar/desequipar um item, ou encaixar/tirar uma carta de um item já
// equipado, muda o que outros jogadores veem no boneco somente-leitura da
// aba Ranks (ver equipped_snapshot) — sincroniza na hora, igual o clique
// manual em "Sincronizar", em vez de esperar o próximo ciclo automático de
// PVP_AUTO_SYNC_INTERVAL_MS (até 5min desatualizado).
function syncPvpEquipmentSilently() {
  refreshPvpTab({ silent: true });
}

// Mesma ideia acima, mas só dispara se `uid` está atualmente equipado —
// usado por aprimorar/Rank Master/ascender/montar item Deus (systems/
// crafting.js, systems/godItems.js), que também mudam o Power do item (ver
// systems/power.js) mas só valem a pena sincronizar se o item afetado
// estiver equipado (senão o Power total do jogador nem mudou).
function syncPvpIfEquipped(uid) {
  if (Object.values(state.equipped).includes(uid)) syncPvpEquipmentSilently();
}

async function handlePvpAttack(defenderId, isBot) {
  // Capturado ANTES do ataque — a resposta da Edge Function repete o nick
  // e o is_vip do defensor (pra colorir o nick, ver .vip-nick no CSS), mas
  // não o ícone (ver showPvpBattleModal em ui/render.js), e pvpData.board
  // ainda reflete a lista que o jogador estava vendo.
  const defenderRow = pvpData.board.find((r) => r.entity_id === defenderId && r.is_bot === isBot);
  const defenderInfo = {
    nick: defenderRow?.nick ?? '???', iconId: defenderRow?.icon_id ?? 'hunter', isVip: defenderRow?.is_vip ?? false,
  };

  pvpData = { ...pvpData, attackingId: defenderId };
  renderPvpTab(state, pvpData);

  let result;
  try {
    result = await attackOpponent(defenderId, isBot);
  } catch (err) {
    console.warn('Arena PvP: falha ao atacar:', err);
    result = { error: 'unknown_error' };
  }
  pvpData = { ...pvpData, attackingId: null };

  if (!result.error && result.goldReward) {
    state.gold += result.goldReward;
    state.lifetimeGoldEarned = (state.lifetimeGoldEarned || 0) + result.goldReward;
    renderTopBar(state);
  }
  if (!result.error && result.attackerWins) {
    state.pvpWinsTotal = (state.pvpWinsTotal || 0) + 1;
  }
  // Missão Diária "Ataque"/"Vença na Arena" (ver systems/dailyMissions.js)
  // — só marca progresso aqui; a recompensa em si só sai quando o
  // jogador clicar "Concluir Missão" na aba (ver claimDailyMission).
  if (!result.error) recordDailyMissionProgress(state, 'arena_attacks');
  if (!result.error && result.attackerWins) recordDailyMissionProgress(state, 'arena_wins');
  refreshDailyMissionsTab();
  if (!result.error && pvpData.myProfile) {
    const ratingPatch = result.hiddenScore ? {} : { rating: result.attackerRatingAfter };
    const winsPatch = result.attackerWins ? { wins: (pvpData.myProfile.wins || 0) + 1 } : {};
    pvpData = {
      ...pvpData,
      myProfile: {
        ...pvpData.myProfile, ...ratingPatch, ...winsPatch,
        pvp_entries: result.entriesRemaining, pvp_entries_updated_at: new Date().toISOString(),
      },
    };
  }
  if (!result.error && typeof result.defenderIsVip === 'boolean') defenderInfo.isVip = result.defenderIsVip;
  showPvpBattleModal(pvpData, defenderInfo, result);
  renderPvpTab(state, pvpData);
  // Posições/pontos do tier inteiro podem ter mudado (o próprio e/ou o
  // alvo) — busca o tier de novo pra refletir, sem travar a resposta da
  // luta esperando por isso.
  if (!result.error && pvpData.myProfile) {
    try {
      const board = await fetchTierBoard(pvpData.myProfile.tier, pvpData.myProfile.group_index);
      pvpData = { ...pvpData, board };
      renderPvpTab(state, pvpData);
    } catch (err) {
      console.warn('Arena PvP: falha ao atualizar o tier após a luta:', err);
    }
  }
}

// "⚔️ Combate" (ver wirePvpTabEvents) — sorteia até 5 oponentes num raio
// de posição ao redor do jogador (ver pickRandomPvpOpponents em
// systems/pvp.js) e abre a janela de escolha. Tudo calculado em cima do
// pvp.board já carregado — não busca nada novo do servidor só pra isso.
function openPvpCombatPicker() {
  const myProfile = pvpData.myProfile;
  if (!myProfile) return;
  const myRow = pvpData.board.find((r) => !r.is_bot && r.entity_id === myProfile.id);
  if (!myRow) return;
  const tierInfo = getPvpTierInfo(myProfile.tier);
  const opponents = pickRandomPvpOpponents(pvpData.board, myProfile.id, myRow.position).map((row) => ({
    ...row,
    swing: tierInfo.hiddenScore ? null : previewPvpAttackSwing(myRow.position, row.position, pvpData.board.length),
  }));
  showPvpCombatPickerModal(tierInfo, opponents);
}

function wirePvpTabEvents() {
  document.getElementById('tab-pvp').addEventListener('click', (e) => {
    const refreshBtn = e.target.closest('[data-pvp-refresh]');
    if (refreshBtn && !pvpData.loading) {
      refreshPvpTab();
      return;
    }
    const combatBtn = e.target.closest('[data-pvp-open-combat]');
    if (combatBtn) {
      openPvpCombatPicker();
    }
  });
}

// Mesmo padrão de refreshPvpTab acima, só que buscando os 3 rankeamentos
// globais em paralelo (ver fetchArenaRank/fetchLevelRank/fetchTranscendRank
// em systems/pvp.js) — cada um já cruza todos os tiers/grupos, então não
// depende do tier/grupo do jogador feito refreshPvpTab depende.
async function refreshRanksTab() {
  ranksData = { ...ranksData, loading: true };
  renderRanksTab(ranksData, pvpData.myProfile);
  try {
    const [arena, level, transcend] = await Promise.all([
      fetchArenaRank(), fetchLevelRank(), fetchTranscendRank(),
    ]);
    ranksData = { ...ranksData, arena, level, transcend, loading: false, loaded: true };
  } catch (err) {
    console.warn('Ranks: falha ao buscar:', err);
    ranksData = { ...ranksData, loading: false };
  }
  renderRanksTab(ranksData, pvpData.myProfile);
}

function wireRanksTabEvents() {
  document.getElementById('tab-ranks').addEventListener('click', (e) => {
    const refreshBtn = e.target.closest('[data-ranks-refresh]');
    if (refreshBtn && !ranksData.loading) {
      refreshRanksTab();
      return;
    }
    const sectionBtn = e.target.closest('[data-ranks-section]');
    if (sectionBtn) {
      ranksData = { ...ranksData, activeSection: sectionBtn.dataset.ranksSection };
      renderRanksTab(ranksData, pvpData.myProfile);
      return;
    }

    // Clique numa linha de outro jogador (qualquer seção — ver
    // data-view-player-equipment em pvpRankRowHtml/ui/render.js, que já
    // omite esse atributo na sua própria linha) — busca o equipamento
    // sincronizado dele e abre o boneco somente-leitura.
    const viewEquipBtn = e.target.closest('[data-view-player-equipment]');
    if (viewEquipBtn) {
      const entityId = viewEquipBtn.dataset.viewPlayerEquipment;
      modalBackHandler = null;
      showModal('', '<p class="shop-note">Carregando equipamento...</p>');
      fetchPlayerEquipment(entityId).then((player) => {
        if (!player) {
          showModal('', '<p class="shop-note">Não foi possível carregar o equipamento desse jogador agora.</p>');
          return;
        }
        viewingForeignEquipment = player.equipped_snapshot || {};
        viewingForeignPlayer = player;
        showForeignEquipmentModal(player);
      });
    }
  });
}

// ---------------------------------------------------------------
// Correio (ver systems/mailbox.js): avisos do Admin + recompensas
// automáticas da Arena. A lista em si (renderMailboxTab) só mostra
// título/ícone de presente; abrir uma mensagem (data-mail-open) mostra o
// corpo + botão de resgatar/apagar num modal (showMailDetailModal),
// wireado no #modal-overlay compartilhado (ver wireModalEvents).
// ---------------------------------------------------------------

async function refreshMailboxTab() {
  mailboxData = { ...mailboxData, loading: true };
  renderMailboxTab(mailboxData);
  try {
    const messages = await fetchMailbox();
    mailboxData = { messages, loading: false };
  } catch (err) {
    console.warn('Correio: falha ao buscar:', err);
    mailboxData = { ...mailboxData, loading: false };
  }
  renderMailboxTab(mailboxData);
  updateMailBadges();
}

/// Bolinha vermelha no botão "Outros" (nav principal) e no item "Correio"
/// dentro do menu, indicando que tem mensagem não lida — some sozinha
/// assim que a última não-lida for aberta (ver data-mail-open em
/// wireModalEvents, que chama markMailRead).
function updateMailBadges() {
  const unread = hasUnreadMail(mailboxData.messages);
  document.getElementById('mail-badge-outros').classList.toggle('hidden', !unread);
  document.getElementById('mail-badge-menu').classList.toggle('hidden', !unread);
}

function wireMailboxTabEvents() {
  document.getElementById('tab-mailbox').addEventListener('click', (e) => {
    const refreshBtn = e.target.closest('[data-mail-refresh]');
    if (refreshBtn && !mailboxData.loading) {
      refreshMailboxTab();
      return;
    }
    const claimAllBtn = e.target.closest('[data-mail-claim-all]');
    if (claimAllBtn) {
      claimAllMail();
      return;
    }
    const openBtn = e.target.closest('[data-mail-open]');
    if (openBtn) {
      const message = mailboxData.messages.find((m) => String(m.id) === openBtn.dataset.mailOpen);
      if (!message) return;
      showMailDetailModal(message);
      if (!message.read) {
        mailboxData = {
          ...mailboxData,
          messages: mailboxData.messages.map((m) => (m.id === message.id ? { ...m, read: true } : m)),
        };
        renderMailboxTab(mailboxData);
        updateMailBadges();
        markMailRead(message.id);
      }
    }
  });
}

/// "🎁 Resgatar Todos" — resgata em sequência toda mensagem com item
/// pendente (evita disparar N updates em paralelo sem necessidade; o
/// volume aqui é sempre pequeno o bastante pra não incomodar).
async function claimAllMail() {
  const claimable = mailboxData.messages.filter((m) => mailHasReward(m) && !m.claimed);
  for (const message of claimable) {
    // eslint-disable-next-line no-await-in-loop
    await claimMailReward(state, message);
  }
  mailboxData = {
    ...mailboxData,
    messages: mailboxData.messages.map((m) => (mailHasReward(m) ? { ...m, claimed: true } : m)),
  };
  renderMailboxTab(mailboxData);
  fullRefresh();
  showToast(`${GIFT_ICON} Recompensas resgatadas!`);
}

// ---------------------------------------------------------------
// Transcender: reset de prestígio (ver systems/awakening.js transcend()) —
// troca a referência local `state` por um state novo (quase tudo
// resetado, ver PRESERVED_KEYS lá) e reinicia todo o estado de combate
// "por sessão" que não é parte do save (currentHp/bossDeadline/etc.),
// igual um load do zero faria.
// ---------------------------------------------------------------

function performTranscend() {
  if (!canTranscend(state)) return;
  state = transcend(state);
  ensureMonsterSpawned(state);

  bossDeadline = null;
  nextHitAt = null;
  pendingMonsterSelection = [];
  pendingHatchCandidates = null;
  pendingAscension = null;
  pendingGodBonus = null;
  pendingBonusReroll = null;
  bulkSelectMode = false;
  bulkSelectedUids = new Set();
  bulkConfirmingDestroy = false;
  skillResetConfirming = false;
  petSortMode = null;
  expeditionCardsVisible = false;
  inventoryFilterCategory = null;
  inventorySortByTier = null;
  activeShopSubTab = 'cash';

  hideModal();
  resetPlayerHp();
  saveState(state);
  fullRefresh();
  armBossTimer();
  showToast(`${TRANSCEND_ICON} Você Transcendeu! Uma nova jornada começa.`);
}

// ---------------------------------------------------------------
// Offline progress
// ---------------------------------------------------------------

function showOfflineProgressIfAny() {
  const progress = computeOfflineProgress(state);
  if (!progress) return;
  const wasTranscendUnlocked = canTranscend(state);
  applyOfflineProgress(state, progress);
  // applyOfflineProgress pode ter empurrado itens novos pro inventário
  // (ver itemDropCount) depois que fullRefresh() já rodou no init() — sem
  // isso a aba Equipamentos ficaria mostrando o inventário desatualizado
  // até a próxima ação disparar um re-render.
  if (progress.itemDropCount > 0) renderInventoryTabNow();
  if (!wasTranscendUnlocked && canTranscend(state)) {
    showToast(`${TRANSCEND_ICON} Transcender desbloqueado! Veja a aba Transcender em Outros.`);
    renderTranscendTab(state);
  }

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

  const maxOfflineHours = (progress.maxOfflineSeconds / 3600).toFixed(1).replace(/\.0$/, '');
  showModal('Bem-vindo de volta!', `
    <p>Você ficou fora por <strong>${timeStr}</strong> (máximo ${maxOfflineHours}h de recompensa offline).</p>
    <p>Seu personagem continuou lutando sozinho, a ${Math.round(OFFLINE_EFFICIENCY * 100)}% de eficiência, e conseguiu:</p>
    <p>💀 ${formatNumber(progress.kills)} monstros derrotados<br>
       ${GOLD_ICON} +${formatNumber(progress.goldGained)} ouro<br>
       ✨ +${formatNumber(progress.xpGained)} Exp</p>
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
  setupProfile();
  wireModalEvents(); // one-time delegated listener, see wireModalEvents()
  wireInventoryTabEvents();
  wireCardsTabEvents();
  wireEventTabEvents();
  wireShopTabEvents();
  wireAchievementsTabEvents();
  wireDailyMissionsTabEvents();
  wireTranscendTabEvents();
  wirePvpTabEvents();
  wireRanksTabEvents();
  wireMailboxTabEvents();
  wirePetsTabEvents();
  wireSkillsTabEvents();
  resetPlayerHp();
  if (state.arenaRunActive) {
    arenaDeadline = Date.now() + ARENA_RUN_DURATION_MS;
  }
  fullRefresh();
  translateContainer(document.body);
  armBossTimer();

  document.getElementById('modal-close').addEventListener('click', () => {
    if (modalBackHandler) {
      modalBackHandler();
      return;
    }
    hideModal();
  });

  showOfflineProgressIfAny();

  // Conecta e sincroniza a Arena PvP sozinho ao abrir o jogo — o jogador
  // não precisa clicar em nada pra outros conseguirem te atacar com stats
  // atualizadas. `silent: true` = falha calada se o Supabase ainda não
  // estiver configurado (ver supabase/README.md) ou sem internet; não
  // aguardado (sem `await`) de propósito, pra não atrasar o resto do
  // carregamento do jogo por causa de uma chamada de rede externa.
  refreshPvpTab({ silent: true });
  setInterval(() => refreshPvpTab({ silent: true }), PVP_AUTO_SYNC_INTERVAL_MS);

  // Mesma ideia pro Correio — busca sozinho ao abrir o jogo (e depois
  // periodicamente) só pra saber se tem mensagem não lida e acender a
  // bolinha em "Outros"/"Correio" (ver updateMailBadges), sem precisar
  // que o jogador abra a aba pra descobrir.
  refreshMailboxTab();
  setInterval(refreshMailboxTab, PVP_AUTO_SYNC_INTERVAL_MS);

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
