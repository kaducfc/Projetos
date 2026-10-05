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
  assert.equal(e.niveis.length, 16);
  assert.equal(e.nivel, 0);
});

test('passe: nível 0 grátis + 15 níveis alternando, 500 RC e o efeito no último; recompensas abrem pelo nível e (se premium) com o passe', async () => {
  const sb = createFakeSupabase();
  const adm = await conta(sb, 'Mestre');
  sb.admins.add(adm.id);
  let e = await platform.passeEstado();
  assert.equal(e.passe.nome, 'Halloween 2026');
  assert.deepEqual(e.niveis.map((n) => n.nivel), Array.from({ length: 16 }, (_, i) => i));
  assert.deepEqual(e.niveis.map((n) => n.trilha), Array.from({ length: 16 }, (_, i) => (i % 2 ? 'premium' : 'gratis')));
  assert.equal(e.niveis[0].trilha, 'gratis'); // nível 0 já começa liberado, grátis
  assert.equal(e.niveis[15].trilha, 'premium');
  assert.ok(e.niveis.slice(0, 15).every((n) => n.tipo === 'moeda' && n.chave === '500'));
  assert.deepEqual([e.niveis[15].tipo, e.niveis[15].chave], ['efeito', 'hw-neon']);
  // Nível 0: resgata sem nenhuma abóbora.
  assert.equal((await platform.passeResgatar(0)).tipo, 'moeda');
  assert.equal(platform.getUser().moedas, 500);
  assert.equal(EFEITOS_TESTE.find((x) => x.id === 'hw-neon').nome, 'Halloween 2026');
  await assert.rejects(platform.passeResgatar(1), /ainda não chegou a este nível/);
  await platform.adminPasse('Mestre', 'aboboras', 250);
  await assert.rejects(platform.passeResgatar(1), /trilha premium/);
  assert.equal((await platform.passeResgatar(2)).tipo, 'moeda'); // grátis, nível 2 = 200 abóboras
  assert.equal(platform.getUser().moedas, 1000);
  await assert.rejects(platform.passeResgatar(2), /já resgatou/);
  await platform.adminPasse('Mestre', 'premium', 1);
  assert.equal((await platform.passeResgatar(1)).tipo, 'moeda');
  assert.equal(platform.getUser().moedas, 1500);
  await platform.adminPasse('Mestre', 'aboboras', 1250);
  const fim = await platform.passeResgatar(15);
  assert.deepEqual([fim.tipo, fim.chave], ['efeito', 'hw-neon']);
  assert.ok((await platform.minhasRecompensas()).some((r) => r.tipo === 'efeito' && r.chave === 'hw-neon'));
  e = await platform.passeEstado();
  assert.equal(e.nivel, 15);
  assert.equal(e.progresso, 100);
  const html = passeHtml(e);
  assert.match(html, /Halloween 2026/);
  assert.equal((html.match(/class="ps-nivel /g) || []).length, 16);
  assert.equal((html.match(/ps-feito/g) || []).length, 4); // níveis 0, 1, 2 e 15
  assert.match(html, /ps-pronto/);
});

test('passe: a tela mostra só o nível e a barra do nível atual, sem totais de abóboras', async () => {
  const sb = createFakeSupabase();
  const adm = await conta(sb, 'Mestre');
  sb.admins.add(adm.id);
  await platform.adminPasse('Mestre', 'aboboras', 455); // nível 4, 55 na barra
  const e = await platform.passeEstado();
  assert.deepEqual([e.nivel, e.progresso], [4, 55]);
  assert.equal('abobora' in e, false);
  const html = passeHtml(e);
  assert.match(html, /aria-valuenow="55"/);
  assert.match(html, /style="width:55%"/);
  assert.match(html, /Nível 4/);
  assert.match(html, /Nível 5/);
  assert.doesNotMatch(html, /455|abóboras<\/span>/); // nada de total acumulado
  // Recompensas abrem pelo nível: níveis 1 a 4 liberados, 5 em diante bloqueados.
  assert.equal((html.match(/ps-bloqueado/g) || []).length, 11); // níveis 5 a 15; o 0 ao 4 estão liberados
  // Subiu de nível: a barra recomeça.
  await platform.adminPasse('Mestre', 'aboboras', 45);
  const e2 = await platform.passeEstado();
  assert.deepEqual([e2.nivel, e2.progresso], [5, 0]);
  assert.match(passeHtml(e2), /style="width:0%"/);
});

test('passe: regras no SQL (5 por partida, 150 por dia, 100 por nível, gatilho nas partidas)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0039_passe_batalha.sql', import.meta.url), 'utf8');
  assert.match(sql, /abobora_por_nivel int not null default 100/);
  assert.match(sql, /abobora_por_partida int not null default 5/);
  assert.match(sql, /limite_dia int not null default 150/);
  assert.match(sql, /case when n % 2 = 1 then 'premium' else 'gratis' end/);
  const sql0 = readFileSync(new URL('../supabase/migrations/0041_passe_nivel0.sql', import.meta.url), 'utf8');
  assert.match(sql0, /check \(nivel >= 0\)/);
  assert.match(sql0, /\('halloween-2026', 0, 'gratis', 'moeda', '500'\)/);
  assert.match(sql, /case when n = 15 then 'efeito' else 'moeda' end/);
  assert.match(sql, /after insert on public\.site_game_results/);
  assert.match(sql, /revoke all on public\.site_passes, public\.site_passe_niveis, public\.site_passe_progresso, public\.site_passe_dia, public\.site_passe_resgates from anon, authenticated/);
});
