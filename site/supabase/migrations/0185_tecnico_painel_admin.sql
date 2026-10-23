-- Painel do administrador: aba do Rift Manager. Uma única consulta (só para administradores) devolve o resumo do jogo:
-- contas e atividade, baús (o que foi aberto e o que veio), RC (entradas e saídas), créditos, partidas, mercado,
-- elenco e a lista dos técnicos. Só lê; nada aqui altera o jogo.
create or replace function public.tc_admin_painel(dias int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  hoje date := site_hoje_br();
  d int := greatest(1, least(coalesce(dias, 30), 365));
  ini date := site_hoje_br() - (greatest(1, least(coalesce(dias, 30), 365)) - 1);
  t0 timestamptz;
  r jsonb;
begin
  if not site_is_admin() then
    raise exception 'not_admin';
  end if;
  t0 := (ini::timestamp) at time zone tz;

  drop table if exists _u;
  create temp table _u on commit drop as
    select o.id as org_id, o.user_id, o.nome, o.sigla, o.creditos, o.divisao, o.criado, p.username
      from tc_orgs o left join site_profiles p on p.id = o.user_id
     where o.user_id is not null;
  -- toda ação de técnico com a hora em que aconteceu (quem fez, quando)
  drop table if exists _ev;
  create temp table _ev on commit drop as
    select user_id, criado as ts from tc_amistosos where user_id is not null
    union all select registrado_por, criado from tc_gameplay_mapas where registrado_por is not null
    union all select user_id, criado from tc_gacha
    union all select user_id, inicio from tc_treinos where user_id is not null
    union all select user_id, criado from tc_transf where user_id is not null
    union all select user_id, criado from site_moedas_lanc where motivo like 'tecnico\_%';
  drop table if exists _rc;
  create temp table _rc on commit drop as
    select l.user_id, l.delta, l.motivo, l.criado
      from site_moedas_lanc l join _u u on u.user_id = l.user_id
     where (l.motivo like 'tecnico\_%' or l.motivo like 'rank\_%' or l.motivo = 'compra') and l.criado >= t0;

  r := jsonb_build_object(
    'dias', d, 'inicio', ini, 'hoje', hoje,
    'resumo', (select jsonb_build_object(
        'contas', (select count(*) from _u),
        'novas_hoje', (select count(*) from _u where (criado at time zone tz)::date = hoje),
        'novas_periodo', (select count(*) from _u where criado >= t0),
        'ativas_hoje', (select count(distinct user_id) from _ev where (ts at time zone tz)::date = hoje and user_id in (select user_id from _u)),
        'ativas_7d', (select count(distinct user_id) from _ev where ts >= now() - interval '7 days' and user_id in (select user_id from _u)),
        'ativas_periodo', (select count(distinct user_id) from _ev where ts >= t0 and user_id in (select user_id from _u)),
        'jogaram_partida', (select count(distinct u.user_id) from _u u where exists (select 1 from tc_amistosos a where a.user_id = u.user_id) or exists (select 1 from tc_gameplay_mapas m where m.registrado_por = u.user_id)),
        'abriram_bau', (select count(distinct user_id) from tc_gacha),
        'pagaram_bau', (select count(distinct user_id) from tc_gacha where custo_rc > 0),
        'rc_nas_carteiras', (select coalesce(sum(c.saldo), 0) from site_carteira c join _u u on u.user_id = c.user_id),
        'creditos_nas_equipes', (select coalesce(sum(creditos), 0) from _u))),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object(
        'dia', g.dia,
        'novas', (select count(*) from _u where (criado at time zone tz)::date = g.dia),
        'ativas', (select count(distinct user_id) from _ev where (ts at time zone tz)::date = g.dia and user_id in (select user_id from _u)),
        'baus', (select coalesce(sum(qtd), 0) from tc_gacha where (criado at time zone tz)::date = g.dia),
        'rc_gasto', (select coalesce(-sum(delta), 0) from _rc where delta < 0 and motivo like 'tecnico\_%' and (criado at time zone tz)::date = g.dia),
        'partidas', (select count(*) from tc_amistosos where (criado at time zone tz)::date = g.dia) + (select count(*) from tc_gameplay_mapas where (criado at time zone tz)::date = g.dia)
      ) order by g.dia), '[]'::jsonb) from (select generate_series(ini, hoje, interval '1 day')::date as dia) g),
    'baus', jsonb_build_object(
      'por_tipo', (select coalesce(jsonb_agg(x order by x.rc desc, x.bau), '[]'::jsonb) from (
          select bau, count(*) as aberturas, sum(qtd) as baus, coalesce(sum(custo_rc), 0) as rc,
                 coalesce(sum(qtd) filter (where gratis), 0) as gratis, count(distinct user_id) as compradores
            from tc_gacha where criado >= t0 group by bau) x),
      'totais', (select jsonb_build_object('aberturas', count(*), 'baus', coalesce(sum(qtd), 0), 'rc', coalesce(sum(custo_rc), 0), 'gratis', coalesce(sum(qtd) filter (where gratis), 0), 'compradores', count(distinct user_id))
                   from tc_gacha where criado >= t0),
      'raridades', (select coalesce(jsonb_agg(jsonb_build_object('raridade', x.rar, 'qtd', x.n, 'repetidas', x.rep) order by array_position(array['comum', 'raro', 'epico', 'lendario', 'mitico'], x.rar)), '[]'::jsonb) from (
          select i->>'raridade' as rar, count(*) as n, count(*) filter (where (i->>'repetida')::boolean) as rep
            from tc_gacha g, jsonb_array_elements(g.resultado) i where g.criado >= t0 group by 1) x),
      'ultimos', (select coalesce(jsonb_agg(jsonb_build_object('criado', x.criado, 'usuario', x.username, 'equipe', x.nome, 'bau', x.bau, 'qtd', x.qtd, 'rc', x.custo_rc, 'gratis', x.gratis,
          'itens', (select coalesce(jsonb_agg(jsonb_build_object('nome', i->'jogador'->>'nome', 'raridade', i->>'raridade', 'repetida', (i->>'repetida')::boolean)), '[]'::jsonb) from jsonb_array_elements(x.resultado) i)) order by x.id desc), '[]'::jsonb)
          from (select g.*, u.username, u.nome from tc_gacha g left join _u u on u.user_id = g.user_id order by g.id desc limit 25) x),
      'mais_raros', (select coalesce(jsonb_agg(jsonb_build_object('criado', x.criado, 'usuario', x.username, 'bau', x.bau, 'nome', x.nome_j, 'raridade', x.rar) order by x.id desc), '[]'::jsonb)
          from (select g.id, g.criado, g.bau, u.username, i->'jogador'->>'nome' as nome_j, i->>'raridade' as rar
                  from tc_gacha g left join _u u on u.user_id = g.user_id, jsonb_array_elements(g.resultado) i
                 where i->>'raridade' in ('lendario', 'mitico') order by g.id desc limit 15) x)),
    'rc', jsonb_build_object(
      'gasto', (select coalesce(jsonb_agg(jsonb_build_object('motivo', motivo, 'rc', rc, 'vezes', vezes) order by rc desc), '[]'::jsonb) from (
          select motivo, -sum(delta) as rc, count(*) as vezes from _rc where delta < 0 and motivo like 'tecnico\_%' group by motivo) x),
      'ganho', (select coalesce(jsonb_agg(jsonb_build_object('motivo', motivo, 'rc', rc, 'vezes', vezes) order by rc desc), '[]'::jsonb) from (
          select motivo, sum(delta) as rc, count(*) as vezes from _rc where delta > 0 and motivo <> 'compra' group by motivo) x),
      'comprado', (select jsonb_build_object('rc', coalesce(sum(delta), 0), 'compras', count(*), 'compradores', count(distinct user_id)) from _rc where motivo = 'compra' and delta > 0),
      'top_gastadores', (select coalesce(jsonb_agg(jsonb_build_object('usuario', x.username, 'equipe', x.nome, 'rc', x.rc) order by x.rc desc), '[]'::jsonb) from (
          select u.username, u.nome, -sum(r2.delta) as rc from _rc r2 join _u u on u.user_id = r2.user_id
           where r2.delta < 0 and r2.motivo like 'tecnico\_%' group by u.username, u.nome order by 3 desc limit 10) x)),
    'creditos', jsonb_build_object(
      'gasto', (select coalesce(jsonb_agg(jsonb_build_object('motivo', motivo, 'creditos', c, 'vezes', n) order by c desc), '[]'::jsonb) from (
          select f.motivo, -sum(f.delta) as c, count(*) as n from tc_fin f join _u u on u.org_id = f.org_id where f.delta < 0 and f.criado >= t0 group by f.motivo) x),
      'ganho', (select coalesce(jsonb_agg(jsonb_build_object('motivo', motivo, 'creditos', c, 'vezes', n) order by c desc), '[]'::jsonb) from (
          select f.motivo, sum(f.delta) as c, count(*) as n from tc_fin f join _u u on u.org_id = f.org_id where f.delta > 0 and f.criado >= t0 group by f.motivo) x)),
    'partidas', jsonb_build_object(
      'amistosos', (select jsonb_build_object('total', count(*), 'hoje', count(*) filter (where (criado at time zone tz)::date = hoje),
                      'vitorias', count(*) filter (where (resultado->>'a')::int > (resultado->>'b')::int), 'jogadores', count(distinct user_id))
                      from tc_amistosos where criado >= t0),
      'mapas', (select jsonb_build_object('total', count(*), 'hoje', count(*) filter (where (m.criado at time zone tz)::date = hoje),
                      'duracao_media', round(coalesce(avg(m.duracao), 0)), 'azul_venceu', count(*) filter (where m.vencedor_org = m.org_azul))
                      from tc_gameplay_mapas m where m.criado >= t0),
      'oficiais_agendadas', (select count(*) from tc_partidas p where p.status = 'agendada' and (p.org_a in (select org_id from _u) or p.org_b in (select org_id from _u))),
      'oficiais_concluidas', (select count(*) from tc_partidas p where p.status = 'concluida' and p.processada >= t0 and (p.org_a in (select org_id from _u) or p.org_b in (select org_id from _u))),
      'ligas_abertas', (select count(*) from tc_ligas where status = 'aberta'),
      'treinos', (select jsonb_build_object('iniciados', count(*), 'creditos', coalesce(sum(custo), 0)) from tc_treinos where inicio >= t0)),
    'mercado', jsonb_build_object(
      'por_tipo', (select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'vezes', n, 'valor', v, 'moeda', moeda) order by n desc), '[]'::jsonb) from (
          select tipo, moeda, count(*) as n, coalesce(sum(valor), 0) as v from tc_transf where criado >= t0 and user_id is not null group by tipo, moeda) x)),
    'elenco', jsonb_build_object(
      'raridades', (select coalesce(jsonb_agg(jsonb_build_object('raridade', rar, 'qtd', n) order by array_position(array['comum', 'raro', 'epico', 'lendario', 'mitico'], rar)), '[]'::jsonb) from (
          select j.raridade as rar, count(*) as n from tc_jogadores j join _u u on u.org_id = j.org_id where not j.ficticio and j.raridade is not null group by 1) x),
      'estrelas', (select coalesce(jsonb_agg(jsonb_build_object('estrelas', e, 'qtd', n) order by e), '[]'::jsonb) from (
          select j.estrelas as e, count(*) as n from tc_jogadores j join _u u on u.org_id = j.org_id where not j.ficticio and j.estrelas > 0 group by 1) x),
      'jogadores', (select count(*) from tc_jogadores j join _u u on u.org_id = j.org_id)),
    'tecnicos', (select coalesce(jsonb_agg(to_jsonb(x) order by x.ultima desc nulls last), '[]'::jsonb) from (
        select u.username, u.nome as equipe, u.sigla, u.divisao, u.criado, u.creditos,
               (select coalesce(c.saldo, 0) from site_carteira c where c.user_id = u.user_id) as rc_saldo,
               (select count(*) from tc_jogadores j where j.org_id = u.org_id) as jogadores,
               (select coalesce(sum(g.qtd), 0) from tc_gacha g where g.user_id = u.user_id) as baus,
               (select coalesce(-sum(l.delta), 0) from site_moedas_lanc l where l.user_id = u.user_id and l.delta < 0 and l.motivo like 'tecnico\_%') as rc_gasto,
               (select count(*) from tc_amistosos a where a.user_id = u.user_id) as amistosos,
               (select count(*) from tc_gameplay_mapas m where m.registrado_por = u.user_id) as mapas,
               (select count(*) from tc_gameplay_mapas m where m.registrado_por = u.user_id and m.vencedor_org = u.org_id) as mapas_vencidos,
               (select max(ts) from _ev e where e.user_id = u.user_id) as ultima
          from _u u order by (select max(ts) from _ev e where e.user_id = u.user_id) desc nulls last limit 100) x));
  return r;
end;
$$;
revoke all on function public.tc_admin_painel(int) from public, anon;
grant execute on function public.tc_admin_painel(int) to authenticated;
