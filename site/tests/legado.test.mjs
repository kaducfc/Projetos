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

test('legado: dinheiro vale 18 pontos por US$ 1 milhão', () => {
  assert.equal(pontos(jogador(), 'Dinheiro'), 36); // US$ 2 milhões
  assert.equal(pontos(jogador({ earnings: { salary: 10_000_000, prizes: 0 } }), 'Dinheiro'), 180);
  assert.equal(pontos(jogador({ earnings: { salary: 500_000, prizes: 0 } }), 'Dinheiro'), 9);
  assert.equal(pontos(jogador({ earnings: { salary: 20_000, prizes: 0 } }), 'Dinheiro'), undefined); // arredonda para 0 e some
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
  assert.equal(legacyScore(p), 180 + 120 + 60 + 40 + 30 + 30 + 36);
});

test('legado: a vigilância do servidor (0031) usa a mesma conta', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0031_legado_novo.sql', import.meta.url), 'utf8');
  assert.match(sql, /round\(18 \* coalesce\(\(r\.summary->>'earnings'\)::numeric, 0\) \/ 1000000\)/);
  assert.match(sql, /30 \* b\.mundial/);
});
