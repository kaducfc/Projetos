-- Receita do marketing do dia: a cada ganho novo o lançamento do dia ("Marketing · Ganhos 18/10") sobe para o topo da lista.
-- Rode depois da 0136; seguro rodar de novo.

create or replace function public.tc_creditos_mexer(oid bigint, delta bigint, motivo_ text, ref_ text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  novo bigint;
  dia text;
  anterior bigint;
  soma bigint;
begin
  update tc_orgs set creditos = creditos + delta where id = oid returning creditos into novo;
  soma := delta;
  if motivo_ = 'mkt_receita' then
    dia := 'dia:' || site_hoje_br()::text;
    -- soma no lançamento do dia e o leva para o topo da lista (o lançamento é refeito, com o id mais novo)
    delete from tc_fin f where f.org_id = oid and f.motivo = 'mkt_receita' and f.ref = dia returning f.delta into anterior;
    soma := soma + coalesce(anterior, 0);
    ref_ := dia;
  end if;
  insert into tc_fin (org_id, delta, saldo, motivo, ref) values (oid, soma, novo, motivo_, ref_);
  return novo;
end;
$$;
revoke all on function public.tc_creditos_mexer(bigint, bigint, text, text) from public, anon, authenticated;
