# Arte do restante do jogo (prompts completos)

Anexe sempre a imagem do Garen (ficha ou kit) como referência de estilo. Fundo verde #00FF00: eu removo depois.
Salve cada imagem na pasta `site/` com o nome indicado e me avise.

## 1. Cenário do Rift: objetos pequenos (24 itens) — props-rift-pequenos.png

```
Create ONE sprite sheet image of small environment props for the map "Summoner's Rift" (League of Legends jungle and lanes).

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 6 columns x 4 rows of equal 256 x 256 px cells (24 cells), no lines between cells. ONE object per cell, centered horizontally, its base touching the same invisible ground line at y = 235 of the cell, at least 20 px of margin, nothing crossing the cell borders. Scale: the main character of the reference is about 170 px tall, so a bush is about 90 px tall, a small rock about 50 px, flowers about 40 px, a boulder about 110 px. Every object must look good scattered on top of a green grass field.

THE 24 OBJECTS (left to right, top to bottom):
Row 1: (1) small grass tuft, (2) tall wild grass clump, (3) round green bush, (4) bush with small pink flowers, (5) cluster of red mushrooms with white dots, (6) small gray rock cluster (3 rocks).
Row 2: (7) medium gray rock, (8) large mossy boulder, (9) group of pink flowers, (10) group of yellow flowers, (11) group of blue and white flowers, (12) fallen mossy log.
Row 3: (13) tree stump with a few roots, (14) hanging jungle vines on two small wooden posts, (15) blue glowing crystal shard cluster (hard-edged pixels, no glow haze), (16) small pile of old bones and a skull, (17) wooden signpost with two arrows (no text), (18) broken wooden fence section.
Row 4: (19) wooden crate and a barrel together, (20) stack of three stone bricks with moss, (21) stone lantern, ancient, with a small flame, (22) yellow "stealth ward" totem: a small wooden pole with a glowing yellow eye, (23) ruined short stone column, (24) fairy ring of small white mushrooms.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green as an outline or on the objects' shadows; green may appear on the objects themselves only if it is a clearly different, darker leaf green (not #00FF00). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

## 2. Cenário do Rift: objetos grandes (6 itens) — props-rift-grandes.png

```
Create ONE sprite sheet image of large environment props for the map "Summoner's Rift" (League of Legends).

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 3 columns x 2 rows of equal 512 x 512 px cells (6 cells), no lines between cells. ONE object per cell, centered horizontally, its base touching the same invisible ground line at y = 470 of the cell, at least 24 px of margin, nothing crossing the cell borders. Scale: the main character of the reference is about 170 px tall; a big tree is about 380 px tall.

THE 6 OBJECTS: (1) big healthy oak tree with a thick trunk and a round dark-green canopy with lighter leaf highlights, (2) tall twisted jungle tree with hanging moss and exposed roots, canopy in darker teal-green, (3) ancient stone arch ruin covered in moss and vines with a faint blue rune on the keystone, (4) large formation of three tall gray boulders with moss, (5) broken ruined turret tower of a Summoner's Rift lane: cracked gray stone base, blue crystal on top half broken, vines, (6) giant glowing blue mushroom (hard-edged pixels, no glow haze) as tall as a house, with small mushrooms around its base.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green as an outline or on the objects' shadows; green may appear on the objects themselves only if it is a clearly different, darker leaf green (not #00FF00). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

## 3. Inimigos do Rift, pacote 1 (4 inimigos × 4 quadros) — inimigos-rift-1.png

```
Create ONE sprite sheet image with the walk cycles of four enemies.

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1024 x 1024 px, divided into an invisible grid of 4 columns x 4 rows of equal 256 x 256 px cells (16 cells), no lines between cells. EACH ROW is ONE enemy; the 4 cells of the row are its WALK CYCLE (4 frames, seamless loop), walking toward the RIGHT, three-quarter view, same size in all frames, feet touching the same invisible baseline at y = 235 of the cell, centered horizontally, at least 20 px of margin, nothing crossing the cell borders. Walk cycles must have clear leg or body movement between frames.

THE 4 ENEMIES (League of Legends, Summoner's Rift red-team creeps, evil and menacing but cute-chunky proportions):
ROW 1, MELEE MINION (about 130 px tall): round gray metal helmet with a short crest, red tunic, small round shield and a short sword, angry face, stubby legs.
ROW 2, CASTER MINION (about 135 px tall): red robe, tall pointed red hat, holds a short staff with a glowing red-orange orb on top (hard-edged pixels, no glow haze), small body, floats slightly while walking.
ROW 3, SIEGE MINION (about 150 px tall): a small red armored cart with a big round cannon barrel pointing right, two wheels that turn between frames, a tiny helmeted crew member behind it.
ROW 4, VOID LARVA (about 100 px tall): purple chitinous insect-like grub with six small legs, two big yellow glowing eyes, spiky back plates, a small mouth with teeth, crawls with wave-like body movement.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green as an outline or on the objects' shadows; green may appear on the objects themselves only if it is a clearly different, darker leaf green (not #00FF00). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

## 4. Inimigos do Rift, pacote 2 (4 inimigos × 4 quadros) — inimigos-rift-2.png

```
Create ONE sprite sheet image with the walk cycles of four enemies.

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1024 x 1024 px, divided into an invisible grid of 4 columns x 4 rows of equal 256 x 256 px cells (16 cells), no lines between cells. EACH ROW is ONE enemy; the 4 cells of the row are its WALK CYCLE (4 frames, seamless loop), moving toward the RIGHT, three-quarter view, same size in all frames, feet touching the same invisible baseline at y = 235 of the cell, centered horizontally, at least 20 px of margin, nothing crossing the cell borders. Walk cycles must have clear leg or body movement between frames.

THE 4 ENEMIES (League of Legends jungle monsters, menacing but chunky proportions):
ROW 1, GRAY WOLF (about 120 px tall, 170 px long): lean gray wolf with a darker back, white chest, glowing yellow eyes, fangs, bushy tail, running gallop.
ROW 2, RAPTOR (about 125 px tall): small orange and red feathered raptor bird-dinosaur with a yellow beak, yellow legs, big angry eyes, small wings, fast hopping run.
ROW 3, KRUG (about 150 px tall): small stone golem made of gray-brown rocks with moss, two glowing blue crystals on its back and one in its chest, small angry eyes, heavy stomping walk.
ROW 4, ANCIENT STONE GOLEM (about 210 px tall, the biggest): huge dark stone golem, cracked body with glowing orange magma runes, big fists, small head with two orange eyes, slow heavy stomp.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green as an outline or on the objects' shadows; green may appear on the objects themselves only if it is a clearly different, darker leaf green (not #00FF00). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

## Próximos pedidos (eu escrevo quando chegar a vez)
- Cenário e inimigos dos outros reinos (Ionia, Demacia, Noxus, Shurima, Freljord): mesmos pacotes, trocando o tema.
- Chefes (Arauto, Dragão, Barão e os 5 finais): uma folha por chefe, com parado, ataque e morte.
- Efeitos das armas e coletáveis: lâminas, orbe, flechas, raio, nevasca, zona de luz, gemas, baú, poção, ímã, ouro.
- Ícones das armas e dos itens, molduras do HUD e logo do jogo.
