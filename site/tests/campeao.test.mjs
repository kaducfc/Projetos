import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare, search, computeStats, championFor, dayIndex, shareText, COLUMNS } from '../jogos/campeao/js/logic.js';

const data = JSON.parse(readFileSync(new URL('../jogos/campeao/dados/campeoes.json', import.meta.url)));
const get = (n) => data.campeoes.find((c) => c.nome === n);

test('dados: 173 campeões completos e fila com todos', () => {
  assert.equal(data.campeoes.length, 173);
  assert.equal(new Set(data.ordem).size, 173);
  for (const c of data.campeoes) {
    for (const col of COLUMNS) assert.ok(c[col.key] !== undefined && (Array.isArray(c[col.key]) ? c[col.key].length : true), `${c.nome}: ${col.key}`);
  }
  assert.equal(get('Locke').ano, 2026);
});

test('compara características: igual, parcial e seta do ano', () => {
  const r = compare(get('Pantheon'), get('Leona'));
  const by = Object.fromEntries(COLUMNS.map((c, i) => [c.key, r[i]]));
  assert.deepEqual(by.ano, { state: 'miss', arrow: 'up' }); // Leona (2011) é mais nova que Pantheon (2010)
  assert.equal(by.genero.state, 'miss');
  assert.equal(by.regioes.state, 'ok'); // Targon
  assert.equal(by.posicoes.state, 'part'); // Suporte em comum
  assert.equal(by.especies.state, 'ok'); // Humano + Celestial
  assert.equal(by.alcance.state, 'ok');
  assert.ok(compare(get('Ahri'), get('Ahri')).every((x) => x.state === 'ok'));
  assert.equal(compare(get('Locke'), get('Aatrox'))[0].arrow, 'down');
});

test('busca ignora acentos e símbolos', () => {
  assert.equal(search('kais', data.campeoes)[0].nome, "Kai'Sa");
  assert.equal(search('nunu', data.campeoes)[0].nome, 'Nunu e Willump');
  assert.deepEqual(search('drmun', data.campeoes).map((c) => c.nome), ['Dr. Mundo']);
  assert.ok(!search('ahr', data.campeoes, new Set(['Ahri'])).length);
});

test('campeão do dia e estatísticas', () => {
  assert.equal(dayIndex(new Date('2026-09-30T02:59:00Z')), 0);
  assert.equal(championFor(0, data).nome, data.ordem[0]);
  const s = computeStats({ 0: 3, 1: 5, 3: 1, 4: 12 }, 4);
  assert.equal(s.played, 4);
  assert.equal(s.avg, 5.25);
  assert.equal(s.best, 2);
  assert.equal(s.streak, 2);
  assert.deepEqual(s.dist, [1, 0, 1, 0, 1, 0, 1]);
  assert.equal(computeStats({ 0: 3 }, 2).streak, 0);
  const t = shareText({ name: 'Jogo', number: 1, guesses: [get('Pantheon'), get('Leona')], answer: get('Leona') });
  assert.equal(t, 'Jogo #1: acertei em 2 tentativas\n\n⬆️🟥🟩🟨🟥🟩🟩\n🟩🟩🟩🟩🟩🟩🟩');
});
