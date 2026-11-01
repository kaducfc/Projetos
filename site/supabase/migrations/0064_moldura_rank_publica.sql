-- Moldura "Rank" liberada para TODOS os jogadores: ela mostra a arte do elo atual e troca
-- sozinha quando o jogador muda de elo. As demais molduras continuam exigindo que a conta
-- as tenha ganho (passe, códigos, administrador). Rodar de novo é seguro.
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
  if moldura is not null and moldura <> 'rank' and not exists (
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
