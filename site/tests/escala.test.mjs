import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { pontos, rodadasDoDia, sortearRodada, rng, fmtAltura, proporcao, RODADAS, RAZAO_MIN, RAZAO_MAX } from '../jogos/escala/js/logic.js';

const itens = JSON.parse(readFileSync(new URL('../jogos/escala/dados/itens.json', import.meta.url)));
const props = JSON.parse(readFileSync(new URL('../jogos/escala/dados/silhuetas.json', import.meta.url)));
const versoes = JSON.parse(readFileSync(new URL('../jogos/escala/dados/versoes.json', import.meta.url)));
const porId = new Map(itens.map((i) => [i.id, i]));

test('escala: pontuação pela distância relativa', () => {
  assert.equal(pontos(2, 2), 100);
  assert.equal(pontos(2.4, 2), pontos(2, 2.4)); // errar para cima ou para baixo pela mesma razão vale igual
  assert.ok(pontos(2.2, 2) >= 90);
  assert.equal(pontos(6, 2), 0); // 3× maior
  assert.equal(pontos(0.5, 2), 0);
  assert.equal(pontos(0, 2), 0);
  // Diferença grande entre as duas coisas: margem maior (Cho'Gath × Jhin, 45% a mais).
  assert.equal(pontos(2.81, 1.93), 66);
  assert.ok(pontos(2.81, 1.93, 21.9 / 1.93) >= 80);
  assert.equal(pontos(2, 2, 12), 100);
  assert.ok(pontos(2.4, 2, 1.2) - pontos(2.4, 2) <= 2); // parecidas: quase igual a antes
});

test('escala: cada item da tabela tem silhueta, nome e altura', () => {
  const ids = new Set();
  for (const i of itens) {
    assert.ok(i.id && i.nome && i.altura > 0, JSON.stringify(i));
    assert.ok(!ids.has(i.id), `id repetido: ${i.id}`);
    ids.add(i.id);
    assert.ok(props[i.id] > 0, `sem proporção: ${i.id}`);
    assert.match(versoes[i.id] || '', /^[0-9a-f]{8}$/, `sem versão: ${i.id}`);
    assert.ok(existsSync(new URL(`../jogos/escala/dados/silhuetas/${i.id}.webp`, import.meta.url)), `sem imagem: ${i.id}`);
    assert.ok(['comunidade', 'desenvolvedores', 'interpretativo', 'oficial', 'rift'].includes(i.confianca), i.id);
  }
});

test('escala: o dia tem 10 rodadas iguais para todos, sem alvo repetido e com proporção jogável', () => {
  for (let dia = 0; dia < 60; dia++) {
    const r = rodadasDoDia(itens, dia);
    assert.deepEqual(r, rodadasDoDia(itens, dia));
    assert.equal(r.length, RODADAS);
    assert.equal(new Set(r.map((x) => x.alvo)).size, RODADAS);
    for (const { ref, alvo } of r) {
      const a = porId.get(alvo).altura;
      const b = porId.get(ref).altura;
      const razao = Math.max(a, b) / Math.min(a, b);
      assert.ok(ref !== alvo && razao >= RAZAO_MIN && razao <= RAZAO_MAX, `${ref} x ${alvo}`);
    }
  }
  assert.notDeepEqual(rodadasDoDia(itens, 1), rodadasDoDia(itens, 2));
  assert.ok(sortearRodada(itens, rng(7)).ref);
});

test('escala: textos de altura e proporção', () => {
  assert.equal(fmtAltura(0.73), '0,73 m');
  assert.equal(fmtAltura(1.6), '1,6 m');
  assert.equal(fmtAltura(12), '12 m');
  assert.equal(fmtAltura(103.6), '104 m');
  assert.equal(proporcao({ nome: 'Garen', altura: 1.95 }, { nome: 'Teemo', altura: 0.81 }), 'Garen é 2,41× maior que Teemo');
});
