-- Perfil do jogador: ícone, troca de nome (com filtro de palavrões),
-- exclusão da conta e espaço para o modo ranqueado.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique
-- em Run. Rodar de novo é seguro.

-- ---------------------------------------------------------------
-- Filtro de nomes. A mesma lista está em site/shared/nomes.js (o teste
-- tests/perfil.test.mjs confere que as duas são iguais).
-- ---------------------------------------------------------------
create or replace function public.site_nome_proibido(nome text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  trechos text[] := array[
    'caralh', 'buceta', 'bucet', 'porra', 'merda', 'arrombad', 'fdputa', 'filhodaputa', 'filhadaputa', 'putaria',
    'putinha', 'putona', 'fudid', 'foder', 'fodase', 'foda', 'punheta', 'xoxota', 'xereca', 'piroca',
    'boquete', 'siririca', 'vagabund', 'vadia', 'prostitut', 'viado', 'veado', 'cuzao', 'cusao', 'babaca',
    'otario', 'escroto', 'corno', 'piranha', 'rapariga', 'retardad', 'mongoloid', 'estupr', 'pedofil', 'nazis',
    'hitler', 'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'faggot', 'whore', 'slut', 'pussy',
    'asshole', 'retard', 'rapist', 'macaco', 'crioulo', 'tiziu', 'sapatao', 'traveco', 'bixa', 'riftarcade',
    'administrador', 'moderador'
  ];
  palavras_proibidas text[] := array[
    'cu', 'cus', 'puta', 'puto', 'putas', 'putos', 'fdp', 'vsf', 'vtnc', 'tnc',
    'pqp', 'krl', 'crl', 'bct', 'pau', 'rola', 'bosta', 'cacete', 'kct',
    'pnc', 'gozo', 'gozar', 'anus', 'penis', 'vagina', 'nazi', 'kkk', 'sex', 'sexo',
    'porn', 'porno', 'dick', 'cock', 'fag', 'admin', 'adm', 'mod', 'staff', 'suporte',
    'oficial', 'riot', 'sistema'
  ];
  junto text;
  junto2 text;
  ps text[];
  p text;
begin
  if nome is null then
    return false;
  end if;
  -- números no lugar de letras (p0rr4 = porra) e só letras
  junto := regexp_replace(translate(lower(nome), '0123456789', 'oizeasgtbg'), '[^a-z]', '', 'g');
  junto2 := regexp_replace(junto, '(.)\1+', '\1', 'g');
  foreach p in array trechos loop
    if position(p in junto) > 0 or position(p in junto2) > 0
       or position(regexp_replace(p, '(.)\1+', '\1', 'g') in junto) > 0
       or position(regexp_replace(p, '(.)\1+', '\1', 'g') in junto2) > 0 then
      return true;
    end if;
  end loop;
  -- palavras do nome: separa por "_", "." e por maiúscula no meio (PutaMerda)
  select coalesce(array_agg(w), '{}') || coalesce(array_agg(regexp_replace(w, '(.)\1+', '\1', 'g')), '{}')
    into ps
    from regexp_split_to_table(
      translate(lower(regexp_replace(nome, '([a-z])([A-Z])', '\1 \2', 'g')), '0123456789', 'oizeasgtbg'),
      '[^a-z]+') as w
    where w <> '';
  ps := ps || array[junto, junto2];
  return ps && palavras_proibidas;
end;
$$;
grant execute on function public.site_nome_proibido(text) to anon, authenticated;

-- ---------------------------------------------------------------
-- Novas colunas do perfil.
--   avatar: ícone escolhido ('mascote' ou 'champ:<Campeão>').
--   username_changed_at: última troca de nome (limite de 1 troca a cada 2 dias).
-- ---------------------------------------------------------------
alter table public.site_profiles add column if not exists avatar text
  check (avatar is null or avatar ~ '^(mascote|champ:[A-Za-z]{2,20})$');
alter table public.site_profiles add column if not exists username_changed_at timestamptz;

-- O perfil só muda pelas funções abaixo (que conferem nome e ícone).
drop policy if exists "site_profiles dono edita" on public.site_profiles;
revoke update on public.site_profiles from authenticated;

-- ---------------------------------------------------------------
-- Cadastro e primeiro login pelo Google também passam pelo filtro.
-- ---------------------------------------------------------------
create or replace function public.site_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome text := new.raw_user_meta_data ->> 'username';
begin
  if nome is not null then
    if nome !~ '^[A-Za-z0-9_.]{3,20}$' or site_nome_proibido(nome) then
      raise exception 'username_blocked';
    end if;
    insert into public.site_profiles (id, username)
    values (new.id, nome)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

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
  if site_nome_proibido(name) then
    raise exception 'username_blocked';
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

-- ---------------------------------------------------------------
-- Trocar o nome de usuário (no máximo 1 vez a cada 2 dias).
-- ---------------------------------------------------------------
create or replace function public.site_change_username(name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  atual record;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if name is null or name !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'invalid_username';
  end if;
  if site_nome_proibido(name) then
    raise exception 'username_blocked';
  end if;
  select username, username_changed_at into atual from site_profiles where id = uid;
  if not found then
    raise exception 'no_profile';
  end if;
  if atual.username = name then
    return name;
  end if;
  -- Só mudar maiúsculas/minúsculas do próprio nome não conta como troca.
  if lower(atual.username) <> lower(name) then
    if atual.username_changed_at is not null and atual.username_changed_at > now() - interval '2 days' then
      raise exception 'username_cooldown';
    end if;
    if exists (select 1 from site_profiles where lower(username) = lower(name) and id <> uid) then
      raise exception 'username_taken';
    end if;
  end if;
  update site_profiles
    set username = name,
        username_changed_at = case when lower(atual.username) <> lower(name) then now() else username_changed_at end
    where id = uid;
  return name;
exception
  when unique_violation then
    raise exception 'username_taken';
end;
$$;
revoke all on function public.site_change_username(text) from public, anon;
grant execute on function public.site_change_username(text) to authenticated;

-- ---------------------------------------------------------------
-- Escolher o ícone do perfil.
-- ---------------------------------------------------------------
create or replace function public.site_set_avatar(icone text)
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
  if icone is not null and icone !~ '^(mascote|champ:[A-Za-z]{2,20})$' then
    raise exception 'invalid_avatar';
  end if;
  update site_profiles set avatar = icone where id = uid;
  return icone;
end;
$$;
revoke all on function public.site_set_avatar(text) from public, anon;
grant execute on function public.site_set_avatar(text) to authenticated;

-- ---------------------------------------------------------------
-- Excluir a própria conta (LGPD). Apaga o login e, em cascata, o perfil,
-- os saves e o histórico. As estatísticas anônimas do painel ficam, sem
-- ligação com a conta.
-- ---------------------------------------------------------------
create or replace function public.site_delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.site_delete_account() from public, anon;
grant execute on function public.site_delete_account() to authenticated;
