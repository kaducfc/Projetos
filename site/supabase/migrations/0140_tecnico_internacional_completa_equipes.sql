-- Copa e Mundial: se a divisão principal não tiver equipes do sistema suficientes, completa as 16 vagas com equipes da divisão de acesso.
-- Rode depois da 0139; seguro rodar de novo.


create or replace function public.tc_criar_copa(temp int, sem int, ini date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  lid bigint;
  t bigint[];
  reais int;
  i int;
  r record;
begin
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'copa';
  if lid is not null then return lid; end if;
  select coalesce(array_agg(x.org_id order by tc_poder_org(x.org_id) desc, x.org_id), '{}') into t from (
    select v.org_id from tc_vagas v join tc_orgs o on o.id = v.org_id
     where v.temporada = temp and v.tipo = 'copa' and o.ativa and o.user_id is not null
     order by tc_poder_org(v.org_id) desc, v.org_id limit 16) x;
  reais := coalesce(array_length(t, 1), 0);
  if reais = 0 then return null; end if;
  select t || coalesce(array_agg(s.id), '{}') into t from (
    select id from tc_orgs where user_id is null and ativa and id <> all (t)
     order by (divisao = 'principal') desc, poder_sistema desc, id limit 16 - reais) s;
  if coalesce(array_length(t, 1), 0) < 16 then return null; end if;
  insert into tc_ligas (temporada, semana, divisao, tipo, nome)
  values (temp, sem, 'principal', 'copa', (tc_cfg('nomes'))->>'copa' || ' · S' || temp::text) returning id into lid;
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
  t bigint[];
  gt bigint[];
  reais int;
  i int;
  g int;
  r record;
  q record;
begin
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'mundial';
  if lid is not null then return lid; end if;
  select coalesce(array_agg(x.org_id order by tc_poder_org(x.org_id) desc, x.org_id), '{}') into t from (
    select v.org_id from tc_vagas v join tc_orgs o on o.id = v.org_id
     where v.temporada = temp and v.tipo = 'mundial' and o.ativa and o.user_id is not null
     order by tc_poder_org(v.org_id) desc, v.org_id limit 16) x;
  reais := coalesce(array_length(t, 1), 0);
  if reais = 0 then return null; end if;
  select t || coalesce(array_agg(s.id), '{}') into t from (
    select id from tc_orgs where user_id is null and ativa and id <> all (t)
     order by (divisao = 'principal') desc, poder_sistema desc, id limit 16 - reais) s;
  if coalesce(array_length(t, 1), 0) < 16 then return null; end if;
  select array_agg(u order by tc_poder_org(u) desc, u) into t from unnest(t) as u; -- semente = ordem de poder
  insert into tc_ligas (temporada, semana, divisao, tipo, nome)
  values (temp, sem, 'principal', 'mundial', (tc_cfg('nomes'))->>'mundial' || ' · S' || temp::text) returning id into lid;
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
