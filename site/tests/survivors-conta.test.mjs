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

t('painel do administrador (0195): números por jogo e painel do Rift Survivors, só para administradores', () => {
  const r0 = psql(['-d', 't'], `
    create table if not exists public.site_events (id bigserial primary key, created_at timestamptz not null default now(), kind text not null, game_id text, device text not null, user_id uuid, data jsonb not null default '{}');
    create table if not exists public.site_game_results (id uuid primary key default gen_random_uuid(), user_id uuid not null, game_id text not null, score numeric, summary jsonb not null default '{}', played_at timestamptz not null default now(), client_id text not null default gen_random_uuid()::text);
    create table if not exists public.site_rk_dia (user_id uuid, dia date, jogo text, n int default 1, base int, nivel int, pdr int, score numeric, result_id uuid, criado timestamptz default now());
    insert into public.site_admins values ('${U(1)}') on conflict do nothing;
    insert into public.site_profiles values ('${U(1)}', 'adm') on conflict do nothing;
    insert into public.site_profiles values ('${U(2)}', 'jogador2') on conflict do nothing;
    insert into public.site_events (kind, game_id, device) values ('game_start', 'survivors', 'dispositivo-1'), ('game_end', 'survivors', 'dispositivo-1'), ('game_start', 'barao', 'dispositivo-2');
    insert into public.site_game_results (user_id, game_id, score, summary) values
      ('${U(1)}', 'survivors', 700, '{"campeao":"garen","reino":"ionia","tempo":600,"abates":300,"nivel":22,"venceu":true,"ranked":"abc"}'),
      ('${U(2)}', 'survivors', 200, '{"campeao":"ahri","reino":"ixtal","tempo":150,"abates":40,"nivel":5,"venceu":false}'),
      ('${U(2)}', 'barao', 10, '{}');
    insert into public.site_rk_dia (user_id, dia, jogo, base, nivel, pdr) values ('${U(1)}', current_date, 'survivors', 20, 0, 20);
  `); assert.equal(r0.status, 0, r0.stderr);
  const r1 = psql(['-d', 't'], readFileSync(new URL('../supabase/migrations/0195_painel_jogos_survivors.sql', import.meta.url), 'utf8')); assert.equal(r1.status, 0, r1.stderr);
  assert.equal(Q('select sv_admin_painel(30)', 2).err, 'not_admin'); assert.equal(Q('select site_admin_jogos(30)', 2).err, 'not_admin');
  const sv = JSON.parse(Q('select sv_admin_painel(30)', 1).out);
  assert.equal(sv.resumo.partidas, 2); assert.equal(sv.resumo.jogadores, 2); assert.equal(sv.resumo.vitorias, 1); assert.equal(sv.resumo.ranqueadas, 1);
  assert.equal(sv.resumo.tempo_maximo, 600); assert.equal(sv.serie.length, 30);
  assert.deepEqual(sv.reinos.map((x) => x.reino).sort(), ['ionia', 'ixtal']); assert.deepEqual(sv.campeoes.map((x) => x.campeao).sort(), ['ahri', 'garen']);
  assert.equal(sv.faixas_tempo.reduce((s, f) => s + f.n, 0), 2); assert.equal(sv.top[0].usuario, 'adm'); assert.equal(sv.top[0].tempo, 600);
  assert.equal(sv.ranqueada.partidas, 1); assert.equal(sv.ranqueada.pdr_total, 20);
  assert.equal(sv.progresso.contas, 2); assert.ok(sv.progresso.essencia_total >= 62); assert.equal(sv.progresso.liberados.garen, 2);
  const jg = JSON.parse(Q('select site_admin_jogos(30)', 1).out).jogos;
  assert.equal(jg.survivors.iniciadas, 1); assert.equal(jg.survivors.terminadas, 1); assert.equal(jg.survivors.resultados, 2); assert.equal(jg.survivors.contas, 2);
  assert.equal(jg.barao.iniciadas, 1); assert.equal(jg.barao.resultados, 1);
  const r2 = psql(['-d', 't'], readFileSync(new URL('../supabase/migrations/0195_painel_jogos_survivors.sql', import.meta.url), 'utf8')); assert.equal(r2.status, 0, 'rodar de novo');
});

