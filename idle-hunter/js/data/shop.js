// Cash sink: instant gold/Runas packs. Prices are a first pass, not
// carefully balanced against the achievement/ad income rate yet.
export const CASH_SHOP_ITEMS = [
  { id: 'cash_gold_s', name: 'Saco de Ouro', emoji: '💰', cost: 10, kind: 'gold', amount: 5000, description: '+5.000 de ouro na hora.' },
  { id: 'cash_gold_l', name: 'Baú de Ouro', emoji: '🪙', cost: 40, kind: 'gold', amount: 30000, description: '+30.000 de ouro na hora.' },
  { id: 'cash_runas_s', name: 'Punhado de Runas', emoji: '🔮', cost: 25, kind: 'runas', amount: 5, description: '+5 Runas na hora.' },
  { id: 'cash_runas_l', name: 'Bolsa de Runas', emoji: '💠', cost: 90, kind: 'runas', amount: 20, description: '+20 Runas na hora.' },
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

// Event-currency sink, generated per family so every unlocked monster has
// a Gem (bypasses its 0.5% drop chance) and bulk material bundles for sale.
// `tier` is the family's index in MONSTER_FAMILIES (0-based), same knob
// items.js uses to scale crafting costs.
export function eventShopItemsForFamily(family, tier) {
  return [
    {
      id: `${family.id}_gem_buy`, name: family.materials.gem.name, emoji: family.materials.gem.emoji,
      matId: family.materials.gem.id, amount: 1, cost: Math.round(30 + tier * 15),
    },
    {
      id: `${family.id}_common_bundle`, name: `${family.materials.common.name} (x25)`, emoji: family.materials.common.emoji,
      matId: family.materials.common.id, amount: 25, cost: Math.round(8 + tier * 3),
    },
    {
      id: `${family.id}_rare_bundle`, name: `${family.materials.rare.name} (x8)`, emoji: family.materials.rare.emoji,
      matId: family.materials.rare.id, amount: 8, cost: Math.round(14 + tier * 5),
    },
  ];
}
