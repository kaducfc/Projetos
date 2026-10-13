// Barão da Sucata — motor de regras (sem tela e sem bots). Tudo que muda o estado da partida passa por `aplicar`,
// que valida a decisão contra o `pedido` atual: a interface e os bots só pedem, nunca alteram o estado por conta própria.
//
// As regras são as do Coup original (4 jogadores, 15 cartas: 3 de cada influência):
//   magnata   (Duque)      ação Cobrar tributos (+3); bloqueia Ajuda Externa
//   lamina    (Assassino)  ação Assassinato (3 moedas)
//   cobrador  (Capitão)    ação Roubo (até 2 moedas); bloqueia Roubo
//   corretor  (Embaixador) ação Troca de cartas; bloqueia Roubo
//   sentinela (Condessa)   bloqueia Assassinato
// Etapas de uma ação (est.fase): acao → alegacao (desafios) → bloqueio → contestar_bloqueio → resolução → próximo turno.
// 'perder' (escolher a carta a revelar) e 'troca' (escolher as cartas a manter) interrompem a sequência quando preciso.
import { aleatorio } from './rng.js';

export const INFLUENCIAS = ['magnata', 'lamina', 'cobrador', 'corretor', 'sentinela'];
export const COPIAS = 3;
export const MOEDAS_INICIAIS = 2;
export const CARTAS_POR_JOGADOR = 2;
export const CUSTO_ASSASSINATO = 3;
export const CUSTO_GOLPE = 7;
export const MOEDAS_GOLPE_OBRIGATORIO = 10;

// alegacao: influência que o autor precisa afirmar ter (desafiável); bloqueiaCom: influências que bloqueiam;
// bloqueioPor: quem pode tentar bloquear ('todos' os outros ou só o 'alvo').
export const ACOES = {
  renda: { custo: 0, alvo: false, alegacao: null, bloqueiaCom: [], bloqueioPor: null },
  ajuda: { custo: 0, alvo: false, alegacao: null, bloqueiaCom: ['magnata'], bloqueioPor: 'todos' },
  tributos: { custo: 0, alvo: false, alegacao: 'magnata', bloqueiaCom: [], bloqueioPor: null },
  roubo: { custo: 0, alvo: true, alegacao: 'cobrador', bloqueiaCom: ['cobrador', 'corretor'], bloqueioPor: 'alvo' },
  troca: { custo: 0, alvo: false, alegacao: 'corretor', bloqueiaCom: [], bloqueioPor: null },
  assassinato: { custo: CUSTO_ASSASSINATO, alvo: true, alegacao: 'lamina', bloqueiaCom: ['sentinela'], bloqueioPor: 'alvo' },
  golpe: { custo: CUSTO_GOLPE, alvo: true, alegacao: null, bloqueiaCom: [], bloqueioPor: null },
};

export function criarBaralho() {
  return INFLUENCIAS.flatMap((inf) => Array(COPIAS).fill(inf));
}
function embaralhar(est, lista) {
  for (let i = lista.length - 1; i > 0; i--) { const j = Math.floor(est.rng() * (i + 1)); [lista[i], lista[j]] = [lista[j], lista[i]]; }
  return lista;
}

// ---------------------------------------------------------------- partida
// `jogadores`: [{ id, nome, humano }] na ordem da mesa (sentido do jogo). `seed` deixa a partida reproduzível.
export function novaPartida({ jogadores, seed = Date.now(), primeiro = null } = {}) {
  if (!jogadores || jogadores.length !== 4) throw new Error('são 4 participantes');
  const est = { rng: aleatorio(seed), seed, jogadores: [], baralho: [], turno: 0, numTurno: 1, fase: 'acao', pendente: null, historico: [], vencedor: null, eliminados: [] };
  est.baralho = embaralhar(est, criarBaralho());
  est.jogadores = jogadores.map((j) => ({ id: j.id, nome: j.nome, humano: Boolean(j.humano), moedas: MOEDAS_INICIAIS, vivo: true,
    cartas: Array.from({ length: CARTAS_POR_JOGADOR }, () => ({ inf: est.baralho.pop(), revelada: false })) }));
  est.turno = primeiro != null ? primeiro : Math.floor(est.rng() * est.jogadores.length);
  log(est, { tipo: 'inicio', primeiro: est.jogadores[est.turno].id });
  return est;
}

const log = (est, e) => est.historico.push({ n: est.historico.length, turno: est.numTurno, ...e });
export const jogador = (est, id) => est.jogadores.find((j) => j.id === id);
export const vivos = (est) => est.jogadores.filter((j) => j.vivo);
export const ativas = (j) => j.cartas.filter((c) => !c.revelada);
export const atual = (est) => est.jogadores[est.turno];
// os jogadores vivos depois de `id`, em ordem de mesa (sem incluir `id`)
function aposDe(est, id) {
  const i = est.jogadores.findIndex((j) => j.id === id);
  const r = [];
  for (let k = 1; k < est.jogadores.length; k++) { const j = est.jogadores[(i + k) % est.jogadores.length]; if (j.vivo) r.push(j.id); }
  return r;
}

