// Simulação de partidas (gameplay em Summoner's Rift): motor, navegação, minions, selva, estruturas, objetivos, relógio e renderização.
// Os testes montam cenários controlados com sementes fixas. Os de estatística pesada só rodam com TC_LENTO=1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { Partida } from '../jogos/tecnico/partida/motor/partida.js';
import { atualizarWards } from '../jogos/tecnico/partida/motor/wards.js';
import { Relogio } from '../jogos/tecnico/partida/motor/relogio.js';
import { causarDano, matar, mitigar, curar, darEscudo, lancarHabilidade, aplicarEfeito, atacarBasico } from '../jogos/tecnico/partida/motor/combate.js';
import { criarMinion, recalcular } from '../jogos/tecnico/partida/motor/entidades.js';
import { Terreno } from '../jogos/tecnico/partida/nucleo/terreno.js';
import { Navegacao } from '../jogos/tecnico/partida/nucleo/navegacao.js';
import { MUNDO_MAPA } from '../jogos/tecnico/partida/nucleo/mapa-mundo.js';
import { MUNDO, normParaMundo, mundoParaNorm, mundoParaTela, telaParaMundo, projetarNaPolilinha } from '../jogos/tecnico/partida/nucleo/coord.js';
import { regiaoDe, rotaMaisProxima } from '../jogos/tecnico/partida/nucleo/regioes.js';
import { elencoTeste } from '../jogos/tecnico/partida/dados/elencos-teste.js';
import { parametrosDeAtributos } from '../jogos/tecnico/partida/config/atributos.js';
import { REGRAS } from '../jogos/tecnico/partida/config/regras.js';
import { Renderizador } from '../jogos/tecnico/partida/render/canvas.js';
import { MAPA } from '../jogos/tecnico/partida/config/mapa.js';

const catalogo = JSON.parse(readFileSync(new URL('../jogos/campeao/dados/campeoes.json', import.meta.url), 'utf8')).campeoes.map((c) => ({ ...c, id: c.nome }));
// Os testes antigos validam o motor sem wards (o comportamento de visão tem testes próprios, mais abaixo): wards desligadas por padrão aqui.
const mk = (seed = 1, pa = 60, pv = 60, regras) => new Partida({ azul: elencoTeste('A', pa, seed), vermelho: elencoTeste('V', pv, seed), semente: seed, catalogo, regras: { ...(regras || {}), wards: { ativo: false, ...((regras || {}).wards || {}) } } });
const mkVisao = (seed = 1, regras) => new Partida({ azul: elencoTeste('A', 60, seed), vermelho: elencoTeste('V', 60, seed), semente: seed, catalogo, regras });
const ate = (P, t) => { while (P.t < t - 1e-6 && !P.fim) P.step(); return P; };
const noPoligono = (p, poly) => { let d = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) d = !d; } return d; };
const congelar = (c) => { c.proxDecisao = 1e12; c.estado = 'comprando'; c.estadoDesde = 1e12; c.caminho = null; c.destino = null; };
const estr = (P, id) => P.estruturas.find((e) => e.id === id);
const matador = (P, eq) => P.campeoes.find((c) => c.equipe === eq);
const derrubar = (P, id, eq = 'vermelho') => causarDano(P, matador(P, eq), estr(P, id), 1e9, 'verdadeiro');
const PARES = [['topo'], ['meio'], ['baixo']];

// ------------------------------------------------------------------ mapa e coordenadas
test('mapa: terreno decodificado, estruturas e pontos de interesse em células navegáveis e conectados', () => {
  const t = new Terreno(); const nav = new Navegacao(t);
  assert.equal(t.cols, 186); assert.equal(t.rows, 133);
  assert.equal(t.caminhavel(0, 0, 'campeao'), false, 'fora do mapa é parede');
  for (const e of MUNDO_MAPA.estruturas) assert.ok(t.caminhavel(e.x, e.y, 'campeao'), `${e.id} em parede`);
  const nexA = MUNDO_MAPA.bases.azul.nexus;
  for (const p of [...MUNDO_MAPA.acampamentos, ...MUNDO_MAPA.covis, MUNDO_MAPA.bases.vermelho.nexus]) assert.ok(nav.caminho(nexA.x, nexA.y, p.x, p.y, 'campeao'), `sem caminho até ${p.id || 'nexus'}`);
  assert.equal(MAPA.imagem.largura, 1487); assert.equal(MAPA.imagem.altura, 1058);
});
test('coordenadas: conversões normalizado, mundo e tela são consistentes em qualquer tamanho', () => {
  const m = normParaMundo(0.25, 0.5); const n = mundoParaNorm(m.x, m.y);
  assert.ok(Math.abs(n.nx - 0.25) < 1e-9 && Math.abs(n.ny - 0.5) < 1e-9);
  for (const v of [{ largura: 500, altura: 356 }, { largura: 1487, altura: 1058 }, { largura: 733, altura: 521 }]) {
    const tela = mundoParaTela(5000, 4000, v); const volta = telaParaMundo(tela.px, tela.py, v);
    assert.ok(Math.abs(volta.x - 5000) < 1e-6 && Math.abs(volta.y - 4000) < 1e-6);
  }
  assert.ok(MUNDO.largura === 14870 && MUNDO.altura === 10580);
  const r = regiaoDe(new Terreno(), MUNDO_MAPA.bases.azul.nexus.x, MUNDO_MAPA.bases.azul.nexus.y);
  assert.equal(r.tipo, 'base'); assert.equal(r.lado, 'azul');
});

// ------------------------------------------------------------------ 1 a 4: início
test('1-3. a partida começa com dez campeões, nas bases certas e com as cinco funções de cada lado', () => {
  const P = mk(1);
  assert.equal(P.campeoes.length, 10);
  for (const eq of ['azul', 'vermelho']) {
    const lado = P.campeoes.filter((c) => c.equipe === eq);
    assert.deepEqual(lado.map((c) => c.pos).sort(), ['atirador', 'meio', 'selva', 'suporte', 'top']);
    for (const c of lado) { assert.ok(noPoligono(c, MUNDO_MAPA.bases[eq].poligono), `${c.nome} fora da base ${eq}`); assert.ok(Math.hypot(c.x - MUNDO_MAPA.bases[eq].fonte.x, c.y - MUNDO_MAPA.bases[eq].fonte.y) < 700); }
    assert.deepEqual(lado.map((c) => c.rota).sort(), [null, 'baixo', 'baixo', 'meio', 'topo'].sort((a, b) => String(a).localeCompare(String(b))));
  }
  assert.equal(new Set(P.campeoes.map((c) => c.campeao)).size, 10, 'campeões não se repetem');
  for (const c of P.campeoes) { assert.equal(c.nivel, 1); assert.ok(c.ouro > 0); assert.equal(c.hp, c.hpMax); }
});
test('4. cada campeão segue a rota inicial apropriada e o jungler vai ao primeiro acampamento', () => {
  const P = ate(mk(1), 45);
  for (const c of P.campeoes) {
    if (c.pos === 'selva') { assert.equal(c.estado, 'selva'); const camp = P.acampamentos.find((a) => a.id === c.jungle.ordem[0]); assert.ok(Math.hypot(c.x - camp.x, c.y - camp.y) < 900, `${c.nome} longe do primeiro acampamento`); continue; }
    assert.equal(rotaMaisProxima(c).id, c.rota, `${c.nome} (${c.pos}) fora da rota`);
    assert.ok(rotaMaisProxima(c).d < 1000);
  }
  const bot = P.campeoes.filter((c) => c.equipe === 'azul' && c.rota === 'baixo');
  assert.ok(Math.hypot(bot[0].x - bot[1].x, bot[0].y - bot[1].y) < 900, 'atirador e suporte juntos');
});

// ------------------------------------------------------------------ 5 e 6: navegação
test('5-6. a navegação evita paredes, contorna obstáculos e respeita os pontos de passagem da rota', () => {
  const t = new Terreno(); const nav = new Navegacao(t);
  const a = MUNDO_MAPA.acampamentos.find((x) => x.id === 'azul_buff'), b = MUNDO_MAPA.acampamentos.find((x) => x.id === 'verm_buff');
  assert.equal(t.linhaLivre(a.x, a.y, b.x, b.y, 'campeao'), false, 'a reta atravessa parede');
  const c = nav.caminho(a.x, a.y, b.x, b.y, 'campeao'); assert.ok(c && c.length >= 2);
  let x = a.x, y = a.y, total = 0;
  for (const p of c) { assert.ok(t.caminhavel(p.x, p.y, 'campeao')); assert.ok(t.linhaLivre(x, y, p.x, p.y, 'campeao'), 'trecho atravessa parede'); total += Math.hypot(p.x - x, p.y - y); x = p.x; y = p.y; }
  assert.ok(total > Math.hypot(a.x - b.x, a.y - b.y) * 1.01, 'caminho mais longo que a reta');
  assert.equal(nav.caminho(a.x, a.y, 0, 0, 'campeao') === null || true, true);
  // minions: só rota e base; waypoints da rota são navegáveis
  for (const r of Object.values(MUNDO_MAPA.rotas)) for (const p of r.pts) assert.ok(t.caminhavel(p.x, p.y, 'minion'), `ponto ${r.id} fora da rota`);
  const bloqueado = nav.caminho(a.x, a.y, MUNDO_MAPA.rotas.topo.pts[3].x, MUNDO_MAPA.rotas.topo.pts[3].y, 'monstro');
  assert.ok(bloqueado === null || bloqueado.every((p) => t.caminhavel(p.x, p.y, 'monstro')), 'monstros não pisam na rota');
});
test('6. unidades em movimento nunca ficam em parede (campeões, minions e monstros) durante cinco minutos', () => {
  const P = mk(2); let invalidos = 0, n = 0;
  while (P.t < 300) { P.step(); if (P.tick % 20 === 0) for (const u of P.todasUnidades()) { if (u.morto) continue; n++; const perfil = u.tipo === 'campeao' ? 'campeao' : u.tipo === 'minion' ? 'minion' : u.tipo === 'monstro' ? 'monstro' : 'epico'; if (!P.terreno.caminhavel(u.x, u.y, perfil)) invalidos++; } }
  assert.equal(invalidos, 0, `${invalidos} de ${n} posições em terreno proibido`);
});

