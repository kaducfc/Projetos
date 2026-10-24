# Zed: prompts completos para refazer a personagem no padrão do Garen, da Ahri, da Jinx, da Ashe e da Lux (copie e cole cada bloco inteiro no ChatGPT)

O 1 vai com a imagem do Garen (ou do kit da Ahri) anexada, só para o ChatGPT copiar o estilo e o tamanho do pixel. Nos de A a D, anexe a ficha aprovada da Zed (`zed-modelo.png`). Nomes sugeridos: `zed-modelo.png`, `zed-kit.png`, `zed-especiais.png`, `zed-andando.png`, `zed-retrato.png`.

## 1. Ficha da personagem (zed-modelo.png)

```
Create a game character model sheet image.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 28 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Compact proportions, about 3.5 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: ZED, "the Master of Shadows", from League of Legends. Show three views side by side on one canvas: front view, three-quarter right view, and back view (the back view must show the spiky ponytail, the scarf and the sheathed look of the shoulder armor clearly), all at the same scale, each in its own 512 x 512 px area (total image 1536 x 512 px). Full body, standing in a low, ready ninja stance, a blade in each hand held down and back.

DESIGN DETAILS: pale skin only visible on the jaw, neck and hands (#E8CDB8, shade #B98F86). Spiky black hair (#1C1826 base, #3A3350 light) pulled into a short spiky ponytail with a few loose spikes at the front. A silver-grey metal half-mask (#9AA3B5 base, #E4EBF7 light, #5A6278 dark) covering the nose and eyes, with a narrow glowing red visor slit (#FF3A4A), hard-edged pixels, no glow haze. A black-and-dark-purple ninja outfit (#14101E, #2A2040, #4A3366) with a high collar, a dark hooded scarf around the neck, red-violet trim (#C0283A and #7A2A9A), a red belt sash with a metal buckle, dark-steel armored shoulder guards and bracers, fingerless dark gloves, black boots with purple trim. Two curved dark-steel blades (shuriken-style kama blades) with silver edges and red-violet glowing edge lines, one in each hand. A faint hard-edged dark-purple shadow wisp curling at his feet. Hard-edged pixels everywhere, no othis effects.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no shadow, no texture. Do NOT use green anywhere on the character. Do not use a white or checkerboard background.
```

## A. Kit principal (zed-kit.png, 1536 x 1024: parada, andando, ataque, dano e morte)

```
Create ONE complete sprite sheet image with the full animation kit of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Zed, the Master of Shadows, League of Legends): spiky black hair tied back, a black-and-dark-purple ninja outfit with a high collar and red-violet trim, a silver-grey metal half-mask with a glowing red visor slit covering his eyes and nose, a dark hooded scarf, armored bracers and shoulder guards in dark steel, a red belt sash, black boots with purple trim, and two curved dark-steel blades with red-violet edges (one in each hand), a faint dark-purple shadow wisp at his feet. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 6 columns x 4 rows of equal 256 x 256 px cells (24 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally in the cell, with his feet touching the same invisible baseline at y = 225 of the cell (lying poses sit on that same baseline). At least 24 px of empty margin around him; nothing crosses the cell borders (scarf, ponytail and blades included).

ROWS (top to bottom):
ROW 1, IDLE loop (6 frames, seamless): a tense ready stance, breathing 1 px, the scarf and the spiky ponytail sway slightly, the blades twitch 1 px and their edges pulse a little brighter in frame 3, the shadow wisp at his feet curls, a flicker of the red visor in frame 5. Differences between frames are small.
ROW 2, WALK CYCLE to the right (6 frames, seamless loop): contact, down, passing, contact with the othis leg, down, passing. Body bobs 2 px, scarf and ponytail flow backwards, blades held low.
ROW 3, ATTACK "RAZOR SHURIKEN" (6 frames): (1) he crouches and pulls both blades back, body twisted, red visor glowing brighter; (2) a fast spin on one foot with the blades out; (3) release: he throws a spinning dark-violet shuriken to the right with a short trail of crisp red-violet sparks (hard-edged pixels, no blur, no glow); (4) follow-through, arm extended to the right, scarf and ponytail whipping; (5) recovery, blades back in his hands; (6) back to the ready stance. The shuriken and sparks may extend up to 40 px beyond the character but must stay inside the cell.
ROW 4, HURT and DEATH: cells 1 and 2 = HURT (flinches back, body slightly lighter, scarf flying). Cells 3 to 6 = DEATH: staggers, drops the blades, falls to his knees, then onto his side with the scarf spread around him and the shadow wisp fading, final pose lying flat on the ground (wide pose, still inside its cell), the blades lying next to him.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## B. Especiais (zed-especiais.png, 1536 x 512: ataque especial, vitória e subir de nível)

```
Create ONE sprite sheet image with the SPECIAL moves of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Zed, the Master of Shadows, League of Legends): spiky black hair tied back, a black-and-dark-purple ninja outfit with a high collar and red-violet trim, a silver-grey metal half-mask with a glowing red visor slit covering his eyes and nose, a dark hooded scarf, armored bracers and shoulder guards in dark steel, a red belt sash, black boots with purple trim, and two curved dark-steel blades with red-violet edges (one in each hand), a faint dark-purple shadow wisp at his feet. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225 of the cell. At least 24 px of margin; nothing crosses the cell borders.

