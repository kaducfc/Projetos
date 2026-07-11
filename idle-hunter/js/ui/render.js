import { MONSTER_FAMILIES, isBossStage } from '../data/monsters.js';
import { getSlot, getItemsForFamily, getItem, getEnhancedStats, getEnhanceLabel, ENHANCE_MAX_LEVEL } from '../data/items.js';
import { UPGRADES, PRESTIGE_UPGRADES } from '../data/upgrades.js';
import { getElement, elementDamageModifier, ELEMENT_RESISTANCE_PER_PIECE } from '../data/elements.js';
import { formatNumber, formatPercent } from '../format.js';
import { getEquippedEntry } from '../systems/equipment.js';
import { canCraft, canEnhance, canUpgradeToMaster } from '../systems/crafting.js';
import { getUpgradeLevel, getUpgradeCost, getPrestigeUpgradeLevel, getPrestigeUpgradeCost } from '../systems/upgrades.js';
import { canRebirth, runasGain, REBIRTH_MIN_STAGE } from '../systems/prestige.js';

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
  document.getElementById('runas-value').textContent = formatNumber(state.runas);
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
  document.getElementById('monster-sprite').innerHTML = iconMarkup(monster.image, monster.emoji, monster.name);
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

export function renderEquipmentTab(state) {
  const container = document.getElementById('tab-equipment');
  const leftSlots = LEFT_SLOT_IDS.map(getSlot);
  const rightSlots = RIGHT_SLOT_IDS.map(getSlot);

  const inventoryHtml = state.inventory.length
    ? state.inventory.map((entry) => inventoryTileHtml(state, entry)).join('')
    : `<p class="empty-slot">Nada craftado ainda. Vá até a aba Forja.</p>`;

  container.innerHTML = `
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

  container.querySelectorAll('[data-equip-slot]').forEach((btn) => {
    btn.addEventListener('click', () => showEquipSlotModal(state, btn.dataset.equipSlot));
  });
  container.querySelectorAll('[data-equip-item]').forEach((btn) => {
    btn.addEventListener('click', () => showItemDetailModal(state, Number(btn.dataset.equipItem)));
  });
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
    showModal(`${slot.emoji} ${slot.name}`, itemDetailHtml(state, uid));
  } else {
    showModal(`${slot.emoji} ${slot.name}`, `
      <div class="item-detail">
        <div class="item-detail-icon">${slot.emoji}</div>
        <p style="color:var(--text-dim); font-size:12.5px;">Nenhum item equipado neste slot ainda. Crafte um na aba Forja.</p>
      </div>
    `);
  }
}

/// Opens the detail popup for a specific inventory item (equipped or not).
export function showItemDetailModal(state, uid) {
  const entry = state.inventory.find((i) => i.uid === uid);
  if (!entry) return;
  const item = getItem(entry.itemId);
  const slot = getSlot(item.slotId);
  showModal(`${slot.emoji} ${slot.name}`, itemDetailHtml(state, uid));
}

function itemDetailHtml(state, uid) {
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
      <div class="card-slot-badge" title="Sistema de cartas ainda não implementado">🃏 Slot de Carta: vazio</div>
      ${enhancePanelHtml(state, uid, entry, item)}
      ${actionBtn}
    </div>
  `;
}

function enhancePanelHtml(state, uid, entry, item) {
  const family = MONSTER_FAMILIES.find((f) => f.id === item.familyId);

  if (entry.isMaster) {
    return `<div class="enhance-maxed">✨ Rank Master alcançado</div>`;
  }

  if (entry.enhanceLevel < ENHANCE_MAX_LEVEL) {
    const cost = item.enhanceCost[entry.enhanceLevel];
    const have = state.materials[item.commonMaterialId] || 0;
    const matInfo = family.materials.common;
    const met = have >= cost;
    return `<div class="enhance-panel">
      <div class="recipe-cost"><span>${matInfo.emoji} ${matInfo.name}</span><span class="${met ? 'met' : 'missing'}">${formatNumber(have)}/${formatNumber(cost)}</span></div>
      <button data-enhance="${uid}" ${canEnhance(state, uid) ? '' : 'disabled'}>Aprimorar para +${entry.enhanceLevel + 1}</button>
    </div>`;
  }

  const gemInfo = family.materials.gem;
  const haveGem = state.materials[gemInfo.id] || 0;
  const matInfo = family.materials.common;
  const haveMat = state.materials[item.commonMaterialId] || 0;
  const matMet = haveMat >= item.masterMaterialCost;
  return `<div class="enhance-panel">
    <div class="recipe-cost"><span>${matInfo.emoji} ${matInfo.name}</span><span class="${matMet ? 'met' : 'missing'}">${formatNumber(haveMat)}/${formatNumber(item.masterMaterialCost)}</span></div>
    <div class="recipe-cost"><span>${gemInfo.emoji} ${gemInfo.name}</span><span class="${haveGem >= 1 ? 'met' : 'missing'}">${formatNumber(haveGem)}/1</span></div>
    <button class="master-btn" data-master-upgrade="${uid}" ${canUpgradeToMaster(state, uid) ? '' : 'disabled'}>Evoluir para Rank Master</button>
  </div>`;
}

