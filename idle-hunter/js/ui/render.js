import { BOSSES, WEAK_MONSTER_GROUPS, findMaterialInfo, ZONES } from '../data/monsters.js';
import { getSlot, getItem, getEnhancedStats, getEnhanceLabel, getRarity, ENHANCE_MAX_LEVEL } from '../data/items.js';
import { UPGRADES } from '../data/upgrades.js';
import { getElement, elementDamageModifier, ELEMENT_RESISTANCE_PER_PIECE, ELEMENTS } from '../data/elements.js';
import { formatNumber, formatPercent } from '../format.js';
import { getEquippedEntry } from '../systems/equipment.js';
import { computePlayerStats } from '../systems/stats.js';
import { canEnhance, canUpgradeToMaster, ensureCardIds } from '../systems/crafting.js';
import { getUpgradeLevel, getUpgradeCost } from '../systems/upgrades.js';
import { isZoneUnlocked, isBossUnlocked, xpToNextLevel } from '../systems/leveling.js';
import { getEventWindow, getTowerWindow, TOWER_MAX_LEVEL, getGoldMineWindow, GOLDMINE_BOSS_HP } from '../data/events.js';
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
  return `<img class="element-badge-icon" src="${el.image}" alt="${el.name}" title="${el.name}">`;
}


const STAT_LABELS = {
  dpsFlat: (v) => `+${formatNumber(v)} DPS`,
  dpsPercent: (v) => `+${formatPercent(v)} DPS`,
  attackSpeedPercent: (v) => `+${formatPercent(v)} Velocidade de Ataque`,
  goldPercent: (v) => `+${formatPercent(v)} Ouro`,
  dropPercent: (v) => `+${formatPercent(v)} Chance de Material`,
  hpFlat: (v) => `+${formatNumber(v)} Vida`,
  armorFlat: (v) => `+${formatNumber(v)} Armadura`,
  hpPercent: (v) => `+${formatPercent(v)} Vida`,
  armorPercent: (v) => `+${formatPercent(v)} Armadura`,
  critChancePercent: (v) => `+${formatPercent(v)} Chance Crítica`,
  critDamagePercent: (v) => `+${formatPercent(v)} Dano Crítico`,
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
  document.getElementById('level-value').textContent = state.hunterLevel || 1;
}

/// Nível/XP do caçador — só libera zonas/chefes por enquanto (ver
/// systems/leveling.js), mostrado como uma barra de progresso simples.
export function renderHunterLevel(state) {
  const level = state.hunterLevel || 1;
  const xp = state.hunterXp || 0;
  const next = xpToNextLevel(level);
  document.getElementById('hunter-level-label').textContent = `Nível de Caça ${level}`;
  const pct = next > 0 ? Math.max(0, Math.min(100, (xp / next) * 100)) : 0;
  document.getElementById('hunter-xp-bar-fill').style.width = `${pct}%`;
  document.getElementById('hunter-xp-bar-text').textContent = `${formatNumber(xp)} / ${formatNumber(next)}`;
}

export function renderCombatStats(stats, monster) {
  document.getElementById('attack-speed-value').textContent = `${stats.attackSpeedPerSec.toFixed(2)}/s`;
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

// Listed as plain static string literals (not built via template-literal
// interpolation) on purpose — build-bundle.mjs's asset inliner only
// recognizes literal 'assets/...' paths in the source text, and a dynamic
// `scene${n}.png` path would either be missed or (worse) wrongly matched
// as one literal spanning the whole `${...}` expression.
const SCENE_IMAGES = [
  'assets/ui/scenes/scene1.png',
  'assets/ui/scenes/scene2.png',
  'assets/ui/scenes/scene3.png',
];

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
  const boss = monster.isBoss;

  // Weak monsters show one of the 3 real scene backgrounds, picked once per
  // spawn (see ensureMonsterSpawned in systems/combat.js — never re-picked
  // here, or the backdrop would flicker every render). Bosses use their own
  // `scene` when they have one (see monsters.js), otherwise fall back to
  // the plain CSS gradient backdrop (see #monster-area in style.css) by
  // clearing the inline background.
  const monsterArea = document.getElementById('monster-area');
  const bossScene = boss ? monster.scene : null;
  monsterArea.style.backgroundImage = bossScene
    ? `url('${bossScene}')`
    : monster.sceneIndex != null
      ? `url('${SCENE_IMAGES[monster.sceneIndex]}')`
      : '';
  // Per-boss override of the default `center 40%` (see #monster-area in
  // style.css) — lets a specific scene's focal point (e.g. a ground magic
  // circle) be nudged to line up with the monster sprite sitting on top of
  // it. Cleared back to '' (falls back to the stylesheet default) for
  // anything without its own scenePosition.
  monsterArea.style.backgroundPosition = bossScene ? (monster.scenePosition || '') : '';

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
    `${monster.name}${boss ? '<span class="boss-tag">CHEFE</span>' : ''} ${elementBadgeHtml(monster.element)}`;

  const hp = Math.max(0, state.monsterHp ?? monster.maxHp);
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
  const banner = `<img class="section-banner-img" src="assets/ui/titles/equipamentos.png" alt="Equipamentos">`;
  container.innerHTML = banner + equipRingContentHtml(state, filterElement);
}

