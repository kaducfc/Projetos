import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GRUPOS, FAMILIAS_CAMPEAO, norm, aleatorio, criarPuzzle, puzzleDoDia, novoJogo, alternar, conferir, dica, podeDica, misturar,
  palavrasRestantes, erros, pontos, textoCompartilhar, salvar, restaurar, TAMANHO, MAX_MARCADAS, PADROES, MAX_ERROS,
} from '../jogos/conexoes/js/logic.js';
import { CAMPEOES } from '../jogos/conexoes/js/campeoes.js';

test('conexões: tabela de campeões consistente (sem repetidos, regiões e rotas conhecidas)', () => {
  const nomes = CAMPEOES.map((c) => norm(c.nome));
  assert.equal(new Set(nomes).size, nomes.length, 'campeão repetido');
  assert.ok(CAMPEOES.length >= 140);
  const regioes = new Set(['Demacia', 'Noxus', 'Ionia', 'Freljord', 'Piltover', 'Zaun', 'Shurima', 'Targon', 'Águas de Sentina', 'Ilhas das Sombras', 'Bandópolis', 'Vazio', 'Ixtal', 'Runeterra']);
  for (const c of CAMPEOES) {
    assert.ok(regioes.has(c.regiao), `${c.nome}: região ${c.regiao}`);
    assert.ok(['Topo', 'Selva', 'Meio', 'Atirador', 'Suporte', '-'].includes(c.rota), `${c.nome}: rota ${c.rota}`);
    assert.ok(['Mago', 'Assassino', 'Atirador', 'Lutador', 'Tanque', 'Suporte'].includes(c.classe), `${c.nome}: classe ${c.classe}`);
  }
});

test('conexões: biblioteca grande e bem formada (grupos de 4+ palavras, sem repetição, famílias e dificuldades)', () => {
  assert.ok(GRUPOS.length >= 90, `${GRUPOS.length} grupos`);
  const palavras = new Set();
  for (const g of GRUPOS) {
    assert.ok(g.tit && g.fam, `grupo sem título/família: ${JSON.stringify(g.tit)}`);
    assert.ok([1, 2, 3, 4].includes(g.dif), `${g.tit}: dificuldade`);
    assert.ok(g.p.length >= TAMANHO, `${g.tit}: só ${g.p.length} palavras`);
    assert.equal(new Set(g.p.map(norm)).size, g.p.length, `${g.tit}: palavra repetida`);
    for (const w of g.p) { assert.ok(w.length <= 32 && w === w.trim() && w.length >= 1, `${g.tit}: "${w}"`); palavras.add(norm(w)); }
  }
  for (const d of [1, 2, 3, 4]) assert.ok(GRUPOS.filter((g) => g.dif === d).length >= 6, `dificuldade ${d}`);
  assert.ok(palavras.size >= 450, `${palavras.size} palavras diferentes`);
  assert.ok(new Set(GRUPOS.map((g) => g.fam)).size >= 25, 'famílias');
  const titulos = GRUPOS.map((g) => g.tit.toLowerCase());
  // grupos escritos à mão repetem título só quando de propósito diferente (famílias diferentes cobrem isso)
  assert.equal(new Set(titulos).size, titulos.length, 'título repetido');
});

