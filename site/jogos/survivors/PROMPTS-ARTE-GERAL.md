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

## 6. Interface (HUD): ícones e logo (2 imagens)

Anexe a imagem do Garen como referência de estilo. Fundo verde #00FF00. Nomes: `ui-icones.png`, `ui-logo.png`.

### 6.1 Ícones (24) — ui-icones.png

```
Create ONE sprite sheet of 24 UI icons for a pixel-art survivors game (League of Legends themed), used small (16 to 32 px) on cards and the HUD.

Pixel art, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and art style as the attached reference character (Garen). NO anti-aliasing, NO blur, NO soft glow, NO gradients. Strong 1-pixel dark outline (#14101E) around every icon, 3 to 4 tones per material, light from the top-left. Each icon is a BOLD, SIMPLE, front-facing, centered emblem that fills about 80% of its cell, with a very clear silhouette and 1 or 2 strong accent colors, so it reads at 16 px. No frames, no backgrounds, no text.

GRID: image size 1536 x 1024 px, invisible grid of 6 columns x 4 rows of equal 256 x 256 px cells (24 cells), no lines. ONE icon per cell, centered, at least 24 px of empty margin.

WEAPONS (row 1 and the first 3 of row 2):
(1) Demacian Blades: a silver sword with a gold hilt and a blue circular sweep mark behind it; (2) Orb of Deception: a violet-pink glowing orb with a short tail; (3) Quick Shot: a golden energy bolt pointing up-right; (4) Ice Volley: a fan of three ice-blue arrows; (5) Singularity: a golden-white swirling vortex; (6) Shadow Blade: a dark violet curved blade with a red edge; (7) Charm Kiss: a pink heart with sparkles; (8) Blizzard: a white-blue snowflake inside a ring of ice shards; (9) Thunder: a white-blue lightning bolt striking down.
PASSIVE ITEMS (cells 10 to 18):
(10) Long Sword: a steel sword upright, red grip; (11) Boots of Speed: a pair of brown leather boots with small wings, light blue accents; (12) Doran's Ring: a gold ring with a small red gem; (13) Chain Vest: a gray chainmail vest; (14) Crystalline Scepter: a golden staff topped with a cyan crystal; (15) Hourglass: a gold hourglass with blue sand; (16) Farsight Stone: a purple eye-shaped stone with a gold rim; (17) Blood Amulet: a red teardrop amulet on a chain; (18) Amplifying Tome: a blue book with a gold star and a rune on the cover.
INTERFACE ICONS (cells 19 to 24):
(19) gold coin with a crown; (20) a white skull (kill counter); (21) Essence: a light-blue faceted crystal drop; (22) Reroll: two arrows in a circle, plus a tiny die; (23) Ban: a red circle with a diagonal bar; (24) Curse: a purple skull-and-flame mark with a dark aura (hard-edged pixels).

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadows. Do not use green on the icons. No text, no labels, no watermark.
```

### 6.2 Logo — ui-logo.png

```
Create a game logo for "RIFT SURVIVORS" in pixel art, 32-bit era, clean hand-placed pixels, crisp hard edges, NO anti-aliasing, NO blur, NO gradients, NO soft glow. Same chunky pixel size as the attached reference character (Garen).

Image size 1536 x 768 px. The logo is centered and fills about 85% of the width. Two lines of chunky, beveled pixel lettering: the top line "RIFT" in large letters, gold (#F5C82E base, #FFE9A0 highlight, #B8860B shadow) with a thick dark outline (#14101E) and a 3D extruded edge; the bottom line "SURVIVORS" in letters of about 75% the height, in white-silver (#E4EBF7 highlight, #AAB6CF base, #6C7896 shadow) with the same dark outline. Between and behind the lines: two crossed Demacian-style swords in steel and gold behind the letters, a small blue-violet crystal gem in the middle of the "I" of RIFT, a few tiny hard-edged sparkles around. Fantasy, heroic, readable at 300 px wide.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadow. Do not use green on the logo. No other text, no tagline, no watermark.
```

