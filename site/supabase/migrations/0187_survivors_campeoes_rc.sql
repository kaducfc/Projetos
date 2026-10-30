-- Rift Survivors: Lux e Ahri são liberadas com Rift Coins (1.000 RC cada), na mesma loja do 0055.
-- * site_loja e site_recompensas passam a aceitar o tipo 'campeao' (chave 'sv-<campeão>').
-- * A compra usa site_loja_comprar('campeao', 'sv-lux'): desconta as moedas e guarda na conta.
-- Rodar de novo é seguro.
alter table public.site_loja drop constraint if exists site_loja_tipo_check;
alter table public.site_loja add constraint site_loja_tipo_check
  check (tipo in ('icone', 'efeito', 'moldura', 'campeao'));

alter table public.site_recompensas drop constraint if exists site_recompensas_tipo_check;
alter table public.site_recompensas add constraint site_recompensas_tipo_check
  check (tipo in ('icone', 'efeito', 'moldura', 'campeao'));

insert into public.site_loja (tipo, chave, preco) values
  ('campeao', 'sv-lux', 1000),
  ('campeao', 'sv-ahri', 1000)
on conflict (tipo, chave) do update set preco = excluded.preco, ativo = true;
