import { CASH_SHOP_ITEMS, AD_WATCH_COOLDOWN_MS, AD_WATCH_CASH_REWARD } from '../data/shop.js';
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
