# Conexões do League

Jogo no estilo "Conexo": 16 palavras do universo de League of Legends em uma grade 4 x 4; o jogador junta as de 4 em 4 que têm algo
em comum (campeões de uma região, itens, feitiços, runas, monstros, eSports, gírias…). Acaba quando os 4 grupos são encontrados.
Hoje só administradores jogam (`soAdmin: true` em `shared/config.js`); para liberar, apague essa linha.

## Como se joga
- Clique para selecionar (até 4; clicar de novo desmarca). Com 4 selecionadas o jogo confere sozinho.
- Acerto: a categoria é revelada em uma barra colorida (ouro, platina, diamante e mestre, as cores dos elos do site, do grupo mais fácil ao mais difícil).
  Erro: as peças tremem e conta uma tentativa ("Falta só uma palavra!" quando 3 das 4 são do mesmo grupo).
- **Dica**: marca com um canto laranja 2 palavras de um grupo ainda não achado; as próximas dicas marcam mais 1 (até 3 por grupo) e depois passam ao grupo seguinte.
- **Embaralhar** mistura as peças que restam. Ao terminar: tentativas, dicas, pontos e botão **Compartilhe** (quadradinhos coloridos, sem revelar palavras).
- Pontos da partida: 100 − 10 por erro − 5 por dica (mínimo 0). Só o **desafio do dia** é registrado no histórico (e rende abóboras do passe); o **jogo livre** gera quebra-cabeças aleatórios sem registrar.
- O desafio do dia é igual para todos (sorteado pela data de Brasília) e o andamento fica salvo no navegador (`conexoes.dia`).

## A biblioteca (`js/`)
- `campeoes.js`: tabela de ~150 campeões com região, rota, classe e marcas (yordle, darkin, vastaya). **Dela saem sozinhos** os grupos de campeões
  (regiões, rotas, classes, letra inicial, nomes curtos/longos/compostos/com apóstrofo…), então as listas são sempre completas e consistentes.
- `curados.js`: grupos escritos à mão (itens, feitiços, runas, mapa, monstros, jogadas, siglas, ligas, times, jogadores, músicas do Mundial…).
  Cada grupo: `c(dificuldade 1-4, 'família', 'título', 'palavra|palavra|…')`. Para acrescentar um, é só uma linha nova; `node --test tests/conexoes.test.mjs` confere tamanho, repetições e conflitos.
- `grupos.js`: junta os dois e cria o índice normalizado (sem acento) de cada grupo.
- `logic.js`: gera o quebra-cabeça (`criarPuzzle`), o desafio do dia (`puzzleDoDia`) e as regras da partida (selecionar, conferir, dicas, embaralhar, salvar/restaurar).

## Como um quebra-cabeça é montado
1. Sorteia um padrão de dificuldade para os 4 grupos (ex.: 1-2-3-4, 1-2-3-3, 2-2-3-4…), do mais fácil ao mais difícil.
2. Escolhe 4 grupos de **famílias diferentes** (não usa dois grupos parecidos juntos, como "botas" e "itens de tanque"); no máximo 2 deles são de campeões, para misturar bem os assuntos.
3. De cada grupo tira 4 palavras que **não pertencem a nenhum dos outros 3 grupos**, para cada palavra ter um único lugar certo.
4. Embaralha as 16 palavras. Já passam de 2.500 combinações testadas sem falha (96 grupos, ~480 palavras diferentes).

## Idiomas
A interface está traduzida nos 6 idiomas do site (`shared/i18n/src/conexoes-ui.mjs`). As palavras e categorias ficam em português em todos
os idiomas (são nomes do jogo em português; o tabuleiro tem `data-no-i18n` para o tradutor do site não mexer nelas).

## Limites conhecidos
- No jogo livre e sem conta, as respostas estão no código do navegador (não vale PDR). Na ranqueada o servidor sorteia e confere (veja abaixo).
- Nomes de itens e runas seguem o cliente em português do Brasil, mas podem divergir de patches novos; revisar de tempos em tempos.

## Ranqueada
- O desafio do dia, para quem tem conta, vale PDR (1 por dia): o quebra-cabeça é sorteado no servidor, um por jogador, e só os grupos acertados voltam ao navegador. Nunca repete um quebra-cabeça que o jogador já teve (mesmas 16 palavras) e evita os grupos dos últimos 14 dias enquanto der. Máximo de 3 erros (o 4º perde), 1 dica por partida (2 do Platina para cima).
- SQL (rodar nesta ordem no Supabase): `supabase/migrations/0075_conexoes_ranqueada.sql` e depois `0076_conexoes_grupos.sql`. O 0076 é gerado: depois de mexer em `js/curados.js`, rode `node scripts/conexoes-sql.mjs` e rode o arquivo novo no Supabase.
- PDR (antes do ajuste por elo): perfeito +30 · 1 dica +22 · 1 erro +15 · 2 erros +5 · 3 erros −10 · perdeu −20 (`baseConexoes` em `shared/ranked.js` e `site_conexoes_base` no SQL).
- Sem conta ou sem servidor, o jogo continua local e não vale PDR.
