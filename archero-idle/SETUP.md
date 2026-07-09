# Setup no Unity Editor

Os scripts em `Assets/Scripts` e o gerador em `Assets/Editor` foram escritos
num ambiente sem Unity Editor instalado (só terminal), então **nunca foram
compilados ou testados**. Este guia é o caminho mais curto para colocar tudo
rodando.

## 1. Criar o projeto

1. Baixe o **Unity Hub** e instale o **Unity 6 LTS** (módulo Android Build
   Support, e iOS Build Support se for compilar para iPhone).
2. No Hub, crie um projeto novo com o template **2D (Core)**.
3. Copie as pastas `Assets/Scripts` e `Assets/Editor` deste repositório para
   dentro do `Assets/` do projeto Unity recém-criado (pelo Explorer/Finder,
   fora do Unity — ele importa sozinho quando você volta pro Editor).
4. Deixe o Unity compilar. Se aparecer erro no Console, me diga a mensagem
   exata que eu ajusto o script.

## 2. Gerar o projeto com um clique

No menu do Unity: **ArcheroIdle > Build Demo Project**.

Esse comando (código em `Assets/Editor/ArcheroIdleProjectBuilder.cs`) monta
tudo sozinho, na ordem:

1. Cria as layers `Player` e `Enemy`.
2. Força "Active Input Handling" para o Input Manager clássico (assim o
   `EventSystem` funciona sem precisar instalar o pacote Input System).
3. Gera sprites simples coloridas (círculos/quadrado) em `Assets/Sprites`
   como placeholder visual — troque depois pelas suas artes.
4. Cria os 8 upgrades em `Assets/Upgrades` (dano, velocidade de ataque,
   velocidade de movimento, vida, projétil extra, perfuração, crítico).
5. Cria os prefabs em `Assets/Prefabs`: `Player`, `MeleeEnemy`,
   `RangedEnemy`, `BossEnemy`, `PlayerProjectile`, `EnemyProjectile`,
   `SlamTelegraph`.
6. Monta a cena `Assets/Scenes/MainScene.unity`: câmera, chão, paredes da
   arena, pontos de spawn, o jogador, o Canvas com joystick virtual, o
   painel de escolha de upgrade, a barra de vida e a tela de Game Over —
   e já registra essa cena em Build Settings.

Um popup confirma quando terminar. Se der algum erro durante a execução,
me manda a mensagem do Console.

**Atenção:** o comando fecha a cena que estiver aberta sem perguntar (usa
`EditorSceneManager.NewScene`). Se acabou de criar o projeto, não há nada
para perder; se já estava mexendo em algo, salve antes de rodar.

## 3. Testar

1. Abra `Assets/Scenes/MainScene.unity` (deve abrir sozinha depois do
   comando).
2. Aperte **Play**.
3. Mova com **WASD/setas** (fallback de teclado) ou arrastando o joystick
   na tela do Game view.
4. A arma mira e atira sozinha no inimigo mais próximo.
5. Limpe a onda de inimigos da sala para ver o painel de 3 upgrades
   aparecer — escolha um e a próxima sala começa.
6. A cada 5 salas (`RoomManager > Boss Room Interval`) aparece o chefe,
   com um círculo vermelho avisando antes do golpe em área.
7. Ao morrer, aparece a tela de Game Over com o botão "Reiniciar".

## 4. Se algo der errado

- **Erro de compilação (CS####)** no Console: me manda o texto do erro
  (arquivo + linha) que eu corrijo o script.
- **Erro sobre Input System** ao entrar em Play: vá em
  `Edit > Project Settings > Player > Active Input Handling` e mude para
  `Input Manager (Old)` ou `Both`, depois reabra o projeto. (O gerador já
  tenta configurar isso sozinho, mas se a versão exata do seu Unity 6
  guardar essa opção num campo diferente, o ajuste manual resolve.)
- **Algum campo aparece "None" no Inspector**: rode o menu
  `ArcheroIdle > Build Demo Project` de novo — ele é seguro para rodar
  mais de uma vez (reaproveita o que já existe) e realinha as referências.

## 5. Trocar a arte placeholder

Os sprites gerados (`Assets/Sprites`) são só círculos/quadrados coloridos
para tudo funcionar de primeira. Para usar arte de verdade: importe seus
PNGs/sprites normalmente, arraste no `SpriteRenderer` de cada prefab
(`Assets/Prefabs`) no lugar do sprite placeholder, e ajuste o tamanho do
`CircleCollider2D` se a arte tiver proporção diferente.

## 6. Ajustando manualmente (opcional)

Todo o resultado do gerador é só GameObjects/prefabs comuns — dá pra abrir
qualquer prefab e mexer nos campos do Inspector normalmente (velocidade,
dano, cooldown, contagem de inimigos por sala, etc.), sem precisar rodar o
gerador de novo depois. Os nomes dos campos batem com os `[SerializeField]`
de cada script em `Assets/Scripts`.
