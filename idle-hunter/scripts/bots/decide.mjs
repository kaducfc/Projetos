// Motor de decisão "Experiente" — reusa os módulos REAIS de regras do
// jogo (js/systems/*.js), sem reimplementar nada em Python/paralelo. Cada
// chamada de runOneDay avança 1 dia de progresso pra 1 bot, na mesma
// ordem que um jogador Experiente de verdade jogaria: checa missão/VIP,
// aplica o progresso offline acumulado (mesmíssimo mecanismo de
// systems/offline.js que roda pro jogador humano), e então gasta os
// recursos ganhos em aprimorar equipamento, chocar ovo, abrir Baú,
// Expedição, Combate Permanente e Transcender.
import { createDefaultState, isVipActive } from '../../js/state.js';
import { computePlayerStats } from '../../js/systems/stats.js';
import { computePlayerPower, computeItemPower } from '../../js/systems/power.js';
import {
  ensureMonsterSpawned, canSelectMonster, setSelectedMonsters, MAX_SELECTED_MONSTERS,
  monsterMaxHp, MONSTER_RESPAWN_DELAY_MS,
} from '../../js/systems/combat.js';
import { computeOfflineProgress, applyOfflineProgress } from '../../js/systems/offline.js';
import { ZONES, ZONE_COUNT } from '../../js/data/monsters.js';
import { highestUnlockedZoneIndex, isBossUnlocked } from '../../js/systems/leveling.js';
import {
  canEnhance, enhanceItem, canUpgradeToMaster, upgradeToMaster, canAscendItem,
  rollAscensionCandidates, finalizeAscension, canRerollBonus, rollBonusReroll, finalizeBonusReroll,
  canSocketCard, socketCard, ensureCardIds, canDestroyItem, destroyItem,
} from '../../js/systems/crafting.js';
import { getItem, getSlotIdsForCategory, MYSTIC_DIE_ID, GOD_ITEMS, GOD_BONUS_SLOTS } from '../../js/data/items.js';
import {
  rollHatchCandidates, canChooseRightPet, useFreeRightPetChoice,
  addPetToInventory, recordPetHatchOutcome, fuseAllPossiblePets,
  equipPet, canEquipPet,
} from '../../js/systems/pets.js';
import { getPetInventoryCap, isPetCandidateBetter } from '../../js/data/pets.js';
import { canBuyChest, openChest } from '../../js/systems/chests.js';
import { canBuyCashItem, buyCashItem } from '../../js/systems/shop.js';
import { canEnterExpedition, enterExpedition } from '../../js/systems/expedition.js';
import { canEnterArena, startArenaRun, applyArenaDamage, endArenaRun } from '../../js/systems/arena.js';
import { canTranscend, transcend, canBuyAwakeningItem, buyAwakeningItem } from '../../js/systems/awakening.js';
import {
  needsGodAttributeChoice, canChooseGodAttribute, chooseGodAttribute,
  canRollGodBonus, rollGodBonusChoice, finalizeGodBonus,
} from '../../js/systems/godItems.js';
import { ensureDailyMissionsFresh, getActiveMissionSlotIndex, canSelectMission, selectMission, canClaimMission, claimDailyMission } from '../../js/systems/dailyMissions.js';
import { equipItem, canEquipItem, findEquippedSlotId, unequipSlot } from '../../js/systems/equipment.js';
import { isAchievementStageReady, isAchievementFullyClaimed, claimAchievementStage } from '../../js/systems/achievements.js';
import { ACHIEVEMENTS } from '../../js/data/achievements.js';
import { canRecycleCard, recycleCard, canCraftCard, craftCard } from '../../js/systems/cards.js';
import { CARDS } from '../../js/data/cards.js';

export function newBotState() {
  return createDefaultState();
}

