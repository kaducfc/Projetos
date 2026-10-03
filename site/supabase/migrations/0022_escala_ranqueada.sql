-- Escala de Runeterra na ranqueada. Rodar depois da 0021 e ANTES da 0023
-- (a 0023 traz a tabela de alturas).
--
-- Regras:
--   * 1 partida ranqueada por dia (a primeira), com 5 rodadas.
--   * As rodadas são sorteadas aqui no servidor, para cada jogador (ninguém
--     consegue passar as respostas para outro), e a próxima só aparece depois
--     de responder a atual.
--   * Cada rodada tem 60 segundos (com 5 de folga para a internet). Passou
--     disso, a rodada vale 0.
--   * O palpite chega como proporção (vermelho ÷ azul); a nota é calculada
--     aqui, com as alturas guardadas aqui.
--   * Começou e não terminou até a meia-noite: o que faltou vale 0.
--   * PDR pela média das 5 rodadas: média 45 = +5; 100 = +38; abaixo de 45
--     perde (44 = −3 … 0 = −25). Os ganhos ainda passam pelo % do elo.

create table if not exists public.site_escala_itens (
  id text primary key,
  nome text not null,
  altura numeric not null check (altura > 0)
);
alter table public.site_escala_itens enable row level security;

create table if not exists public.site_escala (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  rodadas jsonb not null,           -- [{ref, alvo, razao, palpite, pontos, esgotou}]
  atual int not null default 0,     -- rodada em jogo (0 a 4); 5 = terminou
  mostrada_em timestamptz not null default now(),
  status text not null default 'jogando' check (status in ('jogando', 'terminou')),
  media numeric,
  base int,
  pdr int,
  criado timestamptz not null default now(),
  terminado timestamptz,
  primary key (user_id, dia)
);
alter table public.site_escala enable row level security;
-- Ninguém lê nem grava direto: só pelas funções abaixo.

-- Pontos de 0 a 100 (igual a pontos() em jogos/escala/js/logic.js).
create or replace function public.site_escala_pontos(palpite numeric, certo numeric, razao numeric)
returns int language sql immutable as $$
  select case when palpite <= 0 or certo <= 0 then 0 else
    round(100 * greatest(0, 1 - abs(ln(palpite / certo)) / (ln(3) * (1 + 0.35 * ln(greatest(1, razao))))))::int end;
$$;

-- Média das 5 rodadas → PDR de tabela.
create or replace function public.site_escala_base(media numeric)
returns int language sql immutable as $$
  select case when media >= 45 then round(5 + (least(media, 100) - 45) * 33 / 55.0)::int
              else -round(2 + (45 - greatest(media, 0)) * 23 / 45.0)::int end;
$$;

-- Sorteia as 5 rodadas: alvos diferentes e proporção entre 1,15× e 12×.
create or replace function public.site_escala_sortear()
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  out jsonb := '[]'::jsonb;
  usados text[] := '{}';
  a site_escala_itens;
  r site_escala_itens;
  tentativas int := 0;
begin
  while jsonb_array_length(out) < 5 and tentativas < 200 loop
    tentativas := tentativas + 1;
    select * into a from site_escala_itens where id <> all(usados) order by random() limit 1;
    exit when a.id is null;
    select * into r from site_escala_itens x
     where x.id <> a.id
       and greatest(x.altura, a.altura) / least(x.altura, a.altura) between 1.15 and 12
     order by random() limit 1;
    continue when r.id is null;
    usados := usados || a.id;
    out := out || jsonb_build_array(jsonb_build_object(
      'ref', r.id, 'alvo', a.id,
      'razao', greatest(r.altura, a.altura) / least(r.altura, a.altura),
      'palpite', null, 'pontos', null, 'esgotou', false));
  end loop;
  if jsonb_array_length(out) < 5 then
    raise exception 'sem_dados';
  end if;
  return out;
end;
$$;
revoke all on function public.site_escala_sortear() from public, anon, authenticated;

-- Estado para a tela: rodadas já respondidas (com as alturas) e a atual
-- (só os nomes, sem altura nenhuma).
create or replace function public.site_escala_json(e public.site_escala)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'dia', e.dia, 'status', e.status, 'atual', e.atual, 'limite', 60,
    'restante', case when e.status = 'jogando'
                     then greatest(0, 60 - extract(epoch from now() - e.mostrada_em))::int end,
    'media', e.media, 'base', e.base, 'pdr', e.pdr,
    'rodadas', coalesce((
      select jsonb_agg(case
        when x.i - 1 < e.atual then jsonb_build_object(
          'ref', x.r->>'ref', 'alvo', x.r->>'alvo',
          'ref_altura', (select altura from site_escala_itens where id = x.r->>'ref'),
          'alvo_altura', (select altura from site_escala_itens where id = x.r->>'alvo'),
          'palpite', (x.r->>'palpite')::numeric, 'pontos', (x.r->>'pontos')::int,
          'esgotou', coalesce((x.r->>'esgotou')::boolean, false))
        else jsonb_build_object('ref', x.r->>'ref', 'alvo', x.r->>'alvo') end order by x.i)
      from jsonb_array_elements(e.rodadas) with ordinality x(r, i)
      where x.i - 1 <= e.atual), '[]'::jsonb));
$$;
revoke all on function public.site_escala_json(public.site_escala) from public, anon, authenticated;

