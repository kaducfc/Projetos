# Lançamento do Rift Manager

Rode no SQL Editor do Supabase, **nesta ordem**:

1. `supabase/migrations/0183_tecnico_pdr_por_partida.sql` (PDR por partida). Só se ainda não rodou.
2. `01_resetar_rift_manager.sql` — apaga os dados de jogo de todas as contas (destrutivo). Conferir a tabela que aparece no fim.
3. No dia do lançamento: fazer o deploy do site com o jogo aberto (`soAdmin: false` em `shared/config.js`, na entrada `tecnico`) e rodar `02_liberar_para_o_publico.sql`.

Até o passo 3 o jogo continua restrito a administradores e convidados.


# Lançamento do Passe de Batalha "Zaun e Piltover"

1. `supabase/migrations/0200_passe_zaun_piltover.sql` (cria o passe em teste, só administradores). Já fica pronto.
2. Deploy do site com as molduras Canos de Zaun (`mn-zaun`) e Mecanismo Arcano (`mn-mecanismo`) movidas de `MOLDURAS_TESTE` para `MOLDURAS` em `shared/molduras.js` (com `como`) e o efeito Código Verde (`gl-matrix`) movido para `EFEITOS` em `shared/efeitos.js`.
3. Publicar a Edge Function `passe-premium-criar` atualizada (preço R$ 25 do Zaun e Piltover).
4. No dia: `03_lancar_passe_zaun_piltover.sql` (publica e define 01/11 a 20/11).
