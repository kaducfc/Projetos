-- Baú de recrutamento: jogador repetido vira só uma cópia (sem custo, sem contrato), mesmo quando o jogador que você já tinha era o próprio modelo do catálogo.
--   * Antes, nesse caso o baú criava um segundo jogador igual (e o "repetido" não era reconhecido).
--   * As transferências do baú passam a ter o tipo 'bau' (no histórico: "Baú de Recrutamento").
--   * Limpeza: jogadores Legados duplicados na mesma equipe são fundidos (a duplicata vira +1 cópia do original) e o que foi pago em
--     contrato da duplicata é devolvido em créditos.
--   * Histórico: as últimas 10 partidas (cada uma com o nome do campeonato, ver tc_partida_json).
-- Rode depois da 0133; seguro rodar de novo.

alter table public.tc_transf drop constraint if exists tc_transf_tipo_check;
alter table public.tc_transf add constraint tc_transf_tipo_check check (tipo in ('inicial', 'contratacao', 'compra_usuario', 'renovacao', 'liberado', 'expirou', 'substituto', 'bau'));
-- as transferências antigas do baú não têm chave (as do mercado têm)
update public.tc_transf set tipo = 'bau' where tipo = 'contratacao' and chave is null and de_org is null and exists (select 1 from tc_jogadores j where j.id = tc_transf.jogador_id and not j.ficticio);

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
    -- já tem o Legado? (a cópia do catálogo, o próprio modelo do catálogo ou o mesmo nome): vira cópia, sem custo nenhum
    select * into j from tc_jogadores where org_id = o.id and not ficticio and (id = t.id or legado_base = t.id or nome = t.nome) order by (legado_base is null) desc, id limit 1 for update;
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
      values (j.id, o.id, 'bau', round(preco::numeric / qtd_)::bigint, case when moeda_ = 'rc' then 'rc' else 'creditos' end, sal, null, null, uid);
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

create or replace function public.tc_historico()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then return jsonb_build_object('org', null); end if;
  return jsonb_build_object(
    'transferencias', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'jogador', jg.nome, 'tipo', t.tipo, 'valor', t.valor, 'moeda', t.moeda,
                                  'de', (select nome from tc_orgs where id = t.de_org), 'para', (select nome from tc_orgs where id = t.para_org), 'criado', t.criado) order by t.id desc)
                                  from (select * from tc_transf where de_org = o.id or para_org = o.id order by id desc limit 20) t join tc_jogadores jg on jg.id = t.jogador_id), '[]'::jsonb),
    'partidas', coalesce((select jsonb_agg(tc_partida_json(p) order by p.dia desc, p.id desc)
                            from (select * from tc_partidas where status = 'concluida' and (org_a = o.id or org_b = o.id) order by dia desc, id desc limit 10) p), '[]'::jsonb),
    'premios', coalesce((select jsonb_agg(jsonb_build_object('liga', l.nome, 'posicao', pr.posicao, 'creditos', pr.creditos, 'pdr', pr.rank_pdr, 'criado', pr.criado) order by pr.criado desc)
                           from tc_premios pr join tc_ligas l on l.id = pr.liga_id where pr.org_id = o.id), '[]'::jsonb),
    'trofeus', coalesce((select jsonb_agg(jsonb_build_object('titulo', t.titulo, 'temporada', t.temporada) order by t.id desc) from tc_trofeus t where t.org_id = o.id), '[]'::jsonb),
    'financas', coalesce((select jsonb_agg(jsonb_build_object('delta', f.delta, 'saldo', f.saldo, 'motivo', f.motivo, 'criado', f.criado) order by f.id desc)
                            from (select * from tc_fin where org_id = o.id order by id desc limit 20) f), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_historico() from public, anon;
grant execute on function public.tc_historico() to authenticated;

-- Limpeza das duplicatas já criadas pelo baú.
do $$
declare
  r record;
  reemb bigint;
  orgs bigint[] := '{}';
begin
  for r in
    select d.id as did, d.org_id as oid, d.copias as dcop,
           (select min(k.id) from tc_jogadores k where k.org_id = d.org_id and not k.ficticio and k.nome = d.nome) as kid
      from tc_jogadores d
     where d.org_id is not null and not d.ficticio
       and exists (select 1 from tc_jogadores k where k.org_id = d.org_id and not k.ficticio and k.nome = d.nome and k.id < d.id)
     order by d.id desc
  loop
    select coalesce(sum(valor), 0) into reemb from tc_transf where jogador_id = r.did and tipo = 'renovacao';
    if reemb > 0 then
      perform tc_creditos_mexer(r.oid, reemb, 'rescisao', r.did::text);
      perform tc_avisar(r.oid, 'Jogador repetido do baú virou cópia: ' || reemb::text || ' créditos de contrato foram devolvidos.');
    end if;
    delete from tc_transf where jogador_id = r.did and tipo = 'renovacao';
    update tc_transf set jogador_id = r.kid where jogador_id = r.did;
    update tc_jogadores set copias = copias + 1 + r.dcop where id = r.kid;
    delete from tc_jogadores where id = r.did;
    if not (r.oid = any(orgs)) then orgs := orgs || r.oid; end if;
  end loop;
  -- vagas que ficaram sem titular são completadas
  perform tc_completar_elenco(o) from unnest(orgs) o;
end;
$$;
