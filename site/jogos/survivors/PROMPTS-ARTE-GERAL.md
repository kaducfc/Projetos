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


## Chefes de Ixtal (anexe a imagem do Garen em cada um)

### 1. Guardião das Raízes (chefe menor, 5:00) — chefe-ixtal-1.png

```
Create ONE sprite sheet image with the animation frames of a boss monster (ROOT GUARDIAN of Ixtal).

Pixel art game boss sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around the whole creature. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), the creature faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CREATURE: "Guardian of the Roots", a colossal ancient forest guardian of the jungle of Ixtal (League of Legends), about 340 px tall. Body made of twisted dark-brown roots and mossy bark, thick root legs, two long vine arms ending in big thorny root-hands, a crown of large leaves and pink orchid flowers, a glowing emerald-yellow crystal embedded in its chest, small angry glowing yellow eyes in a carved wooden face, jade and turquoise stones tied with golden threads on its shoulders. Palette: dark brown, moss green (olive, not bright), warm yellow glow, pink and turquoise accents.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 3 columns x 2 rows of equal 512 x 512 px cells (6 cells), no lines between cells. In EVERY cell the same creature at the same scale, centered horizontally, its base touching the same invisible ground line at y = 470 of the cell, at least 24 px of margin, nothing crossing the cell borders. Identical design, colors and proportions in all cells.

CELLS (left to right, top to bottom): (1) IDLE A: standing, arms hanging, leaves slightly lowered; (2) IDLE B: leaves and vines swaying a little to one side, chest slightly raised; (3) IDLE C: swaying to the other side (the 3 idle cells form a seamless slow loop); (4) ATTACK WIND-UP: both arms raised high above the head, thorns spread, chest crystal glowing brighter (hard-edged pixels); (5) ATTACK STRIKE: both root-fists slammed down in front of it, a ring of sharp thorns erupting from the ground (hard-edged pixels); (6) DEATH: the guardian collapsed into a heap of roots, leaves, flowers and the cracked dark crystal.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the creature (use dark, yellowish or bluish greens instead, clearly different from the background). Do not use a white or checkerboard background. Do NOT draw ground or cast shadows.
```

### 2. Jaguar Espiritual (chefe do meio, 10:00) — chefe-ixtal-2.png

```
Create ONE sprite sheet image with the animation frames of a boss monster (SPIRIT JAGUAR of Ixtal).

Pixel art game boss sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around the whole creature. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), the creature faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CREATURE: "Spirit Jaguar", a huge ancestral jaguar guardian of Ixtal (League of Legends), about 260 px tall and 430 px long, side view facing right. Midnight-blue to black fur with glowing turquoise rosette spots, amber glowing eyes, long fangs, thick muscular legs with big claws, jade armor plates on the shoulders and back, gold ornaments (ear rings, neck collar with a jade stone), a long tail with a turquoise glowing tip. Palette: midnight blue, black, turquoise, jade, gold, amber.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 3 columns x 2 rows of equal 512 x 512 px cells (6 cells), no lines between cells. In EVERY cell the same creature at the same scale, centered horizontally, its base touching the same invisible ground line at y = 470 of the cell, at least 24 px of margin, nothing crossing the cell borders. Identical design, colors and proportions in all cells.

CELLS (left to right, top to bottom): (1) IDLE A: standing alert, head slightly lowered, tail low; (2) IDLE B: tail swishing up, weight shifted forward; (3) IDLE C: tail swishing the other way (the 3 idle cells form a seamless loop); (4) ATTACK WIND-UP: crouching very low, haunches raised, mouth open snarling, claws gripping the ground; (5) ATTACK STRIKE: mid-air pounce with all claws extended toward the right and mouth wide open, crisp hard-edged turquoise slash lines in front of it; (6) DEATH: lying on its side, flat and wide, turquoise spots fading and a few hard-edged turquoise sparks floating above.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the creature (use dark, yellowish or bluish greens instead, clearly different from the background). Do not use a white or checkerboard background. Do NOT draw ground or cast shadows.
```

### 3. Serpente de Jade, o chefe final (15:00) — chefe-ixtal-3.png

```
Create ONE sprite sheet image with the animation frames of a boss monster (JADE FEATHERED SERPENT of Ixtal).

Pixel art game boss sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around the whole creature. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), the creature faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CREATURE: "Kukul, the Jade Serpent", a giant feathered serpent god of Ixtal (League of Legends, Mesoamerican-inspired), about 440 px tall. Long scaly body coiled in an S shape, rising up so the head is high on the right, scales in dark jade green and deep turquoise with a pale gold belly, a crest of long feathers in blue, red and gold around the head and along the back, a mouth open with long fangs, big golden eyes, an ornate gold and red ornamental collar, and a glowing jade crystal orb held in the lowest coil. Palette: dark jade, turquoise, gold, red, bright blue feathers.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 3 columns x 2 rows of equal 512 x 512 px cells (6 cells), no lines between cells. In EVERY cell the same creature at the same scale, centered horizontally, its base touching the same invisible ground line at y = 470 of the cell, at least 24 px of margin, nothing crossing the cell borders. Identical design, colors and proportions in all cells.

CELLS (left to right, top to bottom): (1) IDLE A: coiled, head raised, feathers relaxed; (2) IDLE B: body swaying a little to one side, feathers lifted; (3) IDLE C: swaying to the other side (the 3 idle cells form a seamless loop); (4) ATTACK WIND-UP: head drawn back, jaw wide open, the jade orb glowing brightly in the coils (hard-edged pixels); (5) ATTACK STRIKE: head thrust forward and down toward the right, a hard-edged ring of turquoise energy bursting from its open mouth; (6) DEATH: the body collapsing and uncoiled flat on the ground, feathers scattered, the orb cracked and dark.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the creature (use dark, yellowish or bluish greens instead, clearly different from the background). Do not use a white or checkerboard background. Do NOT draw ground or cast shadows.
```

