-- TESTE (não é migração): desfaz o Mundial/Copa de teste da semana atual e devolve a sua conta à semana normal.
--   * Apaga a Copa/Mundial desta semana (partidas, premiação registrada e troféu vão junto) e as vagas "de teste" da sua conta.
--   * A sua liga da semana (Academy/Nacional) é recriada sozinha no próximo acesso ao jogo.
--   * Os créditos da premiação JÁ pagos não voltam; se quiser tirá-los, mude devolver_premio para true.
-- Rode no SQL Editor do Supabase. Seguro rodar de novo.

do $$
declare
  devolver_premio boolean := false;
  cal jsonb := tc_calendario();
  temp int := (cal->>'temporada')::int;
  sem int := (cal->>'semana')::int;
  adm bigint;
  cred bigint;
begin
  select o.id into adm from tc_orgs o join site_admins a on a.user_id = o.user_id order by o.id limit 1;
  if devolver_premio then
    select coalesce(sum(p.creditos), 0) into cred from tc_premios p join tc_ligas l on l.id = p.liga_id
     where l.temporada = temp and l.semana = sem and l.tipo in ('copa', 'mundial') and p.org_id = adm;
    if cred > 0 then perform tc_creditos_mexer(adm, -cred, 'ajuste_teste', null); end if;
  end if;
  delete from tc_ligas where temporada = temp and semana = sem and tipo in ('copa', 'mundial');
  delete from tc_vagas where org_id = adm and origem in ('teste', 'copa');
  raise notice 'Pronto: campeonato de teste removido. Abra o jogo para recriar a liga normal da semana.';
end;
$$;
