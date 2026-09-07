-- Arena PvP — grupos (shards) por tier, pra nenhum tier virar uma lista
-- infinita de jogadores. Pedido do usuário:
--   * Bronze até Diamante: no máximo 100 jogadores DE VERDADE por grupo.
--     O grupo 101 (jogador 101 a entrar naquele tier) abre um grupo novo,
--     que começa com os mesmos 5 bots de sempre, encolhendo do mesmo jeito
--     conforme jogadores de verdade entram (ver pvp_tier_board).
--   * Lendário: sem grupo nenhum, todo mundo do tier compete junto — o
--     tamanho não é limitado, só a permanência (ver run_weekly_pvp_reset
--     abaixo: só o top 200 continua no Lendário no reset semanal).
--   * O jogador NUNCA vê o número do grupo em lugar nenhum da UI — é só
--     um detalhe interno de particionamento (ver js/systems/pvp.js
--     fetchTierBoard, que manda group_index pra RPC mas não exibe nada
--     com ele).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo.

-- ---------------------------------------------------------------
-- group_index: em qual "sub-sala" do tier o jogador está. Sem sentido
-- pro Lendário (sempre grupo 1, mas ignorado nas queries — ver
-- pvp_tier_board), só é de fato usado do Bronze ao Diamante.
-- ---------------------------------------------------------------
alter table public.pvp_profiles
  add column if not exists group_index integer not null default 1;

-- Preenche o grupo de quem já tinha conta ANTES dessa migration — divide
-- em blocos de 100 por tier, ordenado por id (ordem arbitrária, mas
-- estável) já que não existe "ordem de entrada" registrada.
with ranked as (
  select id, row_number() over (partition by tier order by id) as rn
  from public.pvp_profiles
  where tier <> 'lendario'
)
update public.pvp_profiles p
set group_index = ceil(ranked.rn / 100.0)::int
from ranked
where p.id = ranked.id;

-- ---------------------------------------------------------------
-- assign_pvp_group: acha o primeiro grupo daquele tier com menos de 100
-- jogadores (ordem crescente — sempre tenta encher os grupos de baixo
-- pra cima antes de abrir um novo), ou abre um grupo novo se todos
-- estiverem cheios. pg_advisory_xact_lock serializa chamadas concorrentes
-- pro MESMO tier (2 jogadores novos entrando no bronze ao mesmo tempo não
-- podem contar as mesmas 99 vagas e achar que cabem os 2 no grupo 1).
-- ---------------------------------------------------------------
create or replace function public.assign_pvp_group(target_tier text)
returns integer
language plpgsql
as $$
declare
  chosen_group integer;
begin
  if target_tier = 'lendario' then
    return 1;
  end if;

  perform pg_advisory_xact_lock(hashtext('pvp_group_assign_' || target_tier));

  select group_index into chosen_group
  from public.pvp_profiles
  where tier = target_tier
  group by group_index
  having count(*) < 100
  order by group_index
  limit 1;

  if chosen_group is null then
    select coalesce(max(group_index), 0) + 1 into chosen_group
    from public.pvp_profiles
    where tier = target_tier;
  end if;

  return chosen_group;
end;
$$;

-- Toda vez que uma linha NOVA de pvp_profiles é criada (primeira conexão
-- de um jogador na Arena — ver js/systems/pvp.js syncProfile), o grupo é
-- decidido aqui no servidor, não pelo cliente (ele nem tem como escrever
-- essa coluna — ver GRANT de update, group_index não está na lista).
create or replace function public.pvp_profiles_assign_group()
returns trigger
language plpgsql
as $$
begin
  new.group_index := public.assign_pvp_group(new.tier);
  return new;
end;
$$;

drop trigger if exists trg_pvp_profiles_assign_group on public.pvp_profiles;
create trigger trg_pvp_profiles_assign_group
before insert on public.pvp_profiles
for each row execute function public.pvp_profiles_assign_group();

-- ---------------------------------------------------------------
-- pvp_tier_board: agora recebe também target_group — filtra jogadores
-- (e conta pra decidir quantos bots aparecem) só DENTRO desse grupo. Pro
-- Lendário, target_group é ignorado (sem grupo, pool inteiro do tier).
-- Precisa dropar a versão antiga (1 argumento) primeiro: mudou a
-- assinatura, "create or replace" sozinho não dá conta disso.
-- ---------------------------------------------------------------
drop function if exists public.pvp_tier_board(text);

