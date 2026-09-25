# Logos oficiais dos times

Usadas quando `TEAM_LOGOS = 'oficiais'` em `shared/config.js` (o padrão
atual), ou só para os times listados em `OFFICIAL_LOGOS_ALLOWED` no modo
`'escudos'` (ex.: times que autorizaram).
Os escudos próprios do site ficam em `../emblemas/`, com os mesmos nomes.

Coloque aqui as logos em **PNG com fundo transparente**, com o nome do
arquivo igual ao id do time (tudo minúsculo). Qualquer jogo do site pode
usar estas imagens.

- Tamanho recomendado: **256×256 px**, logo centralizada, com uma pequena
  margem. Tente deixar cada arquivo com menos de ~30 KB.
- As logos atuais foram padronizadas: margens transparentes cortadas e
  cada logo centralizada num quadrado de 256×256 com o mesmo "tamanho
  visual" (logos quadradas um pouco menores, logos só de texto usando a
  largura toda). Ao trocar uma logo, siga o mesmo padrão.
- Academias usam a logo do time principal automaticamente.
- Times amadores (fictícios, fora do Brasil) continuam com o escudo gerado.
- Time sem arquivo aqui também continua com o escudo gerado.
- Logos escuras (pretas) ganham um contorno claro automático para aparecer
  no fundo preto do site. Se existir a versão branca/clara da logo, ela
  fica ainda melhor.
- Para testar as logos na versão em arquivo único:
  `node jogos/carreira-no-rift/scripts/build-bundle.mjs --logos=oficiais > teste.html`

| Região | Arquivos |
|---|---|
| Coreia (LCK) | gen.png, t1.png, hle.png, kt.png, dk.png, fox.png, ns.png, drx.png, bro.png (HANJIN BRION), dnf.png (DN SOOPers) |
| China (LPL) | blg.png, al.png, tes.png, jdg.png, wbg.png, ig.png, edg.png, lng.png, nip.png, we.png (Team WE) |
| Europa (LEC) | g2.png, fnc.png, mkoi.png, kc.png, vit.png, gx.png, th.png, sk.png, bds.png (Shifters), navi.png |
| Am. do Norte (LCS) | fly.png, c9.png, tl.png, sen.png (Sentinels), dig.png, sr.png, lyon.png, dsg.png |
| Brasil (CBLOL) | png.png (paiN Gaming), loud.png, vks.png, fur.png, red.png, lev.png, fx.png, lg.png |
| Brasil (Circuito Desafiante) | kabum.png (KaBuM! IDL), intz.png, estral.png (Estral Esports), solid.png (TEAM SOLID), 7rex.png (7REX Team), rmd.png (RMD Gaming), einerd.png (Ei Nerd Esports) · academias de Keyd, paiN e RED usam a logo do time principal |
| Convidados | cfo.png (CTBC Flying Oyster), gam.png (GAM Esports) |
