-- Várias edições da Copa e do Mundial na mesma semana: cada edição leva até 16 técnicos com vaga (os de maior poder primeiro) e é completada
-- com equipes do sistema. Quando as 16 vagas de técnicos lotam, os que sobraram jogam uma nova edição na mesma semana
-- ("Copa Internacional · S1 #1", "#2", ...; o mesmo para o Mundial). Cada edição tem premiação, troféu e campeão próprios.
-- Rode depois da 0140; seguro rodar de novo.

alter table public.tc_ligas add column if not exists edicao int not null default 1;
drop index if exists public.tc_ligas_unica;
create unique index if not exists tc_ligas_unica on public.tc_ligas (temporada, semana, tipo, divisao, coalesce(dono_org, 0), edicao);
update public.tc_ligas set nome = nome || ' #1' where tipo in ('copa', 'mundial') and nome !~ '#';


create or replace function public.tc_criar_copa(temp int, sem int, ini date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  lid bigint;
  ed int;
  t bigint[];
  reais int;
  i int;
  r record;
begin
  select coalesce(max(edicao), 0) + 1 into ed from tc_ligas where temporada = temp and semana = sem and tipo = 'copa'; -- cada chamada cria a próxima edição se ainda houver técnicos com vaga sem campeonato
  select coalesce(array_agg(x.org_id order by tc_poder_org(x.org_id) desc, x.org_id), '{}') into t from (
    select v.org_id from tc_vagas v join tc_orgs o on o.id = v.org_id
     where v.temporada = temp and v.tipo = 'copa' and o.ativa and o.user_id is not null
       and not exists (select 1 from tc_liga_times x join tc_ligas lx on lx.id = x.liga_id where x.org_id = v.org_id and lx.temporada = temp and lx.semana = sem and lx.tipo = 'copa')
     order by tc_poder_org(v.org_id) desc, v.org_id limit 16) x;
  reais := coalesce(array_length(t, 1), 0);
  if reais = 0 then return null; end if;
  select t || coalesce(array_agg(s.id), '{}') into t from (
    select id from tc_orgs where user_id is null and ativa and id <> all (t)
     order by (divisao = 'principal') desc, poder_sistema desc, id limit 16 - reais) s;
  if coalesce(array_length(t, 1), 0) < 16 then return null; end if;
  insert into tc_ligas (temporada, semana, divisao, tipo, nome, edicao)
  values (temp, sem, 'principal', 'copa', (tc_cfg('nomes'))->>'copa' || ' · S' || temp::text || ' #' || ed::text, ed) returning id into lid;
  for i in 1..16 loop
    insert into tc_liga_times (liga_id, org_id, semente) values (lid, t[i], i);
  end loop;
  for r in select * from tc_rodadas(t, 10) loop -- 10 rodadas, 2 por dia, de segunda a sexta
    perform tc_partida_mm(lid, 'rodada', r.rod, ini + (r.rod - 1) / 2, r.a, r.b, 1);
  end loop;
  return lid;
end;
$$;
revoke all on function public.tc_criar_copa(int, int, date) from public, anon, authenticated;

create or replace function public.tc_criar_mundial(temp int, sem int, ini date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  lid bigint;
  ed int;
  t bigint[];
  gt bigint[];
  reais int;
  i int;
  g int;
  r record;
  q record;
begin
  select coalesce(max(edicao), 0) + 1 into ed from tc_ligas where temporada = temp and semana = sem and tipo = 'mundial'; -- cada chamada cria a próxima edição se ainda houver técnicos com vaga sem campeonato
  select coalesce(array_agg(x.org_id order by tc_poder_org(x.org_id) desc, x.org_id), '{}') into t from (
    select v.org_id from tc_vagas v join tc_orgs o on o.id = v.org_id
     where v.temporada = temp and v.tipo = 'mundial' and o.ativa and o.user_id is not null
       and not exists (select 1 from tc_liga_times x join tc_ligas lx on lx.id = x.liga_id where x.org_id = v.org_id and lx.temporada = temp and lx.semana = sem and lx.tipo = 'mundial')
     order by tc_poder_org(v.org_id) desc, v.org_id limit 16) x;
  reais := coalesce(array_length(t, 1), 0);
  if reais = 0 then return null; end if;
  select t || coalesce(array_agg(s.id), '{}') into t from (
    select id from tc_orgs where user_id is null and ativa and id <> all (t)
     order by (divisao = 'principal') desc, poder_sistema desc, id limit 16 - reais) s;
  if coalesce(array_length(t, 1), 0) < 16 then return null; end if;
  select array_agg(u order by tc_poder_org(u) desc, u) into t from unnest(t) as u; -- semente = ordem de poder
  insert into tc_ligas (temporada, semana, divisao, tipo, nome, edicao)
  values (temp, sem, 'principal', 'mundial', (tc_cfg('nomes'))->>'mundial' || ' · S' || temp::text || ' #' || ed::text, ed) returning id into lid;
  for i in 0..3 loop -- cada pote de 4 coloca uma equipe em cada grupo (sorteio fixo)
    g := 0;
    for r in select u.org from unnest(t[i * 4 + 1:i * 4 + 4]) as u(org) order by md5(lid::text || ':' || u.org::text) loop
      insert into tc_liga_times (liga_id, org_id, semente, grupo) values (lid, r.org, array_position(t, r.org), chr(65 + g));
      g := g + 1;
    end loop;
  end loop;
  for g in 0..3 loop -- grupos: cada adversário duas vezes (6 rodadas, 2 por dia, terça a quinta)
    select array_agg(org_id order by semente) into gt from tc_liga_times where liga_id = lid and grupo = chr(65 + g);
    for r in select * from tc_rodadas(gt, 6) loop
      perform tc_partida_mm(lid, 'rodada', r.rod, ini + 1 + (r.rod - 1) / 2, r.a, r.b, 1);
    end loop;
  end loop;
  for r in select t2.org_id, t2.grupo from tc_liga_times t2 where t2.liga_id = lid and tc_eh_real(t2.org_id) loop -- treino de segunda: 2 jogos contra equipes de fora do grupo
    i := 0;
    for q in select x.org_id from tc_liga_times x where x.liga_id = lid and x.grupo <> r.grupo
              order by md5(lid::text || ':treino:' || r.org_id::text || ':' || x.org_id::text) limit 2 loop
      i := i + 1;
      insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato, pov)
      values (lid, 'treino', i, ini, r.org_id, q.org_id, 1, r.org_id) on conflict do nothing;
    end loop;
  end loop;
  return lid;
end;
$$;
revoke all on function public.tc_criar_mundial(int, int, date) from public, anon, authenticated;


-- Cria todas as edições da semana (Copa na semana 2, Mundial na semana 4) até acabarem os técnicos com vaga.
create or replace function public.tc_criar_internacionais(temp int, sem int, ini date)
returns void language plpgsql security definer set search_path = public as $$
declare
  i int := 0;
  r bigint;
begin
  if sem not in (2, 4) then return; end if;
  loop
    i := i + 1;
    r := case when sem = 2 then tc_criar_copa(temp, sem, ini) else tc_criar_mundial(temp, sem, ini) end;
    exit when r is null or i >= 200;
  end loop;
end;
$$;
revoke all on function public.tc_criar_internacionais(int, int, date) from public, anon, authenticated;

create or replace function public.tc_avancar_internacionais(temp int, sem int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  l record;
  alg boolean := false;
begin
  for l in select id from tc_ligas where temporada = temp and semana = sem and tipo in ('copa', 'mundial') and status = 'aberta' order by id loop
    if tc_avancar(l.id) then alg := true; end if;
  end loop;
  return alg;
end;
$$;
revoke all on function public.tc_avancar_internacionais(int, int) from public, anon, authenticated;

create or replace function public.tc_internacionais_completos(temp int, sem int)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from tc_ligas l where l.temporada = temp and l.semana = sem and l.tipo in ('copa', 'mundial') and l.status = 'aberta' and not tc_internacional_completo(l.id));
$$;
revoke all on function public.tc_internacionais_completos(int, int) from public, anon, authenticated;

create or replace function public.tc_encerrar_internacionais(temp int, sem int)
returns void language plpgsql security definer set search_path = public as $$
declare
  l record;
begin
  for l in select id from tc_ligas where temporada = temp and semana = sem and tipo in ('copa', 'mundial') and status = 'aberta' order by id loop
    perform tc_encerrar_internacional(l.id);
  end loop;
end;
$$;
revoke all on function public.tc_encerrar_internacionais(int, int) from public, anon, authenticated;


create or replace function public.tc_sincronizar()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cal jsonb := tc_calendario();
  hoje date := site_hoje_br();
  gw_hoje int;
  gw int;
  c jsonb;
  inicio date := ((tc_cfg('calendario'))->>'inicio')::date;
  la bigint;
  lp bigint;
  lc bigint;
  lm bigint;
  p record;
  feitas int := 0;
  o record;
  pend int;
  passo int;
  temp int;
  sem int;
  ini date;
  av1 boolean; av2 boolean; av3 boolean; av4 boolean;
begin
  perform tc_exigir(uid);
  if (cal->>'antes')::boolean then
    return jsonb_build_object('antes', true, 'inicio', inicio);
  end if;
  perform pg_advisory_xact_lock(85002);
  perform tc_garantir_sistema();
  delete from tc_snap_dia where dia < hoje - 7;
  gw_hoje := (cal->>'gw')::int;
  select valor into c from tc_config where chave = 'semana_proc';
  if c is null then
    insert into tc_config (chave, valor) values ('semana_proc', to_jsonb(gw_hoje));
    gw := gw_hoje;
  else
    gw := (c::text)::int;
  end if;
  while gw <= gw_hoje loop
    temp := gw / 4 + 1;
    sem := gw % 4 + 1;
    ini := inicio + gw * 7;
    perform tc_criar_internacionais(temp, sem, ini); -- internacionais primeiro: quem joga a Copa/Mundial não joga a Nacional
    perform tc_criar_ligas_semana(temp, sem, ini);
    -- Processa o que já pode ser jogado e avança as chaves (até 4 passes: quartas, semifinais, final).
    for passo in 1..6 loop
      for p in select id from tc_partidas where liga_id in (select id from tc_ligas where temporada = temp and semana = sem)
                and status = 'agendada' and dia <= hoje order by dia, id loop
        if tc_processar_partida(p.id) then feitas := feitas + 1; end if;
      end loop;
      av1 := tc_avancar_internacionais(temp, sem); av2 := false;
      av3 := tc_avancar_semana(temp, sem); av4 := false;
      exit when not (av1 or av2 or av3 or av4);
    end loop;
    select count(*) into pend from tc_partidas where liga_id in (select id from tc_ligas where temporada = temp and semana = sem) and status = 'agendada';
    exit when pend > 0 or not tc_internacionais_completos(temp, sem);
    perform tc_encerrar_semana(temp, sem);
    perform tc_encerrar_internacionais(temp, sem);
    perform tc_aplicar_promocoes(temp, sem);
    for o in select id from tc_orgs where ativa order by id loop
      perform tc_fechar_semana_org(o.id, gw);
    end loop;
    update tc_config set valor = to_jsonb(gw + 1) where chave = 'semana_proc';
    gw := gw + 1;
  end loop;
  return jsonb_build_object('processadas', feitas, 'gw', gw_hoje, 'temporada', cal->'temporada', 'semana', cal->'semana', 'dia', cal->'dia');
end;
$$;
revoke all on function public.tc_sincronizar() from public, anon;
grant execute on function public.tc_sincronizar() to authenticated;
