-- Liga Academy (Série B) e Liga Nacional (Série A): nova semana de campeonato.
--   * Todas as partidas são MD1 (melhor de 1 mapa).
--   * Segunda a sexta: 2 jogos por dia contra 2 adversários diferentes (10 jogos por equipe; as 8 equipes jogam todos contra todos
--     nas 7 primeiras rodadas e as rodadas 8, 9 e 10 repetem as rodadas 1, 2 e 3).
--   * Sábado: semifinais (1º x 4º e 2º x 3º da fase de pontos). Domingo: final entre os vencedores.
--   * Posição final: campeão, vice, os dois semifinalistas eliminados (pela ordem da fase de pontos) e depois o resto da tabela.
--     Premiação, Rank, troféu e promoção/rebaixamento usam essa posição final: os 2 primeiros da Academy sobem para a Nacional
--     e os 2 últimos da Nacional descem; quem não sobe fica na Academy.
--   * Segunda-feira começa a semana seguinte, com tudo de novo. O calendário passa a começar sempre numa segunda-feira.
-- Rode depois da 0119; é seguro rodar de novo.

alter table public.tc_partidas drop constraint if exists tc_partidas_formato_check;
alter table public.tc_partidas add constraint tc_partidas_formato_check check (formato in (1, 3, 5));

-- Posição final da liga (depois dos playoffs). Sem final concluída, vale a tabela de pontos.
create or replace function public.tc_tabela_final(liga bigint)
returns table (pos int, org_id bigint, partidas int, vitorias int, derrotas int, mapas_pro int, mapas_contra int, pontos int)
language sql stable security definer set search_path = public as $$
  with t as (select * from tc_tabela(liga)),
       f as (select p.vencedor as w, case when p.org_a = p.vencedor then p.org_b else p.org_a end as l
               from tc_partidas p where p.liga_id = liga and p.fase = 'final' and p.status = 'concluida' limit 1)
  select (row_number() over (order by
            case when t.org_id = (select w from f) then 1
                 when t.org_id = (select l from f) then 2
                 when exists (select 1 from tc_partidas s where s.liga_id = liga and s.fase = 'semi' and s.status = 'concluida'
                                 and t.org_id in (s.org_a, s.org_b) and s.vencedor <> t.org_id) and exists (select 1 from f) then 3
                 else 4 end, t.pos))::int as pos,
         t.org_id, t.partidas, t.vitorias, t.derrotas, t.mapas_pro, t.mapas_contra, t.pontos
    from t order by 1;
$$;
revoke all on function public.tc_tabela_final(bigint) from public, anon, authenticated;

-- Liga semanal: 8 equipes, 10 rodadas (2 por dia, de segunda a sexta), tudo MD1.
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
  rodadas int;
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
  rodadas := 10;
  -- método do círculo: a rodada r (1 a 7) é única; as rodadas 8 a 10 repetem as rodadas 1 a 3
  for rod in 1..rodadas loop
    for i in 1..(n / 2) loop
      a := rot[i];
      b := rot[n + 1 - i];
      insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato)
      values (lid, 'rodada', rod, inicio_semana + ((rod - 1) / 2), least(a, b), greatest(a, b), 1);
    end loop;
    rot := array[rot[1]] || rot[n] || rot[2:n - 1];
    if rod = n - 1 then rot := times; end if; -- recomeça o ciclo
  end loop;
  return lid;
end;
$$;
revoke all on function public.tc_criar_liga_divisao(int, int, text, date) from public, anon, authenticated;

-- Playoffs da divisão: semifinais no sábado e final no domingo (só para ligas no formato novo, com 10 rodadas).
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
      (lid, 'semi', 1, d0 + 5, least(t[1], t[4]), greatest(t[1], t[4]), 1),
      (lid, 'semi', 1, d0 + 5, least(t[2], t[3]), greatest(t[2], t[3]), 1) on conflict do nothing;
    return true;
  end if;
  select count(*) into pend from tc_partidas where liga_id = lid and fase = 'semi' and status = 'agendada';
  if pend = 0 and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'final') then
    select vencedor into w1 from tc_partidas where liga_id = lid and fase = 'semi' order by id limit 1;
    select vencedor into w2 from tc_partidas where liga_id = lid and fase = 'semi' order by id desc limit 1;
    if w1 is null or w2 is null then return false; end if;
    insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato)
    values (lid, 'final', 2, d0 + 6, least(w1, w2), greatest(w1, w2), 1) on conflict do nothing;
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.tc_avancar_divisao(bigint) from public, anon, authenticated;

