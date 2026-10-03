-- Arena PvP — Tiers/Rank, Bots, sistema de Entradas, reset semanal.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode DEPOIS de já ter rodado 0001_pvp_arena.sql. Se a extensão pg_cron
-- der erro de permissão no fim do arquivo, veja o aviso perto do
-- `create extension pg_cron` mais abaixo.

-- ---------------------------------------------------------------
-- pvp_tiers: os 6 tiers em ordem, com a pontuação BASE de cada um (o
-- jogador recomeça nela toda vez que o tier muda no reset semanal — ver
-- run_weekly_pvp_reset mais abaixo). hidden_score = true só pro Lendário:
-- o cliente nunca mostra o rating cru desse tier, só a posição (ver
-- pvp_tier_board abaixo e o campo "position" que ele já calcula).
-- ---------------------------------------------------------------
create table if not exists public.pvp_tiers (
  name text primary key,
  order_index integer not null unique,
  base_points integer not null,
  hidden_score boolean not null default false
);

insert into public.pvp_tiers (name, order_index, base_points, hidden_score) values
  ('bronze', 1, 1000, false),
  ('prata', 2, 1200, false),
  ('ouro', 3, 1400, false),
  ('platina', 4, 1600, false),
  ('diamante', 5, 1800, false),
  ('lendario', 6, 2000, true)
on conflict (name) do update set
  order_index = excluded.order_index,
  base_points = excluded.base_points,
  hidden_score = excluded.hidden_score;

-- ---------------------------------------------------------------
-- pvp_profiles: novos campos —
-- tier: em qual dos 6 tiers o jogador está agora (rating dele é
--   "pontos dentro desse tier", pode passar da próxima faixa livremente
--   durante a semana; só é usado pra decidir promoção/rebaixamento no
--   reset de sábado, ver run_weekly_pvp_reset).
-- pvp_entries / pvp_entries_updated_at: sistema de energia — até 5
--   entradas guardadas, +1 a cada 1h (ver a lógica de regeneração na Edge
--   Function resolve-pvp-battle, que é quem de fato consome/recarrega).
-- ---------------------------------------------------------------
alter table public.pvp_profiles
  add column if not exists tier text not null default 'bronze' references public.pvp_tiers(name),
  add column if not exists pvp_entries integer not null default 5,
  add column if not exists pvp_entries_updated_at timestamptz not null default now();

alter table public.pvp_profiles
  drop constraint if exists pvp_profiles_entries_range;
alter table public.pvp_profiles
  add constraint pvp_profiles_entries_range check (pvp_entries between 0 and 5);

-- ---------------------------------------------------------------
-- SEGURANÇA: a policy de update de 0001 deixava o cliente reescrever a
-- linha INTEIRA dele mesmo — incluindo `rating`/`pvp_entries`, que
-- deveriam ser só o servidor (a Edge Function) a mexer. Column-level
-- privilege: revoga o update geral e libera só as colunas "cosméticas"
-- (as mesmas que js/systems/pvp.js syncProfile já manda: nick/ícone/
-- nível). rating/tier/pvp_entries/last_attack_at agora só mudam via
-- service_role (usada pela Edge Function, que ignora esses grants).
-- ---------------------------------------------------------------
revoke update on public.pvp_profiles from authenticated;
grant update (nick, icon_id, hunter_level, updated_at) on public.pvp_profiles to authenticated;

-- ---------------------------------------------------------------
-- pvp_bots: 5 "jogadores" fake por tier, só pra nenhum tier começar
-- vazio (ver pvp_tier_board abaixo pra como eles somem conforme jogador
-- de verdade entra). Nunca mudam de rating sozinhos (sem stats reais por
-- trás, sem inventário/mascote — ver comentário do usuário: "relativamente
-- fracos", números abaixo são um primeiro chute, fácil de re-tunar depois
-- com um UPDATE simples). slot_index (1..5) decide a ORDEM em que somem: o
-- de slot_index mais alto é o 1º a sumir quando um jogador de verdade
-- entra no tier.
-- ---------------------------------------------------------------
create table if not exists public.pvp_bots (
  id uuid primary key default gen_random_uuid(),
  tier text not null references public.pvp_tiers(name),
  slot_index integer not null check (slot_index between 1 and 5),
  nick text not null,
  rating integer not null,
  dps numeric not null,
  max_hp numeric not null,
  armor numeric not null,
  crit_chance numeric not null,
  crit_damage numeric not null,
  dodge_chance numeric not null,
  unique (tier, slot_index)
);

