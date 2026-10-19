-- TESTE (não é migração): depois de jogar e REGISTRAR a final do Mundial de teste, encerra o Campeonato Mundial como o sistema faz no fim da semana 4:
-- premiação em créditos, troféu "Campeão · Campeonato Mundial", fama e aviso.
-- Atenção: paga a premiação de verdade na sua conta (1º lugar = 1.000.000 créditos) e, se a Rank estiver ativa, lança o PDR do Mundial.
-- Só encerra se a final já estiver concluída. Pode rodar de novo: um Mundial já encerrado é ignorado.

do $$
declare
  lid bigint;
begin
  select l.id into lid from tc_ligas l
   where l.tipo = 'mundial' and l.status = 'aberta'
     and exists (select 1 from tc_partidas p where p.liga_id = l.id and p.fase = 'final' and p.status = 'concluida')
   order by l.id desc limit 1;
  if lid is null then raise notice 'Nenhum Mundial aberto com a final concluída. Registre o resultado da final primeiro.'; return; end if;
  perform tc_encerrar_internacional(lid);
  raise notice 'Mundial % encerrado: premiação, troféu e fama entregues.', lid;
end;
$$;

select l.nome, l.status, p.posicao, o.nome as time, p.creditos
  from tc_premios p join tc_ligas l on l.id = p.liga_id join tc_orgs o on o.id = p.org_id
 where l.tipo = 'mundial' order by l.id desc, p.posicao limit 8;
