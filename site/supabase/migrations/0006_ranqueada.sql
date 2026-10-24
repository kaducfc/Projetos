-- Ranqueada da Carreira no Rift.
--
-- Regras:
--   * Só contas logadas. Valem as 3 primeiras carreiras terminadas no dia
--     (horário de Brasília, pela hora do servidor); a nota do dia é a melhor
--     das 3. Depois disso dá para continuar jogando, mas não vale mais.
--   * A cada 3 dias (um ciclo) faz-se a média das notas dos 3 dias (dia sem
--     jogar conta 0). Quem atingir a média do próximo elo sobe 1 elo na
--     atualização da meia-noite seguinte. Ninguém cai, exceto do Desafiante.
--   * Elos: Bronze → Prata (500) → Ouro (650) → Platina (750) →
--     Diamante (850) → Desafiante (950 e estar entre os 100 melhores).
--   * Desafiante tem 100 vagas: a cada atualização, entre os Desafiantes e os
--     Diamantes que bateram 950, ficam os 100 com maior média; o resto fica
--     (ou cai para) Diamante.
--   * Rankings diário, semanal (seg–dom) e mensal: soma das notas do dia.
--
-- Não precisa de tarefa agendada: a função site_ranked_processar() fecha os
-- ciclos pendentes e é chamada pelo site sempre que alguém abre o ranking ou
-- o perfil (rodar de novo não faz nada).
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique
-- em Run (depois do 0005_perfil.sql). Rodar de novo é seguro.

-- ---------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------
create table if not exists public.site_ranked_config (
  id int primary key default 1 check (id = 1),
  inicio date not null,          -- primeiro dia do ciclo 0
  temporada int not null default 1
);
insert into public.site_ranked_config (id, inicio)
values (1, (now() at time zone 'America/Sao_Paulo')::date)
on conflict (id) do nothing;

create table if not exists public.site_ranked (
  user_id uuid primary key references auth.users(id) on delete cascade,
  elo text not null default 'bronze'
    check (elo in ('bronze', 'prata', 'ouro', 'platina', 'diamante', 'desafiante')),
  desde timestamptz not null default now(),   -- quando entrou no elo atual
  ultima_media numeric,
  ultimo_ciclo int
);

-- Partidas que valeram para a ranqueada (no máximo 3 por conta por dia).
create table if not exists public.site_ranked_partidas (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  score int not null,
  result_id uuid unique references public.site_game_results(id) on delete set null,
  criado timestamptz not null default now()
);
create index if not exists site_ranked_partidas_dia on public.site_ranked_partidas (dia);
create index if not exists site_ranked_partidas_user_dia on public.site_ranked_partidas (user_id, dia);

create table if not exists public.site_ranked_ciclos (
  ciclo int primary key,
  processado_em timestamptz not null default now(),
  participantes int not null default 0
);

create table if not exists public.site_ranked_historico (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ciclo int not null,
  de text not null,
  para text not null,
  media numeric not null,
  criado timestamptz not null default now()
);
create index if not exists site_ranked_historico_user on public.site_ranked_historico (user_id, ciclo desc);

-- Acesso só pelas funções abaixo; cada conta lê o próprio elo direto.
alter table public.site_ranked_config enable row level security;
alter table public.site_ranked enable row level security;
alter table public.site_ranked_partidas enable row level security;
alter table public.site_ranked_ciclos enable row level security;
alter table public.site_ranked_historico enable row level security;
grant select on public.site_ranked to authenticated;
drop policy if exists "site_ranked dono le" on public.site_ranked;
create policy "site_ranked dono le" on public.site_ranked for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Limiares (média do ciclo para subir PARA o elo) e vagas do Desafiante.
-- ---------------------------------------------------------------
create or replace function public.site_ranked_limiar(elo text)
returns int
language sql
immutable
as $$
  select case elo
    when 'prata' then 500 when 'ouro' then 650 when 'platina' then 750
    when 'diamante' then 850 when 'desafiante' then 950 else 0 end;
$$;

create or replace function public.site_ranked_proximo(elo text)
returns text
language sql
immutable
as $$
  select case elo
    when 'bronze' then 'prata' when 'prata' then 'ouro' when 'ouro' then 'platina'
    when 'platina' then 'diamante' when 'diamante' then 'desafiante' else null end;
$$;

create or replace function public.site_hoje_br()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Sao_Paulo')::date; $$;

