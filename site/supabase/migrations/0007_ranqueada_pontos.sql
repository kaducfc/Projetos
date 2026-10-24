-- Ranqueada, versão 2 (rodar depois do 0006_ranqueada.sql):
--   * O ciclo de 3 dias passa a valer pela SOMA das notas dos dias (não a
--     média): Prata 1500, Ouro 1950, Platina 2250, Diamante 2550,
--     Desafiante 2850 (+ top 100). Dá para bater a meta em 2 dias.
--   * Queda: quem fizer menos de 1/6 da meta do próprio elo no ciclo cai 1
--     elo (ficar os 3 dias sem jogar sempre derruba). Bronze não cai.
--   * Desafiante: entre os Desafiantes que jogaram e os Diamantes que bateram
--     2850, ficam os 100 com mais pontos. Com 100 ou menos, só cai quem
--     ficou os 3 dias sem jogar.
--   * site_ranked_resetar(): zera a ranqueada (só administradores), para o
--     lançamento oficial.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique
-- em Run. Rodar de novo é seguro.

-- Pontos do ciclo para subir PARA o elo.
create or replace function public.site_ranked_limiar(elo text)
returns int
language sql
immutable
as $$
  select case elo
    when 'prata' then 1500 when 'ouro' then 1950 when 'platina' then 2250
    when 'diamante' then 2550 when 'desafiante' then 2850 else 0 end;
$$;

create or replace function public.site_ranked_anterior(elo text)
returns text
language sql
immutable
as $$
  select case elo
    when 'prata' then 'bronze' when 'ouro' then 'prata' when 'platina' then 'ouro'
    when 'diamante' then 'platina' when 'desafiante' then 'diamante' else null end;
$$;

-- Mínimo no ciclo para não cair (1/6 da meta do próprio elo). Bronze e
-- Desafiante não usam (Desafiante tem regra própria).
create or replace function public.site_ranked_minimo(elo text)
returns int
language sql
immutable
as $$
  select case when elo in ('prata', 'ouro', 'platina', 'diamante') then site_ranked_limiar(elo) / 6 else 0 end;
$$;

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
  if not pg_try_advisory_xact_lock(hashtext('ranked:processar')) then
    return 0;
  end if;
  n := coalesce((select max(ciclo) from site_ranked_ciclos), -1) + 1;
  while cfg_inicio + 3 * n + 3 <= hoje loop
    ini := cfg_inicio + 3 * n;

    create temp table if not exists _rk2 (user_id uuid primary key, elo text, novo text, total int) on commit drop;
    truncate _rk2;
    insert into _rk2 (user_id, elo, novo, total)
    select r.user_id, r.elo, r.elo, coalesce(sum(d.melhor), 0)
      from site_ranked r
      left join (
        select user_id, dia, max(score) as melhor
          from site_ranked_partidas
         where dia between ini and ini + 2
         group by user_id, dia
      ) d on d.user_id = r.user_id
     group by r.user_id, r.elo;

    -- Sobe 1 elo (Bronze a Platina) quem bateu a meta do próximo.
    update _rk2 set novo = site_ranked_proximo(elo)
     where elo in ('bronze', 'prata', 'ouro', 'platina')
       and total >= site_ranked_limiar(site_ranked_proximo(elo));

    -- Cai 1 elo (Prata a Diamante) quem ficou muito abaixo.
    update _rk2 set novo = site_ranked_anterior(elo)
     where elo in ('prata', 'ouro', 'platina', 'diamante')
       and novo = elo
       and total < site_ranked_minimo(elo)
       and not (elo = 'diamante' and total >= site_ranked_limiar('desafiante'));

    -- Desafiante: quem ficou os 3 dias sem jogar cai; das vagas, ficam os
    -- 100 com mais pontos entre os que jogaram e os Diamantes que bateram a meta.
    update _rk2 set novo = 'diamante' where elo = 'desafiante' and total = 0;
    with candidatos as (
      select user_id, row_number() over (order by total desc, user_id) as pos
        from _rk2
       where (elo = 'desafiante' and total > 0)
          or (elo = 'diamante' and total >= site_ranked_limiar('desafiante'))
    )
    update _rk2 k set novo = case when c.pos <= vagas then 'desafiante' else 'diamante' end
      from candidatos c where c.user_id = k.user_id;

    insert into site_ranked_historico (user_id, ciclo, de, para, media)
    select user_id, n, elo, novo, total from _rk2 where novo <> elo;
    update site_ranked r set elo = k.novo, desde = now()
      from _rk2 k where r.user_id = k.user_id and k.novo <> k.elo;
    update site_ranked r set ultima_media = k.total, ultimo_ciclo = n
      from _rk2 k where r.user_id = k.user_id;

    insert into site_ranked_ciclos (ciclo, participantes)
    values (n, (select count(*) from _rk2 where total > 0));
    feitos := feitos + 1;
    n := n + 1;
  end loop;
  return feitos;
