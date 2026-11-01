-- Conferência do draft das partidas oficiais (versão leve).
--   * Antes de registrar o resultado de um mapa, o navegador envia os picks e os bans (tc_gameplay_draft). O servidor confere que o draft é
--     válido: 5 picks por equipe (um por posição), 5 bans por equipe, só campeões que existem, sem repetir campeão e sem pick de campeão banido.
--   * Ao gravar o mapa, o servidor confere que os campeões que jogaram (por equipe e posição) são exatamente os dos picks enviados.
--   * Sem draft válido o resultado do mapa não é gravado ('draft_invalido' / 'draft_nao_enviado' / 'draft_diferente_da_partida').
--   O servidor não acompanha a ordem nem o tempo do draft (isso continua no navegador).
-- Rode depois da 0125; seguro rodar de novo.

create table if not exists public.tc_gameplay_drafts (
  partida_id bigint not null references public.tc_partidas(id) on delete cascade,
  mapa int not null check (mapa between 1 and 5),
  draft jsonb not null,
  enviado_por uuid,
  criado timestamptz not null default now(),
  primary key (partida_id, mapa)
);
alter table public.tc_gameplay_drafts enable row level security;
revoke all on public.tc_gameplay_drafts from anon, authenticated;

-- Devolve o draft reconstruído (só nomes de campeões que existem) ou null se for inválido.
create or replace function public.tc_draft_limpo(d jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  lado text; v text; n text;
  usados text[] := '{}';
  out jsonb := jsonb_build_object('picks', '{}'::jsonb, 'bans', '{}'::jsonb);
  picks jsonb; bans jsonb;
  banidos text[] := '{}';
begin
  if jsonb_typeof(d) <> 'object' then return null; end if;
  foreach lado in array array['azul', 'vermelho'] loop
    if jsonb_typeof(d->'bans'->lado) <> 'array' or jsonb_array_length(d->'bans'->lado) <> 5 then return null; end if;
    bans := '[]'::jsonb;
    for n in select jsonb_array_elements_text(d->'bans'->lado) loop
      if n is null or not exists (select 1 from tc_campeoes where nome = n) or n = any(usados) then return null; end if;
      usados := usados || n; banidos := banidos || n; bans := bans || to_jsonb(n);
    end loop;
    out := jsonb_set(out, array['bans', lado], bans);
  end loop;
  foreach lado in array array['azul', 'vermelho'] loop
    picks := '{}'::jsonb;
    foreach v in array array['top', 'selva', 'meio', 'atirador', 'suporte'] loop
      n := d->'picks'->lado->>v;
      if n is null or not exists (select 1 from tc_campeoes where nome = n) or n = any(usados) then return null; end if;
      usados := usados || n; picks := picks || jsonb_build_object(v, n);
    end loop;
    out := jsonb_set(out, array['picks', lado], picks);
  end loop;
  return out;
end;
$$;
revoke all on function public.tc_draft_limpo(jsonb) from public, anon, authenticated;

create or replace function public.tc_gameplay_draft(pid bigint, mapa_ int, draft jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p tc_partidas;
  cfg jsonb := tc_cfg('gameplay');
  prox jsonb;
  limpo jsonb;
begin
  perform tc_exigir(uid);
  if not coalesce((cfg->>'ativo')::boolean, false) then raise exception 'gameplay_desligado'; end if;
  select * into p from tc_partidas where id = pid for update;
  if p.id is null then raise exception 'partida_inexistente'; end if;
  if not tc_gameplay_pode(p, uid) then raise exception 'partida_nao_e_sua'; end if;
  if p.status <> 'agendada' then raise exception 'partida_ja_concluida'; end if;
  prox := tc_gameplay_proximo(pid);
  if mapa_ <> (prox->>'mapa')::int then raise exception 'mapa_fora_de_ordem'; end if;
  if not (prox->>'lado_definido')::boolean then raise exception 'lado_nao_escolhido'; end if;
  limpo := tc_draft_limpo(draft);
  if limpo is null then raise exception 'draft_invalido'; end if;
  insert into tc_gameplay_drafts (partida_id, mapa, draft, enviado_por) values (pid, mapa_, limpo, uid)
  on conflict (partida_id, mapa) do update set draft = excluded.draft, enviado_por = excluded.enviado_por, criado = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.tc_gameplay_draft(bigint, int, jsonb) from public, anon;
grant execute on function public.tc_gameplay_draft(bigint, int, jsonb) to authenticated;

-- Na hora de gravar o mapa: os campeões que jogaram são os do draft enviado. Roda depois da limpeza do resumo (ordem alfabética dos gatilhos).
create or replace function public.tc_gameplay_draft_confere()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d jsonb; x jsonb; n int := 0;
begin
  select draft into d from tc_gameplay_drafts where partida_id = new.partida_id and mapa = new.mapa;
  if d is null then raise exception 'draft_nao_enviado'; end if;
  for x in select * from jsonb_array_elements(coalesce(new.resumo->'jogadores', '[]'::jsonb)) loop
    if x->>'campeao' is distinct from d->'picks'->(x->>'equipe')->>(x->>'pos') then raise exception 'draft_diferente_da_partida'; end if;
    n := n + 1;
  end loop;
  if n <> 10 then raise exception 'draft_diferente_da_partida'; end if;
  new.resumo := new.resumo || jsonb_build_object('draft', d);
  return new;
end;
$$;
revoke all on function public.tc_gameplay_draft_confere() from public, anon, authenticated;
drop trigger if exists tc_gameplay_zdraft_tg on public.tc_gameplay_mapas;
create trigger tc_gameplay_zdraft_tg before insert on public.tc_gameplay_mapas for each row execute function public.tc_gameplay_draft_confere();
