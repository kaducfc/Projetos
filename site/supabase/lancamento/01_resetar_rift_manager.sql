-- ============================================================================================================
-- RIFT MANAGER · RESET GERAL PARA O LANÇAMENTO  (DESTRUTIVO: não dá para desfazer depois do COMMIT)
-- ------------------------------------------------------------------------------------------------------------
-- O que APAGA:
--   * a organização (time) de TODAS as contas, inclusive administradores, com tudo que pende dela:
--     jogadores, Legados e cópias, estrelas, treino, maestria, baús e garantias, baú grátis, finanças,
--     marketing e patrocínios, avisos, anúncios no mercado, troféus, premiações, vagas, histórico e fama;
--   * todas as ligas, partidas, resultados de mapas, picks/bans e amistosos (o calendário recomeça do zero:
--     as ligas são criadas de novo pelo próprio jogo quando alguém entra);
--   * os jogadores fictícios que ficaram livres no mercado depois de passar por uma conta de teste.
-- O que NÃO mexe:
--   * as contas (login, e-mail, senha, perfil do site) e quem é administrador;
--   * as Rift Coins (RC) e a carteira do site;
--   * o PDR/Rank do site e o histórico de PDR;
--   * o catálogo de Legados, o catálogo de campeões, a configuração do jogo e as equipes do sistema.
-- Tudo roda numa transação: se qualquer comando falhar, NADA é apagado.
-- Como usar: rode o bloco inteiro no SQL Editor do Supabase. No fim ele mostra uma tabela de conferência.
-- ============================================================================================================
begin;

-- Resultados e lados dos mapas jogados ligam à organização sem apagar sozinhos: saem primeiro.
delete from public.tc_gameplay_mapas;
delete from public.tc_gameplay_lados;
delete from public.tc_gameplay_drafts;

-- Competições e amistosos (o jogo recria as ligas da semana quando um técnico entra).
delete from public.tc_ligas;
delete from public.tc_amistosos;
delete from public.tc_trofeus;
delete from public.tc_premios;
delete from public.tc_vagas;
delete from public.tc_fama_eventos;
delete from public.tc_snap_dia;
delete from public.tc_mercado_rot;

-- Jogadores fictícios que passaram por uma conta e voltaram livres ao mercado (vieram do elenco inicial, de uma
-- liberação ou de uma venda): saem junto, para o mercado também recomeçar do zero.
delete from public.tc_jogadores j
 where j.ficticio and j.org_id is null
   and exists (select 1 from public.tc_transf t
                where t.jogador_id = j.id
                  and (t.para_org in (select id from public.tc_orgs where user_id is not null)
                       or t.de_org in (select id from public.tc_orgs where user_id is not null)));

-- Jogadores, Legados e cópias que estão nos times dos técnicos (primeiro eles: o time sem organização não pode ter vaga).
delete from public.tc_jogadores where org_id in (select id from public.tc_orgs where user_id is not null);

-- A organização de cada conta. A cascata leva: treinos, maestria, baús, garantias, finanças, marketing, patrocínios,
-- avisos, anúncios e ofertas no mercado, participação em ligas e o resto que depende do time.
delete from public.tc_orgs where user_id is not null;

-- Extrato financeiro (inclusive o das equipes do sistema, que recebiam premiação nas ligas de teste).
delete from public.tc_fin;

-- Avisos (sino) de todos os times, inclusive os das equipes do sistema.
delete from public.tc_avisos;

-- Marcador de "até que semana o jogo já processou": sem ele o calendário recomeça na semana atual
-- (com o marcador antigo o jogo tentaria reprocessar as semanas dos testes antes de criar a liga nova).
delete from public.tc_config where chave = 'semana_proc';

-- Baú grátis de 3 em 3 dias: todo mundo volta a ter o primeiro disponível.
delete from public.tc_bau_gratis;

-- Equipes do sistema: voltam à forma e à experiência iniciais (jogaram só contra as contas de teste).
update public.tc_jogadores set forma = 50, exp = 0
 where org_id in (select id from public.tc_orgs where user_id is null);

commit;

-- Conferência: tudo isto deve mostrar 0 nas linhas "deve ser 0".
select 'técnicos com time (deve ser 0)' as conferencia, count(*)::text as valor from public.tc_orgs where user_id is not null
union all select 'jogadores em time de técnico (deve ser 0)', count(*)::text from public.tc_jogadores j join public.tc_orgs o on o.id = j.org_id where o.user_id is not null
union all select 'ligas (deve ser 0)', count(*)::text from public.tc_ligas
union all select 'partidas (deve ser 0)', count(*)::text from public.tc_partidas
union all select 'amistosos (deve ser 0)', count(*)::text from public.tc_amistosos
union all select 'baús abertos (deve ser 0)', count(*)::text from public.tc_gacha
union all select 'marketing (deve ser 0)', count(*)::text from public.tc_marketing
union all select 'contas do site (continuam)', count(*)::text from auth.users
union all select 'equipes do sistema (continuam)', count(*)::text from public.tc_orgs where user_id is null
union all select 'Legados no catálogo (continuam)', count(*)::text from public.tc_jogadores where org_id is null and not ficticio;
