-- Simulador de Técnico: contratos por tempo, pagos adiantado, e Legados sem maestria inicial. Rode depois do 0105. Idempotente.
--
--  * Salário é sempre em créditos de equipe. Contratar um jogador (mercado ou baú) só o põe no inventário: SEM contrato.
--  * Para escalar como titular é preciso efetivar um contrato: 1 semana ou 1 temporada (4 semanas, 20% mais barata).
--    O valor é pago adiantado e não há mais cobrança semanal de salário.
--  * Encerrar antes do fim devolve 50% do que já estava pago e o jogador ainda não jogou. Vale também ao demitir/liberar.
--  * Contrato vencido: o titular volta para a reserva (o inventário continua dele) e a vaga é completada por um reserva com
--    contrato ou por um substituto. Quem tem contrato vigente não pode ser anunciado no mercado entre técnicos.
--  * Opções e reembolso em tc_config.contrato.

alter table public.tc_jogadores add column if not exists contrato_valor_semana int not null default 0 check (contrato_valor_semana >= 0);

insert into public.tc_config (chave, valor) values
  ('contrato', '{"opcoes": [{"semanas": 1, "desconto_pct": 0}, {"semanas": 4, "desconto_pct": 20}], "reembolso_pct": 50}'::jsonb)
on conflict (chave) do nothing;

create or replace function public.tc_contrato_ativo(j tc_jogadores)
returns boolean language sql stable security definer set search_path = public as $$
  select j.contrato_fim is not null and j.contrato_fim > tc_semana_global();
$$;
revoke all on function public.tc_contrato_ativo(tc_jogadores) from public, anon, authenticated;

create or replace function public.tc_contrato_restante(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select case when tc_contrato_ativo(j) then j.contrato_fim - tc_semana_global() else 0 end;
$$;
revoke all on function public.tc_contrato_restante(tc_jogadores) from public, anon, authenticated;

create or replace function public.tc_salario_base(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select case when j.salario > 0 then j.salario else tc_salario(tc_preco_jogador(j)) end;
$$;
revoke all on function public.tc_salario_base(tc_jogadores) from public, anon, authenticated;

-- Preço (adiantado) de um contrato de `semanas` para o jogador; null se a duração não existe.
create or replace function public.tc_contrato_preco(j tc_jogadores, semanas int)
returns bigint language sql stable security definer set search_path = public as $$
  select round(tc_salario_base(j)::numeric * semanas * (1 - (o->>'desconto_pct')::numeric / 100))::bigint
    from jsonb_array_elements(tc_cfg('contrato')->'opcoes') o where (o->>'semanas')::int = semanas;
$$;
revoke all on function public.tc_contrato_preco(tc_jogadores, int) from public, anon, authenticated;

create or replace function public.tc_contrato_opcoes(j tc_jogadores)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('semanas', (o->>'semanas')::int, 'desconto_pct', (o->>'desconto_pct')::int, 'preco', tc_contrato_preco(j, (o->>'semanas')::int)) order by (o->>'semanas')::int), '[]'::jsonb)
    from jsonb_array_elements(tc_cfg('contrato')->'opcoes') o;
$$;
revoke all on function public.tc_contrato_opcoes(tc_jogadores) from public, anon, authenticated;

create or replace function public.tc_reembolso_contrato(j tc_jogadores)
returns bigint language sql stable security definer set search_path = public as $$
  select floor(j.contrato_valor_semana::numeric * tc_contrato_restante(j) * coalesce((tc_cfg('contrato')->>'reembolso_pct')::numeric, 50) / 100)::bigint;
$$;
revoke all on function public.tc_reembolso_contrato(tc_jogadores) from public, anon, authenticated;

