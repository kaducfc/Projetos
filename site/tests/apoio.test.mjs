import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeSupabase, installMemoryStorage } from './fake-supabase.js';
import * as platform from '../shared/platform.js';
import { nickHtml } from '../shared/apoio.js';

test('apoio: um só efeito (Reflexo), automático para quem apoiou', () => {
  assert.equal(nickHtml('<b>x</b>'), '<span class="nick">&lt;b&gt;x&lt;/b&gt;</span>');
  assert.match(nickHtml('Kadu', true), /class="nick fx fx-reflexo"/);
  const sql = readFileSync(new URL('../supabase/migrations/0008_apoio.sql', import.meta.url), 'utf8');
  assert.match(sql, /'apoiador', p\.apoio_total > 0/);
  assert.doesNotMatch(sql, /nick_efeito/);
});

test('apoio no site: link de pagamento e efeito depois que o pagamento é aprovado', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'a@example.com', password: 'segredo123', username: 'Apoiador' });
  assert.equal(platform.getUser().apoioTotal, 0);
  await assert.rejects(platform.apoiar(2), /mínimo é R\$ 5/);
  const { url } = await platform.apoiar(25);
  assert.match(url, /valor=25/);
  sb.db.site_profiles[0].apoio_total = 25; // o aviso do Mercado Pago aprovou
  await platform.refreshApoio();
  assert.equal(platform.getUser().apoioTotal, 25);
  sb.db.site_rk.push({ user_id: platform.getUser().id, pts: 120 });
  assert.equal((await platform.ranking('geral')).lista[0].apoiador, true);
});

test('painel de apoio: só administrador vê quem doou, quanto e o total', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'p@example.com', password: 'segredo123', username: 'Doador' });
  await assert.rejects(platform.adminApoios(30), /não tem acesso/);
  const uid = sb.db.site_profiles[0].id;
  const agora = new Date().toISOString();
  sb.db.site_apoios.push(
    { id: 'a1', user_id: uid, valor: 10, valor_pago: 10, status: 'aprovado', origem: 'mercadopago', criado: agora },
    { id: 'a2', user_id: uid, valor: 50, valor_pago: null, status: 'pendente', origem: 'mercadopago', criado: agora },
  );
  sb.admins.add(uid);
  const st = await platform.adminApoios(7);
  assert.equal(st.total.arrecadado, 10);
  assert.equal(st.periodo.status.pendente, 1);
  assert.equal(st.top[0].username, 'Doador');
  assert.equal(st.lista.length, 2);
  assert.equal(st.por_dia.length, 7);
  const sql = readFileSync(new URL('../supabase/migrations/0009_painel_apoio.sql', import.meta.url), 'utf8');
  assert.match(sql, /if not coalesce\(site_is_admin\(\), false\) then\s+raise exception 'not_admin'/);
  assert.match(sql, /revoke all on function public\.site_admin_apoios\(int\) from public, anon/);
});

test('apoio internacional: Stripe e PayPal em USD/EUR', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'i@example.com', password: 'segredo123', username: 'Gringo' });
  await assert.rejects(platform.apoiarIntl('stripe', 1, 'USD'), /Valor inválido|Não foi possível/);
  const st = await platform.apoiarIntl('stripe', 10, 'USD');
  assert.match(st.url, /stripe\.test.*moeda=USD/);
  const pp = await platform.apoiarIntl('paypal', 5, 'EUR');
  assert.match(pp.url, /paypal\.test.*moeda=EUR/);
  assert.equal(await platform.apoioCapturar('ABC12345XYZ'), 'aprovado');
});
