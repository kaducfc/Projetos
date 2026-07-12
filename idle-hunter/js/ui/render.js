import { MONSTER_FAMILIES, isBossStage, BOSSES, WEAK_MONSTER_GROUPS, findMaterialInfo } from '../data/monsters.js';
import { getSlot, getItemsForBoss, getItem, getEnhancedStats, getEnhanceLabel, ENHANCE_MAX_LEVEL } from '../data/items.js';
import { UPGRADES } from '../data/upgrades.js';
import { getElement, elementDamageModifier, ELEMENT_RESISTANCE_PER_PIECE } from '../data/elements.js';
import { formatNumber, formatPercent } from '../format.js';
import { getEquippedEntry } from '../systems/equipment.js';
import { canCraft, canEnhance, canUpgradeToMaster, canAttemptCardSlotUnlock, CARD_SLOT_UNLOCK_CHANCE } from '../systems/crafting.js';
import { getUpgradeLevel, getUpgradeCost } from '../systems/upgrades.js';
import { getEventWindow } from '../data/events.js';
import { isEventClaimed, computeEventBossMaxHp } from '../systems/events.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { isAchievementClaimed, isAchievementReady } from '../systems/achievements.js';
import { CASH_SHOP_ITEMS, CASH_REAL_MONEY_PACKAGES, AD_WATCH_CASH_REWARD, eventShopItemsForBoss } from '../data/shop.js';
import { canBuyCashItem, canBuyEventItem, adWatchCooldownRemaining } from '../systems/shop.js';
import { CARDS, getCard } from '../data/cards.js';
import { renderMonsterSprite } from './monsterAnim.js';

/// Real art if the family has it, emoji fallback otherwise. Sizing is left
/// to the caller: images are set to `width/height: 1em` in CSS so they scale
/// with whatever font-size the surrounding `.icon`-ish element already has.
function iconMarkup(image, emoji, alt) {
  return image ? `<img src="${image}" alt="${alt || ''}">` : emoji;
}

function elementBadgeHtml(elementId) {
  const el = getElement(elementId);
  return `<span class="element-badge element-${el.id}">${el.emoji} ${el.name}</span>`;
}

const ELEMENT_COLORS = {
  neutro: '#9a9ab0',
  fogo: '#ff6a3d',
  planta: '#4caf7d',
  eletrico: '#f4e04d',
  agua: '#5cc2ff',
};

/// Everything the doll needs to know about one equipped slot: the element
/// color (used for the tinted-shape fallback) and, when the family has real
/// art, the image to overlay instead of that shape.
function gearVisual(state, slotId) {
  const eq = getEquippedEntry(state, slotId);
  if (!eq) return null;
  return {
    color: ELEMENT_COLORS[eq.item.element] || ELEMENT_COLORS.neutro,
    image: eq.item.image || null,
    name: eq.item.name,
  };
}

