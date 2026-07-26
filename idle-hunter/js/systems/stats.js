import { getItem, getEnhancedStats, SLOTS, getDamageTypeForAttribute } from '../data/items.js';
import { UPGRADES } from '../data/upgrades.js';
import { ELEMENT_RESISTANCE_PER_PIECE } from '../data/elements.js';
import { getCard, CARD_DAMAGE_BONUS } from '../data/cards.js';
import { ensureCardIds } from './crafting.js';

// Sem arma nenhuma equipada, o caçador ainda bate com as próprias mãos —
// suficiente pra matar o primeiro monstro fraco da Zona 1 (~68 HP) em
// poucos segundos, não instantaneamente.
const BASE_DPS = 8;
const BASE_ATTACK_SPEED_PERCENT = 0;
const BASE_MAX_HP = 100;
const BASE_ARMOR = 0;
const DEFAULT_WEAPON_ELEMENT = 'neutro';

const BASE_CRIT_CHANCE = 5;
const BASE_CRIT_DAMAGE = 50;

/// currentHp: the caller's current HP in whatever fight this is for (main
/// combat, Torre Infinita — each has its own separate pool, see main.js).
/// Only consulted by HP-conditional card specials (Colhedor Carmesim,
/// Vulkarion, below); null means "unknown/not applicable" and is treated
/// as full HP, which is the safe default for every non-combat caller (UI
/// previews, offline-progress math, achievement checks, etc.) — full HP
/// activates Colhedor Carmesim's bonus and gives Vulkarion's zero, neither
/// of which hands out an undeserved buff.
export function computePlayerStats(state, currentHp = null) {
  let dpsFlat = BASE_DPS;
  let dpsPercent = 0;
  let attackSpeedPercent = BASE_ATTACK_SPEED_PERCENT;
  let goldPercent = 0;
  let dropPercent = 0;
  let hpFlat = BASE_MAX_HP;
  let armorFlat = BASE_ARMOR;
  let hpPercent = 0;
  let armorPercent = 0;
  let critChancePercent = 0;
  let critDamagePercent = 0;
  let weaponElement = DEFAULT_WEAPON_ELEMENT;

  // Os 3 tipos de dano (ver DAMAGE_TYPES/getDamageTypeForAttribute em
  // data/items.js): cada peça equipada só contribui pro tipo que casa com
  // seu próprio atributo (Força→Físico, Destreza→Perfuração,
  // Inteligência→Mágico) — mas só o tipo da ARMA PRIMÁRIA (weapon1) vira
  // dano de verdade (ver activeDamageType abaixo); os outros dois pools
  // continuam existindo só pra exibição/eventual troca de arma.
  let danoFisicoFlat = 0;
  let danoPerfuracaoFlat = 0;
  let danoMagicoFlat = 0;

  // Totais de Força/Destreza/Inteligência — puramente informativos (o efeito
  // de cada peça já entra direto em hpFlat/armorFlat/danoXFlat/
  // critChancePercent/critDamagePercent/goldPercent/dropPercent acima, ver
  // data/items.js attributeBaseStats); somados aqui só pra mostrar ao
  // jogador quanto de cada atributo o equipamento atual está dando.
  let forcaTotal = 0;
  let destrezaTotal = 0;
  let inteligenciaTotal = 0;

  // How many equipped cards carry each special.id — most specials scale
  // their magnitude linearly with this count (see applySpecials below).
  const specialCounts = {};
  let equippedSlotCount = 0;
  let equippedElements = new Set();

  const weapon1Entry = state.equipped.weapon1 ? state.inventory.find((i) => i.uid === state.equipped.weapon1) : null;
  const weapon1Item = weapon1Entry ? getItem(weapon1Entry.itemId) : null;
  const activeDamageType = getDamageTypeForAttribute(weapon1Item ? weapon1Item.attribute : 'forca');

  for (const [slotId, uid] of Object.entries(state.equipped)) {
    if (!uid) continue;
    const invEntry = state.inventory.find((i) => i.uid === uid);
    if (!invEntry) continue;

    for (const cardId of ensureCardIds(invEntry)) {
      if (!cardId) continue;
      const card = getCard(cardId);
      if (card) {
        for (const b of card.bonuses || []) addStat(b.stat, b.value);
        if (card.special) specialCounts[card.special.id] = (specialCounts[card.special.id] || 0) + 1;
      }
    }

    const item = getItem(invEntry.itemId);
    if (!item) continue;
    const stats = getEnhancedStats(invEntry);

    dpsFlat += stats.dpsFlat || 0;
    dpsPercent += stats.dpsPercent || 0;
    attackSpeedPercent += stats.attackSpeedPercent || 0;
    goldPercent += stats.goldPercent || 0;
    dropPercent += stats.dropPercent || 0;
    hpFlat += stats.hpFlat || 0;
    armorFlat += stats.armorFlat || 0;
    hpPercent += stats.hpPercent || 0;
    armorPercent += stats.armorPercent || 0;
    critChancePercent += stats.critChancePercent || 0;
    critDamagePercent += stats.critDamagePercent || 0;
    danoFisicoFlat += stats.danoFisicoFlat || 0;
    danoPerfuracaoFlat += stats.danoPerfuracaoFlat || 0;
    danoMagicoFlat += stats.danoMagicoFlat || 0;

    if (item.attribute === 'forca') forcaTotal += stats.danoFisicoFlat || 0;
    else if (item.attribute === 'destreza') destrezaTotal += stats.danoPerfuracaoFlat || 0;
    else if (item.attribute === 'inteligencia') inteligenciaTotal += stats.danoMagicoFlat || 0;

    if (slotId === 'weapon1') weaponElement = item.element || DEFAULT_WEAPON_ELEMENT;

    equippedSlotCount += 1;
    equippedElements.add(item.element || DEFAULT_WEAPON_ELEMENT);
  }

  const activeDamagePool = activeDamageType === 'fisico' ? danoFisicoFlat
    : activeDamageType === 'perfuracao' ? danoPerfuracaoFlat
    : danoMagicoFlat;
  dpsFlat += activeDamagePool;

  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id] || 0;
    if (level <= 0) continue;
    const total = level * upgrade.valuePerLevel;
    addStat(upgrade.stat, total);
  }

  function addStat(stat, total) {
    if (stat === 'dpsFlat') dpsFlat += total;
    else if (stat === 'dpsPercent') dpsPercent += total;
    else if (stat === 'attackSpeedPercent') attackSpeedPercent += total;
    else if (stat === 'goldPercent') goldPercent += total;
    else if (stat === 'dropPercent') dropPercent += total;
    else if (stat === 'hpFlat') hpFlat += total;
    else if (stat === 'armorFlat') armorFlat += total;
    else if (stat === 'hpPercent') hpPercent += total;
    else if (stat === 'armorPercent') armorPercent += total;
    else if (stat === 'critChancePercent') critChancePercent += total;
    else if (stat === 'critDamagePercent') critDamagePercent += total;
  }

  // maxHp/armor need to be final before HP-conditional specials below can
  // check the player's HP fraction against them.
  const maxHp = Math.round(hpFlat * (1 + hpPercent / 100));
  const armor = Math.round(armorFlat * (1 + armorPercent / 100));
  const hpFraction = currentHp == null ? 1 : Math.max(0, Math.min(1, currentHp / maxHp));

  // Card specials that aren't a plain stat sum — each reads its own count
  // from specialCounts (0 if that card isn't socketed at all) and folds its
  // effect into dpsPercent, or exposes a proc chance/multiplier on the
  // returned stats object for combat.js/main.js to act on directly.
  const colhedorCount = specialCounts.hp_threshold_dps || 0;
  if (colhedorCount > 0 && hpFraction >= 0.8) {
    dpsPercent += 45 * colhedorCount;
  }

  const grommukCount = specialCounts.same_element_set || 0;
  if (grommukCount > 0 && equippedSlotCount === SLOTS.length && equippedElements.size === 1) {
    dpsPercent += 60 * grommukCount;
  }

  const vulkarionCount = specialCounts.low_hp_dps_scale || 0;
  if (vulkarionCount > 0) {
    dpsPercent += (1 - hpFraction) * 60 * vulkarionCount;
  }

  const goldDoubleChance = Math.min(100, 20 * (specialCounts.gold_double_chance || 0));
  const bossReprocChance = Math.min(100, 10 * (specialCounts.boss_kill_reproc || 0));
  const solkaiserCount = specialCounts.hit_counter_burst || 0;
  // More copies make the burst land sooner rather than hit harder — see
  // resolveHit() in systems/combat.js, which is what actually reads these.
  const hitBurstEveryN = solkaiserCount > 0 ? Math.max(1, Math.round(50 / solkaiserCount)) : null;
  const hitBurstDamageMult = solkaiserCount > 0 ? 6 : null;

  const dps = dpsFlat * (1 + dpsPercent / 100);
  const attackSpeedPerSec = Math.max(0.05, 1 * (1 + attackSpeedPercent / 100));
  const goldMult = 1 + goldPercent / 100;
  const dropMult = 1 + dropPercent / 100;
  const critChance = Math.max(0, Math.min(100, BASE_CRIT_CHANCE + critChancePercent));
  const critDamage = Math.max(0, BASE_CRIT_DAMAGE + critDamagePercent);

  return {
    dps, attackSpeedPerSec, goldMult, dropMult,
    maxHp, armor, weaponElement,
    critChance, critDamage,
    goldDoubleChance, bossReprocChance, hitBurstEveryN, hitBurstDamageMult,
    forca: forcaTotal, destreza: destrezaTotal, inteligencia: inteligenciaTotal,
    activeDamageType,
    danoFisico: danoFisicoFlat, danoPerfuracao: danoPerfuracaoFlat, danoMagico: danoMagicoFlat,
  };
}

