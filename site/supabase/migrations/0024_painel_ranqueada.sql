-- Painel do administrador: resumo da ranqueada (elos, PDR por jogo, jogos
-- diários) e ajuste manual de PDR. Rodar depois da 0023. Só administradores.

create or replace function public.site_admin_ranqueada(days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := site_hoje_br();
  ini date;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  days := least(greatest(coalesce(days, 30), 1), 365);
  ini := hoje - (days - 1);
  return jsonb_build_object(
    'dias', days,
    'temporada', (select temporada from site_rk_config where id = 1),
    'jogadores', (select count(*) from site_rk),
    'ativos_hoje', (select count(distinct user_id) from site_rk_lanc where dia = hoje and motivo <> 'admin'),
    'ativos_periodo', (select count(distinct user_id) from site_rk_lanc where dia >= ini and motivo <> 'admin'),
    -- Quantos jogadores em cada elo agora.
    'elos', coalesce((select jsonb_object_agg(elo, n) from (
        select site_rk_elo(pts, topo) as elo, count(*) as n from site_rk group by 1) x), '{}'::jsonb),
    -- PDR por jogo no período (partidas que contaram).
    'por_jogo', coalesce((select jsonb_object_agg(jogo, jsonb_build_object(
        'partidas', n, 'jogadores', j, 'pdr_medio', round(m, 1), 'positivas_pct', round(p, 1)))
      from (select jogo, count(*) as n, count(distinct user_id) as j, avg(pdr) as m,
                   100.0 * count(*) filter (where pdr > 0) / greatest(count(*), 1) as p
              from site_rk_dia where dia >= ini group by jogo) x), '{}'::jsonb),
    -- Perdas automáticas no período.
    'nao_terminou', (select count(*) from site_rk_lanc where dia >= ini and motivo = 'nao_terminou'),
    'inatividade', (select count(*) from site_rk_lanc where dia >= ini and motivo = 'inatividade'),
    -- Jogos diários no período.
    'diarios', jsonb_build_object(
      'runetermo', (select jsonb_build_object('jogadas', count(*), 'acertos_pct', round(100.0 * count(*) filter (where status = 'ganhou') / greatest(count(*) filter (where status in ('ganhou', 'perdeu')), 1), 1),
                      'chutes_medio', round(avg(jsonb_array_length(chutes)) filter (where status = 'ganhou'), 2), 'abandonos', count(*) filter (where status = 'jogando'))
                    from site_diario where jogo = 'runetermo' and dia >= ini),
      'campeao', (select jsonb_build_object('jogadas', count(*), 'acertos_pct', round(100.0 * count(*) filter (where status = 'ganhou') / greatest(count(*) filter (where status in ('ganhou', 'perdeu')), 1), 1),
                      'chutes_medio', round(avg(jsonb_array_length(chutes)) filter (where status = 'ganhou'), 2), 'abandonos', count(*) filter (where status = 'jogando'))
                    from site_diario where jogo = 'campeao' and dia >= ini),
      'escala', case when to_regclass('public.site_escala') is null then null else (
                  select jsonb_build_object('jogadas', count(*), 'media', round(avg(media), 1),
                    'reinicios', coalesce(sum(reinicios), 0), 'abandonos', count(*) filter (where status = 'jogando'))
                    from site_escala where dia >= ini) end),
    -- Os 10 primeiros da ranqueada agora.
    'top', coalesce((select jsonb_agg(x) from (
        select p.username, r.pts, site_rk_elo(r.pts, r.topo) as elo, r.ultima_atividade
          from site_rk r join site_profiles p on p.id = r.user_id
         order by r.pts desc limit 10) x), '[]'::jsonb),
    -- Ajustes manuais recentes.
    'ajustes', coalesce((select jsonb_agg(x) from (
        select l.criado, p.username, l.delta, l.antes, l.depois
          from site_rk_lanc l join site_profiles p on p.id = l.user_id
         where l.motivo = 'admin' order by l.id desc limit 20) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.site_admin_ranqueada(int) from public, anon;
grant execute on function public.site_admin_ranqueada(int) to authenticated;

-- Dar ou tirar PDR de alguém na mão (ex.: compensar um erro do site).
-- Mexe direto nos pontos (sem as regras de queda de divisão) e fica no
-- histórico como "ajuste"; não conta nos rankings do dia/semana/mês.
create or replace function public.site_admin_ajustar_pdr(nome text, delta int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
  antes int;
  depois int;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  if delta is null or delta = 0 or abs(delta) > 2000 then
    raise exception 'valor_invalido';
  end if;
  select id into alvo from site_profiles where lower(username) = lower(trim(nome));
  if alvo is null then
    raise exception 'user_not_found';
  end if;
  insert into site_rk (user_id) values (alvo) on conflict (user_id) do nothing;
  select pts into antes from site_rk where user_id = alvo for update;
  depois := greatest(0, antes + delta);
  update site_rk set pts = depois, atualizado = now() where user_id = alvo;
  insert into site_rk_lanc (user_id, dia, jogo, motivo, delta, antes, depois)
  values (alvo, site_hoje_br(), null, 'admin', depois - antes, antes, depois);
  return jsonb_build_object('username', (select username from site_profiles where id = alvo), 'antes', antes, 'depois', depois,
                            'elo', site_rk_elo(depois, (select topo from site_rk where user_id = alvo)));
end;
$$;
revoke all on function public.site_admin_ajustar_pdr(text, int) from public, anon;
grant execute on function public.site_admin_ajustar_pdr(text, int) to authenticated;
