import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBJETIVO, RODADAS, TEMPO_MAX, DANOS_SMITE, CAMPEOES, PARTICIPANTES, JANELAS,
  aleatorio, pontosDaMargem, classificar, criarRodada, vidaEm, resolverSmite,
} from '../jogos/smite/js/logic.js';

test('smite: pontos pela margem (0 = 100; 600 ou mais = 0; sem sobra negativa)', () => {
  assert.equal(pontosDaMargem(0), 100);
  assert.equal(pontosDaMargem(30), 90);
  assert.equal(pontosDaMargem(60), 81);
  assert.equal(pontosDaMargem(150), 56);
  assert.equal(pontosDaMargem(300), 25);
  assert.equal(pontosDaMargem(600), 0);
  assert.equal(pontosDaMargem(900), 0);
  assert.equal(pontosDaMargem(-1), 0);
  let ant = 101;
  for (let m = 0; m <= 700; m += 10) { const p = pontosDaMargem(m); assert.ok(p <= ant); ant = p; }
});

test('smite: classificação da margem', () => {
  assert.equal(classificar(0).id, 'perfeito');
  assert.equal(classificar(25).id, 'perfeito');
  assert.equal(classificar(60).id, 'otimo');
  assert.equal(classificar(200).id, 'bom');
  assert.equal(classificar(400).id, 'longe');
});

test('smite: resolver o golpe (cedo, roubado ou garantido)', () => {
  assert.equal(resolverSmite(0, 900).resultado, 'roubado');
  const cedo = resolverSmite(1000, 900);
  assert.equal(cedo.resultado, 'cedo');
  assert.equal(cedo.faltou, 100);
  assert.equal(cedo.pontos, 0);
  const ok = resolverSmite(895, 900);
  assert.equal(ok.resultado, 'garantido');
  assert.equal(ok.margem, 5);
  assert.ok(ok.pontos >= 98);
  assert.equal(resolverSmite(900, 900).margem, 0); // exatamente igual ainda mata
});

test('smite: constantes batem com o esboço (9000 de vida, dano de 900 existe, 5 rodadas)', () => {
  assert.equal(OBJETIVO.vida, 9000);
  assert.ok(DANOS_SMITE.includes(900));
  assert.equal(RODADAS, 5);
  assert.equal(JANELAS.length, RODADAS);
  assert.ok(JANELAS.every((j, i) => i === 0 || j < JANELAS[i - 1])); // cada rodada dá menos tempo
  assert.equal(PARTICIPANTES.length, 5);
  assert.ok(CAMPEOES.every((c) => c.id && c.nome && c.hab && c.dano > 0));
});

test('smite: toda rodada gerada é jogável (vida cai até zero, passa pelo dano do Smite e há janela)', () => {
  for (let n = 0; n < RODADAS; n++) {
    for (let semente = 1; semente <= 40; semente++) {
      const r = criarRodada(aleatorio(semente * 97 + n), n);
      assert.ok(r.golpes.length > 10, 'golpes de sobra');
      assert.equal(r.golpes[r.golpes.length - 1].vida, 0, 'o objetivo morre');
      assert.ok(r.morreEm < TEMPO_MAX, `morre a tempo (${r.morreEm})`);
      // vida só desce, tempo só sobe
      for (let i = 1; i < r.golpes.length; i++) {
        assert.ok(r.golpes[i].vida < r.golpes[i - 1].vida);
        assert.ok(r.golpes[i].t >= r.golpes[i - 1].t);
      }
      // Existe um intervalo de tempo com vida ≤ dano do Smite e > 0 (a janela de jogo).
      const dentro = r.golpes.filter((g) => g.vida > 0 && g.vida <= r.smite);
      assert.ok(dentro.length >= 1, 'há golpes dentro da janela');
      const t0 = dentro[0].t; const t1 = r.morreEm;
      assert.ok(t1 - t0 > 0.5, `janela de ${(t1 - t0).toFixed(2)}s`);
      assert.ok(t1 - t0 < 8, 'janela não é longa demais');
      assert.ok(r.smite >= 700 && r.smite <= 1200);
    }
  }
});

test('smite: mesma semente, mesma rodada; sementes diferentes, rodadas diferentes', () => {
  const a = criarRodada(aleatorio(7), 2);
  const b = criarRodada(aleatorio(7), 2);
  const c = criarRodada(aleatorio(8), 2);
  assert.deepEqual(a.golpes, b.golpes);
  assert.notDeepEqual(a.golpes.slice(0, 5), c.golpes.slice(0, 5));
});

test('smite: vidaEm acompanha os golpes e desconta a habilidade do jogador', () => {
  const r = criarRodada(aleatorio(3), 0);
  assert.equal(vidaEm(r, 0), OBJETIVO.vida);
  assert.equal(vidaEm(r, r.morreEm + 1), 0);
  const meio = r.golpes[Math.floor(r.golpes.length / 2)];
  assert.equal(vidaEm(r, meio.t), meio.vida);
  assert.equal(vidaEm(r, meio.t, 300), Math.max(0, meio.vida - 300));
  assert.equal(vidaEm(r, meio.t, 1e9), 0);
});

test('smite: rodadas mais para a frente têm janela média menor', () => {
  const media = (n) => {
    let s = 0;
    for (let i = 1; i <= 60; i++) {
      const r = criarRodada(aleatorio(i * 31), n);
      const t0 = r.golpes.find((g) => g.vida > 0 && g.vida <= r.smite).t;
      s += r.morreEm - t0;
    }
    return s / 60;
  };
  assert.ok(media(4) < media(0));
});
