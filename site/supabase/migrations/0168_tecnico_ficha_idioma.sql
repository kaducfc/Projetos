-- Simulador de Técnico: a ficha do jogador passa a trazer os idiomas dele (nativo e secundários) para a tela mostrar. Rode depois do 0167. Idempotente.
-- Só recria tc_jogador_json acrescentando 'idioma' ({nativo, sec, pais}); o resto da função é igual ao do 0152.

create or replace function public.tc_jogador_json(j tc_jogadores, ver_pot boolean default true)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p double precision := tc_poder(j);
  cfg jsonb := tc_cfg('estrelas_jogador');
  legado boolean := not j.ficticio;
begin
  return jsonb_build_object(
    'id', j.id, 'nome', j.nome, 'ficticio', j.ficticio, 'genero', j.genero, 'pos', j.pos, 'pos2', to_jsonb(j.pos2),
    'idade', j.idade, 'regiao', j.regiao, 'retrato', j.retrato, 'idioma', tc_idiomas_do(j),
    'mec', j.mec, 'rotas', j.rotas, 'macro', j.macro, 'tf', j.tf, 'mental', j.mental, 'fama', j.fama,
    'potencial', case when ver_pot then j.potencial else null end,
    'forma', j.forma, 'exp', j.exp, 'poder', round(p)::int,
    'org_id', j.org_id, 'slot', j.slot, 'salario', j.salario, 'contrato_fim', j.contrato_fim,
    'preco', tc_preco(p, j.potencial, j.fama, j.idade),
    'estrela', legado, 'legado', legado,
    'raridade', j.raridade,
    'estrelas', j.estrelas, 'copias', j.copias, 'bonus_estrelas_pct', j.estrelas * (cfg->>'bonus_pct')::int,
    'estrela_max', (cfg->>'max')::int,
    'estrela_custo', case when j.estrelas >= (cfg->>'max')::int then null
                          when legado then j.estrelas + 1
                          else tc_estrela_custo_frag(j) end,
    'estrela_custo_copias', case when legado and j.estrelas < (cfg->>'max')::int then j.estrelas + 1 else null end,
    'estrela_custo_frag', case when j.estrelas < (cfg->>'max')::int then tc_estrela_custo_frag(j) else null end,
    'frag_base', tc_frag_base(j), 'frag_gastos', j.frag_gastos,
    'frag_demissao', tc_fragmentos_demissao(j),
    'contrato_ativo', tc_contrato_ativo(j), 'contrato_restante', tc_contrato_restante(j), 'contrato_opcoes', tc_contrato_opcoes(j),
    'contrato_valor_semana', j.contrato_valor_semana, 'reembolso_contrato', tc_reembolso_contrato(j),
    'estrela_tipo', case when legado then 'copias' else 'fragmentos' end,
    'preco_rc', tc_estrela_preco_rc(j),
    'venda_rc', case when j.ficticio then null else coalesce(((tc_cfg('estrelas'))->>'venda_rc')::boolean, false) end);
end;
$$;
revoke all on function public.tc_jogador_json(tc_jogadores, boolean) from public, anon, authenticated;
