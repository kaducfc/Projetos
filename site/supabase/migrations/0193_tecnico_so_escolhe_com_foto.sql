-- Rift Manager: não dá para escolher (nem ver no mercado oficial) jogador sem foto. Rodar depois da 0192. Rodar de novo é seguro.
--   * tc_mercado_oficial: a vitrine só lista jogador com foto.
--   * tc_contratar: recusa jogador sem foto (jogador_indisponivel), mesmo que alguém tente contratar pelo id.
-- (Desde a 0190 a vitrine já nasce com foto e, desde a 0192, nenhum jogador de time fica sem; isto é a trava no servidor.)
do $$
declare
  def text;
begin
  def := pg_get_functiondef(to_regprocedure('public.tc_mercado_oficial(jsonb)'));
  if position('j.retrato is not null' in def) = 0 then
    if position('where j.id = any (oferta) and j.org_id is null' in def) = 0 then raise exception 'não achei o filtro da vitrine em tc_mercado_oficial'; end if;
    execute replace(def, 'where j.id = any (oferta) and j.org_id is null', 'where j.id = any (oferta) and j.org_id is null and j.retrato is not null');
  end if;
  def := pg_get_functiondef(to_regprocedure('public.tc_contratar(bigint, integer, text)'));
  if position('j.retrato is null' in def) = 0 then
    if position('if j.org_id is not null or not j.ficticio then raise exception ''jogador_indisponivel''; end if;' in def) = 0 then raise exception 'não achei a checagem de disponibilidade em tc_contratar'; end if;
    execute replace(def, 'if j.org_id is not null or not j.ficticio then raise exception ''jogador_indisponivel''; end if;', 'if j.org_id is not null or not j.ficticio or j.retrato is null then raise exception ''jogador_indisponivel''; end if;');
  end if;
end $$;
