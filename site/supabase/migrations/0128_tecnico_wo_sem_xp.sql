-- W.O. e partidas simuladas pelo sistema não dão XP (nem maestria).
--   * XP e Maestria só vêm de mapas realmente jogados (amistoso e oficial). Com o gameplay ligado, a partida que o sistema simula
--     (por exemplo quando nenhum dos dois técnicos jogou) não dá mais XP; a derrota por W.O. já não dava nada além da vitória/derrota.
-- Rode depois da 0127; seguro rodar de novo.

create or replace function public.tc_processar_partida(pid bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  r jsonb;
  pa double precision;
  pb double precision;
  venc bigint;
  perd bigint;
  nec int;
  esperando boolean := false;
  ausentes bigint[];
  jogou boolean := not coalesce((tc_cfg('gameplay')->>'ativo')::boolean, false); -- com o gameplay ligado, partida simulada pelo sistema não dá XP
begin
  select * into p from tc_partidas where id = pid for update;
  if p.id is null or p.status <> 'agendada' then
    return false;
  end if;
  nec := (p.formato + 1) / 2;
  if coalesce((tc_cfg('gameplay')->>'ativo')::boolean, false)
     and exists (select 1 from tc_orgs where id in (p.org_a, p.org_b) and user_id is not null) then
    -- ainda dentro do prazo (até a meia-noite do dia da partida): espera o técnico jogar
    if site_hoje_br() < p.dia + coalesce((tc_cfg('gameplay')->>'prazo_dias')::int, 1) then
      return false;
    end if;
    -- prazo vencido: quem é técnico e já tinha a organização no dia da partida perde por W.O.
    select coalesce(array_agg(id), '{}') into ausentes from tc_orgs
     where id in (p.org_a, p.org_b) and user_id is not null and criado::date <= p.dia;
    if coalesce(array_length(ausentes, 1), 0) = 1 then
      perd := ausentes[1];
      venc := case when perd = p.org_a then p.org_b else p.org_a end;
      update tc_partidas set status = 'concluida', placar_a = case when venc = p.org_a then nec else 0 end, placar_b = case when venc = p.org_b then nec else 0 end,
             vencedor = venc, poder_a = round(tc_poder_org(p.org_a)::numeric, 1), poder_b = round(tc_poder_org(p.org_b)::numeric, 1),
             resumo = jsonb_build_object('origem', 'wo', 'ausente', perd), processada = now()
       where id = p.id;
      perform tc_fama_vitoria(venc, p.id);
      perform tc_avisar(perd, 'Derrota por W.O.: a partida do dia ' || to_char(p.dia, 'DD/MM') || ' não foi jogada até a meia-noite.')
        where exists (select 1 from tc_orgs where id = perd and user_id is not null);
      return true;
    end if;
  end if;
  perform tc_completar_elenco(p.org_a);
  perform tc_completar_elenco(p.org_b);
  pa := tc_poder_org(p.org_a);
  pb := tc_poder_org(p.org_b);
  r := tc_simular(p.org_a, p.org_b, p.formato, 'p' || p.id::text || ':' || p.liga_id::text);
  venc := case when (r->>'a')::int > (r->>'b')::int then p.org_a else p.org_b end;
  perd := case when venc = p.org_a then p.org_b else p.org_a end;
  update tc_partidas set status = 'concluida', placar_a = (r->>'a')::int, placar_b = (r->>'b')::int, vencedor = venc,
         poder_a = round(pa::numeric, 1), poder_b = round(pb::numeric, 1), resumo = r, processada = now()
   where id = p.id;
  update tc_jogadores set forma = least(75, forma + 4), exp = case when jogou then least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_partida')::int, 10)) else exp end where org_id = venc and slot is not null;
  update tc_jogadores set forma = greatest(25, forma - 4), exp = case when jogou then least(100, exp + coalesce(((tc_cfg('treino'))->>'exp_derrota')::int, 5)) else exp end where org_id = perd and slot is not null;
  perform tc_fama_vitoria(venc, p.id);
  return true;
end;
$$;
revoke all on function public.tc_processar_partida(bigint) from public, anon, authenticated;
