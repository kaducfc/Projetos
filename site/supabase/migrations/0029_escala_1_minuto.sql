-- Na Medida (ranqueada): cada rodada volta a ter 1 minuto (eram 30 segundos,
-- curto demais), com 5 s de folga para a internet. Rodar depois da 0028.
-- Rodar de novo é seguro. Só troca os números nas três funções que contam o
-- tempo; o resto delas fica como está.
do $$
declare
  def text;
  novo text;
  f text;
begin
  foreach f in array array[
    'public.site_escala_json(public.site_escala)',
    'public.site_escala_vencer(uuid,date)',
    'public.site_escala_palpite(integer,numeric)'
  ] loop
    def := pg_get_functiondef(to_regprocedure(f));
    novo := replace(replace(replace(def, '''limite'', 30', '''limite'', 60'), '30 - extract(epoch', '60 - extract(epoch'),
                    'interval ''35 seconds''', 'interval ''65 seconds''');
    if novo <> def then
      execute novo;
    elsif def !~ '65 seconds|, 60' then
      raise exception 'função % não tem o tempo esperado', f;
    end if;
  end loop;
end $$;
