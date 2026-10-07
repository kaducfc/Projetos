// Show do Barão: regras do jogo, sem tela (testável). 15 perguntas, três ajudas
// (Pinstouro = pular, Monstros do Vazio e Cartas do Twisted Fate) e dois pontos seguros.
import { BANCO } from './perguntas.js';

export const NIVEIS = 15;
export const PREMIOS = [50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
export const SEGUROS = [5, 10]; // ao chegar nessas perguntas, o prêmio está garantido
export const PULOS = 3;
export const CARTAS = [
  { id: 'azul', nome: 'Carta Azul', tira: 1 },
  { id: 'vermelha', nome: 'Carta Vermelha', tira: 2 },
  { id: 'dourada', nome: 'Carta Dourada', tira: 3 },
];
// Monstros do Vazio: o `img` é o id do campeão no Data Dragon (ícone quadrado).
export const MONSTROS = [
  { id: 'chogath', nome: 'Cho\'Gath', img: 'Chogath' },
  { id: 'khazix', nome: 'Kha\'Zix', img: 'Khazix' },
  { id: 'velkoz', nome: 'Vel\'Koz', img: 'Velkoz' },
];
// Chance de CADA monstro apontar a resposta certa, por faixa de dificuldade.
const ACERTO_MONSTRO = { 1: 0.88, 2: 0.74, 3: 0.58 };

export const faixa = (n) => (n <= 5 ? 1 : n <= 10 ? 2 : 3);
export const letra = (i) => 'ABCD'[i];

export function embaralhar(lista, rnd = Math.random) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Sorteia uma pergunta da faixa do nível (sem repetir as já usadas) e embaralha as opções.
export function sortearPergunta(nivel, usadas = [], rnd = Math.random) {
  const banco = BANCO[faixa(nivel)];
  let livres = banco.filter((p) => !usadas.includes(p.q));
  if (!livres.length) livres = banco;
  const base = livres[Math.floor(rnd() * livres.length)];
  const ordem = embaralhar([0, 1, 2, 3], rnd);
  return {
    q: base.q, cat: base.cat,
    opcoes: ordem.map((i) => base.a[i]),
    certa: ordem.indexOf(0),
    eliminadas: [], votos: null,
  };
}

export function novoJogo(rnd = Math.random) {
  const p = sortearPergunta(1, [], rnd);
  return {
    v: 1, nivel: 1, status: 'jogando', pulos: PULOS,
    cartas: { azul: false, vermelha: false, dourada: false }, cartaNaPergunta: false,
    vazio: false, usadas: [p.q], pergunta: p, premio: 0, resultado: null,
  };
}

// Prêmio ao parar no nível `nivel` (a pergunta atual ainda não foi respondida).
export const premioAoParar = (nivel) => (nivel > 1 ? PREMIOS[nivel - 2] : 0);
// Prêmio garantido ao errar a pergunta `nivel`.
export function premioAoErrar(nivel) {
  const seguro = SEGUROS.filter((s) => s < nivel).pop();
  return seguro ? PREMIOS[seguro - 1] : 0;
}

// Responde a pergunta atual. Devolve o estado novo (sem alterar o antigo).
export function responder(jogo, indice, rnd = Math.random) {
  const j = structuredClone(jogo);
  if (j.status !== 'jogando') return j;
  if (indice === j.pergunta.certa) {
    if (j.nivel >= NIVEIS) {
      j.status = 'fim'; j.resultado = 'ganhou'; j.premio = PREMIOS[NIVEIS - 1];
    } else {
      j.status = 'acertou'; j.premio = PREMIOS[j.nivel - 1];
    }
  } else {
    j.status = 'fim'; j.resultado = 'errou'; j.premio = premioAoErrar(j.nivel);
  }
  j.ultima = indice;
  return j;
}

// Depois de acertar: vem a próxima pergunta.
export function proxima(jogo, rnd = Math.random) {
  const j = structuredClone(jogo);
  if (j.status !== 'acertou') return j;
  j.nivel += 1;
  j.pergunta = sortearPergunta(j.nivel, j.usadas, rnd);
  j.usadas.push(j.pergunta.q);
  j.cartaNaPergunta = false;
  j.status = 'jogando';
  delete j.ultima;
  return j;
}

export function parar(jogo) {
  const j = structuredClone(jogo);
  if (j.status !== 'jogando') return j;
  j.status = 'fim'; j.resultado = 'parou'; j.premio = premioAoParar(j.nivel);
  return j;
}

// Pinstouro: troca a pergunta por outra do mesmo nível (não avança).
export function pular(jogo, rnd = Math.random) {
  const j = structuredClone(jogo);
  if (j.status !== 'jogando' || j.pulos <= 0) return j;
  j.pulos -= 1;
  j.pergunta = sortearPergunta(j.nivel, j.usadas, rnd);
  j.usadas.push(j.pergunta.q);
  j.cartaNaPergunta = false;
  return j;
}

// Carta do Twisted Fate: tira `tira` opções erradas. Uma carta por pergunta.
export function usarCarta(jogo, id, rnd = Math.random) {
  const j = structuredClone(jogo);
  const carta = CARTAS.find((c) => c.id === id);
  if (!carta || j.status !== 'jogando' || j.cartas[id] || j.cartaNaPergunta) return j;
  const erradas = [0, 1, 2, 3].filter((i) => i !== j.pergunta.certa && !j.pergunta.eliminadas.includes(i));
  const tirar = embaralhar(erradas, rnd).slice(0, carta.tira);
  j.pergunta.eliminadas.push(...tirar);
  j.cartas[id] = true;
  j.cartaNaPergunta = true;
  return j;
}

// Monstros do Vazio: cada um aponta uma opção (a certa com chance maior nas perguntas fáceis).
export function usarVazio(jogo, rnd = Math.random) {
  const j = structuredClone(jogo);
  if (j.status !== 'jogando' || j.vazio) return j;
  const p = ACERTO_MONSTRO[faixa(j.nivel)];
  const vivas = [0, 1, 2, 3].filter((i) => !j.pergunta.eliminadas.includes(i));
  const erradas = vivas.filter((i) => i !== j.pergunta.certa);
  j.pergunta.votos = MONSTROS.map((m) => ({
    id: m.id,
    voto: rnd() < p || !erradas.length ? j.pergunta.certa : erradas[Math.floor(rnd() * erradas.length)],
  }));
  j.vazio = true;
  return j;
}
