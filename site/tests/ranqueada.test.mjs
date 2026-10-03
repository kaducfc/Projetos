import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeSupabase, installMemoryStorage } from './fake-supabase.js';
import * as platform from '../shared/platform.js';
import { ELOS, vantagens, nivelElo, divisaoDe, nomeDivisao, ajustarPdr, GANHO_POR_ELO, bonusCarreira } from '../shared/ranked.js';
import { shareText as shareRunetermo } from '../jogos/runetermo/js/logic.js';
import { shareText as shareCampeao } from '../jogos/campeao/js/logic.js';
import * as cblol from '../jogos/lendas-do-cblol/js/logic.js';

const sql15 = readFileSync(new URL('../supabase/migrations/0015_ranqueada_pdr.sql', import.meta.url), 'utf8');

test('ranqueada: 10 elos, divisões de 100 PDR e Mestre depois do Diamante 1', () => {
  assert.deepEqual(ELOS.map((e) => e.id), ['ferro', 'bronze', 'prata', 'ouro', 'platina', 'esmeralda', 'diamante', 'mestre', 'grao-mestre', 'desafiante']);
  assert.deepEqual(divisaoDe(0), { elo: 'ferro', divisao: 3, pdr: 0 });
  assert.deepEqual(divisaoDe(345), { elo: 'bronze', divisao: 3, pdr: 45 });
  assert.deepEqual(divisaoDe(445), { elo: 'bronze', divisao: 2, pdr: 45 });
  assert.equal(nomeDivisao(divisaoDe(2099)), 'Diamante 1');
  assert.deepEqual(divisaoDe(2440, 'desafiante'), { elo: 'desafiante', divisao: null, pdr: 340 });
  assert.equal(divisaoDe(2440).elo, 'mestre');
  // Percentual de ganho igual ao do banco.
  const sql18 = readFileSync(new URL('../supabase/migrations/0018_ranqueada_ganho_por_elo.sql', import.meta.url), 'utf8');
  const pct = sql18.match(/select \(array\[([\d, ]+)\]\)\[least\(greatest\(nivel/)[1].split(',').map(Number);
  assert.deepEqual(GANHO_POR_ELO, pct);
  // Mesma conversão do banco (site_rk_ajustar): ganhos com o % do elo, perdas iguais.
  assert.equal(ajustarPdr(5, 0), 5);
  assert.equal(ajustarPdr(38, 0), 38);
  assert.equal(ajustarPdr(20, 3), 16); // Ouro: 80%
  assert.equal(ajustarPdr(38, 4), 27); // Platina: 70%
  assert.equal(ajustarPdr(38, 6), 23); // Diamante: 60%
  assert.equal(ajustarPdr(5, 9), 3); // Desafiante: 50%
  for (let n = 0; n <= 9; n++) {
    assert.equal(ajustarPdr(-2, n), -2);
    assert.equal(ajustarPdr(-25, n), -25);
  }
});

test('ranqueada: benefícios de cada elo somam com os de baixo', () => {
  const base = { categoriaRunetermo: false, dadosBonus: 1, dicasCampeao: 1, tentativasRunetermo: 6, tentativasCampeao: 8 };
  assert.deepEqual(vantagens(null), base);
  assert.deepEqual(vantagens('ferro'), base);
  assert.deepEqual(vantagens('bronze'), base);
  assert.equal(vantagens('prata').categoriaRunetermo, true);
  assert.equal(vantagens('ouro').dadosBonus, 2);
  assert.equal(vantagens('platina').dicasCampeao, 2);
  assert.equal(vantagens('esmeralda').dicasCampeao, 3);
  assert.equal(vantagens('diamante').tentativasRunetermo, 7);
  assert.deepEqual(vantagens('desafiante'), { categoriaRunetermo: true, dadosBonus: 3, dicasCampeao: 3, tentativasRunetermo: 7, tentativasCampeao: 9 });
  assert.equal(nivelElo('desafiante'), 9);
  assert.deepEqual([null, 'ferro', 'bronze', 'diamante', 'mestre', 'desafiante'].map(bonusCarreira), [0, 0, 1, 6, 7, 9]);
  // O servidor dá as mesmas tentativas e dicas nos jogos diários.
  const sql16 = readFileSync(new URL('../supabase/migrations/0016_diarios_servidor.sql', import.meta.url), 'utf8');
  assert.match(sql16, /then 6 \+ \(niv >= 6\)::int else 8 \+ \(niv >= 9\)::int end/);
  assert.match(sql16, /then 1 \+ \(niv >= 4\)::int \+ \(niv >= 5\)::int else 0 end/);
});

test('benefícios nos jogos: tentativas a mais no texto de compartilhar e vários dados no Lendas do CBLOL', () => {
  assert.match(shareRunetermo({ name: 'Runetermo', number: 1, guesses: ['abc'], answer: 'abc', won: true, max: 7 }), /1\/7/);
  assert.match(shareRunetermo({ name: 'Runetermo', number: 1, guesses: ['abc'], answer: 'abc', won: true }), /1\/6/);
  const { times } = JSON.parse(readFileSync(new URL('../jogos/lendas-do-cblol/dados/times.json', import.meta.url)));
  const jogo = cblol.novoJogo();
  jogo.dadosTotal = 3;
  let usados = 0;
  for (let i = 0; i < 6; i++) {
    cblol.rolar(jogo, times);
    const op = cblol.opcoesBonus(jogo, times);
    const tipo = op.ano.length ? 'ano' : op.org.length ? 'org' : null;
    if (tipo && cblol.usarBonus(jogo, times, tipo)) usados++;
    jogo.atual = null;
  }
  assert.equal(usados, 3);
  assert.equal(cblol.dadosRestantes(jogo), 0);
  // Save antigo (bonusUsado: true) continua valendo como 1 dado usado de 1.
  assert.equal(cblol.dadosRestantes({ bonusUsado: true }), 0);
  assert.equal(cblol.dadosRestantes({ bonusUsado: false }), 1);
  assert.ok(shareCampeao);
});

test('ranqueada no site: elo da conta, situação do dia, ranking com filtro e jogos diários no servidor', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'r@example.com', password: 'segredo123', username: 'Ranqueado' });
  assert.equal(platform.getUser().elo, null);
  const uid = platform.getUser().id;
  sb.db.site_rk.push({ user_id: uid, pts: 1045 }); // Ouro 2, 45 PDR
  const st = await platform.rankedStatus();
  assert.equal(st.elo, 'ouro');
  assert.equal(platform.getUser().elo, 'ouro');
  assert.equal(nomeDivisao(divisaoDe(st.pts, st.elo)), 'Ouro 2');
  const geral = await platform.ranking('geral');
  assert.equal(geral.lista[0].username, 'Ranqueado');
  assert.equal((await platform.ranking('geral', 'prata')).lista.length, 0);
  assert.equal((await platform.ranking('geral', 'ouro')).lista.length, 1);
  await assert.rejects(platform.ranking('anual'));
  // Runetermo no servidor: a resposta só aparece no fim.
  assert.ok(platform.diarioNoServidor());
  const e0 = await platform.diarioAbrir('runetermo');
  assert.equal(e0.tamanho, 5);
  assert.equal(e0.resposta, null);
  const e1 = await platform.diarioChute('runetermo', 'grupo');
  assert.deepEqual(e1.chutes[0].resultado, ['ok', 'ok', 'miss', 'near', 'near']);
  const e2 = await platform.diarioChute('runetermo', 'GROMP');
  assert.equal(e2.status, 'ganhou');
  assert.equal(e2.pdr, 28);
  await assert.rejects(platform.diarioChute('runetermo', 'TESTE'), /já terminou/);
});

