-- Passe Halloween 2026: nível 2 = ícone exclusivo "Poro Assombrado" (grátis) e
-- nível 7 = efeito "Teia de Aranha" (premium). Só troca níveis que ainda são moeda.
-- Rodar de novo é seguro.
update public.site_passe_niveis set tipo = 'icone', chave = 'exc-poro-assombrado'
 where passe = 'halloween-2026' and nivel = 2 and tipo = 'moeda';
update public.site_passe_niveis set tipo = 'efeito', chave = 'hw-teia'
 where passe = 'halloween-2026' and nivel = 7 and tipo = 'moeda';
