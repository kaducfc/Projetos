// Molduras: uma imagem que envolve o ícone do jogador, como uma borda enfeitada.
// A arte fica em shared/assets/molduras/<id>.webp: quadrada, fundo transparente, com o
// buraco do meio (onde aparece o ícone) centralizado. `k` = diâmetro do menor círculo que cobre o buraco, dividido
// pela largura da imagem; o ícone fica 7% maior que o menor círculo que cobre o buraco para a moldura
// cobrir a emenda. Quem pode usar é decidido pelo servidor (site_recompensas, tipo
// 'moldura'). Para lançar uma moldura de teste: mover para MOLDURAS e trocar `tema`
// por `como` (o texto que explica como conseguir).

export const MOLDURAS = [
  // "Rank" é uma moldura só, de todos os jogadores: mostra a arte do elo atual e muda sozinha
  // quando o jogador sobe ou desce de elo (ver ELOS_MOLDURAS).
  { id: 'rank', nome: 'Rank', virtual: true, publica: true },
  { id: 'hw-moldura-1', nome: 'Vampito', k: 0.5879, como: 'Recompensa do nível 8 do Passe de Batalha.' },
  { id: 'hw-moldura-2', nome: 'Abóboras e Espinhos', k: 0.5962, como: 'Recompensa do nível 4 do Passe de Batalha.' },
  { id: 'hw-moldura-3', nome: 'Correntes e Caveiras', k: 0.591, como: 'Recompensa do nível 7 do Passe de Batalha.' },
  // À venda por Rift Coins (site_loja, 0081_loja_molduras.sql): `preco` só serve para mostrar.
  { id: 'mn-poro', nome: 'Poro da Floresta', k: 0.5794, preco: 2000, como: 'Compre por 2.000 RC.' },
  { id: 'mn-hextech', nome: 'Neon Hextech', k: 0.6213, anim: 'mfa-hextech', preco: 6000, como: 'Compre por 6.000 RC.' },
  { id: 'mn-robo', nome: 'Robô de Batalha', k: 0.5721, anim: 'mfb-robo', camadas: ['lar', 'lar2', 'scan', 'ant ant1', 'ant ant2', 'tampa', 'ol e1', 'ol e2'], mascaras: ['laranja'], preco: 10000, como: 'Compre por 10.000 RC.' },
];

// Só o administrador recebe (aba Teste do painel).
export const MOLDURAS_TESTE = [
  // Molduras de arte (imagem) em teste: só administradores equipam (0078_molduras_teste_novas.sql).
  { id: 'mn-zaun', nome: 'Canos de Zaun', k: 0.5525, anim: 'mfb-zaun', camadas: ['verde', 'bolhas', 'ambar', 'roda', 'mano', 'vapor v1', 'vapor v2', 'vapor v3'], mascaras: ['verde', 'ambar', 'roda'], tema: 'Zaun · canos, válvulas e líquido verde' },
  { id: 'mn-pirata', nome: 'Capitão Pirata', k: 0.5306, anim: 'mfb-pirata', camadas: ['luz', 'chama', 'lenco', 'ouro', 'leme', 'olho o1', 'olho o2', 'brasa b1', 'brasa b2', 'brasa b3'], mascaras: ['chama', 'lenco', 'ouro', 'leme'], tema: 'Pirata · corda, lampião e timão' },
];

// Uma moldura por elo (a arte vem em shared/assets/molduras/elo-<elo>.webp). Elas não são
// escolhidas uma a uma: quem equipa "Rank" mostra sempre a do elo atual.
export const ELOS_MOLDURAS = [
  { id: 'elo-ferro', elo: 'ferro', nome: 'Ferro', k: 0.5521 },
  { id: 'elo-bronze', elo: 'bronze', nome: 'Bronze', k: 0.566 },
  { id: 'elo-prata', elo: 'prata', nome: 'Prata', k: 0.538 },
  { id: 'elo-ouro', elo: 'ouro', nome: 'Ouro', k: 0.5524 },
  { id: 'elo-platina', elo: 'platina', nome: 'Platina', k: 0.5333 },
  { id: 'elo-esmeralda', elo: 'esmeralda', nome: 'Esmeralda', k: 0.5385 },
  { id: 'elo-diamante', elo: 'diamante', nome: 'Diamante', k: 0.5383 },
  { id: 'elo-mestre', elo: 'mestre', nome: 'Mestre', k: 0.5222 },
  { id: 'elo-grao-mestre', elo: 'grao-mestre', nome: 'Grão-Mestre', k: 0.5279 },
  { id: 'elo-desafiante', elo: 'desafiante', nome: 'Desafiante', k: 0.4664 },
];

// "rank" vira a moldura do elo informado (sem elo, a do Ferro, onde todo mundo começa).
export function resolverMoldura(id, elo = null) {
  if (id !== 'rank') return id;
  return ELOS_MOLDURAS.some((m) => m.elo === elo) ? `elo-${elo}` : 'elo-ferro';
}

const TODAS = new Map([...MOLDURAS, ...MOLDURAS_TESTE, ...ELOS_MOLDURAS].map((m) => [m.id, m]));
export const molduraPorId = (id) => TODAS.get(id) || null;
export const srcMoldura = (id) => (TODAS.has(id) ? `/shared/assets/molduras/${id}.webp` : '');

// Pasta das camadas de efeito (máscaras): shared/assets/molduras/<id>-<camada>.webp, mesma tela da arte.
export const srcMascara = (id, nome) => `/shared/assets/molduras/${id}-${nome}.webp`;

// Largura da imagem (em % do ícone) e deslocamento para centralizar.
export function geometriaMoldura(id) {
  const k = TODAS.get(id)?.k || 0.714;
  const w = 100 / (k * (TODAS.get(id)?.sobra || 1.07));
  return { w, off: -(w - 100) / 2 };
}
