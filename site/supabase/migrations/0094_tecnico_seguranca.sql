-- Simulador de Técnico: correções de segurança e antifraude (revisão de outubro/2026).
-- Rode depois do 0093. Idempotente (rodar de novo é seguro).
--
--  1. Resumo do gameplay vindo do navegador: o servidor reconstrói o resumo só com números limitados,
--     destaque (MVP) e jogadores que existem nas duas equipes. Nada de texto livre é guardado.
--  2. Anúncio aberto é cancelado sozinho quando o jogador sai da organização (liberado, contrato vencido...).
--  3. Mercado entre usuários (movimenta RC de verdade): regras contra "lavagem" de RC entre contas
--     (conta nova, muitas vendas entre o mesmo par de contas, recompra do jogador vendido, compras por dia).
--     Valores em tc_config.mercado_regras.

-- ---------------------------------------------------------------- 1. resumo do gameplay
create or replace function public.tc_int_limite(v jsonb, lo int, hi int)
returns int language sql immutable as $$
  select case when jsonb_typeof(v) = 'number' then least(hi, greatest(lo, round((v #>> '{}')::numeric)::int)) else 0 end;
$$;
revoke all on function public.tc_int_limite(jsonb, int, int) from public, anon, authenticated;

create or replace function public.tc_gameplay_resumo_limpo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r jsonb := coalesce(new.resumo, '{}'::jsonb);
  p tc_partidas;
  eqs jsonb := '{}'::jsonb;
  e text;
  x jsonb;
  mvp jsonb := null;
  jog jsonb := '[]'::jsonb;
  jg tc_jogadores;
  n int := 0;
begin
  select * into p from tc_partidas where id = new.partida_id;
  foreach e in array array['azul', 'vermelho'] loop
    x := r->'equipes'->e;
    eqs := eqs || jsonb_build_object(e, jsonb_build_object(
      'abates', tc_int_limite(x->'abates', 0, 300), 'mortes', tc_int_limite(x->'mortes', 0, 300),
      'ouro', tc_int_limite(x->'ouro', 0, 500000), 'torresPerdidas', tc_int_limite(x->'torresPerdidas', 0, 11),
      'inibidoresPerdidos', tc_int_limite(x->'inibidoresPerdidos', 0, 3), 'dragoes', tc_int_limite(x->'dragoes', 0, 10),
      'baroes', tc_int_limite(x->'baroes', 0, 10), 'arautos', tc_int_limite(x->'arautos', 0, 2)));
  end loop;
  -- destaque: só um jogador de uma das duas equipes; o nome vem do banco, nunca do navegador
  if jsonb_typeof(r->'mvp'->'id') = 'number' then
    select * into jg from tc_jogadores where id = (r->'mvp'->>'id')::bigint and org_id in (p.org_a, p.org_b);
    if jg.id is not null then
      mvp := jsonb_build_object('id', jg.id, 'nome', jg.nome,
               'campeao', (select nome from tc_campeoes where nome = r->'mvp'->>'campeao'));
    end if;
  end if;
  -- estatísticas por jogador (no máximo 10, só jogadores das duas equipes, só números)
  if jsonb_typeof(r->'jogadores') = 'array' then
    for x in select * from jsonb_array_elements(r->'jogadores') limit 10 loop
      continue when jsonb_typeof(x->'id') <> 'number';
      select * into jg from tc_jogadores where id = (x->>'id')::bigint and org_id in (p.org_a, p.org_b);
      continue when jg.id is null;
      jog := jog || jsonb_build_array(jsonb_build_object(
        'id', jg.id, 'nome', jg.nome,
        'equipe', case when x->>'equipe' in ('azul', 'vermelho') then x->>'equipe' else null end,
        'pos', case when x->>'pos' in ('top', 'selva', 'meio', 'atirador', 'suporte') then x->>'pos' else null end,
        'campeao', (select nome from tc_campeoes where nome = x->>'campeao'),
        'nivel', tc_int_limite(x->'nivel', 1, 18), 'abates', tc_int_limite(x->'abates', 0, 100),
        'mortes', tc_int_limite(x->'mortes', 0, 100), 'assistencias', tc_int_limite(x->'assistencias', 0, 150),
        'cs', tc_int_limite(x->'cs', 0, 2000), 'ouro', tc_int_limite(x->'ouro', 0, 100000),
        'dano', tc_int_limite(x->'dano', 0, 1000000), 'torres', tc_int_limite(x->'torres', 0, 11)));
      n := n + 1;
    end loop;
  end if;
  new.resumo := jsonb_build_object(
    'vencedor', case when r->>'vencedor' in ('azul', 'vermelho') then r->>'vencedor' else null end,
    'motivo', case when r->>'motivo' in ('nexus', 'rendicao', 'tempo') then r->>'motivo' else 'nexus' end,
    'equipes', eqs, 'mvp', mvp, 'jogadores', jog);
  return new;
end;
$$;
revoke all on function public.tc_gameplay_resumo_limpo() from public, anon, authenticated;
drop trigger if exists tc_gameplay_resumo_limpo on public.tc_gameplay_mapas;
create trigger tc_gameplay_resumo_limpo before insert or update of resumo on public.tc_gameplay_mapas
  for each row execute function public.tc_gameplay_resumo_limpo();
-- limpa o que já foi gravado (só administradores jogaram até aqui)
update public.tc_gameplay_mapas set resumo = resumo;
-- e as partidas fechadas pelo gameplay, que copiam números do resumo
update public.tc_partidas p set resumo = jsonb_set(p.resumo, '{mapas}', coalesce((
  select jsonb_agg(m || jsonb_build_object(
           'abates', jsonb_build_array(tc_int_limite(m->'abates'->0, 0, 300), tc_int_limite(m->'abates'->1, 0, 300)),
           'torres', jsonb_build_array(tc_int_limite(m->'torres'->0, 0, 11), tc_int_limite(m->'torres'->1, 0, 11)),
           'dragoes', jsonb_build_array(tc_int_limite(m->'dragoes'->0, 0, 10), tc_int_limite(m->'dragoes'->1, 0, 10)),
           'mvp', coalesce((select g.resumo->'mvp'->>'nome' from tc_gameplay_mapas g where g.partida_id = p.id and g.mapa = (m->>'mapa')::int), ''))
         order by (m->>'mapa')::int)
    from jsonb_array_elements(p.resumo->'mapas') m), '[]'::jsonb))
 where p.resumo->>'origem' = 'gameplay';

-- ---------------------------------------------------------------- 2. anúncio de jogador que saiu da organização
create or replace function public.tc_anuncio_jogador_saiu()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.org_id is not null and new.org_id is distinct from old.org_id then
    update tc_anuncios set status = 'cancelado' where jogador_id = new.id and status = 'aberto' and vendedor_org = old.org_id;
  end if;
  return new;
end;
$$;
revoke all on function public.tc_anuncio_jogador_saiu() from public, anon, authenticated;
drop trigger if exists tc_anuncio_jogador_saiu on public.tc_jogadores;
create trigger tc_anuncio_jogador_saiu after update of org_id on public.tc_jogadores
  for each row execute function public.tc_anuncio_jogador_saiu();
update public.tc_anuncios a set status = 'cancelado'
 where a.status = 'aberto' and not exists (select 1 from tc_jogadores j where j.id = a.jogador_id and j.org_id = a.vendedor_org);

-- ---------------------------------------------------------------- 3. mercado entre usuários: antifraude
insert into public.tc_config (chave, valor) values
  ('mercado_regras', '{"conta_dias_min": 7, "pares_semana_max": 2, "recompra_dias": 14, "compras_dia_max": 5}'::jsonb)
on conflict (chave) do nothing;

create or replace function public.tc_mercado_conta_ok(oid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select u.created_at <= now() - make_interval(days => coalesce((tc_cfg('mercado_regras')->>'conta_dias_min')::int, 0))
                     from tc_orgs o join auth.users u on u.id = o.user_id where o.id = oid), false);
$$;
revoke all on function public.tc_mercado_conta_ok(bigint) from public, anon, authenticated;

-- anunciar: a conta precisa ter a idade mínima
create or replace function public.tc_mercado_anuncio_regras()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not tc_mercado_conta_ok(new.vendedor_org) then raise exception 'mercado_conta_nova'; end if;
  return new;
end;
$$;
revoke all on function public.tc_mercado_anuncio_regras() from public, anon, authenticated;
drop trigger if exists tc_mercado_anuncio_regras on public.tc_anuncios;
create trigger tc_mercado_anuncio_regras before insert on public.tc_anuncios
  for each row execute function public.tc_mercado_anuncio_regras();

-- vender: roda dentro da compra (mesma transação); qualquer recusa desfaz o débito e o crédito de RC
create or replace function public.tc_mercado_venda_regras()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  R jsonb := tc_cfg('mercado_regras');
begin
  if new.status <> 'vendido' or old.status = 'vendido' then return new; end if;
  if not tc_mercado_conta_ok(new.comprador_org) or not tc_mercado_conta_ok(new.vendedor_org) then
    raise exception 'mercado_conta_nova';
  end if;
  if (select count(*) from tc_anuncios
       where status = 'vendido' and id <> new.id and vendido_em > now() - interval '7 days'
         and ((vendedor_org = new.vendedor_org and comprador_org = new.comprador_org)
           or (vendedor_org = new.comprador_org and comprador_org = new.vendedor_org)))
     >= coalesce((R->>'pares_semana_max')::int, 2) then
    raise exception 'mercado_limite_par';
  end if;
  if exists (select 1 from tc_anuncios
              where status = 'vendido' and id <> new.id and jogador_id = new.jogador_id and vendedor_org = new.comprador_org
                and vendido_em > now() - make_interval(days => coalesce((R->>'recompra_dias')::int, 14))) then
    raise exception 'mercado_recompra';
  end if;
  if (select count(*) from tc_anuncios
       where status = 'vendido' and id <> new.id and comprador_org = new.comprador_org and vendido_em > now() - interval '1 day')
     >= coalesce((R->>'compras_dia_max')::int, 5) then
    raise exception 'mercado_limite_dia';
  end if;
  return new;
end;
$$;
revoke all on function public.tc_mercado_venda_regras() from public, anon, authenticated;
drop trigger if exists tc_mercado_venda_regras on public.tc_anuncios;
create trigger tc_mercado_venda_regras before update of status on public.tc_anuncios
  for each row execute function public.tc_mercado_venda_regras();