test('conexões: todo quebra-cabeça tem 16 palavras únicas, 4 grupos de famílias diferentes e cada palavra só cabe no grupo dela', () => {
  const usados = new Set(); const padroes = new Set();
  for (let s = 1; s <= 2500; s++) {
    const p = criarPuzzle(aleatorio(s));
    assert.equal(p.grupos.length, 4);
    assert.equal(p.palavras.length, 16);
    assert.equal(new Set(p.palavras.map(norm)).size, 16);
    assert.equal(new Set(p.grupos.map((g) => g.fam)).size, 4, 'famílias repetidas');
    assert.ok(p.grupos.filter((g) => FAMILIAS_CAMPEAO.has(g.fam)).length <= 2, 'campeões demais');
    p.grupos.forEach((g, i) => {
      assert.equal(g.palavras.length, TAMANHO);
      assert.equal(g.ordem, i);
      if (i) assert.ok(g.dif >= p.grupos[i - 1].dif, 'ordem de dificuldade');
      const original = GRUPOS.find((x) => x.id === g.id);
      for (const w of g.palavras) {
        assert.ok(original.chaves.has(norm(w)), `${w} não é de ${g.tit}`);
        // a palavra não cabe em nenhum dos outros 3 grupos
        for (const o of p.grupos) if (o !== g) assert.ok(!GRUPOS.find((x) => x.id === o.id).chaves.has(norm(w)), `${w} cabe também em ${o.tit}`);
        usados.add(norm(w));
      }
    });
    padroes.add(p.grupos.map((g) => g.dif).join(''));
  }
  assert.ok(usados.size >= 440, `${usados.size} palavras usadas em 2500 jogos`);
  assert.ok(padroes.size >= 6, `${padroes.size} padrões de dificuldade`);
  assert.ok(PADROES.length >= 6);
});

test('conexões: o desafio do dia é igual para todos no mesmo dia e muda de um dia para o outro', () => {
  const a = puzzleDoDia('2026-10-12'); const b = puzzleDoDia('2026-10-12'); const c = puzzleDoDia('2026-10-13');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.palavras, c.palavras);
  const dias = new Set();
  for (let d = 1; d <= 60; d++) dias.add(puzzleDoDia(`2026-11-${String(d).padStart(2, '0')}`).palavras.join('|'));
  assert.equal(dias.size, 60);
});

const jogo = (s = 7, maxDicas = 8) => novoJogo(criarPuzzle(aleatorio(s)), { maxDicas });
const selecionar = (est, palavras) => { for (const w of palavras) alternar(est, w); };

test('conexões: selecionar (até 4, clicar de novo desmarca) e acertar um grupo', () => {
  const est = jogo();
  const [g0, g1] = est.puzzle.grupos;
  alternar(est, g0.palavras[0]); alternar(est, g0.palavras[1]);
  assert.deepEqual(est.sel, [g0.palavras[0], g0.palavras[1]]);
  alternar(est, g0.palavras[1]);
  assert.deepEqual(est.sel, [g0.palavras[0]]);
  selecionar(est, g0.palavras.slice(1));
  assert.equal(est.sel.length, 4);
  alternar(est, g1.palavras[0]); // com 4 já selecionadas, a 5ª é ignorada
  assert.equal(est.sel.length, 4);
  const r = conferir(est);
  assert.equal(r.tipo, 'ok'); assert.equal(r.grupo, g0);
  assert.deepEqual(est.resolvidos, [0]); assert.equal(est.tentativas, 1); assert.deepEqual(est.sel, []);
  assert.equal(palavrasRestantes(est).length, 12);
  assert.ok(!palavrasRestantes(est).includes(g0.palavras[0]));
  alternar(est, g0.palavras[0]); assert.deepEqual(est.sel, [], 'palavra já resolvida não seleciona');
  assert.deepEqual(conferir(est), { tipo: 'nada' });
});

