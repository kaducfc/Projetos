import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSupabase, installMemoryStorage } from './fake-supabase.js';
import * as platform from '../shared/platform.js';

const GAME = 'carreira-no-rift';
const tick = () => new Promise((r) => setTimeout(r, 5));

test('fluxo completo: visitante → cadastro → sincroniza → sai → entra em outro aparelho', async () => {
  const sb = createFakeSupabase();
  const storage = installMemoryStorage();
  platform.__setClientForTests(sb);
  const events = [];
  platform.onChange((e) => events.push(e));

  // Visitante: tudo local.
  await platform.init();
  assert.equal(platform.getUser(), null);
  platform.writeSave(GAME, { v: 2, year: 2027 });
  await platform.recordResult(GAME, { score: 150, summary: { text: 'carreira como visitante' } });
  assert.deepEqual(platform.loadLocalSave(GAME), { v: 2, year: 2027 });
  assert.equal((await platform.listResults()).length, 1);
  assert.equal(sb.db.site_game_results.length, 0);

  // Cadastro: o que foi jogado como visitante sobe para a conta.
  const res = await platform.signUp({ email: 'kadu@example.com', password: 'segredo123', username: 'kadu' });
  assert.equal(res.needsConfirmation, false);
  assert.equal(platform.getUser().username, 'kadu');
  assert.equal(sb.db.site_game_saves.length, 1);
  assert.deepEqual(sb.db.site_game_saves[0].data, { v: 2, year: 2027 });
  assert.equal(sb.db.site_game_results.length, 1);
  assert.equal(sb.db.site_game_results[0].score, 150);

  // Jogando logado: save vai para a nuvem e partidas também.
  platform.writeSave(GAME, { v: 2, year: 2030 });
  await platform.flushPushes();
  assert.deepEqual(sb.db.site_game_saves[0].data, { v: 2, year: 2030 });
  await platform.recordResult(GAME, { score: 400, summary: { text: 'campeão mundial' } });
  assert.equal(sb.db.site_game_results.length, 2);
  const cloudList = await platform.listResults({ gameId: GAME });
  assert.equal(cloudList.length, 2);
  assert.equal(cloudList[0].score, 400, 'mais recente primeiro');

  // Sair limpa o aparelho e avisa o jogo.
  await platform.signOut();
  await tick();
  assert.equal(platform.getUser(), null);
  assert.equal(platform.loadLocalSave(GAME), null);
  assert.equal((await platform.listResults()).length, 0);
  assert.ok(events.some((e) => e.type === 'auth' && e.cleared));

  // Outro aparelho (storage vazio): ao entrar, a carreira da nuvem desce.
  storage.clear();
  platform.__setClientForTests(sb);
  events.length = 0;
  await platform.init();
  await platform.signIn({ email: 'kadu@example.com', password: 'segredo123' });
  assert.deepEqual(platform.loadLocalSave(GAME), { v: 2, year: 2030 });
  assert.ok(events.some((e) => e.type === 'save' && e.gameId === GAME && e.data.year === 2030));
  assert.equal((await platform.listResults()).length, 2);
});

test('save local mais recente que o da nuvem vence ao entrar', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.signUp({ email: 'a@example.com', password: 'segredo123', username: 'jogadora' });
  platform.writeSave(GAME, { v: 2, year: 2026 });
  await platform.flushPushes();
  sb.db.site_game_saves[0].updated_at = '2020-01-01T00:00:00.000Z';
  await platform.signOut();
  await tick();

  platform.writeSave(GAME, { v: 2, year: 2040 });
  await platform.signIn({ email: 'a@example.com', password: 'segredo123' });
  assert.deepEqual(sb.db.site_game_saves[0].data, { v: 2, year: 2040 });
});

test('partidas não duplicam ao reenviar e erros viram mensagens em português', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.signUp({ email: 'b@example.com', password: 'segredo123', username: 'Beto' });
  await platform.recordResult(GAME, { score: 10 });
  await platform.signOut();
  await tick();

  await assert.rejects(platform.signUp({ email: 'c@example.com', password: 'segredo123', username: 'beto' }), /já está em uso/);
  await assert.rejects(platform.signUp({ email: 'c@example.com', password: 'segredo123', username: 'a' }), /3 a 20/);
  await assert.rejects(platform.signIn({ email: 'b@example.com', password: 'errada' }), /E-mail ou senha incorretos/);
  await assert.rejects(platform.signUp({ email: 'b@example.com', password: 'segredo123', username: 'outro' }), /Já existe uma conta/);

  await platform.signIn({ email: 'b@example.com', password: 'segredo123' });
  await platform.recordResult(GAME, { score: 20 });
  assert.equal(sb.db.site_game_results.length, 2);
});

test('sem servidor (modo visitante), login falha com mensagem clara', async () => {
  installMemoryStorage();
  platform.__setClientForTests(null);
  globalThis.__SITE_OFFLINE = true;
  try {
    await platform.init();
    await assert.rejects(platform.signIn({ email: 'x@example.com', password: '123456' }), /indisponível/);
    platform.writeSave(GAME, { v: 2 });
    assert.deepEqual(platform.loadLocalSave(GAME), { v: 2 });
  } finally {
    delete globalThis.__SITE_OFFLINE;
  }
});

test('várias jogadas no mesmo minuto viram um envio só, e falhas são tentadas de novo', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-09-25T12:00:00Z') });
  try {
    const sb = createFakeSupabase();
    installMemoryStorage();
    platform.__setClientForTests(sb);
    await platform.signUp({ email: 'd@example.com', password: 'segredo123', username: 'dani' });
    const base = sb.stats.upserts;

    // Primeira jogada: vai logo (nada foi enviado no último minuto).
    platform.writeSave(GAME, { v: 2, click: 0 });
    mock.timers.tick(1_500);
    await tick0();
    assert.equal(sb.stats.upserts, base + 1);

    // Mais 29 jogadas seguidas: nada vai para a nuvem antes de fechar 1 minuto.
    for (let i = 1; i < 30; i++) platform.writeSave(GAME, { v: 2, click: i });
    mock.timers.tick(57_000);
    await tick0();
    assert.equal(sb.stats.upserts, base + 1);

    // Fechou 1 minuto desde o primeiro envio: um único envio, com o save mais recente.
    mock.timers.tick(3_000);
    await tick0();
    assert.equal(sb.stats.upserts, base + 2);
    assert.deepEqual(sb.db.site_game_saves[0].data, { v: 2, click: 29 });

    // Servidor falha: nova tentativa sozinha depois de alguns segundos.
    sb.stats.failNextUpserts = 1;
    platform.writeSave(GAME, { v: 2, click: 30 }, { urgent: true });
    mock.timers.tick(1_500);
    await tick0();
    assert.equal(sb.stats.upserts, base + 3);
    assert.deepEqual(sb.db.site_game_saves[0].data, { v: 2, click: 29 }, 'falhou, ainda não gravou');
    mock.timers.tick(5_000);
    await tick0();
    assert.equal(sb.stats.upserts, base + 4);
    assert.deepEqual(sb.db.site_game_saves[0].data, { v: 2, click: 30 });
  } finally {
    mock.timers.reset();
  }
});

// Deixa as promessas pendentes (timers já disparados) terminarem.
async function tick0() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
