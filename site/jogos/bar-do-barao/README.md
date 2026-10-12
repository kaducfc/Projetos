# Coup: O Bar do Barão

Adaptação do Coup (4 jogadores: você + 3 bots) ambientada numa taverna clandestina de Zaun. Em teste: `soAdmin: true` em `shared/config.js` (apague a linha para lançar).

- `js/motor.js` — regras (sem tela, sem bots). A interface e os bots só chamam `pedido()` e `aplicar()`.
- `js/bots.js` — decisões dos bots; recebem só `visao()` (suas cartas + informação pública). Perfis em `js/config.js`.
- `js/falas.js` — falas de ambientação (não afetam regras). `js/main.js` — controlador e tela. `js/rng.js` — sorteio com semente.
- Arte: `ARTE` em `js/config.js` aceita caminhos de imagem (`cenario`, `logo`); `null` usa a arte substituta em CSS. Retratos: campo `retrato` de cada personagem.
- Testes: `node --test tests/bar-do-barao.test.mjs`.