-- ---------------------------------------------------------------
-- Toda carreira terminada passa por aqui: se for uma das 3 primeiras do
-- dia, vale para a ranqueada.
-- ---------------------------------------------------------------
create or replace function public.site_ranked_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hoje date := site_hoje_br();
begin
  if new.game_id <> 'carreira-no-rift' or new.score is null or new.score < 0 or new.score > 3000 then
    return new;
  end if;
  -- Partida de outro dia (ex.: enviada depois, sem internet): não vale.
  if (new.played_at at time zone 'America/Sao_Paulo')::date <> hoje then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || new.user_id::text));
  if (select count(*) from site_ranked_partidas where user_id = new.user_id and dia = hoje) >= 3 then
    return new;
  end if;
  insert into site_ranked_partidas (user_id, dia, score, result_id)
  values (new.user_id, hoje, round(new.score), new.id);
  insert into site_ranked (user_id) values (new.user_id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists site_ranked_on_result on public.site_game_results;
create trigger site_ranked_on_result
  after insert on public.site_game_results
  for each row execute function public.site_ranked_registrar();

-- ---------------------------------------------------------------
-- Fecha os ciclos de 3 dias que já terminaram (sobe elos e reorganiza o
-- Desafiante). Retorna quantos ciclos foram fechados agora.
-- ---------------------------------------------------------------
create or replace function public.site_ranked_processar()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg_inicio date;
  hoje date := site_hoje_br();
  n int;
  ini date;
  feitos int := 0;
  vagas constant int := 100;
begin
  select inicio into cfg_inicio from site_ranked_config where id = 1;
  if cfg_inicio is null then
    return 0;
  end if;
  -- Só um processamento por vez (os outros saem sem esperar).
  if not pg_try_advisory_xact_lock(hashtext('ranked:processar')) then
    return 0;
  end if;
  n := coalesce((select max(ciclo) from site_ranked_ciclos), -1) + 1;
  while cfg_inicio + 3 * n + 3 <= hoje loop
    ini := cfg_inicio + 3 * n;

    create temp table if not exists _rk (user_id uuid primary key, elo text, media numeric) on commit drop;
    truncate _rk;
    insert into _rk (user_id, elo, media)
    select r.user_id, r.elo, coalesce(sum(d.melhor), 0) / 3.0
      from site_ranked r
      left join (
        select user_id, dia, max(score) as melhor
          from site_ranked_partidas
         where dia between ini and ini + 2
         group by user_id, dia
      ) d on d.user_id = r.user_id
     group by r.user_id, r.elo;

    -- Bronze → Diamante: sobe 1 elo quem bateu a média do próximo.
    with sobe as (
      select user_id, elo as de, site_ranked_proximo(elo) as para, media
        from _rk
       where elo in ('bronze', 'prata', 'ouro', 'platina')
         and media >= site_ranked_limiar(site_ranked_proximo(elo))
    ), up as (
      update site_ranked r set elo = s.para, desde = now()
        from sobe s where r.user_id = s.user_id
      returning r.user_id
    )
    insert into site_ranked_historico (user_id, ciclo, de, para, media)
    select user_id, n, de, para, media from sobe;

    -- Desafiante: 100 vagas entre os atuais e os Diamantes que bateram 950.
    with candidatos as (
      select user_id, elo, media,
             row_number() over (order by media desc, user_id) as pos
        from _rk
       where elo = 'desafiante'
          or (elo = 'diamante' and media >= site_ranked_limiar('desafiante'))
    ), muda as (
      select user_id, elo as de, case when pos <= vagas then 'desafiante' else 'diamante' end as para, media
        from candidatos
    ), up as (
      update site_ranked r set elo = m.para, desde = now()
        from muda m where r.user_id = m.user_id and m.de <> m.para
      returning r.user_id
    )
    insert into site_ranked_historico (user_id, ciclo, de, para, media)
    select user_id, n, de, para, media from muda where de <> para;

    update site_ranked r set ultima_media = k.media, ultimo_ciclo = n
      from _rk k where r.user_id = k.user_id;

    insert into site_ranked_ciclos (ciclo, participantes)
    values (n, (select count(*) from _rk where media > 0));
    feitos := feitos + 1;
    n := n + 1;
  end loop;
  return feitos;
end;
$$;
revoke all on function public.site_ranked_processar() from public;
grant execute on function public.site_ranked_processar() to anon, authenticated;

-- ---------------------------------------------------------------
-- Situação da própria conta: elo, partidas de hoje, ciclo atual e
-- últimas mudanças de elo.
-- ---------------------------------------------------------------
create or replace function public.site_ranked_meu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg site_ranked_config;
  hoje date := site_hoje_br();
  n int;
  ini date;
  meu site_ranked;
  dias jsonb;
  soma numeric;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform site_ranked_processar();
  select * into cfg from site_ranked_config where id = 1;
  n := greatest(0, (hoje - cfg.inicio) / 3);
  ini := cfg.inicio + 3 * n;
  select * into meu from site_ranked where user_id = uid;

  select coalesce(jsonb_agg(jsonb_build_object('dia', g.dia::date, 'melhor', d.melhor) order by g.dia), '[]'::jsonb),
         coalesce(sum(d.melhor), 0)
    into dias, soma
    from generate_series(ini, ini + 2, interval '1 day') as g(dia)
    left join (
      select dia, max(score) as melhor from site_ranked_partidas
       where user_id = uid and dia between ini and ini + 2 group by dia
    ) d on d.dia = g.dia::date;

  return jsonb_build_object(
    'elo', coalesce(meu.elo, 'bronze'),
    'jogou', meu.user_id is not null,
    'temporada', cfg.temporada,
    'hoje', jsonb_build_object(
      'dia', hoje,
      'partidas', (select count(*) from site_ranked_partidas where user_id = uid and dia = hoje),
      'melhor', (select max(score) from site_ranked_partidas where user_id = uid and dia = hoje),
      -- quais partidas de hoje valeram (o site confere se a última entrou)
      'validas', coalesce((select jsonb_agg(r.client_id) from site_ranked_partidas k
                             join site_game_results r on r.id = k.result_id
                            where k.user_id = uid and k.dia = hoje), '[]'::jsonb)),
    'ciclo', jsonb_build_object(
      'numero', n, 'inicio', ini, 'fim', ini + 2, 'atualiza', ini + 3,
      'dias', dias, 'media', round(soma / 3.0, 1)),
    'proximo', case when site_ranked_proximo(coalesce(meu.elo, 'bronze')) is null then null else
      jsonb_build_object('elo', site_ranked_proximo(coalesce(meu.elo, 'bronze')),
                         'media', site_ranked_limiar(site_ranked_proximo(coalesce(meu.elo, 'bronze')))) end,
    'ultima_media', meu.ultima_media,
    'desafiantes', (select count(*) from site_ranked where elo = 'desafiante'),
    'vagas', 100,
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('ciclo', h.ciclo, 'de', h.de, 'para', h.para, 'media', round(h.media, 1), 'quando', h.criado) order by h.id desc)
        from (select * from site_ranked_historico where user_id = uid order by id desc limit 10) h), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.site_ranked_meu() from public, anon;
