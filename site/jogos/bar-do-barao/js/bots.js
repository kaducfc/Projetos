// Bots do Barão da Sucata. Recebem SOMENTE a `visao` (cartas próprias + informação pública) e o `pedido` atual,
// e devolvem uma decisão no mesmo formato aceito por `aplicar`. Não conhecem as cartas ocultas dos outros nem o baralho.
import { ACOES, INFLUENCIAS, COPIAS } from './motor.js';

const ordem = (v) => v.jogadores;
const eu = (v) => ordem(v).find((j) => j.id === v.voce);
const vivosOutros = (v) => ordem(v).filter((j) => j.vivo && j.id !== v.voce);
const minhasAtivas = (v) => eu(v).cartas.filter((c) => !c.revelada).map((c) => c.inf);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

// Quantas cópias de `inf` ainda podem estar nas mãos dos outros ou no baralho (descontando reveladas e as minhas).
export function copiasPossiveis(v, inf) {
  let vistas = 0;
  for (const j of ordem(v)) for (const c of j.cartas) if (c.inf === inf && (c.revelada || j.id === v.voce)) vistas++;
  return Math.max(0, COPIAS - vistas);
}
// Histórico público de quem já declarou/provou cada influência (memória do bot).
function alegacoesDe(v, id) {
  const r = {};
  for (const e of v.historico) {
    if ((e.tipo === 'alegacao' && e.quem === id) || (e.tipo === 'bloqueio' && e.quem === id)) r[e.inf] = (r[e.inf] || 0) + 1;
    if (e.tipo === 'prova' && e.quem === id) r[e.inf] = (r[e.inf] || 0) + 2;
  }
  return r;
}
// Probabilidade estimada de que `id` realmente tenha `inf` (só com informação pública).
export function chanceTer(v, id, inf) {
  const quem = ordem(v).find((j) => j.id === id);
  const naoReveladas = quem.cartas.filter((c) => !c.revelada).length;
  const livres = copiasPossiveis(v, inf);
  if (!livres || !naoReveladas) return 0;
  const escondidas = ordem(v).filter((j) => j.id !== v.voce).reduce((s, j) => s + j.cartas.filter((c) => !c.revelada).length, 0) + v.baralhoN;
  let p = 1 - Math.pow(1 - livres / Math.max(1, escondidas), naoReveladas); // chance simples por contagem
  const jaDisse = alegacoesDe(v, id)[inf] || 0;
  p = p + (1 - p) * clamp(jaDisse * 0.15, 0, 0.45); // quem reivindica com frequência tende a ter (ou a mentir bem)
  return clamp(p);
}
const sorte = (rng, p) => rng() < p;

// Quem me atacou/contestou/roubou (para vingança)
function ofensores(v) {
  const r = {};
  for (const e of v.historico) {
    if (e.alvo === v.voce && ['assassinato', 'golpe', 'roubo'].includes(e.acao) && e.tipo === 'acao') r[e.quem] = (r[e.quem] || 0) + 1;
    if (e.tipo === 'desafio' && e.claimante === v.voce) r[e.desafiante] = (r[e.desafiante] || 0) + 1;
  }
  return r;
}

function melhorAlvo(v, p, rng, pesoMoedas = 1) {
  const outros = vivosOutros(v);
  const of = ofensores(v);
  const pontuar = (j) => {
    const cartas = j.cartas.filter((c) => !c.revelada).length;
    return j.moedas * 0.4 * pesoMoedas + (cartas === 1 ? 1.2 : 0) + (of[j.id] || 0) * p.vinganca * 1.5 + rng() * 0.6;
  };
  return outros.map((j) => ({ j, s: pontuar(j) })).sort((a, b) => b.s - a.s)[0].j.id;
}

// Escolhe a ação do turno.
function decidirAcao(v, ped, p, rng) {
  const me = eu(v); const mc = minhasAtivas(v); const moedas = me.moedas;
  const tem = (inf) => mc.includes(inf);
  const legais = new Map(ped.acoes.map((a) => [a.acao, a]));
  const outros = vivosOutros(v);
  const alvosDe = (nome) => legais.get(nome)?.alvos ?? [];
  const mortais = outros.length === 1; // duelo final: mais agressivo
  const agr = clamp(p.agressividade + (mortais ? 0.15 : 0));

  if (legais.has('golpe') && (ped.acoes.length === 1 || moedas >= 7 && sorte(rng, 0.55 + agr * 0.4))) {
    return { acao: 'golpe', alvo: melhorAlvo(v, p, rng) };
  }
  const opcoes = [];
  const peso = (acao, w, alvo = null) => { if (legais.has(acao) && w > 0) opcoes.push({ acao, alvo, w }); };
  peso('renda', 1.2 - agr * 0.4 + (moedas < 2 ? 0.3 : 0));
  peso('ajuda', 1.3 - p.cautela * 0.4);
  // tributos: forte quando tenho o magnata; blefe conforme a personalidade
  peso('tributos', tem('magnata') ? 3 : 0.4 + p.blefe * 2.4 - p.cautela * 0.3);
  peso('troca', tem('corretor') ? 1.6 : (mc.length === 2 && !tem('magnata') && !tem('lamina') ? 0.5 : 0) + p.blefe * 0.5);
  const ricos = alvosDe('roubo').filter((id) => ordem(v).find((j) => j.id === id).moedas >= 2);
  if (ricos.length) {
    const alvo = melhorAlvo(v, p, rng, 1.6);
    peso('roubo', (tem('cobrador') ? 2.6 : 0.3 + p.blefe * 1.6) * (0.6 + agr), ricos.includes(alvo) ? alvo : ricos[Math.floor(rng() * ricos.length)]);
  }
  if (legais.has('assassinato') && moedas < 7) {
    peso('assassinato', (tem('lamina') ? 3.2 : 0.2 + p.blefe * 1.8) * (0.4 + agr), melhorAlvo(v, p, rng));
  }
  if (legais.has('golpe')) peso('golpe', 1 + agr * 2, melhorAlvo(v, p, rng));
  // com a mão fraca e poucas moedas, juntar dinheiro
  const total = opcoes.reduce((s, o) => s + o.w, 0);
  let r = rng() * total;
  for (const o of opcoes) { r -= o.w; if (r <= 0) return { acao: o.acao, alvo: o.alvo }; }
  return { acao: 'renda', alvo: null };
}

