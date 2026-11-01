-- Rift Survivors: o progresso permanente (essência, campeões liberados, melhorias, recordes e reinos vencidos)
-- fica salvo na conta, para valer em qualquer aparelho. O navegador continua guardando uma cópia local.
-- Cada conta tem uma única linha. `rev` é a hora da última alteração (em milissegundos): vence sempre a mais recente.
-- Rode uma vez no editor SQL do Supabase; é seguro rodar de novo.

create table if not exists public.sv_progresso (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  rev        bigint not null default 0,
  dados      jsonb  not null,
  atualizado timestamptz not null default now()
);
alter table public.sv_progresso enable row level security;
-- sem políticas: ninguém lê nem escreve a tabela direto; só pelas funções abaixo.
revoke all on public.sv_progresso from public, anon, authenticated;

-- Devolve { rev, dados } da conta, ou null se ainda não há nada salvo.
create or replace function public.sv_carregar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r sv_progresso;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into r from sv_progresso where user_id = uid;
  if r.user_id is null then return null; end if;
  return jsonb_build_object('rev', r.rev, 'dados', r.dados);
end;
$$;

-- Salva o progresso se `p_rev` for mais novo que o do servidor. Devolve { ok, rev } (rev = o que ficou no servidor).
create or replace function public.sv_salvar(p_rev bigint, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  atual bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then raise exception 'dados_invalidos'; end if;
  if p_rev is null or p_rev <= 0 then raise exception 'rev_invalida'; end if;
  if length(p_dados::text) > 40000 then raise exception 'dados_grandes'; end if;
  -- números básicos precisam ser números válidos e não negativos
  if jsonb_typeof(p_dados -> 'essencia') is distinct from 'number' or (p_dados ->> 'essencia')::numeric < 0 then raise exception 'dados_invalidos'; end if;
  if jsonb_typeof(p_dados -> 'liberados') is distinct from 'array' then raise exception 'dados_invalidos'; end if;

  select rev into atual from sv_progresso where user_id = uid for update;
  if atual is not null and atual >= p_rev then
    return jsonb_build_object('ok', false, 'rev', atual);
  end if;
  insert into sv_progresso (user_id, rev, dados, atualizado) values (uid, p_rev, p_dados, now())
  on conflict (user_id) do update set rev = excluded.rev, dados = excluded.dados, atualizado = now();
  return jsonb_build_object('ok', true, 'rev', p_rev);
end;
$$;

revoke all on function public.sv_carregar() from public, anon;
revoke all on function public.sv_salvar(bigint, jsonb) from public, anon;
grant execute on function public.sv_carregar() to authenticated;
grant execute on function public.sv_salvar(bigint, jsonb) to authenticated;
