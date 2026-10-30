-- Passe Zaun e Piltover: três efeitos de nome entram como recompensa.
--   nível 6  (grátis)   Cintila
--   nível 7  (premium)  Neon do Submundo
--   nível 12 (grátis)   Cristal Hextech
-- Os outros níveis continuam como estavam (Rift Coins provisórios, Canos de Zaun no 3, Código Verde no 9, Mecanismo Arcano no 15).
-- Rodar depois da 0200. Rodar de novo é seguro.
update public.site_passe_niveis set tipo = 'efeito', chave = 'zn-cintila'  where passe = 'zaun-piltover-2026' and nivel = 6  and trilha = 'gratis';
update public.site_passe_niveis set tipo = 'efeito', chave = 'zn-neon'     where passe = 'zaun-piltover-2026' and nivel = 7  and trilha = 'premium';
update public.site_passe_niveis set tipo = 'efeito', chave = 'pl-cristal'  where passe = 'zaun-piltover-2026' and nivel = 12 and trilha = 'gratis';
