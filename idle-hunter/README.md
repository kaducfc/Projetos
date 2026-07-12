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
2. **Estágios**: **todo estágio múltiplo de 10 é um chefe** — igual ao
   Clicker Heroes — só que agora cada um dos 10 chefes (estágio 10 a 100)
   é uma entidade própria e única (Chispim, Solkaiser, Tartarok...
   Bahamorth), não mais "o chefe da família reaproveitado". Todo estágio
   que **não** é múltiplo de 10 mostra um **monstro fraco aleatório**,
   sorteado de um grupo de 5 (um por elemento) específico daquela faixa
   de estágios (ver "O roster definitivo" mais abaixo). Dá pra navegar
   (◀ ▶) para qualquer estágio já alcançado e farmar ali — é assim que
   você junta o material de um chefe ou monstro fraco específico.
3. **Chefes têm prazo**: ao alcançar um chefe pela primeira vez (estágio
   ainda não superado), você tem **30 segundos** para derrotá-lo. Se o
   tempo acabar, você recua um estágio (o recorde de estágio máximo não
   é perdido, só sua posição atual). Chefes que você já derrotou antes
   não têm mais prazo — pode farmar neles à vontade.
4. **Equipamentos**: 6 slots — Elmo, Peitoral, Calça, Luvas, Botas
   (defesa) e Arma (ataque), um set de 6 peças por chefe (10 sets no
   total). A aba **Equipamento** tem 3 sub-abas: **Equipar** (o
   personagem no centro com os 6 slots ao redor — só o ícone do item, ou
   apagado se vazio — e o inventário completo embaixo, também só ícones),
   **Forjar** (craft de cada peça com ouro + 4 materiais em média — os 2
   do chefe daquele set mais os do monstro fraco Neutro e do monstro
   fraco do mesmo elemento do chefe, ver "Craft e Forja" mais abaixo —
   equipada automaticamente ao craftar, e só liberada depois de alcançar
   o estágio daquele chefe) e **Materiais** (quanto você tem de cada
   material). As três eram abas separadas antes; viraram sub-abas porque
   são todas sobre a mesma coisa — seu equipamento — e assim sobra espaço
   na navegação principal. Clique em qualquer ícone na sub-aba Equipar,
   equipado ou não, pra abrir um popup com nome, stats, aprimoramento e o
   botão de Equipar/Desequipar. Cada peça craftada já reserva um **slot
   de carta** (estilo Ragnarok Online), mas ele nasce **bloqueado** —
   monstros têm uma chance bem pequena (0,01%, fixa) de dropar a própria
   carta ao morrer, coletável na sub-aba **Cartas** (dentro de
   Equipamento) e encaixável direto nesse mesmo popup, dando um bônus de
   dano real contra o elemento da carta, uma vez que o slot esteja
   destravado. Ver "O sistema de Cartas" mais abaixo.
   Além do stat principal de cada peça, as 5 peças de defesa também dão
   **Vida** (Elmo, Calça, Botas) ou **Armadura** (Peitoral, Luvas) — é
   assim que o equipamento te deixa sobreviver a estágios mais altos, não
   só bater mais forte.
5. **Aprimoramento (+1 a +5 e Rank Master)**: cada peça craftada pode ser
   aprimorada individualmente na aba Equipamento. +1 a +5 gastam o
   material do monstro fraco **Neutro** daquela receita (fica mais caro a
   cada nível — "pouco a pouco"); depois de +5, dá pra evoluir pra **Rank
   Master** consumindo **mais desse mesmo material** (continuando a mesma
   progressão, como um "+6") **e 1 Cristal do chefe** daquele set. Só o
   chefe (não os monstros fracos) tem **0,1% de chance fixa** de dropar o
   Cristal dele a cada morte — e esse mesmo Cristal também é o custo para
   destravar o slot de carta (ver "O sistema de Cartas"), então ele é
   disputado entre duas coisas. Rank Master deixa o item um pouco mais
   forte que a versão +0 do próximo chefe na cadeia — ver a conta em
   "Como o aprimoramento é calculado" abaixo.
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
   diferente vira "chefe de evento" por 5 minutos. O primeiro clique nele
   arma um cronômetro de **50 segundos fixos** pra terminar, sempre, não
   importa a família (se o tempo acabar, dá pra tentar de novo, contanto
   que a janela de 5 minutos ainda esteja aberta) — e a partir desse
   primeiro clique, tanto cliques adicionais quanto o **DPS passivo**
   continuam batendo nele a cada tick do jogo, exatamente como no combate
   normal (só não causa dano de volta em você). O HP dele é o HP do
   **chefe de verdade** daquela família
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

O combate em si tem duas diferenças deliberadas do resto do jogo. A
primeira: ele **não causa dano de volta no jogador** (sem risco de
vida) — é uma atividade de bônus, não mais uma ameaça a sobreviver. A
segunda: o prazo por tentativa (`EVENT_TIME_LIMIT_MS`, `js/data/events.js`)
é **fixo em 50 segundos**, sempre, não importa a família ou o estágio do
jogador — só começa a contar no primeiro clique (`onClickEventBoss()` em
`main.js`), e é aí que a luta "engata": a partir desse momento, tanto
clique quanto DPS passivo continuam batendo nele — DPS via
`tickEventBoss()`, chamada em todo tick do jogo (`tick()` em `main.js`),
não só quando a aba Eventos está aberta. Isso já foi diferente
(chefe de evento só tomava dano de clique) até um pedido explícito de
usar DPS também; a mudança revelou um bug real de ordem de execução:
`tickEventBoss()` tinha que rodar **antes** do bloco de combate do
estágio normal em `tick()`, porque esse bloco dá um `return` antecipado
sempre que o DPS mata o monstro da vez — e com DPS alto, isso acontece
em praticamente todo tick, faminando o chefe de evento de qualquer dano
de DPS. Um teste isolado (medir a queda de HP do chefe de evento ao
longo de 1.5s reais sem clicar de novo) pegou esse bug antes de ele ir
pro commit.

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

