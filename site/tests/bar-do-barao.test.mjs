import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INFLUENCIAS, criarBaralho, novaPartida, aplicar, pedido, visao, acoesLegais, jogador, ativas, vivos, colocacao, atual,
} from '../jogos/bar-do-barao/js/motor.js';

const JOG = [{ id: 'eu', nome: 'Você', humano: true }, { id: 'b1', nome: 'Brutus' }, { id: 'b2', nome: 'Sibil' }, { id: 'b3', nome: 'Vexel' }];
const nova = (seed = 1) => novaPartida({ jogadores: JOG, seed, primeiro: 0 });
// define as cartas ativas de um jogador (para montar cenários)
function cartas(est, id, ...infs) { const j = jogador(est, id); j.cartas = infs.map((inf) => ({ inf, revelada: false })); }
const passa = (est) => { // todos os pedidos de resposta recusados até voltar à fase de ação
  let n = 0;
  while (est.fase !== 'acao' && !est.vencedor && n++ < 20) {
    const p = pedido(est);
    if (p.tipo === 'contestar' || p.tipo === 'contestar_bloqueio') aplicar(est, p.jogador, { contestar: false });
    else if (p.tipo === 'bloquear') aplicar(est, p.jogador, { influencia: null });
    else break;
  }
};

test('baralho tem 15 cartas, 3 de cada influência', () => {
  const b = criarBaralho();
  assert.equal(b.length, 15);
  for (const inf of INFLUENCIAS) assert.equal(b.filter((c) => c === inf).length, 3);
});

test('início: 2 cartas e 2 moedas cada, 7 no baralho, 4 jogadores', () => {
  const est = nova();
  assert.equal(est.jogadores.length, 4);
  for (const j of est.jogadores) { assert.equal(j.cartas.length, 2); assert.equal(j.moedas, 2); }
  assert.equal(est.baralho.length, 7);
  const todas = [...est.baralho, ...est.jogadores.flatMap((j) => j.cartas.map((c) => c.inf))];
  assert.equal(todas.length, 15);
});

test('mesma semente = mesma partida; ordem do primeiro jogador é sorteada', () => {
  assert.deepEqual(visao(novaPartida({ jogadores: JOG, seed: 7 }), 'eu'), visao(novaPartida({ jogadores: JOG, seed: 7 }), 'eu'));
  const primeiros = new Set(Array.from({ length: 40 }, (_, s) => novaPartida({ jogadores: JOG, seed: s }).turno));
  assert.ok(primeiros.size > 1);
});

test('renda +1, ajuda externa +2, tributos +3', () => {
  let est = nova(); aplicar(est, 'eu', { acao: 'renda' });
  assert.equal(jogador(est, 'eu').moedas, 3); assert.equal(atual(est).id, 'b1');
  est = nova(); aplicar(est, 'eu', { acao: 'ajuda' }); passa(est);
  assert.equal(jogador(est, 'eu').moedas, 4);
  est = nova(); cartas(est, 'eu', 'magnata', 'lamina'); aplicar(est, 'eu', { acao: 'tributos' }); passa(est);
  assert.equal(jogador(est, 'eu').moedas, 5);
});

test('ajuda externa: qualquer outro pode bloquear só com magnata', () => {
  const est = nova(); aplicar(est, 'eu', { acao: 'ajuda' });
  const p = pedido(est); assert.equal(p.tipo, 'bloquear'); assert.deepEqual(p.influencias, ['magnata']);
  assert.throws(() => aplicar(est, p.jogador, { influencia: 'sentinela' }), /bloqueio_invalido/);
  cartas(est, p.jogador, 'magnata', 'lamina');
  aplicar(est, p.jogador, { influencia: 'magnata' });
  assert.equal(pedido(est).tipo, 'contestar_bloqueio'); assert.equal(pedido(est).jogador, 'eu', 'autor da ação contesta primeiro');
  passa(est);
  assert.equal(jogador(est, 'eu').moedas, 2, 'ajuda bloqueada');
});

