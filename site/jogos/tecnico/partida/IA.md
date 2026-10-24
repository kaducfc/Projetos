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
