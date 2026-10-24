-- Loja de Rift Coins: efeitos no nome comprados com moedas (cosmético, sem vantagem).
-- Por enquanto: "Brasa" (st-brasa) e "Galáxia" (st-galaxia), 2.000 RC cada.
-- * site_loja: o que está à venda e por quanto (só o servidor lê/escreve).
-- * site_loja_comprar(tipo, chave): desconta as moedas e libera o item na conta
--   (site_recompensas, origem 'loja'); depois é só equipar em Meu perfil → Efeito.
-- Rodar de novo é seguro.

create table if not exists public.site_loja (
  tipo text not null check (tipo in ('icone', 'efeito', 'moldura')),
  chave text not null check (chave ~ '^[a-z0-9-]{2,30}$'),
  preco bigint not null check (preco > 0),
  ativo boolean not null default true,
  primary key (tipo, chave)
);
alter table public.site_loja enable row level security;
revoke all on public.site_loja from anon, authenticated;

insert into public.site_loja (tipo, chave, preco) values
  ('efeito', 'st-brasa', 2000),
  ('efeito', 'st-galaxia', 2000)
on conflict (tipo, chave) do update set preco = excluded.preco, ativo = true;

create or replace function public.site_loja_comprar(p_tipo text, p_chave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  item site_loja;
  novo bigint;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into item from site_loja where tipo = p_tipo and chave = p_chave and ativo;
  if not found then
    raise exception 'item_indisponivel';
  end if;
  if exists (select 1 from site_recompensas r where r.user_id = uid and r.tipo = p_tipo and r.chave = p_chave) then
    raise exception 'ja_possui';
  end if;
  novo := site_moedas_mexer(uid, -item.preco, 'loja', p_tipo || ':' || p_chave);
  insert into site_recompensas (user_id, tipo, chave, origem) values (uid, p_tipo, p_chave, 'loja');
  return jsonb_build_object('saldo', novo, 'tipo', p_tipo, 'chave', p_chave);
end;
$$;
revoke all on function public.site_loja_comprar(text, text) from public, anon;
grant execute on function public.site_loja_comprar(text, text) to authenticated;