test('roubo: leva até 2 moedas (ou menos se o alvo tem menos)', () => {
  let est = nova(); cartas(est, 'eu', 'cobrador', 'lamina');
  aplicar(est, 'eu', { acao: 'roubo', alvo: 'b1' }); passa(est);
  assert.equal(jogador(est, 'eu').moedas, 4); assert.equal(jogador(est, 'b1').moedas, 0);
  est = nova(); cartas(est, 'eu', 'cobrador', 'lamina'); jogador(est, 'b1').moedas = 1;
  aplicar(est, 'eu', { acao: 'roubo', alvo: 'b1' }); passa(est);
  assert.equal(jogador(est, 'eu').moedas, 3); assert.equal(jogador(est, 'b1').moedas, 0);
});

test('roubo só pode ser bloqueado pelo alvo, com cobrador ou corretor', () => {
  const est = nova(); cartas(est, 'eu', 'cobrador', 'lamina'); cartas(est, 'b1', 'corretor', 'sentinela');
  aplicar(est, 'eu', { acao: 'roubo', alvo: 'b1' }); passa1(est);
  function passa1(e) { while (pedido(e).tipo === 'contestar') aplicar(e, pedido(e).jogador, { contestar: false }); }
  const p = pedido(est); assert.equal(p.tipo, 'bloquear'); assert.equal(p.jogador, 'b1'); assert.deepEqual(p.influencias, ['cobrador', 'corretor']);
  aplicar(est, 'b1', { influencia: 'corretor' }); passa(est);
  assert.equal(jogador(est, 'eu').moedas, 2);
});

test('assassinato: custa 3 moedas, perde na hora, alvo escolhe a carta', () => {
  const est = nova(); cartas(est, 'eu', 'lamina', 'magnata'); jogador(est, 'eu').moedas = 3;
  aplicar(est, 'eu', { acao: 'assassinato', alvo: 'b1' });
  assert.equal(jogador(est, 'eu').moedas, 0);
  cartas(est, 'b1', 'cobrador', 'corretor');
  passa1(est);
  function passa1(e) { while (pedido(e).tipo === 'contestar') aplicar(e, pedido(e).jogador, { contestar: false }); }
  aplicar(est, 'b1', { influencia: null });
  const p = pedido(est); assert.equal(p.tipo, 'perder'); assert.equal(p.jogador, 'b1');
  aplicar(est, 'b1', { indice: 1 });
  assert.equal(jogador(est, 'b1').cartas[1].revelada, true); assert.equal(ativas(jogador(est, 'b1')).length, 1);
  assert.equal(atual(est).id, 'b1');
});

test('assassinato bloqueado pela sentinela: moedas não voltam', () => {
  const est = nova(); cartas(est, 'eu', 'lamina', 'magnata'); jogador(est, 'eu').moedas = 3; cartas(est, 'b1', 'sentinela', 'corretor');
  aplicar(est, 'eu', { acao: 'assassinato', alvo: 'b1' });
  while (pedido(est).tipo === 'contestar') aplicar(est, pedido(est).jogador, { contestar: false });
  aplicar(est, 'b1', { influencia: 'sentinela' }); passa(est);
  assert.equal(jogador(est, 'eu').moedas, 0); assert.equal(ativas(jogador(est, 'b1')).length, 2);
});

test('golpe: 7 moedas, não pode ser contestado nem bloqueado', () => {
  const est = nova(); jogador(est, 'eu').moedas = 7; cartas(est, 'b2', 'lamina', 'lamina');
  aplicar(est, 'eu', { acao: 'golpe', alvo: 'b2' });
  assert.equal(pedido(est).tipo, 'perder'); assert.equal(jogador(est, 'eu').moedas, 0);
  aplicar(est, 'b2', { indice: 0 });
  assert.equal(ativas(jogador(est, 'b2')).length, 1);
});