## 5. Efeitos das armas e itens do chão (3 imagens)

Anexe a imagem do Garen como referência de estilo. Fundo verde #00FF00. Nomes: `fx-projeteis.png`, `fx-efeitos.png`, `fx-coletaveis.png`.

### 5.1 Projéteis (8 itens) — fx-projeteis.png

```
Create ONE sprite sheet of projectile sprites for a top-down pixel-art survivors game (League of Legends themed).

Pixel art, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and art style as the attached reference character (Garen). NO anti-aliasing, NO blur, NO soft glow, NO gradients. Strong 1-pixel dark outline (#14101E) on every object, 3 tones per material, light from the top-left. Bright saturated colors so they read at tiny size.

GRID: image size 1536 x 1024 px, invisible grid of 4 columns x 2 rows of equal 384 x 512 px cells (8 cells), no lines. ONE object per cell, centered, large (about 300 px long), with at least 40 px empty margin. Every projectile points to the RIGHT (flying direction), seen from the side, so I can rotate it in the game.

THE 8 PROJECTILES (left to right, top to bottom):
Row 1: (1) a Demacian sword blade, silver steel with a gold hilt, upright, spinning-blade style; (2) the "Orb of Deception": a violet and pink magic orb with a short comet tail of sparkles behind it; (3) a quick golden-white energy bolt, short and pointed, with a tiny trail; (4) an ice arrow: crystal-blue arrowhead and white-blue feathers, tiny snowflake sparkles.
Row 2: (5) a shadow shuriken-like dagger: dark violet blade with a red edge, sharp, pointing right; (6) a charm heart: pink heart with a lighter pink highlight and a pink sparkle trail; (7) enemy bolt: red-orange fireball with a dark core, short flame tail; (8) jade bolt: green-cyan spirit orb with a white core and a leaf-shaped tail (used by the jungle boss).

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadows. Do not use green on the objects except item (8), and give item (8) a strong dark outline so it stays separable. No text, no labels, no frames, no watermark.
```

### 5.2 Efeitos animados (4 efeitos x 4 quadros) — fx-efeitos.png

```
Create ONE sprite sheet of animated visual effects for a top-down pixel-art survivors game (League of Legends themed).

Pixel art, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and art style as the attached reference character (Garen). NO anti-aliasing, NO blur, NO soft glow, NO gradients, NO smoke haze: effects are made of hard-edged pixel shapes with 3 to 4 tones. Dark 1-pixel outline only where it helps readability.

GRID: image size 1536 x 1024 px, invisible grid of 4 columns x 4 rows of equal 384 x 256 px cells (16 cells), no lines. Each ROW is one effect and each COLUMN is one animation frame (frame 1 to 4, left to right), same scale and same center in every frame, nothing crossing a cell border.

THE 4 EFFECTS (one per row, top to bottom):
Row 1 - LIGHTNING STRIKE: a jagged white-and-electric-blue bolt falling from the top of the cell to the ground. Frame 1: thin warning flash; frame 2: full bright bolt with a ground impact star; frame 3: bolt fading, small impact ring; frame 4: only sparks and a scorched ring on the ground.
Row 2 - SINGULARITY: seen from above (flat on the ground, slight perspective), a swirling vortex of golden-white light, 4 spiral arms rotating a quarter turn each frame, bright core, tiny light particles spiraling inward. Frame 4 is the same swirl a little brighter (it will loop).
Row 3 - BLIZZARD AURA: seen from above, a big ring of swirling ice shards and snowflakes in white and light blue around an EMPTY center (the center must stay empty and transparent), the shards shifted a bit each frame so it loops.
Row 4 - HIT SPARK: a small impact burst. Frame 1: tiny white star; frame 2: bigger yellow-white star with 6 spikes; frame 3: broken into 6 flying yellow and orange sparks; frame 4: a few tiny fading sparks.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadows. Do not use green in the effects. No text, no labels, no frames, no watermark.
```

### 5.3 Coletáveis (7 itens) — fx-coletaveis.png

```
Create ONE sprite sheet of pickup items for a top-down pixel-art survivors game (League of Legends themed).

Pixel art, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and art style as the attached reference character (Garen). NO anti-aliasing, NO blur, NO soft glow, NO gradients. Strong 1-pixel dark outline (#14101E), 3 to 4 tones per material, light from the top-left, three-quarter top-down view. Bright, clearly different silhouettes so they are readable when tiny.

GRID: image size 1536 x 1024 px, invisible grid of 4 columns x 2 rows of equal 384 x 512 px cells (8 cells), no lines. ONE object per cell, centered, about 260 px big, with its bottom near the same baseline, at least 50 px empty margin.

THE ITEMS (left to right, top to bottom):
Row 1: (1) small XP crystal, cyan-blue, a faceted diamond; (2) medium XP crystal, lime green, a taller faceted gem; (3) large XP crystal, pink-magenta, a big double-pointed gem with a white highlight; (4) gold coin with a small crown emblem, seen slightly tilted.
Row 2: (5) a red heart-shaped health potion flask with a cork and a white highlight; (6) a closed treasure chest: dark wood, gold corners, gold lock with a blue gem, small rune marks; (7) the same chest OPEN, golden light-colored pixels rising from inside (hard-edged sparkles, no haze), lid up; (8) leave this cell EMPTY.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadows. Do not use green on the items, the lime-green gem (2) must have a strong dark outline and a yellowish tint so it stays separable. No text, no labels, no frames, no watermark.
```
