import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { novoJogo, rolar, escolher, vagasPossiveis, opcoesBonus, usarBonus, completo, forca, simular, VAGAS, ROTAS } from '../jogos/cblol/js/logic.js';

const { times } = JSON.parse(readFileSync(new URL('../jogos/cblol/dados/times.json', import.meta.url)));

test('dados: cada pessoa aparece uma vez só em cada time (sem grafias repetidas)', () => {
  const chave = (n) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const t of times) {
    const vistos = new Set();
    for (const j of t.jogadores) {
      assert.ok(!vistos.has(chave(j.nome)), `${t.id}: ${j.nome} repetido`);
      vistos.add(chave(j.nome));
    }
  }
});

test('dados: times com 5 rotas e OVR entre 50 e 98', () => {
  assert.ok(times.length > 200);
  for (const t of times) {
    for (const r of ROTAS) assert.ok(t.jogadores.some((j) => j.rota === r && j.titular), `${t.id} sem ${r}`);
    for (const j of t.jogadores) assert.ok(j.ovr >= 50 && j.ovr <= 98, `${j.nome} ${j.ovr}`);
  }
});

test('jogador só entra na própria rota ou na reserva; técnico só na vaga de técnico', () => {
  const jogo = novoJogo();
  jogo.atual = times[0].id;
  const top = { ...times[0].jogadores.find((j) => j.rota === 'top'), tipo: 'jogador' };
  assert.deepEqual(vagasPossiveis(jogo, top), ['top', 'reserva']);
  assert.throws(() => escolher(jogo, times, top.nome, 'mid'));
  escolher(jogo, times, top.nome, 'reserva');
  assert.equal(jogo.atual, null); // depois de escolher, precisa rolar de novo
  assert.deepEqual(vagasPossiveis(jogo, { ...top, nome: 'outro' }), ['top']);
  assert.deepEqual(vagasPossiveis(jogo, top), []); // a mesma pessoa não entra duas vezes
  assert.deepEqual(vagasPossiveis(jogo, { nome: 'x', tipo: 'tecnico' }), ['tecnico']);
});

test('reserva só conta se for melhor que a média; técnico ajusta até ±3', () => {
  const v = (ovr) => ({ ovr });
  const base = { top: v(80), jungle: v(80), mid: v(80), adc: v(80), sup: v(80) };
  assert.equal(forca({ ...base, reserva: v(70) }).media, 80);
  assert.ok(forca({ ...base, reserva: v(92) }).media > 80);
  assert.equal(forca({ ...base, tecnico: v(95) }).ajusteTecnico, 3);
  assert.equal(forca({ ...base, tecnico: v(55) }).ajusteTecnico, -3);
});

test('dado bônus: mesmo time em outro split ou outro time do mesmo ano, uma vez só', () => {
  const jogo = novoJogo();
  const pain = times.find((t) => t.org === 'paiN Gaming');
  jogo.atual = pain.id;
  const op = opcoesBonus(jogo, times);
  assert.ok(op.org.every((t) => t.org === 'paiN Gaming' && t.id !== pain.id));
  assert.ok(op.ano.every((t) => t.ano === pain.ano && t.org !== 'paiN Gaming'));
  assert.ok(usarBonus(jogo, times, 'org'));
  assert.equal(opcoesBonus(jogo, times).org.length, 0);
});

test('montagem completa e simulação da campanha', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const jogo = novoJogo();
  for (let i = 0; i < 200 && !completo(jogo); i++) {
    rolar(jogo, times, rnd);
    const t = times.find((x) => x.id === jogo.atual);
    const p = [...t.jogadores.map((j) => ({ ...j, tipo: 'jogador' })), ...(t.tecnico ? [{ ...t.tecnico, tipo: 'tecnico', rota: 'tecnico' }] : [])]
      .find((x) => vagasPossiveis(jogo, x).length);
    escolher(jogo, times, p.nome, vagasPossiveis(jogo, p)[0]);
  }
  assert.ok(completo(jogo));
  const c = simular(jogo, times, rnd);
  assert.equal(c.rodadas.filter((r) => r.fase === 'Fase de pontos').length, 7);
  assert.equal(c.rodadas.length > 7, c.vitoriasGrupos >= 3);
  for (const r of c.rodadas.slice(7)) assert.ok(r.jogos.length >= 2 && r.jogos.length <= 5);
});

test('jogador que trocou de rota no split entra pela rota escolhida', () => {
  const t = times.find((x) => { const n = x.jogadores.map((j) => j.nome); return n.length !== new Set(n).size; });
  if (!t) return;
  const nome = t.jogadores.find((j, i) => t.jogadores.findIndex((k) => k.nome === j.nome) !== i).nome;
  const rotas = t.jogadores.filter((j) => j.nome === nome).map((j) => j.rota);
  const jogo = novoJogo();
  jogo.atual = t.id;
  assert.equal(escolher(jogo, times, nome, rotas[1]).rota, rotas[1]);
});