## 7. Ionia: pacote completo (6 imagens)

Anexe a imagem do Garen em cada uma. Tema: floresta espiritual, flor de cerejeira rosa, bambu, lanternas de pedra, santuários, água cristalina, paleta verde-água, rosa e pedra clara.

### 7.1 Cenário: objetos pequenos (24) — props-ionia-pequenos.png

```
Create ONE sprite sheet image of small environment props for the map "Ionia" (League of Legends: a serene spirit forest with cherry blossoms, bamboo, shrines and clear water).

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 6 columns x 4 rows of equal 256 x 256 px cells (24 cells), no lines between cells. ONE object per cell, centered horizontally, its base touching the same invisible ground line at y = 235 of the cell, at least 20 px of margin, nothing crossing the cell borders. Scale: the main character of the reference is about 170 px tall, so a bush is about 90 px tall, a small rock about 50 px, flowers about 40 px, a lantern about 110 px. Every object must look good scattered on top of a teal-green grass field.

THE 24 OBJECTS (left to right, top to bottom):
Row 1: (1) small tuft of teal-green grass, (2) tall wild grass with a few pink petals, (3) round bush with pale pink cherry blossoms, (4) small bamboo cluster of 3 stalks, (5) group of white and pink lotus-like flowers, (6) small smooth gray stone cluster (3 stones) with moss.
Row 2: (7) medium smooth gray rock, (8) large mossy boulder with a pink flower on top, (9) group of pale pink flowers, (10) group of violet irises, (11) group of white spirit flowers with tiny cyan sparks (hard-edged pixels, no haze), (12) fallen mossy log with small pink mushrooms.
Row 3: (13) small cherry-blossom sapling with a few fallen petals around, (14) stone lantern (toro), ancient, with a soft cyan flame, (15) small stone water basin with a bamboo spout and clear water, (16) pile of cherry petals on the ground, (17) wooden signpost with two arrows (no text), (18) short broken wooden fence with a rope.
Row 4: (19) wooden barrel and a small woven basket together, (20) stack of three flat stepping stones with moss, (21) tiny stone shrine (hokora) the size of a doghouse, with a small red ribbon, (22) small stone fox statue with a red scarf, (23) ruined short stone pillar with a faint cyan rune, (24) ring of small glowing cyan spirit mushrooms (hard-edged pixels).

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the objects (leaves must be a clearly different, darker or yellower green, and pink or teal accents are welcome). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

### 7.2 Cenário: objetos grandes (6) — props-ionia-grandes.png

```
Create ONE sprite sheet image of large environment props for the map "Ionia" (League of Legends).

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 3 columns x 2 rows of equal 512 x 512 px cells (6 cells), no lines between cells. ONE object per cell, centered horizontally, its base touching the same invisible ground line at y = 470 of the cell, at least 24 px of margin, nothing crossing the cell borders. Scale: the main character of the reference is about 170 px tall; a big tree is about 380 px tall.

THE 6 OBJECTS: (1) big cherry blossom tree with a thick twisted dark-brown trunk and a huge round canopy of pale pink blossoms with a few falling petals, (2) second cherry tree, taller and with deeper pink blossoms and a hanging paper lantern, (3) tall bamboo grove of about 8 thick stalks with leafy tops, (4) a red-and-wood torii-style shrine gate (Ionian style: two thick pillars, a curved double crossbeam, a rope with white paper ribbons), mossy base, (5) a stone pagoda shrine with a curved teal roof, two floors, stone base and a glowing cyan lantern in the door, (6) a large mossy rock formation with a small waterfall and a clear blue pool with lily pads at its base.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the objects (leaves must be a clearly different, darker or yellower green, and pink or teal accents are welcome). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

### 7.3 Inimigos de Ionia, pacote 1 — inimigos-ionia-1.png

