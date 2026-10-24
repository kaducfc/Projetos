-- =====================================================================
-- Simulador de Técnico, parte 2: mercado entre usuários (preço fixo em RC).
-- Anúncio, cancelamento e compra. A compra é uma única transação: debita o comprador
-- e credita o vendedor na carteira oficial (site_moedas_mexer), transfere o atleta e
-- encerra o anúncio; qualquer falha desfaz tudo. Rodar depois do 0085. Rodar de novo é seguro.
-- =====================================================================

create table if not exists public.tc_anuncios (
  id bigserial primary key,
  jogador_id bigint not null references public.tc_jogadores(id) on delete cascade,
  vendedor_org bigint not null references public.tc_orgs(id) on delete cascade,
  preco_rc bigint not null check (preco_rc > 0),
  status text not null default 'aberto' check (status in ('aberto', 'vendido', 'cancelado')),
  criado timestamptz not null default now(),
  comprador_org bigint references public.tc_orgs(id) on delete set null,
  taxa_rc bigint,
  vendido_em timestamptz
);
-- Um jogador só pode ter um anúncio aberto: impede vender o mesmo atleta duas vezes.
create unique index if not exists tc_anuncios_um_aberto on public.tc_anuncios (jogador_id) where status = 'aberto';
create index if not exists tc_anuncios_abertos on public.tc_anuncios (preco_rc) where status = 'aberto';
alter table public.tc_anuncios enable row level security;
revoke all on public.tc_anuncios from anon, authenticated;
revoke all on sequence public.tc_anuncios_id_seq from anon, authenticated;

create or replace function public.tc_anuncio_json(a tc_anuncios)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  j tc_jogadores;
  o tc_orgs;
begin
  select * into j from tc_jogadores where id = a.jogador_id;
  select * into o from tc_orgs where id = a.vendedor_org;
  return jsonb_build_object('id', a.id, 'preco_rc', a.preco_rc, 'status', a.status, 'criado', a.criado,
                            'vendedor', jsonb_build_object('id', o.id, 'nome', o.nome, 'sigla', o.sigla, 'escudo', o.escudo, 'cor1', o.cor1, 'cor2', o.cor2),
                            'jogador', tc_jogador_json(j, false));
end;
$$;
revoke all on function public.tc_anuncio_json(tc_anuncios) from public, anon, authenticated;

-- Publica um atleta do próprio elenco por um preço fixo em RC.
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
  if j.contrato_fim is null or j.contrato_fim <= tc_semana_global() then raise exception 'contrato_acabando'; end if;
  if exists (select 1 from tc_anuncios where jogador_id = j.id and status = 'aberto') then raise exception 'ja_anunciado'; end if;
  if (select count(*) from tc_anuncios where vendedor_org = o.id and status = 'aberto') >= 5 then raise exception 'muitos_anuncios'; end if;
  insert into tc_anuncios (jogador_id, vendedor_org, preco_rc) values (j.id, o.id, preco) returning * into a;
  return tc_anuncio_json(a);
end;
$$;
revoke all on function public.tc_anunciar(bigint, bigint) from public, anon;
grant execute on function public.tc_anunciar(bigint, bigint) to authenticated;

