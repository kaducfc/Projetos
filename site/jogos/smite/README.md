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
- Times: 4 aliados (o jogador é o selva) e 4 adversários, 1 por rota (topo, selva, meio, atirador), sem campeão repetido. Todos os 8 batem sozinhos no objetivo
  (o jogador também, como selva, ~500 por 3 s, entre topo e meio), além da habilidade (Q) e do Golpear. Todo dano de ataque é multiplicado por
  `MULT_DANO` = 1.5 (a Q e o Smite não).
- Objetivos (sorteados por rodada, sem repetir o anterior): Dragão Elemental (8.000 de vida), Dragão Ancião (11.000), Barão Nashor (12.000) e
  Arauto do Vale (7.000). Cada um tem o seu tema de cenário (cores do covil) em `OBJETIVOS` (`js/logic.js`).
- Arte: o Dragão Elemental e o Dragão Ancião usam a arte do Na Medida. O Barão (`img/barao.webp`, o leviatã) e o Arauto (`img/arauto.webp`, o caranguejo) agora usam as artes finais que você enviou. O recorte do
  ícone redondo está em `icone` e o tamanho/posição na tela em `pos`/`posM` de cada objetivo (`OBJETIVOS`, `js/logic.js`).

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
  Golpear certo → **25 pontos** (golpe final de um aliado) ou **50 pontos** (golpe final da **sua habilidade**, Q); objetivo do time inimigo → **0**.
- Smite do selva inimigo (`gatilhoInimigo` em `criarRodada`, `checarInimigo` em `js/logic.js`): em 80% das rodadas o selva inimigo golpeia com o **mesmo
  dano do seu Smite** quando a vida do objetivo está entre **5% acima e 30% abaixo** do dano do Smite. O ponto exato é sorteado com `x = √sorteio`,
  então é mais provável perto de 30% abaixo (vida mais baixa). Se a vida passar direto pela faixa (ex.: rajada), ele perde a hora. Se a vida ≤ dano do
  Smite nessa hora, ele leva o objetivo (0 pontos); se estiver nos 5% de cima, o golpe dele não mata. A faixa não aparece na barra; só o marcador branco do dano do Smite.
- Simulação (1.500 rodadas, golpear quando a margem chegar a X): X=0 → 88 pts em média (97% garantem); X=100 → 49 pts; X=200 → 20 pts (52% garantem).
  Para deixar mais difícil: aumentar `PROB_SMITE_INIMIGO`, ou o inimigo reagir em vez de ter um gatilho fixo.
- A lógica da rodada inteira (`novoEstado`, `avancar`, `usarHabilidade`, `usarGolpear`) é pura e está coberta por `tests/smite.test.mjs`.

## Cenários
- `img/cenario.webp`: covil verde-água, para o Dragão Elemental e o Dragão Ancião (o Ancião só muda o matiz por CSS).
- `img/cenario-barao.webp`: covil roxo, para o Barão Nashor e o Arauto do Vale. Qual imagem cada objetivo usa está em `cenario` (`OBJETIVOS`, `js/logic.js`).

## Atualização: a partida é um jogo (sequência) e o dano por classe
- `criarPartida` (`js/logic.js`) sorteia, uma vez por partida: o campeão do jogador (um dos 5: Lee Sin, Nunu e Willump, Kha'Zix, Pantheon ou Wukong), os 7 outros campeões (mesmos nas 5 rodadas, com um deslocamento fixo de
  ±1 nível cada) e os objetivos: rodadas 1-2 = Arauto do Vale e Dragão Elemental (em qualquer ordem); 3 = Dragão Elemental; 4 = Dragão Elemental ou Barão;
  5 = Barão ou Dragão Ancião. O nível sobe a cada rodada (`NIVEIS_RODADA`: 6-8, 8-10, 10-12, 13-15, 16-18, nunca cai) e o dano do Golpear com ele (600 → 900 → 1200).
- Dano por classe (`DANO_3S`, `RITMO`): proporção atirador 1000 : meio 800 : selva 500 : topo 200 (em 3 s). O atirador bate de 0,6 em 0,6 s (5 golpes de ~200, bem
  regular); o meio de 1,5 em 1,5 s (2 golpes de ~400, mais irregular); o selva a cada 1 s; o topo, tanque, bate pouco e não dá rajada. O dano de cada golpe e o tempo
  entre golpes variam pouco no atirador e mais no meio e no topo.
- Simulação (sem agir): o time inimigo (4 batedores e o Smite do selva) fica com o objetivo em ~84% das rodadas; golpear com margem 0 → 94% garantem (84 pts em média).

## A Q de cada campeão (o jogador sorteia 1 dos 5 por partida)
O posto da habilidade (1 a 5) sobe com o nível da rodada (`postoHab` em `js/logic.js`: até 7 → 1, 8–10 → 2, 11–13 → 3, 14–16 → 4, 17+ → 5). Sem custo de mana/energia; valores em `CAMPEOES`.
- **Lee Sin** (duplo): Q1 Onda Sônica abre uma janela de 3 s; Q2 Chute dá mais dano quanto menos vida o objetivo tem (×1 a ×2). A recarga (9 → 5 s) começa depois do Q2 ou quando a janela acaba.
- **Nunu e Willump** (simples): um toque, dano bem acima dos outros (330 → 730), recarga 13 → 9 s.
- **Kha'Zix** (simples): dano sem isolamento (120 → 240), recarga fixa de 3 s.
- **Pantheon** (carga): toque ≤ 0,35 s = estocada (devolve 60% da recarga); segurar = arremesso, com dano crescente até 2 s segurando (mais um segundo golpe de 50%); passar de 4 s segurando cancela, e a recarga é a metade.
- **Wukong** (armar): o Q arma o próximo ataque por 5 s (+110 → +230 de dano); cada golpe dele corta 0,5 s da recarga (8 → 6 s). Se o golpe armado finaliza, vale como habilidade (50 pontos).
- Teste: `?camp=LeeSin` (ou Nunu, Khazix, Pantheon, MonkeyKing) fixa o campeão.
