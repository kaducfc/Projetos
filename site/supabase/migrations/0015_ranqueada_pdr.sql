-- =====================================================================
-- Ranqueada nova: elos com divisões e PDR (Pontos de Rank), em todos os jogos.
--
-- Escada (coluna site_rk.pts):
--   0 .. 2099  → Ferro 3 … Diamante 1 (7 elos × 3 divisões × 100 PDR).
--                pts = elo*300 + (3 - divisão)*100 + PDR da divisão.
--   2100+      → Mestre (PDR = pts - 2100, sem limite). Grão-Mestre (200
--                vagas, 200+ PDR) e Desafiante (100 vagas, 500+ PDR) saem da
--                atualização diária, pela ordem de PDR (coluna topo).
-- Regras:
--   * Ganhou PDR: soma; passou de 100, sobe de divisão na hora (sobra passa).
--   * Perdeu PDR: desce até 0 na divisão; perdendo com 0, volta para a
--     divisão anterior com 75. Ferro 3 não cai.
--   * Régua: quanto mais alto o elo, menos PDR por vitória e mais por derrota.
--   * Inatividade: do Ouro 3 para cima, depois de 3 dias sem jogar, −25 PDR
--     por dia parado, até no máximo o Ouro 3 com 0 PDR.
--   * Carreira no Rift e Lendas do CBLOL (modo Oculto): valem as 3 primeiras
--     partidas começadas no dia; conta a melhor. Começou e não terminou
--     nenhuma no dia: −15 PDR.
--   * Runetermo e Campeão Oculto: 1 por dia, resposta sorteada para cada
--     jogador e conferida aqui no servidor (0016). Começou e não terminou:
--     conta como erro à meia-noite.
--
-- Como aplicar: cole no SQL Editor do Supabase e clique em Run (depois do
-- 0014). Depois rode o 0016. Rodar de novo é seguro.
-- =====================================================================