test('com 10 ou mais moedas só o golpe é permitido; ações ilegais são recusadas', () => {
  const est = nova(); jogador(est, 'eu').moedas = 10;
  const l = acoesLegais(est, jogador(est, 'eu')); assert.equal(l.length, 1); assert.equal(l[0].acao, 'golpe');
  assert.throws(() => aplicar(est, 'eu', { acao: 'renda' }), /acao_invalida/);
  assert.throws(() => aplicar(est, 'eu', { acao: 'golpe', alvo: 'eu' }), /alvo_invalido/);
  const e2 = nova(); assert.throws(() => aplicar(e2, 'eu', { acao: 'golpe', alvo: 'b1' }), /acao_invalida/, 'sem moedas');
  assert.throws(() => aplicar(e2, 'eu', { acao: 'assassinato', alvo: 'b1' }), /acao_invalida/);
  assert.throws(() => aplicar(e2, 'b1', { acao: 'renda' }), /fora_do_turno/);
  assert.throws(() => aplicar(e2, 'eu', { acao: 'roubo' }), /alvo_invalido/);
});

test('contestar uma alegação verdadeira: desafiante perde influência e o autor troca a carta', () => {
  const est = nova(); cartas(est, 'eu', 'magnata', 'lamina'); cartas(est, 'b1', 'corretor', 'sentinela');
  aplicar(est, 'eu', { acao: 'tributos' });
  assert.equal(pedido(est).jogador, 'b1');
  aplicar(est, 'b1', { contestar: true });
  assert.equal(pedido(est).tipo, 'perder'); assert.equal(pedido(est).jogador, 'b1');
  aplicar(est, 'b1', { indice: 0 });
  assert.equal(est.fase, 'acao', 'após o desafio resolvido ninguém mais contesta; a ação acontece');
  assert.equal(est.baralho.length, 7, 'baralho continua com 7');
  assert.equal(jogador(est, 'eu').moedas, 5);
  assert.equal(ativas(jogador(est, 'eu')).length, 2);
});

test('contestar um blefe: o autor perde influência e a ação não acontece', () => {
  const est = nova(); cartas(est, 'eu', 'lamina', 'lamina');
  aplicar(est, 'eu', { acao: 'tributos' });
  aplicar(est, 'b1', { contestar: true });
  assert.equal(pedido(est).jogador, 'eu'); assert.equal(pedido(est).tipo, 'perder');
  aplicar(est, 'eu', { indice: 0 });
  assert.equal(jogador(est, 'eu').moedas, 2); assert.equal(atual(est).id, 'b1');
});

test('blefe de assassinato descoberto devolve as 3 moedas', () => {
  const est = nova(); cartas(est, 'eu', 'magnata', 'magnata'); jogador(est, 'eu').moedas = 3;
  aplicar(est, 'eu', { acao: 'assassinato', alvo: 'b1' });
  aplicar(est, 'b1', { contestar: true });
  aplicar(est, 'eu', { indice: 0 });
  assert.equal(jogador(est, 'eu').moedas, 3);
});

test('bloqueio contestado: bloqueio verdadeiro faz o desafiante perder, ação segue bloqueada', () => {
  const est = nova(); cartas(est, 'eu', 'lamina', 'magnata'); jogador(est, 'eu').moedas = 3; cartas(est, 'b1', 'sentinela', 'corretor');
  aplicar(est, 'eu', { acao: 'assassinato', alvo: 'b1' });
  while (pedido(est).tipo === 'contestar') aplicar(est, pedido(est).jogador, { contestar: false });
  aplicar(est, 'b1', { influencia: 'sentinela' });
  aplicar(est, 'eu', { contestar: true });
  assert.equal(pedido(est).tipo, 'perder'); assert.equal(pedido(est).jogador, 'eu');
  aplicar(est, 'eu', { indice: 0 });
  passa(est);
  assert.equal(ativas(jogador(est, 'b1')).length, 2, 'alvo sobreviveu');
  assert.equal(ativas(jogador(est, 'eu')).length, 1);
});

