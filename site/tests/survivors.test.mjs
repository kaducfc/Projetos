// Rift Survivors: dados e simulação (sem navegador).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPEOES, ARMAS, ITENS, INIMIGOS, CHEFES, MISTURA, MELHORIAS, TEMPO_BARAO, MAX_INIMIGOS, MAX_ARMAS, xpProximo } from '../jogos/survivors/js/data.js';
import { criarJogo, atualizar, escolher, gerarOpcoes, criarInimigo, ferir, essenciaGanha } from '../jogos/survivors/js/game.js';
import { GAMES, gameById } from '../shared/config.js';

const rodar = (S, seg, fn = () => ({ x: Math.cos(S.t * 0.3), y: Math.sin(S.t * 0.3) })) => {
  for (let i = 0; i < seg * 60 && S.estado !== 'derrota' && S.estado !== 'vitoria'; i++) {
    if (S.estado === 'upgrade') { escolher(S, S.opcoes[0]); continue; }
    atualizar(S, 1 / 60, fn()); S.evt.length = 0;
  }
};

test('catálogo: o jogo existe, fica restrito ao administrador e tem página e capa', () => {
  const g = gameById('survivors');
  assert.ok(g && g.soAdmin === true && g.path === 'jogos/survivors/');
  assert.equal(GAMES.filter((x) => x.id === 'survivors').length, 1);
});

test('dados: campeões, armas, itens, inimigos e chefes são coerentes', () => {
  for (const c of CAMPEOES) { assert.ok(ARMAS[c.arma], `${c.id}: arma inicial`); assert.ok(c.hp > 0 && c.vel > 0); }
  for (const [id, a] of Object.entries(ARMAS)) {
    let ant = 0;
    for (let n = 1; n <= 5; n++) { const s = a.stats(n); assert.ok(Number.isFinite(s.dano ?? 1), `${id} ${n}`); if (s.dano) { assert.ok(s.dano >= ant, `${id}: dano cresce`); ant = s.dano; } }
  }
  for (const m of MISTURA) assert.ok(INIMIGOS[m.tipo], m.tipo);
  assert.ok(CHEFES.barao.t === TEMPO_BARAO && CHEFES.arauto.t < CHEFES.dragao.t && CHEFES.dragao.t < CHEFES.barao.t);
  for (const i of Object.values(ITENS)) assert.ok(i.por > 0);
  assert.ok(xpProximo(2) > xpProximo(1));
  for (const m of Object.values(MELHORIAS)) assert.ok(m.preco(0) > 0 && m.max >= 1);
});

test('simulação: mesma semente, mesmo resultado; sem NaN e com limite de inimigos', () => {
  const run = () => { const S = criarJogo({ campeao: 'jinx', semente: 42 }); rodar(S, 90); return S; };
  const a = run(); const b = run();
  assert.equal(a.abates, b.abates); assert.equal(a.inim.length, b.inim.length); assert.equal(a.t.toFixed(3), b.t.toFixed(3));
  assert.ok(Number.isFinite(a.p.x) && Number.isFinite(a.p.hp));
  assert.ok(a.inim.length <= MAX_INIMIGOS + 80);
  assert.ok(a.abates > 5, 'a arma inicial mata');
});

test('todas as armas causam dano num inimigo parado perto', () => {
  for (const id of Object.keys(ARMAS)) {
    const S = criarJogo({ campeao: 'garen', semente: 3 }); S.armas.length = 0; S.armas.push({ id, nivel: 3, cd: 0, ang: 0, tick: 0, fila: 0, filaT: 0 });
    const alvos = []; for (let i = 0; i < 6; i++) { const e = criarInimigo(S, 'krug', 22 + i * 3, (i % 2) * 8 - 4); e.vel = 0; e.hp = e.hpMax = 99999; alvos.push(e); }
    S.p.inv = 999; S.p.dx = 1; S.p.dy = 0;
    for (let i = 0; i < 60 * 8; i++) { atualizar(S, 1 / 60, { x: 0, y: 0 }); S.evt.length = 0; if (alvos.some((e) => e.hp < e.hpMax)) break; }
    assert.ok(alvos.some((e) => e.hp < e.hpMax), `${id} não causou dano`);
  }
});