alter table public.pvp_bots enable row level security;
drop policy if exists "bots are publicly readable" on public.pvp_bots;
create policy "bots are publicly readable" on public.pvp_bots
  for select to authenticated using (true);
-- Sem policy de insert/update/delete pra "authenticated" — bots só mudam
-- via SQL Editor (você) ou uma migration futura.

-- Apaga e recria os 30 bots (5 × 6 tiers) toda vez que esse arquivo roda —
-- seguro rodar de novo, não duplica.
delete from public.pvp_bots;

-- rating: TODOS os bots de um tier começam com a MESMA pontuação-base do
-- tier (igual jogador de verdade — ver pvp_tiers.base_points), pedido
-- explícito do usuário. Isso NÃO afeta a força de combate deles (dps/
-- max_hp/etc. continuam variando entre os 5, pra dar uma progressão de
-- dificuldade) — só a pontuação/posição no ranking. Como o rating empata
-- entre os 5, row_number() em pvp_tier_board desempata por entity_id (o
-- uuid do bot), ordem arbitrária mas estável.
insert into public.pvp_bots (tier, slot_index, nick, rating, dps, max_hp, armor, crit_chance, crit_damage, dodge_chance) values
  -- Bronze — "Tier 1", máximo Incomum
  ('bronze', 1, 'Caçador Iniciante', 1000, 40,  250,  15, 5, 50, 0),
  ('bronze', 2, 'Caçador Iniciante', 1000, 55,  320,  20, 5, 50, 0),
  ('bronze', 3, 'Caçador Iniciante', 1000, 70,  400,  25, 6, 55, 1),
  ('bronze', 4, 'Caçador Iniciante', 1000, 90,  480,  30, 6, 55, 1),
  ('bronze', 5, 'Caçador Iniciante', 1000, 110, 560,  35, 7, 60, 2),
  -- Prata — "Tier 2", máximo Incomum
  ('prata', 1, 'Caçador Patrulheiro', 1200, 150, 800,  50, 7, 60, 2),
  ('prata', 2, 'Caçador Patrulheiro', 1200, 180, 950,  60, 7, 60, 2),
  ('prata', 3, 'Caçador Patrulheiro', 1200, 220, 1100, 70, 8, 65, 3),
  ('prata', 4, 'Caçador Patrulheiro', 1200, 260, 1300, 80, 8, 65, 3),
  ('prata', 5, 'Caçador Patrulheiro', 1200, 310, 1500, 95, 9, 70, 3),
  -- Ouro — "Tier 3", máximo Raro
  ('ouro', 1, 'Caçador Avançado', 1400, 400,  2000, 120, 10, 75, 4),
  ('ouro', 2, 'Caçador Avançado', 1400, 470,  2400, 140, 10, 75, 4),
  ('ouro', 3, 'Caçador Avançado', 1400, 550,  2800, 160, 11, 80, 4),
  ('ouro', 4, 'Caçador Avançado', 1400, 640,  3300, 185, 11, 80, 5),
  ('ouro', 5, 'Caçador Avançado', 1400, 740,  3800, 210, 12, 85, 5),
  -- Platina — "Tier 4", máximo Raro
  ('platina', 1, 'Caçador Elite', 1600, 1000, 5000,  250, 13, 90, 6),
  ('platina', 2, 'Caçador Elite', 1600, 1150, 5800,  280, 13, 90, 6),
  ('platina', 3, 'Caçador Elite', 1600, 1320, 6700,  320, 14, 95, 6),
  ('platina', 4, 'Caçador Elite', 1600, 1500, 7700,  360, 14, 95, 7),
  ('platina', 5, 'Caçador Elite', 1600, 1700, 8800,  400, 15, 100, 7),
  -- Diamante — "Tier 5", máximo Épico
  ('diamante', 1, 'Caçador Chefe', 1800, 2500, 12000, 450, 16, 110, 8),
  ('diamante', 2, 'Caçador Chefe', 1800, 2850, 13500, 500, 16, 110, 8),
  ('diamante', 3, 'Caçador Chefe', 1800, 3250, 15200, 560, 17, 115, 8),
  ('diamante', 4, 'Caçador Chefe', 1800, 3700, 17100, 620, 17, 115, 9),
  ('diamante', 5, 'Caçador Chefe', 1800, 4200, 19200, 690, 18, 120, 9),
  -- Lendário — máximo Lendário
  ('lendario', 1, 'Caçador Deus', 2000, 6000,  28000, 700, 20, 140, 10),
  ('lendario', 2, 'Caçador Deus', 2000, 6800,  31500, 770, 20, 140, 10),
  ('lendario', 3, 'Caçador Deus', 2000, 7700,  35300, 850, 21, 145, 10),
  ('lendario', 4, 'Caçador Deus', 2000, 8700,  39500, 930, 21, 145, 11),
  ('lendario', 5, 'Caçador Deus', 2000, 9800,  44000, 1020, 22, 150, 11);

