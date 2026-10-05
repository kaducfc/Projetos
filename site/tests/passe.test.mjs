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

test('passe: ao terminar a partida, o site avisa quantas abóboras entraram (e quando sobe de nível)', async () => {
  const sb = createFakeSupabase();
  const adm = await conta(sb, 'Mestre');
  sb.admins.add(adm.id);
  // Entra de novo já como administrador (o passe só existe para quem pode ver).
  await platform.signOut();
  await platform.signIn({ email: 'mestre@example.com', password: 'segredo123' });
  await new Promise((ok) => { setTimeout(ok, 30); });
  const avisos = [];
  const off = platform.onChange((evt) => { if (evt.type === 'passe') avisos.push(evt); });
  const espera = () => new Promise((ok) => { setTimeout(ok, 30); });
  await platform.recordResult('runetermo', { score: 100 });
  await espera();
  assert.equal(avisos.length, 1);
  assert.deepEqual([avisos[0].ganhou, avisos[0].nivel, avisos[0].progresso, avisos[0].por], [5, 0, 5, 100]);
  // Falta pouco para o nível 1: a próxima partida sobe de nível.
  await platform.adminPasse('Mestre', 'aboboras', 95); // 5 + 95 = 100 → já é nível 1 (barra 0)
  await platform.adminPasse('Mestre', 'aboboras', -3); // 97 → nível 0, barra 97
  await platform.recordResult('campeao', { score: 1 });
  await espera();
  assert.equal(avisos.length, 2);
  assert.deepEqual([avisos[1].ganhou, avisos[1].nivelAntes, avisos[1].nivel, avisos[1].progresso], [5, 0, 1, 2]);
  off();
});

test('passe: jogador comum (passe em teste) e visitante não recebem aviso de abóboras', async () => {
  const sb = createFakeSupabase();
  await conta(sb, 'Comum');
  const avisos = [];
  const off = platform.onChange((evt) => { if (evt.type === 'passe') avisos.push(evt); });
  await platform.recordResult('runetermo', { score: 100 });
  await new Promise((ok) => { setTimeout(ok, 30); });
  assert.equal(avisos.length, 0);
  off();
});

test('passe: cartões — "Nível N" no que ainda não chegou e botão Premium no que já chegou sem o passe premium', async () => {
  const sb = createFakeSupabase();
  const adm = await conta(sb, 'Mestre');
  sb.admins.add(adm.id);
  await platform.adminPasse('Mestre', 'aboboras', 350); // nível 3
  let html = passeHtml(await platform.passeEstado());
  assert.doesNotMatch(html, /🔒/);
  assert.match(html, /<span class="ps-falta">Nível 5<\/span>/);
  assert.match(html, /<span class="ps-falta">Nível 15<\/span>/);
  // Níveis 1 e 3 são premium e já foram alcançados: botão Premium (não resgata).
  assert.equal((html.match(/class="ps-premium-btn" data-ps-premium/g) || []).length, 2);
  assert.match(html, /class="ps-obter" data-ps-premium/); // atalho no cabeçalho
  await platform.adminPasse('Mestre', 'premium', 1);
  html = passeHtml(await platform.passeEstado());
  assert.doesNotMatch(html, /ps-premium-btn|ps-obter/);
  assert.equal((html.match(/data-ps-resgatar=/g) || []).length, 4); // níveis 0 a 3 prontos
});

test('passe: compra do Premium só com dinheiro (Mercado Pago ou Stripe); o preço é do servidor', async () => {
  const sb = createFakeSupabase();
  await conta(sb, 'Comprador');
  assert.match((await platform.passeComprar('mercadopago')).url, /mercadopago\.test/);
  assert.match((await platform.passeComprar('stripe')).url, /stripe\.test/);
  await assert.rejects(platform.passeComprar('paypal'), /Não foi possível abrir o pagamento/);
  const fn = readFileSync(new URL('../supabase/functions/passe-premium-criar/index.ts', import.meta.url), 'utf8');
  assert.match(fn, /mercadopago: \{ moeda: 'BRL', valor: 15 \}/);
  assert.match(fn, /stripe: \{ moeda: 'USD', valor: 10 \}/);
  assert.doesNotMatch(fn, /body\.valor|corpo\.valor/); // o valor nunca vem do navegador
  const sql = readFileSync(new URL('../supabase/migrations/0042_passe_premium.sql', import.meta.url), 'utf8');
  assert.match(sql, /grant execute on function public\.site_passe_confirmar_compra\(uuid, text, text\) to service_role/);
  assert.match(sql, /revoke all on function public\.site_passe_confirmar_compra\(uuid, text, text\) from public, anon, authenticated/);
});