function elementFilterRowHtml(filterElement) {
  const chips = [{ id: null, emoji: '📦', image: null, name: 'Todos' }, ...ELEMENTS];
  return `<div class="element-filter-row">${chips.map((el) => `
    <button class="element-filter-btn ${filterElement === el.id ? 'active' : ''} ${el.id ? `element-${el.id}` : ''}" data-filter-element="${el.id ?? ''}" title="${el.name}">${el.image ? `<img class="element-filter-icon" src="${el.image}" alt="">` : el.emoji}</button>
  `).join('')}</div>`;
}

// Sem craft: a antiga aba "Forja" (receitas) virou só o visualizador de
// Materiais (equipamentos agora dropam prontos dos monstros — ver
// data/items.js rollDroppedItem — o enhance/Master/socket de carta continua
// no popup de detalhe do item, aberto pela aba Equipamentos).
export function renderForgeTab(state) {
  const container = document.getElementById('tab-forge');
  const banner = `<img class="section-banner-img" src="assets/ui/titles/forja.png" alt="Materiais">`;
  container.innerHTML = banner + materialsContentHtml(state);
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
    ['⚡ Velocidade de Ataque', `${stats.attackSpeedPerSec.toFixed(2)}/s`],
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
      ${setBonusBannerHtml(state)}
      <div class="equip-inventory-header">Inventário</div>
      ${elementFilterRowHtml(filterElement)}
      <div class="equip-inventory-grid">${inventoryHtml}</div>
    </div>
  `;
}

// Small "N cards socketed" badge, bottom-left of an equipment icon — see
// .card-count-badge in style.css. Mirrors .mini-badge's enhance-level
// badge (bottom-right) but only shows once at least one card is socketed.
function cardCountBadgeHtml(entry) {
  const count = ensureCardIds(entry).filter(Boolean).length;
  return count > 0 ? `<span class="card-count-badge">🃏 ${count}</span>` : '';
}

function slotIconHtml(state, slot) {
  const equipped = getEquippedEntry(state, slot.id);
  const icon = equipped
    ? iconMarkup(equipped.item.image, equipped.item.emoji, equipped.item.name)
    : slot.emoji;
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

function inventoryTileHtml(state, entry) {
  const item = getItem(entry.itemId);
  const isEquipped = state.equipped[item.slotId] === entry.uid;
  const label = getEnhanceLabel(entry.enhanceLevel, entry.isMaster);
  const rarity = getRarity(entry.rarityId);
  return `<button class="inventory-tile has-rarity ${isEquipped ? 'equipped' : ''}" style="--rarity-color:${rarity.color};" data-equip-item="${entry.uid}" title="${item.name}">
    <span class="icon">${iconMarkup(item.image, item.emoji, item.name)}</span>
    <span class="mini-badge ${entry.isMaster ? 'master' : ''}">${label}</span>
    ${cardCountBadgeHtml(entry)}
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
  const item = getItem(entry.itemId);
  const slot = getSlot(item.slotId);
  showModal(`${slot.emoji} ${slot.name}`, itemDetailHtml(state, uid, pickerOpenSlot, confirmDestroy));
}