test('conexões: errar conta tentativa, avisa "falta só uma" e acabar os 4 grupos termina o jogo', () => {
  const est = jogo(11);
  const [g0, g1, g2, g3] = est.puzzle.grupos;
  selecionar(est, [g0.palavras[0], g0.palavras[1], g1.palavras[0], g1.palavras[1]]);
  let r = conferir(est);
  assert.equal(r.tipo, 'erro'); assert.equal(r.quase, false); assert.equal(est.tentativas, 1); assert.deepEqual(est.sel, []);
  selecionar(est, [g0.palavras[0], g0.palavras[1], g0.palavras[2], g1.palavras[0]]);
  r = conferir(est);
  assert.equal(r.tipo, 'erro'); assert.equal(r.quase, true); assert.equal(est.quase, true);
  for (const g of [g2, g0, g3, g1]) { selecionar(est, g.palavras); assert.equal(conferir(est).tipo, 'ok'); }
  assert.equal(est.fim, true);
  assert.equal(est.tentativas, 6); assert.equal(erros(est), 2);
  assert.deepEqual(est.resolvidos, [2, 0, 3, 1]);
  assert.equal(pontos(est), 80);
  assert.deepEqual(est.historico.map((h) => h.tipo), ['erro', 'erro', 'ok', 'ok', 'ok', 'ok']);
  alternar(est, g0.palavras[0]); assert.deepEqual(est.sel, []); // jogo acabado
});

test('conexões: dicas marcam 2 palavras do mesmo grupo, depois 1 (até 3) e passam para o próximo grupo', () => {
  const est = jogo(5);
  const [g0, g1] = est.puzzle.grupos;
  const d1 = dica(est);
  assert.equal(d1.grupo, g0); assert.equal(d1.palavras.length, 2); assert.equal(est.dicas, 1);
  const d2 = dica(est);
  assert.equal(d2.grupo, g0); assert.equal(d2.palavras.length, 1);
  assert.equal(g0.palavras.filter((w) => est.marcadas.includes(w)).length, MAX_MARCADAS);
  const d3 = dica(est);
  assert.equal(d3.grupo, g1); // o primeiro grupo já tem o máximo de marcas
  assert.equal(est.dicas, 3);
  // achar o grupo com marcas: as marcas dele deixam de importar
  selecionar(est, g0.palavras); conferir(est);
  assert.deepEqual(est.historico.map((h) => h.tipo), ['dica', 'dica', 'dica', 'ok']);
  let n = 0; while (podeDica(est) && n++ < 20) dica(est);
  assert.equal(podeDica(est), false);
  assert.equal(dica(est), null);
  assert.equal(pontos(est) , 100 - 5 * est.dicas);
});

test('conexões: embaralhar só mexe nas palavras que ainda estão no tabuleiro; salvar e restaurar mantêm tudo', () => {
  const est = jogo(9);
  const g = est.puzzle.grupos[1];
  selecionar(est, g.palavras); conferir(est);
  const antes = [...palavrasRestantes(est)];
  misturar(est, aleatorio(3));
  const depois = palavrasRestantes(est);
  assert.deepEqual([...depois].sort(), [...antes].sort());
  assert.notDeepEqual(depois, antes);
  dica(est); alternar(est, depois[0]);
  const guardado = JSON.parse(JSON.stringify(salvar(est)));
  const p = est.puzzle;
  const igual = restaurar(guardado, p);
  assert.deepEqual(igual.sel, est.sel); assert.deepEqual(igual.resolvidos, est.resolvidos); assert.deepEqual(igual.marcadas, est.marcadas);
  assert.equal(igual.tentativas, est.tentativas); assert.equal(igual.dicas, est.dicas); assert.deepEqual(palavrasRestantes(igual), depois);
  // um andamento de outro quebra-cabeça não é aproveitado
  assert.deepEqual(restaurar(guardado, puzzleDoDia('2030-01-01')).resolvidos, []);
  assert.deepEqual(restaurar(null, p).resolvidos, []);
});

test('conexões: texto para compartilhar não revela as palavras', () => {
  const est = jogo(13);
  dica(est); dica(est);
  const [g0, g1, g2, g3] = est.puzzle.grupos;
  selecionar(est, [g0.palavras[0], g1.palavras[0], g2.palavras[0], g3.palavras[0]]); conferir(est);
  for (const g of est.puzzle.grupos) { selecionar(est, g.palavras); conferir(est); }
  const txt = textoCompartilhar(est, { titulo: 'Conexões do League', dia: '12/10/2026', link: 'https://exemplo/' });
  assert.match(txt, /^Conexões do League · 12\/10\/2026\n💡💡⬛🟨🟩🟦🟪\n5 tentativas · 2 dicas\nhttps:\/\/exemplo\/$/);
  for (const w of est.puzzle.palavras) assert.ok(!txt.includes(w));
});

