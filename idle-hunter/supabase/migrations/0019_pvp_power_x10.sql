-- Só ajusta a ESCALA de exibição do Power (ver POWER_DISPLAY_MULTIPLIER em
-- js/systems/power.js) — o jogador continua mandando o próprio Power já
-- multiplicado por 10 (pedido do usuário: número final maior/mais
-- "preciso", sem mudar o peso relativo de nenhum stat entre si). Só
-- precisa mexer aqui pra manter a estimativa de Power dos BOTS (que não
-- têm item de verdade, ver 0018_pvp_power.sql) na mesma escala.
--
-- Inclui de novo o "add column if not exists" de 0018_pvp_power.sql —
-- seguro rodar mesmo se você ainda não tinha colado aquele migration antes
-- (esse aqui já cobre tudo sozinho).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- (https://supabase.com/dashboard/project/_/sql) e rode uma vez. Seguro
-- rodar de novo.

alter table public.pvp_snapshots
  add column if not exists power numeric not null default 0;

drop function if exists public.pvp_tier_board(text, integer);

create or replace function public.pvp_tier_board(target_tier text, target_group integer)
returns table (
  entity_id uuid,
  is_bot boolean,
  nick text,
  icon_id text,
  hunter_level integer,
  rating integer,
  wins integer,
  "position" integer,
  real_rank integer,
  real_player_count integer,
  is_vip boolean,
  power integer
)
language sql
stable
as $$
  with player_count as (
    select count(*)::int as n
    from public.pvp_profiles
    where tier = target_tier
      and (target_tier = 'lendario' or group_index = target_group)
  ),
  bots_to_show as (
    select least(5, greatest(0, 6 - (select n from player_count))) as show_count
  ),
  combined as (
    select p.id as entity_id, false as is_bot, p.nick, p.icon_id, p.hunter_level, p.rating, p.wins, p.is_vip,
           coalesce(s.power, 0) as power
    from public.pvp_profiles p
    left join public.pvp_snapshots s on s.profile_id = p.id
    where p.tier = target_tier
      and (target_tier = 'lendario' or p.group_index = target_group)
    union all
    select b.id as entity_id, true as is_bot, b.nick, 'hunter' as icon_id, 0 as hunter_level, b.rating, 0 as wins, false as is_vip,
           round((b.dps * 1 + b.max_hp * 0.25 + b.armor * 1.2 + b.crit_chance * 5 + b.crit_damage * 1.8 + b.dodge_chance * 6) * 10)::int as power
    from public.pvp_bots b
    where b.tier = target_tier
      and b.slot_index <= (select show_count from bots_to_show)
  ),
  numbered as (
    select entity_id, is_bot, nick, icon_id, hunter_level, rating, wins, is_vip, power,
           row_number() over (order by rating desc, entity_id asc)::int as "position",
           case when not is_bot
             then row_number() over (partition by is_bot order by rating desc, entity_id asc)
           end::int as real_rank
    from combined
  )
  select entity_id, is_bot, nick, icon_id, hunter_level, rating, wins, "position",
         real_rank, (select n from player_count) as real_player_count, is_vip, power
  from numbered
  order by "position";
$$;

grant execute on function public.pvp_tier_board(text, integer) to authenticated;
