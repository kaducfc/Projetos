// Bots do Barão da Sucata. Recebem SOMENTE a `visao` (cartas próprias + informação pública) e o `pedido` atual,
// e devolvem uma decisão no mesmo formato aceito por `aplicar`. Não conhecem as cartas ocultas dos outros nem o baralho.
//
// Como "pensam" (nível pretendido: bom jogador casual, ainda falho):
//  - contam as cartas: sabem quantas cópias de cada influência ainda podem estar escondidas (hipergeométrica exata);
//  - estimam a chance de um blefe a partir do que o jogador reivindica e da taxa de blefes já descobertos na mesa;
//  - observam quanto os outros contestam e blefam menos contra quem contesta muito;
//  - avaliam ameaças (quem tem 7+ moedas vai dar Golpe; quem está na frente) e escolhem alvos por isso;
//  - com uma carta só jogam pela sobrevivência (bloqueiam e blefam para escapar de assassinato);
//  - erram de propósito de vez em quando (`erro`) para não ficarem perfeitos.
import { ACOES, INFLUENCIAS, COPIAS } from './motor.js';

const ordem = (v) => v.jogadores;
const eu = (v) => ordem(v).find((j) => j.id === v.voce);
const vivosOutros = (v) => ordem(v).filter((j) => j.vivo && j.id !== v.voce);
const minhasAtivas = (v) => eu(v).cartas.filter((c) => !c.revelada).map((c) => c.inf);
const nAtivas = (j) => j.cartas.filter((c) => !c.revelada).length;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sorte = (rng, p) => rng() < p;
const ERRO = 0.07; // chance base de uma decisão "distraída"

// C(n, k) como número (n pequeno)
function comb(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; }

// Quantas cópias de `inf` ainda podem estar nas mãos dos outros ou no baralho (descontando reveladas e as minhas).
export function copiasPossiveis(v, inf) {
  let vistas = 0;
  for (const j of ordem(v)) for (const c of j.cartas) if (c.inf === inf && (c.revelada || j.id === v.voce)) vistas++;
  return Math.max(0, COPIAS - vistas);
}
// quantas cartas eu não conheço (mãos escondidas dos outros + baralho)
function desconhecidas(v) {
  return ordem(v).filter((j) => j.id !== v.voce).reduce((s, j) => s + nAtivas(j), 0) + v.baralhoN;
}

// Quanto os blefes têm sido descobertos nesta mesa (0 a 1), com um palpite inicial de 30%.
function taxaBlefe(v) {
  let blefes = 0; let provas = 0;
  for (const e of v.historico) { if (e.tipo === 'blefe') blefes++; else if (e.tipo === 'prova') provas++; }
  return (blefes + 0.3 * 3) / (blefes + provas + 3);
}
// Quanto `id` (ou todos os outros, sem id) costuma contestar: contestações / chances de contestar.
function taxaContestar(v, id = null) {
  let chances = 0; let contestou = 0; let alegacoes = 0;
  for (const e of v.historico) {
    if (e.tipo === 'alegacao') alegacoes++;
    if (e.tipo === 'desafio' && (id == null || e.desafiante === id)) contestou++;
  }
  chances = id == null ? alegacoes * 2 : alegacoes; // aprox.: 2 a 3 jogadores podem contestar cada alegação
  return (contestou + 0.25 * 3) / (chances + 3);
}

// Chance de `id` ter realmente `inf` dado o que ele declarou: contagem + peso de quem reivindica (Bayes simples).
export function chanceTer(v, id, inf) {
  const quem = ordem(v).find((j) => j.id === id);
  const n = nAtivas(quem);
  const livres = copiasPossiveis(v, inf);
  const U = desconhecidas(v);
  if (!livres || !n || U < n) return 0;
  const base = 1 - comb(U - livres, n) / comb(U, n); // chance de ter ao menos 1 só pela contagem
  const b = taxaBlefe(v); // chance de quem NÃO tem declarar mesmo assim
  const posterior = base / (base + (1 - base) * clamp(b, 0.15, 0.7)); // dado que declarou
  // quem acabou de provar a carta e a devolveu ao baralho tem menos chance de tê-la de novo
  return clamp(posterior);
}

