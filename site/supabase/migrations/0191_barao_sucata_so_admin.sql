-- Barão da Sucata (bar-do-barao): fora de circulação, só a conta de administrador. Rodar depois da 0190. Rodar de novo é seguro.
-- Quem não é administrador não consegue mais pedir vaga na ranqueada desse jogo (a página já bloqueia e o hub esconde o card).
do $$
declare
  def text;
  f constant text := 'public.site_rk_iniciar(text)';
  velho constant text := '  if jogo not in (''carreira-no-rift'', ''cblol'', ''barao'', ''smite'', ''bar-do-barao'', ''survivors'') then';
  novo constant text := '  if jogo = ''bar-do-barao'' and not coalesce(site_is_admin(), false) then
    raise exception ''jogo_invalido'';
  end if;
' || velho;
begin
  def := pg_get_functiondef(to_regprocedure(f));
  if position('jogo = ''bar-do-barao'' and not' in def) = 0 then
    if position(velho in def) = 0 then raise exception 'não achei a lista de jogos em site_rk_iniciar (rode a 0188 antes)'; end if;
    execute replace(def, velho, novo);
  end if;
end $$;