export function renderForgeTab(state) {
  const container = document.getElementById('tab-forge');
  container.innerHTML = MONSTER_FAMILIES.map((family) => familyGroupHtml(state, family)).join('');
}

function familyGroupHtml(state, family) {
  const items = getItemsForFamily(family.id);
  const unlocked = state.maxStage >= family.startStage;

  return `<div class="family-group">
    <h3><span class="icon">${iconMarkup(family.image, family.emoji, family.name)}</span> ${family.name} <span style="color:var(--text-dim); font-weight:400; font-size:11px;">(Estágios ${family.startStage}–${family.endStage})</span></h3>
    ${unlocked ? `<div class="recipe-grid">${items.map((item) => recipeCardHtml(state, item)).join('')}</div>`
      : `<p style="color:var(--text-dim); font-size:12px;">Alcance o estágio ${family.startStage} para desbloquear.</p>`}
  </div>`;
}

function recipeCardHtml(state, item) {
  const craftable = canCraft(state, item.id);
  const equipped = state.equipped[item.slotId] && state.inventory.find((i) => i.uid === state.equipped[item.slotId])?.itemId === item.id;

  const costLines = Object.entries(item.materialCost).map(([matId, qty]) => {
    const family = MONSTER_FAMILIES.find((f) => f.materials.common.id === matId || f.materials.rare.id === matId);
    const matInfo = family.materials.common.id === matId ? family.materials.common : family.materials.rare;
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
    </div>
    <button data-upgrade="${upgrade.id}" ${affordable ? '' : 'disabled'}>💰 ${formatNumber(cost)}</button>
  </div>`;
}

export function renderPrestigeTab(state) {
  const container = document.getElementById('tab-prestige');
  const gain = runasGain(state.maxStage);
  const eligible = canRebirth(state);

  container.innerHTML = `
    <div id="prestige-summary">
      <p>Renascer reseta seu ouro, upgrades comuns e estágio — mas seus <strong>equipamentos, materiais e upgrades de prestígio permanecem</strong>.</p>
      <p>É preciso alcançar o estágio ${REBIRTH_MIN_STAGE} para renascer pela primeira vez.</p>
      <p>Renascendo agora você ganha: <strong style="color:var(--runas)">🔮 ${formatNumber(gain)} Runas</strong></p>
      <button id="rebirth-btn" ${eligible ? '' : 'disabled'}>Renascer</button>
    </div>
    <div class="prestige-list">${PRESTIGE_UPGRADES.map((u) => prestigeCardHtml(state, u)).join('')}</div>
  `;
}

function prestigeCardHtml(state, upgrade) {
  const level = getPrestigeUpgradeLevel(state, upgrade.id);
  const cost = getPrestigeUpgradeCost(state, upgrade.id);
  const affordable = state.runas >= cost;

  return `<div class="prestige-card">
    <span class="icon">${upgrade.emoji}</span>
    <div class="info">
      <div class="name">${upgrade.name}</div>
      <div class="desc">${upgrade.description}</div>
      <div class="level">Nível ${level}</div>
    </div>
    <button data-prestige-upgrade="${upgrade.id}" ${affordable ? '' : 'disabled'}>🔮 ${formatNumber(cost)}</button>
  </div>`;
}

export function renderMaterialsTab(state) {
  const container = document.getElementById('tab-materials');
  const allMaterials = MONSTER_FAMILIES.flatMap((f) => [f.materials.common, f.materials.rare, f.materials.gem]);

  if (allMaterials.every((m) => (state.materials[m.id] || 0) === 0)) {
    container.innerHTML = `<p style="color:var(--text-dim); font-size:13px;">Nenhum material coletado ainda. Derrote monstros para conseguir materiais de craft.</p>`;
    return;
  }

  container.innerHTML = `<div class="material-grid">${allMaterials.map((m) => `
    <div class="material-card">
      <div class="icon">${m.emoji}</div>
      <div class="name">${m.name}</div>
      <div class="qty">${formatNumber(state.materials[m.id] || 0)}</div>
    </div>`).join('')}</div>`;
}

export function renderAll(state, monster, stats) {
  renderTopBar(state);
  renderCombatStats(stats, monster);
  renderMonster(state, monster);
  renderEquipmentTab(state);
  renderForgeTab(state);
  renderUpgradesTab(state);
  renderPrestigeTab(state);
  renderMaterialsTab(state);
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
