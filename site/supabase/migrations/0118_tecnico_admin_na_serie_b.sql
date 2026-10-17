-- Teste do campeonato: coloca a(s) conta(s) de administrador (site_admins) que já têm organização na Série B (divisão 'acesso')
-- e refaz o campeonato da semana atual para incluí-la(s). Rode no SQL Editor; é seguro rodar de novo (se a conta já estiver
-- na liga da semana, não faz nada).
--
-- O que acontece:
--   1. a organização do administrador vai para a divisão 'acesso' (Série B) e fica ativa; se a divisão passar de 8 equipes,
--      a equipe do sistema mais fraca é desativada;
--   2. se o administrador NÃO está na liga da Série B da semana: a liga da semana atual (Série B e Série A) é apagada com as suas
--      partidas e será recriada no próximo acesso ao jogo, já com a conta incluída. Se ainda estamos na primeira semana do
--      calendário, o início do calendário passa a ser HOJE, para as rodadas começarem hoje em vez de já estarem jogadas.
-- Resultados dessa semana de teste são perdidos (ninguém além de testadores usa o jogo antes do lançamento).
-- A conta precisa já ter criado a organização no jogo; sem organização, a função só avisa.

do $$
declare
  hoje date := site_hoje_br();
  ini date := ((tc_cfg('calendario'))->>'inicio')::date;
  gw int := floor((hoje - ini) / 7.0)::int;
  temp int;
  sem int;
  adm record;
  fora bigint;
  n int;
  faltando int := 0;
  total int := 0;
begin
  if hoje < ini then raise notice 'O calendário ainda não começou (início em %).', ini; return; end if;

  for adm in select o.id, o.nome from tc_orgs o join site_admins s on s.user_id = o.user_id loop
    total := total + 1;
    update tc_orgs set divisao = 'acesso', ativa = true where id = adm.id and (divisao <> 'acesso' or not ativa);
    loop
      select count(*) into n from tc_orgs where ativa and divisao = 'acesso';
      exit when n <= 8;
      select id into fora from tc_orgs where user_id is null and ativa and divisao = 'acesso' order by poder_sistema, id limit 1;
      exit when fora is null;
      update tc_orgs set ativa = false where id = fora;
    end loop;
    temp := gw / 4 + 1; sem := gw % 4 + 1;
    if not exists (select 1 from tc_liga_times t join tc_ligas l on l.id = t.liga_id
                    where t.org_id = adm.id and l.divisao = 'acesso' and l.tipo = 'divisao' and l.temporada = temp and l.semana = sem) then
      faltando := faltando + 1;
    end if;
  end loop;

  if total = 0 then raise notice 'Nenhuma conta de administrador tem organização no jogo: crie a organização primeiro.'; return; end if;
  if faltando = 0 then raise notice 'A(s) conta(s) de administrador já estão na Série B desta semana. Nada a refazer.'; return; end if;

  if gw = 0 then
    update tc_config set valor = jsonb_set(valor, '{inicio}', to_jsonb(hoje::text)) where chave = 'calendario';
    raise notice 'Primeira semana: o calendário passa a começar hoje (%).', hoje;
  end if;
  update tc_config set valor = to_jsonb(gw) where chave = 'semana_proc'; -- o servidor volta a processar esta semana (recria as ligas)
  delete from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and status = 'aberta';
  raise notice 'Liga da semana % da temporada % apagada: ela é recriada, com o administrador na Série B, quando alguém abrir o jogo.', sem, temp;
end;
$$;
