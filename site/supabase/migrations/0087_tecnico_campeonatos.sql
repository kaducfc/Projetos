-- =====================================================================
-- Simulador de Técnico, parte 3: calendário, ligas semanais, simulação, tabela,
-- promoção/rebaixamento, premiação em créditos e recompensa de Rank.
--
-- Calendário central do servidor: temporada = 4 semanas (28 dias) a partir de tc_config.calendario.inicio.
-- Cada semana há uma liga por divisão (8 equipes, todos contra todos, 7 rodadas, uma por dia, melhor de 3).
-- tc_sincronizar() é idempotente: cria as ligas da semana, processa as partidas do dia (uma única vez) e fecha
-- o que já terminou. Qualquer acesso ao jogo chama a função; o servidor nunca depende do navegador para decidir
-- resultado.
--
-- Rodar depois do 0086. Rodar de novo é seguro.
-- =====================================================================

alter table public.tc_orgs add column if not exists ativa boolean not null default true;

insert into public.tc_config (chave, valor) values
  ('premios', '{"principal": [150000, 100000, 70000, 50000, 35000, 25000, 20000, 15000], "acesso": [60000, 40000, 28000, 20000, 15000, 10000, 8000, 6000]}'::jsonb),
  -- PDR base do Rank por liga concluída (antes do ajuste do elo): 5 + 3 por vitória + bônus por posição, no máximo 38.
  ('rank', '{"base": 5, "por_vitoria": 3, "bonus_pos": [10, 6, 3], "max": 38}'::jsonb)
on conflict (chave) do nothing;

create table if not exists public.tc_ligas (
  id bigserial primary key,
  temporada int not null,
  semana int not null check (semana between 1 and 4),
  divisao text not null check (divisao in ('acesso', 'principal')),
  tipo text not null default 'divisao' check (tipo in ('divisao', 'copa', 'mundial')),
  nome text not null,
  status text not null default 'aberta' check (status in ('aberta', 'encerrada')),
  criado timestamptz not null default now(),
  encerrada_em timestamptz
);
create unique index if not exists tc_ligas_unica on public.tc_ligas (temporada, semana, tipo, divisao);

create table if not exists public.tc_liga_times (
  liga_id bigint not null references public.tc_ligas(id) on delete cascade,
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  semente int not null default 0,
  primary key (liga_id, org_id)
);

create table if not exists public.tc_partidas (
  id bigserial primary key,
  liga_id bigint not null references public.tc_ligas(id) on delete cascade,
  fase text not null default 'rodada',
  rodada int not null,
  dia date not null,
  org_a bigint not null references public.tc_orgs(id) on delete cascade,
  org_b bigint not null references public.tc_orgs(id) on delete cascade,
  formato int not null default 3 check (formato in (3, 5)),
  status text not null default 'agendada' check (status in ('agendada', 'concluida')),
  placar_a int,
  placar_b int,
  vencedor bigint references public.tc_orgs(id) on delete set null,
  poder_a numeric(5, 1),
  poder_b numeric(5, 1),
  resumo jsonb,
  processada timestamptz,
  check (org_a <> org_b)
);
create unique index if not exists tc_partidas_unica on public.tc_partidas (liga_id, fase, rodada, org_a, org_b);
create index if not exists tc_partidas_dia on public.tc_partidas (dia) where status = 'agendada';

-- Uma linha por (liga, equipe, tipo): impede premiar ou lançar Rank duas vezes.
create table if not exists public.tc_premios (
  liga_id bigint not null references public.tc_ligas(id) on delete cascade,
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  posicao int not null,
  creditos bigint not null default 0,
  rank_base int,
  rank_pdr int,
  criado timestamptz not null default now(),
  primary key (liga_id, org_id)
);

create table if not exists public.tc_trofeus (
  id bigserial primary key,
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  liga_id bigint not null references public.tc_ligas(id) on delete cascade,
  titulo text not null,
  temporada int not null,
  criado timestamptz not null default now(),
  unique (liga_id, org_id)
);

