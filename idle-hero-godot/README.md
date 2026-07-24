# Idle Hero (Godot)

Jogo idle de combate para mobile: o herói enfrenta automaticamente ondas de
inimigos que avançam da direita para a esquerda numa tela quadriculada, ganha
ouro a cada derrota, e progride estágio a estágio. A cada 10 estágios aparece
um chefe mais forte no lugar do último inimigo da onda.

Feito em **Godot 4.3**, projeto novo e independente do `idle-hunter/` (jogo
web já existente neste repositório).

## Como abrir

1. Instale o [Godot 4.3+](https://godotengine.org/download) (versão "Standard",
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
      GameState.gd       # singleton: ouro, estágio, upgrades, save/load em JSON
    Hero.gd              # ataque automático do herói, vida, sinais
    Enemy.gd             # movimento até o ponto de combate, ataque, vida
    Main.gd              # spawn de inimigos, fluxo de estágio/chefe
    GridBackground.gd    # desenha a grade de fundo
    HUD.gd               # labels de estágio/ouro, barras de vida, botão de upgrade
  scenes/
    Hero.tscn / Enemy.tscn / HUD.tscn / Main.tscn
```

## Como o loop idle funciona

- `GameState` (autoload) guarda ouro, estágio atual e nível do upgrade de
  dano, e salva/carrega automaticamente em `user://savegame.json`.
- Cada estágio tem `ENEMIES_PER_STAGE = 5` inimigos. O último inimigo de um
  estágio múltiplo de `BOSS_STAGE_INTERVAL = 10` é um chefe (mais vida, mais
  dano, recompensa de ouro maior, visual maior/roxo).
- Vida e dano dos inimigos escalam exponencialmente com o estágio
  (`Main._enemy_hp_for_stage` / `_enemy_damage_for_stage`) — ajuste os
  multiplicadores ali para balancear a dificuldade.
- Herói e inimigo atacam via `Timer` próprio; ao morrer, o inimigo emite
  `died(gold_reward)` e o herói `died`. Se o herói morre, ele recupera a vida
  cheia e a luta contra o mesmo inimigo recomeça (sem punição de progresso).
- O botão de upgrade na HUD gasta ouro para aumentar o dano do herói
  (`GameState.buy_damage_upgrade`), com custo crescente.

## O que falta antes de publicar

Este é o esqueleto jogável do jogo (grid, herói, spawn de inimigos, chefes,
ouro, upgrade, save/load). Ainda são placeholders/pendências:

- **Arte**: herói e inimigos são retângulos coloridos (`Polygon2D`). Trocar
  por sprites/animações reais em `Hero.tscn` / `Enemy.tscn`.
- **Áudio**: sem efeitos sonoros ou música ainda.
- **Variedade de inimigos**: hoje só existe um "tipo" de inimigo escalado por
  estágio; dá pra variar sprite/nome por faixa de estágio.
- **Mais upgrades**: só existe upgrade de dano; vida, velocidade de ataque,
  ouro por vitória, etc. são extensões naturais do mesmo padrão em
  `GameState.gd`.
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
