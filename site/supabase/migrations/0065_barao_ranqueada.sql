-- Show do Barão na ranqueada. Rodar depois da 0064. Rodar de novo é seguro.
--
-- Regras (iguais às da Carreira e do Lendas):
--   * Valem as 5 primeiras partidas COMEÇADAS no dia (cada uma vale o seu PDR).
--   * Começou e não terminou até a meia-noite: −15 PDR por partida.
--   * Quem lança o PDR é o servidor do jogo (0066_barao_servidor.sql), no fim da partida.
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

-- 2. "Minha ranqueada": as vagas de hoje também mostram o Barão.
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
