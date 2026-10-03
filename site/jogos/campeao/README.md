# Campeão Oculto

Um campeão de League of Legends por dia, igual para todo mundo (troca à
meia-noite de Brasília). O jogador digita campeões e cada tentativa mostra
as características comparadas com as do campeão do dia. São 8 tentativas,
só com nomes de campeões (a lista de sugestões mostra os que começam com o
que foi digitado). Uma vez por dia, a qualquer momento, o jogador pode pedir
uma dica: uma característica que ainda não ficou verde é revelada (sorteada).
A dica gasta uma tentativa e não pode ser pedida na última.

## Características (colunas)

Ano de lançamento · Gênero · Região · Posição · Classe · Espécie · Alcance

- Verde: igual. Amarelo: parte em comum (quando há mais de um valor, como
  várias posições). Vermelho: nada em comum.
- Ano: quando erra, ▲ (o do dia é mais novo) ou ▼ (mais antigo).

## Dados

- `scripts/campeoes.txt`: os 173 campeões (até Locke, 2026), uma linha cada.
  Para corrigir uma característica ou incluir um campeão novo, edite a linha
  e rode `python3 scripts/gerar.py`.
- `dados/campeoes.json` (gerado): os campeões e a ordem dos dias. Quem já
  estava na fila mantém a posição; campeões novos entram no fim.
- Região: a facção oficial do campeão em Runeterra; "Runeterra" é usada para
  quem não pertence a uma região só (Aatrox, Bard, Ryze…).
- Ícones: Data Dragon, o CDN oficial da Riot (a versão atual é buscada ao
  abrir o jogo). Se a imagem não carregar, aparece a inicial do nome.

## Arquivos

- `js/logic.js`: regras sem tela (testadas em `site/tests/campeao.test.mjs`).
- `js/main.js`: tela, busca com sugestões, tabela de tentativas e janelas.
- A data que vira o dia fica em `shared/diario.js` (usado também pelo Runetermo).
