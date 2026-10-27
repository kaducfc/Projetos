-- Painel do administrador: números por jogo mais completos e painel próprio do Rift Survivors. Rodar depois da 0194. Rodar de novo é seguro.
--   * site_admin_jogos(days): por jogo, o que o painel mostra na "Visão geral" (jogadores, iniciadas, terminadas, hoje, 7 dias, última partida, resultados
--     gravados por contas). Junta os eventos (site_events) com os resultados das contas (site_game_results), para os jogos que ainda não mandam eventos
--     de início/fim aparecerem do mesmo jeito.
--   * sv_admin_painel(dias): Rift Survivors (partidas por dia, vitórias por reino, campeões mais jogados, tempo de sobrevivência, ranqueada e o progresso
--     salvo nas contas: essência, campeões liberados, nível das melhorias, reinos vencidos).

create or replace function public.site_admin_jogos(days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  hoje date := (now() at time zone tz)::date;
  desde timestamptz;
  r jsonb;
begin
  if not site_is_admin() then raise exception 'not_admin'; end if;
  days := least(greatest(coalesce(days, 30), 1), 365);
  desde := ((hoje - (days - 1))::timestamp) at time zone tz;
  with ev as (
    select game_id,
           count(*) filter (where kind = 'game_start') as iniciadas,
           count(*) filter (where kind = 'game_end') as terminadas,
           count(distinct device) filter (where kind = 'game_start') as jogadores,
           count(*) filter (where kind = 'game_start' and (created_at at time zone tz)::date = hoje) as hoje_iniciadas,
           count(distinct device) filter (where kind = 'game_start' and (created_at at time zone tz)::date = hoje) as hoje_jogadores,
           count(*) filter (where kind = 'game_start' and created_at >= now() - interval '7 days') as d7_iniciadas,
           max(created_at) filter (where kind in ('game_start', 'game_end')) as ultima
      from site_events where created_at >= desde and game_id is not null group by game_id
  ), res as (
    select game_id,
           count(*) as resultados,
           count(distinct user_id) as contas,
           count(*) filter (where (played_at at time zone tz)::date = hoje) as hoje_resultados,
           max(played_at) as ultimo_resultado
      from site_game_results where played_at >= desde group by game_id
  )
  select coalesce(jsonb_object_agg(coalesce(ev.game_id, res.game_id), jsonb_build_object(
           'iniciadas', coalesce(ev.iniciadas, 0), 'terminadas', coalesce(ev.terminadas, 0), 'jogadores', coalesce(ev.jogadores, 0),
           'hoje_iniciadas', coalesce(ev.hoje_iniciadas, 0), 'hoje_jogadores', coalesce(ev.hoje_jogadores, 0), 'd7_iniciadas', coalesce(ev.d7_iniciadas, 0),
           'ultima', greatest(ev.ultima, res.ultimo_resultado),
           'resultados', coalesce(res.resultados, 0), 'contas', coalesce(res.contas, 0), 'hoje_resultados', coalesce(res.hoje_resultados, 0))), '{}'::jsonb)
    into r
    from ev full join res on res.game_id = ev.game_id;
  return jsonb_build_object('dias', days, 'jogos', r);
end;
$$;
revoke all on function public.site_admin_jogos(int) from public, anon;
grant execute on function public.site_admin_jogos(int) to authenticated;

create or replace function public.sv_admin_painel(dias int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  hoje date := (now() at time zone tz)::date;
  desde timestamptz;
  r jsonb;
begin
  if not site_is_admin() then raise exception 'not_admin'; end if;
  dias := least(greatest(coalesce(dias, 30), 1), 365);
  desde := ((hoje - (dias - 1))::timestamp) at time zone tz;
  with res as (
    select x.id, x.user_id, x.score, x.played_at, (x.played_at at time zone tz)::date as dia,
           x.summary->>'campeao' as campeao, x.summary->>'reino' as reino,
           case when (x.summary->>'tempo') ~ '^[0-9]{1,6}$' then (x.summary->>'tempo')::int end as tempo,
           case when (x.summary->>'abates') ~ '^[0-9]{1,9}$' then (x.summary->>'abates')::int end as abates,
           case when (x.summary->>'nivel') ~ '^[0-9]{1,4}$' then (x.summary->>'nivel')::int end as nivel,
           coalesce(x.summary->>'venceu', 'false') = 'true' as venceu,
           coalesce(x.summary->>'ranked', '') <> '' as ranqueada
      from site_game_results x where x.game_id = 'survivors' and x.played_at >= desde
  ), serie as (
    select d::date as dia from generate_series(hoje - (dias - 1), hoje, interval '1 day') d
  ), prog as (
    select p.user_id, p.dados from sv_progresso p
  ), rk as (
    select * from site_rk_dia where jogo = 'survivors' and dia >= (hoje - (dias - 1))
  )
  select jsonb_build_object(
    'dias', dias,
    'resumo', jsonb_build_object(
      'partidas', (select count(*) from res), 'jogadores', (select count(distinct user_id) from res),
      'vitorias', (select count(*) from res where venceu),
      'tempo_medio', (select round(avg(tempo)) from res), 'tempo_maximo', (select max(tempo) from res),
      'abates_medio', (select round(avg(abates)) from res), 'nivel_medio', (select round(avg(nivel), 1) from res),
      'hoje_partidas', (select count(*) from res where dia = hoje), 'hoje_jogadores', (select count(distinct user_id) from res where dia = hoje),
      'ranqueadas', (select count(*) from res where ranqueada)),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object('dia', s.dia,
                'partidas', (select count(*) from res where res.dia = s.dia),
                'jogadores', (select count(distinct user_id) from res where res.dia = s.dia),
                'vitorias', (select count(*) from res where res.dia = s.dia and venceu)) order by s.dia), '[]'::jsonb) from serie s),
    'reinos', (select coalesce(jsonb_agg(to_jsonb(g) order by g.partidas desc), '[]'::jsonb) from (
                select reino, count(*) as partidas, count(*) filter (where venceu) as vitorias, count(distinct user_id) as jogadores,
                       round(avg(tempo)) as tempo_medio, max(tempo) as tempo_max
                  from res where reino is not null group by reino) g),
    'campeoes', (select coalesce(jsonb_agg(to_jsonb(g) order by g.partidas desc), '[]'::jsonb) from (
                select campeao, count(*) as partidas, count(*) filter (where venceu) as vitorias, count(distinct user_id) as jogadores,
                       round(avg(tempo)) as tempo_medio, round(avg(abates)) as abates_medio
                  from res where campeao is not null group by campeao) g),
    'faixas_tempo', (select coalesce(jsonb_agg(jsonb_build_object('faixa', f.faixa, 'n', f.n) order by f.ordem), '[]'::jsonb) from (
                select v.ordem, v.faixa, (select count(*) from res where tempo >= v.lo and tempo < v.hi) as n
                  from (values (1, 'até 4 min', 0, 240), (2, '4 a 8 min', 240, 480), (3, '8 a 12 min', 480, 720), (4, '12 a 16 min', 720, 960), (5, '16 min ou mais', 960, 1000000)) v(ordem, faixa, lo, hi)) f),
    'top', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
                select pr.username as usuario, res.campeao, res.reino, res.tempo, res.abates, res.nivel, res.venceu, res.played_at as quando
                  from res left join site_profiles pr on pr.id = res.user_id
                 order by res.tempo desc nulls last, res.abates desc nulls last limit 10) t),
    'ranqueada', jsonb_build_object(
      'partidas', (select count(*) from rk), 'jogadores', (select count(distinct user_id) from rk),
      'pdr_medio', (select round(avg(pdr), 1) from rk), 'pdr_total', (select coalesce(sum(pdr), 0) from rk),
      'ganhos', (select count(*) from rk where pdr > 0), 'perdas', (select count(*) from rk where pdr < 0)),
    'progresso', jsonb_build_object(
      'contas', (select count(*) from prog),
      'essencia_total', (select coalesce(sum((dados->>'essencia')::numeric), 0) from prog),
      'essencia_media', (select round(avg((dados->>'essencia')::numeric)) from prog),
      'liberados', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
                select c as k, count(*) as n from prog, jsonb_array_elements_text(coalesce(prog.dados->'liberados', '[]'::jsonb)) c group by c) x),
      'melhorias_media', (select jsonb_build_object(
                'hp', round(avg(coalesce((dados#>>'{melhorias,hp}')::numeric, 0)), 1), 'dano', round(avg(coalesce((dados#>>'{melhorias,dano}')::numeric, 0)), 1),
                'vel', round(avg(coalesce((dados#>>'{melhorias,vel}')::numeric, 0)), 1), 'xp', round(avg(coalesce((dados#>>'{melhorias,xp}')::numeric, 0)), 1),
                'ima', round(avg(coalesce((dados#>>'{melhorias,ima}')::numeric, 0)), 1), 'revive', round(avg(coalesce((dados#>>'{melhorias,revive}')::numeric, 0)), 2)) from prog),
      'melhorias_max', (select jsonb_build_object(
                'hp', max(coalesce((dados#>>'{melhorias,hp}')::int, 0)), 'dano', max(coalesce((dados#>>'{melhorias,dano}')::int, 0)),
                'vel', max(coalesce((dados#>>'{melhorias,vel}')::int, 0)), 'xp', max(coalesce((dados#>>'{melhorias,xp}')::int, 0)),
                'ima', max(coalesce((dados#>>'{melhorias,ima}')::int, 0))) from prog),
      'reinos_vencidos', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
                select e.key as k, count(*) as n from prog, jsonb_each(coalesce(prog.dados->'reinos', '{}'::jsonb)) e
                 where coalesce((e.value->>'vitorias')::int, 0) > 0 group by e.key) x))
  ) into r;
  return r;
end;
$$;
revoke all on function public.sv_admin_painel(int) from public, anon;
grant execute on function public.sv_admin_painel(int) to authenticated;
