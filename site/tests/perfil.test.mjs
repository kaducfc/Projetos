import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeSupabase, installMemoryStorage } from './fake-supabase.js';
import * as platform from '../shared/platform.js';
import { nomeProibido, problemaNoNome, PROIBIDO_TRECHO, PROIBIDO_PALAVRA } from '../shared/nomes.js';

test('filtro de nomes: barra palavrões comuns (com números e letras repetidas) e deixa nomes normais', () => {
  const ok = ['Pinto', 'Pinto_Jr', 'kadu', 'Kadu_SP', 'brTT', 'tinowns', 'computador', 'disputa', 'Reputacao', 'Cubo', 'Pauleta', 'Assassino', 'Matheus99', 'Mod3rno', 'Pikachu', 'Shaco'];
  const ruins = ['porra', 'p0rr4', 'Caralhooo', 'c4r4lh0', 'PutaMerda', 'Puta_Vida', 'cu', 'FdP', 'vsf', 'BUCETA', 'viado123', 'fuck_you', 'xXbitchXx', 'admin', 'RiftArcade', 'hitler88', 'arrombad0', 'Kadu.Merda'];
  for (const n of ok) assert.equal(nomeProibido(n), false, n);
  for (const n of ruins) assert.equal(nomeProibido(n), true, n);
  assert.match(problemaNoNome('porra'), /não é permitido/);
  assert.match(problemaNoNome('ab'), /3 a 20/);
  assert.equal(problemaNoNome('kadu'), '');
});

test('filtro de nomes: a lista do site é a mesma do banco (0005_perfil.sql)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0005_perfil.sql', import.meta.url), 'utf8');
  const lista = (nome) => [...sql.match(new RegExp(`${nome} text\\[\\] := array\\[([\\s\\S]*?)\\];`))[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(lista('trechos'), PROIBIDO_TRECHO);
  assert.deepEqual(lista('palavras_proibidas'), PROIBIDO_PALAVRA);
});

test('perfil: cadastro barra nome feio, troca de nome com limite, ícone, senha e exclusão da conta', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();

  await assert.rejects(platform.signUp({ email: 'x@example.com', password: 'segredo123', username: 'PutaMerda' }), /não é permitido/);
  assert.equal(sb.db.site_profiles.length, 0);

  await platform.signUp({ email: 'kadu@example.com', password: 'segredo123', username: 'kadu' });
  await platform.signUp({ email: 'outro@example.com', password: 'segredo123', username: 'outro' });
  await platform.signIn({ email: 'kadu@example.com', password: 'segredo123' });
  assert.deepEqual(platform.getUser().providers, ['email']);

  await assert.rejects(platform.changeUsername('c4r4lh0'), /não é permitido/);
  await assert.rejects(platform.changeUsername('outro'), /já está em uso/);
  await platform.changeUsername('KaduNovo');
  assert.equal(platform.getUser().username, 'KaduNovo');
  assert.ok(platform.nextUsernameChange() > new Date());
  await assert.rejects(platform.changeUsername('Kadu2'), /Faltam? (1 dia e 23 horas|2 dias)/);
  await platform.changeUsername('kadunovo'); // só maiúsculas: pode
  assert.equal(platform.getUser().username, 'kadunovo');

  await platform.setAvatar('icone:raposa-encantada');
  assert.equal(platform.getUser().avatar, 'icone:raposa-encantada');
  assert.equal(sb.db.site_profiles.find((p) => p.username === 'kadunovo').avatar, 'icone:raposa-encantada');
  // Especiais de apoiador: bloqueados até apoiar.
  assert.deepEqual(await platform.meusSelos(), { apoiador: false, pioneiro: false, posicao: null });
  await assert.rejects(platform.setAvatar('icone:apoiador'), /ainda não foi liberado/);
  await assert.rejects(platform.setAvatar('champ:Ahri'), /não está disponível/);
  sb.db.site_profiles.find((p) => p.username === 'kadunovo').apoio_total = 5;
  assert.equal((await platform.meusSelos()).apoiador, true);
  await platform.setAvatar('icone:pioneiro');
  await assert.rejects(platform.setAvatar('javascript:alert(1)'), /não está disponível/);

  await assert.rejects(platform.changePassword({ current: 'errada', password: 'nova12345' }), /atual está incorreta/);
  await platform.changePassword({ current: 'segredo123', password: 'nova12345' });
  await platform.signOut();
  await assert.rejects(platform.signIn({ email: 'kadu@example.com', password: 'segredo123' }));
  await platform.signIn({ email: 'kadu@example.com', password: 'nova12345' });

  await platform.recordResult('runetermo', { score: 5 });
  assert.equal(sb.db.site_game_results.length, 1);
  await platform.deleteAccount();
  assert.equal(platform.getUser(), null);
  assert.equal(sb.db.site_profiles.some((p) => p.username === 'kadunovo'), false);
  assert.equal(sb.db.site_game_results.length, 0);
  await assert.rejects(platform.signIn({ email: 'kadu@example.com', password: 'nova12345' }));
});

test('ícones: só as artes do site (sem campeões), com imagem para cada um', async () => {
  const { existsSync } = await import('node:fs');
  const { AVATARES, AVATARES_ESPECIAIS, avatarHtml, nomeAvatar } = await import('../shared/avatar.js');
  assert.equal(AVATARES.length, 14); // mascote + 13
  assert.deepEqual(AVATARES_ESPECIAIS, ['icone:apoiador', 'icone:pioneiro']);
  for (const id of [...AVATARES, ...AVATARES_ESPECIAIS].filter((x) => x !== 'mascote')) {
    assert.ok(existsSync(new URL(`../shared/assets/icones/${id.slice(6)}.webp`, import.meta.url)), id);
    assert.ok(nomeAvatar(id));
  }
  // Ícone antigo de campeão vira a inicial do nome.
  assert.match(avatarHtml('champ:Ahri', 'kadu'), /avatar-letra[^>]*>K</);
  const sql = (await import('node:fs')).readFileSync(new URL('../supabase/migrations/0014_icones.sql', import.meta.url), 'utf8');
  assert.match(sql, /raise exception 'icone_bloqueado'/);
  assert.match(sql, /pos <= 100/);
});
