// Molduras: uma imagem que envolve o ícone do jogador, como uma borda enfeitada.
// A arte fica em shared/assets/molduras/<id>.webp (ou .png): quadrada, com fundo
// transparente e o buraco do meio (onde aparece o ícone) com 1/1,4 da largura da
// imagem (~71%), centralizado. A imagem é desenhada 40% maior que o ícone.
// Quem pode usar é decidido pelo servidor (site_recompensas, tipo 'moldura').
// Para lançar uma moldura de teste: mover o item para MOLDURAS e trocar `tema` por `como`.

export const MOLDURAS = [];

// Só o administrador recebe (aba Teste do painel).
export const MOLDURAS_TESTE = [
  { id: 'hw-teste', nome: 'Moldura de teste', tema: 'Halloween · anel de espinhos' },
];

const TODAS = new Map([...MOLDURAS, ...MOLDURAS_TESTE].map((m) => [m.id, m]));
export const molduraPorId = (id) => TODAS.get(id) || null;
export const srcMoldura = (id) => (TODAS.has(id) ? `/shared/assets/molduras/${id}.webp` : '');
