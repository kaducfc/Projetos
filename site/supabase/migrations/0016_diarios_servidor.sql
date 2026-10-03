-- =====================================================================
-- Runetermo e Campeão Oculto valendo ranqueada: cada jogador tem a sua
-- palavra / o seu campeão do dia, sorteado e conferido aqui no servidor
-- (a resposta nunca vai para o navegador antes do fim).
--
--   site_diario_abrir(jogo)        → estado de hoje (sorteia na 1ª vez)
--   site_diario_chute(jogo, chute) → confere o chute
--   site_diario_dica()             → Campeão Oculto: revela uma característica
--
-- PDR (de tabela, antes da régua do elo):
--   Runetermo:      acertou em 1..7 → +35 +28 +22 +16 +11 +6 +5
--   Campeão Oculto: acertou em 1..9 → +36 … +5 (−4 por dica, mínimo +5)
--   Errou (ou começou e não terminou até a meia-noite): −25 a −4, conforme
--   quanto já tinha confirmado (letras certas / características certas).
--
-- Como aplicar: cole no SQL Editor do Supabase e clique em Run (depois do
-- 0015). Depois rode o 0017 (lista de palavras e campeões). Rodar de novo é
-- seguro.
-- =====================================================================

create table if not exists public.site_diario_palavras (
  chave text primary key,
  palavra text not null,
  categoria text
);
create table if not exists public.site_diario_campeoes (
  nome text primary key,
  dados jsonb not null
);
create table if not exists public.site_diario (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  jogo text not null check (jogo in ('runetermo', 'campeao')),
  resposta text not null,
  chutes jsonb not null default '[]'::jsonb,
  dicas jsonb not null default '[]'::jsonb,
  max_tentativas int not null,
  max_dicas int not null default 0,
  categoria boolean not null default false,
  status text not null default 'novo' check (status in ('novo', 'jogando', 'ganhou', 'perdeu')),
  base int,
  pdr int,
  terminado timestamptz,
  criado timestamptz not null default now(),
  primary key (user_id, dia, jogo)
);
create index if not exists site_diario_status on public.site_diario (dia, status);
alter table public.site_diario_palavras enable row level security;
alter table public.site_diario_campeoes enable row level security;
alter table public.site_diario enable row level security;

-- ----------------------------------------------------------- comparação
-- Runetermo: 'ok' (lugar certo), 'near' (outro lugar), 'miss'; letras
-- repetidas só contam quantas vezes existem (igual ao jogo).
create or replace function public.site_diario_letras(chute text, resposta text)
returns text[]
language plpgsql immutable as $$
declare
  g text[] := regexp_split_to_array(chute, '');
  a text[] := regexp_split_to_array(resposta, '');
  res text[] := array_fill('miss'::text, array[array_length(g, 1)]);
  sobra jsonb := '{}'::jsonb;
  i int;
  n int;
begin
  for i in 1 .. array_length(a, 1) loop
    if g[i] = a[i] then
      res[i] := 'ok';
    else
      sobra := jsonb_set(sobra, array[a[i]], to_jsonb(coalesce((sobra->>a[i])::int, 0) + 1));
    end if;
  end loop;
  for i in 1 .. array_length(g, 1) loop
    n := coalesce((sobra->>g[i])::int, 0);
    if res[i] <> 'ok' and n > 0 then
      res[i] := 'near';
      sobra := jsonb_set(sobra, array[g[i]], to_jsonb(n - 1));
    end if;
  end loop;
  return res;
end;
$$;