grant execute on function public.site_ranked_meu() to authenticated;

-- ---------------------------------------------------------------
-- Rankings públicos: 'diario', 'semanal' (segunda a domingo) e 'mensal'.
-- Pontos = soma das notas dos dias do período (nota do dia = melhor das 3
-- primeiras carreiras). Retorna os 100 primeiros e a posição de quem pediu.
-- ---------------------------------------------------------------
create or replace function public.site_ranking(periodo text)
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
begin
  perform site_ranked_processar();
  ini := case periodo
    when 'diario' then hoje
    when 'semanal' then date_trunc('week', hoje)::date
    when 'mensal' then date_trunc('month', hoje)::date
    else null end;
  if ini is null then
    raise exception 'periodo_invalido';
  end if;

  create temp table if not exists _rank (user_id uuid, pontos int, dias int, pos int) on commit drop;
  truncate _rank;
  insert into _rank
  select user_id, sum(melhor)::int, count(*)::int,
         rank() over (order by sum(melhor) desc)::int
    from (
      select user_id, dia, max(score) as melhor
        from site_ranked_partidas
       where dia between ini and hoje
       group by user_id, dia
    ) d
   group by user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'pos', k.pos, 'username', p.username, 'avatar', p.avatar,
           'elo', coalesce(r.elo, 'bronze'), 'pontos', k.pontos, 'dias', k.dias,
           'eu', k.user_id = uid) order by k.pos, p.username), '[]'::jsonb)
    into lista
    from (select * from _rank order by pos, user_id limit 100) k
    join site_profiles p on p.id = k.user_id
    left join site_ranked r on r.user_id = k.user_id;

  select jsonb_build_object('pos', k.pos, 'pontos', k.pontos, 'dias', k.dias)
    into eu from _rank k where k.user_id = uid;

  return jsonb_build_object('periodo', periodo, 'inicio', ini, 'fim', hoje,
                            'jogadores', (select count(*) from _rank),
                            'lista', lista, 'eu', eu);
end;
$$;
revoke all on function public.site_ranking(text) from public;
grant execute on function public.site_ranking(text) to anon, authenticated;
