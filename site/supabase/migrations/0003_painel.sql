-- Painel do administrador: estatísticas de acesso e dos jogos.
--
-- O site registra eventos anônimos (visita do dia, início e fim de partida)
-- na tabela site_events. Ninguém consegue ler essa tabela pela API: só a
-- função site_admin_stats, que confere se quem pede é administrador.
--
-- Como aplicar: cole este arquivo no SQL Editor do Supabase e clique em Run.
-- Rodar de novo é seguro. No fim do arquivo, troque o e-mail pelo da conta
-- que vai ver o painel (a conta precisa já existir no site).

-- ---------------------------------------------------------------
-- Eventos anônimos
-- ---------------------------------------------------------------
create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('visit', 'game_start', 'game_end')),
  game_id text check (char_length(game_id) <= 40),
  device text not null check (char_length(device) between 8 and 64),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 4000)
);
create index if not exists site_events_kind_time on public.site_events (kind, created_at desc);
create index if not exists site_events_game_time on public.site_events (game_id, kind, created_at desc);

alter table public.site_events enable row level security;

-- Qualquer visitante pode registrar eventos (só inserir; nunca ler).
-- Quem está logado só pode marcar o próprio id.
drop policy if exists "site_events inserir" on public.site_events;
create policy "site_events inserir" on public.site_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

grant insert on public.site_events to anon, authenticated;

-- ---------------------------------------------------------------
-- Administradores (sem acesso pela API; editado só pelo SQL Editor)
-- ---------------------------------------------------------------
create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.site_admins enable row level security;

create or replace function public.site_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from site_admins where user_id = auth.uid());
$$;
revoke all on function public.site_is_admin() from public, anon;
grant execute on function public.site_is_admin() to authenticated;

-- ---------------------------------------------------------------
-- Estatísticas para o painel (dias no fuso de Brasília)
-- ---------------------------------------------------------------
create or replace function public.site_admin_stats(days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  since timestamptz;
  today date := (now() at time zone tz)::date;
  result jsonb;
begin
  if not site_is_admin() then
    raise exception 'not_admin';
  end if;
  days := least(greatest(coalesce(days, 30), 1), 365);
  since := ((today - (days - 1))::timestamp) at time zone tz;

  with ev as (
    select *, (created_at at time zone tz)::date as dia from site_events where created_at >= since
  ),
  serie as (
    select d::date as dia from generate_series(today - (days - 1), today, interval '1 day') d
  ),
  por_dia as (
    select s.dia,
      (select count(distinct device) from ev where ev.dia = s.dia and kind = 'visit') as visitantes,
      (select count(*) from ev where ev.dia = s.dia and kind = 'game_start') as partidas,
      (select count(*) from ev where ev.dia = s.dia and kind = 'game_end') as terminadas,
      (select count(*) from auth.users u where (u.created_at at time zone tz)::date = s.dia) as contas
    from serie s
  ),
  fim as (
    select * from ev where kind = 'game_end' and game_id = 'carreira-no-rift'
  ),
  ini as (
    select * from ev where kind = 'game_start' and game_id = 'carreira-no-rift'
  )
  select jsonb_build_object(
    'dias', days,
    'hoje', jsonb_build_object(
      'visitantes', (select count(distinct device) from ev where kind = 'visit' and dia = today),
      'partidas', (select count(*) from ev where kind = 'game_start' and dia = today),
      'terminadas', (select count(*) from ev where kind = 'game_end' and dia = today),
      'contas', (select count(*) from auth.users u where (u.created_at at time zone tz)::date = today)
    ),
    'periodo', jsonb_build_object(
      'visitantes', (select count(distinct device) from ev where kind = 'visit'),
      'jogadores', (select count(distinct device) from ev where kind = 'game_start'),
      'partidas', (select count(*) from ev where kind = 'game_start'),
      'terminadas', (select count(*) from ev where kind = 'game_end'),
      'contas', (select count(*) from auth.users u where u.created_at >= since)
    ),
    'total', jsonb_build_object(
      'contas', (select count(*) from auth.users),
      'visitantes', (select count(distinct device) from site_events where kind = 'visit'),
      'partidas', (select count(*) from site_events where kind = 'game_start')
    ),
    'por_dia', (select coalesce(jsonb_agg(to_jsonb(p) order by p.dia), '[]'::jsonb) from por_dia p),
    'carreira', jsonb_build_object(
      'iniciadas', (select count(*) from ini),
      'terminadas', (select count(*) from fim),
      'ovr_medio', (select round(avg((data->>'peakOvr')::numeric), 1) from fim),
      'ovr_mediana', (select percentile_cont(0.5) within group (order by (data->>'peakOvr')::numeric) from fim),
      'temporadas_media', (select round(avg((data->>'seasons')::numeric), 1) from fim),
      'trofeus_media', (select round(avg((data->>'trophies')::numeric), 1) from fim),
      'legado_medio', (select round(avg((data->>'score')::numeric)) from fim),
      'mundial_pct', (select round(100.0 * count(*) filter (where (data->>'worlds')::int > 0) / nullif(count(*), 0), 1) from fim),
      'ovr_faixas', (select coalesce(jsonb_agg(jsonb_build_object('faixa', f.faixa, 'n', f.n) order by f.ordem), '[]'::jsonb) from (
        select ordem, faixa, (select count(*) from fim where
          (data->>'peakOvr')::int >= lo and (data->>'peakOvr')::int < hi) as n
        from (values (1, '<70', 0, 70), (2, '70–74', 70, 75), (3, '75–79', 75, 80), (4, '80–84', 80, 85),
                     (5, '85–89', 85, 90), (6, '90–94', 90, 95), (7, '95+', 95, 200)) v(ordem, faixa, lo, hi)
      ) f),
      'rotas', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
        select data->>'role' as k, count(*) as n from ini group by 1) x where k is not null),
      'regioes', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
        select data->>'region' as k, count(*) as n from ini group by 1) x where k is not null),
      'velocidade', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
        select data->>'speed' as k, count(*) as n from ini group by 1) x where k is not null),
      'legados', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
        select data->>'legacy' as k, count(*) as n from fim group by 1) x where k is not null),
      'top', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select f.data->>'nick' as nick, pr.username as conta, (f.data->>'score')::int as pontos,
          (f.data->>'peakOvr')::int as ovr, f.data->>'legacy' as legado, f.data->>'role' as rota,
          (f.data->>'trophies')::int as trofeus, f.created_at as quando
        from fim f left join site_profiles pr on pr.id = f.user_id
        order by (f.data->>'score')::int desc nulls last limit 10) t)
    )
  ) into result;
  return result;
end;
$$;
revoke all on function public.site_admin_stats(int) from public, anon;
grant execute on function public.site_admin_stats(int) to authenticated;

-- ---------------------------------------------------------------
-- Quem pode ver o painel: troque o e-mail se precisar e rode de novo.
-- ---------------------------------------------------------------
insert into public.site_admins (user_id)
select id from auth.users where lower(email) = lower('riftarcadeoficial@gmail.com')
on conflict do nothing;
