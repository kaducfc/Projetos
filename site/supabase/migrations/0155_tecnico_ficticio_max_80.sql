-- Simulador de Técnico: jogador comum (fictício) tem no máximo 80 de OVR, e a loja do Mercado oficial usa no máximo 80 como referência do seu time.
-- Rode depois do 0154. Idempotente.
--  * Nenhum atributo de fictício passa de 80 (nem por geração, treino ou edição do administrador): então o Poder base dele também não passa de 80. O potencial também fica em até 80.
--  * Se a média dos seus titulares passar de 80 (Legados, estrelas...), a faixa da loja (5 abaixo a 10 acima) é calculada a partir de 80: aparecem os melhores comuns, de 75 a 80.
insert into public.tc_config (chave, valor) values ('poder_ficticio', '{"max": 80}'::jsonb) on conflict (chave) do nothing;

create or replace function public.tc_limite_ficticio()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m int := coalesce((((tc_cfg('poder_ficticio'))->>'max'))::int, 80);
begin
  if new.ficticio then
    new.mec := least(new.mec, m); new.rotas := least(new.rotas, m); new.macro := least(new.macro, m); new.tf := least(new.tf, m); new.mental := least(new.mental, m);
    new.potencial := least(new.potencial, m);
  end if;
  return new;
end;
$$;
revoke all on function public.tc_limite_ficticio() from public, anon, authenticated;
drop trigger if exists tc_limite_ficticio on public.tc_jogadores;
create trigger tc_limite_ficticio before insert or update on public.tc_jogadores
  for each row execute function public.tc_limite_ficticio();

-- quem já passava do limite é ajustado agora (o gatilho faz o corte)
update public.tc_jogadores set mec = mec where ficticio and (mec > 80 or rotas > 80 or macro > 80 or tf > 80 or mental > 80 or potencial > 80);

-- Referência de Poder do time para a loja: média dos titulares, limitada ao teto dos comuns.
create or replace function public.tc_mercado_ref(oid bigint)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  r numeric;
begin
  select avg(tc_poder_efetivo(j, j.slot)) into r from tc_jogadores j where j.org_id = oid and j.slot is not null;
  if r is null then select avg(tc_poder(j)) into r from tc_jogadores j where j.org_id = oid; end if;
  return least(round(coalesce(r, ((tc_cfg('mercado_oficial'))->>'poder_padrao')::numeric), 1), coalesce((((tc_cfg('poder_ficticio'))->>'max'))::numeric, 80));
end;
$$;
revoke all on function public.tc_mercado_ref(bigint) from public, anon, authenticated;

delete from public.tc_mercado_rot; -- as ofertas guardadas são refeitas com a regra nova