create or replace function public.tc_cancelar_anuncio(anuncio bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  a tc_anuncios;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  select * into a from tc_anuncios where id = anuncio for update;
  if a.id is null or a.vendedor_org is distinct from o.id then raise exception 'anuncio_nao_e_seu'; end if;
  if a.status <> 'aberto' then raise exception 'anuncio_encerrado'; end if;
  update tc_anuncios set status = 'cancelado' where id = a.id;
end;
$$;
revoke all on function public.tc_cancelar_anuncio(bigint) from public, anon;
grant execute on function public.tc_cancelar_anuncio(bigint) to authenticated;

-- Lista os anúncios abertos. Filtros: pos, poder_min/max, preco_min/max, fama_min, idade_max, mec_min..mental_min, busca, ordem, pagina.
create or replace function public.tc_mercado_usuarios(f jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  meu bigint;
  off int := greatest(0, coalesce((f->>'pagina')::int, 0)) * 24;
  r jsonb;
begin
  perform tc_exigir(uid);
  select id into meu from tc_orgs where user_id = uid;
  select coalesce(jsonb_agg(x.j || jsonb_build_object('meu', x.meu) order by x.ord desc, x.id), '[]'::jsonb) into r
  from (
    select tc_anuncio_json(a) as j, (a.vendedor_org = meu) as meu, a.id,
           case coalesce(f->>'ordem', 'recente')
             when 'poder' then tc_poder(j)
             when 'preco' then -a.preco_rc::double precision
             when 'fama' then j.fama::double precision
             else extract(epoch from a.criado) end as ord
      from tc_anuncios a join tc_jogadores j on j.id = a.jogador_id
     where a.status = 'aberto'
       and (f->>'pos' is null or f->>'pos' = '' or j.pos = f->>'pos' or f->>'pos' = any (j.pos2))
       and (f->>'poder_min' is null or tc_poder(j) >= (f->>'poder_min')::double precision)
       and (f->>'poder_max' is null or tc_poder(j) <= (f->>'poder_max')::double precision)
       and (f->>'preco_min' is null or a.preco_rc >= (f->>'preco_min')::bigint)
       and (f->>'preco_max' is null or a.preco_rc <= (f->>'preco_max')::bigint)
       and (f->>'fama_min' is null or j.fama >= (f->>'fama_min')::int)
       and (f->>'idade_max' is null or j.idade <= (f->>'idade_max')::int)
       and (f->>'busca' is null or f->>'busca' = '' or j.nome ilike '%' || replace(replace(f->>'busca', '%', ''), '_', '') || '%')
       and (f->>'mec_min' is null or j.mec >= (f->>'mec_min')::int)
       and (f->>'rotas_min' is null or j.rotas >= (f->>'rotas_min')::int)
       and (f->>'macro_min' is null or j.macro >= (f->>'macro_min')::int)
       and (f->>'tf_min' is null or j.tf >= (f->>'tf_min')::int)
       and (f->>'mental_min' is null or j.mental >= (f->>'mental_min')::int)
     order by ord desc, a.id
     limit 24 offset off) x;
  return r;
end;
$$;
revoke all on function public.tc_mercado_usuarios(jsonb) from public, anon;
grant execute on function public.tc_mercado_usuarios(jsonb) to authenticated;

create or replace function public.tc_meus_anuncios()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  meu bigint;
begin
  perform tc_exigir(uid);
  select id into meu from tc_orgs where user_id = uid;
  return coalesce((select jsonb_agg(tc_anuncio_json(a) order by a.id desc)
                     from (select * from tc_anuncios where vendedor_org = meu order by id desc limit 30) a), '[]'::jsonb);
end;
$$;
revoke all on function public.tc_meus_anuncios() from public, anon;
grant execute on function public.tc_meus_anuncios() to authenticated;

-- Compra de um anúncio. Atômica e idempotente (mesma `chave` = mesmo resultado, sem cobrar de novo).
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
  if j.contrato_fim is null or j.contrato_fim <= tc_semana_global() then raise exception 'contrato_acabando'; end if;
  if (select count(*) from tc_jogadores where org_id = comp.id) >= ((tc_cfg('elenco'))->>'max')::int then raise exception 'elenco_cheio'; end if;
  taxa := floor(a.preco_rc * ((tc_cfg('taxa_mercado_pct'))::text)::numeric / 100)::bigint;
  liquido := a.preco_rc - taxa;
  -- Dinheiro: a carteira oficial valida o saldo; se faltar, tudo é desfeito.
  perform site_moedas_mexer(uid, -a.preco_rc, 'tecnico_compra', left('jogador:' || j.id::text, 200));
  perform site_moedas_mexer(ven.user_id, liquido, 'tecnico_venda', left('jogador:' || j.id::text, 200));
  titular := j.slot is not null;
  update tc_jogadores set org_id = comp.id, slot = null where id = j.id;
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
