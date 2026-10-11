import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBJETIVOS, RODADAS, TEMPO_MAX, DANOS_SMITE, CAMPEOES, ROTAS, POR_ROTA, JANELAS, danoDoSmite, NIVEL_MIN, NIVEL_MAX,
  TEMPO_MINIMO, REACAO_INIMIGO, novoEstado, avancar, usarHabilidade, soltarHabilidade, estadoQ, postoHab, usarGolpear, criarPartida, nivelNoTempo, NIVEL_POR_MINUTO, DANO_3S, RITMO, PONTOS_TIME, PONTOS_HABILIDADE, PROB_SMITE_INIMIGO,
  aleatorio, pontosDoTempo, classificar, criarRodada, proximoObjetivo, vidaEm, resolverSmite,
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
  assert.ok([...vistos.arauto].every((d) => d >= 900)); // o Arauto só nasce aos 15 min: já é nível 10 ou mais
  assert.deepEqual([...vistos['dragao-anciao']], [1200]); // o Ancião vem tarde
  assert.ok(vistos['dragao-elemental'].size === 3); // o Dragão Elemental pega os três
  assert.ok(vistos.barao.has(1200));
});

test('smite: pontos pelo tempo desde que a vida entrou na zona do Smite (rápido = mais)', () => {
  assert.equal(pontosDoTempo(0), 100);
  assert.equal(pontosDoTempo(0.05), 95);
  assert.equal(pontosDoTempo(0.1), 90);
  assert.equal(pontosDoTempo(0.8), 57); // meio do caminho entre 0,1 e 1,5 s (57,5 arredondado)
  assert.equal(pontosDoTempo(1.5), 25);
  assert.equal(pontosDoTempo(2), 25);
  assert.equal(pontosDoTempo(9), 25);
  assert.equal(pontosDoTempo(-1), 0);
  let ant = 101;
  for (let x = 0; x <= 4; x += 0.01) { const p = pontosDoTempo(x); assert.ok(p <= ant); assert.ok(p >= 25); ant = p; }
});

test('smite: classificação do tempo', () => {
  assert.equal(classificar(0).id, 'perfeito');
  assert.equal(classificar(0.1).id, 'perfeito');
  assert.equal(classificar(0.4).id, 'otimo');
  assert.equal(classificar(0.8).id, 'bom');
  assert.equal(classificar(1.2).id, 'longe');
});

test('smite: resolver o golpe (cedo, roubado ou garantido)', () => {
  assert.equal(resolverSmite(0, 900).resultado, 'roubado');
  const cedo = resolverSmite(1000, 900);
  assert.equal(cedo.resultado, 'cedo');
  assert.equal(cedo.faltou, 100);
  assert.equal(cedo.pontos, 0);
  const ok = resolverSmite(895, 900);
  assert.equal(ok.resultado, 'garantido');
  assert.equal(ok.margem, 5); assert.equal(ok.pontos, 100);
  assert.ok(ok.pontos >= 98);
  assert.equal(resolverSmite(900, 900).margem, 0); // exatamente igual ainda mata
});

test('smite: constantes (dano de 900 existe, 5 rodadas, janelas que encurtam) e os 4 objetivos', () => {
  assert.ok(DANOS_SMITE.includes(900));
  assert.equal(RODADAS, 5);
  assert.equal(JANELAS.length, RODADAS);
  assert.ok(JANELAS.every((j, i) => i === 0 || j < JANELAS[i - 1])); // cada rodada dá menos tempo
  assert.ok(CAMPEOES.every((c) => c.id && c.nome && c.hab && c.dano.every((d) => d > 0) && c.recarga.length === 5));
  assert.deepEqual(CAMPEOES.map((c) => c.id), ['LeeSin', 'Nunu', 'Khazix', 'Pantheon', 'MonkeyKing']);
  assert.deepEqual(OBJETIVOS.map((o) => o.id), ['dragao-elemental', 'dragao-anciao', 'barao', 'arauto']);
  assert.deepEqual(OBJETIVOS.map((o) => o.nome), ['Dragão Elemental', 'Dragão Ancião', 'Barão Nashor', 'Arauto do Vale']);
  for (const o of OBJETIVOS) { assert.ok(o.vida >= 5000 && o.vida <= 15000); assert.ok(o.arte.startsWith('img/')); assert.ok(o.tema); }
  assert.deepEqual(ROTAS, ['topo', 'selva', 'meio', 'atirador']);
  for (const r of ROTAS) assert.ok(POR_ROTA[r].length >= 8);
});