test('zerar a ranqueada: só administrador', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'z@example.com', password: 'segredo123', username: 'Comum' });
  await assert.rejects(platform.adminResetRanked(1), /não tem permissão/);
});

test('ranqueada: ingresso (vaga) da Carreira e do Lendas, 3 por dia em cada', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  assert.equal(await platform.rankedIniciar(), null); // sem conta: não vale
  await platform.signUp({ email: 'i@example.com', password: 'segredo123', username: 'Inicio' });
  const r = await platform.rankedIniciar();
  assert.match(r.token, /^[0-9a-f-]{36}$/);
  assert.equal(r.numero, 1);
  await platform.rankedIniciar();
  assert.equal((await platform.rankedIniciar()).restantes, 0);
  assert.equal((await platform.rankedIniciar()).token, null); // 4ª começada: não vale
  assert.equal((await platform.rankedIniciar('cblol')).numero, 1); // Lendas tem as suas 3
  // No banco: vaga da própria conta, do jogo, de hoje e não usada; Lendas só no Oculto.
  assert.match(sql15, /i\.id = tok::uuid and i\.user_id = new\.user_id and i\.dia = hoje and i\.jogo = new\.game_id and i\.usado_em is null/);
  assert.match(sql15, /coalesce\(new\.summary->>'modo', ''\) <> 'oculto' then return new/);
  const main = readFileSync(new URL('../jogos/carreira-no-rift/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /ranked: state\.ranked\?\.token/);
  const lendas = readFileSync(new URL('../jogos/lendas-do-cblol/js/main.js', import.meta.url), 'utf8');
  assert.match(lendas, /platform\.rankedIniciar\(GAME_ID\)/);
});

test('vigilância da ranqueada: só administrador anula partida e tira jogador', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'v@example.com', password: 'segredo123', username: 'Vigia' });
  await assert.rejects(platform.adminRanked(7), /não tem permissão/);
  sb.admins.add(sb.db.site_profiles[0].id);
  sb.db.site_ranked_partidas = [{ id: 1, username: 'Vigia', score: 2500, criado: new Date().toISOString() }];
  assert.equal((await platform.adminRanked(7)).partidas.length, 1);
  await platform.adminAnularPartida(1);
  assert.equal((await platform.adminRanked(7)).partidas.length, 0);
  await platform.adminBanirRanked('vigia', { motivo: 'teste' });
  assert.equal((await platform.adminRanked(7)).banidos[0].username, 'Vigia');
  await platform.adminBanirRanked('Vigia', { banir: false });
  assert.equal((await platform.adminRanked(7)).banidos.length, 0);
  await assert.rejects(platform.adminBanirRanked('ninguem'), /Não existe conta/);
  const sql = readFileSync(new URL('../supabase/migrations/0013_ranqueada_seguranca.sql', import.meta.url), 'utf8');
  assert.match(sql, /i\.usado_em is null/); // vaga usada uma vez só, para sempre
});
