# Gameplay das partidas (Summoner's Rift visto como minimapa)

Simulação tática completa de uma partida 5×5 sobre a imagem do mapa. O motor roda igual no navegador e no Node (testes, lote, auditoria).
Nada aqui calcula o vencedor pelo Poder: o resultado sai de movimento, combate, economia e decisões de 10 agentes.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `config/` | `regras.js` (todos os números de equilíbrio), `atributos.js` (atributos do técnico → combate), `mapa.js` e `terreno.js` (**gerados** a partir do mapa) |
| `nucleo/` | `coord.js` (coordenadas), `terreno.js` + `navegacao.js` (grade e A*), `regioes.js`, `espacial.js`, `rng.js` (semente) |
| `dados/` | `arquetipos.js` (6 arquétipos × 2 variantes com habilidades como dados), `campeoes-sim.js` (173 campeões → perfil), `itens.js`, `elencos-teste.js` |
| `motor/` | `partida.js` (estado oficial + passo fixo), `entidades.js`, `combate.js`, `economia.js`, `movimento.js`, `minions.js`, `selva.js`, `estruturas.js`, `objetivos.js`, `visao.js`, `percepcao.js`, `campeao-ia.js`, `estrategia.js`, `relogio.js`, `resultado.js`, `eventos.js` |
| `render/` | `canvas.js` (só desenha o estado), `depuracao.js` (camadas de depuração) |
| `js/`, `css/`, `index.html`, `depurar.html` | tela da partida e ferramenta de depuração do mapa |
| `ferramentas/` | `mapa-fonte.json` + `gerar_terreno.py` (gera terreno), `simular-lote.mjs` (estatísticas), `auditar.mjs` (reexecução) |

Detalhes do mapeamento do mapa: [`MAPA.md`](MAPA.md).

## Como uma partida roda

- Passo fixo de 0,1 s de jogo (`REGRAS.passo`); o `Relogio` converte tempo real em passos (velocidades 1×–32×, pausa, retomada). Acelerar só executa **mais passos**, nunca passos maiores: nada é pulado e o resultado é idêntico em qualquer velocidade.
- Aleatoriedade com semente (`rng.js`): mesma semente + mesmas escalações + mesma versão das regras = mesma partida.
- Ordem de cada passo: agenda de eventos → ondas, selva, objetivos → índice espacial → visão → estratégia (a cada 2 s) → campeões (decisão a cada ~0,6 s × Macro; ação a cada passo) → minions → estruturas → projéteis → separação → economia → limpeza → vitória.
- A vitória é decidida em **um único lugar** (`Partida._vitoria`, chamada só pela destruição do Nexus). `entregarResultado` entrega o resultado uma vez. Há um limite técnico (`limiteTecnico`) que, se atingido, registra "interrompida" sem inventar vencedor.

## Navegação

Grade de 186 × 133 células (80 unidades). Campeão pisa em qualquer região aberta, minion só em rota e base, monstro só em selva/rio/acampamento/covil. A* 8-direções ponderado, sem cortar quinas, com custo extra perto de parede e suavização por linha de visada. Replanejamento limitado (no máx. a cada 0,7 s) e cache negativo para destinos sem caminho. Ataques à distância exigem linha de ataque (paredes finas não bloqueiam, maciços sim). Unidades presas são detectadas, registradas em `diag` e replanejadas; nunca há teletransporte de navegação (o único "teleporte" é o Recall canalizado de 8 s, interrompível).

## Decisões dos campeões

Máquina de estados com histerese: `saindo_base → indo_rota → farmando ⇄ lutando`, `selva` (rota de farm configurável, Golpear), `gank`, `objetivo`, `estrutura`, `defendendo`, `ajudando`, `recuando`, `voltando_base` (recall), `comprando`, `morto`.
A cada decisão: sobrevivência (vida, torre inimiga, desvantagem local) → necessidade de base (vida, ouro, mana) → luta (balanço de valor de combate local, trocas curtas na fase de rotas) → plano da equipe → função. As equipes escolhem prioridades (defender, objetivo, pressionar, finalizar, ajudar) com avaliação de risco; cada campeão pode abandonar a ordem para sobreviver. A IA só usa a **visão** da equipe (campeões, minions e torres aliados + memória de 6 s).
Atributos: Mecânica (dano e acerto das habilidades), Fase de rotas (último golpe e trocas, só no começo), Macro (frequência e ruído das decisões), Teamfight (lutas com 3+ campeões), Mental (erros e queda sob pressão). **Fama não entra.** Maestria: campeão favorito dá bônus pequeno de desempenho.

## Mecânicas implementadas