// Contestar uma alegação de `inf` feita por `ped.ator`
function decidirContestar(v, ped, p, rng) {
  const inf = ped.influencia;
  const ator = ped.ator;
  const sabeQueNao = copiasPossiveis(v, inf) === 0; // todas as cópias já aparecem para mim
  if (sabeQueNao) return { contestar: true };
  if (minhasAtivas(v).length === 1 && p.cautela > 0.5) return { contestar: false };
  const real = chanceTer(v, ator, inf);
  let chance = (1 - real) * (0.35 + p.desconfianca * 0.85) - 0.1;
  const alvoSouEu = ped.alvo === v.voce;
  if (alvoSouEu && (ped.acao === 'assassinato')) chance += 0.2; // contestar é a defesa quando não tenho sentinela
  if (alvoSouEu && ped.acao === 'assassinato' && minhasAtivas(v).includes('sentinela')) chance -= 0.15;
  if (minhasAtivas(v).length === 1) chance -= 0.15 * p.cautela;
  return { contestar: sorte(rng, clamp(chance, 0.02, 0.9)) };
}

function decidirBloquear(v, ped, p, rng) {
  const mc = minhasAtivas(v);
  const possiveis = ped.influencias;
  const reais = possiveis.filter((i) => mc.includes(i));
  if (reais.length) return { influencia: reais[0] };
  const letal = ped.acao === 'assassinato';
  const risco = letal ? 0.35 + p.cautela * 0.5 : ped.acao === 'roubo' ? 0.1 + p.blefe * 0.4 : 0.05 + p.blefe * 0.4;
  const rapido = mc.length === 1 ? 0.15 : 0;
  // bloquear sem a carta: arrisca ser contestado
  const chanceContestarMin = clamp(0.25 + (v.jogadores.filter((j) => j.vivo).length === 2 ? 0.2 : 0), 0, 1);
  if (sorte(rng, clamp(risco + (letal ? rapido : -0.05) - chanceContestarMin * 0.3, 0, 0.95))) return { influencia: possiveis[Math.floor(rng() * possiveis.length)] };
  return { influencia: null };
}

function decidirContestarBloqueio(v, ped, p, rng) {
  const inf = ped.influencia;
  if (copiasPossiveis(v, inf) === 0) return { contestar: true };
  const real = chanceTer(v, ped.bloqueador, inf);
  let chance = (1 - real) * (0.3 + p.desconfianca * 0.8) - 0.1;
  if (ped.ator === v.voce) chance += 0.15; // fui eu que perdi a ação
  if (ped.acao === 'assassinato' && ped.alvo === ped.bloqueador && ped.ator === v.voce) chance += 0.15;
  if (minhasAtivas(v).length === 1) chance -= 0.2 * p.cautela;
  return { contestar: sorte(rng, clamp(chance, 0.02, 0.9)) };
}

// Qual carta revelar: a menos útil (guarda a que combina com meu estilo)
function decidirPerder(v, ped) {
  const mc = eu(v).cartas;
  const valor = { magnata: 3, lamina: 2.6, cobrador: 2.4, sentinela: 2.2, corretor: 1.4 };
  let melhor = ped.cartas[0]; let menor = Infinity;
  for (const i of ped.cartas) { const x = valor[mc[i].inf]; if (x < menor) { menor = x; melhor = i; } }
  return { indice: melhor };
}

// Troca: fica com as melhores `manter` cartas.
function decidirTrocar(v, ped) {
  const valor = { magnata: 5, lamina: 4.5, cobrador: 4, sentinela: 3.5, corretor: 2 };
  const idx = ped.cartas.map((c, i) => ({ i, c })).sort((a, b) => valor[b.c] - valor[a.c] || a.i - b.i);
  const escolhidos = [];
  const usados = new Set();
  for (const { i, c } of idx) { // prefere diversidade
    if (escolhidos.length >= ped.manter) break;
    if (!usados.has(c)) { escolhidos.push(i); usados.add(c); }
  }
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
