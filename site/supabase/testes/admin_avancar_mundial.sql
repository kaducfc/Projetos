-- TESTE (não é migração): avança a chave do Mundial de teste (admin_mundial_quartas.sql) depois que você REGISTROU o resultado da sua partida.
--   * Cria a fase seguinte (semifinais, depois a final) e marca para HOJE.
--   * As partidas entre duas equipes do sistema já ficam jogadas (vence a equipe de maior Poder); a sua fica agendada para você jogar.
--   * Rode de novo depois de cada partida sua. Se você for eliminado, ele joga o resto da chave até a final.
--   * Quando a final estiver concluída, rode admin_encerrar_mundial.sql.

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
  lid bigint;
  hoje date := site_hoje_br();
  m record;
  mudou boolean;
  i int;
begin
  select id into lid from tc_ligas where tipo = 'mundial' and status = 'aberta' order by id desc limit 1;
  if lid is null then raise notice 'Nenhum Mundial aberto. Rode admin_mundial_quartas.sql primeiro.'; return; end if;
  for i in 1..6 loop
    -- partidas só entre equipes do sistema: já jogadas
    for m in select p.* from tc_partidas p where p.liga_id = lid and p.status = 'agendada'
                and not exists (select 1 from tc_orgs o where o.id in (p.org_a, p.org_b) and o.user_id is not null) loop
      perform pg_temp.concluir(m.id, case when tc_poder_org(m.org_a) >= tc_poder_org(m.org_b) then m.org_a else m.org_b end);
    end loop;
    mudou := tc_avancar(lid);
    if mudou then update tc_partidas set dia = hoje where liga_id = lid and status = 'agendada'; end if;
    exit when not mudou;
  end loop;
  raise notice 'Chave do Mundial avançada. Veja a sua próxima partida no Início.';
end;
$$;

select p.fase, p.dia, p.status, oa.nome as time_a, ob.nome as time_b, w.nome as vencedor
  from tc_partidas p join tc_orgs oa on oa.id = p.org_a join tc_orgs ob on ob.id = p.org_b left join tc_orgs w on w.id = p.vencedor
 where p.liga_id = (select max(id) from tc_ligas where tipo = 'mundial') order by p.id;
