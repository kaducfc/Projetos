-- Simulador de Técnico: durante o período de testes os baús custam créditos de equipe (Básico 5, Premium 10).
-- Rode depois do 0103. Idempotente.
-- Para voltar a cobrar em Rift Coins (valores em baus.*.rc):  update tc_config set valor = jsonb_set(valor, '{moeda}', '"rc"') where chave = 'gacha';
-- Para mudar os preços em créditos:                         update tc_config set valor = jsonb_set(valor, '{baus,basico,creditos}', '5') where chave = 'gacha';

update public.tc_config set valor = jsonb_set(jsonb_set(jsonb_set(valor, '{moeda}', '"creditos"'), '{baus,basico,creditos}', '5'), '{baus,premium,creditos}', '10')
 where chave = 'gacha' and not (valor ? 'moeda'); -- só na primeira vez: depois a moeda e os preços são sua escolha

create or replace function public.tc_recrutar_info()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  cfg jsonb := tc_cfg('gacha');
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  return jsonb_build_object(
    'config', cfg,
    'moeda', coalesce(cfg->>'moeda', 'rc'),
    'saldo', case when coalesce(cfg->>'moeda', 'rc') = 'rc' then coalesce((select saldo from site_carteira where user_id = uid), 0) else o.creditos end,
    'saldo_rc', coalesce((select saldo from site_carteira where user_id = uid), 0),
    'elenco', (select count(*) from tc_jogadores where org_id = o.id),
    'elenco_max', ((tc_cfg('elenco'))->>'max')::int,
    'legados', jsonb_build_object(
      'total', (select count(*) from tc_jogadores where not ficticio and legado_base is null),
      'por_raridade', coalesce((select jsonb_object_agg(r, n) from (select raridade as r, count(*) as n from tc_jogadores where not ficticio and legado_base is null and raridade is not null group by raridade) q), '{}'::jsonb)),
    'garantia', coalesce((select jsonb_object_agg(bau, sem_epico) from tc_gacha_pity where org_id = o.id), '{}'::jsonb),
    'meus_legados', coalesce((select jsonb_agg(tc_jogador_json(j) order by j.id) from tc_jogadores j where j.org_id = o.id and not j.ficticio), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_recrutar_info() from public, anon;
grant execute on function public.tc_recrutar_info() to authenticated;

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
  moeda_ text := coalesce(cfg->>'moeda', 'rc');
  unit numeric;
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
  unit := (b->>(case when moeda_ = 'rc' then 'rc' else 'creditos' end))::numeric;
  preco := case when qtd_ = 5 then round(unit * 5 * (1 - (cfg->>'desconto_5')::numeric)) else unit::bigint end;
  select coalesce(sem_epico, 0) into sem from tc_gacha_pity where org_id = o.id and bau = bau_;
  sem := coalesce(sem, 0);
  if moeda_ = 'rc' then
    perform site_moedas_mexer(uid, -preco, 'tecnico_bau', left(bau_ || ':x' || qtd_::text, 200)); -- falta de saldo desfaz tudo
  else
    if o.creditos < preco then raise exception 'creditos_insuficientes'; end if;
    perform tc_creditos_mexer(o.id, -preco, 'bau', left(bau_ || ':x' || qtd_::text, 200));
  end if;
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
      values (j.id, o.id, 'contratacao', round(preco::numeric / qtd_)::bigint, case when moeda_ = 'rc' then 'rc' else 'creditos' end, sal, null, null, uid);
    end if;
    itens := itens || jsonb_build_array(jsonb_build_object('raridade', achada, 'sorteada', rar, 'repetida', repetida, 'jogador', tc_jogador_json(j)));
    sem := case when array_position(ordem, achada) >= 3 then 0 else sem + 1 end;
  end loop;
  insert into tc_gacha_pity (org_id, bau, sem_epico) values (o.id, bau_, sem)
    on conflict (org_id, bau) do update set sem_epico = excluded.sem_epico;
  insert into tc_gacha (org_id, user_id, bau, qtd, custo_rc, resultado, chave) values (o.id, uid, bau_, qtd_, preco, itens, chave_) returning id into gid;
  if moeda_ = 'rc' then select c.saldo into saldo_novo from site_carteira c where c.user_id = uid; else select creditos into saldo_novo from tc_orgs where id = o.id; end if;
  return jsonb_build_object('ok', true, 'id', gid, 'itens', itens, 'preco_rc', preco, 'preco', preco, 'moeda', moeda_, 'saldo', coalesce(saldo_novo, 0), 'saldo_rc', coalesce(saldo_novo, 0), 'garantia', sem);
end;
$$;
revoke all on function public.tc_recrutar(text, int, text) from public, anon;
grant execute on function public.tc_recrutar(text, int, text) to authenticated;
