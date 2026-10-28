-- Rift Manager: abrir o jogo ficava lento (e às vezes dava "statement timeout") quando várias contas abriam ao mesmo tempo.
-- Toda abertura chama tc_sincronizar(), que processa o campeonato sob um trava global (85002): cada conta esperava a
-- anterior terminar, e a espera também conta no tempo limite da consulta. Agora, se outra conta já está sincronizando,
-- esta não espera na fila: devolve na hora (o trabalho já está sendo feito por quem pegou a trava).
-- Idempotente: pode rodar de novo.
do $$
declare
  def text;
  f constant text := 'public.tc_sincronizar()';
  velho constant text := 'perform pg_advisory_xact_lock(85002);';
  novo constant text := E'if not pg_try_advisory_xact_lock(85002) then\n    return jsonb_build_object(''processadas'', 0, ''gw'', (cal->>''gw'')::int, ''temporada'', cal->''temporada'', ''semana'', cal->''semana'', ''dia'', cal->''dia'', ''ocupado'', true);\n  end if;';
begin
  if to_regprocedure(f) is null then
    raise exception 'não achei tc_sincronizar';
  end if;
  def := pg_get_functiondef(to_regprocedure(f));
  if position('pg_try_advisory_xact_lock(85002)' in def) = 0 then
    if position(velho in def) = 0 then
      raise exception 'não achei a trava de tc_sincronizar';
    end if;
    execute replace(def, velho, novo);
  end if;
end $$;