-- --------------------------------------------------------------- tabelas
create table if not exists public.site_rk (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pts int not null default 0 check (pts >= 0),
  topo text check (topo in ('mestre', 'grao-mestre', 'desafiante')),
  ultima_atividade date,
  criado timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
create index if not exists site_rk_pts on public.site_rk (pts desc);

-- Cada ganho ou perda de PDR (histórico e rankings por período).
create table if not exists public.site_rk_lanc (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  jogo text,
  motivo text not null, -- partida, melhora, nao_terminou, inatividade, admin
  delta int not null,
  antes int not null,
  depois int not null,
  criado timestamptz not null default now()
);
create index if not exists site_rk_lanc_dia on public.site_rk_lanc (dia, user_id);
create index if not exists site_rk_lanc_user on public.site_rk_lanc (user_id, id desc);

-- Resultado que vale no dia, por jogo (Carreira e Lendas: a melhor das 3).
create table if not exists public.site_rk_dia (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  jogo text not null,
  base int not null,        -- PDR "de tabela" (sem a régua do elo)
  nivel int not null,       -- elo (0 = Ferro … 9 = Desafiante) quando contou
  pdr int not null,         -- PDR que valeu (com a régua)
  score numeric,
  result_id uuid references public.site_game_results(id) on delete set null,
  criado timestamptz not null default now(),
  primary key (user_id, dia, jogo)
);

create table if not exists public.site_rk_config (
  id int primary key default 1 check (id = 1),
  temporada int not null default 1,
  inicio date not null,
  processado date not null
);
insert into public.site_rk_config (id, temporada, inicio, processado)
values (1, 1, site_hoje_br(), site_hoje_br() - 1) on conflict (id) do nothing;

-- Vagas (ingressos) da Carreira e agora também do Lendas do CBLOL.
alter table public.site_ranked_inicios add column if not exists jogo text not null default 'carreira-no-rift';
create index if not exists site_ranked_inicios_jogo on public.site_ranked_inicios (user_id, jogo, dia);

alter table public.site_rk enable row level security;
alter table public.site_rk_lanc enable row level security;
alter table public.site_rk_dia enable row level security;
alter table public.site_rk_config enable row level security;
-- Ninguém lê nem grava direto: só pelas funções abaixo.

-- ----------------------------------------------------- escada e régua
-- Nível do elo: 0 Ferro, 1 Bronze, 2 Prata, 3 Ouro, 4 Platina, 5 Esmeralda,
-- 6 Diamante, 7 Mestre, 8 Grão-Mestre, 9 Desafiante.
create or replace function public.site_rk_nivel(pts int, topo text)
returns int language sql immutable as $$
  select case when pts < 2100 then pts / 300
              when topo = 'desafiante' then 9
              when topo = 'grao-mestre' then 8
              else 7 end;
$$;

create or replace function public.site_rk_elo(pts int, topo text)
returns text language sql immutable as $$
  select (array['ferro', 'bronze', 'prata', 'ouro', 'platina', 'esmeralda', 'diamante', 'mestre', 'grao-mestre', 'desafiante'])
         [site_rk_nivel(pts, topo) + 1];
$$;

-- Régua: quanto o elo "desconta" de cada resultado (calibrada por simulação).
create or replace function public.site_rk_regua(nivel int)
returns int language sql immutable as $$
  select (array[0, 1, 2, 3, 5, 6, 8, 12, 16, 20])[least(greatest(nivel, 0), 9) + 1];
$$;

-- PDR de tabela (base, faixa +5..+38 ou −2..−25) → PDR com a régua do elo.
create or replace function public.site_rk_ajustar(base int, nivel int)
returns int language sql immutable as $$
  -- Escala contínua p: p >= 0 é ganho (+5 + p); p <= −1 é perda (−1 + p).
  select case when p >= 0 then least(38, 5 + p) else greatest(-25, -1 + p) end
    from (select (case when base > 0 then base - 5 else base + 1 end) - site_rk_regua(nivel) as p) x;
$$;

-- Aplica um ganho/perda na escada (regras de subida e queda).
create or replace function public.site_rk_mover(pts int, delta int)
returns int language plpgsql immutable as $$
declare
  pdr int;
begin
  if delta >= 0 then
    return pts + delta;
  end if;
  pdr := case when pts >= 2100 then pts - 2100 else pts % 100 end;
  if pdr > 0 then
    return pts - least(pdr, -delta);   -- para no 0 da divisão
  end if;
  if pts = 0 then
    return 0;                          -- Ferro 3 não cai
  end if;
  return pts - 25;                     -- volta para a divisão anterior com 75
end;
$$;

-- Registra um ganho/perda para a conta (cria a linha na primeira vez).
create or replace function public.site_rk_lancar(uid uuid, d date, jogo_ text, motivo_ text, delta_ int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  antes int;
  depois int;
begin
  insert into site_rk (user_id) values (uid) on conflict (user_id) do nothing;
  select pts into antes from site_rk where user_id = uid for update;
  depois := case when motivo_ = 'inatividade' then greatest(least(antes, 900), antes + delta_)
                 else site_rk_mover(antes, delta_) end;
  update site_rk set pts = depois, atualizado = now(),
         ultima_atividade = case when motivo_ in ('partida', 'melhora', 'nao_terminou')
                                 then greatest(coalesce(ultima_atividade, d), d) else ultima_atividade end
   where user_id = uid;
  insert into site_rk_lanc (user_id, dia, jogo, motivo, delta, antes, depois)
  values (uid, d, jogo_, motivo_, depois - antes, antes, depois);
  return depois;
end;
$$;
revoke all on function public.site_rk_lancar(uuid, date, text, text, int) from public, anon, authenticated;

-- Marca o dia como jogado (começou uma partida que vale ranqueada).
create or replace function public.site_rk_ativo(uid uuid, d date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into site_rk (user_id, ultima_atividade) values (uid, d)
  on conflict (user_id) do update set ultima_atividade = greatest(coalesce(site_rk.ultima_atividade, excluded.ultima_atividade), excluded.ultima_atividade);
$$;
revoke all on function public.site_rk_ativo(uuid, date) from public, anon, authenticated;

create or replace function public.site_rk_nivel_de(uid uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select site_rk_nivel(pts, topo) from site_rk where user_id = uid), 0);
$$;
revoke all on function public.site_rk_nivel_de(uuid) from public, anon, authenticated;

-- ---------------------------------------------- PDR de tabela por jogo
-- Carreira no Rift: pontuação de legado → PDR (400 = +5; 1.100 = +32; 1.600+ = +38).
create or replace function public.site_rk_base_carreira(legado numeric)
returns int language sql immutable as $$
  select case
    when legado >= 1100 then round(32 + least(6, (legado - 1100) * 6 / 500.0))::int
    when legado >= 400 then round(5 + (legado - 400) * 27 / 700.0)::int
    else -round(2 + least(23, (400 - legado) * 23 / 250.0))::int end;
$$;

-- Lendas do CBLOL (modo Oculto): fase alcançada + vitórias na fase de pontos.
create or replace function public.site_rk_base_lendas(resultado text, vitorias int, invicto boolean)
returns int language sql immutable as $$
  select case
    when resultado = 'campeao' and invicto then 35
    when resultado = 'campeao' then 18 + 2 * least(4, greatest(0, vitorias - 3))
    when resultado in ('vice', 'final') then 6 + least(4, greatest(0, vitorias - 3))
    when resultado = 'semi' then -(4 + least(2, greatest(0, 5 - vitorias)))
    when resultado = 'quartas' then -(10 + 2 * least(2, greatest(0, 5 - vitorias)))
    else -(18 + 2 * least(3, greatest(0, 3 - vitorias))) end;
$$;

-- ------------------------------------------------- vagas (Carreira e Lendas)
create or replace function public.site_rk_iniciar(jogo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  feitas int;
  novo uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if jogo not in ('carreira-no-rift', 'cblol') then
    raise exception 'jogo_invalido';
  end if;
  perform site_rk_processar();
  if exists (select 1 from site_ranked_banidos where user_id = uid) then
    return jsonb_build_object('token', null, 'dia', hoje, 'banido', true);
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || uid::text));
  select count(*) into feitas from site_ranked_inicios i where i.user_id = uid and i.dia = hoje and i.jogo = site_rk_iniciar.jogo;
  if feitas >= 3 then
    return jsonb_build_object('token', null, 'dia', hoje, 'numero', null, 'restantes', 0, 'limite', 3);
  end if;
  insert into site_ranked_inicios (user_id, dia, jogo) values (uid, hoje, site_rk_iniciar.jogo) returning id into novo;
  perform site_rk_ativo(uid, hoje);
  return jsonb_build_object('token', novo, 'dia', hoje, 'numero', feitas + 1, 'restantes', 2 - feitas, 'limite', 3);
end;
$$;
revoke all on function public.site_rk_iniciar(text) from public, anon;
grant execute on function public.site_rk_iniciar(text) to authenticated;

-- O jogo antigo (antes desta atualização) chamava sem dizer o jogo.
create or replace function public.site_ranked_iniciar()
returns jsonb language sql security definer set search_path = public as $$
  select site_rk_iniciar('carreira-no-rift');
$$;
revoke all on function public.site_ranked_iniciar() from public, anon;
grant execute on function public.site_ranked_iniciar() to authenticated;

-- ------------------------------- fim de partida (Carreira e Lendas valendo)
create or replace function public.site_ranked_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := site_hoje_br();
  tok text := new.summary->>'ranked';
  usado uuid;
  b int;
  atual site_rk_dia;
  niv int;
  valor int;
begin
  if new.game_id not in ('carreira-no-rift', 'cblol') or new.score is null then
    return new;
  end if;
  if tok is null or tok !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;
  if exists (select 1 from site_ranked_banidos where user_id = new.user_id) then
    return new;
  end if;
  if new.game_id = 'carreira-no-rift' then
    if new.score < 0 or new.score > 3000 then return new; end if;
    b := site_rk_base_carreira(new.score);
  else
    if coalesce(new.summary->>'modo', '') <> 'oculto' then return new; end if;
    b := site_rk_base_lendas(new.summary->>'resultado', coalesce((new.summary->>'vitorias')::int, 0),
                             coalesce((new.summary->>'invicto')::boolean, false));
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || new.user_id::text));
  -- Vaga da própria conta, deste jogo, de hoje, ainda não usada (as 3 primeiras do dia).
  update site_ranked_inicios i set result_id = new.id, usado_em = now()
   where i.id = tok::uuid and i.user_id = new.user_id and i.dia = hoje and i.jogo = new.game_id and i.usado_em is null
  returning i.id into usado;
  if usado is null then
    return new;
  end if;
  if new.game_id = 'carreira-no-rift' then
    -- Mantém a tabela antiga de partidas (painel de vigilância).
    insert into site_ranked_partidas (user_id, dia, score, result_id) values (new.user_id, hoje, round(new.score), new.id);
  end if;
  select * into atual from site_rk_dia d where d.user_id = new.user_id and d.dia = hoje and d.jogo = new.game_id;
  if atual.user_id is null then
    niv := site_rk_nivel_de(new.user_id);
    valor := site_rk_ajustar(b, niv);
    insert into site_rk_dia (user_id, dia, jogo, base, nivel, pdr, score, result_id)
    values (new.user_id, hoje, new.game_id, b, niv, valor, new.score, new.id);
    perform site_rk_lancar(new.user_id, hoje, new.game_id, 'partida', valor);
  elsif b > atual.base then
    -- Resultado melhor que o do dia: soma a diferença (vale a melhor).
    valor := site_rk_ajustar(b, atual.nivel);
    update site_rk_dia set base = b, pdr = valor, score = new.score, result_id = new.id
     where user_id = new.user_id and dia = hoje and jogo = new.game_id;
    perform site_rk_lancar(new.user_id, hoje, new.game_id, 'melhora', valor - atual.pdr);
  else
    perform site_rk_ativo(new.user_id, hoje);
  end if;
  return new;
