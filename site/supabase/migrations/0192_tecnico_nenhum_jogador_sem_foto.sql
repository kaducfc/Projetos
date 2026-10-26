-- Rift Manager: NENHUM jogador de time fica sem foto. Rodar depois da 0191. Rodar de novo é seguro.
--
-- Os jogadores comuns (fictícios) de técnicos que foram contratados quando as 60 fotos estavam acabando ficaram com o avatar desenhado.
-- Agora jogador comum pode repetir foto: quando não há foto livre, o jogador do técnico recebe uma das 60 fotos do gênero dele, dando
-- preferência a uma que ainda não esteja no mesmo time (o jogador é marcado como cópia, que é o que permite repetir foto).
--   * tc_retrato_repetido: escolhe a foto do gênero, evitando as que o time já usa (sorteio estável pelo id).
--   * gatilho de fotos: jogador de técnico sem foto livre recebe uma foto repetida em vez de ficar sem foto.
--   * agora: todo jogador de time (técnico ou sistema) que está sem foto recebe uma.
-- Jogador livre do estoque do mercado continua sem foto = não existe (o estoque só tem quem tem foto; a vitrine individual usa as fotos desde a 0190).

create or replace function public.tc_retrato_repetido(jid bigint, g text, org bigint)
returns text language sql stable security definer set search_path = public as $$
  select c.path
    from (
      select '/jogos/tecnico/img/retratos/' || lower(x.gen) || lpad(i::text, 2, '0') || '.webp' as path
        from (select coalesce(g, tc_genero_do_jogador(jid)) as gen) x, generate_series(1, tc_retratos_total(coalesce(g, tc_genero_do_jogador(jid)))) i
    ) c
   order by case when org is not null and exists (select 1 from tc_jogadores p where p.org_id = org and p.retrato = c.path) then 1 else 0 end,
            hashtextextended(c.path || ':' || jid::text, 0)
   limit 1;
$$;
revoke all on function public.tc_retrato_repetido(bigint, text, bigint) from public, anon, authenticated;

create or replace function public.tc_jogador_retrato_auto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  livres int;
  sem_vaga boolean := false;
begin
  if new.ficticio and new.retrato is null then
    new.genero := case when coalesce(current_setting('tc.oferta', true), '') = '1' and coalesce(current_setting('tc.genero', true), '') in ('M', 'F') then current_setting('tc.genero', true) else tc_genero_do_jogador(new.id) end;
    if coalesce(current_setting('tc.mercado', true), '') = '1' then
      return new; -- jogador individual do vitrine: a foto é escolhida logo depois (0190), sem gastar foto do estoque
    end if;
    if new.org_id is null or not exists (select 1 from tc_orgs where id = new.org_id and user_id is null) then
      perform pg_advisory_xact_lock(85107);
      if new.org_id is not null and coalesce(current_setting('tc.oferta', true), '') <> '1' then
        select tc_retratos_total('M') + tc_retratos_total('F') - count(*) into livres from tc_jogadores where ficticio and retrato is not null and not copia_sistema;
        if livres <= coalesce(((tc_cfg('retratos'))->>'reserva_mercado')::int, 30) then sem_vaga := true; end if;
      end if;
      if not sem_vaga then
        new.retrato := tc_retrato_livre(new.id, new.genero);
        if new.retrato is null and coalesce(current_setting('tc.oferta', true), '') = '1' then -- acabou o gênero sorteado: o candidato muda de gênero para ter foto
          new.genero := case when new.genero = 'F' then 'M' else 'F' end;
          new.retrato := tc_retrato_livre(new.id, new.genero);
        end if;
      end if;
    end if;
    -- jogador de técnico nunca fica sem foto: sem foto livre, repete uma (marca como cópia: é o que permite repetir)
    if new.retrato is null and new.org_id is not null and exists (select 1 from tc_orgs where id = new.org_id and user_id is not null) then
      new.retrato := tc_retrato_repetido(new.id, new.genero, new.org_id);
      new.copia_sistema := true;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.tc_jogador_retrato_auto() from public, anon, authenticated;

-- Agora: todo jogador comum de time (técnico ou sistema) sem foto recebe uma.
do $$
declare
  r record;
  n int := 0;
begin
  for r in select id, org_id, genero from tc_jogadores where ficticio and retrato is null and org_id is not null order by org_id, id loop
    update tc_jogadores
       set genero = coalesce(r.genero, tc_genero_do_jogador(r.id)),
           retrato = tc_retrato_repetido(r.id, coalesce(r.genero, tc_genero_do_jogador(r.id)), r.org_id),
           copia_sistema = true
     where id = r.id;
    n := n + 1;
  end loop;
  raise notice 'Jogadores de time que estavam sem foto e agora têm: %', n;
end;
$$;
