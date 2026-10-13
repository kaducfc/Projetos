-- =====================================================================
-- Conexões do League na ranqueada (1 partida por dia). Rodar depois da 0074 e ANTES da 0076 (os dados dos grupos).
-- Rodar de novo é seguro.
--
-- Regras:
--   * 1 partida ranqueada por dia (a primeira). O quebra-cabeça é sorteado AQUI no servidor, para cada jogador
--     (ninguém consegue passar as respostas para outro), e só os grupos acertados voltam para o navegador.
--   * No máximo 3 erros: o 4º erro perde a partida. Palpite repetido não conta.
--   * Dicas por partida: 1 (2 do Platina para cima). Cada dica custa 5 pontos.
--   * Pontos da partida: 100 − 10 por erro − 5 por dica; perdeu = 0 (igual a pontos() em jogos/conexoes/js/logic.js).
--   * PDR de tabela pelos pontos (antes do % do elo; igual a baseConexoes() em shared/ranked.js):
--       perfeito 100 → +30 · 95 → +22 · 90 → +15 · 80 → +5 · 70 → −10 (reta entre eles; abaixo de 70 vale −10) · perdeu → −20
--   * Começou e não terminou até a meia-noite: perdeu (−20).
--   * O PDR é lançado aqui, quando a partida acaba (ganhou ou perdeu).
-- =====================================================================

create table if not exists public.site_conexoes_grupos (
  id int primary key,
  dif int not null check (dif between 1 and 4),
  fam text not null,
  tit text not null,
  campeao boolean not null default false,   -- família de nomes de campeões (no máximo 2 por quebra-cabeça)
  p text[] not null,                        -- as palavras
  chaves text[] not null                    -- as mesmas palavras sem acento e em minúsculas (para não repetir)
);
alter table public.site_conexoes_grupos enable row level security;

create table if not exists public.site_conexoes (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  grupos jsonb not null,                    -- [{id, tit, dif, ordem, palavras}] na ordem de dificuldade (0 a 3)
  palavras jsonb not null,                  -- as 16 palavras, na ordem em que aparecem
  resolvidos jsonb not null default '[]'::jsonb,  -- ordens (0 a 3) já acertadas, na ordem em que foram achadas
  historico jsonb not null default '[]'::jsonb,   -- [{tipo:'ok', ordem} | {tipo:'erro', palavras} | {tipo:'dica'}]
  marcadas jsonb not null default '[]'::jsonb,    -- palavras marcadas pelas dicas
  erros int not null default 0,
  max_dicas int not null default 1,
  status text not null default 'novo' check (status in ('novo', 'jogando', 'ganhou', 'perdeu')),
  pontos int,
  base int,
  pdr int,
  terminado timestamptz,
  criado timestamptz not null default now(),
  primary key (user_id, dia)
);
create index if not exists site_conexoes_status on public.site_conexoes (dia, status);
alter table public.site_conexoes enable row level security;
-- Ninguém lê nem grava direto: só pelas funções abaixo.

-- ----------------------------------------------------------- pontos e PDR de tabela
create or replace function public.site_conexoes_pontos(erros int, dicas int, perdeu boolean)
returns int language sql immutable as $$
  select case when perdeu then 0 else greatest(0, 100 - 10 * erros - 5 * dicas) end;
$$;

create or replace function public.site_conexoes_base(pontos int, perdeu boolean)
returns int language sql immutable as $$
  select case
    when perdeu then -20
    when pontos >= 100 then 30
    when pontos >= 95 then round(22 + (pontos - 95) * 8 / 5.0)::int
    when pontos >= 90 then round(15 + (pontos - 90) * 7 / 5.0)::int
    when pontos >= 80 then round(5 + (pontos - 80) * 10 / 10.0)::int
    when pontos > 70 then round(-10 + (pontos - 70) * 15 / 10.0)::int
    else -10 end;
$$;

