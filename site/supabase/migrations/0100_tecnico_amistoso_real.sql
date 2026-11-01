-- Simulador de Técnico: amistoso com partida de verdade (picks e bans + simulação no navegador). Rode depois do 0099. Idempotente.
--
--  * tc_amistoso(oponente, chave)  abre o amistoso (estado 'aberto') e devolve o id; a partida roda em partida/?amistoso=<id>.
--  * tc_amistoso_elencos(id)       escalações dos dois times, semente e versão das regras.
--  * tc_amistoso_registrar(id, r)  fecha o amistoso com o resultado jogado (EXP só nos primeiros do dia; não vale campeonato).
--  * Uma partida (mapa único). O histórico e o limite diário contam só amistosos finalizados.

alter table public.tc_amistosos add column if not exists estado text not null default 'finalizado' check (estado in ('aberto', 'finalizado'));
alter table public.tc_amistosos add column if not exists bans jsonb;
alter table public.tc_amistosos alter column resultado set default '{}'::jsonb;

update public.tc_config set valor = jsonb_set(valor, '{formato}', '1') where chave = 'amistoso' and (valor->>'formato') <> '1';

create or replace function public.tc_amistoso(oponente bigint, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  g tc_orgs;
  cfg jsonb := tc_cfg('amistoso');
  hoje date := site_hoje_br();
  feitos int;
  a tc_amistosos;
begin
  perform tc_exigir(uid);
  if not coalesce(((tc_cfg('gameplay'))->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into a from tc_amistosos where user_id = uid and chave = chave_;
  if a.id is not null then return jsonb_build_object('ja_feito', true, 'id', a.id, 'estado', a.estado); end if;
  select * into g from tc_orgs where id = oponente;
  if g.id is null or g.id = o.id then raise exception 'oponente_invalido'; end if;
  if not tc_elenco_completo(o.id) then raise exception 'elenco_incompleto'; end if;
  if not tc_elenco_completo(g.id) then raise exception 'oponente_sem_elenco'; end if;
  select count(*) into feitos from tc_amistosos where org_a = o.id and dia = hoje and estado = 'finalizado';
  if feitos >= (cfg->>'max_dia')::int then raise exception 'amistoso_limite_dia'; end if;
  delete from tc_amistosos where org_a = o.id and estado = 'aberto'; -- só um amistoso aberto por vez
  insert into tc_amistosos (org_a, org_b, dia, resultado, deu_exp, chave, user_id, estado) values (o.id, g.id, hoje, '{}'::jsonb, false, chave_, uid, 'aberto') returning * into a;
  return jsonb_build_object('ok', true, 'id', a.id, 'oponente', jsonb_build_object('id', g.id, 'nome', g.nome, 'sigla', g.sigla));
end;
$$;
revoke all on function public.tc_amistoso(bigint, text) from public, anon;
grant execute on function public.tc_amistoso(bigint, text) to authenticated;

create or replace function public.tc_amistoso_elencos(aid bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a tc_amistosos;
  cfg jsonb := tc_cfg('gameplay');
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  select * into a from tc_amistosos where id = aid;
  if a.id is null or a.user_id is distinct from uid then raise exception 'amistoso_inexistente'; end if;
  if a.estado <> 'aberto' then raise exception 'amistoso_ja_jogado'; end if;
  if not tc_elenco_completo(a.org_a) then raise exception 'elenco_incompleto'; end if;
  if not tc_elenco_completo(a.org_b) then raise exception 'oponente_sem_elenco'; end if;
  return jsonb_build_object(
    'id', a.id, 'mapa', 1, 'semente', tc_gameplay_semente(a.id, -1), 'versao', (cfg->>'versao')::int,
    'azul', jsonb_build_object('org', tc_org_json(a.org_a), 'jogadores', tc_gameplay_jogadores(a.org_a)),
    'vermelho', jsonb_build_object('org', tc_org_json(a.org_b), 'jogadores', tc_gameplay_jogadores(a.org_b)));
end;
$$;
revoke all on function public.tc_amistoso_elencos(bigint) from public, anon;
grant execute on function public.tc_amistoso_elencos(bigint) to authenticated;

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
    update tc_jogadores set exp = exp + (ac->>'exp_ganho')::int where org_id = a.org_a and slot is not null;
  end if;
  select * into g from tc_orgs where id = a.org_b;
  return jsonb_build_object('ok', true, 'id', a.id, 'vencedor', res_->>'vencedor', 'exp', exp_ok, 'exp_ganho', case when exp_ok then (ac->>'exp_ganho')::int else 0 end,
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
    'feitos_hoje', feitos, 'exp_por_dia', (cfg->>'exp_por_dia')::int, 'exp_ganho', (cfg->>'exp_ganho')::int,
    'com_exp_restantes', greatest(0, (cfg->>'exp_por_dia')::int - feitos),
    'lista', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'dia', h.dia, 'exp', h.deu_exp, 'a', (h.resultado->>'a')::int, 'b', (h.resultado->>'b')::int,
                         'oponente', jsonb_build_object('id', g.id, 'nome', g.nome, 'sigla', g.sigla)) order by h.id desc)
                         from (select * from tc_amistosos where org_a = o.id and estado = 'finalizado' order by id desc limit 30) h join tc_orgs g on g.id = h.org_b), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_amistosos_historico() from public, anon;
grant execute on function public.tc_amistosos_historico() to authenticated;
