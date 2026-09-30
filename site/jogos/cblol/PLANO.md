# Jogo do CBLOL (nome a definir): regras combinadas

Inspirado no "7 a 0": monta-se um time misturando jogadores de times e splits
diferentes do CBLOL (2012–2026, com a LTA Sul em 2025) e o time é simulado
contra times históricos.

## Dados

- Fonte: Leaguepedia, baixada pela página `/painel/cblol/` para
  `dados-brutos/cblol-leaguepedia.json`.
- Cada "time" do sorteio é um time num split (ex.: paiN Gaming · 2018 Split 1),
  com 5 titulares, reserva(s) e técnico daquele split.

## OVR (50 a 98)

- Por rota, comparando com a média da liga no mesmo split (eras comparáveis).
- Escala: a maioria entre ~60 e ~92; abaixo de 55 só muito abaixo da média;
  acima de 95 só muito acima.
- Top: participação em abates, KDA, farm/min, parcela de dano, parcela do ouro.
- Jungle: participação em abates, KDA, abates+assistências/min, objetivos do
  time, farm, visão.
- Mid: parcela de dano, KDA, participação em abates, farm/min, parcela do ouro.
- ADC: parcela de dano, KDA, farm/min, parcela de abates, parcela do ouro.
- Suporte: participação em abates, assistências/min, visão/min, KDA.
- Todas: taxa de vitória (o peso maior, ~30%). Mortes quase não pesam
  sozinhas, porque já entram no KDA.
- Carreira: 30% do OVR vem do nível médio do jogador em todos os splits
  (evita que uma lenda despenque num split ruim).
- Colocação: campeão +3, vice +2, 3º +1. Títulos do CBLOL na carreira:
  +0,5 cada (até +2).
- Poucos jogos: OVR puxado para a média. Quem jogou o split inteiro não
  conta como amostra pequena, mesmo em split curto (2014 teve 8 jogos).
- Reserva que não jogou: 4 a 8 abaixo do titular da rota.
- Splits sem estatística jogo a jogo: OVR pela colocação do time.
- Técnico: pela colocação final (campeão ~90 … último ~65), ajustada pela
  taxa de vitória.

## Montagem

- Rola o dado → sai um time/split. Escolhe um jogador (ou o técnico).
- Jogador só entra na vaga da própria rota ou na vaga de reserva (se vazia).
  Técnico só na vaga de técnico. Time: Top, Jungle, Mid, ADC, Suporte,
  Reserva e Técnico.
- Depois de escolher, aparece "Rolar" e sai outro time.
- Dado bônus: 1 por partida. Troca o sorteio por outro split do mesmo time OU
  outro time do mesmo ano.
- Modos: Normal (OVR visível) e Oculto (só nomes, OVR escondido).
- Time completo: mostra o OVR de cada um e a média do time.

## Força do time

- Média dos 5 titulares.
- Reserva: só entra na média se o OVR dele for maior que a média sem ele
  (ajuda a subir um pouco); se for menor, é ignorado.
- Técnico: ajuste pequeno na força do time.

## Simulação

- Fase de pontos: 7 jogos (MD1) contra 7 times históricos sorteados.
  3 vitórias ou mais → playoffs.
- Quartas (MD3): só times que jogaram os playoffs de algum split (1º a 8º no
  mata-mata). O adversário depende das vitórias na fase de pontos:
  3 vitórias → adversário com OVR alto; 7 vitórias → adversário com OVR baixo.
- Semifinal (MD5): sorteio entre times que jogaram uma semifinal (1º a 4º).
- Final (MD5): sorteio entre os finalistas de algum split (1º e 2º).
- Nenhum adversário tem alguém do seu elenco.

## Como ficou (dados de 30/09/2026)

- 247 times (cada um num split), 1.443 jogadores e 223 técnicos, de 2014 a
  2026, com a LTA Sul em 2025. 2012 e 2013 ficaram de fora: a Leaguepedia não
  tem elencos nem estatísticas desses anos.
- Estatísticas por era: abates/mortes/assistências e farm em todos os anos;
  visão desde 2019; dano desde 2020. Os pesos de quem falta são redistribuídos.
- OVR: mediana 75, 90% entre 61 e 91, máximo 97 (Mylon 2014).
- Para refazer depois de baixar dados novos: `python3 scripts/gerar.py`.
- Chance de vencer um jogo pela diferença de força: 3 pontos ≈ 72%,
  7 ≈ 90%, 12 ≈ 98% e 15 ou mais: vitória garantida.
- Bônus interno do "time dos sonhos" (não aparece na tela): +3,8 de força no
  Normal e +3,7 no Oculto, só na simulação.
- Equilíbrio (simulador): no Normal, pegando sempre o melhor OVR, o time é
  campeão em ~25% das vezes. No Oculto, tentando pegar o melhor sem ver o
  OVR (erro de ~7 pontos na avaliação de cada jogador), ~15%.
