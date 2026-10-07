import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACIL, MEDIA, DIFICIL, IMPOSSIVEL, BANCO } from '../jogos/barao/js/perguntas.js';
import {
  semAjuda, NIVEIS, PREMIOS, SEGUROS, CARTAS, novoJogo, responder, proxima, parar, pular, usarCarta, usarVazio, premioAoErrar, premioAoParar, faixa,
} from '../jogos/barao/js/logic.js';

// Gerador pseudoaleatório fixo para os testes.
function semente(n = 1) { let s = n; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

test('barão: banco com 250+ perguntas válidas (4 opções distintas, sem repetição)', () => {
  const todas = [...FACIL, ...MEDIA, ...DIFICIL, ...IMPOSSIVEL];
  assert.ok(todas.length >= 250, `só ${todas.length} perguntas`);
  assert.ok(FACIL.length >= 30 && MEDIA.length >= 30 && DIFICIL.length >= 30 && IMPOSSIVEL.length >= 10, 'poucas perguntas por faixa');
  assert.deepEqual(Object.keys(BANCO), ['1', '2', '3', '4']);
  const vistas = new Set();
  for (const p of todas) {
    assert.equal(p.a.length, 4, p.q);
    assert.equal(new Set(p.a.map((x) => x.trim().toLowerCase())).size, 4, `opções repetidas em: ${p.q}`);
    assert.ok(p.q.endsWith('?'), p.q);
    assert.ok(['jogo', 'lore', 'comp'].includes(p.cat), p.q);
    assert.ok(!vistas.has(p.q.toLowerCase()), `repetida: ${p.q}`);
    vistas.add(p.q.toLowerCase());
  }
});

test('barão: 11 perguntas (3 fáceis, 3 médias, 4 difíceis, 1 quase impossível) e prêmios crescentes', () => {
  assert.equal(NIVEIS, 11);
  assert.equal(PREMIOS.length, NIVEIS);
  assert.equal(PREMIOS[10], 1000000);
  assert.equal(PREMIOS[9], 500000);
  assert.ok(PREMIOS.every((v, i) => i === 0 || v > PREMIOS[i - 1]));
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(faixa), [1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4]);
  assert.deepEqual(SEGUROS, [3, 6]);
  assert.equal(premioAoParar(1), 0);
  assert.equal(premioAoParar(8), PREMIOS[6]);
  assert.equal(premioAoErrar(3), 0);
  assert.equal(premioAoErrar(4), PREMIOS[2]); // passou da 3: garantiu 2.000
  assert.equal(premioAoErrar(7), PREMIOS[5]); // passou da 6: garantiu 20.000
  assert.equal(premioAoErrar(11), PREMIOS[5]);
});

test('barão: cada pergunta sai da faixa certa', () => {
  const r = semente(21);
  let j = novoJogo(r);
  for (let n = 1; n <= NIVEIS; n += 1) {
    const banco = BANCO[faixa(n)].map((p) => p.q);
    assert.ok(banco.includes(j.pergunta.q), `pergunta ${n} fora da faixa ${faixa(n)}`);
    j = responder(j, j.pergunta.certa, r);
    if (n < NIVEIS) j = proxima(j, r);
  }
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
  assert.equal(perdeu.premio, PREMIOS[5]); // garantiu 20.000 na 6ª
  const saiu = parar(j);
  assert.equal(saiu.resultado, 'parou');
  assert.equal(saiu.premio, PREMIOS[6]); // 50.000 (acertou até a 7ª)
});

test('barão: Pinstouro troca a pergunta sem avançar e acaba depois de 2 usos', () => {
  const r = semente(11);
  let j = novoJogo(r);
  const antes = j.pergunta.q;
  j = pular(j, r);
  assert.equal(j.nivel, 1);
  assert.equal(j.pulos, 1);
  assert.notEqual(j.pergunta.q, antes);
  j = pular(j, r);
  assert.equal(j.pulos, 0);
  const igual = pular(j, r);
  assert.equal(igual.pulos, 0);
  assert.equal(igual.pergunta.q, j.pergunta.q);
});

test('barão: cartas do TF — viradas, só uma escolha na partida inteira, revela e tira 1, 2 ou 3', () => {
  const r = semente(5);
  let j = novoJogo(r);
  assert.deepEqual([...j.cartaOrdem].sort(), CARTAS.map((c) => c.id).sort(), 'as três cores estão nas três posições');
  assert.equal(j.cartaUsada, null);
  for (let slot = 0; slot < 3; slot += 1) {
    const n = novoJogo(r);
    const id = n.cartaOrdem[slot];
    const tira = CARTAS.find((c) => c.id === id).tira;
    const u = usarCarta(n, slot, r);
    assert.deepEqual(u.cartaUsada, { slot, id });
    assert.equal(u.pergunta.eliminadas.length, tira);
    assert.ok(!u.pergunta.eliminadas.includes(u.pergunta.certa));
    // não dá para escolher outra carta
    const outra = usarCarta(u, (slot + 1) % 3, r);
    assert.equal(outra.pergunta.eliminadas.length, tira);
    assert.deepEqual(outra.cartaUsada, u.cartaUsada);
  }
  // nem nas perguntas seguintes
  j = usarCarta(j, 0, r);
  j = proxima(responder(j, j.pergunta.certa, r), r);
  assert.equal(usarCarta(j, 1, r).pergunta.eliminadas.length, 0);
  assert.equal(usarCarta(j, 1, r).cartaUsada.slot, 0);
  // posições inválidas não fazem nada
  assert.equal(usarCarta(novoJogo(r), 7, r).cartaUsada, null);
});