end;
$$;
drop trigger if exists site_ranked_on_result on public.site_game_results;
create trigger site_ranked_on_result
  after insert on public.site_game_results
  for each row execute function public.site_ranked_registrar();

-- ----------------------------------------------- atualização diária
-- Roda sozinho (preguiçoso) na primeira chamada depois da meia-noite: fecha
-- os dias que passaram (jogo começado e não terminado, inatividade) e
-- refaz Grão-Mestre e Desafiante.
create or replace function public.site_rk_processar()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg site_rk_config;
  hoje date := site_hoje_br();
  d date;
  r record;
  feitos int := 0;
begin
  select * into cfg from site_rk_config where id = 1;
  if cfg.id is null or cfg.processado >= hoje - 1 then
    return 0;
  end if;
  if not pg_try_advisory_xact_lock(hashtext('ranked:processar2')) then
    return 0;
  end if;
  select * into cfg from site_rk_config where id = 1;
  d := cfg.processado + 1;
  while d < hoje loop
    -- Runetermo e Campeão Oculto começados e não terminados: erro.
    if to_regprocedure('public.site_diario_expirar(date)') is not null then
      perform site_diario_expirar(d);
    end if;
    -- Carreira e Lendas: começou (pegou vaga) e não terminou nenhuma no dia.
    for r in
      select distinct i.user_id, i.jogo from site_ranked_inicios i
       where i.dia = d and i.dia >= cfg.inicio
         and not exists (select 1 from site_rk_dia x where x.user_id = i.user_id and x.dia = d and x.jogo = i.jogo)
         and not exists (select 1 from site_ranked_banidos b where b.user_id = i.user_id)
    loop
      insert into site_rk_dia (user_id, dia, jogo, base, nivel, pdr) values (r.user_id, d, r.jogo, -15, site_rk_nivel_de(r.user_id), -15);
      perform site_rk_lancar(r.user_id, d, r.jogo, 'nao_terminou', -15);
    end loop;
    -- Inatividade: Ouro 3 para cima, 4º dia seguido sem jogar em diante.
    for r in
      select user_id from site_rk
       where pts > 900 and coalesce(ultima_atividade, criado::date) <= d - 4
    loop
      perform site_rk_lancar(r.user_id, d, null, 'inatividade', -25);
    end loop;
    d := d + 1;
    feitos := feitos + 1;
  end loop;
  update site_rk_config set processado = hoje - 1 where id = 1;
  -- Mestre / Grão-Mestre / Desafiante pela ordem de PDR.
  update site_rk set topo = null where pts < 2100 and topo is not null;
  with ord as (
    select user_id, pts - 2100 as pdr, row_number() over (order by pts desc, atualizado, user_id) as pos
      from site_rk where pts >= 2100
  ), des as (
    select user_id from ord where pos <= 100 and pdr >= 500
  ), gm as (
    select user_id from (
      select o.user_id, row_number() over (order by o.pos) as pos2
        from ord o where o.pdr >= 200 and o.user_id not in (select user_id from des)
    ) x where pos2 <= 200
  )
  update site_rk s set topo = case when s.user_id in (select user_id from des) then 'desafiante'
                                   when s.user_id in (select user_id from gm) then 'grao-mestre'
                                   else 'mestre' end
   where s.pts >= 2100;
  return feitos;
