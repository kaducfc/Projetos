-- Simulador de Técnico: cada retrato pertence a um único jogador fictício. Rode depois do 0106. Idempotente.
--
--  * Há 60 retratos (35 masculinos, 25 femininos): no máximo 60 jogadores fictícios têm foto ao mesmo tempo.
--  * Prioridade das fotos: jogadores dos técnicos, depois o mercado oficial, depois as equipes do sistema (estas ficam
--    com o avatar desenhado, sem foto). Jogador do mercado sem foto livre deixa de existir até haver mais retratos.
--  * Para ter mais jogadores com foto, inclua novos retratos (m36.., f26..) e ajuste os limites em tc_retratos_total().
--  * Jogadores Legado (reais) e as cópias deles continuam com o retrato próprio.

create or replace function public.tc_retratos_total(g text)
returns int language sql immutable as $$ select case when g = 'F' then 25 else 35 end; $$;
revoke all on function public.tc_retratos_total(text) from public, anon, authenticated;

-- Um retrato livre do gênero (sorteio estável pelo id); null se acabaram.
create or replace function public.tc_retrato_livre(jid bigint, g text)
returns text language sql stable security definer set search_path = public as $$
  select c.path from (
    select '/jogos/tecnico/img/retratos/' || lower(g) || lpad(i::text, 2, '0') || '.webp' as path, i
      from generate_series(1, tc_retratos_total(g)) i
  ) c
  where not exists (select 1 from tc_jogadores p where p.ficticio and p.retrato = c.path)
  order by md5(jid::text || ':' || c.i) limit 1;
$$;
revoke all on function public.tc_retrato_livre(bigint, text) from public, anon, authenticated;

create or replace function public.tc_jogador_retrato_auto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ficticio and new.retrato is null then
    new.genero := tc_genero_do_jogador(new.id);
    -- equipes do sistema não gastam retrato (ficam com o avatar desenhado)
    if new.org_id is null or not exists (select 1 from tc_orgs where id = new.org_id and user_id is null) then
      perform pg_advisory_xact_lock(85107);
      new.retrato := tc_retrato_livre(new.id, new.genero);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.tc_jogador_retrato_auto() from public, anon, authenticated;

-- Já existentes: quem repete retrato perde o repetido (técnicos primeiro, depois mercado, depois sistema) e recebe um livre, se houver.
do $$
declare
  r record;
begin
  perform pg_advisory_xact_lock(85107);
  update tc_jogadores set retrato = null
   where id in (
     select id from (
       select p.id, row_number() over (partition by p.retrato order by
         case when o.user_id is not null then 0 when p.org_id is null then 1 else 2 end, p.id) rn
         from tc_jogadores p left join tc_orgs o on o.id = p.org_id
        where p.ficticio and p.retrato is not null) d where rn > 1);
  for r in select p.id, p.genero from tc_jogadores p left join tc_orgs o on o.id = p.org_id
            where p.ficticio and p.retrato is null and not coalesce(o.user_id is null and p.org_id is not null, false)
            order by case when o.user_id is not null then 0 else 1 end, p.id loop
    update tc_jogadores set retrato = tc_retrato_livre(r.id, r.genero) where id = r.id;
  end loop;
  -- mercado sem foto: sai até haver mais retratos
  delete from tc_jogadores where org_id is null and ficticio and retrato is null;
end $$;

drop index if exists public.tc_jogadores_retrato_unico;
create unique index tc_jogadores_retrato_unico on public.tc_jogadores (retrato) where ficticio and retrato is not null;

-- Reabastecimento do mercado: só cria jogadores enquanto houver retrato livre.
create or replace function public.tc_reabastecer()
returns int language plpgsql security definer set search_path = public as $$
declare
  alvo int := ((tc_cfg('pool_alvo'))::text)::int;
  v text;
  falta int;
  livres int;
  total int := 0;
  restantes int := 5;
begin
  perform pg_advisory_xact_lock(85001);
  select tc_retratos_total('M') + tc_retratos_total('F') - count(*) into livres from tc_jogadores where ficticio and retrato is not null;
  foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
    exit when livres <= 0;
    -- divide os retratos livres entre as posições que faltam (não deixa o topo levar tudo)
    select least(greatest(0, alvo - count(*)), ceil(livres::numeric / restantes)::int) into falta from tc_jogadores where org_id is null and ficticio and pos = v;
    if falta > 0 then
      perform tc_gerar_jogadores(falta, null, v);
      total := total + falta; livres := livres - falta;
    end if;
    restantes := restantes - 1;
  end loop;
  delete from tc_jogadores where org_id is null and ficticio and retrato is null; -- sem retrato livre (gênero esgotado): não entra
  return total;
end;
$$;
revoke all on function public.tc_reabastecer() from public, anon, authenticated;