create or replace function public.pvp_tier_board(target_tier text, target_group integer)
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
    select count(*)::int as n
    from public.pvp_profiles
    where tier = target_tier
      and (target_tier = 'lendario' or group_index = target_group)
  ),
  bots_to_show as (
    -- 0 jogadores → 5 bots; 1 → 5; 2 → 4; 3 → 3; 4 → 2; 5 → 1; 6+ → 0.
    select least(5, greatest(0, 6 - (select n from player_count))) as show_count
  ),
  combined as (
    select id as entity_id, false as is_bot, nick, icon_id, hunter_level, rating, wins
    from public.pvp_profiles
    where tier = target_tier
      and (target_tier = 'lendario' or group_index = target_group)
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

grant execute on function public.pvp_tier_board(text, integer) to authenticated;

-- ---------------------------------------------------------------
-- run_weekly_pvp_reset(): mesma lógica de antes (ver 0002_pvp_tiers.sql)
-- pra Bronze..Diamante, MAIS:
--   * Lendário tem uma regra especial pedida pelo usuário: em vez de
--     top/bottom 20%, só os 200 primeiros (por rating, mesma base de
--     posição de sempre) continuam no Lendário — todo o resto cai pro
--     Diamante, seja qual for a % que isso representa. Ninguém "sobe"
--     saindo do Lendário (não tem tier acima). Diamante continua
--     promovendo pro Lendário pela regra genérica de sempre (top 3 ou
--     top 20%) — são esses promovidos que enchem o Lendário de novo,
--     junto com quem ficou no top 200.
--   * Quem TROCA de tier essa semana (promovido, rebaixado, ou caiu do
--     Lendário) recebe um grupo novo no tier de destino (assign_pvp_group
--     de novo). Quem FICA no mesmo tier mantém o mesmo grupo de antes —
--     não reembaralha todo mundo à toa toda semana.
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
  mover record;
begin
  create temporary table if not exists _pvp_reset_plan (id uuid primary key, new_tier text, old_tier text) on commit drop;
  delete from _pvp_reset_plan;

  for tier_row in select name, order_index from public.pvp_tiers order by order_index loop
    select count(*) into n from public.pvp_profiles where tier = tier_row.name;
    if n = 0 then
      continue;
    end if;

    if tier_row.name = 'lendario' then
      promote_n := 0;
      relegate_n := greatest(0, n - 200);
    elsif n < 10 then
      promote_n := least(3, n);
      relegate_n := 0;
    else
      promote_n := floor(n * 0.2)::int;
      relegate_n := floor(n * 0.2)::int;
    end if;

    if promote_n > 0 then
      insert into _pvp_reset_plan (id, new_tier, old_tier)
      select p.id, coalesce(
        (select name from public.pvp_tiers where order_index = tier_row.order_index + 1),
        tier_row.name
      ), tier_row.name
      from (
        select id from public.pvp_profiles
        where tier = tier_row.name
        order by rating desc, id asc
        limit promote_n
      ) p
      on conflict (id) do nothing;
    end if;

    if relegate_n > 0 then
      insert into _pvp_reset_plan (id, new_tier, old_tier)
      select p.id, coalesce(
        (select name from public.pvp_tiers where order_index = tier_row.order_index - 1),
        tier_row.name
      ), tier_row.name
      from (
        select id from public.pvp_profiles
        where tier = tier_row.name
        order by rating asc, id asc
        limit relegate_n
      ) p
      on conflict (id) do nothing;
    end if;

    insert into _pvp_reset_plan (id, new_tier, old_tier)
    select id, tier_row.name, tier_row.name
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

  -- Loop (não um UPDATE só) de propósito: cada assign_pvp_group precisa
  -- enxergar as atribuições já feitas NESSA mesma rodada pra encher os
  -- grupos em ordem antes de abrir um novo — um loop plpgsql garante que
  -- cada chamada vê o efeito das anteriores dentro da mesma função.
  for mover in
    select id, new_tier from _pvp_reset_plan where new_tier <> old_tier
  loop
    update public.pvp_profiles
    set group_index = public.assign_pvp_group(mover.new_tier)
    where id = mover.id;
  end loop;
end;
$$;
