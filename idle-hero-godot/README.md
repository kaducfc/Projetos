# Idle Hero (Godot)

Jogo idle de combate para mobile: o herói enfrenta automaticamente ondas de
inimigos que avançam da direita para a esquerda numa tela quadriculada, ganha
ouro/gemas a cada derrota, e progride estágio a estágio. A cada 10 estágios
aparece um chefe mais forte no lugar do último inimigo da onda.

A estrutura de tela (moedas duplas, barra de estágio, painel de atributos,
navegação inferior) foi inspirada no jogo **Monster Slayer** (Play Store) —
os *sistemas/layout* seguem a mesma lógica, mas toda a arte aqui é
placeholder (formas coloridas) e todo o código é original. Antes de publicar
você vai precisar de arte própria (ver seção final).

Feito em **Godot 4.7**, projeto novo e independente do `idle-hunter/` (jogo
web já existente neste repositório).

## Como abrir

1. Instale o [Godot 4.x](https://godotengine.org/download) (versão "Standard",
   não é necessário .NET/C#).
2. Abra o Godot, clique em "Importar" e selecione o arquivo
   `idle-hero-godot/project.godot`.
3. Rode com F5 — a cena inicial é `scenes/Main.tscn`.

## Estrutura do projeto

```
idle-hero-godot/
  project.godot          # config do projeto (janela 720x1280 portrait, autoload)
  scripts/
    autoload/
      GameState.gd       # singleton: ouro, gemas, estágio, 4 atributos, save/load
    Hero.gd              # ataque automático, regeneração, vida, sinais
    Enemy.gd             # movimento até o ponto de combate, ataque, vida
    Main.gd              # spawn de inimigos, fluxo de estágio/chefe, dano flutuante
    GridBackground.gd    # desenha a grade de fundo
    HUD.gd               # topo (nível/ouro/gemas), trilha de estágio, painel de stats, nav
    FloatingNumber.gd    # número de dano que sobe e desaparece
  scenes/
    Hero.tscn / Enemy.tscn / HUD.tscn / Main.tscn / FloatingNumber.tscn
```

## Como o loop idle funciona

- `GameState` (autoload) guarda **ouro**, **gemas**, estágio atual e o nível
  de 4 atributos do herói — `attack`, `hp`, `regen`, `speed` — definidos de
  forma orientada a dados em `STAT_DEFS` (base, incremento por nível, custo).
  Salva/carrega automaticamente em `user://savegame.json`.
- Cada estágio tem `ENEMIES_PER_STAGE = 5` inimigos. O último inimigo de um
  estágio múltiplo de `BOSS_STAGE_INTERVAL = 10` é um chefe (mais vida, mais
  dano, recompensa de ouro/gemas maior, visual maior/roxo). O nome do estágio
  na HUD ("Normal 1-1", "Normal 1-10"...) é derivado desse mesmo número.
- Vida e dano dos inimigos escalam exponencialmente com o estágio
  (`Main._enemy_hp_for_stage` / `_enemy_damage_for_stage`) — ajuste os
  multiplicadores ali para balancear a dificuldade.
- Herói e inimigo atacam via `Timer` próprio; cada golpe emite `damaged(amount)`,
  que o `Main.gd` usa para instanciar um `FloatingNumber` (número subindo e
  sumindo) sobre quem levou o dano. O herói também regenera vida sozinho
  (`RegenTimer`, 1/seg) e cada um mantém sua própria barra de vida flutuante
  (`HPBar`) acima do personagem.
- Ao morrer, o inimigo emite `died(gold_reward, gems_reward)`; se o herói
  morre, ele recupera a vida cheia e a luta contra o mesmo inimigo recomeça
  (sem punição de progresso).
- A cada 5 níveis comprados em qualquer atributo, o jogo concede gemas bônus
  e mostra um aviso (`GameState.milestone_reached` → `HUD.show_toast`),
  imitando o banner de "atinge o nível X" do jogo de referência.
- A barra de navegação inferior da HUD (Equipamento/Runas/Pets/Torre/Base) e
  os 2 slots de companion no topo existem só como placeholders bloqueados —
  visual pronto, sistemas ainda não implementados.

## O que falta antes de publicar

Este é o esqueleto jogável do jogo (grid, herói, spawn de inimigos, chefes,
ouro/gemas, 4 atributos upgradáveis, dano flutuante, save/load). Ainda são
placeholders/pendências:

- **Arte**: herói e inimigos são retângulos coloridos (`Polygon2D`), ícones de
  moeda/gema/slots são `ColorRect`. Trocar por sprites/animações e ícones
  reais — **não** reutilize a arte do jogo de referência, ela é protegida por
  direitos autorais; use arte própria ou licenciada.
- **Áudio**: sem efeitos sonoros ou música ainda.
- **Sistemas ainda só de fachada**: equipamento, runas, pets/companions e
  torre aparecem bloqueados na navegação inferior mas não têm lógica por
  trás — são os próximos candidatos naturais a implementar.
- **Variedade de inimigos**: hoje só existe um "tipo" de inimigo escalado por
  estágio; dá pra variar sprite/nome por faixa de estágio.
- **Export para Android / Play Store**:
  1. No Godot, instale os *export templates* (Editor → Manage Export
     Templates).
  2. Instale o Android SDK/JDK e configure em Editor → Editor Settings →
     Export → Android.
  3. Crie um preset de export Android (Project → Export), defina o
     `package name` (ex: `com.seudominio.idlehero`) e gere uma keystore de
     release (`keytool -genkey ...`) — **não** versione a keystore nem
     senhas no git.
  4. Gere o `.aab` (Android App Bundle, formato exigido pela Play Store).
  5. Crie a conta de desenvolvedor na Play Console, preencha ficha de
     conteúdo, política de privacidade e capturas de tela antes de publicar.

> Este ambiente não tem interface gráfica para rodar o editor do Godot, então
> o projeto não foi testado visualmente aqui — abra localmente para conferir
> antes de seguir com arte/balanceamento.