t('ranqueada (0196): vitória após o chefe aparecer (tempo > 10 min) volta a contar e as partidas de hoje recusadas são refeitas', () => {
  const tok = '11111111-1111-1111-1111-111111111111'; const tok2 = '22222222-2222-2222-2222-222222222222';
  const r0 = psql(['-d', 't'], `
    create or replace function public.site_hoje_br() returns date language sql as $f$ select current_date $f$;
    create table public.site_ranked_inicios (id uuid primary key, user_id uuid, dia date, jogo text, criado timestamptz default now(), usado_em timestamptz, result_id uuid);
    create or replace function public.site_ranked_registrar() returns trigger language plpgsql as $f$
    declare tempo int; max_t int; venceu boolean; usado uuid;
    begin
      tempo := (new.summary->>'tempo')::int; venceu := coalesce((new.summary->>'venceu')::boolean, false);
      max_t := case when new.summary->>'reino' = 'ixtal' then 900 else 600 end;
      if tempo > max_t + 5 then return new; end if;
      if venceu and tempo < max_t - 5 then return new; end if;
      update site_ranked_inicios i set result_id = new.id, usado_em = now() where i.id = (new.summary->>'ranked')::uuid and i.usado_em is null returning i.id into usado;
      if usado is not null then insert into site_rk_dia (user_id, dia, jogo, base, nivel, pdr) values (new.user_id, current_date, 'survivors', 35, 0, 35); end if;
      return new;
    end $f$;
    drop trigger if exists site_ranked_on_result on public.site_game_results;
    create trigger site_ranked_on_result after insert on public.site_game_results for each row execute function public.site_ranked_registrar();
    delete from public.site_rk_dia; delete from public.site_game_results where game_id = 'survivors';
    insert into public.site_ranked_inicios (id, user_id, dia, jogo) values ('${tok}', '${U(1)}', current_date, 'survivors'), ('${tok2}', '${U(2)}', current_date, 'survivors');
    insert into public.site_game_results (user_id, game_id, score, summary, client_id) values
      ('${U(1)}', 'survivors', 5700, '{"reino":"ionia","tempo":648,"venceu":true,"ranked":"${tok}"}', 'a'),
      ('${U(2)}', 'survivors', 100, '{"reino":"ionia","tempo":300,"venceu":false,"ranked":"${tok2}"}', 'b');
  `); assert.equal(r0.status, 0, r0.stderr);
  assert.equal(psql(['-d', 't', '-c', 'select count(*) from site_rk_dia']).stdout.trim(), '1', 'antes: só a derrota normal conta; a vitória de 10:48 foi recusada');
  const mig = readFileSync(new URL('../supabase/migrations/0196_survivors_vitoria_tempo.sql', import.meta.url), 'utf8');
  const r1 = psql(['-d', 't'], mig); assert.equal(r1.status, 0, r1.stderr);
  assert.equal(psql(['-d', 't', '-c', "select pdr from site_rk_dia where user_id = '" + U(1) + "'"]).stdout.trim(), '35', 'depois: a vitória vale 35');
  assert.equal(psql(['-d', 't', '-c', "select count(*) from site_game_results where game_id = 'survivors'"]).stdout.trim(), '2', 'sem duplicar resultados');
  assert.equal(psql(['-d', 't', '-c', 'select count(*) from site_rk_dia']).stdout.trim(), '2');
  const r2 = psql(['-d', 't'], mig); assert.equal(r2.status, 0, `rodar de novo: ${r2.stderr}`);
  assert.equal(psql(['-d', 't', '-c', 'select count(*) from site_rk_dia']).stdout.trim(), '2', 'idempotente');
});