// Pedido explícito do usuário: se a zona mais alta já desbloqueada (só por
// NÍVEL, ver isZoneUnlocked em systems/leveling.js — não tem relação
// nenhuma com o DPS de verdade) for forte demais pro Power atual, o bot
// ficaria caçando ali pra sempre sem nenhum kill de verdade saindo (HP do
// monstro alto demais pro DPS atual = tempo por kill gigantesco = zero
// kills mesmo depois de várias "aberturas" do dia) — nunca ganharia XP/
// ouro/material pra se fortificar e nunca sairia de lá sozinho. Recua zona
// por zona até achar uma onde o monstro FRACO (sempre o mais fácil da
// zona) morre num tempo razoável (MAX_ACCEPTABLE_SECONDS_PER_KILL) —
// refreshMonsterSelection roda de novo a cada dia simulado, então assim
// que o Power crescer o suficiente (farmando/aprimorando na zona mais
// fácil), a escolha sobe de volta pra zona mais difícil sozinha, sem
// precisar guardar nenhum estado extra.
const MAX_ACCEPTABLE_SECONDS_PER_KILL = 30;

function estimatedSecondsToKill(stats, zoneIndex, isBoss) {
  const zone = ZONES[zoneIndex];
  const effectiveDps = stats.dps * (stats.attackSpeedPerSec || 1);
  if (effectiveDps <= 0) return Infinity;
  return monsterMaxHp(zone.canonicalStage, isBoss) / effectiveDps + MONSTER_RESPAWN_DELAY_MS / 1000;
}

function pickFarmableZoneIndex(state, stats) {
  let zoneIndex = highestUnlockedZoneIndex(state);
  while (zoneIndex > 0 && estimatedSecondsToKill(stats, zoneIndex, false) > MAX_ACCEPTABLE_SECONDS_PER_KILL) {
    zoneIndex -= 1;
  }
  return zoneIndex;
}

/// Sempre mantém os 4 melhores monstros selecionados na zona mais difícil
/// que o bot já libera E consegue de fato matar (ver pickFarmableZoneIndex
/// acima) — o farm mais eficiente pra XP/ouro/materiais nesse ponto do
/// jogo, mas nunca uma zona que travaria o progresso. O chefe só entra na
/// seleção se também morrer num tempo razoável (senão só os fracos da
/// mesma zona, sempre mais fáceis).
function refreshMonsterSelection(state, stats) {
  const zoneIndex = pickFarmableZoneIndex(state, stats);
  const zone = ZONES[zoneIndex];
  const list = [];
  const bossKillable = isBossUnlocked(state, zoneIndex) && estimatedSecondsToKill(stats, zoneIndex, true) <= MAX_ACCEPTABLE_SECONDS_PER_KILL;
  if (bossKillable) list.push({ zoneIndex, kind: 'boss', monsterId: zone.boss.id });

  // Pedido explícito do usuário: tenta matar o chefe da ÚLTIMA zona assim
  // que possível pra liberar o Transcender — reserva 1 vaga do pool pra
  // essa tentativa sempre que ele já estiver desbloqueado por NÍVEL
  // (isBossUnlocked, sem relação com DPS) e o Transcender ainda não tiver
  // sido liberado, mesmo que ele ainda não seja "farmável" de verdade (ver
  // pickFarmableZoneIndex acima). Cada kill simulado offline sorteia um
  // monstro do pool inteiro (ver computeOfflineProgress/pickOfflineMonster
  // em systems/offline.js), então só incluí-lo aqui já basta pra eventualmente
  // registrar a morte dele e disparar killedFinalBoss -> unlockTranscend.
  const finalZoneIndex = ZONE_COUNT - 1;
  if (!canTranscend(state) && zoneIndex !== finalZoneIndex
    && isBossUnlocked(state, finalZoneIndex) && list.length < MAX_SELECTED_MONSTERS) {
    list.push({ zoneIndex: finalZoneIndex, kind: 'boss', monsterId: ZONES[finalZoneIndex].boss.id });
  }

  for (const m of zone.weakMonsters) {
    if (list.length >= MAX_SELECTED_MONSTERS) break;
    list.push({ zoneIndex, kind: 'weak', monsterId: m.id });
  }
  if (list.length && canSelectMonster(state, zoneIndex, list[0].kind)) setSelectedMonsters(state, list);
  ensureMonsterSpawned(state);
}

