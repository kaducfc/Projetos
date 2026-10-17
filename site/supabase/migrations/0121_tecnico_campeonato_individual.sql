-- Campeonatos individuais: cada técnico joga o SEU campeonato (Liga Academy ou Liga Nacional) contra equipes fictícias.
--   * A liga da semana de um técnico tem 8 equipes: ele e 7 equipes do sistema (escolhidas por sorteio fixo). Os técnicos só se
--     encontram nos campeonatos internacionais.
--   * Fase de pontos (segunda a sexta, 2 jogos por dia, MD1), semifinais MD3 no sábado e final MD5 no domingo.
--   * Promoção: os 2 primeiros da Academy sobem para a Nacional; os 2 últimos da Nacional descem. Equipes do sistema não trocam de divisão.
--   * Copa Internacional (semana 2) e Campeonato Mundial (semana 4): com os técnicos que terminaram entre os 2 primeiros da
--     Liga Nacional (Copa: semana 1; Mundial: semanas 1 a 3); as vagas que sobrarem são preenchidas por equipes do sistema.
--   * Gameplay ligado: o técnico joga a partida no navegador; se passar da meia-noite do dia da partida sem jogar, é derrota (W.O.).
--     Para quem criou a organização depois do dia da partida, a partida é simulada pelo sistema (não conta como W.O.).
-- Rode depois da 0120. Seguro rodar de novo.

alter table public.tc_ligas add column if not exists dono_org bigint references public.tc_orgs(id) on delete cascade;
drop index if exists public.tc_ligas_unica;
create unique index if not exists tc_ligas_unica on public.tc_ligas (temporada, semana, tipo, divisao, coalesce(dono_org, 0));

-- Equipes do sistema não são mais deslocadas quando um técnico entra.
drop trigger if exists tc_orgs_deslocar on public.tc_orgs;

-- Criação da organização: sem limite de técnicos por divisão.
create or replace function public.tc_criar_org(nome_ text, sigla_ text, escudo_ text default 'escudo-1', cor1_ text default '#1b3a6b', cor2_ text default '#d9a82b', estilo_ text default 'classico')
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
  if escudo_ !~ '^(escudo-[1-6]|v2:([1-9]|[12][0-9]|30):[0-9a-f]{6}:[0-9a-f]{6}:[0-9a-f]{6}:([0-9]|1[0-9]|20):[0-9a-f]{6}:[0-9a-f]{6})$' then
    raise exception 'escudo_invalido';
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
  insert into tc_orgs (user_id, nome, sigla, escudo, cor1, cor2, estilo, creditos, divisao)
  values (uid, n, s, escudo_, cor1_, cor2_, estilo_, ((tc_cfg('creditos_iniciais'))::text)::bigint, 'acesso')
  returning id into oid;
  insert into tc_fin (org_id, delta, saldo, motivo) values (oid, ((tc_cfg('creditos_iniciais'))::text)::bigint, ((tc_cfg('creditos_iniciais'))::text)::bigint, 'inicial');
  perform tc_elenco_inicial(oid);
  return jsonb_build_object('id', oid);
exception when unique_violation then
  raise exception 'nome_ou_sigla_em_uso';
end;
$$;
revoke all on function public.tc_criar_org(text, text, text, text, text, text) from public, anon;
grant execute on function public.tc_criar_org(text, text, text, text, text, text) to authenticated;


-- Equipes do sistema: pelo menos 14 ativas por divisão (7 por liga, com variação entre as ligas).
create or replace function public.tc_garantir_sistema()
returns void language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  select count(*) into n from tc_orgs where user_id is null and ativa and divisao = 'principal';
  if n < 14 then perform tc_criar_equipes_sistema('principal', 14 - n, 64); end if;
  select count(*) into n from tc_orgs where user_id is null and ativa and divisao = 'acesso';
  if n < 14 then perform tc_criar_equipes_sistema('acesso', 14 - n, 48); end if;
end;
$$;
revoke all on function public.tc_garantir_sistema() from public, anon, authenticated;

drop function if exists public.tc_criar_liga_divisao(int, int, text, date);