```
Create ONE sprite sheet image with the walk cycles of four enemies.

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1024 x 1024 px, divided into an invisible grid of 4 columns x 4 rows of equal 256 x 256 px cells (16 cells), no lines between cells. EACH ROW is ONE enemy; the 4 cells of the row are its WALK CYCLE (4 frames, seamless loop), moving toward the RIGHT, three-quarter view, same size in all frames, feet touching the same invisible baseline at y = 235 of the cell, centered horizontally, at least 20 px of margin, nothing crossing the cell borders. Walk cycles must have clear leg or body movement between frames.

THE 4 ENEMIES (Ionia, corrupted spirit forces, menacing but cute-chunky proportions):
ROW 1, CORRUPTED MONK (about 130 px tall, the common soldier): an Ionian monk gone dark: bald or topknot head, a ragged teal-and-white robe with a dark purple sash, a wooden bo staff, wrapped hands, angry glowing purple eyes, wisps of purple spirit-smoke (hard-edged pixels) from the shoulders, quick shuffling steps.
ROW 2, SPIRIT SHAMAN (about 135 px tall, the caster): a small shaman in a long pale-blue robe with a white fox-style mask (red markings), holding a tall wooden staff with a hanging paper lantern that glows cyan-violet (hard-edged pixels), floats slightly while walking.
ROW 3, FIREWORK CART (about 150 px tall, the siege unit): a small wooden cart painted red and teal with two big spoked wheels that turn between frames, a bamboo rocket launcher tube on top pointing right with paper-wrapped rockets, a tiny masked crew member behind it.
ROW 4, WISP OF DISCORD (about 100 px tall, the swarm unit): a small floating ghost-flame: a rounded purple-and-cyan flame body with a tail, two big yellow eyes, tiny angry mouth, wavy floating motion (the tail and body wave between frames), no legs.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the objects (leaves must be a clearly different, darker or yellower green, and pink or teal accents are welcome). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

### 7.4 Inimigos de Ionia, pacote 2 — inimigos-ionia-2.png

```
Create ONE sprite sheet image with the walk cycles of four enemies.

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1024 x 1024 px, divided into an invisible grid of 4 columns x 4 rows of equal 256 x 256 px cells (16 cells), no lines between cells. EACH ROW is ONE enemy; the 4 cells of the row are its WALK CYCLE (4 frames, seamless loop), moving toward the RIGHT, three-quarter view, same size in all frames, feet touching the same invisible baseline at y = 235 of the cell, centered horizontally, at least 20 px of margin, nothing crossing the cell borders. Walk cycles must have clear leg or body movement between frames.

THE 4 ENEMIES (Ionia, spirit forest creatures, menacing but chunky proportions):
ROW 1, SPIRIT FOX (about 120 px tall, 170 px long): a lean white-and-pale-blue fox with two tails tipped in cyan flame, red facial markings, glowing yellow eyes, fangs, running gallop.
ROW 2, BAMBOO MANTIS (about 125 px tall): a fast green-and-yellow mantis-like insect made of bamboo segments with two blade-like forearms held forward, big angry eyes, quick hopping run.
ROW 3, STONE GUARDIAN CUB (about 150 px tall, the elite): a small stone temple-guardian lion-dog (komainu style), gray-white stone with moss, curly mane, a glowing teal crystal in the forehead and one in the chest, red ribbon around the neck, heavy stomping walk.
ROW 4, TEMPLE COLOSSUS (about 210 px tall, the biggest): a huge ancient stone statue guardian in monk-warrior armor, pale-gray cracked stone with moss and pink blossoms growing on the shoulders, big stone fists, a calm carved face with two glowing cyan eyes, a broken stone halo behind its head, slow heavy stomp.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the objects (leaves must be a clearly different, darker or yellower green, and pink or teal accents are welcome). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

### 7.5 Kodama Ancião (chefe menor, 5:00) — chefe-ionia-1.png