// ---------------------------------------------------------------- ações legais
export function acoesLegais(est, j) {
  const alvos = vivos(est).filter((o) => o.id !== j.id).map((o) => o.id);
  if (j.moedas >= MOEDAS_GOLPE_OBRIGATORIO) return [{ acao: 'golpe', alvos, custo: CUSTO_GOLPE, obrigatoria: true }];
  const l = [{ acao: 'renda', alvos: null }, { acao: 'ajuda', alvos: null }, { acao: 'tributos', alvos: null }, { acao: 'roubo', alvos }, { acao: 'troca', alvos: null }];
  if (j.moedas >= CUSTO_ASSASSINATO) l.push({ acao: 'assassinato', alvos, custo: CUSTO_ASSASSINATO });
  if (j.moedas >= CUSTO_GOLPE) l.push({ acao: 'golpe', alvos, custo: CUSTO_GOLPE });
  return l;
}

// ---------------------------------------------------------------- o que está sendo pedido agora
export function pedido(est) {
  if (est.vencedor) return null;
  const p = est.pendente;
  switch (est.fase) {
    case 'acao': { const j = atual(est); return { jogador: j.id, tipo: 'acao', acoes: acoesLegais(est, j) }; }
    case 'alegacao': return { jogador: p.fila[p.idx], tipo: 'contestar', ator: p.ator, acao: p.acao, alvo: p.alvo, influencia: ACOES[p.acao].alegacao };
    case 'bloqueio': return { jogador: p.fila[p.idx], tipo: 'bloquear', ator: p.ator, acao: p.acao, alvo: p.alvo, influencias: ACOES[p.acao].bloqueiaCom };
    case 'contestar_bloqueio': return { jogador: p.fila[p.idx], tipo: 'contestar_bloqueio', ator: p.ator, acao: p.acao, alvo: p.alvo, bloqueador: p.bloqueador, influencia: p.bloqueioInf };
    case 'perder': { const j = jogador(est, p.perde); return { jogador: j.id, tipo: 'perder', motivo: p.motivo, cartas: j.cartas.map((c, i) => (c.revelada ? -1 : i)).filter((i) => i >= 0) }; }
    case 'troca': return { jogador: p.ator, tipo: 'trocar', cartas: [...p.troca.cartas], manter: p.troca.manter };
    default: return null;
  }
}

// ---------------------------------------------------------------- decisões
export function aplicar(est, quem, d = {}) {
  const ped = pedido(est);
  if (!ped) throw new Error('partida encerrada');
  if (ped.jogador !== quem) throw new Error('fora_do_turno');
  const p = est.pendente;
  switch (ped.tipo) {
    case 'acao': {
      const opc = ped.acoes.find((a) => a.acao === d.acao);
      if (!opc) throw new Error('acao_invalida');
      if (opc.alvos && !opc.alvos.includes(d.alvo)) throw new Error('alvo_invalido');
      return declarar(est, d.acao, opc.alvos ? d.alvo : null);
    }
    case 'contestar':
      if (d.contestar) return resolverDesafio(est, { claimante: p.ator, desafiante: quem, inf: ped.influencia, ctx: 'acao' });
      p.idx++;
      return p.idx >= p.fila.length ? depoisAlegacao(est) : null;
    case 'bloquear':
      if (d.influencia == null) { p.idx++; return p.idx >= p.fila.length ? resolver(est) : null; }
      if (!ped.influencias.includes(d.influencia)) throw new Error('bloqueio_invalido');
      p.bloqueador = quem; p.bloqueioInf = d.influencia;
      log(est, { tipo: 'bloqueio', quem, inf: d.influencia, ator: p.ator, acao: p.acao });
      return abrirDesafioBloqueio(est);
    case 'contestar_bloqueio':
      if (d.contestar) return resolverDesafio(est, { claimante: p.bloqueador, desafiante: quem, inf: p.bloqueioInf, ctx: 'bloqueio' });
      p.idx++;
      if (p.idx >= p.fila.length) { log(est, { tipo: 'acao_bloqueada', ator: p.ator, acao: p.acao, bloqueador: p.bloqueador }); return fimAcao(est); }
      return null;
    case 'perder': {
      if (!ped.cartas.includes(d.indice)) throw new Error('carta_invalida');
      const j = jogador(est, quem);
      const depois = p.depois;
      revelar(est, j, d.indice, p.motivo);
      return continuar(est, depois);
    }
    case 'trocar': {
      const { manter } = ped;
      const idxs = d.manter;
      if (!Array.isArray(idxs) || idxs.length !== manter || new Set(idxs).size !== manter || idxs.some((i) => !Number.isInteger(i) || i < 0 || i >= ped.cartas.length)) throw new Error('troca_invalida');
      const j = jogador(est, quem);
      const mantidas = idxs.map((i) => ped.cartas[i]);
      const devolvidas = ped.cartas.filter((_, i) => !idxs.includes(i));
      let k = 0;
      for (const c of j.cartas) if (!c.revelada) c.inf = mantidas[k++];
      est.baralho.push(...devolvidas); embaralhar(est, est.baralho);
      log(est, { tipo: 'troca_feita', quem });
      return fimAcao(est);
    }
    default: throw new Error('pedido_desconhecido');
  }
}

