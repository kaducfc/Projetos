# Idle Hunter

Jogo idle inspirado em **Clicker Heroes** (da Playsaurus) e **IdleArc**, com
um sistema de equipamentos por raridade inspirado em **Monster Hunter**:
você seleciona os monstros que quer caçar, seu personagem bate neles
sozinho (100% DPS, sem clique), e equipamentos dropam prontos, já com
raridade e atributos rolados.

HTML + CSS + JavaScript puro (sem build step, sem dependências externas).

- **Jogar online:** https://kaducfc.github.io/Projetos/

## Como rodar

Os arquivos JS usam ES modules (`import`/`export`), que os navegadores só
carregam via `http://`, não abrindo o `index.html` direto (`file://`) por
causa de restrição de CORS. Então é preciso um servidor local simples:

```bash
cd idle-hunter
python3 -m http.server 8000
# ou: npx serve .
```

Depois abra `http://localhost:8000` no navegador.

### Publicando

- **GitHub Pages** (`gh-pages`): cópia direta de `index.html`, `js/`, `css/`
  e `assets/` na raiz da branch.
- **Artifact**: `build-bundle.mjs` empacota todo o JS/CSS/assets num único
  HTML autocontido (`node build-bundle.mjs > bundle.html`). Ao adicionar um
  novo arquivo em `js/systems/` ou `js/data/`, lembre de incluí-lo em
  `MODULE_ORDER` (respeitando a ordem de dependência), senão o bundle
  publica sem aquele módulo.

## Loop de jogo

1. **Zonas de caça**: os monstros são organizados em **10 Zonas** (não mais
   "estágios" numerados 1-100). Cada Zona tem **5 monstros fracos + 1
   Boss** exclusivo, e escala de poder por um "estágio canônico" fixo
   (Zona N = estágio canônico `10×N`, ver `ZONES` em `js/data/monsters.js`).
   A Zona 1 já vem liberada; as demais (e os 10 Bosses) liberam conforme o
   **nível de caça** do jogador (ver abaixo).
2. **Seleção de monstros** (estilo IdleArc): o jogador escolhe de **1 a 4**
   monstros específicos, de qualquer Zona já liberada, pra efetivamente
   caçar (`state.selectedMonsters`, tela própria de seleção). Só esses
   aparecem na Caça — a cada novo spawn, um deles é sorteado
   uniformemente entre os selecionados (1 selecionado = sempre ele; 2 =
   50/50; até 4 = 25% cada).
3. **Combate é 100% DPS, sem clique**: não existe clique/toque pra causar
   dano. Seu personagem bate sozinho, uma vez a cada
   `1 / velocidadeDeAtaque` segundos (base: 1 hit/segundo, escalável pelo
   atributo **Velocidade de Ataque**) — cada hit resolvido aparece na tela
   como um número de dano flutuante (`resolveHit()`/`advanceHitClock()` em
   `js/systems/combat.js`). O monstro também bate em você continuamente,
   reduzido pela sua **Armadura**; se sua **Vida** zerar, o combate contra
   aquele monstro reinicia. A vida enche 100% a cada novo monstro.
4. **Nível de Caça e XP** (`js/systems/leveling.js`): matar qualquer
   monstro dá XP de caçador (proporcional à força do monstro, sem grande
   disparidade entre zonas — só o suficiente pra não ser plano). Subir de
   nível libera zonas e bosses (nível pra liberar o Boss da Zona N =
   `10×N`; nível pra liberar a Zona N+1 = `20×N`). Por enquanto o nível só
   serve pra isso.
5. **Itens dropam prontos, com raridade**: ao matar um monstro, há **8%**
   de chance de dropar um equipamento daquele slot/zona
   (`ITEM_DROP_CHANCE` em `js/systems/combat.js`), já pronto pra equipar —
   não existe mais crafting. A raridade é sorteada
   (`rollDroppedItem()`/`RARITIES` em `js/data/items.js`):

   | Raridade  | Chance | Bônus adicionais | Cor    |
   |-----------|-------:|------------------:|--------|
   | Comum     | 60%    | 0                  | cinza  |
   | Incomum   | 24%    | 1                  | verde  |
   | Raro      | 10%    | 2                  | azul   |
   | Épico     | 4%     | 3                  | roxo   |
   | Lendário  | 1.5%   | 4                  | amarelo|
   | Mítico    | 0.5%   | 5                  | vermelho |

   Raridades mais altas também rolam atributos base mais fortes (multiplicador
   por tier) e cada atributo (base e adicional) tem uma pequena variação
   aleatória — dois itens da mesma raridade/slot nunca saem idênticos. É
   como se cada Zona tivesse seu próprio "set" (o set do boss daquela
   zona), com a raridade decidindo o quão forte é a rolagem daquela peça.
   Bordas e fundo dos ícones de item (inventário, paperdoll de
   equipamento, popup de detalhe) refletem a cor da raridade.
