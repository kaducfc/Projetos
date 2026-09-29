-- Login com Google: quem entra pelo Google não escolhe nome de usuário no
-- cadastro, então o perfil não é criado pelo gatilho. Depois do primeiro
-- login, o site pede um nome e chama esta função para criar o perfil.
--
-- Como aplicar: cole este arquivo no SQL Editor do Supabase e clique em Run.
-- Rodar de novo é seguro.

create or replace function public.site_claim_username(name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if name is null or name !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'invalid_username';
  end if;
  if exists (select 1 from site_profiles where id = uid) then
    raise exception 'already_has_username';
  end if;
  if exists (select 1 from site_profiles where lower(username) = lower(name)) then
    raise exception 'username_taken';
  end if;
  insert into site_profiles (id, username) values (uid, name);
  return name;
exception
  when unique_violation then
    raise exception 'username_taken';
end;
$$;

revoke all on function public.site_claim_username(text) from public, anon;
grant execute on function public.site_claim_username(text) to authenticated;
