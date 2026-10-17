-- 4º rankeamento global da página "Ranks" (menu Outros): "Power" — por
-- Power total do jogador (mesmo número mostrado em qualquer outro lugar do
-- jogo, ver js/systems/power.js computePlayerPower + syncProfile em
-- js/systems/pvp.js, que já manda esse valor pra pvp_snapshots.power a
-- cada sync). Mesmo padrão exato de pvp_rank_level/pvp_rank_transcend (ver
-- 0008_pvp_ranks.sql): top 100 + a própria linha do jogador no fim se ele
-- não estiver entre os 100.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo.

-- drop antes do create or replace: a função já existe (rodada antes sem
-- is_vip) e o Postgres não deixa mudar as colunas de retorno de uma
-- função existente só com create or replace.
drop function if exists public.pvp_rank_power(uuid);

create or replace function public.pvp_rank_power(viewer_id uuid)
returns table (
  entity_id uuid,
  nick text,
  icon_id text,
  power integer,
  "position" integer,
  is_vip boolean
)
language sql
stable
as $$
  with ranked as (
    select p.id as entity_id, p.nick, p.icon_id,
           round(coalesce(s.power, 0))::int as power,
           row_number() over (order by coalesce(s.power, 0) desc, p.id asc)::int as "position",
           p.is_vip
    from public.pvp_profiles p
    left join public.pvp_snapshots s on s.profile_id = p.id
  )
  select * from ranked where "position" <= 100 or entity_id = viewer_id
  order by "position";
$$;

grant execute on function public.pvp_rank_power(uuid) to authenticated;
