-- Ranqueada: compensação de 02/10/2026.
--
-- Na noite da troca de regras (0010/0011), quem estava com a página do jogo
-- aberta desde antes da atualização terminou carreiras sem o ingresso de
-- começo, e elas não valeram. Para compensar, NESSE DIA cada carreira da
-- Carreira no Rift terminada sem ingresso (e que não entrou na ranqueada)
-- devolve 1 chance extra, até 3 extras: o limite do dia vai de 3 para até 6.
--
-- Para compensar outro dia no futuro, basta:
--   insert into site_ranked_compensacao (dia) values ('AAAA-MM-DD');
--
-- Como aplicar: cole este arquivo no SQL Editor do Supabase e clique em Run
-- (depois do 0011). Rodar de novo é seguro.

create table if not exists public.site_ranked_compensacao (
  dia date primary key
);
alter table public.site_ranked_compensacao enable row level security;
insert into public.site_ranked_compensacao (dia) values ('2026-10-02') on conflict do nothing;

-- Quantas carreiras ranqueadas a conta pode fazer no dia (3 + compensação).
create or replace function public.site_ranked_limite(uid uuid, d date)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select 3 + case when not exists (select 1 from site_ranked_compensacao c where c.dia = d) then 0 else
    least(3, (select count(*)::int from site_game_results r
               where r.user_id = uid and r.game_id = 'carreira-no-rift' and r.score is not null
                 and (r.played_at at time zone 'America/Sao_Paulo')::date = d
                 and r.summary->>'ranked' is null
                 and not exists (select 1 from site_ranked_partidas k where k.result_id = r.id)))
  end;
$$;
revoke all on function public.site_ranked_limite(uuid, date) from public, anon, authenticated;

create or replace function public.site_ranked_iniciar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  limite int;
  feitas int;
  novo uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || uid::text));
  limite := site_ranked_limite(uid, hoje);
  select count(*) into feitas from site_ranked_inicios where user_id = uid and dia = hoje;
  if feitas >= limite then
    return jsonb_build_object('token', null, 'dia', hoje, 'numero', null, 'restantes', 0, 'limite', limite);
  end if;
  insert into site_ranked_inicios (user_id, dia) values (uid, hoje) returning id into novo;
  return jsonb_build_object('token', novo, 'dia', hoje, 'numero', feitas + 1, 'restantes', limite - feitas - 1, 'limite', limite);
end;
$$;
revoke all on function public.site_ranked_iniciar() from public, anon;
grant execute on function public.site_ranked_iniciar() to authenticated;

create or replace function public.site_ranked_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := site_hoje_br();
  tok text := new.summary->>'ranked';
  limite int;
  usado uuid;
begin
  if new.game_id <> 'carreira-no-rift' or new.score is null or new.score < 0 or new.score > 3000 then
    return new;
  end if;
  if tok is null or tok !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || new.user_id::text));
  limite := site_ranked_limite(new.user_id, hoje);
  if (select count(*) from site_ranked_partidas where user_id = new.user_id and dia = hoje) >= limite then
    return new;
  end if;
  update site_ranked_inicios i set result_id = new.id
   where i.id = tok::uuid and i.user_id = new.user_id and i.dia = hoje and i.result_id is null
     and (select count(*) from site_ranked_inicios o
           where o.user_id = i.user_id and o.dia = i.dia and (o.criado, o.id) < (i.criado, i.id)) < limite
  returning i.id into usado;
  if usado is null then
    return new;
  end if;
  insert into site_ranked_partidas (user_id, dia, score, result_id)
  values (new.user_id, hoje, round(new.score), new.id);
  insert into site_ranked (user_id) values (new.user_id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Minha ranqueada: igual à do 0011, mais o limite do dia ('hoje.limite').
create or replace function public.site_ranked_meu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg site_ranked_config;
  hoje date := site_hoje_br();
  n int;
  ini date;
  meu site_ranked;
  elo text;
  dias jsonb;
  soma int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform site_ranked_processar();
  select * into cfg from site_ranked_config where id = 1;
  n := greatest(0, (hoje - cfg.inicio) / 3);
  ini := cfg.inicio + 3 * n;
  select * into meu from site_ranked where user_id = uid;
  elo := coalesce(meu.elo, 'bronze');

  select coalesce(jsonb_agg(jsonb_build_object('dia', g.dia::date, 'melhor', d.melhor) order by g.dia), '[]'::jsonb),
         coalesce(sum(d.melhor), 0)
    into dias, soma
    from generate_series(ini, ini + 2, interval '1 day') as g(dia)
    left join (
      select dia, max(score) as melhor from site_ranked_partidas
       where user_id = uid and dia between ini and ini + 2 group by dia
    ) d on d.dia = g.dia::date;

  return jsonb_build_object(
    'elo', elo,
    'jogou', meu.user_id is not null,
    'temporada', cfg.temporada,
    'hoje', jsonb_build_object(
      'dia', hoje,
      'partidas', (select count(*) from site_ranked_partidas where user_id = uid and dia = hoje),
      'iniciadas', least(site_ranked_limite(uid, hoje), (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje)),
      'limite', site_ranked_limite(uid, hoje),
      'melhor', (select max(score) from site_ranked_partidas where user_id = uid and dia = hoje),
      'validas', coalesce((select jsonb_agg(r.client_id) from site_ranked_partidas k
                             join site_game_results r on r.id = k.result_id
                            where k.user_id = uid and k.dia = hoje), '[]'::jsonb)),
    'ciclo', jsonb_build_object(
      'numero', n, 'inicio', ini, 'fim', ini + 2, 'atualiza', ini + 3,
      'dias', dias, 'total', soma, 'media', round(soma / 3.0, 1),
      'minimo', case when meu.user_id is null then 0 else site_ranked_minimo(elo) end),
    'proximo', case when site_ranked_proximo(elo) is null then null else
      jsonb_build_object('elo', site_ranked_proximo(elo), 'pontos', site_ranked_limiar(site_ranked_proximo(elo))) end,
    'ultimo_total', meu.ultima_media,
    'desafiantes', (select count(*) from site_ranked where site_ranked.elo = 'desafiante'),
    'vagas', 100,
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('ciclo', h.ciclo, 'de', h.de, 'para', h.para, 'pontos', round(h.media), 'quando', h.criado) order by h.id desc)
        from (select * from site_ranked_historico where user_id = uid order by id desc limit 10) h), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.site_ranked_meu() from public, anon;
grant execute on function public.site_ranked_meu() to authenticated;
