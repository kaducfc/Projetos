# Zed: prompts completos para refazer a personagem no padrão do Garen, da Ahri, da Jinx, da Ashe e da Lux (copie e cole cada bloco inteiro no ChatGPT)

O 1 vai com a imagem do Garen (ou do kit da Ahri) anexada, só para o ChatGPT copiar o estilo e o tamanho do pixel. Nos de A a D, anexe a ficha aprovada do Zed (`zed-modelo.png`). Nomes sugeridos: `zed-modelo.png`, `zed-kit.png`, `zed-especiais.png`, `zed-andando.png`, `zed-retrato.png`.

## 1. Ficha da personagem (zed-modelo.png)

```
Create a game character model sheet image.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 28 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Compact proportions, about 3 heads tall and broad, heavy proportions, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: ZED, "the Master of Shadows", from League of Legends, in a heavy armored "Death Sworn" look. Show three views side by side on one canvas: front view, three-quarter right view, and back view (the back view must show the torn red cloth, the spiked shoulder plates and the back of the helmet clearly), all at the same scale, each in its own 512 x 512 px area (total image 1536 x 512 px). Full body, a wide, low, ready combat stance, knees bent, a big curved claw blade on each forearm pointing down and back.

DESIGN DETAILS: a broad, muscular, armored ninja warrior. Dark indigo-purple armor and clothing (#2A2040 base, #4A3366 light, #14101E shadow). Large spiked shoulder plates, spiked forearm guards, chest plate, knee plates and toe plates in silver-teal steel (#7FA3A8 base, #C9E4E6 light, #3C5A60 dark) with sharp backward-pointing spikes. A steel-teal helmet with a small gold crest on the forehead and a narrow glowing red eye slit (#FF3A4A), hard-edged pixels, no glow haze, the lower face hidden by a torn red hooded scarf (#C0283A base, #8A1A2A shade) draped over the shoulders and chest; a long ragged red cloth hanging in front of the hips; thick purple boots. On each arm a large curved steel-teal claw blade with silver edges and a few small gold studs, curving down and back past the knee. Hard-edged pixels everywhere, no glow, no effects.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no shadow, no texture. Do NOT use green anywhere on the character. Do not use a white or checkerboard background.
```

## A. Kit principal (zed-kit.png, 1536 x 1024: parada, andando, ataque, dano e morte)

