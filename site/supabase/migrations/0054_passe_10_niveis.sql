-- Passe Halloween 2026 encurtado para 10 níveis. O jogador começa no nível 0 (sem
-- recompensa) e a primeira recompensa é a do nível 1. Ímpares = grátis, pares = premium:
--   1 grátis   ícone Poro Assombrado        6 premium  efeito Teia de Aranha
--   2 premium  500 Rift Coins               7 grátis   moldura Correntes e Caveiras
--   3 grátis   300 Rift Coins               8 premium  moldura Vampito
--   4 premium  moldura Abóboras e Espinhos  9 grátis   ícone Abóbora Sombria
--   5 grátis   ícone Halloween 2026        10 premium  efeito Halloween 2026
-- O progresso em abóboras de quem já jogou é mantido (o nível sobe até no máximo 10).
-- Recompensas de nível já resgatadas ficam como estão; para testar do zero, use
-- "zerar progresso" na aba Teste do painel. Rodar de novo é seguro.

update public.site_passes set niveis = 10 where id = 'halloween-2026';

delete from public.site_passe_niveis where passe = 'halloween-2026' and (nivel = 0 or nivel > 10);

insert into public.site_passe_niveis (passe, nivel, trilha, tipo, chave) values
  ('halloween-2026', 1,  'gratis',  'icone',   'exc-poro-assombrado'),
  ('halloween-2026', 2,  'premium', 'moeda',   '500'),
  ('halloween-2026', 3,  'gratis',  'moeda',   '300'),
  ('halloween-2026', 4,  'premium', 'moldura', 'hw-moldura-2'),
  ('halloween-2026', 5,  'gratis',  'icone',   'exc-halloween-2026'),
  ('halloween-2026', 6,  'premium', 'efeito',  'hw-teia'),
  ('halloween-2026', 7,  'gratis',  'moldura', 'hw-moldura-3'),
  ('halloween-2026', 8,  'premium', 'moldura', 'hw-moldura-1'),
  ('halloween-2026', 9,  'gratis',  'icone',   'exc-abobora-sombria'),
  ('halloween-2026', 10, 'premium', 'efeito',  'hw-neon')
on conflict (passe, nivel) do update
  set trilha = excluded.trilha, tipo = excluded.tipo, chave = excluded.chave;

-- As molduras de teste continuam liberadas só para administradores (0050 e 0053).
insert into public.site_recompensas (user_id, tipo, chave, origem)
select a.user_id, 'moldura', 'hw-moldura-3', 'admin' from public.site_admins a
on conflict do nothing;