end;
$$;
revoke all on function public.site_ranked_processar() from public;
grant execute on function public.site_ranked_processar() to anon, authenticated;

-- Situação da própria conta (agora com os pontos do ciclo e o mínimo para
-- não cair). A coluna/chave "media" do histórico guarda os pontos do ciclo.
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
  elo text;
  dias jsonb;
  soma int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform site_ranked_processar();
  select * into cfg from site_ranked_config where id = 1;
  n := greatest(0, (hoje - cfg.inicio) / 3);
  ini := cfg.inicio + 3 * n;
  select * into meu from site_ranked where user_id = uid;
  elo := coalesce(meu.elo, 'bronze');

  select coalesce(jsonb_agg(jsonb_build_object('dia', g.dia::date, 'melhor', d.melhor) order by g.dia), '[]'::jsonb),
         coalesce(sum(d.melhor), 0)
    into dias, soma
    from generate_series(ini, ini + 2, interval '1 day') as g(dia)
    left join (
      select dia, max(score) as melhor from site_ranked_partidas
       where user_id = uid and dia between ini and ini + 2 group by dia
    ) d on d.dia = g.dia::date;

  return jsonb_build_object(
    'elo', elo,
    'jogou', meu.user_id is not null,
    'temporada', cfg.temporada,
    'hoje', jsonb_build_object(
      'dia', hoje,
      'partidas', (select count(*) from site_ranked_partidas where user_id = uid and dia = hoje),
      'melhor', (select max(score) from site_ranked_partidas where user_id = uid and dia = hoje),
      'validas', coalesce((select jsonb_agg(r.client_id) from site_ranked_partidas k
                             join site_game_results r on r.id = k.result_id
                            where k.user_id = uid and k.dia = hoje), '[]'::jsonb)),
    'ciclo', jsonb_build_object(
      'numero', n, 'inicio', ini, 'fim', ini + 2, 'atualiza', ini + 3,
      'dias', dias, 'total', soma, 'media', round(soma / 3.0, 1),
      'minimo', case when meu.user_id is null then 0 else site_ranked_minimo(elo) end),
    'proximo', case when site_ranked_proximo(elo) is null then null else
      jsonb_build_object('elo', site_ranked_proximo(elo), 'pontos', site_ranked_limiar(site_ranked_proximo(elo))) end,
    'ultimo_total', meu.ultima_media,
    'desafiantes', (select count(*) from site_ranked where site_ranked.elo = 'desafiante'),
    'vagas', 100,
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('ciclo', h.ciclo, 'de', h.de, 'para', h.para, 'pontos', round(h.media), 'quando', h.criado) order by h.id desc)
        from (select * from site_ranked_historico where user_id = uid order by id desc limit 10) h), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.site_ranked_meu() from public, anon;
grant execute on function public.site_ranked_meu() to authenticated;

-- Zera a ranqueada (lançamento oficial ou nova temporada): apaga elos,
-- partidas ranqueadas, ciclos e histórico de elo. O histórico de partidas
-- de cada conta continua. O ciclo 0 começa no dia em que for chamada.
create or replace function public.site_ranked_resetar(nova_temporada int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  apagadas int;
begin
  if not site_is_admin() then
    raise exception 'not_admin';
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:processar'));
  delete from site_ranked_partidas;
  get diagnostics apagadas = row_count;
  delete from site_ranked_historico;
  delete from site_ranked_ciclos;
  delete from site_ranked;
  update site_ranked_config set inicio = site_hoje_br(), temporada = greatest(1, nova_temporada) where id = 1;
  return jsonb_build_object('partidas_apagadas', apagadas, 'inicio', site_hoje_br(), 'temporada', greatest(1, nova_temporada));
end;
$$;
revoke all on function public.site_ranked_resetar(int) from public, anon;
grant execute on function public.site_ranked_resetar(int) to authenticated;
