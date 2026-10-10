-- Modelos de código de recompensa: o administrador salva um conjunto de
-- recompensas (ex.: "Streamer" = ícone + efeito) e reaproveita ao criar códigos.
-- Rodar depois da 0035. Rodar de novo é seguro.

create table if not exists public.site_codigo_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(nome) between 1 and 60),
  recompensas jsonb not null check (jsonb_typeof(recompensas) = 'array' and jsonb_array_length(recompensas) between 1 and 10),
  criado timestamptz not null default now()
);
alter table public.site_codigo_modelos enable row level security;
revoke all on public.site_codigo_modelos from anon, authenticated;

-- Já vem com o modelo dos streamers (ícone + efeito).
insert into public.site_codigo_modelos (nome, recompensas)
values ('Streamer', '[{"tipo":"icone","chave":"exc-streamer"},{"tipo":"efeito","chave":"st-nebulosa"}]'::jsonb)
on conflict (nome) do nothing;

create or replace function public.site_admin_modelos()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'recompensas', m.recompensas) order by m.nome)
                     from site_codigo_modelos m), '[]'::jsonb);
end;
$$;
revoke all on function public.site_admin_modelos() from public, anon;
grant execute on function public.site_admin_modelos() to authenticated;

-- Salva (ou atualiza, se o nome já existir) um modelo.
create or replace function public.site_admin_modelo_salvar(nome text, recompensas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n text := trim(coalesce(nome, ''));
  lista jsonb;
  m site_codigo_modelos;
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  if char_length(n) < 1 or char_length(n) > 60 then
    raise exception 'nome_invalido';
  end if;
  lista := site_recompensas_validar(recompensas);
  insert into site_codigo_modelos (nome, recompensas) values (n, lista)
  on conflict (nome) do update set recompensas = excluded.recompensas
  returning * into m;
  return jsonb_build_object('id', m.id, 'nome', m.nome, 'recompensas', m.recompensas);
end;
$$;
revoke all on function public.site_admin_modelo_salvar(text, jsonb) from public, anon;
grant execute on function public.site_admin_modelo_salvar(text, jsonb) to authenticated;

create or replace function public.site_admin_modelo_apagar(id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(site_is_admin(), false) then
    raise exception 'not_admin';
  end if;
  delete from site_codigo_modelos m where m.id = site_admin_modelo_apagar.id;
end;
$$;
revoke all on function public.site_admin_modelo_apagar(uuid) from public, anon;
grant execute on function public.site_admin_modelo_apagar(uuid) to authenticated;
