-- Simulador de Técnico: jogadores LEGADO (antes "Estrela"), Estrelas de evolução, demissão e fragmentos.
-- Rode depois do 0098. Idempotente.
--
--  * Jogador fora da posição perde 25% de eficiência (era 10%; só troca o valor se ainda estiver em 0,9).
--  * Legados viram "modelos" no catálogo: cada técnico que sorteia um recebe a SUA cópia (linha própria, legado_base).
--    Sortear um legado que você já tem rende uma cópia repetida (copias +1), usada para subir as Estrelas dele.
--  * Estrelas (0 a 5): cada uma dá +5% de eficiência em jogo (não muda o Poder/OVR mostrado).
--      - Legado: subir para N estrelas gasta N cópias repetidas (1, 2, 3, 4 e 5).
--      - Comum: gasta fragmentos de jogador (tc_config.estrelas_jogador.fragmentos).
--  * Demitir: jogador comum (reserva) sai do elenco e rende fragmentos de jogador. Legado não é demitido, vendido nem tem contrato.

-- ---------------------------------------------------------------- configuração
update public.tc_config set valor = '0.75'::jsonb where chave = 'fora_posicao' and valor = '0.9'::jsonb;
insert into public.tc_config (chave, valor) values
  ('estrelas_jogador', '{"bonus_pct": 5, "max": 5, "fragmentos": [30, 60, 90, 120, 150], "devolucao_pct": 50, "frag_base": 60, "bonus_legado_pct": 25}'::jsonb)
on conflict (chave) do nothing;
update public.tc_config set valor = valor || '{"bonus_legado_pct": 25}'::jsonb where chave = 'estrelas_jogador' and not (valor ? 'bonus_legado_pct');

-- ---------------------------------------------------------------- colunas
alter table public.tc_jogadores add column if not exists estrelas int not null default 0 check (estrelas between 0 and 5);
alter table public.tc_jogadores add column if not exists copias int not null default 0 check (copias >= 0);
alter table public.tc_jogadores add column if not exists legado_base bigint references public.tc_jogadores(id) on delete set null;
alter table public.tc_orgs add column if not exists fragmentos bigint not null default 0 check (fragmentos >= 0);

-- O nome continua único entre jogadores "originais"; as cópias de legados dos técnicos repetem o nome do modelo.
drop index if exists public.tc_jogadores_nome_lower;
create unique index tc_jogadores_nome_lower on public.tc_jogadores (lower(nome)) where legado_base is null;
create index if not exists tc_jogadores_legado_base on public.tc_jogadores (legado_base, org_id) where legado_base is not null;

-- Legados que já estavam com algum técnico viram cópias; o modelo volta ao catálogo. Sem contrato.
do $$
declare
  r record;
  novo bigint;
begin
  for r in select * from tc_jogadores where not ficticio and legado_base is null and org_id is not null loop
    update tc_jogadores set legado_base = r.id where id = r.id; -- aponta para si só durante a troca (libera o nome)
    insert into tc_jogadores (nome, ficticio, genero, pos, pos2, idade, regiao, retrato, potencial, mec, rotas, macro, tf, mental, fama, forma, exp, raridade)
    values (r.nome, false, r.genero, r.pos, r.pos2, r.idade, r.regiao, r.retrato, r.potencial, r.mec, r.rotas, r.macro, r.tf, r.mental, r.fama, 50, 0, r.raridade)
    returning id into novo;
    update tc_jogadores set legado_base = novo, contrato_fim = null where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------- eficiência (posição e Estrelas)
create or replace function public.tc_eficiencia(j tc_jogadores, vaga text)
returns double precision language sql stable security definer set search_path = public as $$
  select (case when vaga is not null and vaga <> j.pos and not (vaga = any (j.pos2)) then ((tc_cfg('fora_posicao'))::text)::double precision else 1 end)
         * (1 + j.estrelas * ((tc_cfg('estrelas_jogador'))->>'bonus_pct')::double precision / 100);
$$;
revoke all on function public.tc_eficiencia(tc_jogadores, text) from public, anon, authenticated;

-- Poder em campo: Poder individual na vaga, penalidade de posição, forma e a eficiência das Estrelas.
create or replace function public.tc_poder_efetivo(j tc_jogadores, vaga text)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare
  p double precision := tc_poder(j, vaga);
