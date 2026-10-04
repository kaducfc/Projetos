import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFx, ganharPontos, ganharContinuo, fatorGanho, ATTR_MAX } from '../jogos/carreira-no-rift/js/engine/player.js';

const jogador = (attrs, potential = 99) => ({
  role: 'mid', potential, morale: 50, fame: 10, peakOvr: 0,
  attrs: { mec: 70, rota: 70, macro: 70, tf: 70, mental: 70, ...attrs },
});

test('carreira: acerto sempre sobe algum atributo, mesmo sem atributo no efeito', () => {
  for (let i = 0; i < 200; i++) {
    const p = jogador({});
    const real = applyFx(p, { morale: 5 }, { garantia: 'ganho', attrPadrao: 'macro' });
    assert.ok(real.macro >= 1, JSON.stringify(real));
  }
});

test('carreira: erro sempre mexe em algum atributo', () => {
  const p = jogador({});
  const real = applyFx(p, { morale: -6 }, { garantia: 'mudanca', attrPadrao: 'mental' });
  assert.equal(real.mental, -1);
});

test('carreira: perto do potencial a decisão certa ainda rende pelo menos 1 ponto', () => {
  const p = jogador({}, 60); // já passou do potencial
  const real = applyFx(p, { mec: 2 }, { garantia: 'ganho', attrPadrao: 'mec' });
  assert.ok(real.mec >= 1);
});

test('carreira: atributo nunca passa de 100 e o que aparece é o ganho real', () => {
  const p = jogador({ mec: 100, rota: 100, macro: 100, tf: 100, mental: 99.5 });
  const real = applyFx(p, { mec: 3 }, { garantia: 'ganho', attrPadrao: 'mec' });
  assert.equal(p.attrs.mec, 100);
  assert.equal(real.mec, undefined); // não "ganhou" nada no 100
  assert.equal(p.attrs.mental, 100); // o ganho garantido foi para quem ainda podia subir
  assert.equal(real.mental, 0.5);
  for (let i = 0; i < 50; i++) assert.ok(ganharContinuo(99, 5) <= ATTR_MAX);
});

test('carreira: a partir de 96 fica bem difícil subir, mas o 100 continua possível (perder continua igual)', () => {
  assert.equal(fatorGanho(95.9), 1);
  assert.equal(fatorGanho(96), 0.6);
  assert.ok(fatorGanho(98) < fatorGanho(96));
  assert.ok(fatorGanho(100) > 0); // o 100 é possível
  // Abaixo de 96: sempre entra tudo.
  for (let i = 0; i < 100; i++) assert.equal(ganharPontos(90, 3), 93);
  // Acima: em média entra pouco mais de metade dos pontos tentados no 96.
  let soma = 0;
  for (let i = 0; i < 4000; i++) soma += ganharPontos(96, 3) - 96;
  assert.ok(soma / 4000 < 1.5, `média ${soma / 4000}`);
  // Ganho contínuo: 10 pontos a partir de 90 não chegam nem perto de 100.
  assert.ok(ganharContinuo(90, 10) < 99);
  const p = jogador({ mec: 98 });
  applyFx(p, { mec: -4 }, { garantia: 'mudanca' });
  assert.equal(p.attrs.mec, 94);
});

