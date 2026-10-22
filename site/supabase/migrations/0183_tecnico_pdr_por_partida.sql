-- PDR no Rank do site por PARTIDA do Rift Manager (substitui o PDR de fim de liga). Rode depois da 0182. Idempotente.
--   * Vitória +5 PDR e derrota +3 PDR (a derrota nunca tira PDR).
--   * Conta só nas mesmas partidas que valem XP: os primeiros amistosos do dia (os que dão XP) e cada jogo oficial de campeonato.
--     Treino da segunda-feira, amistoso além do limite de XP e partida simulada pelo sistema / W.O. não dão PDR.
--   * Os valores ficam em tc_config 'rank_partida' ({"vitoria": 5, "derrota": 3}) e só valem com tc_config.rank_ativo = true.
--   * Desliga o PDR de fim de liga e dos torneios internacionais (para não somar duas fontes): tc_rank_liga passa a não lançar nada
--     e tc_config 'rank_intl' fica vazio. (Os valores antigos de 'rank_intl' estão no comentário no fim do arquivo.)

insert into public.tc_config (chave, valor) values ('rank_partida', '{"vitoria": 5, "derrota": 3}'::jsonb)
on conflict (chave) do nothing;

create or replace function public.tc_rank_partida(oid bigint, ganhou boolean, dia_ date)
returns int language plpgsql security definer set search_path = public as $$
declare
  c jsonb := coalesce(tc_cfg('rank_partida'), '{"vitoria": 5, "derrota": 3}'::jsonb);
  uid uuid;
  pdr int;
begin
  if not coalesce((tc_cfg('rank_ativo'))::text::boolean, false) then return null; end if;
  select user_id into uid from tc_orgs where id = oid;
  if uid is null then return null; end if;
  pdr := case when ganhou then coalesce((c->>'vitoria')::int, 5) else coalesce((c->>'derrota')::int, 3) end;
  perform site_rk_lancar(uid, dia_, 'tecnico', 'partida', pdr);
  return pdr;
end;
$$;
revoke all on function public.tc_rank_partida(bigint, boolean, date) from public, anon, authenticated;

-- PDR de fim de liga: desligado.
create or replace function public.tc_rank_liga(oid bigint, lid bigint, pos_ int, vitorias_ int, dia_ date)
returns int language plpgsql security definer set search_path = public as $$
begin
  return null;
end;
$$;
revoke all on function public.tc_rank_liga(bigint, bigint, int, int, date) from public, anon, authenticated;

-- PDR dos torneios internacionais: desligado (sem base, o fechamento do torneio não lança PDR).
update public.tc_config set valor = '{}'::jsonb where chave = 'rank_intl';

-- Amistoso: registra o resultado e dá o PDR quando o amistoso vale XP.
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
  pdr_ int := null;
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
  -- PDR do Rank do site: só nos amistosos que dão XP (os primeiros do dia). Vitória +5, derrota +3 (derrota nunca tira PDR).
  if exp_ok then pdr_ := tc_rank_partida(a.org_a, ganhou, site_hoje_br()); end if;
  select * into g from tc_orgs where id = a.org_b;
  return jsonb_build_object('ok', true, 'id', a.id, 'vencedor', res_->>'vencedor', 'exp', exp_ok, 'exp_ganho', case when not exp_ok then 0 when ganhou then (ac->>'exp_ganho')::int else coalesce((ac->>'exp_derrota')::int, 5) end,
                            'pdr', pdr_, 'feitos_hoje', feitos + 1, 'com_exp_restantes', greatest(0, (ac->>'exp_por_dia')::int - feitos - 1),
                            'oponente', jsonb_build_object('id', g.id, 'nome', g.nome, 'sigla', g.sigla));
end;
$$;
revoke all on function public.tc_amistoso_registrar(bigint, jsonb) from public, anon;
grant execute on function public.tc_amistoso_registrar(bigint, jsonb) to authenticated;

-- Jogos oficiais: o gatilho que já premiava XP e maestria por mapa agora também dá o PDR.
create or replace function public.tc_gameplay_mapa_premios()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  tr jsonb := tc_cfg('treino');
  org_perd bigint; x jsonb; org_x bigint; ganhou boolean;
  d date := site_hoje_br();
begin
  select * into p from tc_partidas where id = new.partida_id;
  org_perd := case when new.vencedor_org = p.org_a then p.org_b else p.org_a end;
  update tc_jogadores j set exp = least(100, exp + coalesce((tr->>'exp_partida')::int, 10))
   where j.org_id = new.vencedor_org and j.slot is not null and (p.pov is null or j.org_id = p.pov) and exists (select 1 from tc_orgs o where o.id = j.org_id and o.user_id is not null);
  update tc_jogadores j set exp = least(100, exp + coalesce((tr->>'exp_derrota')::int, 5))
   where j.org_id = org_perd and j.slot is not null and (p.pov is null or j.org_id = p.pov) and exists (select 1 from tc_orgs o where o.id = j.org_id and o.user_id is not null);
  for x in select * from jsonb_array_elements(coalesce(new.resumo->'jogadores', '[]'::jsonb)) loop
    org_x := case when x->>'equipe' = 'azul' then new.org_azul else case when new.org_azul = p.org_a then p.org_b else p.org_a end end;
    continue when not exists (select 1 from tc_orgs o where o.id = org_x and o.user_id is not null) or (p.pov is not null and org_x <> p.pov);
    perform tc_maestria_registrar((x->>'id')::bigint, (select c.id from tc_campeoes c where c.nome = x->>'campeao'), org_x = new.vencedor_org);
  end loop;
  -- PDR do Rank do site: cada jogo oficial de campeonato jogado (fora o treino da segunda). Vitória +5, derrota +3.
  -- Só técnicos de verdade (conta real) e só quem jogou: partida simulada pelo sistema ou W.O. não passa por aqui.
  if p.fase <> 'treino' then
    if exists (select 1 from tc_orgs o where o.id = new.vencedor_org and o.user_id is not null) and (p.pov is null or new.vencedor_org = p.pov) then
      perform tc_rank_partida(new.vencedor_org, true, d);
    end if;
    if exists (select 1 from tc_orgs o where o.id = org_perd and o.user_id is not null) and (p.pov is null or org_perd = p.pov) then
      perform tc_rank_partida(org_perd, false, d);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.tc_gameplay_mapa_premios() from public, anon, authenticated;

-- Valores antigos de tc_config.rank_intl (PDR dos torneios, antes desta migração):
--   {"copa": {"1": 30, "2": 22, "3": 14}, "mundial": {"1": 38, "2": 32, "3": 24, "5": 14}}
-- Para voltar o PDR de fim de liga/torneios é preciso restaurar também a função tc_rank_liga (ver a 0087).