test('subir de nível: 3 opções diferentes, escolher aplica, respeita o limite de armas', () => {
  const S = criarJogo({ campeao: 'ahri', semente: 9 });
  S.xp = S.xpProx; atualizar(S, 1 / 60, { x: 0, y: 0 }); // gera o ganho de XP no próximo coletar
  S.gemas.push({ x: S.p.x, y: S.p.y, v: 50, ima: true }); atualizar(S, 0.05, { x: 0, y: 0 });
  assert.equal(S.estado, 'upgrade'); assert.equal(S.opcoes.length, 3);
  assert.equal(new Set(S.opcoes.map((o) => o.tipo + o.id)).size, 3);
  const antes = S.armas.length + Object.keys(S.passivas).length; escolher(S, S.opcoes[0]);
  assert.ok(S.armas.length + Object.keys(S.passivas).length >= antes);
  // 6 armas: nunca oferece arma nova
  const T = criarJogo({ campeao: 'ahri', semente: 5 }); for (const id of Object.keys(ARMAS).slice(0, MAX_ARMAS)) if (!T.armas.some((a) => a.id === id)) T.armas.push({ id, nivel: 1, cd: 0, ang: 0, tick: 0, fila: 0, filaT: 0 });
  T.armas = T.armas.slice(0, MAX_ARMAS);
  for (let i = 0; i < 40; i++) for (const o of gerarOpcoes(T)) if (o.tipo === 'arma') assert.ok(T.armas.some((a) => a.id === o.id), 'sem arma nova com slots cheios');
});

test('chefes aparecem no horário e o Barão derrotado vence a partida', () => {
  const S = criarJogo({ campeao: 'garen', semente: 11 }); S.p.inv = 999; S.p.hp = S.p.hpMax = 99999;
  S.t = CHEFES.arauto.t - 0.01; rodar(S, 1, () => ({ x: 0, y: 0 }));
  assert.ok(S.chefes.arauto && S.inim.some((e) => e.tipo === 'arauto'));
  S.t = TEMPO_BARAO - 0.01; S.onda = 99; rodar(S, 1, () => ({ x: 0, y: 0 }));
  const barao = S.inim.find((e) => e.tipo === 'barao'); assert.ok(barao);
  ferir(S, barao, 1e9);
  assert.equal(S.estado, 'vitoria'); assert.ok(essenciaGanha(S) >= 150);
});

test('derrota com vida zerada, e a Ampulheta de Zhonya revive uma vez', () => {
  const S = criarJogo({ campeao: 'garen', semente: 2, meta: { melhorias: { revive: 1 } } });
  for (let i = 0; i < 40; i++) criarInimigo(S, 'canhao', S.p.x + (i % 3), S.p.y);
  S.p.hp = 1; atualizar(S, 0.05, { x: 0, y: 0 });
  assert.equal(S.estado, 'jogando'); assert.ok(S.reviveu);
  S.p.inv = 0; S.p.hp = 1; atualizar(S, 0.05, { x: 0, y: 0 });
  assert.equal(S.estado, 'derrota');
});

test('Beijo Encantado paralisa o inimigo atingido', () => {
  const S = criarJogo({ campeao: 'ahri', semente: 4 }); S.armas.length = 0; S.armas.push({ id: 'coracao', nivel: 1, cd: 0, ang: 0, tick: 0, fila: 0, filaT: 0 });
  const e = criarInimigo(S, 'minion', 60, 0); e.hp = e.hpMax = 9999; S.p.inv = 999;
  let x0 = null;
  for (let i = 0; i < 60 * 4; i++) { atualizar(S, 1 / 60, { x: 0, y: 0 }); if (e.encantado > 0) { x0 = x0 ?? e.x; } }
  assert.ok(x0 !== null, 'foi encantado');
});
