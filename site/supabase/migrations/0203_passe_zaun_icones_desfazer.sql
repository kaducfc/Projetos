-- Passe Zaun e Piltover: os três ícones de cenário (Cidade de Piltover, Refinaria de Zaun, Submundo de Zaun) foram descartados.
-- Se o SQL anterior desta série chegou a rodar, isto devolve os níveis 2, 10 (grátis, 300 RC) e 13 (premium, 500 RC) e tira os
-- ícones dos administradores. Se não rodou, não muda nada. Os ícones novos entram depois. Rodar de novo é seguro.
update public.site_passe_niveis set tipo = 'moeda', chave = '300' where passe = 'zaun-piltover-2026' and nivel in (2, 10) and trilha = 'gratis'  and tipo = 'icone';
update public.site_passe_niveis set tipo = 'moeda', chave = '500' where passe = 'zaun-piltover-2026' and nivel = 13           and trilha = 'premium' and tipo = 'icone';
delete from public.site_recompensas where tipo = 'icone' and chave in ('exc-pl-cidade', 'exc-zn-refinaria', 'exc-zn-submundo');
