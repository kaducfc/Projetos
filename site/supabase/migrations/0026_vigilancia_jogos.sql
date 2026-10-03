-- Vigilância dos outros jogos da ranqueada (Lendas, Runetermo, Campeão Oculto
-- e Na Medida), no painel do administrador. Rodar depois da 0025.
-- Só leitura: devolve as partidas do período com o que é preciso para
-- achar padrões suspeitos (a Carreira continua na vigilância própria).

create or replace function public.site_admin_vigia(days int default 7)
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
  days := least(greatest(coalesce(days, 7), 1), 90);
  ini := hoje - (days - 1);
  return jsonb_build_object(
    'dias', days,
    'partidas', coalesce((select jsonb_agg(x order by x.criado desc) from (
      select d.dia, d.criado, d.jogo, p.username, d.base, d.pdr, d.score,
             -- Lendas (Oculto)
             r.summary->>'resultado' as resultado,
             (r.summary->>'vitorias')::int as vitorias,
             (r.summary->>'invicto')::boolean as invicto,
             -- Runetermo e Campeão Oculto
             sd.status as status,
             case when sd.user_id is not null then jsonb_array_length(sd.chutes) end as chutes,
             case when sd.user_id is not null then jsonb_array_length(sd.dicas) end as dicas,
             -- Na Medida
             e.media, e.reinicios,
             (select min((q->>'pontos')::int) from jsonb_array_elements(e.rodadas) q) as pior_rodada,
             (select count(*) from jsonb_array_elements(e.rodadas) q where (q->>'pontos')::int >= 95) as rodadas_95,
             -- Tempo do começo ao fim, pelo relógio do servidor.
             case
               when d.jogo = 'cblol' then extract(epoch from (i.usado_em - i.criado))::int
               when sd.user_id is not null then extract(epoch from (sd.terminado - sd.criado))::int
               when e.user_id is not null then extract(epoch from (e.terminado - e.criado))::int
             end as duracao_s
        from site_rk_dia d
        join site_profiles p on p.id = d.user_id
        left join site_game_results r on r.id = d.result_id and d.jogo = 'cblol'
        left join site_ranked_inicios i on i.result_id = d.result_id and d.jogo = 'cblol'
        left join site_diario sd on sd.user_id = d.user_id and sd.dia = d.dia and sd.jogo = d.jogo
                                and d.jogo in ('runetermo', 'campeao')
        left join site_escala e on e.user_id = d.user_id and e.dia = d.dia and d.jogo = 'escala'
       where d.dia >= ini and d.jogo in ('cblol', 'runetermo', 'campeao', 'escala')
       order by d.criado desc
       limit 2000) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.site_admin_vigia(int) from public, anon;
grant execute on function public.site_admin_vigia(int) to authenticated;
