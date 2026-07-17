import { isBossStage, BOSSES, WEAK_MONSTER_GROUPS, findMaterialInfo } from '../data/monsters.js';
import { getSlot, getItemsForBoss, getItem, getEnhancedStats, getEnhanceLabel, ENHANCE_MAX_LEVEL } from '../data/items.js';
import { UPGRADES } from '../data/upgrades.js';
import { getElement, elementDamageModifier, ELEMENT_RESISTANCE_PER_PIECE, ELEMENTS } from '../data/elements.js';
import { formatNumber, formatPercent } from '../format.js';
import { getEquippedEntry } from '../systems/equipment.js';
import { computePlayerStats } from '../systems/stats.js';
import { canCraft, canEnhance, canUpgradeToMaster, canAttemptCardSlotUnlock, CARD_SLOT_UNLOCK_CHANCE } from '../systems/crafting.js';
import { getUpgradeLevel, getUpgradeCost } from '../systems/upgrades.js';
import { getEventWindow, getTowerWindow, TOWER_MAX_LEVEL } from '../data/events.js';
import { isEventClaimed, computeEventBossMaxHp } from '../systems/events.js';
import { getTowerMonster } from '../systems/tower.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { isAchievementClaimed, isAchievementReady } from '../systems/achievements.js';
import { CASH_SHOP_ITEMS, CASH_REAL_MONEY_PACKAGES, AD_WATCH_CASH_REWARD, eventShopItemsForBoss } from '../data/shop.js';
import { canBuyCashItem, canBuyEventItem, adWatchCooldownRemaining } from '../systems/shop.js';
import { CARDS, getCard, CARD_DISCOVERY_CASH_REWARD } from '../data/cards.js';
import { isCardDiscovered, canClaimCardReward, isCardRewardClaimed } from '../systems/cards.js';

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

function elementBadgeHtml(elementId) {
  const el = getElement(elementId);
  return `<span class="element-badge element-${el.id}">${el.emoji} ${el.name}</span>`;
}


const STAT_LABELS = {
  clickFlat: (v) => `+${formatNumber(v)} Dano de Clique`,
  dpsFlat: (v) => `+${formatNumber(v)} DPS`,
  clickPercent: (v) => `+${formatPercent(v)} Dano de Clique`,
  dpsPercent: (v) => `+${formatPercent(v)} DPS`,
  goldPercent: (v) => `+${formatPercent(v)} Ouro`,
  dropPercent: (v) => `+${formatPercent(v)} Chance de Material`,
  hpFlat: (v) => `+${formatNumber(v)} Vida`,
  armorFlat: (v) => `+${formatNumber(v)} Armadura`,
};

function formatStatsLines(stats) {
  return Object.entries(stats)
    .map(([key, value]) => (STAT_LABELS[key] ? STAT_LABELS[key](value) : null))
    .filter(Boolean);
}

export function renderTopBar(state) {
  document.getElementById('gold-value').textContent = formatNumber(state.gold);
  document.getElementById('cash-value').textContent = formatNumber(state.cash);
  document.getElementById('event-currency-value').textContent = formatNumber(state.eventCurrency);
  document.getElementById('stage-value').textContent = state.maxStage;
}

