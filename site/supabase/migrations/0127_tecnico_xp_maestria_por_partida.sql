-- XP e Maestria por partida jogada.
--   * Amistoso: nos 5 primeiros do dia, cada titular ganha XP (10 na vitória, 5 na derrota) e Maestria no campeão que usou (30 / 15 pontos);
--     depois do quinto amistoso do dia não ganha mais nada. Jogar fora da posição não reduz a maestria.
--   * Oficial: XP e Maestria saem de CADA mapa jogado (não mais ao fechar a série): MD1, cada mapa da semifinal (MD3) e da final (MD5).
--     Vitória = 10 XP e 30 pontos de maestria, derrota = 5 XP e 15 pontos (valores em tc_config: treino.exp_partida / exp_derrota e maestria.pontos_*).
--   * Só jogadores de técnicos reais recebem; as partidas simuladas pelo sistema (prazo vencido) seguem dando o XP ao fechar a partida.
-- Rode depois da 0126; seguro rodar de novo.

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
  update tc_jogadores set forma = least(75, forma + 4) where org_id = venc and slot is not null;
  update tc_jogadores set forma = greatest(25, forma - 4) where org_id = perd and slot is not null;
  perform tc_fama_vitoria(venc, pid);
  return jsonb_build_object('concluida', true, 'placar_a', v_a, 'placar_b', v_b, 'vencedor', venc);
end;
$$;
revoke all on function public.tc_gameplay_registrar(bigint, int, jsonb) from public, anon;
grant execute on function public.tc_gameplay_registrar(bigint, int, jsonb) to authenticated;

-- XP e Maestria de cada mapa oficial gravado (resumo já limpo e conferido com o draft pelos gatilhos anteriores).
create or replace function public.tc_gameplay_mapa_premios()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  tr jsonb := tc_cfg('treino');
  org_perd bigint; x jsonb; org_x bigint; ganhou boolean;
begin
  select * into p from tc_partidas where id = new.partida_id;
  org_perd := case when new.vencedor_org = p.org_a then p.org_b else p.org_a end;
  update tc_jogadores j set exp = least(100, exp + coalesce((tr->>'exp_partida')::int, 10))
   where j.org_id = new.vencedor_org and j.slot is not null and exists (select 1 from tc_orgs o where o.id = j.org_id and o.user_id is not null);
  update tc_jogadores j set exp = least(100, exp + coalesce((tr->>'exp_derrota')::int, 5))
   where j.org_id = org_perd and j.slot is not null and exists (select 1 from tc_orgs o where o.id = j.org_id and o.user_id is not null);
  for x in select * from jsonb_array_elements(coalesce(new.resumo->'jogadores', '[]'::jsonb)) loop
    org_x := case when x->>'equipe' = 'azul' then new.org_azul else case when new.org_azul = p.org_a then p.org_b else p.org_a end end;
    continue when not exists (select 1 from tc_orgs o where o.id = org_x and o.user_id is not null);
    perform tc_maestria_registrar((x->>'id')::bigint, (select c.id from tc_campeoes c where c.nome = x->>'campeao'), org_x = new.vencedor_org);
  end loop;
  return new;
end;
$$;
revoke all on function public.tc_gameplay_mapa_premios() from public, anon, authenticated;
drop trigger if exists tc_gameplay_premios_tg on public.tc_gameplay_mapas;
create trigger tc_gameplay_premios_tg after insert on public.tc_gameplay_mapas for each row execute function public.tc_gameplay_mapa_premios();

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
  x record;
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
    -- maestria no campeão usado por cada titular (você é sempre o lado azul no amistoso; o servidor só aceita jogador seu e campeão que existe)
    for x in select distinct on (j.id) j.id, (select c.id from tc_campeoes c where c.nome = e->>'campeao') as campeao
               from jsonb_array_elements(case when jsonb_typeof(res_->'jogadores') = 'array' then res_->'jogadores' else '[]'::jsonb end) e
               join tc_jogadores j on jsonb_typeof(e->'id') = 'number' and j.id = (e->>'id')::bigint
              where j.org_id = a.org_a and j.slot is not null and e->>'equipe' = 'azul' and exists (select 1 from tc_campeoes c where c.nome = e->>'campeao')
              order by j.id limit 5 loop
      perform tc_maestria_registrar(x.id, x.campeao, ganhou);
    end loop;
  end if;
  select * into g from tc_orgs where id = a.org_b;
  return jsonb_build_object('ok', true, 'id', a.id, 'vencedor', res_->>'vencedor', 'exp', exp_ok, 'exp_ganho', case when not exp_ok then 0 when ganhou then (ac->>'exp_ganho')::int else coalesce((ac->>'exp_derrota')::int, 5) end,
                            'feitos_hoje', feitos + 1, 'com_exp_restantes', greatest(0, (ac->>'exp_por_dia')::int - feitos - 1),
                            'oponente', jsonb_build_object('id', g.id, 'nome', g.nome, 'sigla', g.sigla));
end;
$$;
revoke all on function public.tc_amistoso_registrar(bigint, jsonb) from public, anon;
grant execute on function public.tc_amistoso_registrar(bigint, jsonb) to authenticated;
