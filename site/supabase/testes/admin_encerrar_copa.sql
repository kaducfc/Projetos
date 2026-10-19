-- TESTE (não é migração): depois de jogar e REGISTRAR a final da Copa Internacional de teste (admin_final_da_copa.sql),
-- encerra a Copa como o sistema faz no fim da semana 2: premiação em créditos, troféu "Campeão · Copa Internacional", fama e aviso.
-- Atenção: isso paga a premiação de verdade na sua conta (1º lugar = 300.000 créditos) e, se a Rank estiver ativa, lança o PDR da Copa.
-- Só encerra se a final já estiver concluída. Pode rodar de novo: uma Copa já encerrada é ignorada.

do $$
declare
  lid bigint;
begin
  select l.id into lid from tc_ligas l
   where l.tipo = 'copa' and l.status = 'aberta'
     and exists (select 1 from tc_partidas p where p.liga_id = l.id and p.fase = 'final' and p.status = 'concluida')
   order by l.id desc limit 1;
  if lid is null then raise notice 'Nenhuma Copa aberta com a final concluída. Registre o resultado da final primeiro.'; return; end if;
  perform tc_encerrar_internacional(lid);
  raise notice 'Copa % encerrada: premiação, troféu e fama entregues.', lid;
end;
$$;

select l.nome, l.status, p.posicao, o.nome as time, p.creditos
  from tc_premios p join tc_ligas l on l.id = p.liga_id join tc_orgs o on o.id = p.org_id
 where l.tipo = 'copa' order by l.id desc, p.posicao limit 8;
