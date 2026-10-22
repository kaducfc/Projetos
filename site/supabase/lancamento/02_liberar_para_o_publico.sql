-- ============================================================================================================
-- RIFT MANAGER · LIBERAR PARA O PÚBLICO  (rode SÓ no dia do lançamento, depois do reset 01 e do deploy do site)
-- ------------------------------------------------------------------------------------------------------------
--   * abre o jogo para qualquer conta logada (hoje só administradores e convidados entram);
--   * liga o PDR no Rank do site (vitória +5, derrota +3 nas partidas que contam);
--   * liga o jogo no mapa (gameplay) para as partidas dos técnicos;
--   * coloca o início do calendário na segunda-feira desta semana: a Semana 1 e a Temporada 1 contam a partir daqui.
-- É seguro rodar de novo. Para fechar de novo: tc_config 'aberto' = false.
-- ============================================================================================================
begin;

update public.tc_config set valor = 'true'::jsonb where chave = 'aberto';
update public.tc_config set valor = 'true'::jsonb where chave = 'rank_ativo';
update public.tc_config set valor = jsonb_set(valor, '{ativo}', 'true') where chave = 'gameplay';
update public.tc_config
   set valor = jsonb_set(valor, '{inicio}', to_jsonb(date_trunc('week', site_hoje_br()::timestamp)::date::text))
 where chave = 'calendario';

commit;

select chave, valor from public.tc_config where chave in ('aberto', 'rank_ativo', 'gameplay', 'calendario', 'rank_partida') order by chave;