-- ---------------------------------------------------------------
-- pvp_matches: agora um ataque pode ser contra um bot, não só contra
-- outro jogador — defender_id vira opcional, defender_bot_id é o novo
-- campo pro caso de bot. winner_id perde a FK (não dá pra referenciar 2
-- tabelas diferentes numa FK só) e passa a poder guardar tanto um id de
-- pvp_profiles quanto de pvp_bots — quem lê essa tabela decide qual é
-- qual olhando defender_is_bot.
-- ---------------------------------------------------------------
alter table public.pvp_matches
  alter column defender_id drop not null;
alter table public.pvp_matches
  add column if not exists defender_is_bot boolean not null default false,
  add column if not exists defender_bot_id uuid references public.pvp_bots(id);
alter table public.pvp_matches
  drop constraint if exists pvp_matches_winner_id_fkey;
alter table public.pvp_matches
  drop constraint if exists pvp_matches_defender_xor;
alter table public.pvp_matches
  add constraint pvp_matches_defender_xor check (
    (defender_is_bot = false and defender_id is not null and defender_bot_id is null)
    or
    (defender_is_bot = true  and defender_bot_id is not null and defender_id is null)
  );

-- ---------------------------------------------------------------
-- pvp_tier_board(tier): a "prancheta" de 1 tier — todo jogador de
-- verdade daquele tier + os bots ainda visíveis (ver a fórmula
-- "6 - jogadores, entre 0 e 5" abaixo, exatamente como descrito: 1
-- jogador → 5 bots, 2 → 4 bots, 3 → 3 bots... até sumir todo mundo),
-- tudo ordenado por rating e já numerado (position = 1 é o topo do tier).
-- Usada tanto pelo cliente (pra montar a lista "seu tier") quanto pela
-- Edge Function (pra saber a posição dos 2 lutadores e calcular o
-- ganho/perda de pontos, ver resolve-pvp-battle).
-- ---------------------------------------------------------------
create or replace function public.pvp_tier_board(target_tier text)
returns table (
  entity_id uuid,
  is_bot boolean,
  nick text,
  icon_id text,
  hunter_level integer,
  rating integer,
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
    select id as entity_id, false as is_bot, nick, icon_id, hunter_level, rating
    from public.pvp_profiles
    where tier = target_tier
    union all
    select id as entity_id, true as is_bot, nick, 'hunter' as icon_id, 0 as hunter_level, rating
    from public.pvp_bots
    where tier = target_tier
      and slot_index <= (select show_count from bots_to_show)
  )
  select entity_id, is_bot, nick, icon_id, hunter_level, rating,
         row_number() over (order by rating desc, entity_id asc)::int as "position"
  from combined
  order by "position";
$$;

grant execute on function public.pvp_tier_board(text) to authenticated;