## O roster definitivo: 10 chefes + 25 monstros fracos

Substitui a lista placeholder de 5 monstros fracos por um roster completo
e definitivo (por enquanto — pode crescer, mas a estrutura já é a real):
**10 chefes únicos** (`BOSSES` em `js/data/monsters.js`), um por estágio
múltiplo de 10 (10 a 100), cada um com nome, elemento e drops próprios —
não é mais "o chefe da família reaproveitado", cada chefe é uma entidade
única. E **25 monstros fracos** (`WEAK_MONSTER_GROUPS`, 5 grupos de 5,
um por elemento) que preenchem os estágios não-chefe, cada grupo válido
numa faixa de estágios (1–19, 21–39, 41–59, 61–79, 81–100 — faixas dadas
assim mesmo, não uma fórmula; a última é mais larga que as outras de
propósito, é a faixa "até o último chefe definido"). Além do estágio 100
(ainda sem conteúdo definido), tanto o chefe quanto o grupo de monstros
fracos ficam travados no último definido (Bahamorth / grupo 81–100),
mesmo padrão que a família antiga usava pra nunca travar o progresso.

**Cada monstro fraco** dropa exatamente **1 material próprio**. **Cada
chefe** dropa **2 materiais próprios** ("Drop Principal 1/2", cada um
rolado independentemente) **+** um **Cristal** exclusivo daquele chefe
(ex.: Cristal de Chispim) **+** chance de carta — nenhum dos dois
(Cristal e carta) é afetado por bônus de Drop, ver "Taxas de drop fixas"
logo abaixo. Todo mundo (chefe e monstro fraco) tem sua própria carta
(`js/data/cards.js`) — o efeito de cada carta ainda não foi definido
(pedido explícito: isso vem depois), então por enquanto toda carta
aplica o mesmo bônus genérico de +3% de dano elemental que o sistema já
tinha (ver "O sistema de Cartas" abaixo) — é um placeholder, não a
intenção final.

Qual monstro fraco aparece é sorteado (`pickRandomWeakMonster(stage)`)
toda vez que um monstro novo nasce no estágio (`ensureMonsterSpawned()`
em `js/systems/combat.js`) — e fica **fixo** (persistido em
`state.weakMonsterId`) enquanto aquele HP específico não morre, senão o
sprite trocaria de bicho no meio da luta a cada re-render. Ao matar (ou
trocar de estágio), sorteia de novo, dentro do grupo daquela faixa.
Chefes (estágio múltiplo de 10) ignoram esse sorteio completamente —
`weakMonsterId` fica `null` e o chefe daquele estágio aparece com sua
própria tabela de drop (2 materiais + Cristal + carta).

### Taxas de drop fixas (Cristal e carta não sobem com bônus de Drop)

`CRYSTAL_DROP_CHANCE` (0,1%, só chefe) e `MONSTER_CARD_DROP_CHANCE`
(0,01%, chefe e monstro fraco) em `js/systems/combat.js` são deixados de
fora do `dropMult` de propósito — `dropMult * chance` nunca é aplicado a
essas duas, só aos materiais "normais" (o material único do monstro
fraco, e cada um dos 2 materiais do chefe). Testei isso diretamente: 50
mil rolagens com `dropMult=1` e `dropMult=10` deram taxa de material
~3.5x maior (0.35 → 0.95, capado) mas taxa de Cristal e de carta
praticamente idênticas nos dois casos (~0.1%/~0.01% em ambos) — nenhum
upgrade de Drop ou item consegue tornar Cristal/carta mais fáceis.

Também tratei o caso de save antigo com uma carta já encaixada num item
(`entry.cardId` apontando pra uma carta que não existe mais, tipo
`boar_card`): sem tratamento isso travaria o slot pra sempre (não dá
pra reencaixar com o slot "ocupado" por uma referência morta) — agora
`loadState()` limpa esse `cardId` órfão automaticamente ao carregar o
save (uma vez só, sem custo pro jogador). Testei semeando um save assim
e confirmando que o slot volta a ficar utilizável.

## Craft e Forja: refeitos do zero em torno dos 10 chefes

`data/items.js` foi reconstruído inteiro: as receitas agora são geradas a
partir de `BOSSES` (uma peça de 6 slots por chefe, 60 itens no total),
não mais de `MONSTER_FAMILIES`. Cada receita pede **em média 4
materiais** (+ ouro): os **2 materiais do próprio chefe** (Drop Principal
1/2) **+ 2 materiais de monstro fraco** — sempre o **monstro Neutro** e o
monstro **do mesmo elemento do chefe**, ambos vindos do grupo de
monstros fracos que antecede aquele chefe
(`getWeakMonsterGroupForStage(boss.stage - 1)`). Exemplo real (Chispim,
estágio 10, Elétrico): `chispim_heart` + `chispim_whisker` (os 2 do
chefe) + `espinhoco_thorn` (Espinhoco, o monstro Neutro do grupo 1–19) +
`aracneon_silk` (Aracneon, o monstro Elétrico do mesmo grupo) — 4
materiais distintos, exatamente como pedido. Para os 2 chefes cujo
próprio elemento é Neutro (Grommuk, Bahamorth), "o monstro do mesmo
elemento" e "o monstro Neutro" são o mesmo monstro — a receita colapsa
naturalmente para **3 materiais distintos** (confirmado: o peso do
material Neutro simplesmente dobra, em vez de duas entradas separadas).
Os materiais do chefe usam uma quantidade menor (esse chefe só é uma
fase em cada 10 estágios); os dos monstros fracos usam uma quantidade
maior (droppáveis em 9 estágios a cada 10) — mesma proporção
comum/raro que a Forja antiga já usava, só que agora com 4 fontes em
vez de 2.

