-- Simulador de Técnico: Treinamento por barra de XP. Rode depois do 0113. Idempotente.
--  * Cada jogador tem uma barra de XP de 0 a 100 (sem níveis). Só dá para treinar com a barra cheia (100/100).
--  * Treinar custa créditos, zera a barra (0/100), segue levando o tempo da sessão (6h) e sobe UM atributo em +1 (antes +3).
--  * Continua valendo o limite de Poder: +10 para jogador comum e +15 para Legado (máximo 100).
--  * XP vem das partidas (+10 para os titulares) e dos amistosos (+10, só os 5 primeiros do dia). O tempo da sessão não depende mais do XP.
--  * Os custos caíram para um terço (a sessão rende um terço). Valores em tc_config.treino e tc_config.amistoso.

update public.tc_config set valor = valor || '{"pontos": 1, "custo_base": 2000, "custo_por_ponto": 70, "reducao_exp_max": 0, "exp_partida": 10}'::jsonb where chave = 'treino';
update public.tc_config set valor = jsonb_set(valor, '{exp_ganho}', '10') where chave = 'amistoso';

-- A barra nunca passa de 100 (nem fica negativa), venha o XP de onde vier.
create or replace function public.tc_jogador_xp_limite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.exp := least(100, greatest(0, coalesce(new.exp, 0)));
  return new;
end;
$$;
revoke all on function public.tc_jogador_xp_limite() from public, anon, authenticated;
drop trigger if exists tc_jogador_xp_limite on public.tc_jogadores;
create trigger tc_jogador_xp_limite before insert or update of exp on public.tc_jogadores
  for each row execute function public.tc_jogador_xp_limite();
update public.tc_jogadores set exp = 100 where exp > 100;

create or replace function public.tc_treinar(jogador bigint, atributo_ text, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  cfg jsonb := tc_cfg('treino');
  atual int;
  custo bigint;
  t tc_treinos;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  if atributo_ is null or atributo_ not in ('mec', 'rotas', 'macro', 'tf', 'mental') then raise exception 'atributo_invalido'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into t from tc_treinos where user_id = uid and chave = chave_;
  if t.id is not null then return jsonb_build_object('ja_feito', true, 'fim', t.fim); end if;
  perform tc_treino_processar(o.id);
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if exists (select 1 from tc_treinos where jogador_id = j.id and status = 'andamento') then raise exception 'jogador_treinando'; end if;
  if (select count(*) from tc_treinos where org_id = o.id and status = 'andamento') >= (cfg->>'simultaneos')::int then raise exception 'treinos_demais'; end if;
  atual := case atributo_ when 'mec' then j.mec when 'rotas' then j.rotas when 'macro' then j.macro when 'tf' then j.tf else j.mental end;
  if atual >= 100 then raise exception 'atributo_no_maximo'; end if;
  if j.poder_inicial is null then
    update tc_jogadores set poder_inicial = round(tc_poder(j))::int where id = j.id;
    select * into j from tc_jogadores where id = j.id;
  end if;
  if round(tc_poder(j)) >= tc_treino_limite(j) then raise exception 'treino_limite_atingido'; end if;
  if j.exp < 100 then raise exception 'xp_insuficiente'; end if; -- só treina com a barra de XP cheia
  custo := tc_treino_custo(atual);
  if o.creditos < custo then raise exception 'creditos_insuficientes'; end if;
  perform tc_creditos_mexer(o.id, -custo, 'treino', j.id::text);
  update tc_jogadores set exp = 0 where id = j.id; -- a sessão gasta o XP (0/100)
  insert into tc_treinos (org_id, jogador_id, atributo, pontos, custo, fim, chave, user_id)
  values (o.id, j.id, atributo_, (cfg->>'pontos')::int, custo, now() + make_interval(secs => round(tc_treino_horas(j) * 3600)::int), chave_, uid)
  returning * into t;
  return jsonb_build_object('ok', true, 'fim', t.fim, 'custo', custo, 'pontos', t.pontos);
end;
$$;
revoke all on function public.tc_treinar(bigint, text, text) from public, anon;
grant execute on function public.tc_treinar(bigint, text, text) to authenticated;

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
  update tc_jogadores set forma = greatest(25, forma - 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_partida')::int, 10)) where org_id = perd and slot is not null;
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
  update tc_jogadores set forma = greatest(25, forma - 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_partida')::int, 10)) where org_id = perd and slot is not null;
  return true;
end;
$$;
revoke all on function public.tc_processar_partida(bigint) from public, anon, authenticated;