test('smite: os arquivos de arte dos objetivos existem', async () => {
  const { existsSync } = await import('node:fs');
  for (const o of OBJETIVOS) {
    assert.ok(existsSync(new URL(`../jogos/smite/${o.arte}`, import.meta.url)), o.arte);
    assert.ok(existsSync(new URL(`../jogos/smite/${o.cenario}`, import.meta.url)), o.cenario);
  }
  // dragões no covil verde-água; Barão e Arauto no covil roxo
  assert.deepEqual(OBJETIVOS.map((o) => o.cenario), ['img/cenario.webp', 'img/cenario.webp', 'img/cenario-barao.webp', 'img/cenario-barao.webp']);
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
    const quem = new Set(r.golpes.map((g) => g.quem));
    assert.ok(quem.has('e-selva') || r.golpes.length > 0);
    assert.ok(['voce', 'a-topo', 'a-meio', 'a-atirador', 'e-topo', 'e-selva', 'e-meio', 'e-atirador'].every((id) => quem.has(id)), 'todos batem');
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
  assert.ok(cont.time > 5 && cont.roubado > 100, `os dois acontecem (${JSON.stringify(cont)})`);
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
    const ev = usarGolpear(est, t + 0.5);
    assert.equal(ev[0].tipo, 'golpear');
    assert.equal(est.fim.resultado, 'garantido');
    assert.equal(est.fim.margem, r.smite - vida);
    assert.ok(Math.abs(est.fim.tempo - (t + 0.5 - est.tZona)) < 1e-9 && est.fim.tempo >= 0.5 - 1e-9);
    assert.equal(est.fim.pontos, Math.max(PONTOS_TIME, pontosDoTempo(est.fim.tempo)));
    assert.equal(est.vida, 0);
  }
});

// Para os testes de pontos: o Kha'Zix (um toque, dano fixo por posto).
const dq = (r) => { r.campeao = CAMPEOES.find((c) => c.id === 'Khazix'); return r.campeao.dano[postoHab(r.nivel)]; };

test('smite: a habilidade que finaliza o objetivo dá o objetivo ao seu time (50 pontos, mais que o aliado)', () => {
  assert.equal(PONTOS_HABILIDADE, 50);
  assert.ok(PONTOS_HABILIDADE > PONTOS_TIME);
  const r = criarRodada(aleatorio(9), 1);
  const D = dq(r);
  const est = novoEstado(r);
  est.vida = D - 1; // quase morto
  const ev = usarHabilidade(est, 1);
  assert.equal(ev[0].tipo, 'habilidade');
  assert.equal(est.fim.resultado, 'time');
  assert.equal(est.fim.pontos, 50);
  assert.equal(est.fim.via, 'habilidade');
  // sem matar, só tira vida
  const e2 = novoEstado(r);
  usarHabilidade(e2, 1);
  assert.equal(e2.vida, r.vidaMax - D);
  assert.equal(e2.fim, null);
});

test('smite: o selva inimigo tem o feitiço em 80% das rodadas e reage entre 0,2 e 0,5 s depois de a vida entrar na zona', () => {
  let usam = 0; let total = 0; let baixa = 0;
  for (let semente = 1; semente <= 2000; semente++) {
    const r = criarRodada(aleatorio(semente * 17), semente % RODADAS);
    total++;
    assert.ok(r.reacaoInimigo >= REACAO_INIMIGO[0] && r.reacaoInimigo <= REACAO_INIMIGO[1], `reação ${r.reacaoInimigo}`);
    if (r.reacaoInimigo < 0.35) baixa++;
    if (r.gatilhoInimigo != null) usam++;
  }
  assert.deepEqual(REACAO_INIMIGO, [0.2, 0.5]);
  assert.ok(Math.abs(usam / total - PROB_SMITE_INIMIGO) < 0.04, `usa em ${(usam / total).toFixed(2)} das rodadas`);
  assert.ok(Math.abs(baixa / total - 0.5) < 0.06, 'a reação se espalha por toda a janela');
});

