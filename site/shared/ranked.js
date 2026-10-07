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

// Tabelas de PDR (antes do % do elo). Iguais às do banco (0033).
// Carreira: a nota de legado em que o PDR vira positivo é 300 no Ferro, Bronze e
// Prata e 400 do Ouro para cima. De 1.100 para cima é igual para todos.
export const PONTO_ZERO_CARREIRA = (nivel) => (nivel <= 2 ? 300 : 400);
export function baseCarreira(legado, nivel = 3) {
  const ponto = PONTO_ZERO_CARREIRA(nivel);
  if (legado >= 1100) return Math.round(32 + Math.min(6, ((legado - 1100) * 6) / 500));
  if (legado >= ponto) return Math.round(5 + ((legado - ponto) * 27) / (1100 - ponto));
  return -Math.round(2 + Math.min(23, ((ponto - legado) * 23) / 250));
}
// Lendas do CBLOL (modo Oculto): fase de pontos e playoffs. `vitorias` são as da
// fase de pontos (os playoffs começam com 4).
export function baseLendas(resultado, vitorias, invicto = false) {
  const extra = Math.min(3, Math.max(0, vitorias - 4));
  if (resultado === 'campeao') return invicto ? 38 : 28 + 2 * extra;
  if (resultado === 'vice' || resultado === 'final') return 17 + extra;
  if (resultado === 'semi') return 12 + extra;
  if (resultado === 'quartas') return 8 + extra;
  return { 0: -20, 1: -10, 2: -5, 3: 5 }[Math.min(3, Math.max(0, vitorias))];
}
// Show do Barão: PDR de tabela pelo prêmio final (antes do % do elo; iguais às do banco, 0065).
export const PDR_BARAO = [[1000000, 35], [500000, 30], [250000, 25], [100000, 20], [50000, 15], [20000, 10], [10000, 5], [5000, -5], [2000, -10], [1000, -15], [0, -20]];
export const baseBarao = (premio) => PDR_BARAO.find(([min]) => premio >= min)[1];
export const PDR_RUNETERMO = [35, 28, 22, 16, 11, 6, 5];
export const PDR_LENDAS = [
  ['Campeão invicto (7-0 e sem perder jogo nos playoffs)', '+38'],
  ['Campeão', '+28 a +34'],
  ['Vice', '+17 a +20'],
  ['Semifinal', '+12 a +15'],
  ['Quartas', '+8 a +11'],
  ['Fora na fase de pontos', '−20 (0 vitórias), −10 (1), −5 (2) ou +5 (3)'],
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

// OVR inicial na Carreira no Rift: 53 sem conta ou sem elo; com elo, 54 no Ferro
// e +1 por elo (Bronze 55 … Desafiante 63). `bonusCarreira` é o extra sobre os 53.
export const OVR_CARREIRA_BASE = 53;
export const bonusCarreira = (elo) => (elo ? nivelElo(elo) + 1 : 0);

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
