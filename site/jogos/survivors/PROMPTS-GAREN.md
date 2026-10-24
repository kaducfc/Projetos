# Garen: prompts completos (copie e cole cada bloco inteiro no ChatGPT)

O 1 vai sozinho. Nos de 2 a 6, anexe a ficha aprovada (garen-modelo.png) junto com o texto.

## 1. Ficha do personagem (garen-modelo.png)

```
Create a game character model sheet image.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 24 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Heroic but compact proportions, about 3 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). Background: fully transparent PNG (real alpha channel). No ground shadow, no text, no labels, no frames, no UI, no watermark, no checkerboard pattern.

SUBJECT: GAREN, "The Might of Demacia", from League of Legends. Show three views side by side on one transparent canvas: front view, three-quarter right view, and back view, all at the same scale, each in its own 512 x 512 px area (total image 1536 x 512 px). Full body, standing in a relaxed heroic pose.

DESIGN DETAILS: bare head with short messy brown hair (#7A4521 base, #A8672F highlights), strong jaw, determined face, fair skin (#F3CDA6, shade #D9A47C). Heavy Demacian plate armor in polished silver steel (#AAB6CF base, #E4EBF7 highlight, #6C7896 shadow) with gold trim (#F5C82E and #B8860B). Huge layered shoulder pauldrons with a gold edge. Royal-blue tabard and short cape (#2F62C8 base, #6A98FF light, #1B2D6B dark) with a simplified winged-shield Demacian crest in gold on the chest. Steel gauntlets and greaves, brown leather boots. In his right hand he holds a big Demacian broadsword (steel blade, gold crossguard, brown grip) resting on his shoulder. No magic effects, no glow.

If you cannot produce a truly transparent background, use a flat solid pure green background (#00FF00), with no gradient, no shadow and no texture, so I can remove it afterwards.
```

## 2. Parada (garen-parada.png)

```
Create a game sprite animation strip.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 24 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Heroic but compact proportions, about 3 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). Background: fully transparent PNG (real alpha channel). No ground shadow, no text, no labels, no frames, no UI, no watermark, no checkerboard pattern.

FORMAT: generate ONE single PNG image, 1024 x 256 px, made of exactly 4 equal square cells of 256 x 256 px laid side by side in ONE ROW, invisible grid, no lines between cells. In every cell: the same character, same scale (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225, at least 24 px of empty margin, nothing crossing the cell borders. Identical costume, colors and proportions in all cells. Facing right.

SUBJECT: Same character exactly as the attached model sheet of GAREN (Demacian knight: bare head with short messy brown hair, silver steel plate armor with gold trim, huge layered shoulder pauldrons, royal-blue tabard and short cape with a gold winged-shield crest, steel gauntlets and greaves, brown boots, big broadsword with steel blade and gold crossguard).
ANIMATION: IDLE loop, 4 frames, seamless: subtle breathing (chest rises 1 px and falls), the cape sways slightly, the sword tip bobs 1 px, a tiny blink in frame 3. Differences between frames must be very small.

If you cannot produce a truly transparent background, use a flat solid pure green background (#00FF00), with no gradient, no shadow and no texture, so I can remove it afterwards.
```

## 3. Andando (garen-andando.png)

```
Create a game sprite animation strip.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 24 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Heroic but compact proportions, about 3 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). Background: fully transparent PNG (real alpha channel). No ground shadow, no text, no labels, no frames, no UI, no watermark, no checkerboard pattern.

FORMAT: generate ONE single PNG image, 1536 x 256 px, made of exactly 6 equal square cells of 256 x 256 px laid side by side in ONE ROW, invisible grid, no lines between cells. In every cell: the same character, same scale (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225, at least 24 px of empty margin, nothing crossing the cell borders. Identical costume, colors and proportions in all cells. Facing right.

SUBJECT: Same character exactly as the attached model sheet of GAREN (Demacian knight: bare head with short messy brown hair, silver steel plate armor with gold trim, huge layered shoulder pauldrons, royal-blue tabard and short cape with a gold winged-shield crest, steel gauntlets and greaves, brown boots, big broadsword with steel blade and gold crossguard).
ANIMATION: WALK CYCLE, 6 frames, seamless loop, walking to the right: contact, down, passing, contact (other leg), down, passing. Body bobs 2 px, cape flows backwards, the sword stays on the shoulder, pauldrons bounce slightly. Feet touch the baseline on the contact frames.

If you cannot produce a truly transparent background, use a flat solid pure green background (#00FF00), with no gradient, no shadow and no texture, so I can remove it afterwards.
```

