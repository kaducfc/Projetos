-- =====================================================================
-- Simulador de Técnico, parte 5: Copa dos Convergentes (semana 2) e Campeonato Mundial das Lendas (semana 4).
--
--   * Copa: os 4 primeiros da divisão principal na semana 1 (mata-mata: semifinais e final, melhor de 5).
--   * Mundial: os 6 melhores da divisão principal por pontos acumulados nas semanas 1 a 3, mais o campeão da Copa
--     (que toma a última vaga se ainda não estiver entre os 6). Quartas (3x6 e 4x5), semifinais (1 x vencedor de 4x5,
--     2 x vencedor de 3x6) e final, tudo em melhor de 5.
--   * Só quem joga a divisão principal se classifica: o acesso nunca dá vaga internacional direta.
--
-- Rodar depois do 0088. Rodar de novo é seguro. Substitui tc_sincronizar e tc_liga_json.
-- =====================================================================

insert into public.tc_config (chave, valor) values
  ('premios_intl', '{"copa": {"1": 300000, "2": 150000, "3": 60000}, "mundial": {"1": 1000000, "2": 500000, "3": 250000, "5": 120000}}'::jsonb),
  -- PDR base (antes do ajuste do elo) por colocação: 1º, 2º, 3º (semifinalista) e 5º (quartas).
  ('rank_intl', '{"copa": {"1": 30, "2": 22, "3": 14}, "mundial": {"1": 38, "2": 32, "3": 24, "5": 14}}'::jsonb)
on conflict (chave) do nothing;

-- Cria uma partida de mata-mata (melhor de 5) sem repetir.
create or replace function public.tc_partida_mm(lid bigint, fase_ text, rod int, d date, a bigint, b bigint)
returns void language sql security definer set search_path = public as $$
  insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato)
  values (lid, fase_, rod, d, least(a, b), greatest(a, b), 5)
  on conflict do nothing;
$$;
revoke all on function public.tc_partida_mm(bigint, text, int, date, bigint, bigint) from public, anon, authenticated;

-- Vencedor de uma partida concluída entre as equipes x e y de uma liga (null se ainda não houve).
create or replace function public.tc_vencedor_entre(lid bigint, fase_ text, x bigint, y bigint)
returns bigint language sql stable security definer set search_path = public as $$
  select vencedor from tc_partidas where liga_id = lid and fase = fase_ and status = 'concluida'
     and org_a = least(x, y) and org_b = greatest(x, y);
$$;
revoke all on function public.tc_vencedor_entre(bigint, text, bigint, bigint) from public, anon, authenticated;

create or replace function public.tc_criar_copa(temp int, sem int, ini date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  lid bigint;
  l1 bigint;
  t bigint[];
begin
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'copa';
  if lid is not null then return lid; end if;
  select id into l1 from tc_ligas where temporada = temp and semana = 1 and tipo = 'divisao' and divisao = 'principal' and status = 'encerrada';
  if l1 is null then return null; end if;
  select array_agg(org_id order by pos) into t from tc_tabela(l1) where pos <= 4;
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

create or replace function public.tc_criar_mundial(temp int, sem int, ini date)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  lid bigint;
  top bigint[];
  campeao bigint;
  lc bigint;
begin
  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'mundial';
  if lid is not null then return lid; end if;
  select array_agg(org_id order by pontos desc, saldo desc, mp desc, org_id) into top from (
    select t.org_id, sum(t.pontos) as pontos, sum(t.mapas_pro - t.mapas_contra) as saldo, sum(t.mapas_pro) as mp
      from tc_ligas l, lateral tc_tabela(l.id) t
     where l.temporada = temp and l.semana between 1 and 3 and l.tipo = 'divisao' and l.divisao = 'principal' and l.status = 'encerrada'
     group by t.org_id order by 2 desc, 3 desc, 4 desc, 1 limit 6) x;
  if coalesce(array_length(top, 1), 0) < 6 then return null; end if;
  select id into lc from tc_ligas where temporada = temp and tipo = 'copa' and status = 'encerrada';
  if lc is not null then
    select vencedor into campeao from tc_partidas where liga_id = lc and fase = 'final' and status = 'concluida';
    if campeao is not null and not (campeao = any (top)) then top[6] := campeao; end if;
  end if;
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

-- Cria a fase seguinte do mata-mata quando a anterior terminou. Devolve true se algo foi criado.
create or replace function public.tc_avancar(lid bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  l tc_ligas;
  s bigint[];
  d date;
  w1 bigint;
  w2 bigint;
  f1 bigint;
  f2 bigint;
  pend int;
begin
  select * into l from tc_ligas where id = lid;
  if l.id is null or l.status = 'encerrada' then return false; end if;
  if l.tipo = 'copa' then
    select count(*) into pend from tc_partidas where liga_id = lid and fase = 'semi' and status = 'agendada';
    if pend = 0 and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'final') then
      select min(dia) + 2 into d from tc_partidas where liga_id = lid and fase = 'semi';
      select vencedor into w1 from tc_partidas where liga_id = lid and fase = 'semi' order by id limit 1;
      select vencedor into w2 from tc_partidas where liga_id = lid and fase = 'semi' order by id desc limit 1;
      perform tc_partida_mm(lid, 'final', 2, d, w1, w2);
      return true;
    end if;
  elsif l.tipo = 'mundial' then
    select array_agg(org_id order by semente) into s from tc_liga_times where liga_id = lid;
    select count(*) into pend from tc_partidas where liga_id = lid and fase = 'quartas' and status = 'agendada';
    if pend = 0 and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'semi') then
      select min(dia) + 2 into d from tc_partidas where liga_id = lid and fase = 'quartas';
      w1 := tc_vencedor_entre(lid, 'quartas', s[4], s[5]);
      w2 := tc_vencedor_entre(lid, 'quartas', s[3], s[6]);
      perform tc_partida_mm(lid, 'semi', 2, d, s[1], w1);
      perform tc_partida_mm(lid, 'semi', 2, d, s[2], w2);
      return true;
    end if;
    select count(*) into pend from tc_partidas where liga_id = lid and fase = 'semi' and status = 'agendada';
    if pend = 0 and exists (select 1 from tc_partidas where liga_id = lid and fase = 'semi') and not exists (select 1 from tc_partidas where liga_id = lid and fase = 'final') then
      select min(dia) + 2 into d from tc_partidas where liga_id = lid and fase = 'semi';
      select vencedor into f1 from tc_partidas where liga_id = lid and fase = 'semi' order by id limit 1;
      select vencedor into f2 from tc_partidas where liga_id = lid and fase = 'semi' order by id desc limit 1;
      perform tc_partida_mm(lid, 'final', 3, d, f1, f2);
      return true;
    end if;
  end if;
  return false;