6. **Aprimoramento (+1 a +5 e Rank Master)**: continua igual a antes — cada
   peça pode ser aprimorada individualmente, consumindo materiais que
   ainda dropam dos monstros (agora só alimentam o aprimoramento, não mais
   um custo de craft). Rank Master consome também 1 Cristal do chefe
   daquele set.
7. **Elementos**: todo monstro tem um elemento (Neutro, Fogo, Planta,
   Elétrico ou Água) — ver "Como os elementos funcionam" abaixo.
8. **Upgrades**: comprados com ouro, aumentam DPS/Velocidade de
   Ataque/vida/armadura/ouro/chance de drop. Progresso linear, sem reset.
9. **Chefe de evento, Torre das Provações e Mina de Ouro** (aba 🎪
   Eventos): três atividades por relógio de parede, ver seção própria
   abaixo — não usam clique, só DPS, como o resto do jogo.
10. **🏆 Conquistas, 💎 Cash e 🛒 Loja**: Cash é a moeda premium, ganha via
    conquistas e "anúncio simulado". Loja vende pacotes de ouro e itens
    com Moeda de Evento.
11. **🃏 Cartas**: sub-aba dentro de Equipamento — colecione cartas de
    monstro (drop raro) e encaixe nos slots de carta do equipamento.

## Decisão de design: progresso é linear, sem prestígio

Idle Hunter não tem nenhum mecanismo de reset — ouro, nível de caça e
upgrades acumulam para sempre.

## Como os elementos funcionam

Ciclo simples de 4 elementos, cada um batendo no próximo e perdendo pro
anterior (`js/data/elements.js`):

```
Fogo → Planta → Elétrico → Água → Fogo
```

Fogo vence Planta e perde para Água; Planta vence Elétrico e perde para
Fogo; Elétrico vence Água e perde para Planta; Água vence Fogo e perde
para Elétrico. Combinações não-vizinhas são neutras. Neutro nunca tem
vantagem nem desvantagem, dos dois lados. A arma equipada herda o
elemento do monstro de quem o set veio e causa +25%/-25% conforme
vantagem/desvantagem; cada peça de defesa dá +5% de resistência ao
elemento de quem ela veio.

## Eventos especiais (aba 🎪 Eventos)

- **Invasão de Chefes**: uma família de monstro vira "chefe de evento" por
  uma janela de tempo, com HP fixo (chefe real da Zona × multiplicador).
- **Torre das Provações** (`js/systems/tower.js`): andares progressivos —
  o jogador sobe enquanto aguentar, com HP próprio.
- **Mina de Ouro** (`js/systems/goldmine.js`): um Chefe de Ouro com HP
  altíssimo e prazo fixo por tentativa; a recompensa é ouro proporcional
  ao dano causado, não uma tabela de drop.

Todos os três são resolvidos por relógio de parede (`getEventWindow()`
em `js/data/events.js`) — nada sobre "quando abre" é salvo, é derivado de
`Date.now()`, então reabrir o jogo em qualquer momento cai no estado
certo automaticamente.

## Estrutura