// Ameaça de um jogador para mim: golpe iminente, dinheiro, vivacidade.
function ameaca(v, j) {
  let s = j.moedas * 0.45 + nAtivas(j) * 0.4;
  if (j.moedas >= 7) s += 3; // vai dar Golpe em alguém
  if (j.moedas >= 10) s += 2;
  return s;
}
// Quem me atacou/contestou/roubou (para vingança)
function ofensores(v) {
  const r = {};
  for (const e of v.historico) {
    if (e.alvo === v.voce && ['assassinato', 'golpe', 'roubo'].includes(e.acao) && e.tipo === 'acao') r[e.quem] = (r[e.quem] || 0) + 1;
    if (e.tipo === 'desafio' && e.claimante === v.voce) r[e.desafiante] = (r[e.desafiante] || 0) + 1;
  }
  return r;
}
// Escolhe o alvo de uma ação hostil. `pesoMoedas` valoriza quem tem dinheiro (roubo); `letal` mira quem está perto de morrer ou é perigoso.
function melhorAlvo(v, p, rng, { pesoMoedas = 1, letal = false, evitar = [] } = {}) {
  const of = ofensores(v);
  const pontuar = (j) => {
    let s = ameaca(v, j) * (letal ? 1.2 : 0.6) + j.moedas * 0.35 * pesoMoedas + (of[j.id] || 0) * p.vinganca * 1.4 + rng() * 0.7;
    if (letal && nAtivas(j) === 1) s += 1.1; // eliminar vale mais
    if (evitar.includes(j.id)) s -= 2.5;
    return s;
  };
  return vivosOutros(v).map((j) => ({ j, s: pontuar(j) })).sort((a, b) => b.s - a.s)[0].j.id;
}
// Quem já mostrou (provou) ter essa influência: bom alvo para evitar quando eu a bloqueio/roubo etc.
function jaProvou(v, id, infs) { return v.historico.some((e) => e.tipo === 'prova' && e.quem === id && infs.includes(e.inf)); }