**Aprimoramento (+1 a +5)** continua consumindo um material "de grão
fino" — agora é o material do monstro fraco Neutro da receita (o mais
farmável dos 4). **Rank Master** não usa mais Gema — agora exige **1
Cristal do chefe daquele equipamento** (ex.: Cristal de Chispim para
qualquer peça do set do Chispim), reaproveitando o mesmo campo que a
Gema ocupava antes (`crystalMaterialId`, renomeado de `gemMaterialId`
para refletir o que ele guarda agora).

**Estágio de liberação**: cada receita carrega `unlockStage` = o estágio
do chefe dela. A aba Forjar só mostra a grade de receitas de um chefe
se `state.maxStage >= unlockStage`; senão mostra "🔒 Alcance o estágio X
para desbloquear" — a mesma mecânica de antes, só que agora o gate é por
chefe individual (10 grupos) em vez de por família (6 grupos, 20
estágios cada). `canCraft()` também checa isso no lado do sistema (não
só na UI), então mesmo um clique "impossível" num botão que não devia
existir não craftaria nada.

**Equipamento antigo não sumiu**: os 36 itens da geração anterior (6
famílias × 6 slots) continuam existindo em `LEGACY_ITEMS` — só não são
mais oferecidos na Forja (`unlockStage: null`, o que também bloqueia
`canCraft()` incondicionalmente para eles). Isso existe só para saves
antigos: um jogador que já tinha craftado/equipado uma peça da Chispim
(família antiga) continua com ela funcionando normalmente (`getItem()`
procura em `ITEMS` — o roster novo — e cai para `LEGACY_ITEMS` se não
achar), só não dá pra craftar uma nova.

### O slot de carta agora custa Cristal, não ouro

Redefinido por pedido direto: a tentativa de destravar o slot de carta
(`attemptCardSlotUnlock()` em `systems/crafting.js`) não gasta mais 10%
do ouro atual — agora custa **1 Cristal do chefe daquele equipamento**
(o mesmo `crystalMaterialId` usado no Rank Master). A chance continua
**80%** de sucesso (`CARD_SLOT_UNLOCK_CHANCE`, inalterada) — **20%** de
falha, e o Cristal é consumido **de qualquer forma**, sucesso ou
fracasso, podendo tentar de novo (com outro Cristal) até dar certo —
mesmo espírito do sistema antigo, só trocando qual recurso é gasto.
Isso deixa o Cristal disputado entre duas coisas (Rank Master e
destravar carta), então cada um que você conseguir (0,1% de chance por
chefe morto) é uma escolha real de pra onde ele vai.

## O sistema de Cartas

Cada monstro do roster (chefe ou fraco) tem uma carta (`js/data/cards.js`,
`CARDS` — 35 no total, uma por chefe + uma por monstro fraco), com 0,01%
de chance de dropar de qualquer um deles (`MONSTER_CARD_DROP_CHANCE` em
`js/systems/combat.js` — taxa fixa, não sobe com bônus de Drop, ver
acima). É uma rolagem separada das de material/Cristal — mesma mecânica,
`drops.push()` com uma flag `isCard: true` a mais, que `applyDamage()`
usa pra decidir se o drop vai para `state.materials` ou para o novo
`state.cards` (as duas coleções usam o mesmo formato `id -> contagem`,
então uma carta é "empilhável" como um material, não um item único com
uid como equipamento). O mesmo desvio por `isCard` foi replicado em
`systems/offline.js`, senão uma carta ganha enquanto a aba estava
fechada acabaria parando em `state.materials` por engano.

**Coleta**: sub-aba **Cartas** em Equipamento, mostrando ícone, nome,
descrição e quantidade de cada carta já dropada.

**Slot de carta (reconstruído do zero)**: todo item craftado nasce com o
slot de carta **bloqueado** (`entry.cardSlotUnlocked: false`), não vazio.
Destravar é uma tentativa arriscada e paga, não uma formalidade:

1. No popup de detalhe, um item com slot bloqueado mostra "🔒 Slot de
   Carta bloqueado" e um botão **"Tentar Desbloquear"** com a chance e o
   custo atuais visíveis antes de clicar.
2. Cada tentativa (`attemptCardSlotUnlock()` em `js/systems/crafting.js`)
   tem **80%** de chance de sucesso (`CARD_SLOT_UNLOCK_CHANCE`) e custa
   **1 Cristal do chefe daquele equipamento** (`item.crystalMaterialId`
   — ver "O slot de carta agora custa Cristal, não ouro" acima; era 10%
   do ouro atual, trocado por pedido direto) — o Cristal é **sempre
   consumido**, sucesso ou fracasso.
3. Sucesso vira `entry.cardSlotUnlocked = true` e o slot passa a mostrar
   "Slot de Carta: vazio" com um botão **"Equipar Carta"**, que abre um
   seletor com toda carta que você possui (mesma UI de antes). Clicar
   numa consome 1 cópia de `state.cards` e preenche `entry.cardId`
   (`socketCard()`/`canSocketCard()`).
