-- Painel ADM do Simulador de Técnico: listar todos os jogadores do jogo e editar nome e atributos (só administradores).
-- Rode depois da 0122; seguro rodar de novo.

create or replace function public.tc_adm_exigir()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from site_admins where user_id = auth.uid()) then
    raise exception 'not_admin';
  end if;
end;
$$;
revoke all on function public.tc_adm_exigir() from public, anon, authenticated;

-- Jogador como o painel ADM o vê: atributos, OVR (Poder) e os pesos da posição (o navegador recalcula o OVR com eles).
create or replace function public.tc_adm_jogador_json(j tc_jogadores)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  w double precision[] := tc_pesos(j.pos);
  o tc_orgs;
begin
  select * into o from tc_orgs where id = j.org_id;
  return jsonb_build_object('id', j.id, 'nome', j.nome, 'pos', j.pos, 'ficticio', j.ficticio, 'idade', j.idade, 'potencial', j.potencial, 'fama', j.fama, 'retrato', j.retrato,
    'mec', j.mec, 'rotas', j.rotas, 'macro', j.macro, 'tf', j.tf, 'mental', j.mental,
    'ovr', round(tc_poder(j)::numeric, 1), 'pesos', to_jsonb(w),
    'time', case when o.id is null then null else jsonb_build_object('id', o.id, 'nome', o.nome, 'sigla', o.sigla, 'tecnico', o.user_id is not null) end);
end;
$$;
revoke all on function public.tc_adm_jogador_json(tc_jogadores) from public, anon, authenticated;

-- Lista paginada (40 por página) com busca por nome, posição e dono (livres / de equipes / de técnicos / legados).
create or replace function public.tc_adm_jogadores(f jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pag int := greatest(0, coalesce((f->>'pagina')::int, 0));
  tot int;
  itens jsonb;
  busca text := nullif(trim(coalesce(f->>'busca', '')), '');
  pos_ text := nullif(f->>'pos', '');
  dono text := nullif(f->>'dono', '');
begin
  perform tc_adm_exigir();
  select count(*) into tot from tc_jogadores j
   where (busca is null or j.nome ilike '%' || replace(replace(busca, '%', ''), '_', '') || '%')
     and (pos_ is null or j.pos = pos_)
     and (dono is null or (dono = 'livre' and j.org_id is null) or (dono = 'tecnico' and exists (select 1 from tc_orgs o where o.id = j.org_id and o.user_id is not null))
          or (dono = 'sistema' and exists (select 1 from tc_orgs o where o.id = j.org_id and o.user_id is null)) or (dono = 'legado' and not j.ficticio));
  select coalesce(jsonb_agg(tc_adm_jogador_json(x) order by x.id), '[]'::jsonb) into itens from (
    select j.* from tc_jogadores j
     where (busca is null or j.nome ilike '%' || replace(replace(busca, '%', ''), '_', '') || '%')
       and (pos_ is null or j.pos = pos_)
       and (dono is null or (dono = 'livre' and j.org_id is null) or (dono = 'tecnico' and exists (select 1 from tc_orgs o where o.id = j.org_id and o.user_id is not null))
            or (dono = 'sistema' and exists (select 1 from tc_orgs o where o.id = j.org_id and o.user_id is null)) or (dono = 'legado' and not j.ficticio))
     order by j.id limit 40 offset pag * 40) x;
  return jsonb_build_object('total', tot, 'pagina', pag, 'por_pagina', 40, 'itens', itens);
end;
$$;
revoke all on function public.tc_adm_jogadores(jsonb) from public, anon;
grant execute on function public.tc_adm_jogadores(jsonb) to authenticated;

-- Edita nome e atributos. O OVR é sempre calculado dos atributos (média ponderada da posição); o navegador converte um OVR digitado
-- em atributos antes de enviar. Se o OVR passar do potencial, o potencial sobe junto.
create or replace function public.tc_adm_jogador_editar(jid bigint, nome_ text, mec_ int, rotas_ int, macro_ int, tf_ int, mental_ int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  j tc_jogadores;
  n text := trim(coalesce(nome_, ''));
  ovr double precision;
begin
  perform tc_adm_exigir();
  if char_length(n) not between 2 and 24 then raise exception 'jogador_nome_invalido'; end if;
  if least(mec_, rotas_, macro_, tf_, mental_) < 1 or greatest(mec_, rotas_, macro_, tf_, mental_) > 100 then raise exception 'atributo_invalido'; end if;
  select * into j from tc_jogadores where id = jid for update;
  if j.id is null then raise exception 'jogador_inexistente'; end if;
  update tc_jogadores set nome = n, mec = mec_, rotas = rotas_, macro = macro_, tf = tf_, mental = mental_ where id = jid returning * into j;
  ovr := tc_poder(j);
  if j.potencial < ceil(ovr) then update tc_jogadores set potencial = least(100, ceil(ovr)::int) where id = jid returning * into j; end if;
  return tc_adm_jogador_json(j);
exception when unique_violation then
  raise exception 'jogador_nome_em_uso';
end;
$$;
revoke all on function public.tc_adm_jogador_editar(bigint, text, int, int, int, int, int) from public, anon;
grant execute on function public.tc_adm_jogador_editar(bigint, text, int, int, int, int, int) to authenticated;
