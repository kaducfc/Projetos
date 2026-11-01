# Ahri: prompts completos para refazer a personagem (copie e cole cada bloco inteiro no ChatGPT)

Mesma receita do Garen. O 1 vai com a imagem do Garen anexada (só para o ChatGPT copiar o estilo e o tamanho do pixel). Nos de A a D, anexe a ficha aprovada da Ahri (`ahri-modelo.png`) e, se quiser, o kit do Garen também. Nomes sugeridos: `ahri-modelo.png`, `ahri-kit.png`, `ahri-especiais.png`, `ahri-andando.png`, `ahri-retrato.png`.

## 1. Ficha da personagem (ahri-modelo.png) — anexe o kit ou a ficha do Garen

```
Create a game character model sheet image.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character (Garen). Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 28 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Heroic but compact proportions, about 3 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: AHRI, "the Nine-Tailed Fox", from League of Legends. Show three views side by side on one canvas: front view, three-quarter right view, and back view (the back view must show all nine tails clearly), all at the same scale, each in its own 512 x 512 px area (total image 1536 x 512 px). Full body, standing in a graceful, playful pose, one hand slightly raised.

DESIGN DETAILS: fair skin (#F3CDA6, shade #D9A47C). Long black hair with a dark blue sheen (#2A2438 base, #4A4466 light, #14101E shadow) falling down her back to the waist, a few long front locks. Two large fox ears on top of the head: black on the outside (same as the hair), pale pink-white inside (#FFD9E8). Big amber-gold eyes (#F5B82E), a calm confident smile, three thin dark whisker marks on each cheek. A gold choker (#F5C82E, #B8860B) with a pink teardrop gem (#E85A9A). Gold earrings. Outfit: a short sleeveless dress in white and lavender (#F2EEFF base, #B9A8E8 shade, #8F7AD0 deep shade) with pink (#E85A9A) and gold trim, a pale-pink sash at the waist, a pointed hem; detached white sleeves with lavender cuffs and gold bracelets; white-and-lavender knee-high boots with gold trim. NINE fluffy fox tails fanned out behind her, white (#FFFFFF base, #DCD3F5 shade) with pink-violet tips (#E85A9A, #B45CFF). In her right hand a small glowing blue-violet orb (#58A8FF core, #B45CFF edge, hard-edged pixels, no glow haze) floating above the palm. No other effects.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no shadow, no texture. Do NOT use green anywhere on the character. Do not use a white or checkerboard background.
```

## A. Kit principal (ahri-kit.png, 1536 x 1024: parada, andando, ataque, dano e morte)

```
Create ONE complete sprite sheet image with the full animation kit of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Ahri, the Nine-Tailed Fox, League of Legends): long black hair, two fox ears, amber eyes, three whisker marks on each cheek, gold choker with a pink gem, white and lavender short dress with pink and gold trim, detached white sleeves with lavender cuffs, nine fluffy white tails with pink tips. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 6 columns x 4 rows of equal 256 x 256 px cells (24 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally in the cell, with her feet touching the same invisible baseline at y = 225 of the cell (lying poses sit on that same baseline). At least 24 px of empty margin around her; nothing crosses the cell borders (tails included).

ROWS (top to bottom):
ROW 1, IDLE loop (6 frames, seamless): graceful breathing, chest rises and falls 1 px, the nine tails sway slowly from side to side, the fox ears twitch in frame 3, hair locks sway slightly, a blink in frame 5, the small orb floats above her palm and bobs 1 px. Differences between frames are small.
ROW 2, WALK CYCLE to the right (6 frames, seamless loop): contact, down, passing, contact with the other leg, down, passing. Body bobs 2 px, tails sway and trail behind, hair flows backwards.
ROW 3, ATTACK "ORB OF DECEPTION" (6 frames): (1) anticipation, body twisted, hand pulled back holding a growing blue-violet orb; (2) arm swinging forward; (3) the orb leaves her hand toward the right with a short trail of crisp pixel sparkles (hard-edged pixels, no blur, no glow); (4) follow-through, hand extended to the right, tails flaring; (5) recovery; (6) back to the ready stance. The orb and sparkles may extend up to 40 px beyond the character but must stay inside the cell.
ROW 4, HURT and DEATH: cells 1 and 2 = HURT (flinches back, eyes squeezed shut, ears flat, body slightly lighter). Cells 3 to 6 = DEATH: staggers, drops to her knees, falls to the side with the tails curling around her, final pose lying flat on the ground (wide pose, still inside its cell), orb gone.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## B. Especiais (ahri-especiais.png, 1536 x 512: ataque especial, vitória e subir de nível)

```
Create ONE sprite sheet image with the SPECIAL moves of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Ahri, the Nine-Tailed Fox, League of Legends): long black hair, two fox ears, amber eyes, three whisker marks on each cheek, gold choker with a pink gem, white and lavender short dress with pink and gold trim, detached white sleeves with lavender cuffs, nine fluffy white tails with pink tips. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225 of the cell. At least 24 px of margin; nothing crosses the cell borders.