ROWS:
ROW 1, SPECIAL "DEATH MARK SHADOW SLASH" (6 frames): he crosses both blades in front of him, then spins fast with the blades out; a ring of dark-purple and red-violet slashes and shadow wisps (hard-edged pixels, no blur, no glow haze) bursts outward in a circle around him, growing frame by frame, peaks in frame 4 with long curved crescent slashes in all directions, then breaks into small floating shadow shards and fades by frame 6.
ROW 2: cells 1 to 4 = VICTORY (he spins both blades, sheathes them with a smooth flick and crosses his arms, scarf swaying, a few shadow wisps around, small loop); cells 5 and 6 = LEVEL UP (cell 5: crouch with the blades crossed, cell 6: jump up in a flip with both blades raised, a red-violet slash arc under him).

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## C. Caminhada e corrida com pernas bem marcadas (zed-andando.png, 1536 x 512)

```
Create ONE sprite sheet image with the WALK and RUN cycles of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Zed, the Master of Shadows, League of Legends): spiky black hair tied back, a black-and-dark-purple ninja outfit with a high collar and red-violet trim, a silver-grey metal half-mask with a glowing red visor slit covering his eyes and nose, a dark hooded scarf, armored bracers and shoulder guards in dark steel, a red belt sash, black boots with purple trim, and two curved dark-steel blades with red-violet edges (one in each hand), a faint dark-purple shadow wisp at his feet. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

VIEW (important): a three-quarter SIDE view, the character walking toward the RIGHT side of the image, body turned about 60 degrees to the right, so that BOTH LEGS ARE CLEARLY VISIBLE AND SEPARATE at all times and the stride is easy to read (this is NOT a front-facing view). The scarf and ponytail stay behind him and the blades are held low and back, neither hides his legs.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, and the lowest foot touches the same invisible baseline at y = 225 of the cell. At least 24 px of empty margin; nothing crosses the cell borders.

ROW 1, WALK CYCLE (6 frames, seamless loop), strongly readable legs, in this order:
(1) CONTACT: front leg extended forward with the heel on the ground, back leg extended behind with the toes on the ground, the stride is WIDE (legs make a clear inverted V); body at its lowest.
(2) RECOIL: weight moves onto the front foot, the back leg starts to lift and bend at the knee.
(3) PASSING: the standing leg is straight under the body, the othis leg is bent and swinging forward with the foot clearly lifted off the ground (knee high); body at its highest.
(4) CONTACT with the OTHER leg: mirrored version of frame 1 (the legs have swapped places), wide stride.
(5) RECOIL with the othis leg (mirror of frame 2).
(6) PASSING with the othis leg (mirror of frame 3).
Add: body bobs 3 px up and down, a quick stealthy stride, the scarf and ponytail flow behind with the steps.

ROW 2, RUN CYCLE (6 frames, seamless loop), same view and same rules, but faster and more dramatic: body leaning forward about 15 degrees, long leaping strides with both feet briefly off the ground in frames 3 and 6, knees lifted high, the scarf and ponytail streaming straight behind him, the blades held tight against his sides.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## D. Retrato (zed-retrato.png)

```
Create a character-select portrait icon.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the same chunky pixel size and art style as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: bust portrait of Zed (League of Legends, "the Master of Shadows") for a character-select screen: a tight crop, head and shoulders, three-quarter view facing slightly right, a cold menacing look, the red visor slit glowing in the silver mask. Same character exactly as the attached model sheet of ZED: spiky black hair and ponytail, the silver-grey half-mask with the red visor, the dark hooded scarf, the dark-steel shoulder guard, and the curved edge of a red-violet blade held up in front of his shoulder. Image size 256 x 256 px, the character filling the whole square like a close-up (face large and clearly readable), same framing as a big character-select bust.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadow, no texture. Do NOT use green anywhere on the character.
```
