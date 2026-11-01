# Como os atributos viram comportamento na partida

Os cinco atributos do jogador (Mecânica, Fase de rotas, Macro, Teamfight, Mental) são convertidos em parâmetros por `config/atributos.js` e
usados pela IA em `motor/campeao-ia.js`, `motor/estrategia.js`, `motor/wards.js` e `motor/inteligencia.js`. A **Fama** não entra na partida (só no Marketing).

| Atributo | O que muda no jogo |
|---|---|
| **Mecânica** | Chance de pegar o último golpe nos minions; precisão das habilidades (e esquiva de quem tem mais Mecânica); dano das habilidades; **vantagem relativa nos duelos** contra o adversário (`regras.atributos.mec.duelo`). |
| **Fase de rotas** | Até ~14 min (cai de 100% a 50% do efeito até `rotas.fim`): troca de golpes mais favorável, **pune vacilos** do adversário (vida baixa), acerta mais minions. |
| **Macro** | Intervalo e ruído das decisões; **visão**: sem saber onde estão os inimigos (`incerteza`), fica mais cauteloso (luta, recuo e objetivos); só entra no objetivo com visão sobre o covil; quando o time está sem visão e com pouca vida, recua; rotaciona mais cedo para ajudar; segura a volta à base por ouro quando um objetivo está para nascer; usa wards (coloca antes dos objetivos, compra Ward de Controle). |
| **Teamfight** | Escolha de alvo (foca o carry/baixa vida e evita bater em tanque; quem tem pouco bate no mais perto); posicionamento à distância (recua mais cedo para manter a distância); **vai com tudo** quando a luta está ganha (tolera vida mais baixa). |
| **Mental** | O "desespero" (time atrás em ouro, abates e torres): quem tem pouco Mental aceita lutas ruins, recua tarde, erra mais e tenta objetivos sem chance; quem tem muito Mental joga igual atrás ou na frente. Também reduz a perda de desempenho por estar atrás (`tilt`). |

## Objetivos: contestar e roubar

Quando o time inimigo está batendo num objetivo (Dragão, Ancião, Barão) e **o time sabe disso** (visão sobre o objetivo ou inimigos vistos perto dele),
`avaliarContestar` decide: vai se conseguir **roubar** (a vida que sobra na chegada cai com a rajada de quem chega, mais o Golpear do caçador) ou se o
valor de combate de quem chega for suficiente. Atrás no placar e com pouco Mental, tenta mesmo em condição ruim (principalmente Barão/Ancião). Macro baixo às vezes nem percebe.
Os eventos `objetivo_contestado` e `objetivo_roubado` registram isso.

## Calibração por simulação

`ferramentas/estudo.mjs` roda partidas completas em lote (sem navegador, em paralelo), em pares espelhados (mesmos campeões, lados trocados):

```
node estudo.mjs atributos 30            # cada atributo 90 contra 10
node estudo.mjs politica baraoDesde 1260,1500 40
node estudo.mjs varredura 40            # todos os parâmetros de estudo-parametros.json
```

Os parâmetros de política (`regras.ia`) podem ser sobrepostos por equipe (`politica` na criação da partida), o que permite comparar uma política contra o padrão.

## Janela de vitória: acabar o jogo (e impedir que acabem)

O objetivo da partida é o **Nexus**, não "todas as torres e todos os inibidores". `motor/janela.js` avalia, a cada 2 s e para as duas equipes:

- **Caminho mais curto**: uma única rota (3 torres e o inibidor), as torres do Nexus e o Nexus. Se um inibidor já caiu (e vai demorar a renascer), só faltam as torres do Nexus e o Nexus. A estimativa de tempo usa o dano real dos campeões contra as estruturas (inclusive a redução sem minions aliados por perto) e a caminhada entre elas.
- **Quem chega a tempo para defender**: inimigos vivos pela distância e os mortos pelo renascimento + viagem desde a fonte. A investida só começa com vantagem numérica real sobre quem chega a tempo (2 a mais; 1 a mais com o buff do Barão) e razão de força mínima, ou quando quase ninguém consegue defender.
- **Regra do Barão**: com o buff ativo e 3+ inimigos mortos, o time tenta acabar com o jogo (mais tempo de investida, razão mínima menor).
- **Investida em andamento** tolera mais (não desiste no meio) por `janela.memoria` s. Participantes de uma investida (ou de uma defesa) urgente não recuam por vida baixa ou desvantagem até o limite `janela.hpUrgente`, nem vão à base por ouro.
- **Defesa**: o mesmo cálculo, do ponto de vista do adversário (com tolerância maior), dispara o plano `defender_base` urgente com todos os campeões em condição, na estrutura onde ele vai bater. Se a nossa investida for mais rápida que a dele, vamos primeiro.
- **Barão (buff)**: o grupo inteiro empurra a rota com a onda mais avançada, ficando junto dos minions (o buff deixa os minions mais fortes perto de um campeão com buff e sem minion a estrutura quase não toma dano).
- **Depois de abates**: um objetivo épico vale se a viagem + o tempo para matar cabem antes de o adversário voltar a ter 4 campeões (`janelaDeAbates`); com vantagem de 2 a mais o grupo já pode pressionar torres mesmo na fase inicial (a partir dos 5 min).

Parâmetros em `regras.ia.janela` (sobrepõe por equipe via `politica`). Eventos: `investida_final` e `defesa_final`.

## Objetivos sem abates: risco pelo tempo de chegada

Dragão e Barão podem ser feitos sem matar ninguém, mas com risco. `ameacaDeContestar` (`motor/janela.js`) estima, para cada campeão inimigo, em quanto tempo ele chegaria ao covil e compara com o tempo da equipe (viagem do grupo + matar o monstro):
- visto agora: distância real; sumiu: última posição vista, supondo que ele pode ter se aproximado desde então (quem tem mais Macro supõe mais); nunca visto: a partir da fonte, com folga; morto: renascimento + viagem;
- só pesa quem chega antes de o objetivo cair (mais uma folga). O caçador conta inteiro; quem está em rota conta metade (e metade de novo se o adversário não tem visão do covil, pois pode nem saber);
- sem visão de ninguém o objetivo continua possível, mas é arriscado; o time inimigo ainda pode contestar e roubar (ver `avaliarContestar`).
Depois de abates, `janelaDeAbates` indica quanto tempo falta para o adversário voltar a ter 4 campeões; se a viagem e o objetivo cabem nesse tempo, o objetivo ganha prioridade mesmo sem vantagem numérica.

## Golpear (Smite) do caçador

Dano verdadeiro em monstros e épicos (`regras.golpear`): nível 3 em diante; começa com **1 carga** e a **2ª chega em 2:18** (a contagem começa aos 0:48 e cada carga leva 90 s); no máximo **2 cargas**, **15 s entre usos**. O dano sobe com o tempo: **600**, **900** aos 10:00 e **1200** aos 20:00 (no jogo real isso vem da evolução do pet; os valores atuais do LoL desde o patch 26.01 são 600/1000/1400 e podem ser ajustados em `regras.golpear.dano`).
Uso: só quando o dano mata o alvo. Em épicos (garantir ou roubar) usa sempre que der; em monstros comuns só com as 2 cargas cheias, para a recarga não ficar parada e uma carga ficar guardada para o objetivo.