-- Liga individual do técnico na semana: ele + 7 equipes do sistema da mesma divisão; 10 rodadas MD1 (2 por dia, segunda a sexta).
create or replace function public.tc_criar_liga_privada(temp int, sem int, dono bigint, inicio_semana date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  o tc_orgs;
  lid bigint;
  times bigint[];
  n int;
  rod int;
  i int;
  a bigint;
  b bigint;
  rot bigint[];
begin
  select * into o from tc_orgs where id = dono;
  if o.id is null or o.user_id is null then return null; end if;
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and divisao = o.divisao and dono_org = dono;
  if lid is not null then return lid; end if;
  select array[dono] || coalesce(array_agg(x.id), '{}') into times from (
    select id from tc_orgs where user_id is null and ativa and divisao = o.divisao
     order by md5(id::text || ':' || dono::text || ':' || temp::text || ':' || sem::text) limit 7) x;
  n := coalesce(array_length(times, 1), 0);
  if n <> 8 then raise exception 'times_insuficientes'; end if;
  insert into tc_ligas (temporada, semana, divisao, tipo, nome, dono_org)
  values (temp, sem, o.divisao, 'divisao', (tc_cfg('nomes'))->>o.divisao || ' · S' || temp::text || ' semana ' || sem::text, dono) returning id into lid;
  for i in 1..n loop
    insert into tc_liga_times (liga_id, org_id, semente) values (lid, times[i], i);
  end loop;
  rot := times;
  for rod in 1..10 loop -- rodadas 1 a 7 únicas; 8 a 10 repetem 1 a 3
    for i in 1..(n / 2) loop
      a := rot[i];
      b := rot[n + 1 - i];
      insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato)
      values (lid, 'rodada', rod, inicio_semana + ((rod - 1) / 2), least(a, b), greatest(a, b), 1);
    end loop;
    rot := array[rot[1]] || rot[n] || rot[2:n - 1];
    if rod = n - 1 then rot := times; end if;
  end loop;
  return lid;
end;
$$;
revoke all on function public.tc_criar_liga_privada(int, int, bigint, date) from public, anon, authenticated;

create or replace function public.tc_criar_ligas_semana(temp int, sem int, ini date)
returns void language plpgsql security definer set search_path = public as $$
declare
  o record;
begin
  for o in select id from tc_orgs where user_id is not null and ativa order by id loop
    perform tc_criar_liga_privada(temp, sem, o.id, ini);
  end loop;
end;
$$;
revoke all on function public.tc_criar_ligas_semana(int, int, date) from public, anon, authenticated;

-- Playoffs de cada liga individual: semifinais MD3 no sábado, final MD5 no domingo.
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
  if not exists (select 1 from tc_partidas where liga_id = lid and fase = 'rodada' and rodada >= 8) then return false; end if;
  select min(dia) into d0 from tc_partidas where liga_id = lid and fase = 'rodada';
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
revoke all on function public.tc_avancar_divisao(bigint) from public, anon, authenticated;

