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
  await assert.rejects(platform.apoiar(2), /entre R\$ 5 e R\$ 1\.000/);
  const { url } = await platform.apoiar(25);
  assert.match(url, /valor=25/);
  sb.db.site_profiles[0].apoio_total = 25; // o aviso do Mercado Pago aprovou
  await platform.refreshApoio();
  assert.equal(platform.getUser().apoioTotal, 25);
  await platform.recordResult('carreira-no-rift', { score: 800 });
  assert.equal((await platform.ranking('diario')).lista[0].apoiador, true);
});
