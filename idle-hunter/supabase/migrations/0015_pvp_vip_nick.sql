-- Nick colorido (efeito "arco-íris") pra jogadores VIP — pedido do
-- usuário, aplicado em toda tela que mostra nick de outro jogador (board
-- da Arena, janela de Combate, resultado de luta, página Ranks). O
-- próprio jogador (Perfil) não precisa de nada do servidor, já sabe
-- localmente se está VIP (ver isVipActive em js/state.js).
--
-- Mesmo modelo de confiança que hunter_level/transcend_count/wins já
-- tinham (ver 0001/0008_pvp_ranks.sql): o cliente se auto-reporta como
-- VIP ao sincronizar o perfil (ver syncProfile em js/systems/pvp.js) — é
-- só cosmético (cor do nick), não afeta pontuação/loot de ninguém, não
-- vale a pena um caminho de verificação server-side pra isso.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel
-- Supabase (https://supabase.com/dashboard/project/_/sql) e rode uma vez.
-- Seguro rodar de novo.

alter table public.pvp_profiles
  add column if not exists is_vip boolean not null default false;

-- pvp_profiles só deixa "authenticated" atualizar uma lista específica de
-- colunas (ver 0002/0008_pvp_ranks.sql) — sem is_vip nessa lista, o
-- upsert inteiro em syncProfile (ver js/systems/pvp.js) falhava calado
-- (erro só no console do navegador, nada visível no jogo), e nem os
-- OUTROS campos (nick/hunter_level/etc) chegavam a atualizar.
grant update (id, nick, icon_id, hunter_level, transcend_count, is_vip, updated_at)
  on public.pvp_profiles to authenticated;

-- ---------------------------------------------------------------
-- pvp_tier_board: + is_vip (bot nunca é VIP, sempre false).
-- ---------------------------------------------------------------
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
  is_vip boolean
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
    select id as entity_id, false as is_bot, nick, icon_id, hunter_level, rating, wins, is_vip
    from public.pvp_profiles
    where tier = target_tier
      and (target_tier = 'lendario' or group_index = target_group)
    union all
    select id as entity_id, true as is_bot, nick, 'hunter' as icon_id, 0 as hunter_level, rating, 0 as wins, false as is_vip
    from public.pvp_bots
    where tier = target_tier
      and slot_index <= (select show_count from bots_to_show)
  ),
  numbered as (
    select entity_id, is_bot, nick, icon_id, hunter_level, rating, wins, is_vip,
           row_number() over (order by rating desc, entity_id asc)::int as "position",
           case when not is_bot
             then row_number() over (partition by is_bot order by rating desc, entity_id asc)
           end::int as real_rank
    from combined
  )
  select entity_id, is_bot, nick, icon_id, hunter_level, rating, wins, "position",
         real_rank, (select n from player_count) as real_player_count, is_vip
  from numbered
  order by "position";
$$;

grant execute on function public.pvp_tier_board(text, integer) to authenticated;

-- ---------------------------------------------------------------
-- pvp_rank_arena: + is_vip.
-- ---------------------------------------------------------------
drop function if exists public.pvp_rank_arena(uuid);

create or replace function public.pvp_rank_arena(viewer_id uuid)
returns table (
  entity_id uuid,
  nick text,
  icon_id text,
  tier text,
  hunter_level integer,
  rating integer,
  wins integer,
  tier_position integer,
  tier_player_count integer,
  "position" integer,
  is_vip boolean
)
language sql
stable
as $$
  with tier_ranked as (
    select p.id,
           row_number() over (partition by p.tier order by p.rating desc, p.id asc)::int as tier_position,
           count(*) over (partition by p.tier)::int as tier_player_count
    from public.pvp_profiles p
  ),
  ranked as (
    select
      p.id as entity_id, p.nick, p.icon_id, p.tier, p.hunter_level,
      case when t.hidden_score then null else p.rating end as rating,
      p.wins,
      tr.tier_position, tr.tier_player_count,
      row_number() over (order by t.order_index desc, p.rating desc, p.id asc)::int as "position",
      p.is_vip
    from public.pvp_profiles p
    join public.pvp_tiers t on t.name = p.tier
    join tier_ranked tr on tr.id = p.id
  )
  select * from ranked where "position" <= 100 or entity_id = viewer_id
  order by "position";
$$;

grant execute on function public.pvp_rank_arena(uuid) to authenticated;

-- ---------------------------------------------------------------
-- pvp_rank_level: + is_vip.
-- ---------------------------------------------------------------
drop function if exists public.pvp_rank_level(uuid);

create or replace function public.pvp_rank_level(viewer_id uuid)
returns table (
  entity_id uuid,
  nick text,
  icon_id text,
  hunter_level integer,
  "position" integer,
  is_vip boolean
)
language sql
stable
as $$
  with ranked as (
    select id as entity_id, nick, icon_id, hunter_level,
           row_number() over (order by hunter_level desc, id asc)::int as "position",
           is_vip
    from public.pvp_profiles
  )
  select * from ranked where "position" <= 100 or entity_id = viewer_id
  order by "position";
$$;

grant execute on function public.pvp_rank_level(uuid) to authenticated;

-- ---------------------------------------------------------------
-- pvp_rank_transcend: + is_vip.
-- ---------------------------------------------------------------
drop function if exists public.pvp_rank_transcend(uuid);

create or replace function public.pvp_rank_transcend(viewer_id uuid)
returns table (
  entity_id uuid,
  nick text,
  icon_id text,
  transcend_count integer,
  "position" integer,
  is_vip boolean
)
language sql
stable
as $$
  with ranked as (
    select id as entity_id, nick, icon_id, transcend_count,
           row_number() over (order by transcend_count desc, id asc)::int as "position",
           is_vip
    from public.pvp_profiles
  )
  select * from ranked where "position" <= 100 or entity_id = viewer_id
  order by "position";
$$;

grant execute on function public.pvp_rank_transcend(uuid) to authenticated;