-- Campeão Oculto: colunas na ordem da tela (ano, gênero, região, posição,
-- classe, espécie, alcance). Ano errado diz se o certo é mais novo (up).
create or replace function public.site_diario_comparar(g jsonb, a jsonb)
returns jsonb
language sql immutable as $$
  select jsonb_agg(r order by ord) from (
    select 1 as ord, case when (g->>'ano')::int = (a->>'ano')::int then jsonb_build_object('state', 'ok')
                          else jsonb_build_object('state', 'miss', 'arrow', case when (a->>'ano')::int > (g->>'ano')::int then 'up' else 'down' end) end as r
    union all
    select 2, jsonb_build_object('state', case when g->>'genero' = a->>'genero' then 'ok' else 'miss' end)
    union all
    select k.ord, jsonb_build_object('state',
             case when (g->k.col) @> (a->k.col) and (a->k.col) @> (g->k.col) then 'ok'
                  when exists (select 1 from jsonb_array_elements_text(g->k.col) x where (a->k.col) ? x) then 'part'
                  else 'miss' end)
      from (values (3, 'regioes'), (4, 'posicoes'), (5, 'classes'), (6, 'especies'), (7, 'alcance')) k(ord, col)
  ) t;
$$;

create or replace function public.site_diario_colunas()
returns text[] language sql immutable as $$
  select array['ano', 'genero', 'regioes', 'posicoes', 'classes', 'especies', 'alcance'];
$$;

-- ----------------------------------------------------------- PDR de tabela
create or replace function public.site_diario_base(d public.site_diario)
returns int
language plpgsql stable
set search_path = public
as $$
declare
  t int := jsonb_array_length(d.chutes);
  n int;
  certos int;
  conf numeric;
  resp jsonb;
begin
  if d.status = 'ganhou' then
    if d.jogo = 'runetermo' then
      return (array[35, 28, 22, 16, 11, 6, 5, 5])[least(t, 8)];
    end if;
    return greatest(5, round(36 - (t - 1) * 31 / 7.0)::int - 4 * jsonb_array_length(d.dicas));
  end if;
  -- Errou: quanto já tinha confirmado.
  if d.jogo = 'runetermo' then
    n := length(d.resposta);
    select count(distinct i) into certos
      from jsonb_array_elements_text(d.chutes) c, generate_series(1, n) i
     where substr(c, i, 1) = substr(d.resposta, i, 1);
  else
    n := 7;
    select dados into resp from site_diario_campeoes where nome = d.resposta;
    select count(distinct col) into certos from (
      select (site_diario_colunas())[o.ord] as col
        from jsonb_array_elements_text(d.chutes) c
        join site_diario_campeoes cc on cc.nome = c
        cross join lateral jsonb_array_elements(site_diario_comparar(cc.dados, resp)) with ordinality o(r, ord)
       where o.r->>'state' = 'ok'
      union all
      select x from jsonb_array_elements_text(d.dicas) x
    ) u;
  end if;
  conf := coalesce(certos, 0)::numeric / n;
  return -greatest(4, round(25 * (1 - conf))::int);
end;
$$;

-- ----------------------------------------------------------- estado (tela)
create or replace function public.site_diario_json(d public.site_diario)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  resp jsonb;
  pal site_diario_palavras;
  fim boolean := d.status in ('ganhou', 'perdeu');
begin
  if d.jogo = 'runetermo' then
    select * into pal from site_diario_palavras where chave = d.resposta;
    return jsonb_build_object(
      'jogo', d.jogo, 'dia', d.dia, 'status', d.status, 'tamanho', length(d.resposta),
      'max_tentativas', d.max_tentativas, 'base', d.base, 'pdr', d.pdr,
      'categoria', case when d.categoria or fim then pal.categoria end,
      'chutes', coalesce((select jsonb_agg(jsonb_build_object('chute', c, 'resultado', to_jsonb(site_diario_letras(c, d.resposta))) order by o)
                            from jsonb_array_elements_text(d.chutes) with ordinality x(c, o)), '[]'::jsonb),
      'resposta', case when fim then jsonb_build_object('chave', d.resposta, 'palavra', pal.palavra) end);
  end if;
  select dados into resp from site_diario_campeoes where nome = d.resposta;
  return jsonb_build_object(
    'jogo', d.jogo, 'dia', d.dia, 'status', d.status,
    'max_tentativas', d.max_tentativas, 'max_dicas', d.max_dicas, 'base', d.base, 'pdr', d.pdr,
    'chutes', coalesce((select jsonb_agg(jsonb_build_object('chute', c, 'resultado', site_diario_comparar(cc.dados, resp)) order by o)
                          from jsonb_array_elements_text(d.chutes) with ordinality x(c, o)
                          join site_diario_campeoes cc on cc.nome = x.c), '[]'::jsonb),
    'dicas', coalesce((select jsonb_agg(jsonb_build_object('key', k, 'valor', resp->k) order by o)
                         from jsonb_array_elements_text(d.dicas) with ordinality y(k, o)), '[]'::jsonb),
    'resposta', case when fim then resp || jsonb_build_object('nome', d.resposta) end);
