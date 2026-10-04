# Carreira no Rift

Simulador de carreira de um jogador profissional de **League of Legends**,
inspirado no modo carreira do Copero (futebol). Você cria o jogador aos 16
anos, assina com um time da base e toma decisões temporada a temporada até
a aposentadoria.

Feito em HTML + CSS + JavaScript puro (ES modules), sem build step e sem
dependências, igual ao `idle-hunter`.

## Rodando localmente

Faz parte do site [Rift Arcade](../../README.md): sirva a pasta `site/`
inteira para o jogo encontrar os arquivos compartilhados (conta, saves).

```bash
cd site
python3 -m http.server 8000
# abra http://localhost:8000/jogos/carreira-no-rift/
```

(Abrir o `index.html` direto pelo `file://` não funciona por causa dos ES modules.)

Para gerar um arquivo único, que abre com dois cliques ou pode ser publicado como Artifact:

```bash
node scripts/build-bundle.mjs > bundle.html
```

## Como funciona

**Criação:** nick, estilo de jogo (agressivo ou controlado), nacionalidade
(define a região inicial) e rota. Os atributos iniciais são sorteados
de acordo com a rota, com OVR inicial 53 (sem conta ou sem elo na ranqueada); com elo, 54 no Ferro
e +1 por elo, até 63 no Desafiante.

**Atributos → OVR:** Mecânica, Fase de rotas, Macro, Teamfight e Mental.
O OVR é a média ponderada desses atributos com pesos diferentes por rota (o
Jungle depende mais de Macro, o ADC de Mecânica/Teamfight etc.). Além deles:

- **Confiança do técnico:** aumenta a chance de jogar e o rendimento em partida.
- **Fama:** melhora as propostas recebidas.
- **Teto de OVR (potencial, oculto):** não é sorteado e é igual para todos os
  elos: começa em 75 e sobe com a carreira até 100. Sem elo o jogador começa
  com OVR 53; o elo da ranqueada só dá +1 de OVR inicial por nível (Ferro 54,
  Bronze 55 … Desafiante 63). Quem começa mais forte ganha mais títulos e por
  isso tem mais chance de chegar ao topo.

**Temporada** (1 por ano), seguindo o calendário de 2026 do LoL:

| Etapa | CBLOL | LCK | LPL | LEC | LCS | Formato no jogo | Vale vaga para |
|---|---|---|---|---|---|---|---|
| Copa | Copa CBLOL | LCK Cup | Split 1 | Versus | Lock-In | turno único MD1, top 4 nos playoffs (MD5) | First Stand |
| Split 1 | Split 1 | Rounds 1–2 | Split 2 | Spring | Spring | turno único MD3, top 6 nos playoffs (MD5) | MSI |
| Split 2 | Split 2 | Rounds 3–4 | Split 3 | Summer | Summer | turno único MD3, top 6 nos playoffs (MD5) | Mundial |

Vagas internacionais por região:

| | Brasil | Coreia | China | Europa | Am. do Norte | Convidados |
|---|---|---|---|---|---|---|
| First Stand | 1 | 2 | 2 | 1 | 1 | 1 |
| MSI | 1 | 2 | 2 | 2 | 2 | 1 |
| Mundial | 1 | 3 | 3 | 3 | 2 | 2 |

As regiões dos dois finalistas do MSI ganham +1 vaga no Mundial. First
Stand e MSI têm play-in para os times mais fracos e chave de 8. O Mundial
tem fase suíça e chave de 8. As divisões de acesso (Circuito Desafiante,
LCK Challengers, LDL, ERL Premier e NACL) jogam só os dois splits.

Cada temporada tem **3 decisões** (eventos de história), uma antes de cada
etapa. Cada etapa (fase de pontos + playoffs) é simulada de uma vez e
aparece numa tela só. First Stand e MSI não têm tela própria: o resumo
aparece no topo da decisão seguinte. Só o Mundial tem tela.

**Risco e recompensa nas decisões:** cerca de 1 em cada 3 decisões é mais
difícil (todas as opções ficam mais arriscadas; às vezes nenhuma passa de
50%). O acerto rende conforme o risco (×0,8 numa jogada segura, ×1 em 60%,
×2 em 30%, até ×2,5), e errar uma jogada arriscada custa menos que errar uma
"certa". As decisões também contam no fim da temporada: acertos (sobretudo
os arriscados) somam até +0,75 de OVR na evolução e erros tiram até −0,75.
Tudo isso é interno: o jogador vê só a chance de cada opção, sem etiqueta de
risco nem de bônus. Na média, jogar seguro, arriscar ou escolher ao acaso rendem a mesma
mediana de OVR; arriscar só oscila mais.

