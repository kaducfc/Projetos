// Rift Survivors: progresso salvo na conta. Parte 1: regras do navegador (meta.js). Parte 2: o servidor de verdade
// (PostgreSQL temporário com a migração 0186). A parte 2 precisa dos binários do PostgreSQL (TC_PGBIN); sem eles é pulada.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { spawnSync, execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const Meta = await import('../jogos/survivors/js/meta.js');

test('meta: cada conta tem a sua cópia no navegador e herda a antiga na primeira vez', () => {
  mem.clear();
  Meta.usarConta(null); const a = Meta.carregar(); a.essencia = 50; Meta.gravar(a);
  Meta.usarConta('u1'); const b = Meta.carregar(); assert.equal(b.essencia, 50, 'primeira vez com conta aproveita o navegador'); b.essencia = 70; Meta.gravar(b);
  Meta.usarConta('u2'); const c = Meta.carregar(); assert.equal(c.essencia, 50, 'outra conta não herda a cópia de u1');
  Meta.usarConta('u1'); assert.equal(Meta.carregar().essencia, 70);
  Meta.usarConta(null);
});

test('meta: gravar carimba a revisão (sempre crescente) e avisa o gancho de sincronização', () => {
  mem.clear(); Meta.usarConta(null); const m = Meta.carregar(); let avisos = 0; Meta.aoGravar(() => { avisos++; });
  Meta.gravar(m); const r1 = m.rev; Meta.gravar(m); assert.ok(m.rev > r1 && avisos === 2);
  Meta.aoGravar(null);
});

test('meta: normalizar migra o reino antigo e completa campos que faltam', () => {
  const m = Meta.normalizar({ essencia: 9, reinos: { rift: { vitorias: 2 } }, ultimoReino: 'rift' });
  assert.equal(m.reinos.ixtal.vitorias, 2); assert.equal(m.ultimoReino, 'ixtal'); assert.ok(Array.isArray(m.liberados) && m.melhor.tempo === 0);
  assert.equal(Meta.normalizar(null).essencia, 0);
});

const BIN = process.env.TC_PGBIN || '/usr/lib/postgresql/16/bin';
const TEM = existsSync(`${BIN}/initdb`);
const PORT = 5900 + (process.pid % 300);
const U = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const root = typeof process.getuid === 'function' && process.getuid() === 0;
const como = (cmd) => (root ? `su postgres -c ${JSON.stringify(cmd)}` : cmd);
let dir;
const psql = (args, input) => spawnSync('psql', ['-h', dir, '-p', String(PORT), '-U', 'postgres', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf8', input });
const Q = (sql, uid = null) => { const r = psql(['-d', 't', '-c', `set app.uid='${uid ? U(uid) : ''}'`, '-c', sql]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: ((r.stderr || '').match(/ERROR:\s+(\S+)/) || [, (r.stderr || '').trim()])[1] }; };
before(() => {
  if (!TEM) return;
  dir = mkdtempSync(path.join(tmpdir(), 'svpg-'));
  if (root) execSync(`chown postgres ${dir}`);
  chmodSync(dir, 0o777);
  execSync(como(`${BIN}/initdb -D ${dir}/data -A trust`), { stdio: 'ignore' });
  execSync(como(`${BIN}/pg_ctl -D ${dir}/data -o "-p ${PORT} -k ${dir} -c fsync=off" -l ${dir}/log -w start`), { stdio: 'ignore' });
  assert.equal(psql(['-d', 'postgres', '-c', 'create database t']).status, 0);
  assert.equal(psql(['-d', 'postgres', '-c', 'create role anon; create role authenticated;']).status, 0);
  let r = psql(['-d', 't'], readFileSync(new URL('./fixtures/tecnico-stubs.sql', import.meta.url), 'utf8')); assert.equal(r.status, 0, r.stderr);
  r = psql(['-d', 't'], readFileSync(new URL('../supabase/migrations/0186_survivors_progresso.sql', import.meta.url), 'utf8')); assert.equal(r.status, 0, r.stderr);
  r = psql(['-d', 't'], readFileSync(new URL('../supabase/migrations/0186_survivors_progresso.sql', import.meta.url), 'utf8')); assert.equal(r.status, 0, `rodar de novo: ${r.stderr}`);
  r = psql(['-d', 't', '-c', "insert into auth.users select ('00000000-0000-0000-0000-00000000000' || g)::uuid from generate_series(1, 3) g"]); assert.equal(r.status, 0, r.stderr);
});
after(() => {
  if (!TEM || !dir) return;
  try { execSync(como(`${BIN}/pg_ctl -D ${dir}/data -m immediate stop`), { stdio: 'ignore' }); } catch { /* já parado */ }
  rmSync(dir, { recursive: true, force: true });
});
const t = (nome, fn) => test(nome, { skip: !TEM && 'PostgreSQL não encontrado (defina TC_PGBIN)' }, fn);
const dados = (ess, extra = '') => `'{"essencia": ${ess}, "liberados": ["garen"]${extra}}'::jsonb`;

t('servidor: sem conta recusa; conta nova não tem nada salvo', () => {
  assert.equal(Q('select sv_carregar()').err, 'not_authenticated');
  assert.equal(Q(`select sv_salvar(100, ${dados(5)})`).err, 'not_authenticated');
  assert.equal(Q('select sv_carregar()', 1).out, '');
});
t('servidor: salva, carrega e só aceita revisão mais nova', () => {
  assert.equal(JSON.parse(Q(`select sv_salvar(1000, ${dados(40)})`, 1).out).ok, true);
  const c = JSON.parse(Q('select sv_carregar()', 1).out); assert.equal(c.rev, 1000); assert.equal(c.dados.essencia, 40);
  const velho = JSON.parse(Q(`select sv_salvar(900, ${dados(999)})`, 1).out); assert.deepEqual(velho, { ok: false, rev: 1000 });
  assert.equal(JSON.parse(Q(`select sv_salvar(1000, ${dados(999)})`, 1).out).ok, false, 'revisão igual não sobrescreve');
  assert.equal(JSON.parse(Q('select sv_carregar()', 1).out).dados.essencia, 40);
  assert.equal(JSON.parse(Q(`select sv_salvar(2000, ${dados(55)})`, 1).out).ok, true);
  assert.equal(JSON.parse(Q('select sv_carregar()', 1).out).dados.essencia, 55);
});
t('servidor: cada conta só vê o seu progresso e a tabela não é acessível direto', () => {
  assert.equal(Q('select sv_carregar()', 2).out, '');
  Q(`select sv_salvar(5, ${dados(7)})`, 2);
  assert.equal(JSON.parse(Q('select sv_carregar()', 2).out).dados.essencia, 7);
  assert.equal(JSON.parse(Q('select sv_carregar()', 1).out).dados.essencia, 55);
  assert.match(psql(['-d', 't', '-c', 'set role authenticated', '-c', 'select * from sv_progresso']).stderr, /permission denied/);
});
t('servidor: recusa dados inválidos', () => {
  assert.equal(Q(`select sv_salvar(9, '[1]'::jsonb)`, 3).err, 'dados_invalidos');
  assert.equal(Q(`select sv_salvar(9, ${dados(-1)})`, 3).err, 'dados_invalidos');
  assert.equal(Q(`select sv_salvar(9, '{"essencia": 1}'::jsonb)`, 3).err, 'dados_invalidos');
  assert.equal(Q(`select sv_salvar(0, ${dados(1)})`, 3).err, 'rev_invalida');
  assert.equal(Q(`select sv_salvar(9, ${dados(1, `, "x": "${'a'.repeat(41000)}"`)})`, 3).err, 'dados_grandes');
});
