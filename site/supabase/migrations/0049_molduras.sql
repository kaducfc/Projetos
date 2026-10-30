-- Molduras: imagem que envolve o ícone do jogador (cosmético).
-- * site_profiles.moldura: id da moldura escolhida (null = sem moldura).
-- * Molduras ganhas ficam em site_recompensas com tipo 'moldura' (passe, códigos ou
--   administrador). O servidor só deixa equipar uma que a conta tem.
-- * O ranking passa a informar a moldura de cada jogador.
-- * A moldura de teste "hw-teste" é liberada para as contas de administrador.
-- Rodar de novo é seguro.

alter table public.site_profiles add column if not exists moldura text;
alter table public.site_profiles drop constraint if exists site_profiles_moldura_chk;
alter table public.site_profiles add constraint site_profiles_moldura_chk
  check (moldura is null or moldura ~ '^[a-z0-9-]{2,30}$');

alter table public.site_recompensas drop constraint if exists site_recompensas_tipo_check;
alter table public.site_recompensas add constraint site_recompensas_tipo_check
  check (tipo in ('icone', 'efeito', 'moldura'));
alter table public.site_passe_niveis drop constraint if exists site_passe_niveis_tipo_check;
alter table public.site_passe_niveis add constraint site_passe_niveis_tipo_check
  check (tipo in ('moeda', 'efeito', 'icone', 'moldura'));

create or replace function public.site_set_moldura(moldura text)
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
  if moldura is not null and moldura !~ '^[a-z0-9-]{2,30}$' then
    raise exception 'invalid_moldura';
  end if;
  if moldura is not null and not exists (
    select 1 from site_recompensas r where r.user_id = uid and r.tipo = 'moldura' and r.chave = moldura
  ) then
    raise exception 'moldura_bloqueada';
  end if;
  update site_profiles set moldura = site_set_moldura.moldura where id = uid;
  return moldura;
end;
$$;
revoke all on function public.site_set_moldura(text) from public, anon;
grant execute on function public.site_set_moldura(text) to authenticated;

-- O ranking passa a dizer também a moldura de cada jogador.
do $$
declare
  def text := pg_get_functiondef('public.site_rk_ranking(text, text)'::regprocedure);
begin
  if def like '%''moldura'', p.moldura%' then
    return;
  end if;
  if def not like '%''efeito'', p.efeito,%' then
    raise exception 'site_rk_ranking com formato inesperado; avise o desenvolvedor';
  end if;
  execute replace(def, '''efeito'', p.efeito,', '''efeito'', p.efeito, ''moldura'', p.moldura,');
end;
$$;

-- Moldura de teste para as contas de administrador.
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'moldura', 'hw-teste', 'admin' from public.site_admins a
on conflict do nothing;