**Velocidade** (escolhida na criação do jogador): **Normal** tem 3 decisões
por ano; **Rápido** tem só 1 (a do meio do ano), com os efeitos dela valendo
por três. Assim a carreira rende igual nos dois modos (OVR, títulos e
prêmios batem nas simulações: `node scripts/simulate.mjs 3000 BR aleatorio
rapido`). No modo rápido, o resumo do MSI aparece no topo do Split 2. Se não chegar nenhuma proposta e o contrato ainda
estiver em vigor, a janela de transferências é pulada.

Simplificações: os playoffs são de eliminação simples (na vida real a
maioria é de eliminação dupla), e as vagas de cada região são fixas.

**Eventos:** cada escolha mostra a chance de dar certo (ex.: 70% / 30%). A
chance muda conforme o atributo ligado à escolha e a confiança do técnico. O
resultado altera atributos, confiança e fama.

**Propostas:** cada janela tem **2 ou 3 opções** no total, contando
"continuar no clube". Elas dependem principalmente do OVR (e um pouco da
fama). Os times estão em 2 divisões por região: tier 1 (CBLOL, LCK, LPL,
LEC, LCS) e a divisão de acesso (tier 2), onde toda carreira começa. No Brasil,
como em 2026: CBLOL e **Circuito Desafiante** (10 times
reais: academias de Keyd, paiN e RED, mais KaBuM! IDL, INTZ, Estral, TEAM
SOLID, 7REX, RMD e Ei Nerd).

- **Apostas:** quando o jogador está em alta (títulos, prêmios, evolução
  rápida, juventude), uma liga mais forte que a atual pode apostar nele,
  oferecendo um time acima do nível que ele normalmente alcançaria.
  Aparece com o selo "Aposta".
- **Porta de entrada no exterior (selo "Exterior"):** a partir de OVR 70,
  times de menor expressão de uma liga mais forte (os mais fracos da liga
  principal ou, para quem tem até 20 anos, uma academia de ponta) podem fazer
  proposta. A chance cresce com o OVR e o "hype".
- **Subir dentro da liga:** depois de uma boa temporada (top 4, prêmio ou
  evolução forte), times melhores da própria liga passam a fazer proposta,
  mesmo acima do nível que o jogador alcançaria normalmente.
- **Exterior (propostas normais):** com OVR alto chegam propostas de times
  de fora (LEC/LCS a partir de ~75, LCK/LPL a partir de ~88; a porta de entrada e
  as apostas da LCK/LPL exigem OVR 76+ e 77+).
- **Empréstimo:** depois de uma temporada muito ruim (quase não jogou, nível
  bem abaixo do time ou em atrito com o técnico), a diretoria pode emprestar
  o jogador por 1 temporada a um time do mesmo nível ou mais fraco (nunca melhor). Não há opção de ficar; no
  fim, ele volta ao clube de origem (se ainda houver contrato) ou recebe
  outras propostas.

**Como o teto sobe** (a cada temporada, até os 26 anos; depois fica parado):

| O que o jogador fez | Teto |
|---|---|
| Mundial / MSI / First Stand | +7 / +4,8 / +3,4 |
| Título da liga principal / da divisão de acesso | +2,4 / +0,4 |
| MVP da Final do Mundial / outro prêmio individual | +2,8 / +1,4 |
| Decisões (eventos) certas ou erradas | até ±1,5 por temporada |
| Jogar uma liga forte (LCK, LPL +0,25; LEC, LCS +0,1; ×0,5) | pequeno bônus |
| Vencer e jogar bastante | pequeno bônus |

Tudo isso é multiplicado por um fator que depende do elo (`CAP_TAXA_ELO` em
`js/engine/career.js`: 0,85 sem elo, cerca de 1,05 a 1,08 do Ferro ao
Diamante e de 1,07 a 1,2 do Mestre em diante), calibrado para a parcela de
carreiras que chegam a OVR 96+. A subida do teto fica mais lenta perto do
topo: pleno até 88, 60% aos 94 e, a partir do 96, bem difícil (35% a 30% do
ganho) até o 100, que é possível mas raro. O atributo também fica mais
difícil de subir a partir do 96 (60% no 96, 40% no 100). Decisões erradas e
temporadas ruins podem tirar teto, mas nunca abaixo de 75.