-- Fechamento da semana, promoção/rebaixamento, premiação e consulta passam a usar a posição final (depois dos playoffs).
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
    la := tc_criar_liga_divisao(temp, sem, 'acesso', ini);
    lp := tc_criar_liga_divisao(temp, sem, 'principal', ini);
    lc := case when sem = 2 then tc_criar_copa(temp, sem, ini) else null end;
    lm := case when sem = 4 then tc_criar_mundial(temp, sem, ini) else null end;
    -- Processa o que já pode ser jogado e avança as chaves (até 4 passes: quartas, semifinais, final).
    for passo in 1..4 loop
      for p in select id from tc_partidas where liga_id in (select id from tc_ligas where temporada = temp and semana = sem)
                and status = 'agendada' and dia <= hoje order by dia, id loop
        if tc_processar_partida(p.id) then feitas := feitas + 1; end if;
      end loop;
      av1 := coalesce(tc_avancar(lc), false); av2 := coalesce(tc_avancar(lm), false);
      av3 := coalesce(tc_avancar_divisao(la), false); av4 := coalesce(tc_avancar_divisao(lp), false);
      exit when not (av1 or av2 or av3 or av4);
    end loop;
    select count(*) into pend from tc_partidas where liga_id in (select id from tc_ligas where temporada = temp and semana = sem) and status = 'agendada';
    exit when pend > 0 or not tc_internacional_completo(lc) or not tc_internacional_completo(lm);
    perform tc_encerrar_liga(la);
    perform tc_encerrar_liga(lp);
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
  for t in select * from tc_tabela_final(lid) loop
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
  select array_agg(org_id order by pos) into sobem from tc_tabela_final(la) where pos <= 2;
  select array_agg(org_id order by pos desc) into descem from (select * from tc_tabela_final(lp) order by pos desc limit 2) x;
  update tc_orgs set divisao = 'principal' where id = any (sobem);
  perform tc_fama_evento(o, 'promo:' || temp::text || ':' || sem::text, 'promocao', ((tc_mkt_cfg())->'fama_eventos'->'promocao'->>'pontos')::numeric) from unnest(sobem) o;
  update tc_orgs set divisao = 'acesso' where id = any (descem);
  perform tc_avisar(o, 'Promovido para a ' || ((tc_cfg('nomes'))->>'principal') || '!') from unnest(sobem) o where exists (select 1 from tc_orgs where id = o and user_id is not null);
  perform tc_avisar(o, 'Rebaixado para a ' || ((tc_cfg('nomes'))->>'acesso') || '.') from unnest(descem) o where exists (select 1 from tc_orgs where id = o and user_id is not null);
end;
$$;
revoke all on function public.tc_aplicar_promocoes(int, int) from public, anon, authenticated;

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
                              when l.divisao = 'principal' and t.pos <= 4 then 'copa'
                              else 'permanece' end) order by t.pos), '[]'::jsonb) into tab
      from tc_tabela(lid) t join tc_tabela_final(lid) f on f.org_id = t.org_id;
  else
    select coalesce(jsonb_agg(jsonb_build_object('pos', t.semente, 'org', tc_org_json(t.org_id), 'partidas', 0, 'vitorias', 0, 'derrotas', 0,
                                                 'mapas_pro', 0, 'mapas_contra', 0, 'saldo', 0, 'pontos', 0,
                                                 'poder', round(tc_poder_org(t.org_id)::numeric, 1), 'situacao', null) order by t.semente), '[]'::jsonb) into tab
      from tc_liga_times t where t.liga_id = lid;
  end if;
  return jsonb_build_object('id', l.id, 'nome', l.nome, 'divisao', l.divisao, 'tipo', l.tipo, 'status', l.status,
                            'temporada', l.temporada, 'semana', l.semana, 'tabela', tab,
                            'partidas', coalesce((select jsonb_agg(tc_partida_json(p) order by p.dia, p.id) from tc_partidas p where p.liga_id = l.id), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_liga_json(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------- calendário e ligas já criadas
-- O calendário começa sempre numa segunda-feira (a semana de campeonato vai de segunda a domingo).
-- Se ainda estamos na primeira semana e o início não é uma segunda, volta para a segunda desta semana.
-- As ligas abertas da semana atual que foram criadas no formato antigo (7 rodadas, melhor de 3) são refeitas no formato novo.
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
  if gw = 0 and extract(isodow from ini) <> 1 then
    ini := hoje - (extract(isodow from hoje)::int - 1);
    update tc_config set valor = jsonb_set(valor, '{inicio}', to_jsonb(ini::text)) where chave = 'calendario';
    gw := 0;
  end if;
  temp := gw / 4 + 1; sem := gw % 4 + 1;
  if exists (select 1 from tc_ligas l where l.temporada = temp and l.semana = sem and l.tipo = 'divisao' and l.status = 'aberta'
                and not exists (select 1 from tc_partidas p where p.liga_id = l.id and p.rodada >= 8)) then
    delete from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and status = 'aberta';
    update tc_config set valor = to_jsonb(gw) where chave = 'semana_proc';
    raise notice 'Ligas da semana % da temporada % refeitas no formato novo (MD1, 2 jogos por dia, semifinal e final).', sem, temp;
  end if;
end;
$$;
