import { getItem, getEnhancedStats, getDamageTypeForAttribute } from '../data/items.js';
import { UPGRADES } from '../data/upgrades.js';
import { ELEMENT_RESISTANCE_PER_PIECE } from '../data/elements.js';
import { getCard, CARD_DAMAGE_BONUS } from '../data/cards.js';
import { ensureCardIds } from './crafting.js';
import { getCardCollectionDpsBonusPercent } from './cards.js';
import { getSkillTree } from '../data/skills.js';
import { getSkillLevel, getChosenSpecialId } from './skills.js';

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

// Conversão do atributo total equipado (soma de Força/Destreza/Inteligência
// de todas as peças — cada item agora só carrega um valor cru do seu
// próprio atributo, ver data/items.js attributeBaseStats) pros stats de
// combate de verdade. Números de partida, fáceis de re-tunar — a
// calibração fina (junto com o rebalanceamento dos monstros) fica pra
// depois.
const FORCA_DANO_PER_POINT = 6;
const FORCA_HP_PER_POINT = 8;
const FORCA_ARMOR_PER_POINT = 2;
const DESTREZA_DANO_PER_POINT = 6;
const DESTREZA_CRIT_CHANCE_PER_POINT = 0.15;
const DESTREZA_CRIT_DAMAGE_PER_POINT = 0.3;
const INTELIGENCIA_DANO_PER_POINT = 6;
const INTELIGENCIA_GOLD_PERCENT_PER_POINT = 0.2;
const INTELIGENCIA_DROP_PERCENT_PER_POINT = 0.15;

