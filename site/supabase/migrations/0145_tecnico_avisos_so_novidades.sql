-- A janela "Avisos" passa a ser só das novidades publicadas pelo ADM (atualizações, eventos...). O contador do sino conta só novidades não lidas;
-- os avisos pessoais do time continuam na tela Início. Rode depois da 0144; seguro rodar de novo.
create or replace function public.tc_avisos_contagem()
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then return 0; end if;
  return (select count(*) from tc_novidades where id > o.novidades_visto)::int;
end;
$$;
revoke all on function public.tc_avisos_contagem() from public, anon;
grant execute on function public.tc_avisos_contagem() to authenticated;

create or replace function public.tc_avisos_central()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  res jsonb;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then return jsonb_build_object('novidades', '[]'::jsonb); end if;
  res := jsonb_build_object(
    'novidades', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'titulo', n.titulo, 'texto', n.texto, 'criado', n.criado, 'novo', n.id > o.novidades_visto) order by n.id desc)
                             from (select * from tc_novidades order by id desc limit 30) n), '[]'::jsonb));
  update tc_orgs set novidades_visto = greatest(novidades_visto, coalesce((select max(id) from tc_novidades), 0)) where id = o.id;
  return res;
end;
$$;
revoke all on function public.tc_avisos_central() from public, anon;
grant execute on function public.tc_avisos_central() to authenticated;
