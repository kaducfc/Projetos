import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBJETIVOS, RODADAS, TEMPO_MAX, DANOS_SMITE, CAMPEOES, ROTAS, POR_ROTA, JANELAS,
  aleatorio, pontosDaMargem, classificar, criarRodada, proximoObjetivo, vidaEm, resolverSmite,
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

test('smite: constantes (dano de 900 existe, 5 rodadas, janelas que encurtam) e os 4 objetivos', () => {
  assert.ok(DANOS_SMITE.includes(900));
  assert.equal(RODADAS, 5);
  assert.equal(JANELAS.length, RODADAS);
  assert.ok(JANELAS.every((j, i) => i === 0 || j < JANELAS[i - 1])); // cada rodada dá menos tempo
  assert.ok(CAMPEOES.every((c) => c.id && c.nome && c.hab && c.dano > 0));
  assert.deepEqual(OBJETIVOS.map((o) => o.id), ['dragao-elemental', 'dragao-anciao', 'barao', 'arauto']);
  assert.deepEqual(OBJETIVOS.map((o) => o.nome), ['Dragão Elemental', 'Dragão Ancião', 'Barão Nashor', 'Arauto do Vale']);
  for (const o of OBJETIVOS) { assert.ok(o.vida >= 5000 && o.vida <= 15000); assert.ok(o.arte.startsWith('img/')); assert.ok(o.tema); }
  assert.deepEqual(ROTAS, ['topo', 'selva', 'meio', 'atirador']);
  for (const r of ROTAS) assert.ok(POR_ROTA[r].length >= 8);
});

test('smite: os arquivos de arte dos objetivos existem', async () => {
  const { existsSync } = await import('node:fs');
  for (const o of OBJETIVOS) assert.ok(existsSync(new URL(`../jogos/smite/${o.arte}`, import.meta.url)), o.arte);
});

test('smite: cada rodada tem 4 aliados (o jogador é o selva) e 4 adversários, 1 por rota, sem campeão repetido', () => {
  for (let semente = 1; semente <= 60; semente++) {
    const r = criarRodada(aleatorio(semente * 13), semente % RODADAS);
    assert.equal(r.participantes.length, 8);
    for (const lado of ['azul', 'vermelho']) {
      const time = r.participantes.filter((p) => p.lado === lado);
      assert.equal(time.length, 4);
      assert.deepEqual(time.map((p) => p.rota), ROTAS);
    }
    const voce = r.participantes.find((p) => p.id === 'voce');
    assert.equal(voce.lado, 'azul');
    assert.equal(voce.rota, 'selva');
    assert.equal(voce.champ, r.campeao.id);
    const champs = r.participantes.map((p) => p.champ);
    assert.equal(new Set(champs).size, 8, 'sem campeão repetido');
    // O jogador não bate sozinho: só a habilidade e o Smite machucam por ele.
    assert.ok(!r.golpes.some((g) => g.quem === 'voce'));
    const quem = new Set(r.golpes.map((g) => g.quem));
    assert.ok(quem.has('e-selva') || r.golpes.length > 0);
    assert.ok(['a-topo', 'a-meio', 'a-atirador', 'e-topo', 'e-selva', 'e-meio', 'e-atirador'].every((id) => quem.has(id)), 'todos batem');
  }
});

test('smite: o objetivo muda entre as rodadas (e a vida é a do objetivo sorteado)', () => {
  const rand = aleatorio(5);
  let ant = null; const vistos = new Set();
  for (let i = 0; i < 40; i++) {
    const o = proximoObjetivo(rand, ant);
    assert.notEqual(o.id, ant);
    vistos.add(o.id); ant = o.id;
  }
  assert.equal(vistos.size, 4);
  for (const o of OBJETIVOS) {
    const r = criarRodada(aleatorio(9), 0, o);
    assert.equal(r.objetivo.id, o.id);
    assert.equal(r.vidaMax, o.vida);
    assert.equal(vidaEm(r, 0), o.vida);
    assert.equal(r.golpes[0].vida < o.vida, true);
  }
});

