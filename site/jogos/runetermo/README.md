# Runetermo

Jogo da palavra do dia no estilo Termo, só com palavras exclusivas do
universo de League of Legends: campeões, regiões e lugares de Runeterra,
itens, monstros do mapa e personagens da lore. Palavras comuns do português
(ex.: "Poção", "Torre", "Suporte", elos, feitiços) ficam de fora das respostas,
mas continuam valendo como tentativa. O nome do jogo fica em `shared/config.js` (`GAMES`).

## Regras

- Uma palavra por dia, igual para todo mundo. Troca à meia-noite de Brasília.
  O dia 1 é `FIRST_DAY` em `js/logic.js`.
- 6 tentativas. A palavra tem de 5 a 10 letras (a grade se ajusta).
- Verde: letra no lugar certo. Dourado: está na palavra, em outro lugar.
  Escuro: não está. Letras repetidas contam só quantas vezes existem.
- Acentos e apóstrofos não contam ("Kai'Sa" = KAISA, "Poção" = POCAO), mas
  aparecem nas peças.
- Tentativas aceitas: qualquer sequência de letras com o mesmo número de
  letras da resposta (não precisa ser uma palavra que existe).

## Arquivos

- `scripts/palavras.txt`: a lista de respostas com a categoria. Para incluir
  palavras, adicione no fim e rode `python3 scripts/gerar.py`.
- `dados/palavras.json` (gerado): respostas na ordem dos dias. Palavras já
  sorteadas não mudam de dia; as novas entram embaralhadas no fim. Quando a
  lista acaba, ela recomeça.
- `dados/dicionario.txt` (gerado): ~79 mil palavras, usado só para mostrar os acentos nas peças,
  tiradas das palavras mais frequentes do pacote npm
  `an-array-of-portuguese-words` (licença MIT). Para refazer:
  `npm pack an-array-of-portuguese-words`, extraia e rode
  `python3 scripts/gerar.py caminho/para/package/words.json`.
- `js/logic.js`: regras sem tela (testadas em `site/tests/runetermo.test.mjs`).
- `js/main.js`: tela, teclado, janelas de ajuda e de estatísticas.

## Progresso e estatísticas

O progresso (tentativas do dia e histórico) é salvo pelo `platform.js`, no
navegador e na conta. O fim de cada partida entra no histórico do site e no
painel do administrador (`supabase/migrations/0004_painel_runetermo.sql`).
