import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeSupabase, installMemoryStorage } from './fake-supabase.js';
import * as platform from '../shared/platform.js';
import { EXCLUSIVOS, avatarHtml, nomeAvatar } from '../shared/avatar.js';
import { nomeRecompensa, tipoTexto, codigoBonito } from '../shared/recompensas.js';

const sql = readFileSync(new URL('../supabase/migrations/0034_codigos_recompensa.sql', import.meta.url), 'utf8');

async function entrar() {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await platform.signUp({ email: 'c@example.com', password: 'segredo123', username: 'Codigo' });
  return sb;
}
const codigo = (sb, extra = {}) => {
  sb.db.site_codigos = sb.db.site_codigos || [];
  const c = { codigo: 'RIFT2026', recompensas: [{ tipo: 'icone', chave: 'exc-lenda' }, { tipo: 'efeito', chave: 'chamas' }], usos_max: null, usos: 0, ativo: true, expira_em: null, ...extra };
  sb.db.site_codigos.push(c);
  return c;
};

test('códigos: resgatar dá as recompensas e mostra o que é novo', async () => {
  const sb = await entrar();
  codigo(sb);
  await assert.rejects(platform.resgatarCodigo('   '), /Digite o código/);
  const r = await platform.resgatarCodigo('rift-2026');
  assert.equal(r.recompensas.length, 2);
  assert.equal(r.novas.length, 2);
  const minhas = await platform.minhasRecompensas();
  assert.deepEqual(minhas.map((x) => `${x.tipo}:${x.chave}`).sort(), ['efeito:chamas', 'icone:exc-lenda']);
  // Mesmo código de novo: recusado.
  await assert.rejects(platform.resgatarCodigo('RIFT2026'), /já resgatou/);
});

test('códigos: inválido, encerrado, esgotado e bloqueio de tentativas viram mensagens claras', async () => {
  const sb = await entrar();
  codigo(sb, { codigo: 'VELHO0001', expira_em: new Date(Date.now() - 1000).toISOString() });
  codigo(sb, { codigo: 'CHEIO0001', usos_max: 1, usos: 1 });
  codigo(sb, { codigo: 'OFF000001', ativo: false });
  await assert.rejects(platform.resgatarCodigo('NAOEXISTE'), /Código inválido/);
  await assert.rejects(platform.resgatarCodigo('VELHO0001'), /não está mais disponível/);
  await assert.rejects(platform.resgatarCodigo('OFF000001'), /não está mais disponível/);
  await assert.rejects(platform.resgatarCodigo('CHEIO0001'), /limite de usos/);
});

test('códigos: sem conta não resgata', async () => {
  const sb = createFakeSupabase();
  installMemoryStorage();
  platform.__setClientForTests(sb);
  await platform.init();
  await assert.rejects(platform.resgatarCodigo('RIFT2026'));
  assert.deepEqual(await platform.minhasRecompensas(), []);
});

test('códigos: nomes das recompensas e formato do código', () => {
  assert.equal(codigoBonito('AA85E49665234D6A'), 'AA85-E496-6523-4D6A');
  assert.equal(tipoTexto('icone'), 'Ícone');
  assert.equal(tipoTexto('efeito'), 'Efeito no nome');
  assert.equal(nomeRecompensa('icone', 'exc-lenda-do-rift'), 'Lenda do rift'); // sem arte cadastrada: nome tirado da chave
  // Ícone exclusivo cadastrado usa o nome dele (e todos começam com "exc-").
  for (const i of EXCLUSIVOS) assert.match(i.id, /^exc-[a-z0-9-]+$/);
  assert.equal(nomeAvatar('icone:exc-nao-existe'), '');
  assert.match(avatarHtml('icone:exc-nao-existe', 'Fulano'), /avatar-letra/); // sem arte: mostra a inicial
});

test('códigos: o banco confere tudo (0034)', () => {
  // Nada é lido nem escrito direto nas tabelas; só pelas funções.
  assert.match(sql, /revoke all on public\.site_recompensas, public\.site_codigos, public\.site_codigos_resgates, public\.site_codigos_tentativas from anon, authenticated/);
  assert.match(sql, /alter table public\.site_codigos enable row level security/);
  // Resgate: uma vez por conta, limite de usos com trava, validade, bloqueio por tentativas erradas.
  assert.match(sql, /primary key \(codigo_id, user_id\)/);
  assert.match(sql, /for update/);
  assert.match(sql, /c\.usos_max is not null and c\.usos >= c\.usos_max/);
  assert.match(sql, /c\.expira_em <= now\(\)/);
  assert.match(sql, /falhas >= 8/);
  assert.match(sql, /interval '10 minutes'/);
  // Só visitante com conta resgata; só administrador cria e lista.
  assert.match(sql, /grant execute on function public\.site_resgatar_codigo\(text\) to authenticated/);
  assert.equal((sql.match(/not coalesce\(site_is_admin\(\), false\)/g) || []).length, 6);
  // Ícone exclusivo só para quem ganhou; o ícone de código sempre começa com exc-.
  assert.match(sql, /icone like 'icone:exc-%' and not exists/);
  assert.match(sql, /chave_ !~ '\^exc-'/);
});

test('modelos de código: salvar, atualizar pelo nome, listar e apagar (só administrador)', async () => {
  const sb = await entrar();
  await assert.rejects(platform.adminModeloSalvar('Streamer', [{ tipo: 'icone', chave: 'exc-streamer' }]), /não tem permissão/);
  sb.admins.add(sb.db.site_profiles[0].id);
  const a = await platform.adminModeloSalvar('Streamer', [{ tipo: 'icone', chave: 'exc-streamer' }, { tipo: 'efeito', chave: 'st-nebulosa' }]);
  assert.equal(a.recompensas.length, 2);
  await platform.adminModeloSalvar('Streamer', [{ tipo: 'efeito', chave: 'st-nebulosa' }]); // mesmo nome: atualiza
  const lista = await platform.adminModelos();
  assert.equal(lista.length, 1);
  assert.equal(lista[0].recompensas.length, 1);
  await assert.rejects(platform.adminModeloSalvar('  ', [{ tipo: 'icone', chave: 'exc-x' }]), /nome ao modelo/);
  await platform.adminModeloApagar(a.id);
  assert.equal((await platform.adminModelos()).length, 0);
});
test('modelos de código: SQL 0036 só para administrador e já traz o modelo Streamer', () => {
  const s = readFileSync(new URL('../supabase/migrations/0036_codigo_modelos.sql', import.meta.url), 'utf8');
  assert.equal((s.match(/not coalesce\(site_is_admin\(\), false\)/g) || []).length, 3);
  assert.match(s, /exc-streamer/);
  assert.match(s, /st-nebulosa/);
  assert.match(s, /revoke all on public\.site_codigo_modelos from anon, authenticated/);
});
