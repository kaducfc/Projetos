# Idle Hunter

Jogo idle/clicker inspirado em **Clicker Heroes** (da Playsaurus), com um
sistema de equipamentos e crafting inspirado em **Monster Hunter**: você
derrota monstros para conseguir materiais e usa esses materiais para
fabricar o equipamento daquele monstro específico.

HTML + CSS + JavaScript puro (sem build step, sem dependências externas).

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

## Loop de jogo

1. **Combate**: clique no monstro para causar dano de clique instantâneo;
   seu DPS (dano por segundo) também bate automaticamente, mesmo sem
   clicar — essa é a parte "idle". Ao derrotar um monstro você ganha ouro
   e (com chance) materiais de craft, e avança para o próximo estágio.
   Só que agora **o monstro também bate em você** continuamente (dano por
   segundo próprio, escalando com o estágio), reduzido pela sua
   **Armadura**. Se sua **Vida** chegar a zero, você morre e recua um
   estágio — exatamente como o timeout de chefe (recorde de estágio
   máximo preservado). Sua vida enche 100% sempre que um monstro novo
   aparece (novo estágio ou novo spawn), então cada combate é um teste
   de "aguento esse aqui?", não desgaste acumulado enquanto você tá AFK.
2. **Estágios**: cada família de monstro ocupa um bloco de 20 estágios (com
   materiais e arma próprios), mas **todo estágio múltiplo de 10 é um
   chefe** — igual ao Clicker Heroes — reaproveitando o chefe da família
   com HP/recompensas maiores. Dá pra navegar (◀ ▶) para qualquer estágio
   já alcançado e farmar ali — é assim que você junta material de um
   monstro específico para craftar o set dele.
3. **Chefes têm prazo**: ao alcançar um chefe pela primeira vez (estágio
   ainda não superado), você tem **30 segundos** para derrotá-lo. Se o
   tempo acabar, você recua um estágio (o recorde de estágio máximo não
   é perdido, só sua posição atual). Chefes que você já derrotou antes
   não têm mais prazo — pode farmar neles à vontade.
4. **Equipamentos**: 6 slots — Elmo, Peitoral, Calça, Luvas, Botas
   (defesa) e Arma (ataque: lança, adaga, arco, martelo, machado ou
   espada, dependendo da família). A aba **Equipamento** tem 3 sub-abas:
   **Equipar** (o personagem no centro com os 6 slots ao redor — só o
   ícone do item, ou apagado se vazio — e o inventário completo embaixo,
   também só ícones), **Forjar** (craft de cada peça com ouro + materiais
   daquele monstro, equipada automaticamente ao craftar) e **Materiais**
   (quanto você tem de cada material). As três eram abas separadas antes;
   viraram sub-abas porque são todas sobre a mesma coisa — seu
   equipamento — e assim sobra espaço na navegação principal. Clique em
   qualquer ícone na sub-aba Equipar, equipado ou não, pra abrir um popup
   com nome, stats, aprimoramento e o botão de Equipar/Desequipar. Cada
   peça craftada já
   reserva um **slot de carta** (estilo Ragnarok Online) — visível nesse
   popup como "vazio". Monstros já têm uma pequena chance (2%) de dropar a
   própria carta ao morrer, coletável na sub-aba **Cartas** (dentro de
   Equipamento) — mas o encaixe em si (usar uma carta pra preencher o slot
   de um item e ativar o bônus dela) ainda não existe, só a coleta. Ver
   "O sistema de Cartas" mais abaixo.
   Além do stat principal de cada peça, as 5 peças de defesa também dão
   **Vida** (Elmo, Calça, Botas) ou **Armadura** (Peitoral, Luvas) — é
   assim que o equipamento te deixa sobreviver a estágios mais altos, não
   só bater mais forte.
