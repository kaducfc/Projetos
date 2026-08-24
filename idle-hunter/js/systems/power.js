// Sistema de "Power": um único número que resume o quão forte um item (ou,
// somado, o jogador inteiro) está, calculado a partir dos MESMOS stats
// brutos que computePlayerStats (ver systems/stats.js) já usa pro dano/vida/
// crítico/etc de verdade — cada stat vira "pontos de Power" através de um
// peso próprio (ver POWER_WEIGHTS abaixo), calibrado pra refletir o quanto
// aquele stat realmente contribui pra força de combate (dano/sobrevivência
// pesam mais que utilidade econômica, por exemplo).
//
// Só cobre EQUIPAMENTO (item + cartas encaixadas nele) — de propósito: o
// pedido era "o Power daquele item" e "o Power do jogador", e a forma mais
// direta/consistente de garantir que os dois nunca dessincronizem é definir
// Power do jogador = soma do Power de cada item equipado, sem misturar
// árvore de habilidades/upgrades permanentes (que já aparecem nos outros
// stats normalmente).
import { getItem, getEnhancedStats } from '../data/items.js';
import { getCard } from '../data/cards.js';
import {
  FORCA_DANO_PER_POINT, FORCA_HP_PER_POINT, FORCA_ARMOR_PER_POINT,
  DESTREZA_DANO_PER_POINT, DESTREZA_CRIT_CHANCE_PER_POINT, DESTREZA_CRIT_DAMAGE_PER_POINT,
  INTELIGENCIA_DANO_PER_POINT, INTELIGENCIA_GOLD_PERCENT_PER_POINT, INTELIGENCIA_DROP_PERCENT_PER_POINT,
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
};

/// Soma um objeto plano de stats brutos (mesma forma que getEnhancedStats()
/// devolve, ou os bônus de uma carta) em "pontos de Power" — primeiro
/// converte Força/Destreza/Inteligência cru nos MESMOS stats de combate que
/// computePlayerStats converteria (dano/vida/armadura/crítico/ouro/drop, ver
/// constantes importadas de stats.js), depois aplica o peso de cada stat.
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

  return power;
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

  // ×10 só pra exibição — o número em si fica maior/mais "preciso" (mais
  // casas antes de virar 1k, 10k...), sem mudar a relevância relativa de
  // nenhum stat entre si (todo mundo escala igual, ver POWER_WEIGHTS acima).
  return Math.max(0, Math.round(statPoolToPower(stats) * POWER_DISPLAY_MULTIPLIER));
}

/// Power TOTAL do jogador — soma o Power de cada item atualmente equipado
/// (state.equipped). Sempre recalculado do zero a partir do estado atual, a
/// mesma garantia de computeItemPower: nunca fica desatualizado, qualquer
/// troca de equipamento/carta/aprimoramento já reflete na próxima chamada.
export function computePlayerPower(state) {
  let total = 0;
  for (const uid of Object.values(state.equipped || {})) {
    if (!uid) continue;
    const entry = state.inventory.find((i) => i.uid === uid);
    if (!entry) continue;
    total += computeItemPower(entry);
  }
  return Math.round(total);
}

/// Mesma soma acima, mas a partir de um equipped_snapshot (ver
/// showForeignEquipmentModal em ui/render.js) — pra calcular o Power total
/// de OUTRO jogador a partir do que o servidor devolveu, sem precisar de
/// nenhum campo extra sincronizado só pra isso.
export function computePowerFromEquippedSnapshot(equippedBySlot) {
  let total = 0;
  for (const entry of Object.values(equippedBySlot || {})) {
    total += computeItemPower(entry);
  }
  return Math.round(total);
}
