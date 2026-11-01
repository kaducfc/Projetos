import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyBreakdown, legacyScore } from '../jogos/carreira-no-rift/js/engine/career.js';

const jogador = (extra = {}) => ({
  peakOvr: 90,
  earnings: { salary: 1_500_000, prizes: 500_000 },
  trophies: [
    { name: 'Mundial', kind: 'intl' }, { name: 'MSI', kind: 'intl' },
    { name: 'LCK', kind: 'league', tier: 1 }, { name: 'LCK', kind: 'league', tier: 1 },
    { name: 'MVP da Final do Mundial', kind: 'award' }, { name: 'MVP da Temporada', kind: 'award' }, { name: 'Seleção', kind: 'award' },
  ],
  ...extra,
});
const pontos = (p, inicio) => legacyBreakdown(p).find((x) => x.label.startsWith(inicio))?.points;

test('legado: dinheiro vale 25 pontos por US$ 1 milhão', () => {
  assert.equal(pontos(jogador(), 'Dinheiro'), 50); // US$ 2 milhões
  assert.equal(pontos(jogador({ earnings: { salary: 10_000_000, prizes: 0 } }), 'Dinheiro'), 250);
  assert.equal(pontos(jogador({ earnings: { salary: 500_000, prizes: 0 } }), 'Dinheiro'), 13); // 12,5 arredonda para 13
  assert.equal(pontos(jogador({ earnings: { salary: 10_000, prizes: 0 } }), 'Dinheiro'), undefined); // arredonda para 0 e some
});

test('legado: MVP da Final do Mundial 30 e outros prêmios individuais 15', () => {
  assert.equal(pontos(jogador(), 'MVP da Final'), 30);
  assert.equal(pontos(jogador(), 'Outros prêmios'), 30); // 2 × 15
});

test('legado: o resto da conta continua igual', () => {
  const p = jogador();
  assert.equal(pontos(p, 'OVR máximo'), 180);
  assert.equal(pontos(p, 'Mundiais'), 120);
  assert.equal(pontos(p, 'MSI'), 60);
  assert.equal(pontos(p, 'Títulos de liga principal'), 40);
  assert.equal(legacyScore(p), 180 + 120 + 60 + 40 + 30 + 30 + 50);
});

test('legado: First Stand 40 e título de divisão de acesso 10', () => {
  const p = jogador({ trophies: [{ name: 'First Stand', kind: 'intl' }, { name: 'Challengers', kind: 'league', tier: 2 }] });
  assert.equal(pontos(p, 'First Stand'), 40);
  assert.equal(pontos(p, 'Títulos de divisão de acesso'), 10);
});

test('legado: a vigilância do servidor (0032) usa a mesma conta', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0032_legado_25.sql', import.meta.url), 'utf8');
  assert.match(sql, /round\(25 \* coalesce\(\(r\.summary->>'earnings'\)::numeric, 0\) \/ 1000000\)/);
  assert.match(sql, /\* 40/); // First Stand
  assert.match(sql, /30 \* b\.mundial/);
});
