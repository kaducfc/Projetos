-- Ranqueada: Carreira no Rift, Lendas do CBLOL e Show do Barão passam a valer
-- as 3 primeiras partidas COMEÇADAS por dia (antes eram 5). Rodar depois da 0066.
-- Rodar de novo é seguro. Partidas já começadas hoje continuam contando; quem
-- já passou de 3 hoje só não ganha ingresso novo.
-- (Mesma função da 0065, só com limite = 3.)

create or replace function public.site_rk_iniciar(jogo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  limite constant int := 3;
  feitas int;
  novo uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if jogo not in ('carreira-no-rift', 'cblol', 'barao') then
    raise exception 'jogo_invalido';
  end if;
  perform site_rk_processar();
  if exists (select 1 from site_ranked_banidos where user_id = uid) then
    return jsonb_build_object('token', null, 'dia', hoje, 'banido', true);
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || uid::text));
  select count(*) into feitas from site_ranked_inicios i where i.user_id = uid and i.dia = hoje and i.jogo = site_rk_iniciar.jogo;
  if feitas >= limite then
    return jsonb_build_object('token', null, 'dia', hoje, 'numero', null, 'restantes', 0, 'limite', limite);
  end if;
  insert into site_ranked_inicios (user_id, dia, jogo) values (uid, hoje, site_rk_iniciar.jogo) returning id into novo;
  perform site_rk_ativo(uid, hoje);
  return jsonb_build_object('token', novo, 'dia', hoje, 'numero', feitas + 1, 'restantes', limite - 1 - feitas, 'limite', limite);
end;
$$;
revoke all on function public.site_rk_iniciar(text) from public, anon;
grant execute on function public.site_rk_iniciar(text) to authenticated;