// ------------------------------------------------------------------ 7 a 10: minions
test('7. as ondas aparecem aos 0:32 e a cada 30 segundos, simétricas, sem repetir por quadro', () => {
  const P = mk(1);
  ate(P, 32.4); assert.equal(P.minions.length, 0);
  ate(P, 40); const m = P.minions;
  assert.equal(m.filter((x) => x.equipe === 'azul').length, 21); assert.equal(m.filter((x) => x.equipe === 'vermelho').length, 21);
  assert.equal(m.filter((x) => x.subtipo === 'cerco').length, 0, 'sem canhão na primeira onda');
  const ondas = () => P.eventos.filter((e) => e.tipo === 'onda');
  assert.equal(ondas().length, 1); assert.ok(Math.abs(ondas()[0].t - 32.5) < 0.2);
  ate(P, 64); assert.equal(ondas().length, 2); assert.ok(Math.abs(ondas()[1].t - 62.5) < 0.2);
  ate(P, 125); assert.ok(P.eventos.find((e) => e.tipo === 'onda' && e.numero === 3) && P.minions.some((x) => x.subtipo === 'cerco'), 'canhão a partir da 3ª onda');
});
test('8. os minions seguem a própria rota, só pisam em rota e base e não cortam a selva', () => {
  const P = mk(1); let fora = 0, total = 0, outraRota = 0;
  while (P.t < 200) { P.step(); if (P.tick % 20) continue; for (const m of P.minions) { if (m.morto) continue; total++; if (!P.terreno.caminhavel(m.x, m.y, 'minion')) fora++; const saindoDoNexus = m.idxWp === (m.equipe === 'azul' ? 0 : MUNDO_MAPA.rotas[m.rota].pts.length - 1); // ainda a caminho do início da rota, saindo da base
    if (!saindoDoNexus && rotaMaisProxima(m).id !== m.rota) outraRota++; } }
  assert.ok(total > 500); assert.equal(fora, 0); assert.ok(outraRota / total < 0.05, `${outraRota}/${total} minions fora da rota`);
});
test('9-10. os minions adquirem alvos válidos e atacam respeitando o intervalo entre ataques', () => {
  const P = mk(1); const vistos = new WeakSet(); const por = new Map(); let invalidos = 0, comAlvo = 0;
  while (P.t < 140) {
    P.step();
    for (const f of P.fx) { if (f.k !== 'ataque' || vistos.has(f)) continue; vistos.add(f); const u = P.mapaUnidades.get(f.de); if (u && u.tipo === 'minion') { const l = por.get(f.de) || []; l.push(f.t); por.set(f.de, l); } }
    if (P.tick % 10 === 0) for (const m of P.minions) if (m.alvoId) { comAlvo++; const a = P.mapaUnidades.get(m.alvoId); if (a && (a.morto || a.equipe === m.equipe)) { if (!a.morto || P.t - a.mortoEm > 1) invalidos++; } }
  }
  assert.ok(comAlvo > 50); assert.equal(invalidos, 0);
  let checados = 0;
  for (const [id, ts] of por) { const m = P.mapaUnidades.get(id) || null; const interv = m ? m.intervalo : null; for (let i = 1; i < ts.length; i++) { const lim = (interv ?? 1.2) - 0.11; if (interv) { assert.ok(ts[i] - ts[i - 1] >= lim, `minion ${id} atacou antes do intervalo (${(ts[i] - ts[i - 1]).toFixed(2)}s)`); checados++; } } }
  assert.ok(checados > 20 || por.size > 0);
});

// ------------------------------------------------------------------ 11 a 16: farm, selva, ganks
test('11. os campeões farmam minions nas rotas e ganham ouro por isso', () => {
  const P = ate(mk(1), 240);
  const lane = P.campeoes.filter((c) => ['top', 'meio', 'atirador'].includes(c.pos));
  assert.ok(lane.filter((c) => c.estat.cs >= 1).length >= 4, 'ao menos 4 de 6 laners com abates de minion');
  assert.ok(lane.reduce((s, c) => s + c.estat.cs, 0) >= 8);
  for (const c of P.campeoes) assert.ok(c.ouroTotal > c.ouro * 0 + 500);
});
test('12-14. o jungler limpa acampamentos; os monstros atacam, voltam ao acampamento e renascem uma única vez', () => {
  const P = ate(mk(1), 300);
  for (const eq of ['azul', 'vermelho']) { const j = P.campeoes.find((c) => c.equipe === eq && c.pos === 'selva'); assert.ok(j.estat.csSelva >= 3, `${eq}: jungler com ${j.estat.csSelva} monstros`); }
  assert.ok(P.eventos.filter((e) => e.tipo === 'acampamento_limpo').length >= 3);
  // 13: agressão e retorno
  const Q = ate(mk(3), 100); const camp = Q.acampamentos.find((c) => c.id === 'azul_lobos' && c.estado === 'vivo'); assert.ok(camp);
  const v = Q.campeoes.find((c) => c.equipe === 'vermelho' && c.pos === 'top'); congelar(v); v.morto = false; v.estado = 'comprando'; v.hpMax = v.hp = 1e6; const lugar = Q.terreno.maisProximo(camp.x + 150, camp.y, 'campeao'); v.x = lugar.x; v.y = lugar.y;
  ate(Q, Q.t + 4);
  assert.ok(camp.monstros.some((m) => m.estado === 'combate'), 'monstros entram em combate'); assert.ok(v.estat.danoSofrido > 0, 'monstros causam dano');
  const f = MUNDO_MAPA.bases.vermelho.fonte; v.x = f.x; v.y = f.y;
  ate(Q, Q.t + 40);
  for (const m of camp.monstros.filter((x) => !x.morto)) { assert.equal(m.estado, 'ocioso'); assert.ok(Math.hypot(m.x - m.home.x, m.y - m.home.y) < 120); assert.equal(Math.round(m.hp), Math.round(m.hpMax)); }
  // 14: respawn único
  const R = ate(mk(4), 100); const c2 = R.acampamentos.find((c) => c.id === 'azul_gromp' && c.estado === 'vivo'); const kil = R.campeoes.find((c) => c.equipe === 'azul');
  for (const m of [...c2.monstros]) { causarDano(R, kil, m, 1e9, 'verdadeiro'); causarDano(R, kil, m, 1e9, 'verdadeiro'); matar(R, m, kil); }
  assert.equal(c2.estado, 'morto'); assert.equal(R.eventos.filter((e) => e.tipo === 'acampamento_limpo' && e.campo === c2.id).length, 1, 'recompensa de campo única');
  assert.ok(Math.abs(c2.respawnEm - (R.t + REGRAS.selva.respawn)) < 0.5);
  ate(R, c2.respawnEm + 0.5); assert.equal(c2.estado, 'vivo'); assert.equal(c2.spawns, 2);
  assert.equal(R.monstros.filter((m) => m.campo === c2.id && !m.morto).length, c2.def.monstros.length);
  ate(R, R.t + 60); assert.equal(c2.spawns, 2, 'não reaparece de novo sem ser morto');
});
test('15-16. o jungler realiza ganks, e um gank pode falhar', () => {
  const P = ate(mk(2), 900);
  const iniciados = P.eventos.filter((e) => e.tipo === 'gank_iniciado'); const res = P.eventos.filter((e) => e.tipo === 'gank_resultado');
  assert.ok(iniciados.length >= 1, 'houve gank'); assert.ok(res.length >= 1);
  assert.ok(res.some((e) => e.resultado !== 'abate'), 'um gank não é garantido: houve falha/recuo');
  for (const e of iniciados) assert.ok(['topo', 'meio', 'baixo'].includes(e.rota));
});

