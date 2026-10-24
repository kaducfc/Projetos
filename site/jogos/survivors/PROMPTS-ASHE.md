# Ashe: prompts completos para refazer a personagem no padrão do Garen, da Ahri e da Jinx (copie e cole cada bloco inteiro no ChatGPT)

O 1 vai com a imagem do Garen (ou do kit da Ahri) anexada, só para o ChatGPT copiar o estilo e o tamanho do pixel. Nos de A a D, anexe a ficha aprovada da Ashe (`ashe-modelo.png`). Nomes sugeridos: `ashe-modelo.png`, `ashe-kit.png`, `ashe-especiais.png`, `ashe-andando.png`, `ashe-retrato.png`.

## 1. Ficha da personagem (ashe-modelo.png)

```
Create a game character model sheet image.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 28 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Compact proportions, about 3.5 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: ASHE, "the Frost Archer", from League of Legends. Show three views side by side on one canvas: front view, three-quarter right view, and back view (the back view must show the quiver and the cape clearly), all at the same scale, each in its own 512 x 512 px area (total image 1536 x 512 px). Full body, standing in a calm, confident pose, the bow held in her left hand pointing down.

DESIGN DETAILS: fair skin with a cool tint (#F1D9CF, shade #CFA8A8). Long straight white-silver hair (#F4F7FF base, #C9D6F2 shade, #8FA3D6 deep shade) falling over the shoulders to the waist, a side-swept fringe, with two thin ice-blue streaks (#58A8FF). Icy light-blue eyes (#7AD0FF), a calm focused expression, small red tattoo-like face markings under the eyes are NOT needed. Outfit: a hooded cape in blue (#2F62C8 base, #6A98FF light, #1B2D6B dark) with a thick white fur collar and white fur trim, the hood thrown back; a fitted white-and-blue tunic with silver edging and a short pleated skirt; fur-trimmed leather bracers; white thigh-high stockings; white-and-blue boots with fur cuffs; a leather belt with a small pouch; a quiver of arrows with ice-crystal heads on her back. Her signature weapon: a big crystalline ICE BOW, light-blue crystal limbs (#9BE0FF base, #E8FBFF highlight, #3A7FB5 shade) with a silver grip and a glowing white string (hard-edged pixels, no glow haze). Hard-edged pixels everywhere, no other effects.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no shadow, no texture. Do NOT use green anywhere on the character. Do not use a white or checkerboard background.
```

## A. Kit principal (ashe-kit.png, 1536 x 1024: parada, andando, ataque, dano e morte)

```
Create ONE complete sprite sheet image with the full animation kit of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Ashe, the Frost Archer, League of Legends): long white-silver hair with a few ice-blue streaks, icy light-blue eyes, a blue-and-white hooded cape with a white fur collar thrown back, a fitted white and blue archer outfit with fur trim and silver details, leather bracers, a quiver of ice arrows on her back, white-and-blue boots, and her big crystalline ice bow (pale-blue crystal limbs with a silver grip) held in her left hand. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 6 columns x 4 rows of equal 256 x 256 px cells (24 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally in the cell, with her feet touching the same invisible baseline at y = 225 of the cell (lying poses sit on that same baseline). At least 24 px of empty margin around her; nothing crosses the cell borders (hair, cape and bow included).

ROWS (top to bottom):
ROW 1, IDLE loop (6 frames, seamless): calm breathing, chest rises and falls 1 px, the long hair and the cape sway slightly in a cold breeze, the bow tip bobs 1 px, a blink in frame 5, tiny hard-edged snowflake sparkles drifting near the bow. Differences between frames are small.
ROW 2, WALK CYCLE to the right (6 frames, seamless loop): contact, down, passing, contact with the other leg, down, passing. Body bobs 2 px, hair and cape flow backwards, bow held in the left hand.
ROW 3, ATTACK "ICE ARROW" (6 frames): (1) she nocks an ice arrow and starts drawing the string, body turned slightly; (2) the string drawn back to her cheek, aiming right, a glowing ice-blue arrowhead (hard-edged pixels); (3) release: the arrow flies out to the right with a short trail of crisp pixel snowflakes (hard-edged, no blur, no glow); (4) follow-through, string vibrating, hair and cape whipping; (5) recovery, lowering the bow; (6) back to the ready stance. The arrow and sparkles may extend up to 40 px beyond the character but must stay inside the cell.
ROW 4, HURT and DEATH: cells 1 and 2 = HURT (flinches back, eyes squeezed shut, body slightly lighter, hair flying). Cells 3 to 6 = DEATH: staggers, drops the bow, falls to her knees, then onto her side with the cape spread around her, final pose lying flat on the ground (wide pose, still inside its cell), the bow lying next to her.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## B. Especiais (ashe-especiais.png, 1536 x 512: ataque especial, vitória e subir de nível)

```
Create ONE sprite sheet image with the SPECIAL moves of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Ashe, the Frost Archer, League of Legends): long white-silver hair with a few ice-blue streaks, icy light-blue eyes, a blue-and-white hooded cape with a white fur collar thrown back, a fitted white and blue archer outfit with fur trim and silver details, leather bracers, a quiver of ice arrows on her back, white-and-blue boots, and her big crystalline ice bow (pale-blue crystal limbs with a silver grip) held in her left hand. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225 of the cell. At least 24 px of margin; nothing crosses the cell borders.

