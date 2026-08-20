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
  // kind: 'gold' em buyCashItem). `durationLabel` e `benefits` alimentam o
  // card enxuto (nome/duração/botão "Benefícios"/preço, ver cashShopHtml em
  // ui/render.js) — o botão "Benefícios" abre um modal listando `benefits`
  // um por linha, em vez do card mostrar tudo de uma vez.
  {
    id: 'cash_vip', name: 'VIP', emoji: '👑', cost: 10, kind: 'vip',
    durationLabel: '30 dias',
    benefits: [
      '+50 no limite de inventário de itens',
      '+100 no limite de inventário de mascotes',
      'Escolha livre do mascote da direita ao chocar ovo',
      'Botão "Chocar Todos" liberado',
      '+2h no limite de recompensa offline (6h no total)',
      'Nick colorido animado (Arena, Ranks, Combate, Perfil)',
    ],
  },
];

// Compra única (não é assinatura, não expira) em dinheiro real — mesma
// situação de CASH_REAL_MONEY_PACKAGES abaixo: sem processador de
// pagamento de verdade nesse protótipo, então renderiza como placeholder
// desabilitado ("Em breve") na loja, não uma compra funcional. Não há SDK
// de anúncio de verdade no jogo (ver AD_WATCH_COOLDOWN_MS acima), então
// "remover anúncios" hoje não muda nenhum comportamento — é só o item da
// loja, pronto pra quando a integração de pagamento/anúncio existir.
export const CASH_ONE_TIME_PURCHASES = [
  {
    id: 'no_ads', name: 'No Ads', emoji: '🚫', priceLabel: 'R$ 10,00',
    description: 'Retira os anúncios do jogo.',
  },
];

// Free Cash source #1 (besides achievements): a simulated ad view on a
// cooldown. There's no real ad SDK wired up — this just grants the reward
// on click, standing in for that integration.
export const AD_WATCH_COOLDOWN_MS = 5 * 60 * 1000;
export const AD_WATCH_CASH_REWARD = 5;

// 2 bônus adicionais, também via anúncio simulado (sem SDK de anúncio de
// verdade, mesma situação do AD_WATCH_CASH_REWARD acima), cada um com seu
// próprio "estoque" de até 4 cargas — sem cooldown de tempo entre
// assistidas, o limite de 4 cargas já é o que impede assistir sem parar.
//
// 1) Turbo de DPS: +30% de DPS fixo (NÃO empilha — assistir de novo não
// aumenta o bônus) por até 30 min a cada assistida, "empilhável até 4x" só
// no sentido de ESTENDER a duração: cada assistida soma +30 min ao relógio
// (real, corre mesmo offline, ver systems/shop.js watchDpsBoostAd), até um
// teto de 2h restantes (DPS_BOOST_DURATION_MS * DPS_BOOST_MAX_EXTENSIONS).
// O bônus em si nunca passa de +30%, só a duração que dá pra acumular.
export const DPS_BOOST_PERCENT = 30;
export const DPS_BOOST_DURATION_MS = 30 * 60 * 1000;
export const DPS_BOOST_MAX_EXTENSIONS = 4;
export const DPS_BOOST_MAX_DURATION_MS = DPS_BOOST_DURATION_MS * DPS_BOOST_MAX_EXTENSIONS; // 2h

// 2) Bônus Idle: +30 min no limite da recompensa offline, empilhável até 4x
// (2h no total). Diferente do Turbo de DPS acima, isso NÃO é um timer que
// corre sozinho — é um "banco" de minutos extras que só é gasto quando o
// jogador realmente fica offline além do limite base (ver
// systems/offline.js computeOfflineProgress): ficar offline por menos que
// o limite base não consome nada do banco, ele continua cheio pra próxima.
export const OFFLINE_BONUS_SECONDS_PER_STACK = 30 * 60;
export const OFFLINE_BONUS_MAX_STACKS = 4;
export const OFFLINE_BONUS_MAX_SECONDS = OFFLINE_BONUS_SECONDS_PER_STACK * OFFLINE_BONUS_MAX_STACKS; // 2h

// Free Cash source #2: real-money packages. No payment processor exists in
// this prototype, so these render as disabled placeholders in the shop —
// scaffolding for a future integration, not a working purchase flow.
export const CASH_REAL_MONEY_PACKAGES = [
  { id: 'pack_s', cashAmount: 100, priceLabel: 'R$ 9,90' },
  { id: 'pack_m', cashAmount: 550, priceLabel: 'R$ 39,90' },
  { id: 'pack_l', cashAmount: 1200, priceLabel: 'R$ 79,90' },
];

// Event-currency sink, generated per boss so every unlocked one has bulk
// bundles of its "drop principal" material(s) for sale. `tier` is the
// boss's index in BOSSES (0-based), same knob items.js uses to scale
// crafting costs.
export function eventShopItemsForBoss(boss, tier) {
  const items = [
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
