-- TESTE (não é migração): coloca a conta de ADMINISTRADOR na Copa Internacional ou no Campeonato Mundial da semana atual.
--   * Edite as duas linhas "alvo_tipo" e "alvo_fase" logo abaixo do "declare":
--       alvo_tipo = 'copa' ou 'mundial'
--       alvo_fase = 'grupos' (todos os jogos da fase de pontos / do treino e dos grupos, marcados para hoje)
--                   'quartas' (só Mundial), 'semi' ou 'final' (as fases anteriores já aparecem jogadas, com vitória sua)
--   * O campeonato tem 16 equipes: você e 15 equipes do sistema. Os jogos que são do sistema contra o sistema são simulados.
--   * Você joga a(s) partida(s) de hoje em "Jogar a partida" no Início. Depois de jogar, rode admin_internacional_avancar.sql:
--     ele joga a fase seguinte do sistema, cria a próxima fase para hoje e, depois da final, premia e encerra o campeonato.
-- Rode no SQL Editor do Supabase. Pode rodar de novo: o campeonato de teste é recriado do zero (créditos já pagos não voltam).
-- Só funciona se a sua conta for o único técnico real do campeonato; se houver outro técnico com vaga, avisa e não faz nada.

create or replace function pg_temp.rk(f text)
returns int language sql immutable as $f$
  select case f when 'treino' then 0 when 'rodada' then 1 when 'quartas' then 2 when 'semi' then 3 else 4 end;
$f$;

-- Dá a vitória ao administrador numa partida dele (placar da série completo, 0 para o adversário).
create or replace function pg_temp.vencer(pid bigint, adm bigint)
returns void language plpgsql as $f$
declare p tc_partidas; nec int;
begin
  select * into p from tc_partidas where id = pid;
  nec := (p.formato + 1) / 2;
  update tc_partidas set status = 'concluida', vencedor = adm,
         placar_a = case when org_a = adm then nec else 0 end, placar_b = case when org_b = adm then nec else 0 end,
         resumo = '{"origem": "teste"}'::jsonb, processada = now() where id = pid;
end;
$f$;

-- Conclui o que vem antes da fase-alvo (suas partidas: vitória; as do sistema: simuladas) e cria as fases seguintes até chegar nela.
create or replace function pg_temp.empurrar(lid bigint, alvo int, adm bigint)
returns void language plpgsql as $f$
declare p record; i int;
begin
  for i in 1..12 loop
    for p in select id, pov from tc_partidas where liga_id = lid and status = 'agendada' and pg_temp.rk(fase) < alvo order by id loop
      if p.pov = adm then perform pg_temp.vencer(p.id, adm); else perform tc_processar_partida(p.id); end if;
    end loop;
    exit when not tc_avancar(lid);
  end loop;
end;
$f$;

do $$
declare
  alvo_tipo text := 'mundial';
  alvo_fase text := 'final';
  cal jsonb := tc_calendario();
  temp int := (cal->>'temporada')::int;
  sem int := (cal->>'semana')::int;
  hoje date := site_hoje_br();
  ini date := ((tc_cfg('calendario'))->>'inicio')::date + (cal->>'gw')::int * 7;
  adm bigint;
  lid bigint;
  alvo int;
begin
  if alvo_tipo not in ('copa', 'mundial') or alvo_fase not in ('grupos', 'quartas', 'semi', 'final') or (alvo_tipo = 'copa' and alvo_fase = 'quartas') then
    raise exception 'alvo_tipo/alvo_fase inválidos';
  end if;
  select o.id into adm from tc_orgs o join site_admins a on a.user_id = o.user_id order by o.id limit 1;
  if adm is null then raise exception 'A conta de administrador precisa ter criado a organização no jogo.'; end if;
  alvo := case alvo_fase when 'grupos' then 0 when 'quartas' then 2 when 'semi' then 3 else 4 end;
  delete from tc_ligas where temporada = temp and semana = sem and tipo = alvo_tipo;
  delete from tc_ligas where temporada = temp and semana = sem and tipo = 'divisao' and dono_org = adm; -- na semana do campeonato você não joga a liga
  insert into tc_vagas (org_id, temporada, tipo, origem) values (adm, temp, alvo_tipo, 'teste') on conflict do nothing;
  perform tc_garantir_sistema();
  lid := case alvo_tipo when 'copa' then tc_criar_copa(temp, sem, ini) else tc_criar_mundial(temp, sem, ini) end;
  if lid is null then raise exception 'Não foi possível criar o campeonato.'; end if;
  if (select count(*) from tc_liga_times t join tc_orgs o on o.id = t.org_id where t.liga_id = lid and o.user_id is not null) <> 1 then
    raise exception 'Há outro técnico real com vaga neste campeonato: o teste só funciona com a sua conta sozinha.';
  end if;
  perform pg_temp.empurrar(lid, alvo, adm);
  update tc_partidas set dia = hoje where liga_id = lid and status = 'agendada' and pg_temp.rk(fase) >= alvo;
  update tc_partidas set dia = hoje where liga_id = lid and status = 'concluida' and dia > hoje; -- fases já "jogadas" não ficam com data no futuro (as Notícias usam a última partida concluída)
  raise notice 'Pronto: % criado (liga %). Jogue as partidas de hoje em "Jogar a partida" e depois rode admin_internacional_avancar.sql.', alvo_tipo, lid;
end;
$$;