```
index.html            Layout da página (elementos fixos; conteúdo dinâmico via JS)
css/style.css          Tema visual (dark fantasy)
assets/                Sprites, cenários, ícones de item/material/carta
js/
  main.js               Bootstrap: game loop (relógio de hit por contexto), wiring de eventos, save/load
  state.js              Estado do jogo + persistência (localStorage)
  format.js              Formatação de números grandes (1.2K, 3.4M, ...)
  version.js             Etiqueta de build exibida na barra superior
  data/
    monsters.js           BOSSES (10) e WEAK_MONSTER_GROUPS (25 monstros fracos); ZONES agrupa em 10 zonas flat (5 monstros fracos + boss cada), com zoneUnlockLevel/bossUnlockLevel
    items.js               RARITIES (pesos/multiplicadores/adicionais por tier), rollDroppedItem() (geração de item pronto por drop), enhancement (+1..+5, Rank Master)
    elements.js             Ciclo de elementos e cálculo de vantagem/desvantagem
    upgrades.js             Upgrades comprados com ouro (DPS, velocidade de ataque, vida, armadura, ouro, drop)
    events.js                Janela dos eventos (rotação por relógio de parede)
    achievements.js           Lista de conquistas e sua recompensa em Cash
    shop.js                    Itens compráveis com Cash e com Moeda de Evento
    cards.js                    Uma carta por chefe/monstro fraco — coleta + bônus elemental
  systems/
    leveling.js             Curva de XP, grantXp(), isZoneUnlocked()/isBossUnlocked()
    stats.js                Agrega equipamento + upgrades → DPS/velocidade de ataque/vida/armadura/resistência finais
    combat.js                HP/recompensa/dano do monstro por zona, relógio de hit (advanceHitClock/resolveHit), drops, seleção de monstro
    equipment.js              Equipar/desequipar, resolver o que está em cada slot
    crafting.js                Aprimoramento (+1..+5, Rank Master via Cristal), slot de carta (desbloqueio/encaixe/remoção), destruir item
    upgrades.js                 Compra de upgrades
    offline.js                    Progresso estimado (XP, drops) enquanto a aba estava fechada
    events.js                     Dano/HP/recompensa do chefe de evento
    tower.js                       Torre das Provações
    goldmine.js                    Mina de Ouro
    achievements.js                Checagem e resgate de conquistas
    shop.js                        Compra com Cash / Moeda de Evento, cooldown do anúncio
  ui/
    render.js                     Toda a renderização (HTML gerado via template strings)
```

Sem framework: `main.js` escuta eventos DOM, chama as funções dos
`systems/*` (que só mexem no objeto `state`, sem tocar no DOM) e depois
chama `render.js` para atualizar a tela.

## Balanceamento

Pontos mais fáceis de ajustar:

- `js/systems/combat.js`: `HP_GROWTH`, `GOLD_GROWTH`, `ITEM_DROP_CHANCE`
  (8%), `CRYSTAL_DROP_CHANCE`, `BOSS_CARD_DROP_CHANCE`/`WEAK_CARD_DROP_CHANCE`.
- `js/data/items.js`: `RARITIES` (pesos, multiplicador e nº de adicionais
  por tier), `TIER_GROWTH`, `ENHANCE_PER_LEVEL_MULT`, `MASTER_MARGIN`.
- `js/data/monsters.js`: `zoneUnlockLevelFor`/`bossUnlockLevelFor` (nível
  de caça pra liberar zona/boss), `BOSSES`/`WEAK_MONSTER_GROUPS` (roster).
- `js/systems/leveling.js`: `xpToNextLevel()`/`xpForZone()` (curva de XP).
- `js/data/upgrades.js`: `baseCost`/`costGrowth` de cada upgrade.
- `js/systems/stats.js`: `BASE_MAX_HP`, `BASE_ARMOR`, `CARD_DAMAGE_BONUS`.
- `js/data/elements.js`: `ELEMENT_DAMAGE_BONUS` (±25%), `ELEMENT_RESISTANCE_PER_PIECE` (5%).
- `js/data/events.js`: janelas e recompensas dos três eventos.
- `js/systems/crafting.js`: `CARD_SLOT_UNLOCK_CHANCE`, `DESTROY_REFUND_RATE`.

## Testado

Rodei o jogo de ponta a ponta num navegador headless (seleção de
monstros, combate por DPS/relógio de hit, drop de item com raridade
verificada estatisticamente contra as porcentagens-alvo, level-up e
desbloqueio de zona/boss, aprimoramento até Rank Master, socket de carta,
Torre/Invasão/Mina de Ouro, save/load) — sem erros no console. Vale um
play manual seu para validar a sensação de progressão/dificuldade, que é
subjetiva.

**Limitação conhecida**: só existem 5 `WEAK_MONSTER_GROUPS` (bandas de
monstro fraco) pra 10 Zonas, então pares de zonas (ex: Zona 1 e Zona 2)
mostram os mesmos monstros fracos, diferindo só na escala de poder
(`canonicalStage`). Arte nova pra mais bandas resolveria isso.