```
Create ONE complete sprite sheet image with the full animation kit of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Zed, the Master of Shadows, League of Legends, 'Death Sworn' armored look): a heavy, broad-shouldered armored ninja warrior in dark indigo-purple armor (#2A2040, #4A3366, #14101E) with silver-teal spiked plates (#7FA3A8 base, #C9E4E6 light, #3C5A60 dark) on both shoulders, forearms, knees and chest; a steel-teal helmet with a gold crest and a glowing red eye slit (#FF3A4A); a torn red hooded scarf draped over the shoulders and chest (#C0283A, #8A1A2A) and a long ragged red cloth hanging in front of the hips like a tabard; heavy purple boots with steel-teal toe plates; and big curved steel-teal CLAW BLADES mounted on both forearms and hands, pointing down and back. Same colors, same proportions and same pixel size in every frame. Do not redesign anything. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 6 columns x 4 rows of equal 256 x 256 px cells (24 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally in the cell, with his feet touching the same invisible baseline at y = 225 of the cell (lying poses sit on that same baseline). At least 24 px of empty margin around him; nothing crosses the cell borders (spikes, red cloth and claws included).

ROWS (top to bottom):
ROW 1, IDLE loop (6 frames, seamless): a heavy tense ready stance, breathing 1 px, the torn red scarf and the hanging red cloth sway slightly, the claw blades twitch 1 px and their edges glint in frame 3, the red eye slit flickers brighter in frame 5. Differences between frames are small.
ROW 2, WALK CYCLE to the right (6 frames, seamless loop): contact, down, passing, contact with the other leg, down, passing. Body bobs 2 px, the torn red scarf and the red cloth flow backwards, claws held low and back.
ROW 3, ATTACK "CLAW SLASH" (6 frames): (1) he crouches and pulls both claw blades back, body twisted, the red eye slit glowing brighter; (2) a fast forward lunge with the right claw swinging up; (3) the slash at full extension to the right with a crisp hard-edged crescent slash arc in dark violet and red (no blur, no glow) and a few flying sparks; (4) follow-through with the left claw slashing back, the red cloth whipping; (5) recovery, claws lowered; (6) back to the ready stance. The slash arc and sparks may extend up to 40 px beyond the character but must stay inside the cell.
ROW 4, HURT and DEATH: cells 1 and 2 = HURT (flinches back, body slightly lighter, the red cloth flying). Cells 3 to 6 = DEATH: staggers, drops to his knees with the claws dragging on the ground, falls onto his side with the red cloth spread around him, final pose lying flat on the ground (wide pose, still inside its cell), the red eye slit gone dark.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## B. Especiais (zed-especiais.png, 1536 x 512: ataque especial, vitória e subir de nível)

```
Create ONE sprite sheet image with the SPECIAL moves of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Zed, the Master of Shadows, League of Legends, 'Death Sworn' armored look): a heavy, broad-shouldered armored ninja warrior in dark indigo-purple armor (#2A2040, #4A3366, #14101E) with silver-teal spiked plates (#7FA3A8 base, #C9E4E6 light, #3C5A60 dark) on both shoulders, forearms, knees and chest; a steel-teal helmet with a gold crest and a glowing red eye slit (#FF3A4A); a torn red hooded scarf draped over the shoulders and chest (#C0283A, #8A1A2A) and a long ragged red cloth hanging in front of the hips like a tabard; heavy purple boots with steel-teal toe plates; and big curved steel-teal CLAW BLADES mounted on both forearms and hands, pointing down and back. Same colors, same proportions and same pixel size in every frame. Do not redesign anything. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225 of the cell. At least 24 px of margin; nothing crosses the cell borders.

ROWS:
ROW 1, SPECIAL "DEATH MARK SPIN" (6 frames): he crosses both claw arms in front of him, then spins fast with the claws out; a ring of dark-purple and red crescent slashes and shadow wisps (hard-edged pixels, no blur, no glow haze) bursts outward in a circle around him, growing frame by frame, peaks in frame 4 with long curved crescent slashes in all directions, then breaks into small floating shadow shards and fades by frame 6.
ROW 2: cells 1 to 4 = VICTORY (he slams his claws together, then spreads his arms wide with a roar-like pose, the red cloth swaying and a few shadow wisps around, small loop); cells 5 and 6 = LEVEL UP (cell 5: deep crouch with the claws crossed, cell 6: a high jump with both claws raised and a red-violet slash arc under him).

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## C. Caminhada e corrida com pernas bem marcadas (zed-andando.png, 1536 x 512)

```
Create ONE sprite sheet image with the WALK and RUN cycles of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Zed, the Master of Shadows, League of Legends, 'Death Sworn' armored look): a heavy, broad-shouldered armored ninja warrior in dark indigo-purple armor (#2A2040, #4A3366, #14101E) with silver-teal spiked plates (#7FA3A8 base, #C9E4E6 light, #3C5A60 dark) on both shoulders, forearms, knees and chest; a steel-teal helmet with a gold crest and a glowing red eye slit (#FF3A4A); a torn red hooded scarf draped over the shoulders and chest (#C0283A, #8A1A2A) and a long ragged red cloth hanging in front of the hips like a tabard; heavy purple boots with steel-teal toe plates; and big curved steel-teal CLAW BLADES mounted on both forearms and hands, pointing down and back. Same colors, same proportions and same pixel size in every frame. Do not redesign anything. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

VIEW (important): a three-quarter SIDE view, the character walking toward the RIGHT side of the image, body turned about 60 degrees to the right, so that BOTH LEGS ARE CLEARLY VISIBLE AND SEPARATE at all times and the stride is easy to read (this is NOT a front-facing view). The red scarf and the red cloth stay behind him and the claws are held low and back, none of them hides his legs.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, and the lowest foot touches the same invisible baseline at y = 225 of the cell. At least 24 px of empty margin; nothing crosses the cell borders.

ROW 1, WALK CYCLE (6 frames, seamless loop), strongly readable legs, in this order:
(1) CONTACT: front leg extended forward with the heel on the ground, back leg extended behind with the toes on the ground, the stride is WIDE (legs make a clear inverted V); body at its lowest.
(2) RECOIL: weight moves onto the front foot, the back leg starts to lift and bend at the knee.
(3) PASSING: the standing leg is straight under the body, the other leg is bent and swinging forward with the foot clearly lifted off the ground (knee high); body at its highest.
(4) CONTACT with the OTHER leg: mirrored version of frame 1 (the legs have swapped places), wide stride.
(5) RECOIL with the other leg (mirror of frame 2).
(6) PASSING with the other leg (mirror of frame 3).
Add: body bobs 3 px up and down, a heavy, powerful stride, the red cloth flows behind with the steps.

ROW 2, RUN CYCLE (6 frames, seamless loop), same view and same rules, but faster and more dramatic: body leaning forward about 15 degrees, long leaping strides with both feet briefly off the ground in frames 3 and 6, knees lifted high, the red scarf and the red cloth streaming straight behind him, the claws held tight against his sides.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## D. Retrato (zed-retrato.png)

```
Create a character-select portrait icon.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the same chunky pixel size and art style as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: bust portrait of Zed (League of Legends, "the Master of Shadows", armored 'Death Sworn' look) for a character-select screen: a tight crop, head and shoulders, three-quarter view facing slightly right, a cold menacing look, the red eye slit glowing under the steel-teal helmet with the gold crest, the torn red scarf over his shoulders, the big spiked shoulder plates, and the curved tip of a claw blade held up in front of his shoulder. Image size 256 x 256 px, the character filling the whole square like a close-up (the helmet and eye slit large and clearly readable), same framing as a big character-select bust.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadow, no texture. Do NOT use green anywhere on the character.
```
