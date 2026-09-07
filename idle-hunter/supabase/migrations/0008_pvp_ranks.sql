-- Página "Ranks" (menu Outros) — 3 rankeamentos globais, cada um cruzando
-- TODOS os tiers/grupos da Arena PvP (pvp_profiles é a única fonte de
-- dados global do jogo, já que o resto do save é só local — todo jogador
-- é sincronizado automaticamente ao abrir o jogo, ver js/main.js init()):
--   * Arena: por tier (do Lendário pro Bronze) e, dentro do tier, por
--     rating — pontuação do Lendário continua oculta (mesma regra de
--     sempre, ver hidden_score em pvp_tiers).
--   * Nível de Caçador: por hunter_level.
--   * Transcender: por quantas vezes transcendeu (transcend_count, campo
--     NOVO — sincronizado do mesmo jeito "cosmético" que nick/ícone/nível
--     já eram, ver GRANT abaixo).
-- Cada rank devolve o TOP 100 +, se o jogador que está olhando não
-- estiver entre os 100, a própria linha dele extra no fim (com a posição
-- real, por mais distante que seja) — client passa o próprio id como
-- viewer_id.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e rode uma vez. Seguro rodar de novo.

alter table public.pvp_profiles
  add column if not exists transcend_count integer not null default 0;

grant update (id, nick, icon_id, hunter_level, transcend_count, updated_at)
  on public.pvp_profiles to authenticated;

create or replace function public.pvp_rank_arena(viewer_id uuid)
returns table (
  entity_id uuid,
  nick text,
  icon_id text,
  tier text,
  hunter_level integer,
  rating integer,
  "position" integer
)
language sql
stable
as $$
  with ranked as (
    select
      p.id as entity_id, p.nick, p.icon_id, p.tier, p.hunter_level,
      case when t.hidden_score then null else p.rating end as rating,
      row_number() over (order by t.order_index desc, p.rating desc, p.id asc)::int as "position"
    from public.pvp_profiles p
    join public.pvp_tiers t on t.name = p.tier
  )
  select * from ranked where "position" <= 100 or entity_id = viewer_id
  order by "position";
$$;

grant execute on function public.pvp_rank_arena(uuid) to authenticated;

create or replace function public.pvp_rank_level(viewer_id uuid)
returns table (
  entity_id uuid,
  nick text,
  icon_id text,
  hunter_level integer,
  "position" integer
)
language sql
stable
as $$
  with ranked as (
    select id as entity_id, nick, icon_id, hunter_level,
           row_number() over (order by hunter_level desc, id asc)::int as "position"
    from public.pvp_profiles
  )
  select * from ranked where "position" <= 100 or entity_id = viewer_id
  order by "position";
$$;

grant execute on function public.pvp_rank_level(uuid) to authenticated;

create or replace function public.pvp_rank_transcend(viewer_id uuid)
returns table (
  entity_id uuid,
  nick text,
  icon_id text,
  transcend_count integer,
  "position" integer
)
language sql
stable
as $$
  with ranked as (
    select id as entity_id, nick, icon_id, transcend_count,
           row_number() over (order by transcend_count desc, id asc)::int as "position"
    from public.pvp_profiles
  )
  select * from ranked where "position" <= 100 or entity_id = viewer_id
  order by "position";
$$;

grant execute on function public.pvp_rank_transcend(uuid) to authenticated;