test('carreira: OVR inicial fixo (53) com atributos sorteados, mais o bônus de elo', async () => {
  const { rollAttrs, calcOvr, OVR_INICIAL } = await import('../jogos/carreira-no-rift/js/engine/player.js');
  const { ROLES, STYLES } = await import('../jogos/carreira-no-rift/js/data/world.js');
  const { bonusCarreira, OVR_CARREIRA_BASE } = await import('../shared/ranked.js');
  assert.equal(OVR_INICIAL, 53);
  assert.equal(OVR_CARREIRA_BASE, OVR_INICIAL); // o card da ranqueada mostra o mesmo número
  assert.deepEqual([null, 'ferro', 'bronze', 'prata', 'ouro', 'platina', 'esmeralda', 'diamante', 'mestre', 'grao-mestre', 'desafiante'].map(bonusCarreira), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const vistos = new Set();
  for (const r of Object.keys(ROLES)) for (const s of Object.keys(STYLES)) for (let i = 0; i < 50; i++) {
    const a = rollAttrs(r, s, OVR_INICIAL + bonusCarreira('ouro'));
    assert.equal(calcOvr(a, r), 57); // 53 + 4 (Ouro: 54 Ferro, 55 Bronze, 56 Prata, 57 Ouro)
    vistos.add(JSON.stringify(a));
  }
  assert.ok(vistos.size > 100); // atributos mudam a cada sorteio
});

test('carreira: teto de OVR igual para todos (75–100), não sorteado, sobe com a carreira e fica difícil depois do 96', async () => {
  const { createPlayer, capRange, updateCap, fatorTeto, rollAttrs, OVR_INICIAL } = await import('../jogos/carreira-no-rift/js/engine/player.js');
  const { capGain } = await import('../jogos/carreira-no-rift/js/engine/career.js');
  const { bonusCarreira } = await import('../shared/ranked.js');
  // Mesma faixa para todos os elos: o bônus de elo só muda o OVR inicial.
  assert.deepEqual(capRange(), { min: 75, max: 100 });
  const novo = (bonus) => createPlayer({ nick: 'a', nat: 'BR', region: 'br', role: 'mid', style: 'agressivo', attrs: rollAttrs('mid', 'agressivo', OVR_INICIAL + bonus), bonus });
  const tetos = new Set();
  for (const elo of [null, 'ferro', 'bronze', 'ouro', 'desafiante']) {
    const p = novo(bonusCarreira(elo));
    tetos.add(`${p.potential}/${p.capMin}/${p.capMax}`);
  }
  assert.deepEqual([...tetos], ['75/75/100']);
  assert.equal(OVR_INICIAL, 53);
  // Sobe com o progresso, até 100, e perde com resultados ruins, nunca abaixo de 75.
  const p = novo(0);
  updateCap(p, 5);
  assert.equal(p.potential, 80);
  updateCap(p, -100);
  assert.equal(p.potential, 75);
  updateCap(p, 5000);
  assert.equal(p.potential, 100); // nunca passa de 100
  // Depois do 96 cada ponto de progresso rende bem menos (mas o 100 é possível).
  assert.equal(fatorTeto(80), 1);
  assert.ok(fatorTeto(96) < fatorTeto(90) && fatorTeto(98) <= fatorTeto(96) && fatorTeto(100) > 0);
  const q = novo(0);
  updateCap(q, 21); // 75 + 21 chegaria a 96
  const antes = q.potential;
  updateCap(q, 4);
  assert.ok(q.potential - antes < 2, `subiu ${q.potential - antes}`);
  // Carreira criada com a faixa antiga (por elo) passa para a faixa única.
  const velha = { potential: 79, capMin: 77, capMax: 98, capProgress: 2 };
  updateCap(velha, 0);
  assert.deepEqual([velha.capMin, velha.capMax, velha.potential], [75, 100, 79]);
  // Saves antigos (potencial sorteado, sem faixa) não mudam.
  const antigo = { potential: 88 };
  assert.equal(updateCap(antigo, 10), 0);
  assert.equal(antigo.potential, 88);
  // O que o jogador faz decide o ganho de teto: título e MVP ajudam, decisões erradas e temporada fraca pesam.
  const base = { age: 20, titles: [], awards: [], decisionScore: 0 };
  const ctx = { level: null, winRate: 0.5, playedRatio: 0.6 };
  assert.ok(Math.abs(capGain(base, p, ctx)) < 0.01);
  const campea = { ...base, titles: [{ kind: 'intl', name: 'Mundial' }, { kind: 'league', tier: 1 }], awards: [{ name: 'MVP da Final do Mundial' }] };
  assert.ok(capGain(campea, p, ctx) > capGain({ ...base, titles: [{ kind: 'league', tier: 1 }] }, p, ctx));
  assert.ok(capGain({ ...base, decisionScore: -1.5 }, p, ctx) < 0);
  assert.ok(capGain({ ...base, decisionScore: 1.5 }, p, ctx) > 0);
  assert.equal(capGain({ ...campea, age: 27 }, p, ctx), 0); // depois dos 26 não muda
  // Sem "limitador por elo": o ganho de teto é o mesmo para qualquer elo.
  assert.equal(capGain(campea, novo(10), ctx), capGain(campea, novo(0), ctx));
});
