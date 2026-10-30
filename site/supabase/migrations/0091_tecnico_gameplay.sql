-- Simulador de técnico (nome provisório), parte 6: gameplay das partidas (mapa de Summoner's Rift simulado no navegador).
-- Rode DEPOIS de 0085 a 0090. Seguro para rodar de novo. Fica desligado (gameplay.ativo = false) e o jogo segue só para administradores.
--
-- Como funciona:
--  * A partida (melhor de 3 ou 5) é jogada mapa a mapa pelo motor JavaScript do navegador (jogos/tecnico/partida/).
--  * O servidor entrega as duas escalações (tc_partida_elencos) com a SEMENTE e o LADO de cada mapa, que ele mesmo define.
--  * O navegador devolve o resultado oficial de cada mapa (tc_gameplay_registrar). O servidor valida a ordem, a semente, a versão das
--    regras e quem pode registrar, grava cada mapa uma única vez e fecha a partida quando alguém chega à maioria.
--  * Enquanto gameplay.ativo = true, as partidas de técnicos reais esperam `prazo_dias` pelo gameplay; passado o prazo, o sistema
--    simula sozinho (tc_simular), como antes. Partidas entre times do sistema nunca esperam.
--
-- LIMITAÇÃO CONHECIDA (documentada em jogos/tecnico/partida/README.md): o resultado vem do navegador. Enquanto o jogo é só para
-- administradores isso basta; antes de abrir ao público, a simulação oficial deve rodar no servidor (a mesma semente e a mesma
-- versão do motor permitem reexecutar e auditar qualquer mapa: ferramentas/auditar.mjs).

insert into public.tc_config (chave, valor) values
  ('gameplay', '{"ativo": false, "prazo_dias": 1, "versao": 1}'::jsonb)
on conflict (chave) do nothing;

create table if not exists public.tc_gameplay_mapas (
  partida_id bigint not null references public.tc_partidas(id) on delete cascade,
  mapa int not null check (mapa between 1 and 5),
  org_azul bigint not null references public.tc_orgs(id),
  vencedor_org bigint not null references public.tc_orgs(id),
  semente bigint not null,
  duracao int not null,
  resumo jsonb not null,
  registrado_por uuid,
  criado timestamptz not null default now(),
  primary key (partida_id, mapa)
);
alter table public.tc_gameplay_mapas enable row level security;
revoke all on public.tc_gameplay_mapas from anon, authenticated;

-- Semente do mapa: determinística, definida pelo servidor (o cliente não escolhe).
create or replace function public.tc_gameplay_semente(pid bigint, mapa_ int)
returns bigint language sql immutable as $$
  select (('x' || substr(md5('gp:' || pid::text || ':' || mapa_::text), 1, 8))::bit(32)::bigint) & 2147483647;
$$;
revoke all on function public.tc_gameplay_semente(bigint, int) from public, anon, authenticated;

-- Quem pode ver e registrar a partida: técnico de uma das duas equipes ou administrador.
create or replace function public.tc_gameplay_pode(p tc_partidas, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tc_orgs o where o.user_id = uid and o.id in (p.org_a, p.org_b))
      or exists (select 1 from site_admins where user_id = uid);
$$;
revoke all on function public.tc_gameplay_pode(tc_partidas, uuid) from public, anon, authenticated;

-- Maioria necessária: melhor de 3 = 2, melhor de 5 = 3.
create or replace function public.tc_gameplay_proximo(pid bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p tc_partidas;
  vit_a int; vit_b int; n int;
begin
  select * into p from tc_partidas where id = pid;
  select count(*) filter (where vencedor_org = p.org_a), count(*) filter (where vencedor_org = p.org_b), count(*)
    into vit_a, vit_b, n from tc_gameplay_mapas where partida_id = pid;
  return jsonb_build_object('mapa', n + 1, 'vitorias_a', vit_a, 'vitorias_b', vit_b, 'necessarias', (p.formato + 1) / 2,
    'azul', case when (n + 1) % 2 = 1 then p.org_a else p.org_b end);
end;
$$;
revoke all on function public.tc_gameplay_proximo(bigint) from public, anon, authenticated;

-- Escalações das duas equipes para o próximo mapa (com atributos, posições, campeões favoritos e bônus de maestria).
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
  prox := tc_gameplay_proximo(pid);
  mapa_ := (prox->>'mapa')::int;
  azul := (prox->>'azul')::bigint;
  verm := case when azul = p.org_a then p.org_b else p.org_a end;
  return jsonb_build_object(
    'partida', tc_partida_json(p), 'mapa', mapa_, 'proximo', prox, 'semente', tc_gameplay_semente(pid, mapa_), 'versao', (cfg->>'versao')::int,
    'azul', jsonb_build_object('org', tc_org_json(azul), 'jogadores', tc_gameplay_jogadores(azul)),
    'vermelho', jsonb_build_object('org', tc_org_json(verm), 'jogadores', tc_gameplay_jogadores(verm)),
    'mapas', coalesce((select jsonb_agg(jsonb_build_object('mapa', g.mapa, 'vencedor', g.vencedor_org, 'duracao', g.duracao) order by g.mapa) from tc_gameplay_mapas g where g.partida_id = pid), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_partida_elencos(bigint) from public, anon;
grant execute on function public.tc_partida_elencos(bigint) to authenticated;

create or replace function public.tc_gameplay_jogadores(oid bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', j.id, 'nome', j.nome, 'pos', j.slot, 'poder', round(tc_poder_efetivo(j, j.slot))::int,
      'atributos', jsonb_build_object('mec', j.mec, 'rotas', j.rotas, 'macro', j.macro, 'tf', j.tf, 'mental', j.mental, 'fama', j.fama),
      'favoritos', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'bonus_pct', tc_bonus_nivel(tc_maestria_nivel(m.pontos))) order by m.pontos desc)
                               from tc_maestria m join tc_campeoes c on c.id = m.campeao_id
                              where m.jogador_id = j.id and m.favorito and j.slot = any(c.posicoes)), '[]'::jsonb))
    order by array_position(array['top', 'selva', 'meio', 'atirador', 'suporte'], j.slot)), '[]'::jsonb)
    from tc_jogadores j where j.org_id = oid and j.slot is not null;
