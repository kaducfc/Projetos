-- Lança o Passe de Batalha "Halloween 2026" para o público: abre sozinho na virada do
-- dia 06/10/2026 (meia-noite de Brasília). Antes disso continua só para administradores.
-- Rodar de novo é seguro.
update public.site_passes
   set publico = true, inicio = date '2026-10-06'
 where id = 'halloween-2026';
