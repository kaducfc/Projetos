import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeSupabase, installMemoryStorage } from './fake-supabase.js';
import * as platform from '../shared/platform.js';
import { nomeRecompensa, tipoTexto } from '../shared/recompensas.js';

async function conta(sb, username) {
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: `${username.toLowerCase()}@example.com`, password: 'segredo123', username });
  return platform.getUser();
}

test('moedas: carteira começa em zero e o código de recompensa soma Rift Coins', async () => {
  const sb = createFakeSupabase();
  const adm = await conta(sb, 'Mestre');
  sb.admins.add(adm.id);
  await platform.adminCodigoCriar({ recompensas: [{ tipo: 'moeda', chave: '250' }, { tipo: 'efeito', chave: 'st-nebulosa' }], codigo: 'MOEDAS250' });
  await platform.signOut();
  const eu = await conta(sb, 'Jogador');
  assert.equal(eu.moedas, 0);
  const r = await platform.resgatarCodigo('moedas-250');
  assert.deepEqual(r.novas.map((x) => x.tipo).sort(), ['efeito', 'moeda']);
  assert.equal(platform.getUser().moedas, 250);
  const ext = await platform.moedasExtrato();
  assert.equal(ext.length, 1);
  assert.deepEqual([ext[0].delta, ext[0].saldo, ext[0].motivo, ext[0].ref], [250, 250, 'codigo', 'MOEDAS250']);
  // Mesma conta não resgata de novo (e não ganha moedas duas vezes).
  await assert.rejects(platform.resgatarCodigo('MOEDAS250'), /já resgatou/);
  assert.equal(platform.getUser().moedas, 250);
});

test('moedas: o administrador dá e tira, mas o saldo não fica negativo; jogador comum não pode', async () => {
  const sb = createFakeSupabase();
  const adm = await conta(sb, 'Mestre');
  sb.admins.add(adm.id);
  platform.__setClientForTests(sb);
  await platform.signOut();
  const eu = await conta(sb, 'Jogador');
  await assert.rejects(platform.adminMoedas('Jogador', 100), /not_admin|permissão|admin/i);
  await platform.signOut();
  platform.__setClientForTests(sb);
  await platform.signIn({ email: 'mestre@example.com', password: 'segredo123' });
  assert.equal((await platform.adminMoedas('jogador', 100, 'prêmio')).saldo, 100);
  assert.equal((await platform.adminMoedas('Jogador', -40)).saldo, 60);
  await assert.rejects(platform.adminMoedas('Jogador', -500), /não tem moedas suficientes/);
  await assert.rejects(platform.adminMoedas('Jogador', 0), /Quantidade inválida/);
  const j = await platform.adminMoedasJogador('Jogador');
  assert.equal(j.saldo, 60);
  assert.deepEqual(j.extrato.map((l) => l.delta), [-40, 100]);
  assert.ok(eu.id);
});

test('moedas: nomes das recompensas e o SQL da carteira', () => {
  assert.equal(tipoTexto('moeda'), 'Rift Coins');
  assert.equal(nomeRecompensa('moeda', '1500'), '+1.500');
  const sql = readFileSync(new URL('../supabase/migrations/0038_moedas.sql', import.meta.url), 'utf8');
  // Só as funções mexem nas tabelas; o saldo nunca fica negativo; ninguém lê o saldo dos outros.
  assert.match(sql, /saldo bigint not null default 0 check \(saldo >= 0\)/);
  assert.match(sql, /revoke all on public\.site_carteira, public\.site_moedas_lanc from anon, authenticated/);
  assert.match(sql, /revoke all on function public\.site_moedas_mexer\(uuid, bigint, text, text\) from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant select on public\.site_carteira/);
});
