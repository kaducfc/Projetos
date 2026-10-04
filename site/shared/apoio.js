// Apoio ao site (doação pelo Mercado Pago): só cosmético, nenhuma vantagem
// nos jogos. Quem apoia com qualquer valor ganha automaticamente o efeito
// "Reflexo" no nick (dourado com um reflexo de luz passando), no perfil, no
// ranking e na barra do site.

import { efeitoAtivo } from './efeitos.js';

export const VALORES_SUGERIDOS = [5, 10, 25, 50];
export const VALOR_MINIMO = 5;
// Sem limite para cima (só o teto técnico do banco, numeric(10, 2)).
export const VALOR_MAXIMO = 99999999;
// A partir deste valor, pede confirmação (evita um zero a mais sem querer).
export const VALOR_CONFIRMAR = 1000;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Nick com o efeito escolhido (`apoiador` = já apoiou o site; `escolha` = efeito
// que o jogador selecionou: null automático, 'nenhum' ou o id).
export function nickHtml(nome, apoiador = false, escolha = null) {
  const fx = efeitoAtivo(escolha, apoiador);
  return fx
    ? `<span class="nick fx ${fx.classe}" title="${esc(fx.titulo || `Efeito ${fx.nome}`)}">${esc(nome)}</span>`
    : `<span class="nick">${esc(nome)}</span>`;
}
