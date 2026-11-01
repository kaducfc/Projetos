-- Simulador de Técnico: posições padrão dos campeões ajustadas à mão.
-- Idempotente. Para corrigir um campeão: edite a lista abaixo (uma linha por campeão) e rode ESTE arquivo de novo.
-- Rode-o também sempre que reexecutar 0090 (que volta as posições do catálogo original).
-- Administradores também mudam posições dentro do jogo (aba Campeões): essas trocas ficam em tc_posicoes_manual e
-- são reaplicadas por este arquivo DEPOIS da lista abaixo (a troca feita no jogo vale mais que a lista).
--
--   id:        nome do campeão em minúsculas, sem espaços/acentos/símbolos (o mesmo id de tc_campeoes: 'naafiri', 'leesin', 'kaisa'...)
--   posições:  top, selva, meio, atirador, suporte (uma ou mais; a primeira é a principal)
--
-- Para consultar os ids/posições atuais:  select id, nome, posicoes from tc_campeoes order by nome;

create table if not exists public.tc_posicoes_manual (
  id text primary key references public.tc_campeoes(id) on delete cascade,
  posicoes text[] not null,
  atualizado_em timestamptz not null default now()
);
alter table public.tc_posicoes_manual enable row level security;
revoke all on public.tc_posicoes_manual from anon, authenticated;

-- Troca as posições de um campeão (só administradores; usada pela aba Campeões do jogo).
create or replace function public.tc_campeao_posicoes(cid text, pos text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  validas constant text[] := array['top', 'selva', 'meio', 'atirador', 'suporte'];
  limpas text[];
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from site_admins where user_id = uid) then raise exception 'not_admin'; end if;
  if pos is null or coalesce(array_length(pos, 1), 0) = 0 then raise exception 'posicoes_invalidas'; end if;
  if exists (select 1 from unnest(pos) e where e <> all (validas)) then raise exception 'posicoes_invalidas'; end if;
  limpas := array(select x from unnest(pos) with ordinality t(x, o) group by x order by min(o)); -- sem repetição, mantendo a ordem escolhida (a primeira é a principal)
  update tc_campeoes set posicoes = limpas where id = cid;
  if not found then raise exception 'campeao_inexistente'; end if;
  insert into tc_posicoes_manual (id, posicoes, atualizado_em) values (cid, limpas, now())
    on conflict (id) do update set posicoes = excluded.posicoes, atualizado_em = now();
  return jsonb_build_object('id', cid, 'posicoes', to_jsonb(limpas));
end;
$$;
revoke all on function public.tc_campeao_posicoes(text, text[]) from public, anon;
grant execute on function public.tc_campeao_posicoes(text, text[]) to authenticated;

do $$
declare
  ajustes constant jsonb := '{
    "naafiri": ["selva"]
  }'::jsonb;
  k text;
  p jsonb;
  validas constant text[] := array['top', 'selva', 'meio', 'atirador', 'suporte'];
begin
  for k, p in select * from jsonb_each(ajustes) loop
    if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) = 0
       or exists (select 1 from jsonb_array_elements_text(p) e where e <> all (validas)) then
      raise exception 'posições inválidas para %: use top, selva, meio, atirador ou suporte', k;
    end if;
    update tc_campeoes set posicoes = array(select jsonb_array_elements_text(p)) where id = k;
    if not found then raise exception 'campeão "%" não existe em tc_campeoes (confira o id com: select id, nome from tc_campeoes)', k; end if;
  end loop;
  -- trocas feitas dentro do jogo por administradores
  update tc_campeoes c set posicoes = m.posicoes from tc_posicoes_manual m where m.id = c.id;
end $$;