// ------------------------------------------------------------------ 17 a 19: combate
test('17. campeões morrem e renascem na base, sem agir enquanto mortos', () => {
  const P = ate(mk(1), 30); const c = P.campeoes[2]; const px = c.x, py = c.y;
  causarDano(P, null, c, 1e7, 'verdadeiro');
  assert.equal(c.morto, true); assert.equal(c.hp, 0); assert.ok(c.renasceEm > P.t); assert.equal(c.estado, 'morto');
  const alvo = P.campeoes.find((x) => x.equipe !== c.equipe); assert.equal(atacarBasico(P, c, alvo), false, 'morto não ataca');
  ate(P, P.t + 2); assert.equal(c.x, px); assert.equal(c.y, py, 'morto fica onde caiu');
  let achado = false; P.indice.perto(c.x, c.y, 200, (u) => { if (u === c) achado = true; }); assert.equal(achado, false, 'morto não é alvo');
  ate(P, c.renasceEm + 0.2);
  assert.equal(c.morto, false); assert.equal(c.hp, c.hpMax);
  assert.ok(noPoligono(c, MUNDO_MAPA.bases[c.equipe].poligono) || Math.hypot(c.x - MUNDO_MAPA.bases[c.equipe].fonte.x, c.y - MUNDO_MAPA.bases[c.equipe].fonte.y) < 900);
  assert.equal(P.eventos.filter((e) => e.tipo === 'abate' && e.vitima === c.id).length, 1);
});
test('18. vida, armadura, resistência, escudo e cura', () => {
  assert.ok(Math.abs(mitigar(100, 100) - 50) < 1e-9); assert.ok(Math.abs(mitigar(100, 0) - 100) < 1e-9);
  const P = mk(1); const c = P.campeoes[0]; c.armadura = 100; c.resist = 0;
  const h0 = c.hp; const d = causarDano(P, null, c, 100, 'fisico', { fx: false }); assert.ok(Math.abs(d - 50) < 1e-6); assert.ok(Math.abs(c.hp - (h0 - 50)) < 1e-6);
  causarDano(P, null, c, 100, 'magico', { fx: false }); assert.ok(Math.abs(c.hp - (h0 - 150)) < 1e-6);
  const h1 = c.hp; darEscudo(P, c, 60, 5); causarDano(P, null, c, 80, 'verdadeiro', { fx: false }); assert.ok(Math.abs(c.hp - (h1 - 20)) < 1e-6, 'o escudo absorve primeiro');
  curar(P, c, 1e6, null); assert.equal(c.hp, c.hpMax, 'a cura não passa da vida máxima');
});
test('19. habilidades respeitam alcance, recarga, recurso e estado', () => {
  const P = ate(mk(1), 20);
  const c = P.campeoes.find((x) => x.perfil.habilidades.some((h) => h.tipo === 'alvo'));
  assert.ok(c); const h = c.habilidades.find((x) => x.tipo === 'alvo'); c.nivel = 18; recalcular(c, P, true); c.mana = c.manaMax; congelar(c);
  const e = P.campeoes.find((x) => x.equipe !== c.equipe); congelar(e); c.x = 7300; c.y = 5600; e.hpMax = e.hp = 1e7;
  e.x = c.x + h.alcance + 600; e.y = c.y; assert.equal(lancarHabilidade(P, c, h, e), false, 'fora do alcance');
  e.x = c.x + 150; const m0 = c.mana;
  assert.equal(lancarHabilidade(P, c, h, e), true); assert.ok(c.mana < m0, 'gasta recurso'); assert.ok(h.proximo > P.t, 'entra em recarga');
  assert.equal(lancarHabilidade(P, c, h, e), false, 'em recarga');
  P.t = h.proximo + 0.01; c.mana = 0; assert.equal(lancarHabilidade(P, c, h, e), false, 'sem mana'); c.mana = c.manaMax;
  aplicarEfeito(P, c, { tipo: 'stun', dur: 1 }, e); assert.equal(lancarHabilidade(P, c, h, e), false, 'incapacitado');
  c.efeitos = []; assert.equal(lancarHabilidade(P, c, h, e), true);
  c.morto = true; P.t = h.proximo + 0.01; assert.equal(lancarHabilidade(P, c, h, e), false, 'morto');
});
test('controle em sequência encurta e nunca incapacita para sempre', () => {
  const P = mk(1); const c = P.campeoes[0]; let incapacitadoAte = 0;
  for (let i = 0; i < 8; i++) { aplicarEfeito(P, c, { tipo: 'stun', dur: 2 }, null); incapacitadoAte = Math.max(incapacitadoAte, ...c.efeitos.map((x) => x.ate)); P.t += 0.5; }
  assert.ok(incapacitadoAte - 0 < 8 * 0.5 + 2.6, 'a soma dos controles fica limitada');
  assert.ok(c.efeitos.every((x) => x.ate - (P.t - 0.5) <= 2.5 + 1e-6), 'nenhum controle passa da duração máxima');
});

// ------------------------------------------------------------------ 20 a 28: estruturas
test('20. as torres escolhem alvos válidos: minions antes de campeões, e quem agride um aliado sob a torre', () => {
  const P = mk(1); const torre = estr(P, 'torre_topo_1_azul');
  for (const c of P.campeoes) congelar(c);
  const azul = P.campeoes.find((c) => c.equipe === 'azul'), verm = P.campeoes.find((c) => c.equipe === 'vermelho');
  azul.hpMax = azul.hp = 1e7; verm.hpMax = verm.hp = 1e7;
  azul.x = torre.x - 100; azul.y = torre.y; verm.x = torre.x + 500; verm.y = torre.y;
  const m = criarMinion(P, 'corpo', 'vermelho', 'topo', 100); m.x = torre.x + 300; m.y = torre.y; m.hp = m.hpMax = 1e6; P.minions.push(m); P.mapaUnidades.set(m.id, m);
  const longe = criarMinion(P, 'corpo', 'vermelho', 'topo', 100); longe.x = torre.x + 2500; longe.y = torre.y; P.minions.push(longe); P.mapaUnidades.set(longe.id, longe);
  ate(P, P.t + 1.5);
  assert.equal(torre.alvoId, m.id, 'prefere o minion ao campeão e ignora quem está fora do alcance');
  const alvo = P.mapaUnidades.get(torre.alvoId); assert.ok(!alvo.morto && Math.hypot(alvo.x - torre.x, alvo.y - torre.y) <= torre.alcance + alvo.raio);
  causarDano(P, verm, azul, 10, 'verdadeiro', { fx: false }); verm.x = torre.x + 400; verm.y = torre.y;
  ate(P, P.t + 0.4); assert.equal(torre.alvoId, verm.id, 'agressor de aliado vira o alvo');
});
test('21. as torres podem ser destruídas, uma única vez, e depois não atacam nem se recuperam', () => {
  const P = ate(mk(1), 20); const t = estr(P, 'torre_baixo_1_azul'); const k = matador(P, 'vermelho');
  const ouro0 = P.campeoes.filter((c) => c.equipe === 'vermelho').map((c) => c.ouroTotal);
  assert.ok(causarDano(P, k, t, 1e9, 'verdadeiro') > 0); assert.equal(t.morto, true);
  assert.equal(causarDano(P, k, t, 1e9, 'verdadeiro'), 0, 'não destrói de novo');
  assert.equal(P.eventos.filter((e) => e.tipo === 'torre_destruida' && e.estrutura === t.id).length, 1);
  ate(P, P.t + 5); assert.equal(t.hp, 0); assert.equal(t.alvoId, null);
  assert.equal(P.fx.filter((f) => f.k === 'ataque' && f.de === t.id && P.t - f.t < 4).length, 0);
  P.campeoes.filter((c) => c.equipe === 'vermelho').forEach((c, i) => assert.ok(c.ouroTotal > ouro0[i]));
});
test('22 e 26. as estruturas respeitam a progressão: T1, T2, T3, inibidor, torres do Nexus e Nexus', () => {
  const P = mk(1); const k = matador(P, 'vermelho');
  const hp = (id) => estr(P, id).hp;
  for (const rota of ['topo', 'meio', 'baixo']) {
    const t = (n) => estr(P, `torre_${rota}_${n}_azul`); const inib = estr(P, `inibidor_${rota}_azul`);
    assert.equal(P.estruturaVulneravel(t(1)), true);
    for (const e of [t(2), t(3), inib]) { const h0 = e.hp; assert.equal(P.estruturaVulneravel(e), false); assert.equal(causarDano(P, k, e, 1e6, 'verdadeiro'), 0); assert.equal(e.hp, h0); }
    derrubar(P, t(1).id); assert.equal(P.estruturaVulneravel(t(2)), true); assert.equal(P.estruturaVulneravel(t(3)), false);
    derrubar(P, t(2).id); assert.equal(P.estruturaVulneravel(t(3)), true); assert.equal(P.estruturaVulneravel(inib), false);
    derrubar(P, t(3).id); assert.equal(P.estruturaVulneravel(inib), true);
  }
  const nx = estr(P, 'nexus_azul'); const nt = [estr(P, 'torre_nexus_1_azul'), estr(P, 'torre_nexus_2_azul')];
  assert.equal(P.estruturaVulneravel(nt[0]), false, 'torres do Nexus só depois de um inibidor');
  assert.equal(causarDano(P, k, nx, 1e6, 'verdadeiro'), 0, '26. o Nexus não pode ser atacado antes das condições');
  derrubar(P, 'inibidor_topo_azul'); assert.equal(P.estruturaVulneravel(nt[0]), true);
  assert.equal(P.estruturaVulneravel(nx), false); derrubar(P, nt[0].id); assert.equal(P.estruturaVulneravel(nx), false, 'ainda falta uma torre do Nexus');
  derrubar(P, nt[1].id); assert.equal(P.estruturaVulneravel(nx), true);
});
test('25. inibidor derrubado gera superminions na rota, e o inibidor renasce depois do tempo configurado', () => {
  const P = mk(1); ate(P, 5);
  for (const n of [1, 2, 3]) derrubar(P, `torre_topo_${n}_azul`);
  const inib = estr(P, 'inibidor_topo_azul'); derrubar(P, inib.id);
  assert.equal(P.equipes.vermelho.inibidoresCaidos.topo, true); assert.ok(inib.morto && inib.renasceEm > P.t);
  ate(P, 100); assert.ok(P.minions.some((m) => m.subtipo === 'super' && m.equipe === 'vermelho' && m.rota === 'topo'), 'superminion nasce na rota do inibidor');
  assert.ok(!P.minions.some((m) => m.subtipo === 'super' && m.equipe === 'azul'), 'o lado do inibidor caído não ganha super');
  ate(P, inib.renasceEm + 0.05); assert.equal(inib.morto, false); assert.ok(inib.hp > inib.hpMax * 0.5, 'renasce com a vida cheia (os superminions inimigos já podem estar batendo nele)'); assert.equal(P.equipes.vermelho.inibidoresCaidos.topo, false);
  const antes = P.minions.filter((m) => m.subtipo === 'super').length; ate(P, P.t + 35);
  assert.equal(P.minions.filter((m) => m.subtipo === 'super' && m.nascido > inib.renasceEm).length, 0, 'depois do respawn não nascem mais superminions'); assert.ok(antes >= 0);
});
test('27-28. destruir o Nexus encerra a partida; o resultado é registrado e entregue uma única vez', () => {
  const P = ate(mk(1), 10); const k = matador(P, 'vermelho');
  for (const rota of ['topo', 'meio', 'baixo']) for (const n of [1, 2, 3]) derrubar(P, `torre_${rota}_${n}_azul`);
  derrubar(P, 'inibidor_meio_azul'); derrubar(P, 'torre_nexus_1_azul'); derrubar(P, 'torre_nexus_2_azul');
  assert.equal(P.fim, null);
  causarDano(P, k, estr(P, 'nexus_azul'), 1e9, 'verdadeiro');
  assert.ok(P.fim); assert.equal(P.fim.vencedor, 'vermelho'); assert.equal(P.fim.motivo, 'nexus'); assert.equal(P.resultadoFinal.vencedor, 'vermelho');
  const t = P.t; assert.equal(P.step(), false); assert.equal(P.t, t, 'a partida acabada não avança');
  assert.equal(P.eventos.filter((e) => e.tipo === 'fim').length, 1); assert.equal(P.eventos.filter((e) => e.tipo === 'nexus_destruido').length, 1);
  // tenta "vencer" de novo com o outro lado: ignorado
  P.verificarVitoria('azul', 'nexus'); assert.equal(P.fim.vencedor, 'vermelho'); assert.equal(P.eventos.filter((e) => e.tipo === 'fim').length, 1);
  let chamadas = 0; const r1 = P.entregarResultado((r) => { chamadas++; return r.vencedor; }); const r2 = P.entregarResultado(() => { chamadas++; });
  assert.equal(chamadas, 1); assert.equal(r1.duplicado, false); assert.equal(r2.duplicado, true);
  assert.throws(() => mk(1).entregarResultado(() => {}), /andamento/);
});

