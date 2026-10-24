-- Arena PvP — contador de vitórias por jogador, pra mostrar no rank do
-- tier (ver pvp_tier_board abaixo e resolve-pvp-battle, que agora
-- incrementa isso a cada luta vencida).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo ("if not exists"/"or replace").

alter table public.pvp_profiles
  add column if not exists wins integer not null default 0;

-- Mesma função de antes (ver 0002_pvp_tiers.sql), só acrescentando "wins"
-- na saída — 0 fixo pros bots (eles não guardam histórico de vitórias).
-- Precisa dropar antes: o Postgres não deixa trocar o formato de retorno
-- (as colunas OUT) de uma função existente só com "create or replace".
drop function if exists public.pvp_tier_board(text);

create or replace function public.pvp_tier_board(target_tier text)
returns table (
  entity_id uuid,
  is_bot boolean,
  nick text,
  icon_id text,
  hunter_level integer,
  rating integer,
  wins integer,
  "position" integer
)
language sql
stable
as $$
  with player_count as (
    select count(*)::int as n from public.pvp_profiles where tier = target_tier
  ),
  bots_to_show as (
    -- 0 jogadores → 5 bots; 1 → 5; 2 → 4; 3 → 3; 4 → 2; 5 → 1; 6+ → 0.
    select least(5, greatest(0, 6 - (select n from player_count))) as show_count
  ),
  combined as (
    select id as entity_id, false as is_bot, nick, icon_id, hunter_level, rating, wins
    from public.pvp_profiles
    where tier = target_tier
    union all
    select id as entity_id, true as is_bot, nick, 'hunter' as icon_id, 0 as hunter_level, rating, 0 as wins
    from public.pvp_bots
    where tier = target_tier
      and slot_index <= (select show_count from bots_to_show)
  )
  select entity_id, is_bot, nick, icon_id, hunter_level, rating, wins,
         row_number() over (order by rating desc, entity_id asc)::int as "position"
  from combined
  order by "position";
$$;

grant execute on function public.pvp_tier_board(text) to authenticated;
