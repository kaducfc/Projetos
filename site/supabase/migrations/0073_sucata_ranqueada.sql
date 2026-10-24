-- Barão da Sucata (bar-do-barao) na ranqueada. Rodar depois da 0072. Rodar de novo é seguro.
--
-- Regras:
--   * Valem as 2 primeiras partidas COMEÇADAS no dia (cada uma vale o seu PDR).
--   * Começou e não terminou até a meia-noite: −15 PDR por partida (a atualização diária já cobre qualquer jogo).
--   * A pontuação da partida vai de 10 a 100 (colocação + cartas finais + cartas tiradas + eliminações + blefes + cofre
--     + tempo na mesa − penalidades; ver jogos/bar-do-barao/js/pontuacao.js).
--   * PDR de tabela pela pontuação, antes do % do elo (o ganho passa por site_rk_ajustar):
--       100 → +35      55 → +3        (reta entre os dois: ganha de +3 a +35)
--       54  → −3       10 → −25       (reta entre os dois: perde de −3 a −25)
--   * O cliente joga e registra o resultado (como a Carreira, o Lendas e o Golpear); o servidor confere que o detalhe
--     enviado (summary.detalhe) tem itens permitidos, com os valores certos de cada um, e que a soma (limitada a 10..100)
--     é a pontuação registrada. Ele NÃO consegue ver as jogadas: quem forjar um detalhe coerente consegue pontuar.

-- 1. PDR de tabela pela pontuação (igual a baseSucata() em shared/ranked.js).
create or replace function public.site_rk_base_sucata(pontos numeric)
returns int language sql immutable as $$
  select case
    when pontos >= 55 then round(3 + (least(pontos, 100) - 55) * 32 / 45.0)::int
    else -round(3 + (54 - greatest(pontos, 10)) * 22 / 44.0)::int
  end;
$$;

-- 2. Confere o detalhe da pontuação (mesmos valores de jogos/bar-do-barao/js/pontuacao.js).
create or replace function public.site_rk_valida_sucata(pontos numeric, det jsonb)
returns boolean language plpgsql immutable as $$
declare
  n int;
  chaves int;
  soma int;
  coloc int;
  qtd_tiradas int := 0;
  qtd_elim int := 0;
  tem_finais boolean := false;
  x jsonb;
  k text;
  v int;
  q int;
  esperado int;
begin
  if pontos is null or pontos < 10 or pontos > 100 or pontos <> floor(pontos) then return false; end if;
  if det is null or jsonb_typeof(det) <> 'array' then return false; end if;
  n := jsonb_array_length(det);
  if n < 1 or n > 9 then return false; end if;
  select count(distinct y->>'chave') into chaves from jsonb_array_elements(det) y;
  if chaves <> n then return false; end if;
  soma := 0;
  for x in select * from jsonb_array_elements(det) loop
    if jsonb_typeof(x) <> 'object' then return false; end if;
    k := x->>'chave';
    if (x->>'valor') is null or (x->>'valor') !~ '^-?[0-9]{1,3}$' then return false; end if;
    v := (x->>'valor')::int;
    if (x->>'qtd') is not null then
      if (x->>'qtd') !~ '^[0-9]{1,3}$' then return false; end if;
      q := (x->>'qtd')::int;
    else
      q := null;
    end if;
    if k = 'colocacao' then
      if q is null or q not between 1 and 4 then return false; end if;
      esperado := case q when 1 then 52 when 2 then 50 when 3 then 38 else 20 end;
      if v <> esperado then return false; end if;
      coloc := q;
    elsif k = 'cartas_finais' then
      if q is null or q not in (1, 2) then return false; end if;
      esperado := case q when 2 then 16 else 10 end;
      if v <> esperado then return false; end if;
      tem_finais := true;
    elsif k = 'cartas_tiradas' then
      if q is null or q not between 1 and 6 or v <> q * 6 then return false; end if;
      qtd_tiradas := q;
    elsif k = 'eliminacoes' then
      if q is null or q not between 1 and 3 or v <> q * 6 then return false; end if;
      qtd_elim := q;
    elsif k = 'blefes' then
      if q is null or q not between 1 and 5 or v <> q * 2 then return false; end if;
    elsif k = 'cofre' then
      if q is null or q < 2 or q > 200 or v <> least(4, q / 2) then return false; end if;
    elsif k = 'sobrevivencia' then
      if v not between 1 and 8 then return false; end if;
    elsif k = 'duvida_errada' then
      if q is null or q not between 1 and 50 or v <> -3 * q then return false; end if;
    elsif k = 'blefe_descoberto' then
      if q is null or q not between 1 and 50 or v <> -2 * q then return false; end if;
    else
      return false;
    end if;
    soma := soma + v;
  end loop;
  if coloc is null then return false; end if;
  if tem_finais and coloc <> 1 then return false; end if; -- só o vencedor termina vivo
  if qtd_elim > qtd_tiradas then return false; end if; -- cada eliminação é uma carta tirada
  return greatest(10, least(100, soma)) = pontos;
