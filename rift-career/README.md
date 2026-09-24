# Carreira no Rift

Simulador de carreira de um jogador profissional de **League of Legends**,
inspirado no modo carreira do Copero (futebol). Você cria o jogador aos 16
anos, assina com um time da base e toma decisões temporada a temporada até
a aposentadoria.

Feito em HTML + CSS + JavaScript puro (ES modules), sem build step e sem
dependências, igual ao `idle-hunter`.

## Rodando localmente

```bash
cd rift-career
python3 -m http.server 8000
# abra http://localhost:8000
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
tem fase suíça e chave de 8. As divisões de acesso (academias e ligas
amadoras) jogam só os dois splits. Há 5 eventos de história por temporada.

Simplificações: os playoffs são de eliminação simples (na vida real a
maioria é de eliminação dupla), e as vagas de cada região são fixas.

**Eventos:** cada escolha mostra a chance de dar certo (ex.: 70% / 30%). A
chance muda conforme o atributo ligado à escolha e a confiança do técnico. O
resultado altera atributos, confiança e fama.

**Propostas:** dependem principalmente do OVR (e um pouco da fama). Os times
estão em 3 divisões por região: tier 1 (CBLOL, LCK, LPL, LEC, LCS),
academias e ligas amadoras. Com OVR alto, chegam propostas do exterior.
Coreia e China exigem um nível mais alto.

**Aposentadoria:** pode ser anunciada a partir dos 27 anos e é obrigatória
aos 35. O relatório final mostra o legado, os clubes, os títulos e um resumo
para compartilhar.

O progresso fica salvo no `localStorage` do navegador.

## Estrutura

```
rift-career/
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
│   │   └── career.js      # fluxo da temporada, propostas, torneios, prêmios
│   └── ui/
│       ├── art.js         # SVGs (escudos, troféus, camisa, minimapa)
│       ├── create.js      # tela de criação
│       └── game.js        # tela principal
├── scripts/simulate.mjs   # simula milhares de carreiras para balanceamento
└── scripts/build-bundle.mjs  # gera um HTML único com tudo embutido
```

## Balanceamento

```bash
node scripts/simulate.mjs 1000 BR   # quantidade de carreiras, país
```

Mostra a distribuição do OVR máximo, quantos jogadores chegam ao tier 1, a
média de títulos por carreira e os legados. Use depois de mexer em números
em `engine/player.js`, `engine/sim.js` ou `engine/career.js`.

## Adicionando conteúdo

- **Eventos:** acrescente objetos em `js/data/events.js`. Cada escolha tem
  `base` (chance base), `attr` (atributo que ajusta a chance) e os resultados
  `ok`/`fail` com `fx`.
- **Times:** `TIER1` em `js/data/world.js` (id, nome, sigla, rating, cores).
  As academias são geradas a partir dos 8 primeiros times de cada região.

Os nomes de times e ligas reais aparecem só como referência de fã. Os
escudos são gerados (sigla + cores), sem logos oficiais.
