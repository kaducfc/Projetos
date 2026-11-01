-- Simulador de Técnico: ao demitir um Legado, as cópias repetidas que ele tem também viram fragmentos (cada cópia vale o mesmo que a demissão do jogador: a base da raridade). Rode depois do 0153. Idempotente.
-- Total da demissão = base + (cópias x base) + metade dos fragmentos gastos em estrelas.
create or replace function public.tc_fragmentos_demissao(j tc_jogadores)
returns int language sql stable security definer set search_path = public as $$
  select tc_frag_base(j) * (1 + case when j.ficticio then 0 else j.copias end)
         + round(j.frag_gastos * ((tc_cfg('estrelas_jogador'))->>'devolucao_pct')::numeric / 100)::int;
$$;
revoke all on function public.tc_fragmentos_demissao(tc_jogadores) from public, anon, authenticated;

-- Demitir só parte das cópias repetidas de um Legado: cada cópia vira a base de fragmentos da raridade e o jogador continua com você (titular ou não).
create or replace function public.tc_demitir_copias(jogador bigint, qtd int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  j tc_jogadores;
  ganho int;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid for update;
  if o.id is null then raise exception 'sem_org'; end if;
  select * into j from tc_jogadores where id = jogador for update;
  if j.id is null or j.org_id is distinct from o.id then raise exception 'jogador_nao_e_seu'; end if;
  if j.ficticio then raise exception 'sem_copias'; end if;
  if qtd is null or qtd < 1 or qtd > j.copias then raise exception 'copias_insuficientes'; end if;
  ganho := tc_frag_base(j) * qtd;
  update tc_jogadores set copias = copias - qtd where id = j.id;
  update tc_orgs set fragmentos = fragmentos + ganho where id = o.id;
  select * into j from tc_jogadores where id = j.id;
  perform tc_avisar(o.id, qtd::text || ' cópia(s) de ' || j.nome || ' demitida(s): +' || ganho::text || ' fragmentos de jogador.');
  return jsonb_build_object('ok', true, 'fragmentos_ganhos', ganho, 'copias', j.copias, 'fragmentos', (select fragmentos from tc_orgs where id = o.id), 'jogador', tc_jogador_json(j));
end;
$$;
revoke all on function public.tc_demitir_copias(bigint, int) from public, anon;
grant execute on function public.tc_demitir_copias(bigint, int) to authenticated;