test('bloqueio falso descoberto: bloqueador perde e a ação é executada (assassinato elimina o alvo com 1 carta)', () => {
  const est = nova(); cartas(est, 'eu', 'lamina', 'magnata'); jogador(est, 'eu').moedas = 3; cartas(est, 'b1', 'corretor', 'corretor');
  aplicar(est, 'eu', { acao: 'assassinato', alvo: 'b1' });
  while (pedido(est).tipo === 'contestar') aplicar(est, pedido(est).jogador, { contestar: false });
  aplicar(est, 'b1', { influencia: 'sentinela' });
  aplicar(est, 'eu', { contestar: true });
  aplicar(est, 'b1', { indice: 0 }); // perde a primeira por blefe; a última cai sozinha pelo assassinato
  assert.equal(jogador(est, 'b1').vivo, false);
  assert.equal(atual(est).id, 'b2', 'turno pula o eliminado');
});

test('troca de cartas: compra 2, escolhe quantas manter, baralho permanece com 7', () => {
  const est = nova(); cartas(est, 'eu', 'corretor', 'lamina');
  aplicar(est, 'eu', { acao: 'troca' }); passa1(est);
  function passa1(e) { while (pedido(e).tipo === 'contestar') aplicar(e, pedido(e).jogador, { contestar: false }); }
  const p = pedido(est); assert.equal(p.tipo, 'trocar'); assert.equal(p.cartas.length, 4); assert.equal(p.manter, 2);
  assert.throws(() => aplicar(est, 'eu', { manter: [0] }), /troca_invalida/);
  assert.throws(() => aplicar(est, 'eu', { manter: [0, 0] }), /troca_invalida/);
  const escolhidas = [p.cartas[2], p.cartas[3]];
  aplicar(est, 'eu', { manter: [2, 3] });
  assert.deepEqual(jogador(est, 'eu').cartas.map((c) => c.inf), escolhidas);
  assert.equal(est.baralho.length, 7);
});

test('troca com uma carta só mantém uma', () => {
  const est = nova(); cartas(est, 'eu', 'corretor'); jogador(est, 'eu').cartas.push({ inf: 'lamina', revelada: true });
  aplicar(est, 'eu', { acao: 'troca' });
  while (pedido(est).tipo === 'contestar') aplicar(est, pedido(est).jogador, { contestar: false });
  const p = pedido(est); assert.equal(p.cartas.length, 3); assert.equal(p.manter, 1);
  aplicar(est, 'eu', { manter: [0] });
  assert.equal(est.baralho.length, 7, 'comprou 2 e devolveu 2');
});

test('eliminação e vitória: último vivo vence e a colocação é calculada', () => {
  const est = nova();
  for (const id of ['b1', 'b2', 'b3']) { cartas(est, id, 'lamina'); }
  jogador(est, 'eu').moedas = 7;
  aplicar(est, 'eu', { acao: 'golpe', alvo: 'b1' });
  assert.equal(jogador(est, 'b1').vivo, false);
  jogador(est, 'eu').moedas = 7; est.turno = 0; est.fase = 'acao'; est.pendente = null;
  aplicar(est, 'eu', { acao: 'golpe', alvo: 'b2' });
  jogador(est, 'eu').moedas = 7; est.turno = 0; est.fase = 'acao'; est.pendente = null;
  aplicar(est, 'eu', { acao: 'golpe', alvo: 'b3' });
  assert.equal(est.vencedor, 'eu'); assert.equal(pedido(est), null);
  assert.equal(colocacao(est, 'eu'), 1); assert.equal(colocacao(est, 'b3'), 2); assert.equal(colocacao(est, 'b1'), 4);
  assert.throws(() => aplicar(est, 'eu', { acao: 'renda' }), /encerrada/);
});

