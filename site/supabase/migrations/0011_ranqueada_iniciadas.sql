-- Ranqueada: valem as 3 primeiras carreiras COMEÇADAS no dia.
--
-- Fecha a brecha de começar várias carreiras no mesmo dia (em abas
-- diferentes, por exemplo), ver qual está indo melhor e terminar só essa.
-- Agora o servidor só entrega 3 ingressos ranqueados por dia: a 1ª, a 2ª e a
-- 3ª carreira começadas. Carreira abandonada também gasta a vaga. Da 4ª em
-- diante dá para jogar normalmente, mas não vale para a ranqueada.
-- Continua valendo a regra do 0010: tem que terminar no mesmo dia.
--
-- Como aplicar: cole este arquivo no SQL Editor do Supabase e clique em Run
-- (depois do 0010). Rodar de novo é seguro.

-- Começo de carreira: entrega o ingresso só para as 3 primeiras do dia.
create or replace function public.site_ranked_iniciar()
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
  perform pg_advisory_xact_lock(hashtext('ranked:' || uid::text));
  select count(*) into feitas from site_ranked_inicios where user_id = uid and dia = hoje;
  if feitas >= 3 then
    return jsonb_build_object('token', null, 'dia', hoje, 'numero', null, 'restantes', 0);
  end if;
  insert into site_ranked_inicios (user_id, dia) values (uid, hoje) returning id into novo;
  return jsonb_build_object('token', novo, 'dia', hoje, 'numero', feitas + 1, 'restantes', 2 - feitas);
end;
$$;
revoke all on function public.site_ranked_iniciar() from public, anon;
grant execute on function public.site_ranked_iniciar() to authenticated;

-- Fim de carreira: vale com ingresso da própria conta, de hoje, ainda não
-- usado e que seja um dos 3 primeiros do dia.
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
begin
  if new.game_id <> 'carreira-no-rift' or new.score is null or new.score < 0 or new.score > 3000 then
    return new;
  end if;
  if tok is null or tok !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || new.user_id::text));
  if (select count(*) from site_ranked_partidas where user_id = new.user_id and dia = hoje) >= 3 then
    return new;
  end if;
  update site_ranked_inicios i set result_id = new.id
   where i.id = tok::uuid and i.user_id = new.user_id and i.dia = hoje and i.result_id is null
     and (select count(*) from site_ranked_inicios o
           where o.user_id = i.user_id and o.dia = i.dia and (o.criado, o.id) < (i.criado, i.id)) < 3
  returning i.id into usado;
  if usado is null then
    return new;
  end if;
  insert into site_ranked_partidas (user_id, dia, score, result_id)
  values (new.user_id, hoje, round(new.score), new.id);
  insert into site_ranked (user_id) values (new.user_id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Minha ranqueada: igual à do 0007, mais quantas carreiras ranqueadas já
-- foram começadas hoje ('hoje.iniciadas').
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
      'iniciadas', least(3, (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje)),
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
