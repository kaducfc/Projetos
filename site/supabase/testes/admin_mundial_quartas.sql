-- TESTE (não é migração): coloca a conta de ADMINISTRADOR no Campeonato Mundial, nas QUARTAS DE FINAL, marcadas para HOJE.
--   * Cria (ou refaz) o Mundial da semana atual com 6 times: você (semente 3) e as 5 equipes do sistema mais fortes da Liga Nacional.
--   * Quartas: você (3º) x 6º colocado, jogo de hoje. A outra quarta (4º x 5º) já aparece jogada. Os 1º e 2º entram direto nas semifinais.
--   * Jogue a partida em "Jogar a partida" no Início. Depois de REGISTRAR cada resultado, rode admin_avancar_mundial.sql: ele cria a fase seguinte
--     para hoje (semifinal, depois final), já deixando jogadas as partidas entre equipes do sistema.
--   * Ao registrar a final, rode admin_encerrar_mundial.sql (premiação, troféu e fama).
-- Rode no SQL Editor do Supabase. Pode rodar de novo: o Mundial de teste é recriado do zero.
-- Só mexe em um Mundial que tenha apenas o administrador como técnico real; se houver outro técnico real, avisa e não faz nada.

create or replace function pg_temp.concluir(pid bigint, ganhador bigint)
returns void language plpgsql as $f$
declare p tc_partidas; perde int := 1;
begin
  select * into p from tc_partidas where id = pid;
  update tc_partidas set status = 'concluida', vencedor = ganhador,
         placar_a = case when org_a = ganhador then (p.formato + 1) / 2 else perde end,
         placar_b = case when org_b = ganhador then (p.formato + 1) / 2 else perde end,
         resumo = '{"origem": "teste"}'::jsonb, processada = now() where id = pid;
end;
$f$;

do $$
declare
  cal jsonb := tc_calendario();
  temp int := (cal->>'temporada')::int;
  sem int := (cal->>'semana')::int;
  hoje date := site_hoje_br();
  adm bigint;
  lid bigint;
  s bigint[];
  nome_ text := (tc_cfg('nomes'))->>'mundial' || ' · S' || (cal->>'temporada');
  outros int;
  pid bigint;
begin
  select o.id into adm from tc_orgs o join site_admins a on a.user_id = o.user_id order by o.id limit 1;
  if adm is null then raise exception 'Nenhuma organização de administrador encontrada.'; end if;
  select array_agg(id) into s from (
    select id from tc_orgs where user_id is null and ativa and divisao = 'principal' order by poder_sistema desc, id limit 5) q;
  if coalesce(array_length(s, 1), 0) < 5 then raise exception 'Faltam equipes do sistema ativas na Liga Nacional.'; end if;

  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'mundial';
  if lid is not null then
    select count(*) into outros from tc_liga_times t join tc_orgs o on o.id = t.org_id where t.liga_id = lid and o.user_id is not null and o.id <> adm;
    if outros > 0 then raise notice 'O Mundial desta semana tem outros técnicos reais; nada foi alterado.'; return; end if;
    delete from tc_partidas where liga_id = lid;
    delete from tc_liga_times where liga_id = lid;
    delete from tc_premios where liga_id = lid;
    delete from tc_trofeus where liga_id = lid;
    update tc_ligas set status = 'aberta', encerrada_em = null, nome = nome_ where id = lid;
  else
    insert into tc_ligas (temporada, semana, divisao, tipo, nome) values (temp, sem, 'principal', 'mundial', nome_) returning id into lid;
  end if;

  -- sementes: 1 e 2 (sistema), 3 você, 4, 5 e 6 (sistema)
  insert into tc_liga_times (liga_id, org_id, semente) values (lid, s[1], 1), (lid, s[2], 2), (lid, adm, 3), (lid, s[3], 4), (lid, s[4], 5), (lid, s[5], 6);
  -- quartas: você (3º) x 6º hoje; 4º x 5º já jogada (o 4º vence)
  insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato) values (lid, 'quartas', 1, hoje, least(adm, s[5]), greatest(adm, s[5]), 5);
  insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato) values (lid, 'quartas', 1, hoje, least(s[3], s[4]), greatest(s[3], s[4]), 5) returning id into pid;
  perform pg_temp.concluir(pid, s[3]);

  raise notice 'Pronto: as quartas do % estão marcadas para hoje. Jogue no Início e depois rode admin_avancar_mundial.sql.', nome_;
end;
$$;

select l.nome, p.fase, p.dia, p.status, oa.nome as time_a, ob.nome as time_b
  from tc_partidas p join tc_ligas l on l.id = p.liga_id join tc_orgs oa on oa.id = p.org_a join tc_orgs ob on ob.id = p.org_b
 where l.tipo = 'mundial' and l.id = (select max(id) from tc_ligas where tipo = 'mundial') order by p.id;
