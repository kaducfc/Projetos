# Simulador de Técnico (nome provisório)

Jogo só para administradores até a liberação (`soAdmin` em `shared/config.js` + `tc_config.aberto=false` no servidor).

## SQL (rodar nesta ordem no Supabase)
0085 base, 0086 mercado de usuários, 0087 campeonatos, 0088 consultas, 0089 Copa/Mundial.

## Liberar ao público
1. `update tc_config set valor = jsonb_set(valor,'{aberto}','true')` (e `rank_ativo` para integrar o Rank).
2. Remover `soAdmin` do catálogo e definir o nome final.
3. Ligar `ranked`/PDR no card do hub.

## Arquitetura
Toda regra (Poder, preços, mercado, simulação, calendário, prêmios) vive nas RPCs `tc_*`; o cliente só exibe.
`js/regras.js` espelha as constantes do SQL (testes garantem a paridade). Testes: `tests/tecnico*.test.mjs`.
