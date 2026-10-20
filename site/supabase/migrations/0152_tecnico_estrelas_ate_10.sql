-- Simulador de Técnico: Estrelas até 10, custo em fragmentos por raridade e demissão que rende mais para Legados. Rode depois do 0151. Idempotente.
--  * Estrelas: de 0 a 10, cada uma continua dando +5% de eficiência (até +50%). A barra mostra 5 estrelas amarelas; da 6ª em diante cada estrela nova pinta uma das anteriores de vermelho (feito na tela).
--  * Fragmentos que a demissão rende (base, sem estrelas): Legado por raridade (comum 20, raro 40, épico 80, lendário 160, mítico 320); jogador comum pelo Poder (12 x (Poder/100)^2,5).
--    Além disso volta metade (devolucao_pct) dos fragmentos que foram gastos nas estrelas dele (tc_jogadores.frag_gastos). Cópias gastas em estrelas não voltam.
--  * Custo da estrela N em fragmentos: 3 x N x (base de demissão do jogador). Para o Legado existe também o caminho das cópias: N cópias repetidas para a estrela N.

do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.tc_jogadores'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%estrelas%' loop
    execute format('alter table public.tc_jogadores drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.tc_jogadores add constraint tc_jogadores_estrelas_max check (estrelas between 0 and 10);
alter table public.tc_jogadores add column if not exists frag_gastos int not null default 0;

-- quem já tinha estrelas compradas com fragmentos (jogador comum) mantém o histórico do que gastou, pelos custos antigos (30, 60, 90, 120, 150)
update public.tc_jogadores set frag_gastos = (select coalesce(sum(30 * n), 0) from generate_series(1, estrelas) n)
 where ficticio and estrelas > 0 and frag_gastos = 0;

update public.tc_config set valor = valor || '{"max": 10, "frag_base": 12, "mult_estrela": 3, "devolucao_pct": 50,
    "legado_base": {"comum": 20, "raro": 40, "epico": 80, "lendario": 160, "mitico": 320}}'::jsonb where chave = 'estrelas_jogador';

-- Fragmentos que a demissão rende com 0 estrela (e que servem de base para o custo das estrelas).
create or replace function public.tc_frag_base(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select case when j.ficticio
    then greatest(1, round(power(tc_poder(j) / 100.0, 2.5) * ((tc_cfg('estrelas_jogador'))->>'frag_base')::numeric)::int)
    else coalesce((((tc_cfg('estrelas_jogador'))->'legado_base')->>coalesce(j.raridade, 'comum'))::int, 20) end;
$$;
revoke all on function public.tc_frag_base(tc_jogadores) from public, anon, authenticated;

-- Custo em fragmentos da PRÓXIMA estrela: 3 x N x base.
create or replace function public.tc_estrela_custo_frag(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select (((tc_cfg('estrelas_jogador'))->>'mult_estrela')::numeric * (j.estrelas + 1) * tc_frag_base(j))::int;
$$;
revoke all on function public.tc_estrela_custo_frag(tc_jogadores) from public, anon, authenticated;

create or replace function public.tc_fragmentos_demissao(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select tc_frag_base(j) + round(j.frag_gastos * ((tc_cfg('estrelas_jogador'))->>'devolucao_pct')::numeric / 100)::int;
$$;
revoke all on function public.tc_fragmentos_demissao(tc_jogadores) from public, anon, authenticated;

create or replace function public.tc_jogador_saiu_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.org_id is not null and new.org_id is null then
    if new.ficticio then new.estrelas := 0; new.copias := 0; new.frag_gastos := 0;
    elsif new.estrelas = 0 then new.frag_gastos := 0; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.tc_jogador_saiu_org() from public, anon, authenticated;

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
                          else tc_estrela_custo_frag(j) end,
    'estrela_custo_copias', case when legado and j.estrelas < (cfg->>'max')::int then j.estrelas + 1 else null end,
    'estrela_custo_frag', case when j.estrelas < (cfg->>'max')::int then tc_estrela_custo_frag(j) else null end,
    'frag_base', tc_frag_base(j), 'frag_gastos', j.frag_gastos,
    'frag_demissao', tc_fragmentos_demissao(j),
    'contrato_ativo', tc_contrato_ativo(j), 'contrato_restante', tc_contrato_restante(j), 'contrato_opcoes', tc_contrato_opcoes(j),
    'contrato_valor_semana', j.contrato_valor_semana, 'reembolso_contrato', tc_reembolso_contrato(j),
    'estrela_tipo', case when legado then 'copias' else 'fragmentos' end,
    'preco_rc', tc_estrela_preco_rc(j),
    'venda_rc', case when j.ficticio then null else coalesce(((tc_cfg('estrelas'))->>'venda_rc')::boolean, false) end);
end;
$$;
revoke all on function public.tc_jogador_json(tc_jogadores, boolean) from public, anon, authenticated;

-- Subir a estrela. Legado: via 'copias' (N cópias repetidas) ou via 'fragmentos' (3 x N x base); jogador comum: só fragmentos.
drop function if exists public.tc_subir_estrela(bigint);
create or replace function public.tc_subir_estrela(jogador bigint, via text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  cfg jsonb := tc_cfg('estrelas_jogador');
  custo int;
  forma_ text;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if j.estrelas >= (cfg->>'max')::int then raise exception 'estrelas_no_maximo'; end if;
  forma_ := case when j.ficticio then 'fragmentos' else coalesce(via, 'copias') end;
  if forma_ not in ('copias', 'fragmentos') then raise exception 'via_invalida'; end if;
  if forma_ = 'fragmentos' then
    custo := tc_estrela_custo_frag(j);
    if o.fragmentos < custo then raise exception 'fragmentos_insuficientes'; end if;
    update tc_orgs set fragmentos = fragmentos - custo where id = o.id;
    update tc_jogadores set estrelas = estrelas + 1, frag_gastos = frag_gastos + custo where id = j.id;
  else
    custo := j.estrelas + 1; -- 1 cópia para a 1ª estrela, 2 para a 2ª, e assim por diante
    if j.copias < custo then raise exception 'copias_insuficientes'; end if;
    update tc_jogadores set estrelas = estrelas + 1, copias = copias - custo where id = j.id;
  end if;
  select * into j from tc_jogadores where id = j.id;
  perform tc_avisar(o.id, j.nome || ' subiu para ' || j.estrelas::text || ' estrela(s).');
  return jsonb_build_object('ok', true, 'estrelas', j.estrelas, 'copias', j.copias, 'custo', custo, 'via', forma_,
                            'fragmentos', (select fragmentos from tc_orgs where id = o.id), 'jogador', tc_jogador_json(j));
end;
$$;
revoke all on function public.tc_subir_estrela(bigint, text) from public, anon;
grant execute on function public.tc_subir_estrela(bigint, text) to authenticated;