alter table public.tc_ligas enable row level security;
alter table public.tc_liga_times enable row level security;
alter table public.tc_partidas enable row level security;
alter table public.tc_premios enable row level security;
alter table public.tc_trofeus enable row level security;
revoke all on public.tc_ligas, public.tc_liga_times, public.tc_partidas, public.tc_premios, public.tc_trofeus from anon, authenticated;
revoke all on sequence public.tc_ligas_id_seq, public.tc_partidas_id_seq, public.tc_trofeus_id_seq from anon, authenticated;

-- ---------------------------------------------------------------- calendário
-- Dias desde o início do calendário -> temporada (1...), semana (1 a 4) e dia da semana (1 a 7).
create or replace function public.tc_calendario(d date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ini date := ((tc_cfg('calendario'))->>'inicio')::date;
  dias int := coalesce(d, site_hoje_br()) - ini;
begin
  if dias < 0 then
    return jsonb_build_object('antes', true, 'inicio', ini);
  end if;
  return jsonb_build_object('antes', false, 'gw', dias / 7, 'temporada', dias / 28 + 1, 'semana', (dias % 28) / 7 + 1, 'dia', dias % 7 + 1,
                            'inicio_semana', ini + (dias / 7) * 7);
end;
$$;
revoke all on function public.tc_calendario(date) from public, anon, authenticated;

-- ---------------------------------------------------------------- equipes do sistema
-- Equipe do sistema que sai quando um técnico entra na divisão (a mais fraca ativa).
create or replace function public.tc_deslocar_sistema()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fora bigint;
begin
  if new.user_id is not null and new.ativa then
    if (select count(*) from tc_orgs where ativa and divisao = new.divisao) > 8 then
      select id into fora from tc_orgs where user_id is null and ativa and divisao = new.divisao
       order by poder_sistema, id limit 1;
      if fora is not null then
        update tc_orgs set ativa = false where id = fora;
      end if;
    end if;
    -- Liga da divisão ainda sem nenhuma partida jogada: refaz com o técnico novo incluído (o tc_sincronizar recria).
    delete from tc_ligas l
     where l.divisao = new.divisao and l.tipo = 'divisao' and l.status = 'aberta'
       and not exists (select 1 from tc_partidas p where p.liga_id = l.id and p.status = 'concluida');
  end if;
  return null;
end;
$$;
drop trigger if exists tc_orgs_deslocar on public.tc_orgs;
create trigger tc_orgs_deslocar after insert on public.tc_orgs for each row execute function public.tc_deslocar_sistema();

-- Garante 8 equipes ativas em cada divisão (cria equipes do sistema se faltar).
create or replace function public.tc_garantir_sistema()
returns void language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  select count(*) into n from tc_orgs where ativa and divisao = 'principal';
  if n < 8 then perform tc_criar_equipes_sistema('principal', 8 - n, 64); end if;
  select count(*) into n from tc_orgs where ativa and divisao = 'acesso';
  if n < 8 then perform tc_criar_equipes_sistema('acesso', 8 - n, 48); end if;
end;
$$;
revoke all on function public.tc_garantir_sistema() from public, anon, authenticated;

-- ---------------------------------------------------------------- simulação
-- Série entre duas equipes. Determinística: a mesma semente dá o mesmo resultado (e a partida só é simulada uma vez).
-- Cada mapa sorteia três componentes (rotas, objetivos e teamfights) a partir do Poder da equipe e dos atributos dos
-- titulares; o vencedor é quem soma mais, e as estatísticas exibidas são esses mesmos componentes.
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
      f := case when v <> j.pos and not (v = any (j.pos2)) then ((tc_cfg('fora_posicao'))::text)::double precision else 1 end;
      lane := lane + (j.rotas * 0.6 + j.mec * 0.4) * f;
      obj := obj + (j.macro * 0.6 + j.mental * 0.4) * f;
      tf := tf + (j.tf * 0.6 + j.mec * 0.2 + j.mental * 0.2) * f;
      n := n + 1;
    end if;
  end loop;
  if n = 0 then return array[p, 1, 1, 1]; end if;
  lane := lane / n; obj := obj / n; tf := tf / n;
  -- [Poder, rotas, objetivos, teamfight]: cada componente é o Poder deslocado pela especialidade da equipe.
  return array[p, p + (lane - (lane + obj + tf) / 3) * 0.6, p + (obj - (lane + obj + tf) / 3) * 0.6, p + (tf - (lane + obj + tf) / 3) * 0.6];
end;
$$;
revoke all on function public.tc_componentes(bigint) from public, anon, authenticated;

create or replace function public.tc_mvp(oid bigint, semente text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  r text;
begin
  select nome into r from (
    select j.nome, tc_poder_efetivo(j, j.slot) * (0.75 + tc_u(semente || ':' || j.id::text, 7) * 0.5) as s
      from tc_jogadores j where j.org_id = oid and j.slot is not null order by s desc limit 1) x;
  return r;
end;
$$;
revoke all on function public.tc_mvp(bigint, text) from public, anon, authenticated;

create or replace function public.tc_simular(a bigint, b bigint, bo int, semente text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ca double precision[] := tc_componentes(a);
  cb double precision[] := tc_componentes(b);
  ga int := 0;
  gb int := 0;
  alvo int := bo / 2 + 1;
  mapas jsonb := '[]'::jsonb;
  m int := 0;
  s text;
  xa double precision[3];
  xb double precision[3];
  sa double precision;
  sb double precision;
  venceu_a boolean;
  dur int;
  quota double precision;
begin
  while ga < alvo and gb < alvo loop
    m := m + 1;
    s := semente || ':m' || m::text;
    for i in 1..3 loop
      xa[i] := ca[i + 1] + (tc_u(s || 'a', i) - 0.5) * 50;
      xb[i] := cb[i + 1] + (tc_u(s || 'b', i) - 0.5) * 50;
    end loop;
    sa := xa[1] + xa[2] + xa[3];
    sb := xb[1] + xb[2] + xb[3];
    venceu_a := sa > sb or (sa = sb and tc_u(s, 99) < 0.5);
    if venceu_a then ga := ga + 1; else gb := gb + 1; end if;
    quota := greatest(sa, sb) / (sa + sb);
    dur := 22 + floor((1 - quota) * 20 + tc_u(s, 50) * 8)::int;
    mapas := mapas || jsonb_build_object(
      'mapa', m, 'vencedor', case when venceu_a then 'a' else 'b' end,
      'rotas', jsonb_build_array(round(xa[1])::int, round(xb[1])::int),
      'objetivos', jsonb_build_array(round(xa[2])::int, round(xb[2])::int),
      'teamfight', jsonb_build_array(round(xa[3])::int, round(xb[3])::int),
      'duracao', dur,
      'mvp', tc_mvp(case when venceu_a then a else b end, s));
  end loop;
  return jsonb_build_object('a', ga, 'b', gb, 'mapas', mapas);
end;
$$;
revoke all on function public.tc_simular(bigint, bigint, int, text) from public, anon, authenticated;

-- Processa uma partida agendada. Só roda uma vez: depois de concluída, chamar de novo não muda nada.
create or replace function public.tc_processar_partida(pid bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  r jsonb;
  pa double precision;
  pb double precision;
  venc bigint;
  perd bigint;
begin
  select * into p from tc_partidas where id = pid for update;
  if p.id is null or p.status <> 'agendada' then
    return false;
  end if;
  perform tc_completar_elenco(p.org_a);
  perform tc_completar_elenco(p.org_b);
  pa := tc_poder_org(p.org_a);
  pb := tc_poder_org(p.org_b);
  r := tc_simular(p.org_a, p.org_b, p.formato, 'p' || p.id::text || ':' || p.liga_id::text);
  venc := case when (r->>'a')::int > (r->>'b')::int then p.org_a else p.org_b end;
  perd := case when venc = p.org_a then p.org_b else p.org_a end;
  update tc_partidas set status = 'concluida', placar_a = (r->>'a')::int, placar_b = (r->>'b')::int, vencedor = venc,
         poder_a = round(pa::numeric, 1), poder_b = round(pb::numeric, 1), resumo = r, processada = now()
   where id = p.id;
  -- Forma: quem ganha sobe um pouco, quem perde desce um pouco (limites estreitos).
  update tc_jogadores set forma = least(75, forma + 4), exp = exp + 1 where org_id = venc and slot is not null;
  update tc_jogadores set forma = greatest(25, forma - 4), exp = exp + 1 where org_id = perd and slot is not null;
  return true;
end;
$$;
revoke all on function public.tc_processar_partida(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------- tabelas
-- Classificação de uma liga (só partidas da fase de rodadas). Pontos em melhor de três: vitória 2-0 = 3, vitória 2-1 = 2,
-- derrota 1-2 = 1, derrota 0-2 = 0. Desempate, nesta ordem: pontos, saldo de mapas, mapas ganhos, menor id da organização.
create or replace function public.tc_tabela(liga bigint)
returns table (pos int, org_id bigint, partidas int, vitorias int, derrotas int, mapas_pro int, mapas_contra int, pontos int)
language sql stable security definer set search_path = public as $$
  with res as (
    select p.org_a as org, p.placar_a as pro, p.placar_b as contra from tc_partidas p where p.liga_id = liga and p.status = 'concluida' and p.fase = 'rodada'
    union all
    select p.org_b, p.placar_b, p.placar_a from tc_partidas p where p.liga_id = liga and p.status = 'concluida' and p.fase = 'rodada'
  ), tot as (
    select t.org_id,
           count(r.org)::int as partidas,
           (count(*) filter (where r.pro > r.contra))::int as vitorias,
           (count(*) filter (where r.pro < r.contra))::int as derrotas,
           coalesce(sum(r.pro), 0)::int as mapas_pro,
           coalesce(sum(r.contra), 0)::int as mapas_contra,
           coalesce(sum(case when r.pro > r.contra then (case when r.contra = 0 then 3 else 2 end)
                             else (case when r.pro = 1 then 1 else 0 end) end), 0)::int as pontos
      from tc_liga_times t left join res r on r.org = t.org_id
     where t.liga_id = liga group by t.org_id
  )
  select (row_number() over (order by pontos desc, (mapas_pro - mapas_contra) desc, mapas_pro desc, org_id))::int as pos,
         tot.org_id, tot.partidas, tot.vitorias, tot.derrotas, tot.mapas_pro, tot.mapas_contra, tot.pontos
    from tot order by pos;
$$;
revoke all on function public.tc_tabela(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------- criação das ligas
-- Calendário todos-contra-todos (método do círculo): n equipes -> n-1 rodadas.
create or replace function public.tc_criar_liga_divisao(temp int, sem int, div text, inicio_semana date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  lid bigint;
  times bigint[];
  n int;
  rod int;
  i int;
  a bigint;
  b bigint;
  rot bigint[];
begin
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and divisao = div;
  if lid is not null then return lid; end if;
  select array_agg(id order by id) into times from tc_orgs where ativa and divisao = div;
  n := coalesce(array_length(times, 1), 0);
  if n < 4 or n % 2 = 1 then raise exception 'times_insuficientes'; end if;
  insert into tc_ligas (temporada, semana, divisao, tipo, nome)
  values (temp, sem, div, 'divisao', (tc_cfg('nomes'))->>div || ' · S' || temp::text || ' semana ' || sem::text) returning id into lid;
  for i in 1..n loop
    insert into tc_liga_times (liga_id, org_id, semente) values (lid, times[i], i);
  end loop;
  rot := times;
  for rod in 1..(n - 1) loop
    for i in 1..(n / 2) loop
      a := rot[i];
      b := rot[n + 1 - i];
      insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato)
      values (lid, 'rodada', rod, inicio_semana + (rod - 1), least(a, b), greatest(a, b), 3);
    end loop;
    -- gira todos menos o primeiro
    rot := array[rot[1]] || rot[n] || rot[2:n - 1];
  end loop;
  return lid;
end;
$$;
revoke all on function public.tc_criar_liga_divisao(int, int, text, date) from public, anon, authenticated;

-- ---------------------------------------------------------------- fechamento
-- Pontos de Rank (PDR base antes do ajuste do elo) por liga concluída, uma vez por conta.
-- Só vale com tc_config.rank_ativo = true (fica desligado até o lançamento do jogo).
create or replace function public.tc_rank_liga(oid bigint, lid bigint, pos_ int, vitorias_ int, dia_ date)
returns int language plpgsql security definer set search_path = public as $$
declare
  c jsonb := tc_cfg('rank');
  uid uuid;
  base int;
  nivel int;
  pdr int;
begin
  if not coalesce((tc_cfg('rank_ativo'))::text::boolean, false) then return null; end if;
  select user_id into uid from tc_orgs where id = oid;
  if uid is null then return null; end if;
  base := least((c->>'max')::int, (c->>'base')::int + (c->>'por_vitoria')::int * vitorias_
                + coalesce((c->'bonus_pos'->>(pos_ - 1))::int, 0));
  nivel := site_rk_nivel_de(uid);
  pdr := site_rk_ajustar(base, nivel);
  perform site_rk_lancar(uid, dia_, 'tecnico', 'partida', pdr);
  return pdr;
end;
$$;
revoke all on function public.tc_rank_liga(bigint, bigint, int, int, date) from public, anon, authenticated;

-- Fecha uma liga de divisão: premiação em créditos, Rank, troféu. Só uma vez por liga.
create or replace function public.tc_encerrar_liga(lid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  l tc_ligas;
  t record;
  prem bigint[];
  cred bigint;
  pdr int;
  d date := site_hoje_br();
begin
  select * into l from tc_ligas where id = lid for update;
  if l.status = 'encerrada' then return; end if;
  prem := array(select (jsonb_array_elements_text((tc_cfg('premios'))->l.divisao))::bigint);
  for t in select * from tc_tabela(lid) loop
    cred := coalesce(prem[t.pos], 0);
    if cred > 0 then
      perform tc_creditos_mexer(t.org_id, cred, 'premiacao', lid::text);
    end if;
    pdr := tc_rank_liga(t.org_id, lid, t.pos, t.vitorias, d);
    insert into tc_premios (liga_id, org_id, posicao, creditos, rank_base, rank_pdr)
    values (lid, t.org_id, t.pos, cred, null, pdr) on conflict do nothing;
    if t.pos = 1 then
      insert into tc_trofeus (org_id, liga_id, titulo, temporada)
      values (t.org_id, lid, 'Campeão · ' || l.nome, l.temporada) on conflict do nothing;
    end if;
    if cred > 0 then
      perform tc_avisar(t.org_id, 'Liga encerrada: você ficou em ' || t.pos::text || 'º e recebeu ' || cred::text || ' créditos.');
    end if;
  end loop;
  update tc_ligas set status = 'encerrada', encerrada_em = now() where id = lid;
end;
$$;
revoke all on function public.tc_encerrar_liga(bigint) from public, anon, authenticated;

-- Promoção e rebaixamento: os dois primeiros da divisão de acesso sobem; os dois últimos da principal descem.
create or replace function public.tc_aplicar_promocoes(temp int, sem int)
returns void language plpgsql security definer set search_path = public as $$
declare
  la bigint;
  lp bigint;
  sobem bigint[];
  descem bigint[];
begin
  select id into la from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and divisao = 'acesso';
  select id into lp from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and divisao = 'principal';
  if la is null or lp is null then return; end if;
  select array_agg(org_id order by pos) into sobem from tc_tabela(la) where pos <= 2;
  select array_agg(org_id order by pos desc) into descem from (select * from tc_tabela(lp) order by pos desc limit 2) x;
  update tc_orgs set divisao = 'principal' where id = any (sobem);
  update tc_orgs set divisao = 'acesso' where id = any (descem);
  perform tc_avisar(o, 'Promovido para a ' || ((tc_cfg('nomes'))->>'principal') || '!') from unnest(sobem) o where exists (select 1 from tc_orgs where id = o and user_id is not null);
  perform tc_avisar(o, 'Rebaixado para a ' || ((tc_cfg('nomes'))->>'acesso') || '.') from unnest(descem) o where exists (select 1 from tc_orgs where id = o and user_id is not null);
end;
$$;
revoke all on function public.tc_aplicar_promocoes(int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------- sincronização
-- Chamada a cada acesso: cria as ligas da semana, processa as partidas até hoje (uma única vez cada)
-- e fecha as semanas concluídas (premiação, Rank, promoção/rebaixamento, salários e contratos).
create or replace function public.tc_sincronizar()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cal jsonb := tc_calendario();
  hoje date := site_hoje_br();
  gw_hoje int;
  gw int;
  ptr int;
  c jsonb;
  inicio date := ((tc_cfg('calendario'))->>'inicio')::date;
  la bigint;
  lp bigint;
  p record;
  feitas int := 0;
  o record;
  pend int;
begin
  perform tc_exigir(uid);
  if (cal->>'antes')::boolean then
    return jsonb_build_object('antes', true, 'inicio', inicio);
  end if;
  perform pg_advisory_xact_lock(85002);
  perform tc_garantir_sistema();
  gw_hoje := (cal->>'gw')::int;
  select valor into c from tc_config where chave = 'semana_proc';
  if c is null then
    insert into tc_config (chave, valor) values ('semana_proc', to_jsonb(gw_hoje));
    ptr := gw_hoje;
  else
    ptr := (c::text)::int;
  end if;
  gw := ptr;
  while gw <= gw_hoje loop
    declare
      temp int := gw / 4 + 1;
      sem int := gw % 4 + 1;
      ini date := inicio + gw * 7;
    begin
      la := tc_criar_liga_divisao(temp, sem, 'acesso', ini);
      lp := tc_criar_liga_divisao(temp, sem, 'principal', ini);
      for p in select id from tc_partidas where liga_id in (la, lp) and status = 'agendada' and dia <= hoje order by dia, id loop
        if tc_processar_partida(p.id) then feitas := feitas + 1; end if;
      end loop;
      select count(*) into pend from tc_partidas where liga_id in (la, lp) and status = 'agendada';
      exit when pend > 0;
      -- Semana toda concluída: fecha as duas ligas, aplica promoção/rebaixamento e fecha as finanças.
      perform tc_encerrar_liga(la);
      perform tc_encerrar_liga(lp);
      perform tc_aplicar_promocoes(temp, sem);
      for o in select id from tc_orgs where ativa order by id loop
        perform tc_fechar_semana_org(o.id, gw);
      end loop;
      update tc_config set valor = to_jsonb(gw + 1) where chave = 'semana_proc';
    end;
    gw := gw + 1;
  end loop;
  return jsonb_build_object('processadas', feitas, 'gw', gw_hoje, 'temporada', cal->'temporada', 'semana', cal->'semana', 'dia', cal->'dia');
end;
$$;
revoke all on function public.tc_sincronizar() from public, anon;
grant execute on function public.tc_sincronizar() to authenticated;
