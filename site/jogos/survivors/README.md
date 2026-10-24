# Rift Survivors (em teste, só administradores)

Sobrevivência em estilo "survivors" com tema de League of Legends e pixel art. Canvas 2D, sem bibliotecas.

- `js/data.js`: campeões, armas (5 níveis), itens, inimigos, chefes, curva de dificuldade. Puro, testado no Node.
- `js/game.js`: simulação (sem DOM). `tests/survivors.test.mjs` cobre dados, armas, nível, chefes, vitória e derrota.
- `js/sprites.js`: pixel art desenhada em código (mapas de caracteres espelhados, contorno automático) e carregamento das
  imagens da Ahri em `img/ahri/` (sprites extraídos da folha enviada: parada/andando, orbe, coração, retrato, arte).
- `js/render.js`: chão procedural em pedaços, entidades, projéteis, HUD. `js/audio.js`: sons sintetizados.
- `js/meta.js`: Essência Azul, campeões liberados e melhorias, salvos no navegador (`survivors.meta.v1`).
- `js/main.js`: telas, entrada (teclado e joystick de toque), laço e acesso restrito (`soAdmin` em `shared/config.js`).

Para lançar: apagar `soAdmin: true` da entrada `survivors` em `shared/config.js`.
Pendências conhecidas: textos em PT apenas (traduzir com `shared/i18n/src/*.mjs`), progresso só local (sem servidor),
ranking/PDR, mais campeões com sprites próprios.

## Estudo do Eclipse Eterno (referência) e o que já aproveitamos
Roguelite em pixel art (arquivo único, arte e música gerados em código, 4 idiomas, instalável como app). Estrutura que observei:
10 reinos (mapa, monstros, clima, trilha e chefe próprios; um objetivo no mapa desperta o chefe; eventos do ambiente com
ataques avisados no chão), 8 heróis liberados por missões, 8 armas e 9 passivas de 5 níveis com elementos e sinergias,
evolução de arma (nível máx. + passiva certa, em baú), cartas de nível com raridade, rolar e banir, maldições (risco por
recompensa), relíquias por chefe, mercador no meio da partida, baús em roleta, nêmesis, combos de abates, ascensão
(dificuldade extra), desafio diário, livro de descobertas, conquistas e melhorias permanentes.

Já no Rift Survivors: cartas com raridade (4), rolar (3) e banir (2), 5 maldições, evolução de armas em baú (9 evoluções),
combos com ouro, chefes (Arauto, Dragão, Barão), meta de Essência Azul.
Roteiro sugerido (nada disso foi implementado): reinos/mapas por tema do Rift (Selva, Rio, Rota, Vazio), objetivo que
desperta o chefe, eventos com ataque avisado no chão, relíquias por chefe, mercador, mais campeões com sprites próprios,
desafio diário, livro de descobertas e ascensão.
