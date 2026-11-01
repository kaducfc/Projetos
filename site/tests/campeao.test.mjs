import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare, search, exactMatch, pickHint, computeStats, championFor, dayIndex, shareText, COLUMNS } from '../jogos/campeao/js/logic.js';

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

test('busca: só nomes que começam com o texto; aceita só nome completo', () => {
  assert.deepEqual(search('nu', data.campeoes).map((c) => c.nome), ['Nunu e Willump']);
  assert.ok(search('n', data.campeoes).every((c) => c.nome.startsWith('N')));
  assert.equal(search('kais', data.campeoes)[0].nome, "Kai'Sa");
  assert.deepEqual(search('mundo', data.campeoes), []); // não procura no meio do nome
  assert.ok(!search('ahr', data.campeoes, new Set(['Ahri'])).length);
  assert.equal(exactMatch("kai'sa", data.campeoes).nome, "Kai'Sa");
  assert.equal(exactMatch('KAISA', data.campeoes).nome, "Kai'Sa");
  assert.equal(exactMatch('kai', data.campeoes), null);
});

test('dica confirma uma característica que ainda não está verde', () => {
  const ans = get('Leona');
  // Pantheon já deixou Região, Espécie e Alcance verdes.
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(pickHint([get('Pantheon')], ans, () => i / 40));
  assert.deepEqual([...seen].sort(), ['ano', 'classes', 'genero', 'posicoes'].sort());
  const any = pickHint([], ans); // sem tentativas: qualquer uma das 7
  assert.ok(COLUMNS.some((c) => c.key === any));
  assert.equal(pickHint([ans], ans), null);
});

test('campeão do dia e estatísticas', () => {
  assert.equal(dayIndex(new Date('2026-09-30T02:59:00Z')), 0);
  assert.equal(championFor(0, data).nome, data.ordem[0]);
  const s = computeStats({ 0: { tries: 3, won: true }, 1: { tries: 5, won: true }, 3: { tries: 1, won: true }, 4: { tries: 8, won: false }, 5: 2 }, 5);
  assert.equal(s.played, 5);
  assert.equal(s.wins, 4);
  assert.equal(s.losses, 1);
  assert.equal(s.avg, 2.75);
  assert.equal(s.best, 2);
  assert.equal(s.streak, 1);
  assert.deepEqual(s.dist, [1, 1, 1, 0, 1, 0, 0, 0]);
  assert.equal(computeStats({ 0: { tries: 3, won: true } }, 2).streak, 0);
  const t = shareText({ name: 'Jogo', number: 1, guesses: [get('Pantheon'), get('Leona')], answer: get('Leona'), won: true });
  assert.equal(t, 'Jogo #1 2/8\n\n⬆️🟥🟩🟨🟥🟩🟩\n🟩🟩🟩🟩🟩🟩🟩');
  const th = shareText({ name: 'Jogo', number: 1, guesses: [get('Leona')], answer: get('Leona'), won: true, hint: true });
  assert.equal(th.split('\n')[0], 'Jogo #1 2/8 💡'); // a dica gasta uma tentativa
});
