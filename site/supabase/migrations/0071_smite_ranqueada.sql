-- Desafio do Golpear (smite) na ranqueada. Rodar depois da 0070. Rodar de novo é seguro.
--
-- Regras:
--   * Valem as 2 primeiras partidas COMEÇADAS no dia (cada uma vale o seu PDR).
--   * Começou e não terminou até a meia-noite: −15 PDR por partida (a atualização diária já cobre qualquer jogo).
--   * A partida tem 5 rodadas de até 100 pontos: a nota é a soma (0 a 500).
--   * PDR de tabela pela nota, antes do % do elo (o ganho passa por site_rk_ajustar; as perdas são iguais para todos):
--       500 → +35      250 → +3        (reta entre os dois: ganha de +3 a +35)
--       249 → −3       0   → −30       (reta entre os dois: perde de −3 a −30)
--   * O cliente joga e registra o resultado (como a Carreira e o Lendas); o servidor confere que a nota é a soma das 5 rodadas.

-- 1. PDR de tabela pela nota (igual a baseSmite() em shared/ranked.js).
create or replace function public.site_rk_base_smite(pontos numeric)
returns int language sql immutable as $$
  select case
    when pontos >= 250 then round(3 + (least(pontos, 500) - 250) * 32 / 250.0)::int
    else -round(3 + (249 - greatest(pontos, 0)) * 27 / 249.0)::int
  end;
$$;

-- 2. A perda máxima passa de −25 para −30 (as tabelas dos outros jogos nunca passam de −25, então nada muda para eles).
create or replace function public.site_rk_ajustar(base int, nivel int)
returns int language sql immutable as $$
  select case when base > 0 then greatest(1, round(least(base, 38) * site_rk_ganho_pct(nivel) / 100.0)::int)
              else greatest(-30, base) end;
$$;

-- 3. Começo da partida: ingresso do dia (3 por dia nos outros jogos, 2 por dia no Golpear).
create or replace function public.site_rk_iniciar(jogo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hoje date := site_hoje_br();
  limite int := case when jogo = 'smite' then 2 else 3 end;
  feitas int;
  novo uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if jogo not in ('carreira-no-rift', 'cblol', 'barao', 'smite') then
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

-- 4. "Minha ranqueada": as vagas de hoje também mostram o Golpear.
do $$
declare
  def text;
  f constant text := 'public.site_rk_meu()';
  velho constant text := '''barao'', (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje and jogo = ''barao'')';
  novo constant text := velho || ', ''smite'', (select count(*) from site_ranked_inicios where user_id = uid and dia = hoje and jogo = ''smite'')';
begin
  def := pg_get_functiondef(to_regprocedure(f));
  if position('jogo = ''smite''' in def) = 0 then
    if position(velho in def) = 0 then
      raise exception 'não achei as vagas do Barão em site_rk_meu (rode a 0065 antes)';
    end if;
    execute replace(def, velho, novo);
  end if;
end $$;

-- 5. Fim de partida (Carreira, Lendas e Golpear): o gatilho do resultado ganha o ramo do Golpear.
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
  if new.game_id not in ('carreira-no-rift', 'cblol', 'smite') or new.score is null then
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