function declarar(est, acao, alvo) {
  const j = atual(est);
  const def = ACOES[acao];
  j.moedas -= def.custo; // assassinato e golpe são pagos já na declaração
  est.pendente = { ator: j.id, acao, alvo, custoPago: def.custo, fila: [], idx: 0 };
  log(est, { tipo: 'acao', quem: j.id, acao, alvo, custo: def.custo });
  if (def.alegacao) return abrirDesafioAcao(est);
  if (def.bloqueiaCom.length) return abrirBloqueio(est);
  return resolver(est);
}

function abrirDesafioAcao(est) {
  const p = est.pendente;
  p.fila = aposDe(est, p.ator); p.idx = 0; est.fase = 'alegacao';
  log(est, { tipo: 'alegacao', quem: p.ator, inf: ACOES[p.acao].alegacao, acao: p.acao, alvo: p.alvo });
}
function depoisAlegacao(est) {
  return ACOES[est.pendente.acao].bloqueiaCom.length ? abrirBloqueio(est) : resolver(est);
}
function abrirBloqueio(est) {
  const p = est.pendente; const def = ACOES[p.acao];
  p.fila = def.bloqueioPor === 'todos' ? aposDe(est, p.ator) : (p.alvo && jogador(est, p.alvo).vivo ? [p.alvo] : []);
  p.idx = 0;
  if (!p.fila.length) return resolver(est);
  est.fase = 'bloqueio';
  return null;
}
function abrirDesafioBloqueio(est) {
  const p = est.pendente;
  // quem pode contestar o bloqueio: todos os outros vivos, começando pelo autor da ação
  p.fila = [p.ator, ...aposDe(est, p.ator)].filter((id, i, a) => id !== p.bloqueador && jogador(est, id).vivo && a.indexOf(id) === i);
  p.idx = 0; est.fase = 'contestar_bloqueio';
  return null;
}

function resolverDesafio(est, { claimante, desafiante, inf, ctx }) {
  const cl = jogador(est, claimante);
  log(est, { tipo: 'desafio', desafiante, claimante, inf, ctx });
  const i = cl.cartas.findIndex((c) => !c.revelada && c.inf === inf);
  if (i >= 0) {
    // disse a verdade: mostra a carta, devolve ao baralho e compra outra; o desafiante perde uma influência
    log(est, { tipo: 'prova', quem: claimante, inf, ctx });
    est.baralho.push(inf); embaralhar(est, est.baralho);
    cl.cartas[i] = { inf: est.baralho.pop(), revelada: false };
    return perder(est, desafiante, 'desafio_perdido', { tipo: 'desafio_verdadeiro', ctx });
  }
  log(est, { tipo: 'blefe', quem: claimante, inf, ctx });
  return perder(est, claimante, 'blefe_descoberto', { tipo: 'desafio_mentira', ctx });
}

// o jogador perde uma influência: com uma só carta ativa revela sozinho; com duas, escolhe (fase 'perder')
function perder(est, id, motivo, depois) {
  const j = jogador(est, id);
  const ativasIdx = j.cartas.map((c, i) => (c.revelada ? -1 : i)).filter((i) => i >= 0);
  if (!ativasIdx.length) return continuar(est, depois);
  if (ativasIdx.length === 1) { revelar(est, j, ativasIdx[0], motivo); return continuar(est, depois); }
  est.pendente.perde = id; est.pendente.motivo = motivo; est.pendente.depois = depois; est.fase = 'perder';
  return null;
}
function revelar(est, j, indice, motivo) {
  j.cartas[indice].revelada = true;
  log(est, { tipo: 'perdeu', quem: j.id, inf: j.cartas[indice].inf, motivo });
  if (!ativas(j).length) {
    j.vivo = false; est.eliminados.push(j.id);
    log(est, { tipo: 'eliminado', quem: j.id });
    const resta = vivos(est);
    if (resta.length === 1) { est.vencedor = resta[0].id; est.fase = 'fim'; log(est, { tipo: 'vitoria', quem: est.vencedor }); }
  }
}