4. Uma vez desbloqueado, o slot **fica desbloqueado pra sempre** —
   `unsocketCard()` (botão "Remover") só esvazia `entry.cardId` e devolve
   a cópia pra `state.cards`, sem re-bloquear o slot. Trocar de carta
   continua barato e reversível; só a primeira liberação do slot é a
   etapa arriscada.

Saves de antes desse sistema (item já com `cardId` setado mas sem o campo
`cardSlotUnlocked`) são tratados como já desbloqueados — ninguém perde
uma carta já encaixada por causa da migração — mas um item antigo sem
carta nenhuma nasce bloqueado como qualquer item novo (`isSlotUnlocked()`
em `crafting.js`: `cardSlotUnlocked || !!cardId`).

**Efeito**: cada carta dá **+3%** de dano contra monstros do elemento
dela (`CARD_DAMAGE_BONUS` em `js/systems/stats.js`) — Neutro nunca entra
nessa conta, mesma regra do sistema elemental principal. O bônus é
somado direto no cálculo de dano por golpe (`getCardDamageBonus()`,
chamada ao lado de `elementDamageModifier()` nos quatro lugares onde
dano é calculado em `main.js`: clique e DPS no combate normal, clique e
DPS no chefe de evento), e não em `computePlayerStats()`, pela mesma
razão que a resistência elemental de equipamento também fica de fora
dali: o bônus depende de qual monstro você está enfrentando, não é um
número fixo do seu personagem.

### Bug corrigido: toasts empilhados bloqueavam cliques no popup (causa raiz de "não consigo remover a carta")

Um primeiro reparo (mantido, ver abaixo) tratou uma causa real mas
secundária: clicar em "Remover" troca aquele botão pelo seletor
"Encaixar carta" na mesma posição de tela, então um segundo clique
rápido demais no mesmo lugar acaba **re-encaixando** a carta em vez de
deixá-la removida. Corrigido com `runModalAction()` em `main.js` — um
lock de 300ms em volta de toda ação que muta o `state` a partir do
popup (equipar, desequipar, aprimorar, evoluir pra Rank Master,
encaixar/remover carta); um clique dentro da janela de lock é
simplesmente ignorado. Confirmado que isso não atrapalha o uso legítimo
(5 cliques em "Aprimorar" a ~350ms de intervalo continuam todos
funcionando).

Só que o relato de bug continuou depois desse reparo — sinal de que a
causa principal era outra. Reexaminando com mais cuidado (inclusive
injetando os mesmos elementos `.toast` que `showToast()` cria, pra
inspecionar `document.elementFromPoint()` no exato pixel do botão
"Remover"): `#toast-container` tem `z-index: 60`, **mais alto** que o
`#modal-overlay` (`z-index: 50`), e nenhum dos dois tinha
`pointer-events: none`. Toasts de kill disparam a cada monstro
derrotado — com DPS/dano de clique decentes, combate ativo consegue
empilhar bastante toast por segundo (o container cresce pra cima, já
que é ancorado por `bottom`, e cada toast leva ~3s pra sumir). Com uma
pilha de ~10 toasts (realista durante combate rápido com o popup
aberto), o texto deles não é curto (`💀 Derrotado! +5 💰 +2 🦴 +1 🔷`
por exemplo), e a pilha inteira acabava cobrindo fisicamente os botões
do popup — incluindo "Remover". Como toasts capturavam clique (sem
`pointer-events: none`) e ficavam **acima** do popup na pilha de
z-index, um clique mirado em "Remover" na verdade acertava o `<div
class="toast">` por cima — o clique nunca chegava no listener
delegado do modal, `state` ficava intocado, e a carta continuava
equipada exatamente como estava. Reproduzi isso de propósito: populei o
container com 10 toasts de texto realista, confirmei via
`elementFromPoint()` que o ponto do botão resolvia pro `<div
class="toast">` em vez do `<button>`, e que clicar ali de fato não
mudava nada no `state` — batendo com "o slot não fica vazio" relatado.
(A "duplicação" ocasional provavelmente vinha da combinação dos dois
bugs: um clique engolido por um toast não muda nada, mas se a pilha de
toasts encolher a tempo do próximo clique acertar o layout já trocado
pro seletor "Encaixar carta" — o mesmo problema do primeiro reparo — aí
sim uma carta extra é consumida sem a pessoa perceber a sequência
completa.)

Correção: `pointer-events: none` no `#toast-container` inteiro (não só
`.toast`, pra cobrir também o instante de entrada/saída da animação).
Toasts são só informativos — ninguém devia "clicar" neles mesmo — então
não tem por que capturarem clique nunca, com ou sem pilha. Reproduzi o
mesmo teste (10 toasts cobrindo o botão) depois do fix: `elementFromPoint()`
agora resolve pro `<button>` de verdade através da pilha de toasts, e o
clique funciona normalmente.

### Blindagem extra do popup (e a etiqueta de build no topo)

O relato de "remover não funciona" persistiu mesmo depois dos dois
reparos acima — e uma bateria de reprodução em condições realistas
(save antigo com itens de versões anteriores sem os campos
`cardId`/`enhanceLevel`, toque de celular em vez de mouse, combate ativo
com DPS matando monstros e empilhando toasts durante a interação, tanto
no código-fonte quanto no bundle publicado) passou inteira. Isso deixa
duas explicações prováveis: (a) o navegador do jogador está servindo um
**bundle antigo em cache** (o Artifact mantém a mesma URL entre
publicações, então "o bug continua" pode significar "a correção nunca
chegou"), ou (b) algo lança exceção só no ambiente dele. Três mudanças
atacam os dois lados:

1. **`runModalAction` agora usa `try/finally`**: antes, se qualquer coisa
   dentro de uma ação do popup lançasse exceção, o lock de 300ms ficava
   travado **pra sempre** — todo botão do popup silenciosamente morto até
   recarregar a página, que é exatamente a assinatura de "remover nunca
   funciona". Verificado com um teste de sabotagem (forçar `showToast` a
   lançar uma vez): antes do fix, o popup inteiro morria; depois, o lock
   se solta sozinho 300ms depois e o clique seguinte funciona.
