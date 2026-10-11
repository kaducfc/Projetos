# Smite Challenge (jogo 7, oculto)

Desafio de timing de League of Legends: o Dragão do Oceano perde vida com o dano de aliados e adversários e o
jogador (um jungle) golpeia com o **Smite** na hora certa. O Smite mata se a vida do objetivo for **menor ou igual** ao dano dele;
quanto mais perto do dano do Smite (para menos), mais pontos. Só o Smite e uma habilidade do campeão (Q) machucam o objetivo.

- Regras: 5 rodadas, até 100 pontos cada (500 no total). Pontos = `100 · (1 − margem/600)²`, onde margem = dano do Smite − vida
  do objetivo no golpe (0 → 100; 30 → 90; 150 → 56; 300 → 25; 600+ → 0). Golpe cedo (vida acima do dano do Smite) ou objetivo morto
  antes do Smite (inclusive por causa da habilidade do jogador) = 0.
- Cada rodada sorteia o dano do Smite (700 a 1200), o campeão (e a habilidade) e uma sequência de golpes de aliados/adversários
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