```
Create ONE sprite sheet image with the animation frames of a boss monster (ANCIENT KODAMA SPIRIT STAG of Ionia).

Pixel art game boss sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around the whole creature. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), the creature faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CREATURE: "Ancient Kodama", a huge sacred forest spirit of Ionia (League of Legends), about 340 px tall: a tall stag-like spirit standing on four sturdy legs, pale cream-white fur with dark teal markings, a calm carved white mask-like face with two glowing cyan eyes and red marking lines, enormous antlers shaped like cherry-blossom branches full of pink flowers and a few hanging paper charms, a thick mane of teal leaves, small glowing cyan spirit crystals along the spine and a rope with white paper ribbons around the neck. Palette: cream white, teal, pink blossom, cyan glow, warm gray.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 3 columns x 2 rows of equal 512 x 512 px cells (6 cells), no lines between cells. In EVERY cell the same creature at the same scale, centered horizontally, its base touching the same invisible ground line at y = 470 of the cell, at least 24 px of margin, nothing crossing the cell borders. Identical design, colors and proportions in all cells.

CELLS (left to right, top to bottom): (1) IDLE A: standing calm, head up, blossoms still; (2) IDLE B: antlers swaying slightly to one side, a couple of petals falling; (3) IDLE C: swaying to the other side (the 3 idle cells form a seamless slow loop); (4) ATTACK WIND-UP: head lowered, antlers pointed forward to the right, front hoof scraping the ground, cyan crystals glowing brighter (hard-edged pixels); (5) ATTACK STRIKE: charging lunge to the right, head low, antler tips flaring with crisp hard-edged cyan and pink energy streaks behind; (6) DEATH: the stag lying down on its side, antlers scattered into a heap of pink blossoms and petals, cyan crystals dark and cracked.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the creature (use dark, yellowish or bluish greens instead, clearly different from the background). Do not use a white or checkerboard background. Do NOT draw ground or cast shadows.
```

### 7.6 Dragão Espiritual (chefe final, 10:00) — chefe-ionia-2.png

```
Create ONE sprite sheet image with the animation frames of a boss monster (ASTRAL SPIRIT DRAGON of Ionia).

Pixel art game boss sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around the whole creature. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), the creature faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CREATURE: "Spirit Dragon", a giant Ionian eastern-style serpent dragon (League of Legends), about 440 px tall: a long slender scaled body in deep teal-blue with a pale gold-white belly, coiled in an S shape that rises so the head is high on the right, no wings, four small clawed legs, a long flowing mane and two long whiskers in pink and white, two antler-like horns, big glowing golden eyes, a mouth with sharp fangs, a glowing white-cyan pearl held in one claw, tiny pink blossoms stuck in its mane. Palette: deep teal, blue, pale gold, pink, white, cyan glow.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 3 columns x 2 rows of equal 512 x 512 px cells (6 cells), no lines between cells. In EVERY cell the same creature at the same scale, centered horizontally, its base touching the same invisible ground line at y = 470 of the cell, at least 24 px of margin, nothing crossing the cell borders. Identical design, colors and proportions in all cells.

CELLS (left to right, top to bottom): (1) IDLE A: coiled, head raised, whiskers and mane relaxed; (2) IDLE B: body swaying slightly to one side, whiskers drifting; (3) IDLE C: swaying to the other side (the 3 idle cells form a seamless loop); (4) ATTACK WIND-UP: head drawn back, jaw wide open, the pearl glowing brightly, the mane flared (hard-edged pixels); (5) ATTACK STRIKE: head thrust forward and down toward the right, a hard-edged ring of cyan and pink energy bursting from its open mouth; (6) DEATH: the body collapsed flat and uncoiled on the ground, whiskers limp, petals scattered around, the pearl cracked and dark.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the creature (use dark, yellowish or bluish greens instead, clearly different from the background). Do not use a white or checkerboard background. Do NOT draw ground or cast shadows.
```

## 8. Demacia: pacote completo (6 imagens)

