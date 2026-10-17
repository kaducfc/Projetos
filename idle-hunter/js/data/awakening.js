import { GOD_CARDS } from './cards.js';
import { GOD_ITEMS } from './items.js';

// Transcender (ver systems/awakening.js): um reset de prestígio liberado
// depois de derrotar pela 1ª vez o chefe da última zona. Cada Transcender
// concede 1 Fragmento do Despertar (acumulável) e reseta o jogo quase
// inteiro — só cartas e itens/mascotes comprados na Loja do Despertar
// sobrevivem (ver systems/awakening.js PRESERVED_KEYS).
export const AWAKENING_SHARD_ID = 'awakening_shard';
export const AWAKENING_SHARD_NAME = 'Fragmento do Despertar';
export const AWAKENING_SHARD_EMOJI = '🌌';

// Catálogo da Loja do Despertar. Cada entrada carrega `kind` + o id do que
// ela concede, lido por systems/awakening.js buyAwakeningItem.
//
// As 5 cartas "Deus" (ver GOD_CARDS em data/cards.js) — compra instantânea
// (botão direto no card da loja, mesmo fluxo que a antiga carta Supremo
// tinha), 1 Fragmento do Despertar cada. name/image/description já vêm do
// próprio card, sem duplicar aqui.
const GOD_CARD_SHOP_ITEMS = GOD_CARDS.map((card) => ({
  id: `awk_${card.id}`, name: card.name, emoji: '🃏', image: card.image,
  kind: 'card', cardId: card.id, cost: 1, description: card.description,
}));

// Os 13 itens "Tier God" (ver GOD_ITEMS em data/items.js) — cada entrada
// só guarda o id do molde + custo; nome/imagem/atributo etc já vêm do
// próprio getItem(itemId), sem duplicar aqui (ver awakeningShopItemCardHtml
// em ui/render.js). Diferente das cartas acima (compra instantânea, botão
// direto no card da loja), clicar num item Deus abre uma janela de
// "especificações" antes de confirmar a compra (showGodItemShopDetailModal
// em ui/render.js) — pedido explícito do usuário.
const GOD_SHOP_ITEMS = GOD_ITEMS.map((item) => ({
  id: `awk_${item.id}`, kind: 'god_item', itemId: item.id, cost: 1,
}));

export const AWAKENING_SHOP_ITEMS = [
  ...GOD_CARD_SHOP_ITEMS,
  ...GOD_SHOP_ITEMS,
];