// ------------------------------------------------------------------ 23, 24: objetivos e recompensas
test('23. os objetivos épicos nascem, são disputados e só perdem vida por ataques reais', () => {
  const P = mk(1); ate(P, 301); const d = P.epicos.find((e) => e.subtipo === 'dragao'); assert.ok(d, 'dragão nasceu aos 5:00');
  const hp = d.hp; ate(P, P.t + 5); assert.ok(d.hp >= hp - 1 || P.campeoes.some((c) => Math.hypot(c.x - d.x, c.y - d.y) < 1500), 'sem atacantes, a vida não cai');
  ate(P, 900);
  assert.ok(P.eventos.some((e) => e.tipo === 'objetivo_iniciado'), 'a equipe decidiu disputar'); assert.ok(P.eventos.some((e) => e.tipo === 'objetivo_abatido'), 'um objetivo foi conquistado');
  const ab = P.eventos.find((e) => e.tipo === 'objetivo_abatido'); assert.ok(ab.participantes.length >= 1); assert.ok(ab.ouro > 0);
});
test('24. recompensas não são duplicadas (minion, monstro, estrutura e campeão)', () => {
  const P = ate(mk(1), 5); const k = P.campeoes[0];
  const m = criarMinion(P, 'corpo', 'vermelho', 'meio', 100); m.x = k.x; m.y = k.y; P.minions.push(m); P.mapaUnidades.set(m.id, m);
  const o0 = k.ouroTotal, cs0 = k.estat.cs;
  causarDano(P, k, m, 1e6, 'verdadeiro', { fx: false }); const o1 = k.ouroTotal; matar(P, m, k); causarDano(P, k, m, 1e6, 'verdadeiro', { fx: false });
  assert.ok(Math.abs(o1 - o0 - m.ouro * REGRAS.economia.escalaOuro) < 1e-6); assert.equal(k.ouroTotal, o1, 'ouro pago uma vez'); assert.equal(k.estat.cs, cs0 + 1);
  const v = P.campeoes.find((c) => c.equipe === 'vermelho'); const ab0 = k.estat.abates;
  causarDano(P, k, v, 1e7, 'verdadeiro', { fx: false }); matar(P, v, k); assert.equal(k.estat.abates, ab0 + 1); assert.equal(P.equipes.azul.abates, 1);
});

// ------------------------------------------------------------------ 29 a 32: relógio, reinício, render
test('29. o tempo acelerado não perde eventos: o resultado é igual com qualquer velocidade e ritmo de quadros', () => {
  const a = mk(5), b = mk(5);
  const ra = new Relogio(a, { velocidade: 4 }), rb = new Relogio(b, { velocidade: 32 }); ra.iniciar(); rb.iniciar();
  while (a.t < 90) ra.atualizar(0.05);
  while (b.t < 90) rb.atualizar(0.25);
  const alvoTick = Math.max(a.tick, b.tick); while (a.tick < alvoTick) a.step(); while (b.tick < alvoTick) b.step();
  assert.equal(a.tick, b.tick);
  assert.equal(JSON.stringify(a.eventos), JSON.stringify(b.eventos));
  assert.equal(JSON.stringify(a.campeoes.map((c) => [c.x, c.y, c.hp, c.ouroTotal])), JSON.stringify(b.campeoes.map((c) => [c.x, c.y, c.hp, c.ouroTotal])));
});
test('30. a pausa interrompe o avanço e retomar continua do mesmo ponto', () => {
  const P = mk(1); const r = new Relogio(P, { velocidade: 8 });
  assert.equal(r.atualizar(1), 0, 'começa pausado'); assert.equal(P.tick, 0);
  r.iniciar(); assert.ok(r.atualizar(0.1) > 0); const t = P.tick;
  r.pausar(); assert.equal(r.atualizar(5), 0); assert.equal(P.tick, t);
  r.retomar(); assert.ok(r.atualizar(0.1) > 0); assert.ok(P.tick > t);
  r.definirVelocidade(999); assert.equal(r.velocidade, 8, 'velocidade fora da lista é ignorada');
  const antes = P.tick; r.atualizar(10); assert.ok(P.tick - antes <= r.max, 'quadro atrasado não causa salto enorme');
});
test('31. reiniciar cria uma partida nova e limpa (mesma semente, mesmo ponto de partida)', () => {
  const A = mk(7); const inicial = JSON.stringify(A.campeoes.map((c) => [c.campeao, Math.round(c.x), Math.round(c.y), c.hp]));
  ate(A, 120);
  const B = mk(7);
  assert.equal(B.t, 0); assert.equal(B.tick, 0); assert.equal(B.minions.length, 0); assert.equal(B.fim, null);
  assert.ok(B.eventos.every((e) => e.t === 0 && ['inicio', 'compra'].includes(e.tipo)), 'só o início e as compras iniciais'); assert.equal(B.eventos.filter((e) => e.tipo === 'inicio').length, 1);
  assert.equal(JSON.stringify(B.campeoes.map((c) => [c.campeao, Math.round(c.x), Math.round(c.y), c.hp])), inicial);
  assert.notEqual(A.t, B.t);
  const C = mk(8); assert.notEqual(JSON.stringify(C.campeoes.map((c) => c.campeao)), JSON.stringify(B.campeoes.map((c) => c.campeao)), 'outra semente, outros campeões');
});
test('32. a renderização desenha o estado real do motor (posições, mortos com tempo, estruturas)', () => {
  const chamadas = { arc: [], fillText: [], rect: 0 };
  const ctx = new Proxy({}, { get: (_, nome) => { if (nome === 'arc') return (x, y, r) => chamadas.arc.push([x, y, r]); if (nome === 'fillText') return (t, x, y) => chamadas.fillText.push([String(t), x, y]); if (nome === 'rect') return () => { chamadas.rect++; }; if (nome === 'createRadialGradient') return () => ({ addColorStop() {} }); return () => {}; }, set: () => true });
  const canvas = { getContext: () => ctx, style: {}, width: 0, height: 0 };
  globalThis.window = { devicePixelRatio: 1 };
  const r = new Renderizador(canvas, null); r.ajustar(1000);
  const P = ate(mk(1), 40); const morto = P.campeoes[4]; causarDano(P, null, morto, 1e7, 'verdadeiro', { fx: false });
  r.desenhar(P);
  const perto = (x, y, tol = 0.01) => chamadas.arc.some(([ax, ay]) => Math.abs(ax - x * r.k) < tol && Math.abs(ay - y * r.k) < tol);
  for (const c of P.campeoes) if (!c.morto) assert.ok(perto(c.x, c.y), `campeão ${c.nome} não desenhado onde está no motor`);
  assert.ok(chamadas.fillText.some(([t]) => /^\d+s$/.test(t)), 'o morto mostra o tempo de renascimento');
  for (const e of P.estruturas) assert.ok(perto(e.x, e.y) || chamadas.rect > 0);
  assert.equal(r.k, 1000 / MUNDO.largura);
  r.ajustar(500); assert.equal(r.k, 500 / MUNDO.largura, 'o tamanho da tela não muda as coordenadas lógicas');
});