Anexe a imagem do Garen em cada uma. Tema: planícies verdes, mármore branco, estandartes azuis e dourados, muralhas, estátuas de cavaleiros, petricita (pedra branca anti-magia).

### 8.1 Cenário: objetos pequenos (24) — props-demacia-pequenos.png

```
Create ONE sprite sheet image of small environment props for the map "Demacia" (League of Legends: rolling green plains and the white-marble kingdom, blue and gold banners, stone walls, petricite).

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 6 columns x 4 rows of equal 256 x 256 px cells (24 cells), no lines between cells. ONE object per cell, centered horizontally, its base touching the same invisible ground line at y = 235 of the cell, at least 20 px of margin, nothing crossing the cell borders. Scale: the main character of the reference is about 170 px tall, so a bush is about 90 px tall, a small rock about 50 px, flowers about 40 px, a banner pole about 170 px. Every object must look good scattered on top of a bright green grass field.

THE 24 OBJECTS (left to right, top to bottom):
Row 1: (1) small tuft of green grass, (2) tall wild grass with a few yellow wheat stalks, (3) round bush with small white flowers, (4) small cluster of golden wheat, (5) group of white daisies, (6) small gray stone cluster (3 stones).
Row 2: (7) medium gray rock, (8) large mossy boulder, (9) group of blue cornflowers, (10) group of yellow buttercups, (11) round hay bale with a rope, (12) fallen log with a few small mushrooms.
Row 3: (13) short broken white marble column with a vine, (14) blue-and-gold Demacian banner on a wooden pole, with a simple winged-shield crest (no text), (15) a sword planted in a small stone mound with a blue ribbon (a hero's grave marker), (16) small pile of white marble rubble, (17) wooden signpost with two arrows (no text), (18) short wooden fence section.
Row 4: (19) wooden crate, barrel and a sack together, (20) stack of three white stone bricks, (21) iron brazier with a small fire on a stone base, (22) small stone angel-knight statue on a pedestal with a tiny sword, (23) wooden weapon rack with spears and a round shield (blue and gold), (24) small round army tent, blue canvas with a gold pennant.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the objects (leaves and grass must be a clearly different, darker or yellower green, and white, blue and gold accents are welcome). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

### 8.2 Cenário: objetos grandes (6) — props-demacia-grandes.png

```
Create ONE sprite sheet image of large environment props for the map "Demacia" (League of Legends).

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 3 columns x 2 rows of equal 512 x 512 px cells (6 cells), no lines between cells. ONE object per cell, centered horizontally, its base touching the same invisible ground line at y = 470 of the cell, at least 24 px of margin, nothing crossing the cell borders. Scale: the main character of the reference is about 170 px tall; a big tree is about 380 px tall.

THE 6 OBJECTS: (1) big healthy oak tree with a thick trunk and a round deep-green canopy with lighter highlights, (2) tall slim poplar-like tree group (three trees), (3) a white-marble watchtower with a blue conical roof, gold finial and a blue-and-gold banner, stone base with a small wooden door, (4) a big white-marble statue of a winged Demacian knight with a raised sword on a tall stone pedestal, (5) a section of the Demacian city wall: a white-stone wall with two crenellated towers and a closed wooden gate with iron bands, blue banners hanging, (6) a stone windmill with big wooden blades, a small stone farmhouse base, haystacks next to it.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the objects (leaves and grass must be a clearly different, darker or yellower green, and white, blue and gold accents are welcome). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

### 8.3 Inimigos de Demacia, pacote 1 — inimigos-demacia-1.png