begin
  if vaga <> j.pos and not (vaga = any (j.pos2)) then
    p := p * ((tc_cfg('fora_posicao'))::text)::double precision;
  end if;
  p := p + (j.forma - 50) * ((tc_cfg('forma'))->>'peso')::double precision;
  p := p * (1 + j.estrelas * ((tc_cfg('estrelas_jogador'))->>'bonus_pct')::double precision / 100);
  return least(125, greatest(1, p));
end;
$$;
revoke all on function public.tc_poder_efetivo(tc_jogadores, text) from public, anon, authenticated;

create or replace function public.tc_poder_org(oid bigint)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare
  soma double precision := 0;
  v text;
  j tc_jogadores;
  sin int;
begin
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    select * into j from tc_jogadores where org_id = oid and slot = v;
    soma := soma + case when j.id is null then 1 else tc_poder_efetivo(j, v) end;
  end loop;
  select sinergia into sin from tc_orgs where id = oid;
  return least(125, soma / 5 + coalesce(sin, 0) / 100.0 * ((tc_cfg('sinergia'))->>'max_bonus')::double precision);
end;
$$;
revoke all on function public.tc_poder_org(bigint) from public, anon, authenticated;

create or replace function public.tc_componentes(oid bigint)
returns double precision[] language plpgsql stable security definer set search_path = public as $$
declare
  p double precision := tc_poder_org(oid);
  lane double precision := 0;
  obj double precision := 0;
  tf double precision := 0;
  j tc_jogadores;
  f double precision;
  v text;
  n int := 0;
begin
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    select * into j from tc_jogadores where org_id = oid and slot = v;
    if j.id is not null then
      f := tc_eficiencia(j, v);
      lane := lane + (j.rotas * 0.6 + j.mec * 0.4) * f;
      obj := obj + (j.macro * 0.6 + j.mental * 0.4) * f;
      tf := tf + (j.tf * 0.6 + j.mec * 0.2 + j.mental * 0.2) * f;
      n := n + 1;
    end if;
  end loop;
  if n = 0 then return array[p, 1, 1, 1]; end if;
  lane := lane / n; obj := obj / n; tf := tf / n;
  return array[p, p + (lane - (lane + obj + tf) / 3) * 0.6, p + (obj - (lane + obj + tf) / 3) * 0.6, p + (tf - (lane + obj + tf) / 3) * 0.6];
end;
$$;
revoke all on function public.tc_componentes(bigint) from public, anon, authenticated;

-- A partida jogada no navegador recebe a eficiência de cada titular (posição x Estrelas).
create or replace function public.tc_gameplay_jogadores(oid bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', j.id, 'nome', j.nome, 'pos', j.slot, 'poder', round(tc_poder_efetivo(j, j.slot))::int,
      'eficiencia', round(tc_eficiencia(j, j.slot)::numeric, 4),
      'atributos', jsonb_build_object('mec', j.mec, 'rotas', j.rotas, 'macro', j.macro, 'tf', j.tf, 'mental', j.mental, 'fama', j.fama),
      'favoritos', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'bonus_pct', tc_bonus_nivel(tc_maestria_nivel(m.pontos))) order by m.pontos desc)
                               from tc_maestria m join tc_campeoes c on c.id = m.campeao_id
                              where m.jogador_id = j.id and m.favorito and j.slot = any(c.posicoes)), '[]'::jsonb))
    order by array_position(array['top', 'selva', 'meio', 'atirador', 'suporte'], j.slot)), '[]'::jsonb)
    from tc_jogadores j where j.org_id = oid and j.slot is not null;
$$;
revoke all on function public.tc_gameplay_jogadores(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------- JSON e organização
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
    'salarios_semana', coalesce((select sum(salario) from tc_jogadores where org_id = o.id), 0),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'criado', a.criado, 'lido', a.lido) order by a.id desc)
                         from (select * from tc_avisos where org_id = o.id order by id desc limit 15) a), '[]'::jsonb),
    'rc', coalesce((select saldo from site_carteira where user_id = uid), 0));
end;
$$;
revoke all on function public.tc_meu() from public, anon;
grant execute on function public.tc_meu() to authenticated;

-- Quem sai de uma organização perde as Estrelas de evolução (jogadores comuns). Legados nunca saem.
create or replace function public.tc_jogador_saiu_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.org_id is not null and new.org_id is null and new.ficticio then
    new.estrelas := 0; new.copias := 0;
  end if;
  return new;