2. **A re-renderização do popup vem primeiro** na sequência de cada ação
   (mutação → re-render do popup → toast → `fullRefresh()`): o popup é o
   feedback que o jogador está olhando, então ele atualiza mesmo que
   qualquer outra parte do refresh geral falhe. Isso também elimina o
   cenário "carta voltou pra coleção mas o slot ainda mostra ela" — a
   causa exata da sensação de 'duplicou e não removeu'.
3. **Etiqueta de build visível** (`js/version.js`, `GAME_BUILD`, exibida
   no canto direito da barra superior): agora dá pra confirmar de relance
   qual build está rodando. Se um bug "continua" mas a etiqueta na tela
   não é a do build mais novo, é cache do navegador — recarregue com
   force-refresh — e não regressão de código. Lembrar de **bumpar o valor
   a cada publicação**.

### O mecanismo de encaixe foi reconstruído do zero (relato persistiu mesmo após os 3 reparos acima)

Mesmo depois dos reparos documentados acima (lock com `try/finally`,
`pointer-events: none` nos toasts, popup atualizado antes do refresh
geral) — todos reais, verificados e mantidos —, o relato de "remover não
funciona / carta duplica" continuou chegando. Sem conseguir reproduzir
mais nenhuma falha nova em testes de alta fidelidade (save antigo, toque
de celular, DPS ativo empilhando toast, código-fonte e bundle), a decisão
foi não seguir caçando uma causa possivelmente ligada só ao ambiente do
jogador (cache de navegador é o principal suspeito) e em vez disso
**redesenhar a mecânica** por pedido direto: em vez de "encaixar/remover"
ser a única interação com o slot, o slot em si agora nasce bloqueado e
precisa de uma etapa de desbloqueio paga e arriscada antes que qualquer
encaixe seja possível — ver "O sistema de Cartas" acima para a mecânica
nova completa. Os três reparos de clique (lock de 300ms, toasts sem
`pointer-events`, popup atualizado primeiro) continuam em vigor e valem
igualmente para os novos botões "Tentar Desbloquear" e "Equipar Carta",
que passam pelo mesmo `runModalAction()`.

## Estrutura