t('passe Zaun e Piltover (0200): cria o passe em teste, devolve as datas e escolhe o passe público do momento', () => {
  const arq = (f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');
  const r0 = psql(['-d', 't'], `
    create table if not exists public.site_recompensas (user_id uuid not null, tipo text not null, chave text not null, origem text, unique (user_id, tipo, chave));
    create table if not exists public.site_game_results (id uuid primary key default gen_random_uuid(), user_id uuid not null, game_id text not null, score numeric, summary jsonb not null default '{}'::jsonb, played_at timestamptz not null default now(), client_id text);
    create or replace function public.site_hoje_br() returns date language sql as $f$ select current_date $f$;
    insert into public.site_admins values ('${U(1)}') on conflict do nothing;
  `); assert.equal(r0.status, 0, r0.stderr);
  for (const f of ['0039_passe_batalha.sql', '0040_passe_nivel.sql']) { const r = psql(['-d', 't'], arq(f)); assert.equal(r.status, 0, `${f}: ${r.stderr}`); }
  psql(['-d', 't', '-c', "alter table site_passe_niveis drop constraint if exists site_passe_niveis_tipo_check; alter table site_passe_niveis add constraint site_passe_niveis_tipo_check check (tipo in ('moeda', 'efeito', 'icone', 'moldura'))"]); // como na 0053
  const mig = arq('0200_passe_zaun_piltover.sql');
  let r = psql(['-d', 't'], mig); assert.equal(r.status, 0, r.stderr);
  r = psql(['-d', 't'], mig); assert.equal(r.status, 0, `rodar de novo: ${r.stderr}`);
  assert.equal(psql(['-d', 't', '-c', "select count(*) from site_passe_niveis where passe = 'zaun-piltover-2026'"]).stdout.trim(), '15');
  // 0201: efeitos de nome como recompensa (grátis: Cintila no 6 e Cristal Hextech no 12; premium: Neon do Submundo no 7)
  const m2 = arq('0201_passe_zaun_efeitos.sql'); r = psql(['-d', 't'], m2); assert.equal(r.status, 0, r.stderr); r = psql(['-d', 't'], m2); assert.equal(r.status, 0, `0201 de novo: ${r.stderr}`);
  assert.equal(psql(['-d', 't', '-c', "select string_agg(nivel || ':' || trilha || ':' || tipo || ':' || chave, ' ' order by nivel) from site_passe_niveis where passe = 'zaun-piltover-2026' and tipo <> 'moeda'"]).stdout.trim(),
    '3:premium:moldura:mn-zaun 6:gratis:efeito:zn-cintila 7:premium:efeito:zn-neon 9:premium:efeito:gl-matrix 12:gratis:efeito:pl-cristal 15:premium:moldura:mn-mecanismo');
  // só o administrador vê o passe em teste; ele ainda não é público
  const adm = JSON.parse(Q("select site_passe_estado('zaun-piltover-2026')", 1).out);
  assert.equal(adm.passe.publico, false); assert.equal(adm.passe.fim, null); assert.equal(adm.niveis.length, 15);
  assert.equal(Q("select site_passe_estado('zaun-piltover-2026')", 2).err, 'passe_indisponivel');
  assert.equal(Q('select site_passe_atual()', 2).out, 'halloween-2026' === Q('select site_passe_atual()', 2).out ? 'halloween-2026' : '', 'o passe em teste não vira o atual');
  // lançamento: publica com datas; hoje cai dentro da janela
  r = psql(['-d', 't', '-c', "update site_passes set publico = true, inicio = current_date - 1, fim = current_date + 19 where id = 'zaun-piltover-2026'"]); assert.equal(r.status, 0, r.stderr);
  assert.equal(Q('select site_passe_atual()', 2).out, 'zaun-piltover-2026');
  const pub = JSON.parse(Q("select site_passe_estado('zaun-piltover-2026')", 2).out);
  assert.equal(pub.passe.fim, new Date(Date.now() + 19 * 86400000).toISOString().slice(0, 10));
  // fora da janela: nenhum passe público
  r = psql(['-d', 't', '-c', "update site_passes set fim = current_date - 1 where id = 'zaun-piltover-2026'"]); assert.equal(r.status, 0, r.stderr);
  assert.equal(Q('select site_passe_atual()', 2).out, '');
});
