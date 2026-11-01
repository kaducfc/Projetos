-- Escolha de lado nas partidas oficiais.
--   * O time melhor colocado na tabela da liga escolhe o lado do mapa 1 (azul = primeiro pick, vermelho = segundo); no mapa 2 quem escolhe
--     é o adversário, e assim por diante (MD3/MD5 intercalam). Quem escolhe o lado decide, de graça, quem começa o draft.
--   * A escolha é feita na tela de Pick e Ban, antes do primeiro ban. Se quem escolhe é uma equipe do sistema, o servidor decide sozinho.
--   * O servidor guarda o lado de cada mapa (tc_gameplay_lados) e só aceita o resultado do mapa no lado escolhido.
-- Rode depois da 0124; seguro rodar de novo.

create table if not exists public.tc_gameplay_lados (
  partida_id bigint not null references public.tc_partidas(id) on delete cascade,
  mapa int not null check (mapa between 1 and 5),
  org_azul bigint not null references public.tc_orgs(id),
  escolhido_por uuid,
  criado timestamptz not null default now(),
  primary key (partida_id, mapa)
);
alter table public.tc_gameplay_lados enable row level security;
revoke all on public.tc_gameplay_lados from anon, authenticated;

-- Quem escolhe o lado do mapa: o melhor colocado no mapa 1, depois alterna.
create or replace function public.tc_gameplay_escolhedor(pid bigint, mapa_ int)
returns bigint language plpgsql stable security definer set search_path = public as $$
declare
  p tc_partidas;
  melhor bigint;
begin
  select * into p from tc_partidas where id = pid;
  select t.org_id into melhor from tc_tabela(p.liga_id) t where t.org_id in (p.org_a, p.org_b) order by t.pos limit 1;
  melhor := coalesce(melhor, p.org_a);
  return case when mapa_ % 2 = 1 then melhor else case when melhor = p.org_a then p.org_b else p.org_a end end;
end;
$$;
revoke all on function public.tc_gameplay_escolhedor(bigint, int) from public, anon, authenticated;

