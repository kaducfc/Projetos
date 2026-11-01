-- Campeonatos: Copa Internacional e Campeonato Mundial com 16 equipes, classificação por vagas e partidas "PVP" contra o bot do adversário.
--
-- Carreira
--   * Todo técnico começa na Liga Academy (contra equipes fictícias). Os 2 primeiros sobem para a Liga Nacional; o resto continua na Academy.
--   * Liga Nacional também é contra equipes fictícias. Não existe mais rebaixamento: quem não se classifica joga a Nacional de novo na semana seguinte.
--   * Uma competição por semana. Técnico em campeonato internacional não joga a Nacional naquela semana. Temporada = 4 semanas:
--     semana 1 liga, semana 2 Copa Internacional, semana 3 liga, semana 4 Campeonato Mundial.
--   * Vaga na Copa: 2 primeiros da Nacional na semana 1, ou 2 primeiros da Nacional na semana 4 da temporada anterior.
--   * Vaga no Mundial: 2 primeiros da Nacional na semana 2 ou 3, ou campeão da Copa (só o campeão).
--     Quem ganha uma vaga e não a usa (a liga só fecha depois) simplesmente joga a próxima liga; não há acúmulo entre temporadas.
--
-- Copa Internacional (16 equipes, técnicos reais + equipes fictícias): segunda a sexta 2 jogos por dia (MD1) contra equipes diferentes;
--   sábado semifinais (4 melhores por pontos, MD3); domingo final (MD5).
-- Campeonato Mundial (16 equipes): 4 grupos de 4 por cabeça de chave de poder (4 mais fortes = cabeças dos 4 grupos, 5º a 8º = 2º pote...).
--   Segunda: treino (2 jogos, MD1, sem pontos, só XP/Maestria, contra equipes de fora do grupo). Terça a quinta: 2 jogos por dia contra o
--   próprio grupo (cada adversário duas vezes, MD1). Sexta: quartas (sorteio, MD3) com os 2 primeiros de cada grupo. Sábado semifinais (MD3). Domingo final (MD5).
--
-- Partidas PVP (técnico real contra a equipe de outro técnico real): cada técnico joga a SUA partida contra o bot do adversário (que usa o elenco
--   e as maestrias do adversário congelados no início do dia). Cada técnico conta o seu próprio resultado. Se os dois vencerem (ou perderem) um
--   mata-mata, avança quem tiver melhor saldo de mapas e, depois, quem terminou mais rápido, e por fim a melhor semente.
--
-- Rode depois da 0138. Seguro rodar de novo.

alter table public.tc_partidas add column if not exists pov bigint references public.tc_orgs(id) on delete cascade;
alter table public.tc_liga_times add column if not exists grupo text;
drop index if exists public.tc_partidas_unica;
create unique index if not exists tc_partidas_unica on public.tc_partidas (liga_id, fase, rodada, org_a, org_b, coalesce(pov, 0));

create table if not exists public.tc_vagas (
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  temporada int not null,
  tipo text not null check (tipo in ('copa', 'mundial')),
  origem text,
  criado timestamptz not null default now(),
  primary key (org_id, temporada, tipo)
);
alter table public.tc_vagas enable row level security;
revoke all on public.tc_vagas from anon, authenticated;

-- Elenco do adversário congelado no primeiro uso do dia (o bot que o enfrenta usa o mesmo elenco o dia inteiro).
create table if not exists public.tc_snap_dia (
  org_id bigint not null references public.tc_orgs(id) on delete cascade,
  dia date not null,
  jogadores jsonb not null,
  criado timestamptz not null default now(),
  primary key (org_id, dia)
);
alter table public.tc_snap_dia enable row level security;
revoke all on public.tc_snap_dia from anon, authenticated;

create or replace function public.tc_eh_real(oid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tc_orgs where id = oid and user_id is not null);
$$;
revoke all on function public.tc_eh_real(bigint) from public, anon, authenticated;

create or replace function public.tc_snap_jogadores(oid bigint, d date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  j jsonb;
begin
  select jogadores into j from tc_snap_dia where org_id = oid and dia = d;
  if j is null then
    j := tc_gameplay_jogadores(oid);
    insert into tc_snap_dia (org_id, dia, jogadores) values (oid, d, j) on conflict do nothing;
    select jogadores into j from tc_snap_dia where org_id = oid and dia = d;
  end if;
  return j;
end;
$$;
revoke all on function public.tc_snap_jogadores(bigint, date) from public, anon, authenticated;

-- Escalação de uma equipe numa partida: o adversário técnico (bot) usa o elenco congelado do dia.
create or replace function public.tc_jogadores_da_partida(p tc_partidas, oid bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p.pov is not null and oid <> p.pov and tc_eh_real(oid) then
    return tc_snap_jogadores(oid, p.dia);
  end if;
  return tc_gameplay_jogadores(oid);
end;
$$;
revoke all on function public.tc_jogadores_da_partida(tc_partidas, bigint) from public, anon, authenticated;

-- Equipes do sistema: 16 na divisão principal (a Copa e o Mundial usam até 15 fictícias) e 8 no acesso; a liga individual usa 7.
create or replace function public.tc_garantir_sistema()
returns void language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update tc_orgs set ativa = true where user_id is null and not ativa;
  select count(*) into n from tc_orgs where user_id is null and ativa and divisao = 'principal';
  if n < 16 then perform tc_criar_equipes_sistema('principal', 16 - n, 64); end if;
  select count(*) into n from tc_orgs where user_id is null and ativa and divisao = 'acesso';
  if n < 8 then perform tc_criar_equipes_sistema('acesso', 8 - n, 48); end if;
  perform tc_sistema_fotos(); -- equipes novas do sistema recebem fotos (0124)
end;
$$;
revoke all on function public.tc_garantir_sistema() from public, anon, authenticated;

-- Método do círculo: n equipes (par) -> rodadas 1..n-1; depois dela repete as mesmas rodadas.
create or replace function public.tc_rodadas(times bigint[], max_rod int default null)
returns table (rod int, a bigint, b bigint) language plpgsql immutable set search_path = public as $$
declare
  n int := coalesce(array_length(times, 1), 0);
  rot bigint[] := times;
  r int;
  i int;
begin
  for r in 1..coalesce(max_rod, n - 1) loop
    for i in 1..(n / 2) loop
      rod := r; a := rot[i]; b := rot[n + 1 - i];
      return next;
    end loop;
    rot := array[rot[1]] || rot[n] || rot[2:n - 1];
    if r = n - 1 then rot := times; end if;
  end loop;
end;
$$;
revoke all on function public.tc_rodadas(bigint[], int) from public, anon, authenticated;

-- Cria o confronto de uma fase: uma partida por técnico real (cada um joga a sua contra o bot do outro) ou uma só, simulada, entre equipes do sistema.
drop function if exists public.tc_partida_mm(bigint, text, int, date, bigint, bigint);
create or replace function public.tc_partida_mm(lid bigint, fase_ text, rod int, d date, a bigint, b bigint, fmt int default 5)
returns void language plpgsql security definer set search_path = public as $$
declare
  x bigint;
  n int := 0;
begin
  if a is null or b is null then return; end if;
  for x in select u from unnest(array[a, b]) as u where tc_eh_real(u) order by u loop
    insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato, pov)
    values (lid, fase_, rod, d, least(a, b), greatest(a, b), fmt, x) on conflict do nothing;
    n := n + 1;
  end loop;
  if n = 0 then
    insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato)
    values (lid, fase_, rod, d, least(a, b), greatest(a, b), fmt) on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.tc_partida_mm(bigint, text, int, date, bigint, bigint, int) from public, anon, authenticated;

