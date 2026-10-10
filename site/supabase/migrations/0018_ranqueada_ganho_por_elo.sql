-- Ranqueada: a régua vira um percentual só nos ganhos, e a eliminação na
-- fase de pontos do Lendas do CBLOL passa a depender das vitórias.
-- Rodar depois da 0015/0016/0017.
--
-- Ganhos (+5..+38) por elo: Ferro 100%; Bronze até Ouro 80%; Platina e
-- Esmeralda 70%; Diamante 60%; Mestre, Grão-Mestre e Desafiante 50%.
-- Perdas (−2..−25): iguais para todos os elos.

create or replace function public.site_rk_ganho_pct(nivel int)
returns int language sql immutable as $$
  select (array[100, 80, 80, 80, 70, 70, 60, 50, 50, 50])[least(greatest(nivel, 0), 9) + 1];
$$;

create or replace function public.site_rk_ajustar(base int, nivel int)
returns int language sql immutable as $$
  select case when base > 0 then greatest(1, round(least(base, 38) * site_rk_ganho_pct(nivel) / 100.0)::int)
              else greatest(-25, base) end;
$$;

drop function if exists public.site_rk_regua(int);

-- Lendas do CBLOL (modo Oculto). Eliminado na fase de pontos (0 a 2
-- vitórias): −24, −20, −16.
create or replace function public.site_rk_base_lendas(resultado text, vitorias int, invicto boolean)
returns int language sql immutable as $$
  select case
    when resultado = 'campeao' and invicto then 35
    when resultado = 'campeao' then 18 + 2 * least(4, greatest(0, vitorias - 3))
    when resultado in ('vice', 'final') then 6 + least(4, greatest(0, vitorias - 3))
    when resultado = 'semi' then -(4 + least(2, greatest(0, 5 - vitorias)))
    when resultado = 'quartas' then -(10 + 2 * least(2, greatest(0, 5 - vitorias)))
    else -(24 - 4 * least(2, greatest(0, vitorias))) end;
$$;
