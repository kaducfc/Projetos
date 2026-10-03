// Escala de Runeterra: regras puras (sem tela), testadas em tests/escala.test.mjs.
import { dayIndex as dayIndexFrom } from '../../../shared/diario.js';

export const FIRST_DAY = '2026-10-01';
export const RODADAS = 5;
// Proporção entre as duas coisas de uma rodada: nem quase iguais, nem absurdas.
export const RAZAO_MIN = 1.15;
export const RAZAO_MAX = 12;
// Errar por este fator (3× maior ou 3× menor) já vale 0, numa comparação
// entre coisas de tamanho parecido.
const ERRO_ZERO = Math.log(3);
// Quanto mais diferentes as duas coisas, mais difícil acertar a proporção
// (a menor vira poucos pixels perto da maior), então a margem cresce: até
// quase o dobro numa diferença de 12×.
const PESO_DIFICULDADE = 0.35;
export const tolerancia = (razao = 1) => 1 + PESO_DIFICULDADE * Math.log(Math.max(1, razao));

export const dayIndex = (now = new Date()) => dayIndexFrom(FIRST_DAY, now);

// 0 a 100 pela distância relativa: errar 20% para cima ou para baixo vale o
// mesmo. `razao` = quantas vezes a maior das duas coisas é maior que a menor.
export function pontos(palpite, real, razao = 1) {
  if (!(palpite > 0) || !(real > 0)) return 0;
  const erro = Math.abs(Math.log(palpite / real));
  return Math.round(100 * Math.max(0, 1 - erro / (ERRO_ZERO * tolerancia(razao))));
}

export function veredito(p) {
  if (p >= 95) return 'Perfeito!';
  if (p >= 80) return 'Muito perto';
  if (p >= 60) return 'Perto';
  if (p >= 30) return 'Longe';
  return 'Muito longe';
}

// "60% menor que o real" / "25% maior que o real" / "na medida".
export function diferenca(palpite, real) {
  const d = Math.round((palpite / real - 1) * 100);
  if (d === 0) return 'na medida certa';
  return d > 0 ? `${d}% maior que o real` : `${-d}% menor que o real`;
}

// Gerador determinístico (mesma sequência para a mesma semente).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const razaoOk = (a, b) => {
  const r = Math.max(a.altura, b.altura) / Math.min(a.altura, b.altura);
  return r >= RAZAO_MIN && r <= RAZAO_MAX;
};

// Uma rodada: { ref, alvo } (ids). `usados` evita repetir o alvo na partida.
export function sortearRodada(itens, rand, usados = new Set()) {
  for (let tentativa = 0; tentativa < 500; tentativa++) {
    const alvo = itens[Math.floor(rand() * itens.length)];
    if (usados.has(alvo.id) && tentativa < 400) continue;
    const opcoes = itens.filter((x) => x.id !== alvo.id && razaoOk(x, alvo));
    if (!opcoes.length) continue;
    const ref = opcoes[Math.floor(rand() * opcoes.length)];
    usados.add(alvo.id);
    return { ref: ref.id, alvo: alvo.id };
  }
  throw new Error('sem_par');
}

// As rodadas do dia sem conta: sorteadas para cada aparelho (`semente`),
// fixas durante o dia (recarregar a página não troca).
export function rodadasDoDia(itens, dia, semente = 0) {
  const rand = rng(0x5ca1a + dia * 7919 + semente * 104729);
  const usados = new Set();
  return Array.from({ length: RODADAS }, () => sortearRodada(itens, rand, usados));
}

// Altura em metros para a tela: "0,73 m", "1,95 m", "12 m", "103,6 m".
export function fmtAltura(m) {
  const casas = m < 10 ? 2 : m < 100 ? 1 : 0;
  return `${Number(m.toFixed(casas)).toLocaleString('pt-BR', { maximumFractionDigits: casas })} m`;
}

// "Garen é 2,6× maior que Teemo".
export function proporcao(a, b) {
  const [maior, menor] = a.altura >= b.altura ? [a, b] : [b, a];
  const r = maior.altura / menor.altura;
  return `${maior.nome} é ${r.toLocaleString('pt-BR', { maximumFractionDigits: r < 10 ? 2 : 1 })}× maior que ${menor.nome}`;
}

// Quadradinhos para compartilhar: 🟩 80+, 🟨 50+, 🟧 25+, 🟥 abaixo.
export const quadrado = (p) => (p >= 80 ? '🟩' : p >= 50 ? '🟨' : p >= 25 ? '🟧' : '🟥');