create or replace function public.tc_gameplay_proximo(pid bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p tc_partidas;
  vit_a int; vit_b int; n int;
  lado bigint;
begin
  select * into p from tc_partidas where id = pid;
  select count(*) filter (where vencedor_org = p.org_a), count(*) filter (where vencedor_org = p.org_b), count(*)
    into vit_a, vit_b, n from tc_gameplay_mapas where partida_id = pid;
  select org_azul into lado from tc_gameplay_lados where partida_id = pid and mapa = n + 1;
  return jsonb_build_object('mapa', n + 1, 'vitorias_a', vit_a, 'vitorias_b', vit_b, 'necessarias', (p.formato + 1) / 2,
    'azul', lado, 'lado_definido', lado is not null, 'escolhe', tc_gameplay_escolhedor(pid, n + 1));
end;
$$;
revoke all on function public.tc_gameplay_proximo(bigint) from public, anon, authenticated;

-- Se quem escolhe o lado do próximo mapa é uma equipe do sistema, o servidor escolhe por ela (determinístico pela semente).
create or replace function public.tc_gameplay_lado_auto(pid bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  prox jsonb; esc bigint; m int; azul bigint;
begin
  select * into p from tc_partidas where id = pid;
  prox := tc_gameplay_proximo(pid);
  if (prox->>'lado_definido')::boolean then return; end if;
  m := (prox->>'mapa')::int; esc := (prox->>'escolhe')::bigint;
  if exists (select 1 from tc_orgs where id = esc and user_id is not null) then return; end if;
  azul := case when tc_gameplay_semente(pid, m) % 2 = 0 then esc else case when esc = p.org_a then p.org_b else p.org_a end end;
  insert into tc_gameplay_lados (partida_id, mapa, org_azul) values (pid, m, azul) on conflict do nothing;
end;
$$;
revoke all on function public.tc_gameplay_lado_auto(bigint) from public, anon, authenticated;

create or replace function public.tc_gameplay_escolher_lado(pid bigint, lado text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p tc_partidas;
  cfg jsonb := tc_cfg('gameplay');
  prox jsonb; esc bigint; m int;
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  if lado not in ('azul', 'vermelho') then raise exception 'lado_invalido'; end if;
  select * into p from tc_partidas where id = pid for update;
  if p.id is null then raise exception 'partida_inexistente'; end if;
  if not tc_gameplay_pode(p, uid) then raise exception 'partida_nao_e_sua'; end if;
  if p.status <> 'agendada' then raise exception 'partida_ja_concluida'; end if;
  if p.dia > site_hoje_br() then raise exception 'partida_no_futuro'; end if;
  prox := tc_gameplay_proximo(pid);
  if (prox->>'lado_definido')::boolean then raise exception 'lado_ja_escolhido'; end if;
  m := (prox->>'mapa')::int; esc := (prox->>'escolhe')::bigint;
  if not (exists (select 1 from tc_orgs o where o.id = esc and o.user_id = uid) or exists (select 1 from site_admins where user_id = uid)) then
    raise exception 'nao_e_sua_escolha';
  end if;
  insert into tc_gameplay_lados (partida_id, mapa, org_azul, escolhido_por)
  values (pid, m, case when lado = 'azul' then esc else case when esc = p.org_a then p.org_b else p.org_a end end, uid);
  return tc_gameplay_proximo(pid);
end;
$$;
revoke all on function public.tc_gameplay_escolher_lado(bigint, text) from public, anon;
grant execute on function public.tc_gameplay_escolher_lado(bigint, text) to authenticated;

create or replace function public.tc_partida_elencos(pid bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p tc_partidas;
  prox jsonb;
  azul bigint; verm bigint;
  mapa_ int;
  cfg jsonb := tc_cfg('gameplay');
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  select * into p from tc_partidas where id = pid;
  if p.id is null then raise exception 'partida_inexistente'; end if;
  if not tc_gameplay_pode(p, uid) then raise exception 'partida_nao_e_sua'; end if;
  if p.status <> 'agendada' then raise exception 'partida_ja_concluida'; end if;
  if p.dia > site_hoje_br() then raise exception 'partida_no_futuro'; end if;
  perform tc_completar_elenco(p.org_a);
  perform tc_completar_elenco(p.org_b);
  perform tc_gameplay_lado_auto(pid);
  prox := tc_gameplay_proximo(pid);
  mapa_ := (prox->>'mapa')::int;
  -- enquanto o lado não foi escolhido, a ordem (a, b) é só provisória
  azul := coalesce((prox->>'azul')::bigint, p.org_a);
  verm := case when azul = p.org_a then p.org_b else p.org_a end;
  return jsonb_build_object(
    'partida', tc_partida_json(p), 'mapa', mapa_, 'proximo', prox, 'semente', tc_gameplay_semente(pid, mapa_), 'versao', (cfg->>'versao')::int,
    'lado', jsonb_build_object('definido', (prox->>'lado_definido')::boolean, 'escolhe', (prox->>'escolhe')::bigint,
      'voce_escolhe', exists (select 1 from tc_orgs o where o.id = (prox->>'escolhe')::bigint and o.user_id = uid) or exists (select 1 from site_admins where user_id = uid)),
    'azul', jsonb_build_object('org', tc_org_json(azul), 'jogadores', tc_gameplay_jogadores(azul)),
    'vermelho', jsonb_build_object('org', tc_org_json(verm), 'jogadores', tc_gameplay_jogadores(verm)),
    'mapas', coalesce((select jsonb_agg(jsonb_build_object('mapa', g.mapa, 'vencedor', g.vencedor_org, 'duracao', g.duracao) order by g.mapa) from tc_gameplay_mapas g where g.partida_id = pid), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_partida_elencos(bigint) from public, anon;
grant execute on function public.tc_partida_elencos(bigint) to authenticated;

-- O resultado de um mapa só é gravado no lado que foi escolhido.
create or replace function public.tc_gameplay_mapas_lado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from tc_gameplay_lados l where l.partida_id = new.partida_id and l.mapa = new.mapa and l.org_azul = new.org_azul) then
    raise exception 'lado_nao_escolhido';
  end if;
  return new;
end;
$$;
revoke all on function public.tc_gameplay_mapas_lado() from public, anon, authenticated;
drop trigger if exists tc_gameplay_mapas_lado_tg on public.tc_gameplay_mapas;
create trigger tc_gameplay_mapas_lado_tg before insert on public.tc_gameplay_mapas for each row execute function public.tc_gameplay_mapas_lado();
