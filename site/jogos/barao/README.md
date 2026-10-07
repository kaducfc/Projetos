# Show do Barão (jogo 6, oculto)

Quiz de LoL no estilo Show do Milhão: **11 perguntas** (3 fáceis, 3 médias, 4 difíceis e a última quase impossível),
3 2 Pinstouros (pulos), ajuda dos Monstros do Vazio e as Cartas do Twisted Fate.

- Pontos (não são RC): 500 → 1.000.000 (11 degraus, com 500.000 na 10ª). Sem pontos seguros: parar leva o que o jogador já tem (a pergunta anterior) e errar vale o degrau abaixo disso (ex.: com 500.000 no bolso, errar vale 250.000).
- Cartas do TF: três cartas viradas para baixo, escolhe-se UMA, uma única vez na partida; ao virar, revela se tira 1 (azul), 2 (vermelha) ou 3 (dourada) opções erradas. A posição de cada cor é sorteada a cada partida.
- Arquivos: `js/perguntas.js` (banco: FACIL, MEDIA, DIFICIL, IMPOSSIVEL; resposta certa SEMPRE primeiro), `js/logic.js` (regras puras, testadas),
  `js/main.js` (UI/áudio), `css/style.css`, `img/apresentador.webp` (mascote apresentador).
- Reclassificar pergunta: mover a linha dela de uma lista para outra em `perguntas.js` (o teste confere formato e duplicatas).
- Acesso: só admin (`soAdmin: true` em `shared/config.js`). Fora do localhost, visitantes veem tela bloqueada.
- Lançar: remover `soAdmin` do GAMES em `shared/config.js` e adicionar traduções i18n da página.
- Pendente: ranking/PDR, i18n.
- Testes: `node --test tests/barao.test.mjs`
- A dificuldade é só interna: o jogador não vê "fácil/difícil". Na 10ª pergunta nenhuma ajuda (pulo, Vazio, carta) é permitida. Pular troca a pergunta e mantém a mesma etapa/prêmio.
- Idiomas: o jogo está traduzido para EN, DE, ES, IT e FR. Textos de tela em `shared/i18n/src/barao-ui.mjs`, perguntas em `barao-perguntas-*.mjs` e alternativas em `barao-opcoes.mjs`. Ao adicionar/editar uma pergunta, inclua a linha de tradução (o teste avisa se faltar) e rode `node scripts/i18n-build.mjs`. O nome "Show do Barão" fica igual em todos os idiomas.