const DEFENSE_SLOTS = ['head', 'chest', 'legs', 'hands', 'boots'];

/// Resistance to a specific element, from equipped defense pieces whose own
/// monster family matches that element — 5% per matching piece. Computed
/// separately from computePlayerStats() because it depends on which
/// element is attacking (i.e. the current monster), not just on gear.
export function getElementalResistance(state, element) {
  let count = 0;
  for (const slotId of DEFENSE_SLOTS) {
    const uid = state.equipped[slotId];
    if (!uid) continue;
    const invEntry = state.inventory.find((i) => i.uid === uid);
    if (!invEntry) continue;
    const item = getItem(invEntry.itemId);
    if (item && item.element === element) count += 1;
  }
  return count * ELEMENT_RESISTANCE_PER_PIECE;
}

/// Sum of socketed-card bonuses against a specific element — +3% per
/// equipped item (any slot, not just defense) whose card matches that
/// element. Same "Neutro never has advantage" rule as elementDamageModifier,
/// and computed separately from computePlayerStats() for the same reason as
/// getElementalResistance() above: it depends on the current target.
export function getCardDamageBonus(state, element) {
  if (element === 'neutro') return 0;
  let bonus = 0;
  for (const uid of Object.values(state.equipped)) {
    if (!uid) continue;
    const invEntry = state.inventory.find((i) => i.uid === uid);
    if (!invEntry) continue;
    for (const cardId of ensureCardIds(invEntry)) {
      if (!cardId) continue;
      const card = getCard(cardId);
      if (card && card.element === element) bonus += CARD_DAMAGE_BONUS;
    }
  }
  return bonus;
}
