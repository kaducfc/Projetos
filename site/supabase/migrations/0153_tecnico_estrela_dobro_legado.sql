-- Simulador de Técnico: o custo em fragmentos de cada estrela de um Legado cai de 3x para 2x o que a demissão dele rende (N x 2 x base).
-- Jogador comum continua em 3x. Rode depois do 0152. Idempotente. Para mudar: update tc_config set valor = jsonb_set(valor, '{mult_estrela_legado}', '2') where chave = 'estrelas_jogador';
update public.tc_config set valor = valor || '{"mult_estrela_legado": 2}'::jsonb where chave = 'estrelas_jogador';

create or replace function public.tc_estrela_custo_frag(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select (((tc_cfg('estrelas_jogador'))->>(case when j.ficticio then 'mult_estrela' else 'mult_estrela_legado' end))::numeric * (j.estrelas + 1) * tc_frag_base(j))::int;
$$;
revoke all on function public.tc_estrela_custo_frag(tc_jogadores) from public, anon, authenticated;