```
index.html            Layout da página (elementos fixos; conteúdo dinâmico via JS)
css/style.css          Tema visual (dark fantasy)
assets/chispim/        Arte real do Chispim (PNGs recortados) + sheet de referência original
js/
  main.js               Bootstrap: game loop, wiring de eventos, save/load
  state.js              Estado do jogo + persistência (localStorage)
  format.js              Formatação de números grandes (1.2K, 3.4M, ...)
  version.js             Etiqueta de build exibida na barra superior (bumpar a cada publicação)
  data/
    monsters.js           BOSSES (10, um por estágio múltiplo de 10) e WEAK_MONSTER_GROUPS (25 monstros fracos, 5 grupos) — o roster que de fato spawna. MONSTER_FAMILIES continua só pra craft/evento (ver "Decisão de escopo" no README)
    items.js               Geração dos 60 itens equipáveis (10 chefes × 6 slots) + LEGACY_ITEMS (os 36 antigos, só para saves velhos — não mais craftáveis)
    elements.js             Ciclo de elementos e cálculo de vantagem/desvantagem
    upgrades.js             Upgrades comuns (ouro) e de prestígio (Runas)
    events.js                Janela do chefe de evento (rotação por relógio de parede)
    achievements.js           Lista de conquistas e sua recompensa em Cash
    shop.js                    Itens compráveis com Cash e com Moeda de Evento
    cards.js                    Uma carta por chefe/monstro fraco (35 no total) — coleta + bônus elemental genérico (efeitos próprios ainda não definidos)
  systems/
    stats.js                Agrega equipamento + upgrades → dano/DPS/bônus/resistência elemental finais
    combat.js                HP/recompensa/dano do monstro por estágio, drops, kill/spawn
    equipment.js              Equipar/desequipar, resolver o que está em cada slot
    crafting.js                Checagem de custo (+ liberação por estágio), craft, aprimoramento (+1..+5, Rank Master via Cristal) e o slot de carta (desbloqueio via Cristal + encaixe/remoção)
    upgrades.js                 Compra de upgrades comuns e de prestígio
    prestige.js                  Cálculo de Runas e lógica de renascimento
    offline.js                    Progresso estimado enquanto a aba estava fechada
    events.js                     Dano/HP/recompensa do chefe de evento (rotaciona pelos 10 BOSSES agora)
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
- `js/data/monsters.js`: `BOSS_INTERVAL` (frequência de chefes), `BOSSES`/`WEAK_MONSTER_GROUPS` (o roster em si — nomes, elementos, materiais).
- `js/main.js`: `BOSS_TIME_LIMIT_MS` (prazo do chefe).
- `js/data/items.js`: `ENHANCE_PER_LEVEL_MULT`, `MASTER_MARGIN` (curva de aprimoramento).
- `js/systems/combat.js`: `CRYSTAL_DROP_CHANCE` (chance de Cristal do chefe, 0,1% fixo — não sobe com bônus de Drop).
- `js/systems/stats.js`: `BASE_MAX_HP`, `BASE_ARMOR` (vida/armadura antes de qualquer equipamento).
- `js/systems/combat.js`: `PLAYER_DPS_TAKEN_GROWTH`/`_BASE`, `BOSS_DPS_TAKEN_MULT`, `ARMOR_CONSTANT`.
- `js/data/elements.js`: `ELEMENT_DAMAGE_BONUS` (±25%), `ELEMENT_RESISTANCE_PER_PIECE` (5%).
- `js/data/events.js`: `EVENT_CYCLE_MS`/`EVENT_ACTIVE_MS` (frequência/duração da janela), `EVENT_TIME_LIMIT_MS` (prazo fixo por tentativa, 50s), `EVENT_DIFFICULTY_MULT` (quanto mais forte que o chefe original, 1.3 = 30%), `EVENT_CURRENCY_BASE`/`_PER_STAGE` (recompensa).
- `js/data/shop.js`: preços em `CASH_SHOP_ITEMS`/`eventShopItemsForBoss()`, `AD_WATCH_COOLDOWN_MS`/`_CASH_REWARD`.
- `js/data/items.js`: `bossQty`/`weakQty` dentro de `buildBossItem()` (quantidade de cada um dos 4 materiais na receita, por slot/tier).
- `js/data/achievements.js`: `cashReward` de cada conquista.
- `js/systems/combat.js`: `MONSTER_CARD_DROP_CHANCE` (chance de carta, 0,01% fixo — não sobe com bônus de Drop; era `CARD_DROP_CHANCE` 2% originalmente, achado fácil demais).
- `js/systems/stats.js`: `CARD_DAMAGE_BONUS` (bônus de dano por carta encaixada, 3% por padrão).
- `js/systems/crafting.js`: `CARD_SLOT_UNLOCK_CHANCE` (chance de destravar o slot, 80% por padrão) — custo é fixo em 1 Cristal do chefe do equipamento, não é mais um número ajustável.

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

Testei o DPS no chefe de evento medindo a queda de HP dele ao longo de
1.5s reais **sem clicar de novo** depois do clique inicial — bateu
exatamente com `dps × 1.5s` (achei e corrigi o bug de ordem de execução
descrito em "Decisão de design: o chefe de evento é 100% baseado em
relógio de parede" através desse mesmo teste, antes dele bater certo).
Testei também que combate normal (avanço de estágio, ouro, kills) e
DPS no chefe de evento continuam funcionando ao mesmo tempo, sem um
atrapalhar o outro.

Testei o encaixe de carta: craftei um item, dei uma carta da mesma
família via `state.cards`, abri o popup de detalhe e encaixei pela UI —
confirmei que `entry.cardId` foi setado e a contagem em `state.cards`
caiu em 1; removi de volta e confirmei que a contagem voltou. Medi dano
de clique contra o Chispim (elétrico) antes e depois de encaixar a carta
de Chispim (elétrico) no elmo equipado: a razão exata entre os dois foi
1.0300 — confirmando os +3% do bônus da carta aplicados de verdade no
cálculo de dano, não só cosmético na UI.

Depois de um relato de bug (remover carta não funcionava direito, às
vezes "duplicando" uma carta), reproduzi clicando nas coordenadas exatas
de tela do botão "Remover" e depois nas mesmas coordenadas de novo —
confirmando a causa (a re-renderização coloca o seletor "Encaixar carta"
no lugar exato de onde "Remover" estava, então um clique rápido demais
em seguida acerta o seletor em vez do botão que sumiu) antes de escrever
qualquer correção. Depois do fix (`runModalAction()`, um lock de 300ms
em torno de toda ação mutante do popup), reproduzi o mesmo teste e
confirmei que a carta fica removida de verdade (`cardId: null`, cópia
devolvida) mesmo com um clique de acompanhamento quase instantâneo (50ms
depois). Testei também que isso não atrapalha o uso legítimo: cliquei
"Aprimorar" 5 vezes seguidas com ~350ms entre cliques (ritmo rápido mas
realista) e as 5 aplicaram normalmente. Rodei a suíte completa de novo
(todas as abas, todas as sub-abas de Equipamento, craft, combate) depois
da correção — sem erros no console.

Como o relato de bug continuou mesmo depois desse fix, investiguei mais
fundo e achei a causa raiz de verdade (pilha de toasts com z-index maior
que o popup, capturando clique — ver "Bug corrigido: toasts empilhados"
acima). Reproduzi de forma isolada: injetei 10 elementos `.toast` com o
texto realista que `handleKillEvent` de fato gera, depois usei
`document.elementFromPoint()` no centro exato do botão "Remover" pra
confirmar que o ponto resolvia pro `<div class="toast">` em vez do
`<button>` — e que um clique ali, de fato, não mudava nada no `state`
(bateu exatamente com "o slot não fica vazio"). Depois de adicionar
`pointer-events: none` no `#toast-container`, repeti o mesmo teste
(mesma pilha de 10 toasts, mesmo ponto): `elementFromPoint()` passou a
resolver pro botão de verdade, e o clique voltou a funcionar. Rodei de
novo o teste de clique duplo nas mesmas coordenadas e o de 5 cliques
rápidos em "Aprimorar" (ambos do fix anterior) pra confirmar que os dois
reparos continuam coexistindo sem conflito, e a suíte completa (todas as
abas/sub-abas, craft, muitos kills seguidos gerando bastante toast) mais
uma vez sem erro no console.

