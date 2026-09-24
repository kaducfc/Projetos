# Projetos

## Carreira no Rift

Simulador de carreira de jogador profissional de League of Legends: crie o
jogador aos 16 anos, escolha propostas, tome decisões com porcentagem de
sucesso e dispute ligas, MSI e Mundial até a aposentadoria. HTML + CSS +
JavaScript puro.

- **Código-fonte e documentação:** [`rift-career/`](rift-career/)
- **Rodar localmente:** `cd rift-career && python3 -m http.server 8000`

## Idle Hunter

Jogo idle/clicker mobile-first, inspirado em **Clicker Heroes** + **Monster
Hunter**, feito em HTML + CSS + JavaScript puro (sem build step, sem
dependências externas).

- **Jogar online:** https://kaducfc.github.io/Projetos/
- **Código-fonte:** [`idle-hunter/`](idle-hunter/)
- **Documentação completa** (mecânicas, decisões de design, estrutura do
  código): [`idle-hunter/README.md`](idle-hunter/README.md)

### Rodando localmente

```bash
cd idle-hunter
python3 -m http.server 8000
# abra http://localhost:8000
```

### Publicando

- **GitHub Pages** (`gh-pages`): cópia direta de `idle-hunter/index.html`,
  `js/`, `css/` e `assets/` na raiz da branch.
- **Artifact**: `idle-hunter/build-bundle.mjs` empacota todo o JS/CSS/assets
  num único HTML autocontido (`node build-bundle.mjs > bundle.html`).
