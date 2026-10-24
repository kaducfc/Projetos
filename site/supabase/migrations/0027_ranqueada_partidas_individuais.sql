-- Ranqueada: cada partida de Carreira e Lendas vale o seu próprio PDR.
-- Rodar depois da 0026. Rodar de novo é seguro.
--
-- Antes: as 3 primeiras partidas do dia contavam só pela melhor (as outras
-- só somavam a diferença quando eram melhores). Agora as 3 vagas do dia
-- continuam (3 por jogo), mas cada uma que termina dá ou tira PDR na hora,
-- do jeito dela. Vaga começada e não terminada até a meia-noite perde 15
-- PDR (uma por vaga; antes era uma vez só no dia, e só se nenhuma terminasse),
-- senão dava para abandonar as partidas ruins sem pagar nada.

-- 1. site_rk_dia passa a ter uma linha por partida (n = número da vaga, 1 a 3).
alter table public.site_rk_dia add column if not exists n int not null default 1;
do $$
begin
  if not exists (
    select 1 from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
     where i.indrelid = 'public.site_rk_dia'::regclass and i.indisprimary and a.attname = 'n'
  ) then
    alter table public.site_rk_dia drop constraint site_rk_dia_pkey;
    alter table public.site_rk_dia add primary key (user_id, dia, jogo, n);
  end if;
end $$;

-- 2. Runetermo, Campeão Oculto e Na Medida (1 por dia, n = 1): só ajustam o
--    "on conflict" para a chave nova (o resto das funções fica como está).
do $$
declare
  def text;
  f text;
begin
  foreach f in array array['public.site_diario_fechar(uuid,date,text,text)', 'public.site_escala_fechar(uuid,date)'] loop
    if to_regprocedure(f) is null then continue; end if;
    def := pg_get_functiondef(to_regprocedure(f));
    if position('on conflict (user_id, dia, jogo) do nothing' in def) > 0 then
      execute replace(def, 'on conflict (user_id, dia, jogo) do nothing', 'on conflict (user_id, dia, jogo, n) do nothing');
    end if;
  end loop;
end $$;

-- 3. Fim de partida (Carreira e Lendas): cada vaga usada vira uma linha e um lançamento.
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
  niv int;
  valor int;
  num int;
  gravou int;
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
  -- Número da vaga: a ordem em que foram começadas no dia.
  select count(*) into num from site_ranked_inicios x
   where x.user_id = new.user_id and x.dia = hoje and x.jogo = new.game_id
     and x.criado <= (select criado from site_ranked_inicios where id = usado);
  if new.game_id = 'carreira-no-rift' then
    -- Mantém a tabela de partidas (painel de vigilância da Carreira).
    insert into site_ranked_partidas (user_id, dia, score, result_id) values (new.user_id, hoje, round(new.score), new.id);
  end if;
  niv := site_rk_nivel_de(new.user_id);
  valor := site_rk_ajustar(b, niv);
  insert into site_rk_dia (user_id, dia, jogo, n, base, nivel, pdr, score, result_id)
  values (new.user_id, hoje, new.game_id, num, b, niv, valor, new.score, new.id)
  on conflict (user_id, dia, jogo, n) do nothing
  returning 1 into gravou;
  if gravou is null then
    return new;
  end if;
  perform site_rk_lancar(new.user_id, hoje, new.game_id, 'partida', valor);
  return new;
end;
$$;
revoke all on function public.site_ranked_registrar() from public, anon, authenticated;
drop trigger if exists site_ranked_on_result on public.site_game_results;
create trigger site_ranked_on_result
  after insert on public.site_game_results
  for each row execute function public.site_ranked_registrar();

-- 4. Atualização diária: cada vaga começada e não terminada perde 15 PDR.
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
    -- Carreira e Lendas: vaga pega e não terminada no dia (uma perda por vaga).
    for r in
      select q.user_id, q.jogo, q.n from (
        select i.user_id, i.jogo, i.usado_em, i.dia,
               row_number() over (partition by i.user_id, i.jogo order by i.criado)::int as n
          from site_ranked_inicios i where i.dia = d
      ) q
       where q.usado_em is null and q.dia >= cfg.inicio
         and not exists (select 1 from site_ranked_banidos b where b.user_id = q.user_id)
       order by q.user_id, q.jogo, q.n
    loop
      insert into site_rk_dia (user_id, dia, jogo, n, base, nivel, pdr)
      values (r.user_id, d, r.jogo, r.n, -15, site_rk_nivel_de(r.user_id), -15)
      on conflict (user_id, dia, jogo, n) do nothing;
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

-- 5. "Minha ranqueada": por jogo, a soma do dia + a lista de partidas de hoje.
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
      -- Por jogo: PDR somado das partidas de hoje (base = a maior delas).
      'jogos', coalesce((select jsonb_object_agg(jogo, jsonb_build_object('pdr', pdr, 'base', base, 'partidas', n))
                           from (select jogo, sum(pdr)::int as pdr, max(base) as base, count(*)::int as n
                                   from site_rk_dia where user_id = uid and dia = hoje group by jogo) x), '{}'::jsonb),
      -- Cada partida de hoje, com o PDR dela.
      'partidas', coalesce((select jsonb_agg(jsonb_build_object('jogo', d.jogo, 'n', d.n, 'pdr', d.pdr, 'base', d.base,
                                                               'client_id', r.client_id) order by d.criado)
                              from site_rk_dia d left join site_game_results r on r.id = d.result_id
                             where d.user_id = uid and d.dia = hoje), '[]'::jsonb),
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

-- 6. Painel: anular uma partida da Carreira tira só o PDR dela (a linha certa).
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
    update site_rk_dia set base = -25, pdr = 0, result_id = null
     where user_id = d.user_id and dia = d.dia and jogo = d.jogo and n = d.n;
  end if;
  delete from site_ranked_partidas where id = partida;
  return jsonb_build_object('anuladas', 1, 'pdr_tirados', coalesce(d.pdr, 0));
end;
$$;
revoke all on function public.site_admin_ranked_anular(bigint) from public, anon;
grant execute on function public.site_admin_ranked_anular(bigint) to authenticated;