Na terceira rodada do mesmo relato, montei uma reprodução de alta
fidelidade: save antigo semeado antes da página carregar (itens no
formato da primeira versão, sem `cardId`/`enhanceLevel`/`isMaster`),
contexto de toque (tap de celular em vez de clique de mouse), e DPS
alto o bastante pra kills e toasts dispararem continuamente durante a
interação com o popup — rodada tanto contra o código-fonte quanto
contra o bundle publicado. Tudo passou, o que direcionou a suspeita
pra cache do navegador servindo bundle antigo. Ainda assim, apliquei a
blindagem descrita em "Blindagem extra do popup": o teste de sabotagem
(forçar `showToast` a lançar exceção uma vez no meio de um encaixe)
confirmou o bug latente do lock — antes do `try/finally`, o clique de
remover seguinte era silenciosamente ignorado pra sempre; depois, o
lock se solta sozinho e o remover seguinte funciona (`cardId: null`,
cópia devolvida). Re-rodei todos os testes das rodadas anteriores
(ciclos de encaixe/remoção, clique duplo nas mesmas coordenadas, pilha
de toasts sobre o botão, 5 aprimoramentos seguidos) e a suíte completa
de regressão — tudo verde, sem erros no console.

Depois da reconstrução do slot de carta (bloqueado por padrão, com etapa
de desbloqueio paga), testei cada estado da UI isoladamente via save
injetado (`page.addInitScript`, não `page.reload()` — um reload dispara
`beforeunload`, que resalva o `state` em memória por cima do save que
acabei de injetar, mascarando o teste como se tivesse "falhado"; já caí
nessa pegadinha antes e caí de novo escrevendo o teste desta rodada,
então documentando aqui de novo): item recém-craftado mostra o painel
"🔒 Slot de Carta bloqueado" com o botão "Tentar Desbloquear" (nunca o
seletor de carta diretamente). Forçando `Math.random` a sempre acertar,
confirmei que o sucesso vira `cardSlotUnlocked: true`, o painel troca
para "Equipar Carta", e o ouro cai exatamente no valor mostrado antes do
clique (10% do ouro no momento). Forçando `Math.random` a sempre errar,
confirmei que o ouro é descontado **mesmo na falha** (`attemptCardSlotUnlock`
retorna `{success: false, cost}`) e o item continua bloqueado. Com ouro
zerado, `canAttemptCardSlotUnlock` bloqueia a tentativa e o botão
aparece desabilitado. Cliquei "Equipar Carta" (abre o seletor), escolhi
uma carta e confirmei `entry.cardId` setado e a cópia consumida de
`state.cards`; cliquei "Remover" e confirmei que a carta volta pra
coleção e o slot volta para "vazio" **sem re-bloquear**
(`cardSlotUnlocked` continua `true`) — esse era o ponto central do
pedido, então testei especificamente que o painel bloqueado nunca
reaparece depois da primeira liberação. Testei as duas formas de save
antigo: item com `cardId` já setado mas sem o campo `cardSlotUnlocked`
mostra a carta direto (tratado como já desbloqueado, ninguém perde a
carta que já tinha); item sem carta e sem o campo nasce bloqueado como
qualquer item novo. (Uma nota de metodologia: numa das rodadas eu mockei
`Math.random` globalmente por várias centenas de ms com o loop de
combate real rodando por trás — isso troca a chance de drop de carta de
~2% para ~100% a cada golpe, e as contagens de `state.cards` "erradas"
que vi no primeiro teste eram ruído de drops de verdade, não bug de
socket/unsocket; confirmei isolando cada chamada com `state.monsterHp`
travado bem alto pra não haver kill nenhum durante a janela do mock.)
Todos os fluxos passaram sem erro no console.

Testei os monstros fracos: no estágio 1 (não-chefe), o monstro mostrado
não é mais o da família (confirmei que o nome não contém "Chispim");
sorteei 100 respawns reais via `ensureMonsterSpawned()` e vi os 5 ids
esperados aparecerem (bee/wildboar/slime/boulder/sheep), confirmando
aleatoriedade de verdade, não um id fixo. Matei 500 monstros fracos
simulados no estágio 1 e conferi que só o material próprio de cada um
cai (nunca o comum/raro da família, nunca carta — cartas não existem
pra eles ainda). Naveguei de verdade pro estágio 10 via `setViewedStage`
(a mesma função dos botões ◀ ▶ Máx) e confirmei `weakMonsterId` volta a
`null` e o chefe da família (Chispim Alfa) aparece exatamente como
antes, com a tabela de drop cheia. Testei a chance de carta nova
(0,01%): 20.000 rolagens de `rollDrops()` no estágio de chefe deram 0
cartas — consistente com a chance bem menor que antes (a chance antiga,
2%, teria dado ~400 em 20.000). Rodei os mesmos testes contra o bundle
publicado (não só o código-fonte) e bateu igual: monstro fraco no
estágio 1, materiais certos acumulando, chefe intacto no estágio máximo
alcançado. Sem erro no console em nenhum passo.

Depois do roster definitivo (10 chefes + 25 monstros fracos, substituindo
a lista placeholder de 5), retestei tudo de novo do zero. Confirmei os
10 `BOSSES` (estágios 10-100 exatos) e os 5 `WEAK_MONSTER_GROUPS` (25
monstros no total) na estrutura de dados; as 35 cartas (10 chefe + 25
fraco) geradas corretamente. Naveguei estágio por estágio (10 a 100,
depois 110 e 150 pra checar o fallback além do último definido) usando
`getMonsterInfo()` direto — bateu com a lista exata que foi passada
(Chispim, Solkaiser, Tartarok, Colhedor Carmesim, Grommuk, Vulkarion,
Leviargon, Tempestron, Gaiatron, Bahamorth, e Bahamorth se repetindo
depois do 100). Simulei 3.000 kills espalhados pelos 100 estágios e
conferi que os 44 materiais esperados (25 dos monstros fracos + 20 dos
chefes + parte dos 10 Cristais, que não apareceram todos por serem só
0,1% de chance numa amostra pequena — confirmado separadamente, ver
abaixo) apareceram, e que a sub-aba Materiais mostra tanto os materiais
de chefe quanto o Cristal quanto o material do monstro fraco (forcei
`state.materials` direto pra confirmar o Cristal renderiza certo com
quantidade, já que a amostra de kills não tinha garantia de dropar um).
A sub-aba Cartas também renderiza a carta de chefe forçada em
`state.cards`, com o texto de efeito placeholder.