/// Fonte real de Esmeralda (sem microtransação de verdade nesse
/// protótipo, ver data/shop.js) — resgata toda etapa de conquista pronta.
function claimReadyAchievements(state) {
  for (const achievement of ACHIEVEMENTS) {
    let guard = 0;
    while (!isAchievementFullyClaimed(state, achievement) && isAchievementStageReady(state, achievement) && guard++ < 50) {
      claimAchievementStage(state, achievement.id);
    }
  }
}

function buyVipAsapAndAscendPriorities(state) {
  if (!isVipActive(state) && canBuyCashItem(state, 'cash_vip')) buyCashItem(state, 'cash_vip');
  // Pedido explícito do usuário: "sempre que possível, compre os baús de
  // Gold" — 'cash_gold_l' ("Baú de Ouro") converte Esmeralda sobrando em
  // Ouro pra sustentar aprimoramento de equipamento; sem limite diário
  // (ver canBuyCashItem/systems/shop.js), então esvazia a Esmeralda que
  // sobrar depois do VIP nisso, sempre a opção de melhor custo-benefício
  // (750 ouro por Esmeralda, contra 500 do 'cash_gold_s').
  let guard = 0;
  while (canBuyCashItem(state, 'cash_gold_l') && guard++ < 50) buyCashItem(state, 'cash_gold_l');
}

/// A build de 1 bot é travada PRA SEMPRE na 1ª arma primária que ele
/// equipar (state.botBuildAttribute — campo só dos bots, não faz parte do
/// save de um jogador de verdade). Precisa ser travada, não só derivada
/// ao vivo do que está equipado agora: um Transcender reseta hunterLevel
/// pra 1, e Tier God exige Nível >= GOD_MIN_LEVEL(100) pra equipar (ver
/// canEquipItem em systems/equipment.js) — nessa janela entre transcender
/// e voltar ao nível 100, o bot equipa temporariamente qualquer arma
/// normal que cair (ver manageInventory), às vezes de outro atributo. Sem
/// travar, isso fazia buyAvailableGodItems (chamada logo após Transcender)
/// achar um atributo "de passagem" errado e comprar mais de 1 arma Tier
/// God diferente ao longo de várias Transcendências, desperdiçando
/// Fragmento do Despertar. maybeTranscend abaixo carrega esse campo pro
/// state novo manualmente (transcend() em systems/awakening.js não sabe
/// dele, é específico dos bots).
function getBuildAttribute(state) {
  if (state.botBuildAttribute) return state.botBuildAttribute;
  const uid = state.equipped.weapon1;
  if (!uid) return null;
  const entry = state.inventory.find((i) => i.uid === uid);
  const item = entry && getItem(entry.itemId);
  const attribute = (item && item.attribute) || null;
  if (attribute) state.botBuildAttribute = attribute;
  return attribute;
}

// Pedido explícito do usuário: bots especializados em 1 único atributo
// (baseado na arma) — só o tipo de dano que combina com esse atributo
// interessa (dano físico pra Força, perfuração pra Destreza, mágico pra
// Inteligência, já que só o dano da ARMA PRIMÁRIA vira dano de verdade, ver
// activeDamageType em systems/stats.js), fora os stats universalmente úteis
// pra qualquer build (vida, crítico, velocidade de ataque, esquiva).
const UNIVERSAL_GOOD_STATS = new Set([
  'dpsPercent', 'hpPercent', 'hpFlat', 'armorFlat', 'armorPercent', 'critChancePercent',
  'critDamagePercent', 'attackSpeedPercent', 'dodgePercent', 'lifestealFlat', 'doubleHitChance',
]);
const DANO_STAT_BY_ATTRIBUTE = {
  forca: 'danoFisicoFlat', destreza: 'danoPerfuracaoFlat', inteligencia: 'danoMagicoFlat',
};

