-- Contas do site de minigames: perfil, progresso salvo e histórico de
-- partidas de todos os jogos.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do painel Supabase
-- e clique em Run. Rodar de novo é seguro (usa "if not exists"/"or replace").
--
-- Usa o mesmo projeto do Idle Hunter, mas com tabelas próprias (prefixo
-- site_). As contas anônimas do Idle Hunter não ganham perfil aqui: o
-- gatilho só cria perfil quando o cadastro vem com um nome de usuário.

-- ---------------------------------------------------------------
-- site_profiles: 1 linha por conta do site. O nome de usuário é público
-- (servirá para rankings); e-mail fica só no auth.users.
-- ---------------------------------------------------------------
create table if not exists public.site_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 20),
  created_at timestamptz not null default now()
);
create unique index if not exists site_profiles_username_lower on public.site_profiles (lower(username));

-- ---------------------------------------------------------------
-- site_game_saves: progresso em andamento de cada jogo (ex.: a carreira
-- atual no Carreira no Rift). Um save por conta por jogo.
-- ---------------------------------------------------------------
create table if not exists public.site_game_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (char_length(game_id) <= 40),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- ---------------------------------------------------------------
-- site_game_results: histórico de partidas terminadas de todos os jogos.
-- `summary` guarda o que cada jogo quiser mostrar (texto curto, detalhes).
-- `client_id` evita duplicar partidas enviadas de novo após ficar offline.
-- ---------------------------------------------------------------
create table if not exists public.site_game_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (char_length(game_id) <= 40),
  score numeric,
  summary jsonb not null default '{}'::jsonb,
  played_at timestamptz not null default now(),
  client_id text not null,
  unique (user_id, client_id)
);
create index if not exists site_game_results_user_game on public.site_game_results (user_id, game_id, played_at desc);

-- ---------------------------------------------------------------
-- Segurança (RLS): cada conta só lê e escreve os próprios saves e
-- resultados. Perfis são legíveis por todos (nome de usuário público).
-- ---------------------------------------------------------------
alter table public.site_profiles enable row level security;
alter table public.site_game_saves enable row level security;
alter table public.site_game_results enable row level security;

drop policy if exists "site_profiles leitura publica" on public.site_profiles;
create policy "site_profiles leitura publica" on public.site_profiles
  for select using (true);
drop policy if exists "site_profiles dono edita" on public.site_profiles;
create policy "site_profiles dono edita" on public.site_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "site_game_saves dono" on public.site_game_saves;
create policy "site_game_saves dono" on public.site_game_saves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "site_game_results dono le" on public.site_game_results;
create policy "site_game_results dono le" on public.site_game_results
  for select using (auth.uid() = user_id);
drop policy if exists "site_game_results dono insere" on public.site_game_results;
create policy "site_game_results dono insere" on public.site_game_results
  for insert with check (auth.uid() = user_id);
drop policy if exists "site_game_results dono apaga" on public.site_game_results;
create policy "site_game_results dono apaga" on public.site_game_results
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Cria o perfil automaticamente no cadastro, a partir do nome de usuário
-- enviado em options.data.username (ver site/shared/platform.js).
-- ---------------------------------------------------------------
create or replace function public.site_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ? 'username' then
    insert into public.site_profiles (id, username)
    values (new.id, new.raw_user_meta_data ->> 'username')
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists site_on_auth_user_created on auth.users;
create trigger site_on_auth_user_created
  after insert on auth.users
  for each row execute function public.site_handle_new_user();

-- Checagem de nome disponível antes do cadastro (sem expor e-mails).
create or replace function public.site_username_available(name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.site_profiles where lower(username) = lower(name));
$$;
grant execute on function public.site_username_available(text) to anon, authenticated;
