// Ranqueada: elos com divisões e PDR (Pontos de Rank) em todos os jogos.
// As regras de verdade ficam no banco (0015_ranqueada_pdr.sql e
// 0016_diarios_servidor.sql); os números aqui precisam bater com os de lá.
//
// Escada (pts): 0..2099 = Ferro 3 … Diamante 1 (100 PDR por divisão);
// 2100+ = Mestre (PDR sem limite). Grão-Mestre e Desafiante saem da
// atualização diária (ordem de PDR).

export const ELOS = [
  { id: 'ferro', nome: 'Ferro', cor: '#8c8580' },
  { id: 'bronze', nome: 'Bronze', cor: '#c07a4c' },
  { id: 'prata', nome: 'Prata', cor: '#b4bec8' },
  { id: 'ouro', nome: 'Ouro', cor: '#e8b93f' },
  { id: 'platina', nome: 'Platina', cor: '#4fd1b9' },
  { id: 'esmeralda', nome: 'Esmeralda', cor: '#2fbf71' },
  { id: 'diamante', nome: 'Diamante', cor: '#6f8cff' },
  { id: 'mestre', nome: 'Mestre', cor: '#b65cf0' },
  { id: 'grao-mestre', nome: 'Grão-Mestre', cor: '#ef4f3c' },
  { id: 'desafiante', nome: 'Desafiante', cor: '#f5cf5a' },
];
export const PDR_DIVISAO = 100;
export const PTS_MESTRE = 2100; // Ferro 3 0 PDR → Mestre
export const VAGAS_DESAFIANTE = 100;
export const MIN_DESAFIANTE = 500;
export const VAGAS_GRAO_MESTRE = 200;
export const MIN_GRAO_MESTRE = 200;
export const PARTIDAS_POR_DIA = 5; // Carreira e Lendas: as 5 primeiras do dia (igual a 0028_ranqueada_5_partidas.sql)
export const NAO_TERMINOU = -15; // Carreira/Lendas começada e não terminada no dia
export const INATIVIDADE = { aPartir: 'ouro', dias: 3, pdr: -25 };

export const eloInfo = (id) => ELOS.find((e) => e.id === id) || ELOS[0];
export const nivelElo = (id) => Math.max(0, ELOS.findIndex((e) => e.id === id));

// Posição na escada → { elo, divisao (3..1 ou null), pdr }.
export function divisaoDe(pts = 0, elo = null) {
  if (pts >= PTS_MESTRE) return { elo: elo && nivelElo(elo) >= 7 ? elo : 'mestre', divisao: null, pdr: pts - PTS_MESTRE };
  const n = Math.floor(pts / 300);
  return { elo: ELOS[n].id, divisao: 3 - Math.floor((pts % 300) / 100), pdr: pts % 100 };
}
// "Ouro 2", "Mestre"…
export const nomeDivisao = (d) => `${eloInfo(d.elo).nome}${d.divisao ? ` ${d.divisao}` : ''}`;

// Ganhos por elo, em % (igual a site_rk_ganho_pct): Ferro 100; Bronze a Ouro
// 80; Platina e Esmeralda 70; Diamante 60; Mestre para cima 50. Perdas: 100%.
export const GANHO_POR_ELO = [100, 80, 80, 80, 70, 70, 60, 50, 50, 50];
// PDR de tabela (+5..+38 ou −2..−25) → PDR do elo (site_rk_ajustar).
export function ajustarPdr(base, nivel = 0) {
  if (base <= 0) return Math.max(-25, base);
  return Math.max(1, Math.round(Math.min(38, base) * GANHO_POR_ELO[Math.min(9, Math.max(0, nivel))] / 100));
}

// Tabelas de PDR (antes do % do elo).
export const PDR_CARREIRA = [[150, -25], [250, -16], [399, -2], [400, 5], [600, 13], [800, 20], [1000, 28], [1100, 32], [1300, 34], [1600, 38]];
export const PDR_RUNETERMO = [35, 28, 22, 16, 11, 6, 5];
export const PDR_LENDAS = [
  ['Campeão invicto (7-0 e sem perder jogo nos playoffs)', '+35'],
  ['Campeão', '+25 a +31'],
  ['Vice', '+14 a +17'],
  ['Semifinal', '+9 a +12'],
  ['Quartas', '+5 a +8'],
  ['Fora na fase de pontos', '−24 (0 vitórias), −20 (1), −16 (2) ou −12 (3)'],
];

// Benefícios: cada elo mantém os dos elos abaixo.
export const BENEFICIOS = [
  { elo: 'prata', jogo: 'Runetermo', texto: 'a categoria da palavra (campeão, item, região…) aparece desde o começo' },
  { elo: 'ouro', jogo: 'Lendas do CBLOL', texto: '+1 dado bônus por partida (2 no total)' },
  { elo: 'platina', jogo: 'Campeão Oculto', texto: '+1 dica por dia (2 no total)' },
  { elo: 'esmeralda', jogo: 'Campeão Oculto', texto: '+1 dica por dia (3 no total)' },
  { elo: 'diamante', jogo: 'Runetermo', texto: '+1 tentativa (7 no total)' },
  { elo: 'desafiante', jogo: 'Lendas do CBLOL e Campeão Oculto', texto: '+1 dado bônus (3 no total) e +1 tentativa no Campeão Oculto (9 no total)' },
];

// OVR inicial na Carreira no Rift: 50 + 1 por elo (Ferro +0 … Desafiante +9).
export const bonusCarreira = (elo) => (elo ? nivelElo(elo) : 0);

// O que o elo libera em cada jogo (sem conta ou sem elo: nada extra).
export function vantagens(elo) {
  const n = elo ? nivelElo(elo) : 0;
  return {
    categoriaRunetermo: n >= 2,
    dadosBonus: 1 + (n >= 3 ? 1 : 0) + (n >= 9 ? 1 : 0),
    dicasCampeao: 1 + (n >= 4 ? 1 : 0) + (n >= 5 ? 1 : 0),
    tentativasRunetermo: 6 + (n >= 6 ? 1 : 0),
    tentativasCampeao: 8 + (n >= 9 ? 1 : 0),
  };
}

// Emblema do elo (imagens em shared/assets/elos). Pequeno (até 40 px): o
// recorte justo; grande: o recorte comum (os elos altos ficam maiores).
// `vazio` = ainda sem ranque (Ferro apagado).
export function emblemaHtml(elo, size = 64, { vazio = false } = {}) {
  const e = eloInfo(elo);
  const icone = size <= 40;
  const h = icone ? size : Math.round(size * 267 / 256);
  return `<img class="emblema${vazio ? ' vazio' : ''}" src="/shared/assets/elos/${e.id}${icone ? '-icone' : ''}.webp" alt="" width="${size}" height="${h}" decoding="async" />`;
}

// "+12 PDR" / "−8 PDR".
export const fmtPdr = (n) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(Math.round(n || 0))} PDR`;
