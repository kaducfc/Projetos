# Logos oficiais dos times

Usadas quando `TEAM_LOGOS = 'oficiais'` em `shared/config.js`, ou só para os
times listados em `OFFICIAL_LOGOS_ALLOWED` (ex.: times que autorizaram).
Os escudos próprios do site ficam em `../emblemas/`, com os mesmos nomes.

Coloque aqui as logos em **PNG com fundo transparente**, com o nome do
arquivo igual ao id do time (tudo minúsculo). Qualquer jogo do site pode
usar estas imagens.

- Tamanho recomendado: **256×256 px**, logo centralizada, com uma pequena
  margem. Tente deixar cada arquivo com menos de ~30 KB.
- Academias usam a logo do time principal automaticamente.
- Times amadores (fictícios) continuam com o escudo gerado.
- Time sem arquivo aqui também continua com o escudo gerado.
- Logos escuras (pretas) ganham um contorno claro automático para aparecer
  no fundo preto do site. Se existir a versão branca/clara da logo, ela
  fica ainda melhor.
- Para testar as logos na versão em arquivo único:
  `node jogos/carreira-no-rift/scripts/build-bundle.mjs --logos=oficiais > teste.html`

| Região | Arquivos |
|---|---|
| Coreia (LCK) | gen.png, t1.png, hle.png, kt.png, dk.png, fox.png, ns.png, drx.png, bro.png, dnf.png |
| China (LPL) | blg.png, al.png, tes.png, jdg.png, wbg.png, ig.png, edg.png, lng.png, nip.png, fpx.png |
| Europa (LEC) | g2.png, fnc.png, mkoi.png, kc.png, vit.png, gx.png, th.png, sk.png, bds.png, navi.png |
| Am. do Norte (LCS) | fly.png, c9.png, tl.png, 100t.png, dig.png, sr.png, lyon.png, dsg.png |
| Brasil (CBLOL) | png.png (paiN Gaming), loud.png, vks.png, fur.png, red.png, lev.png, fx.png, lg.png |
| Convidados | cfo.png (CTBC Flying Oyster), gam.png (GAM Esports) |