-- Duração total (minutos) dos mapas de uma partida; W.O. e partida sem tempo valem "muito lento".
create or replace function public.tc_duracao_partida(p tc_partidas)
returns numeric language sql immutable set search_path = public as $$
  select case when s > 0 then s else 99999 end from (
    select coalesce((select sum((m->>'duracao')::numeric) from jsonb_array_elements(case when jsonb_typeof(p.resumo->'mapas') = 'array' then p.resumo->'mapas' else '[]'::jsonb end) m), 0) as s) q;
$$;
revoke all on function public.tc_duracao_partida(tc_partidas) from public, anon, authenticated;

-- Quem avança num confronto (null se alguma partida do confronto ainda não terminou).
create or replace function public.tc_vencedor_entre(lid bigint, fase_ text, x bigint, y bigint)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare
  n int; pend int;
  rx tc_partidas; ry tc_partidas;
  sx int; sy int; dx numeric; dy numeric;
begin
  select count(*), count(*) filter (where status = 'agendada') into n, pend from tc_partidas
   where liga_id = lid and fase = fase_ and least(org_a, org_b) = least(x, y) and greatest(org_a, org_b) = greatest(x, y);
  if n = 0 or pend > 0 then return null; end if;
  select * into rx from tc_partidas where liga_id = lid and fase = fase_ and least(org_a, org_b) = least(x, y) and greatest(org_a, org_b) = greatest(x, y) and pov = x order by id limit 1;
  select * into ry from tc_partidas where liga_id = lid and fase = fase_ and least(org_a, org_b) = least(x, y) and greatest(org_a, org_b) = greatest(x, y) and pov = y order by id limit 1;
  if rx.id is null or ry.id is null then
    return (select vencedor from tc_partidas where liga_id = lid and fase = fase_ and least(org_a, org_b) = least(x, y) and greatest(org_a, org_b) = greatest(x, y) order by id limit 1);
  end if;
  if rx.vencedor = x and ry.vencedor <> y then return x; end if;
  if ry.vencedor = y and rx.vencedor <> x then return y; end if;
  sx := case when rx.org_a = x then rx.placar_a - rx.placar_b else rx.placar_b - rx.placar_a end;
  sy := case when ry.org_a = y then ry.placar_a - ry.placar_b else ry.placar_b - ry.placar_a end;
  if sx <> sy then return case when sx > sy then x else y end; end if;
  dx := tc_duracao_partida(rx); dy := tc_duracao_partida(ry);
  if dx <> dy then return case when dx < dy then x else y end; end if;
  return (select org_id from tc_liga_times where liga_id = lid and org_id in (x, y) order by semente, org_id limit 1);
end;
$$;
revoke all on function public.tc_vencedor_entre(bigint, text, bigint, bigint) from public, anon, authenticated;

create or replace function public.tc_confrontos(lid bigint, fase_ text)
returns table (rodada int, x bigint, y bigint) language sql stable security definer set search_path = public as $$
  select distinct p.rodada, least(p.org_a, p.org_b), greatest(p.org_a, p.org_b) from tc_partidas p where p.liga_id = lid and p.fase = fase_ order by 1;
$$;
revoke all on function public.tc_confrontos(bigint, text) from public, anon, authenticated;

-- Classificação da fase de pontos (Liga, Copa e grupos do Mundial). Cada partida conta para o técnico que a jogou
-- (e, no outro lado, só para equipes do sistema). Vitória = 1 ponto. Desempate: confronto direto, tempo de jogo, semente.
-- A posição é dentro do grupo (Mundial); nas demais competições o grupo é nulo e vale a classificação geral.
create or replace function public.tc_tabela(liga bigint)
returns table (pos int, org_id bigint, partidas int, vitorias int, derrotas int, mapas_pro int, mapas_contra int, pontos int)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.org_a as org, p.org_b as opp, p.placar_a as pro, p.placar_b as contra,
           coalesce((select sum((m->>'duracao')::int) from jsonb_array_elements(case when jsonb_typeof(p.resumo->'mapas') = 'array' then p.resumo->'mapas' else '[]'::jsonb end) m), 0) as dur
      from tc_partidas p where p.liga_id = liga and p.status = 'concluida' and p.fase = 'rodada'
       and (p.pov is null or p.pov = p.org_a or not exists (select 1 from tc_orgs x where x.id = p.org_a and x.user_id is not null))
    union all
    select p.org_b, p.org_a, p.placar_b, p.placar_a,
           coalesce((select sum((m->>'duracao')::int) from jsonb_array_elements(case when jsonb_typeof(p.resumo->'mapas') = 'array' then p.resumo->'mapas' else '[]'::jsonb end) m), 0)
      from tc_partidas p where p.liga_id = liga and p.status = 'concluida' and p.fase = 'rodada'
       and (p.pov is null or p.pov = p.org_b or not exists (select 1 from tc_orgs x where x.id = p.org_b and x.user_id is not null))
  ), tot as (
    select t.org_id, t.semente, t.grupo,
           count(b.org)::int as partidas,
           (count(*) filter (where b.pro > b.contra))::int as vitorias,
           (count(*) filter (where b.pro < b.contra))::int as derrotas,
           coalesce(sum(b.pro), 0)::int as mapas_pro,
           coalesce(sum(b.contra), 0)::int as mapas_contra,
           (count(*) filter (where b.pro > b.contra))::int as pontos,
           coalesce(sum(case when b.org is null then 0 when b.dur > 0 then b.dur else 60 end), 0)::int as tempo
      from tc_liga_times t left join base b on b.org = t.org_id
     where t.liga_id = liga group by t.org_id, t.semente, t.grupo
  ), h2h as (
    select b.org, (count(*) filter (where b.pro > b.contra))::int as h
      from base b join tot s on s.org_id = b.org join tot o on o.org_id = b.opp
     where s.pontos = o.pontos group by b.org
  )
  select (row_number() over (partition by tot.grupo order by tot.pontos desc, coalesce(h2h.h, 0) desc, tot.tempo, tot.semente, tot.org_id))::int as pos,
         tot.org_id, tot.partidas, tot.vitorias, tot.derrotas, tot.mapas_pro, tot.mapas_contra, tot.pontos
    from tot left join h2h on h2h.org = tot.org_id order by tot.grupo nulls first, pos;
$$;
revoke all on function public.tc_tabela(bigint) from public, anon, authenticated;

