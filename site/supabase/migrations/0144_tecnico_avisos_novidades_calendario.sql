-- Avisos e Novidades do jogo + Calendário dos campeonatos.
--   * Novidades: texto publicado por administradores (atualizações, avisos gerais). Cada técnico vê quais ainda não leu.
--   * Avisos pessoais passam a ser marcados como lidos quando o técnico abre a janela "Avisos" (o contador do sino volta a zero).
--   * Calendário: dados dos campeonatos (semanas, vagas, premiações) para a janela "Calendário".
-- Rode depois da 0143; seguro rodar de novo.

create table if not exists public.tc_novidades (
  id bigserial primary key,
  titulo text not null check (char_length(titulo) between 1 and 80),
  texto text not null check (char_length(texto) between 1 and 1500),
  criado timestamptz not null default now(),
  autor uuid
);
alter table public.tc_novidades enable row level security;
revoke all on public.tc_novidades from anon, authenticated;
revoke all on sequence public.tc_novidades_id_seq from anon, authenticated;
alter table public.tc_orgs add column if not exists novidades_visto bigint not null default 0;
-- quem já tem time começa com as novidades existentes como "não lidas" só a partir de agora: marca o que já existe como visto
update public.tc_orgs set novidades_visto = coalesce((select max(id) from public.tc_novidades), 0) where novidades_visto = 0;

create or replace function public.tc_avisos_contagem()
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then return 0; end if;
  return (select count(*) from tc_avisos where org_id = o.id and not lido)::int
       + (select count(*) from tc_novidades where id > o.novidades_visto)::int;
end;
$$;
revoke all on function public.tc_avisos_contagem() from public, anon;
grant execute on function public.tc_avisos_contagem() to authenticated;

-- Abre a janela de avisos: devolve as novidades e os avisos pessoais (com o que era novo) e marca tudo como lido.
create or replace function public.tc_avisos_central()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o tc_orgs;
  res jsonb;
begin
  perform tc_exigir(uid);
  select * into o from tc_orgs where user_id = uid;
  if o.id is null then return jsonb_build_object('novidades', '[]'::jsonb, 'avisos', '[]'::jsonb); end if;
  res := jsonb_build_object(
    'novidades', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'titulo', n.titulo, 'texto', n.texto, 'criado', n.criado, 'novo', n.id > o.novidades_visto) order by n.id desc)
                             from (select * from tc_novidades order by id desc limit 30) n), '[]'::jsonb),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'texto', a.texto, 'criado', a.criado, 'novo', not a.lido) order by a.id desc)
                          from (select * from tc_avisos where org_id = o.id order by id desc limit 30) a), '[]'::jsonb));
  update tc_avisos set lido = true where org_id = o.id and not lido;
  update tc_orgs set novidades_visto = greatest(novidades_visto, coalesce((select max(id) from tc_novidades), 0)) where id = o.id;
  return res;
end;
$$;
revoke all on function public.tc_avisos_central() from public, anon;
grant execute on function public.tc_avisos_central() to authenticated;

create or replace function public.tc_adm_novidade_publicar(titulo_ text, texto_ text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t text := trim(coalesce(titulo_, ''));
  x text := trim(coalesce(texto_, ''));
  nid bigint;
begin
  perform tc_adm_exigir();
  if char_length(t) < 1 or char_length(t) > 80 or char_length(x) < 1 or char_length(x) > 1500 then raise exception 'novidade_invalida'; end if;
  insert into tc_novidades (titulo, texto, autor) values (t, x, auth.uid()) returning id into nid;
  return jsonb_build_object('id', nid);
end;
$$;
revoke all on function public.tc_adm_novidade_publicar(text, text) from public, anon;
grant execute on function public.tc_adm_novidade_publicar(text, text) to authenticated;

create or replace function public.tc_adm_novidade_apagar(nid bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform tc_adm_exigir();
  delete from tc_novidades where id = nid;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.tc_adm_novidade_apagar(bigint) from public, anon;
grant execute on function public.tc_adm_novidade_apagar(bigint) to authenticated;

-- Janela "Calendário": semana atual, nomes, premiações e as vagas internacionais do técnico.
create or replace function public.tc_calendario_competicoes()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cal jsonb := tc_calendario();
  oid bigint;
begin
  perform tc_exigir(uid);
  select id into oid from tc_orgs where user_id = uid;
  return jsonb_build_object('calendario', cal, 'nomes', tc_cfg('nomes'), 'premios_intl', tc_cfg('premios_intl'), 'premios', tc_cfg('premios'),
    'vagas', coalesce((select jsonb_agg(jsonb_build_object('temporada', v.temporada, 'tipo', v.tipo) order by v.temporada, v.tipo) from tc_vagas v
                        where v.org_id = oid and v.temporada >= coalesce((cal->>'temporada')::int, 1)), '[]'::jsonb));
end;
$$;
revoke all on function public.tc_calendario_competicoes() from public, anon;
grant execute on function public.tc_calendario_competicoes() to authenticated;
