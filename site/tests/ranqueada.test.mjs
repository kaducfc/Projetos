import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeSupabase, installMemoryStorage } from './fake-supabase.js';
import * as platform from '../shared/platform.js';
import { ELOS, vantagens, nivelElo, VAGAS_DESAFIANTE, minimoParaFicar } from '../shared/ranked.js';
import { shareText as shareRunetermo } from '../jogos/runetermo/js/logic.js';
import { shareText as shareCampeao } from '../jogos/campeao/js/logic.js';
import * as cblol from '../jogos/lendas-do-cblol/js/logic.js';

test('ranqueada: médias e vagas do site batem com as do banco (0006_ranqueada.sql)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0007_ranqueada_pontos.sql', import.meta.url), 'utf8');
  for (const e of ELOS.slice(1)) assert.match(sql, new RegExp(`when '${e.id}' then ${e.pontos}\\b`), e.id);
  assert.match(sql, new RegExp(`vagas constant int := ${VAGAS_DESAFIANTE};`));
  assert.equal(minimoParaFicar('ouro'), 325);
  assert.match(sql, /site_ranked_limiar\(elo\) \/ 6/);
  assert.equal(minimoParaFicar('bronze'), 0);
  assert.equal(minimoParaFicar('desafiante'), 0);
  assert.deepEqual(ELOS.map((e) => e.id), ['bronze', 'prata', 'ouro', 'platina', 'diamante', 'desafiante']);
  assert.ok(ELOS.every((e, i) => i === 0 || e.pontos > ELOS[i - 1].pontos), 'cada elo pede mais que o anterior');
});

test('ranqueada: benefícios de cada elo somam com os de baixo', () => {
  const base = { categoriaRunetermo: false, dadosBonus: 1, dicasCampeao: 1, tentativasRunetermo: 6, tentativasCampeao: 8 };
  assert.deepEqual(vantagens(null), base);
  assert.deepEqual(vantagens('bronze'), base);
  assert.equal(vantagens('prata').categoriaRunetermo, true);
  assert.equal(vantagens('ouro').dadosBonus, 2);
  assert.equal(vantagens('platina').dicasCampeao, 2);
  assert.equal(vantagens('diamante').tentativasRunetermo, 7);
  assert.deepEqual(vantagens('desafiante'), { categoriaRunetermo: true, dadosBonus: 3, dicasCampeao: 2, tentativasRunetermo: 7, tentativasCampeao: 9 });
  assert.equal(nivelElo('desafiante'), 5);
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

test('ranqueada no site: situação do dia, elo da conta e ranking', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'r@example.com', password: 'segredo123', username: 'Ranqueado' });
  assert.equal(platform.getUser().elo, null);
  const ids = [];
  for (const s of [400, 900, 650, 1200]) ids.push((await platform.recordResult('carreira-no-rift', { score: s })).clientId);
  const st = await platform.rankedStatus();
  assert.equal(st.hoje.partidas, 3);
  assert.equal(st.hoje.melhor, 900);
  assert.ok(st.hoje.validas.includes(ids[2]));
  assert.ok(!st.hoje.validas.includes(ids[3]), 'a 4ª carreira do dia não vale');
  assert.equal(platform.getUser().elo, 'bronze');
  sb.db.site_ranked.push({ user_id: platform.getUser().id, elo: 'ouro' });
  await platform.rankedStatus();
  assert.equal(platform.getUser().elo, 'ouro');
  const r = await platform.ranking('semanal');
  assert.equal(r.lista[0].username, 'Ranqueado');
  await assert.rejects(platform.ranking('anual'));
});

test('zerar a ranqueada: só administrador', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'z@example.com', password: 'segredo123', username: 'Comum' });
  await assert.rejects(platform.adminResetRanked(1), /não tem permissão/);
});

test('ranqueada: ingresso do dia em que a carreira começou', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  assert.equal(await platform.rankedIniciar(), null); // sem conta: não vale
  await platform.signUp({ email: 'i@example.com', password: 'segredo123', username: 'Inicio' });
  const r = await platform.rankedIniciar();
  assert.match(r.token, /^[0-9a-f-]{36}$/);
  assert.equal(r.dia, new Date().toISOString().slice(0, 10));
  assert.equal(r.numero, 1);
  await platform.rankedIniciar();
  assert.equal((await platform.rankedIniciar()).restantes, 0);
  const quarta = await platform.rankedIniciar(); // 4ª começada: não vale
  assert.equal(quarta.token, null);
  const sql11 = readFileSync(new URL('../supabase/migrations/0011_ranqueada_iniciadas.sql', import.meta.url), 'utf8');
  assert.match(sql11, /if feitas >= 3 then/);
  assert.match(sql11, /'iniciadas'/);
  const sql = readFileSync(new URL('../supabase/migrations/0010_ranqueada_inicio.sql', import.meta.url), 'utf8');
  assert.match(sql, /where id = tok::uuid and user_id = new\.user_id and dia = hoje and result_id is null/);
  const main = readFileSync(new URL('../jogos/carreira-no-rift/js/main.js', import.meta.url), 'utf8');
  assert.match(main, /ranked: state\.ranked\?\.token/);
});