test('conexões: o jogo está no catálogo (só administrador por enquanto) e a interface está traduzida nos 5 idiomas', async () => {
  const { GAMES } = await import('../shared/config.js');
  const jogoCfg = GAMES.find((g) => g.id === 'conexoes');
  assert.ok(jogoCfg && jogoCfg.status === 'live' && jogoCfg.path === 'jogos/conexoes/');
  const hub = readFileSync(new URL('../js/hub.js', import.meta.url), 'utf8');
  assert.match(hub, /conexoes: `<div class="cv cv-cx">/);
  const { __usarDicionario, traduzirTexto, t, LANGS } = await import('../shared/i18n.js');
  const fonte = readFileSync(new URL('../jogos/conexoes/js/main.js', import.meta.url), 'utf8');
  const textos = new Set([...fonte.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")));
  textos.add(jogoCfg.name); textos.add(jogoCfg.tagline); textos.add(jogoCfg.kind);
  textos.add('Conexões do League · Rift Arcade'); textos.add('CONEXÕES'); textos.add('DO LEAGUE');
  assert.ok(textos.size >= 25);
  const ids = LANGS.map((l) => l.id).filter((id) => id !== 'pt-BR');
  for (const id of ids) {
    const d = (await import(`../shared/i18n/${id}.js`)).default;
    __usarDicionario(d, id);
    const faltam = [...textos].filter((x) => /[A-Za-zÀ-ú]{3}/.test(x) && traduzirTexto(x) == null);
    assert.deepEqual(faltam, [], `${id}: sem tradução`);
    for (const x of textos) {
      const vars = (x.match(/\{\w+\}/g) || []).sort().join();
      const trad = traduzirTexto(x);
      if (trad != null) assert.equal((trad.match(/\{\w+\}/g) || []).sort().join(), vars, `${id}: ${x}`);
    }
  }
  __usarDicionario((await import('../shared/i18n/en.js')).default, 'en');
  assert.equal(t('Conexões do League'), 'League Connections');
  assert.equal(t('Você acertou em {t} tentativas e {d}.', { t: 5, d: t('2 dicas'.replace('2', '{n}'), { n: 2 }) }), 'You got it in 5 attempts and 2 hints.');
});

import { baseConexoes, vantagens } from '../shared/ranked.js';
const errar = (est) => { // 4 palavras de grupos diferentes (nunca é um grupo certo)
  const restantes = palavrasRestantes(est);
  const porGrupo = est.puzzle.grupos.map((g) => restantes.filter((w) => g.palavras.includes(w)));
  const escolha = porGrupo.flatMap((p) => p.slice(0, 1)).slice(0, TAMANHO);
  const extra = restantes.filter((w) => !escolha.includes(w)).slice(0, TAMANHO - escolha.length);
  est.sel = []; selecionar(est, [...escolha, ...extra]); return conferir(est);
};

test('conexões: no máximo 3 erros; o 4º erro acaba a partida (perde, 0 pontos)', () => {
  const est = jogo(21);
  assert.equal(MAX_ERROS, 3);
  for (let i = 1; i <= 3; i++) { const r = errar(est); assert.equal(r.tipo, 'erro'); assert.equal(est.fim, false, `erro ${i}`); assert.equal(erros(est), i); }
  assert.equal(pontos(est), 70);
  const r4 = errar(est);
  assert.equal(r4.perdeu, true); assert.equal(est.fim, true); assert.equal(est.perdeu, true); assert.equal(pontos(est), 0);
  assert.equal(conferir(est).tipo, 'nada'); assert.equal(podeDica(est), false);
  assert.match(textoCompartilhar(est, { titulo: 'X' }), /perdeu/);
  const salvo = restaurar(salvar(est), est.puzzle);
  assert.equal(salvo.perdeu, true); assert.equal(salvo.fim, true);
});

test('conexões: 1 dica por partida (2 do Platina para cima) e a pontuação desconta 5 por dica', () => {
  assert.equal(vantagens('ouro').dicasConexoes, 1); assert.equal(vantagens(null).dicasConexoes, 1);
  assert.equal(vantagens('platina').dicasConexoes, 2); assert.equal(vantagens('desafiante').dicasConexoes, 2);
  const um = jogo(5, 1);
  assert.ok(dica(um)); assert.equal(podeDica(um), false); assert.equal(dica(um), null); assert.equal(um.dicas, 1);
  const dois = jogo(5, 2);
  dica(dois); assert.equal(podeDica(dois), true); dica(dois); assert.equal(podeDica(dois), false);
  for (const g of dois.puzzle.grupos) { selecionar(dois, g.palavras); conferir(dois); }
  assert.equal(dois.fim, true); assert.equal(dois.perdeu, false); assert.equal(pontos(dois), 90);
  const certo = jogo(9, 1);
  for (const g of certo.puzzle.grupos) { selecionar(certo, g.palavras); conferir(certo); }
  assert.equal(pontos(certo), 100);
  // partida salva sem o campo mantém o padrão de 1 dica
  assert.equal(restaurar(salvar(certo), certo.puzzle).maxDicas, 1);
});

test('conexões: PDR de tabela (perfeito +30; 1 dica +22; 1 erro +15; 2 erros +5; 3 erros −10; perdeu −20)', () => {
  assert.equal(baseConexoes(0, true), -20);
  assert.deepEqual([100, 95, 90, 80, 70].map((p) => baseConexoes(p)), [30, 22, 15, 5, -10]);
  assert.deepEqual([85, 75, 65, 30].map((p) => baseConexoes(p)), [10, -3, -10, -10]); // 1 erro + 1 dica, 2 erros + 1 dica, abaixo de 70
  for (let p = 30; p < 100; p++) assert.ok(baseConexoes(p + 1) >= baseConexoes(p), `crescente em ${p}`);
  assert.ok(baseConexoes(30) > baseConexoes(0, true), 'vencer sempre rende mais que perder');
  // as pontuações reais da partida batem com a tabela: perfeito 100, 1 dica 95, 1 erro 90, 2 erros 80, 3 erros 70
  for (const [erros_, dicas_, esperado] of [[0, 0, 100], [0, 1, 95], [1, 0, 90], [2, 0, 80], [3, 0, 70]]) assert.equal(100 - 10 * erros_ - 5 * dicas_, esperado);
});

import { gerarSql } from '../scripts/conexoes-sql.mjs';
test('conexões: os grupos no SQL do servidor (0076) são os mesmos da biblioteca do jogo (rode node scripts/conexoes-sql.mjs se falhar)', () => {
  const arquivo = readFileSync(new URL('../supabase/migrations/0076_conexoes_grupos.sql', import.meta.url), 'utf8');
  assert.equal(arquivo, gerarSql());
  const sql = readFileSync(new URL('../supabase/migrations/0075_conexoes_ranqueada.sql', import.meta.url), 'utf8');
  assert.match(sql, /1 \+ \(site_rk_nivel_de\(uid\) >= 4\)::int/); // 2 dicas do Platina para cima (índice 4 = Platina)
  assert.match(sql, /if c\.erros \+ 1 > 3 then/); // 4º erro perde
  assert.match(sql, /when pontos >= 95 then round\(22 \+ \(pontos - 95\) \* 8 \/ 5\.0\)/);
  assert.match(sql, /on conflict \(user_id, dia, jogo, n\) do nothing/);
});
