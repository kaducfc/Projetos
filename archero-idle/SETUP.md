# Setup no Unity Editor

Os scripts em `Assets/Scripts` foram escritos num ambiente sem Unity Editor
instalado (só terminal), então **nunca foram compilados ou testados**. Este
guia é o caminho para colocar tudo rodando e revisar/corrigir qualquer erro
de compilação que apareça na primeira importação.

## 1. Criar o projeto

1. Abra o Unity Hub, crie um projeto novo com o template **2D (Core)**.
   Recomendado: Unity 2022 LTS (os scripts usam `Rigidbody2D.velocity`, que
   no Unity 6 foi renomeado para `linearVelocity` — no Unity 6 ele ainda
   compila, só aparece um aviso de "obsolete"; se preferir eliminar o aviso,
   troque `rb.velocity` por `rb.linearVelocity` nos 3 lugares onde aparece:
   `Projectile.cs`, `PlayerController.cs`, `EnemyController.cs`,
   `BossController.cs`).
2. Copie a pasta `Assets/Scripts` deste repositório para dentro do
   `Assets/` do projeto Unity recém-criado.
3. Deixe o Unity importar e compilar. Se aparecer algum erro no Console,
   me avise com a mensagem exata — como não pude compilar, pode haver algum
   typo que passou despercebido.

## 2. Tags e Layers

Em **Edit > Project Settings > Tags and Layers**:

- Tag `Player` (já existe por padrão) — aplique no GameObject do jogador.
- Layers novos: `Player`, `Enemy`, `PlayerProjectile`, `EnemyProjectile`.

Em **Edit > Project Settings > Physics 2D**, na matriz de colisão, desmarque:
- `Player` × `PlayerProjectile` (o próprio tiro do jogador não deve acertá-lo)
- `Enemy` × `EnemyProjectile`
- `PlayerProjectile` × `EnemyProjectile` (opcional, evita tiros se destruindo entre si)

## 3. GameObjects principais

### Player
- GameObject `Player`, Tag `Player`, Layer `Player`.
- Componentes: `Rigidbody2D` (Gravity Scale 0, Freeze Rotation Z),
  `CircleCollider2D`, `SpriteRenderer`, `Health`, `PlayerStats`,
  `PlayerController`, `AutoAimShooter`.
- Filho `FirePoint` (Transform vazio na frente do sprite) — arraste em
  `AutoAimShooter.firePoint`.
- Em `AutoAimShooter`, defina `Enemy Layer` = layer `Enemy`.

### Inimigo melee (prefab)
- `Rigidbody2D` (Gravity Scale 0, Freeze Rotation Z), `CircleCollider2D`,
  `SpriteRenderer`, Layer `Enemy`.
- Componentes: `Health`, `EnemyController` (`Is Ranged` desmarcado).
- Salve como prefab, ex: `MeleeEnemy`.

### Inimigo ranged (prefab)
- Igual ao melee, mas `Is Ranged` marcado, com filho `FirePoint` e
  `Projectile Prefab` apontando para o prefab `EnemyProjectile` (passo abaixo).
- Salve como prefab, ex: `RangedEnemy`.

### Boss (prefab)
- Igual à base do inimigo, componente `BossController` no lugar de
  `EnemyController`. Opcionalmente arraste um prefab de círculo (um
  `SpriteRenderer` circular semi-transparente vermelho) em
  `Slam Telegraph Prefab` para o aviso visual do ataque em área.
- Salve como prefab, ex: `BossEnemy`.

### Projéteis (2 prefabs)
- `PlayerProjectile`: `Rigidbody2D` (Gravity Scale 0), `CircleCollider2D`
  marcado como **Is Trigger**, `SpriteRenderer`, Layer `PlayerProjectile`,
  componente `Projectile` com `Hittable Layer` = `Enemy`.
- `EnemyProjectile`: mesma estrutura, Layer `EnemyProjectile`,
  `Hittable Layer` = `Player`.
