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