test('smite: toda rodada gerada é jogável (vida cai até zero, passa pelo dano do Smite e há janela)', () => {
  for (let n = 0; n < RODADAS; n++) {
    for (let semente = 1; semente <= 40; semente++) {
      const r = criarRodada(aleatorio(semente * 97 + n), n);
      assert.ok(r.golpes.length > 10, 'golpes de sobra');
      assert.equal(r.golpes[r.golpes.length - 1].vida, 0, 'o objetivo morre');
      assert.ok(r.quemMata, 'alguém dá o golpe final');
      assert.ok(r.morreEm < TEMPO_MAX, `morre a tempo (${r.morreEm})`);
      for (let i = 1; i < r.golpes.length; i++) {
        assert.ok(r.golpes[i].vida < r.golpes[i - 1].vida);
        assert.ok(r.golpes[i].t >= r.golpes[i - 1].t);
      }
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
  assert.equal(vidaEm(r, 0), r.vidaMax);
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

test('smite: todo texto do jogo (t(...), nome, descrição, título) está traduzido nos 5 idiomas', async () => {
  const { readFileSync } = await import('node:fs');
  const { __usarDicionario, traduzirTexto, t, LANGS } = await import('../shared/i18n.js');
  const fonte = readFileSync(new URL('../jogos/smite/js/main.js', import.meta.url), 'utf8');
  const textos = new Set([...fonte.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));
  const { GAMES } = await import('../shared/config.js');
  const jogo = GAMES.find((g) => g.id === 'smite');
  textos.add(jogo.name); textos.add(jogo.tagline);
  for (const o of OBJETIVOS) textos.add(o.nome);
  textos.add('Desafio do Golpear · Rift Arcade'); // <title>
  for (const r of ['Topo', 'Selva', 'Meio', 'Atirador', 'Aliado', 'Adversário', 'Você', 'Habilidade', 'Golpear']) textos.add(r);
  for (const c of ['Perfeito!', 'Ótimo!', 'Bom', 'Passou longe']) textos.add(c);
  assert.ok(textos.size > 50);
  const ids = LANGS.map((l) => l.id).filter((id) => id !== 'pt-BR');
  assert.equal(ids.length, 5);
  for (const id of ids) {
    __usarDicionario((await import(`../shared/i18n/${id}.js`)).default, id);
    const faltam = [...textos].filter((x) => /[A-Za-zÀ-ú]{3}/.test(x) && traduzirTexto(x) == null);
    assert.deepEqual(faltam, [], `${id}: sem tradução`);
  }
  // nomes do jogo por idioma
  const nome = { en: 'Smite Challenge', de: 'Zerschmettern-Challenge', es: 'Desafío de Aplastar', it: 'Sfida della Punizione', fr: 'Défi du Châtiment' };
  for (const [id, esperado] of Object.entries(nome)) {
    __usarDicionario((await import(`../shared/i18n/${id}.js`)).default, id);
    assert.equal(t('Desafio do Golpear'), esperado);
  }
  // os valores dentro do texto são substituídos
  __usarDicionario((await import('../shared/i18n/en.js')).default, 'en');
  assert.equal(t('Rodada {n} de {total}', { n: 2, total: 5 }), 'Round 2 of 5');
  assert.match(t('Golpeie o {obj} com o Golpear no momento certo!', { obj: t('Barão Nashor') }), /Smite Baron Nashor/);
  // e as chaves {x} de todas as traduções batem com as do original
  for (const id of ids) {
    const d = (await import(`../shared/i18n/${id}.js`)).default;
    __usarDicionario(d, id);
    for (const x of textos) {
      const vars = (x.match(/\{\w+\}/g) || []).sort().join();
      const trad = traduzirTexto(x);
      if (trad != null) assert.equal((trad.match(/\{\w+\}/g) || []).sort().join(), vars, `${id}: ${x}`);
    }
  }
});
