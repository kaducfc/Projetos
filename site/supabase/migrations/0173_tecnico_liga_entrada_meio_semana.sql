-- Simulador de Técnico: conta nova entra direto na Liga Academy, no dia em que criou a organização. Rode depois do 0172. Idempotente.
--  * Segunda a sexta: a liga da semana começa HOJE. Todos os times começam com 0 jogos e jogam 2 jogos por dia até sexta
--    (entrou na quinta: 2 jogos na quinta e 2 na sexta; na segunda: os 10 jogos de sempre). Os 4 melhores por pontos vão para as semifinais
--    (sábado, MD3) e depois para a final (domingo, MD5), como sempre.
--  * Empate de pontos nas ligas dos técnicos (Academy e Nacional): o técnico real fica na frente das equipes do sistema e avança.
--  * Sábado e domingo: a conta espera a próxima semana (a liga dela começa na segunda). Da semana seguinte em diante tudo segue normal
--    (promoção, Copa, Mundial...). Quem já existia não muda.
--  * tc_orgs.liga_inicio guarda o dia em que a conta entrou (contas antigas ficam nulas e seguem o calendário da semana).

alter table public.tc_orgs add column if not exists liga_inicio date;

create or replace function public.tc_criar_org(nome_ text, sigla_ text, escudo_ text default 'v4:1:083871:12131d', cor1_ text default '#1b3a6b', cor2_ text default '#d9a82b', estilo_ text default 'classico')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n text := regexp_replace(trim(coalesce(nome_, '')), '\s+', ' ', 'g');
  s text := upper(trim(coalesce(sigla_, '')));
  oid bigint;
begin
  perform tc_exigir(uid);
  if char_length(n) < 3 or char_length(n) > 24 or n !~ '^[[:alnum:] ._''-]+$' then
    raise exception 'nome_invalido';
  end if;
  if s !~ '^[A-Z0-9]{2,4}$' then
    raise exception 'sigla_invalida';
  end if;
  if escudo_ !~ '^(v4:([1-9]|[1-3][0-9]|4[0-9])(:[0-9a-f]{6}){1,3}|v3:[A-Za-z0-9À-ÿ .&!''+-]{1,14}:([1-9]|1[01]):[0-9a-f]{6}:[0-9a-f]{6}:[0-8]:[0-9a-f]{6}:[0-6]:[0-9a-f]{6}:[0-3]:[0-9a-f]{6}:[0-9a-f]{6})$' then
    raise exception 'escudo_invalido';
  end if;
  if escudo_ like 'v3:%' and lower(split_part(escudo_, ':', 2)) <> lower(btrim(nome_)) then
    raise exception 'escudo_invalido'; -- a escrita do emblema é sempre o nome do time
  end if;
  if estilo_ not in ('classico', 'moderno', 'tecnologico') then
    raise exception 'estilo_invalido';
  end if;
  if exists (select 1 from tc_orgs where user_id = uid) then
    raise exception 'ja_tem_org';
  end if;
  if exists (select 1 from tc_orgs where lower(nome) = lower(n)) then
    raise exception 'nome_em_uso';
  end if;
  if exists (select 1 from tc_orgs where sigla = s) then
    raise exception 'sigla_em_uso';
  end if;
  -- Sem limite de técnicos: cada um joga o seu próprio campeonato contra equipes do sistema.
  insert into tc_orgs (user_id, nome, sigla, escudo, cor1, cor2, estilo, creditos, divisao, liga_inicio)
  values (uid, n, s, escudo_, cor1_, cor2_, estilo_, ((tc_cfg('creditos_iniciais'))::text)::bigint, 'acesso', site_hoje_br())
  returning id into oid;
  insert into tc_fin (org_id, delta, saldo, motivo) values (oid, ((tc_cfg('creditos_iniciais'))::text)::bigint, ((tc_cfg('creditos_iniciais'))::text)::bigint, 'inicial');
  perform tc_elenco_inicial(oid);
  return jsonb_build_object('id', oid);
exception when unique_violation then
  raise exception 'nome_ou_sigla_em_uso';
end;
$$;

