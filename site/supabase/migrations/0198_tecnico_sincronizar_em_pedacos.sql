-- Rift Manager: abrir o jogo dava "canceling statement due to statement timeout" (e ficava lento).
-- Todo dia há partidas de todos os técnicos para processar (e ligas novas para criar), e o primeiro a abrir pagava tudo numa
-- chamada só. Com o número de contas crescendo isso passou do tempo limite do servidor (8 s): a chamada era desfeita por
-- inteiro e a próxima conta tentava o mesmo trabalho de novo, sem nunca terminar.
-- Agora tc_sincronizar() trabalha com um orçamento de tempo (5 s): faz o que couber, grava, e devolve "parcial": true;
-- quem chamar depois continua de onde parou (as partidas e ligas já feitas não se repetem). O jogo chama de novo
-- em segundo plano até acabar. Rodar depois da 0197. Idempotente.
do $$
declare
  def text;
  f constant text := 'public.tc_sincronizar()';
  g constant text := 'public.tc_criar_ligas_semana(int, int, date)';
begin
  if to_regprocedure(f) is null or to_regprocedure(g) is null then
    raise exception 'não achei tc_sincronizar / tc_criar_ligas_semana';
  end if;

  def := pg_get_functiondef(to_regprocedure(f));
  if position('t_lim' in def) = 0 then
    def := replace(def, 'av1 boolean; av2 boolean; av3 boolean; av4 boolean;',
      E'av1 boolean; av2 boolean; av3 boolean; av4 boolean;\n  t_lim timestamptz := clock_timestamp() + make_interval(secs => coalesce(nullif(current_setting(''tc.sinc_orcamento'', true), '''')::numeric, 5));\n  parcial boolean := false;');
    -- a criação das ligas também respeita o orçamento (lê o limite daqui)
    if position('perform tc_criar_ligas_semana(temp, sem, ini);' in def) = 0 then raise exception 'não achei a criação das ligas'; end if;
    def := replace(def, 'perform tc_criar_ligas_semana(temp, sem, ini);',
      E'perform set_config(''tc.limite'', t_lim::text, true);\n    perform set_config(''tc.parcial'', '''', true);\n    perform tc_criar_ligas_semana(temp, sem, ini);\n    if coalesce(current_setting(''tc.parcial'', true), '''') = ''1'' then parcial := true; exit; end if;');
    if position('if tc_processar_partida(p.id) then feitas := feitas + 1; end if;' in def) = 0 then raise exception 'não achei o processamento das partidas'; end if;
    def := replace(def, 'if tc_processar_partida(p.id) then feitas := feitas + 1; end if;',
      E'if tc_processar_partida(p.id) then feitas := feitas + 1; end if;\n        if clock_timestamp() > t_lim then parcial := true; exit; end if;');
    if position('av1 := tc_avancar_internacionais(temp, sem); av2 := false;' in def) = 0 then raise exception 'não achei o avanço das chaves'; end if;
    def := replace(def, 'av1 := tc_avancar_internacionais(temp, sem); av2 := false;',
      E'exit when parcial;\n      av1 := tc_avancar_internacionais(temp, sem); av2 := false;');
    if position('select count(*) into pend from tc_partidas' in def) = 0 then raise exception 'não achei a contagem de pendentes'; end if;
    def := replace(def, 'select count(*) into pend from tc_partidas',
      E'if parcial then exit; end if;\n    select count(*) into pend from tc_partidas');
    if position('jsonb_build_object(''processadas'', feitas,' in def) = 0 then raise exception 'não achei o retorno'; end if;
    def := replace(def, 'jsonb_build_object(''processadas'', feitas,', 'jsonb_build_object(''parcial'', parcial, ''processadas'', feitas,');
    execute def;
  end if;

  def := pg_get_functiondef(to_regprocedure(g));
  if position('tc.limite' in def) = 0 then
    if position('perform tc_criar_liga_privada(temp, sem, o.id, ini);' in def) = 0 then raise exception 'não achei a criação da liga privada'; end if;
    -- só conta no orçamento quando uma liga é realmente criada (quem já tem liga é pulado sem custo)
    def := replace(def, 'perform tc_criar_liga_privada(temp, sem, o.id, ini);',
      E'if not exists (select 1 from tc_ligas l where l.temporada = temp and l.semana = sem and l.tipo = ''divisao'' and l.dono_org = o.id and l.divisao = (select divisao from tc_orgs where id = o.id)) then\n      perform tc_criar_liga_privada(temp, sem, o.id, ini);\n      if clock_timestamp() > coalesce(nullif(current_setting(''tc.limite'', true), '''')::timestamptz, ''infinity'') then perform set_config(''tc.parcial'', ''1'', true); exit; end if;\n    end if;');
    execute def;
  end if;
end $$;
