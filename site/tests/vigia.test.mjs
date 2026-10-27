import test from 'node:test';
import assert from 'node:assert/strict';
import { sinaisVigia, resumoJogadores, anotarRepeticoes } from '../shared/vigia.js';

const cod = (p) => sinaisVigia(p).map(([c]) => c);

test('vigia: Lendas — campeão invicto e campanha rápida demais', () => {
  assert.deepEqual(cod({ jogo: 'cblol', invicto: true, duracao_s: 120 }), []);
  assert.deepEqual(cod({ jogo: 'cblol', invicto: false, duracao_s: 12 }), ['rapida']);
  assert.deepEqual(cod({ jogo: 'cblol', invicto: false, duracao_s: 90 }), []);
  assert.deepEqual(cod({ jogo: 'cblol', invicto: true, duracao_s: 12 }), ['rapida']);
});

test('vigia: Runetermo e Campeão — só vitória conta como sinal', () => {
  assert.deepEqual(cod({ jogo: 'runetermo', status: 'ganhou', chutes: 1, duracao_s: 40 }), []);
  assert.deepEqual(cod({ jogo: 'campeao', status: 'ganhou', chutes: 4, duracao_s: 3 }), ['rapida']);
  assert.deepEqual(cod({ jogo: 'campeao', status: 'perdeu', chutes: 6, duracao_s: 3 }), []);
  assert.deepEqual(cod({ jogo: 'runetermo', status: 'ganhou', chutes: 3, duracao_s: 60 }), []);
});

test('vigia: Na Medida — média quase perfeita e tempo curto', () => {
  assert.deepEqual(cod({ jogo: 'escala', media: 97.2, duracao_s: 80 }), []);
  assert.deepEqual(cod({ jogo: 'escala', media: 99.4, duracao_s: 80 }), ['rara']);
  assert.deepEqual(cod({ jogo: 'escala', media: 60, duracao_s: 9 }), ['rapida']);
  assert.deepEqual(cod({ jogo: 'escala', media: '94.9', duracao_s: 80 }), []);
  assert.deepEqual(cod({ jogo: 'escala', media: null, duracao_s: null }), []);
});

test('vigia: resumo por jogador conta dias diferentes, não só partidas', () => {
  const ps = [
    { username: 'ana', jogo: 'cblol', duracao_s: 5, dia: '2026-10-01' },
    { username: 'ana', jogo: 'escala', media: 99.5, dia: '2026-10-01' },
    { username: 'ana', jogo: 'cblol', duracao_s: 9, dia: '2026-10-02' },
    { username: 'bia', jogo: 'cblol', invicto: false, dia: '2026-10-01', duracao_s: 100 },
    { username: 'caio', jogo: 'escala', media: 99, dia: '2026-10-01' },
  ];
  const r = resumoJogadores(ps);
  assert.equal(r[0].nome, 'ana');
  assert.equal(r[0].dias, 2);
  assert.equal(r[0].comSinais, 3);
  assert.deepEqual(r[0].jogos, { cblol: 2, escala: 1 });
  assert.equal(r.find((j) => j.nome === 'bia').comSinais, 0);
});

test('vigia: Carreira (ficha do jogador) — só rápida demais', () => {
  assert.deepEqual(cod({ jogo: 'carreira-no-rift', score: 900, duracao_s: 120 }), ['rapida']);
  assert.deepEqual(cod({ jogo: 'carreira-no-rift', score: 1650, duracao_s: 1800 }), [], 'nota alta sozinha não é sinal');
  assert.deepEqual(cod({ jogo: 'carreira-no-rift', score: 900, duracao_s: 1800 }), []);
});

test('vigia: acertar de primeira só vira sinal ao se repetir em 3 dias ou mais', () => {
  const g = (u, dia, extra = {}) => ({ username: u, jogo: 'runetermo', status: 'ganhou', chutes: 1, dia, ...extra });
  const ps = anotarRepeticoes([g('ana', '2026-10-01'), g('ana', '2026-10-01'), g('ana', '2026-10-02'), g('bia', '2026-10-01'), g('bia', '2026-10-02'), g('bia', '2026-10-03', { dicas: 1 }), g('bia', '2026-10-04', { jogo: 'campeao' })]);
  assert.deepEqual(ps.map((p) => cod(p).length), [0, 0, 0, 0, 0, 0, 0], 'ana: 2 dias; bia: 2 dias (dica não conta; outro jogo à parte)');
  const mais = anotarRepeticoes([g('caio', '2026-10-01'), g('caio', '2026-10-02'), g('caio', '2026-10-03'), g('caio', '2026-10-04', { chutes: 3 })]);
  assert.deepEqual(mais.map((p) => cod(p).length), [1, 1, 1, 0]);
});
