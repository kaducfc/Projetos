-- Loja de Rift Coins: o efeito "Dado Corrompido" (gl-corrompido) passa a ser vendido por
-- 10.000 RC (mesma loja do 0055: site_loja + site_loja_comprar). Rodar de novo é seguro.
insert into public.site_loja (tipo, chave, preco) values ('efeito', 'gl-corrompido', 10000)
on conflict (tipo, chave) do update set preco = excluded.preco, ativo = true;
