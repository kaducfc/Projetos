// Premiação em RC do ranking semanal/mensal (migração 0184) num PostgreSQL temporário.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, chmodSync, rmSync } from 'node:fs';
import { spawnSync, execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BIN = process.env.TC_PGBIN || '/usr/lib/postgresql/16/bin';
const TEM = existsSync(`${BIN}/initdb`);
const PORT = 5900 + (process.pid % 300);
const U = (n) => `00000000-0000-0000-0000-00000000000${n}`;
let dir;
const root = typeof process.getuid === 'function' && process.getuid() === 0;
const como = (cmd) => (root ? `su postgres -c ${JSON.stringify(cmd)}` : cmd);
const psql = (args, input) => spawnSync('psql', ['-h', dir, '-p', String(PORT), '-U', 'postgres', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', ...args], { encoding: 'utf8', input });
const V = (sql, hoje = '2026-10-12', uid = '') => {
  const r = psql(['-d', 't', '-c', `set app.uid='${uid}'`, '-c', `set app.hoje='${hoje}'`, '-c', sql]);
  assert.equal(r.status, 0, `${sql}\n${r.stderr}`);
  return r.stdout.trim();
};
const saldo = (n) => Number(V(`select coalesce((select saldo from site_carteira where user_id='${U(n)}'),0)`));

before(() => {
  if (!TEM) return;
  dir = mkdtempSync(path.join(tmpdir(), 'rkpg-'));
  if (root) execSync(`chown postgres ${dir}`);
  chmodSync(dir, 0o777);
  execSync(como(`${BIN}/initdb -D ${dir}/data -A trust`), { stdio: 'ignore' });
  execSync(como(`${BIN}/pg_ctl -D ${dir}/data -o "-p ${PORT} -k ${dir} -c fsync=off" -l ${dir}/log -w start`), { stdio: 'ignore' });
  assert.equal(psql(['-d', 'postgres', '-c', 'create database t']).status, 0);
  assert.equal(psql(['-d', 'postgres', '-c', 'create role anon; create role authenticated;']).status, 0);
  let r = psql(['-d', 't'], readFileSync(new URL('./fixtures/tecnico-stubs.sql', import.meta.url), 'utf8'));
  assert.equal(r.status, 0, r.stderr);
  r = psql(['-d', 't'], `
    create table site_rk_lanc (id bigserial primary key, user_id uuid not null references auth.users(id), dia date not null, jogo text, motivo text not null, delta int not null, antes int not null default 0, depois int not null default 0, criado timestamptz not null default now());
    create table site_ranked_banidos (user_id uuid primary key);
    create function site_rk_processar() returns int language sql as $$ select 0 $$;
    insert into auth.users select ('00000000-0000-0000-0000-00000000000' || g)::uuid from generate_series(1, 9) g;`);
  assert.equal(r.status, 0, r.stderr);
  // os 'hoje' das tabelas de controle nascem da data do stub (2026-10-14: semana de 12/10, mês de 01/10)
  r = psql(['-d', 't'], readFileSync(new URL('../supabase/migrations/0184_ranking_premios_rc.sql', import.meta.url), 'utf8'));
  assert.equal(r.status, 0, r.stderr);
});
after(() => {
  if (!TEM || !dir) return;
  try { execSync(como(`${BIN}/pg_ctl -D ${dir}/data -m immediate stop`), { stdio: 'ignore' }); } catch { /* já parado */ }
  rmSync(dir, { recursive: true, force: true });
});
const t = (nome, fn) => test(nome, { skip: !TEM && 'PostgreSQL não encontrado' }, fn);

t('semana fecha: top 5 recebe, banido/admin/negativo não, uma única vez', () => {
  // semana de 12/10 a 18/10: u1..u7 com PDR; u8 só tem ajuste de admin; u9 banido
  const l = (u, d, m, v) => V(`insert into site_rk_lanc (user_id, dia, motivo, delta) values ('${U(u)}', '${d}', '${m}', ${v})`);
  l(1, '2026-10-12', 'partida', 50); l(2, '2026-10-13', 'partida', 40); l(3, '2026-10-13', 'partida', 30);
  l(4, '2026-10-14', 'partida', 20); l(5, '2026-10-15', 'partida', 10); l(6, '2026-10-15', 'partida', 9);
  l(7, '2026-10-15', 'partida', -5); l(8, '2026-10-16', 'admin', 99); l(9, '2026-10-16', 'partida', 70);
  V("insert into site_ranked_banidos values ('" + U(9) + "')");
  l(5, '2026-10-20', 'partida', 500); // semana seguinte: não conta
  assert.equal(V('select site_rk_premiar()', '2026-10-18'), '0', 'semana ainda aberta');
  assert.equal(V('select site_rk_premiar()', '2026-10-19'), '5');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(saldo), [1000, 700, 500, 500, 500, 0, 0, 0, 0]);
  assert.equal(V('select site_rk_premiar()', '2026-10-19'), '0', 'não paga duas vezes');
  assert.equal(V("select count(*) from site_moedas_lanc where motivo = 'rank_semanal'"), '5');
});

t('mês fecha: 3.000 / 2.000 / 1.000; semanas e meses pulados são alcançados', () => {
  // outubro: soma de todas as semanas do mês (u1 50, u2 40, u3 30, u4 20, u5 510, u6 9)
  assert.equal(V('select site_rk_premiar()', '2026-11-02'), '6'); // mensal (5) + semana de 26/10 vazia + semana 19/10 (u5)
  const premios = V("select string_agg(pos || ':' || user_id::text || ':' || rc, ',' order by pos) from site_rk_premios where periodo = 'mensal' and inicio = '2026-10-01'");
  assert.equal(premios, `1:${U(5)}:3000,2:${U(1)}:2000,3:${U(2)}:1000,4:${U(3)}:1000,5:${U(4)}:1000`);
  assert.equal(V("select count(*) from site_rk_premios where periodo = 'semanal' and inicio = '2026-10-19'"), '1');
});

t('processar chama a premiação e a tabela de prêmios fica pública', () => {
  V("insert into site_rk_lanc (user_id, dia, motivo, delta) values ('" + U(6) + "', '2026-11-03', 'partida', 5)", '2026-11-03');
  V('select site_rk_processar()', '2026-11-10');
  assert.equal(V("select rc from site_rk_premios where periodo = 'semanal' and inicio = '2026-11-02' and pos = 1"), '1000');
  const info = JSON.parse(V("select site_rk_premios_info()", '2026-11-10', U(6)));
  assert.equal(info.semanal.premios['1'], 1000);
  assert.equal(info.mensal.premios['1'], 3000);
  assert.equal(info.semanal.fim, '2026-11-15');
  assert.equal(info.ultimos[0].rc, 1000);
});
