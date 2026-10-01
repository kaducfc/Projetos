// Apoio ao site (doação pelo Mercado Pago): só cosmético, nenhuma vantagem
// nos jogos. Quem apoia com qualquer valor ganha automaticamente o efeito
// "Reflexo" no nick (dourado com um reflexo de luz passando), no perfil, no
// ranking e na barra do site.

export const VALORES_SUGERIDOS = [5, 10, 25, 50];
export const VALOR_MINIMO = 5;
export const VALOR_MAXIMO = 1000;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Nick com o efeito de apoiador (`apoiador` = já apoiou o site).
export function nickHtml(nome, apoiador = false) {
  return apoiador
    ? `<span class="nick fx fx-reflexo" title="Apoiador do Rift Arcade">${esc(nome)}</span>`
    : `<span class="nick">${esc(nome)}</span>`;
}
