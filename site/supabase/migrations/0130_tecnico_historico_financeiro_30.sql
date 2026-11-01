-- Histórico financeiro: só os últimos 30 lançamentos.
-- Rode depois da 0129; seguro rodar de novo.

create or replace function public.tc_marketing_historico()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then raise exception 'sem_org'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'delta', f.delta, 'saldo', f.saldo, 'motivo', f.motivo, 'ref', f.ref, 'criado', f.criado) order by f.id desc)
                     from (select * from tc_fin where org_id = o.id order by id desc limit 30) f), '[]'::jsonb);
end;
$$;
revoke all on function public.tc_marketing_historico() from public, anon;
grant execute on function public.tc_marketing_historico() to authenticated;
