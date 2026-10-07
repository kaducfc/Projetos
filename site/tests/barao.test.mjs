import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACIL, MEDIA, DIFICIL } from '../jogos/barao/js/perguntas.js';
import {
  NIVEIS, PREMIOS, novoJogo, responder, proxima, parar, pular, usarCarta, usarVazio, premioAoErrar, premioAoParar, faixa,
} from '../jogos/barao/js/logic.js';

// Gerador pseudoaleatório fixo para os testes.
function semente(n = 1) { let s = n; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

test('barão: banco de perguntas válido (4 opções distintas, sem pergunta repetida)', () => {
  const todas = [...FACIL, ...MEDIA, ...DIFICIL];
  assert.ok(FACIL.length >= 15 && MEDIA.length >= 15 && DIFICIL.length >= 15, 'poucas perguntas por faixa');
  const vistas = new Set();
  for (const p of todas) {
    assert.equal(p.a.length, 4, p.q);
    assert.equal(new Set(p.a.map((x) => x.trim().toLowerCase())).size, 4, `opções repetidas em: ${p.q}`);
    assert.ok(p.q.endsWith('?'), p.q);
    assert.ok(['jogo', 'lore', 'comp'].includes(p.cat), p.q);
    assert.ok(!vistas.has(p.q), `repetida: ${p.q}`);
    vistas.add(p.q);
  }
});

test('barão: prêmios, faixas e pontos seguros', () => {
  assert.equal(PREMIOS.length, NIVEIS);
  assert.equal(PREMIOS[14], 1000000);
  assert.deepEqual([1, 5, 6, 10, 11, 15].map(faixa), [1, 1, 2, 2, 3, 3]);
  assert.equal(premioAoParar(1), 0);
  assert.equal(premioAoParar(8), PREMIOS[6]);
  assert.equal(premioAoErrar(3), 0);
  assert.equal(premioAoErrar(6), PREMIOS[4]); // passou da 5: garantiu 1.000
  assert.equal(premioAoErrar(11), PREMIOS[9]); // passou da 10: garantiu 32.000
});

test('barão: partida completa — acertando tudo ganha 1.000.000', () => {
  const r = semente(7);
  let j = novoJogo(r);
  for (let n = 1; n <= NIVEIS; n += 1) {
    assert.equal(j.nivel, n);
    j = responder(j, j.pergunta.certa, r);
    if (n < NIVEIS) { assert.equal(j.status, 'acertou'); j = proxima(j, r); }
  }
  assert.equal(j.status, 'fim');
  assert.equal(j.resultado, 'ganhou');
  assert.equal(j.premio, 1000000);
  assert.equal(new Set(j.usadas).size, j.usadas.length, 'não repete pergunta');
});

test('barão: errar volta ao prêmio garantido; parar leva o prêmio atual', () => {
  const r = semente(3);
  let j = novoJogo(r);
  for (let n = 1; n <= 7; n += 1) { j = responder(j, j.pergunta.certa, r); j = proxima(j, r); }
  assert.equal(j.nivel, 8);
  const errada = [0, 1, 2, 3].find((i) => i !== j.pergunta.certa);
  const perdeu = responder(j, errada, r);
  assert.equal(perdeu.resultado, 'errou');
  assert.equal(perdeu.premio, PREMIOS[4]); // garantiu 1.000 na 5ª
  const saiu = parar(j);
  assert.equal(saiu.resultado, 'parou');
  assert.equal(saiu.premio, PREMIOS[6]); // 4.000 (acertou até a 7ª)
});

test('barão: Pinstouro troca a pergunta sem avançar e acaba depois de 3 usos', () => {
  const r = semente(11);
  let j = novoJogo(r);
  const antes = j.pergunta.q;
  j = pular(j, r);
  assert.equal(j.nivel, 1);
  assert.equal(j.pulos, 2);
  assert.notEqual(j.pergunta.q, antes);
  j = pular(pular(j, r), r);
  assert.equal(j.pulos, 0);
  const igual = pular(j, r);
  assert.equal(igual.pulos, 0);
  assert.equal(igual.pergunta.q, j.pergunta.q);
});

test('barão: Cartas do Twisted Fate tiram 1, 2 e 3 opções erradas, uma carta por pergunta', () => {
  const r = semente(5);
  for (const [id, tira] of [['azul', 1], ['vermelha', 2], ['dourada', 3]]) {
    let j = novoJogo(r);
    j = usarCarta(j, id, r);
    assert.equal(j.pergunta.eliminadas.length, tira);
    assert.ok(!j.pergunta.eliminadas.includes(j.pergunta.certa));
    assert.equal(j.cartas[id], true);
    const outra = usarCarta(j, id === 'azul' ? 'vermelha' : 'azul', r);
    assert.equal(outra.pergunta.eliminadas.length, tira, 'só uma carta por pergunta');
  }
  // a carta gasta não volta, mas uma nova pergunta libera outra carta
  let j = novoJogo(r);
  j = usarCarta(j, 'azul', r);
  j = responder(j, j.pergunta.certa, r);
  j = proxima(j, r);
  assert.equal(usarCarta(j, 'azul', r).cartas.azul, true);
  assert.equal(usarCarta(j, 'azul', r).pergunta.eliminadas.length, 0, 'carta azul já foi usada');
  assert.equal(usarCarta(j, 'dourada', r).pergunta.eliminadas.length, 3);
});

test('barão: Monstros do Vazio votam em opções que ainda existem e acertam mais nas fáceis', () => {
  const r = semente(9);
  let acertosFacil = 0; let acertosDificil = 0; const N = 400;
  for (let i = 0; i < N; i += 1) {
    const f = usarVazio(novoJogo(r), r);
    assert.equal(f.pergunta.votos.length, 3);
    acertosFacil += f.pergunta.votos.filter((v) => v.voto === f.pergunta.certa).length;
    let d = novoJogo(r); d.nivel = 12; d = usarVazio(d, r);
    acertosDificil += d.pergunta.votos.filter((v) => v.voto === d.pergunta.certa).length;
  }
  assert.ok(acertosFacil > acertosDificil, `${acertosFacil} vs ${acertosDificil}`);
  const c = usarVazio(usarCarta(novoJogo(r), 'dourada', r), r);
  assert.ok(c.pergunta.votos.every((v) => v.voto === c.pergunta.certa)); // só sobrou a certa
  assert.equal(usarVazio(c, r).vazio, true);
});
