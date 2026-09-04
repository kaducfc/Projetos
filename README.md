# Projetos

## Idle Hero (Godot)

Jogo idle de combate para mobile (Android/Play Store), feito em **Godot
4.3**: o herói enfrenta ondas de inimigos automaticamente numa tela
quadriculada, ganha ouro e progride estágio a estágio, com chefes a cada 10
estágios. Projeto novo, independente do Idle Hunter abaixo.

- **Código-fonte:** [`idle-hero-godot/`](idle-hero-godot/)
- **Documentação** (como abrir, arquitetura, passos pra publicar na Play
  Store): [`idle-hero-godot/README.md`](idle-hero-godot/README.md)

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
