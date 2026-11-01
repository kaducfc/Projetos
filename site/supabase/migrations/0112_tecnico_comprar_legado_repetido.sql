-- Simulador de Técnico: comprar um Legado que você já tem é permitido: o jogador comprado vira cópia (+1, mais as cópias dele)
-- do Legado que você já possui e não ocupa vaga no inventário. As estrelas do vendido se perdem. Rode depois do 0111. Idempotente.

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
  dup bigint;
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
  if not j.ficticio then select x.id into dup from tc_jogadores x where x.org_id = comp.id and x.legado_base is not distinct from j.legado_base and x.nome = j.nome limit 1; end if; -- já tem o Legado: o comprado vira cópia
  if dup is null and (select count(*) from tc_jogadores where org_id = comp.id) >= ((tc_cfg('elenco'))->>'max')::int then raise exception 'elenco_cheio'; end if; -- cópia não ocupa vaga
  taxa := floor(a.preco_rc * ((tc_cfg('taxa_mercado_pct'))::text)::numeric / 100)::bigint;
  liquido := a.preco_rc - taxa;
  -- Dinheiro: a carteira oficial valida o saldo; se faltar, tudo é desfeito.
  perform site_moedas_mexer(uid, -a.preco_rc, 'tecnico_compra', left('jogador:' || j.id::text, 200));
  perform site_moedas_mexer(ven.user_id, liquido, 'tecnico_venda', left('jogador:' || j.id::text, 200));
  titular := j.slot is not null;
  reembolso := tc_rescindir(j.id); -- o contrato acaba na venda: o vendedor recebe 50% do que sobrou
  if dup is not null then
    update tc_jogadores set copias = copias + 1 + j.copias where id = dup; -- vira cópia (as estrelas do vendido se perdem)
    update tc_jogadores set org_id = null, slot = null, estrelas = 0, copias = 0, contrato_fim = null, contrato_valor_semana = 0 where id = j.id; -- mantém o registro da venda
    perform tc_avisar(comp.id, j.nome || ' já era seu: o jogador comprado virou +' || (1 + j.copias)::text || ' cópia(s) para evoluir as estrelas.');
  else
    update tc_jogadores set org_id = comp.id, slot = null, contrato_fim = null, contrato_valor_semana = 0 where id = j.id;
  end if;
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