```
Create ONE sprite sheet image with the walk cycles of four enemies.

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1024 x 1024 px, divided into an invisible grid of 4 columns x 4 rows of equal 256 x 256 px cells (16 cells), no lines between cells. EACH ROW is ONE enemy; the 4 cells of the row are its WALK CYCLE (4 frames, seamless loop), moving toward the RIGHT, three-quarter view, same size in all frames, feet touching the same invisible baseline at y = 235 of the cell, centered horizontally, at least 20 px of margin, nothing crossing the cell borders. Walk cycles must have clear leg or body movement between frames.

THE 4 ENEMIES (Demacia, rogue soldiers and hunted spirits, menacing but cute-chunky proportions):
ROW 1, REBEL PIKEMAN (about 130 px tall, the common soldier): a rebel soldier of Demacia gone rogue: dull gray-blue steel helmet with a torn red plume, battered chainmail and a tattered dark-blue tabard with a scratched-out crest, a long spear held forward, a small dented round shield, angry glowing red eyes, marching steps.
ROW 2, MAGESEEKER (about 135 px tall, the caster): a hooded mage-hunter in a long white and gold robe with a gray hood, a white petricite-crystal staff with a glowing pale-blue crystal on top (hard-edged pixels, no haze), a pale face with glowing blue eyes, floats slightly while walking.
ROW 3, BALLISTA CART (about 150 px tall, the siege unit): a small wooden cart with two spoked wheels that turn between frames, a big steel ballista on top aimed to the right loaded with a thick bolt, blue-and-gold torn banner on the side, a tiny helmeted crew member pushing from behind.
ROW 4, MIST WRAITH (about 100 px tall, the swarm unit): a small floating ghost-knight spirit: a pale blue-green translucent-looking (but hard-edged, opaque pixels) ghostly helmet and torso fading into a wispy tail, two glowing teal eyes in the helmet slit, wavy floating motion (the tail waves between frames), no legs.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the objects (leaves and grass must be a clearly different, darker or yellower green, and white, blue and gold accents are welcome). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

### 8.4 Inimigos de Demacia, pacote 2 — inimigos-demacia-2.png

```
Create ONE sprite sheet image with the walk cycles of four enemies.

Pixel art game assets, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around every object. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors). No text, no labels, no numbers, no frames, no UI, no watermark.

GRID: image size 1024 x 1024 px, divided into an invisible grid of 4 columns x 4 rows of equal 256 x 256 px cells (16 cells), no lines between cells. EACH ROW is ONE enemy; the 4 cells of the row are its WALK CYCLE (4 frames, seamless loop), moving toward the RIGHT, three-quarter view, same size in all frames, feet touching the same invisible baseline at y = 235 of the cell, centered horizontally, at least 20 px of margin, nothing crossing the cell borders. Walk cycles must have clear leg or body movement between frames.

THE 4 ENEMIES (Demacia, war beasts and stone guardians, menacing but chunky proportions):
ROW 1, NIGHTMARE WARHORSE (about 130 px tall, 180 px long): a black armored warhorse with torn blue barding, a cracked steel face-guard, glowing red eyes, flowing dark mane, galloping.
ROW 2, WILD GRYPHON FLEDGLING (about 125 px tall): a young gryphon with an eagle head (yellow beak, angry eyes), brown-and-white feathers, a lion body and small half-open wings, quick hopping run.
ROW 3, GARGOYLE CUB (about 150 px tall, the elite): a small stone gargoyle with a stocky body, short folded wings, horns, glowing blue eyes and a glowing blue crystal in the chest, pale gray granite with cracks, heavy stomping walk.
ROW 4, PETRICITE JUGGERNAUT (about 210 px tall, the biggest): a huge walking suit of white petricite stone armor shaped like a knight, no body inside, glowing blue light in the helmet slit and chest, giant stone gauntlet fists, cracks with blue light, a broken blue-and-gold tabard on the waist, slow heavy stomp.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the objects (leaves and grass must be a clearly different, darker or yellower green, and white, blue and gold accents are welcome). Do not use a white or checkerboard background. Do NOT draw ground, grass patches, or cast shadows under the objects.
```

### 8.5 Cavaleiro da Vanguarda (chefe menor, 5:00) — chefe-demacia-1.png

```
Create ONE sprite sheet image with the animation frames of a boss monster (VANGUARD KNIGHT-COMMANDER of Demacia).