ROWS:
ROW 1, SPECIAL "FOX-FIRE BURST" (6 frames): she twirls with her arms open and all nine tails fanned out wide, a ring of pink and violet fox-fire flames (hard-edged pixels, no blur, no glow haze) grows around her frame by frame, peaks in frame 4, then fades by frame 6.
ROW 2: cells 1 to 4 = VICTORY (a playful wink, tosses the orb up and catches it, tails swishing, small happy loop); cells 5 and 6 = LEVEL UP (cell 5: crouch, cell 6: jump up with a twirl and all tails raised).

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## C. Caminhada e corrida com pernas bem marcadas (ahri-andando.png, 1536 x 512)

```
Create ONE sprite sheet image with the WALK and RUN cycles of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Ahri, the Nine-Tailed Fox, League of Legends): long black hair, two fox ears, amber eyes, three whisker marks on each cheek, gold choker with a pink gem, white and lavender short dress with pink and gold trim, detached white sleeves with lavender cuffs, nine fluffy white tails with pink tips. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

VIEW (important): a three-quarter SIDE view, the character walking toward the RIGHT side of the image, body turned about 60 degrees to the right, so that BOTH LEGS ARE CLEARLY VISIBLE AND SEPARATE at all times and the stride is easy to read (this is NOT a front-facing view). The tails stay behind her and must not hide her legs.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, and the lowest foot touches the same invisible baseline at y = 225 of the cell. At least 24 px of empty margin; nothing crosses the cell borders.

ROW 1, WALK CYCLE (6 frames, seamless loop), strongly readable legs, in this order:
(1) CONTACT: front leg extended forward with the heel on the ground, back leg extended behind with the toes on the ground, the stride is WIDE (legs make a clear inverted V); body at its lowest.
(2) RECOIL: weight moves onto the front foot, the back leg starts to lift and bend at the knee.
(3) PASSING: the standing leg is straight under the body, the other leg is bent and swinging forward with the foot clearly lifted off the ground (knee high); body at its highest.
(4) CONTACT with the OTHER leg: mirrored version of frame 1 (the legs have swapped places), wide stride.
(5) RECOIL with the other leg (mirror of frame 2).
(6) PASSING with the other leg (mirror of frame 3).
Add: body bobs 3 px up and down, arms swing with the steps, the tails sway behind and the hair flows backwards.

ROW 2, RUN CYCLE (6 frames, seamless loop), same view and same rules, but faster and more dramatic: body leaning forward about 15 degrees, long leaping strides with both feet briefly off the ground in frames 3 and 6, knees lifted high, the nine tails streaming straight behind her, hair and sash flowing backwards, the orb floating next to her hand.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## D. Retrato (ahri-retrato.png)

```
Create a character-select portrait icon.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the same chunky pixel size and art style as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: bust portrait of Ahri (League of Legends) for a character-select screen: head and shoulders, three-quarter view facing slightly right, confident playful smile, ears up. Same character exactly as the attached model sheet of AHRI. Image size 256 x 256 px, the character filling about 90% of the square, a couple of the fluffy tails visible behind her shoulder.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadow, no texture. Do NOT use green anywhere on the character.
```

## E. TODOS os movimentos em UMA imagem (ahri-completo.png, 1536 x 1792)

Anexe a ficha aprovada da Ahri. São 42 quadros: parada, andando, correndo, ataque, dano, morte, especial, vitória e subir de nível. Se o ChatGPT não conseguir manter tudo consistente numa imagem só, use os blocos A, B e C acima, que dividem a mesma coisa em 3 imagens.

```
Create ONE single sprite sheet image with ALL the animations of this character (every movement in one image).

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Ahri, the Nine-Tailed Fox, League of Legends): long black hair, two fox ears, amber eyes, three whisker marks on each cheek, gold choker with a pink gem, white and lavender short dress with pink and gold trim and a pink sash, detached white sleeves with lavender cuffs, white-and-lavender knee-high boots, nine fluffy white tails with pink tips, a small glowing blue-violet orb in her right hand. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 1792 px, divided into an invisible grid of 6 columns x 7 rows of equal 256 x 256 px cells (42 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally in the cell, with her feet touching the same invisible baseline at y = 225 of the cell (lying poses sit on that same baseline). At least 24 px of empty margin around her; nothing crosses the cell borders (tails and effects included). Every frame inside a row keeps the same scale and the same ground position.

ROWS (top to bottom):
ROW 1, IDLE loop (6 frames, seamless): graceful breathing, chest rises and falls 1 px, the nine tails sway slowly from side to side, the fox ears twitch in frame 3, hair locks sway slightly, a blink in frame 5, the orb floats above her palm and bobs 1 px. Differences between frames are small.
ROW 2, WALK CYCLE (6 frames, seamless loop), THREE-QUARTER SIDE VIEW walking to the RIGHT, body turned about 60 degrees, BOTH LEGS CLEARLY VISIBLE AND SEPARATE at all times, the tails stay behind her and never hide her legs. Frames in order: (1) CONTACT: front leg extended forward with the heel on the ground, back leg extended behind with the toes on the ground, WIDE stride (clear inverted V), body lowest; (2) RECOIL: weight onto the front foot, the back leg starts to lift and bend; (3) PASSING: standing leg straight under the body, the other leg bent and swinging forward with the foot lifted (knee high), body highest; (4) CONTACT with the OTHER leg (mirror of frame 1, legs swapped); (5) RECOIL with the other leg; (6) PASSING with the other leg. Body bobs 3 px, arms swing, tails sway behind, hair flows backwards.
ROW 3, RUN CYCLE (6 frames, seamless loop), same side view and rules as the walk but faster and more dramatic: body leaning forward about 15 degrees, long leaping strides with both feet briefly off the ground in frames 3 and 6, knees lifted high, the nine tails streaming straight behind her, hair and sash flowing backwards, the orb floating next to her hand.
ROW 4, ATTACK "ORB OF DECEPTION" (6 frames): (1) anticipation, body twisted, hand pulled back holding a growing blue-violet orb; (2) arm swinging forward; (3) the orb leaves her hand toward the right with a short trail of crisp pixel sparkles (hard-edged pixels, no blur, no glow); (4) follow-through, hand extended to the right, tails flaring; (5) recovery; (6) back to the ready stance. The orb and sparkles may extend up to 40 px beyond the character but stay inside the cell.
ROW 5, HURT and DEATH: cells 1 and 2 = HURT (flinches back, eyes squeezed shut, ears flat, body slightly lighter). Cells 3 to 6 = DEATH: staggers, drops to her knees, falls to the side with the tails curling around her, final pose lying flat on the ground (wide pose, still inside its cell), orb gone.
ROW 6, SPECIAL "FOX-FIRE BURST" (6 frames): she twirls with her arms open and all nine tails fanned out wide, a ring of pink and violet fox-fire flames (hard-edged pixels, no blur, no glow haze) grows around her frame by frame, peaks in frame 4, then fades by frame 6.
ROW 7, VICTORY and LEVEL UP: cells 1 to 4 = VICTORY (a playful wink, tosses the orb up and catches it, tails swishing, small happy loop); cells 5 and 6 = LEVEL UP (cell 5: crouch, cell 6: jump up with a twirl and all tails raised).

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```
