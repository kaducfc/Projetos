-- Arena PvP (assíncrona) — schema inicial.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- (https://supabase.com/dashboard/project/_/sql) e rode. Rode uma vez só —
-- rodar de novo é seguro (tudo usa "if not exists"/"or replace"), mas não
-- há necessidade.
--
-- Depois de rodar isso, vá em Authentication > Providers e confirme que
-- "Anonymous Sign-Ins" está habilitado (o jogo usa login anônimo — sem
-- e-mail/senha — pra não ter fricção nenhuma de cadastro).

-- ---------------------------------------------------------------
-- pvp_profiles: 1 linha por conta (auth.users), nick/ícone (espelham o
-- Perfil do jogo, ver js/systems/profile.js) + rating de ranking (estilo
-- Elo, começa em 1000) + cooldown de ataque.
-- ---------------------------------------------------------------
create table if not exists public.pvp_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nick text not null default 'Caçador',
  icon_id text not null default 'hunter',
  hunter_level integer not null default 1,
  rating integer not null default 1000,
  last_attack_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- pvp_snapshots: última cópia conhecida das stats de combate de cada
-- jogador (ver computePlayerStats() em js/systems/stats.js) — é contra
-- ISSO, salvo no servidor, que todo ataque é resolvido. O cliente nunca
-- manda "minhas stats são X" na hora de atacar; ele só manda "ataca o
-- jogador Y", e o servidor lê o snapshot mais recente de Y (ver a Edge
-- Function resolve-pvp-battle).
-- ---------------------------------------------------------------
create table if not exists public.pvp_snapshots (
  profile_id uuid primary key references public.pvp_profiles(id) on delete cascade,
  dps numeric not null default 0,
  max_hp numeric not null default 1,
  armor numeric not null default 0,
  crit_chance numeric not null default 0,
  crit_damage numeric not null default 0,
  dodge_chance numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- pvp_matches: histórico — só a Edge Function escreve aqui (ver policies
-- abaixo, sem policy de insert pra usuário comum).
-- ---------------------------------------------------------------
create table if not exists public.pvp_matches (
  id bigint generated always as identity primary key,
  attacker_id uuid not null references public.pvp_profiles(id) on delete cascade,
  defender_id uuid not null references public.pvp_profiles(id) on delete cascade,
  winner_id uuid not null references public.pvp_profiles(id) on delete cascade,
  attacker_rating_before integer not null,
  defender_rating_before integer not null,
  attacker_rating_after integer not null,
  defender_rating_after integer not null,
  gold_reward integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pvp_matches_attacker_idx on public.pvp_matches (attacker_id, created_at desc);
create index if not exists pvp_matches_defender_idx on public.pvp_matches (defender_id, created_at desc);
create index if not exists pvp_profiles_rating_idx on public.pvp_profiles (rating desc);

-- ---------------------------------------------------------------
-- RLS: todo mundo autenticado (inclusive anônimo) pode LER perfis/
-- snapshots (precisa pra montar a lista de oponentes/ranking), mas só
-- escreve a PRÓPRIA linha. pvp_matches só lê as próprias lutas (como
-- atacante ou defensor) e NINGUÉM tem policy de insert/update — isso é de
-- propósito: só a Edge Function grava resultado de luta, usando a
-- service_role key (que ignora RLS). Sem isso, um cliente malicioso
-- poderia inserir uma "vitória" direto no banco sem passar pela simulação.
-- ---------------------------------------------------------------
alter table public.pvp_profiles enable row level security;
alter table public.pvp_snapshots enable row level security;
alter table public.pvp_matches enable row level security;

drop policy if exists "profiles are publicly readable" on public.pvp_profiles;
create policy "profiles are publicly readable" on public.pvp_profiles
  for select to authenticated using (true);

drop policy if exists "users manage their own profile" on public.pvp_profiles;
create policy "users manage their own profile" on public.pvp_profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "users update their own profile" on public.pvp_profiles;
create policy "users update their own profile" on public.pvp_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "snapshots are publicly readable" on public.pvp_snapshots;
create policy "snapshots are publicly readable" on public.pvp_snapshots
  for select to authenticated using (true);

drop policy if exists "users manage their own snapshot" on public.pvp_snapshots;
create policy "users manage their own snapshot" on public.pvp_snapshots
  for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists "users update their own snapshot" on public.pvp_snapshots;
create policy "users update their own snapshot" on public.pvp_snapshots
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "users read their own matches" on public.pvp_matches;
create policy "users read their own matches" on public.pvp_matches
  for select to authenticated using (attacker_id = auth.uid() or defender_id = auth.uid());
-- Sem policy de insert/update/delete pra "authenticated" — só a
-- service_role (usada pela Edge Function) consegue escrever aqui.