-- Copa Internacional: 16 equipes. Técnicos com vaga (até 16, os de maior poder) + equipes fictícias.
create or replace function public.tc_criar_copa(temp int, sem int, ini date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  lid bigint;
  t bigint[];
  reais int;
  i int;
  r record;
begin
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'copa';
  if lid is not null then return lid; end if;
  select coalesce(array_agg(x.org_id order by tc_poder_org(x.org_id) desc, x.org_id), '{}') into t from (
    select v.org_id from tc_vagas v join tc_orgs o on o.id = v.org_id
     where v.temporada = temp and v.tipo = 'copa' and o.ativa and o.user_id is not null
     order by tc_poder_org(v.org_id) desc, v.org_id limit 16) x;
  reais := coalesce(array_length(t, 1), 0);
  if reais = 0 then return null; end if;
  select t || coalesce(array_agg(s.id), '{}') into t from (
    select id from tc_orgs where user_id is null and ativa and divisao = 'principal' and id <> all (t)
     order by poder_sistema desc, id limit 16 - reais) s;
  if coalesce(array_length(t, 1), 0) < 16 then return null; end if;
  insert into tc_ligas (temporada, semana, divisao, tipo, nome)
  values (temp, sem, 'principal', 'copa', (tc_cfg('nomes'))->>'copa' || ' · S' || temp::text) returning id into lid;
  for i in 1..16 loop
    insert into tc_liga_times (liga_id, org_id, semente) values (lid, t[i], i);
  end loop;
  for r in select * from tc_rodadas(t, 10) loop -- 10 rodadas, 2 por dia, de segunda a sexta
    perform tc_partida_mm(lid, 'rodada', r.rod, ini + (r.rod - 1) / 2, r.a, r.b, 1);
  end loop;
  return lid;
end;
$$;
revoke all on function public.tc_criar_copa(int, int, date) from public, anon, authenticated;

-- Campeonato Mundial: 16 equipes em 4 grupos (potes por poder), treino na segunda, grupos de terça a quinta.
create or replace function public.tc_criar_mundial(temp int, sem int, ini date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  lid bigint;
  t bigint[];
  gt bigint[];
  reais int;
  i int;
  g int;
  r record;
  q record;
begin
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'mundial';
  if lid is not null then return lid; end if;
  select coalesce(array_agg(x.org_id order by tc_poder_org(x.org_id) desc, x.org_id), '{}') into t from (
    select v.org_id from tc_vagas v join tc_orgs o on o.id = v.org_id
     where v.temporada = temp and v.tipo = 'mundial' and o.ativa and o.user_id is not null
     order by tc_poder_org(v.org_id) desc, v.org_id limit 16) x;
  reais := coalesce(array_length(t, 1), 0);
  if reais = 0 then return null; end if;
  select t || coalesce(array_agg(s.id), '{}') into t from (
    select id from tc_orgs where user_id is null and ativa and divisao = 'principal' and id <> all (t)
     order by poder_sistema desc, id limit 16 - reais) s;
  if coalesce(array_length(t, 1), 0) < 16 then return null; end if;
  select array_agg(u order by tc_poder_org(u) desc, u) into t from unnest(t) as u; -- semente = ordem de poder
  insert into tc_ligas (temporada, semana, divisao, tipo, nome)
  values (temp, sem, 'principal', 'mundial', (tc_cfg('nomes'))->>'mundial' || ' · S' || temp::text) returning id into lid;
  for i in 0..3 loop -- cada pote de 4 coloca uma equipe em cada grupo (sorteio fixo)
    g := 0;
    for r in select u.org from unnest(t[i * 4 + 1:i * 4 + 4]) as u(org) order by md5(lid::text || ':' || u.org::text) loop
      insert into tc_liga_times (liga_id, org_id, semente, grupo) values (lid, r.org, array_position(t, r.org), chr(65 + g));
      g := g + 1;
    end loop;
  end loop;
  for g in 0..3 loop -- grupos: cada adversário duas vezes (6 rodadas, 2 por dia, terça a quinta)
    select array_agg(org_id order by semente) into gt from tc_liga_times where liga_id = lid and grupo = chr(65 + g);
    for r in select * from tc_rodadas(gt, 6) loop
      perform tc_partida_mm(lid, 'rodada', r.rod, ini + 1 + (r.rod - 1) / 2, r.a, r.b, 1);
    end loop;
  end loop;
  for r in select t2.org_id, t2.grupo from tc_liga_times t2 where t2.liga_id = lid and tc_eh_real(t2.org_id) loop -- treino de segunda: 2 jogos contra equipes de fora do grupo
    i := 0;
    for q in select x.org_id from tc_liga_times x where x.liga_id = lid and x.grupo <> r.grupo
              order by md5(lid::text || ':treino:' || r.org_id::text || ':' || x.org_id::text) limit 2 loop
      i := i + 1;
      insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato, pov)
      values (lid, 'treino', i, ini, r.org_id, q.org_id, 1, r.org_id) on conflict do nothing;
    end loop;
  end loop;
  return lid;
end;
$$;
revoke all on function public.tc_criar_mundial(int, int, date) from public, anon, authenticated;

-- Fases seguintes: Copa (semifinais com os 4 melhores, final) e Mundial (quartas sorteadas, semifinais, final).
create or replace function public.tc_avancar(lid bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  l tc_ligas;
  d0 date;
  t bigint[];
  w bigint[] := '{}';
  emb bigint[];
  c record;
  ok boolean;
  salt int;
  i int;
begin
  if lid is null then return false; end if;
  select * into l from tc_ligas where id = lid;
  if l.id is null or l.status = 'encerrada' then return false; end if;
  select min(dia) into d0 from tc_partidas where liga_id = lid;
  if l.tipo = 'copa' then
    if exists (select 1 from tc_partidas where liga_id = lid and fase = 'rodada') and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'rodada' and status = 'agendada')
       and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'semi') then
      select array_agg(org_id order by pos) into t from tc_tabela(lid) where pos <= 4;
      if coalesce(array_length(t, 1), 0) < 4 then return false; end if;
      perform tc_partida_mm(lid, 'semi', 1, d0 + 5, t[1], t[4], 3);
      perform tc_partida_mm(lid, 'semi', 2, d0 + 5, t[2], t[3], 3);
      return true;
    end if;
    if exists (select 1 from tc_partidas where liga_id = lid and fase = 'semi') and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'semi' and status = 'agendada')
       and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'final') then
      for c in select * from tc_confrontos(lid, 'semi') loop w := w || tc_vencedor_entre(lid, 'semi', c.x, c.y); end loop;
      if coalesce(array_length(w, 1), 0) < 2 or array_position(w, null) is not null then return false; end if;
      perform tc_partida_mm(lid, 'final', 1, d0 + 6, w[1], w[2], 5);
      return true;
    end if;
  elsif l.tipo = 'mundial' then
    if exists (select 1 from tc_partidas where liga_id = lid and fase = 'rodada') and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'rodada' and status = 'agendada')
       and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'quartas') then
      if (select count(*) from tc_tabela(lid) where pos <= 2) < 8 then return false; end if;
      for salt in 0..40 loop -- sorteio das quartas, evitando (quando possível) times do mesmo grupo
        select array_agg(x.org_id order by md5(lid::text || ':q:' || salt::text || ':' || x.org_id::text)) into emb from tc_tabela(lid) x where x.pos <= 2;
        ok := true;
        for i in 0..3 loop
          if (select grupo from tc_liga_times where liga_id = lid and org_id = emb[i * 2 + 1]) = (select grupo from tc_liga_times where liga_id = lid and org_id = emb[i * 2 + 2]) then ok := false; end if;
        end loop;
        exit when ok;
      end loop;
      for i in 0..3 loop
        perform tc_partida_mm(lid, 'quartas', i + 1, d0 + 4, emb[i * 2 + 1], emb[i * 2 + 2], 3);
      end loop;
      return true;
    end if;
    if exists (select 1 from tc_partidas where liga_id = lid and fase = 'quartas') and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'quartas' and status = 'agendada')
       and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'semi') then
      for c in select * from tc_confrontos(lid, 'quartas') loop w := w || tc_vencedor_entre(lid, 'quartas', c.x, c.y); end loop;
      if coalesce(array_length(w, 1), 0) < 4 or array_position(w, null) is not null then return false; end if;
      perform tc_partida_mm(lid, 'semi', 1, d0 + 5, w[1], w[2], 3);
      perform tc_partida_mm(lid, 'semi', 2, d0 + 5, w[3], w[4], 3);
      return true;
    end if;
    if exists (select 1 from tc_partidas where liga_id = lid and fase = 'semi') and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'semi' and status = 'agendada')
       and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'final') then
      for c in select * from tc_confrontos(lid, 'semi') loop w := w || tc_vencedor_entre(lid, 'semi', c.x, c.y); end loop;
      if coalesce(array_length(w, 1), 0) < 2 or array_position(w, null) is not null then return false; end if;
      perform tc_partida_mm(lid, 'final', 1, d0 + 6, w[1], w[2], 5);
      return true;
    end if;
  end if;
  return false;