5. **Aprimoramento (+1 a +5 e Rank Master)**: cada peça craftada pode ser
   aprimorada individualmente na aba Equipamento. +1 a +5 gastam o
   material **comum** daquele monstro (fica mais caro a cada nível — "pouco
   a pouco"); depois de +5, dá pra evoluir pra **Rank Master** consumindo
   **mais material comum** (continuando a mesma progressão, como um "+6")
   **e 1 Gema** daquele monstro. Todo monstro (comum ou chefe) da família
   tem **0,5% de chance** de dropar a Gema dele a cada morte. Rank Master
   deixa o item um pouco mais forte que a versão +0 do próximo monstro na
   cadeia
   — ver a conta em "Como o aprimoramento é calculado" abaixo.
6. **Elementos**: todo monstro tem um elemento (Neutro, Fogo, Planta,
   Elétrico ou Água) — veja o badge colorido ao lado do nome dele. Sua
   arma herda o elemento do monstro de quem foi craftada e causa **+25%**
   de dano se tiver vantagem contra o monstro atual, **-25%** se tiver
   desvantagem, ou nada se qualquer um dos dois for Neutro. Cada peça de
   **defesa** dá **+5% de resistência** ao elemento do monstro de quem
   ela veio (então usar peças do mesmo monstro empilha resistência contra
   aquele elemento especificamente). Detalhes e a tabela de vantagens em
   "Como os elementos funcionam" abaixo.
7. **Upgrades**: comprados com ouro, aumentam dano/DPS/ouro/chance de
   material. Cada card mostra nível atual, o bônus que você **já tem**
   nesse nível (`Atual: +8`, por exemplo) e o bônus que o **próximo**
   nível dará (`Próximo: +12`) lado a lado, então dá pra ver de cara o
   quanto vale a próxima compra sem fazer conta de cabeça. Resetam a cada
   renascimento.
8. **Prestígio (Renascer)**: ao alcançar o estágio 20+, você pode
   renascer: ganha Runas (baseado no estágio máximo alcançado) e reseta
   ouro/estágio/upgrades comuns. Runas compram upgrades **permanentes**
   (Poder Ancestral, Fortuna Eterna, Faro Apurado, Início Avançado) — os
   cards deles mostram o mesmo Atual/Próximo dos upgrades comuns.
9. **Chefe de evento (aba 🎪 Eventos)**: a cada 15 minutos (relógio de
   parede, não precisa estar com o jogo aberto), uma família de monstro
   diferente vira "chefe de evento" por 5 minutos. Diferente do combate
   normal, esse chefe **só toma dano de clique** — sem DPS passivo — e uma
   vez que você acerta o primeiro golpe, tem **50 segundos fixos** pra
   terminar, sempre, não importa a família (se o tempo acabar, dá pra
   tentar de novo, contanto que a janela de 5 minutos ainda esteja
   aberta). O HP dele é o HP do **chefe de verdade** daquela família
   (o mesmo chefe que aparece no estágio final do bloco dela, no combate
   normal), só que **30% mais forte** — então cada família tem uma
   dificuldade de evento fixa e previsível, na mesma proporção da
   dificuldade que ela já tem no jogo normal. Quem escala com o estágio é
   a **recompensa**: ao derrotar, você sempre ganha **1 a 6 materiais** (a
   "chance de drop aumentada" é expressa como bônus garantido, não como
   mais uma rolagem de dado) e uma quantidade de **🎫 Moeda de Evento**. Só
   dá pra derrotar (e resgatar a recompensa) uma vez por janela.
10. **🏆 Conquistas, 💎 Cash e 🛒 Loja**: Cash é a moeda premium do jogo,
    com sua própria aba **Conquistas** — uma lista de marcos ("alcance o
    estágio 25", "evolua um item pra Rank Master") que pagam Cash ao
    serem cumpridos, mais um botão de **anúncio simulado** (sem SDK de
    anúncio real integrado ainda, só concede a recompensa direto, com
    cooldown de 5 minutos). A aba **Loja** é só pra *gastar*: sub-aba Cash
    (pacotes de ouro/Runas, mais uma seção de compra com dinheiro real
    desabilitada — "em breve", estrutura pronta pra uma futura integração
    de pagamento mas nada funcional ainda) e sub-aba 🎫 Moeda de Evento
    (ganha só derrotando o chefe de evento), com Gemas
    e pacotes de material de qualquer família já desbloqueada. Ambas as
    moedas (💎 Cash e 🎫 Moeda de Evento) aparecem também na barra
    superior, ao lado de Ouro e Runas, então dá pra acompanhar as quatro
    moedas sem entrar em nenhuma aba.
11. **🃏 Cartas**: sub-aba dentro de Equipamento, um inventário só das
    cartas de monstro que você já coletou (ver "O sistema de Cartas"
    abaixo).

## Decisão de design: o que sobrevive ao renascimento

Diferente de heróis em Clicker Heroes (que resetam), aqui **equipamentos
craftados e materiais permanecem depois de renascer**. A ideia é que o
craft é uma coleção permanente — faria o esforço de farmar/craftar parecer
descartável se resetasse a cada prestígio. O que reseta é só o progresso
"macio": ouro, estágio atual e upgrades comprados com ouro. Quem carrega o
poder entre runs são os upgrades de Runas (permanentes) — esse é o mesmo
papel que os "Ancients" cumprem no Clicker Heroes original.

Se você preferir o comportamento clássico (equipamento também reseta), a
mudança é pequena: em `js/systems/prestige.js`, função `doRebirth`, é só
também limpar `state.inventory`, `state.equipped` e `state.materials`.

## Decisão de design: o prazo do chefe não é salvo

O contador de 30s (`bossDeadline` em `js/main.js`) é deliberadamente **não
persistido** no save — só existe em memória enquanto a aba está aberta.
Assim, fechar/recarregar a página sempre te dá uma tentativa limpa contra
o chefe, em vez de arriscar zerar o tempo enquanto você não estava
olhando. O prazo também só existe enquanto o chefe é a fronteira do seu
progresso (`state.stage === state.maxStage`); revisitar um chefe já
derrotado pra farmar material nunca tem pressa.

## Decisão de design: vida cheia a cada monstro, dano recebido não é salvo

Igual ao `bossDeadline`, a vida atual (`currentHp` em `js/main.js`) **não
é persistida** e é restaurada por completo sempre que um monstro novo
aparece — seja porque você matou o anterior, seja porque navegou pra
outro estágio, seja porque acabou de abrir o jogo. A alternativa (vida
indo se acumulando/desgastando entre vários monstros, inclusive offline)
faria pouco sentido num idle: monstros triviais que você já superou iam
eventualmente te matar só por ficar ausente. Assim, morrer significa
especificamente "esse monstro/chefe é forte demais pro meu equipamento
atual" — o gatilho certo pra você ir farmar/craftar, não punição por
estar de boa numa fase fácil.

A fórmula de redução de dano pela Armadura tem retorno decrescente
(`armadura / (armadura + 100)`, em `armorReduction()` de
`js/systems/combat.js`) — nunca chega a 100%, então armadura sempre vale
a pena empilhar, mas nunca te deixa invencível.

## Como o aprimoramento é calculado

Cada família de monstro é ~2,15× mais forte que a anterior (`TIER_GROWTH`
em `js/data/items.js` — é a mesma constante usada para gerar os itens
base). O Rank Master de um item mira um alvo fixo: `TIER_GROWTH ×
MASTER_MARGIN` (2,15 × 1,03 ≈ 2,21×) o valor do item em +0 — ou seja,
sempre ~3% acima do +0 do próximo monstro, não importa a família. +1 a +5
sobem 9% compostos por nível (`ENHANCE_PER_LEVEL_MULT`) até chegar a
~1,54× em +5; o salto de +5 pra Rank Master é o resto da conta (~44%),
sentindo como a evolução rara que ele é. Isso vale pra qualquer stat que o
item tenha (dano, DPS, %, etc.) — todos escalam pelo mesmo multiplicador.

## Como os elementos funcionam

Ciclo simples de 4 elementos, cada um batendo no próximo e perdendo pro
anterior (`js/data/elements.js`):

```
Fogo → Planta → Elétrico → Água → Fogo
```

Ou seja: Fogo tem vantagem contra Planta e perde para Água; Planta vence
Elétrico e perde para Fogo; Elétrico vence Água e perde para Planta; Água
vence Fogo e perde para Elétrico. Combinações "não-vizinhas" no ciclo
(ex: Fogo vs Elétrico) são neutras — sem bônus nem penalidade. Neutro
nunca tem vantagem nem desvantagem, dos dois lados.

Cada família de monstro tem um elemento fixo (Chispim e Lobo = Elétrico,
Aranha = Planta, Wyvern de Gelo = Água, Dragão = Fogo; Golem é Neutro). O elemento da sua **arma** é sempre o da família de quem ela foi
craftada — é o único item que "ataca", então só ele entra na conta de
±25%. Já a **resistência** (+5% por peça) olha o elemento de cada peça de
**defesa** individualmente contra o elemento do monstro atual — não tem
relação com o ±25% de vantagem/desvantagem, é uma redução separada que
soma com a fórmula de Armadura (multiplicativamente, então nenhuma das
duas isoladamente derruba o dano a zero).

## O boneco da aba Equipamento (paper doll)

O personagem no centro da aba Equipamento é uma pilha de duas camadas
(`characterVisual()` em `js/ui/render.js`): por baixo, um SVG do corpo
base (boneco cartoon só de sunga, `characterSvg()`); por cima, um `<div>`
com `position: relative` que recebe um `<img class="gear-overlay">`
absolutamente posicionado para cada slot equipado que tenha arte real
(hoje só o Chispim — veja a seção seguinte). Cada imagem é ancorada por
um ponto central (`GEAR_OVERLAY_ANCHORS`: `left`/`top` em % da caixa do
boneco, mais `width` e `z-index`) calibrado visualmente pra cair sobre a
cabeça/torso/pernas/mãos certos, na ordem de "vestir" (pernas → botas →
peitoral → elmo → luvas → arma por cima de tudo, pra parecer empunhada).

Para slots equipados **sem** arte real (qualquer família além do
Chispim), o boneco cai de volta no comportamento antigo: uma forma lisa
dentro do próprio SVG, pintada com a cor do **elemento** do item
(amarelo = Elétrico, vermelho = Fogo, etc. — mapa `ELEMENT_COLORS`). As
duas coisas convivem no mesmo boneco: dá pra ter, por exemplo, elmo com
arte real do Chispim e calça de outra família aparecendo como bloco
colorido, ao mesmo tempo, sem conflito.

Nota sobre o rebrand do primeiro monstro (Chispim): os ids internos da
família continuam `boar`/`boar_*` de propósito — eles são chaves de save
(inventário e contagem de materiais), então renomeá-los quebraria saves
existentes. Só os nomes/emoji/elemento exibidos mudaram.

## Arte real do Chispim (`assets/chispim/`)

O Chispim é a primeira (e por enquanto única) família com arte de
referência de verdade em vez de emoji. `assets/chispim/reference-sheet.jpeg`
é o sheet original enviado pelo usuário (monstro + 5 peças de defesa + 4
armas); um script Python com Pillow detectou os limites de cada sprite
por densidade de pixel não-branco (col/row bounds), recortou com um
padding pequeno e converteu o fundo branco em transparência, gerando os
7 PNGs usados no jogo (`monster.png`, `helm.png`, `armor.png`, `pants.png`,
`luvas.png`, `botas.png`, `dualblade.png` — as 3 armas não usadas pelo
Chispim, espada grande/arco/lança, ficaram só no sheet de referência).

No código, `MONSTER_FAMILIES[0]` (o `boar`) ganhou os campos opcionais
`image` (ícone do monstro) e `images` (um por slot); `buildItem()` em
`items.js` copia o caminho certo de `family.images[slot.id]` para
`item.image` quando existe. `render.js` tem um helper único,
`iconMarkup(image, emoji, alt)`, que troca emoji por `<img>` sempre que
`image` estiver presente — usado no sprite do monstro, nos cards da
Forja, nos ícones da aba Equipamento (anel de slots + grade de
inventário) e no popup de detalhe do item. O CSS não precisou de regra
por contexto: toda imagem tem `width/height: 1em`, então ela herda o
`font-size` que cada `.icon` já tinha para o emoji. O boneco (seção
anterior) usa o mesmo `item.image`, mas em vez do truque de `1em` ele
posiciona a imagem em cima do corpo via `GEAR_OVERLAY_ANCHORS`.

Qualquer família sem `images` continua caindo no emoji normalmente —
adicionar arte pra outro monstro é só repetir o mesmo padrão (`image` +
`images` no objeto da família em `monsters.js`).

## Decisão de design: a aba Equipamento é só ícones + um popup

Todo detalhe de item (stats, elemento, aprimoramento, botão de
Equipar/Desequipar) mora num único popup compartilhado — o mesmo
`#modal-overlay` já usado para o aviso de progresso offline (`showModal`/
`hideModal` em `render.js`). Clicar em qualquer ícone (slot no personagem
ou item no inventário) chama `showEquipSlotModal`/`showItemDetailModal`,
que só leem `state` e desenham o popup; a mutação de verdade (equipar,
desequipar, aprimorar, evoluir pra Rank Master) acontece via um único
listener delegado em `#modal-overlay`, wireado uma vez em `main.js`
(`wireModalEvents`) — igual ao padrão já usado pros outros listeners
delegados do jogo. Aprimorar/evoluir mantém o popup aberto e só atualiza
o conteúdo dele, pra dar pra clicar "Aprimorar" várias vezes seguidas sem
reabrir nada.

Desde que Forjar/Materiais viraram sub-abas de Equipamento, a aba inteira
passou a usar esse mesmo padrão de listener único delegado
(`wireEquipmentTabEvents()` em `main.js`, wireado uma vez no `init()`) —
antes, os cliques nos slots/itens eram religados a cada `renderEquipmentTab()`
(seguro só porque o container inteiro era recriado antes). Como essa aba
agora recria seu conteúdo com muito mais frequência (qualquer clique na
Forja, troca de sub-aba, etc.) e é justamente onde o projeto já tropeçou
duas vezes com listener duplicado, delegar no container estável em vez de
religar a cada render eliminou a categoria de bug de uma vez.

## Decisão de design: o chefe de evento é 100% baseado em relógio de parede

`getEventWindow()` (`js/data/events.js`) não guarda "quando o próximo
evento começa" em nenhum lugar do save — ele deriva tudo de `Date.now()`:
`cycleIndex = floor(now / EVENT_CYCLE_MS)` decide qual família está na
vez (`cycleIndex % número de famílias`) e se essa janela ainda está
dentro dos primeiros `EVENT_ACTIVE_MS`. Isso significa que offline não
precisa de nenhuma lógica de "recuperar o que perdi": o relógio andou
igual pra todo mundo, então reabrir o jogo em qualquer momento já cai no
estado certo automaticamente, sem cálculo de catch-up nem risco de
dessincronizar com um valor salvo antigo.

O combate em si também é deliberadamente diferente do resto do jogo: o
chefe de evento **só toma dano de clique** (nenhum tick de DPS passivo
bate nele — só o combate do estágio atual continua recebendo DPS
normalmente). A ideia é que evento seja uma atividade ativa e curta
("chefe correria"), não mais uma coisa pra deixar rodando sozinha; por
isso também não causa dano de volta no jogador (sem risco de vida) e o
prazo por tentativa (`EVENT_TIME_LIMIT_MS`, `js/data/events.js`) é
**fixo em 50 segundos**, sempre, não importa a família ou o estágio do
jogador.

O HP do chefe de evento (`computeEventBossMaxHp()` em
`js/systems/events.js`) reaproveita a mesma fórmula do combate normal —
`monsterMaxHp(family.endStage)`, que é exatamente o HP do chefe de
verdade daquela família (`endStage` é sempre um estágio de chefe, já que
o tamanho do bloco de estágios é múltiplo do intervalo de chefes) — só
multiplicado por `EVENT_DIFFICULTY_MULT` (1.3, ou seja **30% mais
difícil** que o chefe original). Isso é bem diferente de escalar pelo
dano de clique do próprio jogador: a dificuldade de cada família de
evento é fixa e sempre proporcional à dificuldade que ela já tem no jogo
normal, então famílias no fim da progressão (Dragão Ancião, por exemplo)
são chefes de evento muito mais duros que as do início — não existe
autoequilíbrio pelo poder do jogador, é uma dificuldade "de verdade"
amarrada ao estágio daquela família.

## O sistema de Cartas (metade construída, de propósito)

Cada família de monstro tem uma carta (`js/data/cards.js`, `CARDS` — um
por família, gerado a partir de `MONSTER_FAMILIES`), com 2% de chance de
dropar de qualquer monstro daquela família, comum ou chefe
(`CARD_DROP_CHANCE` em `js/systems/combat.js`). É uma rolagem separada
das de material/Gema — mesma mecânica, `drops.push()` com uma flag
`isCard: true` a mais, que `applyDamage()` usa pra decidir se o drop vai
para `state.materials` ou para o novo `state.cards` (as duas coleções
usam o mesmo formato `id -> contagem`, então uma carta é "empilhável"
como um material, não um item único com uid como equipamento). O mesmo
desvio por `isCard` foi replicado em `systems/offline.js`, senão uma
carta ganha enquanto a aba estava fechada acabaria parando em
`state.materials` por engano.

O que existe: a coleta (drop + `state.cards` + a sub-aba **Cartas** em
Equipamento mostrando ícone, nome, descrição de sabor e quantidade). O
que **não** existe ainda: encaixar uma carta no slot de um item
equipado. A estrutura pra isso já estava pronta antes mesmo de existir
uma carta pra usar (`inventory[i].cardId`, função `socketCard()` em
`js/systems/crafting.js`, badge "Slot de Carta" no popup de detalhe do
item) — falta só a UI de "escolher uma carta da sua coleção e encaixar
num item" e os efeitos dela entrando de fato em
`systems/stats.js` (`computePlayerStats`). A descrição de cada carta
(`+3% de dano contra o elemento X`) já é o texto que o bônus teria
quando isso for implementado — por enquanto é só sabor, não afeta o
combate.

## Estrutura

```
index.html            Layout da página (elementos fixos; conteúdo dinâmico via JS)
css/style.css          Tema visual (dark fantasy)
assets/chispim/        Arte real do Chispim (PNGs recortados) + sheet de referência original
js/
  main.js               Bootstrap: game loop, wiring de eventos, save/load
  state.js              Estado do jogo + persistência (localStorage)
  format.js              Formatação de números grandes (1.2K, 3.4M, ...)
  data/
    monsters.js           As 6 famílias de monstro, estágios, materiais, elemento
    items.js               Geração dos 36 itens equipáveis (6 famílias × 6 slots)
    elements.js             Ciclo de elementos e cálculo de vantagem/desvantagem
    upgrades.js             Upgrades comuns (ouro) e de prestígio (Runas)
    events.js                Janela do chefe de evento (rotação por relógio de parede)
    achievements.js           Lista de conquistas e sua recompensa em Cash
    shop.js                    Itens compráveis com Cash e com Moeda de Evento
    cards.js                    Uma carta por família de monstro (coleta; encaixe ainda não existe)
  systems/
    stats.js                Agrega equipamento + upgrades → dano/DPS/bônus/resistência elemental finais
    combat.js                HP/recompensa/dano do monstro por estágio, drops, kill/spawn
    equipment.js              Equipar/desequipar, resolver o que está em cada slot
    crafting.js                Checagem de custo, craft e aprimoramento (+1..+5, Rank Master)
    upgrades.js                 Compra de upgrades comuns e de prestígio
    prestige.js                  Cálculo de Runas e lógica de renascimento
    offline.js                    Progresso estimado enquanto a aba estava fechada
    events.js                     Dano/HP/recompensa do chefe de evento
    achievements.js                Checagem e resgate de conquistas
    shop.js                        Compra com Cash / Moeda de Evento, cooldown do anúncio
  ui/
    render.js                     Toda a renderização (HTML gerado via template strings)
```

Sem framework: `main.js` escuta eventos DOM, chama as funções dos
`systems/*` (que só mexem no objeto `state`, sem tocar no DOM) e depois
chama `render.js` para atualizar a tela. Fácil de seguir o fluxo:
evento → muda estado → re-renderiza.

## Balanceamento

Os números (HP, ouro, custo de upgrade, stats de item) são um ponto de
partida razoável, testado manualmente, mas não extensivamente calibrado
para uma curva de progressão "perfeita" de longo prazo — normal em um
primeiro MVP. Os pontos mais fáceis de ajustar:

- `js/systems/combat.js`: `HP_GROWTH`, `GOLD_GROWTH`, chances de drop.
- `js/data/items.js`: `tierBase()` e os multiplicadores por slot.
- `js/data/upgrades.js`: `baseCost`/`costGrowth` de cada upgrade.
- `js/systems/prestige.js`: fórmula de `runasGain`.
- `js/data/monsters.js`: `BOSS_INTERVAL` (frequência de chefes).
- `js/main.js`: `BOSS_TIME_LIMIT_MS` (prazo do chefe).
- `js/data/items.js`: `ENHANCE_PER_LEVEL_MULT`, `MASTER_MARGIN` (curva de aprimoramento).
- `js/systems/combat.js`: `GEM_DROP_CHANCE` (chance de Gema, 0,5% por padrão).
- `js/systems/stats.js`: `BASE_MAX_HP`, `BASE_ARMOR` (vida/armadura antes de qualquer equipamento).
- `js/systems/combat.js`: `PLAYER_DPS_TAKEN_GROWTH`/`_BASE`, `BOSS_DPS_TAKEN_MULT`, `ARMOR_CONSTANT`.
- `js/data/elements.js`: `ELEMENT_DAMAGE_BONUS` (±25%), `ELEMENT_RESISTANCE_PER_PIECE` (5%).
- `js/data/events.js`: `EVENT_CYCLE_MS`/`EVENT_ACTIVE_MS` (frequência/duração da janela), `EVENT_TIME_LIMIT_MS` (prazo fixo por tentativa, 50s), `EVENT_DIFFICULTY_MULT` (quanto mais forte que o chefe original, 1.3 = 30%), `EVENT_CURRENCY_BASE`/`_PER_STAGE` (recompensa).
- `js/data/shop.js`: preços em `CASH_SHOP_ITEMS`/`eventShopItemsForFamily()`, `AD_WATCH_COOLDOWN_MS`/`_CASH_REWARD`.
- `js/data/achievements.js`: `cashReward` de cada conquista.
- `js/systems/combat.js`: `CARD_DROP_CHANCE` (chance de carta, 2% por padrão).

## Testado

Rodei o jogo de ponta a ponta num navegador headless (clique, DPS
automático, avanço de estágio, craft, equipar, troca de estágio para
farm, renascimento, progresso offline ao reabrir, morte/recuo de estágio,
vida/armadura vindas de equipamento, os três casos de matchup elemental —
vantagem/desvantagem/neutro — testados isoladamente, resistência
elemental por peça validada com teste unitário direto, o bug de
atualização da aba Equipamento corrigido e confirmado, e layout em
viewport mobile) — sem erros no console. Vale um play manual seu para
validar a sensação de progressão/dificuldade (inclusive a nova curva de
risco de morte), que é subjetiva.

Testei Cash/Eventos/Loja também: para o chefe de evento eu precisei
sobrescrever `Date.now()` no browser (via `page.addInitScript`) pra cair
dentro de uma janela ativa sem esperar até 15 minutos de verdade —
confirmei a rotação de família (índice de ciclo → família diferente a
cada 15 min), o combate só-por-clique matando o chefe e concedendo 1–6
materiais + Moeda de Evento, o bloqueio de re-farm no mesmo ciclo
("Evento concluído!"), o timeout abortando a tentativa (e permitindo
tentar de novo dentro da mesma janela), e — um bug real que esse teste
pegou — a prévia "Próximo evento" mostrando a família errada (a que
acabou de ser derrotada, em vez da próxima no rodízio), corrigido antes
de terminar. Testei também o cooldown do botão de anúncio (Cash
concedido, botão desabilita e mostra contagem regressiva), resgate de
conquista, compra com Cash (ouro/Runas) e com Moeda de Evento (Gema/
material), e migração de um save antigo (sem nenhum desses campos) sem
erro no console. Os pacotes de "Cash com dinheiro real" são só uma
prévia visual desabilitada — não há integração de pagamento real.

Depois, na reorganização (Forjar/Materiais viraram sub-abas de
Equipamento, Conquistas virou aba própria separada da Loja, prazo do
chefe de evento fixo em 50s, dificuldade dele = 30% acima do chefe de
verdade da família), retestei o fluxo inteiro: craft e equipar via o
novo listener delegado único da aba Equipamento (inclusive trocando de
sub-aba no meio), as 3 sub-abas renderizando o conteúdo certo, Conquistas
e Loja aparecendo como abas separadas (Loja sem mais o botão de anúncio
nem a lista de conquistas), e confirmei numericamente — computando a
mesma fórmula em Node e comparando com o HP real gerado no browser — que
o HP do chefe de evento bate exatamente com `monsterMaxHp(family.endStage)
× 1.3` para a família ativa no momento do teste, e que o prazo por
tentativa é sempre 50s cravados, não importa a família. Sem erros no
console em nenhum desses passos.

Depois, mais uma rodada pros três últimos pedidos: no card de cada
upgrade (comum e de Runas), comprei alguns níveis e conferi que
"Atual"/"Próximo" atualizam junto com o nível (nível 2 de Treino de
Força mostrou "Atual: +8 → Próximo: +12", batendo com
`nível × valuePerLevel`). Na barra superior, confirmei visualmente que
💎 Cash e 🎫 Moeda de Evento aparecem ao lado de Ouro/Runas/Estágio sem
quebrar o layout em 480px, e testei que ficam atualizados após comprar
na Loja, resgatar conquista, assistir anúncio e derrotar o chefe de
evento (esses três últimos pontos de mutação de Cash/Moeda de Evento não
estavam chamando `renderTopBar()` antes — corrigido). Pra Cartas, forcei
`Math.random` pra sempre acertar as chances de drop e confirmei, via uma
morte real (não só mexendo em `state` direto), que a carta cai em
`state.cards` e **não** em `state.materials`; testei o mesmo desvio em
`systems/offline.js` (progresso offline também não devia misturar carta
com material); e verifiquei visualmente a sub-aba Cartas vazia (mensagem
de "nenhuma carta ainda") e com cartas (ícone, nome, descrição,
quantidade). Save antigo sem o campo `cards` migra pra `{}` sem erro —
confirmado semeando o `localStorage` antes da página carregar, não
depois (um reload comum dispara `beforeunload`, que re-salva o estado em
memória por cima do que acabei de injetar — achei isso da forma difícil
numa tentativa de teste que "falhou" por esse motivo, não por bug real).

Também testei a nova UI da aba Equipamento especificamente: abrir o popup
a partir de um slot no personagem e a partir de um ícone do inventário,
aprimorar 5 vezes seguidas com o popup ficando aberto e atualizando os
números a cada clique, o painel de Rank Master aparecendo com as duas
exigências (material + Gema) corretas, desequipar (slot volta a ficar
apagado) e reequipar a partir do inventário — tudo bateu com o estado
esperado e sem erros no console.

Testei também a arte real do Chispim: craftei e equipei as 6 peças e
conferi via screenshot que o sprite do monstro, os 6 cards da Forja, os
6 ícones do anel de Equipamento, os tiles do inventário e o popup de
detalhe do item mostram a imagem certa (não o emoji antigo) — sem 404 e
sem erro no console. Famílias sem arte (Lobo, Aranha, Golem, Wyvern,
Dragão) continuam mostrando emoji normalmente, confirmando que o
fallback funciona.

Testei o boneco com arte real equipando peça por peça (pernas → botas →
peitoral → elmo → luvas → arma) e conferindo screenshot a cada uma, pra
calibrar os pontos de ancoragem (`GEAR_OVERLAY_ANCHORS`) até cada peça
cair no lugar certo do corpo — inclusive um caso em que as botas
pareciam sumir mas na verdade estavam lá, só pequenas e coladas na
barra da calça (confirmado lendo `getBoundingClientRect()` da imagem
antes de mexer em qualquer posição). Testei também o caso misto: elmo +
peitoral do Chispim (arte real) junto com uma calça de outra família
(bloco colorido) equipados ao mesmo tempo — as duas camadas convivem
sem conflito, sem erro no console.
