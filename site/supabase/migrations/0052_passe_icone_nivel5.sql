-- Passe Halloween 2026: o ícone "Halloween 2026" passa do nível 6 para o nível 5
-- (o nível 6 volta a dar 500 Rift Coins). Só troca se ainda estiver como antes.
-- Rodar de novo é seguro.
update public.site_passe_niveis set tipo = 'moeda', chave = '500'
 where passe = 'halloween-2026' and nivel = 6 and tipo = 'icone' and chave = 'exc-halloween-2026';
update public.site_passe_niveis set tipo = 'icone', chave = 'exc-halloween-2026'
 where passe = 'halloween-2026' and nivel = 5 and tipo = 'moeda';
