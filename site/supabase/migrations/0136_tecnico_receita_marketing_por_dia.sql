-- Receita do marketing: um lançamento por dia ("Marketing · Ganhos 18/10") que vai acumulando, em vez de uma linha a cada processamento.
--   * tc_creditos_mexer: a receita do marketing do dia (ref 'dia:AAAA-MM-DD') soma no lançamento do dia, se ele já existir.
--   * Limpeza: os lançamentos antigos de receita são somados por dia.
--   * O histórico passa a devolver o ref de cada lançamento.
-- Rode depois da 0135; seguro rodar de novo.

create or replace function public.tc_creditos_mexer(oid bigint, delta bigint, motivo_ text, ref_ text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  novo bigint;
  dia text;
  linha bigint;
begin
  update tc_orgs set creditos = creditos + delta where id = oid returning creditos into novo;
  if motivo_ = 'mkt_receita' then
    dia := 'dia:' || site_hoje_br()::text;
    select f.id into linha from tc_fin f where f.org_id = oid and f.motivo = 'mkt_receita' and f.ref = dia order by f.id desc limit 1;
    if linha is not null then
      update tc_fin f set delta = f.delta + $2, saldo = novo where f.id = linha;
      return novo;
    end if;
    ref_ := dia;
  end if;
  insert into tc_fin (org_id, delta, saldo, motivo, ref) values (oid, delta, novo, motivo_, ref_);
  return novo;
end;
$$;
revoke all on function public.tc_creditos_mexer(bigint, bigint, text, text) from public, anon, authenticated;

with g as (
  select org_id, (criado at time zone 'America/Sao_Paulo')::date as d, min(id) as manter, sum(delta) as total, (array_agg(saldo order by id desc))[1] as sal
    from tc_fin where motivo = 'mkt_receita' and (ref is null or ref not like 'dia:%') group by 1, 2)
update tc_fin f set delta = g.total, saldo = g.sal, ref = 'dia:' || g.d::text from g where f.id = g.manter;
delete from tc_fin where motivo = 'mkt_receita' and (ref is null or ref not like 'dia:%');

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
                                  from (select * from tc_transf where de_org = o.id or para_org = o.id order by id desc limit 20) t join tc_jogadores jg on jg.id = t.jogador_id), '[]'::jsonb),
    'partidas', coalesce((select jsonb_agg(tc_partida_json(p) order by p.dia desc, p.id desc)
                            from (select * from tc_partidas where status = 'concluida' and (org_a = o.id or org_b = o.id) order by dia desc, id desc limit 10) p), '[]'::jsonb),
    'premios', coalesce((select jsonb_agg(jsonb_build_object('liga', l.nome, 'posicao', pr.posicao, 'creditos', pr.creditos, 'pdr', pr.rank_pdr, 'criado', pr.criado) order by pr.criado desc)
                           from tc_premios pr join tc_ligas l on l.id = pr.liga_id where pr.org_id = o.id), '[]'::jsonb),
    'trofeus', coalesce((select jsonb_agg(jsonb_build_object('titulo', t.titulo, 'temporada', t.temporada) order by t.id desc) from tc_trofeus t where t.org_id = o.id), '[]'::jsonb),
    'financas', coalesce((select jsonb_agg(jsonb_build_object('delta', f.delta, 'saldo', f.saldo, 'motivo', f.motivo, 'ref', f.ref, 'criado', f.criado) order by f.id desc)
                            from (select * from tc_fin where org_id = o.id order by id desc limit 20) f), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_historico() from public, anon;
grant execute on function public.tc_historico() to authenticated;
