// Sistema de "Power": um único número que resume o quão forte um item, um
// mascote (ou, somado, o jogador inteiro) está, calculado a partir dos
// MESMOS stats brutos que computePlayerStats (ver systems/stats.js) já usa
// pro dano/vida/crítico/etc de verdade — cada stat vira "pontos de Power"
// através de um peso próprio (ver POWER_WEIGHTS abaixo), calibrado pra
// refletir o quanto aquele stat realmente contribui pra força de combate
// (dano/sobrevivência pesam mais que utilidade econômica, por exemplo).
//
// Power do jogador (computePlayerPower) = Power de cada item equipado +
// Power de cada mascote equipado + "bônus da conta" (árvore de habilidades
// passivas, upgrades permanentes, bônus de coleção de cartas, turbo de DPS
// ativo — ver computeAccountBonusPower). Esse último bloco é só um NÚMERO
// somado ao total; de propósito não é quebrado stat a stat pro jogador (só
// os itens/mascotes individuais mostram seu próprio Power).
import { getItem, getEnhancedStats } from '../data/items.js';
import { getCard } from '../data/cards.js';
import { getPetSpecies, getPetDamagePercent, getPetDpsBonusPercent } from '../data/pets.js';
import { getSkillTree } from '../data/skills.js';
import { getSkillLevel, getChosenSpecialId } from './skills.js';
import { UPGRADES } from '../data/upgrades.js';
import { getCardCollectionDpsBonusPercent } from './cards.js';
import { getActiveDpsBoostPercent } from './shop.js';
import {
  FORCA_DANO_PER_POINT, FORCA_HP_PER_POINT, FORCA_ARMOR_PER_POINT,
  DESTREZA_DANO_PER_POINT, DESTREZA_CRIT_CHANCE_PER_POINT, DESTREZA_CRIT_DAMAGE_PER_POINT,
  INTELIGENCIA_DANO_PER_POINT, INTELIGENCIA_GOLD_PERCENT_PER_POINT, INTELIGENCIA_DROP_PERCENT_PER_POINT,
  TRANSCEND_HP_DPS_BONUS_PERCENT_PER_COUNT,
} from './stats.js';

// Pontos de Power por unidade de cada stat. Dano/vida/armadura "flat" usam a
// mesma escala de dpsFlat (1 ponto de dano = 1 de Power — é literalmente
// DPS), o resto é calibrado por quanto aquele stat costuma valer em combate:
// % que multiplica o pool inteiro (dpsPercent, velocidade de ataque, crítico)
// vale MUITO mais por ponto que um % puramente econômico (ouro/drop), e
// vida/armadura plana valem menos que dano por ponto (é preciso bem mais HP
// pra "equivaler" a um ponto de dano em utilidade ofensiva).
// Multiplicador só de exibição (ver computeItemPower abaixo) — pedido do
// usuário pra deixar o número final maior/mais "preciso", sem mexer no
// peso relativo de nenhum stat. Se mudar, atualize também o ×10 hardcoded
// na fórmula do Power estimado dos bots em supabase/migrations (ver
// 0019_pvp_power_x10.sql).
export const POWER_DISPLAY_MULTIPLIER = 10;

export const POWER_WEIGHTS = {
  danoFlatPerPoint: 1,
  hpFlatPerPoint: 0.25,
  armorFlatPerPoint: 1.2,
  lifestealFlatPerPoint: 3,
  dpsPercentPerPoint: 9,
  hpPercentPerPoint: 3,
  armorPercentPerPoint: 3.5,
  attackSpeedPercentPerPoint: 7,
  critChancePercentPerPoint: 5,
  critDamagePercentPerPoint: 1.8,
  danoTypePercentPerPoint: 5, // danoFisicoPercent/danoPerfuracaoPercent/danoMagicoPercent (cartas)
  goldPercentPerPoint: 0.6,
  dropPercentPerPoint: 0.9,
  petDamagePercentPerPoint: 2,
  dodgePercentPerPoint: 6,
  doubleHitChancePerPoint: 7,
  // Só dispara quando o jogador TOMA dano (não some sozinho, depende do
  // monstro bater) — peso um pouco abaixo de dpsPercent por isso, mas
  // ainda alto (é dano extra de verdade, ver reflectChance em stats.js).
  reflectPercentPerPoint: 6,
};