/// Pontua um stat de bônus (candidate.stat de rollAscensionCandidates/
/// rollBonusReroll) pra quão bem ele serve a build atual — usado tanto pra
/// ESCOLHER o melhor dos 3 candidatos (Ascensão/reroll) quanto pra achar
/// qual bônus JÁ EXISTENTE num item vale a pena trocar.
function scoreBonusStat(buildAttribute, stat) {
  if (UNIVERSAL_GOOD_STATS.has(stat)) return 100;
  if (buildAttribute) {
    if (stat === buildAttribute) return 100; // attrSelf/attrOther no atributo da build
    if (DANO_STAT_BY_ATTRIBUTE[buildAttribute] === stat) return 100; // tipo de dano da build
    if (stat === 'forca' || stat === 'destreza' || stat === 'inteligencia') return 20; // outro atributo — ainda dá HP/armadura/crítico de brinde
    if (Object.values(DANO_STAT_BY_ATTRIBUTE).includes(stat)) return 5; // tipo de dano que a build NÃO usa
  }
  return 10; // goldPercent/dropPercent/petDamagePercent — ou build ainda não definida
}

function bestCandidateIndex(buildAttribute, candidates) {
  let bestIndex = 0;
  let bestScore = -Infinity;
  candidates.forEach((c, i) => {
    const score = scoreBonusStat(buildAttribute, c.stat);
    if (score > bestScore) { bestScore = score; bestIndex = i; }
  });
  return bestIndex;
}

/// Pontua uma carta inteira (ver data/cards.js CARDS, bonuses: [{stat,
/// value}]) somando scoreBonusStat de cada bônus que ela dá — um bônus
/// NEGATIVO (cartas de contrapeso, ex: +Força/-Inteligência) inverte o
/// sinal do score daquele stat, já que reduzir um stat bom é ruim. Mesma
/// escala 0-100 por stat de scoreBonusStat, reaproveitada igual pros
/// bônus de item.
function scoreCard(buildAttribute, card) {
  return (card.bonuses || []).reduce((sum, b) => {
    const base = scoreBonusStat(buildAttribute, b.stat);
    return sum + (b.value >= 0 ? base : -base);
  }, 0);
}

// Pedido explícito do usuário: "recicle cartas que não ajudam na build" e
// "tente craftar cartas que são fortes" — abaixo desse score, a carta é
// considerada fraca/desalinhada o bastante pra valer reciclar mesmo tendo
// só 1 cópia (economia > guardar sucata).
const WEAK_CARD_SCORE_THRESHOLD = 30;

/// Recicla toda cópia de carta fraca/desalinhada que sobrar em mãos
/// (nunca mexe em carta já socketada — essa nem aparece em state.cards
/// enquanto estiver equipada, ver systems/crafting.js) e usa os
/// fragmentos ganhos (+ os que já existiam) pra craftar a carta mais forte
/// disponível pra build atual, repetidamente enquanto o estoque permitir.
function manageCards(state) {
  const buildAttribute = getBuildAttribute(state);
  for (const card of CARDS) {
    if ((state.cards[card.id] || 0) < 1) continue;
    if (scoreCard(buildAttribute, card) >= WEAK_CARD_SCORE_THRESHOLD) continue;
    if (canRecycleCard(state, card.id)) recycleCard(state, card.id);
  }

  const craftable = CARDS
    .filter((card) => !card.noCraft)
    .map((card) => ({ card, score: scoreCard(buildAttribute, card) }))
    .sort((a, b) => b.score - a.score);
  let guard = 0;
  let craftedSomething = true;
  while (craftedSomething && guard++ < 200) {
    craftedSomething = false;
    for (const { card } of craftable) {
      if (canCraftCard(state, card.id)) {
        craftCard(state, card.id);
        craftedSomething = true;
        break;
      }
    }
  }
}

