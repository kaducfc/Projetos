-- Simulador de Técnico: Rank de Poder dos técnicos reais (só leitura). Rode depois do 0157. Idempotente.
--  * tc_rank_poder(): lista dos times de técnicos reais ordenada pelo Poder da equipe (empate: mais títulos), com posição, time, escudo e número de títulos.
--  * tc_rank_time(org): o time titular de um técnico real (os 5 jogadores com atributos, estrelas e maestria dos campeões).

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
      select o.id, tc_poder_org(o.id) as p, (select count(*) from tc_trofeus t where t.org_id = o.id) as tit
        from tc_orgs o where o.user_id is not null and o.ativa
    ), k as (select r.*, row_number() over (order by r.p desc, r.tit desc, r.id) as pos from r)
    select jsonb_agg(jsonb_build_object('pos', k.pos, 'org', tc_org_json(k.id), 'poder', round(k.p::numeric, 1), 'titulos', k.tit, 'meu', k.id = meu) order by k.pos)
      from k where k.pos <= 200), '[]'::jsonb);
end;
$$;
revoke all on function public.tc_rank_poder() from public, anon;
grant execute on function public.tc_rank_poder() to authenticated;

create or replace function public.tc_rank_time(org bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where id = org and user_id is not null and ativa;
  if o.id is null then raise exception 'org_invalida'; end if;
  return jsonb_build_object('org', tc_org_json(o.id), 'poder', round(tc_poder_org(o.id)::numeric, 1),
    'titulos', (select count(*) from tc_trofeus t where t.org_id = o.id),
    'titulares', coalesce((select jsonb_agg(tc_ficha_jogador(j.id) order by array_position(array['top', 'selva', 'meio', 'atirador', 'suporte'], j.slot))
                             from tc_jogadores j where j.org_id = o.id and j.slot is not null), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_rank_time(bigint) from public, anon;
grant execute on function public.tc_rank_time(bigint) to authenticated;
