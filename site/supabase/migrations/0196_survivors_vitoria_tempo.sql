-- Rift Survivors: a vitória não estava sendo contada na ranqueada.
-- O chefe final só aparece no fim do tempo do reino (10 min; 15 em Ixtal) e a vitória vem ao derrotá-lo,
-- então o tempo da partida vencida é sempre MAIOR que isso (ex.: 10:48). A 0188 recusava qualquer tempo
-- acima do tempo do reino + 5 s, e a partida ficava sem PDR (e sem usar a vaga do dia).
-- Aqui o limite passa a ser 2 h (modo infinito) e as partidas de HOJE que ficaram para trás são refeitas.
-- Idempotente: pode rodar de novo.

do $$
declare
  def text;
  f constant text := 'public.site_ranked_registrar()';
  velho constant text := 'if tempo > max_t + 5 then return new; end if;';
  novo constant text := 'if tempo > 7200 then return new; end if;';
begin
  if to_regprocedure(f) is null then
    raise exception 'não achei site_ranked_registrar (rode a 0188 antes)';
  end if;
  def := pg_get_functiondef(to_regprocedure(f));
  if position(novo in def) = 0 then
    if position(velho in def) = 0 then
      raise exception 'não achei o limite de tempo do Survivors em site_ranked_registrar';
    end if;
    execute replace(def, velho, novo);
  end if;
end $$;

-- Refaz as partidas de hoje que foram recusadas: o resultado é regravado (mesmo dia e hora) e o gatilho
-- roda de novo, agora aceitando o tempo. Só partidas com vaga de hoje ainda não usada.
do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select g.* from site_game_results g
     where g.game_id = 'survivors'
       and (g.summary->>'ranked') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and (g.summary->>'tempo') ~ '^[0-9]{1,4}$'
       and exists (select 1 from site_ranked_inicios i
                    where i.id = (g.summary->>'ranked')::uuid and i.user_id = g.user_id
                      and i.jogo = 'survivors' and i.dia = site_hoje_br() and i.usado_em is null)
     order by g.played_at
  loop
    delete from site_game_results where id = r.id;
    insert into site_game_results (user_id, game_id, score, summary, played_at, client_id)
    values (r.user_id, r.game_id, r.score, r.summary, r.played_at, r.client_id);
    n := n + 1;
  end loop;
  raise notice 'partidas do Survivors refeitas: %', n;
end $$;
