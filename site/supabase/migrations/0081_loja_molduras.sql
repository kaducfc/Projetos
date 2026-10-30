-- Molduras à venda na loja de Rift Coins (mesma loja do 0055: site_loja + site_loja_comprar, tipo 'moldura').
-- Robô de Batalha 10.000 RC, Neon Hextech 6.000 RC, Poro da Floresta 2.000 RC.
-- Depois de comprar, é só equipar em Meu perfil → Moldura. Rodar de novo é seguro.
insert into public.site_loja (tipo, chave, preco) values
  ('moldura', 'mn-robo', 10000),
  ('moldura', 'mn-hextech', 6000),
  ('moldura', 'mn-poro', 2000)
on conflict (tipo, chave) do update set preco = excluded.preco, ativo = true;
