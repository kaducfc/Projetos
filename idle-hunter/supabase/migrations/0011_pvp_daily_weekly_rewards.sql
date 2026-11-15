-- Recompensas automáticas da Arena — diária (por grupo, ver
-- 0007_pvp_groups.sql) e semanal (por tier inteiro, junto do reset de
-- promoção/rebaixamento). Chegam pro jogador como mensagens no Correio
-- (ver 0010_pvp_mailbox.sql). Também estende pvp_tier_board e
-- pvp_rank_arena com os dados que o cliente precisa pra PRÉ-VISUALIZAR a
-- recompensa de cada linha antes do reset (posição real entre jogadores
-- de verdade, sem contar bots — ver real_rank/tier_position abaixo).
--
-- Curvas de recompensa — derivadas dos números EXATOS que o usuário deu
-- como âncora (marcados abaixo), interpolando o resto de forma suave
-- (mesmo espírito de "decisão minha, documentada" das outras calibrações
-- deste projeto — fácil de re-tunar com um UPDATE nos VALUES abaixo):
--
-- DIÁRIA (por grupo — metade de cima recebe, exceto Lendário que é geral):
--   Bronze pior-da-metade=10, melhor=20 (10 = ÂNCORA do usuário)
--   Prata 14 / 28, Ouro 20 / 40, Platina 28 / 56
--   Diamante melhor=80 (ÂNCORA do usuário), pior-da-metade=40
--   Lendário: TODOS recebem, melhor=100 / pior=70 (AMBAS âncoras do usuário)
--   (cada tier usa a MESMA quantidade pra fragmento de carta E de
--   mascote — "80 fragmentos de CADA", pedido do usuário)
--
-- SEMANAL (tier inteiro, metade de cima em TODOS os tiers, inclusive
-- Lendário — pedido explícito do usuário):
--   Bronze/Prata/Ouro: fragmento de carta + ovos
--     Bronze pior-da-metade=50 frag (ÂNCORA) / melhor=100 frag
--     Ouro melhor=300 frag (ÂNCORA) / pior-da-metade=150 frag
--     Prata fica no meio (174 / 87)
--   Platina/Diamante/Lendário: 1 carta aleatória (fixo) + ovos
--     Lendário melhor=400 ovos / pior-da-metade=200 ovos (AMBAS âncoras)
--   Ovos em TODOS os tiers, escala Bronze(30/60) → Lendário(200/400),
--   Ouro bate exatamente nos 170 ovos que o usuário deu como âncora pro
--   melhor do Ouro.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo.

-- ---------------------------------------------------------------
-- pvp_tier_board: + real_rank (posição só entre jogadores de verdade,
-- null pra bot) e real_player_count (quantos jogadores de verdade tem
-- nesse grupo) — o cliente usa isso pra saber se uma linha está na
-- metade de cima do grupo (pré-visualização da recompensa diária, ver
-- js/systems/pvp.js previewDailyArenaReward). "position" continua igual
-- de antes (com bots misturados, é o que decide a ordem visual da
-- lista).
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
  real_player_count integer
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
    select id as entity_id, false as is_bot, nick, icon_id, hunter_level, rating, wins
    from public.pvp_profiles
    where tier = target_tier
      and (target_tier = 'lendario' or group_index = target_group)
    union all
    select id as entity_id, true as is_bot, nick, 'hunter' as icon_id, 0 as hunter_level, rating, 0 as wins
    from public.pvp_bots
    where tier = target_tier
      and slot_index <= (select show_count from bots_to_show)
  ),
  numbered as (
    select entity_id, is_bot, nick, icon_id, hunter_level, rating, wins,
           row_number() over (order by rating desc, entity_id asc)::int as "position",
           case when not is_bot
             then row_number() over (partition by is_bot order by rating desc, entity_id asc)
           end::int as real_rank
    from combined
  )
  select entity_id, is_bot, nick, icon_id, hunter_level, rating, wins, "position",
         real_rank, (select n from player_count) as real_player_count
  from numbered
  order by "position";
$$;

grant execute on function public.pvp_tier_board(text, integer) to authenticated;

-- ---------------------------------------------------------------
-- pvp_rank_arena: + tier_position/tier_player_count (posição do jogador
-- DENTRO do próprio tier inteiro, ignorando grupos — é essa posição, não
-- a global cross-tier, que decide a recompensa SEMANAL de cada um, ver
-- run_weekly_pvp_reset abaixo e previewWeeklyArenaReward no cliente).
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
  "position" integer
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
      p.id as entity_id, p.nick, p.icon_id, p.tier, p.hunter_level, p.wins,
      case when t.hidden_score then null else p.rating end as rating,
      tr.tier_position, tr.tier_player_count,
      row_number() over (order by t.order_index desc, p.rating desc, p.id asc)::int as "position"
    from public.pvp_profiles p
    join public.pvp_tiers t on t.name = p.tier
    join tier_ranked tr on tr.id = p.id
  )
  select * from ranked where "position" <= 100 or entity_id = viewer_id
  order by "position";
$$;

grant execute on function public.pvp_rank_arena(uuid) to authenticated;

-- ---------------------------------------------------------------
-- run_daily_pvp_rewards(): recompensa diária — Bronze..Diamante por
-- GRUPO (metade de cima), Lendário geral (todo mundo, sem corte).
-- ---------------------------------------------------------------
create or replace function public.run_daily_pvp_rewards()
returns void
language plpgsql
as $$
declare
  reward_row record;
  amount integer;