// ---------------------------------------------------------------- ação do turno
function decidirAcao(v, ped, p, rng) {
  const me = eu(v); const mc = minhasAtivas(v); const moedas = me.moedas;
  const tem = (inf) => mc.includes(inf);
  const legais = new Map(ped.acoes.map((a) => [a.acao, a]));
  const outros = vivosOutros(v);
  const duelo = outros.length === 1;
  const agr = clamp(p.agressividade + (duelo ? 0.15 : 0));
  const vida = mc.length; // 1 = em perigo
  const rateOutros = taxaContestar(v); // quanto contestam em geral
  const arriscaBlefe = (1 - clamp(rateOutros * 1.7)) * (vida === 1 ? 0.55 : 1); // blefar compensa menos contra quem contesta e com 1 carta

  // erro de distração: às vezes joga o básico
  if (!legais.has('golpe') || ped.acoes.length > 1) {
    if (sorte(rng, ERRO * (1 - p.cautela * 0.5))) return { acao: rng() < 0.5 ? 'renda' : 'ajuda', alvo: null };
  }
  // Golpe: não pode ser contestado nem bloqueado; com 7+ moedas é quase sempre o melhor
  if (legais.has('golpe') && (ped.acoes.length === 1 || sorte(rng, 0.8 + agr * 0.15))) {
    return { acao: 'golpe', alvo: melhorAlvo(v, p, rng, { letal: true }) };
  }
  const opcoes = [];
  const peso = (acao, w, alvo = null) => { if (legais.has(acao) && w > 0) opcoes.push({ acao, alvo, w }); };
  // Ajuda Externa: some se alguém provavelmente tem o Magnata para bloquear
  const pBloq = 1 - outros.reduce((acc, j) => acc * (1 - chanceTer(v, j.id, 'magnata') * 0.55), 1);
  peso('renda', 1.0 - agr * 0.35 + (moedas < 2 ? 0.25 : 0) + pBloq * 0.5);
  peso('ajuda', (1.4 - p.cautela * 0.3) * (1 - pBloq * 0.85));
  // Tributos: forte com o Magnata; blefe só quando compensa
  peso('tributos', tem('magnata') ? 3.4 : (0.25 + p.blefe * 2.4) * arriscaBlefe * (copiasPossiveis(v, 'magnata') ? 1 : 0.15));
  peso('troca', tem('corretor') ? (vida === 2 && !tem('magnata') && !tem('lamina') ? 2.0 : 1.2) : (p.blefe * 0.45) * arriscaBlefe);
  // Roubo: alvo com 2+ moedas, preferindo quem não provou poder bloquear
  const ricos = (legais.get('roubo')?.alvos ?? []).filter((id) => ordem(v).find((j) => j.id === id).moedas >= 2);
  if (ricos.length) {
    const alvo = melhorAlvo(v, p, rng, { pesoMoedas: 1.7, evitar: ricos.filter((id) => jaProvou(v, id, ['cobrador', 'corretor'])) });
    const a = ricos.includes(alvo) ? alvo : ricos[Math.floor(rng() * ricos.length)];
    const bloqueavel = Math.max(chanceTer(v, a, 'cobrador'), chanceTer(v, a, 'corretor'));
    peso('roubo', (tem('cobrador') ? 2.6 : (0.25 + p.blefe * 1.5) * arriscaBlefe) * (0.6 + agr) * (1 - bloqueavel * 0.45), a);
  }
  // Assassinato: com a Lâmina é uma ótima arma; sem ela só em blefe calculado
  if (legais.has('assassinato') && moedas < 7) {
    const a = melhorAlvo(v, p, rng, { letal: true });
    const pSent = chanceTer(v, a, 'sentinela');
    peso('assassinato', (tem('lamina') ? 3.2 : (0.15 + p.blefe * 1.6) * arriscaBlefe) * (0.4 + agr) * (1 - pSent * 0.5), a);
  }
  const total = opcoes.reduce((s, o) => s + o.w, 0);
  let r = rng() * total;
  for (const o of opcoes) { r -= o.w; if (r <= 0) return { acao: o.acao, alvo: o.alvo }; }
  return { acao: 'renda', alvo: null };
}

// ---------------------------------------------------------------- contestar uma alegação de `ped.influencia` feita por `ped.ator`
function decidirContestar(v, ped, p, rng) {
  const inf = ped.influencia; const ator = ped.ator;
  if (copiasPossiveis(v, inf) === 0) return { contestar: true }; // impossível ele ter: todas já apareceram
  const mc = minhasAtivas(v);
  const vida = mc.length;
  const eAlvo = ped.alvo === v.voce;
  const letal = eAlvo && ped.acao === 'assassinato';
  const q = 1 - chanceTer(v, ator, inf); // chance de ser blefe
  let limiar = 0.52 - (p.desconfianca - 0.5) * 0.3; // contesto quando acho blefe mais provável que verdade
  if (vida === 1 && !letal) limiar += 0.14 * (0.5 + p.cautela); // com 1 carta, errar é morrer
  if (letal) limiar -= vida === 1 ? 0.22 : 0.12; // é a minha defesa se não tiver bloqueio
  if (letal && mc.includes('sentinela')) limiar += 0.3; // melhor bloquear com a Sentinela de verdade
  if (ator !== v.voce && ordem(v).find((j) => j.id === ator).moedas >= 7) limiar -= 0.04;
  let pc = clamp(0.5 + (q - limiar) * 2.4, 0.02, 0.95);
  if (sorte(rng, ERRO)) pc = 1 - pc; // erro humano ocasional
  return { contestar: sorte(rng, pc) };
}

