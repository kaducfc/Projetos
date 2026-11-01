-- Simulador de Técnico: Legados e jogadores com contrato vigente também podem ser anunciados. Rode depois do 0110. Idempotente.
--  * Contrato vigente não impede o anúncio. Só quando alguém COMPRA o contrato é encerrado automaticamente: o vendedor recebe
--    50% do salário restante (já pago) em créditos e o comprador recebe o jogador SEM contrato (precisa efetivar um para escalar).
--  * Legado vendido leva as estrelas e as cópias repetidas dele. Quem já tem aquele Legado não pode comprar outra cópia do mesmo.

create or replace function public.tc_anunciar(jogador bigint, preco bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  lim jsonb := tc_cfg('preco_rc');
  a tc_anuncios;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  if preco is null or preco < (lim->>'min')::bigint or preco > (lim->>'max')::bigint then
    raise exception 'preco_invalido';
  end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if exists (select 1 from tc_anuncios where jogador_id = j.id and status = 'aberto') then raise exception 'ja_anunciado'; end if;
  if (select count(*) from tc_anuncios where vendedor_org = o.id and status = 'aberto') >= 5 then raise exception 'muitos_anuncios'; end if;
  insert into tc_anuncios (jogador_id, vendedor_org, preco_rc) values (j.id, o.id, preco) returning * into a;
  return tc_anuncio_json(a);
end;
$$;
revoke all on function public.tc_anunciar(bigint, bigint) from public, anon;
grant execute on function public.tc_anunciar(bigint, bigint) to authenticated;

create or replace function public.tc_comprar_anuncio(anuncio bigint, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  comp tc_orgs;
  ven tc_orgs;
  a tc_anuncios;
  j tc_jogadores;
  taxa bigint;
  liquido bigint;
  titular boolean;
  reembolso bigint;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  select * into comp from tc_orgs where user_id = uid for update;
  if comp.id is null then raise exception 'sem_org'; end if;
  if exists (select 1 from tc_transf where user_id = uid and chave = chave_) then
    return jsonb_build_object('ja_feito', true);
  end if;
  -- Trava na mesma ordem sempre (anúncio, jogador, vendedor) para não travar um ao outro.
  select * into a from tc_anuncios where id = anuncio for update;
  if a.id is null then raise exception 'anuncio_inexistente'; end if;
  if a.status <> 'aberto' then raise exception 'anuncio_encerrado'; end if;
  select * into j from tc_jogadores where id = a.jogador_id for update;
  select * into ven from tc_orgs where id = a.vendedor_org for update;
  if j.org_id is distinct from a.vendedor_org then
    update tc_anuncios set status = 'cancelado' where id = a.id;
    raise exception 'anuncio_encerrado';
  end if;
  if ven.id = comp.id then raise exception 'compra_propria'; end if;
  if ven.user_id is null then raise exception 'vendedor_invalido'; end if;
  if not j.ficticio and exists (select 1 from tc_jogadores x where x.org_id = comp.id and x.legado_base is not distinct from j.legado_base and x.nome = j.nome) then raise exception 'legado_ja_possui'; end if;
  if (select count(*) from tc_jogadores where org_id = comp.id) >= ((tc_cfg('elenco'))->>'max')::int then raise exception 'elenco_cheio'; end if;
  taxa := floor(a.preco_rc * ((tc_cfg('taxa_mercado_pct'))::text)::numeric / 100)::bigint;
  liquido := a.preco_rc - taxa;
  -- Dinheiro: a carteira oficial valida o saldo; se faltar, tudo é desfeito.
  perform site_moedas_mexer(uid, -a.preco_rc, 'tecnico_compra', left('jogador:' || j.id::text, 200));
  perform site_moedas_mexer(ven.user_id, liquido, 'tecnico_venda', left('jogador:' || j.id::text, 200));
  titular := j.slot is not null;
  reembolso := tc_rescindir(j.id); -- o contrato acaba na venda: o vendedor recebe 50% do que sobrou
  update tc_jogadores set org_id = comp.id, slot = null, contrato_fim = null, contrato_valor_semana = 0 where id = j.id;
  update tc_anuncios set status = 'vendido', comprador_org = comp.id, taxa_rc = taxa, vendido_em = now() where id = a.id;
  insert into tc_transf (jogador_id, de_org, para_org, tipo, valor, moeda, salario, contrato_fim, chave, user_id)
  values (j.id, ven.id, comp.id, 'compra_usuario', a.preco_rc, 'rc', j.salario, j.contrato_fim, chave_, uid);
  if titular then
    update tc_orgs set sinergia = greatest(0, sinergia - ((tc_cfg('sinergia'))->>'perda_troca')::int) where id = ven.id;
  end if;
  perform tc_completar_elenco(ven.id);
  perform tc_avisar(ven.id, j.nome || ' foi vendido por ' || a.preco_rc::text || ' RC (você recebeu ' || liquido::text || ' RC)' || case when reembolso > 0 then ' e ' || reembolso::text || ' créditos do contrato que ele não cumpriu.' else '.' end);
  return jsonb_build_object('ok', true, 'jogador', j.id, 'preco_rc', a.preco_rc, 'taxa_rc', taxa);
end;
$$;
revoke all on function public.tc_comprar_anuncio(bigint, text) from public, anon;
grant execute on function public.tc_comprar_anuncio(bigint, text) to authenticated;
