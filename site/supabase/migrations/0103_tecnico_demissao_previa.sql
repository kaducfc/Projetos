-- Simulador de Técnico: o cálculo dos fragmentos de uma demissão vira função própria, para a ficha mostrar o valor exato
-- antes de confirmar (campo frag_demissao do jogador). Rode depois do 0102. Idempotente.

create or replace function public.tc_fragmentos_demissao(j tc_jogadores)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb := tc_cfg('estrelas_jogador');
  base int;
  devolvido int := 0;
  total int;
  i int;
begin
  base := greatest(1, round(power(tc_poder(j) / 100.0, 2.5) * (cfg->>'frag_base')::numeric)::int);
  for i in 0..(j.estrelas - 1) loop
    devolvido := devolvido + round((cfg->'fragmentos'->>i)::numeric * (cfg->>'devolucao_pct')::numeric / 100)::int;
  end loop;
  total := base + devolvido;
  if not j.ficticio then total := round(total * (1 + coalesce((cfg->>'bonus_legado_pct')::numeric, 0) / 100))::int; end if;
  return total;
end;
$$;
revoke all on function public.tc_fragmentos_demissao(tc_jogadores) from public, anon, authenticated;

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
    'estrela_tipo', case when legado then 'copias' else 'fragmentos' end,
    'preco_rc', tc_estrela_preco_rc(j),
    'venda_rc', case when j.ficticio then null else coalesce(((tc_cfg('estrelas'))->>'venda_rc')::boolean, false) end);
end;
$$;
revoke all on function public.tc_jogador_json(tc_jogadores, boolean) from public, anon, authenticated;

create or replace function public.tc_demitir(jogador bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  cfg jsonb := tc_cfg('estrelas_jogador');
  total int;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if j.slot is not null then raise exception 'jogador_titular'; end if;
  if exists (select 1 from tc_treinos where jogador_id = j.id and status = 'andamento') then raise exception 'jogador_treinando'; end if;
  total := tc_fragmentos_demissao(j);
  if j.ficticio then
    update tc_jogadores set org_id = null, slot = null, salario = 0, contrato_fim = null where id = j.id; -- o gatilho zera as estrelas
    insert into tc_transf (jogador_id, de_org, tipo) values (j.id, o.id, 'liberado');
  else
    delete from tc_jogadores where id = j.id; -- a cópia do técnico some; o Legado continua no catálogo dos baús
  end if;
  update tc_orgs set fragmentos = fragmentos + total where id = o.id;
  perform tc_avisar(o.id, j.nome || ' foi demitido e rendeu ' || total::text || ' fragmentos de jogador.');
  return jsonb_build_object('ok', true, 'fragmentos_ganhos', total, 'fragmentos', (select fragmentos from tc_orgs where id = o.id));
end;
$$;
revoke all on function public.tc_demitir(bigint) from public, anon;
grant execute on function public.tc_demitir(bigint) to authenticated;