- Arraste `PlayerProjectile` em `AutoAimShooter.projectilePrefab` (no
  Player) e em `EnemyController.projectilePrefab` do prefab `RangedEnemy`
  troque para `EnemyProjectile` (e o mesmo no Boss se quiser que ele
  atire à distância também — hoje o Boss só tem contato + slam).

## 4. Sala de combate (cena)

1. Crie uma arena simples: um plano/chão e paredes com `BoxCollider2D`
   (sem trigger) delimitando a área.
2. Crie um GameObject vazio `SpawnPoints` com vários filhos `Transform`
   distribuídos pela arena (bordas da sala funcionam bem).
3. GameObject `EnemySpawner` com o componente `EnemySpawner`: arraste os
   prefabs `MeleeEnemy`, `RangedEnemy`, `BossEnemy` e o array de
   `spawnPoints`.
4. GameObject `RoomManager` com o componente `RoomManager`: arraste o
   `EnemySpawner`, o `UpgradeManager` (passo 5), o `UpgradeSelectionUI`
   (passo 6) e o `PlayerStats` do jogador.

## 5. Upgrades (ScriptableObjects)

Em **Assets > Create > ArcheroIdle > Upgrade**, crie ~8 assets, um por tipo
de `UpgradeType`, por exemplo:

| upgradeName | type | value |
|---|---|---|
| Dano +2 | Damage | 2 |
| Velocidade de Ataque +0.3 | AttackSpeed | 0.3 |
| Velocidade de Movimento +0.5 | MoveSpeed | 0.5 |
| Vida Máxima +20 | MaxHealth | 20 |
| Projétil Extra | ProjectileCount | 1 |
| Perfuração +1 | Pierce | 1 |
| Chance de Crítico +5% | CritChance | 0.05 |
| Multiplicador de Crítico +0.25 | CritMultiplier | 0.25 |

Coloque um GameObject `UpgradeManager` na cena com o componente
`UpgradeManager` e arraste todos os assets criados na lista `All Upgrades`.

## 6. UI de upgrade (Canvas)

1. Crie um `Canvas` (Screen Space - Overlay) com um `EventSystem`.
2. Dentro, um painel `UpgradePanel` (inicialmente desativado) contendo 3
   "cards" — cada card é um GameObject com `Image` (ícone), dois `Text`
   (nome e descrição) e um `Button`, com o componente `UpgradeCardUI`
   referenciando esses elementos.
3. Um GameObject com o componente `UpgradeSelectionUI`: arraste o
   `UpgradePanel` em `Panel` e os 3 cards no array `Cards`.
4. Volte no `RoomManager` e arraste esse GameObject em `Upgrade Ui`
   (se ainda não tiver feito).

## 7. Joystick virtual (Canvas)

1. No mesmo `Canvas`, crie `JoystickBackground` (Image circular
   semi-transparente, canto inferior esquerdo) com um filho
   `JoystickHandle` (Image circular menor, centralizada).
2. Adicione o componente `VirtualJoystick` no `JoystickBackground`,
   arrastando `background` (o próprio objeto) e `handle`.
3. No `Player`, arraste esse `VirtualJoystick` em
   `PlayerController.joystick`.

## 8. Health bar e Game Over (opcional para o MVP, mas recomendado)

- Um `HealthBarUI` world-space (Canvas filho do Player, Render Mode
  "World Space") ligado ao `Health` do jogador, e outro por cima de cada
  inimigo (pode ser adicionado dinamicamente ao prefab).
- Um `GameManager` na cena com `Player Health` apontando para o `Health`
  do jogador e um `GameOverPanel` (Canvas UI, desativado por padrão) com
  um botão chamando `GameManager.RestartRun()`.

## 9. Testar

- Entre no Play Mode, arraste o joystick e confira o movimento.
- Confirme que a arma mira sozinha no inimigo mais próximo e atira.
- Limpe uma sala e veja se as 3 opções de upgrade aparecem e aplicam o
  efeito certo.
- Deixe chegar até a sala 5 (ou o valor de `Boss Room Interval`) para
  testar o boss e o ataque em área telegrafado.

Qualquer erro de compilação ou comportamento estranho na primeira rodada,
me diga o que apareceu no Console que eu ajusto o script correspondente.
