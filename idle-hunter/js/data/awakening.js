import { SUPREMO_CARD_ID } from './cards.js';
import { GOD_ITEMS } from './items.js';

// Transcender (ver systems/awakening.js): um reset de prestígio liberado
// depois de derrotar pela 1ª vez o chefe da última zona. Cada Transcender
// concede 1 Fragmento do Despertar (acumulável) e reseta o jogo quase
// inteiro — só cartas e itens/mascotes comprados na Loja do Despertar
// sobrevivem (ver systems/awakening.js PRESERVED_KEYS).
export const AWAKENING_SHARD_ID = 'awakening_shard';
export const AWAKENING_SHARD_NAME = 'Fragmento do Despertar';
export const AWAKENING_SHARD_EMOJI = '🌌';

// Catálogo da Loja do Despertar — por enquanto só a carta Supremo
// (placeholder; o usuário vai criar os itens personalizados depois). Cada
// entrada carrega `kind` + o id do que ela concede, lido por
// systems/awakening.js buyAwakeningItem.
// Os 13 itens "Tier God" (ver GOD_ITEMS em data/items.js) — cada entrada
// só guarda o id do molde + custo; nome/imagem/atributo etc já vêm do
// próprio getItem(itemId), sem duplicar aqui (ver awakeningShopItemCardHtml
// em ui/render.js). Diferente da carta Supremo (compra instantânea, botão
// direto no card da loja), clicar num item Deus abre uma janela de
// "especificações" antes de confirmar a compra (showGodItemShopDetailModal
// em ui/render.js) — pedido explícito do usuário.
const GOD_SHOP_ITEMS = GOD_ITEMS.map((item) => ({
  id: `awk_${item.id}`, kind: 'god_item', itemId: item.id, cost: 1,
}));

export const AWAKENING_SHOP_ITEMS = [
  {
    id: 'awk_supremo_card', name: 'Supremo', emoji: '🌌', kind: 'card', cardId: SUPREMO_CARD_ID, cost: 1,
    description: '+50% de DPS quando equipada.',
  },
  ...GOD_SHOP_ITEMS,
];
