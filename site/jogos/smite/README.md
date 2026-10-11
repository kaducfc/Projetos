# Smite Challenge (jogo 7, oculto)

Desafio de timing de League of Legends: o Dragão do Oceano perde vida com o dano de aliados e adversários e o
jogador (um jungle) golpeia com o **Smite** na hora certa. O Smite mata se a vida do objetivo for **menor ou igual** ao dano dele;
quanto mais perto do dano do Smite (para menos), mais pontos. Só o Smite e uma habilidade do campeão (Q) machucam o objetivo.

- Regras: 5 rodadas, até 100 pontos cada (500 no total). Pontos = `100 · (1 − margem/600)²`, onde margem = dano do Smite − vida
  do objetivo no golpe (0 → 100; 30 → 90; 150 → 56; 300 → 25; 600+ → 0). 
- Cada rodada sorteia o dano do Smite (600, 900 ou 1200 por nível), o campeão (e a habilidade) e uma sequência de golpes de aliados/adversários
  que faz a vida passar pelo dano do Smite entre 18 e 32 s. A janela entre "chegou na zona" e "morreu" encurta a cada rodada (3,4 s → 1,8 s)
  e as rajadas (golpes grandes) ficam mais frequentes.
- Arquivos: `js/logic.js` (regras puras, testadas em `tests/smite.test.mjs`), `js/main.js` (tela, laço do jogo, áudio WebAudio),
  `css/style.css` (palco 16:9 em `cqw`; coluna 9:18 no celular), `img/dragao.webp` (arte do Dragão, a mesma do Na Medida).
  Ícones de campeões e do Smite vêm do Data Dragon.
- Acesso: só admin (`soAdmin: true` em `shared/config.js`). Fora do localhost, visitantes veem tela bloqueada. Para testar sem conta no
  localhost: `?teste=1`.
- Capa do hub: `smite` em `CAPAS` (`js/hub.js`) e estilos `.cv-smite` em `css/hub.css`.

## Pendente antes de lançar
- Ranqueada/PDR (hoje o jogo não vale PDR): adicionar `ranked` em `shared/config.js`, regra no servidor (a partida roda no navegador;
  para valer PDR de verdade, sortear e conferir as rodadas no servidor, como no Show do Barão) e avisos em `shared/aviso-ranked.js`.
- Idiomas: textos do jogo ainda só em português (`shared/i18n/src/`); logo "Smite Challenge" fica igual em todos os idiomas.
- Arte: cenário, fichas e botões são desenhados em CSS/SVG; dá para trocar por imagens (fosso, fichas de campeões, ícones).
- Campeões e dano da habilidade são valores de jogo (equilibrar), e o Smite pode virar por nível do campeão.

## Atualização: nome, times e objetivos
- Nome: "Desafio do Golpear" (PT), "Smite Challenge" (EN), "Zerschmettern-Challenge" (DE), "Desafío de Aplastar" (ES), "Sfida della Punizione" (IT) e
  "Défi du Châtiment" (FR); o feitiço usa o termo de cada idioma (o mesmo do Show do Barão). Traduções em `shared/i18n/src/golpear-ui.mjs`.
- Times: 4 aliados (o jogador é o selva) e 4 adversários, 1 por rota (topo, selva, meio, atirador), sem campeão repetido. Só os 7 outros jogadores
  batem sozinhos no objetivo; o jogador só tem a habilidade (Q) e o Golpear.
- Objetivos (sorteados por rodada, sem repetir o anterior): Dragão Elemental (8.000 de vida), Dragão Ancião (11.000), Barão Nashor (12.000) e
  Arauto do Vale (7.000). Cada um tem o seu tema de cenário (cores do covil) em `OBJETIVOS` (`js/logic.js`).
- Arte: o Dragão Elemental e o Dragão Ancião usam a arte do Na Medida. **O Barão e o Arauto ainda são silhuetas coloridas provisórias**
  (`img/barao.webp` e `img/arauto.webp`, geradas das silhuetas do Na Medida): trocar pelas artes finais mantendo os mesmos nomes de arquivo
  (o recorte do ícone redondo está em `icone` de cada objetivo).

## Atualização: cenário e dano por nível
- Cenário: `img/cenario.webp` (a imagem do covil que você mandou, 1600 px). Cada objetivo muda o matiz dela por CSS (`--hue`, `--sat`, `--luz`
  em `.sm[data-tema=...]`). No celular a imagem é ampliada e centrada no fosso.
- Dano do Golpear por nível do jogador (`danoDoSmite` em `js/logic.js`): até o nível 8 → 600; do 9 ao 12 → 900; do 13 em diante → 1200. O nível
  da rodada vem da faixa de cada objetivo (`niveis`): Arauto 7-11, Dragão Elemental 5-16, Barão 12-18, Dragão Ancião 13-18; os outros jogadores
  ficam a ±1 nível. O nível aparece no retrato, nas fichas e no cartão da rodada.
- Teste visual: `?obj=barao` (ou `arauto`, `dragao-anciao`, `dragao-elemental`) na URL fixa o objetivo.

## Atualização: a rodada continua depois de errar (regra atual de pontuação)
- Errar o Golpear (usar com a vida acima do dano do Smite) **não encerra a rodada**: o Golpear bate no objetivo (tira o dano do Smite) e é
  desperdiçado; a rodada segue até o objetivo morrer. Só dá para usar o Golpear uma vez por rodada.
- Quem fica com o objetivo decide os pontos: Golpear certo (vida ≤ dano) → `100·(1 − margem/600)²` (a rodada acaba na hora); objetivo do seu time sem o
  Golpear certo (golpe final de um aliado ou da sua habilidade) → **25 pontos**; objetivo do time inimigo → **0**.
- Smite do selva inimigo (`gatilhoInimigo` em `criarRodada`, `checarInimigo` em `js/logic.js`): em 80% das rodadas o selva inimigo golpeia com o **mesmo
  dano do seu Smite** quando a vida do objetivo está entre **5% acima e 30% abaixo** do dano do Smite. O ponto exato é sorteado com `x = √sorteio`,
  então é mais provável perto de 30% abaixo (vida mais baixa). Se a vida passar direto pela faixa (ex.: rajada), ele perde a hora. Se a vida ≤ dano do
  Smite nessa hora, ele leva o objetivo (0 pontos); se estiver nos 5% de cima, o golpe dele não mata. A faixa aparece na barra de vida (listrada, vermelha).
- Simulação (1.500 rodadas, golpear quando a margem chegar a X): X=0 → 88 pts em média (97% garantem); X=100 → 49 pts; X=200 → 20 pts (52% garantem).
  Para deixar mais difícil: aumentar `PROB_SMITE_INIMIGO`, ou o inimigo reagir em vez de ter um gatilho fixo.
- A lógica da rodada inteira (`novoEstado`, `avancar`, `usarHabilidade`, `usarGolpear`) é pura e está coberta por `tests/smite.test.mjs`.
