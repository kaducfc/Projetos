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
de acordo com a rota.

**Atributos → OVR:** Mecânica, Fase de rotas, Macro, Teamfight e Mental.
O OVR é a média ponderada desses atributos com pesos diferentes por rota (o
Jungle depende mais de Macro, o ADC de Mecânica/Teamfight etc.). Além deles:

- **Confiança do técnico:** aumenta a chance de jogar e o rendimento em partida.
- **Fama:** melhora as propostas recebidas.
- **Potencial (oculto):** o teto de evolução do jogador.

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
academias e ligas amadoras) jogam só os dois splits.

Cada temporada tem **3 decisões** (eventos de história), uma antes de cada
etapa. Cada etapa (fase de pontos + playoffs) é simulada de uma vez e
aparece numa tela só. First Stand e MSI não têm tela própria: o resumo
aparece no topo da decisão seguinte. Só o Mundial tem tela. Se não chegar nenhuma proposta e o contrato ainda
estiver em vigor, a janela de transferências é pulada.

Simplificações: os playoffs são de eliminação simples (na vida real a
maioria é de eliminação dupla), e as vagas de cada região são fixas.

**Eventos:** cada escolha mostra a chance de dar certo (ex.: 70% / 30%). A
chance muda conforme o atributo ligado à escolha e a confiança do técnico. O
resultado altera atributos, confiança e fama.

**Propostas:** cada janela tem **2 ou 3 opções** no total, contando
"continuar no clube". Elas dependem principalmente do OVR (e um pouco da
fama). Os times estão em divisões por região: tier 1 (CBLOL, LCK, LPL,
LEC, LCS), a divisão de acesso e, fora do Brasil, ligas amadoras. O Brasil
tem só 2 divisões, como em 2026: CBLOL e **Circuito Desafiante** (10 times
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

**Nível das regiões:** jogar na liga principal de uma região forte faz o
OVR crescer mais e aumenta o teto (potencial) do jogador.

| Região | Evolução | Teto por temporada |
|---|---|---|
| LCK (Coreia) | +20% | +0,25 |
| LPL (China) | +18% | +0,25 |
| LEC (Europa) | +10% | +0,1 |
| LCS (Am. do Norte) | +6% | +0,1 |
| CBLOL (Brasil) | base | — |

Títulos internacionais e prêmios de MVP também aumentam o teto em +0,5.
Quem já tem potencial 88+ ganha só 60% desses aumentos (teto máximo 96).

**Distribuição esperada** (3.000 carreiras simuladas no Brasil): OVR máximo
mediano ~80; <75 ~14%, 75–79 ~35%, 80–84 ~20%, 85–89 ~17% e 90+ ~15%.
Chegar a 80 já é uma boa carreira; 90+ é para poucos. Cerca de 58% das
carreiras passam pela LCK/LPL.

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

**Curva de evolução:** começa devagar aos 16–17, cresce forte dos 18 aos 22 e
chega ao auge entre 19 e 24 anos. Dos 25 aos 26 mantém ou cresce pouco, e a
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

A Copa paga 60% de um split; divisões de acesso pagam 2 mil ao campeão e ligas
amadoras 600. Prêmios individuais: MVP de 3 a 10 mil (conforme a liga),
Seleção metade disso, Revelação 3 mil e MVP da Final do Mundial 20 mil.
O dinheiro só aparece no relatório final da aposentadoria (total arrecadado,
salários e premiações); durante a carreira o foco fica no jogo.

**Pontos de legado:** OVR máximo × 2, títulos (Mundial 120, MSI 60, First
Stand 35, liga principal 20, academia 8, amadora 4), prêmios (MVP da Final
do Mundial 25, outros 10) e o dinheiro arrecadado, que conta pouco: +10 por
US$ 100 mil, +20 por US$ 1 milhão, +30 por US$ 10 milhões. O relatório final
mostra a conta.

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
volta aos escudos próprios/gerados (sigla + cores). Times sem arquivo e os
times amadores fictícios sempre usam o escudo gerado.