Ondas (3 corpo + 3 conjuradores, canhão com frequência crescente, superminions), aquisição de alvos de minions e provocação por campeões, 14 acampamentos (buffs, Gromp, Lobos, Raptores, Krugs, caranguejos) com aggro, leash, retorno e respawn único; torres (T1–T3, torres do Nexus) com prioridades de alvo, dano crescente e proteção contra "backdoor"; inibidores (respawn, superminions); Nexus e progressão estrita; Dragão (pilhas, Alma, Ancião), Arauto (carga) e Barão (buff temporário); abates, assistências, primeiro abate, nível e itens (22 itens, builds por perfil); habilidades (alvo, projétil, área, dash, escudo, cura, buff) com lentidão, atordoamento (com resistência a CC em sequência) e execução; recall e fonte.

## Integração com o jogo de gestão

- `tecnico/partida/?id=<partida>`: partida oficial. O servidor (SQL `0091`) entrega as escalações (`tc_partida_elencos`), a **semente** e o **lado** de cada mapa; o navegador devolve o resultado (`tc_gameplay_registrar`). O servidor valida ordem, semente, versão e dono, grava cada mapa uma vez e fecha a série na maioria (bo3/bo5), com o mesmo fechamento da simulação do sistema (forma, experiência) e ligas/Rank seguindo pelos mesmos caminhos.
- `gameplay.ativo` (em `tc_config`) liga o modo. Ligado, as partidas de técnicos reais esperam `prazo_dias`; passado o prazo o sistema simula sozinho (`tc_simular`), como antes. Desligado, nada muda.
- `tecnico/partida/?teste=1` (somente `localhost`): sala de testes com times sintéticos.

**Limitação importante**: o resultado vem do navegador. Enquanto o jogo é só para administradores isso basta; antes de abrir ao público, a simulação oficial deve rodar no servidor. `ferramentas/auditar.mjs` reexecuta um mapa (mesma semente, escalações e versão) para conferir resultados.

## Resultados de equilíbrio medidos (versão 1 das regras)

Lotes de partidas completas (`simular-lote.mjs`): duração média 30–37 min (mín. 22, máx. 56), 50–58 abates, 13–16 torres derrubadas, primeira torre aos 10–12 min, 7–9 objetivos épicos, 100% terminam por destruição do Nexus, nenhum erro interno. Poder 75 contra 45: o time forte venceu 75% das partidas (média dos dois lados do mapa) e o fraco venceu 25%. Com times iguais, o lado vermelho venceu cerca de 60%: a geometria da imagem favorece levemente esse lado (o Dragão fica mais perto da base vermelha). Em séries melhor de 3/5 os lados alternam a cada mapa, o que compensa o viés.

## Limitações conhecidas

- CS por minuto baixo (≈2 por campeão contando a selva; o jogo real faz 6–8): a economia é compensada por multiplicadores (`escalaOuro`, `escalaXp`).
- Habilidades são arquétipos configuráveis (12 variantes), não as habilidades reais de cada campeão; não há wards/neblina de guerra renderizada (a visão limita só a IA); itens são 22 genéricos.
- Pick and Ban ainda não existe: os campeões saem dos favoritos do jogador ou do catálogo por posição.
- Posições dos acampamentos e dos covis são estimativas (marcadas com ⚠ na ferramenta de depuração); torres e inibidores foram posicionados por proporção das rotas, pois a imagem não tem estruturas.
- Viés leve a favor do lado vermelho; unidades presas ainda ocorrem esporadicamente (registradas em `diag`).

## Testes e ferramentas

```
node --test tests/partida.test.mjs                  # 30 testes do motor (≈ 1 min)
TC_LENTO=1 node --test tests/partida.test.mjs        # inclui a rodada estatística de Poder (alguns minutos)
node jogos/tecnico/partida/ferramentas/simular-lote.mjs 12 75 45 1 4   # lote: n, poder azul, poder vermelho, semente, trabalhadores
```
Ao mudar qualquer regra que altere resultados, aumente `REGRAS.versao` e `gameplay.versao` no servidor.

## Itemização situacional e subcategorias
- `dados/itemizacao.js`: modelos de build com vagas flexíveis (`?bota`, `?def`, `?defs`, `?pen`, `?surv`) e as subcategorias dos campeões por posição
  (Top, Caçador, Mid, ADC, Suporte → Tanque, Bruiser, Lutador, Assassino, Mago, Híbrido, Atirador, Encantador, Engajador). O papel muda com a posição (`estiloNaPosicao`).
- `motor/itemizacao.js`: `analisarInimigos` lê o time inimigo (dano físico x mágico, tanques, abates) e `construirBuild` resolve as vagas na hora da compra:
  tanques e suportes escolhem armadura ou resistência mágica; carregadores trocam por penetração contra muitos tanques; magos e lutadores levam Banshee, Zhonya, Mortalha ou Anjo
  conforme o dano que recebem. O que já foi comprado fica fixo; o evento `compra` leva `situacional` e `motivo`.