-- ---------------------------------------------------------------
-- run_weekly_pvp_reset(): a atualização de sábado. Pra cada tier (bots
-- nunca entram nessa conta, só pvp_profiles):
--   < 10 jogadores  → os 3 primeiros (ou todos, se tiver menos de 3) sobem
--                      1 tier; ninguém desce.
--   >= 10 jogadores → os 20% de cima sobem 1 tier, os 20% de baixo descem
--                      1 tier (arredondado pra baixo).
-- Bronze não desce mais (não tem tier abaixo) e Lendário não sobe mais
-- (não tem tier acima) — quem "promoveria"/"rebaixaria" pra fora dos 6
-- tiers simplesmente fica onde está.
-- TODO mundo (subiu, ficou ou desceu) recomeça a semana com a pontuação
-- BASE do tier em que ficou (pvp_tiers.base_points) — exatamente como
-- pedido: quem termina com 1500 no Bronze e sobe pro Prata começa a
-- semana seguinte com 1200 (base do Prata), não com 1500.
-- ---------------------------------------------------------------
create or replace function public.run_weekly_pvp_reset()
returns void
language plpgsql
as $$
declare
  tier_row record;
  n integer;
  promote_n integer;
  relegate_n integer;
begin
  create temporary table if not exists _pvp_reset_plan (id uuid primary key, new_tier text) on commit drop;
  delete from _pvp_reset_plan;

  for tier_row in select name, order_index from public.pvp_tiers order by order_index loop
    select count(*) into n from public.pvp_profiles where tier = tier_row.name;
    if n = 0 then
      continue;
    end if;

    if n < 10 then
      promote_n := least(3, n);
      relegate_n := 0;
    else
      promote_n := floor(n * 0.2)::int;
      relegate_n := floor(n * 0.2)::int;
    end if;

    if promote_n > 0 then
      insert into _pvp_reset_plan (id, new_tier)
      select p.id, coalesce(
        (select name from public.pvp_tiers where order_index = tier_row.order_index + 1),
        tier_row.name
      )
      from (
        select id from public.pvp_profiles
        where tier = tier_row.name
        order by rating desc, id asc
        limit promote_n
      ) p
      on conflict (id) do nothing;
    end if;

    if relegate_n > 0 then
      insert into _pvp_reset_plan (id, new_tier)
      select p.id, coalesce(
        (select name from public.pvp_tiers where order_index = tier_row.order_index - 1),
        tier_row.name
      )
      from (
        select id from public.pvp_profiles
        where tier = tier_row.name
        order by rating asc, id asc
        limit relegate_n
      ) p
      on conflict (id) do nothing;
    end if;

    insert into _pvp_reset_plan (id, new_tier)
    select id, tier_row.name
    from public.pvp_profiles
    where tier = tier_row.name
    on conflict (id) do nothing;
  end loop;

  update public.pvp_profiles p
  set tier = plan.new_tier,
      rating = t.base_points,
      updated_at = now()
  from _pvp_reset_plan plan
  join public.pvp_tiers t on t.name = plan.new_tier
  where p.id = plan.id;
end;
$$;

-- ---------------------------------------------------------------
-- Agenda run_weekly_pvp_reset pra todo sábado 21h de Brasília. Brasília
-- não tem mais horário de verão (lei de 2019), então é sempre UTC-3 —
-- 21h de sábado em Brasília = 00h de domingo em UTC, por isso o cron
-- abaixo (que roda em UTC) está marcado "domingo 00:00".
--
-- IMPORTANTE: se a linha abaixo der erro tipo "permission denied to
-- create extension" ou "extension pg_cron is not available", vá em
-- Database → Extensions no painel, procure "pg_cron" e clique em Enable
-- por lá — depois volte e rode só o bloco do cron.schedule daqui pra
-- baixo de novo.
-- ---------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pvp-weekly-tier-reset') then
    perform cron.unschedule('pvp-weekly-tier-reset');
  end if;
end $$;

select cron.schedule(
  'pvp-weekly-tier-reset',
  '0 0 * * 0',
  $$select public.run_weekly_pvp_reset();$$
);
