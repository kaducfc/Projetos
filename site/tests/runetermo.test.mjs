import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  norm, displayLetters, evaluate, brDate, dayIndex, answerFor, msToNextDay, computeStats, keyboardState, shareText,
} from '../jogos/runetermo/js/logic.js';

test('normaliza acentos e símbolos', () => {
  assert.equal(norm("Kai'Sa"), 'KAISA');
  assert.equal(norm('Poção'), 'POCAO');
  assert.deepEqual(displayLetters('Poção'), ['P', 'O', 'Ç', 'Ã', 'O']);
  assert.deepEqual(displayLetters("Kai'Sa"), ['K', 'A', 'I', 'S', 'A']);
});

test('compara letras, inclusive repetidas', () => {
  assert.deepEqual(evaluate('TURMA', 'TERMO'), ['ok', 'miss', 'ok', 'ok', 'miss']);
  assert.deepEqual(evaluate('VIOLA', 'TERMO'), ['miss', 'miss', 'near', 'miss', 'miss']);
  // Duas letras A no palpite, uma só na resposta: só a primeira conta.
  assert.deepEqual(evaluate('ARARA', 'KARMA'), ['near', 'near', 'miss', 'miss', 'ok']);
  // A que está no lugar certo tem prioridade sobre a de antes.
  assert.deepEqual(evaluate('AABBB', 'CCCAA'), ['near', 'near', 'miss', 'miss', 'miss']);
  assert.deepEqual(evaluate('pocao', 'Poção'), ['ok', 'ok', 'ok', 'ok', 'ok']);
});

test('dia troca à meia-noite de Brasília', () => {
  // 02:59 UTC do dia 30 = 23:59 do dia 29 em Brasília.
  assert.equal(brDate(new Date('2026-09-30T02:59:00Z')), '2026-09-29');
  assert.equal(brDate(new Date('2026-09-30T03:00:00Z')), '2026-09-30');
  assert.equal(dayIndex(new Date('2026-09-30T02:59:00Z')), 0);
  assert.equal(dayIndex(new Date('2026-09-30T03:00:00Z')), 1);
  assert.equal(dayIndex(new Date('2026-12-31T15:00:00Z')), 93);
  assert.equal(msToNextDay(new Date('2026-09-30T02:59:00Z')), 60_000);
  assert.equal(answerFor(3, ['a', 'b']), 'b');
});

test('estatísticas e sequência de vitórias', () => {
  const h = { 0: { tries: 3, won: true }, 1: { tries: 4, won: true }, 3: { tries: 2, won: true }, 4: { tries: 6, won: false }, 5: { tries: 1, won: true }, 6: { tries: 5, won: true } };
  const s = computeStats(h, 6);
  assert.equal(s.played, 6);
  assert.equal(s.wins, 5);
  assert.equal(s.pct, 83);
  assert.equal(s.best, 2);
  assert.equal(s.streak, 2);
  assert.deepEqual(s.dist, [1, 1, 1, 1, 1, 0]);
  assert.equal(computeStats(h, 7).streak, 2); // ainda não jogou hoje
  assert.equal(computeStats(h, 8).streak, 0); // pulou um dia
  assert.equal(computeStats({ 2: { tries: 6, won: false } }, 2).streak, 0);
});

test('teclado e texto para compartilhar', () => {
  const k = keyboardState(['TURMA', 'TERMO'], 'TERMO');
  assert.equal(k.T, 'ok');
  assert.equal(k.U, 'miss');
  assert.equal(k.O, 'ok');
  const t = shareText({ name: 'Jogo', number: 5, guesses: ['TURMA', 'TERMO'], answer: 'TERMO', won: true });
  assert.equal(t, 'Jogo #5 2/6\n\n🟩⬛🟩🟩⬛\n🟩🟩🟩🟩🟩');
});