-- ----------------------------------------------------------- sorteio do quebra-cabeça
-- Mesma ideia de criarPuzzle() no jogo: 4 grupos de famílias diferentes (no máximo 2 só de campeões) e 4 palavras de cada
-- que não pertencem aos outros 3 grupos escolhidos. `recentes` (títulos dos últimos dias) é evitado enquanto der.
create or replace function public.site_conexoes_sortear(recentes text[])
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  padroes constant int[] := array[1,2,3,4, 1,2,3,3, 1,2,2,3, 1,1,2,3, 2,2,3,4, 1,2,2,4, 2,3,3,4, 1,1,2,2];
  pesos constant int[] := array[28, 20, 16, 10, 10, 8, 4, 4];
  tent int;
  pat int;
  r numeric;
  acc int;
  k int;
  g site_conexoes_grupos;
  escolhidos int[];
  fams text[];
  nomes_campeao int;
  ok boolean;
  sel jsonb;
  ids int[];
  todas_k text[];
  ws text[];
  ks text[];
  lista jsonb;
  d int;
  idx int;
begin
  for tent in 1..400 loop
    -- padrão de dificuldade sorteado pelo peso
    r := random() * 100;
    acc := 0;
    pat := 1;
    for k in 1..8 loop
      acc := acc + pesos[k];
      if r < acc then pat := k; exit; end if;
    end loop;
    escolhidos := '{}'; fams := '{}'; nomes_campeao := 0; ok := true;
    for idx in 1..4 loop
      d := padroes[(pat - 1) * 4 + idx];
      select * into g from site_conexoes_grupos x
       where x.dif = d and x.fam <> all (fams) and x.id <> all (escolhidos)
         and (not x.campeao or nomes_campeao < 2)
         and (tent > 300 or x.tit <> all (coalesce(recentes, '{}')))
       order by random() limit 1;
      if g.id is null then ok := false; exit; end if;
      escolhidos := escolhidos || g.id;
      fams := fams || g.fam;
      if g.campeao then nomes_campeao := nomes_campeao + 1; end if;
    end loop;
    if not ok then continue; end if;
    -- 4 palavras de cada grupo que não estão em nenhum dos outros 3
    lista := '[]'::jsonb; todas_k := '{}';
    for idx in 1..4 loop
      select * into g from site_conexoes_grupos where id = escolhidos[idx];
      select array_agg(x.palavra), array_agg(x.chave) into ws, ks
        from (select g.p[i] as palavra, g.chaves[i] as chave
                from generate_series(1, array_length(g.p, 1)) i
               where not exists (select 1 from site_conexoes_grupos o
                                  where o.id = any (escolhidos) and o.id <> g.id and g.chaves[i] = any (o.chaves))
               order by random() limit 4) x;
      if coalesce(array_length(ws, 1), 0) < 4 then ok := false; exit; end if;
      todas_k := todas_k || ks;
      lista := lista || jsonb_build_object('id', g.id, 'tit', g.tit, 'dif', g.dif, 'ordem', idx - 1, 'palavras', to_jsonb(ws));
    end loop;
    if not ok then continue; end if;
    if (select count(distinct kk.chave) from unnest(todas_k) as kk(chave)) <> 16 then continue; end if;
    return jsonb_build_object(
      'grupos', lista,
      'palavras', (select jsonb_agg(w order by random()) from jsonb_array_elements_text(
                     (select jsonb_agg(p) from jsonb_array_elements(lista) gr, jsonb_array_elements_text(gr->'palavras') p)) w));
  end loop;
  raise exception 'sem_dados';
end;
$$;
revoke all on function public.site_conexoes_sortear(text[]) from public, anon, authenticated;

