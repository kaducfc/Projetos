-- Lendas do CBLOL (modo Oculto): chegar aos playoffs sempre vale PDR
-- positivo, e agora são 4 vitórias (de 7) para passar da fase de pontos.
-- Rodar depois da 0019.
--
-- Fase de pontos (0 a 3 vitórias): −24, −20, −16, −12.
-- Quartas: +5 a +8 · Semifinal: +9 a +12 · Vice: +14 a +17
-- (4, 5, 6 ou 7 vitórias na fase de pontos).
-- Campeão: +25 a +31 · Campeão invicto (7-0 e sem perder jogo): +35.
create or replace function public.site_rk_base_lendas(resultado text, vitorias int, invicto boolean)
returns int language sql immutable as $$
  select case
    when resultado = 'campeao' and invicto then 35
    when resultado = 'campeao' then 25 + 2 * least(3, greatest(0, vitorias - 4))
    when resultado in ('vice', 'final') then 14 + least(3, greatest(0, vitorias - 4))
    when resultado = 'semi' then 9 + least(3, greatest(0, vitorias - 4))
    when resultado = 'quartas' then 5 + least(3, greatest(0, vitorias - 4))
    else -(24 - 4 * least(3, greatest(0, vitorias))) end;
$$;