**Nível das regiões:** jogar na liga principal de uma região forte faz o
OVR crescer mais (evolução +20% na LCK, +18% na LPL, +10% na LEC, +6% na
LCS) e dá um pequeno bônus de teto. A divisão de acesso dá 60% disso.

**Distribuição esperada** (2.500 carreiras simuladas por elo, Brasil,
escolhendo sempre o time mais forte; `node scripts/simulate.mjs 2500 BR
ambicioso normal <bônus>`, com bônus 0 sem elo, 1 Ferro … 10 Desafiante):

| Elo | OVR máximo 96+ | 98+ | 100 | Mediana |
|---|---|---|---|---|
| Sem elo | 2,5% | 0,6% | ~0% | 85 |
| Ferro | 9,5% | 2,2% | 0,1% | 88 |
| Bronze | 13% | 4% | 0,4% | 89 |
| Prata | 16% | 6% | 0,3% | 90 |
| Ouro | 18% | 7% | 0,6% | 91 |
| Platina | 24% | 11% | 0,7% | 91 |
| Esmeralda | 28% | 12% | 0,9% | 92 |
| Diamante | 30% | 15% | 1,8% | 93 |
| Mestre | 44% | 26% | 3,3% | 95 |
| Grão-Mestre | 44% | 26% | 4,1% | 95 |
| Desafiante | 46% | 27% | 5,2% | 95 |

Quem escolhe sem critério (propostas ao acaso) fica abaixo: 96+ em ~1% sem
elo, ~12% no Ouro e ~32% no Desafiante. Chegar a 80 já é uma boa carreira;
do 96 em diante é raro. Cerca de 58% das carreiras passam pela LCK/LPL.

**Zebras:** a forma de cada time numa etapa ou torneio oscila um pouco, e
em 10% das vezes o time vive uma "fase iluminada" (+5 a +13 de força). Assim
qualquer time pode ser campeão, cada um com a sua dificuldade. Chance de
título por temporada (`node scripts/odds.mjs`):

| Time | Liga | MSI | Mundial |
|---|---|---|---|
| Gen.G (LCK, 91) | ~35% | ~26% | ~21% |
| G2 (LEC, 85) | ~36% | ~7% | ~5% |
| FlyQuest (LCS, 81) | ~31% | ~2% | ~1% |
| paiN (CBLOL, 78) | ~26% | ~0,5% | ~0,4% |
| Pior time da LCK (75) | ~0,4% | — | — |

Somando todos os times do CBLOL, o Brasil ganha ~1% dos MSIs e ~0,6% dos
Mundiais: quase impossível, mas não zero.

**"O time virou alvo":** cada título já ganho na temporada deixa o time mais
estudado pelos rivais (−3,5 de forma por título nas etapas seguintes), a não
ser que ele esteja bem acima do resto da liga (3+ pontos: metade; 6+: sem
penalidade). Ganhar tudo no mesmo ano continua possível, mas é raríssimo.
Prêmios individuais também ficaram mais raros (MVP da liga até 40% por
temporada, Seleção até 55%, MVP da Final do Mundial até 45%).
Resultado (3.000 carreiras): troféus + prêmios por carreira têm mediana ~11;
30 ou mais só em ~1% (jogador comum) a ~4% (sempre no melhor time).

**Curva de evolução:** o jogador começa com OVR ~52 e cresce rápido na
juventude (mediana ~56 aos 16, ~67 aos 18, ~75 aos 20), com um impulso extra
até os 21 que compensa o início mais baixo. Chega ao auge entre 19 e 24 anos. Dos 25 aos 26 mantém ou cresce pouco, e a
queda começa por volta dos 27 (mais forte a partir dos 28). Ter 75+ aos 17–18
anos é raríssimo (bem menos de 1% das carreiras: só os "gênios").

**Dinheiro:** cada temporada soma o salário do ano (contrato mensal × 12) e
as premiações. O salário depende do OVR, da divisão e da liga (LPL e LCS
pagam mais, CBLOL bem menos). Premiações (parte do jogador, em US$):

| Torneio | Campeão | Vice | Semifinal | Quartas | Fase anterior |
|---|---|---|---|---|---|
| Mundial | 90 mil | 45 mil | 25 mil | 12 mil | 5 mil |
| MSI | 50 mil | 25 mil | 12 mil | 6 mil | 3 mil |
| First Stand | 40 mil | 20 mil | 10 mil | 5 mil | 2,5 mil |
| Split da liga principal (LCK/LPL · LEC · LCS · CBLOL) | 30 · 20 · 18 · 8 mil | 50% | 25% | 10% | — |