/// Aprimora/evolui/ascende TODO item equipado até travar por falta de
/// material/ouro — na Ascensão, sempre escolhe o candidato que melhor serve
/// a build atual (ver scoreBonusStat acima) em vez de um aleatório. Com
/// Dado Místico sobrando (>=10), rerola o bônus MAIS DESALINHADO da build
/// que o item já tem (só se realmente vale a pena, score < 50 — senão
/// guarda o estoque) pelo melhor dos 3 candidatos novos.
function upgradeEquippedItems(state) {
  const buildAttribute = getBuildAttribute(state);
  for (const uid of Object.values(state.equipped)) {
    if (!uid) continue;
    let guard = 0;
    while (canEnhance(state, uid) && guard++ < 20) enhanceItem(state, uid);
    if (canUpgradeToMaster(state, uid)) upgradeToMaster(state, uid);
    if (canAscendItem(state, uid)) {
      const pending = rollAscensionCandidates(state, uid);
      if (pending) finalizeAscension(state, uid, pending, bestCandidateIndex(buildAttribute, pending.candidates));
    }
    const entry = state.inventory.find((i) => i.uid === uid);
    const additionalStats = entry?.additionalStats || [];
    if (additionalStats.length > 0 && (state.materials[MYSTIC_DIE_ID] || 0) >= 10) {
      let worstIndex = -1;
      let worstScore = Infinity;
      additionalStats.forEach((add, i) => {
        const score = scoreBonusStat(buildAttribute, add.stat);
        if (score < worstScore) { worstScore = score; worstIndex = i; }
      });
      if (worstIndex !== -1 && worstScore < 50 && canRerollBonus(state, uid, worstIndex)) {
        const pending = rollBonusReroll(state, uid, worstIndex);
        if (pending) finalizeBonusReroll(state, uid, pending, bestCandidateIndex(buildAttribute, pending.candidates));
      }
    }
  }
}

/// Loja do Despertar (1 Fragmento do Despertar por peça, ver
/// AWAKENING_SHOP_ITEMS em data/awakening.js): monta a build Tier God peça
/// por peça assim que sobrar Fragmento — pedido explícito do usuário
/// ("comprar um item Tier God, e assim vai montando a build correta").
/// Prioriza a arma primária do MESMO atributo da build atual, depois as
/// peças sem atributo fixo (servem pra qualquer build), por último a arma
/// secundária (só equipa junto da primária do mesmo atributo — ver
/// canEquipItem em systems/equipment.js). `buildAttributeOverride` é usado
/// logo após Transcender: nesse momento o state é novo (sem arma
/// equipada ainda pra derivar um sozinho), então usa o atributo de ANTES
/// de transcender em vez de perder a build escolhida.
function buyAvailableGodItems(state, buildAttributeOverride = null) {
  const buildAttribute = buildAttributeOverride || getBuildAttribute(state) || 'forca';
  const priority = [
    { category: 'weapon1', attribute: buildAttribute, maxCopies: 1 },
    { category: 'head', attribute: null, maxCopies: 1 },
    { category: 'chest', attribute: null, maxCopies: 1 },
    { category: 'legs', attribute: null, maxCopies: 1 },
    { category: 'hands', attribute: null, maxCopies: 1 },
    { category: 'boots', attribute: null, maxCopies: 1 },
    { category: 'ring', attribute: null, maxCopies: 2 },
    { category: 'necklace', attribute: null, maxCopies: 1 },
    { category: 'weapon2', attribute: buildAttribute, maxCopies: 1 },
  ];
  for (const { category, attribute, maxCopies } of priority) {
    const godItem = GOD_ITEMS.find((it) => it.category === category && it.attribute === attribute);
    if (!godItem) continue;
    let owned = state.inventory.filter((e) => e.itemId === godItem.id).length;
    const shopId = `awk_${godItem.id}`;
    while (owned < maxCopies && canBuyAwakeningItem(state, shopId)) {
      buyAwakeningItem(state, shopId);
      owned += 1;
    }
  }
}