test('smite: quando o selva inimigo golpeia, tira o dano do Smite no instante tZona + reação; com a vida ≤ dano, ele leva o objetivo (0 pontos)', () => {
  let mataram = 0;
  for (let semente = 1; semente <= 600; semente++) {
    const r = criarRodada(aleatorio(semente * 23), semente % RODADAS);
    if (r.gatilhoInimigo == null) continue;
    const est = novoEstado(r);
    let ev = null; let quando = 0;
    for (let t = 0; t <= TEMPO_MAX && !est.fim; t += 0.02) {
      const e = avancar(est, t);
      const x = e.find((y) => y.tipo === 'smite-inimigo');
      if (x) { ev = x; quando = t; break; }
    }
    if (!ev) continue; // o objetivo morreu por golpes dos outros antes da reação dele
    assert.equal(ev.dano, r.smite);
    assert.equal(ev.quem, 'e-selva');
    assert.ok(quando - est.tZona >= r.reacaoInimigo - 1e-9 && quando - est.tZona <= r.reacaoInimigo + 0.021, `golpeou ${(quando - est.tZona).toFixed(3)} s depois (reação ${r.reacaoInimigo.toFixed(3)})`);
    assert.ok(ev.antes <= r.smite + r.golpes[0].dano * 0 + r.smite, 'sanidade');
    assert.equal(ev.depois, Math.max(0, ev.antes - r.smite));
    if (ev.antes <= r.smite) { assert.equal(est.fim.resultado, 'roubado'); assert.equal(est.fim.via, 'smite-inimigo'); assert.equal(est.fim.pontos, 0); mataram++; }
  }
  assert.ok(mataram > 100, `mataram ${mataram}`);
});

test('smite: o inimigo só golpeia uma vez e só depois de a vida entrar na zona', () => {
  const r = { ...criarRodada(aleatorio(4), 0), golpes: [], reacaoInimigo: 0.3, gatilhoInimigo: 600 };
  const D = dq(r);
  const est = novoEstado(r);
  est.vida = r.smite + D - 20; // a habilidade deixa a vida dentro da zona
  const sm = (ev) => ev.filter((x) => x.tipo === 'smite-inimigo').length;
  const a = usarHabilidade(est, 1);
  assert.equal(sm(a), 0); assert.equal(est.tZona, 1);
  assert.equal(sm(avancar(est, 1.29)), 0);
  assert.equal(sm(avancar(est, 1.31)), 1);
  assert.equal(est.fim.resultado, 'roubado');
  assert.deepEqual(usarHabilidade(est, 1.4), []); // já terminou
  // fora da zona ele não golpeia
  const longe = novoEstado(r); longe.vida = r.smite * 3;
  assert.equal(sm(avancar(longe, 10)), 0); assert.equal(longe.inimigoUsou, false);
});

test('smite: pontos nunca passam de 100 por rodada, e errar o Golpear com o time ganhando dá 25 (não mais)', () => {
  for (let semente = 1; semente <= 100; semente++) {
    const r = criarRodada(aleatorio(semente * 41), 3);
    const est = jogar(r, (e, t) => { if (t > 6 && !e.smiteUsado) usarGolpear(e); });
    assert.ok(est.fim.pontos <= 100);
    if (est.fim.resultado === 'time') assert.equal(est.fim.pontos, est.fim.via === 'habilidade' ? 50 : 25);
    if (est.fim.resultado === 'roubado') assert.equal(est.fim.pontos, 0);
  }
});

// ---- A partida (5 rodadas) é um jogo só: mesmos campeões, do objetivo mais fraco ao mais forte.
test('smite: a partida segue a ordem dos objetivos (1: Dragão entre 6 e 14 min; 2: Arauto; 3: Elemental; 4: Elemental ou Barão; 5: Barão ou Ancião)', () => {
  const ordens = new Set(); const quartos = new Set(); const quintos = new Set();
  for (let semente = 1; semente <= 500; semente++) {
    const par = criarPartida(aleatorio(semente * 13));
    const ids = par.objetivos.map((o) => o.id);
    assert.equal(ids.length, RODADAS);
    assert.deepEqual([ids[0], ids[1]], ['dragao-elemental', 'arauto']);
    assert.ok(par.tempos[0] >= 360 && par.tempos[0] < 840, `primeiro aos ${par.tempos[0]}s`);
    assert.equal(ids[2], 'dragao-elemental');
    assert.ok(['dragao-elemental', 'barao'].includes(ids[3]));
    assert.ok(['barao', 'dragao-anciao'].includes(ids[4]));
    ordens.add(`${ids[0]}>${ids[1]}`); quartos.add(ids[3]); quintos.add(ids[4]);
  }
  assert.equal(ordens.size, 1); assert.equal(quartos.size, 2); assert.equal(quintos.size, 2);
});