A Copa paga 60% de um split; divisões de acesso pagam 2 mil ao campeão. Prêmios individuais: MVP de 3 a 10 mil (conforme a liga),
Seleção metade disso, Revelação 3 mil e MVP da Final do Mundial 20 mil.
O dinheiro só aparece no relatório final da aposentadoria (total arrecadado,
salários e premiações); durante a carreira o foco fica no jogo.

**Pontos de legado:** OVR máximo × 2, títulos (Mundial 120, MSI 60, First
Stand 40, liga principal 20, divisão de acesso 10), prêmios (MVP da Final
do Mundial 30, outros 15) e o dinheiro arrecadado: 25 pontos por US$ 1
milhão. O relatório final mostra a conta.

**Aposentadoria:** pode ser anunciada a partir dos 27 anos e é obrigatória
aos 35. O relatório final mostra o legado, os clubes, os títulos e um resumo
para compartilhar.

O progresso é salvo pela plataforma do site (`site/shared/platform.js`):
no navegador como visitante e na nuvem com conta. Ao se aposentar, a
carreira entra no histórico com os **pontos de legado**.

## Estrutura

```
carreira-no-rift/
├── index.html
├── css/style.css
├── js/
│   ├── main.js            # estado, save/load, ações da UI
│   ├── util.js
│   ├── data/
│   │   ├── world.js       # atributos, rotas, regiões, países e times
│   │   └── events.js      # eventos narrativos e escolhas
│   ├── engine/
│   │   ├── player.js      # OVR, evolução, valor de mercado, salário
│   │   ├── sim.js         # partidas, séries, turno único, estatísticas
│   │   ├── career.js      # fluxo da temporada, propostas, torneios, prêmios
│   │   └── save.js        # save compacto (~7 KB): só o que muda nos times
│   └── ui/
│       ├── art.js         # SVGs (escudos, troféus, camisa, minimapa)
│       ├── create.js      # tela de criação
│       └── game.js        # tela principal
├── scripts/simulate.mjs   # simula milhares de carreiras para balanceamento
├── scripts/odds.mjs       # chance de título de cada time (ligas e internacionais)
└── scripts/build-bundle.mjs  # gera um HTML único com tudo embutido
```

## Balanceamento

```bash
node scripts/simulate.mjs 1000 BR   # quantidade de carreiras, país
node scripts/odds.mjs 4000          # chance de título de cada time
```

Mostra a distribuição do OVR máximo, quantos jogadores chegam ao tier 1, a
média de títulos por carreira e os legados. Use depois de mexer em números
em `engine/player.js`, `engine/sim.js` ou `engine/career.js`.

## Adicionando conteúdo

- **Eventos:** acrescente objetos em `js/data/events.js`. Cada escolha tem
  `base` (chance base), `attr` (atributo que ajusta a chance) e os resultados
  `ok`/`fail` com `fx`.
- **Eventos por rota:** um evento ou uma escolha aceita `roles: ['support']`
  (só aparece para essas rotas) ou `notRoles: ['support']` (nunca aparece para
  elas). Um evento só é sorteado se sobrarem pelo menos 2 escolhas válidas.
  Textos podem variar por rota (`{ default: '...', jungle: '...' }`), e
  `{lane}` vira "selva" para o Jungle e "rota" para as demais. Há eventos
  exclusivos de cada rota (teleporte do top, invasão do jungle, roam do mid,
  posicionamento do ADC, visão e dupla do suporte).
- **Placeholders:** `{nick}`, `{team}`, `{league}`, `{doLeague}` ("do CBLOL",
  "da LCK"), `{naLeague}` ("no CBLOL", "na LCK") e `{lane}`.
- **Times:** `TIER1` em `js/data/world.js` (id, nome, sigla, rating, cores).
  Times que saíram (ex.: FPX, 100 Thieves) ficam em `RETIRED_TEAMS`: só
  voltam em saves antigos que os citam, fora das ligas e das propostas.
  A 2ª divisão do Brasil está em `TIER2` (times reais); nas outras regiões
  as academias são geradas a partir dos 8 primeiros times.

Os nomes de times e ligas reais aparecem só como referência de fã. Por
padrão o jogo mostra as logos oficiais de `shared/assets/times/`
(`TEAM_LOGOS = 'oficiais'` em `shared/config.js`); trocando para `'escudos'`,
volta aos escudos próprios/gerados (sigla + cores). Times sem arquivo usam
o escudo gerado.