/// Layered paper doll: a generic cartoon guy in swim trunks (SVG), with each
/// equipped piece drawn on top. Slots backed by real art (see
/// assets/chispim/) get their actual sprite overlaid via <img>; slots
/// without art fall back to a flat shape tinted by the item's element
/// color, same as before. Pure presentation — reads equipped state, renders
/// nothing interactive (clicks go to the slot icons around it).
function characterSvg(visuals) {
  const skin = '#f2c19b';
  const skinShade = '#e0a87e';
  const hair = '#4a3626';
  const trunk = '#e2445c';
  const blade = '#cfd6e4';

  // Only render the tinted-shape fallback when there's no real image for
  // that slot — otherwise the <img> overlay (see gearOverlaysHtml) covers it.
  const helmet = visuals.helmet && !visuals.helmet.image ? visuals.helmet.color : null;
  const chest = visuals.armor && !visuals.armor.image ? visuals.armor.color : null;
  const pants = visuals.pants && !visuals.pants.image ? visuals.pants.color : null;
  const gloves = visuals.gloves && !visuals.gloves.image ? visuals.gloves.color : null;
  const boots = visuals.boots && !visuals.boots.image ? visuals.boots.color : null;
  const weapon = visuals.weapon && !visuals.weapon.image ? visuals.weapon.color : null;

  return `<svg viewBox="0 0 120 200" width="110" height="184" role="img" aria-label="Seu personagem">
    <g stroke="#14141c" stroke-width="2" stroke-linejoin="round">
      <!-- arms (behind torso) -->
      <rect x="30" y="66" width="11" height="42" rx="5.5" fill="${skin}" />
      <rect x="79" y="66" width="11" height="42" rx="5.5" fill="${skin}" />
      <!-- legs + feet -->
      <rect x="47" y="110" width="11" height="62" rx="5" fill="${skin}" />
      <rect x="62" y="110" width="11" height="62" rx="5" fill="${skin}" />
      <ellipse cx="51" cy="175" rx="9" ry="5" fill="${skinShade}" />
      <ellipse cx="69" cy="175" rx="9" ry="5" fill="${skinShade}" />
      <!-- torso -->
      <rect x="42" y="60" width="36" height="54" rx="11" fill="${skin}" />
      <!-- sunga (always on) -->
      <path d="M42 97 h36 v9 q-8 9 -18 9 q-10 0 -18 -9 z" fill="${trunk}" />
      <line x1="42" y1="99" x2="78" y2="99" stroke="#a32b42" />
      ${pants ? `
        <rect x="45" y="100" width="14" height="64" rx="6" fill="${pants}" />
        <rect x="61" y="100" width="14" height="64" rx="6" fill="${pants}" />
        <rect x="42" y="97" width="36" height="9" rx="3" fill="${pants}" />` : ''}
      ${boots ? `
        <rect x="44" y="154" width="14" height="18" rx="4" fill="${boots}" />
        <rect x="62" y="154" width="14" height="18" rx="4" fill="${boots}" />
        <ellipse cx="51" cy="175" rx="10" ry="5.5" fill="${boots}" />
        <ellipse cx="69" cy="175" rx="10" ry="5.5" fill="${boots}" />` : ''}
      ${chest ? `
        <rect x="40" y="58" width="40" height="48" rx="10" fill="${chest}" />
        <circle cx="40" cy="66" r="8" fill="${chest}" />
        <circle cx="80" cy="66" r="8" fill="${chest}" />
        <line x1="60" y1="64" x2="60" y2="100" stroke="#14141c" stroke-opacity="0.35" />` : ''}
      <!-- head -->
      <circle cx="60" cy="38" r="21" fill="${skin}" />
      <path d="M39 36 a21 21 0 0 1 42 0 z" fill="${hair}" />
      ${helmet ? `
        <path d="M37 38 a23 23 0 0 1 46 0 z" fill="${helmet}" />
        <rect x="35" y="36" width="50" height="7" rx="3.5" fill="${helmet}" />` : ''}
      <!-- face (drawn after helmet so it never gets covered) -->
      <circle cx="53" cy="42" r="2.4" fill="#222" stroke="none" />
      <circle cx="67" cy="42" r="2.4" fill="#222" stroke="none" />
      <path d="M53 50 q7 6 14 0" stroke="#222" fill="none" stroke-width="2" stroke-linecap="round" />
      ${weapon ? `
        <polygon points="84,104 91,56 97,61 90,106" fill="${blade}" />
        <circle cx="87" cy="103" r="3.6" fill="${weapon}" />
        <polygon points="36,104 29,56 23,61 30,106" fill="${blade}" />
        <circle cx="33" cy="103" r="3.6" fill="${weapon}" />` : ''}
      <!-- hands (over blade hilts so the grip reads as "holding") -->
      <circle cx="35.5" cy="111" r="6" fill="${skin}" />
      <circle cx="84.5" cy="111" r="6" fill="${skin}" />
      ${gloves ? `
        <circle cx="35.5" cy="111" r="7.5" fill="${gloves}" />
        <rect x="29" y="100" width="13" height="7" rx="3" fill="${gloves}" />
        <circle cx="84.5" cy="111" r="7.5" fill="${gloves}" />
        <rect x="78" y="100" width="13" height="7" rx="3" fill="${gloves}" />` : ''}
    </g>
  </svg>`;
}

