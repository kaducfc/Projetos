// Smite Challenge: regras puras (sem DOM), testadas em tests/smite.test.mjs.
//
// O objetivo (um dragão) começa com a vida cheia e vai caindo conforme aliados e adversários
// causam dano. O jogador só tem dois botões que machucam o objetivo: o Smite (golpear) e uma
// habilidade do campeão da selva. O Smite mata na hora se a vida do objetivo for MENOR OU IGUAL ao
// dano dele; quanto mais perto do dano do Smite (para menos), melhor.

export const OBJETIVO = { id: 'dragao', nome: 'Dragão do Oceano', vida: 9000 };
export const RODADAS = 5;
export const TEMPO_MAX = 50; // segundos de cada rodada
export const RECARGA_HAB = 6; // segundos de recarga da habilidade
export const DANOS_SMITE = [700, 800, 900, 1000, 1100, 1200]; // dano do Smite por nível do jogador
// Quanto tempo o objetivo leva para morrer depois de chegar perto do dano do Smite: fica menor a cada rodada.
export const JANELAS = [3.4, 3.0, 2.6, 2.2, 1.8];
export const MARGEM_ZERO = 600; // a partir daqui (vida ≤ dano − 600) a rodada vale 0

// Campeões da selva. `hab`: a habilidade que também machuca o objetivo.
export const CAMPEOES = [
  { id: 'LeeSin', nome: 'Lee Sin', hab: 'Onda Sônica', dano: 380 },
  { id: 'Warwick', nome: 'Warwick', hab: 'Mandíbulas da Besta', dano: 330 },
  { id: 'JarvanIV', nome: 'Jarvan IV', hab: 'Golpe do Dragão', dano: 350 },
  { id: 'Nunu', nome: 'Nunu e Willump', hab: 'Consumir', dano: 400 },
  { id: 'Amumu', nome: 'Amumu', hab: 'Lançar Bandagem', dano: 300 },
  { id: 'Khazix', nome: "Kha'Zix", hab: 'Garras Famintas', dano: 340 },
  { id: 'Elise', nome: 'Elise', hab: 'Neurotoxina', dano: 310 },
  { id: 'MasterYi', nome: 'Mestre Yi', hab: 'Golpe Alpha', dano: 360 },
];

// Quem causa dano no objetivo (a ordem é a do painel "Dano no objetivo").
export const PARTICIPANTES = [
  { id: 'a1', nome: 'Aliado 1', lado: 'azul', champ: 'Warwick' },
  { id: 'a2', nome: 'Aliado 2', lado: 'azul', champ: 'Amumu' },
  { id: 'a3', nome: 'Aliado 3', lado: 'azul', champ: 'Elise' },
  { id: 'e1', nome: 'Adversário 1', lado: 'vermelho', champ: 'Khazix' },
  { id: 'e2', nome: 'Adversário 2', lado: 'vermelho', champ: 'MasterYi' },
];

// Gerador pseudoaleatório com semente (as rodadas ficam reproduzíveis nos testes).
export function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entre = (rand, a, b) => a + rand() * (b - a);
const escolher = (rand, lista) => lista[Math.floor(rand() * lista.length)];

// Pontos de uma rodada pela margem (dano do Smite − vida do objetivo na hora do golpe).
// 0 → 100; 30 → 90; 60 → 81; 150 → 56; 300 → 25; 600 ou mais → 0.
export function pontosDaMargem(margem) {
  if (!(margem >= 0)) return 0;
  const x = Math.max(0, 1 - margem / MARGEM_ZERO);
  return Math.round(100 * x * x);
}

export function classificar(margem) {
  if (margem <= 25) return { id: 'perfeito', rotulo: 'Perfeito!' };
  if (margem <= 90) return { id: 'otimo', rotulo: 'Ótimo!' };
  if (margem <= 220) return { id: 'bom', rotulo: 'Bom' };
  return { id: 'longe', rotulo: 'Passou longe' };
}

// Cria uma rodada: o dano do Smite, o campeão e a lista de golpes (quem bate, quando e quanto).
// `n`: 0 a RODADAS - 1. Rodadas mais para a frente têm rajadas e janela menor.
export function criarRodada(rand, n = 0) {
  const smite = escolher(rand, DANOS_SMITE);
  const campeao = escolher(rand, CAMPEOES);
  const janela = JANELAS[Math.min(n, JANELAS.length - 1)] * entre(rand, 0.9, 1.1);
  const tx = entre(rand, 18, 32); // quando a vida chega perto do dano do Smite
  const folga = entre(rand, 60, 360); // quanto a vida ainda passa do dano do Smite nesse momento
  const vx = smite + folga;
  const r1 = (OBJETIVO.vida - vx) / tx;
  const r2 = vx / janela;
  const pesos = PARTICIPANTES.map(() => entre(rand, 0.7, 1.4));
  const soma = pesos.reduce((a, b) => a + b, 0);
  const prob = 0.04 + 0.03 * n; // chance de rajada (golpe grande) em cada batida
  const eventos = [];
  PARTICIPANTES.forEach((p, i) => {
    const periodo = entre(rand, 0.55, 1.0);
    for (let t = entre(rand, 0.2, 0.9); t < TEMPO_MAX; t += periodo * entre(rand, 0.85, 1.15)) {
      const taxa = t < tx ? r1 : r2;
      let dano = taxa * (pesos[i] / soma) * periodo * entre(rand, 0.75, 1.25);
      if (rand() < prob) dano *= entre(rand, 1.6, 2.2);
      eventos.push({ t: Math.round(t * 1000) / 1000, quem: p.id, dano: Math.max(1, Math.round(dano)) });
    }
  });
  eventos.sort((a, b) => a.t - b.t);
  // A vida acumulada: o último golpe é cortado para a vida chegar a zero (e nada vem depois).
  let vida = OBJETIVO.vida;
  const golpes = [];
  for (const e of eventos) {
    if (vida <= 0) break;
    const dano = Math.min(e.dano, vida);
    vida -= dano;
    golpes.push({ ...e, dano, vida });
  }
  return { n, smite, campeao, janela, tx, golpes, morreEm: vida <= 0 ? golpes[golpes.length - 1].t : null };
}

// Vida do objetivo no instante t (s) só pelos golpes dos outros jogadores.
export function vidaEm(rodada, t, danoExtra = 0) {
  let vida = OBJETIVO.vida;
  for (const g of rodada.golpes) {
    if (g.t > t) break;
    vida = g.vida;
  }
  return Math.max(0, vida - danoExtra);
}

// O que acontece quando o jogador usa o Smite com `vida` de vida no objetivo.
export function resolverSmite(vida, smite) {
  if (vida <= 0) return { resultado: 'roubado', margem: null, pontos: 0 };
  if (vida > smite) return { resultado: 'cedo', margem: null, pontos: 0, faltou: vida - smite };
  const margem = smite - vida;
  return { resultado: 'garantido', margem, pontos: pontosDaMargem(margem), nota: classificar(margem) };
}