Pixel art game boss sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around the whole creature. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), the creature faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CREATURE: "Vanguard Commander", a huge heavily armored Demacian knight-captain (League of Legends), about 340 px tall: bulky dark-steel full plate armor with gold trim, a tall helmet with a long blue plume, massive pauldrons with winged-shield crests, a long blue-and-gold cape, one hand holding a giant tower shield with a golden winged crest, the other hand holding a huge greatsword with a white-steel blade and a gold crossguard, glowing pale-blue eyes in the helmet slit. Palette: dark steel gray, gold, royal blue, white steel, pale-blue glow.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 3 columns x 2 rows of equal 512 x 512 px cells (6 cells), no lines between cells. In EVERY cell the same creature at the same scale, centered horizontally, its base touching the same invisible ground line at y = 470 of the cell, at least 24 px of margin, nothing crossing the cell borders. Identical design, colors and proportions in all cells.

CELLS (left to right, top to bottom): (1) IDLE A: standing guard, shield forward, sword point resting low; (2) IDLE B: cape and plume swaying slightly to one side, chest rising; (3) IDLE C: swaying to the other side (the 3 idle cells form a seamless slow loop); (4) ATTACK WIND-UP: greatsword raised high above the head with both hands, shield dropped behind, body leaning back, eyes glowing brighter (hard-edged pixels); (5) ATTACK STRIKE: the greatsword slammed down into the ground in front of it, crisp hard-edged white and pale-blue shockwave lines and flying stone chips around the impact; (6) DEATH: the armor collapsed in a heap on the ground with the helmet rolled aside, the sword stuck in the ground and the cape lying over the pile, the eye-glow gone dark.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the creature (use dark, yellowish or bluish greens instead, clearly different from the background). Do not use a white or checkerboard background. Do NOT draw ground or cast shadows.
```

### 8.6 Galio, o Colosso (chefe final, 10:00) — chefe-demacia-2.png

```
Create ONE sprite sheet image with the animation frames of a boss monster (GALIO THE COLOSSUS, stone gargoyle guardian of Demacia).

Pixel art game boss sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong dark outline (#14101E) around the whole creature. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), the creature faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CREATURE: "Galio, the Colossus", a giant living stone-gargoyle statue guardian of Demacia (League of Legends), about 440 px tall: a massive humanoid body of pale-gray and white carved stone with blue glowing cracks and a glowing blue core in the chest, huge folded stone wings with feather-shaped plates, a stern knight-like carved face with two glowing blue eyes, a stone crest crown, thick arms with giant fists, gold ornaments on the shoulders, a worn blue tabard hanging from the waist. Palette: pale gray stone, white, dark gray, blue glow, a little gold.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 3 columns x 2 rows of equal 512 x 512 px cells (6 cells), no lines between cells. In EVERY cell the same creature at the same scale, centered horizontally, its base touching the same invisible ground line at y = 470 of the cell, at least 24 px of margin, nothing crossing the cell borders. Identical design, colors and proportions in all cells.

CELLS (left to right, top to bottom): (1) IDLE A: standing tall, wings folded, fists lowered; (2) IDLE B: chest core pulsing brighter, wings slightly lifted, a few dust specks falling; (3) IDLE C: wings settling back (the 3 idle cells form a seamless slow loop); (4) ATTACK WIND-UP: wings spread wide, both fists raised high above the head, chest core blazing (hard-edged pixels); (5) ATTACK STRIKE: both fists smashed into the ground in front of it, a hard-edged ring of blue light shockwave and flying stone chips; (6) DEATH: the statue collapsed and shattered into a pile of stone blocks, broken wings and rubble with the blue core cracked and dark.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use #00FF00 or any bright pure green on the creature (use dark, yellowish or bluish greens instead, clearly different from the background). Do not use a white or checkerboard background. Do NOT draw ground or cast shadows.
```
