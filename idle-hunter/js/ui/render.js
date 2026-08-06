import { BOSSES, findMaterialInfo, ZONES } from '../data/monsters.js';
import {
  getSlot, getItem, getEnhanceLabel, getRarity, getAttribute, getCategoryLabel,
  getAscensionCost, getDamageType, ENHANCE_MAX_LEVEL, enhancementMultiplier,
  DROP_CATEGORIES, getItemInventoryCap, getWeaponArchetypeName, RARITIES,
} from '../data/items.js';
import { getElement, elementDamageModifier, ELEMENT_RESISTANCE_PER_PIECE } from '../data/elements.js';
import { formatNumber, formatPercent } from '../format.js';
import { getEquippedEntry, findEquippedSlotId, canEquipItem } from '../systems/equipment.js';
import { computePlayerStats } from '../systems/stats.js';
import { canEnhance, canUpgradeToMaster, canAscendItem, ensureCardIds } from '../systems/crafting.js';
import { isZoneUnlocked, isBossUnlocked, xpToNextLevel, HUNTER_MAX_LEVEL } from '../systems/leveling.js';
import {
  getEventWindow, getTowerWindow, TOWER_MAX_LEVEL, getGoldMineWindow, GOLDMINE_BOSS_HP,
  EXPEDITION_TIERS, EXPEDITION_REWARDS,
} from '../data/events.js';
import { isEventClaimed, computeEventBossMaxHp } from '../systems/events.js';
import { getTowerMonster } from '../systems/tower.js';
import { canEnterExpedition, expeditionRemainingMs } from '../systems/expedition.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { isAchievementClaimed, isAchievementReady } from '../systems/achievements.js';
import { CASH_SHOP_ITEMS, CASH_REAL_MONEY_PACKAGES, AD_WATCH_CASH_REWARD, eventShopItemsForBoss } from '../data/shop.js';
import { canBuyCashItem, canBuyEventItem, adWatchCooldownRemaining } from '../systems/shop.js';
import {
  CARDS, getCard, CARD_DISCOVERY_CASH_REWARD,
  CARD_FRAGMENT_ID, CARD_FRAGMENT_NAME,
  getCardRecycleValue, getCardCraftCost,
} from '../data/cards.js';
import {
  isCardDiscovered, canClaimCardReward, isCardRewardClaimed,
  canRecycleCard, canCraftCard,
} from '../systems/cards.js';
import {
  getPetSpecies, getPetDamage, getPetRecycleValue, getPetElementColor, getPetDpsBonusPercent, PET_MAX_LEVEL,
  getPetInventoryCap, PET_ELEMENTS, xpToNextPetLevel,
} from '../data/pets.js';
import {
  getPetEntry, getFusePartners, MAX_EQUIPPED_PETS, canChooseRightPet, canHatchAllEggs, canEquipPet,
  MYTHIC_PITY_THRESHOLD, LEGENDARY_PITY_THRESHOLD, canDonatePetFragments, petFragmentsToDonateNow, canRecyclePet,
} from '../systems/pets.js';
import { isVipActive } from '../state.js';
import { getSkillTree, STAT_DISPLAY_NAME, SPECIAL_THRESHOLDS } from '../data/skills.js';
import {
  getTotalSkillPoints, getSpentSkillPoints, getAvailableSkillPoints, getSkillLevel,
  isRowUnlocked, canBuySkillLevel, getChosenSpecialId, canBuySpecial, isStageUnlocked,
} from '../systems/skills.js';

/// Real art if the family has it, emoji fallback otherwise. Sizing is left
/// to the caller: images are set to `width/height: 1em` in CSS so they scale
/// with whatever font-size the surrounding `.icon`-ish element already has.
export function iconMarkup(image, emoji, alt) {
  return image ? `<img src="${image}" alt="${alt || ''}">` : emoji;
}

// Real currency icons (see assets/ui/currency-*.png) used in place of the
// 💰/🎫/💎 emoji anywhere a currency amount shows up — top bar, shop,
// toasts, recipe/upgrade costs, achievement/ad rewards, etc. "Cash" is
// user-facing "Esmeralda" now (see ESMERALDA_ICON), though the underlying
// state field/variable names stay `cash` internally.
export const GOLD_ICON = `<img class="currency-icon" src="assets/ui/currency-gold.png" alt="Ouro">`;
export const EVENT_ICON = `<img class="currency-icon" src="assets/ui/currency-event.png" alt="Moeda de Evento">`;
export const ESMERALDA_ICON = `<img class="currency-icon" src="assets/ui/currency-esmeralda.png" alt="Esmeralda">`;

// Ícone genérico de Carta (qualquer menção a "carta" sem ser a arte
// específica de um monstro — badge de contagem, título de seção, toast de
// socket/unsocket, etc.) e de Fragmento de Carta (ver CARD_FRAGMENT_ID em
// data/cards.js) — substituem os antigos emoji 🃏/🧩 em todo lugar.
export const CARD_ICON = `<img class="currency-icon" src="assets/ui/cards/card_generic.png" alt="Carta">`;
export const CARD_FRAGMENT_ICON = `<img class="currency-icon" src="assets/ui/cards/card_fragment.png" alt="Fragmento de Carta">`;

function elementBadgeHtml(elementId) {
  const el = getElement(elementId);
  return `<img class="element-badge-icon" src="${el.image}" alt="${el.name}" title="${el.name}">`;
}


// Atributo base do item em si (ver data/items.js attributeBaseStats) — é a
// linha de destaque no card do item, na cor própria do atributo (identifica
// o "estilo" sozinho, sem precisar de uma linha separada de atributo/tipo
// de dano). Reusado também pros atributos bônus 'attrOther' (ver
// BONUS_STAT_LABEL abaixo), que dão um dos OUTROS dois atributos.
const ATTRIBUTE_STAT_LABEL = {
  forca: (v) => `<span style="color:${getAttribute('forca').color}; font-weight:800;">+${formatNumber(v)} Força</span>`,
  destreza: (v) => `<span style="color:${getAttribute('destreza').color}; font-weight:800;">+${formatNumber(v)} Destreza</span>`,
  inteligencia: (v) => `<span style="color:${getAttribute('inteligencia').color}; font-weight:800;">+${formatNumber(v)} Inteligência</span>`,
};

// Atributos bônus (ver rollAdditionalStats em data/items.js) — mostrados
// abaixo do atributo base do item, cada um na sua própria linha (ver
// itemDetailStatsHtml). Inclui 'attrSelf' (mesmo atributo do item, pode
// repetir o mesmo valor da base) e 'attrOther' (um dos outros dois
// atributos) — ambos usam as mesmas chaves forca/destreza/inteligencia de
// ATTRIBUTE_STAT_LABEL, por isso o spread abaixo.
const BONUS_STAT_LABEL = {
  ...ATTRIBUTE_STAT_LABEL,
  dpsPercent: (v) => `+${formatPercent(v)} DPS`,
  hpPercent: (v) => `+${formatPercent(v)} Vida`,
  attackSpeedPercent: (v) => `+${formatPercent(v)} Velocidade de Ataque`,
  critChancePercent: (v) => `+${formatPercent(v)} Chance Crítica`,
  critDamagePercent: (v) => `+${formatPercent(v)} Dano Crítico`,
  goldPercent: (v) => `+${formatPercent(v)} Ouro`,
  dropPercent: (v) => `+${formatPercent(v)} Chance de Material`,
  danoFisicoFlat: (v) => `+${formatNumber(v)} Dano Físico`,
  danoMagicoFlat: (v) => `+${formatNumber(v)} Dano Mágico`,
  danoPerfuracaoFlat: (v) => `+${formatNumber(v)} Dano de Perfuração`,
  armorFlat: (v) => `+${formatNumber(v)} Armadura`,
  hpFlat: (v) => `+${formatNumber(v)} Vida`,
  petDamagePercent: (v) => `+${formatPercent(v)} Dano do Mascote`,
  dodgePercent: (v) => `+${formatPercent(v)} Esquiva`,
  lifestealFlat: (v) => `+${formatNumber(v)} Cura por Golpe`,
};

export function renderTopBar(state) {
  document.getElementById('gold-value').textContent = formatNumber(state.gold);
  document.getElementById('cash-value').textContent = formatNumber(state.cash);
  document.getElementById('event-currency-value').textContent = formatNumber(state.eventCurrency);
  document.getElementById('level-value').textContent = state.hunterLevel || 1;
}

/// Nível/XP do caçador — só libera zonas/chefes por enquanto (ver
/// systems/leveling.js), mostrado como uma barra de progresso simples. No
/// nível máximo (HUNTER_MAX_LEVEL), a barra fica cheia e mostra "MÁXIMO"
/// em vez de uma fração de XP que nunca mais vai encher de verdade.
export function renderHunterLevel(state) {
  const level = state.hunterLevel || 1;
  document.getElementById('hunter-level-label').textContent = `Nível de Caça ${level}`;
  if (level >= HUNTER_MAX_LEVEL) {
    document.getElementById('hunter-xp-bar-fill').style.width = '100%';
    document.getElementById('hunter-xp-bar-text').textContent = 'NÍVEL MÁXIMO';
    return;
  }
  const xp = state.hunterXp || 0;
  const next = xpToNextLevel(level);
  const pct = next > 0 ? Math.max(0, Math.min(100, (xp / next) * 100)) : 0;
  document.getElementById('hunter-xp-bar-fill').style.width = `${pct}%`;
  document.getElementById('hunter-xp-bar-text').textContent = `${formatNumber(xp)} / ${formatNumber(next)}`;
}

export function renderCombatStats(stats, monster) {
  document.getElementById('attack-speed-value').textContent = `${stats.attackSpeedPerSec.toFixed(2)}/s`;
  const damageType = getDamageType(stats.activeDamageType);
  document.getElementById('dps-label').textContent = `${damageType.emoji} DPS (${damageType.name})`;
  document.getElementById('dps-value').textContent = formatNumber(stats.dps);
  document.getElementById('armor-value').textContent = formatNumber(stats.armor);
  document.getElementById('crit-chance-value').textContent = formatPercent(stats.critChance);
  document.getElementById('crit-damage-value').textContent = formatPercent(stats.critDamage);

  const weaponEl = document.getElementById('weapon-element-value');
  weaponEl.innerHTML = elementBadgeHtml(stats.weaponElement);

  if (monster) {
    document.getElementById('enemy-dps-value').textContent = formatNumber(monster.dps);
    document.getElementById('enemy-element-value').innerHTML = elementBadgeHtml(monster.element);
  }

  const modEl = document.getElementById('element-matchup');
  if (monster) {
    const mod = elementDamageModifier(stats.weaponElement, monster.element);
    if (mod > 0) {
      modEl.textContent = `⚔️ Vantagem elemental (+${Math.round(mod * 100)}%)`;
      modEl.className = 'advantage';
    } else if (mod < 0) {
      modEl.textContent = `⚠️ Desvantagem elemental (${Math.round(mod * 100)}%)`;
      modEl.className = 'disadvantage';
    } else {
      modEl.textContent = '';
      modEl.className = '';
    }
  }
}

export function renderPlayerHp(current, max) {
  const hp = Math.max(0, current);
  const pct = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  const fill = document.getElementById('player-hp-bar-fill');
  fill.style.width = `${pct}%`;
  fill.classList.toggle('low', pct <= 25);
  document.getElementById('player-hp-bar-text').textContent = `${formatNumber(hp)} / ${formatNumber(max)}`;
}

// Idle-loop sprite animation (see monsters.js's `animFrames` on a boss/weak
// entry). renderMonster() runs every game tick (100ms, see main.js's
// tick()) — rebuilding the sprite's markup every single call would reset any
// running animation right back to frame 0 before it ever visibly advanced.
// So the sprite's innerHTML (and the frame-cycling interval) is only
// (re)built when the monster identity actually changes; same-monster
// re-renders leave the sprite element — and its animation — untouched.
//
// 150ms/frame, plain src swap (no crossfade) is the established standard
// for every monster's idle animation, set once here and shared by all of
// them — tuned and locked in on the Chispim reference (assets/chispim/anim/,
// 4 frames). Don't tune this per-monster; if a future set of frames feels
// off at this speed, the frames themselves (count/similarity) are the
// thing to revisit, not this constant.
const MONSTER_IDLE_FRAME_MS = 150;
let currentMonsterSpriteKey = null;
let monsterIdleAnimTimer = null;

function stopMonsterIdleAnim() {
  if (monsterIdleAnimTimer) {
    clearInterval(monsterIdleAnimTimer);
    monsterIdleAnimTimer = null;
  }
}

function startMonsterIdleAnim(frames) {
  stopMonsterIdleAnim();
  if (!frames || frames.length < 2) return;
  const img = document.querySelector('#monster-sprite img');
  if (!img) return;
  let i = 0;
  monsterIdleAnimTimer = setInterval(() => {
    i = (i + 1) % frames.length;
    img.src = frames[i];
  }, MONSTER_IDLE_FRAME_MS);
}

