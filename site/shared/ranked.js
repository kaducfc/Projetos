// Ranqueada (Carreira no Rift): elos, médias para subir e os pequenos
// benefícios que cada elo dá nos outros jogos. As regras de verdade ficam no
// banco (0006_ranqueada.sql); os números aqui precisam bater com os de lá.

export const ELOS = [
  { id: 'bronze', nome: 'Bronze', cor: '#b0784f', media: 0 },
  { id: 'prata', nome: 'Prata', cor: '#b4bec8', media: 500 },
  { id: 'ouro', nome: 'Ouro', cor: '#e8b93f', media: 650 },
  { id: 'platina', nome: 'Platina', cor: '#4fc8b9', media: 750 },
  { id: 'diamante', nome: 'Diamante', cor: '#7d97ff', media: 850 },
  { id: 'desafiante', nome: 'Desafiante', cor: '#f5cf5a', media: 950 },
];
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

// Escudo do elo (SVG), na cor do elo. `vazio` = ainda sem ranque.
export function emblemaHtml(elo, size = 64, { vazio = false } = {}) {
  const e = eloInfo(elo);
  const cor = vazio ? '#6b6455' : e.cor;
  const n = nivelElo(e.id);
  // Detalhes crescem com o elo: faixas, asas e coroa no Desafiante.
  const faixas = vazio ? '' : Array.from({ length: Math.min(n, 4) }, (_, i) => `<path d="M20 ${50 - i * 6}h24" stroke="${cor}" stroke-width="2.4" stroke-linecap="round" opacity="${0.55 + i * 0.1}"/>`).join('');
  const asas = !vazio && n >= 3 ? `<path d="M6 22 0 16v18l6 6M58 22l6-6v18l-6 6" fill="none" stroke="${cor}" stroke-width="2.5" stroke-linejoin="round"/>` : '';
  const coroa = !vazio && n >= 5 ? `<path d="M22 3 26 10 32 2l6 8 4-7 2 11H20Z" fill="${cor}"/>` : '';
  return `<svg class="emblema" width="${size}" height="${Math.round(size * 1.13)}" viewBox="-2 -2 68 74" aria-hidden="true">
    ${asas}${coroa}
    <path d="M32 8 58 18v19c0 15-11 25-26 30C17 62 6 52 6 37V18Z" fill="${cor}" fill-opacity="0.16" stroke="${cor}" stroke-width="3" ${vazio ? 'stroke-dasharray="6 5"' : ''}/>
    <path d="M32 16 50 23v14c0 10-8 17-18 21-10-4-18-11-18-21V23Z" fill="${cor}" fill-opacity="${vazio ? 0 : 0.35}"/>
    ${vazio ? `<text x="32" y="44" text-anchor="middle" font-size="22" font-weight="800" fill="${cor}" font-family="Inter, sans-serif">?</text>` : faixas}
  </svg>`;
}