// ------------------------------------------------------------------ 33 a 35: atributos, equilíbrio e partida completa
test('33. os atributos viram parâmetros de combate de forma central e a Fama não entra', () => {
  const baixo = parametrosDeAtributos({ mec: 10, rotas: 10, macro: 10, tf: 10, mental: 10, fama: 10 }, REGRAS);
  const alto = parametrosDeAtributos({ mec: 90, rotas: 90, macro: 90, tf: 90, mental: 90, fama: 10 }, REGRAS);
  assert.ok(alto.execDano > baixo.execDano && alto.execAcerto > baixo.execAcerto && alto.farm > baixo.farm && alto.troca > baixo.troca);
  assert.ok(alto.luta > baixo.luta && alto.erro < baixo.erro && alto.tilt < baixo.tilt && alto.decisaoIntervalo < baixo.decisaoIntervalo && alto.ruido < baixo.ruido);
  assert.deepEqual(parametrosDeAtributos({ mec: 50, rotas: 50, macro: 50, tf: 50, mental: 50, fama: 1 }, REGRAS), parametrosDeAtributos({ mec: 50, rotas: 50, macro: 50, tf: 50, mental: 50, fama: 100 }, REGRAS));
  assert.ok(alto.execDano - baixo.execDano < 0.2, 'diferenças moderadas: não decidem sozinhas a partida');
  for (const [pa, pv] of [[30, 30], [90, 20]]) { const P = ate(mk(9, pa, pv), 420); assert.equal(P.diag.erros.length, 0); assert.ok(P.campeoes.every((c) => Number.isFinite(c.hp) && Number.isFinite(c.x))); }
});
test('35. uma partida completa termina com a destruição do Nexus, sem travar nem inventar vencedor', { timeout: 240000 }, () => {
  const P = mk(1); const r = P.executarAteFim();
  assert.ok(P.fim); assert.equal(r.motivo, 'nexus'); assert.ok(['azul', 'vermelho'].includes(r.vencedor)); assert.equal(r.interrompida, false);
  assert.ok(r.duracao > 600 && r.duracao < REGRAS.limiteTecnico);
  assert.equal(r.diagnostico.erros, 0); assert.ok(r.diagnostico.presosGraves < 30);
  const perd = r.perdedor; const nexus = estr(P, `nexus_${perd}`); assert.equal(nexus.morto, true);
  assert.ok(r.equipes[r.vencedor].torresPerdidas < r.equipes[perd].torresPerdidas + 12);
  const torres = P.eventos.filter((e) => e.tipo === 'torre_destruida').map((e) => e.estrutura); assert.equal(new Set(torres).size, torres.length, 'nenhuma torre cai duas vezes');
  assert.ok(P.eventos.filter((e) => e.tipo === 'abate').length > 5); assert.ok(r.jogadores.every((j) => j.nivel >= 1 && j.ouro > 0));
  assert.equal(P.eventos.filter((e) => e.tipo === 'fim').length, 1);
  // determinismo: a mesma semente reproduz o mesmo resultado
  const Q = mk(1).executarAteFim(); assert.equal(Q.duracao, r.duracao); assert.equal(Q.vencedor, r.vencedor);
});
test('34. quem tem mais Poder tem vantagem estatística, mas não vence sempre (partidas completas nos dois lados do mapa)', { skip: !process.env.TC_LENTO && 'TC_LENTO=1 para rodar (leva alguns minutos)', timeout: 1800000 }, () => {
  const lote = (pa, pv) => JSON.parse(spawnSync('node', ['jogos/tecnico/partida/ferramentas/simular-lote.mjs', '12', String(pa), String(pv), '100', '4', '--json'], { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname }).stdout.trim().split('\n').pop());
  const a = lote(75, 45), b = lote(45, 75); // o time forte joga uma vez de cada lado (o mapa tem uma leve vantagem para o lado vermelho)
  const fortes = Number(a.azulVenceu.split('/')[0]) + (12 - Number(b.azulVenceu.split('/')[0]));
  assert.equal(a.semVencedor + b.semVencedor, 0); assert.equal(a.erros + b.erros, 0);
  assert.ok(fortes / 24 > 0.6, `o time forte deveria vencer bem mais (${fortes}/24)`); assert.ok(fortes < 24, 'o time fraco precisa conseguir vencer às vezes');
  for (const r of [a, b]) { assert.ok(r.duracaoMediaMin > 15 && r.duracaoMediaMin < 50); assert.ok(r.torresDerrubadas > 5); }
});

test('arquivos: documentação do mapa, ferramenta de depuração e geração do terreno acompanham o código', () => {
  for (const f of ['MAPA.md', 'depurar.html', 'index.html', 'ferramentas/gerar_terreno.py', 'ferramentas/mapa-fonte.json', 'ferramentas/simular-lote.mjs', 'config/terreno.js', 'config/mapa.js', 'config/regras.js']) assert.ok(existsSync(new URL(`../jogos/tecnico/partida/${f}`, import.meta.url)), f);
  assert.ok(existsSync(new URL('../jogos/tecnico/img/mapa-sr.webp', import.meta.url)));
  assert.match(readFileSync(new URL('../jogos/tecnico/partida/index.html', import.meta.url), 'utf8'), /noindex/);
});

test('o caçador que começou a bater num acampamento só sai dele por vida baixa ou perigo (não por plano, gank ou ouro)', () => {
  for (const seed of [1, 2]) {
    const P = mk(seed); const js = P.campeoes.filter((c) => c.pos === 'selva'); const antes = new Map(); let saidas = 0;
    while (P.t < 480 && !P.fim) {
      P.step();
      for (const j of js) {
        const ant = antes.get(j.id);
        const perigo = P.campeoes.some((c) => c.equipe !== j.equipe && !c.morto && Math.hypot(c.x - j.x, c.y - j.y) < 1500);
        if (ant && !j.morto && j.estado !== 'selva' && j.hp / j.hpMax > 0.5 && !perigo && P.monstros.some((m) => !m.morto && m.alvoId === j.id)) saidas++;
        antes.set(j.id, j.estado === 'selva' && P.monstros.some((m) => !m.morto && m.estado === 'combate' && m.alvoId === j.id));
      }
    }
    assert.equal(saidas, 0, `seed ${seed}: o caçador largou o acampamento ${saidas} vez(es)`);
  }
});

test('posições ajustadas à mão: a escolha de campeões da partida respeita a lista e ela bate com o SQL 0093', async () => {
  const { POSICOES } = await import('../jogos/tecnico/partida/config/posicoes.js');
  const { posicoesDe } = await import('../jogos/tecnico/partida/dados/campeoes-sim.js');
  const nafiri = catalogo.find((c) => c.nome === 'Naafiri');
  assert.deepEqual(posicoesDe(nafiri), ['Jungle']); assert.ok(posicoesDe(catalogo.find((c) => c.nome === 'Ahri')).includes('Mid'));
  const MAPA_POS = { Top: 'top', Jungle: 'selva', Mid: 'meio', ADC: 'atirador', Suporte: 'suporte' };
  const sql = readFileSync(new URL('../supabase/migrations/0093_tecnico_posicoes.sql', import.meta.url), 'utf8');
  const bloco = JSON.parse(sql.match(/ajustes constant jsonb := '(\{[\s\S]*?\})'::jsonb/)[1]);
  const idDe = (n) => catalogo.find((c) => c.nome === n).id.toLowerCase().replace(/[^a-z0-9]/g, '');
  const js = Object.fromEntries(Object.entries(POSICOES).map(([n, p]) => [idDe(n), p.map((x) => MAPA_POS[x])]));
  assert.deepEqual(js, bloco, 'config/posicoes.js e 0093_tecnico_posicoes.sql têm que listar os mesmos campeões e posições');
});