-- Encerra o contrato de um jogador da organização: devolve parte do que já estava pago e tira o contrato. Devolve o reembolso.
create or replace function public.tc_rescindir(jid bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  j tc_jogadores;
  r bigint := 0;
begin
  select * into j from tc_jogadores where id = jid for update;
  if j.id is null or j.org_id is null then return 0; end if;
  if tc_contrato_ativo(j) then
    r := tc_reembolso_contrato(j);
    if r > 0 then perform tc_creditos_mexer(j.org_id, r, 'rescisao', j.id::text); end if;
  end if;
  update tc_jogadores set contrato_fim = null, contrato_valor_semana = 0 where id = j.id;
  return r;
end;
$$;
revoke all on function public.tc_rescindir(bigint) from public, anon, authenticated;

-- Efetiva um contrato (pago adiantado). Só com contrato vencido ou na última semana dele.
create or replace function public.tc_assinar_contrato_int(oid bigint, jid bigint, semanas int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  j tc_jogadores;
  o tc_orgs;
  preco bigint;
  fim int;
begin
  select * into o from tc_orgs where id = oid for update;
  select * into j from tc_jogadores where id = jid for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  preco := tc_contrato_preco(j, semanas);
  if preco is null then raise exception 'contrato_invalido'; end if;
  if tc_contrato_ativo(j) and tc_contrato_restante(j) > 1 then raise exception 'contrato_vigente'; end if;
  if o.creditos < preco then raise exception 'creditos_insuficientes'; end if;
  fim := greatest(coalesce(j.contrato_fim, 0), tc_semana_global()) + semanas;
  perform tc_creditos_mexer(o.id, -preco, 'contrato', j.id::text);
  update tc_jogadores set salario = tc_salario_base(j), contrato_fim = fim, contrato_valor_semana = round(preco::numeric / semanas)::int where id = j.id;
  insert into tc_transf (jogador_id, de_org, para_org, tipo, valor, salario, contrato_fim, user_id)
  values (j.id, o.id, o.id, 'renovacao', preco, tc_salario_base(j), fim, o.user_id);
  return jsonb_build_object('ok', true, 'custo', preco, 'semanas', semanas, 'contrato_fim', fim);
end;
$$;
revoke all on function public.tc_assinar_contrato_int(bigint, bigint, int) from public, anon, authenticated;

create or replace function public.tc_assinar_contrato(jogador bigint, semanas int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  return tc_assinar_contrato_int(o.id, jogador, semanas);
end;
$$;
revoke all on function public.tc_assinar_contrato(bigint, int) from public, anon;
grant execute on function public.tc_assinar_contrato(bigint, int) to authenticated;

create or replace function public.tc_encerrar_contrato(jogador bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  r bigint;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if not tc_contrato_ativo(j) then raise exception 'sem_contrato'; end if;
  if exists (select 1 from tc_treinos where jogador_id = j.id and status = 'andamento') then raise exception 'jogador_treinando'; end if;
  r := tc_rescindir(j.id);
  if j.slot is not null then
    update tc_jogadores set slot = null where id = j.id;
    update tc_orgs set sinergia = greatest(0, sinergia - ((tc_cfg('sinergia'))->>'perda_troca')::int) where id = o.id;
    perform tc_completar_elenco(o.id);
  end if;
  perform tc_avisar(o.id, 'Contrato de ' || j.nome || ' encerrado' || case when r > 0 then ': você recebeu ' || r::text || ' créditos de volta.' else '.' end);
  return jsonb_build_object('ok', true, 'reembolso', r);
end;
$$;
revoke all on function public.tc_encerrar_contrato(bigint) from public, anon;
grant execute on function public.tc_encerrar_contrato(bigint) to authenticated;

-- Escalar: o titular precisa de contrato vigente; sem contrato, `semanas` efetiva um agora (na mesma operação).
drop function if exists public.tc_escalar(text, bigint);
create or replace function public.tc_escalar(vaga text, jogador bigint, semanas int default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  atual bigint;
begin
  perform tc_exigir(uid);
  if vaga not in ('top', 'selva', 'meio', 'atirador', 'suporte') then raise exception 'vaga_invalida'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if j.slot = vaga then return; end if;
  if not tc_contrato_ativo(j) then
    if semanas is null then raise exception 'contrato_necessario'; end if;
    perform tc_assinar_contrato_int(o.id, j.id, semanas);
  end if;
  select id into atual from tc_jogadores where org_id = o.id and slot = vaga for update;
  if atual is not null then
    update tc_jogadores set slot = null where id = atual;
  end if;
  update tc_jogadores set slot = vaga where id = j.id;
  update tc_orgs set sinergia = greatest(0, sinergia - ((tc_cfg('sinergia'))->>'perda_troca')::int) where id = o.id;
end;
$$;
revoke all on function public.tc_escalar(text, bigint, int) from public, anon;
grant execute on function public.tc_escalar(text, bigint, int) to authenticated;

-- Contratar do mercado oficial: só compra o jogador (inventário, sem contrato). O argumento `semanas` é ignorado.
create or replace function public.tc_contratar(jogador bigint, semanas int, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  el jsonb := tc_cfg('elenco');
  preco bigint;
  sal int;
  ant jsonb;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then
    raise exception 'chave_invalida';
  end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  -- Pedido repetido: devolve o resultado anterior.
  select jsonb_build_object('ja_feito', true, 'jogador', jogador_id) into ant from tc_transf where user_id = uid and chave = chave_;
  if ant is not null then return ant; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null then raise exception 'jogador_inexistente'; end if;
  if j.org_id is not null then raise exception 'jogador_indisponivel'; end if;
  if (select count(*) from tc_jogadores where org_id = o.id) >= (el->>'max')::int then
    raise exception 'elenco_cheio';
  end if;
  preco := tc_preco_jogador(j);
  if o.creditos < preco then raise exception 'creditos_insuficientes'; end if;
  sal := tc_salario(preco);
  perform tc_creditos_mexer(o.id, -preco, 'contratacao', j.id::text);
  update tc_jogadores set org_id = o.id, slot = null, salario = sal, contrato_fim = null, contrato_valor_semana = 0 where id = j.id;
  insert into tc_transf (jogador_id, para_org, tipo, valor, salario, contrato_fim, chave, user_id)
  values (j.id, o.id, 'contratacao', preco, sal, null, chave_, uid);
  return jsonb_build_object('ok', true, 'jogador', j.id, 'preco', preco, 'salario', sal);
end;
$$;
revoke all on function public.tc_contratar(bigint, int, text) from public, anon;
grant execute on function public.tc_contratar(bigint, int, text) to authenticated;

drop function if exists public.tc_renovar(bigint, int, text);

create or replace function public.tc_liberar(jogador bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if not j.ficticio then raise exception 'legado_nao_libera'; end if;
  if j.slot is not null then raise exception 'jogador_titular'; end if;
  perform tc_rescindir(j.id);
  update tc_jogadores set org_id = null, slot = null, salario = 0, contrato_fim = null where id = j.id;
  insert into tc_transf (jogador_id, de_org, tipo) values (j.id, o.id, 'liberado');
end;
$$;
revoke all on function public.tc_liberar(bigint) from public, anon;
grant execute on function public.tc_liberar(bigint) to authenticated;

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
  if not j.ficticio then raise exception 'legado_nao_vende'; end if;
  if tc_contrato_ativo(j) then raise exception 'contrato_vigente'; end if;
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
  if (select count(*) from tc_jogadores where org_id = comp.id) >= ((tc_cfg('elenco'))->>'max')::int then raise exception 'elenco_cheio'; end if;
  taxa := floor(a.preco_rc * ((tc_cfg('taxa_mercado_pct'))::text)::numeric / 100)::bigint;
  liquido := a.preco_rc - taxa;
  -- Dinheiro: a carteira oficial valida o saldo; se faltar, tudo é desfeito.
  perform site_moedas_mexer(uid, -a.preco_rc, 'tecnico_compra', left('jogador:' || j.id::text, 200));
  perform site_moedas_mexer(ven.user_id, liquido, 'tecnico_venda', left('jogador:' || j.id::text, 200));
  titular := j.slot is not null;
  update tc_jogadores set org_id = comp.id, slot = null, contrato_fim = null, contrato_valor_semana = 0 where id = j.id;
  update tc_anuncios set status = 'vendido', comprador_org = comp.id, taxa_rc = taxa, vendido_em = now() where id = a.id;
  insert into tc_transf (jogador_id, de_org, para_org, tipo, valor, moeda, salario, contrato_fim, chave, user_id)
  values (j.id, ven.id, comp.id, 'compra_usuario', a.preco_rc, 'rc', j.salario, j.contrato_fim, chave_, uid);
  if titular then
    update tc_orgs set sinergia = greatest(0, sinergia - ((tc_cfg('sinergia'))->>'perda_troca')::int) where id = ven.id;
  end if;
  perform tc_completar_elenco(ven.id);
  perform tc_avisar(ven.id, j.nome || ' foi vendido por ' || a.preco_rc::text || ' RC (você recebeu ' || liquido::text || ' RC).');
  return jsonb_build_object('ok', true, 'jogador', j.id, 'preco_rc', a.preco_rc, 'taxa_rc', taxa);
end;
$$;
revoke all on function public.tc_comprar_anuncio(bigint, text) from public, anon;
grant execute on function public.tc_comprar_anuncio(bigint, text) to authenticated;

create or replace function public.tc_demitir(jogador bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  cfg jsonb := tc_cfg('estrelas_jogador');
  total int;
  reembolso bigint;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if j.slot is not null then raise exception 'jogador_titular'; end if;
  if exists (select 1 from tc_treinos where jogador_id = j.id and status = 'andamento') then raise exception 'jogador_treinando'; end if;
  total := tc_fragmentos_demissao(j);
  reembolso := tc_rescindir(j.id);
  if j.ficticio then
    update tc_jogadores set org_id = null, slot = null, salario = 0, contrato_fim = null where id = j.id; -- o gatilho zera as estrelas
    insert into tc_transf (jogador_id, de_org, tipo) values (j.id, o.id, 'liberado');
  else
    delete from tc_jogadores where id = j.id; -- a cópia do técnico some; o Legado continua no catálogo dos baús
  end if;
  update tc_orgs set fragmentos = fragmentos + total where id = o.id;
  perform tc_avisar(o.id, j.nome || ' foi demitido e rendeu ' || total::text || ' fragmentos de jogador.');
  return jsonb_build_object('ok', true, 'fragmentos_ganhos', total, 'reembolso', reembolso, 'fragmentos', (select fragmentos from tc_orgs where id = o.id));
end;
$$;
revoke all on function public.tc_demitir(bigint) from public, anon;
grant execute on function public.tc_demitir(bigint) to authenticated;

-- Garante cinco titulares: leva o melhor reserva elegível (com contrato vigente, nas equipes de técnicos) ou cria um substituto.
create or replace function public.tc_completar_elenco(oid bigint)
returns int language plpgsql security definer set search_path = public as $$
declare
  v text;
  achou bigint;
  n int := 0;
  tecnico boolean := exists (select 1 from tc_orgs where id = oid and user_id is not null);
begin
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    if not exists (select 1 from tc_jogadores where org_id = oid and slot = v) then
      select id into achou from tc_jogadores j
       where org_id = oid and slot is null and (pos = v or v = any (pos2))
         and (not tecnico or tc_contrato_ativo(j))
       order by (mec + rotas + macro + tf + mental) desc limit 1;
      if achou is not null then
        update tc_jogadores set slot = v where id = achou;
      else
        perform tc_preencher_vaga(oid, v);
      end if;
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.tc_completar_elenco(bigint) from public, anon, authenticated;

-- Fechamento da semana: sem cobrança de salário (já foi pago no contrato). Contrato vencido tira o titular da vaga.
create or replace function public.tc_fechar_semana_org(oid bigint, semana int)
returns void language plpgsql security definer set search_path = public as $$
declare
  j record;
begin
  update tc_orgs set sinergia = least(100, sinergia + ((tc_cfg('sinergia'))->>'ganho_semana')::int) where id = oid;
  for j in select * from tc_jogadores where org_id = oid and contrato_fim is not null and contrato_fim <= semana order by id loop
    update tc_jogadores set slot = null, contrato_fim = null, contrato_valor_semana = 0 where id = j.id;
    perform tc_avisar(oid, 'O contrato de ' || j.nome || ' terminou' || case when j.slot is not null then ' e ele saiu da escalação. Efetive um novo contrato para escalá-lo.' else '.' end);
  end loop;
  perform tc_completar_elenco(oid);
  for j in select nome from tc_jogadores where org_id = oid and slot is not null and contrato_fim = semana + 1 order by id loop
    perform tc_avisar(oid, 'O contrato de ' || j.nome || ' termina na próxima semana.');
  end loop;
end;
$$;
revoke all on function public.tc_fechar_semana_org(bigint, int) from public, anon, authenticated;

create or replace function public.tc_jogador_json(j tc_jogadores, ver_pot boolean default true)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p double precision := tc_poder(j);
  cfg jsonb := tc_cfg('estrelas_jogador');
  legado boolean := not j.ficticio;
begin
  return jsonb_build_object(
    'id', j.id, 'nome', j.nome, 'ficticio', j.ficticio, 'genero', j.genero, 'pos', j.pos, 'pos2', to_jsonb(j.pos2),
    'idade', j.idade, 'regiao', j.regiao, 'retrato', j.retrato,
    'mec', j.mec, 'rotas', j.rotas, 'macro', j.macro, 'tf', j.tf, 'mental', j.mental, 'fama', j.fama,
    'potencial', case when ver_pot then j.potencial else null end,
    'forma', j.forma, 'exp', j.exp, 'poder', round(p)::int,
    'org_id', j.org_id, 'slot', j.slot, 'salario', j.salario, 'contrato_fim', j.contrato_fim,
    'preco', tc_preco(p, j.potencial, j.fama, j.idade),
    'estrela', legado, 'legado', legado,
    'raridade', j.raridade,
    'estrelas', j.estrelas, 'copias', j.copias, 'bonus_estrelas_pct', j.estrelas * (cfg->>'bonus_pct')::int,
    'estrela_max', (cfg->>'max')::int,
    'estrela_custo', case when j.estrelas >= (cfg->>'max')::int then null
                          when legado then j.estrelas + 1
                          else (cfg->'fragmentos'->>(j.estrelas))::int end,
    'frag_demissao', tc_fragmentos_demissao(j),
    'contrato_ativo', tc_contrato_ativo(j), 'contrato_restante', tc_contrato_restante(j), 'contrato_opcoes', tc_contrato_opcoes(j),
    'contrato_valor_semana', j.contrato_valor_semana, 'reembolso_contrato', tc_reembolso_contrato(j),
    'estrela_tipo', case when legado then 'copias' else 'fragmentos' end,
    'preco_rc', tc_estrela_preco_rc(j),
    'venda_rc', case when j.ficticio then null else coalesce(((tc_cfg('estrelas'))->>'venda_rc')::boolean, false) end);
end;
$$;
revoke all on function public.tc_jogador_json(tc_jogadores, boolean) from public, anon, authenticated;

create or replace function public.tc_meu()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  semana int := tc_semana_global();
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then
    return jsonb_build_object('org', null, 'semana', semana, 'nomes', tc_cfg('nomes'), 'rc', coalesce((select saldo from site_carteira where user_id = uid), 0));
  end if;
  return jsonb_build_object(
    'org', jsonb_build_object('id', o.id, 'nome', o.nome, 'sigla', o.sigla, 'escudo', o.escudo, 'cor1', o.cor1, 'cor2', o.cor2,
                              'estilo', o.estilo, 'creditos', o.creditos, 'divisao', o.divisao, 'sinergia', o.sinergia, 'fragmentos', o.fragmentos),
    'poder', round(tc_poder_org(o.id)::numeric, 1),
    'completo', tc_elenco_completo(o.id),
    'semana', semana,
    'nomes', tc_cfg('nomes'),
    'elenco', coalesce((select jsonb_agg(tc_jogador_json(j) order by (j.slot is null), j.pos) from tc_jogadores j where j.org_id = o.id), '[]'::jsonb),
    'elenco_max', ((tc_cfg('elenco'))->>'max')::int, 'reservas_max', ((tc_cfg('elenco'))->>'reservas')::int, 'ativos', coalesce((select jsonb_agg(a) from tc_ativos(o.id) a), '[]'::jsonb),
    'salarios_semana', coalesce((select sum(contrato_valor_semana) from tc_jogadores j where org_id = o.id and tc_contrato_ativo(j)), 0),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'criado', a.criado, 'lido', a.lido) order by a.id desc)
                         from (select * from tc_avisos where org_id = o.id order by id desc limit 15) a), '[]'::jsonb),
    'rc', coalesce((select saldo from site_carteira where user_id = uid), 0));
end;
$$;
revoke all on function public.tc_meu() from public, anon;
grant execute on function public.tc_meu() to authenticated;

-- Legados começam sem maestria com nenhum campeão: ela é construída aos poucos pelo técnico.
create or replace function public.tc_semear_campeoes(jid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  j tc_jogadores;
  n int; i int; c text;
  pool text[];
begin
  select * into j from tc_jogadores where id = jid;
  if j.id is null or not j.ficticio or exists (select 1 from tc_maestria where jogador_id = jid) then return; end if;
  select array_agg(id order by md5(id || ':' || jid::text)) into pool
    from tc_campeoes where ativo and (j.pos = any(posicoes) or posicoes && j.pos2);
  if pool is null then return; end if;
  n := least(array_length(pool, 1), 3 + floor(tc_u('mae:n:' || jid::text, 1) * 3)::int);
  for i in 1..n loop
    c := pool[i];
    insert into tc_maestria (jogador_id, campeao_id, pontos, jogos, vitorias)
      values (jid, c, greatest(0, round((j.exp * 22 + tc_u('mae:p:' || jid::text, i) * 700) / (1 + (i - 1) * 0.55))::int), 0, 0);
  end loop;
  perform tc_recalcular_favoritos(jid);
end;
$$;
revoke all on function public.tc_semear_campeoes(bigint) from public, anon, authenticated;
delete from public.tc_maestria where jogador_id in (select id from public.tc_jogadores where not ficticio and exists (select 1 from public.tc_maestria m where m.jogador_id = tc_jogadores.id and m.jogos = 0));

-- Titulares que já estavam escalados sem contrato (Legados antigos) ganham 4 semanas de cortesia para não travar a escalação.
update public.tc_jogadores set contrato_fim = tc_semana_global() + 4
 where org_id is not null and slot is not null and contrato_fim is null;
