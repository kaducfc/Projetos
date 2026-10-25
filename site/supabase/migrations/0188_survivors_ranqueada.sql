-- Rift Survivors na ranqueada. Rodar depois da 0187. Rodar de novo é seguro.
--
-- Regras:
--   * Valem as 2 primeiras partidas COMEÇADAS no dia (cada uma vale o seu PDR).
--   * Começou e não terminou até a meia-noite: −15 PDR por partida (a atualização diária já cobre qualquer jogo).
--   * O PDR vem do TEMPO SOBREVIVIDO (antes do % do elo; o ganho passa por site_rk_ajustar):
--       menos de 4:00 perde:  0:00 → −15 · 3:59 → −3 (reta entre os dois)
--       a partir de 4:00 ganha: 4:00 → +3 · 15:00 → +35 (reta entre os dois); depois dos 15:00 continua +35
--     Vitória (chefe final derrotado) vale o máximo, +35. Ixtal dura 15 min e os outros reinos 10 min.
--   * O cliente joga e registra o resultado (como a Carreira e o Barão da Sucata); o servidor só confere que o tempo e o reino
--     enviados são possíveis. Ele NÃO vê a partida: quem forjar um resumo coerente consegue pontuar.

-- 1. PDR de tabela pelo tempo (igual a baseSurvivors() em shared/ranked.js).
create or replace function public.site_rk_base_survivors(tempo numeric, venceu boolean)
returns int language sql immutable as $$
  select case
    when coalesce(venceu, false) then 35
    when least(greatest(tempo, 0), 900) >= 240 then round(3 + (least(tempo, 900) - 240) * 32 / 660.0)::int
    else -round(3 + (239 - greatest(floor(tempo), 0)) * 12 / 239.0)::int
  end;
$$;

-- 2. Começo da partida: ingresso do dia (2 por dia, como os outros jogos por vagas).
create or replace function public.site_rk_iniciar(jogo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  limite int := 2; -- todos os jogos por vagas valem as 2 primeiras partidas do dia
  feitas int;
  novo uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if jogo not in ('carreira-no-rift', 'cblol', 'barao', 'smite', 'bar-do-barao', 'survivors') then
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

-- 3. "Minha ranqueada": as vagas de hoje também mostram o Rift Survivors.
do $$
declare
  def text;
  f constant text := 'public.site_rk_meu()';
  velho constant text := '''bar-do-barao'', (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje and jogo = ''bar-do-barao'')';
  novo constant text := velho || ', ''survivors'', (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje and jogo = ''survivors'')';
begin
  def := pg_get_functiondef(to_regprocedure(f));
  if position('jogo = ''survivors''' in def) = 0 then
    if position(velho in def) = 0 then
      raise exception 'não achei as vagas do Barão da Sucata em site_rk_meu (rode a 0073 antes)';
    end if;
    execute replace(def, velho, novo);
  end if;
end $$;

-- 4. Fim de partida: o gatilho do resultado ganha o ramo do Rift Survivors (o resto é igual ao da 0073).
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
  tempo int;
  venceu boolean;
  max_t int;
begin
  if new.game_id not in ('carreira-no-rift', 'cblol', 'smite', 'bar-do-barao', 'survivors') or new.score is null then
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
  elsif new.game_id = 'survivors' then
    -- O tempo sobrevivido (segundos) tem que caber no reino: Ixtal dura 15 min e os outros 10 min.
    if (new.summary->>'tempo') is null or (new.summary->>'tempo') !~ '^[0-9]{1,4}$' then return new; end if;
    if (new.summary->>'reino') is null or (new.summary->>'reino') not in ('ixtal', 'ionia', 'demacia', 'noxus', 'shurima', 'freljord') then return new; end if;
    if new.summary->'venceu' is not null and jsonb_typeof(new.summary->'venceu') <> 'boolean' then return new; end if;
    tempo := (new.summary->>'tempo')::int;
    venceu := coalesce((new.summary->>'venceu')::boolean, false);
    max_t := case when new.summary->>'reino' = 'ixtal' then 900 else 600 end;
    if tempo > max_t + 5 then return new; end if;
    if venceu and tempo < max_t - 5 then return new; end if; -- vitória só no fim do tempo do reino
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
  elsif new.game_id = 'survivors' then
    b := site_rk_base_survivors(tempo, venceu);
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
