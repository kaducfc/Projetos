import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeSupabase, installMemoryStorage } from './fake-supabase.js';
import * as platform from '../shared/platform.js';
import { passeHtml } from '../shared/passe.js';
import { EFEITOS_TESTE } from '../shared/efeitos.js';

async function conta(sb, username) {
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: `${username.toLowerCase()}@example.com`, password: 'segredo123', username });
  return platform.getUser();
}

test('passe: visitante não tem passe; jogador comum só depois de publicado', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  assert.equal(await platform.passeEstado(), null); // visitante
  assert.match(passeHtml(null), /Entre na sua conta/);
  await conta(sb, 'Comum');
  await assert.rejects(platform.passeEstado(), /não está disponível/);
  const adm = await conta(sb, 'Mestre');
  sb.admins.add(adm.id);
  await platform.adminPassePublicar(true);
  await platform.signOut();
  await conta(sb, 'Comum2');
  const e = await platform.passeEstado();
  assert.equal(e.nivel, 0);
  assert.equal(e.niveis.length, 15);
});

test('passe: 15 níveis alternando premium/grátis, 500 RC e o efeito no último; resgate só com abóboras e (se premium) com o passe', async () => {
  const sb = createFakeSupabase();
  const adm = await conta(sb, 'Mestre');
  sb.admins.add(adm.id);
  let e = await platform.passeEstado();
  assert.equal(e.passe.nome, 'Halloween 2026');
  assert.deepEqual(e.niveis.map((n) => n.trilha), Array.from({ length: 15 }, (_, i) => ((i + 1) % 2 ? 'premium' : 'gratis')));
  assert.equal(e.niveis[0].trilha, 'premium');
  assert.equal(e.niveis[14].trilha, 'premium');
  assert.ok(e.niveis.slice(0, 14).every((n) => n.tipo === 'moeda' && n.chave === '500'));
  assert.deepEqual([e.niveis[14].tipo, e.niveis[14].chave], ['efeito', 'hw-neon']);
  assert.equal(EFEITOS_TESTE.find((x) => x.id === 'hw-neon').nome, 'Halloween 2026');
  await assert.rejects(platform.passeResgatar(1), /abóboras suficientes/);
  await platform.adminPasse('Mestre', 'aboboras', 250);
  await assert.rejects(platform.passeResgatar(1), /trilha premium/);
  assert.equal((await platform.passeResgatar(2)).tipo, 'moeda'); // grátis, nível 2 = 200 abóboras
  assert.equal(platform.getUser().moedas, 500);
  await assert.rejects(platform.passeResgatar(2), /já resgatou/);
  await platform.adminPasse('Mestre', 'premium', 1);
  assert.equal((await platform.passeResgatar(1)).tipo, 'moeda');
  assert.equal(platform.getUser().moedas, 1000);
  await platform.adminPasse('Mestre', 'aboboras', 1250);
  const fim = await platform.passeResgatar(15);
  assert.deepEqual([fim.tipo, fim.chave], ['efeito', 'hw-neon']);
  assert.ok((await platform.minhasRecompensas()).some((r) => r.tipo === 'efeito' && r.chave === 'hw-neon'));
  e = await platform.passeEstado();
  assert.equal(e.nivel, 15);
  const html = passeHtml(e);
  assert.match(html, /Halloween 2026/);
  assert.equal((html.match(/ps-feito/g) || []).length, 3);
  assert.match(html, /ps-pronto/);
});

test('passe: regras no SQL (5 por partida, 150 por dia, 100 por nível, gatilho nas partidas)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0039_passe_batalha.sql', import.meta.url), 'utf8');
  assert.match(sql, /abobora_por_nivel int not null default 100/);
  assert.match(sql, /abobora_por_partida int not null default 5/);
  assert.match(sql, /limite_dia int not null default 150/);
  assert.match(sql, /case when n % 2 = 1 then 'premium' else 'gratis' end/);
  assert.match(sql, /case when n = 15 then 'efeito' else 'moeda' end/);
  assert.match(sql, /after insert on public\.site_game_results/);
  assert.match(sql, /revoke all on public\.site_passes, public\.site_passe_niveis, public\.site_passe_progresso, public\.site_passe_dia, public\.site_passe_resgates from anon, authenticated/);
});