function continuar(est, depois) {
  if (est.vencedor) return null;
  const p = est.pendente;
  switch (depois.tipo) {
    case 'desafio_verdadeiro':
      if (depois.ctx === 'acao') return depoisAlegacao(est);
      log(est, { tipo: 'acao_bloqueada', ator: p.ator, acao: p.acao, bloqueador: p.bloqueador }); // o bloqueio era verdadeiro
      return fimAcao(est);
    case 'desafio_mentira':
      if (depois.ctx === 'acao') { // a ação falha e as moedas pagas voltam
        jogador(est, p.ator).moedas += p.custoPago;
        log(est, { tipo: 'acao_falhou', ator: p.ator, acao: p.acao });
        return fimAcao(est);
      }
      log(est, { tipo: 'bloqueio_falhou', bloqueador: p.bloqueador, ator: p.ator, acao: p.acao });
      return resolver(est);
    case 'efeito': return fimAcao(est);
    default: throw new Error('continuacao_desconhecida');
  }
}

function resolver(est) {
  const p = est.pendente; const ator = jogador(est, p.ator);
  if (!ator.vivo) return fimAcao(est);
  switch (p.acao) {
    case 'renda': ator.moedas += 1; log(est, { tipo: 'efeito', acao: 'renda', quem: ator.id, moedas: 1 }); return fimAcao(est);
    case 'ajuda': ator.moedas += 2; log(est, { tipo: 'efeito', acao: 'ajuda', quem: ator.id, moedas: 2 }); return fimAcao(est);
    case 'tributos': ator.moedas += 3; log(est, { tipo: 'efeito', acao: 'tributos', quem: ator.id, moedas: 3 }); return fimAcao(est);
    case 'roubo': {
      const alvo = jogador(est, p.alvo);
      if (!alvo.vivo) { log(est, { tipo: 'sem_efeito', acao: 'roubo', quem: ator.id }); return fimAcao(est); }
      const q = Math.min(2, alvo.moedas);
      alvo.moedas -= q; ator.moedas += q;
      log(est, { tipo: 'efeito', acao: 'roubo', quem: ator.id, alvo: alvo.id, moedas: q });
      return fimAcao(est);
    }
    case 'troca': {
      const compradas = [est.baralho.pop(), est.baralho.pop()];
      p.troca = { cartas: [...ativas(ator).map((c) => c.inf), ...compradas], manter: ativas(ator).length };
      est.fase = 'troca';
      log(est, { tipo: 'troca_inicio', quem: ator.id });
      return null;
    }
    case 'assassinato': case 'golpe': {
      const alvo = jogador(est, p.alvo);
      if (!alvo.vivo) { log(est, { tipo: 'sem_efeito', acao: p.acao, quem: ator.id }); return fimAcao(est); }
      log(est, { tipo: 'efeito', acao: p.acao, quem: ator.id, alvo: alvo.id });
      return perder(est, alvo.id, p.acao, { tipo: 'efeito' });
    }
    default: throw new Error('acao_desconhecida');
  }
}

function fimAcao(est) {
  if (est.vencedor) return null;
  est.pendente = null;
  let i = est.turno;
  do { i = (i + 1) % est.jogadores.length; } while (!est.jogadores[i].vivo);
  est.turno = i; est.numTurno++; est.fase = 'acao';
  return null;
}

// ---------------------------------------------------------------- o que cada jogador pode saber
// `visao` é tudo que um participante enxerga: as próprias cartas, as cartas reveladas de todos, as moedas e o histórico público.
// Os bots só recebem isso (nunca o estado completo).
export function visao(est, id) {
  return {
    voce: id,
    turno: atual(est).id,
    numTurno: est.numTurno,
    fase: est.fase,
    baralhoN: est.baralho.length,
    vencedor: est.vencedor,
    pendente: est.pendente ? { ator: est.pendente.ator, acao: est.pendente.acao, alvo: est.pendente.alvo, bloqueador: est.pendente.bloqueador ?? null, bloqueioInf: est.pendente.bloqueioInf ?? null } : null,
    jogadores: est.jogadores.map((j) => ({
      id: j.id, nome: j.nome, moedas: j.moedas, vivo: j.vivo,
      cartas: j.cartas.map((c) => ({ revelada: c.revelada, inf: c.revelada || j.id === id ? c.inf : null })),
    })),
    historico: est.historico.map((e) => ({ ...e })),
  };
}

// Pontos da partida: vitória 100; 2º lugar 50; 3º 25; 4º 10.
export function colocacao(est, id) {
  if (est.vencedor === id) return 1;
  const k = est.eliminados.indexOf(id);
  return k < 0 ? null : 4 - k; // o primeiro eliminado é o 4º lugar
}
export const PONTOS_COLOCACAO = { 1: 100, 2: 50, 3: 25, 4: 10 };
