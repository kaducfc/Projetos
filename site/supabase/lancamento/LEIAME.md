# Lançamento do Rift Manager

Rode no SQL Editor do Supabase, **nesta ordem**:

1. `supabase/migrations/0183_tecnico_pdr_por_partida.sql` (PDR por partida). Só se ainda não rodou.
2. `01_resetar_rift_manager.sql` — apaga os dados de jogo de todas as contas (destrutivo). Conferir a tabela que aparece no fim.
3. No dia do lançamento: fazer o deploy do site com o jogo aberto (`soAdmin: false` em `shared/config.js`, na entrada `tecnico`) e rodar `02_liberar_para_o_publico.sql`.

Até o passo 3 o jogo continua restrito a administradores e convidados.


# Lançamento do Passe de Batalha "Zaun e Piltover"

Feito: as molduras (Canos de Zaun, Mecanismo Arcano, Horizonte de Piltover), os efeitos (Código Verde, Cintila, Neon do Submundo, Cristal Hextech) e os ícones já estão na lista pública do site.

1. `supabase/migrations/0200` a `0204` (cria o passe, as recompensas e os ícones). Já rodados em ordem.
2. Publicar a Edge Function `passe-premium-criar` atualizada (Premium a R$ 25).
3. Deploy do site e `supabase/migrations/0205_passe_zaun_lancamento.sql` (publica: 01/11 a 20/11).
