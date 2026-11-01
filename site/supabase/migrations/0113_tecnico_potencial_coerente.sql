-- Simulador de Técnico: o Potencial passa a respeitar o teto do Treinamento (+10 de Poder para jogador comum, +15 para Legado).
-- Antes havia jogadores com Poder 80 e Potencial 95, um teto que o treino nunca deixaria alcançar. Rode depois do 0112. Idempotente.
--  * Potencial = o menor entre o valor sorteado e o limite de treino do jogador (nunca abaixo do Poder atual).
--  * Vale para os jogadores que já existem e para todos os novos. Os preços (que dependem do Potencial) ficam mais baixos nos casos ajustados.

create or replace function public.tc_potencial_ajustado(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select greatest(round(tc_poder(j))::int, least(j.potencial, tc_treino_limite(j)));
$$;
revoke all on function public.tc_potencial_ajustado(tc_jogadores) from public, anon, authenticated;

update public.tc_jogadores j set potencial = tc_potencial_ajustado(j) where j.potencial <> tc_potencial_ajustado(j);

create or replace function public.tc_jogador_potencial_auto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update tc_jogadores j set potencial = tc_potencial_ajustado(j) where j.id = new.id and j.potencial <> tc_potencial_ajustado(j);
  return null;
end;
$$;
revoke all on function public.tc_jogador_potencial_auto() from public, anon, authenticated;
drop trigger if exists tc_jogador_potencial_auto on public.tc_jogadores;
create trigger tc_jogador_potencial_auto after insert on public.tc_jogadores
  for each row execute function public.tc_jogador_potencial_auto();