// ---------------------------------------------------------------- bloquear
function decidirBloquear(v, ped, p, rng) {
  const mc = minhasAtivas(v);
  const possiveis = ped.influencias;
  const reais = possiveis.filter((i) => mc.includes(i));
  if (reais.length) return { influencia: reais[0] }; // bloqueio verdadeiro: sempre
  const letal = ped.acao === 'assassinato';
  const vida = mc.length;
  const ator = ped.ator;
  // quanto os outros contestam bloqueios (se contestam muito, blefar o bloqueio é caro)
  const rate = taxaContestar(v);
  const escolha = possiveis.filter((i) => copiasPossiveis(v, i) > 0);
  if (!escolha.length) return { influencia: null };
  let pb;
  if (letal) pb = vida === 1 ? 0.97 : clamp(0.45 + p.cautela * 0.35 - rate * 0.3, 0.2, 0.9); // escapar da morte
  else if (ped.acao === 'roubo') pb = clamp((0.08 + p.blefe * 0.38) * (1 - rate * 0.8) * (vida === 1 ? 1.3 : 1), 0, 0.7);
  else pb = clamp((0.05 + p.blefe * 0.42) * (1 - rate * 0.9) * (ped.acao === 'ajuda' ? 0.85 : 1), 0, 0.65);
  // se o autor já provou a carta que eu fingiria (ou quase certeza de que contesta), desisto
  if (!letal && jaProvou(v, ator, [])) pb *= 1;
  if (sorte(rng, ERRO * 0.5)) pb = 1 - pb;
  if (sorte(rng, pb)) {
    // declara a influência cujas cópias têm mais chance de ainda estar escondidas
    escolha.sort((a, b) => copiasPossiveis(v, b) - copiasPossiveis(v, a));
    return { influencia: escolha[0] };
  }
  return { influencia: null };
}

function decidirContestarBloqueio(v, ped, p, rng) {
  const inf = ped.influencia;
  if (copiasPossiveis(v, inf) === 0) return { contestar: true };
  const mc = minhasAtivas(v);
  const q = 1 - chanceTer(v, ped.bloqueador, inf);
  let limiar = 0.52 - (p.desconfianca - 0.5) * 0.3;
  if (mc.length === 1) limiar += 0.14 * (0.5 + p.cautela);
  if (ped.ator === v.voce) limiar -= 0.1; // a ação era minha: perder o bloqueio custa mais
  if (ped.ator === v.voce && ped.acao === 'assassinato') limiar -= 0.08;
  let pc = clamp(0.5 + (q - limiar) * 2.4, 0.02, 0.95);
  if (sorte(rng, ERRO)) pc = 1 - pc;
  return { contestar: sorte(rng, pc) };
}

// Qual carta revelar: a menos útil (guarda a que combina com o estilo e com o que ainda dá para blefar)
function decidirPerder(v, ped) {
  const mc = eu(v).cartas;
  const valor = { magnata: 3, lamina: 2.7, cobrador: 2.3, sentinela: 2.4, corretor: 1.4 };
  let melhor = ped.cartas[0]; let menor = Infinity;
  for (const i of ped.cartas) { const x = valor[mc[i].inf]; if (x < menor) { menor = x; melhor = i; } }
  return { indice: melhor };
}

// Troca: fica com as melhores `manter` cartas, preferindo variedade.
function decidirTrocar(v, ped) {
  const valor = { magnata: 5, lamina: 4.6, cobrador: 4, sentinela: 3.8, corretor: 2 };
  const idx = ped.cartas.map((c, i) => ({ i, c })).sort((a, b) => valor[b.c] - valor[a.c] || a.i - b.i);
  const escolhidos = []; const usados = new Set();
  for (const { i, c } of idx) { if (escolhidos.length >= ped.manter) break; if (!usados.has(c)) { escolhidos.push(i); usados.add(c); } }
  for (const { i } of idx) { if (escolhidos.length >= ped.manter) break; if (!escolhidos.includes(i)) escolhidos.push(i); }
  return { manter: escolhidos };
}

export function decidir(visao, pedido, perfil, rng) {
  switch (pedido.tipo) {
    case 'acao': return decidirAcao(visao, pedido, perfil, rng);
    case 'contestar': return decidirContestar(visao, pedido, perfil, rng);
    case 'bloquear': return decidirBloquear(visao, pedido, perfil, rng);
    case 'contestar_bloqueio': return decidirContestarBloqueio(visao, pedido, perfil, rng);
    case 'perder': return decidirPerder(visao, pedido);
    case 'trocar': return decidirTrocar(visao, pedido);
    default: throw new Error('pedido_desconhecido');
  }
}
export { INFLUENCIAS, ACOES };
