// Regras e rótulos do simulador de técnico, só para exibição.
// A fonte da verdade é o servidor (SQL 0085 a 0089); as contas aqui servem para mostrar prévias e são
// conferidas contra o SQL em tests/tecnico.test.mjs.
export const VAGAS = ['top', 'selva', 'meio', 'atirador', 'suporte'];
export const NOME_VAGA = { top: 'Topo', selva: 'Selva', meio: 'Meio', atirador: 'Atirador', suporte: 'Suporte' };
export const SIGLA_VAGA = { top: 'TOP', selva: 'SEL', meio: 'MID', atirador: 'ADC', suporte: 'SUP' };
export const ATRIBUTOS = [
  { id: 'mec', nome: 'Mecânica' },
  { id: 'rotas', nome: 'Fase de rotas' },
  { id: 'macro', nome: 'Macro' },
  { id: 'tf', nome: 'Teamfight' },
  { id: 'mental', nome: 'Mental' },
  { id: 'fama', nome: 'Fama' },
];
// Pesos do Poder (soma 100). Fama não entra no Poder.
export const PESOS = { mec: 25, rotas: 20, macro: 20, tf: 20, mental: 15 };
export const FORA_POSICAO = 0.75;
export const ELENCO_MAX = 10;
export const CONTRATO_MIN = 4;
export const CONTRATO_MAX = 26;
export const TAXA_MERCADO_PCT = 5;
export const FAVORITOS_MAX = 5;
export const NOME_NIVEL = ['Iniciante', 'Praticante', 'Experiente', 'Especialista', 'Mestre'];
export const PRECO_RC = { min: 10, max: 100000 };

export function poder(j, pesos = PESOS) {
  const soma = pesos.mec + pesos.rotas + pesos.macro + pesos.tf + pesos.mental;
  const v = (pesos.mec * j.mec + pesos.rotas * j.rotas + pesos.macro * j.macro + pesos.tf * j.tf + pesos.mental * j.mental) / soma;
  return Math.min(100, Math.max(1, v));
}
export function poderEmCampo(j, vaga) {
  let p = poder(j);
  if (vaga !== j.pos && !(j.pos2 || []).includes(vaga)) p *= FORA_POSICAO;
  p += (j.forma - 50) * 0.04;
  p *= 1 + (j.estrelas || 0) * 0.05; // cada estrela de evolução: +5% de eficiência em jogo
  return Math.min(125, Math.max(1, p));
}
// Preço em créditos (mesma conta do servidor, tc_preco).
export function preco(p, potencial, fama, idade) {
  const v = (Math.pow(p / 100, 3) * 800000 * (1 + Math.max(0, potencial - p) / 100) * (1 + fama / 300) * (idade < 22 ? 1.1 : 1)) / 1000;
  return Math.max(5000, Math.round(v) * 1000);
}
export const salarioDe = (pr) => Math.max(300, Math.round((pr * 0.015) / 100) * 100);

export const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const taxaDe = (precoRc) => Math.floor((precoRc * TAXA_MERCADO_PCT) / 100);
// Cor do Poder (faixas), para os selos e barras.
// Escudo do Poder, com as mesmas faixas do OVR da Carreira no Rift e de Lendas do CBLOL: prata (<70), ouro (70–79),
// platina (80–89), diamante (90–94) e challenger (95+). Imagens em shared/assets/trofeus.
export const escudoPoder = (p) => (p >= 95 ? 'challenger' : p >= 90 ? 'diamante' : p >= 80 ? 'platina' : p >= 70 ? 'ouro' : 'prata');
export const corPoder = (p) => (p >= 80 ? '#f5cf5a' : p >= 65 ? '#5eead4' : p >= 50 ? '#60a5fa' : p >= 35 ? '#a3a3b8' : '#8b7355');