-- ----------------------------------------------------------- estado (o que a tela recebe)
-- Os grupos que ainda não foram achados NÃO vão para o navegador (só quando a partida acaba, se perdeu).
create or replace function public.site_conexoes_json(c public.site_conexoes)
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'jogo', 'conexoes', 'dia', c.dia, 'status', c.status,
    'erros', c.erros, 'max_erros', 3,
    'max_dicas', c.max_dicas,
    'dicas', (select count(*) from jsonb_array_elements(c.historico) h where h->>'tipo' = 'dica'),
    'palavras', c.palavras,
    'marcadas', c.marcadas,
    'resolvidos', coalesce((select jsonb_agg(c.grupos->(o.v::int) order by o.n)
                              from jsonb_array_elements_text(c.resolvidos) with ordinality o(v, n)), '[]'::jsonb),
    'faltam', case when c.status = 'perdeu' then
                coalesce((select jsonb_agg(gr order by (gr->>'ordem')::int)
                            from jsonb_array_elements(c.grupos) gr
                           where not (c.resolvidos @> (gr->'ordem'))), '[]'::jsonb) end,
    'historico', coalesce((select jsonb_agg(case when h->>'tipo' = 'erro' then jsonb_build_object('tipo', 'erro')
                                                 else h end order by n)
                             from jsonb_array_elements(c.historico) with ordinality x(h, n)), '[]'::jsonb),
    'pontos', c.pontos, 'base', c.base, 'pdr', c.pdr);
$$;
revoke all on function public.site_conexoes_json(public.site_conexoes) from public, anon, authenticated;

