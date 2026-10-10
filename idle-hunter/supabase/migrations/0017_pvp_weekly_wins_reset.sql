-- O contador de vitórias da Arena (mostrado na aba Arena e na página
-- Ranks, ver WINS_ICON em js/ui/render.js) até agora só zerava quando o
-- jogador Transcendia — não zerava no reset semanal (junto da mudança/
-- permanência de Tier), diferente do rating. Pedido do usuário: zerar
-- `wins` toda semana, junto do resto do reset.
--
-- Só redefine run_weekly_pvp_reset() (ver 0011_pvp_daily_weekly_rewards.sql
-- pra função original) acrescentando "wins = 0" no mesmo UPDATE que já
-- zera o rating — nada mais muda (promoção/rebaixamento de tier,
-- recompensas semanais, cron continuam iguais).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- (https://supabase.com/dashboard/project/_/sql) e rode uma vez. Seguro
-- rodar de novo.

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
      -- Único acréscimo desta migração — zera as vitórias junto do rating,
      -- toda semana, independente do jogador ter subido, descido ou
      -- ficado no mesmo Tier.
      wins = 0,
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
