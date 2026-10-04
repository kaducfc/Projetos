-- Carreira no Rift: nova pontuação de legado (dinheiro: 18 pontos por US$ 1 milhão;
-- MVP da Final do Mundial 30; outros prêmios individuais 15). Atualiza a faixa
-- de nota possível usada na vigilância do painel ("não bate com os troféus"),
-- calibrada com 1.400 carreiras simuladas: nenhuma carreira honesta ficou fora.
-- Rodar depois da 0030. Rodar de novo é seguro.

create or replace function public.site_admin_ranked(days int default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  hoje date := site_hoje_br();
  ini date;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  days := least(greatest(coalesce(days, 7), 1), 365);
  ini := hoje - (days - 1);
  return jsonb_build_object(
    'dias', days,
    'partidas', (select coalesce(jsonb_agg(x order by x.criado desc), '[]'::jsonb) from (
      select k.id, k.dia, k.criado, k.score, pr.username,
             i.criado as comecou,
             extract(epoch from (k.criado - i.criado))::int as duracao_s,
             (r.summary->>'peakOvr')::int as ovr,
             (r.summary->>'seasons')::int as temporadas,
             r.summary->>'legacy' as legado,
             r.summary->>'role' as rota,
             r.summary->'titles' as titulos,
             b.base + 4 * b.ligas as esperado_min,
             b.base + 20 * b.ligas + 30 * b.mundial + 20 * b.temporadas + 20 as esperado_max
        from site_ranked_partidas k
        join site_profiles pr on pr.id = k.user_id
        left join site_game_results r on r.id = k.result_id
        left join site_ranked_inicios i on i.result_id = k.result_id
        left join lateral (
          select (r.summary->>'peakOvr')::numeric * 2
                 + coalesce((r.summary->'titles'->>'mundial')::numeric, 0) * 120
                 + coalesce((r.summary->'titles'->>'msi')::numeric, 0) * 60
                 + coalesce((r.summary->'titles'->>'firstStand')::numeric, 0) * 35
                 + round(18 * coalesce((r.summary->>'earnings')::numeric, 0) / 1000000) as base,
                 coalesce((r.summary->'titles'->>'ligas')::numeric, 0) as ligas,
                 coalesce((r.summary->'titles'->>'mundial')::numeric, 0) as mundial,
                 coalesce((r.summary->>'seasons')::numeric, 0) as temporadas
           where r.summary ? 'peakOvr' and jsonb_typeof(r.summary->'peakOvr') = 'number'
        ) b on true
       where k.dia >= ini
       order by k.criado desc
       limit 1000) x),
    'banidos', (select coalesce(jsonb_agg(jsonb_build_object('username', pr.username, 'motivo', b.motivo, 'criado', b.criado)
                                          order by b.criado desc), '[]'::jsonb)
                  from site_ranked_banidos b join site_profiles pr on pr.id = b.user_id)
  );
end;
$$;
revoke all on function public.site_admin_ranked(int) from public, anon;
grant execute on function public.site_admin_ranked(int) to authenticated;