end;
$$;

-- Fecha a partida (ganhou/perdeu) e lança o PDR.
create or replace function public.site_diario_fechar(uid uuid, d_dia date, d_jogo text, status_ text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d site_diario;
  b int;
  v int;
begin
  update site_diario set status = status_, terminado = now()
   where user_id = uid and dia = d_dia and jogo = d_jogo returning * into d;
  b := site_diario_base(d);
  if exists (select 1 from site_ranked_banidos where user_id = uid) then
    update site_diario set base = b, pdr = 0 where user_id = uid and dia = d_dia and jogo = d_jogo;
    return;
  end if;
  v := site_rk_ajustar(b, site_rk_nivel_de(uid));
  update site_diario set base = b, pdr = v where user_id = uid and dia = d_dia and jogo = d_jogo;
  insert into site_rk_dia (user_id, dia, jogo, base, nivel, pdr) values (uid, d_dia, d_jogo, b, site_rk_nivel_de(uid), v)
  on conflict (user_id, dia, jogo) do nothing;
  perform site_rk_lancar(uid, d_dia, d_jogo, 'partida', v);
end;
$$;
revoke all on function public.site_diario_fechar(uuid, date, text, text) from public, anon, authenticated;

-- Começados e não terminados no dia `d`: erro (chamado pela atualização diária).
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
  return n;
end;
$$;
revoke all on function public.site_diario_expirar(date) from public, anon, authenticated;

-- ----------------------------------------------------------- jogar
create or replace function public.site_diario_abrir(jogo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  j text := jogo;
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  d site_diario;
  niv int;
  resp text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if j not in ('runetermo', 'campeao') then
    raise exception 'jogo_invalido';
  end if;
  perform site_rk_processar();
  select * into d from site_diario x where x.user_id = uid and x.dia = hoje and x.jogo = j;
  if d.user_id is null then
    niv := site_rk_nivel_de(uid);
    -- Sorteia uma resposta que a conta não teve nos últimos meses.
    if j = 'runetermo' then
      select chave into resp from site_diario_palavras p
       where not exists (select 1 from site_diario x where x.user_id = uid and x.jogo = 'runetermo' and x.resposta = p.chave and x.dia > hoje - 120)
       order by random() limit 1;
      if resp is null then select chave into resp from site_diario_palavras order by random() limit 1; end if;
    else
      select nome into resp from site_diario_campeoes c
       where not exists (select 1 from site_diario x where x.user_id = uid and x.jogo = 'campeao' and x.resposta = c.nome and x.dia > hoje - 150)
       order by random() limit 1;
      if resp is null then select nome into resp from site_diario_campeoes order by random() limit 1; end if;
    end if;
    if resp is null then
      raise exception 'sem_dados';
    end if;
    insert into site_diario (user_id, dia, jogo, resposta, max_tentativas, max_dicas, categoria)
    values (uid, hoje, j, resp,
            case when j = 'runetermo' then 6 + (niv >= 6)::int else 8 + (niv >= 9)::int end,
            case when j = 'campeao' then 1 + (niv >= 4)::int + (niv >= 5)::int else 0 end,
            j = 'runetermo' and niv >= 2)
    on conflict (user_id, dia, jogo) do nothing;
    select * into d from site_diario x where x.user_id = uid and x.dia = hoje and x.jogo = j;
  end if;
  return site_diario_json(d);
end;
$$;
revoke all on function public.site_diario_abrir(text) from public, anon;
grant execute on function public.site_diario_abrir(text) to authenticated;

create or replace function public.site_diario_chute(jogo text, chute text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  j text := jogo;
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  d site_diario;
  c text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('diario:' || uid::text));
  select * into d from site_diario x where x.user_id = uid and x.dia = hoje and x.jogo = j for update;
  if d.user_id is null then
    raise exception 'sem_partida';
  end if;
  -- No Campeão Oculto cada dica gasta uma tentativa.
  if d.status not in ('novo', 'jogando') or jsonb_array_length(d.chutes) + jsonb_array_length(d.dicas) >= d.max_tentativas then
    raise exception 'partida_encerrada';
  end if;
  if j = 'runetermo' then
    c := upper(chute);
    if c !~ '^[A-Z]+$' or length(c) <> length(d.resposta) then
      raise exception 'chute_invalido';
    end if;
  else
    select nome into c from site_diario_campeoes where nome = chute;
    if c is null then
      raise exception 'chute_invalido';
    end if;
    if d.chutes ? c then
      raise exception 'chute_repetido';
    end if;
  end if;
  update site_diario set chutes = chutes || to_jsonb(c), status = 'jogando'
   where user_id = uid and dia = hoje and jogo = j returning * into d;
  perform site_rk_ativo(uid, hoje);
  if c = d.resposta then
    perform site_diario_fechar(uid, hoje, j, 'ganhou');
  elsif jsonb_array_length(d.chutes) + jsonb_array_length(d.dicas) >= d.max_tentativas then
    perform site_diario_fechar(uid, hoje, j, 'perdeu');
  end if;
  select * into d from site_diario x where x.user_id = uid and x.dia = hoje and x.jogo = j;
  return site_diario_json(d);
end;
$$;
revoke all on function public.site_diario_chute(text, text) from public, anon;
grant execute on function public.site_diario_chute(text, text) to authenticated;

-- Dica do Campeão Oculto: confirma uma característica ainda não confirmada.
create or replace function public.site_diario_dica()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  d site_diario;
  resp jsonb;
  k text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform pg_advisory_xact_lock(hashtext('diario:' || uid::text));
  select * into d from site_diario where user_id = uid and dia = hoje and jogo = 'campeao' for update;
  if d.user_id is null or d.status not in ('novo', 'jogando') then
    raise exception 'partida_encerrada';
  end if;
  if jsonb_array_length(d.dicas) >= d.max_dicas or d.max_tentativas - jsonb_array_length(d.chutes) - jsonb_array_length(d.dicas) <= 1 then
    raise exception 'sem_dica';
  end if;
  select dados into resp from site_diario_campeoes where nome = d.resposta;
  select col into k from (
    select unnest(site_diario_colunas()) as col
  ) t
   where not (d.dicas ? col)
     and not exists (
       select 1 from jsonb_array_elements_text(d.chutes) c join site_diario_campeoes cc on cc.nome = c
        cross join lateral jsonb_array_elements(site_diario_comparar(cc.dados, resp)) with ordinality o(r, ord)
        where (site_diario_colunas())[o.ord] = t.col and o.r->>'state' = 'ok')
   order by random() limit 1;
  if k is null then
    raise exception 'sem_dica';
  end if;
  update site_diario set dicas = dicas || to_jsonb(k), status = 'jogando'
   where user_id = uid and dia = hoje and jogo = 'campeao' returning * into d;
  perform site_rk_ativo(uid, hoje);
  return site_diario_json(d);
end;
$$;
revoke all on function public.site_diario_dica() from public, anon;
grant execute on function public.site_diario_dica() to authenticated;