test('com uma carta só, a perda é automática (sem janela travada)', () => {
  const est = nova(); jogador(est, 'eu').moedas = 7; cartas(est, 'b1', 'lamina');
  aplicar(est, 'eu', { acao: 'golpe', alvo: 'b1' });
  assert.equal(est.fase, 'acao'); assert.equal(jogador(est, 'b1').vivo, false);
});

test('visão do jogador não revela cartas ocultas dos outros', () => {
  const est = nova(); cartas(est, 'b1', 'magnata', 'lamina'); est.jogadores[1].cartas[1].revelada = true;
  const v = visao(est, 'eu');
  const b1 = v.jogadores.find((j) => j.id === 'b1');
  assert.equal(b1.cartas[0].inf, null); assert.equal(b1.cartas[1].inf, 'lamina');
  assert.ok(v.jogadores.find((j) => j.id === 'eu').cartas.every((c) => c.inf));
  assert.equal(JSON.stringify(v).includes('"rng"'), false);
  assert.equal(v.baralho, undefined);
});

test('simulação aleatória: 300 partidas legais terminam sem travar e conservam as 15 cartas', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const est = novaPartida({ jogadores: JOG, seed });
    let passos = 0;
    const rnd = (n) => Math.floor(est.rng() * n);
    while (!est.vencedor) {
      assert.ok(passos++ < 2000, `travou na semente ${seed}`);
      const p = pedido(est); assert.ok(p, 'sem pedido numa partida em andamento');
      assert.ok(jogador(est, p.jogador).vivo, 'pedido a jogador eliminado');
      switch (p.tipo) {
        case 'acao': { const a = p.acoes[rnd(p.acoes.length)]; aplicar(est, p.jogador, { acao: a.acao, alvo: a.alvos ? a.alvos[rnd(a.alvos.length)] : null }); break; }
        case 'contestar': case 'contestar_bloqueio': aplicar(est, p.jogador, { contestar: est.rng() < 0.3 }); break;
        case 'bloquear': aplicar(est, p.jogador, { influencia: est.rng() < 0.3 ? p.influencias[rnd(p.influencias.length)] : null }); break;
        case 'perder': aplicar(est, p.jogador, { indice: p.cartas[rnd(p.cartas.length)] }); break;
        case 'trocar': aplicar(est, p.jogador, { manter: [...p.cartas.keys()].sort(() => est.rng() - 0.5).slice(0, p.manter) }); break;
      }
      const total = est.baralho.length + est.jogadores.reduce((s, j) => s + j.cartas.length, 0);
      if (est.fase !== 'troca') assert.equal(total, 15, 'cartas conservadas');
      assert.ok(est.jogadores.every((j) => j.moedas >= 0));
    }
    assert.equal(vivos(est).length, 1);
  }
});

// ------------------------------------------------------------------ bots
import { decidir } from '../jogos/bar-do-barao/js/bots.js';
import { PERSONAGENS } from '../jogos/bar-do-barao/js/config.js';
import { aleatorio } from '../jogos/bar-do-barao/js/rng.js';

function jogarBots(seed) {
  const est = novaPartida({ jogadores: JOG.map((j) => ({ ...j, humano: false })), seed });
  const perfis = { eu: PERSONAGENS.b3.perfil, b1: PERSONAGENS.b1.perfil, b2: PERSONAGENS.b2.perfil, b3: PERSONAGENS.b3.perfil };
  const rngs = Object.fromEntries(Object.keys(perfis).map((id, k) => [id, aleatorio(seed * 10 + k)]));
  let passos = 0;
  while (!est.vencedor) {
    assert.ok(passos++ < 3000, `bots travaram na semente ${seed}`);
    const p = pedido(est);
    const d = decidir(visao(est, p.jogador), p, perfis[p.jogador], rngs[p.jogador]);
    aplicar(est, p.jogador, d); // qualquer decisão ilegal lança erro
  }
  return est;
}