/// Soma um objeto plano de stats brutos (mesma forma que getEnhancedStats()
/// devolve, os bônus de uma carta, ou os de uma habilidade/upgrade — todos
/// usam a MESMA nomenclatura de stat, ver computePlayerStats em stats.js)
/// em "pontos de Power" — primeiro converte Força/Destreza/Inteligência cru
/// nos MESMOS stats de combate que computePlayerStats converteria (dano/
/// vida/armadura/crítico/ouro/drop, ver constantes importadas de stats.js),
/// depois aplica o peso de cada stat.
function statPoolToPower(stats) {
  const w = POWER_WEIGHTS;

  let danoFisicoFlat = stats.danoFisicoFlat || 0;
  let danoPerfuracaoFlat = stats.danoPerfuracaoFlat || 0;
  let danoMagicoFlat = stats.danoMagicoFlat || 0;
  let hpFlat = stats.hpFlat || 0;
  let armorFlat = stats.armorFlat || 0;
  let critChancePercent = stats.critChancePercent || 0;
  let critDamagePercent = stats.critDamagePercent || 0;
  let goldPercent = stats.goldPercent || 0;
  let dropPercent = stats.dropPercent || 0;

  const forca = stats.forca || 0;
  const destreza = stats.destreza || 0;
  const inteligencia = stats.inteligencia || 0;
  danoFisicoFlat += forca * FORCA_DANO_PER_POINT;
  hpFlat += forca * FORCA_HP_PER_POINT;
  armorFlat += forca * FORCA_ARMOR_PER_POINT;
  danoPerfuracaoFlat += destreza * DESTREZA_DANO_PER_POINT;
  critChancePercent += destreza * DESTREZA_CRIT_CHANCE_PER_POINT;
  critDamagePercent += destreza * DESTREZA_CRIT_DAMAGE_PER_POINT;
  danoMagicoFlat += inteligencia * INTELIGENCIA_DANO_PER_POINT;
  goldPercent += inteligencia * INTELIGENCIA_GOLD_PERCENT_PER_POINT;
  dropPercent += inteligencia * INTELIGENCIA_DROP_PERCENT_PER_POINT;

  let power = 0;
  // dpsFlat entra igual danoXFlat (mesma unidade — só upgrades permanentes
  // usam essa chave, ver data/upgrades.js).
  power += (stats.dpsFlat || 0) * w.danoFlatPerPoint;
  power += (danoFisicoFlat + danoPerfuracaoFlat + danoMagicoFlat) * w.danoFlatPerPoint;
  power += hpFlat * w.hpFlatPerPoint;
  power += armorFlat * w.armorFlatPerPoint;
  power += (stats.lifestealFlat || 0) * w.lifestealFlatPerPoint;

  power += (stats.dpsPercent || 0) * w.dpsPercentPerPoint;
  power += (stats.hpPercent || 0) * w.hpPercentPerPoint;
  power += (stats.armorPercent || 0) * w.armorPercentPerPoint;
  power += (stats.attackSpeedPercent || 0) * w.attackSpeedPercentPerPoint;
  power += critChancePercent * w.critChancePercentPerPoint;
  power += critDamagePercent * w.critDamagePercentPerPoint;
  power += (stats.danoFisicoPercent || 0) * w.danoTypePercentPerPoint;
  power += (stats.danoPerfuracaoPercent || 0) * w.danoTypePercentPerPoint;
  power += (stats.danoMagicoPercent || 0) * w.danoTypePercentPerPoint;
  power += goldPercent * w.goldPercentPerPoint;
  power += dropPercent * w.dropPercentPerPoint;
  power += (stats.petDamagePercent || 0) * w.petDamagePercentPerPoint;
  power += (stats.dodgePercent || 0) * w.dodgePercentPerPoint;
  power += (stats.doubleHitChance || 0) * w.doubleHitChancePerPoint;
  power += (stats.reflectPercent || 0) * w.reflectPercentPerPoint;

  return power;
}

/// statPoolToPower() + o ×10 de exibição + arredondamento/clamp em 0 —
/// ponto único usado por toda fonte de Power (item, mascote, bônus da
/// conta) pra garantir que a mesma escala/regra se aplica em todo lugar.
function powerFromStatPool(stats) {
  return Math.max(0, Math.round(statPoolToPower(stats) * POWER_DISPLAY_MULTIPLIER));
}

/// Power de UM item equipado (ou não — funciona pra qualquer inventory
/// entry), já somando as cartas encaixadas nele: aprimorar o item, virar
/// Rank Master, ascender de raridade, ou encaixar/tirar uma carta muda o
/// resultado na hora, porque tudo aqui é recalculado do zero a partir do
/// entry atual, nunca guardado como um valor fixo. Aceita tanto uma
/// inventory entry de verdade (state.inventory) quanto uma entrada de
/// equipped_snapshot de outro jogador (mesma forma — ver
/// serializeEquippedSnapshot em systems/pvp.js) — as duas têm itemId/
/// baseStats/additionalStats/enhanceLevel/isMaster/cardIds.
export function computeItemPower(entry) {
  if (!entry) return 0;
  const item = getItem(entry.itemId);
  if (!item) return 0;

  const stats = { ...getEnhancedStats(entry) };
  for (const cardId of entry.cardIds || []) {
    if (!cardId) continue;
    const card = getCard(cardId);
    if (!card) continue;
    for (const bonus of card.bonuses || []) {
      stats[bonus.stat] = (stats[bonus.stat] || 0) + bonus.value;
    }
  }

  return powerFromStatPool(stats);
}

