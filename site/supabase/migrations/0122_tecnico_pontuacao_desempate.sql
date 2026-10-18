-- Pontuação e desempate da fase de pontos (Liga Academy e Liga Nacional) e posição na tabela depois da fase de pontos.
--   * Vitória = 1 ponto; derrota = 0. A pontuação só decide quem vai às semifinais de sábado (os 4 primeiros).
--   * Desempate: 1) confronto direto (vitórias contra os outros times empatados em pontos), 2) quem terminou os jogos mais rápido
--     (menor soma da duração das partidas; partida sem tempo registrado, como W.O., conta 60 min), 3) semente da liga.
--   * Depois da fase de pontos a tabela mostra a posição final: os finalistas ficam em 1º e 2º (ordem da fase de pontos até a final
--     terminar), os semifinalistas eliminados em 3º e 4º e os demais pela fase de pontos.
-- Rode depois da 0121; seguro rodar de novo.

create or replace function public.tc_tabela(liga bigint)
returns table (pos int, org_id bigint, partidas int, vitorias int, derrotas int, mapas_pro int, mapas_contra int, pontos int)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.org_a as org, p.org_b as opp, p.placar_a as pro, p.placar_b as contra,
           coalesce((select sum((m->>'duracao')::int) from jsonb_array_elements(case when jsonb_typeof(p.resumo->'mapas') = 'array' then p.resumo->'mapas' else '[]'::jsonb end) m), 0) as dur
      from tc_partidas p where p.liga_id = liga and p.status = 'concluida' and p.fase = 'rodada'
    union all
    select p.org_b, p.org_a, p.placar_b, p.placar_a,
           coalesce((select sum((m->>'duracao')::int) from jsonb_array_elements(case when jsonb_typeof(p.resumo->'mapas') = 'array' then p.resumo->'mapas' else '[]'::jsonb end) m), 0)
      from tc_partidas p where p.liga_id = liga and p.status = 'concluida' and p.fase = 'rodada'
  ), tot as (
    select t.org_id, t.semente,
           count(b.org)::int as partidas,
           (count(*) filter (where b.pro > b.contra))::int as vitorias,
           (count(*) filter (where b.pro < b.contra))::int as derrotas,
           coalesce(sum(b.pro), 0)::int as mapas_pro,
           coalesce(sum(b.contra), 0)::int as mapas_contra,
           (count(*) filter (where b.pro > b.contra))::int as pontos,
           coalesce(sum(case when b.org is null then 0 when b.dur > 0 then b.dur else 60 end), 0)::int as tempo
      from tc_liga_times t left join base b on b.org = t.org_id
     where t.liga_id = liga group by t.org_id, t.semente
  ), h2h as (
    select b.org, (count(*) filter (where b.pro > b.contra))::int as h
      from base b join tot s on s.org_id = b.org join tot o on o.org_id = b.opp
     where s.pontos = o.pontos group by b.org
  )
  select (row_number() over (order by tot.pontos desc, coalesce(h2h.h, 0) desc, tot.tempo, tot.semente, tot.org_id))::int as pos,
         tot.org_id, tot.partidas, tot.vitorias, tot.derrotas, tot.mapas_pro, tot.mapas_contra, tot.pontos
    from tot left join h2h on h2h.org = tot.org_id order by pos;
$$;
revoke all on function public.tc_tabela(bigint) from public, anon, authenticated;

create or replace function public.tc_tabela_final(liga bigint)
returns table (pos int, org_id bigint, partidas int, vitorias int, derrotas int, mapas_pro int, mapas_contra int, pontos int)
language sql stable security definer set search_path = public as $$
  with t as (select * from tc_tabela(liga)),
       f as (select * from tc_partidas p where p.liga_id = liga and p.fase = 'final' order by p.id limit 1)
  select (row_number() over (order by
            case when exists (select 1 from f where f.status = 'concluida' and f.vencedor = t.org_id) then 1
                 when exists (select 1 from f where f.status = 'concluida' and t.org_id in (f.org_a, f.org_b)) then 2
                 when exists (select 1 from f where f.status = 'agendada' and t.org_id in (f.org_a, f.org_b)) then 1
                 when exists (select 1 from f) and exists (select 1 from tc_partidas s where s.liga_id = liga and s.fase = 'semi' and s.status = 'concluida'
                                                              and t.org_id in (s.org_a, s.org_b) and s.vencedor <> t.org_id) then 3
                 else 4 end, t.pos))::int as pos,
         t.org_id, t.partidas, t.vitorias, t.derrotas, t.mapas_pro, t.mapas_contra, t.pontos
    from t order by 1;
$$;
revoke all on function public.tc_tabela_final(bigint) from public, anon, authenticated;

create or replace function public.tc_liga_json(lid bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l tc_ligas;
  tab jsonb;
  n int;
begin
  select * into l from tc_ligas where id = lid;
  if l.id is null then return null; end if;
  n := (select count(*) from tc_liga_times where liga_id = lid);
  if l.tipo = 'divisao' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'pos', f.pos, 'pos_pontos', t.pos, 'org', tc_org_json(t.org_id), 'partidas', t.partidas, 'vitorias', t.vitorias, 'derrotas', t.derrotas,
             'mapas_pro', t.mapas_pro, 'mapas_contra', t.mapas_contra, 'saldo', t.mapas_pro - t.mapas_contra, 'pontos', t.pontos,
             'poder', round(tc_poder_org(t.org_id)::numeric, 1),
             'pos_final', f.pos,
             'situacao', case when l.divisao = 'acesso' and f.pos <= 2 then 'promocao'
                              when l.divisao = 'principal' and f.pos > n - 2 then 'rebaixamento'
                              when l.divisao = 'principal' and f.pos <= 2 then 'copa'
                              else 'permanece' end) order by f.pos), '[]'::jsonb) into tab
      from tc_tabela(lid) t join tc_tabela_final(lid) f on f.org_id = t.org_id;
  else
    select coalesce(jsonb_agg(jsonb_build_object('pos', t.semente, 'org', tc_org_json(t.org_id), 'partidas', 0, 'vitorias', 0, 'derrotas', 0,
                                                 'mapas_pro', 0, 'mapas_contra', 0, 'saldo', 0, 'pontos', 0,
                                                 'poder', round(tc_poder_org(t.org_id)::numeric, 1), 'situacao', null) order by t.semente), '[]'::jsonb) into tab
      from tc_liga_times t where t.liga_id = lid;
  end if;
  return jsonb_build_object('id', l.id, 'nome', l.nome, 'divisao', l.divisao, 'tipo', l.tipo, 'status', l.status,
                            'temporada', l.temporada, 'semana', l.semana, 'dono', l.dono_org, 'tabela', tab,
                            'partidas', coalesce((select jsonb_agg(tc_partida_json(p) order by p.dia, p.id) from tc_partidas p where p.liga_id = l.id), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_liga_json(bigint) from public, anon, authenticated;
