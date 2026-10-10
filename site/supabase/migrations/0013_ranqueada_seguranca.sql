-- Ranqueada: segurança.
--   A) O ingresso (vaga) de uma carreira fica usado para sempre. Antes, se o
--      jogador apagasse o resultado do histórico, a vaga voltava a ficar livre
--      e podia ser reaproveitada em outra carreira.
--   C) Painel do administrador: lista das carreiras ranqueadas com sinais de
--      suspeita (rápida demais, pontuação que não bate com os troféus, nota
--      muito alta), botão para anular uma partida e para tirar (ou devolver)
--      um jogador da ranqueada.
--
-- Como aplicar: cole este arquivo no SQL Editor do Supabase e clique em Run
-- (depois do 0012). Rodar de novo é seguro.

-- ---------------------------------------------------------------- A) vaga usada
alter table public.site_ranked_inicios add column if not exists usado_em timestamptz;
update public.site_ranked_inicios set usado_em = criado where result_id is not null and usado_em is null;

-- ------------------------------------------------- jogadores fora da ranqueada
create table if not exists public.site_ranked_banidos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  motivo text,
  criado timestamptz not null default now()
);
alter table public.site_ranked_banidos enable row level security;

-- Começo de carreira (igual ao 0012, mais: quem foi tirado da ranqueada não
-- recebe ingresso).
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
  if exists (select 1 from site_ranked_banidos where user_id = uid) then
    return jsonb_build_object('token', null, 'dia', hoje, 'banido', true);
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

-- Fim de carreira (igual ao 0012, mais: ingresso usado uma vez só, para
-- sempre, e quem foi tirado da ranqueada não pontua).
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
  if exists (select 1 from site_ranked_banidos where user_id = new.user_id) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || new.user_id::text));
  limite := site_ranked_limite(new.user_id, hoje);
  if (select count(*) from site_ranked_partidas where user_id = new.user_id and dia = hoje) >= limite then
    return new;
  end if;
  update site_ranked_inicios i set result_id = new.id, usado_em = now()
   where i.id = tok::uuid and i.user_id = new.user_id and i.dia = hoje and i.usado_em is null
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

-- ------------------------------------------------------------- C) painel admin
-- Carreiras ranqueadas do período, com o que é preciso para achar suspeitas:
--   duracao_s: do ingresso (começo, relógio do servidor) até a partida entrar;
--   esperado_min / esperado_max: faixa de pontos possível para o OVR máximo,
--     troféus, temporadas e dinheiro informados (calibrada com 3.000
--     carreiras simuladas: nenhuma carreira honesta ficou fora).
create or replace function public.site_admin_ranked(days int default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  hoje date := site_hoje_br();
  ini date;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  days := least(greatest(coalesce(days, 7), 1), 365);
  ini := hoje - (days - 1);
  return jsonb_build_object(
    'dias', days,
    'partidas', (select coalesce(jsonb_agg(x order by x.criado desc), '[]'::jsonb) from (
      select k.id, k.dia, k.criado, k.score, pr.username,
             i.criado as comecou,
             extract(epoch from (k.criado - i.criado))::int as duracao_s,
             (r.summary->>'peakOvr')::int as ovr,
             (r.summary->>'seasons')::int as temporadas,
             r.summary->>'legacy' as legado,
             r.summary->>'role' as rota,
             r.summary->'titles' as titulos,
             b.base + 4 * b.ligas as esperado_min,
             b.base + 20 * b.ligas + 25 * b.mundial + 15 * b.temporadas + 20 as esperado_max
        from site_ranked_partidas k
        join site_profiles pr on pr.id = k.user_id
        left join site_game_results r on r.id = k.result_id
        left join site_ranked_inicios i on i.result_id = k.result_id
        left join lateral (
          select (r.summary->>'peakOvr')::numeric * 2
                 + coalesce((r.summary->'titles'->>'mundial')::numeric, 0) * 120
                 + coalesce((r.summary->'titles'->>'msi')::numeric, 0) * 60
                 + coalesce((r.summary->'titles'->>'firstStand')::numeric, 0) * 35
                 + case when (r.summary->>'earnings')::numeric > 10000
                        then round(10 * log((r.summary->>'earnings')::numeric / 10000)) else 0 end as base,
                 coalesce((r.summary->'titles'->>'ligas')::numeric, 0) as ligas,
                 coalesce((r.summary->'titles'->>'mundial')::numeric, 0) as mundial,
                 coalesce((r.summary->>'seasons')::numeric, 0) as temporadas
           where r.summary ? 'peakOvr' and jsonb_typeof(r.summary->'peakOvr') = 'number'
        ) b on true
       where k.dia >= ini
       order by k.criado desc
       limit 1000) x),
    'banidos', (select coalesce(jsonb_agg(jsonb_build_object('username', pr.username, 'motivo', b.motivo, 'criado', b.criado)
                                          order by b.criado desc), '[]'::jsonb)
                  from site_ranked_banidos b join site_profiles pr on pr.id = b.user_id)
  );
end;
$$;
revoke all on function public.site_admin_ranked(int) from public, anon;
grant execute on function public.site_admin_ranked(int) to authenticated;

-- Anula uma partida ranqueada (sai da nota do dia, do ranking e do ciclo).
create or replace function public.site_admin_ranked_anular(partida bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  delete from site_ranked_partidas where id = partida;
  get diagnostics n = row_count;
  return jsonb_build_object('anuladas', n);
end;
$$;
revoke all on function public.site_admin_ranked_anular(bigint) from public, anon;
grant execute on function public.site_admin_ranked_anular(bigint) to authenticated;

-- Tira um jogador da ranqueada (apaga as partidas ranqueadas e o elo dele e
-- impede que as próximas carreiras valham) ou devolve (banir = false).
create or replace function public.site_admin_ranked_banir(nome text, motivo text default null, banir boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  n int := 0;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  select id into alvo from site_profiles where lower(username) = lower(nome);
  if alvo is null then
    raise exception 'user_not_found';
  end if;
  if banir then
    insert into site_ranked_banidos (user_id, motivo) values (alvo, nullif(trim(motivo), ''))
    on conflict (user_id) do update set motivo = excluded.motivo;
    delete from site_ranked_partidas where user_id = alvo;
    get diagnostics n = row_count;
    delete from site_ranked where user_id = alvo;
  else
    delete from site_ranked_banidos where user_id = alvo;
  end if;
  return jsonb_build_object('username', nome, 'banido', banir, 'partidas_apagadas', n);
end;
$$;
revoke all on function public.site_admin_ranked_banir(text, text, boolean) from public, anon;
grant execute on function public.site_admin_ranked_banir(text, text, boolean) to authenticated;
