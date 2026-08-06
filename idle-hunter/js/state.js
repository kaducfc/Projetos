import { getCard } from './data/cards.js';
import { ZONES } from './data/monsters.js';

// Bumped from v3: item baseStats/additionalStats schema changed
// incompatibly (base attribute agora é um valor cru só, e o pool de
// atributos bônus foi reformulado do zero) — itens antigos de um save v3
// não têm as chaves novas e mostrariam 0 no atributo base. Mesmo "start
// fresh under a new key" call das duas bumps anteriores.
const SAVE_KEY = 'idleHunterSave.v4';

// Versão do FORMATO da árvore de habilidades (ver skillTree.treeVersion
// acima) — v1 era 5 etapas de 3 linhas cada; v2 é 6 etapas de 7 linhas
// cada. Um id "stageIndex_rowIndex_colIndex" salvo na v1 aponta pra um stat
// diferente na v2 (a conta de linha global mudou), então loadState() reseta
// purchased/specials de qualquer save que não esteja nessa versão, em vez
// de deixar o jogador com pontos investidos silenciosamente realocados pra
// outro stat.
export const SKILL_TREE_VERSION = 2;

// Duração de cada compra de VIP na loja (ver data/shop.js cash_vip,
// systems/shop.js buyCashItem) — 30 dias corridos, empilhável.
export const VIP_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/// Única fonte de verdade pra "o VIP está ativo agora" — nunca ler
/// state.vipExpiresAt cru fora daqui, pra não esquecer o `> now` em algum
/// lugar. now é parâmetro (não Date.now() interno) só pra facilitar teste
/// determinístico; todo chamador real usa o default.
export function isVipActive(state, now = Date.now()) {
  return !!(state.vipExpiresAt && state.vipExpiresAt > now);
}

