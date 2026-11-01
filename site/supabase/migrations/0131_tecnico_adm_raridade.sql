-- ADM: alterar a raridade de um jogador legado (comum, raro, épico, lendário, mítico). Só administradores.
-- A raridade muda no modelo do catálogo e nas cópias que os técnicos já têm.
-- Rode depois da 0130; seguro rodar de novo.

create or replace function public.tc_adm_jogador_json(j tc_jogadores)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  w double precision[] := tc_pesos(j.pos);
  o tc_orgs;
begin
  select * into o from tc_orgs where id = j.org_id;
  return jsonb_build_object('id', j.id, 'nome', j.nome, 'pos', j.pos, 'ficticio', j.ficticio, 'idade', j.idade, 'potencial', j.potencial, 'fama', j.fama, 'retrato', j.retrato,
    'raridade', j.raridade, 'modelo', (not j.ficticio and j.legado_base is null),
    'mec', j.mec, 'rotas', j.rotas, 'macro', j.macro, 'tf', j.tf, 'mental', j.mental,
    'ovr', round(tc_poder(j)::numeric, 1), 'pesos', to_jsonb(w),
    'time', case when o.id is null then null else jsonb_build_object('id', o.id, 'nome', o.nome, 'sigla', o.sigla, 'tecnico', o.user_id is not null) end);
end;
$$;
revoke all on function public.tc_adm_jogador_json(tc_jogadores) from public, anon, authenticated;

create or replace function public.tc_adm_jogador_raridade(jid bigint, rar text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  j tc_jogadores;
  copias int := 0;
begin
  perform tc_adm_exigir();
  if rar not in ('comum', 'raro', 'epico', 'lendario', 'mitico') then raise exception 'raridade_invalida'; end if;
  select * into j from tc_jogadores where id = jid for update;
  if j.id is null then raise exception 'jogador_inexistente'; end if;
  if j.ficticio then raise exception 'so_legado'; end if;
  update tc_jogadores set raridade = rar where id = jid or (j.legado_base is null and legado_base = jid) or (j.legado_base is not null and id = j.legado_base);
  get diagnostics copias = row_count;
  select * into j from tc_jogadores where id = jid;
  return tc_adm_jogador_json(j) || jsonb_build_object('atualizados', copias);
end;
$$;
revoke all on function public.tc_adm_jogador_raridade(bigint, text) from public, anon;
grant execute on function public.tc_adm_jogador_raridade(bigint, text) to authenticated;