create or replace function public.tc_criar_liga_privada(temp int, sem int, dono bigint, inicio_semana date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  o tc_orgs;
  lid bigint;
  times bigint[];
  n int;
  rod int;
  rods int := 10;
  i int;
  a bigint;
  b bigint;
  rot bigint[];
  comeco date := inicio_semana; -- primeiro dia de jogos da liga
begin
  select * into o from tc_orgs where id = dono;
  if o.id is null or o.user_id is null then return null; end if;
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and divisao = o.divisao and dono_org = dono;
  if lid is not null then return lid; end if;
  -- Conta nova: a liga começa no dia em que ela entrou (segunda a sexta, 2 jogos por dia até sexta). Sábado e domingo: espera a próxima semana.
  if o.liga_inicio is not null then
    if o.liga_inicio > inicio_semana + 6 then return null; end if; -- a conta ainda não existia nesta semana
    if o.liga_inicio >= inicio_semana then
      if o.liga_inicio >= inicio_semana + 5 then return null; end if; -- entrou no sábado ou no domingo
      comeco := o.liga_inicio;
      rods := 10 - 2 * (comeco - inicio_semana);
    end if;
  end if;
  select array[dono] || coalesce(array_agg(x.id), '{}') into times from (
    select id from tc_orgs where user_id is null and ativa
     order by (divisao = o.divisao) desc, md5(id::text || ':' || dono::text || ':' || temp::text || ':' || sem::text) limit 7) x; -- da própria divisão; se faltar, completa com as da outra
  n := coalesce(array_length(times, 1), 0);
  if n <> 8 then raise exception 'times_insuficientes'; end if;
  insert into tc_ligas (temporada, semana, divisao, tipo, nome, dono_org)
  values (temp, sem, o.divisao, 'divisao', (tc_cfg('nomes'))->>o.divisao || ' · S' || temp::text || ' semana ' || sem::text, dono) returning id into lid;
  for i in 1..n loop
    insert into tc_liga_times (liga_id, org_id, semente) values (lid, times[i], i);
  end loop;
  rot := times;
  for rod in 1..rods loop -- rodadas 1 a 7 únicas; 8 a 10 repetem 1 a 3
    for i in 1..(n / 2) loop
      a := rot[i];
      b := rot[n + 1 - i];
      insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato)
      values (lid, 'rodada', rod, comeco + ((rod - 1) / 2), least(a, b), greatest(a, b), 1);
    end loop;
    rot := array[rot[1]] || rot[n] || rot[2:n - 1];
    if rod = n - 1 then rot := times; end if;
  end loop;
  return lid;
end;
$$;
revoke all on function public.tc_criar_liga_privada(int, int, bigint, date) from public, anon, authenticated;

-- Playoffs: a segunda-feira da semana vem da data dos jogos, porque a liga de quem entrou no meio da semana começa depois dela.
create or replace function public.tc_avancar_divisao(lid bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  l tc_ligas;
  t bigint[];
  d0 date;
  pend int;
  w1 bigint;
  w2 bigint;
begin
  select * into l from tc_ligas where id = lid;
  if l.id is null or l.tipo <> 'divisao' or l.status = 'encerrada' then return false; end if;
  if not exists (select 1 from tc_partidas where liga_id = lid and fase = 'rodada') then return false; end if;
  select min(dia) into d0 from tc_partidas where liga_id = lid and fase = 'rodada';
  d0 := d0 - (extract(isodow from d0)::int - 1); -- segunda-feira da semana da liga (a liga de quem entrou no meio da semana começa depois dela)
  select count(*) into pend from tc_partidas where liga_id = lid and fase = 'rodada' and status = 'agendada';
  if pend > 0 then return false; end if;
  if not exists (select 1 from tc_partidas where liga_id = lid and fase = 'semi') then
    select array_agg(org_id order by pos) into t from tc_tabela(lid) where pos <= 4;
    if coalesce(array_length(t, 1), 0) < 4 then return false; end if;
    insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato) values
      (lid, 'semi', 1, d0 + 5, least(t[1], t[4]), greatest(t[1], t[4]), 3),
      (lid, 'semi', 1, d0 + 5, least(t[2], t[3]), greatest(t[2], t[3]), 3) on conflict do nothing;
    return true;
  end if;
  select count(*) into pend from tc_partidas where liga_id = lid and fase = 'semi' and status = 'agendada';
  if pend = 0 and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'final') then
    select vencedor into w1 from tc_partidas where liga_id = lid and fase = 'semi' order by id limit 1;
    select vencedor into w2 from tc_partidas where liga_id = lid and fase = 'semi' order by id desc limit 1;
    if w1 is null or w2 is null then return false; end if;
    insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato)
    values (lid, 'final', 2, d0 + 6, least(w1, w2), greatest(w1, w2), 5) on conflict do nothing;
    return true;
  end if;
  return false;
end;
$$;

-- Classificação: empate de pontos nas ligas dos técnicos dá prioridade ao técnico real.
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
  ), rl as (
    select t.org_id, (o.user_id is not null) as real from tc_liga_times t join tc_orgs o on o.id = t.org_id where t.liga_id = liga
  ), h2h as (
    select b.org, (count(*) filter (where b.pro > b.contra))::int as h
      from base b join tot s on s.org_id = b.org join tot o on o.org_id = b.opp
     where s.pontos = o.pontos group by b.org
  )
  select (row_number() over (partition by tot.grupo order by tot.pontos desc, (case when coalesce(rl.real, false) and (select l.tipo from tc_ligas l where l.id = liga) = 'divisao' then 0 else 1 end), coalesce(h2h.h, 0) desc, tot.tempo, tot.semente, tot.org_id))::int as pos,
         tot.org_id, tot.partidas, tot.vitorias, tot.derrotas, tot.mapas_pro, tot.mapas_contra, tot.pontos
    from tot left join h2h on h2h.org = tot.org_id left join rl on rl.org_id = tot.org_id order by tot.grupo nulls first, pos;
$$;
