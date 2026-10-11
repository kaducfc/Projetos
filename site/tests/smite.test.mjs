import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBJETIVOS, RODADAS, TEMPO_MAX, DANOS_SMITE, CAMPEOES, ROTAS, POR_ROTA, JANELAS, danoDoSmite, NIVEL_MIN, NIVEL_MAX,
  novoEstado, avancar, usarHabilidade, usarGolpear, PONTOS_TIME, PROB_SMITE_INIMIGO, FAIXA_ACIMA, FAIXA_ABAIXO,
  aleatorio, pontosDaMargem, classificar, criarRodada, proximoObjetivo, vidaEm, resolverSmite,
} from '../jogos/smite/js/logic.js';

test('smite: dano do Golpear em 3 níveis (até o 8 → 600; 9 a 12 → 900; 13 em diante → 1200)', () => {
  for (let n = 1; n <= 8; n++) assert.equal(danoDoSmite(n), 600, `nível ${n}`);
  for (let n = 9; n <= 12; n++) assert.equal(danoDoSmite(n), 900, `nível ${n}`);
  for (let n = 13; n <= 18; n++) assert.equal(danoDoSmite(n), 1200, `nível ${n}`);
  assert.deepEqual(DANOS_SMITE, [600, 900, 1200]);
});

test('smite: o nível da rodada vem da faixa do objetivo e os outros jogadores ficam perto dele', () => {
  const vistos = {};
  for (const o of OBJETIVOS) {
    assert.ok(o.niveis[0] >= NIVEL_MIN && o.niveis[1] <= NIVEL_MAX && o.niveis[0] <= o.niveis[1]);
    vistos[o.id] = new Set();
    for (let semente = 1; semente <= 200; semente++) {
      const r = criarRodada(aleatorio(semente * 7), 0, o);
      assert.ok(r.nivel >= o.niveis[0] && r.nivel <= o.niveis[1], `${o.id}: nível ${r.nivel}`);
      vistos[o.id].add(r.smite);
      for (const p of r.participantes) {
        assert.ok(Math.abs(p.nivel - r.nivel) <= 1 && p.nivel >= NIVEL_MIN && p.nivel <= NIVEL_MAX);
      }
      assert.equal(r.participantes.find((p) => p.id === 'voce').nivel, r.nivel);
    }
  }
  assert.deepEqual([...vistos.arauto].sort(), [600, 900]); // o Arauto vem cedo
  assert.deepEqual([...vistos['dragao-anciao']], [1200]); // o Ancião vem tarde
  assert.ok(vistos['dragao-elemental'].size === 3); // o Dragão Elemental pega os três
  assert.ok(vistos.barao.has(1200));
});

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
      assert.ok([600, 900, 1200].includes(r.smite));
      assert.equal(r.smite, danoDoSmite(r.nivel));
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

// ---- A rodada continua depois de errar o Golpear; o selva inimigo também pode golpear.

// Joga uma rodada inteira em passos de 20 ms. `agir(est, t)` pode usar o Golpear e a habilidade.
function jogar(rodada, agir = null) {
  const est = novoEstado(rodada);
  for (let t = 0; t <= TEMPO_MAX + 1 && !est.fim; t += 0.02) {
    avancar(est, t);
    if (!est.fim && agir) agir(est, t);
  }
  return est;
}

test('smite: sem fazer nada, quem dá o último golpe decide (aliado = 25 pontos, inimigo = 0)', () => {
  const cont = { time: 0, roubado: 0 };
  for (let semente = 1; semente <= 300; semente++) {
    const r = criarRodada(aleatorio(semente * 11), semente % RODADAS);
    const est = jogar(r);
    assert.ok(est.fim, 'a rodada termina');
    assert.ok(['time', 'roubado'].includes(est.fim.resultado));
    assert.equal(est.fim.pontos, est.fim.resultado === 'time' ? PONTOS_TIME : 0);
    assert.equal(est.fim.margem, null);
    cont[est.fim.resultado]++;
  }
  assert.ok(cont.time > 30 && cont.roubado > 30, `os dois acontecem (${JSON.stringify(cont)})`);
});