begin
  for reward_row in
    with tier_rewards (tier, best_amount, worst_amount) as (
      values
        ('bronze', 20, 10),
        ('prata', 28, 14),
        ('ouro', 40, 20),
        ('platina', 56, 28),
        ('diamante', 80, 40)
    ),
    ranked as (
      select p.id, p.tier,
             row_number() over (partition by p.tier, p.group_index order by p.rating desc, p.id asc) as pos,
             count(*) over (partition by p.tier, p.group_index) as n
      from public.pvp_profiles p
      where p.tier <> 'lendario'
    )
    select r.id, tr.best_amount, tr.worst_amount, r.pos,
           greatest(1, ceil(r.n / 2.0)::int) as cutoff
    from ranked r
    join tier_rewards tr on tr.tier = r.tier
    where r.pos <= greatest(1, ceil(r.n / 2.0)::int)
  loop
    amount := case
      when reward_row.cutoff <= 1 then reward_row.best_amount
      else round(
        reward_row.best_amount - (reward_row.best_amount - reward_row.worst_amount)
          * (reward_row.pos - 1)::numeric / (reward_row.cutoff - 1)
      )
    end;
    insert into public.pvp_mailbox (profile_id, title, body, reward_type, reward_amount, reward2_type, reward2_amount)
    values (
      reward_row.id, '🏟️ Recompensa Diária da Arena',
      'Você terminou entre os melhores do seu grupo na Arena hoje!',
      'card_fragment', amount, 'pet_fragment', amount
    );
  end loop;

  for reward_row in
    select p.id,
           row_number() over (order by p.rating desc, p.id asc) as pos,
           count(*) over () as n
    from public.pvp_profiles p
    where p.tier = 'lendario'
  loop
    amount := case
      when reward_row.n <= 1 then 100
      else round(100 - (100 - 70) * (reward_row.pos - 1)::numeric / (reward_row.n - 1))
    end;
    insert into public.pvp_mailbox (profile_id, title, body, reward_type, reward_amount, reward2_type, reward2_amount)
    values (
      reward_row.id, '🏟️ Recompensa Diária da Arena',
      'Recompensa diária de quem está no Lendário!',
      'card_fragment', amount, 'pet_fragment', amount
    );
  end loop;
end;
$$;

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pvp-daily-arena-rewards') then
    perform cron.unschedule('pvp-daily-arena-rewards');
  end if;
end $$;

-- Todo dia 00:00 UTC = 21h de Brasília (sem horário de verão desde 2019),
-- mesma conta de sempre (ver 0002_pvp_tiers.sql sobre o cron semanal).
select cron.schedule(
  'pvp-daily-arena-rewards',
  '0 0 * * *',
  $$select public.run_daily_pvp_rewards();$$
);

-- ---------------------------------------------------------------
-- run_weekly_pvp_reset(): mesma lógica de 0007_pvp_groups.sql, só que
-- agora manda as recompensas SEMANAIS (metade de cima de CADA tier,
-- Lendário incluso) pro Correio ANTES de zerar tier/rating — precisa ser
-- calculado em cima do standing de ANTES do reset, senão todo mundo já
-- estaria com a pontuação base zerada.
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
  reward_row record;
  frag_amount integer;
  egg_amount integer;
begin
  -- Recompensas semanais — precisa vir ANTES de qualquer UPDATE em
  -- pvp_profiles nessa função (lê tier/rating de ANTES do reset).
  for reward_row in
    with tier_rewards (tier, kind, best1, worst1, best_eggs, worst_eggs) as (
      values
        ('bronze', 'card_fragment', 100, 50, 60, 30),
        ('prata', 'card_fragment', 174, 87, 100, 50),
        ('ouro', 'card_fragment', 300, 150, 170, 85),
        ('platina', 'random_card', 1, 1, 226, 113),
        ('diamante', 'random_card', 1, 1, 302, 151),
        ('lendario', 'random_card', 1, 1, 400, 200)
    ),
    ranked as (
      select p.id, p.tier,
             row_number() over (partition by p.tier order by p.rating desc, p.id asc) as pos,
             count(*) over (partition by p.tier) as n
      from public.pvp_profiles p
    )
    select r.id, tr.kind, tr.best1, tr.worst1, tr.best_eggs, tr.worst_eggs, r.pos,
           greatest(1, ceil(r.n / 2.0)::int) as cutoff
    from ranked r
    join tier_rewards tr on tr.tier = r.tier
    where r.pos <= greatest(1, ceil(r.n / 2.0)::int)
  loop
    if reward_row.cutoff <= 1 then
      frag_amount := reward_row.best1;
      egg_amount := reward_row.best_eggs;
    else
      frag_amount := round(
        reward_row.best1 - (reward_row.best1 - reward_row.worst1)
          * (reward_row.pos - 1)::numeric / (reward_row.cutoff - 1)
      );
      egg_amount := round(
        reward_row.best_eggs - (reward_row.best_eggs - reward_row.worst_eggs)
          * (reward_row.pos - 1)::numeric / (reward_row.cutoff - 1)
      );
    end if;
    insert into public.pvp_mailbox (profile_id, title, body, reward_type, reward_amount, reward2_type, reward2_amount)
    values (
      reward_row.id, '🏆 Recompensa Semanal da Arena',
      'Você ficou entre os melhores do seu tier essa semana!',
      reward_row.kind, frag_amount, 'egg', egg_amount
    );
  end loop;

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

  for mover in
    select id, new_tier from _pvp_reset_plan where new_tier <> old_tier
  loop
    update public.pvp_profiles
    set group_index = public.assign_pvp_group(mover.new_tier)
    where id = mover.id;
  end loop;
end;
$$;
