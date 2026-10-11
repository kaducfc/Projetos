# Smite Challenge (jogo 7, oculto)

Desafio de timing de League of Legends: o Dragão do Oceano perde vida com o dano de aliados e adversários e o
jogador (um jungle) golpeia com o **Smite** na hora certa. O Smite mata se a vida do objetivo for **menor ou igual** ao dano dele;
quanto mais perto do dano do Smite (para menos), mais pontos. Só o Smite e uma habilidade do campeão (Q) machucam o objetivo.

- Regras: 5 rodadas, até 100 pontos cada (500 no total). Pontos pelo TEMPO (ver abaixo), onde antes era a margem = dano do Smite − vida
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
- Quem fica com o objetivo decide os pontos: Golpear certo (vida ≤ dano) → pontos pelo tempo (`pontosDoTempo`), com mínimo de 25 (o objetivo é do seu time) (a rodada acaba na hora); objetivo do seu time sem o
  Golpear certo → **25 pontos** (golpe final de um aliado) ou **50 pontos** (golpe final da **sua habilidade**, Q); objetivo do time inimigo → **0**.
- O **selva inimigo** também pode usar o Smite (o mesmo dano). Em **80%** das rodadas ele tem o feitiço e golpeia **entre 0,2 e 0,5 s depois de a vida do objetivo entrar na zona do Smite** (vida ≤ dano do Smite; `REACAO_INIMIGO`, sorteado por rodada em `reacaoInimigo`). Como a vida já está ≤ dano, o golpe dele mata e o objetivo vai para o time inimigo (0 pontos), a não ser que o seu Golpear (ou o objetivo morrendo por golpes de aliados) chegue antes. Nenhum marcador aparece na barra de vida.
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

## Relógio da partida
O canto superior direito mostra "Tempo da Partida" (relógio simulado, andando 1 s por segundo durante a rodada). Cada objetivo nasce depois do mínimo (`TEMPO_MINIMO`): Dragão 5 min, Arauto 15, Barão 20, Dragão Ancião 30, mais até 4 min sorteados; o tempo só avança de uma rodada para a outra (`partida.tempos`). O limite de 50 s da rodada continua, sem aparecer na tela.

## Pontuação do Golpear: pelo tempo
O relógio da pontuação começa quando a vida do objetivo entra na zona do Smite (vida ≤ dano do Smite), por qualquer causa, inclusive o seu próprio Q (`est.tZona`), e para quando o seu Golpear mata. `pontosDoTempo(seg)`: 0 s → 100; 0,1 s → 90 (nessa faixa, de 100 a 90); de 0,1 a 1,5 s cai em linha reta de 90 até 25; 1,5 s ou mais → 25 (o mínimo, pois o objetivo é do seu time). Se morre antes (por aliado, inimigo ou o Smite do selva inimigo) segue a regra de 25/50/0. Assim, combos como Q1 + Q2 + Golpear logo em seguida valem 100.


- Ajuste de equilíbrio das Q: recargas −10% (`RECARGA_Q_MULT` = 0,9) e danos +20% (`DANO_Q_MULT` = 1,2) sobre os valores-base de `CAMPEOES`; os números acima da seção "A Q de cada campeão" são os valores-base. No celular o Pantheon carrega no 1º toque e solta no 2º (mouse e teclado: segurar e soltar); sem soltar em 4 s cancela, com recarga pela metade.

## Nível pelo relógio da partida
O nível do jogador (e, ±1, dos outros) agora vem do relógio simulado (`nivelNoTempo` em `js/logic.js`, tabela `NIVEL_POR_MINUTO`): ~5 aos 5 min, ~9 aos 10, ~11 aos 15, ~13 aos 20, ~15 aos 25, ~16 aos 30, ~17 aos 35. Não consegui baixar os dados de 2026 do Oracle's Elixir daqui, então a curva é a das médias conhecidas (e da tabela de XP do jogo); dá para trocar os pontos de `NIVEL_POR_MINUTO` quando houver a média real. Consequência: o Arauto (≥ 15 min) já vem em nível 11-13 (Golpear 900 ou 1200), o Barão em 13-17 e o Ancião em 16-18.

- Ordem da partida: 1ª rodada sempre Dragão Elemental (entre 6 e 14 min, `TEMPO_PRIMEIRO`), 2ª sempre Arauto (≥ 15 min), 3ª Dragão, 4ª Dragão ou Barão, 5ª Barão ou Ancião.

- Dano dos outros campeões escala com o nível: o tempo até a vida chegar perto do dano do Smite vai de 24-40 s (nível ~5, golpes fracos) a 16-28 s (nível 18, golpes fortes, ~2× maiores), e cada nível acima do seu dá +4% no peso daquele campeão.

- Simulação com a regra atual (jogador que golpeia X s depois de a vida entrar na zona): X=0,25 s → garante ~85% das rodadas (71 pts em média); X=0,35 s → ~58% (45 pts); X=0,5 s → ~20% (14 pts). Sem agir, o inimigo leva ~90% das rodadas.

- Ajustes recentes de equilíbrio: Q do Pantheon −30% (`PANTHEON_MULT` = 0,7); os outros campeões (aliados e adversários, não o jogador) batem +35% (`MULT_OUTROS` = 1,35). Sem compensação: com mais dano a janela de acerto do Golpear fica menor de propósito, e o objetivo chega à zona do Smite mais cedo e com golpes maiores.

- Dois Barões seguidos (rodadas 4 e 5) ficam ≥ 6 min de jogo separados (`RENASCE_BARAO`). Os botões Q e F mostram, no topo, o dano atual (Q: Lee Sin Q2 cresce com a vida que falta; Pantheon mostra estocada e, segurando, o arremesso; `danoDaQ`).

## Ranqueada (PDR)
- Valem as **2 primeiras partidas começadas por dia** (`partidasPorDia('smite')`, ingresso em `site_rk_iniciar`, SQL `supabase/migrations/0071_smite_ranqueada.sql`). Começou e não terminou até a meia-noite: −15 PDR por partida (a atualização diária já cobre qualquer jogo).
- A nota da partida é a soma das 5 rodadas (0 a 500). PDR de tabela (`baseSmite` em `shared/ranked.js` = `site_rk_base_smite` no SQL): **500 → +35 · 250 → +3** (reta entre os dois) e **249 → −3 · 0 → −30** (reta entre os dois). Ganhos passam pelo % do elo (Ferro 100% … Mestre+ 50%); a perda é igual em todos os elos (a perda máxima do `site_rk_ajustar` subiu de −25 para −30).
- Fluxo: JOGAR → `platform.rankedIniciar('smite')` (ingresso); fim → `platform.recordResult` com `summary.ranked` (token) e `summary.rodadas` (5 itens com `p`); o gatilho `site_ranked_registrar` confere que a nota = soma das 5 rodadas (cada uma de 0 a 100) e lança o PDR. Avisos de início/fim: `shared/aviso-ranked.js`.
- Jogo liberado ao público (sem `soAdmin` no catálogo). A ranqueada precisa das migrações 0071 e 0072 rodadas no Supabase; sem elas o jogo funciona, mas a partida não vale PDR.
- Limite conhecido: o jogo roda no navegador (como a Carreira): o servidor só confere a soma das rodadas e o teto de 500, não consegue provar que os tempos de reação foram reais.
