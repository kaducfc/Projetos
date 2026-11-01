-- Simulador de Técnico: novos valores de fragmentos por demissão (e, com eles, o custo das estrelas e o valor de cada cópia). Rode depois do 0155. Idempotente.
--  * Jogador comum (sem raridade), pelo Poder: até 50 = 5 · de 51 a 70 = 10 · de 71 a 80 = 15 · 81 ou mais = 20.
--  * Legado, por raridade: comum 30 · raro 40 · épico 60 · lendário 80 · mítico 125.
--  * Custo da estrela N em fragmentos: Legado 2 x N x base; comum 3 x N x base (a base é o que a demissão rende, sem estrelas). Cada cópia vale a base.
update public.tc_config set valor = valor || '{"legado_base": {"comum": 30, "raro": 40, "epico": 60, "lendario": 80, "mitico": 125},
    "ficticio_faixas": [{"ate": 50, "frag": 5}, {"ate": 70, "frag": 10}, {"ate": 80, "frag": 15}, {"ate": 100, "frag": 20}]}'::jsonb where chave = 'estrelas_jogador';

create or replace function public.tc_frag_base(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select case when j.ficticio
    then coalesce((select (f->>'frag')::int from jsonb_array_elements((tc_cfg('estrelas_jogador'))->'ficticio_faixas') f
                    where round(tc_poder(j)) <= (f->>'ate')::numeric order by (f->>'ate')::numeric limit 1), 20)
    else coalesce((((tc_cfg('estrelas_jogador'))->'legado_base')->>coalesce(j.raridade, 'comum'))::int, 30) end;
$$;
revoke all on function public.tc_frag_base(tc_jogadores) from public, anon, authenticated;