create or replace function public.tc_avancar_semana(temp int, sem int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  l record;
  alg boolean := false;
begin
  for l in select id from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' order by id loop
    if tc_avancar_divisao(l.id) then alg := true; end if;
  end loop;
  return alg;
end;
$$;
revoke all on function public.tc_avancar_semana(int, int) from public, anon, authenticated;

create or replace function public.tc_encerrar_semana(temp int, sem int)
returns void language plpgsql security definer set search_path = public as $$
declare
  l record;
begin
  for l in select id from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and status = 'aberta' order by id loop
    perform tc_encerrar_liga(l.id);
  end loop;
end;
$$;
revoke all on function public.tc_encerrar_semana(int, int) from public, anon, authenticated;

-- Promoção e rebaixamento só do técnico dono da liga: os 2 primeiros da Academy sobem; os 2 últimos da Nacional descem.
create or replace function public.tc_aplicar_promocoes(temp int, sem int)
returns void language plpgsql security definer set search_path = public as $$
declare
  l record;
  pos_ int;
  n int;
begin
  for l in select id, divisao, dono_org from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and dono_org is not null loop
    select f.pos into pos_ from tc_tabela_final(l.id) f where f.org_id = l.dono_org;
    select count(*) into n from tc_liga_times where liga_id = l.id;
    if l.divisao = 'acesso' and pos_ <= 2 then
      update tc_orgs set divisao = 'principal' where id = l.dono_org;
      perform tc_fama_evento(l.dono_org, 'promo:' || temp::text || ':' || sem::text, 'promocao', ((tc_mkt_cfg())->'fama_eventos'->'promocao'->>'pontos')::numeric);
      perform tc_avisar(l.dono_org, 'Promovido para a ' || ((tc_cfg('nomes'))->>'principal') || '!');
    elsif l.divisao = 'principal' and pos_ > n - 2 then
      update tc_orgs set divisao = 'acesso' where id = l.dono_org;
      perform tc_avisar(l.dono_org, 'Rebaixado para a ' || ((tc_cfg('nomes'))->>'acesso') || '.');
    end if;
  end loop;
end;
$$;
revoke all on function public.tc_aplicar_promocoes(int, int) from public, anon, authenticated;

-- Copa Internacional: técnicos que ficaram entre os 2 primeiros da Liga Nacional na semana 1 (até 4); completa com equipes do sistema.
create or replace function public.tc_criar_copa(temp int, sem int, ini date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  lid bigint;
  t bigint[];
  reais int;
  i int;
begin
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'copa';
  if lid is not null then return lid; end if;
  select coalesce(array_agg(x.org_id order by x.pos, x.pontos desc, x.org_id), '{}') into t from (
    select * from (
      select l.dono_org as org_id, f.pos, tb.pontos
        from tc_ligas l, lateral tc_tabela_final(l.id) f, lateral tc_tabela(l.id) tb
       where l.temporada = temp and l.semana = 1 and l.tipo = 'divisao' and l.divisao = 'principal' and l.status = 'encerrada'
         and l.dono_org is not null and f.org_id = l.dono_org and tb.org_id = l.dono_org and f.pos <= 2) q limit 4) x;
  reais := coalesce(array_length(t, 1), 0);
  if reais = 0 then return null; end if;
  select t || coalesce(array_agg(s.id), '{}') into t from (
    select id from tc_orgs where user_id is null and ativa and divisao = 'principal' and id <> all (t)
     order by poder_sistema desc, id limit 4 - reais) s;
  if coalesce(array_length(t, 1), 0) < 4 then return null; end if;
  insert into tc_ligas (temporada, semana, divisao, tipo, nome)
  values (temp, sem, 'principal', 'copa', (tc_cfg('nomes'))->>'copa' || ' · S' || temp::text) returning id into lid;
  for i in 1..4 loop
    insert into tc_liga_times (liga_id, org_id, semente) values (lid, t[i], i);
  end loop;
  perform tc_partida_mm(lid, 'semi', 1, ini + 2, t[1], t[4]);
  perform tc_partida_mm(lid, 'semi', 1, ini + 2, t[2], t[3]);
  return lid;
end;
$$;
revoke all on function public.tc_criar_copa(int, int, date) from public, anon, authenticated;

-- Campeonato Mundial: técnicos que foram finalistas (2 primeiros) da Liga Nacional nas semanas 1 a 3 (até 6) e o campeão da Copa se for técnico.
create or replace function public.tc_criar_mundial(temp int, sem int, ini date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  lid bigint;
  top bigint[];
  campeao bigint;
  lc bigint;
  reais int;
  i int;
begin
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'mundial';
  if lid is not null then return lid; end if;
  select coalesce(array_agg(x.org_id order by x.titulos desc, x.melhor, x.pontos desc, x.org_id), '{}') into top from (
    select * from (
      select l.dono_org as org_id, count(*) as finais, count(*) filter (where f.pos = 1) as titulos, min(f.pos) as melhor, sum(tb.pontos) as pontos
        from tc_ligas l, lateral tc_tabela_final(l.id) f, lateral tc_tabela(l.id) tb
       where l.temporada = temp and l.semana between 1 and 3 and l.tipo = 'divisao' and l.divisao = 'principal' and l.status = 'encerrada'
         and l.dono_org is not null and f.org_id = l.dono_org and tb.org_id = l.dono_org and f.pos <= 2
       group by l.dono_org) q order by titulos desc, melhor, pontos desc, org_id limit 6) x;
  select id into lc from tc_ligas where temporada = temp and tipo = 'copa' and status = 'encerrada';
  if lc is not null then
    select vencedor into campeao from tc_partidas where liga_id = lc and fase = 'final' and status = 'concluida';
    if campeao is not null and exists (select 1 from tc_orgs where id = campeao and user_id is not null) and not (campeao = any (top)) then
      top := case when coalesce(array_length(top, 1), 0) >= 6 then top[1:5] || campeao else top || campeao end;
    end if;
  end if;
  reais := coalesce(array_length(top, 1), 0);
  if reais = 0 then return null; end if;
  select top || coalesce(array_agg(s.id), '{}') into top from (
    select id from tc_orgs where user_id is null and ativa and divisao = 'principal' and id <> all (top)
     order by poder_sistema desc, id limit 6 - reais) s;
  if coalesce(array_length(top, 1), 0) < 6 then return null; end if;
  insert into tc_ligas (temporada, semana, divisao, tipo, nome)
  values (temp, sem, 'principal', 'mundial', (tc_cfg('nomes'))->>'mundial' || ' · S' || temp::text) returning id into lid;
  for i in 1..6 loop
    insert into tc_liga_times (liga_id, org_id, semente) values (lid, top[i], i);
  end loop;
  perform tc_partida_mm(lid, 'quartas', 1, ini + 1, top[3], top[6]);
  perform tc_partida_mm(lid, 'quartas', 1, ini + 1, top[4], top[5]);
  return lid;
end;
$$;
revoke all on function public.tc_criar_mundial(int, int, date) from public, anon, authenticated;

-- Processamento da partida: o técnico joga no navegador; passada a meia-noite do dia da partida sem jogar, é derrota (W.O.).
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
begin
  select * into p from tc_partidas where id = pid for update;
  if p.id is null or p.status <> 'agendada' then
    return false;
  end if;
  nec := (p.formato + 1) / 2;
  if coalesce((tc_cfg('gameplay')->>'ativo')::boolean, false)
     and exists (select 1 from tc_orgs where id in (p.org_a, p.org_b) and user_id is not null) then
    -- ainda dentro do prazo (até a meia-noite do dia da partida): espera o técnico jogar
    if site_hoje_br() < p.dia + coalesce((tc_cfg('gameplay')->>'prazo_dias')::int, 1) then
      return false;
    end if;
    -- prazo vencido: quem é técnico e já tinha a organização no dia da partida perde por W.O.
    select coalesce(array_agg(id), '{}') into ausentes from tc_orgs
     where id in (p.org_a, p.org_b) and user_id is not null and criado::date <= p.dia;
    if coalesce(array_length(ausentes, 1), 0) = 1 then
      perd := ausentes[1];
      venc := case when perd = p.org_a then p.org_b else p.org_a end;
      update tc_partidas set status = 'concluida', placar_a = case when venc = p.org_a then nec else 0 end, placar_b = case when venc = p.org_b then nec else 0 end,
             vencedor = venc, poder_a = round(tc_poder_org(p.org_a)::numeric, 1), poder_b = round(tc_poder_org(p.org_b)::numeric, 1),
             resumo = jsonb_build_object('origem', 'wo', 'ausente', perd), processada = now()
       where id = p.id;
      perform tc_fama_vitoria(venc, p.id);
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
  update tc_jogadores set forma = least(75, forma + 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_partida')::int, 10)) where org_id = venc and slot is not null;
  update tc_jogadores set forma = greatest(25, forma - 4), exp = least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_derrota')::int, 5)) where org_id = perd and slot is not null;
  perform tc_fama_vitoria(venc, p.id);
  return true;
end;
$$;
revoke all on function public.tc_processar_partida(bigint) from public, anon, authenticated;

-- Aba Campeonatos: só as ligas em que a equipe do técnico participa (a liga individual e os internacionais).
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
    'ligas', coalesce((select jsonb_agg(tc_liga_json(l.id) order by l.temporada desc, l.semana desc, l.tipo, l.divisao)
                         from (select l2.* from tc_ligas l2 where l2.id in (select liga_id from tc_liga_times where org_id = oid)
                                order by l2.temporada desc, l2.semana desc, l2.id desc limit 8) l), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_campeonatos() from public, anon;
grant execute on function public.tc_campeonatos() to authenticated;

-- Painel: a liga individual mais recente do técnico.
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
    perform tc_criar_ligas_semana(temp, sem, ini);
    lc := case when sem = 2 then tc_criar_copa(temp, sem, ini) else null end;
    lm := case when sem = 4 then tc_criar_mundial(temp, sem, ini) else null end;
    -- Processa o que já pode ser jogado e avança as chaves (até 4 passes: quartas, semifinais, final).
    for passo in 1..4 loop
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
  for t in select * from tc_tabela_final(lid) where exists (select 1 from tc_orgs o where o.id = org_id and o.user_id is not null) loop -- só equipes de técnicos recebem premiação, Rank e troféu
    cred := coalesce(prem[t.pos], 0);
    if cred > 0 then
      perform tc_creditos_mexer(t.org_id, cred, 'premiacao', lid::text);
    end if;
    pdr := tc_rank_liga(t.org_id, lid, t.pos, t.vitorias, d);
    perform tc_fama_evento(t.org_id, 'liga:' || lid::text, 'liga', coalesce(((tc_mkt_cfg())->'fama_eventos'->'liga'->l.divisao->>(t.pos - 1))::numeric, 0));
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

create or replace function public.tc_liga_json(lid bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l tc_ligas;
  tab jsonb;
  n int;
begin
  select * into l from tc_ligas where id = lid;
  if l.id is null then return null; end if;
  n := (select count(*) from tc_liga_times where liga_id = lid);
  if l.tipo = 'divisao' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'pos', t.pos, 'org', tc_org_json(t.org_id), 'partidas', t.partidas, 'vitorias', t.vitorias, 'derrotas', t.derrotas,
             'mapas_pro', t.mapas_pro, 'mapas_contra', t.mapas_contra, 'saldo', t.mapas_pro - t.mapas_contra, 'pontos', t.pontos,
             'poder', round(tc_poder_org(t.org_id)::numeric, 1),
             'pos_final', f.pos,
             'situacao', case when l.divisao = 'acesso' and f.pos <= 2 then 'promocao'
                              when l.divisao = 'principal' and f.pos > n - 2 then 'rebaixamento'
                              when l.divisao = 'principal' and f.pos <= 2 then 'copa'
                              else 'permanece' end) order by t.pos), '[]'::jsonb) into tab
      from tc_tabela(lid) t join tc_tabela_final(lid) f on f.org_id = t.org_id;
  else
    select coalesce(jsonb_agg(jsonb_build_object('pos', t.semente, 'org', tc_org_json(t.org_id), 'partidas', 0, 'vitorias', 0, 'derrotas', 0,
                                                 'mapas_pro', 0, 'mapas_contra', 0, 'saldo', 0, 'pontos', 0,
                                                 'poder', round(tc_poder_org(t.org_id)::numeric, 1), 'situacao', null) order by t.semente), '[]'::jsonb) into tab
      from tc_liga_times t where t.liga_id = lid;
  end if;
  return jsonb_build_object('id', l.id, 'nome', l.nome, 'divisao', l.divisao, 'tipo', l.tipo, 'status', l.status,
                            'temporada', l.temporada, 'semana', l.semana, 'dono', l.dono_org, 'tabela', tab,
                            'partidas', coalesce((select jsonb_agg(tc_partida_json(p) order by p.dia, p.id) from tc_partidas p where p.liga_id = l.id), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_liga_json(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------- ligas já criadas
-- As ligas abertas da semana atual (globais, do formato anterior) são apagadas: o servidor recria, para cada técnico, a liga individual.
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
  if exists (select 1 from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and status = 'aberta' and dono_org is null) then
    delete from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and status = 'aberta' and dono_org is null;
    update tc_config set valor = to_jsonb(gw) where chave = 'semana_proc';
    raise notice 'Ligas globais da semana % da temporada % apagadas: cada técnico recebe a sua liga individual no próximo acesso ao jogo.', sem, temp;
  end if;
end;
$$;