-- ----------------------------------------------------------- fim da partida e PDR
create or replace function public.site_conexoes_fechar(uid uuid, d date, venceu boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c site_conexoes;
  dicas int;
  p int;
  b int;
  v int;
  niv int;
begin
  select * into c from site_conexoes where user_id = uid and dia = d for update;
  if c.user_id is null or c.status in ('ganhou', 'perdeu') then
    return;
  end if;
  select count(*) into dicas from jsonb_array_elements(c.historico) h where h->>'tipo' = 'dica';
  p := site_conexoes_pontos(c.erros, dicas, not venceu);
  b := site_conexoes_base(p, not venceu);
  if exists (select 1 from site_ranked_banidos where user_id = uid) then
    update site_conexoes set status = case when venceu then 'ganhou' else 'perdeu' end, terminado = now(), pontos = p, base = b, pdr = 0
     where user_id = uid and dia = d;
    return;
  end if;
  niv := site_rk_nivel_de(uid);
  v := site_rk_ajustar(b, niv);
  update site_conexoes set status = case when venceu then 'ganhou' else 'perdeu' end, terminado = now(), pontos = p, base = b, pdr = v
   where user_id = uid and dia = d;
  insert into site_rk_dia (user_id, dia, jogo, n, base, nivel, pdr, score)
  values (uid, d, 'conexoes', 1, b, niv, v, p)
  on conflict (user_id, dia, jogo, n) do nothing;
  perform site_rk_lancar(uid, d, 'conexoes', 'partida', v);
end;
$$;
revoke all on function public.site_conexoes_fechar(uuid, date, boolean) from public, anon, authenticated;

-- ----------------------------------------------------------- jogar
-- Partida de hoje (sorteia na 1ª vez). Dicas: 1, e 2 do Platina para cima.
create or replace function public.site_conexoes_abrir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  c site_conexoes;
  puz jsonb;
  rec text[];
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform site_rk_processar();
  perform pg_advisory_xact_lock(hashtext('conexoes:' || uid::text));
  select * into c from site_conexoes x where x.user_id = uid and x.dia = hoje;
  if c.user_id is null then
    select coalesce(array_agg(g->>'tit'), '{}') into rec
      from site_conexoes x, jsonb_array_elements(x.grupos) g
     where x.user_id = uid and x.dia >= hoje - 6;
    puz := site_conexoes_sortear(rec);
    insert into site_conexoes (user_id, dia, grupos, palavras, max_dicas)
    values (uid, hoje, puz->'grupos', puz->'palavras', 1 + (site_rk_nivel_de(uid) >= 4)::int)
    on conflict (user_id, dia) do nothing;
    select * into c from site_conexoes x where x.user_id = uid and x.dia = hoje;
  end if;
  return site_conexoes_json(c);
end;
$$;
revoke all on function public.site_conexoes_abrir() from public, anon;
grant execute on function public.site_conexoes_abrir() to authenticated;

-- Confere 4 palavras. Devolve { tipo: 'ok' | 'erro', quase, estado }.
create or replace function public.site_conexoes_tentar(palavras text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  c site_conexoes;
  ordem int;
  achou int := null;
  quase boolean := false;
  conta int;
  ws jsonb;
  w text;
  sorted jsonb;
  tipo text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('conexoes:' || uid::text));
  select * into c from site_conexoes where user_id = uid and dia = hoje for update;
  if c.user_id is null then
    raise exception 'sem_partida';
  end if;
  if c.status in ('ganhou', 'perdeu') then
    raise exception 'partida_encerrada';
  end if;
  if palavras is null or array_length(palavras, 1) <> 4 or (select count(distinct x) from unnest(palavras) x) <> 4 then
    raise exception 'chute_invalido';
  end if;
  ws := to_jsonb(palavras);
  -- as 4 têm que estar no tabuleiro e fora dos grupos já achados
  foreach w in array palavras loop
    if not (c.palavras ? w) then raise exception 'chute_invalido'; end if;
    if exists (select 1 from jsonb_array_elements_text(c.resolvidos) o where (c.grupos->(o::int)->'palavras') ? w) then
      raise exception 'chute_invalido';
    end if;
  end loop;
  select jsonb_agg(x order by x) into sorted from jsonb_array_elements_text(ws) x;
  if exists (select 1 from jsonb_array_elements(c.historico) h
              where h->>'tipo' = 'erro' and (select jsonb_agg(y order by y) from jsonb_array_elements_text(h->'palavras') y) = sorted) then
    raise exception 'chute_repetido';
  end if;
  -- é um dos grupos que faltam?
  for ordem in 0..3 loop
    if c.resolvidos @> to_jsonb(ordem) then continue; end if;
    select count(*) into conta from jsonb_array_elements_text(c.grupos->ordem->'palavras') p where p = any (palavras);
    if conta = 4 then achou := ordem; exit; end if;
    if conta = 3 then quase := true; end if;
  end loop;
  if achou is not null then
    tipo := 'ok';
    c.resolvidos := c.resolvidos || to_jsonb(achou);
    c.historico := c.historico || jsonb_build_object('tipo', 'ok', 'ordem', achou);
    update site_conexoes set resolvidos = c.resolvidos, historico = c.historico, status = 'jogando'
     where user_id = uid and dia = hoje;
    if jsonb_array_length(c.resolvidos) = 4 then
      perform site_conexoes_fechar(uid, hoje, true);
    end if;
  else
    tipo := 'erro';
    update site_conexoes set erros = erros + 1, status = 'jogando',
           historico = historico || jsonb_build_object('tipo', 'erro', 'palavras', ws)
     where user_id = uid and dia = hoje;
    if c.erros + 1 > 3 then
      perform site_conexoes_fechar(uid, hoje, false);
    end if;
  end if;
  perform site_rk_ativo(uid, hoje);
  select * into c from site_conexoes where user_id = uid and dia = hoje;
  return jsonb_build_object('tipo', tipo, 'quase', quase and tipo = 'erro', 'estado', site_conexoes_json(c));
end;
$$;
revoke all on function public.site_conexoes_tentar(text[]) from public, anon;
grant execute on function public.site_conexoes_tentar(text[]) to authenticated;

-- Dica: marca 2 palavras do primeiro grupo que falta e, na dica seguinte do mesmo grupo, mais 1 (até 3).
create or replace function public.site_conexoes_dica()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  c site_conexoes;
  usadas int;
  ordem int;
  ja int;
  novas jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('conexoes:' || uid::text));
  select * into c from site_conexoes where user_id = uid and dia = hoje for update;
  if c.user_id is null then
    raise exception 'sem_partida';
  end if;
  if c.status in ('ganhou', 'perdeu') then
    raise exception 'partida_encerrada';
  end if;
  select count(*) into usadas from jsonb_array_elements(c.historico) h where h->>'tipo' = 'dica';
  if usadas >= c.max_dicas then
    raise exception 'sem_dica';
  end if;
  for ordem in 0..3 loop
    if c.resolvidos @> to_jsonb(ordem) then continue; end if;
    select count(*) into ja from jsonb_array_elements_text(c.grupos->ordem->'palavras') p where c.marcadas ? p;
    if ja < 3 then
      select coalesce(jsonb_agg(p), '[]'::jsonb) into novas from (
        select p from jsonb_array_elements_text(c.grupos->ordem->'palavras') p
         where not (c.marcadas ? p) limit case when ja = 0 then 2 else 1 end) q;
      update site_conexoes set marcadas = marcadas || novas, historico = historico || jsonb_build_object('tipo', 'dica'), status = 'jogando'
       where user_id = uid and dia = hoje;
      perform site_rk_ativo(uid, hoje);
      select * into c from site_conexoes where user_id = uid and dia = hoje;
      return site_conexoes_json(c);
    end if;
  end loop;
  raise exception 'sem_dica';