test('barão: a ordem das cartas varia de partida para partida', () => {
  const r = semente(2);
  const ordens = new Set(Array.from({ length: 40 }, () => novoJogo(r).cartaOrdem.join()));
  assert.ok(ordens.size >= 4);
});

test('barão: Monstros do Vazio votam em opções que ainda existem e acertam mais nas fáceis', () => {
  const r = semente(9);
  let acertosFacil = 0; let acertosDificil = 0; const N = 400;
  for (let i = 0; i < N; i += 1) {
    const f = usarVazio(novoJogo(r), r);
    assert.equal(f.pergunta.votos.length, 3);
    acertosFacil += f.pergunta.votos.filter((v) => v.voto === f.pergunta.certa).length;
    let d = novoJogo(r); d.nivel = 9; d = usarVazio(d, r);
    acertosDificil += d.pergunta.votos.filter((v) => v.voto === d.pergunta.certa).length;
  }
  assert.ok(acertosFacil > acertosDificil, `${acertosFacil} vs ${acertosDificil}`);
  const n = novoJogo(r);
  const c = usarVazio(usarCarta(n, n.cartaOrdem.indexOf('dourada'), r), r);
  assert.ok(c.pergunta.votos.every((v) => v.voto === c.pergunta.certa)); // só sobrou a certa
  assert.equal(usarVazio(c, r).vazio, true);
});

test('barão: na última pergunta nenhuma ajuda funciona', () => {
  const r = semente(4);
  let j = novoJogo(r);
  j.nivel = NIVEIS;
  assert.ok(semAjuda(j.nivel));
  assert.equal(pular(j, r).pulos, j.pulos);
  assert.equal(pular(j, r).pergunta.q, j.pergunta.q);
  assert.equal(usarCarta(j, 0, r).cartaUsada, null);
  assert.equal(usarVazio(j, r).vazio, false);
});

test('barão: pular mantém a etapa e o prêmio, só troca a pergunta da mesma faixa', () => {
  const r = semente(13);
  let j = novoJogo(r);
  for (let n = 1; n <= 2; n += 1) j = proxima(responder(j, j.pergunta.certa, r), r);
  assert.equal(j.nivel, 3);
  const q = j.pergunta.q;
  const p = pular(j, r);
  assert.equal(p.nivel, 3);
  assert.equal(p.status, 'jogando');
  assert.notEqual(p.pergunta.q, q);
  assert.ok(BANCO[faixa(3)].some((x) => x.q === p.pergunta.q));
  assert.equal(parar(p).premio, PREMIOS[1]); // o prêmio segue o mesmo
});

test('barão: tradução completa — telas, perguntas e alternativas nos 5 idiomas', async () => {
  const { __usarDicionario, traduzirTexto, t, LANGS } = await import('../shared/i18n.js');
  const { default: ui } = await import('../shared/i18n/src/barao-ui.mjs');
  const ids = LANGS.map((l) => l.id).filter((id) => id !== 'pt-BR');
  const todas = Object.values(BANCO).flat();
  // alternativas que ficam iguais em todos os idiomas (nomes de campeões, times, lugares, números…)
  const opcoesTraduzidas = new Set((await import('../shared/i18n/src/barao-opcoes.mjs')).default.map((l) => l[0]));
  for (const id of ids) {
    __usarDicionario((await import(`../shared/i18n/${id}.js`)).default, id);
    const faltam = todas.filter((p) => traduzirTexto(p.q) == null).map((p) => p.q);
    assert.deepEqual(faltam.slice(0, 5), [], `${id}: ${faltam.length} perguntas sem tradução`);
    for (const l of ui) if (!/^\{\w+\} pontos$/.test(l[0])) assert.ok(traduzirTexto(l[0]) != null || l[0] === 'Quiz', `${id}: ${l[0]}`);
    for (const o of opcoesTraduzidas) assert.ok(traduzirTexto(o) != null, `${id}: ${o}`);
  }
  // as alternativas com palavras em português estão todas cobertas (o resto é nome próprio)
  const palavras = /\b(de|do|da|dos|das|e|o|a|os|as|um|uma|em|no|na|fase|dano|time|guerra|rei|ilhas?)\b/i;
  const semTraducao = [...new Set(todas.flatMap((p) => p.a))].filter((o) => palavras.test(o) && !opcoesTraduzidas.has(o) && !/^[A-Z][\w'’.\-\/ ]+$/.test(o));
  assert.deepEqual(semTraducao, [], 'alternativas em português sem tradução');
  // valores dentro do texto continuam funcionando
  __usarDicionario((await import('../shared/i18n/en.js')).default, 'en');
  assert.equal(t('Prêmio garantido: {valor}!', { valor: '1,000' }), 'Prize secured: 1,000!');
  assert.equal(traduzirTexto('A resposta certa era B: Dragão Infernal.'), 'The correct answer was B: Infernal Drake.');
});
