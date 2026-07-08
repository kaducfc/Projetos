# Archero Idle (nome provisório)

Jogo mobile de ação top-down inspirado em **Archero** (movimento com joystick,
mira/tiro automático no inimigo mais próximo, salas com ondas de inimigos,
upgrades aleatórios entre salas, chefes com ataques telegrafados), com uma
segunda camada de progressão **Idle** planejada para uma fase futura.

## Status atual

Esta é a **Fase 1 (MVP): apenas o combate core**. Não há moeda, loja,
progressão offline nem gacha ainda — isso é intencional, ver roadmap abaixo.

## Stack

- Unity (C#), projeto 2D top-down.
- Sem dependências de pacotes além do que já vem no template 2D padrão do
  Unity (uGUI para a interface, Physics2D para colisões).

## Estrutura

```
Assets/Scripts/
  Core/       GameManager (fim de partida / restart)
  Combat/     Health, Projectile, AutoAimShooter
  Player/     PlayerController, PlayerStats, VirtualJoystick
  Enemies/    EnemyController (melee/ranged), BossController (ataque em área telegrafado)
  Rooms/      EnemySpawner (ondas + escala de dificuldade), RoomManager (progressão de salas)
  Upgrades/   UpgradeData (ScriptableObject), UpgradeManager
  UI/         UpgradeSelectionUI, UpgradeCardUI, HealthBarUI
```

## Como abrir

Os scripts foram escritos fora do Editor do Unity (ambiente sem GUI), então
**nunca foram compilados**. Veja `SETUP.md` para o passo a passo de como criar
o projeto Unity, importar esses scripts e montar a cena/prefabs no Editor.

## Loop de jogo (Fase 1)

1. Jogador se move com um joystick virtual em tela; a arma mira e atira
   sozinha no inimigo vivo mais próximo dentro do alcance.
2. Cada sala spawna uma onda de inimigos (contagem e stats escalam com o
   número da sala).
3. Ao limpar a sala, o jogador escolhe 1 de 3 upgrades aleatórios
   (dano, velocidade de ataque, velocidade de movimento, vida máxima,
   projéteis extras, perfuração, chance/multiplicador de crítico).
4. A cada N salas (padrão: 5) aparece um chefe com um ataque em área
   telegrafado (círculo de aviso antes do golpe) além do dano de contato.
5. Morrer encerra a run; `GameManager` expõe `RestartRun()` para reiniciar.

## Roadmap (fases futuras — ainda não implementadas)

- **Fase 2 — Idle**: moeda gerada passivamente (inclusive offline, calculada
  pelo tempo fora do jogo), tela de upgrades permanentes entre runs
  (comprados com essa moeda), multiplicadores de progressão idle.
- **Fase 3 — Equipamentos/Gacha**: itens com raridade, invocação de
  heróis/armas, árvore de evolução de equipamento.
- **Fase 4 — Meta**: eventos, dungeons especiais, ranking/PvP assíncrono.

Cada fase deve entrar como um novo marco de trabalho, não misturada no MVP
atual.
