-- Ícones de perfil novos (artes do Rift Arcade) no lugar dos de campeão.
--   * Ícones normais: 'mascote' ou 'icone:<id>'.
--   * Especiais de apoiador (o servidor confere):
--       'icone:apoiador' → quem apoiou com qualquer valor;
--       'icone:pioneiro' → os 100 primeiros apoiadores do site (pela data
--                          do primeiro apoio aprovado; a vaga é para sempre).
--     Se todo o apoio for estornado, o ícone especial sai sozinho.
--   * Quem estava com ícone de campeão volta para a inicial do nome.
--
-- Como aplicar: cole este arquivo no SQL Editor do Supabase e clique em Run
-- (depois do 0013). Rodar de novo é seguro.

update public.site_profiles set avatar = null where avatar like 'champ:%';

-- Posição da conta na fila de apoiadores (1 = primeiro). Null se nunca apoiou.
create or replace function public.site_apoiador_posicao(uid uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select pos::int from (
    select id, rank() over (order by apoiador_desde, id) as pos
      from site_profiles where apoiador_desde is not null
  ) f where f.id = uid;
$$;
revoke all on function public.site_apoiador_posicao(uuid) from public, anon, authenticated;

-- Selos da própria conta (o que libera os ícones especiais).
create or replace function public.site_meus_selos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  total numeric;
  pos int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  select apoio_total into total from site_profiles where id = uid;
  pos := site_apoiador_posicao(uid);
  return jsonb_build_object(
    'apoiador', coalesce(total, 0) > 0,
    'pioneiro', coalesce(total, 0) > 0 and pos is not null and pos <= 100,
    'posicao', pos);
end;
$$;
revoke all on function public.site_meus_selos() from public, anon;
grant execute on function public.site_meus_selos() to authenticated;

-- Quantas vagas de "100 primeiros apoiadores" ainda restam (página Apoiar).
create or replace function public.site_pioneiros_vagas()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, 100 - (select count(*) from site_profiles where apoiador_desde is not null))::int;
$$;
revoke all on function public.site_pioneiros_vagas() from public;
grant execute on function public.site_pioneiros_vagas() to anon, authenticated;

create or replace function public.site_set_avatar(icone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  selos jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if icone is not null and icone !~ '^(mascote|icone:[a-z0-9-]{2,30})$' then
    raise exception 'invalid_avatar';
  end if;
  if icone in ('icone:apoiador', 'icone:pioneiro') then
    selos := site_meus_selos();
    if not (selos->>(substr(icone, 7)))::boolean then
      raise exception 'icone_bloqueado';
    end if;
  end if;
  update site_profiles set avatar = icone where id = uid;
  return icone;
end;
$$;
revoke all on function public.site_set_avatar(text) from public, anon;
grant execute on function public.site_set_avatar(text) to authenticated;

-- Apoio todo estornado: tira o ícone especial.
create or replace function public.site_icone_especial_confere()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.avatar in ('icone:apoiador', 'icone:pioneiro') and coalesce(new.apoio_total, 0) <= 0 then
    new.avatar := null;
  end if;
  return new;
end;
$$;
drop trigger if exists site_profiles_icone_especial on public.site_profiles;
create trigger site_profiles_icone_especial
  before update of apoio_total, avatar on public.site_profiles
  for each row execute function public.site_icone_especial_confere();
