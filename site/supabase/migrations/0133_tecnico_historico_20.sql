-- Histórico: só as últimas 20 transferências/contratos e as últimas 20 movimentações de finanças.
-- Rode depois da 0132; seguro rodar de novo.

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
                            from (select * from tc_partidas where status = 'concluida' and (org_a = o.id or org_b = o.id) order by dia desc, id desc limit 30) p), '[]'::jsonb),
    'premios', coalesce((select jsonb_agg(jsonb_build_object('liga', l.nome, 'posicao', pr.posicao, 'creditos', pr.creditos, 'pdr', pr.rank_pdr, 'criado', pr.criado) order by pr.criado desc)
                           from tc_premios pr join tc_ligas l on l.id = pr.liga_id where pr.org_id = o.id), '[]'::jsonb),
    'trofeus', coalesce((select jsonb_agg(jsonb_build_object('titulo', t.titulo, 'temporada', t.temporada) order by t.id desc) from tc_trofeus t where t.org_id = o.id), '[]'::jsonb),
    'financas', coalesce((select jsonb_agg(jsonb_build_object('delta', f.delta, 'saldo', f.saldo, 'motivo', f.motivo, 'criado', f.criado) order by f.id desc)
                            from (select * from tc_fin where org_id = o.id order by id desc limit 20) f), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_historico() from public, anon;
grant execute on function public.tc_historico() to authenticated;
