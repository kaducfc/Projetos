-- Simulador de Técnico: o Rank de Poder passa a mostrar também a competição atual de cada técnico (internacional em andamento primeiro; senão a liga de divisão). Rode depois do 0158. Idempotente.
create or replace function public.tc_rank_poder()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  meu bigint;
begin
  perform tc_exigir(uid);
  select id into meu from tc_orgs where user_id = uid;
  return coalesce((
    with r as (
      select o.id, tc_poder_org(o.id) as p, (select count(*) from tc_trofeus t where t.org_id = o.id) as tit,
             (select l.nome from tc_liga_times lt join tc_ligas l on l.id = lt.liga_id
               where lt.org_id = o.id order by (l.status = 'aberta') desc, (l.tipo <> 'divisao') desc, l.id desc limit 1) as comp
        from tc_orgs o where o.user_id is not null and o.ativa
    ), k as (select r.*, row_number() over (order by r.p desc, r.tit desc, r.id) as pos from r)
    select jsonb_agg(jsonb_build_object('pos', k.pos, 'org', tc_org_json(k.id), 'poder', round(k.p::numeric, 1), 'titulos', k.tit, 'competicao', k.comp, 'meu', k.id = meu) order by k.pos)
      from k where k.pos <= 200), '[]'::jsonb);
end;
$$;
revoke all on function public.tc_rank_poder() from public, anon;
grant execute on function public.tc_rank_poder() to authenticated;