test('OVR decide: 15+ de diferença é impossível; 7 só com sorte', async () => {
  const { chanceVitoria } = await import('../jogos/cblol/js/logic.js');
  assert.equal(chanceVitoria(77, 92), 0);
  assert.equal(chanceVitoria(70, 92), 0);
  assert.equal(chanceVitoria(92, 77), 1);
  assert.ok(chanceVitoria(78, 92) > 0 && chanceVitoria(78, 92) < 0.02);
  assert.ok(chanceVitoria(85, 92) > 0.05 && chanceVitoria(85, 92) < 0.12);
  assert.equal(chanceVitoria(80, 80), 0.5);
});

test('sorteio evita times com jogador já escolhido (e ele fica desabilitado)', () => {
  const jogo = novoJogo();
  const tin = times.find((t) => t.jogadores.some((j) => j.nome === 'tinowns'));
  jogo.atual = tin.id;
  escolher(jogo, times, 'tinowns', 'mid');
  const comTin = new Set(times.filter((t) => t.jogadores.some((j) => j.nome === 'tinowns')).map((t) => t.id));
  let repetidos = 0;
  for (let i = 0; i < 2000; i++) { jogo.atual = null; rolar(jogo, times); if (comTin.has(jogo.atual)) repetidos++; }
  const esperadoSemFiltro = comTin.size / times.length;
  assert.ok(repetidos / 2000 < esperadoSemFiltro / 5, `${repetidos} de 2000`);
  const outro = times.find((t) => t.id !== tin.id && comTin.has(t.id));
  const p = { ...outro.jogadores.find((j) => j.nome === 'tinowns'), tipo: 'jogador' };
  assert.deepEqual(vagasPossiveis(jogo, p), []);
});

test('simulação: K/D/A de cada jogador fecha com o placar de abates', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const jogo = novoJogo();
  while (!completo(jogo)) {
    rolar(jogo, times, rnd);
    const t = times.find((x) => x.id === jogo.atual);
    const pessoas = [...t.jogadores.map((j) => ({ ...j, tipo: 'jogador' })), ...(t.tecnico ? [{ ...t.tecnico, tipo: 'tecnico', rota: 'tecnico' }] : [])];
    for (const p of pessoas) {
      const vs = vagasPossiveis(jogo, p);
      if (vs.length) { escolher(jogo, times, p.nome, vs[0]); break; }
    }
    jogo.atual = null;
  }
  const c = simular(jogo, times, rnd);
  const soma = (ls, k) => ls.reduce((s, j) => s + j[k], 0);
  const meus = new Set(VAGAS.map((v) => jogo.vagas[v].nome));
  for (const r of c.rodadas) {
    for (const g of r.jogos) {
      assert.ok(!g.eles.some((j) => meus.has(j.nome)), `${r.adv.time} tem alguém do seu time`);
      assert.equal(g.nos.length, 5);
      assert.equal(g.eles.length, 5);
      assert.equal(soma(g.nos, 'k'), g.placar[0]);
      assert.equal(soma(g.eles, 'k'), g.placar[1]);
      assert.equal(soma(g.nos, 'd'), g.placar[1]);
      assert.equal(soma(g.eles, 'd'), g.placar[0]);
      assert.ok(g.duracao >= 23 * 60 && g.duracao <= 40 * 60, `${g.duracao}`);
      if (g.venceu) assert.ok(g.nos.some((j) => j.nome === g.mvp));
    }
  }
});

test('mata-mata: adversários só de times que chegaram àquela fase', () => {
  const fase = new Map(times.map((t) => [t.id, t.playoffs]));
  const pode = { 'Quartas de final': ['quartas', 'semi', 'final'], Semifinal: ['semi', 'final'], Final: ['final'] };
  let vistos = 0;
  for (let n = 0; n < 150; n++) {
    const jogo = novoJogo();
    while (!completo(jogo)) {
      rolar(jogo, times);
      const t = times.find((x) => x.id === jogo.atual);
      const ps = [...t.jogadores.map((j) => ({ ...j, tipo: 'jogador' })), ...(t.tecnico ? [{ ...t.tecnico, tipo: 'tecnico', rota: 'tecnico' }] : [])];
      const p = ps.filter((x) => vagasPossiveis(jogo, x).length).sort((a, b) => b.ovr - a.ovr)[0];
      if (p) escolher(jogo, times, p.nome, vagasPossiveis(jogo, p).find((v) => v !== 'reserva') || vagasPossiveis(jogo, p)[0]);
      jogo.atual = null;
    }
    const rs = simular(jogo, times).rodadas;
    const ids = (lista) => lista.map((r) => r.adv.id);
    assert.equal(new Set(ids(rs.slice(0, 7))).size, 7, 'fase de pontos sem repetir');
    assert.equal(new Set(ids(rs.slice(7))).size, rs.length - 7, 'playoffs sem repetir');
    for (const r of rs.slice(7)) {
      assert.ok(pode[r.fase].includes(fase.get(r.adv.id)), `${r.fase}: ${r.adv.id} (${fase.get(r.adv.id)})`);
      vistos++;
    }
  }
  assert.ok(vistos > 50);
});
