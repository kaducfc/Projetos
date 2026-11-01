-- Passe Premium: compra única, só com dinheiro (R$ 15 no Mercado Pago para quem usa o
-- site em português do Brasil; US$ 10 no Stripe para os outros idiomas). A compra
-- vira uma linha em site_passe_compras; quando o aviso do Mercado Pago/Stripe confirma o
-- pagamento, as Edge Functions chamam site_passe_confirmar_compra, que liga a coluna
-- `premium` do progresso do passe. Estorno desliga o premium (as recompensas já
-- resgatadas ficam). Só as Edge Functions (chave de serviço) mexem nestas tabelas.
--
-- Como aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique em Run
-- (depois da 0041). Rodar de novo é seguro.

create table if not exists public.site_passe_compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  passe text not null references public.site_passes(id) on delete cascade,
  provedor text not null check (provedor in ('mercadopago', 'stripe')),
  moeda text not null check (moeda in ('BRL', 'USD')),
  valor numeric(10, 2) not null check (valor > 0),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'cancelado', 'estornado')),
  ext_id text,
  pagamento_id text unique,
  criado timestamptz not null default now(),
  atualizado timestamptz not null default now()
);
create index if not exists site_passe_compras_user on public.site_passe_compras (user_id, criado desc);
alter table public.site_passe_compras enable row level security;
revoke all on public.site_passe_compras from anon, authenticated;
grant select, insert, update on public.site_passe_compras to service_role;

-- A conta pode comprar? (passe existe e está disponível para ela; ainda não é premium.)
-- Só a Edge Function (chave de serviço) chama.
create or replace function public.site_passe_pode_comprar(uid uuid, pid text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p site_passes;
begin
  select * into p from site_passes where id = pid;
  if p.id is null or not site_passe_acessivel(p, uid) then
    return 'passe_indisponivel';
  end if;
  if exists (select 1 from site_passe_progresso r where r.user_id = uid and r.passe = pid and r.premium) then
    return 'ja_premium';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.site_passe_pode_comprar(uuid, text) from public, anon, authenticated;
grant execute on function public.site_passe_pode_comprar(uuid, text) to service_role;

-- Atualiza a compra (pelo id ou pelo número do pagamento) e liga/desliga o premium.
-- Avisos chegam fora de ordem: aprovado não volta para pendente/recusado, e estorno só
-- vale para compra aprovada.
create or replace function public.site_passe_confirmar_compra(cid uuid default null, novo_status text default null, pag text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c site_passe_compras;
begin
  if novo_status not in ('pendente', 'aprovado', 'recusado', 'cancelado', 'estornado') then
    raise exception 'status_invalido';
  end if;
  if cid is not null then
    select * into c from site_passe_compras where id = cid for update;
  elsif pag is not null then
    select * into c from site_passe_compras where pagamento_id = pag for update;
  end if;
  if c.id is null then
    return 'nao_encontrada';
  end if;
  if novo_status = 'aprovado' then
    update site_passe_compras set status = 'aprovado', pagamento_id = coalesce(pag, pagamento_id), atualizado = now() where id = c.id;
    insert into site_passe_progresso (user_id, passe, premium, premium_desde) values (c.user_id, c.passe, true, now())
    on conflict (user_id, passe) do update set premium = true, premium_desde = coalesce(site_passe_progresso.premium_desde, now());
  elsif novo_status = 'estornado' then
    if c.status <> 'aprovado' then
      return 'ignorado';
    end if;
    update site_passe_compras set status = 'estornado', atualizado = now() where id = c.id;
    if not exists (select 1 from site_passe_compras x where x.user_id = c.user_id and x.passe = c.passe and x.status = 'aprovado') then
      update site_passe_progresso set premium = false where user_id = c.user_id and passe = c.passe;
    end if;
  else
    if c.status in ('aprovado', 'estornado') then
      return 'ignorado';
    end if;
    update site_passe_compras set status = novo_status, atualizado = now() where id = c.id;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.site_passe_confirmar_compra(uuid, text, text) from public, anon, authenticated;
grant execute on function public.site_passe_confirmar_compra(uuid, text, text) to service_role;
