-- Rift Manager: o Potencial de um Legado (jogador real) é o limite de treino dele: OVR com que ele veio + 15 (no máximo 100).
-- Rodar depois da 0193. Rodar de novo é seguro.
--
-- Antes o Potencial dos Legados vinha de uma tabela própria e podia ficar bem abaixo do que o treino permite (o Vulcan veio com OVR 74 e Potencial 80,
-- só +6, apesar de poder subir até +15). Agora o Potencial do Legado acompanha o teto do Treinamento: poder_inicial + bônus de estrela (15), no máximo 100,
-- nunca abaixo do Poder atual. Vale para os Legados da loja e para as cópias que já estão nas organizações; os preços (que dependem do Potencial) sobem junto.
-- Jogador comum (fictício) continua como na 0113.

create or replace function public.tc_potencial_ajustado(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select case
    when not j.ficticio then greatest(round(tc_poder(j))::int, tc_treino_limite(j))
    else greatest(round(tc_poder(j))::int, least(j.potencial, tc_treino_limite(j)))
  end;
$$;
revoke all on function public.tc_potencial_ajustado(tc_jogadores) from public, anon, authenticated;

-- Os Legados (e as cópias deles) passam a ter o Potencial novo.
update public.tc_jogadores j set potencial = tc_potencial_ajustado(j) where not j.ficticio and j.potencial <> tc_potencial_ajustado(j);

-- O gatilho de jogador novo (0113) só ajustava quem ficava acima do limite; para Legado agora iguala ao limite.
