import {
  CASH_SHOP_ITEMS, AD_WATCH_COOLDOWN_MS, AD_WATCH_CASH_REWARD,
  DPS_BOOST_PERCENT, DPS_BOOST_DURATION_MS, DPS_BOOST_MAX_DURATION_MS,
  OFFLINE_BONUS_SECONDS_PER_STACK, OFFLINE_BONUS_MAX_SECONDS,
} from '../data/shop.js';
import { isVipActive, VIP_DURATION_MS } from '../state.js';

export function canBuyCashItem(state, id) {
  const item = CASH_SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return false;
  // VIP não empilha mais — enquanto ainda está ativo, o botão fica
  // travado; só dá pra comprar de novo depois que o contador de dias
  // zerar e o VIP expirar de vez (ver buyCashItem abaixo).
  if (item.kind === 'vip' && isVipActive(state)) return false;
  return state.cash >= item.cost;
}

export function buyCashItem(state, id) {
  if (!canBuyCashItem(state, id)) return false;
  const item = CASH_SHOP_ITEMS.find((i) => i.id === id);
  state.cash -= item.cost;
  if (item.kind === 'gold') {
    state.gold += item.amount;
    state.lifetimeGoldEarned = (state.lifetimeGoldEarned || 0) + item.amount;
  }
  // canBuyCashItem já garante que o VIP não está ativo aqui (bloqueado
  // acima), então sempre conta VIP_DURATION_MS a partir de agora — nunca
  // precisa somar em cima de um vencimento anterior.
  else if (item.kind === 'vip') state.vipExpiresAt = Date.now() + VIP_DURATION_MS;
  return true;
}

/// { matId, amount, cost } — deliberately not a full data/shop.js item
/// lookup, since event-shop entries are generated per-boss and the
/// caller (render.js) already has the exact one the player clicked.
export function canBuyEventItem(state, item) {
  return state.eventCurrency >= item.cost;
}

export function buyEventItem(state, item) {
  if (!canBuyEventItem(state, item)) return false;
  state.eventCurrency -= item.cost;
  state.materials[item.matId] = (state.materials[item.matId] || 0) + item.amount;
  return true;
}

export function adWatchCooldownRemaining(state) {
  const last = state.lastAdWatchTime || 0;
  return Math.max(0, AD_WATCH_COOLDOWN_MS - (Date.now() - last));
}

export function canWatchAd(state) {
  return adWatchCooldownRemaining(state) <= 0;
}

export function watchAd(state) {
  if (!canWatchAd(state)) return false;
  state.cash += AD_WATCH_CASH_REWARD;
  state.lastAdWatchTime = Date.now();
  return true;
}

// ---------------------------------------------------------------
// Turbo de DPS (anúncio #2): bônus fixo de DPS_BOOST_PERCENT% de DPS
// enquanto o relógio (state.dpsBoostExpiresAt, real, corre mesmo offline)
// não zerar. Assistir de novo NÃO aumenta o bônus (sempre +30%) — só
// estende o relógio em +DPS_BOOST_DURATION_MS, até um teto de
// DPS_BOOST_MAX_DURATION_MS (2h) de tempo restante.
// ---------------------------------------------------------------

export function getDpsBoostRemainingMs(state) {
  return Math.max(0, (state.dpsBoostExpiresAt || 0) - Date.now());
}

export function isDpsBoostActive(state) {
  return getDpsBoostRemainingMs(state) > 0;
}

/// % de DPS a somar em computePlayerStats (ver systems/stats.js) — 0 se o
/// relógio já zerou.
export function getActiveDpsBoostPercent(state) {
  return isDpsBoostActive(state) ? DPS_BOOST_PERCENT : 0;
}

// Depois que o banco enche de vez (4/4 cargas, teto de
// DPS_BOOST_MAX_DURATION_MS), o próximo anúncio só libera quando sobrar mais
// de uma carga (DPS_BOOST_DURATION_MS) de espaço pra encher de novo — ou
// seja, precisa a última carga "acabar" antes de poder assistir outro,
// em vez de poder completar o banco a qualquer segundo que ele não esteja
// 100% cheio.
export function canWatchDpsBoostAd(state) {
  return getDpsBoostRemainingMs(state) <= DPS_BOOST_MAX_DURATION_MS - DPS_BOOST_DURATION_MS;
}

export function watchDpsBoostAd(state) {
  if (!canWatchDpsBoostAd(state)) return false;
  const now = Date.now();
  const base = Math.max(now, state.dpsBoostExpiresAt || 0);
  state.dpsBoostExpiresAt = Math.min(base + DPS_BOOST_DURATION_MS, now + DPS_BOOST_MAX_DURATION_MS);
  return true;
}

// ---------------------------------------------------------------
// Bônus Idle (anúncio #3... na verdade a 2ª nova fonte, ver comentário em
// data/shop.js): banco de até OFFLINE_BONUS_MAX_SECONDS (2h) de limite
// extra pra recompensa offline, em cargas de OFFLINE_BONUS_SECONDS_PER_STACK
// (30 min). Diferente do Turbo de DPS acima, isso não decai sozinho — só é
// gasto de fato em computeOfflineProgress (systems/offline.js), quando o
// jogador fica offline além do limite base.
// ---------------------------------------------------------------

// Mesma regra do Turbo de DPS acima: depois que o banco enche de vez (4/4
// cargas), só libera o próximo anúncio quando sobrar mais de uma carga
// (OFFLINE_BONUS_SECONDS_PER_STACK) de espaço — precisa a última carga
// "acabar" (ser gasta ficando offline) antes de poder assistir outro.
export function canWatchOfflineBonusAd(state) {
  return (state.offlineBonusSeconds || 0) <= OFFLINE_BONUS_MAX_SECONDS - OFFLINE_BONUS_SECONDS_PER_STACK;
}

export function watchOfflineBonusAd(state) {
  if (!canWatchOfflineBonusAd(state)) return false;
  state.offlineBonusSeconds = Math.min(
    OFFLINE_BONUS_MAX_SECONDS,
    (state.offlineBonusSeconds || 0) + OFFLINE_BONUS_SECONDS_PER_STACK,
  );
  return true;
}
