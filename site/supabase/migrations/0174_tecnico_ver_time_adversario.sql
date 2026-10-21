-- Ver o time titular de qualquer equipe ativa (técnico real ou do sistema), por exemplo ao clicar na classificação.
-- Antes só valia para técnicos reais (Rank). Rodar de novo é seguro.
create or replace function public.tc_rank_time(org bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where id = org and ativa;
  if o.id is null then raise exception 'org_invalida'; end if;
  return jsonb_build_object('org', tc_org_json(o.id), 'poder', round(tc_poder_org(o.id)::numeric, 1),
    'titulos', (select count(*) from tc_trofeus t where t.org_id = o.id),
    'titulares', coalesce((select jsonb_agg(tc_ficha_jogador(j.id) order by array_position(array['top', 'selva', 'meio', 'atirador', 'suporte'], j.slot))
                             from tc_jogadores j where j.org_id = o.id and j.slot is not null), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_rank_time(bigint) from public, anon;
grant execute on function public.tc_rank_time(bigint) to authenticated;