end;
$$;
revoke all on function public.tc_avancar(bigint) from public, anon, authenticated;

create or replace function public.tc_internacional_completo(lid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select lid is null or exists (select 1 from tc_partidas where liga_id = lid and fase = 'final' and status = 'concluida');
$$;
revoke all on function public.tc_internacional_completo(bigint) from public, anon, authenticated;

-- Premiação e Rank da Copa e do Mundial (uma vez por liga; só equipes de técnicos recebem Rank).
create or replace function public.tc_encerrar_internacional(lid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  l tc_ligas;
  fin tc_partidas;
  r record;
  chave text;
  pos_ int;
  cred bigint;
  base int;
  uid uuid;
  pdr int;
  d date := site_hoje_br();
begin
  select * into l from tc_ligas where id = lid for update;
  if l.id is null or l.status = 'encerrada' then return; end if;
  select * into fin from tc_partidas where liga_id = lid and fase = 'final' and status = 'concluida';
  if fin.id is null then return; end if;
  for r in select t.org_id,
                  case when t.org_id = fin.vencedor then 1
                       when t.org_id in (fin.org_a, fin.org_b) then 2
                       when exists (select 1 from tc_partidas p where p.liga_id = lid and p.fase = 'semi' and (p.org_a = t.org_id or p.org_b = t.org_id)) then 3
                       else 5 end as pos
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
    if r.pos = 1 then
      insert into tc_trofeus (org_id, liga_id, titulo, temporada) values (r.org_id, lid, 'Campeão · ' || l.nome, l.temporada) on conflict do nothing;
    end if;
    if cred > 0 then
      perform tc_avisar(r.org_id, l.nome || ': ' || r.pos::text || 'º lugar, ' || cred::text || ' créditos.');
    end if;
  end loop;
  update tc_ligas set status = 'encerrada', encerrada_em = now() where id = lid;
end;
$$;
revoke all on function public.tc_encerrar_internacional(bigint) from public, anon, authenticated;

-- Sincronização com Copa e Mundial (substitui a do 0087).
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
      exit when not (coalesce(tc_avancar(lc), false) or coalesce(tc_avancar(lm), false));
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

-- Liga em JSON: Copa e Mundial mostram os participantes por semente (em vez de tabela de pontos).
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
             'situacao', case when l.divisao = 'acesso' and t.pos <= 2 then 'promocao'
                              when l.divisao = 'principal' and t.pos > n - 2 then 'rebaixamento'
                              when l.divisao = 'principal' and t.pos <= 4 then 'copa'
                              else 'permanece' end) order by t.pos), '[]'::jsonb) into tab
      from tc_tabela(lid) t;
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
