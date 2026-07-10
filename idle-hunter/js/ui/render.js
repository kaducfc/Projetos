import { MONSTER_FAMILIES, isBossStage } from '../data/monsters.js';
import { SLOTS, getItemsForFamily } from '../data/items.js';
import { UPGRADES, PRESTIGE_UPGRADES } from '../data/upgrades.js';
import { formatNumber, formatPercent } from '../format.js';
import { getEquippedItem, getInventoryForSlot } from '../systems/equipment.js';
import { canCraft } from '../systems/crafting.js';
import { getUpgradeLevel, getUpgradeCost, getPrestigeUpgradeLevel, getPrestigeUpgradeCost } from '../systems/upgrades.js';
import { canRebirth, runasGain, REBIRTH_MIN_STAGE } from '../systems/prestige.js';

const STAT_LABELS = {
  clickFlat: (v) => `+${formatNumber(v)} Dano de Clique`,
  dpsFlat: (v) => `+${formatNumber(v)} DPS`,
  clickPercent: (v) => `+${formatPercent(v)} Dano de Clique`,
  dpsPercent: (v) => `+${formatPercent(v)} DPS`,
  goldPercent: (v) => `+${formatPercent(v)} Ouro`,
  dropPercent: (v) => `+${formatPercent(v)} Chance de Material`,
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

export function renderCombatStats(stats) {
  document.getElementById('click-damage-value').textContent = formatNumber(stats.clickDamage);
  document.getElementById('dps-value').textContent = formatNumber(stats.dps);
}

export function renderMonster(state, monster) {
  const boss = isBossStage(state.stage);
  document.getElementById('monster-sprite').textContent = monster.emoji;
  document.getElementById('monster-name').innerHTML =
    `${monster.name}${boss ? '<span class="boss-tag">CHEFE</span>' : ''}`;
  document.getElementById('stage-label').textContent = `Estágio ${state.stage}`;

  const hp = Math.max(0, state.monsterHp ?? monster.maxHp);
  const pct = Math.max(0, Math.min(100, (hp / monster.maxHp) * 100));
  document.getElementById('hp-bar-fill').style.width = `${pct}%`;
  document.getElementById('hp-bar-text').textContent = `${formatNumber(hp)} / ${formatNumber(monster.maxHp)}`;

  document.getElementById('stage-prev').disabled = state.stage <= 1;
  document.getElementById('stage-next').disabled = state.stage >= state.maxStage;
  document.getElementById('stage-max').disabled = state.stage >= state.maxStage;
}

export function renderEquipmentTab(state) {
  const container = document.getElementById('tab-equipment');
  container.innerHTML = `<div class="slot-grid">${SLOTS.map((slot) => slotCardHtml(state, slot)).join('')}</div>`;

  container.querySelectorAll('select[data-slot]').forEach((select) => {
    select.addEventListener('change', (e) => {
      const uid = e.target.value ? Number(e.target.value) : null;
      container.dispatchEvent(new CustomEvent('equip-change', { detail: { slotId: e.target.dataset.slot, uid }, bubbles: true }));
    });
  });
}

function slotCardHtml(state, slot) {
  const equipped = getEquippedItem(state, slot.id);
  const options = getInventoryForSlot(state, slot.id);

  const itemHtml = equipped
    ? `<div class="slot-item"><span class="icon">${equipped.emoji}</span><span class="name">${equipped.name}</span></div>
       <div class="slot-stats">${formatStatsLines(equipped.stats).join('<br>')}</div>`
    : `<div class="empty-slot">Nenhum item equipado</div>`;

  const selectHtml = options.length
    ? `<select data-slot="${slot.id}">
        <option value="">— Nenhum —</option>
        ${options.map((o) => `<option value="${o.uid}" ${state.equipped[slot.id] === o.uid ? 'selected' : ''}>${o.item.name}</option>`).join('')}
      </select>`
    : `<div class="empty-slot">Nada craftado ainda</div>`;

  return `<div class="slot-card">
    <div class="slot-title">${slot.emoji} ${slot.name}</div>
    ${itemHtml}
    ${selectHtml}
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
    <h3>${family.emoji} ${family.name} <span style="color:var(--text-dim); font-weight:400; font-size:11px;">(Estágios ${family.startStage}–${family.endStage})</span></h3>
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
    <div class="recipe-header"><span class="icon">${item.emoji}</span><span class="name">${item.name}</span></div>
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
  const allMaterials = MONSTER_FAMILIES.flatMap((f) => [f.materials.common, f.materials.rare]);

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
  renderCombatStats(stats);
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