function itemDetailHtml(state, uid, pickerOpenSlot, confirmDestroy = false) {
  const entry = state.inventory.find((i) => i.uid === uid);
  const item = getItem(entry.itemId);
  const slot = getSlot(item.slotId);
  const enhancedStats = getEnhancedStats(entry);
  const label = getEnhanceLabel(entry.enhanceLevel, entry.isMaster);
  const rarity = getRarity(entry.rarityId);
  const isEquipped = state.equipped[item.slotId] === uid;

  const resistanceLine = slot.kind === 'defense'
    ? `<div class="element-resistance">${elementBadgeHtml(item.element)} +${Math.round(ELEMENT_RESISTANCE_PER_PIECE * 100)}% resistência</div>`
    : `<div class="element-resistance">${elementBadgeHtml(item.element)} elemento de ataque</div>`;

  const actionBtn = isEquipped
    ? `<button class="modal-action-btn" data-modal-unequip="${item.slotId}">Desequipar</button>`
    : `<button class="modal-action-btn" data-modal-equip="${uid}">Equipar</button>`;

  const cardSlotsHtml = ensureCardIds(entry)
    .map((cardId, slotIndex) => cardSlotHtml(state, uid, entry, pickerOpenSlot === slotIndex, slotIndex))
    .join('');

  return `
    <div class="item-detail">
      <div class="item-detail-icon" style="filter: drop-shadow(0 0 10px ${rarity.color});">${iconMarkup(item.image, item.emoji, item.name)}</div>
      <div class="item-detail-name">${item.name} <span class="enhance-badge ${entry.isMaster ? 'master' : ''}">${label}</span></div>
      <div class="item-detail-rarity" style="color:${rarity.color}; font-weight:800; font-size:12px;">${rarity.name}</div>
      <div class="item-detail-stats">${formatStatsLines(enhancedStats).join('<br>')}</div>
      ${resistanceLine}
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
      <span class="icon">🃏</span>
      <div class="card-slot-info"><div class="card-slot-name">Slot de Carta: vazio</div></div>
      <button class="card-slot-equip-btn" data-open-card-picker="${uid}" data-open-card-picker-slot="${slotIndex}">Equipar Carta</button>
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
      <button class="card-slot-option" data-socket-uid="${uid}" data-socket-slot="${slotIndex}" data-socket-card-id="${c.id}" title="${c.description}">
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
    <img class="section-banner-img" src="assets/ui/titles/aprimoramentos.png" alt="Aprimoramentos">
    <div class="upgrade-list">${UPGRADES.map((u) => upgradeCardHtml(state, u)).join('')}</div>
  `;
}

function upgradeCardHtml(state, upgrade) {
  const level = getUpgradeLevel(state, upgrade.id);
  const cost = getUpgradeCost(state, upgrade.id);
  const affordable = state.gold >= cost;

  return `<div class="upgrade-card">
    <span class="icon">${iconMarkup(upgrade.image, upgrade.emoji, upgrade.name)}</span>
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
    return `<p style="color:var(--text-dim); font-size:13px;">Nenhum material coletado ainda. Derrote monstros para conseguir materiais de aprimoramento.</p>`;
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
// data/cards.js) across all 6 equip slots (each slot can carry up to
// maxCardSlots(entry) cards — see systems/crafting.js) — the panel the
// mockup calls "Bônus das Cartas Ativas".
const CARD_BONUS_LABELS = {
  dpsPercent: '💥 DPS', attackSpeedPercent: '⚡ Velocidade de Ataque', goldPercent: `${GOLD_ICON} Ouro Obtido`,
  dropPercent: '🎒 Chance de Drop', critChancePercent: '🎯 Chance Crítica', critDamagePercent: '💢 Dano Crítico',
  hpPercent: '❤️ Vida Máxima', armorPercent: '🛡️ Armadura', hpFlat: '❤️ Vida Máxima', armorFlat: '🛡️ Armadura',
  dpsFlat: '💥 DPS',
};

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
    const value = stat.endsWith('Percent') ? `+${formatPercent(v)}` : `+${formatNumber(v)}`;
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

  container.innerHTML = `
    <img class="section-banner-img" src="assets/ui/titles/cartas.png" alt="Cartas">
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
        </div>
      </div>
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
