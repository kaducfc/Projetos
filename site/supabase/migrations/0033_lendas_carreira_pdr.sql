-- Lendas do CBLOL e Carreira: novas tabelas de PDR. Rodar depois da 0032. Rodar de
-- novo é seguro.
--
-- Lendas (modo Oculto): 3 vitórias na fase de pontos já dão +5 mesmo sem passar
-- (os playoffs continuam exigindo 4); sem vitória −20, com 1 −10, com 2 −5.
-- Quartas, semifinal, vice e campeão foram recalculados (+3 em cada) para
-- continuarem acima do +5 da fase:
--   fase   0v −20 · 1v −10 · 2v −5 · 3v +5
--   quartas +8 a +11 · semi +12 a +15 · vice +17 a +20
--   campeão +28 a +34 (2 a mais por vitória na fase) · invicto +38
-- (o + por vitória conta de 4 a 7 vitórias na fase).
create or replace function public.site_rk_base_lendas(resultado text, vitorias int, invicto boolean)
returns int language sql immutable as $$
  select case
    when resultado = 'campeao' and invicto then 38
    when resultado = 'campeao' then 28 + 2 * least(3, greatest(0, vitorias - 4))
    when resultado in ('vice', 'final') then 17 + least(3, greatest(0, vitorias - 4))
    when resultado = 'semi' then 12 + least(3, greatest(0, vitorias - 4))
    when resultado = 'quartas' then 8 + least(3, greatest(0, vitorias - 4))
    else case least(3, greatest(0, vitorias)) when 0 then -20 when 1 then -10 when 2 then -5 else 5 end
  end;
$$;

-- Carreira: a nota de legado onde o PDR vira positivo depende do elo. Ferro,
-- Bronze e Prata (nível 0 a 2) começam a ganhar a partir de 300 pontos; do Ouro
-- (nível 3) para cima, a partir de 400. A rampa de perdas anda junto: −2 logo
-- abaixo do ponto, −25 a 250 pontos dele. De 1.100 para cima é igual para todos
-- (+32 a +38).
drop function if exists public.site_rk_base_carreira(numeric);
create or replace function public.site_rk_base_carreira(legado numeric, nivel int default 3)
returns int language sql immutable as $$
  select case
    when legado >= 1100 then round(32 + least(6, (legado - 1100) * 6 / 500.0))::int
    when legado >= ponto then round(5 + (legado - ponto) * 27 / (1100 - ponto))::int
    else -round(2 + least(23, (ponto - legado) * 23 / 250.0))::int
  end
  from (select case when nivel <= 2 then 300 else 400 end as ponto) p;
$$;

-- Fim de partida (Carreira e Lendas): a base da Carreira agora depende do elo.
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
