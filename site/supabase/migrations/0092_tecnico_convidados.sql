-- Simulador de Técnico: libera o jogo (fechado) para jogadores específicos, sem torná-los administradores.
-- Idempotente. Para liberar:  insert into tc_convidados (user_id) select id from auth.users where email = 'fulano@exemplo.com';
-- Para retirar:               delete from tc_convidados where user_id = '<uuid>';

create table if not exists public.tc_convidados (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.tc_convidados enable row level security;
revoke all on public.tc_convidados from anon, authenticated;

create or replace function public.tc_exigir(uid uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if not coalesce((tc_cfg('aberto'))::text::boolean, false)
     and not exists (select 1 from site_admins where user_id = uid)
     and not exists (select 1 from tc_convidados where user_id = uid) then
    raise exception 'jogo_fechado';
  end if;
end;
$$;
revoke all on function public.tc_exigir(uuid) from public, anon, authenticated;

-- O navegador pergunta se a conta pode ver o jogo (administrador, convidado ou jogo já aberto).
create or replace function public.tc_tenho_acesso()
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  perform tc_exigir(auth.uid());
  return true;
exception when others then
  return false;
end;
$$;
revoke all on function public.tc_tenho_acesso() from public, anon;
grant execute on function public.tc_tenho_acesso() to authenticated;
