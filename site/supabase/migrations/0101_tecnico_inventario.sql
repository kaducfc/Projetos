-- Simulador de Técnico: inventário de jogadores. Rode depois do 0100. Idempotente.
--
--  * O elenco passa a ter até 50 jogadores (inventário). Para encher, só demitindo ou vendendo.
--  * "Ativos" = 5 titulares + as 5 melhores reservas (por Poder): só eles recebem salário e têm o contrato vencendo.
--    Os demais ficam guardados no inventário, sem custo e sem vencer.
--  * Baú e contratação exigem espaço livre no inventário: abrir 5 baús precisa de 5 vagas. Legado repetido vira cópia (não ocupa espaço depois de sorteado).

update public.tc_config set valor = valor || '{"max": 50, "reservas": 5}'::jsonb where chave = 'elenco';

create or replace function public.tc_ativos(oid bigint)
returns setof bigint language sql stable security definer set search_path = public as $$
  select id from tc_jogadores where org_id = oid and slot is not null
  union
  (select id from tc_jogadores where org_id = oid and slot is null
    order by (mec + rotas + macro + tf + mental) desc, id limit coalesce(((tc_cfg('elenco'))->>'reservas')::int, 5));
$$;
revoke all on function public.tc_ativos(bigint) from public, anon, authenticated;

create or replace function public.tc_fechar_semana_org(oid bigint, semana int)
returns void language plpgsql security definer set search_path = public as $$
declare
  total bigint;
  j record;
begin
  select coalesce(sum(salario), 0) into total from tc_jogadores where org_id = oid and id in (select tc_ativos(oid));
  if total > 0 then
    perform tc_creditos_mexer(oid, -total, 'salarios', semana::text);
  end if;
  -- Sinergia: sobe com a semana juntos.
  update tc_orgs set sinergia = least(100, sinergia + ((tc_cfg('sinergia'))->>'ganho_semana')::int) where id = oid;
  for j in select * from tc_jogadores where org_id = oid and id in (select tc_ativos(oid)) and contrato_fim is not null and contrato_fim <= semana order by id loop
    update tc_jogadores set org_id = null, slot = null, salario = 0, contrato_fim = null where id = j.id;
    insert into tc_transf (jogador_id, de_org, tipo) values (j.id, oid, 'expirou');
    perform tc_avisar(oid, 'O contrato de ' || j.nome || ' terminou e ele voltou ao mercado.');
  end loop;
  perform tc_completar_elenco(oid);
  -- Avisa dos contratos que vencem na próxima semana.
  for j in select nome from tc_jogadores where org_id = oid and id in (select tc_ativos(oid)) and contrato_fim = semana + 1 order by id loop
    perform tc_avisar(oid, 'O contrato de ' || j.nome || ' termina na próxima semana.');
  end loop;
end;
$$;
revoke all on function public.tc_fechar_semana_org(bigint, int) from public, anon, authenticated;

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
    'salarios_semana', coalesce((select sum(salario) from tc_jogadores where org_id = o.id and id in (select tc_ativos(o.id))), 0),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'criado', a.criado, 'lido', a.lido) order by a.id desc)
                         from (select * from tc_avisos where org_id = o.id order by id desc limit 15) a), '[]'::jsonb),
    'rc', coalesce((select saldo from site_carteira where user_id = uid), 0));
end;
$$;
revoke all on function public.tc_meu() from public, anon;
grant execute on function public.tc_meu() to authenticated;

