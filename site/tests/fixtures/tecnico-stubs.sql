create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
alter table auth.users add column if not exists created_at timestamptz not null default now() - interval '30 days';
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
create or replace function public.site_hoje_br() returns date language sql stable as $$ select coalesce(nullif(current_setting('app.hoje', true), ''), '2026-10-14')::date $$;
create table if not exists public.site_admins (user_id uuid primary key references auth.users(id));
create table if not exists public.site_carteira (user_id uuid primary key references auth.users(id) on delete cascade, saldo bigint not null default 0 check (saldo >= 0), atualizado timestamptz not null default now());
create table if not exists public.site_moedas_lanc (id bigserial primary key, user_id uuid not null, delta bigint not null check (delta <> 0), saldo bigint not null check (saldo >= 0), motivo text not null check (char_length(motivo) between 1 and 40), ref text check (ref is null or char_length(ref) <= 200), criado timestamptz not null default now());
create or replace function public.site_moedas_mexer(uid uuid, delta bigint, motivo text, ref text default null) returns bigint language plpgsql security definer set search_path = public as $$
declare novo bigint;
begin
  if delta = 0 then raise exception 'quantidade_invalida'; end if;
  insert into site_carteira (user_id, saldo) values (uid, 0) on conflict (user_id) do nothing;
  begin
    update site_carteira set saldo = saldo + delta, atualizado = now() where user_id = uid returning saldo into novo;
  exception when check_violation then raise exception 'saldo_insuficiente';
  end;
  insert into site_moedas_lanc (user_id, delta, saldo, motivo, ref) values (uid, delta, novo, motivo, ref);
  return novo;
end; $$;
create table if not exists public.site_rk_lanc_stub (user_id uuid, dia date, jogo text, motivo text, delta int);
create or replace function public.site_rk_lancar(uid uuid, d date, j text, m text, v int) returns int language sql as $$ insert into public.site_rk_lanc_stub values (uid, d, j, m, v); select v $$;
create table if not exists public.site_nivel (user_id uuid primary key, nivel int not null default 0);
create or replace function public.site_rk_nivel_de(uid uuid) returns int language sql stable as $$ select coalesce((select nivel from public.site_nivel where user_id = uid), 0) $$;
create or replace function public.site_rk_ajustar(base int, nivel int) returns int language sql immutable as $$ select base $$;
create or replace function public.site_is_admin() returns boolean language sql stable as $$ select exists (select 1 from site_admins where user_id = auth.uid()) $$;
create table if not exists public.site_profiles (id uuid primary key references auth.users(id), username text);