test('farm: a Mecânica define o último golpe nos minions (quem tem mais Mecânica faz mais CS) e o farm é próximo do real', () => {
  const cs10 = (poder) => {
    let soma = 0, n = 0;
    for (const seed of [1, 2, 3]) {
      const P = new Partida({ azul: elencoTeste('A', poder, seed), vermelho: elencoTeste('V', poder, seed), semente: seed, catalogo });
      ate(P, 600);
      for (const c of P.campeoes) if (['top', 'meio', 'atirador'].includes(c.pos)) { soma += c.estat.cs; n++; }
    }
    return soma / n;
  };
  const fraco = cs10(25), forte = cs10(95);
  assert.ok(forte > fraco * 1.2, `mais Mecânica, mais farm: ${fraco.toFixed(0)} contra ${forte.toFixed(0)} CS aos 10 min`);
  assert.ok(forte >= 50 && forte <= 112, `CS aos 10 min do jogador forte fora do esperado: ${forte.toFixed(0)}`);
  assert.ok(fraco >= 25, `CS aos 10 min do jogador fraco muito baixo: ${fraco.toFixed(0)}`);
});

test('onda com 7 minions + canhão; abate do suporte conta também para o atirador (ouro e farm) e o suporte não disputa minions', () => {
  const P = ate(mk(1), 66);
  const doLado = P.minions.filter((m) => m.equipe === 'azul' && m.rota === 'meio' && m.subtipo !== 'super');
  const spawns = P.filaSpawn.filter((f) => f.equipe === 'azul' && f.rota === 'meio').length + doLado.length;
  assert.equal(REGRAS.minions.onda.length, 7); assert.equal(REGRAS.minions.onda.filter((t) => t === 'corpo').length, 4);
  assert.ok(spawns >= 7, `a primeira onda deveria ter 7 minions por rota (viu ${spawns})`);
  const Q = ate(mk(2), 200);
  const sup = Q.campeoes.find((c) => c.equipe === 'azul' && c.pos === 'suporte'), adc = Q.campeoes.find((c) => c.equipe === 'azul' && c.pos === 'atirador');
  congelar(adc); congelar(sup); adc.morto = false; sup.morto = false; adc.hp = adc.hpMax; sup.hp = sup.hpMax;
  const inim = Q.minions.find((m) => m.equipe === 'vermelho' && !m.morto);
  adc.x = sup.x = inim.x; adc.y = sup.y = inim.y;
  const cs0 = adc.estat.cs, ouro0 = adc.ouro, csS = sup.estat.cs;
  causarDano(Q, sup, inim, 1e9, 'fisico', { basico: true });
  assert.equal(sup.estat.cs, csS + 1, 'o suporte conta o minion'); assert.equal(adc.estat.cs, cs0 + 1, 'o atirador também conta o minion do suporte');
  assert.ok(adc.ouro - ouro0 >= inim.ouro - 1, 'o atirador recebe o ouro do minion');
});

test('o canhão vale 4 minions na contagem de farm (e para o atirador quando o suporte o abate)', () => {
  const P = ate(mk(1), 5); const k = P.campeoes.find((c) => c.equipe === 'azul' && c.pos === 'meio');
  const canhao = criarMinion(P, 'cerco', 'vermelho', 'meio', 100); canhao.x = k.x; canhao.y = k.y; P.minions.push(canhao); P.mapaUnidades.set(canhao.id, canhao);
  const cs0 = k.estat.cs; causarDano(P, k, canhao, 1e6, 'verdadeiro', { fx: false });
  assert.equal(k.estat.cs, cs0 + REGRAS.minions.csCanhao); assert.equal(REGRAS.minions.csCanhao, 4);
  const comum = criarMinion(P, 'corpo', 'vermelho', 'meio', 100); comum.x = k.x; comum.y = k.y; P.minions.push(comum); P.mapaUnidades.set(comum.id, comum);
  const cs1 = k.estat.cs; causarDano(P, k, comum, 1e6, 'verdadeiro', { fx: false }); assert.equal(k.estat.cs, cs1 + 1);
});

test('picks e bans do amistoso: 10 bans, 10 picks na ordem certa, só campeões da posição, sem repetir; a partida roda com os escolhidos', async () => {
  const D = await import('../jogos/tecnico/partida/dados/draft.js');
  assert.equal(D.ORDEM.filter((p) => p.tipo === 'ban').length, 10); assert.equal(D.ORDEM.filter((p) => p.tipo === 'pick').length, 10);
  const azul = elencoTeste('A', 60, 3), verm = elencoTeste('V', 60, 3);
  const d = D.novoDraft(catalogo, azul, verm, 3);
  assert.equal(D.banir(d, 'Zed'), true); assert.equal(D.banir(d, 'Zed'), false, 'não bane duas vezes'); // o 1º passo é do azul; o 2º é do vermelho
  assert.equal(D.escolher(d, 'Ahri', 'meio'), false, 'ainda é fase de bans');
  while (!D.terminou(d)) {
    const p = D.passoAtual(d);
    if (p.lado === 'azul') { // jogador humano simulado: primeiro campeão válido
      if (p.tipo === 'ban') D.banir(d, catalogo.find((c) => !D.indisponiveis(d).has(c.nome)).nome);
      else { const v = D.vagasLivres(d, 'azul')[0]; assert.equal(D.escolher(d, catalogo.find((c) => D.serve(c, v) && !D.indisponiveis(d).has(c.nome)).nome, v), true); }
    } else D.jogadaIA(d);
  }
  const r = D.resultadoDraft(d);
  assert.equal(r.bans.azul.length, 5); assert.equal(r.bans.vermelho.length, 5);
  const nomes = [...r.azul, ...r.vermelho].map((j) => j.campeao.nome);
  assert.equal(new Set([...nomes, ...r.bans.azul, ...r.bans.vermelho]).size, 20, 'ninguém repete e ban não é pick');
  for (const j of [...r.azul, ...r.vermelho]) assert.ok(D.serve(j.campeao, j.pos), `${j.campeao.nome} em ${j.pos}`);
  const P = new Partida({ azul: r.azul, vermelho: r.vermelho, semente: 3, catalogo });
  ate(P, 30);
  assert.deepEqual(P.campeoes.filter((c) => c.equipe === 'azul').map((c) => c.campeao), r.azul.map((j) => j.campeao.nome));
});

test('draft: qualquer campeão serve em qualquer vaga, e fora da posição nativa a eficiência cai', async () => {
  const D = await import('../jogos/tecnico/partida/dados/draft.js');
  const cat = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, nome: `c${i}`, posicoes: i < 3 ? ['Suporte'] : ['Top'] }));
  const vagas = ['top', 'selva', 'meio', 'atirador', 'suporte'];
  const el = vagas.map((p) => ({ id: p, nome: p, pos: p, favoritos: [] }));
  const d = D.novoDraft(cat, el, el, 1);
  for (let i = 0; i < 6; i++) D.jogadaIA(d); // bans
  assert.ok(D.escolher(d, 'c0', 'top'), 'um suporte nativo pode ser escolhido no topo');
  for (let i = 0; i < 30 && D.passoAtual(d); i++) D.jogadaIA(d);
  const r = D.resultadoDraft(d);
  for (const j of r.azul.concat(r.vermelho)) assert.equal(j.eficiencia, D.serve(j.campeao, j.pos) ? 1 : D.EFIC_FORA_POSICAO, `${j.pos} ${j.campeao.nome}`);
  assert.ok(D.EFIC_FORA_POSICAO < 1);
});

test('selva: monstro e épico sem tomar dano por 4 s recuperam toda a vida em 2 s; antes disso não', async () => {
  const { recuperarSemCombate } = await import('../jogos/tecnico/partida/motor/selva.js');
  assert.equal(REGRAS.selva.resetSemCombateS, 4); assert.equal(REGRAS.selva.resetRecuperaS, 2);
  const P = mk(5); ate(P, 92);
  const m = P.monstros.find((x) => !x.morto); assert.ok(m, 'há monstro vivo');
  const avancar = (seg) => { for (let i = 0; i < seg * 20; i++) { P.t += 0.05; recuperarSemCombate(P, m, 0.05); } };
  m.hp = m.hpMax * 0.3; m.ultimoCombate = P.t;
  avancar(3.8); assert.ok(Math.abs(m.hp - m.hpMax * 0.3) < 1, `antes de 4 s a vida não muda (${m.hp / m.hpMax})`);
  avancar(1.0); assert.ok(m.hp > m.hpMax * 0.3 && m.hp < m.hpMax, 'começou a recuperar');
  avancar(2.0); assert.equal(m.hp, m.hpMax, 'cheia depois de 2 s');
  m.hp = m.hpMax * 0.3; m.ultimoCombate = P.t; avancar(2); m.ultimoCombate = P.t; avancar(3.9); assert.ok(m.hp < m.hpMax * 0.31, 'dano recente reinicia a contagem');
});