-- Fecha a partida e lança o PDR.
create or replace function public.site_escala_fechar(uid uuid, d date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e site_escala;
  m numeric;
  b int;
  v int;
begin
  select * into e from site_escala where user_id = uid and dia = d for update;
  if e.user_id is null or e.status = 'terminou' then
    return;
  end if;
  -- Rodadas sem resposta valem 0.
  select coalesce(sum(coalesce((r->>'pontos')::int, 0)), 0) / 5.0 into m from jsonb_array_elements(e.rodadas) r;
  b := site_escala_base(m);
  if exists (select 1 from site_ranked_banidos where user_id = uid) then
    update site_escala set status = 'terminou', terminado = now(), atual = 5, media = round(m, 1), base = b, pdr = 0
     where user_id = uid and dia = d;
    return;
  end if;
  v := site_rk_ajustar(b, site_rk_nivel_de(uid));
  update site_escala set status = 'terminou', terminado = now(), atual = 5, media = round(m, 1), base = b, pdr = v
   where user_id = uid and dia = d;
  insert into site_rk_dia (user_id, dia, jogo, base, nivel, pdr, score)
  values (uid, d, 'escala', b, site_rk_nivel_de(uid), v, round(m, 1))
  on conflict (user_id, dia, jogo) do nothing;
  perform site_rk_lancar(uid, d, 'escala', 'partida', v);
end;
$$;
revoke all on function public.site_escala_fechar(uuid, date) from public, anon, authenticated;

-- Rodada mostrada há mais de 65 s sem resposta: vale 0 e passa para a
-- próxima (que começa a contar agora, porque é agora que ela aparece).
create or replace function public.site_escala_vencer(uid uuid, d date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e site_escala;
begin
  select * into e from site_escala where user_id = uid and dia = d for update;
  if e.status = 'jogando' and now() - e.mostrada_em > interval '65 seconds' then
    update site_escala
       set rodadas = jsonb_set(rodadas, array[e.atual::text], (rodadas -> e.atual) || '{"pontos": 0, "esgotou": true}'::jsonb),
           atual = e.atual + 1, mostrada_em = now()
     where user_id = uid and dia = d;
    if e.atual + 1 >= 5 then
      perform site_escala_fechar(uid, d);
    end if;
  end if;
end;
$$;
revoke all on function public.site_escala_vencer(uuid, date) from public, anon, authenticated;

-- ----------------------------------------------------------- jogar
-- comecar = false: só consulta (null se ainda não começou hoje).
-- comecar = true: começa a partida de hoje (a primeira rodada já conta o tempo).
create or replace function public.site_escala_abrir(comecar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  e site_escala;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform site_rk_processar();
  perform pg_advisory_xact_lock(hashtext('escala:' || uid::text));
  select * into e from site_escala where user_id = uid and dia = hoje;
  if e.user_id is null then
    if not comecar then
      return null;
    end if;
    insert into site_escala (user_id, dia, rodadas) values (uid, hoje, site_escala_sortear()) returning * into e;
    perform site_rk_ativo(uid, hoje);
    return site_escala_json(e);
  end if;
  perform site_escala_vencer(uid, hoje);
  select * into e from site_escala where user_id = uid and dia = hoje;
  return site_escala_json(e);
end;
$$;
revoke all on function public.site_escala_abrir(boolean) from public, anon;
grant execute on function public.site_escala_abrir(boolean) to authenticated;

-- Palpite da rodada `rodada` (0 a 4): `razao` = altura do vermelho ÷ altura do azul.
create or replace function public.site_escala_palpite(rodada int, razao numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  e site_escala;
  r jsonb;
  ref_alt numeric;
  alvo_alt numeric;
  palpite numeric;
  pts int;
  esgotou boolean;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if razao is null or razao < 1 / 15.0 or razao > 15 then
    raise exception 'palpite_invalido';
  end if;
  perform pg_advisory_xact_lock(hashtext('escala:' || uid::text));
  select * into e from site_escala where user_id = uid and dia = hoje for update;
  if e.user_id is null then
    raise exception 'sem_partida';
  end if;
  if e.status <> 'jogando' or rodada is distinct from e.atual then
    raise exception 'rodada_encerrada';
  end if;
  r := e.rodadas -> e.atual;
  select altura into ref_alt from site_escala_itens where id = r->>'ref';
  select altura into alvo_alt from site_escala_itens where id = r->>'alvo';
  palpite := round(razao * ref_alt, 3);
  esgotou := now() - e.mostrada_em > interval '65 seconds';
  pts := case when esgotou then 0 else site_escala_pontos(palpite, alvo_alt, (r->>'razao')::numeric) end;
  update site_escala
     set rodadas = jsonb_set(rodadas, array[e.atual::text],
                             r || jsonb_build_object('palpite', palpite, 'pontos', pts, 'esgotou', esgotou)),
         atual = e.atual + 1, mostrada_em = now()
   where user_id = uid and dia = hoje;
  if e.atual + 1 >= 5 then
    perform site_escala_fechar(uid, hoje);
  end if;
  select * into e from site_escala where user_id = uid and dia = hoje;
  return site_escala_json(e);
end;
$$;
revoke all on function public.site_escala_palpite(int, numeric) from public, anon;
grant execute on function public.site_escala_palpite(int, numeric) to authenticated;

-- Página inicial: situação de hoje (agora com a Escala também).
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
    from site_escala e where e.user_id = auth.uid() and e.dia = site_hoje_br()), '{}'::jsonb);
$$;
revoke all on function public.site_diario_hoje() from public, anon;
grant execute on function public.site_diario_hoje() to authenticated;

-- Meia-noite: Runetermo e Campeão Oculto começados e não terminados (como
-- antes) e, agora, Escala começada e não terminada (o que faltou vale 0).
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
  return n;
end;
$$;
revoke all on function public.site_diario_expirar(date) from public, anon, authenticated;