end;
$$;
revoke all on function public.tc_avancar(bigint) from public, anon, authenticated;

create or replace function public.tc_internacional_completo(lid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select lid is null or (exists (select 1 from tc_partidas where liga_id = lid and fase = 'final')
                         and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'final' and status = 'agendada'));
$$;
revoke all on function public.tc_internacional_completo(bigint) from public, anon, authenticated;

-- Premiação e Rank da Copa e do Mundial (uma vez por liga). O campeão da Copa ganha a vaga do Mundial da temporada.
create or replace function public.tc_encerrar_internacional(lid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  l tc_ligas;
  fx bigint; fy bigint; camp bigint;
  r record;
  chave text;
  cred bigint;
  base int;
  uid uuid;
  pdr int;
  d date := site_hoje_br();
begin
  select * into l from tc_ligas where id = lid for update;
  if l.id is null or l.status = 'encerrada' then return; end if;
  select org_a, org_b into fx, fy from tc_partidas where liga_id = lid and fase = 'final' order by id limit 1;
  if fx is null then return; end if;
  camp := tc_vencedor_entre(lid, 'final', fx, fy);
  if camp is null then return; end if;
  for r in select t.org_id,
                  case when t.org_id = camp then 1
                       when t.org_id in (fx, fy) then 2
                       when exists (select 1 from tc_partidas p where p.liga_id = lid and p.fase = 'semi' and t.org_id in (p.org_a, p.org_b)) then 3
                       when exists (select 1 from tc_partidas p where p.liga_id = lid and p.fase = 'quartas' and t.org_id in (p.org_a, p.org_b)) then 5
                       else 9 end as pos
             from tc_liga_times t where t.liga_id = lid loop
    chave := r.pos::text;
    cred := coalesce(((tc_cfg('premios_intl'))->l.tipo->>chave)::bigint, 0);
    if cred > 0 then perform tc_creditos_mexer(r.org_id, cred, 'premiacao', lid::text); end if;
    pdr := null;
    base := ((tc_cfg('rank_intl'))->l.tipo->>chave)::int;
    select user_id into uid from tc_orgs where id = r.org_id;
    if uid is not null and base is not null and coalesce((tc_cfg('rank_ativo'))::text::boolean, false) then
      pdr := site_rk_ajustar(base, site_rk_nivel_de(uid));
      perform site_rk_lancar(uid, d, 'tecnico', 'partida', pdr);
    end if;
    insert into tc_premios (liga_id, org_id, posicao, creditos, rank_base, rank_pdr) values (lid, r.org_id, r.pos, cred, base, pdr) on conflict do nothing;
    if uid is not null then
      perform tc_fama_evento(r.org_id, 'intl:' || lid::text, 'internacional', case r.pos when 1 then ((tc_mkt_cfg())->'fama_eventos'->'internacional'->>'titulo')::numeric when 2 then ((tc_mkt_cfg())->'fama_eventos'->'internacional'->>'final')::numeric else ((tc_mkt_cfg())->'fama_eventos'->'internacional'->>'participacao')::numeric end);
    end if;
    if r.pos = 1 then
      insert into tc_trofeus (org_id, liga_id, titulo, temporada) values (r.org_id, lid, 'Campeão · ' || l.nome, l.temporada) on conflict do nothing;
    end if;
    if cred > 0 then
      perform tc_avisar(r.org_id, l.nome || ': ' || r.pos::text || 'º lugar, ' || cred::text || ' créditos.');
    end if;
  end loop;
  if l.tipo = 'copa' and tc_eh_real(camp) then
    insert into tc_vagas (org_id, temporada, tipo, origem) values (camp, l.temporada, 'mundial', 'copa') on conflict do nothing;
    perform tc_avisar(camp, 'Campeão da Copa! Vaga garantida no Campeonato Mundial.');
  end if;
  update tc_ligas set status = 'encerrada', encerrada_em = now() where id = lid;
end;
$$;
revoke all on function public.tc_encerrar_internacional(bigint) from public, anon, authenticated;

-- Promoção e vagas internacionais (sem rebaixamento): os 2 primeiros da Academy sobem para a Nacional; os 2 primeiros da Nacional ganham vaga.
--   semana 1 -> Copa da temporada; semanas 2 e 3 -> Mundial da temporada; semana 4 -> Copa da temporada seguinte.
create or replace function public.tc_aplicar_promocoes(temp int, sem int)
returns void language plpgsql security definer set search_path = public as $$
declare
  l record;
  pos_ int;
  tipo_v text;
begin
  for l in select id, divisao, dono_org from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and dono_org is not null loop
    select f.pos into pos_ from tc_tabela_final(l.id) f where f.org_id = l.dono_org;
    continue when pos_ is null or pos_ > 2;
    if l.divisao = 'acesso' then
      update tc_orgs set divisao = 'principal' where id = l.dono_org;
      perform tc_fama_evento(l.dono_org, 'promo:' || temp::text || ':' || sem::text, 'promocao', ((tc_mkt_cfg())->'fama_eventos'->'promocao'->>'pontos')::numeric);
      perform tc_avisar(l.dono_org, 'Promovido para a ' || ((tc_cfg('nomes'))->>'principal') || '!');
    else
      tipo_v := case when sem in (1, 4) then 'copa' else 'mundial' end;
      insert into tc_vagas (org_id, temporada, tipo, origem)
      values (l.dono_org, case when sem = 4 then temp + 1 else temp end, tipo_v, 'liga:' || sem::text) on conflict do nothing;
      perform tc_avisar(l.dono_org, case when tipo_v = 'copa' then 'Classificado para a Copa Internacional' else 'Classificado para o Campeonato Mundial' end
                                    || case when sem = 4 then ' da próxima temporada!' else '!' end);
    end if;
  end loop;
end;
$$;
revoke all on function public.tc_aplicar_promocoes(int, int) from public, anon, authenticated;

-- Reconstrói as vagas da temporada a partir das ligas já encerradas (usado ao migrar).
create or replace function public.tc_vagas_recalcular(temp int)
returns void language plpgsql security definer set search_path = public as $$
declare
  l record;
  pos_ int;
  camp bigint;
  fx bigint; fy bigint;
begin
  for l in select id, semana, dono_org from tc_ligas
            where tipo = 'divisao' and divisao = 'principal' and dono_org is not null and status = 'encerrada'
              and ((temporada = temp and semana <= 3) or (temporada = temp - 1 and semana = 4)) loop
    select f.pos into pos_ from tc_tabela_final(l.id) f where f.org_id = l.dono_org;
    continue when pos_ is null or pos_ > 2;
    insert into tc_vagas (org_id, temporada, tipo, origem)
    values (l.dono_org, temp, case when l.semana in (1, 4) then 'copa' else 'mundial' end, 'liga:' || l.semana::text) on conflict do nothing;
  end loop;
  for l in select id from tc_ligas where temporada = temp and tipo = 'copa' and status = 'encerrada' loop
    select org_a, org_b into fx, fy from tc_partidas where liga_id = l.id and fase = 'final' order by id limit 1;
    continue when fx is null;
    camp := tc_vencedor_entre(l.id, 'final', fx, fy);
    if camp is not null and tc_eh_real(camp) then
      insert into tc_vagas (org_id, temporada, tipo, origem) values (camp, temp, 'mundial', 'copa') on conflict do nothing;
    end if;
  end loop;
end;
$$;
revoke all on function public.tc_vagas_recalcular(int) from public, anon, authenticated;

-- Liga da semana: técnico que está num campeonato internacional na semana não joga a Nacional.
create or replace function public.tc_criar_ligas_semana(temp int, sem int, ini date)
returns void language plpgsql security definer set search_path = public as $$
declare
  o record;
begin
  for o in select oo.id from tc_orgs oo where oo.user_id is not null and oo.ativa
              and not exists (select 1 from tc_liga_times t join tc_ligas l on l.id = t.liga_id
                               where t.org_id = oo.id and l.temporada = temp and l.semana = sem and l.tipo in ('copa', 'mundial'))
            order by oo.id loop
    perform tc_criar_liga_privada(temp, sem, o.id, ini);
  end loop;
end;
$$;
revoke all on function public.tc_criar_ligas_semana(int, int, date) from public, anon, authenticated;

-- ---------------------------------------------------------------- gameplay: cada técnico joga a sua partida
-- Quem pode ver e registrar a partida: o técnico dono dela (na partida PVP, o técnico do ponto de vista; nunca o adversário) ou administrador.
create or replace function public.tc_gameplay_pode(p tc_partidas, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tc_orgs o where o.user_id = uid and o.id in (p.org_a, p.org_b) and (p.pov is null or p.pov = o.id))
      or exists (select 1 from site_admins where user_id = uid);
$$;
revoke all on function public.tc_gameplay_pode(tc_partidas, uuid) from public, anon, authenticated;

create or replace function public.tc_gameplay_lado_auto(pid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  prox jsonb; esc bigint; m int; azul bigint;
begin
  select * into p from tc_partidas where id = pid;
  prox := tc_gameplay_proximo(pid);
  if (prox->>'lado_definido')::boolean then return; end if;
  m := (prox->>'mapa')::int; esc := (prox->>'escolhe')::bigint;
  if exists (select 1 from tc_orgs where id = esc and user_id is not null) and (p.pov is null or p.pov = esc) then return; end if; -- no PVP o bot do adversário escolhe sozinho
  azul := case when tc_gameplay_semente(pid, m) % 2 = 0 then esc else case when esc = p.org_a then p.org_b else p.org_a end end;
  insert into tc_gameplay_lados (partida_id, mapa, org_azul) values (pid, m, azul) on conflict do nothing;
end;
$$;
revoke all on function public.tc_gameplay_lado_auto(bigint) from public, anon, authenticated;

create or replace function public.tc_partida_elencos(pid bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p tc_partidas;
  prox jsonb;
  azul bigint; verm bigint;
  mapa_ int;
  cfg jsonb := tc_cfg('gameplay');
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  select * into p from tc_partidas where id = pid;
  if p.id is null then raise exception 'partida_inexistente'; end if;
  if not tc_gameplay_pode(p, uid) then raise exception 'partida_nao_e_sua'; end if;
  if p.status <> 'agendada' then raise exception 'partida_ja_concluida'; end if;
  if p.dia > site_hoje_br() then raise exception 'partida_no_futuro'; end if;
  perform tc_completar_elenco(p.org_a);
  perform tc_completar_elenco(p.org_b);
  perform tc_gameplay_lado_auto(pid);
  prox := tc_gameplay_proximo(pid);
  mapa_ := (prox->>'mapa')::int;
  -- enquanto o lado não foi escolhido, a ordem (a, b) é só provisória
  azul := coalesce((prox->>'azul')::bigint, p.org_a);
  verm := case when azul = p.org_a then p.org_b else p.org_a end;
  return jsonb_build_object(
    'partida', tc_partida_json(p), 'mapa', mapa_, 'proximo', prox, 'semente', tc_gameplay_semente(pid, mapa_), 'versao', (cfg->>'versao')::int,
    'lado', jsonb_build_object('definido', (prox->>'lado_definido')::boolean, 'escolhe', (prox->>'escolhe')::bigint,
      'voce_escolhe', exists (select 1 from tc_orgs o where o.id = (prox->>'escolhe')::bigint and o.user_id = uid) or exists (select 1 from site_admins where user_id = uid)),
    'azul', jsonb_build_object('org', tc_org_json(azul), 'jogadores', tc_jogadores_da_partida(p, azul)),
    'vermelho', jsonb_build_object('org', tc_org_json(verm), 'jogadores', tc_jogadores_da_partida(p, verm)),
    'mapas', coalesce((select jsonb_agg(jsonb_build_object('mapa', g.mapa, 'vencedor', g.vencedor_org, 'duracao', g.duracao) order by g.mapa) from tc_gameplay_mapas g where g.partida_id = pid), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_partida_elencos(bigint) from public, anon;
grant execute on function public.tc_partida_elencos(bigint) to authenticated;

create or replace function public.tc_gameplay_pendente()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := tc_cfg('gameplay');
  meu bigint;
  p tc_partidas;
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then return jsonb_build_object('ativo', false); end if;
  select id into meu from tc_orgs where user_id = uid;
  if meu is null then return jsonb_build_object('ativo', true, 'partida', null); end if;
  select * into p from tc_partidas where status = 'agendada' and dia <= site_hoje_br() and (pov = meu or (pov is null and meu in (org_a, org_b))) order by dia, id limit 1;
  return jsonb_build_object('ativo', true, 'partida', case when p.id is null then null else tc_partida_json(p) end,
                            'proximo', case when p.id is null then null else tc_gameplay_proximo(p.id) end);
end;
$$;
revoke all on function public.tc_gameplay_pendente() from public, anon;
grant execute on function public.tc_gameplay_pendente() to authenticated;

create or replace function public.tc_gameplay_registrar(pid bigint, mapa_ int, resultado jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p tc_partidas;
  cfg jsonb := tc_cfg('gameplay');
  prox jsonb;
  azul bigint; verm bigint; venc bigint; perd bigint;
  v_a int; v_b int; nec int;
  dur int;
  res jsonb;
  pa double precision; pb double precision;
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  select * into p from tc_partidas where id = pid for update;
  if p.id is null then raise exception 'partida_inexistente'; end if;
  if not tc_gameplay_pode(p, uid) then raise exception 'partida_nao_e_sua'; end if;
  if p.status <> 'agendada' then raise exception 'partida_ja_concluida'; end if;
  prox := tc_gameplay_proximo(pid);
  if mapa_ <> (prox->>'mapa')::int then raise exception 'mapa_fora_de_ordem'; end if;
  if (resultado->>'semente')::bigint is distinct from tc_gameplay_semente(pid, mapa_) then raise exception 'semente_invalida'; end if;
  if (resultado->>'versaoRegras')::int is distinct from (cfg->>'versao')::int then raise exception 'versao_invalida'; end if;
  if coalesce(resultado->>'vencedor', '') not in ('azul', 'vermelho') or coalesce((resultado->>'interrompida')::boolean, false) then raise exception 'resultado_invalido'; end if;
  dur := (resultado->>'duracao')::int;
  if dur is null or dur < 300 or dur > 7200 then raise exception 'duracao_invalida'; end if;
  azul := (prox->>'azul')::bigint;
  verm := case when azul = p.org_a then p.org_b else p.org_a end;
  venc := case when resultado->>'vencedor' = 'azul' then azul else verm end;
  insert into tc_gameplay_mapas (partida_id, mapa, org_azul, vencedor_org, semente, duracao, resumo, registrado_por)
  values (pid, mapa_, azul, venc, (resultado->>'semente')::bigint, dur, jsonb_build_object(
            'vencedor', resultado->>'vencedor', 'equipes', resultado->'equipes', 'mvp', resultado->'mvp', 'jogadores', resultado->'jogadores', 'motivo', resultado->>'motivo'), uid);
  select count(*) filter (where vencedor_org = p.org_a), count(*) filter (where vencedor_org = p.org_b) into v_a, v_b from tc_gameplay_mapas where partida_id = pid;
  nec := (p.formato + 1) / 2;
  if v_a < nec and v_b < nec then
    return jsonb_build_object('concluida', false, 'placar_a', v_a, 'placar_b', v_b, 'proximo', tc_gameplay_proximo(pid));
  end if;
  -- fechou a série: mesmo fechamento da simulação do sistema
  perd := case when v_a >= nec then p.org_b else p.org_a end;
  venc := case when v_a >= nec then p.org_a else p.org_b end;
  pa := tc_poder_org(p.org_a); pb := tc_poder_org(p.org_b);
  res := jsonb_build_object('a', v_a, 'b', v_b, 'origem', 'gameplay', 'mapas', (
    select jsonb_agg(jsonb_build_object('mapa', g.mapa, 'duracao', round(g.duracao / 60.0)::int, 'gameplay', true,
             'vencedor', case when g.vencedor_org = p.org_a then 'a' else 'b' end,
             'abates', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'azul'->'abates', g.resumo->'equipes'->'vermelho'->'abates')
                            else jsonb_build_array(g.resumo->'equipes'->'vermelho'->'abates', g.resumo->'equipes'->'azul'->'abates') end,
             'torres', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'vermelho'->'torresPerdidas', g.resumo->'equipes'->'azul'->'torresPerdidas')
                            else jsonb_build_array(g.resumo->'equipes'->'azul'->'torresPerdidas', g.resumo->'equipes'->'vermelho'->'torresPerdidas') end,
             'dragoes', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'azul'->'dragoes', g.resumo->'equipes'->'vermelho'->'dragoes')
                             else jsonb_build_array(g.resumo->'equipes'->'vermelho'->'dragoes', g.resumo->'equipes'->'azul'->'dragoes') end,
             'mvp', coalesce(g.resumo->'mvp'->>'nome', '')) order by g.mapa) from tc_gameplay_mapas g where g.partida_id = pid));
  update tc_partidas set status = 'concluida', placar_a = v_a, placar_b = v_b, vencedor = venc,
         poder_a = round(pa::numeric, 1), poder_b = round(pb::numeric, 1), resumo = res, processada = now()
   where id = pid;
  update tc_jogadores set forma = least(75, forma + 4) where org_id = venc and slot is not null and (p.pov is null or org_id = p.pov);
  update tc_jogadores set forma = greatest(25, forma - 4) where org_id = perd and slot is not null and (p.pov is null or org_id = p.pov);
  if (p.pov is null or venc = p.pov) and p.fase <> 'treino' then perform tc_fama_vitoria(venc, pid); end if;
  return jsonb_build_object('concluida', true, 'placar_a', v_a, 'placar_b', v_b, 'vencedor', venc);
end;
$$;
revoke all on function public.tc_gameplay_registrar(bigint, int, jsonb) from public, anon;
grant execute on function public.tc_gameplay_registrar(bigint, int, jsonb) to authenticated;

create or replace function public.tc_gameplay_mapa_premios()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  tr jsonb := tc_cfg('treino');
  org_perd bigint; x jsonb; org_x bigint; ganhou boolean;
begin
  select * into p from tc_partidas where id = new.partida_id;
  org_perd := case when new.vencedor_org = p.org_a then p.org_b else p.org_a end;
  update tc_jogadores j set exp = least(100, exp + coalesce((tr->>'exp_partida')::int, 10))
   where j.org_id = new.vencedor_org and j.slot is not null and (p.pov is null or j.org_id = p.pov) and exists (select 1 from tc_orgs o where o.id = j.org_id and o.user_id is not null);
  update tc_jogadores j set exp = least(100, exp + coalesce((tr->>'exp_derrota')::int, 5))
   where j.org_id = org_perd and j.slot is not null and (p.pov is null or j.org_id = p.pov) and exists (select 1 from tc_orgs o where o.id = j.org_id and o.user_id is not null);
  for x in select * from jsonb_array_elements(coalesce(new.resumo->'jogadores', '[]'::jsonb)) loop
    org_x := case when x->>'equipe' = 'azul' then new.org_azul else case when new.org_azul = p.org_a then p.org_b else p.org_a end end;
    continue when not exists (select 1 from tc_orgs o where o.id = org_x and o.user_id is not null) or (p.pov is not null and org_x <> p.pov);
    perform tc_maestria_registrar((x->>'id')::bigint, (select c.id from tc_campeoes c where c.nome = x->>'campeao'), org_x = new.vencedor_org);
  end loop;
  return new;
end;
$$;
revoke all on function public.tc_gameplay_mapa_premios() from public, anon, authenticated;

create or replace function public.tc_processar_partida(pid bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  r jsonb;
  pa double precision;
  pb double precision;
  venc bigint;
  perd bigint;
  nec int;
  esperando boolean := false;
  ausentes bigint[];
  jogou boolean := not coalesce((tc_cfg('gameplay')->>'ativo')::boolean, false); -- com o gameplay ligado, partida simulada pelo sistema não dá XP
begin
  select * into p from tc_partidas where id = pid for update;
  if p.id is null or p.status <> 'agendada' then
    return false;
  end if;
  nec := (p.formato + 1) / 2;
  if coalesce((tc_cfg('gameplay')->>'ativo')::boolean, false)
     and exists (select 1 from tc_orgs where id in (p.org_a, p.org_b) and user_id is not null and (p.pov is null or id = p.pov)) then
    -- ainda dentro do prazo (até a meia-noite do dia da partida): espera o técnico jogar
    if site_hoje_br() < p.dia + coalesce((tc_cfg('gameplay')->>'prazo_dias')::int, 1) then
      return false;
    end if;
    -- prazo vencido: quem é técnico e já tinha a organização no dia da partida perde por W.O.
    select coalesce(array_agg(id), '{}') into ausentes from tc_orgs
     where id in (p.org_a, p.org_b) and user_id is not null and criado::date <= p.dia and (p.pov is null or id = p.pov);
    if coalesce(array_length(ausentes, 1), 0) = 1 then
      perd := ausentes[1];
      venc := case when perd = p.org_a then p.org_b else p.org_a end;
      update tc_partidas set status = 'concluida', placar_a = case when venc = p.org_a then nec else 0 end, placar_b = case when venc = p.org_b then nec else 0 end,
             vencedor = venc, poder_a = round(tc_poder_org(p.org_a)::numeric, 1), poder_b = round(tc_poder_org(p.org_b)::numeric, 1),
             resumo = jsonb_build_object('origem', 'wo', 'ausente', perd), processada = now()
       where id = p.id;
      if (p.pov is null or venc = p.pov) and p.fase <> 'treino' then perform tc_fama_vitoria(venc, p.id); end if;
      perform tc_avisar(perd, 'Derrota por W.O.: a partida do dia ' || to_char(p.dia, 'DD/MM') || ' não foi jogada até a meia-noite.')
        where exists (select 1 from tc_orgs where id = perd and user_id is not null);
      return true;
    end if;
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
  update tc_jogadores set forma = least(75, forma + 4), exp = case when jogou then least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_partida')::int, 10)) else exp end where org_id = venc and slot is not null and (p.pov is null or org_id = p.pov);
  update tc_jogadores set forma = greatest(25, forma - 4), exp = case when jogou then least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_derrota')::int, 5)) else exp end where org_id = perd and slot is not null and (p.pov is null or org_id = p.pov);
  if (p.pov is null or venc = p.pov) and p.fase <> 'treino' then perform tc_fama_vitoria(venc, p.id); end if;
  return true;
end;
$$;
revoke all on function public.tc_processar_partida(bigint) from public, anon, authenticated;

create or replace function public.tc_painel()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  cal jsonb := tc_calendario();
  lid bigint;
  prox tc_partidas;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then return jsonb_build_object('org', null); end if;
  if (cal->>'antes')::boolean then
    return jsonb_build_object('antes', true, 'inicio', cal->'inicio');
  end if;
  select l.id into lid from tc_ligas l join tc_liga_times t on t.liga_id = l.id
   where t.org_id = o.id order by l.temporada desc, l.semana desc, l.id desc limit 1; -- liga da semana ou, na semana internacional, a Copa/Mundial
  select p.* into prox from tc_partidas p join tc_ligas l on l.id = p.liga_id
   where p.status = 'agendada' and ((p.pov is null and o.id in (p.org_a, p.org_b)) or p.pov = o.id) order by p.dia, p.id limit 1;
  return jsonb_build_object(
    'calendario', cal,
    'liga', case when lid is null then null else tc_liga_json(lid) end,
    'proxima', case when prox.id is null then null else tc_partida_json(prox) end,
    'ultimos', coalesce((select jsonb_agg(tc_partida_vis(p) order by p.dia desc, p.id desc)
                           from (select * from tc_partidas where status = 'concluida' and ((pov is null and o.id in (org_a, org_b)) or pov = o.id) order by dia desc, id desc limit 6) p), '[]'::jsonb),
    'trofeus', coalesce((select jsonb_agg(jsonb_build_object('titulo', t.titulo, 'temporada', t.temporada) order by t.id desc) from tc_trofeus t where t.org_id = o.id), '[]'::jsonb),
    'financas', coalesce((select jsonb_agg(jsonb_build_object('delta', f.delta, 'saldo', f.saldo, 'motivo', f.motivo, 'criado', f.criado) order by f.id desc)
                            from (select * from tc_fin where org_id = o.id order by id desc limit 8) f), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_painel() from public, anon;
grant execute on function public.tc_painel() to authenticated;

create or replace function public.tc_historico()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then return jsonb_build_object('org', null); end if;
  return jsonb_build_object(
    'transferencias', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'jogador', jg.nome, 'tipo', t.tipo, 'valor', t.valor, 'moeda', t.moeda,
                                  'de', (select nome from tc_orgs where id = t.de_org), 'para', (select nome from tc_orgs where id = t.para_org), 'criado', t.criado) order by t.id desc)
                                  from (select * from tc_transf where de_org = o.id or para_org = o.id order by id desc limit 20) t join tc_jogadores jg on jg.id = t.jogador_id), '[]'::jsonb),
    'partidas', coalesce((select jsonb_agg(tc_partida_json(p) order by p.dia desc, p.id desc)
                            from (select * from tc_partidas where status = 'concluida' and ((pov is null and o.id in (org_a, org_b)) or pov = o.id) order by dia desc, id desc limit 10) p), '[]'::jsonb),
    'premios', coalesce((select jsonb_agg(jsonb_build_object('liga', l.nome, 'posicao', pr.posicao, 'creditos', pr.creditos, 'pdr', pr.rank_pdr, 'criado', pr.criado) order by pr.criado desc)
                           from tc_premios pr join tc_ligas l on l.id = pr.liga_id where pr.org_id = o.id), '[]'::jsonb),
    'trofeus', coalesce((select jsonb_agg(jsonb_build_object('titulo', t.titulo, 'temporada', t.temporada) order by t.id desc) from tc_trofeus t where t.org_id = o.id), '[]'::jsonb),
    'financas', coalesce((select jsonb_agg(jsonb_build_object('delta', f.delta, 'saldo', f.saldo, 'motivo', f.motivo, 'ref', f.ref, 'criado', f.criado) order by f.id desc)
                            from (select * from tc_fin where org_id = o.id order by id desc limit 20) f), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_historico() from public, anon;
grant execute on function public.tc_historico() to authenticated;

create or replace function public.tc_partida_json(p tc_partidas)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'liga_id', p.liga_id, 'fase', p.fase, 'rodada', p.rodada, 'dia', p.dia, 'formato', p.formato,
                            'status', p.status, 'a', tc_org_json(p.org_a), 'b', tc_org_json(p.org_b),
                            'placar_a', p.placar_a, 'placar_b', p.placar_b, 'vencedor', p.vencedor,
                            'poder_a', p.poder_a, 'poder_b', p.poder_b, 'pov', p.pov)
         || coalesce((select jsonb_build_object('liga_nome', l.nome, 'liga_tipo', l.tipo, 'liga_divisao', l.divisao) from tc_ligas l where l.id = p.liga_id), '{}'::jsonb);
$$;
revoke all on function public.tc_partida_json(tc_partidas) from public, anon, authenticated;

-- Partida como o técnico a vê; nos mata-matas o "vencedor" é quem avança de verdade (pode diferir do resultado do próprio técnico no desempate).
create or replace function public.tc_partida_vis(p tc_partidas)
returns jsonb language sql stable security definer set search_path = public as $$
  select tc_partida_json(p)
         || case when p.status = 'concluida' and p.fase in ('quartas', 'semi', 'final')
                 then jsonb_build_object('vencedor', coalesce(tc_vencedor_entre(p.liga_id, p.fase, p.org_a, p.org_b), p.vencedor)) else '{}'::jsonb end;
$$;
revoke all on function public.tc_partida_vis(tc_partidas) from public, anon, authenticated;

-- Liga/Copa/Mundial em JSON. As partidas PVP aparecem do ponto de vista de quem consulta (a do adversário fica escondida);
-- nos mata-matas o "vencedor" é quem avança de verdade.
create or replace function public.tc_liga_json(lid bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l tc_ligas;
  tab jsonb;
  meu bigint := (select id from tc_orgs where user_id = auth.uid());
  destino text;
begin
  select * into l from tc_ligas where id = lid;
  if l.id is null then return null; end if;
  destino := case when l.divisao = 'acesso' then 'promocao' when l.semana in (1, 4) then 'copa' else 'mundial' end;
  if l.tipo = 'divisao' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'pos', f.pos, 'pos_pontos', t.pos, 'org', tc_org_json(t.org_id), 'partidas', t.partidas, 'vitorias', t.vitorias, 'derrotas', t.derrotas,
             'mapas_pro', t.mapas_pro, 'mapas_contra', t.mapas_contra, 'saldo', t.mapas_pro - t.mapas_contra, 'pontos', t.pontos,
             'poder', round(tc_poder_org(t.org_id)::numeric, 1),
             'pos_final', f.pos,
             'situacao', case when f.pos <= 2 then destino else 'permanece' end) order by f.pos), '[]'::jsonb) into tab
      from tc_tabela(lid) t join tc_tabela_final(lid) f on f.org_id = t.org_id;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
             'pos', t.pos, 'pos_pontos', t.pos, 'grupo', lt.grupo, 'semente', lt.semente, 'org', tc_org_json(t.org_id),
             'partidas', t.partidas, 'vitorias', t.vitorias, 'derrotas', t.derrotas,
             'mapas_pro', t.mapas_pro, 'mapas_contra', t.mapas_contra, 'saldo', t.mapas_pro - t.mapas_contra, 'pontos', t.pontos,
             'poder', round(tc_poder_org(t.org_id)::numeric, 1),
             'situacao', case when l.tipo = 'copa' and t.pos <= 4 then 'semi' when l.tipo = 'mundial' and t.pos <= 2 then 'quartas' else 'eliminado' end)
             order by lt.grupo nulls first, t.pos), '[]'::jsonb) into tab
      from tc_tabela(lid) t join tc_liga_times lt on lt.liga_id = lid and lt.org_id = t.org_id;
  end if;
  return jsonb_build_object('id', l.id, 'nome', l.nome, 'divisao', l.divisao, 'tipo', l.tipo, 'status', l.status,
                            'temporada', l.temporada, 'semana', l.semana, 'dono', l.dono_org, 'tabela', tab,
                            'partidas', coalesce((select jsonb_agg(tc_partida_vis(p) order by p.dia, p.id)
                                                    from tc_partidas p
                                                   where p.liga_id = l.id
                                                     and (p.pov is null or p.pov = meu or meu is null
                                                          or (not exists (select 1 from tc_partidas q where q.liga_id = p.liga_id and q.fase = p.fase and q.rodada = p.rodada
                                                                             and q.org_a = p.org_a and q.org_b = p.org_b and q.pov = meu)
                                                              and p.id = (select min(q2.id) from tc_partidas q2 where q2.liga_id = p.liga_id and q2.fase = p.fase and q2.rodada = p.rodada
                                                                             and q2.org_a = p.org_a and q2.org_b = p.org_b)))), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_liga_json(bigint) from public, anon, authenticated;

create or replace function public.tc_sincronizar()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cal jsonb := tc_calendario();
  hoje date := site_hoje_br();
  gw_hoje int;
  gw int;
  c jsonb;
  inicio date := ((tc_cfg('calendario'))->>'inicio')::date;
  la bigint;
  lp bigint;
  lc bigint;
  lm bigint;
  p record;
  feitas int := 0;
  o record;
  pend int;
  passo int;
  temp int;
  sem int;
  ini date;
  av1 boolean; av2 boolean; av3 boolean; av4 boolean;
begin
  perform tc_exigir(uid);
  if (cal->>'antes')::boolean then
    return jsonb_build_object('antes', true, 'inicio', inicio);
  end if;
  perform pg_advisory_xact_lock(85002);
  perform tc_garantir_sistema();
  delete from tc_snap_dia where dia < hoje - 7;
  gw_hoje := (cal->>'gw')::int;
  select valor into c from tc_config where chave = 'semana_proc';
  if c is null then
    insert into tc_config (chave, valor) values ('semana_proc', to_jsonb(gw_hoje));
    gw := gw_hoje;
  else
    gw := (c::text)::int;
  end if;
  while gw <= gw_hoje loop
    temp := gw / 4 + 1;
    sem := gw % 4 + 1;
    ini := inicio + gw * 7;
    lc := case when sem = 2 then tc_criar_copa(temp, sem, ini) else null end; -- internacionais primeiro: quem joga a Copa/Mundial não joga a Nacional
    lm := case when sem = 4 then tc_criar_mundial(temp, sem, ini) else null end;
    perform tc_criar_ligas_semana(temp, sem, ini);
    -- Processa o que já pode ser jogado e avança as chaves (até 4 passes: quartas, semifinais, final).
    for passo in 1..6 loop
      for p in select id from tc_partidas where liga_id in (select id from tc_ligas where temporada = temp and semana = sem)
                and status = 'agendada' and dia <= hoje order by dia, id loop
        if tc_processar_partida(p.id) then feitas := feitas + 1; end if;
      end loop;
      av1 := coalesce(tc_avancar(lc), false); av2 := coalesce(tc_avancar(lm), false);
      av3 := tc_avancar_semana(temp, sem); av4 := false;
      exit when not (av1 or av2 or av3 or av4);
    end loop;
    select count(*) into pend from tc_partidas where liga_id in (select id from tc_ligas where temporada = temp and semana = sem) and status = 'agendada';
    exit when pend > 0 or not tc_internacional_completo(lc) or not tc_internacional_completo(lm);
    perform tc_encerrar_semana(temp, sem);
    if lc is not null then perform tc_encerrar_internacional(lc); end if;
    if lm is not null then perform tc_encerrar_internacional(lm); end if;
    perform tc_aplicar_promocoes(temp, sem);
    for o in select id from tc_orgs where ativa order by id loop
      perform tc_fechar_semana_org(o.id, gw);
    end loop;
    update tc_config set valor = to_jsonb(gw + 1) where chave = 'semana_proc';
    gw := gw + 1;
  end loop;
  return jsonb_build_object('processadas', feitas, 'gw', gw_hoje, 'temporada', cal->'temporada', 'semana', cal->'semana', 'dia', cal->'dia');
end;
$$;
revoke all on function public.tc_sincronizar() from public, anon;
grant execute on function public.tc_sincronizar() to authenticated;

-- Aba Campeonatos: as ligas do técnico e as vagas internacionais que ele já conquistou.
create or replace function public.tc_campeonatos()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cal jsonb := tc_calendario();
  oid bigint;
begin
  perform tc_exigir(uid);
  if (cal->>'antes')::boolean then
    return jsonb_build_object('antes', true, 'inicio', cal->'inicio', 'ligas', '[]'::jsonb);
  end if;
  select id into oid from tc_orgs where user_id = uid;
  return jsonb_build_object(
    'calendario', cal, 'nomes', tc_cfg('nomes'),
    'vagas', coalesce((select jsonb_agg(jsonb_build_object('temporada', v.temporada, 'tipo', v.tipo) order by v.temporada, v.tipo) from tc_vagas v where v.org_id = oid and v.temporada >= (cal->>'temporada')::int), '[]'::jsonb),
    'ligas', coalesce((select jsonb_agg(tc_liga_json(l.id) order by l.temporada desc, l.semana desc, l.tipo, l.divisao)
                         from (select l2.* from tc_ligas l2 where l2.id in (select liga_id from tc_liga_times where org_id = oid)
                                order by l2.temporada desc, l2.semana desc, l2.id desc limit 8) l), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_campeonatos() from public, anon;
grant execute on function public.tc_campeonatos() to authenticated;

-- ---------------------------------------------------------------- dados já existentes
-- Vagas da temporada atual a partir das ligas encerradas; Copa e Mundial antigos (4 e 6 equipes) da semana atual ainda em aberto são apagados
-- e recriados no novo formato; quem tem vaga na semana atual deixa de ter a liga da Nacional dela.
do $$
declare
  hoje date := site_hoje_br();
  ini date := ((tc_cfg('calendario'))->>'inicio')::date;
  gw int;
  temp int;
  sem int;
begin
  if hoje < ini then return; end if;
  gw := floor((hoje - ini) / 7.0)::int;
  temp := gw / 4 + 1; sem := gw % 4 + 1;
  perform tc_vagas_recalcular(temp);
  delete from tc_ligas l where l.temporada = temp and l.semana = sem and l.tipo in ('copa', 'mundial') and l.status = 'aberta'
     and (select count(*) from tc_liga_times t where t.liga_id = l.id) <> 16;
  if sem in (2, 4) then
    delete from tc_ligas l where l.temporada = temp and l.semana = sem and l.tipo = 'divisao' and l.status = 'aberta' and l.dono_org in (
      select v.org_id from tc_vagas v where v.temporada = temp and v.tipo = case when sem = 2 then 'copa' else 'mundial' end);
  end if;
end;
$$;