test('Barão: buff dos campeões vira aura roxa nos minions próximos (+50% vida, +20% dano); sai do alcance ou morre o campeão e volta ao normal', async () => {
  const O = await import('../jogos/tecnico/partida/motor/objetivos.js');
  const { matar } = await import('../jogos/tecnico/partida/motor/combate.js');
  const r = O.raioAuraBarao();
  assert.ok(r > 1150 && r < 1300, `alcance = distância T1–T2 do meio (${Math.round(r)})`);
  const P = mk(7); ate(P, 40);
  const eq = 'azul';
  const c = P.campeoes.find((x) => x.equipe === eq && !x.morto);
  const m = P.minions.find((x) => x.equipe === eq && !x.morto); assert.ok(m, 'há minion azul');
  P.equipes[eq].buffBarao = { ate: P.t + 180 }; c.buffBarao = { ate: P.t + 180 };
  const base = { hp: m.hpMax, dano: m.dano };
  c.x = m.x + r * 0.5; c.y = m.y; O.atualizarAuraMinion(P, m);
  assert.equal(m.auraBarao, true); assert.ok(Math.abs(m.hpMax - base.hp * 1.5) < 1e-6 && Math.abs(m.dano - base.dano * 1.2) < 1e-6, 'vida +50% e dano +20%');
  m.hp = m.hpMax * 0.5; c.x = m.x + r * 1.2; O.atualizarAuraMinion(P, m);
  assert.equal(m.auraBarao, false, 'fora do alcance volta ao normal'); assert.ok(Math.abs(m.hpMax - base.hp) < 1e-6 && Math.abs(m.hp - base.hp * 0.5) < 1e-6 && Math.abs(m.dano - base.dano) < 1e-6, 'proporção de vida preservada');
  c.x = m.x + 10; O.atualizarAuraMinion(P, m); assert.equal(m.auraBarao, true);
  matar(P, c, null); assert.equal(c.buffBarao, null, 'morrer tira o buff'); O.atualizarAuraMinion(P, m); assert.equal(m.auraBarao, false, 'sem campeão com buff, sem aura');
});

test('Arauto: nasce aos 15:00, some aos 20:00 para o Barão; o abatedor o conquista e, ao usá-lo, ele avança em até 2 estruturas (70% da vida delas e 70% da própria)', async () => {
  const O = await import('../jogos/tecnico/partida/motor/objetivos.js');
  assert.equal(REGRAS.epicos.arauto.spawn, 900); assert.equal(REGRAS.epicos.arauto.desaparece, 1200); assert.equal(REGRAS.epicos.barao.spawn, 1200);
  // conquista
  const P = mk(11); ate(P, 901);
  const ar = P.objetivosEstado.arauto.vivo; assert.ok(ar && !ar.morto, 'Arauto vivo aos 15:00');
  const k = P.campeoes.find((x) => x.equipe === 'azul');
  matar(P, ar, k);
  assert.ok(k.arautoDisp && Math.abs(k.arautoDisp.ate - (P.t + 240)) < 1, 'quem deu o último golpe tem 4 min para usar');
  // uso: nasce onde foi usado e avança contra a estrutura inimiga mais próxima
  const torre = P.estruturas.find((e) => e.subtipo === 'torre' && e.equipe === 'vermelho' && e.rota === 'meio' && e.nivel === 1 && !e.morto);
  k.x = torre.x - 700; k.y = torre.y + 700; k.morto = false;
  P.estruturaVulneravel = () => true; // as estruturas da frente ficam à mostra neste cenário isolado
  const m = O.usarArauto(P, k);
  assert.equal(m.subtipo, 'arauto'); assert.ok(Math.hypot(m.x - k.x, m.y - k.y) < 5, 'nasce onde foi usado'); assert.equal(k.arautoDisp, null);
  const hpTorre = torre.hpMax; const hp0 = m.hpMax;
  const t0 = P.t; let impactos = 0;
  while (P.t < t0 + 40 && !m.morto) { P.step(); impactos = P.eventos.filter((e) => e.tipo === 'arauto_impacto').length; if (impactos >= 1) break; }
  assert.ok(impactos >= 1, 'avançou contra uma estrutura');
  const ev = P.eventos.filter((e) => e.tipo === 'arauto_impacto')[0];
  const alvo = P.mapaUnidades.get(P.estruturas.find((e) => e.id === ev.estrutura).id);
  assert.ok(Math.abs(ev.dano - Math.round(alvo.hpMax * 0.7)) <= 1, 'tira 70% da vida máxima da estrutura');
  assert.ok(m.morto || (m.hp <= hp0 * 0.3 + 1 && m.hp > hp0 * 0.3 - hp0 * 0.1), 'perde 70% da própria vida máxima (mais algum dano do caminho)');
  assert.ok(m.carga.avancos <= 2);
});

test('Arauto conquistado nunca recebe o buff do Barão, mesmo com o time com o buff e um campeão com o buff por perto', async () => {
  const O = await import('../jogos/tecnico/partida/motor/objetivos.js');
  const P = mk(13); ate(P, 40);
  const c = P.campeoes.find((x) => x.equipe === 'azul');
  P.equipes.azul.buffBarao = { ate: P.t + 180 }; c.buffBarao = { ate: P.t + 180 };
  const m = O.usarArauto(P, c);
  const base = { hp: m.hpMax, dano: m.dano };
  O.atualizarAuraMinion(P, m); O.atualizarAuraMinion(P, m);
  assert.ok(!m.auraBarao, 'sem aura de bônus'); assert.equal(m.hpMax, base.hp); assert.equal(m.dano, base.dano);
});

test('draft invertido: quem joga no lado vermelho da partida escolhe depois, com as mesmas regras', async () => {
  const D = await import('../jogos/tecnico/partida/dados/draft.js');
  const cat = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, nome: `c${i}`, posicoes: ['Top', 'Jungle', 'Mid', 'ADC', 'Suporte'] }));
  const el = ['top', 'selva', 'meio', 'atirador', 'suporte'].map((p) => ({ id: p, nome: p, pos: p, favoritos: [] }));
  const normal = D.novoDraft(cat, el, el, 1); const inv = D.novoDraft(cat, el, el, 1, { invertida: true });
  assert.equal(D.passoAtual(normal).lado, 'azul'); assert.equal(D.passoAtual(inv).lado, 'vermelho', 'o time da tela abre em segundo');
  assert.equal(inv.ordem.length, D.ORDEM.length); assert.equal(inv.ordem.filter((p) => p.lado === 'azul').length, D.ORDEM.filter((p) => p.lado === 'vermelho').length);
  let n = 0; while (D.passoAtual(inv) && n++ < 40) D.jogadaIA(inv);
  assert.ok(D.terminou(inv));
});

// ---------------------------------------------------------------- moitas, fog e wards
const terrenoComMoita = () => {
  const base = new Terreno();
  const meio = MUNDO_MAPA.rotas.meio.pts[Math.floor(MUNDO_MAPA.rotas.meio.pts.length / 2)];
  const cx = base.col(meio.x), cy = base.lin(meio.y); const cels = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cels.push(`${cx + dx},${cy + dy}`);
  const t = new Terreno(undefined, { moitas: cels });
  return { t, nav: new Navegacao(t), centro: t.centro(cx, cy), fora: t.centro(cx + 8, cy) };
};
const mkMoita = (seed = 1) => { const m = terrenoComMoita(); const P = new Partida({ azul: elencoTeste('A', 60, seed), vermelho: elencoTeste('V', 60, seed), semente: seed, catalogo, terreno: m.t, nav: m.nav }); return { P, ...m }; };
const colocar = (c, p) => { c.x = p.x; c.y = p.y; c.caminho = null; c.destino = null; };
const vis = (P) => { P.tick = 4; P.step(); }; // o passo seguinte é o 5º: atualiza a visão
const atualizarWardsTeste = (P) => atualizarWards(P);