test('smite: na partida o nível sobe a cada rodada (e o dano do Golpear com ele) e os campeões são os mesmos', () => {
  for (let semente = 1; semente <= 300; semente++) {
    const par = criarPartida(aleatorio(semente * 29));
    const rodadas = par.objetivos.map((_, n) => criarRodada(aleatorio(semente * 7 + n), n, { partida: par }));
    rodadas.forEach((r, n) => {
      assert.ok(Math.abs(r.nivel - nivelNoTempo(r.tempoInicio)) <= 1, `rodada ${n + 1}: nível ${r.nivel} aos ${r.tempoInicio}s`);
      if (n) { assert.ok(r.nivel >= rodadas[n - 1].nivel, 'o nível nunca cai'); assert.ok(r.smite >= rodadas[n - 1].smite, 'o dano do Golpear nunca cai'); }
      assert.equal(r.objetivo.id, par.objetivos[n].id);
      assert.equal(r.campeao.id, par.campeao.id);
      assert.deepEqual(r.participantes.map((p) => [p.id, p.lado, p.rota, p.champ]), rodadas[0].participantes.map((p) => [p.id, p.lado, p.rota, p.champ]), 'mesmos campeões');
      for (const p of r.participantes) assert.equal(p.nivel, Math.min(18, Math.max(1, r.nivel + p.desloc)));
      assert.equal(r.golpes[r.golpes.length - 1].vida, 0); // continua jogável
    });
    assert.ok(rodadas[0].smite < rodadas[4].smite || rodadas[0].nivel < rodadas[4].nivel); // começa mais fraco que termina
    assert.ok(rodadas[4].smite >= 900); // termina forte
    assert.equal(new Set(rodadas[0].participantes.map((p) => p.champ)).size, 8);
  }
});

test('smite: dano por classe (atirador > meio > selva > topo, na proporção 1000 : 800 : 500 : 200) e ritmos diferentes', () => {
  assert.deepEqual(DANO_3S, { atirador: 1000, meio: 800, selva: 500, topo: 200 });
  const soma = { atirador: 0, meio: 0, selva: 0, topo: 0 }; const golpes = { atirador: [], meio: [], selva: [], topo: [] };
  for (let semente = 1; semente <= 300; semente++) {
    const par = criarPartida(aleatorio(semente * 3));
    const r = criarRodada(aleatorio(semente * 5), semente % RODADAS, { partida: par });
    const rota = Object.fromEntries(r.participantes.map((p) => [p.id, p.rota]));
    for (const g of r.golpes) { soma[rota[g.quem]] += g.dano; golpes[rota[g.quem]].push(g); }
  }
  const jogadores = { atirador: 2, meio: 2, selva: 2, topo: 2 }; // por rodada (os dois selvas, o jogador inclusive, batem)
  for (const k of Object.keys(soma)) soma[k] /= jogadores[k];
  const ref = soma.atirador;
  assert.ok(Math.abs(soma.meio / ref - 0.8) < 0.06, `meio ${(soma.meio / ref).toFixed(2)}`);
  assert.ok(Math.abs(soma.selva / ref - 0.5) < 0.06, `selva ${(soma.selva / ref).toFixed(2)}`);
  assert.ok(Math.abs(soma.topo / ref - 0.2) < 0.04, `topo ${(soma.topo / ref).toFixed(2)}`);
  // quantos golpes por jogador: atirador bate com muito mais frequência que o meio; o golpe do meio é maior
  const porJogador = (rota) => golpes[rota].length / (300 * jogadores[rota]);
  assert.ok(porJogador('atirador') > porJogador('meio') * 2, 'atirador bate mais vezes');
  const media = (rota) => golpes[rota].reduce((a, g) => a + g.dano, 0) / golpes[rota].length;
  assert.ok(media('meio') > media('atirador') * 1.6, `golpe do meio ${media('meio').toFixed(0)} vs atirador ${media('atirador').toFixed(0)}`);
  assert.ok(media('topo') < media('atirador'));
});