test('smite: errar o Golpear (vida acima do dano) não encerra: bate no objetivo e a rodada segue até ele morrer', () => {
  let testadas = 0;
  for (let semente = 1; semente <= 200; semente++) {
    const r = criarRodada(aleatorio(semente * 5), 0);
    let usou = null;
    const est = jogar(r, (e, t) => {
      if (usou || t < 5) return;
      const vidaAntes = e.vida;
      const ev = usarGolpear(e);
      usou = { vidaAntes, ev };
      assert.equal(e.fim, null, 'não encerra');
    });
    assert.ok(usou && usou.vidaAntes > r.smite, 'golpeou cedo');
    assert.equal(usou.ev[0].tipo, 'golpear-cedo');
    assert.equal(est.smiteFalhou.vida, usou.vidaAntes);
    assert.equal(est.smiteFalhou.faltou, usou.vidaAntes - r.smite);
    assert.ok(est.fim, 'a rodada acaba quando o objetivo morre');
    assert.ok(['time', 'roubado'].includes(est.fim.resultado));
    assert.ok(est.fim.pontos === 0 || est.fim.pontos === PONTOS_TIME);
    testadas++;
  }
  assert.equal(testadas, 200);
  // só dá para usar o Golpear uma vez
  const e = novoEstado(criarRodada(aleatorio(1), 0));
  avancar(e, 3);
  assert.equal(usarGolpear(e)[0].tipo, 'golpear-cedo');
  assert.deepEqual(usarGolpear(e), []);
});

test('smite: Golpear com a vida ≤ dano do Smite garante o objetivo (margem exata) e encerra', () => {
  for (let semente = 1; semente <= 100; semente++) {
    const r = criarRodada(aleatorio(semente * 3), 2);
    const est = novoEstado(r);
    // anda até a vida passar a ficar ≤ dano do Smite, sem o inimigo ter golpeado antes
    let t = 0;
    while (!est.fim && est.vida > r.smite && t < TEMPO_MAX) avancar(est, t += 0.02);
    if (est.fim) continue; // o inimigo golpeou primeiro
    const vida = est.vida;
    const ev = usarGolpear(est);
    assert.equal(ev[0].tipo, 'golpear');
    assert.equal(est.fim.resultado, 'garantido');
    assert.equal(est.fim.margem, r.smite - vida);
    assert.equal(est.fim.pontos, pontosDaMargem(r.smite - vida));
    assert.equal(est.vida, 0);
  }
});

test('smite: a habilidade que derruba o objetivo dá o objetivo ao seu time (25 pontos)', () => {
  const r = criarRodada(aleatorio(9), 1);
  const est = novoEstado(r);
  est.vida = r.campeao.dano - 1; // quase morto
  const ev = usarHabilidade(est);
  assert.equal(ev[0].tipo, 'habilidade');
  assert.equal(est.fim.resultado, 'time');
  assert.equal(est.fim.pontos, PONTOS_TIME);
  assert.equal(est.fim.via, 'habilidade');
  // sem matar, só tira vida
  const e2 = novoEstado(r);
  usarHabilidade(e2);
  assert.equal(e2.vida, r.vidaMax - r.campeao.dano);
  assert.equal(e2.fim, null);
});

test('smite: o selva inimigo golpeia com o mesmo dano, só na faixa (5% acima a 30% abaixo) e quase sempre perto do fim dela', () => {
  let usam = 0; let total = 0; let metadeBaixa = 0;
  for (let semente = 1; semente <= 2000; semente++) {
    const r = criarRodada(aleatorio(semente * 17), semente % RODADAS);
    total++;
    if (r.gatilhoInimigo == null) continue;
    usam++;
    assert.ok(r.gatilhoInimigo >= Math.round(r.smite * (1 - FAIXA_ABAIXO)) - 1 && r.gatilhoInimigo <= Math.round(r.smite * (1 + FAIXA_ACIMA)) + 1);
    assert.equal(r.faixaMin, Math.round(r.smite * 0.7));
    assert.equal(r.faixaMax, Math.round(r.smite * 1.05));
    const meio = r.smite * (1 + FAIXA_ACIMA - (FAIXA_ACIMA + FAIXA_ABAIXO) / 2);
    if (r.gatilhoInimigo < meio) metadeBaixa++;
  }
  assert.ok(Math.abs(usam / total - PROB_SMITE_INIMIGO) < 0.04, `usa em ${(usam / total).toFixed(2)} das rodadas`);
  assert.ok(metadeBaixa / usam > 0.7, `mais chance na metade de baixo da faixa (${(metadeBaixa / usam).toFixed(2)})`);
});