export function renderMonster(state, monster) {
  if (!monster) return;

  // Cada zona tem 1 cenário de fundo fixo (ver ZONES[].sceneImage em
  // data/monsters.js) — fraco ou chefe da mesma zona mostram o mesmo fundo.
  const zone = ZONES[monster.zoneIndex];
  const monsterArea = document.getElementById('monster-area');
  monsterArea.style.backgroundImage = zone?.sceneImage ? `url('${zone.sceneImage}')` : '';
  monsterArea.style.backgroundPosition = '';

  const spriteKey = monster.bossId || monster.weakMonsterId || monster.name;
  if (spriteKey !== currentMonsterSpriteKey) {
    currentMonsterSpriteKey = spriteKey;
    const sprite = document.getElementById('monster-sprite');
    const initialImage = (monster.animFrames && monster.animFrames[0]) || monster.image;
    sprite.innerHTML = iconMarkup(initialImage, monster.emoji, monster.name);
    startMonsterIdleAnim(monster.animFrames);
    // Per-boss size boost (see monsters.js's `spriteScale`) via font-size
    // — not transform:scale, which would fight the .hit CSS animation
    // (also transform-based) every time it fires and snap back to 1x for
    // the animation's 0.12s duration. Sizing off font-size composes
    // cleanly since #monster-sprite img is already 1em/1em.
    sprite.style.fontSize = monster.spriteScale && monster.spriteScale !== 1
      ? `${92 * monster.spriteScale}px`
      : '';
  }
  document.getElementById('monster-name').innerHTML =
    `${monster.name}${monster.isBoss ? '<span class="boss-tag">CHEFE</span>' : ''} ${elementBadgeHtml(monster.element)}`;

  // state.monsterHp só fica null enquanto esse `monster` é na verdade o
  // último morto, ainda exibido durante a pausa de respawn (ver
  // state.lastMonsterRef/main.js) — nesse caso a barra fica zerada, nunca
  // cheia (um monstro vivo de verdade sempre tem monsterHp numérico, ver
  // ensureMonsterSpawned em systems/combat.js).
  const hp = Math.max(0, state.monsterHp ?? 0);
  const pct = Math.max(0, Math.min(100, (hp / monster.maxHp) * 100));
  document.getElementById('hp-bar-fill').style.width = `${pct}%`;
  document.getElementById('enemy-hp-value').textContent = `${formatNumber(hp)} / ${formatNumber(monster.maxHp)}`;
}

/// Nenhum monstro selecionado ainda (ex: save novo com selectedMonsters
/// esvaziado manualmente) — mostra um convite pra abrir a seleção em vez de
/// uma tela de combate quebrada.
export function renderNoMonsterSelected() {
  document.getElementById('monster-name').textContent = '';
  document.getElementById('hp-bar-fill').style.width = '0%';
  document.getElementById('enemy-hp-value').textContent = '—';
  const sprite = document.getElementById('monster-sprite');
  currentMonsterSpriteKey = null;
  stopMonsterIdleAnim();
  sprite.innerHTML = '❓';
  sprite.style.fontSize = '';
}

// ---------------------------------------------------------------
// Seleção de monstros (estilo IdleArc): até 4, de qualquer zona liberada,
// escolhidos pelo jogador — só esses aparecem sorteados na Caça (ver
// systems/combat.js ensureMonsterSpawned/setSelectedMonsters). pendingSelection
// é o estado de edição (main.js), só vira state.selectedMonsters de fato ao
// confirmar.
// ---------------------------------------------------------------
function monsterChipHtml(zoneIndex, kind, monsterId, name, emoji, image, pendingSelection) {
  const selected = pendingSelection.some((m) => m.zoneIndex === zoneIndex && m.kind === kind && m.monsterId === monsterId);
  return `<button class="monster-select-chip ${selected ? 'selected' : ''} ${kind === 'boss' ? 'boss-chip' : ''}"
    data-select-monster-zone="${zoneIndex}" data-select-monster-kind="${kind}" data-select-monster-id="${monsterId}">
    <span class="icon">${iconMarkup(image, emoji, name)}</span> ${name}
  </button>`;
}

function monsterSelectZoneHtml(state, zone, pendingSelection) {
  if (!isZoneUnlocked(state, zone.index)) {
    return `<div class="monster-select-zone locked">
      <div class="monster-select-zone-title">🔒 ${zone.name} <span class="zone-req">(nível ${zone.zoneUnlockLevel})</span></div>
    </div>`;
  }
  const weakChips = zone.weakMonsters.map((m) => monsterChipHtml(zone.index, 'weak', m.id, m.name, m.emoji, m.image, pendingSelection)).join('');
  const bossChip = isBossUnlocked(state, zone.index)
    ? monsterChipHtml(zone.index, 'boss', zone.boss.id, zone.boss.name, zone.boss.emoji, zone.boss.image, pendingSelection)
    : `<button class="monster-select-chip locked" disabled title="Nível ${zone.bossUnlockLevel} necessário">🔒 ${zone.boss.name}</button>`;
  return `<div class="monster-select-zone">
    <div class="monster-select-zone-title">${zone.name}</div>
    <div class="monster-select-chips">${weakChips}${bossChip}</div>
  </div>`;
}

export function showMonsterSelectModal(state, pendingSelection) {
  const zonesHtml = ZONES.map((zone) => monsterSelectZoneHtml(state, zone, pendingSelection)).join('');
  showModal('🎯 Selecionar Monstros', `
    <p style="font-size:12px;color:var(--text-dim);">Escolha até 4 monstros de qualquer zona liberada — um deles é sorteado aleatoriamente a cada caçada.</p>
    <div class="monster-select-count">Selecionados: <strong>${pendingSelection.length}/4</strong></div>
    <div class="monster-select-list">${zonesHtml}</div>
    <div class="modal-action-row">
      <button class="modal-action-btn" data-confirm-monster-selection>Confirmar</button>
    </div>
  `);
}

/// remainingMs === null hides the timer (not fighting an unconquered boss).
export function renderBossTimer(remainingMs) {
  const el = document.getElementById('boss-timer');
  if (remainingMs == null) {
    el.classList.add('hidden');
    return;
  }
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  el.classList.remove('hidden');
  el.classList.toggle('urgent', seconds <= 10);
  el.textContent = `⏱ ${seconds}s`;
}

// Inventário (paper-doll + owned items) e Forja (craft recipes +
// Materiais) are separate bottom-nav tabs — previously sub-tabs of one
// combined "Equipamento" tab, split apart per the mockups' bottom-nav
// layout (Inventário, Forja, Caçada, Aprimoramento, Cartas, Loja).
// Interactive elements in each are handled by their own delegated listener
// wired once in main.js's init() (wireInventoryTabEvents()/
// wireForgeTabEvents()), since these tabs re-render often (every kill) and
// per-render re-wiring is exactly the bug class that bit this project
// twice before.
/// bulkSelect (opcional) é { active, selectedUids: Set<number>, confirming }
/// — ver seleção em massa (segurar um item por 1s) em main.js
/// wireInventoryTabEvents(). null/omitido = fora do modo de seleção,
/// comportamento normal (clique abre o detalhe do item).
export function renderInventoryTab(state, filterCategory = null, bulkSelect = null) {
  const container = document.getElementById('tab-inventory');
  const banner = `<img class="section-banner-img" src="assets/ui/titles/equipamentos.png" alt="Equipamentos">`;
  container.innerHTML = banner + equipRingContentHtml(state, filterCategory, bulkSelect);
}

