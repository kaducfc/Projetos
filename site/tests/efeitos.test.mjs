import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeSupabase, installMemoryStorage } from './fake-supabase.js';
import * as platform from '../shared/platform.js';
import { nickHtml } from '../shared/apoio.js';
import { EFEITOS, EFEITOS_TESTE, efeitoAtivo } from '../shared/efeitos.js';

const css = readFileSync(new URL('../shared/account.css', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/0035_efeito_nome.sql', import.meta.url), 'utf8');

async function entrar() {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'e@example.com', password: 'segredo123', username: 'Efeito' });
  return sb;
}

test('efeitos: automático dá o reflexo ao apoiador, "nenhum" tira, id desconhecido cai no automático', () => {
  assert.equal(efeitoAtivo(null, true).id, 'reflexo');
  assert.equal(efeitoAtivo(null, false), null);
  assert.equal(efeitoAtivo('nenhum', true), null);
  assert.equal(efeitoAtivo('st-contorno', true).id, 'reflexo'); // ainda em teste: não vale para o público
  assert.equal(efeitoAtivo('st-contorno', false), null);
  assert.equal(efeitoAtivo('st-nebulosa', false).nome, 'Streamer'); // lançado: vale para quem escolheu
  assert.match(nickHtml('Ana', false, 'st-nebulosa'), /fx-st-nebulosa/);
  assert.match(nickHtml('Ana', true), /fx-reflexo/);
  assert.doesNotMatch(nickHtml('Ana', true, 'nenhum'), /fx-/);
  assert.doesNotMatch(nickHtml('Ana', false, 'st-contorno'), /fx-/);
  assert.match(nickHtml('<b>', true), /&lt;b&gt;/);
});

test('efeitos: os de teste têm CSS e não estão na lista pública', () => {
  assert.equal(EFEITOS_TESTE.length, 13);
  assert.equal(EFEITOS_TESTE.filter((e) => e.id.startsWith('nv-')).length, 5);
  assert.equal(EFEITOS_TESTE.filter((e) => e.id.startsWith('lj-')).length, 5);
  assert.ok(EFEITOS_TESTE.some((e) => /Laranja e preto/.test(e.tema)));
  for (const e of EFEITOS_TESTE) {
    assert.match(e.id, /^[a-z0-9-]{2,30}$/);
    assert.ok(css.includes(`.${e.classe}`), `falta CSS de ${e.classe}`);
    assert.ok(!EFEITOS.some((p) => p.id === e.id));
  }
  assert.ok(css.includes('.fx-reflexo'));
});

test('efeitos: escolher no servidor exige ter o efeito', async () => {
  const sb = await entrar();
  await assert.rejects(platform.setEfeito('reflexo'), /não foi liberado/);
  await assert.rejects(platform.setEfeito('chamas'), /não foi liberado/);
  await platform.setEfeito('nenhum');
  assert.equal(platform.getUser().efeito, 'nenhum');
  sb.db.site_profiles.find((p) => p.id === platform.getUser().id).apoio_total = 10;
  await platform.setEfeito('reflexo');
  assert.equal(platform.getUser().efeito, 'reflexo');
  sb.db.recompensas = [{ user_id: platform.getUser().id, tipo: 'efeito', chave: 'chamas' }];
  await platform.setEfeito('chamas');
  await platform.setEfeito(null);
  assert.equal(platform.getUser().efeito, null);
});

test('efeitos: SQL 0035 valida a posse e atualiza o ranking', () => {
  assert.match(sql, /efeito_bloqueado/);
  assert.match(sql, /site_recompensas r where r\.user_id = uid and r\.tipo = 'efeito'/);
  assert.match(sql, /''efeito'', p\.efeito/);
  assert.match(sql, /revoke all on function public\.site_set_efeito\(text\) from public, anon/);
});

test('ícone exclusivo Streamer: lançado, com arte, só vale para quem ganhou', async () => {
  const { EXCLUSIVOS, EXCLUSIVOS_TESTE, nomeAvatar } = await import('../shared/avatar.js');
  const { existsSync } = await import('node:fs');
  assert.ok(EXCLUSIVOS.some((i) => i.id === 'exc-streamer'));
  assert.ok(!EXCLUSIVOS_TESTE.some((i) => i.id === 'exc-streamer'));
  assert.ok(existsSync(new URL('../shared/assets/icones/exc-streamer.webp', import.meta.url)));
  assert.equal(nomeAvatar('icone:exc-streamer'), 'Streamer');
  await entrar();
  await assert.rejects(platform.setAvatar('icone:exc-streamer'), /não foi liberado/);
});

test('nome da recompensa de efeito/ícone usa o nome do site (Streamer), não o id', async () => {
  const { nomeRecompensa } = await import('../shared/recompensas.js');
  assert.equal(nomeRecompensa('efeito', 'st-nebulosa'), 'Streamer');
  assert.equal(nomeRecompensa('efeito', 'st-contorno'), 'Contorno Twitch'); // em teste (painel)
  assert.equal(nomeRecompensa('icone', 'exc-streamer'), 'Streamer');
});
