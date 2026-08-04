// Cash sink: instant gold packs. Prices are a first pass, not carefully
// balanced against the achievement/ad income rate yet.
export const CASH_SHOP_ITEMS = [
  { id: 'cash_gold_s', name: 'Saco de Ouro', emoji: '💰', cost: 10, kind: 'gold', amount: 5000, description: '+5.000 de ouro na hora.' },
  { id: 'cash_gold_l', name: 'Baú de Ouro', emoji: '🪙', cost: 40, kind: 'gold', amount: 30000, description: '+30.000 de ouro na hora.' },
  // Por tempo, NÃO empilhável — cada compra soma VIP_DURATION_MS (30 dias)
  // a partir de agora (ver buyCashItem em systems/shop.js); enquanto
  // state.vipExpiresAt ainda está no futuro (isVipActive, ver state.js), a
  // compra fica bloqueada (canBuyCashItem) até o contador zerar de vez.
  // Sem "amount" nenhum pra dar (kind: 'vip' é tratado à parte de
  // kind: 'gold' em buyCashItem). Efeitos reais enquanto ativo: +50 no
  // limite de inventário de itens (VIP_INVENTORY_BONUS, ver
  // data/items.js) e +100 no de mascotes (PET_VIP_INVENTORY_BONUS, ver
  // data/pets.js — valor próprio, maior), escolha livre do mascote da
  // direita ao chocar ovo (ver canChooseRightPet em systems/pets.js), e
  // "Chocar Todos" liberado (ver canHatchAllEggs em systems/pets.js).
  {
    id: 'cash_vip', name: 'VIP', emoji: '👑', cost: 10, kind: 'vip',
    description: '30 dias de: +50 no limite de inventário de itens, +100 no de mascotes, escolha livre do mascote da direita ao chocar ovo, e o botão Chocar Todos.',
  },
];

// Free Cash source #1 (besides achievements): a simulated ad view on a
// cooldown. There's no real ad SDK wired up — this just grants the reward
// on click, standing in for that integration.
export const AD_WATCH_COOLDOWN_MS = 5 * 60 * 1000;
export const AD_WATCH_CASH_REWARD = 5;

// Free Cash source #2: real-money packages. No payment processor exists in
// this prototype, so these render as disabled placeholders in the shop —
// scaffolding for a future integration, not a working purchase flow.
export const CASH_REAL_MONEY_PACKAGES = [
  { id: 'pack_s', cashAmount: 100, priceLabel: 'R$ 9,90' },
  { id: 'pack_m', cashAmount: 550, priceLabel: 'R$ 39,90' },
  { id: 'pack_l', cashAmount: 1200, priceLabel: 'R$ 79,90' },
];

// Event-currency sink, generated per boss so every unlocked one has a
// Crystal (bypasses its 0.1% drop chance) and bulk bundles of its
// "drop principal" material(s) for sale. `tier` is the boss's index in
// BOSSES (0-based), same knob items.js uses to scale crafting costs.
export function eventShopItemsForBoss(boss, tier) {
  const items = [
    {
      id: `${boss.id}_crystal_buy`, name: boss.crystal.name, emoji: boss.crystal.emoji, image: boss.crystal.image || null,
      matId: boss.crystal.id, amount: 1, cost: Math.round(30 + tier * 15),
    },
    {
      id: `${boss.id}_primary1_bundle`, name: `${boss.materials.primary1.name} (x25)`, emoji: boss.materials.primary1.emoji, image: boss.materials.primary1.image || null,
      matId: boss.materials.primary1.id, amount: 25, cost: Math.round(8 + tier * 3),
    },
  ];
  // Alguns bosses (ex: Thornak, ver data/monsters.js) têm só 1 material de
  // drop de verdade — primary1 e primary2 apontam pro mesmo id nesse caso
  // (o schema compartilhado ainda exige os 2 campos preenchidos) — pula a
  // 2ª linha pra não vender o mesmo material duas vezes na loja.
  if (boss.materials.primary2.id !== boss.materials.primary1.id) {
    items.push({
      id: `${boss.id}_primary2_bundle`, name: `${boss.materials.primary2.name} (x25)`, emoji: boss.materials.primary2.emoji, image: boss.materials.primary2.image || null,
      matId: boss.materials.primary2.id, amount: 25, cost: Math.round(8 + tier * 3),
    });
  }
  return items;
}
