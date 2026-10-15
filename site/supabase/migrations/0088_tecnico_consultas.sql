-- =====================================================================
-- Simulador de Técnico, parte 4: consultas para as telas (só leitura).
-- Rodar depois do 0087. Rodar de novo é seguro.
-- =====================================================================

create or replace function public.tc_org_json(oid bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', o.id, 'nome', o.nome, 'sigla', o.sigla, 'escudo', o.escudo, 'cor1', o.cor1, 'cor2', o.cor2,
                            'divisao', o.divisao, 'usuario', o.user_id is not null)
    from tc_orgs o where o.id = oid;
$$;
revoke all on function public.tc_org_json(bigint) from public, anon, authenticated;

create or replace function public.tc_partida_json(p tc_partidas)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'liga_id', p.liga_id, 'fase', p.fase, 'rodada', p.rodada, 'dia', p.dia, 'formato', p.formato,
                            'status', p.status, 'a', tc_org_json(p.org_a), 'b', tc_org_json(p.org_b),
                            'placar_a', p.placar_a, 'placar_b', p.placar_b, 'vencedor', p.vencedor,
                            'poder_a', p.poder_a, 'poder_b', p.poder_b);
$$;
revoke all on function public.tc_partida_json(tc_partidas) from public, anon, authenticated;

