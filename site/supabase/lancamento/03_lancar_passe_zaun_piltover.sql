-- Lançamento do Passe de Batalha "Zaun e Piltover": rode no dia 01/11/2026 (ou antes, a abertura é pela data).
-- Faça o deploy do site com as molduras Canos de Zaun e Mecanismo Arcano e o efeito Código Verde já na lista
-- pública (shared/molduras.js e shared/efeitos.js) e publique a Edge Function passe-premium-criar atualizada (R$ 25).
-- O passe abre na virada de 01/11 e fecha no fim do dia 20/11 (meia-noite de Brasília, 20 dias).
update public.site_passes
   set publico = true, inicio = date '2026-11-01', fim = date '2026-11-20'
 where id = 'zaun-piltover-2026';