test('bots: 200 partidas completas só com decisões legais e sem travar', () => {
  const vit = {};
  for (let s = 1; s <= 200; s++) { const e = jogarBots(s); vit[e.vencedor] = (vit[e.vencedor] || 0) + 1; }
  assert.ok(Object.keys(vit).length >= 3, 'mais de um estilo vence: ' + JSON.stringify(vit));
});

test('bots não leem cartas ocultas: decisão idêntica se as cartas dos outros mudarem', () => {
  for (let s = 1; s <= 30; s++) {
    const est = nova(s);
    const p = pedido(est);
    const ped = pedido(est);
    const v1 = visao(est, 'eu');
    // troca as cartas ocultas dos outros por outras quaisquer
    const est2 = nova(s);
    for (const j of est2.jogadores) if (j.id !== 'eu') j.cartas.forEach((c) => { c.inf = 'sentinela'; });
    const v2 = visao(est2, 'eu');
    assert.deepEqual(v1.jogadores, v2.jogadores);
    assert.deepEqual(decidir(v1, ped, PERSONAGENS.b3.perfil, aleatorio(s)), decidir(v2, p, PERSONAGENS.b3.perfil, aleatorio(s)));
  }
});

// ------------------------------------------------------------------ integração
import { readFileSync, existsSync } from 'node:fs';
test('integração: catálogo (só administrador), capa no hub, arquivos e referências do index.html existem', async () => {
  const { GAMES } = await import('../shared/config.js');
  const cfg = GAMES.find((g) => g.id === 'bar-do-barao');
  assert.ok(cfg && cfg.name === 'O Bar do Barão' && cfg.path === 'jogos/bar-do-barao/' && cfg.soAdmin === true);
  assert.match(readFileSync(new URL('../js/hub.js', import.meta.url), 'utf8'), /'bar-do-barao': `<div class="cv cv-bb">/);
  const html = readFileSync(new URL('../jogos/bar-do-barao/index.html', import.meta.url), 'utf8');
  for (const m of html.matchAll(/(?:href|src)="((?!https?:)[^"#]+?)(?:\?[^"]*)?"/g)) {
    assert.ok(existsSync(new URL(`../jogos/bar-do-barao/${m[1]}`, import.meta.url)), `referência quebrada: ${m[1]}`);
  }
  // os outros jogos continuam no catálogo
  for (const id of ['barao', 'smite', 'carreira-no-rift', 'cblol', 'campeao', 'runetermo', 'escala', 'conexoes']) assert.ok(GAMES.some((g) => g.id === id), id);
});

test('interface do Bar do Barão traduzida nos 5 idiomas', async () => {
  const { __usarDicionario, traduzirTexto, LANGS } = await import('../shared/i18n.js');
  const fonte = readFileSync(new URL('../jogos/bar-do-barao/js/main.js', import.meta.url), 'utf8');
  const textos = new Set([...fonte.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));
  textos.add('O Bar do Barão'); textos.add('O Bar do Barão · Rift Arcade'); textos.add('Blefe');
  textos.add('Blefe, intriga e traição numa taverna clandestina de Zaun: sobreviva com ao menos uma influência.');
  for (const id of LANGS.map((l) => l.id).filter((x) => x !== 'pt-BR')) {
    __usarDicionario((await import(`../shared/i18n/${id}.js`)).default, id);
    const faltam = [...textos].filter((x) => /[A-Za-zÀ-ú]{3}/.test(x) && traduzirTexto(x) == null);
    assert.deepEqual(faltam, [], `${id}: sem tradução`);
  }
});

test('o motor e os bots não dependem de tela nem de rede (sem document/window/fetch)', () => {
  for (const f of ['motor.js', 'bots.js', 'rng.js']) {
    const src = readFileSync(new URL(`../jogos/bar-do-barao/js/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /\b(document|window|fetch|localStorage)\b/, f);
  }
  const bots = readFileSync(new URL('../jogos/bar-do-barao/js/bots.js', import.meta.url), 'utf8');
  assert.doesNotMatch(bots, /est\.jogadores|est\.baralho|est\.rng/, 'bots só usam a visão');
});
