-- Simulador de Técnico: a partida passa a informar quando terminou por W.O. (campos wo e wo_ausente: quem não jogou). Rode depois do 0161. Idempotente.
create or replace function public.tc_partida_json(p tc_partidas)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'liga_id', p.liga_id, 'fase', p.fase, 'rodada', p.rodada, 'dia', p.dia, 'formato', p.formato,
                            'status', p.status, 'a', tc_org_json(p.org_a), 'b', tc_org_json(p.org_b),
                            'placar_a', p.placar_a, 'placar_b', p.placar_b, 'vencedor', p.vencedor,
                            'poder_a', p.poder_a, 'poder_b', p.poder_b, 'pov', p.pov,
                            'wo', coalesce(p.resumo->>'origem', '') = 'wo', 'wo_ausente', case when p.resumo->>'origem' = 'wo' then (p.resumo->>'ausente')::bigint end)
         || coalesce((select jsonb_build_object('liga_nome', l.nome, 'liga_tipo', l.tipo, 'liga_divisao', l.divisao) from tc_ligas l where l.id = p.liga_id), '{}'::jsonb);
$$;
revoke all on function public.tc_partida_json(tc_partidas) from public, anon, authenticated;