export function renderCombatStats(stats, monster) {
  document.getElementById('click-damage-value').textContent = formatNumber(stats.clickDamage);
  document.getElementById('dps-value').textContent = formatNumber(stats.dps);
  document.getElementById('armor-value').textContent = formatNumber(stats.armor);
  document.getElementById('crit-chance-value').textContent = formatPercent(stats.critChance);
  document.getElementById('crit-damage-value').textContent = formatPercent(stats.critDamage);
  document.getElementById('attack-damage-value').textContent = `Dano: ${formatNumber(stats.clickDamage)}`;

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

export function renderMonster(state, monster) {
  const boss = isBossStage(state.stage);
  document.getElementById('monster-sprite').innerHTML = iconMarkup(monster.image, monster.emoji, monster.name);
  document.getElementById('monster-name').innerHTML =
    `${monster.name}${boss ? '<span class="boss-tag">CHEFE</span>' : ''} ${elementBadgeHtml(monster.element)}`;
  document.getElementById('stage-label').textContent = `Estágio ${state.stage}`;

  const hp = Math.max(0, state.monsterHp ?? monster.maxHp);
  const pct = Math.max(0, Math.min(100, (hp / monster.maxHp) * 100));
  document.getElementById('hp-bar-fill').style.width = `${pct}%`;
  document.getElementById('hp-bar-text').textContent = `${formatNumber(hp)} / ${formatNumber(monster.maxHp)}`;
  document.getElementById('enemy-hp-value').textContent = `${formatNumber(hp)} / ${formatNumber(monster.maxHp)}`;

  document.getElementById('stage-prev').disabled = state.stage <= 1;
  document.getElementById('stage-next').disabled = state.stage >= state.maxStage;
  document.getElementById('stage-max').disabled = state.stage >= state.maxStage;
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
  el.textContent = `⏱ ${seconds}s para derrotar o chefe!`;
}

// All 6 equip slots, shown as a single grid of square tiles (no paper-doll
// avatar) — order is purely cosmetic.
const ALL_SLOT_IDS = ['helmet', 'armor', 'weapon', 'pants', 'gloves', 'boots'];

// Inventário (paper-doll + owned items) and Forja (craft recipes +
// Materiais) are separate bottom-nav tabs — previously sub-tabs of one
// combined "Equipamento" tab, split apart per the mockups' bottom-nav
// layout (Inventário, Forja, Caçada, Aprimoramento, Cartas, Loja).
// Interactive elements in each are handled by their own delegated listener
// wired once in main.js's init() (wireInventoryTabEvents()/
// wireForgeTabEvents()), since these tabs re-render often (every kill) and
// per-render re-wiring is exactly the bug class that bit this project
// twice before.
export function renderInventoryTab(state, filterElement = null) {
  const container = document.getElementById('tab-inventory');
  const banner = `<img class="equip-banner-img" src="assets/ui/equip-banner.png" alt="Equipamentos">`;
  container.innerHTML = banner + equipRingContentHtml(state, filterElement);
}

function elementFilterRowHtml(filterElement) {
  const chips = [{ id: null, emoji: '📦', name: 'Todos' }, ...ELEMENTS];
  return `<div class="element-filter-row">${chips.map((el) => `
    <button class="element-filter-btn ${filterElement === el.id ? 'active' : ''} ${el.id ? `element-${el.id}` : ''}" data-filter-element="${el.id ?? ''}" title="${el.name}">${el.emoji}</button>
  `).join('')}</div>`;
}

const FORGE_SUBTABS = [
  { id: 'recipes', label: '🔨 Receitas' },
  { id: 'materials', label: '🎒 Materiais' },
];

export function renderForgeTab(state, activeForgeSubTab = 'recipes', expandedForgeBosses = new Set()) {
  const container = document.getElementById('tab-forge');
  const banner = `<div class="section-banner">Forja</div>`;
  const subnav = `<div class="inner-subnav">${FORGE_SUBTABS.map((t) => `
    <button class="inner-subtab-btn ${activeForgeSubTab === t.id ? 'active' : ''}" data-forge-subtab="${t.id}">${t.label}</button>
  `).join('')}</div>`;
  const body = activeForgeSubTab === 'materials' ? materialsContentHtml(state) : forgeContentHtml(state, expandedForgeBosses);
  container.innerHTML = banner + subnav + body;
}

function setBonusBannerHtml(state) {
  const { activeSetBonus } = computePlayerStats(state);
  if (!activeSetBonus) return '';
  const boss = BOSSES.find((b) => b.id === activeSetBonus.bossId);
  const label = activeSetBonus.setLevel > ENHANCE_MAX_LEVEL ? 'Rank Master' : `nível +${activeSetBonus.setLevel}`;
  return `<div class="set-bonus-banner">
    ✨ Set completo de ${boss ? boss.name : activeSetBonus.bossId} ativo (${label}): +${formatNumber(activeSetBonus.hpFlat)} Vida ·
    +${formatNumber(activeSetBonus.armorFlat)} Armadura · +${formatPercent(activeSetBonus.critChancePercent)} Crítico ·
    +${formatPercent(activeSetBonus.critDamagePercent)} Dano Crítico
  </div>`;
}

// Paper-doll: a square card with the character art as its background and
// the 6 equip slots overlaid on top of it in 2 columns of 3 —
// weapon/helmet/armor on the left, gloves/pants/boots on the right
// (closest match to the reference art's weapon/helmet/armor-vs-necklace/
// ring/boots split, given our actual 6 slots have no jewelry slot). Sits
// side by side with the stats card; the inventory grid spans the full
// width below both.
const PAPERDOLL_LEFT = ['weapon', 'helmet', 'armor'];
const PAPERDOLL_RIGHT = ['gloves', 'pants', 'boots'];
const PLAYER_PORTRAIT_IMAGE = 'assets/ui/hero-portrait.png';

// Row centers as % of the stats-frame.png height, measured against its
// baked-in divider lines (banner "ESTATÍSTICAS" + 6 rows on a parchment
// scroll) so each stat sits right above its line in the artwork.
const STATS_ROW_POSITIONS = [18.2, 30.8, 42.9, 55.0, 67.1, 79.2];

function equipStatsBoxHtml(state) {
  const stats = computePlayerStats(state);
  const rows = [
    ['⚔️ Dano de Clique', formatNumber(stats.clickDamage)],
    ['💥 DPS', formatNumber(stats.dps)],
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

function equipRingContentHtml(state, filterElement = null) {
  const filtered = filterElement
    ? state.inventory.filter((entry) => getItem(entry.itemId)?.element === filterElement)
    : state.inventory;
  const inventoryHtml = filtered.length
    ? filtered.map((entry) => inventoryTileHtml(state, entry)).join('')
    : state.inventory.length
      ? `<p class="empty-slot">Nenhum item desse elemento.</p>`
      : `<p class="empty-slot">Nada craftado ainda. Vá até a aba Forjar.</p>`;

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
      ${setBonusBannerHtml(state)}
      <div class="equip-inventory-header">Inventário</div>
      ${elementFilterRowHtml(filterElement)}
      <div class="equip-inventory-grid">${inventoryHtml}</div>
    </div>
  `;
}

function slotIconHtml(state, slot) {
  const equipped = getEquippedEntry(state, slot.id);
  const icon = equipped
    ? iconMarkup(equipped.item.image, equipped.item.emoji, equipped.item.name)
    : slot.emoji;
  const badge = equipped
    ? `<span class="mini-badge ${equipped.entry.isMaster ? 'master' : ''}">${getEnhanceLabel(equipped.entry.enhanceLevel, equipped.entry.isMaster)}</span>`
    : '';
  return `<button class="equip-slot-icon ${equipped ? 'filled' : 'empty'}" data-equip-slot="${slot.id}" title="${slot.name}">
    <span class="icon">${icon}</span>
    ${badge}
  </button>`;
}

function inventoryTileHtml(state, entry) {
  const item = getItem(entry.itemId);
  const isEquipped = state.equipped[item.slotId] === entry.uid;
  const label = getEnhanceLabel(entry.enhanceLevel, entry.isMaster);
  return `<button class="inventory-tile ${isEquipped ? 'equipped' : ''}" data-equip-item="${entry.uid}" title="${item.name}">
    <span class="icon">${iconMarkup(item.image, item.emoji, item.name)}</span>
    <span class="mini-badge ${entry.isMaster ? 'master' : ''}">${label}</span>
  </button>`;
}

/// Opens the detail popup for whatever is (or isn't) equipped in a slot.
export function showEquipSlotModal(state, slotId) {
  const slot = getSlot(slotId);
  const uid = state.equipped[slotId];
  if (uid) {
    showModal(`${slot.emoji} ${slot.name}`, itemDetailHtml(state, uid, false));
  } else {
    showModal(`${slot.emoji} ${slot.name}`, `
      <div class="item-detail">
        <div class="item-detail-icon">${slot.emoji}</div>
        <p style="color:var(--text-dim); font-size:12.5px;">Nenhum item equipado neste slot ainda. Crafte um na aba Forjar.</p>
      </div>
    `);
  }
}

/// Opens the detail popup for a specific inventory item (equipped or not).
/// pickerOpen controls whether the card-picker sub-panel starts expanded
/// (only true right after the player clicks "Equipar Carta" — see main.js).
export function showItemDetailModal(state, uid, pickerOpen = false, confirmDestroy = false) {
  const entry = state.inventory.find((i) => i.uid === uid);
  if (!entry) return;
  const item = getItem(entry.itemId);
  const slot = getSlot(item.slotId);
  showModal(`${slot.emoji} ${slot.name}`, itemDetailHtml(state, uid, pickerOpen, confirmDestroy));
}

function itemDetailHtml(state, uid, pickerOpen, confirmDestroy = false) {
  const entry = state.inventory.find((i) => i.uid === uid);
  const item = getItem(entry.itemId);
  const slot = getSlot(item.slotId);
  const enhancedStats = getEnhancedStats(item, entry.enhanceLevel, entry.isMaster);
  const label = getEnhanceLabel(entry.enhanceLevel, entry.isMaster);
  const isEquipped = state.equipped[item.slotId] === uid;

  const resistanceLine = slot.kind === 'defense'
    ? `<div class="element-resistance">${elementBadgeHtml(item.element)} +${Math.round(ELEMENT_RESISTANCE_PER_PIECE * 100)}% resistência</div>`
    : `<div class="element-resistance">${elementBadgeHtml(item.element)} elemento de ataque</div>`;

  const actionBtn = isEquipped
    ? `<button class="modal-action-btn" data-modal-unequip="${item.slotId}">Desequipar</button>`
    : `<button class="modal-action-btn" data-modal-equip="${uid}">Equipar</button>`;

  return `
    <div class="item-detail">
      <div class="item-detail-icon">${iconMarkup(item.image, item.emoji, item.name)}</div>
      <div class="item-detail-name">${item.name} <span class="enhance-badge ${entry.isMaster ? 'master' : ''}">${label}</span></div>
      <div class="item-detail-stats">${formatStatsLines(enhancedStats).join('<br>')}</div>
      ${resistanceLine}
      ${cardSlotHtml(state, uid, entry, pickerOpen, item)}
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
// card can go in any item's slot. The slot itself has three states:
//   1. locked — the item was just crafted, must be unlocked first (RNG,
//      paid in that item's own boss Crystal — see attemptCardSlotUnlock())
//   2. unlocked, empty — either closed (a button to open the picker) or with
//      the picker expanded (pickerOpen), listing every owned card
//   3. unlocked, filled — the socketed card, with a Remover button
function cardSlotHtml(state, uid, entry, pickerOpen, item) {
  const unlocked = entry.cardSlotUnlocked || !!entry.cardId;

  if (!unlocked) {
    const crystalInfo = findMaterialInfo(item.crystalMaterialId);
    const haveCrystal = state.materials[item.crystalMaterialId] || 0;
    const canAttempt = canAttemptCardSlotUnlock(state, uid);
    return `<div class="card-slot-locked">
      <div class="card-slot-label">🔒 Slot de Carta bloqueado</div>
      <div class="card-slot-unlock-info">${Math.round(CARD_SLOT_UNLOCK_CHANCE * 100)}% de chance de sucesso · custo: 1 <span class="icon">${iconMarkup(crystalInfo.image, crystalInfo.emoji, crystalInfo.name)}</span> ${crystalInfo.name} (você tem ${formatNumber(haveCrystal)})</div>
      <button class="card-slot-unlock-btn" data-unlock-card-slot="${uid}" ${canAttempt ? '' : 'disabled'}>Tentar Desbloquear</button>
    </div>`;
  }

  // getCard() can miss for an old save's cardId (the roster that generates
  // CARDS was replaced — see data/cards.js) — fall through to the normal
  // empty-slot display below rather than crash on a stale reference.
  if (entry.cardId && getCard(entry.cardId)) {
    const card = getCard(entry.cardId);
    return `<div class="card-slot-badge filled">
      <span class="icon">${iconMarkup(card.image, card.emoji, card.name)}</span>
      <div class="card-slot-info">
        <div class="card-slot-name">${card.name}</div>
        <div class="card-slot-desc">${card.description}</div>
      </div>
      <button class="card-slot-remove" data-unsocket-uid="${uid}">Remover</button>
    </div>`;
  }

  if (!pickerOpen) {
    return `<div class="card-slot-badge">
      <span class="icon">🃏</span>
      <div class="card-slot-info"><div class="card-slot-name">Slot de Carta: vazio</div></div>
      <button class="card-slot-equip-btn" data-open-card-picker="${uid}">Equipar Carta</button>
    </div>`;
  }

  const owned = CARDS.filter((c) => (state.cards[c.id] || 0) > 0);
  if (!owned.length) {
    return `<div class="card-slot-picker">
      <div class="card-slot-label">🃏 Você ainda não tem nenhuma carta. Derrote monstros para conseguir uma.</div>
    </div>`;
  }

  return `<div class="card-slot-picker">
    <div class="card-slot-label">🃏 Escolha uma carta:</div>
    <div class="card-slot-options">${owned.map((c) => `
      <button class="card-slot-option" data-socket-uid="${uid}" data-socket-card-id="${c.id}" title="${c.description}">
        <span class="icon">${iconMarkup(c.image, c.emoji, c.name)}</span> ${c.name} <span class="qty">×${state.cards[c.id]}</span>
      </button>
    `).join('')}</div>
  </div>`;
}

function enhancePanelHtml(state, uid, entry, item) {
  if (entry.isMaster) {
    return `<div class="enhance-maxed">✨ Rank Master alcançado</div>`;
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

// Spoiler control: show every unlocked boss, plus exactly one preview of
// whatever comes next (so there's always something to look forward to)
// — everything further out stays a complete surprise instead of listing
// every future boss's name/element/art up front.
function forgeContentHtml(state, expandedForgeBosses) {
  const nextLockedIndex = BOSSES.findIndex((b) => b.stage > state.maxStage);
  const visibleBosses = nextLockedIndex === -1 ? BOSSES : BOSSES.slice(0, nextLockedIndex + 1);
  return visibleBosses.map((boss) => bossGroupHtml(state, boss, expandedForgeBosses)).join('');
}

function bossGroupHtml(state, boss, expandedForgeBosses) {
  const unlocked = state.maxStage >= boss.stage;
  const header = `<h3><span class="icon">${iconMarkup(boss.image, boss.emoji, boss.name)}</span> ${boss.name} ${elementBadgeHtml(boss.element)} <span style="color:var(--text-dim); font-weight:400; font-size:11px;">(Chefe do Estágio ${boss.stage})</span></h3>`;

  if (!unlocked) {
    return `<div class="family-group">
      ${header}
      <p style="color:var(--text-dim); font-size:12px;">🔒 Alcance o estágio ${boss.stage} para desbloquear.</p>
    </div>`;
  }

  const items = getItemsForBoss(boss.id);
  const expanded = expandedForgeBosses.has(boss.id);

  return `<div class="family-group">
    <div class="family-group-header">
      ${header}
      <button class="forge-toggle-btn" data-toggle-forge="${boss.id}">${expanded ? '▲ Recolher' : '▼ Expandir'}</button>
    </div>
    ${expanded ? `<div class="recipe-grid">${items.map((item) => recipeCardHtml(state, item)).join('')}</div>` : ''}
  </div>`;
}

function recipeCardHtml(state, item) {
  const craftable = canCraft(state, item.id);
  const equipped = state.equipped[item.slotId] && state.inventory.find((i) => i.uid === state.equipped[item.slotId])?.itemId === item.id;

  const costLines = Object.entries(item.materialCost).map(([matId, qty]) => {
    const matInfo = findMaterialInfo(matId);
    const have = state.materials[matId] || 0;
    const met = have >= qty;
    return `<div class="recipe-cost"><span><span class="icon">${iconMarkup(matInfo.image, matInfo.emoji, matInfo.name)}</span> ${matInfo.name}</span><span class="${met ? 'met' : 'missing'}">${formatNumber(have)}/${formatNumber(qty)}</span></div>`;
  }).join('');

  const goldMet = state.gold >= item.goldCost;

  return `<div class="recipe-card ${equipped ? 'equipped' : ''}">
    <div class="recipe-header"><span class="icon">${iconMarkup(item.image, item.emoji, item.name)}</span><span class="name">${item.name}</span></div>
    <div class="element-resistance">${elementBadgeHtml(item.element)}</div>
    <div class="recipe-stats">${formatStatsLines(item.stats).join('<br>')}</div>
    <div class="recipe-cost"><span>${GOLD_ICON} Ouro</span><span class="${goldMet ? 'met' : 'missing'}">${formatNumber(state.gold)}/${formatNumber(item.goldCost)}</span></div>
    ${costLines}
    <button data-craft="${item.id}" ${craftable ? '' : 'disabled'}>${equipped ? 'Craftado (equipado)' : 'Craftar'}</button>
  </div>`;
}

// Upgrade bonuses are always `level * valuePerLevel` — just formatted per
// stat type (percent stats get a %, everything else is flat).
function formatUpgradeBonus(stat, value) {
  if (stat.endsWith('Percent')) return `+${formatPercent(value)}`;
  return `+${formatNumber(value)}`;
}

function upgradeProgressHtml(upgrade, level) {
  const current = formatUpgradeBonus(upgrade.stat, level * upgrade.valuePerLevel);
  const next = formatUpgradeBonus(upgrade.stat, (level + 1) * upgrade.valuePerLevel);
  return `<div class="upgrade-progress">
    <span>Atual: <strong>${level > 0 ? current : '—'}</strong></span>
    <span class="arrow">→</span>
    <span>Próximo: <strong>${next}</strong></span>
  </div>`;
}

export function renderUpgradesTab(state) {
  const container = document.getElementById('tab-upgrades');
  container.innerHTML = `
    <div class="section-banner">Aprimoramentos</div>
    <div class="upgrade-list">${UPGRADES.map((u) => upgradeCardHtml(state, u)).join('')}</div>
  `;
}

function upgradeCardHtml(state, upgrade) {
  const level = getUpgradeLevel(state, upgrade.id);
  const cost = getUpgradeCost(state, upgrade.id);
  const affordable = state.gold >= cost;

  return `<div class="upgrade-card">
    <span class="icon">${upgrade.emoji}</span>
    <div class="info">
      <div class="name">${upgrade.name}</div>
      <div class="desc">${upgrade.description}</div>
      <div class="level">Nível ${level}</div>
      ${upgradeProgressHtml(upgrade, level)}
    </div>
    <button data-upgrade="${upgrade.id}" ${affordable ? '' : 'disabled'}>${GOLD_ICON} ${formatNumber(cost)}</button>
  </div>`;
}

// MONSTER_FAMILIES materials (lobo, javali etc.) are intentionally excluded
// here — leftovers from the pre-boss-roster v1 that nothing can drop
// anymore (see the comment atop MONSTER_FAMILIES in data/monsters.js).
// The live roster (BOSSES + WEAK_MONSTER_GROUPS) is also filtered to
// owned-only, so a material never spoils a boss/monster the player hasn't
// reached yet.
function materialsContentHtml(state) {
  const ownedMaterials = BOSSES.flatMap((b) => [b.materials.primary1, b.materials.primary2, b.crystal])
    .concat(WEAK_MONSTER_GROUPS.flatMap((g) => g.monsters).map((m) => m.material))
    .filter((m) => (state.materials[m.id] || 0) > 0);

  if (!ownedMaterials.length) {
    return `<p style="color:var(--text-dim); font-size:13px;">Nenhum material coletado ainda. Derrote monstros para conseguir materiais de craft.</p>`;
  }

  return `<div class="material-grid">${ownedMaterials.map((m) => `
    <div class="material-card">
      <div class="icon">${iconMarkup(m.image, m.emoji, m.name)}</div>
      <div class="name">${m.name}</div>
      <div class="qty">${formatNumber(state.materials[m.id] || 0)}</div>
    </div>`).join('')}</div>`;
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
// data/cards.js) across all 6 equip slots, and counts how many of those
// slots have their card slot unlocked at all (see systems/crafting.js's
// attemptCardSlotUnlock) — the two panels the mockup calls "Bônus das
// Cartas Ativas" and "Slot de Cartas".
const CARD_BONUS_LABELS = {
  dpsPercent: '💥 DPS', clickPercent: '⚔️ Dano de Clique', goldPercent: `${GOLD_ICON} Ouro Obtido`,
  dropPercent: '🎒 Chance de Drop', critChancePercent: '🎯 Chance Crítica', critDamagePercent: '💢 Dano Crítico',
  hpPercent: '❤️ Vida Máxima', armorPercent: '🛡️ Armadura', hpFlat: '❤️ Vida Máxima', armorFlat: '🛡️ Armadura',
  clickFlat: '⚔️ Dano de Clique', dpsFlat: '💥 DPS',
};

function cardsSummaryHtml(state) {
  const totals = {};
  let unlockedSlots = 0;
  for (const uid of Object.values(state.equipped)) {
    if (!uid) continue;
    const entry = state.inventory.find((i) => i.uid === uid);
    if (!entry) continue;
    if (entry.cardSlotUnlocked || entry.cardId) unlockedSlots += 1;
    if (!entry.cardId) continue;
    const card = getCard(entry.cardId);
    if (!card) continue;
    for (const b of card.bonuses || []) totals[b.stat] = (totals[b.stat] || 0) + b.value;
  }

  const rows = Object.entries(totals).filter(([, v]) => v).map(([stat, v]) => {
    const label = CARD_BONUS_LABELS[stat] || stat;
    const value = stat.endsWith('Percent') ? `+${formatPercent(v)}` : `+${formatNumber(v)}`;
    return `<div class="battle-info-row"><span>${label}</span><strong>${value}</strong></div>`;
  }).join('');

  return `
    <div class="cards-summary-box">
      <div class="equip-stats-title">✨ Bônus das Cartas Ativas</div>
      ${rows || '<p style="font-size:11px;color:var(--text-dim); margin:0;">Nenhuma carta equipada ainda.</p>'}
    </div>
    <div class="cards-summary-box">
      <div class="equip-stats-title">🎴 Slots de Carta</div>
      <div class="battle-info-row"><span>Desbloqueados</span><strong>${unlockedSlots}/6</strong></div>
    </div>
  `;
}

export function renderCardsTab(state) {
  const container = document.getElementById('tab-cards');
  const bossCards = CARDS.filter((c) => c.isBossCard);
  const commonCards = CARDS.filter((c) => !c.isBossCard);
  const bossOwned = bossCards.filter((c) => isCardDiscovered(state, c.id)).length;
  const commonOwned = commonCards.filter((c) => isCardDiscovered(state, c.id)).length;

  container.innerHTML = `
    <div class="section-banner">Cartas</div>
    ${cardsSummaryHtml(state)}
    <h3 class="cards-section-title">👑 Cartas de Boss <span class="cards-collected">Colecionadas: ${bossOwned}/${bossCards.length}</span></h3>
    <div class="card-grid">${bossCards.map((c) => cardTileHtml(state, c)).join('')}</div>
    <h3 class="cards-section-title">🃏 Cartas de Monstros <span class="cards-collected">Colecionadas: ${commonOwned}/${commonCards.length}</span></h3>
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

  return `
    <div class="card-detail ${discovered ? '' : 'undiscovered'}">
      <div class="card-detail-image">${iconMarkup(card.image, card.emoji, card.name)}</div>
      <div class="card-detail-info">
        <div class="card-detail-name">${card.name}</div>
        <div class="card-detail-desc">${card.description}</div>
        ${discovered ? `<div class="card-detail-owned">Você tem: ${formatNumber(owned)}</div>` : ''}
        ${actionHtml}
      </div>
    </div>
  `;
}

export function showCardDetailModal(state, cardId) {
  const card = getCard(cardId);
  if (!card) return;
  showModal(`${card.isBossCard ? '👑' : '🃏'} ${card.name}`, cardDetailHtml(state, card));
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
// player has beaten at least one boss (stage 10+) so there's an eligible
// boss to roll.
function invasaoChefesCanEnter(state) {
  if (state.eventBossHp != null) return false;
  const win = getEventWindow();
  if (!win.active) return false;
  if (isEventClaimed(state, win.cycleIndex)) return false;
  if (state.eventEnteredCycle === win.cycleIndex) return false;
  return BOSSES.some((b) => b.stage <= state.maxStage);
}

// The 3 empty "RECOMPENSAS" squares baked into the banner art are just a
// preview row (purely illustrative — real rewards are rolled/granted on
// victory, same as before), overlaid with 3 real icons positioned over
// the art's squares.
function rewardPreviewIconsHtml(icons) {
  return icons
    .map((src, i) => `<img class="invasion-reward-icon invasion-reward-${i + 1}" src="${src}" alt="">`)
    .join('');
}

function invasaoChefesBannerHtml(state) {
  const { label, value } = invasaoChefesStatusParts(state);
  const canEnter = invasaoChefesCanEnter(state);
  const rewardIcons = rewardPreviewIconsHtml([
    'assets/crystals/leviargon.png',
    'assets/cards/leviargon.png',
    'assets/ui/currency-event.png',
  ]);
  return `<div class="event-card event-card-invasion">
    <div class="invasion-banner" style="background-image: url('assets/ui/invasao-banner.png')">
      ${rewardIcons}
      <div class="invasion-status-box">
        <div class="invasion-status-label">${label}</div>
        <div class="invasion-status-value">${value}</div>
      </div>
      ${canEnter ? `<button class="invasion-enter-btn" data-event-enter>Entrar</button>` : ''}
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
          <button id="event-boss-sprite" class="event-boss-sprite" title="Clique para atacar">${iconMarkup(boss.image, boss.emoji, boss.name)}</button>
          <div class="event-hp-bar-outer"><div class="event-hp-bar-fill" style="width:${pct}%"></div><span class="event-hp-bar-text">${formatNumber(hp)} / ${formatNumber(maxHp)}</span></div>
          <p class="event-reward-info">🎁 10 itens ao derrotar (materiais/Cristal) + chance de Carta + ${EVENT_ICON} Moeda de Evento</p>
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
  ]);
  return `<div class="event-card event-card-invasion">
    <div class="invasion-banner" style="background-image: url('assets/ui/torre-banner.png')">
      ${rewardIcons}
      <div class="invasion-status-box">
        <div class="invasion-status-label">${label}</div>
        <div class="invasion-status-value">${value}</div>
      </div>
      ${canEnter ? `<button class="invasion-enter-btn" data-tower-enter>Entrar</button>` : ''}
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
          <button id="tower-monster-sprite" class="event-boss-sprite" title="Clique para atacar">${iconMarkup(monster.image, monster.emoji, monster.name)}</button>
          <div class="event-hp-bar-outer"><div class="event-hp-bar-fill" style="width:${pct}%"></div><span class="event-hp-bar-text">${formatNumber(state.towerMonsterHp)} / ${formatNumber(maxHp)}</span></div>
          <p class="event-sub">Sua vida na torre</p>
          <div class="event-hp-bar-outer"><div class="event-hp-bar-fill" style="width:${hpPlayerPct}%; background:var(--danger, #e05656);"></div><span class="event-hp-bar-text">${formatNumber(hp)} / ${formatNumber(towerMaxHp)}</span></div>
          <p class="event-reward-info">🎁 Recompensa ao final: ${EVENT_ICON} Moeda de Evento, conforme o nível alcançado.</p>
        </div>
      </div>
    </div>`;
}

export function renderEventsTab(state, towerRunRemainingMs = null, towerHp = null, towerMaxHp = null) {
  const container = document.getElementById('tab-events');
  container.innerHTML = `
    <div class="section-banner">Eventos</div>
    <div class="event-list">
    ${invasaoChefesBannerHtml(state)}
    ${state.eventBossHp != null ? invasaoChefesFightPanelHtml(state) : ''}
    ${torreProvacoesBannerHtml(state)}
    ${state.towerRunActive ? torreProvacoesFightPanelHtml(state, towerRunRemainingMs, towerHp, towerMaxHp) : ''}
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
    <div class="section-banner">Loja</div>
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

  const shopItemsHtml = CASH_SHOP_ITEMS.map((item) => `
    <div class="shop-item-card">
      <span class="icon">${item.emoji}</span>
      <div class="info">
        <div class="name">${item.name}</div>
        <div class="desc">${item.description}</div>
      </div>
      <button data-buy-cash="${item.id}" ${canBuyCashItem(state, item.id) ? '' : 'disabled'}>${ESMERALDA_ICON} ${item.cost}</button>
    </div>`).join('');

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
    const unlocked = state.maxStage >= boss.stage;
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
  el.textContent = isBurst ? `-${formatNumber(amount)} CLIQUE DEVASTADOR!` : isCrit ? `-${formatNumber(amount)} CRÍTICO!` : `-${formatNumber(amount)}`;
  // Wide, randomized spread on both axes — a fast clicker spawns several of
  // these within the same 750ms window, and a narrow fixed spot made them
  // pile up unreadably on top of each other (looking like clicks got
  // dropped even though every one of them landed).
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
  const parts = [`+${formatNumber(goldGained)} ${GOLD_ICON}`, ...drops.map((d) => `+${d.qty} ${d.emoji}`)];
  const el = document.createElement('div');
  el.className = 'loot-popup-entry';
  el.innerHTML = parts.join(' ');
  container.appendChild(el);
  while (container.childNodes.length > 3) container.removeChild(container.firstChild);
  setTimeout(() => el.remove(), 2500);
}

export function showToast(message) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

export function showModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

export function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