end;
$$;

-- 3. Começo da partida: ingresso do dia (2 por dia no Barão da Sucata, no Golpear, na Carreira e no Lendas; 3 no Show do Barão).
create or replace function public.site_rk_iniciar(jogo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  limite int := case when jogo in ('smite', 'cblol', 'carreira-no-rift', 'bar-do-barao') then 2 else 3 end;
  feitas int;
  novo uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if jogo not in ('carreira-no-rift', 'cblol', 'barao', 'smite', 'bar-do-barao') then
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

-- 4. "Minha ranqueada": as vagas de hoje também mostram o Barão da Sucata.
do $$
declare
  def text;
  f constant text := 'public.site_rk_meu()';
  velho constant text := '''smite'', (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje and jogo = ''smite'')';
  novo constant text := velho || ', ''bar-do-barao'', (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje and jogo = ''bar-do-barao'')';
begin
  def := pg_get_functiondef(to_regprocedure(f));
  if position('jogo = ''bar-do-barao''' in def) = 0 then
    if position(velho in def) = 0 then
      raise exception 'não achei as vagas do Golpear em site_rk_meu (rode a 0071 antes)';
    end if;
    execute replace(def, velho, novo);
  end if;
end $$;

-- 5. Fim de partida: o gatilho do resultado ganha o ramo do Barão da Sucata (o resto é igual ao da 0071).
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
  rod jsonb;
  qtd int;
  soma int;
  ok boolean;
begin
  if new.game_id not in ('carreira-no-rift', 'cblol', 'smite', 'bar-do-barao') or new.score is null then
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
  elsif new.game_id = 'smite' then
    -- A nota (0 a 500) é a soma das 5 rodadas de até 100 pontos.
    if new.score < 0 or new.score > 500 then return new; end if;
    rod := new.summary->'rodadas';
    if rod is null or jsonb_typeof(rod) <> 'array' or jsonb_array_length(rod) <> 5 then return new; end if;
    select count(*)::int,
           coalesce(sum(case when (x->>'p') ~ '^[0-9]{1,3}$' then (x->>'p')::int end), 0)::int,
           bool_and(case when (x->>'p') ~ '^[0-9]{1,3}$' then (x->>'p')::int <= 100 else false end)
      into qtd, soma, ok
      from jsonb_array_elements(rod) x;
    if qtd <> 5 or not coalesce(ok, false) or soma <> round(new.score) then return new; end if;
  elsif new.game_id = 'bar-do-barao' then
    -- A pontuação (10 a 100) tem que bater com o detalhe enviado.
    if not site_rk_valida_sucata(new.score, new.summary->'detalhe') then return new; end if;
  else
    if coalesce(new.summary->>'modo', '') <> 'oculto' then return new; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('ranked:' || new.user_id::text));
  -- Vaga da própria conta, deste jogo, de hoje, ainda não usada.
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
  elsif new.game_id = 'smite' then
    b := site_rk_base_smite(new.score);
  elsif new.game_id = 'bar-do-barao' then
    b := site_rk_base_sucata(new.score);
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
