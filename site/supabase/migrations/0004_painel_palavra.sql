-- Painel: estatísticas separadas por jogo e seção da Palavra do Rift.
--
-- Como aplicar: cole este arquivo no SQL Editor do Supabase e clique em Run
-- (depois do 0003). Só troca a função do painel; rodar de novo é seguro.

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
  ),
  pfim as (
    select * from ev where kind = 'game_end' and game_id = 'palavra'
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
    'jogos', (select coalesce(jsonb_object_agg(game_id, jsonb_build_object(
        'iniciadas', iniciadas, 'terminadas', terminadas, 'jogadores', jogadores)), '{}'::jsonb) from (
      select game_id,
        count(*) filter (where kind = 'game_start') as iniciadas,
        count(*) filter (where kind = 'game_end') as terminadas,
        count(distinct device) filter (where kind = 'game_start') as jogadores
      from ev where game_id is not null group by game_id) g),
    'palavra', jsonb_build_object(
      'jogadas', (select count(*) from pfim),
      'jogadores', (select count(distinct device) from pfim),
      'vitorias_pct', (select round(100.0 * count(*) filter (where (data->>'won')::boolean) / nullif(count(*), 0), 1) from pfim),
      'tentativas_media', (select round(avg((data->>'tries')::numeric), 2) from pfim where (data->>'won')::boolean),
      'hoje_jogadas', (select count(*) from pfim where dia = today),
      'hoje_vitorias_pct', (select round(100.0 * count(*) filter (where (data->>'won')::boolean) / nullif(count(*), 0), 1) from pfim where dia = today),
      'dist', (select jsonb_build_array(
          count(*) filter (where (data->>'won')::boolean and (data->>'tries')::int = 1),
          count(*) filter (where (data->>'won')::boolean and (data->>'tries')::int = 2),
          count(*) filter (where (data->>'won')::boolean and (data->>'tries')::int = 3),
          count(*) filter (where (data->>'won')::boolean and (data->>'tries')::int = 4),
          count(*) filter (where (data->>'won')::boolean and (data->>'tries')::int = 5),
          count(*) filter (where (data->>'won')::boolean and (data->>'tries')::int = 6),
          count(*) filter (where not (data->>'won')::boolean)) from pfim),
      'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', s.dia,
          'jogadas', (select count(*) from pfim where pfim.dia = s.dia),
          'vitorias', (select count(*) from pfim where pfim.dia = s.dia and (data->>'won')::boolean)) order by s.dia), '[]'::jsonb) from serie s)
    ),
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
