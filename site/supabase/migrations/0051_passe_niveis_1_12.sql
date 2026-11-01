-- Passe Halloween 2026: nível 1 = moldura "Abóboras e Espinhos" (premium) e
-- nível 12 = moldura "Vampito" (grátis). Só troca níveis que ainda são moeda.
-- Rodar de novo é seguro.
update public.site_passe_niveis set tipo = 'moldura', chave = 'hw-moldura-2'
 where passe = 'halloween-2026' and nivel = 1 and tipo = 'moeda';
update public.site_passe_niveis set tipo = 'moldura', chave = 'hw-moldura-1'
 where passe = 'halloween-2026' and nivel = 12 and tipo = 'moeda';
