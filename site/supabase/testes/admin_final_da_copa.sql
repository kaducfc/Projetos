-- TESTE (não é migração): coloca a conta de ADMINISTRADOR na FINAL da Copa Internacional, marcada para HOJE, para você jogar e conferir o fluxo.
--   * Cria (ou refaz) a Copa Internacional da semana atual com 4 times: a sua organização e as 3 equipes do sistema mais fortes da Liga Nacional.
--   * As duas semifinais já aparecem como jogadas (você venceu a sua) e a FINAL (melhor de 5) fica agendada para hoje contra a equipe do sistema mais forte.
--   * Jogue a final em "Jogar a partida" no Início. Depois de registrar o resultado, rode o arquivo admin_encerrar_copa.sql
--     para entregar premiação, troféu e fama (é o que o sistema faz sozinho no fim da semana 2).
-- Rode no SQL Editor do Supabase. Pode rodar de novo: a Copa de teste é recriada do zero.
-- Só mexe em uma Copa que tenha apenas o administrador como técnico real; se houver outro técnico real nela, avisa e não faz nada.

do $$
declare
  cal jsonb := tc_calendario();
  temp int := (cal->>'temporada')::int;
  sem int := (cal->>'semana')::int;
  hoje date := site_hoje_br();
  adm bigint;
  lid bigint;
  sis bigint[];
  nome_ text := (tc_cfg('nomes'))->>'copa' || ' · S' || (cal->>'temporada');
  outros int;
begin
  select o.id into adm from tc_orgs o join site_admins a on a.user_id = o.user_id order by o.id limit 1;
  if adm is null then raise exception 'Nenhuma organização de administrador encontrada.'; end if;
  select array_agg(id) into sis from (
    select id from tc_orgs where user_id is null and ativa and divisao = 'principal' order by poder_sistema desc, id limit 3) s;
  if coalesce(array_length(sis, 1), 0) < 3 then raise exception 'Faltam equipes do sistema ativas na Liga Nacional.'; end if;

  select id into lid from tc_ligas where temporada = temp and semana = sem and tipo = 'copa';
  if lid is not null then
    select count(*) into outros from tc_liga_times t join tc_orgs o on o.id = t.org_id where t.liga_id = lid and o.user_id is not null and o.id <> adm;
    if outros > 0 then raise notice 'A Copa desta semana tem outros técnicos reais; nada foi alterado.'; return; end if;
    delete from tc_partidas where liga_id = lid;
    delete from tc_liga_times where liga_id = lid;
    delete from tc_premios where liga_id = lid;
    delete from tc_trofeus where liga_id = lid;
    update tc_ligas set status = 'aberta', encerrada_em = null, nome = nome_ where id = lid;
  else
    insert into tc_ligas (temporada, semana, divisao, tipo, nome) values (temp, sem, 'principal', 'copa', nome_) returning id into lid;
  end if;

  insert into tc_liga_times (liga_id, org_id, semente) values (lid, adm, 1), (lid, sis[1], 2), (lid, sis[2], 3), (lid, sis[3], 4);

  -- semifinais já jogadas: ADM 3x1 no 4º; 2º 3x2 no 3º (placar sempre do menor id para o maior, como a tabela guarda)
  insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato, status, placar_a, placar_b, vencedor, resumo, processada)
  values
    (lid, 'semi', 1, hoje - 1, least(adm, sis[3]), greatest(adm, sis[3]), 5, 'concluida',
       case when adm < sis[3] then 3 else 1 end, case when adm < sis[3] then 1 else 3 end, adm, '{"origem": "teste"}'::jsonb, now()),
    (lid, 'semi', 1, hoje - 1, least(sis[1], sis[2]), greatest(sis[1], sis[2]), 5, 'concluida',
       case when sis[1] < sis[2] then 3 else 2 end, case when sis[1] < sis[2] then 2 else 3 end, sis[1], '{"origem": "teste"}'::jsonb, now());
  -- a final de hoje
  insert into tc_partidas (liga_id, fase, rodada, dia, org_a, org_b, formato)
  values (lid, 'final', 2, hoje, least(adm, sis[1]), greatest(adm, sis[1]), 5);

  raise notice 'Pronto: a final da % está marcada para hoje (% x %). Jogue no Início e depois rode admin_encerrar_copa.sql.', nome_, adm, sis[1];
end;
$$;

select l.nome, p.fase, p.dia, p.status, oa.nome as time_a, ob.nome as time_b, p.formato
  from tc_partidas p join tc_ligas l on l.id = p.liga_id join tc_orgs oa on oa.id = p.org_a join tc_orgs ob on ob.id = p.org_b
 where l.tipo = 'copa' and l.id = (select max(id) from tc_ligas where tipo = 'copa') order by p.id;