test('smite: quando o selva inimigo golpeia, tira o dano do Smite; com a vida ≤ dano, ele leva o objetivo (0 pontos)', () => {
  let mataram = 0; let naoMataram = 0;
  for (let semente = 1; semente <= 600; semente++) {
    const r = criarRodada(aleatorio(semente * 23), semente % RODADAS);
    if (r.gatilhoInimigo == null) continue;
    const est = novoEstado(r);
    let ev = [];
    for (let t = 0; t <= TEMPO_MAX && !est.fim; t += 0.02) {
      const e = avancar(est, t);
      const s = e.find((x) => x.tipo === 'smite-inimigo');
      if (s) { ev = s; break; }
    }
    if (!ev.tipo) continue; // a vida passou direto pela faixa
    assert.equal(ev.dano, r.smite);
    assert.equal(ev.quem, 'e-selva');
    assert.ok(ev.antes >= r.faixaMin && ev.antes <= r.gatilhoInimigo, 'golpeou dentro da faixa');
    assert.equal(ev.depois, Math.max(0, ev.antes - r.smite));
    if (ev.antes <= r.smite) {
      assert.equal(est.fim.resultado, 'roubado'); assert.equal(est.fim.via, 'smite-inimigo'); assert.equal(est.fim.pontos, 0);
      mataram++;
    } else { assert.ok(ev.depois > 0); naoMataram++; }
  }
  assert.ok(mataram > 100, `mataram ${mataram}`);
  assert.ok(naoMataram >= 0);
});

test('smite: o inimigo só golpeia uma vez, e não golpeia se a vida passou da faixa sem ele ver', () => {
  const r = { ...criarRodada(aleatorio(4), 0) };
  const est = novoEstado({ ...r, gatilhoInimigo: Math.round(r.smite * 0.9) });
  est.vida = r.smite * 2; // longe da faixa
  est.vida = r.faixaMin - 10 + r.campeao.dano; // a habilidade deixa a vida abaixo da faixa (70% do dano)
  const ev = usarHabilidade(est);
  assert.equal(ev.some((x) => x.tipo === 'smite-inimigo'), false);
  assert.equal(est.inimigoUsou, true);
  assert.equal(est.fim, null);
  // dentro da faixa: golpeia uma única vez
  const est2 = novoEstado({ ...r, gatilhoInimigo: Math.round(r.smite * 0.9) });
  est2.vida = Math.round(r.smite * 0.9) - 5 + r.campeao.dano; // depois da habilidade: dentro da faixa
  const ev2 = usarHabilidade(est2);
  assert.equal(ev2.filter((x) => x.tipo === 'smite-inimigo').length, 1);
  assert.equal(est2.fim.resultado, 'roubado');
  assert.deepEqual(usarHabilidade(est2), []); // já terminou
});

test('smite: pontos nunca passam de 100 por rodada, e errar o Golpear com o time ganhando dá 25 (não mais)', () => {
  for (let semente = 1; semente <= 100; semente++) {
    const r = criarRodada(aleatorio(semente * 41), 3);
    const est = jogar(r, (e, t) => { if (t > 6 && !e.smiteUsado) usarGolpear(e); });
    assert.ok(est.fim.pontos <= 100);
    if (est.fim.resultado === 'time') assert.equal(est.fim.pontos, 25);
    if (est.fim.resultado === 'roubado') assert.equal(est.fim.pontos, 0);
  }
});