/// Power de UM mascote — o dano dele (% do DPS do caçador, ver
/// getPetDamagePercent em data/pets.js) e o bônus de %DPS que ele empresta
/// quando é o ativo em combate (getPetDpsBonusPercent) entram os dois como
/// "dpsPercent" no mesmo conversor de stats de item/habilidade acima: os
/// dois já SÃO percentuais que multiplicam a força ofensiva do jogador,
/// então usam o mesmo peso (dpsPercentPerPoint) sem precisar de uma escala
/// própria. Recalculado do zero a cada chamada — subir de nível/raridade/
/// fusão já reflete na próxima renderização do popup do mascote.
export function computePetPower(petEntry) {
  if (!petEntry) return 0;
  const species = getPetSpecies(petEntry.speciesId);
  if (!species) return 0;
  const dpsPercent = getPetDamagePercent(petEntry) + getPetDpsBonusPercent(petEntry);
  return powerFromStatPool({ dpsPercent });
}

/// Soma o Power de cada mascote atualmente equipado (até 4 slots, ver
/// MAX_EQUIPPED_PETS em systems/pets.js) — todos os equipados contam, não
/// só o que estaria ativo contra o monstro atual (o Power é uma força
/// "potencial" do jogador, independente de qual mascote a mecânica de
/// combate escolheria agora).
export function computeEquippedPetsPower(state) {
  let total = 0;
  for (const uid of state.equippedPetUids || []) {
    if (!uid) continue;
    const pet = (state.pets || []).find((p) => p.uid === uid);
    if (pet) total += computePetPower(pet);
  }
  return Math.round(total);
}

/// "Bônus da conta": tudo que fortalece o jogador SEM vir de um item ou
/// mascote específico — árvore de habilidades passivas (pontos investidos +
/// especial escolhido de cada etapa destravada), upgrades permanentes
/// (Loja > Esmeralda), o bônus de %DPS por carta já descoberta (coleção,
/// ver getCardCollectionDpsBonusPercent) e o turbo de %DPS por anúncio
/// enquanto ativo (getActiveDpsBoostPercent). De propósito não some cada um
/// desses pedaços separadamente pro jogador (só entra como 1 número dentro
/// do Power total) — mesma soma de stats que qualquer outra fonte, só que
/// aqui não amarrada a um item/mascote visível.
function computeAccountBonusStats(state) {
  const stats = {};
  const add = (stat, value) => {
    if (!value) return;
    stats[stat] = (stats[stat] || 0) + value;
  };

  for (const stage of getSkillTree().stages) {
    for (const row of stage.rows) {
      for (const skill of row) {
        const level = getSkillLevel(state, skill.id);
        if (level > 0) add(skill.stat, skill.perLevel * level);
      }
    }
    if (stage.special) {
      const chosenId = getChosenSpecialId(state, stage.stageIndex);
      const option = chosenId && stage.special.options.find((o) => o.id === chosenId);
      if (option) {
        for (const bonus of option.bonuses) add(bonus.stat, bonus.value);
      }
    }
  }

  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id] || 0;
    if (level > 0) add(upgrade.stat, level * upgrade.valuePerLevel);
  }

  add('dpsPercent', getCardCollectionDpsBonusPercent(state));
  add('dpsPercent', getActiveDpsBoostPercent(state));

  // Bônus de Vida/DPS por Transcendência (ver TRANSCEND_HP_DPS_BONUS_PERCENT_PER_COUNT
  // em systems/stats.js — lá é um multiplicador final separado sobre o
  // DPS/HP já totalmente calculados; aqui, pro Power, entra como
  // dpsPercent/hpPercent igual qualquer outra fonte, já que o Power soma
  // tudo pelo mesmo pool de stats ponderado).
  const transcendBonusPercent = (state.transcendCount || 0) * TRANSCEND_HP_DPS_BONUS_PERCENT_PER_COUNT;
  add('dpsPercent', transcendBonusPercent);
  add('hpPercent', transcendBonusPercent);

  return stats;
}

export function computeAccountBonusPower(state) {
  return powerFromStatPool(computeAccountBonusStats(state));
}

/// Power TOTAL do jogador — itens equipados + mascotes equipados + bônus da
/// conta (habilidades/upgrades/coleção de cartas/turbo ativo, ver acima).
/// Sempre recalculado do zero a partir do estado atual: qualquer troca de
/// equipamento/mascote/carta/aprimoramento/ponto de habilidade já reflete
/// na próxima chamada, nunca fica desatualizado.
export function computePlayerPower(state) {
  let total = 0;
  for (const uid of Object.values(state.equipped || {})) {
    if (!uid) continue;
    const entry = state.inventory.find((i) => i.uid === uid);
    if (!entry) continue;
    total += computeItemPower(entry);
  }
  total += computeEquippedPetsPower(state);
  total += computeAccountBonusPower(state);
  return Math.round(total);
}