export function computePlayerStats(state) {
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
  // Atributos bônus novos (ver ADDITIONAL_STAT_POOL/rollAdditionalStat em
  // data/items.js): cura fixa por hit, % de dano do mascote, % de esquiva.
  let lifestealFlat = 0;
  let petDamagePercent = 0;
  let dodgePercent = 0;
  // O dano do próprio personagem é sempre Neutro agora — sem vantagem/
  // desvantagem elemental no ataque normal (elementDamageModifier sempre dá
  // 0 pra Neutro). Só o mascote equipado (ver systems/pets.js) carrega
  // elemento de verdade e disputa vantagem/desvantagem contra o monstro.
  const weaponElement = DEFAULT_WEAPON_ELEMENT;

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

  // % aplicado sobre danoXFlat DEPOIS da conversão de atributo abaixo — só
  // cartas concedem isso por enquanto (ver data/cards.js CARD_EFFECTS).
  let danoFisicoPercent = 0;
  let danoPerfuracaoPercent = 0;
  let danoMagicoPercent = 0;

  // Golpe Duplo (ver resolveDoubleHit em systems/combat.js): chance de um 2º
  // hit independente (crítico próprio) acontecer junto do hit principal — só
  // concedido por carta hoje, soma linear entre cópias equipadas.
  let doubleHitChancePercent = 0;

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
      }
    }

    const item = getItem(invEntry.itemId);
    if (!item) continue;
    const stats = getEnhancedStats(invEntry);

    // Affixes "adicionais" da raridade (ver ADDITIONAL_STAT_POOL em
    // data/items.js) continuam sendo somados direto, item a item — só o
    // atributo base em si (forca/destreza/inteligencia) virou um valor cru
    // por item, acumulado abaixo e convertido em stats de verdade depois
    // do loop. hpFlat/armorFlat/danoXFlat somados aqui cobrem tanto o 2º
    // adicional base de todo item (ver secondaryStatKeyForCategory em
    // data/items.js) quanto um afixo de raridade que role a mesma chave —
    // os dois se fundem no mesmo objeto `stats` (ver getEnhancedStats).
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
    lifestealFlat += stats.lifestealFlat || 0;
    petDamagePercent += stats.petDamagePercent || 0;
    dodgePercent += stats.dodgePercent || 0;

    if (item.attribute === 'forca') forcaTotal += stats.forca || 0;
    else if (item.attribute === 'destreza') destrezaTotal += stats.destreza || 0;
    else if (item.attribute === 'inteligencia') inteligenciaTotal += stats.inteligencia || 0;
  }

  // Árvore de habilidades passivas ÚNICA (ver data/skills.js + systems/
  // skills.js) — soma os níveis comprados + a especial escolhida de cada
  // etapa já destravada, nos MESMOS acumuladores usados pelo equipamento.
  // Força/Destreza/Inteligência entram em forcaTotal/
  // destrezaTotal/inteligenciaTotal ANTES da conversão abaixo, então um
  // ponto de atributo vale o mesmo venha da árvore ou do equipamento.
  // Recalculado do zero a cada chamada a partir de state.skillTree — nunca
  // aplicado como um delta permanente, então não duplica bônus num reload.
  function addTreeStat(stat, total) {
    if (stat === 'forca') forcaTotal += total;
    else if (stat === 'destreza') destrezaTotal += total;
    else if (stat === 'inteligencia') inteligenciaTotal += total;
    else if (stat === 'hpFlat') hpFlat += total;
    else if (stat === 'armorFlat') armorFlat += total;
    else if (stat === 'hpPercent') hpPercent += total;
    else if (stat === 'armorPercent') armorPercent += total;
    else if (stat === 'danoFisicoFlat') danoFisicoFlat += total;
    else if (stat === 'danoPerfuracaoFlat') danoPerfuracaoFlat += total;
    else if (stat === 'danoMagicoFlat') danoMagicoFlat += total;
    else if (stat === 'critChancePercent') critChancePercent += total;
    else if (stat === 'critDamagePercent') critDamagePercent += total;
    else if (stat === 'attackSpeedPercent') attackSpeedPercent += total;
    else if (stat === 'dodgePercent') dodgePercent += total;
    else if (stat === 'goldPercent') goldPercent += total;
    else if (stat === 'dropPercent') dropPercent += total;
    else if (stat === 'dpsPercent') dpsPercent += total;
    else if (stat === 'lifestealFlat') lifestealFlat += total;
  }

  for (const stage of getSkillTree().stages) {
    for (const row of stage.rows) {
      for (const skill of row) {
        const level = getSkillLevel(state, skill.id);
        if (level > 0) addTreeStat(skill.stat, skill.perLevel * level);
      }
    }
    if (stage.special) {
      const chosenId = getChosenSpecialId(state, stage.stageIndex);
      const option = chosenId && stage.special.options.find((o) => o.id === chosenId);
      if (option) {
        for (const bonus of option.bonuses) addTreeStat(bonus.stat, bonus.value);
      }
    }
  }

  // Converte o atributo total equipado pros stats de combate de verdade
  // (ver constantes *_PER_POINT no topo do arquivo): Força vira dano físico
  // + vida + armadura, Destreza vira dano de perfuração + crítico,
  // Inteligência vira dano mágico + ouro%/drop%.
  danoFisicoFlat += forcaTotal * FORCA_DANO_PER_POINT;
  hpFlat += forcaTotal * FORCA_HP_PER_POINT;
  armorFlat += forcaTotal * FORCA_ARMOR_PER_POINT;
  danoPerfuracaoFlat += destrezaTotal * DESTREZA_DANO_PER_POINT;
  critChancePercent += destrezaTotal * DESTREZA_CRIT_CHANCE_PER_POINT;
  critDamagePercent += destrezaTotal * DESTREZA_CRIT_DAMAGE_PER_POINT;
  danoMagicoFlat += inteligenciaTotal * INTELIGENCIA_DANO_PER_POINT;
  goldPercent += inteligenciaTotal * INTELIGENCIA_GOLD_PERCENT_PER_POINT;
  dropPercent += inteligenciaTotal * INTELIGENCIA_DROP_PERCENT_PER_POINT;

  // % de dano por tipo (só cartas concedem isso por enquanto, ver
  // data/cards.js) — aplicado sobre o pool já convertido acima, antes de
  // escolher qual pool vira DPS de verdade (activeDamageType, logo abaixo).
  danoFisicoFlat *= 1 + danoFisicoPercent / 100;
  danoPerfuracaoFlat *= 1 + danoPerfuracaoPercent / 100;
  danoMagicoFlat *= 1 + danoMagicoPercent / 100;

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
    else if (stat === 'forca') forcaTotal += total;
    else if (stat === 'destreza') destrezaTotal += total;
    else if (stat === 'inteligencia') inteligenciaTotal += total;
    else if (stat === 'lifestealFlat') lifestealFlat += total;
    else if (stat === 'petDamagePercent') petDamagePercent += total;
    else if (stat === 'dodgePercent') dodgePercent += total;
    else if (stat === 'danoFisicoPercent') danoFisicoPercent += total;
    else if (stat === 'danoPerfuracaoPercent') danoPerfuracaoPercent += total;
    else if (stat === 'danoMagicoPercent') danoMagicoPercent += total;
    else if (stat === 'doubleHitChance') doubleHitChancePercent += total;
  }

  // maxHp/armor final.
  const maxHp = Math.round(hpFlat * (1 + hpPercent / 100));
  const armor = Math.round(armorFlat * (1 + armorPercent / 100));

  // Bônus de coleção de cartas (ver getCardCollectionDpsBonusPercent em
  // systems/cards.js) — permanente por carta já descoberta ao menos uma vez,
  // separado do bônus de carta SOCKETADA acima (os dois se somam).
  dpsPercent += getCardCollectionDpsBonusPercent(state);

  const dps = dpsFlat * (1 + dpsPercent / 100);
  const attackSpeedPerSec = Math.max(0.05, 1 * (1 + attackSpeedPercent / 100));
  const goldMult = 1 + goldPercent / 100;
  const dropMult = 1 + dropPercent / 100;
  const critChance = Math.max(0, Math.min(100, BASE_CRIT_CHANCE + critChancePercent));
  const critDamage = Math.max(0, BASE_CRIT_DAMAGE + critDamagePercent);
  const lifesteal = Math.max(0, lifestealFlat);
  const petDamageMult = 1 + petDamagePercent / 100;
  const dodgeChance = Math.max(0, Math.min(100, dodgePercent));
  const doubleHitChance = Math.max(0, Math.min(100, doubleHitChancePercent));

  return {
    dps, attackSpeedPerSec, goldMult, dropMult,
    maxHp, armor, weaponElement,
    critChance, critDamage,
    lifesteal, petDamageMult, dodgeChance, doubleHitChance,
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
