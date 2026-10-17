-- Show do Barão: do Bronze para cima a partida começa com 3 Pinstouros (pulos) em vez de 2.
-- (Mesma função do 0066, só com a conta dos pulos pelo elo; visitantes e Ferro continuam com 2.)
-- Partidas já abertas mantêm os pulos com que abriram. Rodar de novo é seguro.
create or replace function public.site_barao_comecar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r jsonb;
  tok uuid;
  novo uuid;
  p site_barao_partidas;
  ordem text[];
  npulos int := 2;
begin
  -- Limpeza: partidas de visitantes paradas há mais de 6 h e de contas há mais de 3 dias.
  delete from site_barao_partidas
   where (user_id is null and atualizado < now() - interval '6 hours')
      or (user_id is not null and atualizado < now() - interval '3 days');
  ordem := array(select x from unnest(array['azul', 'vermelha', 'dourada']) x order by random());
  if uid is not null then
    r := site_rk_iniciar('barao');
    tok := nullif(r->>'token', '')::uuid;
    npulos := 2 + (site_rk_nivel_de(uid) >= 1)::int;
  end if;
  insert into site_barao_partidas (user_id, ranked, dia, carta_ordem, pulos)
  values (uid, tok, site_hoje_br(), ordem, npulos) returning id into novo;
  perform site_barao_nova_pergunta(novo);
  select * into p from site_barao_partidas where id = novo;
  return jsonb_build_object('estado', site_barao_json(p), 'ranked', r);
end;
$$;
revoke all on function public.site_barao_comecar() from public;
grant execute on function public.site_barao_comecar() to anon, authenticated;