-- Uma liga: classificação e partidas.
create or replace function public.tc_liga_json(lid bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l tc_ligas;
  tab jsonb;
  n int;
begin
  select * into l from tc_ligas where id = lid;
  if l.id is null then return null; end if;
  n := (select count(*) from tc_liga_times where liga_id = lid);
  select coalesce(jsonb_agg(jsonb_build_object(
           'pos', t.pos, 'org', tc_org_json(t.org_id), 'partidas', t.partidas, 'vitorias', t.vitorias, 'derrotas', t.derrotas,
           'mapas_pro', t.mapas_pro, 'mapas_contra', t.mapas_contra, 'saldo', t.mapas_pro - t.mapas_contra, 'pontos', t.pontos,
           'poder', round(tc_poder_org(t.org_id)::numeric, 1),
           'situacao', case when l.tipo <> 'divisao' then null
                            when l.divisao = 'acesso' and t.pos <= 2 then 'promocao'
                            when l.divisao = 'principal' and t.pos > n - 2 then 'rebaixamento'
                            else 'permanece' end) order by t.pos), '[]'::jsonb) into tab
    from tc_tabela(lid) t;
  return jsonb_build_object('id', l.id, 'nome', l.nome, 'divisao', l.divisao, 'tipo', l.tipo, 'status', l.status,
                            'temporada', l.temporada, 'semana', l.semana, 'tabela', tab,
                            'partidas', coalesce((select jsonb_agg(tc_partida_json(p) order by p.dia, p.id) from tc_partidas p where p.liga_id = l.id), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_liga_json(bigint) from public, anon, authenticated;

-- Painel principal do técnico: liga da divisão, próxima partida, últimos resultados e finanças.
create or replace function public.tc_painel()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  cal jsonb := tc_calendario();
  lid bigint;
  prox tc_partidas;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then return jsonb_build_object('org', null); end if;
  if (cal->>'antes')::boolean then
    return jsonb_build_object('antes', true, 'inicio', cal->'inicio');
  end if;
  select l.id into lid from tc_ligas l join tc_liga_times t on t.liga_id = l.id
   where t.org_id = o.id and l.tipo = 'divisao' order by l.temporada desc, l.semana desc limit 1;
  select p.* into prox from tc_partidas p join tc_ligas l on l.id = p.liga_id
   where p.status = 'agendada' and (p.org_a = o.id or p.org_b = o.id) order by p.dia, p.id limit 1;
  return jsonb_build_object(
    'calendario', cal,
    'liga', case when lid is null then null else tc_liga_json(lid) end,
    'proxima', case when prox.id is null then null else tc_partida_json(prox) end,
    'ultimos', coalesce((select jsonb_agg(tc_partida_json(p) order by p.dia desc, p.id desc)
                           from (select * from tc_partidas where status = 'concluida' and (org_a = o.id or org_b = o.id) order by dia desc, id desc limit 6) p), '[]'::jsonb),
    'trofeus', coalesce((select jsonb_agg(jsonb_build_object('titulo', t.titulo, 'temporada', t.temporada) order by t.id desc) from tc_trofeus t where t.org_id = o.id), '[]'::jsonb),
    'financas', coalesce((select jsonb_agg(jsonb_build_object('delta', f.delta, 'saldo', f.saldo, 'motivo', f.motivo, 'criado', f.criado) order by f.id desc)
                            from (select * from tc_fin where org_id = o.id order by id desc limit 8) f), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_painel() from public, anon;
grant execute on function public.tc_painel() to authenticated;

-- Todas as ligas abertas ou recentes (divisões, Copa, Mundial) para a aba Campeonatos.
create or replace function public.tc_campeonatos()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cal jsonb := tc_calendario();
begin
  perform tc_exigir(uid);
  if (cal->>'antes')::boolean then
    return jsonb_build_object('antes', true, 'inicio', cal->'inicio', 'ligas', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'calendario', cal, 'nomes', tc_cfg('nomes'),
    'ligas', coalesce((select jsonb_agg(tc_liga_json(l.id) order by l.temporada desc, l.semana desc, l.tipo, l.divisao)
                         from (select * from tc_ligas order by temporada desc, semana desc, id desc limit 8) l), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_campeonatos() from public, anon;
grant execute on function public.tc_campeonatos() to authenticated;

-- Detalhe de uma partida concluída (placar, mapas e destaques).
create or replace function public.tc_partida(pid bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
begin
  perform tc_exigir(auth.uid());
  select * into p from tc_partidas where id = pid;
  if p.id is null then raise exception 'partida_inexistente'; end if;
  return tc_partida_json(p) || jsonb_build_object('resumo', p.resumo);
end;
$$;
revoke all on function public.tc_partida(bigint) from public, anon;
grant execute on function public.tc_partida(bigint) to authenticated;

-- Histórico da organização: transferências, partidas, premiações e troféus.
create or replace function public.tc_historico()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then return jsonb_build_object('org', null); end if;
  return jsonb_build_object(
    'transferencias', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'jogador', jg.nome, 'tipo', t.tipo, 'valor', t.valor, 'moeda', t.moeda,
                                  'de', (select nome from tc_orgs where id = t.de_org), 'para', (select nome from tc_orgs where id = t.para_org), 'criado', t.criado) order by t.id desc)
                                  from (select * from tc_transf where de_org = o.id or para_org = o.id order by id desc limit 40) t join tc_jogadores jg on jg.id = t.jogador_id), '[]'::jsonb),
    'partidas', coalesce((select jsonb_agg(tc_partida_json(p) order by p.dia desc, p.id desc)
                            from (select * from tc_partidas where status = 'concluida' and (org_a = o.id or org_b = o.id) order by dia desc, id desc limit 30) p), '[]'::jsonb),
    'premios', coalesce((select jsonb_agg(jsonb_build_object('liga', l.nome, 'posicao', pr.posicao, 'creditos', pr.creditos, 'pdr', pr.rank_pdr, 'criado', pr.criado) order by pr.criado desc)
                           from tc_premios pr join tc_ligas l on l.id = pr.liga_id where pr.org_id = o.id), '[]'::jsonb),
    'trofeus', coalesce((select jsonb_agg(jsonb_build_object('titulo', t.titulo, 'temporada', t.temporada) order by t.id desc) from tc_trofeus t where t.org_id = o.id), '[]'::jsonb),
    'financas', coalesce((select jsonb_agg(jsonb_build_object('delta', f.delta, 'saldo', f.saldo, 'motivo', f.motivo, 'criado', f.criado) order by f.id desc)
                            from (select * from tc_fin where org_id = o.id order by id desc limit 40) f), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_historico() from public, anon;
grant execute on function public.tc_historico() to authenticated;

-- Ficha de um atleta (do mercado oficial, de um anúncio ou do próprio elenco) com o histórico de transferências.
create or replace function public.tc_ficha_jogador(jid bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  j tc_jogadores;
  meu bigint;
begin
  perform tc_exigir(uid);
  select id into meu from tc_orgs where user_id = uid;
  select * into j from tc_jogadores where id = jid;
  if j.id is null then raise exception 'jogador_inexistente'; end if;
  -- Potencial só aparece para o dono e no mercado oficial (jogador sem dono).
  return tc_jogador_json(j, j.org_id is null or j.org_id = meu)
    || jsonb_build_object('org', case when j.org_id is null then null else tc_org_json(j.org_id) end,
                          'historico', coalesce((select jsonb_agg(jsonb_build_object('tipo', t.tipo, 'valor', t.valor, 'moeda', t.moeda, 'criado', t.criado,
                                                   'de', (select nome from tc_orgs where id = t.de_org), 'para', (select nome from tc_orgs where id = t.para_org)) order by t.id desc)
                                                  from (select * from tc_transf where jogador_id = j.id order by id desc limit 15) t), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_ficha_jogador(bigint) from public, anon;
grant execute on function public.tc_ficha_jogador(bigint) to authenticated;
