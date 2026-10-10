-- Loja de Rift Coins: o efeito "Cristal de Gelo" (nv-cristal) passa a ser vendido por 1.000 RC
-- (mesma loja do 0055: site_loja + site_loja_comprar). Rodar de novo é seguro.
insert into public.site_loja (tipo, chave, preco) values ('efeito', 'nv-cristal', 1000)
on conflict (tipo, chave) do update set preco = excluded.preco, ativo = true;
