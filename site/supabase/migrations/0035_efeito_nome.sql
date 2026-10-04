-- Efeito no nome: o jogador escolhe qual efeito aparece no nick dele (perfil,
-- ranking, barra do site). Rodar depois da 0034. Rodar de novo é seguro.
--
-- site_profiles.efeito:
--   null      → automático (apoiador usa o "reflexo"; os demais, sem efeito);
--   'nenhum'  → sem efeito, mesmo sendo apoiador;
--   'reflexo' → dourado dos apoiadores (precisa ter apoiado);
--   outro id  → efeito ganho por código de recompensa (site_recompensas, tipo 'efeito').

alter table public.site_profiles add column if not exists efeito text;
alter table public.site_profiles drop constraint if exists site_profiles_efeito_chk;
alter table public.site_profiles add constraint site_profiles_efeito_chk
  check (efeito is null or efeito ~ '^[a-z0-9-]{2,30}$');

create or replace function public.site_set_efeito(efeito text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  total numeric;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if efeito is not null and efeito !~ '^[a-z0-9-]{2,30}$' then
    raise exception 'invalid_efeito';
  end if;
  if efeito = 'reflexo' then
    select apoio_total into total from site_profiles where id = uid;
    if coalesce(total, 0) <= 0 then
      raise exception 'efeito_bloqueado';
    end if;
  elsif efeito is not null and efeito <> 'nenhum' then
    if not exists (select 1 from site_recompensas r where r.user_id = uid and r.tipo = 'efeito' and r.chave = efeito) then
      raise exception 'efeito_bloqueado';
    end if;
  end if;
  update site_profiles set efeito = site_set_efeito.efeito where id = uid;
  return efeito;
end;
$$;
revoke all on function public.site_set_efeito(text) from public, anon;
grant execute on function public.site_set_efeito(text) to authenticated;

-- O ranking passa a dizer também o efeito escolhido de cada jogador.
do $$
declare
  def text := pg_get_functiondef('public.site_rk_ranking(text, text)'::regprocedure);
begin
  if def like '%''efeito'', p.efeito%' then
    return;
  end if;
  if def not like '%''apoiador'', p.apoio_total > 0,%' then
    raise exception 'site_rk_ranking com formato inesperado; avise o desenvolvedor';
  end if;
  execute replace(def, '''apoiador'', p.apoio_total > 0,', '''apoiador'', p.apoio_total > 0, ''efeito'', p.efeito,');
end;
$$;
