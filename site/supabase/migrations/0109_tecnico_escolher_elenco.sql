-- Simulador de Técnico: o time novo começa SEM jogadores. Depois de criar o time vem a etapa "Contratar": 15 opções
-- (3 por posição) e o técnico escolhe 5, um de cada posição. Rode depois do 0108. Idempotente. Contas já criadas não mudam.
--  * tc_orgs.elenco_pendente: true até o técnico escolher.
--  * tc_ofertas: os 15 candidatos de cada time novo. Os 10 não escolhidos são apagados (as fotos ficam livres de novo).
--  * Os 5 escolhidos entram como titulares com contrato de cortesia de 12 semanas.

alter table public.tc_orgs add column if not exists elenco_pendente boolean not null default false;

create table if not exists public.tc_ofertas (
  jogador_id bigint primary key references public.tc_jogadores(id) on delete cascade,
  org_id bigint not null references public.tc_orgs(id) on delete cascade
);
create index if not exists tc_ofertas_org on public.tc_ofertas (org_id);
alter table public.tc_ofertas enable row level security;
revoke all on public.tc_ofertas from anon, authenticated;

create or replace function public.tc_elenco_inicial(oid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v text;
  i int;
  ids bigint[];
begin
  perform set_config('tc.oferta', '1', true); -- os candidatos sempre recebem foto, mesmo sobrando poucas
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    for i in 1..3 loop
      ids := tc_gerar_jogadores(1, 42, v, oid);
      update tc_jogadores set salario = tc_salario(tc_preco_jogador(tc_jogadores)), contrato_fim = null, contrato_valor_semana = 0,
             forma = 50, fama = least(fama, 25), slot = null
       where id = ids[1];
      insert into tc_ofertas (jogador_id, org_id) values (ids[1], oid);
    end loop;
  end loop;
  perform set_config('tc.oferta', '', true);
  update tc_orgs set elenco_pendente = true where id = oid;
end;
$$;
revoke all on function public.tc_elenco_inicial(bigint) from public, anon, authenticated;

-- candidatos recebem foto sem respeitar a reserva do mercado
create or replace function public.tc_jogador_retrato_auto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  livres int;
begin
  if new.ficticio and new.retrato is null then
    new.genero := tc_genero_do_jogador(new.id);
    if new.org_id is null or not exists (select 1 from tc_orgs where id = new.org_id and user_id is null) then
      perform pg_advisory_xact_lock(85107);
      if new.org_id is not null and coalesce(current_setting('tc.oferta', true), '') <> '1' then
        select tc_retratos_total('M') + tc_retratos_total('F') - count(*) into livres from tc_jogadores where ficticio and retrato is not null;
        if livres <= coalesce(((tc_cfg('retratos'))->>'reserva_mercado')::int, 30) then return new; end if;
      end if;
      new.retrato := tc_retrato_livre(new.id, new.genero);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.tc_jogador_retrato_auto() from public, anon, authenticated;

-- Escolha dos 5 iniciais: um de cada posição, entre as ofertas do próprio time.
create or replace function public.tc_escolher_elenco_inicial(ids bigint[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  semana int := tc_semana_global();
  j tc_jogadores;
  escolhidos bigint[];
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  if not o.elenco_pendente then raise exception 'elenco_ja_escolhido'; end if;
  select array_agg(distinct x) into escolhidos from unnest(coalesce(ids, '{}')) x;
  if coalesce(array_length(escolhidos, 1), 0) <> 5 then raise exception 'escolha_5'; end if;
  if (select count(*) from tc_ofertas f where f.org_id = o.id and f.jogador_id = any (escolhidos)) <> 5 then raise exception 'jogador_nao_ofertado'; end if;
  if (select count(distinct pos) from tc_jogadores where id = any (escolhidos)) <> 5 then raise exception 'uma_por_posicao'; end if;
  for j in select * from tc_jogadores where id = any (escolhidos) order by id loop
    update tc_jogadores set slot = j.pos, contrato_fim = semana + 12, contrato_valor_semana = 0 where id = j.id;
    insert into tc_transf (jogador_id, para_org, tipo, valor, salario, contrato_fim)
    values (j.id, o.id, 'inicial', 0, j.salario, semana + 12);
  end loop;
  delete from tc_jogadores where id in (select jogador_id from tc_ofertas where org_id = o.id) and id <> all (escolhidos);
  delete from tc_ofertas where org_id = o.id;
  update tc_orgs set elenco_pendente = false where id = o.id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.tc_escolher_elenco_inicial(bigint[]) from public, anon;
grant execute on function public.tc_escolher_elenco_inicial(bigint[]) to authenticated;

create or replace function public.tc_completar_elenco(oid bigint)
returns int language plpgsql security definer set search_path = public as $$
declare
  v text;
  achou bigint;
  n int := 0;
  tecnico boolean := exists (select 1 from tc_orgs where id = oid and user_id is not null);
begin
  if exists (select 1 from tc_orgs where id = oid and elenco_pendente) then return 0; end if; -- ainda escolhendo os 5 iniciais
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

create or replace function public.tc_ativos(oid bigint)
returns setof bigint language sql stable security definer set search_path = public as $$
  select id from tc_jogadores where org_id = oid and slot is not null
  union
  (select id from tc_jogadores j where org_id = oid and slot is null and not exists (select 1 from tc_ofertas f where f.jogador_id = j.id)
    order by (mec + rotas + macro + tf + mental) desc, id limit coalesce(((tc_cfg('elenco'))->>'reservas')::int, 5));
$$;
revoke all on function public.tc_ativos(bigint) from public, anon, authenticated;

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
                              'estilo', o.estilo, 'creditos', o.creditos, 'divisao', o.divisao, 'sinergia', o.sinergia, 'fragmentos', o.fragmentos, 'elenco_pendente', o.elenco_pendente),
    'poder', round(tc_poder_org(o.id)::numeric, 1),
    'completo', tc_elenco_completo(o.id),
    'semana', semana,
    'nomes', tc_cfg('nomes'),
    'elenco', coalesce((select jsonb_agg(tc_jogador_json(j) order by (j.slot is null), j.pos) from tc_jogadores j where j.org_id = o.id and not exists (select 1 from tc_ofertas f where f.jogador_id = j.id)), '[]'::jsonb),
    'ofertas', case when o.elenco_pendente then coalesce((select jsonb_agg(tc_jogador_json(j) order by array_position(array['top','selva','meio','atirador','suporte'], j.pos), j.id) from tc_jogadores j join tc_ofertas f on f.jogador_id = j.id where f.org_id = o.id), '[]'::jsonb) else '[]'::jsonb end,
    'elenco_max', ((tc_cfg('elenco'))->>'max')::int, 'reservas_max', ((tc_cfg('elenco'))->>'reservas')::int, 'ativos', coalesce((select jsonb_agg(a) from tc_ativos(o.id) a), '[]'::jsonb),
    'salarios_semana', coalesce((select sum(contrato_valor_semana) from tc_jogadores j where org_id = o.id and tc_contrato_ativo(j)), 0),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'criado', a.criado, 'lido', a.lido) order by a.id desc)
                         from (select * from tc_avisos where org_id = o.id order by id desc limit 15) a), '[]'::jsonb),
    'rc', coalesce((select saldo from site_carteira where user_id = uid), 0));
end;
$$;
revoke all on function public.tc_meu() from public, anon;
grant execute on function public.tc_meu() to authenticated;
