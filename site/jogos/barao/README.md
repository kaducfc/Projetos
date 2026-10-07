# Show do Barão (jogo 6, oculto)

Quiz de LoL no estilo Show do Milhão: **11 perguntas** (3 fáceis, 3 médias, 4 difíceis e a última quase impossível),
3 2 Pinstouros (pulos), ajuda dos Monstros do Vazio e as Cartas do Twisted Fate.

- Pontos (não são RC): 500 → 1.000.000 (11 degraus, com 500.000 na 10ª). Sem pontos seguros: parar leva o que o jogador já tem (a pergunta anterior) e errar vale o degrau abaixo disso (ex.: com 500.000 no bolso, errar vale 250.000).
- Cartas do TF: três cartas viradas para baixo, escolhe-se UMA, uma única vez na partida; ao virar, revela se tira 1 (azul), 2 (vermelha) ou 3 (dourada) opções erradas. A posição de cada cor é sorteada a cada partida.
- Arquivos: `js/logic.js` (constantes/helpers), `js/main.js` (UI/áudio, conversa com o servidor), `css/style.css`, `img/apresentador.webp`. O banco de perguntas NÃO fica em `site/`: está em `../barao-banco/perguntas.mjs` (FACIL, MEDIA, DIFICIL, IMPOSSIVEL; resposta certa SEMPRE primeiro).
  `js/main.js` (UI/áudio), `css/style.css`, `img/apresentador.webp` (mascote apresentador).
- Editar/reclassificar pergunta: mexer em `barao-banco/perguntas.mjs`, rodar `node barao-banco/gerar-sql.mjs` e rodar `barao-banco/perguntas.sql` no SQL Editor do Supabase.
- Acesso: só admin (`soAdmin: true` em `shared/config.js`). Fora do localhost, visitantes veem tela bloqueada.
- Lançar: remover `soAdmin` do GAMES em `shared/config.js` e adicionar traduções i18n da página.
- Servidor: a partida roda toda no Supabase (`supabase/migrations/0066_barao_servidor.sql`); a resposta certa só sai depois do fim da partida/da pergunta. Rodar no SQL Editor: 0065, 0066 e depois `barao-banco/perguntas.sql`.
- Testes: `node --test tests/barao.test.mjs`
- A dificuldade é só interna: o jogador não vê "fácil/difícil". Na 10ª pergunta nenhuma ajuda (pulo, Vazio, carta) é permitida. Pular troca a pergunta e mantém a mesma etapa/prêmio.
- Idiomas: o jogo está traduzido para EN, DE, ES, IT e FR. Textos de tela em `shared/i18n/src/barao-ui.mjs`, perguntas em `barao-perguntas-*.mjs` e alternativas em `barao-opcoes.mjs`. Ao adicionar/editar uma pergunta, inclua a linha de tradução (o teste avisa se faltar) e rode `node scripts/i18n-build.mjs`. O nome "Show do Barão" fica igual em todos os idiomas.
- Ranqueada (PDR): valem as 3 primeiras partidas começadas no dia; não terminar custa −15 PDR. Tabela pelo prêmio final (antes do % do elo): ≤500 → −20; 1.000 → −15; 2.000 → −10; 5.000 → −5; 10.000 → +5; 20.000 → +10; 50.000 → +15; 100.000 → +20; 250.000 → +25; 500.000 → +30; 1.000.000 → +35. Os ganhos passam pelo % do elo (Ferro 100% … Mestre 50%). Servidor: `supabase/migrations/0065_barao_ranqueada.sql` (rodar no SQL Editor); cliente: `baseBarao` em `shared/ranked.js`.
- Visitantes (sem conta) jogam normalmente, sem PDR: o código da partida é anônimo. Partidas de visitantes paradas há mais de 6h (e de contas há mais de 3 dias) são apagadas a cada partida nova. Sem limite de partidas por hora.