end;
$$;
revoke all on function public.site_rk_processar() from public, anon;
grant execute on function public.site_rk_processar() to authenticated;

-- ------------------------------------------------------ minha ranqueada
create or replace function public.site_rk_meu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  eu site_rk;
  cfg site_rk_config;
  pos int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform site_rk_processar();
  select * into cfg from site_rk_config where id = 1;
  select * into eu from site_rk where user_id = uid;
  if eu.pts >= 2100 then
    select count(*) + 1 into pos from site_rk where pts > eu.pts;
  end if;
  return jsonb_build_object(
    'temporada', cfg.temporada,
    'jogou', eu.user_id is not null,
    'pts', coalesce(eu.pts, 0),
    'elo', site_rk_elo(coalesce(eu.pts, 0), eu.topo),
    'nivel', site_rk_nivel(coalesce(eu.pts, 0), eu.topo),
    'posicao_topo', pos,
    'ultima_atividade', eu.ultima_atividade,
    'hoje', jsonb_build_object(
      'dia', hoje,
      'pdr', coalesce((select sum(delta) from site_rk_lanc where user_id = uid and dia = hoje), 0),
      'jogos', coalesce((select jsonb_object_agg(jogo, jsonb_build_object('pdr', pdr, 'base', base))
                           from site_rk_dia where user_id = uid and dia = hoje), '{}'::jsonb),
      'vagas', jsonb_build_object(
        'carreira-no-rift', (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje and jogo = 'carreira-no-rift'),
        'cblol', (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje and jogo = 'cblol')),
      'validas', coalesce((select jsonb_agg(r.client_id) from site_ranked_inicios i join site_game_results r on r.id = i.result_id
                            where i.user_id = uid and i.dia = hoje), '[]'::jsonb)),
    'cortes', jsonb_build_object(
      'desafiante', (select min(pts) - 2100 from site_rk where topo = 'desafiante'),
      'grao_mestre', (select min(pts) - 2100 from site_rk where topo = 'grao-mestre'),
      'desafiantes', (select count(*) from site_rk where topo = 'desafiante'),
      'grao_mestres', (select count(*) from site_rk where topo = 'grao-mestre')),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('dia', l.dia, 'jogo', l.jogo, 'motivo', l.motivo, 'delta', l.delta,
                                                               'antes', l.antes, 'depois', l.depois) order by l.id desc)
                             from (select * from site_rk_lanc where user_id = uid order by id desc limit 20) l), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.site_rk_meu() from public, anon;
