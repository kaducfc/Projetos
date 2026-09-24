# Projetos

## Rift Arcade (site de minigames)

Site com contas (e-mail e senha) que guarda progresso e histórico de
partidas de todos os jogos. O primeiro jogo é o **Carreira no Rift**:
crie um pro player de LoL aos 16 anos e leve a carreira da base ao Mundial.

- **Código-fonte e documentação:** [`site/`](site/)
- **Jogo:** [`site/jogos/carreira-no-rift/`](site/jogos/carreira-no-rift/)
- **Rodar localmente:** `cd site && python3 -m http.server 8000`

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
