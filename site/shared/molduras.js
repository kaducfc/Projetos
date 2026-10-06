// Molduras: uma imagem que envolve o ícone do jogador, como uma borda enfeitada.
// A arte fica em shared/assets/molduras/<id>.webp: quadrada, fundo transparente, com o
// buraco do meio (onde aparece o ícone) centralizado. `k` = diâmetro do menor círculo que cobre o buraco, dividido
// pela largura da imagem; o ícone fica 7% maior que o menor círculo que cobre o buraco para a moldura
// cobrir a emenda. Quem pode usar é decidido pelo servidor (site_recompensas, tipo
// 'moldura'). Para lançar uma moldura de teste: mover para MOLDURAS e trocar `tema`
// por `como` (o texto que explica como conseguir).

export const MOLDURAS = [
  { id: 'hw-moldura-1', nome: 'Vampito', k: 0.5879, como: 'Recompensa do nível 8 do Passe de Batalha.' },
  { id: 'hw-moldura-2', nome: 'Abóboras e Espinhos', k: 0.5962, como: 'Recompensa do nível 4 do Passe de Batalha.' },
  { id: 'hw-moldura-3', nome: 'Correntes e Caveiras', k: 0.591, como: 'Recompensa do nível 7 do Passe de Batalha.' },
];

// Só o administrador recebe (aba Teste do painel).
export const MOLDURAS_TESTE = [];

const TODAS = new Map([...MOLDURAS, ...MOLDURAS_TESTE].map((m) => [m.id, m]));
export const molduraPorId = (id) => TODAS.get(id) || null;
export const srcMoldura = (id) => (TODAS.has(id) ? `/shared/assets/molduras/${id}.webp` : '');

// Largura da imagem (em % do ícone) e deslocamento para centralizar.
export function geometriaMoldura(id) {
  const k = TODAS.get(id)?.k || 0.714;
  const w = 100 / (k * (TODAS.get(id)?.sobra || 1.07));
  return { w, off: -(w - 100) / 2 };
}