$$;
revoke all on function public.tc_gameplay_jogadores(bigint) from public, anon, authenticated;

-- Registra o resultado oficial de um mapa. Chamado uma vez por mapa; repetir o mesmo mapa é recusado (nada é pago ou contado duas vezes).
create or replace function public.tc_gameplay_registrar(pid bigint, mapa_ int, resultado jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p tc_partidas;
  cfg jsonb := tc_cfg('gameplay');
  prox jsonb;
  azul bigint; verm bigint; venc bigint; perd bigint;
  v_a int; v_b int; nec int;
  dur int;
  res jsonb;
  pa double precision; pb double precision;
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  select * into p from tc_partidas where id = pid for update;
  if p.id is null then raise exception 'partida_inexistente'; end if;
  if not tc_gameplay_pode(p, uid) then raise exception 'partida_nao_e_sua'; end if;
  if p.status <> 'agendada' then raise exception 'partida_ja_concluida'; end if;
  prox := tc_gameplay_proximo(pid);
  if mapa_ <> (prox->>'mapa')::int then raise exception 'mapa_fora_de_ordem'; end if;
  if (resultado->>'semente')::bigint is distinct from tc_gameplay_semente(pid, mapa_) then raise exception 'semente_invalida'; end if;
  if (resultado->>'versaoRegras')::int is distinct from (cfg->>'versao')::int then raise exception 'versao_invalida'; end if;
  if coalesce(resultado->>'vencedor', '') not in ('azul', 'vermelho') or coalesce((resultado->>'interrompida')::boolean, false) then raise exception 'resultado_invalido'; end if;
  dur := (resultado->>'duracao')::int;
  if dur is null or dur < 300 or dur > 7200 then raise exception 'duracao_invalida'; end if;
  azul := (prox->>'azul')::bigint;
  verm := case when azul = p.org_a then p.org_b else p.org_a end;
  venc := case when resultado->>'vencedor' = 'azul' then azul else verm end;
  insert into tc_gameplay_mapas (partida_id, mapa, org_azul, vencedor_org, semente, duracao, resumo, registrado_por)
  values (pid, mapa_, azul, venc, (resultado->>'semente')::bigint, dur, jsonb_build_object(
            'vencedor', resultado->>'vencedor', 'equipes', resultado->'equipes', 'mvp', resultado->'mvp', 'jogadores', resultado->'jogadores', 'motivo', resultado->>'motivo'), uid);
  select count(*) filter (where vencedor_org = p.org_a), count(*) filter (where vencedor_org = p.org_b) into v_a, v_b from tc_gameplay_mapas where partida_id = pid;
  nec := (p.formato + 1) / 2;
  if v_a < nec and v_b < nec then
    return jsonb_build_object('concluida', false, 'placar_a', v_a, 'placar_b', v_b, 'proximo', tc_gameplay_proximo(pid));
  end if;
  -- fechou a série: mesmo fechamento da simulação do sistema
  perd := case when v_a >= nec then p.org_b else p.org_a end;
  venc := case when v_a >= nec then p.org_a else p.org_b end;
  pa := tc_poder_org(p.org_a); pb := tc_poder_org(p.org_b);
  res := jsonb_build_object('a', v_a, 'b', v_b, 'origem', 'gameplay', 'mapas', (
    select jsonb_agg(jsonb_build_object('mapa', g.mapa, 'duracao', round(g.duracao / 60.0)::int, 'gameplay', true,
             'vencedor', case when g.vencedor_org = p.org_a then 'a' else 'b' end,
             'abates', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'azul'->'abates', g.resumo->'equipes'->'vermelho'->'abates')
                            else jsonb_build_array(g.resumo->'equipes'->'vermelho'->'abates', g.resumo->'equipes'->'azul'->'abates') end,
             'torres', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'vermelho'->'torresPerdidas', g.resumo->'equipes'->'azul'->'torresPerdidas')
                            else jsonb_build_array(g.resumo->'equipes'->'azul'->'torresPerdidas', g.resumo->'equipes'->'vermelho'->'torresPerdidas') end,
             'dragoes', case when g.org_azul = p.org_a then jsonb_build_array(g.resumo->'equipes'->'azul'->'dragoes', g.resumo->'equipes'->'vermelho'->'dragoes')
                             else jsonb_build_array(g.resumo->'equipes'->'vermelho'->'dragoes', g.resumo->'equipes'->'azul'->'dragoes') end,
             'mvp', coalesce(g.resumo->'mvp'->>'nome', '')) order by g.mapa) from tc_gameplay_mapas g where g.partida_id = pid));
  update tc_partidas set status = 'concluida', placar_a = v_a, placar_b = v_b, vencedor = venc,
         poder_a = round(pa::numeric, 1), poder_b = round(pb::numeric, 1), resumo = res, processada = now()
   where id = pid;
  update tc_jogadores set forma = least(75, forma + 4), exp = exp + 1 where org_id = venc and slot is not null;
  update tc_jogadores set forma = greatest(25, forma - 4), exp = exp + 1 where org_id = perd and slot is not null;
  return jsonb_build_object('concluida', true, 'placar_a', v_a, 'placar_b', v_b, 'vencedor', venc);
