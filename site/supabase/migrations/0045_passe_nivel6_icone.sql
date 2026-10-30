-- Passe Halloween 2026: a recompensa do nível 6 passa a ser o ícone exclusivo
-- "Halloween 2026" (arte em shared/assets/icones/exc-halloween-2026.webp).
-- Só troca se o nível 6 ainda for o marcador de 500 RC. Rodar de novo é seguro.
update public.site_passe_niveis
   set tipo = 'icone', chave = 'exc-halloween-2026'
 where passe = 'halloween-2026' and nivel = 6 and tipo = 'moeda' and chave = '500';
