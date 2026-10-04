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

test('carreira: a partir de 93 fica difícil subir (perder continua igual)', () => {
  assert.equal(fatorGanho(92.9), 1);
  assert.ok(fatorGanho(93) < 0.5 && fatorGanho(97) < fatorGanho(93));
  assert.equal(fatorGanho(100), 0);
  // Abaixo de 93: sempre entra tudo.
  for (let i = 0; i < 100; i++) assert.equal(ganharPontos(85, 3), 88);
  // Acima: em média entra bem menos de 1 ponto a cada 3 tentados no 96.
  let soma = 0;
  for (let i = 0; i < 4000; i++) soma += ganharPontos(96, 3) - 96;
  assert.ok(soma / 4000 < 0.4, `média ${soma / 4000}`);
  // Ganho contínuo: 10 pontos a partir de 90 não chegam nem perto de 100.
  assert.ok(ganharContinuo(90, 10) < 96);
  const p = jogador({ mec: 96 });
  applyFx(p, { mec: -4 }, { garantia: 'mudanca' });
  assert.equal(p.attrs.mec, 92);
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