end;
$$;
revoke all on function public.tc_jogador_saiu_org() from public, anon, authenticated;
drop trigger if exists tc_jogador_saiu_org on public.tc_jogadores;
create trigger tc_jogador_saiu_org before update of org_id on public.tc_jogadores
  for each row execute function public.tc_jogador_saiu_org();

-- ---------------------------------------------------------------- regras do Legado nas funções antigas
create or replace function public.tc_renovar(jogador bigint, semanas int, chave_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  el jsonb := tc_cfg('elenco');
  custo bigint;
  sal int;
  fim int;
begin
  perform tc_exigir(uid);
  if chave_ is null or char_length(chave_) not between 6 and 60 then raise exception 'chave_invalida'; end if;
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  if exists (select 1 from tc_transf where user_id = uid and chave = chave_) then
    return jsonb_build_object('ja_feito', true);
  end if;
  if semanas is null or semanas < (el->>'contrato_min')::int or semanas > (el->>'contrato_max')::int then
    raise exception 'contrato_invalido';
  end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if not j.ficticio then raise exception 'legado_sem_contrato'; end if;
  sal := tc_salario(tc_preco_jogador(j));
  custo := (sal::bigint * semanas) / 2;
  if o.creditos < custo then raise exception 'creditos_insuficientes'; end if;
  fim := greatest(coalesce(j.contrato_fim, tc_semana_global()), tc_semana_global()) + semanas;
  perform tc_creditos_mexer(o.id, -custo, 'renovacao', j.id::text);
  update tc_jogadores set salario = sal, contrato_fim = fim where id = j.id;
  insert into tc_transf (jogador_id, de_org, para_org, tipo, valor, salario, contrato_fim, chave, user_id)
  values (j.id, o.id, o.id, 'renovacao', custo, sal, fim, chave_, uid);
  return jsonb_build_object('ok', true, 'custo', custo, 'salario', sal, 'contrato_fim', fim);
end;
$$;
revoke all on function public.tc_renovar(bigint, int, text) from public, anon;
grant execute on function public.tc_renovar(bigint, int, text) to authenticated;

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
  if j.contrato_fim is null or j.contrato_fim <= tc_semana_global() then raise exception 'contrato_acabando'; end if;
  if exists (select 1 from tc_anuncios where jogador_id = j.id and status = 'aberto') then raise exception 'ja_anunciado'; end if;
  if (select count(*) from tc_anuncios where vendedor_org = o.id and status = 'aberto') >= 5 then raise exception 'muitos_anuncios'; end if;
  insert into tc_anuncios (jogador_id, vendedor_org, preco_rc) values (j.id, o.id, preco) returning * into a;
  return tc_anuncio_json(a);
end;
$$;
revoke all on function public.tc_anunciar(bigint, bigint) from public, anon;
grant execute on function public.tc_anunciar(bigint, bigint) to authenticated;

-- ---------------------------------------------------------------- Estrelas de evolução
create or replace function public.tc_subir_estrela(jogador bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  cfg jsonb := tc_cfg('estrelas_jogador');
  custo int;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if j.estrelas >= (cfg->>'max')::int then raise exception 'estrelas_no_maximo'; end if;
  if j.ficticio then
    custo := (cfg->'fragmentos'->>(j.estrelas))::int;
    if o.fragmentos < custo then raise exception 'fragmentos_insuficientes'; end if;
    update tc_orgs set fragmentos = fragmentos - custo where id = o.id;
    update tc_jogadores set estrelas = estrelas + 1 where id = j.id;
  else
    custo := j.estrelas + 1; -- 1 cópia para a 1ª estrela, 2 para a 2ª, e assim por diante
    if j.copias < custo then raise exception 'copias_insuficientes'; end if;
    update tc_jogadores set estrelas = estrelas + 1, copias = copias - custo where id = j.id;
  end if;
  select * into j from tc_jogadores where id = j.id;
  perform tc_avisar(o.id, j.nome || ' subiu para ' || j.estrelas::text || ' estrela(s).');
  return jsonb_build_object('ok', true, 'estrelas', j.estrelas, 'copias', j.copias, 'custo', custo,
                            'fragmentos', (select fragmentos from tc_orgs where id = o.id), 'jogador', tc_jogador_json(j));
end;
$$;
revoke all on function public.tc_subir_estrela(bigint) from public, anon;
grant execute on function public.tc_subir_estrela(bigint) to authenticated;

-- ---------------------------------------------------------------- Demitir
create or replace function public.tc_demitir(jogador bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  cfg jsonb := tc_cfg('estrelas_jogador');
  base int;
  devolvido int := 0;
  i int;
  total int;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if j.slot is not null then raise exception 'jogador_titular'; end if;
  if exists (select 1 from tc_treinos where jogador_id = j.id and status = 'andamento') then raise exception 'jogador_treinando'; end if;
  -- fragmentos: por Poder (jogador melhor rende mais) + parte do que foi gasto nas Estrelas dele
  base := greatest(1, round(power(tc_poder(j) / 100.0, 2.5) * (cfg->>'frag_base')::numeric)::int);
  for i in 0..(j.estrelas - 1) loop
    devolvido := devolvido + round((cfg->'fragmentos'->>i)::numeric * (cfg->>'devolucao_pct')::numeric / 100)::int;
  end loop;
  total := base + devolvido;
  if not j.ficticio then total := round(total * (1 + coalesce((cfg->>'bonus_legado_pct')::numeric, 0) / 100))::int; end if; -- Legado rende mais (regra interna)
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

-- ---------------------------------------------------------------- Recrutar: cópias, repetidos e catálogo de Legados
-- A compra direta por RC não existe mais: o legado só vem dos baús.
drop function if exists public.tc_contratar_estrela(bigint, int, text);

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
  if (select count(*) from tc_jogadores where org_id = o.id) + qtd_ > ((tc_cfg('elenco'))->>'max')::int then raise exception 'elenco_cheio'; end if;
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

-- Mercado oficial: a coluna `estrelas` passou a existir, então a variável local mudou de nome.
create or replace function public.tc_mercado_oficial(f jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lim int := 24;
  off int := greatest(0, coalesce((f->>'pagina')::int, 0)) * 24;
  r jsonb;
  com_legado boolean := coalesce(((tc_cfg('estrelas_mercado'))::text)::boolean, false);
begin
  perform tc_exigir(uid);
  perform tc_reabastecer();
  select coalesce(jsonb_agg(x.j order by x.ord1 desc, x.id), '[]'::jsonb) into r
  from (
    select tc_jogador_json(j) as j, j.id,
           case coalesce(f->>'ordem', 'poder')
             when 'poder' then tc_poder(j) when 'potencial' then j.potencial::double precision
             when 'fama' then j.fama::double precision when 'preco' then -tc_preco(tc_poder(j), j.potencial, j.fama, j.idade)::double precision
             when 'idade' then -j.idade::double precision else tc_poder(j) end as ord1
      from tc_jogadores j
     where j.org_id is null
       and (com_legado or j.ficticio)
       and (f->>'pos' is null or f->>'pos' = '' or j.pos = f->>'pos' or f->>'pos' = any (j.pos2))
       and (f->>'poder_min' is null or tc_poder(j) >= (f->>'poder_min')::double precision)
       and (f->>'poder_max' is null or tc_poder(j) <= (f->>'poder_max')::double precision)
       and (f->>'pot_min' is null or j.potencial >= (f->>'pot_min')::int)
       and (f->>'idade_max' is null or j.idade <= (f->>'idade_max')::int)
       and (f->>'fama_min' is null or j.fama >= (f->>'fama_min')::int)
       and (f->>'preco_max' is null or tc_preco(tc_poder(j), j.potencial, j.fama, j.idade) <= (f->>'preco_max')::bigint)
       and (f->>'busca' is null or f->>'busca' = '' or j.nome ilike '%' || replace(replace(f->>'busca', '%', ''), '_', '') || '%')
       and (f->>'mec_min' is null or j.mec >= (f->>'mec_min')::int)
       and (f->>'rotas_min' is null or j.rotas >= (f->>'rotas_min')::int)
       and (f->>'macro_min' is null or j.macro >= (f->>'macro_min')::int)
       and (f->>'tf_min' is null or j.tf >= (f->>'tf_min')::int)
       and (f->>'mental_min' is null or j.mental >= (f->>'mental_min')::int)
     order by 3 desc, j.id
     limit lim offset off) x;
  return r;
end;
$$;
revoke all on function public.tc_mercado_oficial(jsonb) from public, anon;
grant execute on function public.tc_mercado_oficial(jsonb) to authenticated;
