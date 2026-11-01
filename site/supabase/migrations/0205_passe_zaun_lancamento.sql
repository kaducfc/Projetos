-- Lança o Passe de Batalha "Zaun e Piltover" para o público: 20 dias, de 01/11/2026 a 20/11/2026 (o último dia vale até a
-- meia-noite de Brasília). A partir daqui todos os jogadores conectados ganham engrenagens jogando, e o Passe Premium (R$ 25)
-- pode ser comprado. Antes de rodar: deploy do site e a Edge Function passe-premium-criar publicada de novo (preço R$ 25).
-- Rodar de novo é seguro.
update public.site_passes
   set publico = true, inicio = date '2026-11-01', fim = date '2026-11-20'
 where id = 'zaun-piltover-2026';