/// Escolhe o atributo de toda peça Tier God sem categoria fixa (armadura/
/// anel/colar, ver needsGodAttributeChoice em systems/godItems.js), rola
/// os 8 bônus sempre escolhendo o melhor dos 3 candidatos (mesmo critério
/// de scoreBonusStat/bestCandidateIndex de cima) e equipa assim que
/// completo (canEquipItem já exige os 8 bônus + Nível >= GOD_MIN_LEVEL).
function progressGodItems(state) {
  const buildAttribute = getBuildAttribute(state) || 'forca';
  for (const entry of state.inventory) {
    const item = getItem(entry.itemId);
    if (!item || !item.isGodTier) continue;
    if (needsGodAttributeChoice(entry, item)) {
      if (canChooseGodAttribute(state, entry.uid)) chooseGodAttribute(state, entry.uid, buildAttribute);
      continue;
    }
    let guard = 0;
    while (canRollGodBonus(state, entry.uid) && guard++ < GOD_BONUS_SLOTS) {
      const pending = rollGodBonusChoice(state, entry.uid);
      if (!pending) break;
      finalizeGodBonus(state, entry.uid, pending, bestCandidateIndex(buildAttribute, pending.candidates));
    }
    if (findEquippedSlotId(state, entry.uid) == null && canEquipItem(state, entry.uid)) {
      equipItem(state, entry.uid);
    }
  }
}

/// Power do slot mais FRACO ocupado por essa categoria (ou -1 se algum dos
/// slots da categoria ainda está vazio — sempre vale a pena preencher).
/// equipItem() sempre preenche um slot vazio antes de sobrescrever, então
/// comparar contra o mínimo é a aproximação certa pra saber se o item novo
/// é mesmo uma melhoria antes de gastar o equip nele.
function weakestEquippedPowerForCategory(state, category) {
  const slotIds = getSlotIdsForCategory(category);
  let weakest = Infinity;
  for (const slotId of slotIds) {
    const uid = state.equipped[slotId];
    if (!uid) return -1;
    const entry = state.inventory.find((i) => i.uid === uid);
    weakest = Math.min(weakest, entry ? computeItemPower(entry) : -1);
  }
  return weakest;
}

/// Só equipa quando o item é de fato uma melhoria de Power no slot certo
/// (compara contra o mais fraco já equipado daquela categoria) — sem isso
/// qualquer drop novo sobrescreveria o equipamento bom por engano
/// (equipItem() não compara nada sozinho, ver systems/equipment.js). O
/// resto — não equipado e não uma melhoria — é lixo: destrói tudo pra
/// nunca lotar o inventário e ainda reverter em material.
///
/// 2 passadas pra manter a build de 1 atributo só (ver getBuildAttribute
/// acima): a 1ª só aceita upgrade de item do MESMO atributo da build atual
/// (nunca deixa um item de fora do atributo substituir um já equipado —
/// pedido explícito do usuário, "focado em 1 único atributo"); a 2ª só
/// preenche categorias ainda vazias (nenhuma peça equipada nelas ainda) com
/// o que sobrar, pra nunca travar o bot com um slot vazio esperando o
/// atributo certo cair. Sem build definida ainda (nenhuma arma equipada),
/// a 1ª passada aceita qualquer atributo — a 1ª arma que o bot pegar decide
/// a build dali pra frente.
function manageInventory(state) {
  const buildAttribute = getBuildAttribute(state);
  // Anel é a ÚNICA categoria com 2 slots físicos (ring1+ring2, ver
  // getSlotIdsForCategory em data/items.js) — e equipItem() sempre
  // sobrescreve ring1 primeiro quando os 2 já estão ocupados (ver
  // systems/equipment.js), então um anel fora da build que caiu em ring2
  // nunca seria alcançado pelas passadas de equip abaixo (só ring1 giraria
  // pra sempre). Libera ele aqui ANTES das passadas — só quando já existe
  // algum anel do atributo certo disponível no inventário, pra nunca ficar
  // com o slot vazio à toa.
  if (buildAttribute) {
    const hasOnBuildRing = state.inventory.some((e) => {
      const it = getItem(e.itemId);
      return it && !it.isGodTier && it.category === 'ring' && it.attribute === buildAttribute && findEquippedSlotId(state, e.uid) == null;
    });
    if (hasOnBuildRing) {
      for (const slotId of ['ring1', 'ring2']) {
        const uid = state.equipped[slotId];
        const entry = uid && state.inventory.find((i) => i.uid === uid);
        const it = entry && getItem(entry.itemId);
        if (it && !it.isGodTier && it.attribute && it.attribute !== buildAttribute) unequipSlot(state, slotId);
      }
    }
  }
  for (const entry of [...state.inventory]) {
    const item = getItem(entry.itemId);
    if (item.isGodTier) continue;
    if (findEquippedSlotId(state, entry.uid) != null) continue;
    if (!canEquipItem(state, entry.uid)) continue;
    if (buildAttribute && item.attribute && item.attribute !== buildAttribute) continue;
    const myPower = computeItemPower(entry);
    if (myPower > weakestEquippedPowerForCategory(state, item.category)) equipItem(state, entry.uid);
  }
  for (const entry of [...state.inventory]) {
    const item = getItem(entry.itemId);
    if (item.isGodTier) continue;
    if (findEquippedSlotId(state, entry.uid) != null) continue;
    if (!canEquipItem(state, entry.uid)) continue;
    if (weakestEquippedPowerForCategory(state, item.category) !== -1) continue;
    equipItem(state, entry.uid);
  }
  for (const entry of [...state.inventory]) {
    if (findEquippedSlotId(state, entry.uid) != null) continue;
    if (canDestroyItem(state, entry.uid)) destroyItem(state, entry.uid);
  }
  // Socket de carta: todo slot vazio recebe a MELHOR carta disponível pra
  // build atual (ver scoreCard acima), não mais a 1ª que aparecer em
  // state.cards — mesmo critério usado pra Ascensão/reroll de bônus.
  const ownedCardIdsByScore = [...new Set(Object.keys(state.cards || {}).filter((id) => (state.cards[id] || 0) > 0))]
    .map((id) => ({ id, card: CARDS.find((c) => c.id === id) }))
    .filter((x) => x.card)
    .sort((a, b) => scoreCard(buildAttribute, b.card) - scoreCard(buildAttribute, a.card))
    .map((x) => x.id);
  for (const uid of Object.values(state.equipped)) {
    if (!uid) continue;
    const entry = state.inventory.find((i) => i.uid === uid);
    if (!entry) continue;
    ensureCardIds(entry).forEach((cardId, slotIndex) => {
      if (cardId) return;
      const ownedCardId = ownedCardIdsByScore.find((id) => canSocketCard(state, uid, slotIndex, id));
      if (ownedCardId) socketCard(state, uid, slotIndex, ownedCardId);
    });
  }
}