function bulkSelectToolbarHtml(bulkSelect) {
  if (!bulkSelect?.active) return '';
  const count = bulkSelect.selectedUids.size;
  const plural = count === 1 ? 'item' : 'itens';
  if (bulkSelect.confirming) {
    return `
      <div class="bulk-select-toolbar">
        <span>Destruir ${count} ${plural} selecionado${count === 1 ? '' : 's'}? (-80% material cada)</span>
        <div class="modal-action-row">
          <button class="modal-action-btn destroy-btn" data-bulk-confirm-destroy>Confirmar destruição</button>
          <button class="modal-action-btn" data-bulk-cancel-confirm>Cancelar</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="bulk-select-toolbar">
      <span>${count} ${plural} selecionado${count === 1 ? '' : 's'}</span>
      <div class="modal-action-row">
        <button class="modal-action-btn" data-bulk-select-all>Selecionar Todos</button>
        <button class="modal-action-btn destroy-btn" data-bulk-destroy-selected ${count < 1 ? 'disabled' : ''}>Destruir selecionados</button>
        <button class="modal-action-btn" data-bulk-exit-select>Sair da seleção</button>
      </div>
    </div>
  `;
}

function categoryFilterRowHtml(filterCategory) {
  const chips = [{ id: null, emoji: '📦', name: 'Todos' }, ...DROP_CATEGORIES.map((category) => ({ id: category, ...getCategoryLabel(category) }))];
  return `<div class="element-filter-row">${chips.map((c) => `
    <button class="element-filter-btn ${filterCategory === c.id ? 'active' : ''}" data-filter-category="${c.id ?? ''}" title="${c.name}">${iconMarkup(c.image, c.emoji, c.name)}</button>
  `).join('')}</div>`;
}

// Paper-doll: a square card with the character art as its background and
// the 10 equip slots overlaid on top of it in 2 columns of 5 — armas +
// cabeça/peito no lado esquerdo, calça/mãos/botas/anéis/colar no direito.
const PAPERDOLL_LEFT = ['head', 'chest', 'hands', 'legs', 'boots'];
const PAPERDOLL_RIGHT = ['weapon1', 'weapon2', 'ring1', 'necklace', 'ring2'];
const PLAYER_PORTRAIT_IMAGE = 'assets/ui/hero-portrait.png';

// Row centers as % of the stats-frame.png height, measured against its
// baked-in divider lines (banner "ESTATÍSTICAS" + 6 rows on a parchment
// scroll) so each stat sits right above its line in the artwork. Os totais
// de Força/Destreza/Inteligência ficam FORA desse frame (ver
// attributeTotalsHtml) — a arte do frame já tem só 6 linhas desenhadas, não
// dá pra espremer mais 3 sem ficar torto.
const STATS_ROW_POSITIONS = [18.2, 30.8, 42.9, 55.0, 67.1, 79.2];

function equipStatsBoxHtml(state) {
  const stats = computePlayerStats(state);
  const damageType = getDamageType(stats.activeDamageType);
  const rows = [
    ['⚡ Velocidade de Ataque', `${stats.attackSpeedPerSec.toFixed(2)}/s`],
    [`${damageType.emoji} DPS (${damageType.name})`, formatNumber(stats.dps)],
    ['🛡️ Armadura', formatNumber(stats.armor)],
    ['🎯 Taxa de Crítico', formatPercent(stats.critChance)],
    ['💢 Dano Crítico', formatPercent(stats.critDamage)],
    ['❤️ Vida Máxima', formatNumber(stats.maxHp)],
  ];
  const rowsHtml = rows
    .map(
      ([label, value], i) => `
        <div class="stats-frame-row" style="top: ${STATS_ROW_POSITIONS[i]}%">
          <span>${label}</span><strong>${value}</strong>
        </div>`
    )
    .join('');
  return `
    <div class="equip-stats-box" style="background-image: url('assets/ui/stats-frame.png')">
      ${rowsHtml}
    </div>
  `;
}

/// Totais de Força/Destreza/Inteligência somados do equipamento atual — ver
/// systems/stats.js (forcaTotal/destrezaTotal/inteligenciaTotal). Cada peça
/// já converte seu atributo direto em stats reais (vida/armadura/dps/
/// velocidade/crítico, ver equipStatsBoxHtml acima); esses números aqui só
/// mostram quanto de cada atributo o build atual está priorizando.
function attributeTotalsHtml(state) {
  const stats = computePlayerStats(state);
  const attrs = [
    ['forca', '💪', stats.forca],
    ['destreza', '🏃', stats.destreza],
    ['inteligencia', '🧠', stats.inteligencia],
  ];
  return `<div class="attribute-totals-row">${attrs.map(([id, emoji, value]) => {
    const attr = getAttribute(id);
    return `<span class="attribute-total" style="color:${attr.color};">${emoji} ${attr.name}: <strong>${formatNumber(value)}</strong></span>`;
  }).join('')}</div>`;
}

function fullStatsRowHtml(label, value) {
  return `<div class="full-stats-row"><span>${label}</span><strong>${value}</strong></div>`;
}

function fullStatsSectionHtml(title, rows) {
  if (!rows.length) return '';
  return `
    <div class="full-stats-section">
      <div class="full-stats-section-title">${title}</div>
      ${rows.map(([label, value]) => fullStatsRowHtml(label, value)).join('')}
    </div>
  `;
}

/// Janela "Ver Estatísticas" (botão abaixo do quadro compacto de 6 linhas,
/// ver equipStatsBoxHtml acima) — TODO atributo que computePlayerStats()
/// calcula, sem exceção, agrupado por categoria e sempre recalculado na
/// hora (nada fica desatualizado, já que só lê o state atual). Golpe Duplo
/// (doubleHitChance) só aparece quando alguma carta socketada de fato o
/// concede (0 = nenhuma carta com esse efeito equipada) — mostrar "0%" pra
/// todo mundo só poluiria a lista.
export function showFullStatsModal(state) {
  const stats = computePlayerStats(state);
  const damageType = getDamageType(stats.activeDamageType);

  const combatRows = [
    [`${damageType.emoji} DPS (${damageType.name})`, formatNumber(stats.dps)],
    ['⚡ Velocidade de Ataque', `${stats.attackSpeedPerSec.toFixed(2)}/s`],
    ['❤️ Vida Máxima', formatNumber(stats.maxHp)],
    ['🛡️ Armadura', formatNumber(stats.armor)],
    ['🎯 Chance Crítica', formatPercent(stats.critChance)],
    ['💢 Dano Crítico', formatPercent(stats.critDamage)],
    ['🌀 Esquiva', formatPercent(stats.dodgeChance)],
    ['💚 Cura por Golpe', formatNumber(stats.lifesteal)],
    ['🌈 Elemento de Ataque', elementBadgeHtml(stats.weaponElement)],
  ];

  const damageRows = [
    [`🗡️ Dano Físico${stats.activeDamageType === 'fisico' ? ' (ativo)' : ''}`, formatNumber(stats.danoFisico)],
    [`🏹 Dano de Perfuração${stats.activeDamageType === 'perfuracao' ? ' (ativo)' : ''}`, formatNumber(stats.danoPerfuracao)],
    [`🔮 Dano Mágico${stats.activeDamageType === 'magico' ? ' (ativo)' : ''}`, formatNumber(stats.danoMagico)],
  ];

  const economyRows = [
    ['💰 Ouro', `+${formatPercent((stats.goldMult - 1) * 100)}`],
    ['📦 Chance de Material', `+${formatPercent((stats.dropMult - 1) * 100)}`],
    ['🐾 Dano do Mascote', `+${formatPercent((stats.petDamageMult - 1) * 100)}`],
  ];

  const attributeRows = [
    [`💪 ${getAttribute('forca').name}`, formatNumber(stats.forca)],
    [`🏃 ${getAttribute('destreza').name}`, formatNumber(stats.destreza)],
    [`🧠 ${getAttribute('inteligencia').name}`, formatNumber(stats.inteligencia)],
  ];

  const specialRows = [];
  if (stats.doubleHitChance > 0) specialRows.push(['👊 Golpe Duplo', formatPercent(stats.doubleHitChance)]);

  showModal('📊 Estatísticas Completas', `
    ${fullStatsSectionHtml('Combate', combatRows)}
    ${fullStatsSectionHtml('Dano por Tipo', damageRows)}
    ${fullStatsSectionHtml('Economia', economyRows)}
    ${fullStatsSectionHtml('Atributos', attributeRows)}
    ${fullStatsSectionHtml('Especiais de Carta', specialRows)}
  `);
}

function equipRingContentHtml(state, filterCategory = null, bulkSelect = null) {
  const filtered = filterCategory
    ? state.inventory.filter((entry) => getItem(entry.itemId)?.category === filterCategory)
    : state.inventory;
  const inventoryHtml = filtered.length
    ? filtered.map((entry) => inventoryTileHtml(state, entry, bulkSelect)).join('')
    : state.inventory.length
      ? `<p class="empty-slot">Nenhum item desse tipo.</p>`
      : `<p class="empty-slot">Nenhum item ainda. Derrote monstros na Caça para conseguir equipamentos.</p>`;

  const portraitStyle = PLAYER_PORTRAIT_IMAGE ? `style="background-image: url('${PLAYER_PORTRAIT_IMAGE}')"` : '';

  return `
    <div class="equip-screen">
      <div class="equip-top-row">
        <div class="paperdoll-card" ${portraitStyle}>
          ${PLAYER_PORTRAIT_IMAGE ? '' : '<div class="paperdoll-placeholder">🧑‍🚀</div>'}
          <div class="paperdoll-overlay-col paperdoll-overlay-left">${PAPERDOLL_LEFT.map((id) => slotIconHtml(state, getSlot(id))).join('')}</div>
          <div class="paperdoll-overlay-col paperdoll-overlay-right">${PAPERDOLL_RIGHT.map((id) => slotIconHtml(state, getSlot(id))).join('')}</div>
        </div>
        ${equipStatsBoxHtml(state)}
      </div>
      <div class="view-full-stats-row">
        <button class="view-full-stats-btn" data-view-full-stats>📊 Ver Estatísticas</button>
      </div>
      ${attributeTotalsHtml(state)}
      <div class="equip-inventory-header-row">
        <div class="equip-inventory-header">Inventário (${state.inventory.length}/${getItemInventoryCap(state)})</div>
        ${bulkSelect?.active ? '' : '<button class="bulk-select-toggle-btn" data-bulk-toggle-select>☑️ Selecionar</button>'}
      </div>
      ${categoryFilterRowHtml(filterCategory)}
      ${bulkSelectToolbarHtml(bulkSelect)}
      <div class="equip-inventory-grid">${inventoryHtml}</div>
    </div>
  `;
}

// Small "N cards socketed" badge, bottom-left of an equipment icon — see
// .card-count-badge in style.css. Mirrors .mini-badge's enhance-level
// badge (bottom-right) but only shows once at least one card is socketed.
function cardCountBadgeHtml(entry) {
  const count = ensureCardIds(entry).filter(Boolean).length;
  return count > 0 ? `<span class="card-count-badge">${CARD_ICON} ${count}</span>` : '';
}

function slotIconHtml(state, slot) {
  const equipped = getEquippedEntry(state, slot.id);
  const icon = equipped
    ? iconMarkup(equipped.item.image, equipped.item.emoji, equipped.item.name)
    : iconMarkup(slot.emptyIcon, slot.emoji, slot.name);
  const badge = equipped
    ? `<span class="mini-badge ${equipped.entry.isMaster ? 'master' : ''}">${getEnhanceLabel(equipped.entry.enhanceLevel, equipped.entry.isMaster)}</span>`
    : '';
  const rarity = equipped ? getRarity(equipped.entry.rarityId) : null;
  const rarityClass = rarity ? ' has-rarity' : '';
  const rarityStyle = rarity ? ` style="--rarity-color:${rarity.color};"` : '';
  return `<button class="equip-slot-icon ${equipped ? 'filled' : 'empty'}${rarityClass}" data-equip-slot="${slot.id}" title="${slot.name}"${rarityStyle}>

    <span class="icon">${icon}</span>
    ${badge}
    ${equipped ? cardCountBadgeHtml(equipped.entry) : ''}
  </button>`;
}

function inventoryTileHtml(state, entry, bulkSelect = null) {
  const item = getItem(entry.itemId);
  const isEquipped = findEquippedSlotId(state, entry.uid) != null;
  const label = getEnhanceLabel(entry.enhanceLevel, entry.isMaster);
  const rarity = getRarity(entry.rarityId);
  const isSelected = !!bulkSelect?.active && bulkSelect.selectedUids.has(entry.uid);
  // No modo de seleção em massa, itens equipados ficam escurecidos e fora
  // de seleção — destruir em massa é pra descartar sucata, não pra pegar
  // sem querer algo que já está no personagem (destruir um equipado
  // continua possível pelo popup de detalhe individual, que já desequipa
  // sozinho, ver destroyItem em systems/crafting.js).
  const bulkLocked = !!bulkSelect?.active && isEquipped;
  const title = bulkLocked ? `${item.name} (equipado — desequipe antes de selecionar)` : item.name;
  return `<button class="inventory-tile has-rarity ${isEquipped ? 'equipped' : ''} ${isSelected ? 'bulk-selected' : ''} ${bulkLocked ? 'bulk-locked' : ''}" style="--rarity-color:${rarity.color};" data-equip-item="${entry.uid}" title="${title}" ${bulkLocked ? 'disabled' : ''}>
    <span class="icon">${iconMarkup(item.image, item.emoji, item.name)}</span>
    <span class="mini-badge ${entry.isMaster ? 'master' : ''}">${label}</span>
    ${cardCountBadgeHtml(entry)}
    ${bulkSelect?.active && !bulkLocked ? `<span class="bulk-select-check">${isSelected ? '✅' : '⬜'}</span>` : ''}
  </button>`;
}

/// Opens the detail popup for whatever is (or isn't) equipped in a slot.
export function showEquipSlotModal(state, slotId) {
  const slot = getSlot(slotId);
  const uid = state.equipped[slotId];
  if (uid) {
    // Sem título — mesmo padrão do showItemDetailModal (o nome do item já
    // aparece embaixo do ícone, não precisa repetir aqui em cima).
    showModal('', itemDetailHtml(state, uid, false));
  } else {
    showModal(`${slot.emoji} ${slot.name}`, `
      <div class="item-detail">
        <div class="item-detail-icon">${slot.emoji}</div>
        <p style="color:var(--text-dim); font-size:12.5px;">Nenhum item equipado neste slot ainda. Derrote monstros para conseguir um.</p>
      </div>
    `);
  }
}

/// Opens the detail popup for a specific inventory item (equipped or not).
/// pickerOpenSlot controls whether a card-picker sub-panel starts expanded
/// for that specific slot index (only set right after the player clicks
/// "Equipar Carta" on that slot — see main.js); null means every slot is
/// closed.
export function showItemDetailModal(state, uid, pickerOpenSlot = null, confirmDestroy = false) {
  const entry = state.inventory.find((i) => i.uid === uid);
  if (!entry) return;
  // Sem título — o nome do item já aparece uma vez, embaixo do ícone (ver
  // item-detail-name em itemDetailHtml), não precisa repetir aqui em cima.
  showModal('', itemDetailHtml(state, uid, pickerOpenSlot, confirmDestroy));
}

/// Linha do atributo base do item (FIXA — só muda pelo tier/zona do item,
/// nunca por raridade/enhance, ver rollBaseStatsFromTemplate/
/// getEnhancedStats em data/items.js) + a linha do 2º adicional base (dano
/// pra arma, vida pra armadura, armadura pra anel/colar — ver
/// secondaryStatKeyForCategory em data/items.js), essa sim escalada pelo
/// enhance, seguidas de uma linha por atributo bônus rolado (ver
/// rollAdditionalStats em data/items.js) — inclusive quando o bônus é o
/// MESMO atributo do item ('attrSelf') ou um dos outros dois ('attrOther'):
/// sempre no mesmo valor fixo da base, mas numa linha separada (soma, não
/// funde). Itens de um save antigo (rolados antes do 2º adicional existir)
/// simplesmente não têm essa chave em baseStats — secondaryLine fica
/// vazia, sem quebrar.
function itemDetailStatsHtml(item, entry) {
  const mult = enhancementMultiplier(entry.enhanceLevel || 0, !!entry.isMaster);
  const baseValue = entry.baseStats?.[item.attribute] || 0;
  const baseLine = ATTRIBUTE_STAT_LABEL[item.attribute](baseValue);

  const secondaryKey = Object.keys(entry.baseStats || {}).find((key) => key !== item.attribute);
  const secondaryValue = secondaryKey ? Math.round((entry.baseStats[secondaryKey] || 0) * mult) : 0;
  const secondaryLine = secondaryKey && BONUS_STAT_LABEL[secondaryKey]
    ? `<strong>${BONUS_STAT_LABEL[secondaryKey](secondaryValue)}</strong>` : null;

  const bonusLines = (entry.additionalStats || [])
    .map((add) => (BONUS_STAT_LABEL[add.stat] ? BONUS_STAT_LABEL[add.stat](add.value) : null))
    .filter(Boolean);
  return [baseLine, secondaryLine, ...bonusLines].filter(Boolean).join('<br>');
}

function itemDetailHtml(state, uid, pickerOpenSlot, confirmDestroy = false) {
  const entry = state.inventory.find((i) => i.uid === uid);
  const item = getItem(entry.itemId);
  const categoryLabel = getCategoryLabel(item.category);
  const label = getEnhanceLabel(entry.enhanceLevel, entry.isMaster);
  const rarity = getRarity(entry.rarityId);
  const equippedSlotId = findEquippedSlotId(state, uid);
  const isEquipped = equippedSlotId != null;

  const resistanceLine = categoryLabel.kind === 'armor'
    ? `<div class="element-resistance">${elementBadgeHtml(item.element)} +${Math.round(ELEMENT_RESISTANCE_PER_PIECE * 100)}% resistência</div>`
    : `<div class="element-resistance">${elementBadgeHtml(item.element)} elemento de ataque</div>`;

  // Aljava/Livro/Escudo (weapon2) só equipam junto da arma primária do
  // mesmo atributo (Arco/Cajado/Espada, ver canEquipItem em
  // systems/equipment.js) — mostra o motivo em vez de só desabilitar o
  // botão sem explicação.
  const weaponRequirementNote = (!isEquipped && item.category === 'weapon2' && !canEquipItem(state, uid))
    ? `<p class="weapon-requirement-note">⚠️ Equipe primeiro ${getWeaponArchetypeName('weapon1', item.attribute)} (mesmo atributo) na arma primária.</p>`
    : '';

  const actionBtn = isEquipped
    ? `<button class="modal-action-btn" data-modal-unequip="${equippedSlotId}">Desequipar</button>`
    : `<button class="modal-action-btn" data-modal-equip="${uid}" ${canEquipItem(state, uid) ? '' : 'disabled'}>Equipar</button>`;

  const cardSlotsHtml = ensureCardIds(entry)
    .map((cardId, slotIndex) => cardSlotHtml(state, uid, entry, pickerOpenSlot === slotIndex, slotIndex))
    .join('');

  return `
    <div class="item-detail">
      <div class="item-detail-tier-badge">Tier ${item.zoneIndex + 1}</div>
      <div class="item-detail-icon item-detail-icon-lg" style="filter: drop-shadow(0 0 10px ${rarity.color});">${iconMarkup(item.image, item.emoji, item.name)}</div>
      <div class="item-detail-name">${item.name} <span class="enhance-badge ${entry.isMaster ? 'master' : ''}">${label}</span></div>
      <div class="item-detail-rarity" style="color:${rarity.color}; font-weight:800; font-size:12px;">${rarity.name}</div>
      <div class="item-detail-stats">${itemDetailStatsHtml(item, entry)}</div>
      ${resistanceLine}
      ${weaponRequirementNote}
      ${cardSlotsHtml}
      ${enhancePanelHtml(state, uid, entry, item)}
      <div class="modal-action-row">
        ${actionBtn}
        ${confirmDestroy
          ? `<button class="modal-action-btn destroy-btn" data-confirm-destroy-uid="${uid}">Confirmar destruição</button>
             <button class="modal-action-btn" data-cancel-destroy-uid="${uid}">Cancelar</button>`
          : `<button class="modal-action-btn destroy-btn" data-destroy-uid="${uid}">Destruir (-80% material)</button>`}
      </div>
    </div>
  `;
}

// A card is consumed from state.cards (a stackable count, like a material)
// the moment it's socketed. Cards themselves have no slotId restriction: any
// card can go in any item's slot. Every item comes with 1 card slot already
// unlocked from the moment it's crafted; Rank Master grants a 2nd (see
// maxCardSlots/ensureCardIds in systems/crafting.js) — there's no more RNG
// unlock step. Each slot (identified by slotIndex) is either:
//   1. empty — either closed (a button to open the picker) or with the
//      picker expanded (pickerOpen), listing every owned card
//   2. filled — the socketed card, with a Remover button
function cardSlotHtml(state, uid, entry, pickerOpen, slotIndex) {
  const cardId = entry.cardIds[slotIndex];

  // getCard() can miss for an old save's cardId (the roster that generates
  // CARDS was replaced — see data/cards.js) — fall through to the normal
  // empty-slot display below rather than crash on a stale reference.
  if (cardId && getCard(cardId)) {
    const card = getCard(cardId);
    return `<div class="card-slot-badge filled">
      <span class="icon">${iconMarkup(card.image, card.emoji, card.name)}</span>
      <div class="card-slot-info">
        <div class="card-slot-name">${card.name}</div>
        <div class="card-slot-desc">${card.description}</div>
      </div>
      <button class="card-slot-remove" data-unsocket-uid="${uid}" data-unsocket-slot="${slotIndex}">Remover</button>
    </div>`;
  }

  if (!pickerOpen) {
    return `<div class="card-slot-badge">
      <span class="icon">${CARD_ICON}</span>
      <div class="card-slot-info"><div class="card-slot-name">Slot de Carta: vazio</div></div>
      <button class="card-slot-equip-btn" data-open-card-picker="${uid}" data-open-card-picker-slot="${slotIndex}">Equipar Carta</button>
    </div>`;
  }

  const owned = CARDS.filter((c) => (state.cards[c.id] || 0) > 0);
  if (!owned.length) {
    return `<div class="card-slot-picker">
      <div class="card-slot-label">${CARD_ICON} Você ainda não tem nenhuma carta. Derrote monstros para conseguir uma.</div>
    </div>`;
  }

  return `<div class="card-slot-picker">
    <div class="card-slot-label">${CARD_ICON} Escolha uma carta:</div>
    <div class="card-slot-options">${owned.map((c) => `
      <button class="card-slot-option" data-socket-uid="${uid}" data-socket-slot="${slotIndex}" data-socket-card-id="${c.id}" title="${c.description}">
        <span class="icon">${iconMarkup(c.image, c.emoji, c.name)}</span> ${c.name} <span class="qty">×${state.cards[c.id]}</span>
      </button>
    `).join('')}</div>
  </div>`;
}

function enhancePanelHtml(state, uid, entry, item) {
  if (entry.isMaster) {
    const cost = getAscensionCost(item, entry.rarityId);
    if (!cost) {
      return `<div class="enhance-maxed">✨ Rank Master alcançado (Raridade máxima)</div>`;
    }
    const nextRarity = getRarity(cost.nextRarityId);
    const haveCrystal = state.materials[cost.crystalMaterialId] || 0;
    const crystalInfo = findMaterialInfo(cost.crystalMaterialId);
    const matInfo = findMaterialInfo(cost.matId);
    const haveMat = state.materials[cost.matId] || 0;
    const matMet = haveMat >= cost.qty;
    return `<div class="enhance-panel">
      <div class="enhance-maxed">✨ Rank Master alcançado</div>
      <div class="recipe-cost"><span><span class="icon">${iconMarkup(matInfo.image, matInfo.emoji, matInfo.name)}</span> ${matInfo.name}</span><span class="${matMet ? 'met' : 'missing'}">${formatNumber(haveMat)}/${formatNumber(cost.qty)}</span></div>
      <div class="recipe-cost"><span><span class="icon">${iconMarkup(crystalInfo.image, crystalInfo.emoji, crystalInfo.name)}</span> ${crystalInfo.name}</span><span class="${haveCrystal >= 1 ? 'met' : 'missing'}">${formatNumber(haveCrystal)}/1</span></div>
      <button class="master-btn" data-ascend-uid="${uid}" ${canAscendItem(state, uid) ? '' : 'disabled'}>Ascender para <span style="color:${nextRarity.color}">${nextRarity.name}</span> +0</button>
    </div>`;
  }

  if (entry.enhanceLevel < ENHANCE_MAX_LEVEL) {
    const cost = item.enhanceCost[entry.enhanceLevel];
    const have = state.materials[cost.matId] || 0;
    const matInfo = findMaterialInfo(cost.matId);
    const met = have >= cost.qty;
    return `<div class="enhance-panel">
      <div class="recipe-cost"><span><span class="icon">${iconMarkup(matInfo.image, matInfo.emoji, matInfo.name)}</span> ${matInfo.name}</span><span class="${met ? 'met' : 'missing'}">${formatNumber(have)}/${formatNumber(cost.qty)}</span></div>
      <button data-enhance="${uid}" ${canEnhance(state, uid) ? '' : 'disabled'}>Aprimorar para +${entry.enhanceLevel + 1}</button>
    </div>`;
  }

  const crystalInfo = findMaterialInfo(item.crystalMaterialId);
  const haveCrystal = state.materials[item.crystalMaterialId] || 0;
  const masterCost = item.masterMaterialCost;
  const matInfo = findMaterialInfo(masterCost.matId);
  const haveMat = state.materials[masterCost.matId] || 0;
  const matMet = haveMat >= masterCost.qty;
  return `<div class="enhance-panel">
    <div class="recipe-cost"><span><span class="icon">${iconMarkup(matInfo.image, matInfo.emoji, matInfo.name)}</span> ${matInfo.name}</span><span class="${matMet ? 'met' : 'missing'}">${formatNumber(haveMat)}/${formatNumber(masterCost.qty)}</span></div>
    <div class="recipe-cost"><span><span class="icon">${iconMarkup(crystalInfo.image, crystalInfo.emoji, crystalInfo.name)}</span> ${crystalInfo.name}</span><span class="${haveCrystal >= 1 ? 'met' : 'missing'}">${formatNumber(haveCrystal)}/1</span></div>
    <button class="master-btn" data-master-upgrade="${uid}" ${canUpgradeToMaster(state, uid) ? '' : 'disabled'}>Evoluir para Rank Master</button>
  </div>`;
}

// ---------------------------------------------------------------
// Árvore de habilidades passivas ÚNICA (ver data/skills.js + systems/
// skills.js — era 3 árvores por classe, agora uma só): 1 ponto por nível de
// caça, 5 etapas de 3 linhas (3 habilidades cada) + 1 especial (3 opções
// mutuamente exclusivas) entre cada etapa. Ocupa a aba "Aprimoramentos"
// (tab-upgrades) — era só um placeholder antes disso tudo existir.
// ---------------------------------------------------------------

/// "+valor Nome do Stat" — mesma convenção usada nos afixos de item (ver
/// BONUS_STAT_LABEL acima), só que genérica a partir de STAT_DISPLAY_NAME
/// (data/skills.js) em vez de uma função por stat: stats que terminam em
/// "Percent" formatam como %, o resto como número puro.
function skillValueLabel(stat, value) {
  const amount = stat.endsWith('Percent') ? `+${formatPercent(value)}` : `+${formatNumber(value)}`;
  return `${amount} ${STAT_DISPLAY_NAME[stat] || stat}`;
}

/// □ □ □ □ → ■ ■ □ □ conforme o nível comprado — indicador de progresso
/// pedido explicitamente pro design (ver instruções da árvore).
function skillSquaresHtml(level, maxLevel) {
  return Array.from({ length: maxLevel }, (_, i) => (i < level ? '■' : '□')).join(' ');
}

/// Estado visual de uma habilidade NORMAL — 5 dos 7 estados pedidos
/// (bloqueada/disponível/parcial/maximizada/sem pontos); os outros 2
/// (especial disponível/comprada) são só pra specialOptionHtml abaixo.
function skillCardHtml(state, skill) {
  const level = getSkillLevel(state, skill.id);
  const unlocked = isRowUnlocked(state, skill.stageIndex, skill.rowIndex);
  const maxed = level >= skill.maxLevel;
  const hasPoints = getAvailableSkillPoints(state) >= 1;
  let stateClass;
  if (!unlocked) stateClass = 'locked';
  else if (maxed) stateClass = 'maxed';
  else if (!hasPoints) stateClass = 'no-points';
  else if (level > 0) stateClass = 'partial';
  else stateClass = 'available';

  const canBuy = canBuySkillLevel(state, skill.id);
  return `
    <button class="skill-card ${stateClass}" data-buy-skill="${skill.id}" ${canBuy ? '' : 'disabled'} title="${unlocked ? '' : 'Compre a linha anterior primeiro'}">
      <div class="skill-card-name">${skill.name}</div>
      <div class="skill-card-desc">${skillValueLabel(skill.stat, skill.perLevel)} por nível</div>
      <div class="skill-card-level">Nível ${level} / ${skill.maxLevel}</div>
      <div class="skill-card-squares">${skillSquaresHtml(level, skill.maxLevel)}</div>
    </button>
  `;
}

/// Uma das 3 opções mutuamente exclusivas do especial de uma etapa —
/// 'special-bought' pra opção escolhida, 'special-available' pra qualquer
/// uma enquanto nenhuma foi escolhida ainda (e o requisito de pontos
/// gastos foi atingido), 'locked' pro resto (requisito não atingido, ou
/// uma opção IRMÃ já foi escolhida).
function specialOptionHtml(state, option) {
  const chosenId = getChosenSpecialId(state, option.stageIndex);
  const isChosen = chosenId === option.id;
  const canBuy = canBuySpecial(state, option.id);
  const stateClass = isChosen ? 'special-bought' : canBuy ? 'special-available' : 'locked';
  const desc = option.bonuses.map((b) => skillValueLabel(b.stat, b.value)).join(', ');
  return `
    <button class="skill-card skill-special ${stateClass}" data-buy-special="${option.id}" ${canBuy ? '' : 'disabled'}>
      <div class="skill-card-name">✨ ${option.name}</div>
      <div class="skill-card-desc">${desc}</div>
      <div class="skill-card-level">${isChosen ? 'Escolhida' : 'Nível 0 / 1'}</div>
    </button>
  `;
}

function skillTreeHtml(state) {
  const tree = getSkillTree();
  const stagesHtml = tree.stages.map((stage) => {
    const stageUnlocked = isStageUnlocked(state, stage.stageIndex);
    const rowsHtml = stage.rows.map((row) => `
      <div class="skill-row">${row.map((skill) => skillCardHtml(state, skill)).join('')}</div>
    `).join('');
    const specialHtml = stage.special ? (() => {
      const lastRow = stage.rows[stage.rows.length - 1];
      const lastRowDone = lastRow.some((skill) => getSkillLevel(state, skill.id) > 0);
      return `
      <div class="skill-special-gate">
        <div class="skill-special-gate-label">
          🔒 Especial da Etapa ${stage.stageIndex + 1} — precisa gastar ${SPECIAL_THRESHOLDS[stage.stageIndex]} pontos no total
          (${Math.min(getSpentSkillPoints(state), SPECIAL_THRESHOLDS[stage.stageIndex])}/${SPECIAL_THRESHOLDS[stage.stageIndex]})
          e ter pelo menos 1 nível na linha de cima ${lastRowDone ? '✅' : '❌'}
        </div>
        <div class="skill-row skill-special-row">${stage.special.options.map((opt) => specialOptionHtml(state, opt)).join('')}</div>
      </div>
    `;
    })() : '';
    return `
      <div class="skill-stage ${stageUnlocked ? '' : 'locked'}">
        <div class="skill-stage-title">Etapa ${stage.stageIndex + 1}</div>
        ${rowsHtml}
        ${specialHtml}
      </div>
    `;
  }).join('');
  return `<div class="skill-tree">${stagesHtml}</div>`;
}

/// resetConfirming: true depois do 1º clique em "Resetar Pontos" — mostra
/// a confirmação inline (mesmo padrão non-blocking do "Destruir
/// selecionados" do inventário, ver bulkSelectToolbarHtml acima —
/// window.confirm fica bloqueado no iframe sandboxed do Artifact) antes de
/// zerar purchased/specials de vez.
function skillResetRowHtml(state, resetConfirming) {
  if (getSpentSkillPoints(state) < 1) return '';
  if (resetConfirming) {
    return `
      <div class="skill-reset-row">
        <span>Resetar todos os pontos investidos na árvore?</span>
        <div class="modal-action-row">
          <button class="modal-action-btn destroy-btn" data-skill-reset-confirm>Confirmar reset</button>
          <button class="modal-action-btn" data-skill-reset-cancel>Cancelar</button>
        </div>
      </div>
    `;
  }
  return `<button class="skill-reset-btn" data-skill-reset-start>🔄 Resetar Pontos</button>`;
}

export function renderUpgradesTab(state, resetConfirming = false) {
  const container = document.getElementById('tab-upgrades');
  const total = getTotalSkillPoints(state);
  const available = getAvailableSkillPoints(state);

  const header = `
    <div class="skills-header">
      <div class="skills-points">🔹 Pontos disponíveis: <strong>${available}</strong> (${getSpentSkillPoints(state)}/${total} gastos)</div>
      ${skillResetRowHtml(state, resetConfirming)}
    </div>
  `;

  container.innerHTML = `
    <img class="section-banner-img" src="assets/ui/titles/aprimoramentos.png" alt="Habilidades">
    ${header}
    ${skillTreeHtml(state)}
  `;
}

// ---------------------------------------------------------------
// Cartas tab: every card in the game (see data/cards.js), split into Boss
// and Common sections, always visible — undiscovered ones render dimmed
// (`.card-tile.undiscovered`) rather than being hidden, so the collection's
// full size is visible as a goal. Clicking any tile opens a bigger detail
// popup (showCardDetailModal, shares the #modal-overlay with the item
// detail popup) with the full-size art, description, and — the first time
// a card is ever obtained — a claimable one-time Cash reward (see
// systems/cards.js), same "claim once" idea as an achievement.
// ---------------------------------------------------------------

function cardTileHtml(state, card) {
  const discovered = isCardDiscovered(state, card.id);
  const claimable = canClaimCardReward(state, card.id);
  return `<button class="card-tile ${discovered ? 'discovered' : 'undiscovered'}" data-view-card="${card.id}">
    ${claimable ? '<span class="card-tile-badge">🎁</span>' : ''}
    <div class="icon">${iconMarkup(card.image, card.emoji, card.name)}</div>
    <div class="name">${card.name}</div>
  </button>`;
}

// Real data, not mockup flavor: sums every socketed card's `bonuses` (see
// data/cards.js) across all 6 equip slots (each slot can carry up to
// maxCardSlots(entry) cards — see systems/crafting.js) — the panel the
// mockup calls "Bônus das Cartas Ativas".
const CARD_BONUS_LABELS = {
  dpsPercent: '💥 DPS', attackSpeedPercent: '⚡ Velocidade de Ataque', goldPercent: `${GOLD_ICON} Ouro Obtido`,
  dropPercent: '🎒 Chance de Drop', critChancePercent: '🎯 Chance Crítica', critDamagePercent: '💢 Dano Crítico',
  hpPercent: '❤️ Vida Máxima', armorPercent: '🛡️ Armadura', hpFlat: '❤️ Vida Máxima', armorFlat: '🛡️ Armadura',
  dpsFlat: '💥 DPS', forca: '💪 Força', destreza: '🏃 Destreza', inteligencia: '🧠 Inteligência',
  lifestealFlat: '💚 Cura por Golpe', petDamagePercent: '🐾 Dano de Mascote', dodgePercent: '🌀 Esquiva',
  danoFisicoPercent: '🗡️ Dano Físico', danoPerfuracaoPercent: '🏹 Dano Perfurante', danoMagicoPercent: '🔮 Dano Mágico',
  doubleHitChance: '👊 Golpe Duplo',
};

const CARD_BONUS_PERCENT_STATS = new Set(['doubleHitChance']);

function cardsSummaryHtml(state) {
  const totals = {};
  for (const uid of Object.values(state.equipped)) {
    if (!uid) continue;
    const entry = state.inventory.find((i) => i.uid === uid);
    if (!entry) continue;
    for (const cardId of ensureCardIds(entry)) {
      if (!cardId) continue;
      const card = getCard(cardId);
      if (!card) continue;
      for (const b of card.bonuses || []) totals[b.stat] = (totals[b.stat] || 0) + b.value;
    }
  }

  const rows = Object.entries(totals).filter(([, v]) => v).map(([stat, v]) => {
    const label = CARD_BONUS_LABELS[stat] || stat;
    const value = (stat.endsWith('Percent') || CARD_BONUS_PERCENT_STATS.has(stat)) ? `+${formatPercent(v)}` : `+${formatNumber(v)}`;
    return `<div class="battle-info-row"><span>${label}</span><strong>${value}</strong></div>`;
  }).join('');

  return `
    <div class="cards-summary-box">
      <div class="equip-stats-title">✨ Bônus das Cartas Ativas</div>
      ${rows || '<p style="font-size:11px;color:var(--text-dim); margin:0;">Nenhuma carta equipada ainda.</p>'}
    </div>
  `;
}

export function renderCardsTab(state) {
  const container = document.getElementById('tab-cards');
  const bossCards = CARDS.filter((c) => c.isBossCard);
  const commonCards = CARDS.filter((c) => !c.isBossCard);
  const bossOwned = bossCards.filter((c) => isCardDiscovered(state, c.id)).length;
  const commonOwned = commonCards.filter((c) => isCardDiscovered(state, c.id)).length;
  // Bônus de DPS por COLEÇÃO (ver getCardCollectionDpsBonusPercent em
  // systems/cards.js — 1%/carta de monstro, 5%/carta de boss, permanente
  // por descoberta) — mostrado ao lado de cada contador, já quebrado por
  // seção, pra ficar óbvio de onde cada parte do bônus vem.
  const bossDpsBonus = bossOwned * 5;
  const commonDpsBonus = commonOwned * 1;

  const fragments = state.materials[CARD_FRAGMENT_ID] || 0;

  container.innerHTML = `
    <img class="section-banner-img" src="assets/ui/titles/cartas.png" alt="Cartas">
    <div class="card-fragment-total">${CARD_FRAGMENT_ICON} ${CARD_FRAGMENT_NAME}: ${formatNumber(fragments)}</div>
    ${cardsSummaryHtml(state)}
    <h3 class="cards-section-title">👑 Cartas de Boss <span class="cards-collected">Colecionadas: ${bossOwned}/${bossCards.length}</span> <span class="cards-dps-bonus">+${bossDpsBonus}% DPS</span></h3>
    <div class="card-grid">${bossCards.map((c) => cardTileHtml(state, c)).join('')}</div>
    <h3 class="cards-section-title">${CARD_ICON} Cartas de Monstros <span class="cards-collected">Colecionadas: ${commonOwned}/${commonCards.length}</span> <span class="cards-dps-bonus">+${commonDpsBonus}% DPS</span></h3>
    <div class="card-grid">${commonCards.map((c) => cardTileHtml(state, c)).join('')}</div>
  `;
}

function cardDetailHtml(state, card) {
  const discovered = isCardDiscovered(state, card.id);
  const claimable = canClaimCardReward(state, card.id);
  const claimed = isCardRewardClaimed(state, card.id);
  const owned = state.cards[card.id] || 0;

  let actionHtml;
  if (claimable) {
    actionHtml = `<button class="modal-action-btn" data-claim-card="${card.id}">🎁 Resgatar +${CARD_DISCOVERY_CASH_REWARD} ${ESMERALDA_ICON} Esmeralda</button>`;
  } else if (claimed) {
    actionHtml = `<div class="card-detail-status">🎁 Recompensa já resgatada</div>`;
  } else if (!discovered) {
    actionHtml = `<div class="card-detail-status">🔒 Ainda não obtida — derrote o monstro dela para ter uma chance de conseguir.</div>`;
  } else {
    actionHtml = '';
  }

  const fragments = state.materials[CARD_FRAGMENT_ID] || 0;
  const recycleValue = getCardRecycleValue(card);
  const craftCost = getCardCraftCost(card);
  const canRecycle = canRecycleCard(state, card.id);
  const canCraft = canCraftCard(state, card.id);

  return `
    <div class="card-detail ${discovered ? '' : 'undiscovered'}">
      <div class="card-detail-image">${iconMarkup(card.image, card.emoji, card.name)}</div>
      <div class="card-detail-info">
        <div class="card-detail-name">${card.name}</div>
        <div class="card-detail-desc">${card.description}</div>
        ${discovered ? `<div class="card-detail-owned">Você tem: ${formatNumber(owned)}</div>` : ''}
        ${actionHtml}
        <div class="card-fragment-box">
          <div class="card-fragment-count">${CARD_FRAGMENT_ICON} ${CARD_FRAGMENT_NAME}: ${formatNumber(fragments)}</div>
          <div class="card-fragment-actions">
            ${owned > 0 ? `<button class="modal-action-btn" data-recycle-card="${card.id}" ${canRecycle ? '' : 'disabled'}>♻️ Reciclar (+${recycleValue} ${CARD_FRAGMENT_ICON})</button>` : ''}
            <button class="modal-action-btn" data-craft-card="${card.id}" ${canCraft ? '' : 'disabled'}>🛠️ Craftar (${craftCost} ${CARD_FRAGMENT_ICON})</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function showCardDetailModal(state, cardId) {
  const card = getCard(cardId);
  if (!card) return;
  // showModal() usa textContent pro título (não innerHTML) — não dá pra
  // passar markup <img> ali, então esse continua sendo o único lugar que
  // ainda usa o emoji de texto puro em vez do CARD_ICON de verdade.
  showModal(`${card.isBossCard ? '👑' : '🃏'} ${card.name}`, cardDetailHtml(state, card));
}

// ---------------------------------------------------------------
// Mascotes: chocam de ovo (achado em kills/eventos), causam um dano
// elemental à parte do personagem (que agora é sempre Neutro — ver
// systems/stats.js), até 4 equipados de uma vez (o jogo escolhe sozinho o
// melhor contra o monstro atual, ver getBestEquippedPet em
// systems/pets.js), e podem ser fundidos (2 iguais -> +1 nível, até +10).
// ---------------------------------------------------------------

function petSlotIconHtml(state, uid, slotIndex) {
  const pet = uid ? getPetEntry(state, uid) : null;
  const species = pet ? getPetSpecies(pet.speciesId) : null;
  const rarity = pet ? getRarity(pet.rarityId) : null;
  const rarityClass = rarity ? ' has-rarity' : '';
  const rarityStyle = rarity ? ` style="--rarity-color:${rarity.color};"` : '';
  return `<button class="equip-slot-icon ${pet ? 'filled' : 'empty'}${rarityClass}" data-pet-slot="${slotIndex}" title="Mascote ${slotIndex + 1}"${rarityStyle}>
    <span class="icon">${species ? iconMarkup(species.image, species.emoji, species.name) : '🐾'}</span>
    ${pet ? `<span class="mini-badge">+${pet.level}</span>` : ''}
  </button>`;
}

function petTileHtml(state, pet) {
  const species = getPetSpecies(pet.speciesId);
  const rarity = getRarity(pet.rarityId);
  const isEquipped = (state.equippedPetUids || []).includes(pet.uid);
  return `<button class="inventory-tile has-rarity ${isEquipped ? 'equipped' : ''}" style="--rarity-color:${rarity.color};" data-view-pet="${pet.uid}" title="${species.name}">
    <span class="icon">${iconMarkup(species.image, species.emoji, species.name)}</span>
    <span class="mini-badge">+${pet.level}</span>
  </button>`;
}

/// Reordena só a EXIBIÇÃO da grade de mascotes — nunca muta state.pets (a
/// ordem "real" ali continua sendo a de aquisição/fusão, o que importa pra
/// getFusePartners/fuseAllPossiblePets não depender de exibição nenhuma).
/// null/'none' = ordem original. 'level'/'rarity' descem (maior primeiro);
/// 'element' agrupa pela ordem fixa de PET_ELEMENTS (fogo/planta/elétrico/
/// água), com Tier crescente dentro de cada grupo pra ficar previsível.
const PET_SORT_LABELS = { level: '🔼 Nível', rarity: '💠 Raridade', element: '🔥 Elemento' };

function sortPetsForDisplay(pets, sortMode) {
  if (!sortMode) return pets;
  const withSpecies = pets.map((pet) => ({ pet, species: getPetSpecies(pet.speciesId) }));
  if (sortMode === 'level') {
    withSpecies.sort((a, b) => b.pet.level - a.pet.level);
  } else if (sortMode === 'rarity') {
    const rarityRank = (rarityId) => RARITIES.findIndex((r) => r.id === rarityId);
    withSpecies.sort((a, b) => rarityRank(b.pet.rarityId) - rarityRank(a.pet.rarityId));
  } else if (sortMode === 'element') {
    const elementRank = (elementId) => PET_ELEMENTS.indexOf(elementId);
    withSpecies.sort((a, b) => {
      const elDiff = elementRank(a.species?.element) - elementRank(b.species?.element);
      if (elDiff !== 0) return elDiff;
      return (a.species?.tier || 0) - (b.species?.tier || 0);
    });
  }
  return withSpecies.map((w) => w.pet);
}

function petSortRowHtml(sortMode) {
  const chips = [{ id: null, label: '📋 Padrão' }, ...Object.entries(PET_SORT_LABELS).map(([id, label]) => ({ id, label }))];
  return `<div class="element-filter-row pet-sort-row">${chips.map((c) => `
    <button class="element-filter-btn pet-sort-btn ${sortMode === c.id ? 'active' : ''}" data-pet-sort="${c.id ?? ''}">${c.label}</button>
  `).join('')}</div>`;
}

export function renderPetsTab(state, sortMode = null) {
  const container = document.getElementById('tab-pets');
  const equipRow = (state.equippedPetUids || []).map((uid, i) => petSlotIconHtml(state, uid, i)).join('');
  const sortedPets = sortPetsForDisplay(state.pets, sortMode);
  const petsHtml = state.pets.length
    ? sortedPets.map((p) => petTileHtml(state, p)).join('')
    : `<p class="empty-slot">Nenhum mascote ainda. Derrote monstros ou vença eventos pra achar ovos, depois choque na aba aqui em cima.</p>`;

  const eggCount = state.eggCount || 0;
  const vipActive = isVipActive(state);
  const hatchAllTitle = vipActive
    ? 'Escolhe sempre o mascote de maior raridade (e maior Tier no empate) de cada ovo, sem abrir o modal de escolha'
    : 'Funcionalidade exclusiva de VIP (loja de Cash)';
  container.innerHTML = `
    <div class="section-banner section-banner-sm">🐾 Mascotes</div>
    <div class="pets-egg-row">
      <span class="pets-egg-count">🥚 Ovos: <strong>${formatNumber(eggCount)}</strong></span>
      <span class="pets-egg-count">🧩 Fragmentos: <strong>${formatNumber(state.petFragments || 0)}</strong></span>
      <button class="pets-hatch-btn" data-hatch-egg-btn ${eggCount < 1 ? 'disabled' : ''}>Chocar Ovo</button>
      <button class="pets-hatch-btn" data-hatch-all-btn ${canHatchAllEggs(state) ? '' : 'disabled'} title="${hatchAllTitle}">👑 Chocar Todos (${formatNumber(eggCount)})</button>
    </div>
    <div class="equip-inventory-header">Equipados (até ${MAX_EQUIPPED_PETS}, 1 por elemento)</div>
    <div class="pets-equip-row">${equipRow}</div>
    <div class="equip-inventory-header-row">
      <div class="equip-inventory-header">Inventário (${state.pets.length}/${getPetInventoryCap(state)})</div>
      <button class="bulk-select-toggle-btn" data-fuse-all-btn title="Funde em cascata todo par de mascotes iguais (mesma espécie, raridade e nível) não equipado">🌟 Fundir Tudo</button>
    </div>
    ${petSortRowHtml(sortMode)}
    <div class="equip-inventory-grid">${petsHtml}</div>
  `;
}

function fusePartnersHtml(state, uid) {
  const partners = getFusePartners(state, uid);
  if (!partners.length) {
    return `<div class="card-slot-picker"><div class="card-slot-label">Nenhum outro mascote igual (mesma espécie, raridade e nível) disponível pra fundir.</div></div>`;
  }
  return `<div class="card-slot-picker">
    <div class="card-slot-label">🌟 Escolha o parceiro pra fundir:</div>
    <div class="card-slot-options">${partners.map((p) => {
      const species = getPetSpecies(p.speciesId);
      const rarity = getRarity(p.rarityId);
      return `<button class="card-slot-option" data-fuse-base="${uid}" data-fuse-with="${p.uid}">${iconMarkup(species.image, species.emoji, species.name)} ${species.name} +${p.level} <span class="qty">${rarity.name}</span></button>`;
    }).join('')}</div>
  </div>`;
}

/// Barra de XP do pet + botão "Doar Fragmentos" — 2º caminho pra evoluir
/// nível além de fundir (ver donatePetFragments em systems/pets.js). Some
/// no nível máximo (não tem próximo nível pra progredir rumo a ele). O
/// botão mostra exatamente quanto VAI ser doado agora — só o que falta pro
/// próximo nível (nunca mais, mesmo com fragmento de sobra — ver
/// petFragmentsToDonateNow).
function petXpSectionHtml(state, pet, uid) {
  if (pet.level >= PET_MAX_LEVEL) return '';
  const xp = pet.xp || 0;
  const xpNeeded = xpToNextPetLevel(pet);
  const pct = xpNeeded > 0 ? Math.max(0, Math.min(100, (xp / xpNeeded) * 100)) : 0;
  const toDonate = petFragmentsToDonateNow(state, uid);
  const canDonate = canDonatePetFragments(state, uid);
  return `
    <div class="pet-xp-section">
      <div class="pet-xp-label">🧩 XP: ${formatNumber(xp)} / ${formatNumber(xpNeeded)}</div>
      <div class="pet-xp-bar-outer"><div class="pet-xp-bar-fill" style="width:${pct}%"></div></div>
      <button class="modal-action-btn" data-donate-pet-fragments-uid="${uid}" ${canDonate ? '' : 'disabled'}>🧩 Doar Fragmentos (+${formatNumber(toDonate)})</button>
    </div>
  `;
}

function petDetailHtml(state, uid, showFuseList) {
  const pet = getPetEntry(state, uid);
  const species = getPetSpecies(pet.speciesId);
  const rarity = getRarity(pet.rarityId);
  // Dano do pet agora é % do DPS do próprio caçador (ver getPetDamage em
  // data/pets.js) — precisa do DPS atual pra mostrar um número de verdade
  // aqui, não só a % crua.
  const damage = getPetDamage(pet, computePlayerStats(state).dps);
  const isEquipped = (state.equippedPetUids || []).includes(uid);

  const actionBtn = isEquipped
    ? `<button class="modal-action-btn" data-unequip-pet-uid="${uid}">Desequipar</button>`
    : canEquipPet(state, uid)
      ? `<button class="modal-action-btn" data-equip-pet-uid="${uid}">Equipar</button>`
      : `<button class="modal-action-btn" disabled title="Já tem um mascote de ${getElement(species.element).name} equipado — desequipe ele primeiro">🔒 Equipar</button>`;

  const fuseSection = showFuseList
    ? fusePartnersHtml(state, uid)
    : pet.level < PET_MAX_LEVEL
      ? `<button class="modal-action-btn" data-open-pet-fuse="${uid}">🌟 Fundir</button>`
      : `<div class="enhance-maxed">✨ Nível máximo (+10)</div>`;

  const dpsBonusPercent = getPetDpsBonusPercent(pet);
  const xpSection = petXpSectionHtml(state, pet, uid);
  const recycleBtn = canRecyclePet(state, uid)
    ? `<button class="modal-action-btn destroy-btn" data-recycle-pet-uid="${uid}">♻️ Reciclar (+${formatNumber(getPetRecycleValue(pet))} 🧩)</button>`
    : `<button class="modal-action-btn destroy-btn" disabled title="Mascote equipado não pode ser reciclado — desequipe ele primeiro">🔒 Reciclar</button>`;
  return `
    <div class="item-detail">
      <div class="item-detail-tier-badge">Tier ${species.tier}</div>
      <div class="item-detail-icon" style="filter: drop-shadow(0 0 10px ${rarity.color});">${iconMarkup(species.image, species.emoji, species.name)}</div>
      <div class="item-detail-name">${species.name} <span class="enhance-badge">+${pet.level}</span></div>
      <div class="item-detail-rarity" style="color:${rarity.color}; font-weight:800; font-size:12px;">${rarity.name}</div>
      <div class="item-detail-attribute" style="color:${getPetElementColor(species.element)}; font-weight:700; font-size:11.5px;">${elementBadgeHtml(species.element)} ${getElement(species.element).name}</div>
      <div class="item-detail-stats">+${formatNumber(damage)} Dano ${getElement(species.element).name}</div>
      <div class="item-detail-stats">+${dpsBonusPercent.toFixed(1)}% DPS do caçador (só enquanto ativo em combate)</div>
      ${xpSection}
      ${fuseSection}
      <div class="modal-action-row">
        ${actionBtn}
        ${recycleBtn}
      </div>
    </div>
  `;
}

export function showPetDetailModal(state, uid, showFuseList = false) {
  const pet = getPetEntry(state, uid);
  if (!pet) return;
  // Sem título — o nome do mascote já aparece uma vez, embaixo do ícone
  // (ver item-detail-name em petDetailHtml), não precisa repetir aqui em
  // cima (mesmo padrão do modal de item, ver showItemDetailModal).
  showModal('', petDetailHtml(state, uid, showFuseList));
}

function hatchCandidateHtml(candidate, side, unlocked) {
  const species = getPetSpecies(candidate.speciesId);
  const rarity = getRarity(candidate.rarityId);
  return `
    <div class="hatch-candidate ${unlocked ? '' : 'locked'}">
      <div class="item-detail-tier-badge">Tier ${species.tier}</div>
      <div class="item-detail-icon" style="filter: drop-shadow(0 0 10px ${rarity.color});">${iconMarkup(species.image, species.emoji, species.name)}</div>
      <div class="item-detail-name">${species.name}</div>
      <div class="item-detail-rarity" style="color:${rarity.color}; font-weight:800; font-size:12px;">${rarity.name}</div>
      ${unlocked
        ? `<button class="modal-action-btn" data-hatch-choose="${side}">Escolher</button>`
        : `<button class="modal-action-btn" disabled>🔒 VIP</button>`}
    </div>
  `;
}

/// Contador de pity (ver systems/pets.js MYTHIC_PITY_THRESHOLD/
/// LEGENDARY_PITY_THRESHOLD) — mostra quantos chocos já passaram desde a
/// última raridade daquele tipo, incluindo ESTE choco que está prestes a
/// acontecer (por isso o +1: se faltasse 1 antes de abrir o modal, essa
/// é a garantia batendo agora). Nunca passa de N/N — o pity garante que
/// esse choco específico já sai na raridade quando o contador bateria o
/// limite, então o rótulo mostra "garantido!" em vez de ultrapassar.
function petPityRowHtml(state) {
  const mythicSoFar = Math.min(MYTHIC_PITY_THRESHOLD, (state.petHatchesSinceMythic || 0) + 1);
  const legendarySoFar = Math.min(LEGENDARY_PITY_THRESHOLD, (state.petHatchesSinceLegendary || 0) + 1);
  const mythicLabel = mythicSoFar >= MYTHIC_PITY_THRESHOLD ? 'garantido!' : `${mythicSoFar}/${MYTHIC_PITY_THRESHOLD}`;
  const legendaryLabel = legendarySoFar >= LEGENDARY_PITY_THRESHOLD ? 'garantido!' : `${legendarySoFar}/${LEGENDARY_PITY_THRESHOLD}`;
  return `
    <div class="pet-pity-row">
      <span class="pet-pity-chip">💠 Lendário: <strong>${legendaryLabel}</strong></span>
      <span class="pet-pity-chip">✨ Mítico: <strong>${mythicLabel}</strong></span>
    </div>
  `;
}

export function showHatchModal(state, candidates) {
  const [left, right] = candidates;
  const canRight = canChooseRightPet(state);
  showModal('🥚 Ovo Chocado!', `
    <p style="font-size:12px; color:var(--text-dim); text-align:center;">Escolha 1 dos 2 mascotes — o outro se perde.</p>
    ${petPityRowHtml(state)}
    <div class="hatch-choice-row">
      ${hatchCandidateHtml(left, 'left', true)}
      ${hatchCandidateHtml(right, 'right', canRight)}
    </div>
    ${!isVipActive(state) && canRight ? '<p class="hatch-free-note">✨ Escolha grátis do lado direito disponível hoje!</p>' : ''}
    ${!isVipActive(state) && !canRight ? '<p class="hatch-free-note">🔒 O lado direito só com VIP (ou amanhã, na próxima escolha grátis).</p>' : ''}
  `);
}

/// Um dos 3 candidatos rolados por rollAscensionCandidates (systems/
/// crafting.js) — cada candidato é só um {stat, value} adicional ainda não
/// commitado, formatado com o mesmo BONUS_STAT_LABEL usado no popup de
/// detalhe do item (ver itemDetailStatsHtml acima).
function ascensionCandidateHtml(uid, candidate, index) {
  const line = BONUS_STAT_LABEL[candidate.stat] ? BONUS_STAT_LABEL[candidate.stat](candidate.value) : candidate.stat;
  return `
    <div class="ascension-candidate">
      <div class="item-detail-icon">🌟</div>
      <div class="item-detail-name" style="font-size:12.5px;">${line}</div>
      <button class="modal-action-btn" data-ascend-choose="${uid}" data-ascend-choose-index="${index}">Escolher</button>
    </div>
  `;
}

/// Segundo passo da Ascensão (ver rollAscensionCandidates/finalizeAscension
/// em systems/crafting.js): o item já rerolou baseStats pra magnitude da
/// raridade seguinte, e 3 bônus adicionais candidatos já foram sorteados —
/// falta só o jogador escolher 1 dos 3 pra virar o novo adicional (os que o
/// item já tinha continuam intactos). `pending` é o objeto retornado por
/// rollAscensionCandidates, guardado em main.js até o clique de escolha.
export function showAscensionModal(state, uid, pending) {
  const entry = state.inventory.find((i) => i.uid === uid);
  if (!entry) return;
  const item = getItem(entry.itemId);
  const nextRarity = getRarity(pending.nextRarityId);
  showModal('🌟 Ascensão!', `
    <p style="font-size:12px; color:var(--text-dim); text-align:center;">
      ${item.name} vai virar <span style="color:${nextRarity.color}; font-weight:800;">${nextRarity.name}</span>.
      Escolha 1 dos 3 bônus abaixo — ele vira o novo adicional do item.
    </p>
    <div class="ascension-choice-row">
      ${pending.candidates.map((c, i) => ascensionCandidateHtml(uid, c, i)).join('')}
    </div>
  `);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ---------------------------------------------------------------
// Events tab: fixed (non-collapsible) banner cards, each owning its own
// rotation clock (see data/events.js). "Mercador" was removed entirely.
//
// "Invasão de Chefes" and "Torre das Provações" share the same format —
// real mockup art as a fixed banner (title/subtitle/rewards frame baked
// in), an "Abre em:"/"Fecha em:" status overlaid on the art's empty box,
// and an "Entrar" button that appears there when the window is open. Once
// entered, the fight/run itself renders in a separate panel below the
// banner, not nested inside/expanding from it.
// ---------------------------------------------------------------

// Invasão de Chefes ("Caça Aprimorada" under the hood, see systems/events.js
// for the canEnterEvent/startEvent lifecycle): a fixed, non-expandable
// banner (invasao-banner.png, see invasaoChefesBannerHtml) showing the
// open/closed status and, when open, a real "Entrar" button. Once entered,
// the fight itself renders in a separate panel below the banner
// (invasaoChefesFightPanelHtml) — not nested inside/expanding from the
// banner card, per the user's "outra janela" request.
function invasaoChefesStatusParts(state) {
  const win = getEventWindow();
  if (win.active && state.eventEnteredCycle !== win.cycleIndex && !isEventClaimed(state, win.cycleIndex)) {
    return { label: 'Fecha em:', value: formatDuration(win.remainingActiveMs) };
  }
  return { label: 'Abre em:', value: formatDuration(win.msUntilNextWindow) };
}

// Whether the "Entrar" button should show below the status box: window
// open, not already used/claimed this cycle, not already fighting, and the
// player has unlocked at least one zone's boss so there's an eligible boss
// to roll.
function invasaoChefesCanEnter(state) {
  if (state.eventBossHp != null) return false;
  const win = getEventWindow();
  if (!win.active) return false;
  if (isEventClaimed(state, win.cycleIndex)) return false;
  if (state.eventEnteredCycle === win.cycleIndex) return false;
  return BOSSES.some((b, zoneIndex) => isBossUnlocked(state, zoneIndex));
}

// The 3 empty "RECOMPENSAS" squares baked into the banner art are just a
// preview row (purely illustrative — real rewards are rolled/granted on
// victory, same as before), overlaid with 3 real icons positioned over
// the art's squares. `variant` picks the vertical position matching that
// banner's own square row (measured separately per source mockup — Torre's
// squares sit noticeably higher than Invasão's, see CSS).
function rewardPreviewIconsHtml(icons, variant) {
  return icons
    .map((src, i) => `<img class="invasion-reward-icon reward-${variant} invasion-reward-${i + 1}" src="${src}" alt="">`)
    .join('');
}

function invasaoChefesBannerHtml(state) {
  const { label, value } = invasaoChefesStatusParts(state);
  const canEnter = invasaoChefesCanEnter(state);
  const rewardIcons = rewardPreviewIconsHtml([
    'assets/crystals/leviargon.png',
    'assets/cards/leviargon.png',
    'assets/ui/currency-event.png',
  ], 'invasion');
  return `<div class="event-card event-card-invasion">
    <div class="invasion-banner" style="background-image: url('assets/ui/invasao-banner.png')">
      ${rewardIcons}
      <div class="invasion-status-box">
        <div class="invasion-status-label">${label}</div>
        <div class="invasion-status-value">${value}</div>
      </div>
      ${canEnter ? `<button class="invasion-enter-btn" data-event-enter aria-label="Entrar"></button>` : ''}
    </div>
  </div>`;
}

function invasaoChefesFightPanelHtml(state) {
  const boss = BOSSES.find((b) => b.id === state.eventBossId);
  if (!boss) return `<div class="event-card"><div class="event-card-body"><div class="event-panel"><p class="event-sub">Chefe do evento não encontrado — tente recarregar.</p></div></div></div>`;
  const maxHp = state.eventBossMaxHp ?? computeEventBossMaxHp(boss);
  const hp = state.eventBossHp ?? maxHp;
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  return `
    <div class="event-card">
      <div class="event-card-body">
        <div class="event-panel">
          <div class="event-active-badge">🎪 Em combate!</div>
          <h3>${boss.name} <span class="boss-tag">EVENTO</span> ${elementBadgeHtml(boss.element)}</h3>
          <button id="event-boss-sprite" class="event-boss-sprite" >${iconMarkup(boss.image, boss.emoji, boss.name)}</button>
          <div class="event-hp-bar-outer"><div class="event-hp-bar-fill" style="width:${pct}%"></div><span class="event-hp-bar-text">${formatNumber(hp)} / ${formatNumber(maxHp)}</span></div>
          <p class="event-reward-info">🎁 10 itens ao derrotar (materiais/Cristal) + chance de Carta + ${EVENT_ICON} Moeda de Evento</p>
          <button class="event-giveup-btn" data-event-giveup>Encerrar</button>
        </div>
      </div>
    </div>`;
}

// Torre das Provações ("Torre Infinita" under the hood, see data/events.js
// for the window timing and systems/tower.js for level->monster resolution
// + run lifecycle) — same fixed-banner format as Invasão de Chefes (see
// torre-banner.png), just its own art/theme. The active-run view (once
// entered) renders separately, below the banner.
function torreProvacoesStatusParts(state) {
  const win = getTowerWindow();
  if (win.active && state.towerEnteredCycle !== win.cycleIndex && !state.towerRunActive) {
    return { label: 'Fecha em:', value: formatDuration(win.remainingActiveMs) };
  }
  return { label: 'Abre em:', value: formatDuration(win.msUntilNextWindow) };
}

function torreProvacoesCanEnter(state) {
  if (state.towerRunActive) return false;
  const win = getTowerWindow();
  if (!win.active) return false;
  return state.towerEnteredCycle !== win.cycleIndex;
}

function torreProvacoesBannerHtml(state) {
  const { label, value } = torreProvacoesStatusParts(state);
  const canEnter = torreProvacoesCanEnter(state);
  const rewardIcons = rewardPreviewIconsHtml([
    'assets/grunco/hide.png',
    'assets/ui/currency-gold.png',
    'assets/ui/currency-event.png',
  ], 'torre');
  return `<div class="event-card event-card-invasion">
    <div class="invasion-banner" style="background-image: url('assets/ui/torre-banner.png')">
      ${rewardIcons}
      <div class="invasion-status-box">
        <div class="invasion-status-label">${label}</div>
        <div class="invasion-status-value">${value}</div>
      </div>
      ${canEnter ? `<button class="invasion-enter-btn" data-tower-enter aria-label="Entrar"></button>` : ''}
    </div>
  </div>`;
}

function torreProvacoesFightPanelHtml(state, runRemainingMs, towerHp, towerMaxHp) {
  const monster = getTowerMonster(state.towerLevel, state.towerWeakMonsterId);
  const hp = towerHp ?? monster.maxHp;
  const maxHp = towerMaxHp ?? monster.maxHp;
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (state.towerMonsterHp / maxHp) * 100)) : 0;
  const hpPlayerPct = maxHp > 0 && towerMaxHp > 0 ? Math.max(0, Math.min(100, (hp / towerMaxHp) * 100)) : 0;
  return `
    <div class="event-card">
      <div class="event-card-body">
        <div class="event-panel">
          <div class="event-active-badge">🗼 Nível ${state.towerLevel}/${TOWER_MAX_LEVEL} — ${runRemainingMs != null ? formatDuration(runRemainingMs) : ''} restantes</div>
          <h3>${monster.name} ${monster.isBoss ? '<span class="boss-tag">CHEFE</span>' : ''} ${elementBadgeHtml(monster.element)}</h3>
          <button id="tower-monster-sprite" class="event-boss-sprite" >${iconMarkup(monster.image, monster.emoji, monster.name)}</button>
          <div class="event-hp-bar-outer"><div class="event-hp-bar-fill" style="width:${pct}%"></div><span class="event-hp-bar-text">${formatNumber(state.towerMonsterHp)} / ${formatNumber(maxHp)}</span></div>
          <p class="event-sub">Sua vida na torre</p>
          <div class="event-hp-bar-outer"><div class="event-hp-bar-fill" style="width:${hpPlayerPct}%; background:var(--danger, #e05656);"></div><span class="event-hp-bar-text">${formatNumber(hp)} / ${formatNumber(towerMaxHp)}</span></div>
          <p class="event-reward-info">🎁 Recompensa ao final: ${EVENT_ICON} Moeda de Evento, conforme o nível alcançado.</p>
          <button class="event-giveup-btn" data-tower-giveup>Encerrar</button>
        </div>
      </div>
    </div>`;
}

// Mina de Ouro (see data/events.js for window/fight timing and
// systems/goldmine.js for the run lifecycle) — same fixed-banner format as
// the other two, but the fight itself is a single Gold Boss on its own
// short 35s clock instead of a boss/level roll: the Gold Boss never fights
// back, and the run always ends in a reward (kill or timeout both grant
// gold for however much damage was actually dealt — see
// computeGoldMineReward), so there's no "loss" state to render.
function goldMineStatusParts(state) {
  const win = getGoldMineWindow();
  if (win.active && state.goldMineEnteredCycle !== win.cycleIndex && !state.goldMineRunActive) {
    return { label: 'Fecha em:', value: formatDuration(win.remainingActiveMs) };
  }
  return { label: 'Abre em:', value: formatDuration(win.msUntilNextWindow) };
}

function goldMineCanEnter(state) {
  if (state.goldMineRunActive) return false;
  const win = getGoldMineWindow();
  if (!win.active) return false;
  return state.goldMineEnteredCycle !== win.cycleIndex;
}

function goldMineBannerHtml(state) {
  const { label, value } = goldMineStatusParts(state);
  const canEnter = goldMineCanEnter(state);
  const rewardIcons = rewardPreviewIconsHtml([
    'assets/ui/currency-gold.png',
    'assets/ui/currency-gold.png',
    'assets/ui/currency-gold.png',
  ], 'goldmine');
  return `<div class="event-card event-card-invasion">
    <div class="invasion-banner" style="background-image: url('assets/ui/goldmine-banner.png')">
      ${rewardIcons}
      <div class="invasion-status-box">
        <div class="invasion-status-label">${label}</div>
        <div class="invasion-status-value">${value}</div>
      </div>
      ${canEnter ? `<button class="invasion-enter-btn" data-goldmine-enter aria-label="Entrar"></button>` : ''}
    </div>
  </div>`;
}

const GOLDMINE_BOSS_ANIM_FRAMES = [
  'assets/goldmine_boss/anim/frame1.png',
  'assets/goldmine_boss/anim/frame2.png',
  'assets/goldmine_boss/anim/frame3.png',
  'assets/goldmine_boss/anim/frame4.png',
];

function goldMineFightPanelHtml(state, runRemainingMs) {
  const maxHp = GOLDMINE_BOSS_HP;
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (state.goldMineBossHp / maxHp) * 100)) : 0;
  const frameIdx = Math.floor(Date.now() / MONSTER_IDLE_FRAME_MS) % GOLDMINE_BOSS_ANIM_FRAMES.length;
  return `
    <div class="event-card">
      <div class="event-card-body">
        <div class="event-panel event-panel-goldmine">
          <div class="event-active-badge">⛏️ ${runRemainingMs != null ? formatDuration(runRemainingMs) : ''} restantes</div>
          <h3>Dragão Dourado <span class="boss-tag">EVENTO</span></h3>
          <button id="goldmine-boss-sprite" class="event-boss-sprite event-boss-sprite-goldmine" >${iconMarkup(GOLDMINE_BOSS_ANIM_FRAMES[frameIdx], '🐉', 'Dragão Dourado')}</button>
          <div class="event-hp-bar-outer"><div class="event-hp-bar-fill" style="width:${pct}%"></div><span class="event-hp-bar-text">${formatNumber(state.goldMineBossHp)} / ${formatNumber(maxHp)}</span></div>
          <p class="event-reward-info">🎁 Recompensa ao final: ${GOLD_ICON} 1 Ouro por ponto de dano causado.</p>
          <button class="event-giveup-btn" data-goldmine-giveup>Encerrar</button>
        </div>
      </div>
    </div>`;
}

// Expedição do Caçador (see data/events.js EXPEDITION_TIERS/EXPEDITION_REWARDS
// + systems/expedition.js): no fight, no per-cycle window — 3 fixed duration
// cards (1h/4h/8h), each with its own accent color. Entering grants the
// reward immediately and arms a single cooldown shared across all 3 cards
// (see canEnterExpedition), so while on cooldown every card shows the same
// countdown instead of its own "Entrar" button.
export function expeditionDurationLabel(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/// A 1ª linha (chance 1) é a garantida, sempre exibida sem %; as demais são
/// bônus que SOMAM ao total quando o roll bate (ver rollExpeditionRewardRows)
/// — mostradas como "+qty" com a % de chance ao lado.
function expeditionRewardRowsHtml(rows, iconHtml) {
  return rows.map((row, i) => {
    const guaranteed = row.chance >= 1;
    const qtyLabel = guaranteed ? `${formatNumber(row.qty)}` : `+${formatNumber(row.qty)}`;
    const chanceLabel = `<span class="expedition-drop-chance">${Math.round(row.chance * 100)}%</span>`;
    return `<div class="expedition-drop-row ${guaranteed ? 'guaranteed' : 'bonus'}">${chanceLabel}${iconHtml} ${qtyLabel}</div>`;
  }).join('');
}

function expeditionCardHtml(state, tier, ready, remainingMs) {
  const rewards = EXPEDITION_REWARDS[tier.id];
  const btnHtml = ready
    ? `<button class="expedition-enter-btn" style="--tier-color:${tier.color}" data-expedition-enter="${tier.id}">Entrar</button>`
    : `<button class="expedition-enter-btn" disabled>${expeditionDurationLabel(remainingMs)} restantes</button>`;
  return `
    <div class="expedition-card" style="--tier-color:${tier.color}">
      <div class="expedition-card-title">Expedição de ${tier.label}</div>
      <div class="expedition-banner" style="background-image:url('${tier.image}')"></div>
      ${btnHtml}
      <div class="expedition-rewards">
        <div>
          <div class="expedition-reward-col-title">${EVENT_ICON} Moeda de Evento</div>
          ${expeditionRewardRowsHtml(rewards.currency, EVENT_ICON)}
        </div>
        <div>
          <div class="expedition-reward-col-title">🥚 Ovo de Mascote</div>
          ${expeditionRewardRowsHtml(rewards.eggs, '🥚')}
        </div>
      </div>
    </div>`;
}

function expeditionSectionHtml(state) {
  const now = Date.now();
  const ready = canEnterExpedition(state, now);
  const remainingMs = expeditionRemainingMs(state, now);
  const cardsHtml = EXPEDITION_TIERS.map((tier) => expeditionCardHtml(state, tier, ready, remainingMs)).join('');
  return `
    <div class="expedition-section">
      <div class="expedition-section-title">🧭 Expedição do Caçador</div>
      <div class="expedition-tier-grid">${cardsHtml}</div>
      <p class="expedition-note">Escolha 1 duração — a recompensa é concedida na hora, e as 3 ficam bloqueadas até o tempo escolhido passar. A linha garantida (sem %) sempre entra; as demais se somam quando o bônus bate.</p>
    </div>`;
}

export function renderEventsTab(state, towerRunRemainingMs = null, towerHp = null, towerMaxHp = null, goldMineRunRemainingMs = null) {
  const container = document.getElementById('tab-events');
  container.innerHTML = `
    <img class="section-banner-img" src="assets/ui/titles/eventos.png" alt="Eventos">
    <div class="event-list">
    ${invasaoChefesBannerHtml(state)}
    ${state.eventBossHp != null ? invasaoChefesFightPanelHtml(state) : ''}
    ${torreProvacoesBannerHtml(state)}
    ${state.towerRunActive ? torreProvacoesFightPanelHtml(state, towerRunRemainingMs, towerHp, towerMaxHp) : ''}
    ${goldMineBannerHtml(state)}
    ${state.goldMineRunActive ? goldMineFightPanelHtml(state, goldMineRunRemainingMs) : ''}
    ${expeditionSectionHtml(state)}
  </div>`;
}

export function pulseEventBoss() {
  const sprite = document.getElementById('event-boss-sprite');
  if (!sprite) return;
  sprite.classList.remove('hit');
  void sprite.offsetWidth; // restart animation
  sprite.classList.add('hit');
}

export function pulseTowerMonster() {
  const sprite = document.getElementById('tower-monster-sprite');
  if (!sprite) return;
  sprite.classList.remove('hit');
  void sprite.offsetWidth; // restart animation
  sprite.classList.add('hit');
}

export function pulseGoldMineBoss() {
  const sprite = document.getElementById('goldmine-boss-sprite');
  if (!sprite) return;
  sprite.classList.remove('hit');
  void sprite.offsetWidth; // restart animation
  sprite.classList.add('hit');
}

// ---------------------------------------------------------------
// Achievements content — "earn Cash" side (achievement claims + the
// simulated ad-watch reward). Folded into the Shop tab as a 3rd sub-tab
// (see renderShopTab below) for now — the bottom nav only has room for
// Inventário/Forja/Caçada/Aprimoramento/Cartas/Loja, so Conquistas rides
// along inside Loja until it earns its own slot.
// ---------------------------------------------------------------

function achievementsContentHtml(state) {
  const cooldownMs = adWatchCooldownRemaining(state);
  const adReady = cooldownMs <= 0;

  const achievementsHtml = ACHIEVEMENTS.map((a) => {
    const claimed = isAchievementClaimed(state, a.id);
    const ready = isAchievementReady(state, a);
    const statusBtn = claimed
      ? `<button disabled>Resgatado</button>`
      : `<button data-claim-achievement="${a.id}" ${ready ? '' : 'disabled'}>${ESMERALDA_ICON} +${a.cashReward}</button>`;
    return `<div class="achievement-card ${claimed ? 'claimed' : ''}">
      <span class="icon">${a.emoji}</span>
      <div class="info">
        <div class="name">${a.name}</div>
        <div class="desc">${a.description}</div>
      </div>
      ${statusBtn}
    </div>`;
  }).join('');

  return `
    <div class="shop-balance">${ESMERALDA_ICON} Você tem <strong>${formatNumber(state.cash)}</strong> Esmeralda</div>
    <button id="watch-ad-btn" class="watch-ad-btn" ${adReady ? '' : 'disabled'}>
      ${adReady ? '🎬 Assistir Anúncio (+' + AD_WATCH_CASH_REWARD + ' ' + ESMERALDA_ICON + ')' : `🎬 Anúncio disponível em ${formatDuration(cooldownMs)}`}
    </button>
    <div class="achievement-list">${achievementsHtml}</div>
  `;
}

// ---------------------------------------------------------------
// Shop tab: Cash sub-tab (spend on gold packs, plus a disabled real-money
// package stub), Event-currency sub-tab (per-boss Crystal/material
// bundles), and Conquistas (see achievementsContentHtml above).
// `activeSubTab` is owned by main.js.
// ---------------------------------------------------------------

export function renderShopTab(state, activeSubTab) {
  const container = document.getElementById('tab-shop');
  let body;
  if (activeSubTab === 'event') body = eventShopHtml(state);
  else if (activeSubTab === 'achievements') body = achievementsContentHtml(state);
  else body = cashShopHtml(state);

  container.innerHTML = `
    <img class="section-banner-img" src="assets/ui/titles/loja.png" alt="Loja">
    <div class="inner-subnav">
      <button class="inner-subtab-btn ${activeSubTab === 'cash' ? 'active' : ''}" data-shop-subtab="cash">${ESMERALDA_ICON} Esmeralda</button>
      <button class="inner-subtab-btn ${activeSubTab === 'event' ? 'active' : ''}" data-shop-subtab="event">${EVENT_ICON} Evento</button>
      <button class="inner-subtab-btn ${activeSubTab === 'achievements' ? 'active' : ''}" data-shop-subtab="achievements">🏆 Conquistas</button>
    </div>
    ${body}
  `;
}

function cashShopHtml(state) {
  const packagesHtml = CASH_REAL_MONEY_PACKAGES.map((p) => `
    <div class="cash-package-card disabled" title="Requer integração de pagamento — ainda não disponível">
      <div class="icon">${ESMERALDA_ICON}</div>
      <div class="name">${p.cashAmount} Esmeralda</div>
      <div class="price">${p.priceLabel}</div>
      <button disabled>Em breve</button>
    </div>`).join('');

  const shopItemsHtml = CASH_SHOP_ITEMS.map((item) => {
    // VIP é por tempo, não empilhável (ver systems/shop.js
    // canBuyCashItem/buyCashItem) — o botão fica travado enquanto ainda
    // está ativo, só volta a ficar comprável depois que os dias
    // restantes zerarem e o VIP expirar de vez.
    const vipActiveNow = item.kind === 'vip' && isVipActive(state);
    const vipStatus = vipActiveNow
      ? `<div class="desc vip-days-left">👑 Ativo — expira em ${Math.max(1, Math.ceil((state.vipExpiresAt - Date.now()) / 86400000))} dia(s).</div>`
      : '';
    const buyBtn = vipActiveNow
      ? `<button disabled title="Já é VIP — espere o contador zerar pra comprar de novo">👑 Ativo</button>`
      : `<button data-buy-cash="${item.id}" ${canBuyCashItem(state, item.id) ? '' : 'disabled'}>${ESMERALDA_ICON} ${item.cost}</button>`;
    return `
    <div class="shop-item-card">
      <span class="icon">${item.emoji}</span>
      <div class="info">
        <div class="name">${item.name}</div>
        <div class="desc">${item.description}</div>
        ${vipStatus}
      </div>
      ${buyBtn}
    </div>`;
  }).join('');

  return `
    <div class="shop-balance">${ESMERALDA_ICON} Você tem <strong>${formatNumber(state.cash)}</strong> Esmeralda</div>
    <p class="shop-note">Ganhe Esmeralda na aba 🏆 Conquistas.</p>

    <h4 class="shop-section-title">Comprar com Esmeralda</h4>
    <div class="shop-item-grid">${shopItemsHtml}</div>

    <h4 class="shop-section-title">Comprar Esmeralda (dinheiro real)</h4>
    <p class="shop-note">Ainda não disponível nesta versão — em breve.</p>
    <div class="cash-package-grid">${packagesHtml}</div>
  `;
}

function eventShopHtml(state) {
  const bossesHtml = BOSSES.map((boss, tier) => {
    const unlocked = isBossUnlocked(state, tier);
    if (!unlocked) return '';
    const items = eventShopItemsForBoss(boss, tier);
    return `<div class="family-group">
      <h3><span class="icon">${iconMarkup(boss.image, boss.emoji, boss.name)}</span> ${boss.name}</h3>
      <div class="shop-item-grid">${items.map((item) => `
        <div class="shop-item-card event-variant">
          <span class="icon">${iconMarkup(item.image, item.emoji, item.name)}</span>
          <div class="info">
            <div class="name">${item.name}</div>
          </div>
          <button data-buy-event-mat="${item.matId}" data-buy-event-amount="${item.amount}" data-buy-event-cost="${item.cost}" ${canBuyEventItem(state, item) ? '' : 'disabled'}>${EVENT_ICON} ${item.cost}</button>
        </div>`).join('')}</div>
    </div>`;
  }).join('');

  return `
    <div class="shop-balance event-variant">${EVENT_ICON} Você tem <strong>${formatNumber(state.eventCurrency)}</strong> Moeda de Evento</div>
    <p class="shop-note">Ganhe Moeda de Evento derrotando o chefe de evento na aba 🎪 Eventos.</p>
    ${bossesHtml || '<p class="shop-note">Nenhum chefe desbloqueado ainda.</p>'}
  `;
}

// Equipment (which now also covers Forja/Materiais as sub-tabs) is
// deliberately not here, same reasoning as Events/Shop/Achievements: it
// needs main.js-owned transient UI state (which sub-tab is active) that
// render.js has no business knowing about. See fullRefresh() in main.js.
export function renderAll(state, monster, stats) {
  renderTopBar(state);
  renderCombatStats(stats, monster);
  renderMonster(state, monster);
  renderUpgradesTab(state);
}

export function spawnDamagePopup(amount, isCrit = false, isBurst = false) {
  const container = document.getElementById('damage-popups');
  const el = document.createElement('div');
  el.className = isBurst ? 'damage-popup burst' : isCrit ? 'damage-popup crit' : 'damage-popup';
  el.textContent = isBurst ? `-${formatNumber(amount)} GOLPE DEVASTADOR!` : isCrit ? `-${formatNumber(amount)} CRÍTICO!` : `-${formatNumber(amount)}`;
  // Wide, randomized spread on both axes — a fast attack-speed build spawns
  // several of these within the same 750ms window, and a narrow fixed spot
  // made them pile up unreadably on top of each other (looking like hits got
  // dropped even though every one of them landed).
  el.style.left = `${30 + Math.random() * 40}%`;
  el.style.top = `${30 + Math.random() * 20}%`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 750);
}

/// Popup separado pro dano do mascote (ver systems/combat.js resolvePetHit)
/// — cor do elemento do pet, pra ficar visualmente distinto do dano normal
/// do personagem (que agora é sempre Neutro). isCrit usa a mesma chance/
/// dano crítico do caçador (rolagem própria, ver resolvePetHit).
export function spawnPetDamagePopup(amount, species, isCrit = false) {
  const container = document.getElementById('damage-popups');
  const el = document.createElement('div');
  el.className = isCrit ? 'damage-popup pet-damage crit' : 'damage-popup pet-damage';
  el.style.color = getPetElementColor(species.element);
  el.textContent = isCrit ? `${species.emoji} -${formatNumber(amount)} CRÍTICO!` : `${species.emoji} -${formatNumber(amount)}`;
  el.style.left = `${30 + Math.random() * 40}%`;
  el.style.top = `${30 + Math.random() * 20}%`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 750);
}

export function pulseMonster() {
  const sprite = document.getElementById('monster-sprite');
  sprite.classList.remove('hit');
  void sprite.offsetWidth; // restart animation
  sprite.classList.add('hit');
}

export function showLootPopup(goldGained, drops) {
  const container = document.getElementById('loot-popup');
  const parts = [`+${formatNumber(goldGained)} ${GOLD_ICON}`, ...drops.map((d) => `+${d.qty} ${iconMarkup(d.image, d.emoji, d.name)}`)];
  const el = document.createElement('div');
  el.className = 'loot-popup-entry';
  el.innerHTML = parts.join(' ');
  container.appendChild(el);
  while (container.childNodes.length > 3) container.removeChild(container.firstChild);
  setTimeout(() => el.remove(), 2500);
}

// Global cooldown across every toast, regardless of source: a monster that
// one-shots the player in a fast/tough zone would otherwise retrigger
// retreat()'s "você morreu" toast every fight (sub-second), flooding the
// screen and burying anything else happening at the same time. One message
// per 10s window is enough to inform without drowning play out.
const TOAST_COOLDOWN_MS = 10000;
let lastToastAt = -Infinity;

export function showToast(message) {
  const now = Date.now();
  if (now - lastToastAt < TOAST_COOLDOWN_MS) return;
  lastToastAt = now;

  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

export function showModal(title, bodyHtml) {
  const titleEl = document.getElementById('modal-title');
  titleEl.textContent = title;
  titleEl.style.display = title ? '' : 'none';
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

export function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