end;
$$;
revoke all on function public.site_conexoes_dica() from public, anon;
grant execute on function public.site_conexoes_dica() to authenticated;

-- ----------------------------------------------------------- integração com o resto da ranqueada
-- Página inicial: situação de hoje (agora com o Conexões também). Mesma função da 0022 + conexoes.
create or replace function public.site_diario_hoje()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select jsonb_object_agg(d.jogo, jsonb_build_object(
           'status', d.status,
           'chutes', jsonb_array_length(d.chutes),
           'tentativas', jsonb_array_length(d.chutes) + case when d.jogo = 'campeao' then jsonb_array_length(d.dicas) else 0 end,
           'pdr', d.pdr))
    from site_diario d
   where d.user_id = auth.uid() and d.dia = site_hoje_br()), '{}'::jsonb)
  || coalesce((select jsonb_build_object('escala', jsonb_build_object(
           'status', case when e.status = 'terminou' then 'terminou' else 'jogando' end,
           'rodadas', e.atual, 'media', e.media, 'pdr', e.pdr))
    from site_escala e where e.user_id = auth.uid() and e.dia = site_hoje_br()), '{}'::jsonb)
  || coalesce((select jsonb_build_object('conexoes', jsonb_build_object(
           'status', c.status, 'erros', c.erros, 'pontos', c.pontos, 'pdr', c.pdr))
    from site_conexoes c where c.user_id = auth.uid() and c.dia = site_hoje_br()), '{}'::jsonb);
$$;
revoke all on function public.site_diario_hoje() from public, anon;
grant execute on function public.site_diario_hoje() to authenticated;

-- Meia-noite: o que ficou em andamento vira derrota (Runetermo, Campeão Oculto, Na Medida e, agora, Conexões).
create or replace function public.site_diario_expirar(d date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in select user_id, jogo from site_diario where dia = d and status = 'jogando' loop
    perform site_diario_fechar(r.user_id, d, r.jogo, 'perdeu');
    n := n + 1;
  end loop;
  for r in select user_id from site_escala where dia = d and status = 'jogando' loop
    perform site_escala_fechar(r.user_id, d);
    n := n + 1;
  end loop;
  for r in select user_id from site_conexoes where dia = d and status = 'jogando' loop
    perform site_conexoes_fechar(r.user_id, d, false);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.site_diario_expirar(date) from public, anon, authenticated;
