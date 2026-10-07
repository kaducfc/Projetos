# Show do Barão (jogo 6, oculto)

Quiz de LoL no estilo Show do Milhão: 15 perguntas, 3 Pinstouros (pulos), ajuda dos Monstros do Vazio e 3 cartas do TF (tiram 1, 2 ou 3 opções erradas).

- Pontos: 50 → 1.000.000 (pts, não são RC reais). Pontos seguros nas perguntas 5 e 10.
- Arquivos: `js/perguntas.js` (banco; resposta certa SEMPRE primeiro), `js/logic.js` (regras puras, testadas), `js/main.js` (UI/áudio), `css/style.css`.
- Acesso: só admin (`soAdmin: true` em `shared/config.js`). Fora do localhost, visitantes veem tela bloqueada.
- Lançar: remover `soAdmin` do GAMES em `shared/config.js` e adicionar traduções i18n da página.
- Pendente: ranking/PDR, i18n.
- Testes: `node --test tests/barao.test.mjs`
