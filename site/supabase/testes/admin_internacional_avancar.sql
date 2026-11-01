-- TESTE (não é migração): avança a Copa ou o Mundial de teste da semana atual depois que você jogou e REGISTROU as partidas de hoje.
--   * Joga as partidas do sistema da fase atual, cria a próxima fase (quartas, semifinais ou final) para hoje e deixa a sua partida pendente.
--   * Depois da final registrada, premia (créditos, troféu, fama, vaga no Mundial para o campeão da Copa) e encerra o campeonato.
--   * Se ainda existir partida sua pendente, não faz nada (jogue-a primeiro). Pode rodar de novo à vontade.
-- Rode no SQL Editor do Supabase.

do $$
declare
  cal jsonb := tc_calendario();
  temp int := (cal->>'temporada')::int;
  sem int := (cal->>'semana')::int;
  hoje date := site_hoje_br();
  adm bigint;
  l tc_ligas;
  p record;
  i int;
  nec int;
begin
  select o.id into adm from tc_orgs o join site_admins a on a.user_id = o.user_id order by o.id limit 1;
  for l in select * from tc_ligas where temporada = temp and semana = sem and tipo in ('copa', 'mundial') and status = 'aberta' loop
    if exists (select 1 from tc_partidas where liga_id = l.id and status = 'agendada' and pov = adm) then
      raise notice '%: jogue primeiro a sua partida pendente.', l.nome;
      continue;
    end if;
    for i in 1..12 loop
      for p in select id from tc_partidas where liga_id = l.id and status = 'agendada' and pov is null order by id loop
        perform tc_processar_partida(p.id);
      end loop;
      exit when exists (select 1 from tc_partidas where liga_id = l.id and status = 'agendada' and pov = adm);
      exit when not tc_avancar(l.id);
      update tc_partidas set dia = hoje where liga_id = l.id and status = 'agendada';
    end loop;
    update tc_partidas set dia = hoje where liga_id = l.id and status = 'concluida' and dia > hoje;
    if tc_internacional_completo(l.id) then
      perform tc_encerrar_internacional(l.id);
      raise notice '%: encerrado (premiação, troféu e fama pagos).', l.nome;
    else
      raise notice '%: próxima fase criada para hoje.', l.nome;
    end if;
  end loop;
end;
$$;
