// Apoio ao site (doação pelo Mercado Pago): só cosméticos, nenhuma vantagem
// nos jogos. Cada efeito de nick é liberado a partir de um valor total
// apoiado. A mesma tabela de valores está no banco (0008_apoio.sql).

export const EFEITOS = [
  { id: 'ouro', nome: 'Ouro', desc: 'Dourado metálico', minimo: 5 },
  { id: 'neon', nome: 'Neon', desc: 'Azul neon com brilho pulsando', minimo: 5 },
  { id: 'gelo', nome: 'Gelo', desc: 'Azul congelado com geada', minimo: 5 },
  { id: 'chamas', nome: 'Chamas', desc: 'Fogo tremulando', minimo: 10 },
  { id: 'quimico', nome: 'Químico', desc: 'Verde tóxico que borbulha', minimo: 10 },
  { id: 'hextech', nome: 'Hextech', desc: 'Azul e dourado com energia correndo', minimo: 10 },
  { id: 'reflexo', nome: 'Reflexo', desc: 'Dourado com um reflexo de luz passando', minimo: 25 },
  { id: 'vazio', nome: 'Vazio', desc: 'Roxo do Vazio, ondulando', minimo: 25 },
  { id: 'glitch', nome: 'Glitch', desc: 'Falha digital em vermelho e azul', minimo: 25 },
  { id: 'prisma', nome: 'Prisma', desc: 'Arco-íris em movimento (o mais raro)', minimo: 50 },
];

export const VALORES_SUGERIDOS = [5, 10, 25, 50];
export const VALOR_MINIMO = 5;
export const VALOR_MAXIMO = 1000;

export const efeitoInfo = (id) => EFEITOS.find((e) => e.id === id) || null;
export const efeitoLiberado = (id, total) => Boolean(efeitoInfo(id)) && Number(total || 0) >= efeitoInfo(id).minimo;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// Nick com o efeito escolhido (sem efeito: texto normal). `total` evita
// mostrar um efeito que deixou de valer (ex.: apoio estornado).
export function nickHtml(nome, efeito, total = Infinity) {
  if (!efeito || !efeitoLiberado(efeito, total)) return `<span class="nick">${esc(nome)}</span>`;
  return `<span class="nick fx fx-${efeito}" data-text="${esc(nome)}">${esc(nome)}</span>`;
}
