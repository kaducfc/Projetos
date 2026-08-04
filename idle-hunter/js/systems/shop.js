import { CASH_SHOP_ITEMS, AD_WATCH_COOLDOWN_MS, AD_WATCH_CASH_REWARD } from '../data/shop.js';
import { isVipActive, VIP_DURATION_MS } from '../state.js';

export function canBuyCashItem(state, id) {
  const item = CASH_SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return false;
  // VIP é por tempo, não permanente — comprar de novo é sempre válido,
  // mesmo já sendo VIP (empilha mais VIP_DURATION_MS em cima, ver
  // buyCashItem abaixo), diferente de um desbloqueio único.
  return state.cash >= item.cost;
}

export function buyCashItem(state, id) {
  if (!canBuyCashItem(state, id)) return false;
  const item = CASH_SHOP_ITEMS.find((i) => i.id === id);
  state.cash -= item.cost;
  if (item.kind === 'gold') state.gold += item.amount;
  else if (item.kind === 'vip') {
    // Empilha: se o VIP ainda está ativo, soma a partir do vencimento
    // atual (não perde o tempo que já tinha); se já expirou (ou nunca
    // comprou), começa a contar a partir de agora.
    const now = Date.now();
    const base = isVipActive(state, now) ? state.vipExpiresAt : now;
    state.vipExpiresAt = base + VIP_DURATION_MS;
  }
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