end;
$$;
revoke all on function public.tc_gameplay_registrar(bigint, int, jsonb) from public, anon;
grant execute on function public.tc_gameplay_registrar(bigint, int, jsonb) to authenticated;

-- Partida de técnico real à espera do gameplay (a mais antiga já liberada), para o botão "Jogar partida".
create or replace function public.tc_gameplay_pendente()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := tc_cfg('gameplay');
  meu bigint;
  p tc_partidas;
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then return jsonb_build_object('ativo', false); end if;
  select id into meu from tc_orgs where user_id = uid;
  if meu is null then return jsonb_build_object('ativo', true, 'partida', null); end if;
  select * into p from tc_partidas where status = 'agendada' and dia <= site_hoje_br() and meu in (org_a, org_b) order by dia, id limit 1;
  return jsonb_build_object('ativo', true, 'partida', case when p.id is null then null else tc_partida_json(p) end,
                            'proximo', case when p.id is null then null else tc_gameplay_proximo(p.id) end);
end;
$$;
revoke all on function public.tc_gameplay_pendente() from public, anon;
grant execute on function public.tc_gameplay_pendente() to authenticated;

-- Processamento das partidas pelo sistema: passa a esperar o gameplay (dentro do prazo) nas partidas de técnicos reais.
create or replace function public.tc_processar_partida(pid bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  p tc_partidas;
  r jsonb;
  pa double precision;
  pb double precision;
  venc bigint;
  perd bigint;
begin
  select * into p from tc_partidas where id = pid for update;
  if p.id is null or p.status <> 'agendada' then
    return false;
  end if;
  -- gameplay ligado: o técnico joga a partida no navegador; o sistema só simula depois do prazo
  if coalesce((tc_cfg('gameplay')->>'ativo')::boolean, false)
     and exists (select 1 from tc_orgs where id in (p.org_a, p.org_b) and user_id is not null)
     and site_hoje_br() < p.dia + coalesce((tc_cfg('gameplay')->>'prazo_dias')::int, 1) then
    return false;
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
  update tc_jogadores set forma = least(75, forma + 4), exp = exp + 1 where org_id = venc and slot is not null;
  update tc_jogadores set forma = greatest(25, forma - 4), exp = exp + 1 where org_id = perd and slot is not null;
  return true;
end;
$$;
revoke all on function public.tc_processar_partida(bigint) from public, anon, authenticated;