test('smite: o atirador é mais constante que o meio (tempo e dano entre golpes variam menos)', () => {
  const cv = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) / m; };
  const intervalos = { atirador: [], meio: [] };
  for (let semente = 1; semente <= 200; semente++) {
    const r = criarRodada(aleatorio(semente * 17), 0, { partida: criarPartida(aleatorio(semente)) });
    for (const p of r.participantes.filter((x) => x.rota === 'atirador' || x.rota === 'meio')) {
      const ts = r.golpes.filter((g) => g.quem === p.id).map((g) => g.t);
      for (let i = 1; i < ts.length; i++) intervalos[p.rota].push(ts[i] - ts[i - 1]);
    }
  }
  assert.ok(cv(intervalos.atirador) < cv(intervalos.meio), 'tempo entre golpes mais regular');
  const m = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(Math.abs(m(intervalos.atirador) - RITMO.atirador.periodo) < 0.08);
  assert.ok(Math.abs(m(intervalos.meio) - RITMO.meio.periodo) < 0.2);
});

// ---- A Q de cada campeão (tipo, janela, recarga, posto pelo nível).
const rodadaCom = (id, n = 2) => { const r = criarRodada(aleatorio(21), n); r.campeao = CAMPEOES.find((c) => c.id === id); return r; };
const semGolpes = (r) => ({ ...r, golpes: [], gatilhoInimigo: null });

