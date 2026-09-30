import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { novoJogo, rolar, escolher, vagasPossiveis, opcoesBonus, usarBonus, completo, forca, simular, VAGAS, ROTAS } from '../jogos/cblol/js/logic.js';

const { times } = JSON.parse(readFileSync(new URL('../jogos/cblol/dados/times.json', import.meta.url)));

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

test('OVR decide: 12+ de diferença é impossível; 7 só com sorte', async () => {
  const { chanceVitoria } = await import('../jogos/cblol/js/logic.js');
  assert.equal(chanceVitoria(78, 92), 0);
  assert.equal(chanceVitoria(80, 92), 0);
  assert.ok(chanceVitoria(85, 92) > 0.03 && chanceVitoria(85, 92) < 0.1);
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