function hatchAllEggsAlways(state) {
  let guard = 0;
  while ((state.eggCount || 0) > 0 && state.pets.length < getPetInventoryCap(state) && guard++ < 2000) {
    const [left, right] = rollHatchCandidates(state);
    let chosen = left;
    if (canChooseRightPet(state) && isPetCandidateBetter(right, left)) {
      chosen = right;
      if (!isVipActive(state)) useFreeRightPetChoice(state);
    }
    state.eggCount -= 1;
    const { uid } = addPetToInventory(state, chosen);
    recordPetHatchOutcome(state, chosen.rarityId);
    if (uid && canEquipPet(state, uid)) equipPet(state, uid);
  }
  fuseAllPossiblePets(state);
  // Reequipa o melhor pet livre de cada elemento (pode ter melhorado com fusão).
  for (const pet of state.pets) {
    if (canEquipPet(state, pet.uid)) equipPet(state, pet.uid);
  }
}

/// Prioridade de Baú: Cartas primeiro (pedido explícito do usuário —
/// alimenta o crafting de cartas fortes em manageCards, e "Baú de Cartas"
/// custa OURO, igual "Baú de Mascote", ver CHESTS em data/chests.js) >
/// Mascote > Evento/Premium (moeda própria, não compete pelo mesmo Ouro).
function openChestsUpToLimit(state) {
  for (const chestId of ['cartas', 'mascote', 'evento', 'premium']) {
    let guard = 0;
    while (canBuyChest(state, chestId) && guard++ < 3) openChest(state, chestId);
  }
}

function playCombatePermanente(state, stats) {
  if (!canEnterArena(state)) return;
  startArenaRun(state);
  const effectiveDps = stats.dps * (stats.attackSpeedPerSec || 1);
  applyArenaDamage(state, effectiveDps * 30);
  endArenaRun(state);
}