ROWS:
ROW 1, SPECIAL "FROST NOVA" (6 frames): she plants her bow in front of her and slams a fist on the ground, a ring of sharp ice crystals (white, pale-blue and cyan, hard-edged pixels, no blur, no glow haze) bursts out of the ground in a circle around her, growing frame by frame, peaks in frame 4 with tall jagged crystal spikes, then shatters into small flying shards and fades by frame 6.
ROW 2: cells 1 to 4 = VICTORY (she raises the ice bow to the sky with a proud smile, the cape flapping, a few snowflakes falling, small loop); cells 5 and 6 = LEVEL UP (cell 5: crouch, cell 6: jump up while shooting a glowing ice arrow into the sky).

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## C. Caminhada e corrida com pernas bem marcadas (ashe-andando.png, 1536 x 512)

```
Create ONE sprite sheet image with the WALK and RUN cycles of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Ashe, the Frost Archer, League of Legends): long white-silver hair with a few ice-blue streaks, icy light-blue eyes, a blue-and-white hooded cape with a white fur collar thrown back, a fitted white and blue archer outfit with fur trim and silver details, leather bracers, a quiver of ice arrows on her back, white-and-blue boots, and her big crystalline ice bow (pale-blue crystal limbs with a silver grip) held in her left hand. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

VIEW (important): a three-quarter SIDE view, the character walking toward the RIGHT side of the image, body turned about 60 degrees to the right, so that BOTH LEGS ARE CLEARLY VISIBLE AND SEPARATE at all times and the stride is easy to read (this is NOT a front-facing view). The hair and the cape stay behind her, the bow is held low in front, none of them hides her legs.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, and the lowest foot touches the same invisible baseline at y = 225 of the cell. At least 24 px of empty margin; nothing crosses the cell borders.

ROW 1, WALK CYCLE (6 frames, seamless loop), strongly readable legs, in this order:
(1) CONTACT: front leg extended forward with the heel on the ground, back leg extended behind with the toes on the ground, the stride is WIDE (legs make a clear inverted V); body at its lowest.
(2) RECOIL: weight moves onto the front foot, the back leg starts to lift and bend at the knee.
(3) PASSING: the standing leg is straight under the body, the other leg is bent and swinging forward with the foot clearly lifted off the ground (knee high); body at its highest.
(4) CONTACT with the OTHER leg: mirrored version of frame 1 (the legs have swapped places), wide stride.
(5) RECOIL with the other leg (mirror of frame 2).
(6) PASSING with the other leg (mirror of frame 3).
Add: body bobs 3 px up and down, a graceful stride, the hair and cape flow behind with the steps.

ROW 2, RUN CYCLE (6 frames, seamless loop), same view and same rules, but faster and more dramatic: body leaning forward about 15 degrees, long leaping strides with both feet briefly off the ground in frames 3 and 6, knees lifted high, the long hair and the cape streaming straight behind her, the bow held tight against her side.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## D. Retrato (ashe-retrato.png)

```
Create a character-select portrait icon.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the same chunky pixel size and art style as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: bust portrait of Ashe (League of Legends, "the Frost Archer") for a character-select screen: a tight crop, head and shoulders, three-quarter view facing slightly right, a calm confident look with a faint smile, icy light-blue eyes. Same character exactly as the attached model sheet of ASHE: long white-silver hair with ice-blue streaks, the blue cape with the thick white fur collar, the quiver strap across the chest, and the pale-blue crystal limb of her ice bow held up in front of her shoulder. Image size 256 x 256 px, the character filling the whole square like a close-up (face large and clearly readable), same framing as a big character-select bust.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadow, no texture. Do NOT use green anywhere on the character.
```