grant execute on function public.site_rk_meu() to authenticated;

-- --------------------------------------------------------------- rankings
-- periodo: 'geral' (pela escada; elo opcional filtra) ou 'diario',
-- 'semanal', 'mensal' (PDR ganhos no período, já descontadas as perdas).
create or replace function public.site_rk_ranking(periodo text, elo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := site_hoje_br();
  ini date;
  uid uuid := auth.uid();
  lista jsonb;
  eu jsonb;
  total int;
begin
  perform site_rk_processar();
  if periodo = 'geral' then
    create temp table if not exists _rkg (user_id uuid, pts int, topo text, pos int, valor int) on commit drop;
    truncate _rkg;
    insert into _rkg
    select s.user_id, s.pts, s.topo,
           row_number() over (order by site_rk_nivel(s.pts, s.topo) desc, s.pts desc, s.atualizado, s.user_id)::int,
           s.pts
      from site_rk s
     where (elo is null or site_rk_elo(s.pts, s.topo) = elo)
       and not exists (select 1 from site_ranked_banidos b where b.user_id = s.user_id);
  else
    ini := case periodo when 'diario' then hoje
                        when 'semanal' then date_trunc('week', hoje)::date
                        when 'mensal' then date_trunc('month', hoje)::date end;
    if ini is null then
      raise exception 'periodo_invalido';
    end if;
    create temp table if not exists _rkg (user_id uuid, pts int, topo text, pos int, valor int) on commit drop;
    truncate _rkg;
    insert into _rkg
    select l.user_id, s.pts, s.topo, rank() over (order by sum(l.delta) desc)::int, sum(l.delta)::int
      from site_rk_lanc l join site_rk s on s.user_id = l.user_id
     where l.dia between ini and hoje and l.motivo <> 'admin'
       and not exists (select 1 from site_ranked_banidos b where b.user_id = l.user_id)
     group by l.user_id, s.pts, s.topo;
  end if;
  select count(*) into total from _rkg;
  select coalesce(jsonb_agg(jsonb_build_object(
           'pos', k.pos, 'username', p.username, 'avatar', p.avatar, 'apoiador', p.apoio_total > 0,
           'elo', site_rk_elo(k.pts, k.topo), 'pts', k.pts, 'valor', k.valor, 'eu', k.user_id = uid) order by k.pos), '[]'::jsonb)
    into lista
    from (select * from _rkg order by pos limit 100) k
    join site_profiles p on p.id = k.user_id;
  select jsonb_build_object('pos', k.pos, 'valor', k.valor, 'pts', k.pts, 'elo', site_rk_elo(k.pts, k.topo))
    into eu from _rkg k where k.user_id = uid;
  return jsonb_build_object('periodo', periodo, 'elo', elo, 'inicio', coalesce(ini, hoje), 'fim', hoje,
                            'jogadores', total, 'lista', lista, 'eu', eu);
end;
$$;
revoke all on function public.site_rk_ranking(text, text) from public;
grant execute on function public.site_rk_ranking(text, text) to anon, authenticated;

-- ------------------------------------------- zerar (lançamento / temporada)
create or replace function public.site_rk_resetar(nova_temporada int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  hoje date := site_hoje_br();
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  select count(*) into n from site_rk;
  delete from site_rk_lanc;
  delete from site_rk_dia;
  delete from site_rk;
  if to_regclass('public.site_diario') is not null then
    execute 'delete from public.site_diario';
  end if;
  update site_ranked_inicios set usado_em = coalesce(usado_em, now()) where dia = hoje; -- vagas de hoje antes do zerar não valem
  insert into site_rk_config (id, temporada, inicio, processado) values (1, nova_temporada, hoje, hoje - 1)
  on conflict (id) do update set temporada = excluded.temporada, inicio = excluded.inicio, processado = excluded.processado;
  return jsonb_build_object('jogadores_zerados', n, 'temporada', nova_temporada, 'inicio', hoje);
end;
$$;
revoke all on function public.site_rk_resetar(int) from public, anon;
grant execute on function public.site_rk_resetar(int) to authenticated;

-- Elo da própria conta, rápido (barra do site, bônus nos jogos).
create or replace function public.site_rk_eu()
returns jsonb
language sql stable
security definer
set search_path = public
as $$
  select case when s.user_id is null then null
         else jsonb_build_object('elo', site_rk_elo(s.pts, s.topo), 'nivel', site_rk_nivel(s.pts, s.topo), 'pts', s.pts) end
    from (select auth.uid() as uid) u left join site_rk s on s.user_id = u.uid;
$$;
revoke all on function public.site_rk_eu() from public, anon;
grant execute on function public.site_rk_eu() to authenticated;

-- ------------------------------------------------ painel (vigilância)
-- Anular uma partida da Carreira: tira os PDR que ela deu.
create or replace function public.site_admin_ranked_anular(partida bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p site_ranked_partidas;
  d site_rk_dia;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  select * into p from site_ranked_partidas where id = partida;
  if p.id is null then
    return jsonb_build_object('anuladas', 0);
  end if;
  select * into d from site_rk_dia where result_id = p.result_id;
  if d.user_id is not null then
    perform site_rk_lancar(d.user_id, d.dia, d.jogo, 'admin', -d.pdr);
    update site_rk_dia set base = -25, pdr = 0, result_id = null where user_id = d.user_id and dia = d.dia and jogo = d.jogo;
  end if;
  delete from site_ranked_partidas where id = partida;
  return jsonb_build_object('anuladas', 1, 'pdr_tirados', coalesce(d.pdr, 0));
end;
$$;
revoke all on function public.site_admin_ranked_anular(bigint) from public, anon;
grant execute on function public.site_admin_ranked_anular(bigint) to authenticated;

-- Tirar (ou devolver) um jogador da ranqueada: apaga elo e PDR dele.
create or replace function public.site_admin_ranked_banir(nome text, motivo text default null, banir boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  alvo uuid;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  select id into alvo from site_profiles where lower(username) = lower(nome);
  if alvo is null then
    raise exception 'user_not_found';
  end if;
  if banir then
    insert into site_ranked_banidos (user_id, motivo) values (alvo, nullif(trim(motivo), ''))
    on conflict (user_id) do update set motivo = excluded.motivo;
    delete from site_ranked_partidas where user_id = alvo;
    delete from site_rk_lanc where user_id = alvo;
    delete from site_rk_dia where user_id = alvo;
    delete from site_rk where user_id = alvo;
  else
    delete from site_ranked_banidos where user_id = alvo;
  end if;
  return jsonb_build_object('username', nome, 'banido', banir);
end;
$$;
revoke all on function public.site_admin_ranked_banir(text, text, boolean) from public, anon;
grant execute on function public.site_admin_ranked_banir(text, text, boolean) to authenticated;