function playExpedition(state) {
  if (!canEnterExpedition(state)) return;
  enterExpedition(state, '8h');
}

function playDailyMission(state) {
  ensureDailyMissionsFresh(state);
  if (getActiveMissionSlotIndex(state) === -1) {
    const idx = (state.dailyMissions?.slots || []).findIndex((s) => s.status === 'idle');
    if (idx !== -1 && canSelectMission(state, idx)) selectMission(state, idx);
  }
  (state.dailyMissions?.slots || []).forEach((slot, idx) => {
    if (slot.status === 'ready' && canClaimMission(state, idx)) claimDailyMission(state, idx);
  });
}

/// Transcende assim que possível (Experiente agressivo — cada Transcender
/// dá bônus permanente de XP/HP/DPS, compensa reiniciar). Pedido explícito
/// do usuário: assim que transcender, já compra um item Tier God pra
/// começar a remontar a build (Transcender reseta equipamento normal, mas
/// não Fragmento do Despertar nem itens Tier God já comprados antes, ver
/// PRESERVED_KEYS em systems/awakening.js) — usa o atributo de ANTES de
/// transcender, já que o state novo ainda não tem arma nenhuma equipada.
function maybeTranscend(state) {
  if (!canTranscend(state)) return state;
  const previousBuildAttribute = getBuildAttribute(state);
  const fresh = transcend(state);
  if (previousBuildAttribute) fresh.botBuildAttribute = previousBuildAttribute;
  buyAvailableGodItems(fresh, previousBuildAttribute);
  return fresh;
}

/// Avança 1 "dia" de jogo pra 1 bot — chamado 1x por execução diária (ver
/// run.mjs). `elapsedMsOverride` (opcional, só pra teste local) força o
/// tempo "offline" simulado em vez de usar o relógio real.
// Um Experiente de verdade abre o jogo várias vezes ao longo do dia (não
// só 1x) — cada "abertura" só conta progresso até o teto de recompensa
// offline (ver getMaxOfflineSeconds em systems/offline.js, ~6h com VIP),
// então rodar computeOfflineProgress só 1x por dia jogado desperdiçaria a
// maior parte das ~24h reais entre execuções. CHECK_INS_PER_DAY simula
// esses vários acessos, cada um batendo o teto por conta própria.
const CHECK_INS_PER_DAY = 4;

export function runOneDay(state, elapsedMsOverride = null) {
  const totalElapsedMs = elapsedMsOverride != null ? elapsedMsOverride : (Date.now() - (state.lastSaveTime || Date.now()));

  playDailyMission(state);
  claimReadyAchievements(state);
  buyVipAsapAndAscendPriorities(state);
  refreshMonsterSelection(state, computePlayerStats(state));

  let remaining = totalElapsedMs;
  for (let i = 0; i < CHECK_INS_PER_DAY && remaining > 0; i++) {
    const chunk = Math.floor(remaining / (CHECK_INS_PER_DAY - i));
    remaining -= chunk;
    state.lastSaveTime = Date.now() - chunk;
    const progress = computeOfflineProgress(state);
    if (progress) applyOfflineProgress(state, progress);
    state.lastSaveTime = Date.now();
  }

  manageInventory(state);
  upgradeEquippedItems(state);
  manageCards(state);
  buyAvailableGodItems(state);
  progressGodItems(state);
  hatchAllEggsAlways(state);
  openChestsUpToLimit(state);
  playExpedition(state);

  let stats = computePlayerStats(state);
  playCombatePermanente(state, stats);

  // Mais conquistas provavelmente desbloquearam durante o dia (nível/ouro/
  // kills subiram) — resgata de novo e tenta o VIP com a Esmeralda nova.
  claimReadyAchievements(state);
  buyVipAsapAndAscendPriorities(state);

  state = maybeTranscend(state);

  // Recalcula depois de tudo (Transcender pode ter mudado o state inteiro).
  stats = computePlayerStats(state);
  refreshMonsterSelection(state, stats);
  const power = computePlayerPower(state);

  return { state, stats, power };
}