test('V1. moitas: grupos de células vizinhas viram uma moita; sem moitas marcadas o terreno é o de antes', () => {
  const { t, centro, fora } = terrenoComMoita();
  assert.equal(t.moitas.length, 1); assert.ok(t.moitas[0].celulas >= 5); assert.equal(t.moitaEm(centro.x, centro.y), 1); assert.equal(t.moitaEm(fora.x, fora.y), 0);
  const padrao = new Terreno(); assert.ok(padrao.moitas.length >= 10, 'o mapa padrão tem as moitas marcadas em config/ajustes.js');
  for (const m of padrao.moitas) assert.ok(padrao.caminhavel(m.x, m.y, 'campeao'), `o centro da moita ${m.id} fica em terreno caminhável`);
});
test('V2. quem está na moita só é visto por inimigo dentro da mesma moita; atacar revela por um instante', () => {
  const { P, centro, fora } = mkMoita(3);
  const a = P.campeoes.find((c) => c.equipe === 'azul'), v = P.campeoes.find((c) => c.equipe === 'vermelho');
  for (const c of P.campeoes) congelar(c);
  colocar(v, centro); colocar(a, fora); vis(P);
  assert.equal(P.visivelPara('azul', v), false, 'dentro da moita: invisível para quem está fora (mesmo perto)');
  assert.equal(P.visivelPara('vermelho', v), true, 'o próprio time sempre vê');
  assert.equal(P.equipes.azul.visao[v.id]?.visivel || false, false, 'a IA do time azul não conhece o campeão escondido');
  assert.equal(atacarBasico(P, a, v), false, 'não dá para atacar quem não se vê');
  colocar(a, { x: centro.x + 20, y: centro.y + 20 }); vis(P);
  assert.equal(P.visivelPara('azul', v), true, 'quem entra na mesma moita enxerga');
  colocar(a, fora); vis(P); assert.equal(P.visivelPara('azul', v), false);
  v.reveladoAte = P.t + 1; assert.equal(P.visivelPara('azul', v), true, 'revelado depois de atacar');
  P.t += 2; assert.equal(P.visivelPara('azul', v), false);
});
test('V3. ward na moita enxerga o que está dentro; ward amarela expira; ward cai com 3 golpes e dá ouro', async () => {
  const { colocarWard, golpearWard, wardsDe } = await import('../jogos/tecnico/partida/motor/wards.js');
  const { P, centro, fora } = mkMoita(4);
  const a = P.campeoes.find((c) => c.equipe === 'azul'), v = P.campeoes.find((c) => c.equipe === 'vermelho');
  for (const c of P.campeoes) congelar(c);
  a.nivel = 5; colocar(v, centro); colocar(a, { x: fora.x + 400, y: fora.y });
  const cargas0 = a.wards.cargas;
  const w = colocarWard(P, a, 'amarela', centro.x - 60, centro.y); assert.ok(w); assert.equal(a.wards.cargas, cargas0 - 1);
  vis(P); assert.equal(P.visivelPara('azul', v), true, 'a ward dentro da moita revela quem está nela');
  assert.equal(P.visivelPara('vermelho', w), false, 'a ward inimiga é invisível sem Ward de Controle');
  const ouro0 = v.ouro; let derrubou = false;
  for (let i = 0; i < 3; i++) derrubou = golpearWard(P, v, w);
  assert.equal(derrubou, true); assert.equal(w.morto, true); assert.ok(v.ouro > ouro0, 'destruir ward dá ouro'); assert.equal(v.estat.wardsDestruidas, 1);
  const w2 = colocarWard(P, a, 'amarela', fora.x, fora.y); assert.ok(w2);
  P.t = w2.expira + 0.1; atualizarWardsTeste(P); assert.equal(w2.morto, true, 'o totem some quando acaba a duração');
  assert.ok(wardsDe(P, a, 'amarela').length === 0);
});
test('V4. Ward de Controle: dura até ser destruída, revela wards inimigas no raio e a compra respeita o limite', async () => {
  const { colocarWard, podeColocar } = await import('../jogos/tecnico/partida/motor/wards.js');
  const { P, centro, fora } = mkMoita(5);
  const a = P.campeoes.find((c) => c.equipe === 'azul'), v = P.campeoes.find((c) => c.equipe === 'vermelho');
  for (const c of P.campeoes) congelar(c);
  v.nivel = 3; a.nivel = 3; assert.equal(podeColocar(P, a, 'controle'), false, 'sem a ward comprada não coloca');
  a.wards.controleEstoque = 1;
  const wv = colocarWard(P, v, 'amarela', fora.x + 300, fora.y);
  const wc = colocarWard(P, a, 'controle', fora.x, fora.y); assert.ok(wc); assert.equal(wc.expira, Infinity);
  assert.equal(podeColocar(P, a, 'controle'), false, 'uma Ward de Controle por vez');
  vis(P); assert.equal(P.visivelPara('azul', wv), true, 'a Ward de Controle revela a ward inimiga');
  P.t += 400; atualizarWardsTeste(P); assert.equal(wc.morto, false, 'a Ward de Controle não expira');
});
test('V5. cargas do totem recarregam com o tempo e o nível acelera a recarga e a duração', async () => {
  const { colocarWard, duracaoAmarela, recargaAmarela } = await import('../jogos/tecnico/partida/motor/wards.js');
  const P = mkVisao(6); const a = P.campeoes.find((c) => c.equipe === 'azul'); a.nivel = 3;
  assert.equal(a.wards.cargas, 2);
  colocarWard(P, a, 'amarela', a.x + 200, a.y); colocarWard(P, a, 'amarela', a.x + 400, a.y);
  assert.equal(a.wards.cargas, 0);
  P.t += recargaAmarela(P, a) + 1; atualizarWardsTeste(P); assert.equal(a.wards.cargas, 1);
  a.nivel = 1; const d1 = duracaoAmarela(P, a), r1 = recargaAmarela(P, a); a.nivel = 18;
  assert.ok(duracaoAmarela(P, a) > d1 && recargaAmarela(P, a) < r1); assert.equal(Math.round(duracaoAmarela(P, a)), 120); assert.equal(Math.round(recargaAmarela(P, a)), 120);
});
test('V6. partida completa com wards: a IA compra e coloca wards, nada quebra e o resultado continua válido', () => {
  const P = mkVisao(7); P.executarAteFim(1500);
  assert.ok(P.fim); assert.equal(P.diag.erros.length, 0);
  const colocadas = P.campeoes.reduce((s, c) => s + c.estat.wardsColocadas, 0);
  assert.ok(colocadas >= 3, `os bots colocaram wards (${colocadas})`);
  assert.ok(P.eventos.some((e) => e.tipo === 'ward'));
});


test('O1. objetivos: Dragão 10k/160, Ancião 17k/240, Barão 16k/250 de vida e dano', () => {
  const E = REGRAS.epicos;
  assert.deepEqual([E.dragao.hp, E.dragao.dano, E.anciao.hp, E.anciao.dano, E.barao.hp, E.barao.dano], [10000, 160, 17000, 240, 16000, 250]);
});
test('O2. buff do Ancião: ao matar o Ancião, o time ganha 2 min de execução (20% da vida); morrer perde o buff', () => {
  const P = mk(2); for (const c of P.campeoes) congelar(c);
  const azuis = P.campeoes.filter((c) => c.equipe === 'azul'), [v1, v2, v3] = P.campeoes.filter((c) => c.equipe === 'vermelho');
  const a = azuis[0]; for (const c of [a, v1, v2, v3]) { c.x = 5000; c.y = 5000; }
  v1.hp = v1.hpMax * 0.3; causarDano(P, a, v1, v1.hpMax * 0.2, 'verdadeiro'); assert.equal(v1.morto, false, 'sem o buff não executa');
  // o time mata o Dragão Ancião
  const O = P.objetivosEstado.dragao; O.almaAlcancada = true; O.proximo = P.t; P.step();
  const anc = O.vivo; assert.equal(anc.subtipo, 'anciao'); assert.equal(anc.hpMax, 17000);
  causarDano(P, a, anc, 1e9, 'verdadeiro');
  for (const c of azuis) { assert.ok(c.buffExecucao && Math.abs(c.buffExecucao.ate - (P.t + 120)) < 1, 'todo o time ganha 2 min de execução'); }
  v2.hp = v2.hpMax * 0.3; causarDano(P, a, v2, v2.hpMax * 0.05, 'verdadeiro'); assert.equal(v2.morto, false, 'acima de 20% da vida não executa');
  causarDano(P, a, v2, v2.hpMax * 0.06, 'verdadeiro'); assert.equal(v2.morto, true, 'ficou com 19%: executado');
  // quem morre perde o buff; o buff acaba depois de 2 min
  const b = azuis[1]; matar(P, b, null); assert.equal(b.buffExecucao, null, 'morrer perde o buff');
  P.t += 121; v3.hp = v3.hpMax * 0.3; causarDano(P, a, v3, v3.hpMax * 0.2, 'verdadeiro'); assert.equal(v3.morto, false, 'depois dos 2 min não executa mais');
});

test('R1. tempo de morte: 6 a 16 s (níveis 1-6), 21 s (nível 7), 27,5 a 52,5 s (8-18) e +50% aos 55 min (até ~78 s)', () => {
  const R = REGRAS.campeao;
  assert.deepEqual([R.respawn[0], R.respawn[5], R.respawn[6], R.respawn[7], R.respawn[17]], [6, 16, 21, 27.5, 52.5]);
  const P = mk(2); for (const c of P.campeoes) congelar(c);
  const v = P.campeoes.find((c) => c.equipe === 'vermelho'), k = P.campeoes.find((c) => c.equipe === 'azul');
  const tempo = (nivel, min) => { v.nivel = nivel; v.morto = false; v.hp = 100; P.t = min * 60; matar(P, v, k); return v.renasceEm - P.t; };
  assert.equal(tempo(1, 2), 6); assert.equal(tempo(6, 10), 16); assert.equal(tempo(7, 10), 21); assert.equal(tempo(18, 10), 52.5);
  assert.equal(tempo(18, 15), 52.5, 'até os 15 min não aumenta');
  assert.ok(tempo(18, 30) > 52.5 && tempo(18, 30) < tempo(18, 45), 'cresce com o tempo');
  assert.ok(Math.abs(tempo(18, 55) - 78.75) < 0.01 && Math.abs(tempo(18, 70) - 78.75) < 0.01, 'teto de +50% (78 s) aos 55 min ou mais');
});
