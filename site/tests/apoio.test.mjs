import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeSupabase, installMemoryStorage } from './fake-supabase.js';
import * as platform from '../shared/platform.js';
import { EFEITOS, efeitoLiberado, nickHtml } from '../shared/apoio.js';

test('apoio: 10 efeitos, valores do site batem com os do banco (0008_apoio.sql)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0008_apoio.sql', import.meta.url), 'utf8');
  assert.equal(EFEITOS.length, 10);
  assert.equal(new Set(EFEITOS.map((e) => e.id)).size, 10);
  for (const e of EFEITOS) assert.match(sql, new RegExp(`when '${e.id}' then ${e.minimo}\\b`), e.id);
  assert.ok(efeitoLiberado('ouro', 5));
  assert.ok(!efeitoLiberado('prisma', 49.99));
  assert.ok(!efeitoLiberado('inventado', 999));
});

test('apoio: nick com efeito escapa o nome e some quando o efeito não vale mais', () => {
  assert.equal(nickHtml('<b>x</b>', null), '<span class="nick">&lt;b&gt;x&lt;/b&gt;</span>');
  assert.match(nickHtml('Kadu', 'glitch', 25), /class="nick fx fx-glitch" data-text="Kadu"/);
  assert.doesNotMatch(nickHtml('Kadu', 'prisma', 10), /fx-prisma/);
});

test('apoio no site: link de pagamento, escolher efeito liberado e barrar o bloqueado', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'a@example.com', password: 'segredo123', username: 'Apoiador' });
  assert.equal(platform.getUser().apoioTotal, 0);
  await assert.rejects(platform.apoiar(2), /entre R\$ 5 e R\$ 1\.000/);
  const { url } = await platform.apoiar(25);
  assert.match(url, /valor=25/);
  await assert.rejects(platform.setNickEfeito('vazio'), /ainda não foi liberado/);
  sb.db.site_profiles[0].apoio_total = 25; // o webhook aprovou
  await platform.refreshApoio();
  assert.equal(platform.getUser().apoioTotal, 25);
  await platform.setNickEfeito('vazio');
  assert.equal(platform.getUser().nickEfeito, 'vazio');
  await assert.rejects(platform.setNickEfeito('prisma'), /ainda não foi liberado/);
  await platform.setNickEfeito(null);
  assert.equal(platform.getUser().nickEfeito, null);
});
