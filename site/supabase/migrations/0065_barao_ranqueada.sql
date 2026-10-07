-- Show do Barão na ranqueada. Rodar depois da 0064. Rodar de novo é seguro.
--
-- Regras (iguais às da Carreira e do Lendas):
--   * Valem as 5 primeiras partidas COMEÇADAS no dia (cada uma vale o seu PDR).
--   * Começou e não terminou até a meia-noite: −15 PDR por partida.
--   * PDR pelo prêmio final (a tabela abaixo, antes do % do elo): o ganho passa
--     por site_rk_ajustar (Ferro 100% … Mestre para cima 50%); as perdas são
--     iguais para todos os elos.
--
--     até 500 pts  −20      10.000  +5      100.000  +20      500.000  +30
--     1.000        −15      20.000  +10     250.000  +25      1.000.000 +35
--     2.000        −10      50.000  +15
--     5.000         −5

-- Prêmio final → PDR de tabela (igual a baseBarao() em shared/ranked.js).
create or replace function public.site_rk_base_barao(premio numeric)
returns int language sql immutable as $$
  select case
    when premio >= 1000000 then 35
    when premio >= 500000 then 30
    when premio >= 250000 then 25
    when premio >= 100000 then 20
    when premio >= 50000 then 15
    when premio >= 20000 then 10
    when premio >= 10000 then 5
    when premio >= 5000 then -5
    when premio >= 2000 then -10
    when premio >= 1000 then -15
    else -20 end;
$$;

-- Prêmio possível de cada resultado: ganhou = 1.000.000; parou na pergunta n = prêmio da
-- anterior; errou na pergunta n = prêmio de duas antes (nada nas duas primeiras).
create or replace function public.site_barao_premio_ok(resultado text, nivel int, premio numeric)
returns boolean language sql immutable as $$
  with t(p) as (select array[500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 250000, 500000, 1000000]::numeric[])
  select case
    when nivel is null or nivel < 1 or nivel > 11 then false
    when resultado = 'ganhou' then nivel = 11 and premio = 1000000
    when resultado = 'parou' then nivel >= 2 and nivel <= 11 and premio = (select p[nivel - 1] from t)
    when resultado = 'errou' then premio = case when nivel >= 3 then (select p[nivel - 2] from t) else 0 end
    else false end;
$$;

-- 1. Começo da partida: o Barão também ganha ingresso do dia (5 por dia).
create or replace function public.site_rk_iniciar(jogo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  limite constant int := 5;
  feitas int;
  novo uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if jogo not in ('carreira-no-rift', 'cblol', 'barao') then
    raise exception 'jogo_invalido';
  end if;
  perform site_rk_processar();
  if exists (select 1 from site_ranked_banidos where user_id = uid) then
    return jsonb_build_object('token', null, 'dia', hoje, 'banido', true);
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || uid::text));
  select count(*) into feitas from site_ranked_inicios i where i.user_id = uid and i.dia = hoje and i.jogo = site_rk_iniciar.jogo;
  if feitas >= limite then
    return jsonb_build_object('token', null, 'dia', hoje, 'numero', null, 'restantes', 0, 'limite', limite);
  end if;
  insert into site_ranked_inicios (user_id, dia, jogo) values (uid, hoje, site_rk_iniciar.jogo) returning id into novo;
  perform site_rk_ativo(uid, hoje);
  return jsonb_build_object('token', novo, 'dia', hoje, 'numero', feitas + 1, 'restantes', limite - 1 - feitas, 'limite', limite);
end;
$$;
revoke all on function public.site_rk_iniciar(text) from public, anon;
grant execute on function public.site_rk_iniciar(text) to authenticated;

-- 2. Confere o resultado ao gravar: se for impossível (resultado e prêmio que não batem),
--    a partida fica salva, mas sem valer para a ranqueada.
do $$
declare
  def text;
  f constant text := 'public.site_game_results_limites()';
  marca constant text := '-- Lendas (Oculto) valendo PDR';
  bloco constant text := $b$
  -- Show do Barão valendo PDR: resultado, pergunta e prêmio precisam bater.
  if new.game_id = 'barao' and new.summary ? 'ranked' then
    if new.score is null
       or not site_barao_premio_ok(new.summary->>'resultado',
                                   case when (new.summary->>'nivel') ~ '^[0-9]{1,2}$' then (new.summary->>'nivel')::int end,
                                   new.score) then
      new.summary := new.summary - 'ranked';
    end if;
  end if;

  $b$;
begin
  if to_regprocedure(f) is null then
    raise exception 'site_game_results_limites não existe: rode a 0025 antes';
  end if;
  def := pg_get_functiondef(to_regprocedure(f));
  if position('game_id = ''barao''' in def) = 0 then
    if position(marca in def) = 0 then
      raise exception 'não achei o ponto de inserção em site_game_results_limites';
    end if;
    execute replace(def, marca, bloco || marca);
  end if;
end $$;

-- 3. Fim de partida: Carreira, Lendas e Barão.
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
  if new.game_id not in ('carreira-no-rift', 'cblol', 'barao') or new.score is null then
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
  elsif new.game_id = 'barao' then
    if not site_barao_premio_ok(new.summary->>'resultado',
                                case when (new.summary->>'nivel') ~ '^[0-9]{1,2}$' then (new.summary->>'nivel')::int end,
                                new.score) then
      return new;
    end if;
  else
    if coalesce(new.summary->>'modo', '') <> 'oculto' then return new; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || new.user_id::text));
  -- Vaga da própria conta, deste jogo, de hoje, ainda não usada (as 5 primeiras do dia).
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
  niv := site_rk_nivel_de(new.user_id);
  if new.game_id = 'carreira-no-rift' then
    b := site_rk_base_carreira(new.score, niv);
    -- Mantém a tabela de partidas (painel de vigilância da Carreira).
    insert into site_ranked_partidas (user_id, dia, score, result_id) values (new.user_id, hoje, round(new.score), new.id);
  elsif new.game_id = 'barao' then
    b := site_rk_base_barao(new.score);
  else
    b := site_rk_base_lendas(new.summary->>'resultado', coalesce((new.summary->>'vitorias')::int, 0),
                             coalesce((new.summary->>'invicto')::boolean, false));
  end if;
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

-- 4. "Minha ranqueada": as vagas de hoje também mostram o Barão.
do $$
declare
  def text;
  f constant text := 'public.site_rk_meu()';
  velho constant text := '''cblol'', (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje and jogo = ''cblol'')';
  novo constant text := velho || ', ''barao'', (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje and jogo = ''barao'')';
begin
  def := pg_get_functiondef(to_regprocedure(f));
  if position('jogo = ''barao''' in def) = 0 then
    if position(velho in def) = 0 then
      raise exception 'não achei as vagas em site_rk_meu';
    end if;
    execute replace(def, velho, novo);
  end if;
end $$;