test('smite: o posto da habilidade sobe com o nível (1 a 5)', () => {
  assert.deepEqual([6, 7, 8, 10, 11, 13, 14, 16, 17, 18].map(postoHab), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  for (const c of CAMPEOES) for (const k of ['dano', 'recarga']) assert.ok(c[k].every((v, i) => i === 0 || k === 'recarga' ? v > 0 : v > c[k][i - 1]));
});

test('smite: Lee Sin: Q1 abre a janela de 3 s; Q2 bate mais com menos vida; perder a janela inicia a recarga', () => {
  const r = semGolpes(rodadaCom('LeeSin')); const c = r.campeao; const k = postoHab(r.nivel);
  const est = novoEstado(r);
  const e1 = usarHabilidade(est, 10);
  assert.equal(e1[0].fase, 'q1'); assert.equal(e1[0].dano, c.dano[k]);
  assert.equal(estadoQ(est, 11).fase, 'janela');
  // Q2 com a vida cheia: dano base; com a vida quase no fim: perto do dobro
  const cheio = novoEstado(r); usarHabilidade(cheio, 10);
  const q2 = usarHabilidade(cheio, 12)[0];
  assert.equal(q2.fase, 'q2'); assert.ok(Math.abs(q2.dano - c.dano2[k] * (1 + (c.dano[k] / r.vidaMax))) < 2);
  assert.equal(estadoQ(cheio, 12.5).fase, 'recarga');
  assert.ok(Math.abs(estadoQ(cheio, 12).falta - c.recarga[k]) < 0.01);
  const baixo = novoEstado(r); usarHabilidade(baixo, 10); baixo.vida = r.vidaMax * 0.1;
  const q2b = usarHabilidade(baixo, 11)[0];
  assert.ok(q2b.dano > c.dano2[k] * 1.85);
  // perdeu a janela: depois de 3 s a recarga começa (do fim da janela)
  const perdeu = novoEstado(r); usarHabilidade(perdeu, 10);
  const ev = avancar(perdeu, 13.2);
  assert.ok(ev.some((x) => x.tipo === 'habilidade-fim' && x.motivo === 'janela'));
  assert.equal(estadoQ(perdeu, 13.2).fase, 'recarga');
  assert.ok(Math.abs(estadoQ(perdeu, 13.2).falta - (c.recarga[k] - 0.2)) < 0.01);
  assert.deepEqual(usarHabilidade(perdeu, 13.5), []); // ainda em recarga
});

test('smite: Nunu e Kha\'Zix: um toque; recarga própria; Nunu bate bem mais forte; Kha\'Zix recarrega em 3 s', () => {
  for (const id of ['Nunu', 'Khazix']) {
    const r = semGolpes(rodadaCom(id)); const c = r.campeao; const k = postoHab(r.nivel);
    const est = novoEstado(r);
    assert.equal(usarHabilidade(est, 5)[0].dano, c.dano[k]);
    assert.equal(estadoQ(est, 5.1).fase, 'recarga');
    assert.deepEqual(usarHabilidade(est, 5 + c.recarga[k] - 0.1), []);
    assert.equal(usarHabilidade(est, 5 + c.recarga[k] + 0.01).length, 1);
  }
  const nunu = CAMPEOES.find((c) => c.id === 'Nunu'); const outros = CAMPEOES.filter((c) => c.id !== 'Nunu');
  for (let k = 0; k < 5; k++) assert.ok(nunu.dano[k] > 1.5 * Math.max(...outros.filter((c) => c.tipo === 'simples').map((c) => c.dano[k])));
  assert.ok(CAMPEOES.find((c) => c.id === 'Khazix').recarga.every((v) => v === 2.7));
});

test('smite: Pantheon: toque rápido devolve 60% da recarga; segurar dá arremesso maior; segurar demais = metade da recarga', () => {
  const r = semGolpes(rodadaCom('Pantheon')); const c = r.campeao; const k = postoHab(r.nivel);
  const toque = novoEstado(r);
  usarHabilidade(toque, 10);
  assert.equal(estadoQ(toque, 10.1).fase, 'segurando');
  const e = soltarHabilidade(toque, 10.2)[0];
  assert.equal(e.fase, 'toque'); assert.equal(e.dano, c.dano[k]);
  assert.ok(Math.abs(estadoQ(toque, 10.2).falta - c.recarga[k] * 0.4) < 0.01);
  const dano = (seg) => { const x = novoEstado(r); usarHabilidade(x, 10); return soltarHabilidade(x, 10 + seg)[0]; };
  const curto = dano(0.5); const meio = dano(1.2); const cheio = dano(2); const mais = dano(3.5);
  assert.equal(curto.fase, 'arremesso');
  assert.ok(curto.dano > c.dano[k] && meio.dano > curto.dano && cheio.dano > meio.dano);
  assert.equal(mais.dano, cheio.dano); // passou da carga cheia: não cresce mais
  const x = novoEstado(r); usarHabilidade(x, 10);
  assert.equal(estadoQ(x, 12).fase, 'segurando');
  const ev = avancar(x, 14.1);
  assert.ok(ev.some((v) => v.tipo === 'habilidade-fim' && v.motivo === 'segurou'));
  assert.equal(x.vida, r.vidaMax); // não causou dano
  assert.ok(Math.abs(estadoQ(x, 14.1).falta - (c.recarga[k] / 2 - 0.1)) < 0.01);
  assert.deepEqual(soltarHabilidade(x, 14.2), []); // já cancelou
});

test('smite: Wukong: o Q arma o próximo ataque (5 s) com dano extra; cada golpe seu corta 0,5 s da recarga', () => {
  const base = rodadaCom('MonkeyKing'); const c = base.campeao; const k = postoHab(base.nivel);
  const r = { ...base, gatilhoInimigo: null, golpes: [{ t: 12, quem: 'voce', dano: 100, vida: 0 }, { t: 13, quem: 'voce', dano: 100, vida: 0 }, { t: 18, quem: 'voce', dano: 100, vida: 0 }] };
  const est = novoEstado(r);
  const a = usarHabilidade(est, 10);
  assert.equal(a[0].tipo, 'habilidade-armar'); assert.equal(est.vida, r.vidaMax);
  assert.equal(estadoQ(est, 11).fase, 'armado');
  const ev = avancar(est, 12.5);
  assert.ok(ev.some((x) => x.tipo === 'habilidade' && x.fase === 'bonus' && x.dano === c.dano[k]));
  assert.equal(est.vida, r.vidaMax - 100 - c.dano[k]);
  avancar(est, 13.5); // o segundo golpe não tem bônus
  assert.equal(est.vida, r.vidaMax - 200 - c.dano[k]);
  // recarga: 10 + recarga, menos 0,5 s por golpe do Wukong (2 golpes)
  assert.ok(Math.abs(est.q.prontoEm - (10 + c.recarga[k] - 1)) < 0.01);
  // sem golpe a tempo, o armado expira
  const r2 = { ...base, gatilhoInimigo: null, golpes: [{ t: 30, quem: 'voce', dano: 100, vida: 0 }] };
  const e2 = novoEstado(r2); usarHabilidade(e2, 10);
  assert.ok(avancar(e2, 15.5).some((x) => x.tipo === 'habilidade-fim' && x.motivo === 'armado'));
  avancar(e2, 31); assert.equal(e2.vida, r2.vidaMax - 100);
});

test('smite: o Golpear vale pelo TEMPO desde a vida entrar na zona (inclusive pelo seu próprio Q) e no mínimo 25', () => {
  // Lee Sin: a vida está acima do dano do Smite; o Q2 a derruba para dentro da zona e o Golpear vem logo depois
  const base = criarRodada(aleatorio(33), 2); base.campeao = CAMPEOES.find((c) => c.id === 'LeeSin');
  const r = { ...base, golpes: [], gatilhoInimigo: null };
  const mk = (atraso) => {
    const est = novoEstado(r); est.vida = r.smite + 100;
    usarHabilidade(est, 10); // Q1: já entra na zona
    assert.equal(est.tZona, 10);
    usarGolpear(est, 10 + atraso);
    return est.fim;
  };
  assert.equal(mk(0).pontos, 100);
  assert.equal(mk(1).pontos, pontosDoTempo(1));
  assert.equal(mk(1).tempo, 1);
  assert.equal(mk(3).pontos, 25); // lento demais: vale o mínimo do time
  assert.equal(mk(0.05).pontos, 95);
  // Golpear que não mata não marca nada e a rodada continua
  const cedo = novoEstado(r); cedo.vida = r.smite * 3;
  usarGolpear(cedo, 5); assert.equal(cedo.fim, null);
});

test('smite: o relógio da partida respeita o nascimento dos objetivos e só avança', () => {
  assert.deepEqual(TEMPO_MINIMO, { 'dragao-elemental': 300, arauto: 900, barao: 1200, 'dragao-anciao': 1800 });
  for (let semente = 1; semente <= 200; semente++) {
    const par = criarPartida(aleatorio(semente));
    par.tempos.forEach((tp, i) => {
      assert.ok(tp >= TEMPO_MINIMO[par.objetivos[i].id], `${par.objetivos[i].id} em ${tp}`);
      if (i) assert.ok(tp > par.tempos[i - 1]);
      const r = criarRodada(aleatorio(semente + i), i, { partida: par });
      assert.equal(r.tempoInicio, tp);
    });
  }
});

test('smite: o seu Golpear dentro da reação do selva inimigo (0,2 a 0,5 s) chega antes e garante o objetivo', () => {
  const base = criarRodada(aleatorio(4), 2);
  const r = { ...base, golpes: [{ t: 5, quem: 'a-topo', dano: 100, vida: 0 }], gatilhoInimigo: base.smite, reacaoInimigo: 0.4 };
  const mk = () => { const e = novoEstado(r); e.vida = r.smite + 50; return e; };
  const e1 = mk(); avancar(e1, 5); // a vida entra na zona em t = 5
  assert.equal(e1.tZona, 5);
  usarGolpear(e1, 5.3); // antes dos 0,4 s do inimigo
  assert.equal(e1.fim.resultado, 'garantido');
  assert.ok(Math.abs(e1.fim.tempo - 0.3) < 1e-9);
  // depois dos 0,4 s o inimigo já levou
  const e2 = mk(); avancar(e2, 5);
  assert.equal(avancar(e2, 5.41).some((x) => x.tipo === 'smite-inimigo'), true);
  assert.equal(e2.fim.resultado, 'roubado');
});

test('smite: o nível acompanha o relógio da partida (curva média de nível por minuto) e nunca fica irreal', () => {
  const m = (min) => nivelNoTempo(min * 60);
  assert.ok(m(5) > 4 && m(5) < 6);
  assert.ok(m(10) > 8 && m(10) < 10);
  assert.ok(m(15) > 10.5 && m(15) < 12);
  assert.ok(m(20) > 13 && m(20) < 14.5);
  assert.ok(m(30) > 16 && m(30) < 17.5);
  for (let x = 0; x <= 3000; x += 15) assert.ok(nivelNoTempo(x + 15) >= nivelNoTempo(x));
  assert.equal(nivelNoTempo(99999), 18);
  for (let semente = 1; semente <= 300; semente++) {
    const par = criarPartida(aleatorio(semente * 13));
    par.tempos.forEach((tp, i) => {
      const esperado = nivelNoTempo(tp);
      assert.ok(Math.abs(par.niveis[i] - esperado) <= 1.5, `aos ${tp}s nível ${par.niveis[i]} (curva ${esperado.toFixed(1)})`);
      // Arauto (a partir dos 15 min) já passa do nível 10; Barão (20 min) do 12; Ancião (30 min) do 15
      const min = { arauto: 10, barao: 12, 'dragao-anciao': 15 }[par.objetivos[i].id];
      if (min) assert.ok(par.niveis[i] >= min, `${par.objetivos[i].id} em nível ${par.niveis[i]}`);
    });
  }
});