// Anchor point (center, as % of the 110×184 doll box) + width (as % of box
// width) for each slot's real-art overlay. z-index controls draw order —
// roughly back-to-front the way a person gets dressed, with the weapon
// last so it reads as held in front of the hands.
const GEAR_OVERLAY_ANCHORS = {
  weapon: { left: 50, top: 57, width: 96, z: 6 },
  pants: { left: 50, top: 68, width: 38, z: 2 },
  boots: { left: 50, top: 90, width: 36, z: 3 },
  armor: { left: 50, top: 46, width: 50, z: 4 },
  helmet: { left: 50, top: 17, width: 46, z: 5 },
  gloves: { left: 50, top: 55, width: 48, z: 7 },
};

function gearOverlaysHtml(visuals) {
  return Object.entries(visuals)
    .filter(([, v]) => v && v.image)
    .map(([slotId, v]) => {
      const a = GEAR_OVERLAY_ANCHORS[slotId];
      return `<img class="gear-overlay" src="${v.image}" alt="${v.name}"
        style="left:${a.left}%; top:${a.top}%; width:${a.width}%; z-index:${a.z};">`;
    })
    .join('');
}

/// Combines the base SVG doll with real-art overlays into the final markup
/// for `.equip-character`.
function characterVisual(state) {
  const visuals = {
    helmet: gearVisual(state, 'helmet'),
    armor: gearVisual(state, 'armor'),
    pants: gearVisual(state, 'pants'),
    gloves: gearVisual(state, 'gloves'),
    boots: gearVisual(state, 'boots'),
    weapon: gearVisual(state, 'weapon'),
  };
  return `<div class="character-visual">${characterSvg(visuals)}${gearOverlaysHtml(visuals)}</div>`;
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

  const weaponEl = document.getElementById('weapon-element-value');
  weaponEl.innerHTML = elementBadgeHtml(stats.weaponElement);

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
  renderMonsterSprite(monster);
  document.getElementById('monster-name').innerHTML =
    `${monster.name}${boss ? '<span class="boss-tag">CHEFE</span>' : ''} ${elementBadgeHtml(monster.element)}`;
  document.getElementById('stage-label').textContent = `Estágio ${state.stage}`;

  const hp = Math.max(0, state.monsterHp ?? monster.maxHp);
  const pct = Math.max(0, Math.min(100, (hp / monster.maxHp) * 100));
  document.getElementById('hp-bar-fill').style.width = `${pct}%`;
  document.getElementById('hp-bar-text').textContent = `${formatNumber(hp)} / ${formatNumber(monster.maxHp)}`;

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

// Left/right split of the 6 slots around the character avatar (see the
// reference layout: weapon + upper-body gear on one side, the rest on the
// other). Purely cosmetic grouping — any slot can go in either side.
const LEFT_SLOT_IDS = ['helmet', 'armor', 'weapon'];
const RIGHT_SLOT_IDS = ['pants', 'gloves', 'boots'];

// The Equipment tab now also houses Forja and Materiais as sub-tabs (they
// used to be top-level tabs) — one less thing competing for space in the
// tab-nav, and thematically all three are "stuff about your gear" anyway.
// `activeSubTab` is owned by main.js (transient UI state, not part of the
// save), same pattern as Shop's Cash/Event split. All interactive elements
// here (subtab buttons, equip slots/inventory tiles, craft buttons) are
// handled by ONE delegated listener on #tab-equipment wired once in
// main.js's init() — see wireEquipmentTabEvents() — since this tab
// re-renders very often (every kill) and per-render re-wiring is exactly
// the bug class that bit this project twice before.
const EQUIP_SUBTABS = [
  { id: 'equip', label: '🎽 Equipar' },
  { id: 'forge', label: '🔨 Forjar' },
  { id: 'materials', label: '🎒 Materiais' },
  { id: 'cards', label: '🃏 Cartas' },
];

export function renderEquipmentTab(state, activeSubTab = 'equip') {
  const container = document.getElementById('tab-equipment');
  const subnav = `<div class="inner-subnav">${EQUIP_SUBTABS.map((t) => `
    <button class="inner-subtab-btn ${activeSubTab === t.id ? 'active' : ''}" data-equip-subtab="${t.id}">${t.label}</button>
  `).join('')}</div>`;

  let body;
  if (activeSubTab === 'forge') body = forgeContentHtml(state);
  else if (activeSubTab === 'materials') body = materialsContentHtml(state);
  else if (activeSubTab === 'cards') body = cardsContentHtml(state);
  else body = equipRingContentHtml(state);

  container.innerHTML = subnav + body;
}

function equipRingContentHtml(state) {
  const leftSlots = LEFT_SLOT_IDS.map(getSlot);
  const rightSlots = RIGHT_SLOT_IDS.map(getSlot);

  const inventoryHtml = state.inventory.length
    ? state.inventory.map((entry) => inventoryTileHtml(state, entry)).join('')
    : `<p class="empty-slot">Nada craftado ainda. Vá até a aba Forjar.</p>`;

  return `
    <div class="equip-screen">
      <div class="equip-ring">
        <div class="equip-side">${leftSlots.map((s) => slotIconHtml(state, s)).join('')}</div>
        <div class="equip-character">${characterVisual(state)}</div>
        <div class="equip-side">${rightSlots.map((s) => slotIconHtml(state, s)).join('')}</div>
      </div>
      <div class="equip-inventory-header">Inventário</div>
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
export function showItemDetailModal(state, uid, pickerOpen = false) {
  const entry = state.inventory.find((i) => i.uid === uid);
  if (!entry) return;
  const item = getItem(entry.itemId);
  const slot = getSlot(item.slotId);
  showModal(`${slot.emoji} ${slot.name}`, itemDetailHtml(state, uid, pickerOpen));
}

function itemDetailHtml(state, uid, pickerOpen) {
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
      ${actionBtn}
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
      <div class="card-slot-unlock-info">${Math.round(CARD_SLOT_UNLOCK_CHANCE * 100)}% de chance de sucesso · custo: 1 ${crystalInfo.emoji} ${crystalInfo.name} (você tem ${formatNumber(haveCrystal)})</div>
      <button class="card-slot-unlock-btn" data-unlock-card-slot="${uid}" ${canAttempt ? '' : 'disabled'}>Tentar Desbloquear</button>
    </div>`;
  }

  // getCard() can miss for an old save's cardId (the roster that generates
  // CARDS was replaced — see data/cards.js) — fall through to the normal
  // empty-slot display below rather than crash on a stale reference.
  if (entry.cardId && getCard(entry.cardId)) {
    const card = getCard(entry.cardId);
    return `<div class="card-slot-badge filled">
      <span class="icon">${card.emoji}</span>
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
        ${c.emoji} ${c.name} <span class="qty">×${state.cards[c.id]}</span>
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
    const have = state.materials[item.commonMaterialId] || 0;
    const matInfo = findMaterialInfo(item.commonMaterialId);
    const met = have >= cost;
    return `<div class="enhance-panel">
      <div class="recipe-cost"><span>${matInfo.emoji} ${matInfo.name}</span><span class="${met ? 'met' : 'missing'}">${formatNumber(have)}/${formatNumber(cost)}</span></div>
      <button data-enhance="${uid}" ${canEnhance(state, uid) ? '' : 'disabled'}>Aprimorar para +${entry.enhanceLevel + 1}</button>
    </div>`;
  }

  const crystalInfo = findMaterialInfo(item.crystalMaterialId);
  const haveCrystal = state.materials[item.crystalMaterialId] || 0;
  const matInfo = findMaterialInfo(item.commonMaterialId);
  const haveMat = state.materials[item.commonMaterialId] || 0;
  const matMet = haveMat >= item.masterMaterialCost;
  return `<div class="enhance-panel">
    <div class="recipe-cost"><span>${matInfo.emoji} ${matInfo.name}</span><span class="${matMet ? 'met' : 'missing'}">${formatNumber(haveMat)}/${formatNumber(item.masterMaterialCost)}</span></div>
    <div class="recipe-cost"><span>${crystalInfo.emoji} ${crystalInfo.name}</span><span class="${haveCrystal >= 1 ? 'met' : 'missing'}">${formatNumber(haveCrystal)}/1</span></div>
    <button class="master-btn" data-master-upgrade="${uid}" ${canUpgradeToMaster(state, uid) ? '' : 'disabled'}>Evoluir para Rank Master</button>
  </div>`;
}

function forgeContentHtml(state) {
  return BOSSES.map((boss) => bossGroupHtml(state, boss)).join('');
}

function bossGroupHtml(state, boss) {
  const items = getItemsForBoss(boss.id);
  const unlocked = state.maxStage >= boss.stage;

  return `<div class="family-group">
    <h3><span class="icon">${iconMarkup(boss.image, boss.emoji, boss.name)}</span> ${boss.name} ${elementBadgeHtml(boss.element)} <span style="color:var(--text-dim); font-weight:400; font-size:11px;">(Chefe do Estágio ${boss.stage})</span></h3>
    ${unlocked ? `<div class="recipe-grid">${items.map((item) => recipeCardHtml(state, item)).join('')}</div>`
      : `<p style="color:var(--text-dim); font-size:12px;">🔒 Alcance o estágio ${boss.stage} para desbloquear.</p>`}
  </div>`;
}

function recipeCardHtml(state, item) {
  const craftable = canCraft(state, item.id);
  const equipped = state.equipped[item.slotId] && state.inventory.find((i) => i.uid === state.equipped[item.slotId])?.itemId === item.id;

  const costLines = Object.entries(item.materialCost).map(([matId, qty]) => {
    const matInfo = findMaterialInfo(matId);
    const have = state.materials[matId] || 0;
    const met = have >= qty;
    return `<div class="recipe-cost"><span>${matInfo.emoji} ${matInfo.name}</span><span class="${met ? 'met' : 'missing'}">${formatNumber(have)}/${formatNumber(qty)}</span></div>`;
  }).join('');

  const goldMet = state.gold >= item.goldCost;

  return `<div class="recipe-card ${equipped ? 'equipped' : ''}">
    <div class="recipe-header"><span class="icon">${iconMarkup(item.image, item.emoji, item.name)}</span><span class="name">${item.name}</span></div>
    <div class="element-resistance">${elementBadgeHtml(item.element)}</div>
    <div class="recipe-stats">${formatStatsLines(item.stats).join('<br>')}</div>
    <div class="recipe-cost"><span>💰 Ouro</span><span class="${goldMet ? 'met' : 'missing'}">${formatNumber(state.gold)}/${formatNumber(item.goldCost)}</span></div>
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
  container.innerHTML = `<div class="upgrade-list">${UPGRADES.map((u) => upgradeCardHtml(state, u)).join('')}</div>`;
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
    <button data-upgrade="${upgrade.id}" ${affordable ? '' : 'disabled'}>💰 ${formatNumber(cost)}</button>
  </div>`;
}

function materialsContentHtml(state) {
  const allMaterials = MONSTER_FAMILIES.flatMap((f) => [f.materials.common, f.materials.rare, f.materials.gem])
    .concat(BOSSES.flatMap((b) => [b.materials.primary1, b.materials.primary2, b.crystal]))
    .concat(WEAK_MONSTER_GROUPS.flatMap((g) => g.monsters).map((m) => m.material));

  if (allMaterials.every((m) => (state.materials[m.id] || 0) === 0)) {
    return `<p style="color:var(--text-dim); font-size:13px;">Nenhum material coletado ainda. Derrote monstros para conseguir materiais de craft.</p>`;
  }

  return `<div class="material-grid">${allMaterials.map((m) => `
    <div class="material-card">
      <div class="icon">${m.emoji}</div>
      <div class="name">${m.name}</div>
      <div class="qty">${formatNumber(state.materials[m.id] || 0)}</div>
    </div>`).join('')}</div>`;
}

// Cards drop rarely from any monster of their family (see systems/combat.js)
// and just sit in this inventory for now — there's no socketing UI yet
// (see data/cards.js), so this is purely a "what have I collected" view.
function cardsContentHtml(state) {
  const owned = CARDS.filter((c) => (state.cards[c.id] || 0) > 0);

  if (!owned.length) {
    return `<p style="color:var(--text-dim); font-size:13px;">Nenhuma carta coletada ainda. Monstros têm uma pequena chance de dropar a carta deles ao morrer.</p>`;
  }

  return `<div class="material-grid">${owned.map((c) => `
    <div class="material-card card-item">
      <div class="icon">${c.emoji}</div>
      <div class="name">${c.name}</div>
      <div class="card-desc">${c.description}</div>
      <div class="qty">${formatNumber(state.cards[c.id] || 0)}</div>
    </div>`).join('')}</div>`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ---------------------------------------------------------------
// Events tab: a rotating event boss, fought by clicking only (see
// systems/events.js and main.js's onClickEventBoss for why there's no
// passive-DPS tick here). `engagementRemainingMs` is owned by main.js (a
// transient, un-persisted "time left in this attempt" clock, same idea as
// the regular boss timer) — null means no attempt is in progress yet.
// ---------------------------------------------------------------

export function renderEventsTab(state, engagementRemainingMs) {
  const container = document.getElementById('tab-events');
  const win = getEventWindow();
  const claimed = isEventClaimed(state, win.cycleIndex);

  if (!win.active || claimed) {
    // The *next* window's boss isn't win.boss (that's whoever is/was up
    // this cycle) — it's whichever boss the next cycle index lands on.
    const nextBoss = BOSSES[(win.cycleIndex + 1) % BOSSES.length];
    const heading = claimed ? 'Evento concluído!' : 'Nenhum evento ativo agora';
    const sub = claimed
      ? 'Você já derrotou o chefe de evento deste ciclo.'
      : 'Volte quando o próximo ciclo começar.';
    container.innerHTML = `
      <div class="event-panel">
        <div class="event-icon dim">🎪</div>
        <h3>${heading}</h3>
        <p class="event-sub">${sub}</p>
        <p class="event-next">Próximo: ${iconMarkup(nextBoss.image, nextBoss.emoji, nextBoss.name)} <strong>${nextBoss.name}</strong> em <strong>${formatDuration(win.msUntilNextWindow)}</strong></p>
      </div>`;
    return;
  }

  const maxHp = state.eventBossMaxHp ?? computeEventBossMaxHp(win.boss);
  const hp = state.eventBossHp ?? maxHp;
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const timerHtml = engagementRemainingMs != null
    ? `<div class="event-countdown ${engagementRemainingMs <= 10000 ? 'urgent' : ''}">⏱ ${Math.ceil(engagementRemainingMs / 1000)}s para derrotar!</div>`
    : `<div class="event-countdown hint">Clique para começar a atacar</div>`;

  container.innerHTML = `
    <div class="event-panel">
      <div class="event-active-badge">🎪 Evento ativo — janela fecha em ${formatDuration(win.remainingActiveMs)}</div>
      <h3>${win.boss.name} <span class="boss-tag">EVENTO</span> ${elementBadgeHtml(win.boss.element)}</h3>
      <button id="event-boss-sprite" class="event-boss-sprite" title="Clique para atacar">${iconMarkup(win.boss.image, win.boss.emoji, win.boss.name)}</button>
      <div class="event-hp-bar-outer"><div class="event-hp-bar-fill" style="width:${pct}%"></div><span class="event-hp-bar-text">${formatNumber(hp)} / ${formatNumber(maxHp)}</span></div>
      ${timerHtml}
      <p class="event-reward-info">🎁 Recompensa ao derrotar: 1–6 materiais + 🎫 Moeda de Evento</p>
    </div>`;
}

export function pulseEventBoss() {
  const sprite = document.getElementById('event-boss-sprite');
  if (!sprite) return;
  sprite.classList.remove('hit');
  void sprite.offsetWidth; // restart animation
  sprite.classList.add('hit');
}

// ---------------------------------------------------------------
// Achievements tab: the "earn Cash" side (achievement claims + the
// simulated ad-watch reward), split out from the Shop, which is purely
// "spend Cash / spend Event Currency" now.
// ---------------------------------------------------------------

export function renderAchievementsTab(state) {
  const container = document.getElementById('tab-achievements');
  const cooldownMs = adWatchCooldownRemaining(state);
  const adReady = cooldownMs <= 0;

  const achievementsHtml = ACHIEVEMENTS.map((a) => {
    const claimed = isAchievementClaimed(state, a.id);
    const ready = isAchievementReady(state, a);
    const statusBtn = claimed
      ? `<button disabled>Resgatado</button>`
      : `<button data-claim-achievement="${a.id}" ${ready ? '' : 'disabled'}>💎 +${a.cashReward}</button>`;
    return `<div class="achievement-card ${claimed ? 'claimed' : ''}">
      <span class="icon">${a.emoji}</span>
      <div class="info">
        <div class="name">${a.name}</div>
        <div class="desc">${a.description}</div>
      </div>
      ${statusBtn}
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="shop-balance">💎 Você tem <strong>${formatNumber(state.cash)}</strong> Cash</div>
    <button id="watch-ad-btn" class="watch-ad-btn" ${adReady ? '' : 'disabled'}>
      ${adReady ? '🎬 Assistir Anúncio (+' + AD_WATCH_CASH_REWARD + ' 💎)' : `🎬 Anúncio disponível em ${formatDuration(cooldownMs)}`}
    </button>
    <div class="achievement-list">${achievementsHtml}</div>
  `;
}

// ---------------------------------------------------------------
// Shop tab: Cash sub-tab (spend on gold packs, plus a disabled real-money
// package stub) and Event-currency sub-tab (per-boss Crystal/material
// bundles). `activeSubTab` is owned by main.js.
// ---------------------------------------------------------------

export function renderShopTab(state, activeSubTab) {
  const container = document.getElementById('tab-shop');
  container.innerHTML = `
    <div class="inner-subnav">
      <button class="inner-subtab-btn ${activeSubTab === 'cash' ? 'active' : ''}" data-shop-subtab="cash">💎 Cash</button>
      <button class="inner-subtab-btn ${activeSubTab === 'event' ? 'active' : ''}" data-shop-subtab="event">🎫 Moeda de Evento</button>
    </div>
    ${activeSubTab === 'event' ? eventShopHtml(state) : cashShopHtml(state)}
  `;
}

function cashShopHtml(state) {
  const packagesHtml = CASH_REAL_MONEY_PACKAGES.map((p) => `
    <div class="cash-package-card disabled" title="Requer integração de pagamento — ainda não disponível">
      <div class="icon">💎</div>
      <div class="name">${p.cashAmount} Cash</div>
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
      <button data-buy-cash="${item.id}" ${canBuyCashItem(state, item.id) ? '' : 'disabled'}>💎 ${item.cost}</button>
    </div>`).join('');

  return `
    <div class="shop-balance">💎 Você tem <strong>${formatNumber(state.cash)}</strong> Cash</div>
    <p class="shop-note">Ganhe Cash na aba 🏆 Conquistas.</p>

    <h4 class="shop-section-title">Comprar com Cash</h4>
    <div class="shop-item-grid">${shopItemsHtml}</div>

    <h4 class="shop-section-title">Comprar Cash (dinheiro real)</h4>
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
          <span class="icon">${item.emoji}</span>
          <div class="info">
            <div class="name">${item.name}</div>
          </div>
          <button data-buy-event-mat="${item.matId}" data-buy-event-amount="${item.amount}" data-buy-event-cost="${item.cost}" ${canBuyEventItem(state, item) ? '' : 'disabled'}>🎫 ${item.cost}</button>
        </div>`).join('')}</div>
    </div>`;
  }).join('');

  return `
    <div class="shop-balance event-variant">🎫 Você tem <strong>${formatNumber(state.eventCurrency)}</strong> Moeda de Evento</div>
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

export function spawnDamagePopup(amount) {
  const container = document.getElementById('damage-popups');
  const el = document.createElement('div');
  el.className = 'damage-popup';
  el.textContent = `-${formatNumber(amount)}`;
  el.style.left = `${45 + Math.random() * 10}%`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 750);
}

export function pulseMonster() {
  const sprite = document.getElementById('monster-sprite');
  sprite.classList.remove('hit');
  void sprite.offsetWidth; // restart animation
  sprite.classList.add('hit');
}

export function showToast(message) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
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
