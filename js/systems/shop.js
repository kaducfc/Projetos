import {
  CASH_SHOP_ITEMS, AD_WATCH_COOLDOWN_MS, AD_WATCH_CASH_REWARD,
  DPS_BOOST_PERCENT_PER_STACK, DPS_BOOST_DURATION_MS, DPS_BOOST_MAX_STACKS,
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
  if (item.kind === 'gold') state.gold += item.amount;
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
// Turbo de DPS (anúncio #2): até DPS_BOOST_MAX_STACKS cargas de +
// DPS_BOOST_PERCENT_PER_STACK% de DPS por DPS_BOOST_DURATION_MS cada,
// empilháveis. Cada carga tem seu próprio timestamp de expiração (real,
// corre mesmo offline) — sem cooldown separado, o limite de cargas ativas
// já regula quantas vezes dá pra assistir.
// ---------------------------------------------------------------

/// Filtra as cargas já expiradas (e persiste o array já limpo de volta em
/// state, pra não crescer sem limite) e devolve as que ainda estão ativas.
export function getActiveDpsBoostStacks(state) {
  const now = Date.now();
  const active = (state.dpsBoostExpirations || []).filter((expiresAt) => expiresAt > now);
  state.dpsBoostExpirations = active;
  return active;
}

/// % de DPS a somar em computePlayerStats (ver systems/stats.js) — 0 se
/// nenhuma carga ativa.
export function getActiveDpsBoostPercent(state) {
  return getActiveDpsBoostStacks(state).length * DPS_BOOST_PERCENT_PER_STACK;
}

export function canWatchDpsBoostAd(state) {
  return getActiveDpsBoostStacks(state).length < DPS_BOOST_MAX_STACKS;
}

export function watchDpsBoostAd(state) {
  if (!canWatchDpsBoostAd(state)) return false;
  const active = getActiveDpsBoostStacks(state);
  active.push(Date.now() + DPS_BOOST_DURATION_MS);
  state.dpsBoostExpirations = active;
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

export function canWatchOfflineBonusAd(state) {
  return (state.offlineBonusSeconds || 0) < OFFLINE_BONUS_MAX_SECONDS;
}

export function watchOfflineBonusAd(state) {
  if (!canWatchOfflineBonusAd(state)) return false;
  state.offlineBonusSeconds = Math.min(
    OFFLINE_BONUS_MAX_SECONDS,
    (state.offlineBonusSeconds || 0) + OFFLINE_BONUS_SECONDS_PER_STACK,
  );
  return true;
}