## 4. Ataque (garen-ataque.png)

```
Create a game sprite animation strip.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 24 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Heroic but compact proportions, about 3 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). Background: fully transparent PNG (real alpha channel). No ground shadow, no text, no labels, no frames, no UI, no watermark, no checkerboard pattern.

FORMAT: generate ONE single PNG image, 1024 x 256 px, made of exactly 4 equal square cells of 256 x 256 px laid side by side in ONE ROW, invisible grid, no lines between cells. In every cell: the same character, same scale (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225, at least 24 px of empty margin, nothing crossing the cell borders. Identical costume, colors and proportions in all cells. Facing right.

SUBJECT: Same character exactly as the attached model sheet of GAREN (Demacian knight: bare head with short messy brown hair, silver steel plate armor with gold trim, huge layered shoulder pauldrons, royal-blue tabard and short cape with a gold winged-shield crest, steel gauntlets and greaves, brown boots, big broadsword with steel blade and gold crossguard).
ANIMATION: SPIN ATTACK, 4 frames: (1) wind-up, body twisted, sword pulled back; (2) fast horizontal spin slash with a crisp pixel-art slash arc in white and light blue (hard-edged pixels, no blur, no glow); (3) follow-through, sword extended to the right, the arc fading; (4) recover to a ready stance. The slash arc may extend up to 40 px beyond the character but must stay inside its cell.

If you cannot produce a truly transparent background, use a flat solid pure green background (#00FF00), with no gradient, no shadow and no texture, so I can remove it afterwards.
```

## 5. Dano e morte (garen-dano-morte.png)

```
Create a game sprite animation strip.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 24 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Heroic but compact proportions, about 3 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). Background: fully transparent PNG (real alpha channel). No ground shadow, no text, no labels, no frames, no UI, no watermark, no checkerboard pattern.

FORMAT: generate ONE single PNG image, 1536 x 256 px, made of exactly 6 equal square cells of 256 x 256 px laid side by side in ONE ROW, invisible grid, no lines between cells. In every cell: the same character, same scale (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225, at least 24 px of empty margin, nothing crossing the cell borders. Identical costume, colors and proportions in all cells. Facing right.

SUBJECT: Same character exactly as the attached model sheet of GAREN (Demacian knight: bare head with short messy brown hair, silver steel plate armor with gold trim, huge layered shoulder pauldrons, royal-blue tabard and short cape with a gold winged-shield crest, steel gauntlets and greaves, brown boots, big broadsword with steel blade and gold crossguard).
ANIMATION: cells 1 and 2 = HURT (flinches back, eyes squeezed shut, whole body slightly lighter). Cells 3 to 6 = DEATH: staggers, drops to one knee while dropping the sword, falls on his side, lies on the ground (cell 6 is the final lying pose, flat and wide, still inside its cell).

If you cannot produce a truly transparent background, use a flat solid pure green background (#00FF00), with no gradient, no shadow and no texture, so I can remove it afterwards.
```

## 6. Retrato (garen-retrato.png)

```
Create a character-select portrait icon.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 24 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Heroic but compact proportions, about 3 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). Background: fully transparent PNG (real alpha channel). No ground shadow, no text, no labels, no frames, no UI, no watermark, no checkerboard pattern.

SUBJECT: bust portrait of Garen (League of Legends) for a character-select screen: head and shoulders, three-quarter view facing slightly right, confident smile. Same character exactly as the attached model sheet of GAREN (Demacian knight: bare head with short messy brown hair, silver steel plate armor with gold trim, huge layered shoulder pauldrons, royal-blue tabard and short cape with a gold winged-shield crest, steel gauntlets and greaves, brown boots, big broadsword with steel blade and gold crossguard). Image size 256 x 256 px, the character filling about 90% of the square, transparent background, no frame, no text.

If you cannot produce a truly transparent background, use a flat solid pure green background (#00FF00), with no gradient, no shadow and no texture, so I can remove it afterwards.
```