O ponto mais importante — "bônus de Drop não pode afetar Cristal nem
carta" — validei numericamente: 50 mil rolagens de `rollDrops()` com
`dropMult=1` e depois com `dropMult=10` (um bônus de Drop enorme, de
propósito). O material "normal" (do monstro fraco, ou cada um dos 2 do
chefe) saltou de ~35% pra ~95% de chance (capado), exatamente o esperado
com um multiplicador de 10x — mas a taxa de Cristal (~0,1%) e de carta
(~0,01%) ficaram praticamente idênticas nos dois casos (variação normal
de amostragem, não um salto de 10x) — confirma que essas duas taxas
realmente ignoram `dropMult`.

Testei a migração de save antigo com carta órfã: semeei um save (via
`page.addInitScript`, não `page.reload()` — mesma pegadinha do
`beforeunload` de sempre) com um item tendo `cardId: 'boar_card'` (carta
que não existe mais no roster novo) e `cardSlotUnlocked: true`; depois
de carregar, `entry.cardId` virou `null` automaticamente e
`cardSlotUnlocked` continuou `true` — abri o popup do item e confirmou
mostrar o estado "vazio, desbloqueado" (com o botão "Equipar Carta"),
não travado nem quebrado.

Rodei os mesmos testes de identidade de chefe (todos os 10 estágios)
contra o bundle publicado, com um cuidado extra: ler `state.stage` +
nome do monstro **na mesma chamada síncrona** de `page.evaluate()`, sem
`waitForTimeout()` no meio — o loop de jogo tem seu próprio tick a cada
100ms, e forçar `state.stage` pra um estágio de chefe tardio (dano alto)
sem também dar vida/armadura correspondente pode matar o personagem e
disparar `retreat()` antes da checagem seguinte rodar, misturando o
resultado (foi exatamente isso que aconteceu na primeira tentativa desse
teste — não era bug, era corrida entre meu teste e o `tick()`). Com essa
correção, todos os 10 chefes bateram certo no bundle também. Sem erro no
console em nenhum passo.

Depois de reconstruir Craft/Forja e o chefe de evento em torno dos 10
chefes, testei a receita de cada boss diretamente: `chispim_weapon`
(Chispim, Elétrico) tem exatamente 4 materiais na receita
(`chispim_heart`, `chispim_whisker`, `espinhoco_thorn`, `aracneon_silk`)
batendo com o exemplo dado (2 do chefe + o Neutro do grupo 1–19 + o
Elétrico do mesmo grupo); `grommuk_weapon` (Grommuk, Neutro) colapsa
para 3 materiais distintos, com o material Neutro pesando o dobro — 
confirmando que "monstro Neutro" e "monstro do elemento do chefe" viram
o mesmo material quando o próprio chefe é Neutro. Craftei o item pela
UI de verdade (clique em "Craftar" na Forja) e confirmei os 4 materiais
sendo descontados corretamente e o item indo pro inventário equipado.

Testei o novo custo do slot de carta: o popup mostra "custo: 1 [emoji]
Cristal de Chispim (você tem N)" em vez de ouro; uma chamada isolada de
`attemptCardSlotUnlock()` (sem o loop de combate rodando por trás, pra
não misturar ganho de ouro orgânico com o teste) confirmou que o ouro
fica **absolutamente intocado** e exatamente 1 Cristal é consumido,
sucesso ou fracasso. (Numa tentativa anterior, testando via UI depois de
crafar e equipar uma arma de verdade, o ouro mudou um pouco durante a
janela do teste — não era o slot de carta mexendo em ouro, era a arma
recém-equipada dando DPS real e o personagem matando o monstro fraco da
tela em segundo plano, ganhando ouro organicamente; a chamada isolada
confirmou que o sistema de carta em si não toca em ouro.) Também testei
Aprimoramento (+1 a +5, consumindo `espinhoco_thorn` — o material Neutro
da receita) e Rank Master (consumindo exatamente 1 `chispim_crystal`),
ambos em sequência, chegando em Rank Master de verdade.

Testei a liberação por estágio: com `maxStage = 55`, a Forja mostra as
receitas de Chispim(10) a Grommuk(50) normalmente, e Vulkarion(60) em
diante aparecem com "🔒 Alcance o estágio X para desbloquear" — 
inclusive Bahamorth(100). Testei que um item da geração antiga
(`boar_weapon`, agora em `LEGACY_ITEMS`) continua resolvendo via
`getItem()` (não quebra saves antigos) mas tem `unlockStage: null`,
bloqueando `canCraft()` incondicionalmente — não aparece mais na Forja.

Testei o rodízio do chefe de evento: 12 ciclos consecutivos (mais que os
10 chefes) passaram pelos 10 IDs esperados sem repetir fora de ordem, e
`claimEventVictory()` chamado direto com o boss do estágio 10 só gerou
`chispim_heart`/`chispim_whisker`/`chispim_crystal` como possíveis
drops — nunca um material de outro chefe ou da lista antiga de
famílias. Rodei os mesmos testes de receita/craft/estágio contra o
bundle publicado e bateu igual, sem erro no console em nenhum passo.
