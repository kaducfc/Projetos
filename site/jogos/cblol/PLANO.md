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
- Top: participação em abates, KDA, farm/min, parcela de dano.
- Jungle: participação em abates, objetivos do time, KDA, visão.
- Mid: parcela de dano, KDA, participação em abates, farm/min.
- ADC: parcela de dano, farm/min, parcela de abates, KDA.
- Suporte: participação em abates, assistências/min, visão/min, poucas mortes.
- Todas: taxa de vitória; bônus pequeno pela colocação final (campeão +2, vice +1).
- Poucos jogos: OVR puxado para a média (amostra baixa vale pouco).
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
- Quartas (MD3): o adversário depende das vitórias na fase de pontos:
  3 vitórias → adversário com OVR alto; 7 vitórias → adversário com OVR baixo.
- Semifinal e final (MD5): adversários 100% aleatórios.
