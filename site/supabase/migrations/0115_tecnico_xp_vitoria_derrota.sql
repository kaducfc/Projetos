-- Simulador de Técnico: XP por resultado. Vitória dá 10 de XP e derrota dá 5, nas partidas de campeonato e nos amistosos
-- (amistoso: só os 5 primeiros do dia dão XP). Rode depois do 0114. Idempotente. Valores em tc_config.treino e tc_config.amistoso.

update public.tc_config set valor = valor || '{"exp_partida": 10, "exp_derrota": 5}'::jsonb where chave = 'treino';
update public.tc_config set valor = valor || '{"exp_ganho": 10, "exp_derrota": 5}'::jsonb where chave = 'amistoso';

create or replace function public.tc_gameplay_registrar(pid bigint, mapa_ int, resultado jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p tc_partidas;
  cfg jsonb := tc_cfg('gameplay');
  prox jsonb;
  azul bigint; verm bigint; venc bigint; perd bigint;
  v_a int; v_b int; nec int;
  dur int;
  res jsonb;
  pa double precision; pb double precision;
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  select * into p from tc_partidas where id = pid for update;
  if p.id is null then raise exception 'partida_inexistente'; end if;
  if not tc_gameplay_pode(p, uid) then raise exception 'partida_nao_e_sua'; end if;
  if p.status <> 'agendada' then raise exception 'partida_ja_concluida'; end if;
  prox := tc_gameplay_proximo(pid);
  if mapa_ <> (prox->>'mapa')::int then raise exception 'mapa_fora_de_ordem'; end if;
  if (resultado->>'semente')::bigint is distinct from tc_gameplay_semente(pid, mapa_) then raise exception 'semente_invalida'; end if;
  if (resultado->>'versaoRegras')::int is distinct from (cfg->>'versao')::int then raise exception 'versao_invalida'; end if;
  if coalesce(resultado->>'vencedor', '') not in ('azul', 'vermelho') or coalesce((resultado->>'interrompida')::boolean, false) then raise exception 'resultado_invalido'; end if;
  dur := (resultado->>'duracao')::int;
  if dur is null or dur < 300 or dur > 7200 then raise exception 'duracao_invalida'; end if;
  azul := (prox->>'azul')::bigint;
  verm := case when azul = p.org_a then p.org_b else p.org_a end;
  venc := case when resultado->>'vencedor' = 'azul' then azul else verm end;
  insert into tc_gameplay_mapas (partida_id, mapa, org_azul, vencedor_org, semente, duracao, resumo, registrado_por)
  values (pid, mapa_, azul, venc, (resultado->>'semente')::bigint, dur, jsonb_build_object(
            'vencedor', resultado->>'vencedor', 'equipes', resultado->'equipes', 'mvp', resultado->'mvp', 'jogadores', resultado->'jogadores', 'motivo', resultado->>'motivo'), uid);
  select count(*) filter (where vencedor_org = p.org_a), count(*) filter (where vencedor_org = p.org_b) into v_a, v_b from tc_gameplay_mapas where partida_id = pid;
  nec := (p.formato + 1) / 2;
  if v_a < nec and v_b < nec then
    return jsonb_build_object('concluida', false, 'placar_a', v_a, 'placar_b', v_b, 'proximo', tc_gameplay_proximo(pid));
  end if;
  -- fechou a série: mesmo fechamento da simulação do sistema
  perd := case when v_a >= nec then p.org_b else p.org_a end;
  venc := case when v_a >= nec then p.org_a else p.org_b end;
  pa := tc_poder_org(p.org_a); pb := tc_poder_org(p.org_b);
  res := jsonb_build_object('a', v_a, 'b', v_b, 'origem', 'gameplay', 'mapas', (
    select jsonb_agg(jsonb_build_object('mapa', g.mapa, 'duracao', round(g.duracao / 60.0)::int, 'gameplay', true,
             'vencedor', case when g.vencedor_org = p.org_a then 'a' else 'b' end,
             'abates', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'azul'->'abates', g.resumo->'equipes'->'vermelho'->'abates')
                            else jsonb_build_array(g.resumo->'equipes'->'vermelho'->'abates', g.resumo->'equipes'->'azul'->'abates') end,
             'torres', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'vermelho'->'torresPerdidas', g.resumo->'equipes'->'azul'->'torresPerdidas')
                            else jsonb_build_array(g.resumo->'equipes'->'azul'->'torresPerdidas', g.resumo->'equipes'->'vermelho'->'torresPerdidas') end,
             'dragoes', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'azul'->'dragoes', g.resumo->'equipes'->'vermelho'->'dragoes')
                             else jsonb_build_array(g.resumo->'equipes'->'vermelho'->'dragoes', g.resumo->'equipes'->'azul'->'dragoes') end,
             'mvp', coalesce(g.resumo->'mvp'->>'nome', '')) order by g.mapa) from tc_gameplay_mapas g where g.partida_id = pid));
  update tc_partidas set status = 'concluida', placar_a = v_a, placar_b = v_b, vencedor = venc,
         poder_a = round(pa::numeric, 1), poder_b = round(pb::numeric, 1), resumo = res, processada = now()
   where id = pid;
  update tc_jogadores set forma = least(75, forma + 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_partida')::int, 10)) where org_id = venc and slot is not null;
  update tc_jogadores set forma = greatest(25, forma - 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_derrota')::int, 5)) where org_id = perd and slot is not null;
  return jsonb_build_object('concluida', true, 'placar_a', v_a, 'placar_b', v_b, 'vencedor', venc);
end;
$$;
revoke all on function public.tc_gameplay_registrar(bigint, int, jsonb) from public, anon;
grant execute on function public.tc_gameplay_registrar(bigint, int, jsonb) to authenticated;

create or replace function public.tc_processar_partida(pid bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  r jsonb;
  pa double precision;
  pb double precision;
  venc bigint;
  perd bigint;
begin
  select * into p from tc_partidas where id = pid for update;
  if p.id is null or p.status <> 'agendada' then
    return false;
  end if;
  -- gameplay ligado: o técnico joga a partida no navegador; o sistema só simula depois do prazo
  if coalesce((tc_cfg('gameplay')->>'ativo')::boolean, false)
     and exists (select 1 from tc_orgs where id in (p.org_a, p.org_b) and user_id is not null)
     and site_hoje_br() < p.dia + coalesce((tc_cfg('gameplay')->>'prazo_dias')::int, 1) then
    return false;
  end if;
  perform tc_completar_elenco(p.org_a);
  perform tc_completar_elenco(p.org_b);
  pa := tc_poder_org(p.org_a);
  pb := tc_poder_org(p.org_b);
  r := tc_simular(p.org_a, p.org_b, p.formato, 'p' || p.id::text || ':' || p.liga_id::text);
  venc := case when (r->>'a')::int > (r->>'b')::int then p.org_a else p.org_b end;
  perd := case when venc = p.org_a then p.org_b else p.org_a end;
  update tc_partidas set status = 'concluida', placar_a = (r->>'a')::int, placar_b = (r->>'b')::int, vencedor = venc,
         poder_a = round(pa::numeric, 1), poder_b = round(pb::numeric, 1), resumo = r, processada = now()
   where id = p.id;
  update tc_jogadores set forma = least(75, forma + 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_partida')::int, 10)) where org_id = venc and slot is not null;
  update tc_jogadores set forma = greatest(25, forma - 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_derrota')::int, 5)) where org_id = perd and slot is not null;
  return true;
end;
$$;
revoke all on function public.tc_processar_partida(bigint) from public, anon, authenticated;

create or replace function public.tc_amistoso_registrar(aid bigint, res_ jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a tc_amistosos;
  cfg jsonb := tc_cfg('gameplay');
  ac jsonb := tc_cfg('amistoso');
  feitos int;
  dur int;
  exp_ok boolean;
  ganhou boolean;
  g tc_orgs;
  bans_ jsonb;
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  select * into a from tc_amistosos where id = aid for update;
  if a.id is null or a.user_id is distinct from uid then raise exception 'amistoso_inexistente'; end if;
  if a.estado <> 'aberto' then raise exception 'amistoso_ja_jogado'; end if;
  if now() - a.criado < interval '20 seconds' then raise exception 'amistoso_cedo'; end if;
  if (res_->>'semente')::bigint is distinct from tc_gameplay_semente(a.id, -1) then raise exception 'semente_invalida'; end if;
  if (res_->>'versaoRegras')::int is distinct from (cfg->>'versao')::int then raise exception 'versao_invalida'; end if;
  if coalesce(res_->>'vencedor', '') not in ('azul', 'vermelho') or coalesce((res_->>'interrompida')::boolean, false) then raise exception 'resultado_invalido'; end if;
  dur := (res_->>'duracao')::int;
  if dur is null or dur < 300 or dur > 7200 then raise exception 'duracao_invalida'; end if;
  select count(*) into feitos from tc_amistosos where org_a = a.org_a and dia = site_hoje_br() and estado = 'finalizado';
  if feitos >= (ac->>'max_dia')::int then raise exception 'amistoso_limite_dia'; end if;
  exp_ok := feitos < (ac->>'exp_por_dia')::int;
  ganhou := res_->>'vencedor' = 'azul';
  bans_ := case when jsonb_typeof(res_->'bans'->'azul') = 'array' and jsonb_typeof(res_->'bans'->'vermelho') = 'array'
                 and jsonb_array_length(res_->'bans'->'azul') <= 5 and jsonb_array_length(res_->'bans'->'vermelho') <= 5
                then res_->'bans' else null end;
  update tc_amistosos set estado = 'finalizado', deu_exp = exp_ok, bans = bans_, dia = site_hoje_br(), criado = now(),
         resultado = jsonb_build_object('a', case when ganhou then 1 else 0 end, 'b', case when ganhou then 0 else 1 end, 'origem', 'gameplay', 'duracao', dur,
                                        'equipes', res_->'equipes', 'mvp', res_->'mvp', 'jogadores', res_->'jogadores', 'motivo', res_->>'motivo')
   where id = a.id;
  if exp_ok then
    update tc_jogadores set exp = least(100, exp + case when ganhou then (ac->>'exp_ganho')::int else coalesce((ac->>'exp_derrota')::int, 5) end) where org_id = a.org_a and slot is not null;
  end if;
  select * into g from tc_orgs where id = a.org_b;
  return jsonb_build_object('ok', true, 'id', a.id, 'vencedor', res_->>'vencedor', 'exp', exp_ok, 'exp_ganho', case when not exp_ok then 0 when ganhou then (ac->>'exp_ganho')::int else coalesce((ac->>'exp_derrota')::int, 5) end,
                            'feitos_hoje', feitos + 1, 'com_exp_restantes', greatest(0, (ac->>'exp_por_dia')::int - feitos - 1),
                            'oponente', jsonb_build_object('id', g.id, 'nome', g.nome, 'sigla', g.sigla));
end;
$$;
revoke all on function public.tc_amistoso_registrar(bigint, jsonb) from public, anon;
grant execute on function public.tc_amistoso_registrar(bigint, jsonb) to authenticated;

create or replace function public.tc_amistosos_historico()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  cfg jsonb := tc_cfg('amistoso');
  hoje date := site_hoje_br();
  feitos int;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  select count(*) into feitos from tc_amistosos where org_a = o.id and dia = hoje and estado = 'finalizado';
  return jsonb_build_object(
    'feitos_hoje', feitos, 'exp_por_dia', (cfg->>'exp_por_dia')::int, 'exp_ganho', (cfg->>'exp_ganho')::int, 'exp_derrota', coalesce((cfg->>'exp_derrota')::int, 5),
    'com_exp_restantes', greatest(0, (cfg->>'exp_por_dia')::int - feitos),
    'lista', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'dia', h.dia, 'exp', h.deu_exp, 'a', (h.resultado->>'a')::int, 'b', (h.resultado->>'b')::int,
                         'oponente', jsonb_build_object('id', g.id, 'nome', g.nome, 'sigla', g.sigla)) order by h.id desc)
                         from (select * from tc_amistosos where org_a = o.id and estado = 'finalizado' order by id desc limit 30) h join tc_orgs g on g.id = h.org_b), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_amistosos_historico() from public, anon;
grant execute on function public.tc_amistosos_historico() to authenticated;
