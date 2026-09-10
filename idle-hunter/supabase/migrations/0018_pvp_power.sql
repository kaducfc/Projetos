-- Sistema de "Power" (ver js/systems/power.js): um número único que resume
-- a força de combate de um item/jogador. O jogador manda o PRÓPRIO Power
-- total já calculado (mesma fórmula usada localmente pra tudo o mais, ver
-- syncProfile em js/systems/pvp.js) junto do resto do snapshot de combate —
-- é só mais um número exibido, ninguém usa isso pra resolver luta (a
-- resolução continua 100% em cima de dps/max_hp/armor/crit/dodge de
-- sempre), então o mesmo modelo de confiança de dps/max_hp/etc se aplica.
--
-- Bots (pvp_bots) não têm Power calculado no cliente — não existem de
-- verdade, só uma fileira fixa por tier — então o board estima o deles
-- aqui mesmo, com os MESMOS pesos por stat que POWER_WEIGHTS usa em
-- js/systems/power.js (documentado abaixo pra ficar fácil re-sincronizar
-- se aquele arquivo mudar): dano(dps)=1/ponto, vida=0.25/ponto,
-- armadura=1.2/ponto, crítico(chance)=5/ponto, crítico(dano)=1.8/ponto,
-- esquiva=6/ponto.
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
           round(b.dps * 1 + b.max_hp * 0.25 + b.armor * 1.2 + b.crit_chance * 5 + b.crit_damage * 1.8 + b.dodge_chance * 6)::int as power
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