export function createDefaultState() {
  return {
    gold: 0,

    // Nível/XP de caça (ver systems/leveling.js): só libera zonas/chefes por
    // enquanto (ver ZONES[].zoneUnlockLevel/bossUnlockLevel em
    // data/monsters.js), sem bônus de atributo.
    hunterLevel: 1,
    hunterXp: 0,

    // Até 4 monstros escolhidos pra caçar (qualquer zona liberada, podendo
    // misturar zonas) — só esses aparecem na Caça. Um novo jogador começa
    // com o primeiro monstro fraco da Zona 1 pré-selecionado, pra não cair
    // numa tela vazia. Ver systems/combat.js ensureMonsterSpawned.
    selectedMonsters: [
      { zoneIndex: 0, kind: 'weak', monsterId: ZONES[0].weakMonsters[0].id },
    ],
    // Qual dos selectedMonsters está ativo agora (sorteado uniformemente a
    // cada respawn — ver ensureMonsterSpawned) — { zoneIndex, kind, monsterId }.
    currentMonster: null,
    monsterHp: null, // HP restante do monstro atual; null = precisa (re)spawnar
    // Cópia do último monstro morto, só pra UI continuar mostrando ele (HP
    // zerado) durante a pausa de respawn em vez de cair na tela de "?" — ver
    // applyDamage em systems/combat.js. Não participa de nenhum cálculo de
    // combate.
    lastMonsterRef: null,

    materials: {}, // materialId -> count (agora só alimenta o enhance/Master, não craft)
    cards: {}, // cardId -> count (see data/cards.js)
    // Cartas tab collection tracking (see systems/cards.js): cardsDiscovered
    // marks a card as "ever obtained" forever, even after its count in
    // `cards` above drops back to 0 (e.g. once socketed into gear).
    // cardsRewardClaimed blocks re-claiming that card's one-time Cash bonus.
    cardsDiscovered: {}, // cardId -> true
    cardsRewardClaimed: {}, // cardId -> true
    // { uid, itemId, rarityId, baseStats, additionalStats, enhanceLevel,
    //   isMaster, cardIds } — ver data/items.js rollDroppedItem().
    inventory: [],
    nextUid: 1,
    // 10 slots físicos (ver data/items.js SLOTS) — uid or null. ring1/ring2
    // são independentes mas aceitam a mesma categoria de item (ver
    // getSlotIdsForCategory/equipItem).
    equipped: {
      weapon1: null, weapon2: null,
      head: null, chest: null, legs: null, hands: null, boots: null,
      ring1: null, ring2: null,
      necklace: null,
    },
    upgrades: {}, // upgradeId -> level
    totalKills: 0,
    lastSaveTime: Date.now(),

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

    // Mina de Ouro (see data/events.js + systems/goldmine.js): a single
    // fixed Gold Boss fought on its own short 35s clock, entered once per
    // GOLDMINE_ACTIVE_MS window. goldMineEnteredCycle blocks a second entry
    // within that same window; goldMineRunActive/goldMineBossHp/
    // goldMineDamageDealt are the persisted run state so an in-progress
    // fight survives a reload. The run's own 35s clock is intentionally
    // NOT persisted (see main.js) — same "a reload gives a fresh attempt
    // clock" trade-off already made for the boss timer/Torre/Caça
    // Aprimorada attempts.
    goldMineRunActive: false,
    goldMineBossHp: 0,
    goldMineDamageDealt: 0,
    goldMineEnteredCycle: null,

    // Expedição do Caçador (see data/events.js EXPEDITION_TIERS + systems/
    // expedition.js): sem luta — Entrar concede a recompensa na hora e arma
    // expeditionReadyAt (now + duração escolhida), um cooldown ÚNICO
    // compartilhado entre as 3 durações (1h/4h/8h), não uma janela por
    // ciclo como os outros eventos acima. expeditionLastTierId só guarda
    // qual duração foi escolhida da última vez, pra UI informativa (não
    // afeta o cooldown em si, que já está todo em expeditionReadyAt).
    expeditionReadyAt: null,
    expeditionLastTierId: null,

    // Combate Permanente (see data/arena.js + systems/arena.js): um saco de
    // pancada de 30s que nunca revida — o dano total causado decide o Rank
    // final ao fechar (ver endArenaRun). Sem janela por ciclo nem cooldown,
    // só não dá pra ter 2 combates rodando ao mesmo tempo (ver
    // canEnterArena). O clock de 30s em si NÃO é persistido (mesmo trade-off
    // já feito pra Torre/Mina — ver main.js), só o progresso acumulado.
    arenaRunActive: false,
    arenaDamageDealt: 0,

    // Mascotes (ver data/pets.js + systems/pets.js): { uid, speciesId,
    // rarityId, level } — inventário próprio, não aparece na aba
    // Equipamentos. equippedPetUids tem sempre 4 posições (slot vazio =
    // null); a cada hit o jogo escolhe automaticamente o melhor pet
    // equipado contra o monstro atual (ver getBestEquippedPet).
    pets: [],
    nextPetUid: 1,
    equippedPetUids: [null, null, null, null],
    eggCount: 0,
    // Recurso simples (só um contador, sem uso ainda) recebido quando um
    // pet é descartado automaticamente por o inventário estar cheio — ver
    // addPetToInventory em systems/pets.js.
    petFragments: 0,
    // Pity de raridade ao chocar (ver MYTHIC_PITY_THRESHOLD/
    // LEGENDARY_PITY_THRESHOLD em systems/pets.js): quantos ovos foram
    // chocados desde o último Mítico/Lendário obtido — cada contador é
    // independente (só reseta ao chocar EXATAMENTE aquela raridade) e
    // conta até garantir a raridade correspondente no próximo choco.
    petHatchesSinceMythic: 0,
    petHatchesSinceLegendary: 0,
    // Sistema VIP — por tempo, não permanente (ver isVipActive/
    // VIP_DURATION_MS abaixo): cada compra na loja de Cash (data/shop.js
    // cash_vip, systems/shop.js buyCashItem) soma mais VIP_DURATION_MS a
    // vipExpiresAt, empilhando em cima do tempo que já restava se a compra
    // acontecer enquanto o VIP ainda está ativo. null = nunca comprou/já
    // expirou. Enquanto ativo: escolha livre entre os 2 pets ao chocar um
    // ovo, +50 de capacidade nos inventários de equipamentos e de mascotes
    // (100 → 150, ver data/items.js getItemInventoryCap / data/pets.js
    // getPetInventoryCap), e a única forma de usar "Chocar Todos" (ver
    // canHatchAllEggs em systems/pets.js). freeRightPetChoiceCycle guarda o
    // último ciclo diário (ver systems/pets.js currentDailyCycle) em que um
    // jogador não-VIP já usou a escolha grátis do pet da direita.
    vipExpiresAt: null,
    freeRightPetChoiceCycle: null,

    // Árvore de habilidades passivas ÚNICA (ver data/skills.js + systems/
    // skills.js — antes eram 3 árvores por classe, agora uma só): 1 ponto
    // por nível de caça, nunca guardado à parte — é sempre derivado de
    // hunterLevel menos o total gasto aqui, então não tem como duplicar
    // bônus num reload. purchased: skillId -> nível comprado. specials:
    // stageIndex -> id da opção especial escolhida (só 1 por etapa).
    // treeVersion identifica o FORMATO da árvore (não o conteúdo/valores) —
    // bump necessário sempre que a forma stageIndex_rowIndex_colIndex mudar
    // de significado (ver SKILL_TREE_VERSION/loadState abaixo), pra saves
    // antigos resetarem em vez de ficar com pontos investidos em stats
    // trocados silenciosamente.
    skillTree: {
      purchased: {},
      specials: {},
      treeVersion: SKILL_TREE_VERSION,
    },
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
    // A monster/boss roster replacement (see data/cards.js) can leave an old
    // save's socketed card pointing at a card that no longer exists.
    // Rendering already falls back gracefully for this (see cardSlotHtml in
    // ui/render.js), but leaving it set would permanently block re-socketing
    // that slot (canSocketCard requires an empty slot) — clear it here
    // instead, once, so the slot is usable again.
    for (const entry of state.inventory) {
      entry.cardIds = (entry.cardIds || []).map((id) => (id && !getCard(id) ? null : id));
    }
    // A árvore de habilidades era 3 árvores por classe (state.skillTree.
    // classId marcava qual) e virou uma árvore única sem classe — os ids
    // salvos em purchased/specials de um save antigo (ex: "arqueiro_0_0_0")
    // não existem mais na árvore nova. Sem essa limpeza eles ficariam
    // "presos" contando como pontos gastos pra sempre (ver
    // getSpentSkillPoints em systems/skills.js), sem dar bônus nenhum —
    // reseta pra árvore nova em branco (os pontos, sempre derivados do
    // hunterLevel, continuam intactos pra redistribuir).
    if ('classId' in (state.skillTree || {}) || (state.skillTree?.treeVersion || 1) < SKILL_TREE_VERSION) {
      state.skillTree = { purchased: {}, specials: {}, treeVersion: SKILL_TREE_VERSION };
    }
    // VIP era um boolean permanente (state.vip) antes de virar por tempo
    // (state.vipExpiresAt, ver isVipActive acima) — um save antigo que já
    // tinha comprado nessa breve janela vira 30 dias a partir de agora em
    // vez de simplesmente perder o VIP que pagou. `delete` pra não deixar
    // o campo morto boiando no save daqui pra frente.
    if (parsed.vip === true && !state.vipExpiresAt) {
      state.vipExpiresAt = Date.now() + VIP_DURATION_MS;
    }
    delete state.vip;
    return state;
  } catch (err) {
    console.warn('Falha ao carregar o save, começando um jogo novo:', err);
    return null;
  }
}

export function hardResetState() {
  localStorage.removeItem(SAVE_KEY);
}