create or replace function public.tc_recrutar(bau_ text, qtd_ int, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  cfg jsonb := tc_cfg('gacha');
  b jsonb;
  ordem text[] := array['comum', 'raro', 'epico', 'lendario', 'mitico'];
  preco bigint;
  g tc_gacha;
  t tc_jogadores;
  j tc_jogadores;
  rar text;
  achada text;
  sem int;
  pity int := (cfg->>'pity_a_cada')::int;
  sal int;
  itens jsonb := '[]'::jsonb;
  i int;
  k int;
  ofs int;
  gid bigint;
  saldo_novo bigint;
  repetida boolean;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  if qtd_ is null or qtd_ not in (1, 5) then raise exception 'quantidade_invalida'; end if;
  b := cfg->'baus'->bau_;
  if b is null then raise exception 'bau_invalido'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into g from tc_gacha where user_id = uid and chave = chave_;
  if g.id is not null then return jsonb_build_object('ja_feito', true, 'itens', g.resultado, 'preco_rc', g.custo_rc); end if;
  if (select count(*) from tc_jogadores where org_id = o.id) + qtd_ > ((tc_cfg('elenco'))->>'max')::int then raise exception 'elenco_cheio'; end if; -- inventário: precisa de espaço para a quantidade pedida
  if not exists (select 1 from tc_jogadores where not ficticio and legado_base is null) then raise exception 'sem_legados'; end if;
  perform pg_advisory_xact_lock(85098);
  preco := case when qtd_ = 5 then round((b->>'rc')::numeric * 5 * (1 - (cfg->>'desconto_5')::numeric)) else (b->>'rc')::bigint end;
  select coalesce(sem_epico, 0) into sem from tc_gacha_pity where org_id = o.id and bau = bau_;
  sem := coalesce(sem, 0);
  perform site_moedas_mexer(uid, -preco, 'tecnico_bau', left(bau_ || ':x' || qtd_::text, 200)); -- falta de saldo desfaz tudo
  for i in 1..qtd_ loop
    rar := tc_gacha_raridade(b->'odds', sem + 1 >= pity);
    achada := null;
    ofs := array_position(ordem, rar);
    for k in 0..4 loop
      foreach achada in array array[ordem[ofs - k], ordem[ofs + k]] loop
        continue when achada is null;
        exit when exists (select 1 from tc_jogadores where not ficticio and legado_base is null and raridade = achada);
        achada := null;
      end loop;
      exit when achada is not null;
    end loop;
    if achada is null then raise exception 'sem_legados'; end if;
    select * into t from tc_jogadores where not ficticio and legado_base is null and raridade = achada order by random() limit 1;
    select * into j from tc_jogadores where legado_base = t.id and org_id = o.id for update;
    if j.id is not null then
      repetida := true;
      update tc_jogadores set copias = copias + 1 where id = j.id returning * into j; -- repetido: vira cópia para subir Estrelas
    else
      repetida := false;
      sal := tc_salario(tc_preco_jogador(t));
      insert into tc_jogadores (nome, ficticio, genero, pos, pos2, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, forma, exp, raridade, org_id, slot, salario, contrato_fim, legado_base)
      values (t.nome, false, t.genero, t.pos, t.pos2, t.idade, t.regiao, t.retrato, t.potencial, t.mec, t.rotas, t.macro, t.tf, t.mental, t.fama, 50, 0, t.raridade, o.id, null, sal, null, t.id)
      returning * into j;
      insert into tc_transf (jogador_id, para_org, tipo, valor, moeda, salario, contrato_fim, chave, user_id)
      values (j.id, o.id, 'contratacao', round(preco::numeric / qtd_)::bigint, 'rc', sal, null, null, uid);
    end if;
    itens := itens || jsonb_build_array(jsonb_build_object('raridade', achada, 'sorteada', rar, 'repetida', repetida, 'jogador', tc_jogador_json(j)));
    sem := case when array_position(ordem, achada) >= 3 then 0 else sem + 1 end;
  end loop;
  insert into tc_gacha_pity (org_id, bau, sem_epico) values (o.id, bau_, sem)
    on conflict (org_id, bau) do update set sem_epico = excluded.sem_epico;
  insert into tc_gacha (org_id, user_id, bau, qtd, custo_rc, resultado, chave) values (o.id, uid, bau_, qtd_, preco, itens, chave_) returning id into gid;
  select c.saldo into saldo_novo from site_carteira c where c.user_id = uid;
  return jsonb_build_object('ok', true, 'id', gid, 'itens', itens, 'preco_rc', preco, 'saldo_rc', coalesce(saldo_novo, 0), 'garantia', sem);
end;
$$;
revoke all on function public.tc_recrutar(text, int, text) from public, anon;
grant execute on function public.tc_recrutar(text, int, text) to authenticated;
