// Ranqueada (Carreira no Rift): elos, médias para subir e os pequenos
// benefícios que cada elo dá nos outros jogos. As regras de verdade ficam no
// banco (0006_ranqueada.sql); os números aqui precisam bater com os de lá.

// pontos = soma das notas do ciclo de 3 dias para subir PARA o elo.
export const ELOS = [
  { id: 'bronze', nome: 'Bronze', cor: '#c07a4c', pontos: 0 },
  { id: 'prata', nome: 'Prata', cor: '#b4bec8', pontos: 1500 },
  { id: 'ouro', nome: 'Ouro', cor: '#e8b93f', pontos: 1950 },
  { id: 'platina', nome: 'Platina', cor: '#4fd1b9', pontos: 2250 },
  { id: 'diamante', nome: 'Diamante', cor: '#6f8cff', pontos: 2550 },
  { id: 'desafiante', nome: 'Desafiante', cor: '#f5cf5a', pontos: 2850 },
];
// Abaixo disto no ciclo, cai 1 elo (1/6 da meta do próprio elo).
export const minimoParaFicar = (id) => (['prata', 'ouro', 'platina', 'diamante'].includes(id) ? Math.floor(eloInfo(id).pontos / 6) : 0);
export const VAGAS_DESAFIANTE = 100;
export const PARTIDAS_POR_DIA = 3;
export const DIAS_POR_CICLO = 3;

export const eloInfo = (id) => ELOS.find((e) => e.id === id) || ELOS[0];
export const nivelElo = (id) => Math.max(0, ELOS.findIndex((e) => e.id === id));

// Benefícios: cada elo mantém os dos elos abaixo.
export const BENEFICIOS = [
  { elo: 'prata', jogo: 'Runetermo', texto: 'a categoria da palavra (campeão, item, região…) aparece desde o começo' },
  { elo: 'ouro', jogo: 'Lendas do CBLOL', texto: '+1 dado bônus por partida (2 no total)' },
  { elo: 'platina', jogo: 'Campeão Oculto', texto: '+1 dica por dia (2 no total)' },
  { elo: 'diamante', jogo: 'Runetermo', texto: '+1 tentativa (7 no total)' },
  { elo: 'desafiante', jogo: 'Lendas do CBLOL e Campeão Oculto', texto: '+1 dado bônus (3 no total) e +1 tentativa no Campeão Oculto (9 no total)' },
];

// O que o elo libera em cada jogo (sem conta ou sem elo: nada extra).
export function vantagens(elo) {
  const n = elo ? nivelElo(elo) : 0;
  return {
    categoriaRunetermo: n >= 1,
    dadosBonus: 1 + (n >= 2 ? 1 : 0) + (n >= 5 ? 1 : 0),
    dicasCampeao: 1 + (n >= 3 ? 1 : 0),
    tentativasRunetermo: 6 + (n >= 4 ? 1 : 0),
    tentativasCampeao: 8 + (n >= 5 ? 1 : 0),
  };
}

// Emblema do elo (imagens em shared/assets/elos). Pequeno (até 40 px): o
// recorte justo; grande: o recorte comum (os elos altos ficam maiores).
// `vazio` = ainda sem ranque (Bronze apagado).
export function emblemaHtml(elo, size = 64, { vazio = false } = {}) {
  const e = eloInfo(elo);
  const icone = size <= 40;
  const h = icone ? size : Math.round(size * 267 / 256);
  return `<img class="emblema${vazio ? ' vazio' : ''}" src="/shared/assets/elos/${e.id}${icone ? '-icone' : ''}.webp" alt="" width="${size}" height="${h}" decoding="async" />`;
}
