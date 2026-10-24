# Jinx: prompts completos para refazer a personagem no padrão do Garen e da Ahri (copie e cole cada bloco inteiro no ChatGPT)

O 1 vai com a imagem do Garen (ou do kit da Ahri) anexada, só para o ChatGPT copiar o estilo e o tamanho do pixel. Nos de A a D, anexe a ficha aprovada da Jinx (`jinx-modelo.png`). Nomes sugeridos: `jinx-modelo.png`, `jinx-kit.png`, `jinx-especiais.png`, `jinx-andando.png`, `jinx-retrato.png`.

## 1. Ficha da personagem (jinx-modelo.png)

```
Create a game character model sheet image.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 28 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Compact, expressive proportions, about 3.5 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: JINX, "the Loose Cannon", from League of Legends. Show three views side by side on one canvas: front view, three-quarter right view, and back view (the back view must show both long braids clearly), all at the same scale, each in its own 512 x 512 px area (total image 1536 x 512 px). Full body, standing in a cocky, bouncy pose.

DESIGN DETAILS: fair pale skin (#F6D8C4, shade #D9A89A). TWO extremely long bright cyan-blue braids (#58D8F8 base, #8FEAFF light, #2A8FC0 shadow) hanging down past her knees, tied with pink bands, with a short messy fringe. Big pink eyes (#FF4FA3), a wild crooked grin with a tiny fang, dark eye-liner. Pink tattoos on both arms (small stars, clouds, circles, #FF4FA3). A dark charcoal crop top (#3A3445) with pink straps and an ammo bandolier of golden bullets across the chest; dark charcoal shorts with pink stripes and a belt; mismatched stockings: one leg with pink and black stripes, the other leg dark with a pink band; black boots with pink laces and soles; one fingerless glove and one dark wrist guard. She holds in both hands the huge minigun POW-POW: a grey-steel barrel cluster (#9AA3B5 base, #E4EBF7 light, #5A6278 dark) with pink details (#FF4FA3), a pink drum magazine, and a cartoon shark-tooth decoration on the front. Hard-edged pixels everywhere, no glow, no effects.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no shadow, no texture. Do NOT use green anywhere on the character. Do not use a white or checkerboard background.
```

## A. Kit principal (jinx-kit.png, 1536 x 1024: parada, andando, ataque, dano e morte)

```
Create ONE complete sprite sheet image with the full animation kit of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Jinx, the Loose Cannon, League of Legends): two very long bright cyan-blue braids, pink eyes, a mischievous grin, pink tattoos on the arms, a dark crop top with pink straps and an ammo bandolier across the chest, dark shorts with pink details, mismatched striped stockings, black boots with pink details, fingerless gloves, and the big grey-and-pink minigun Pow-Pow held in both hands. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 6 columns x 4 rows of equal 256 x 256 px cells (24 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally in the cell, with her feet touching the same invisible baseline at y = 225 of the cell (lying poses sit on that same baseline). At least 24 px of empty margin around her; nothing crosses the cell borders (braids and gun included).

ROWS (top to bottom):
ROW 1, IDLE loop (6 frames, seamless): a bouncy idle, she shifts her weight from foot to foot, the two braids sway, the minigun bobs and its barrels rotate a quarter turn between frames, a blink in frame 5, a cocky grin in frame 3. Differences between frames are small.
ROW 2, WALK CYCLE to the right (6 frames, seamless loop): contact, down, passing, contact with the other leg, down, passing. Body bobs 2 px, braids swing and trail behind, minigun held across her body.
ROW 3, ATTACK "POW-POW FIRE" (6 frames): (1) she raises the minigun and aims to the right; (2) the first burst: crisp hard-edged yellow and orange muzzle flash at the barrels, body recoils back 2 px; (3) the second burst with a trail of golden bullet dashes flying to the right (hard-edged pixels, no blur, no glow); (4) the third burst, braids whipping from the recoil; (5) the barrels spin down with a small puff of hard-edged grey smoke; (6) back to the ready stance. The muzzle flash and bullet dashes may extend up to 40 px beyond the character but stay inside the cell.
ROW 4, HURT and DEATH: cells 1 and 2 = HURT (flinches back, eyes squeezed shut, body slightly lighter, braids flying). Cells 3 to 6 = DEATH: staggers, drops the minigun, falls onto her back with the braids spread around her, final pose lying flat on the ground (wide pose, still inside its cell), eyes as little X marks.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## B. Especiais (jinx-especiais.png, 1536 x 512: ataque especial, vitória e subir de nível)

```
Create ONE sprite sheet image with the SPECIAL moves of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Jinx, the Loose Cannon, League of Legends): two very long bright cyan-blue braids, pink eyes, a mischievous grin, pink tattoos on the arms, a dark crop top with pink straps and an ammo bandolier across the chest, dark shorts with pink details, mismatched striped stockings, black boots with pink details, fingerless gloves, and the big grey-and-pink minigun Pow-Pow held in both hands. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225 of the cell. At least 24 px of margin; nothing crosses the cell borders.

ROWS:
ROW 1, SPECIAL "CHOMPER GRENADE RING" (6 frames): she slams the minigun on her shoulder and throws a handful of little round pink-and-cyan grenades (cartoon shark-mouth chompers) in a circle around her while laughing; in frames 2 to 4 a ring of hard-edged explosions grows around her frame by frame (orange, yellow and pink pixel bursts with a few cyan sparks, no blur, no glow haze), peaks in frame 4, then fades by frame 6.
ROW 2: cells 1 to 4 = VICTORY (a mad laugh, twirls the minigun on one finger and poses with a peace sign, braids swinging, small happy loop); cells 5 and 6 = LEVEL UP (cell 5: crouch, cell 6: jump up firing the minigun into the air with a bright hard-edged muzzle flash).

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## C. Caminhada e corrida com pernas bem marcadas (jinx-andando.png, 1536 x 512)

```
Create ONE sprite sheet image with the WALK and RUN cycles of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Jinx, the Loose Cannon, League of Legends): two very long bright cyan-blue braids, pink eyes, a mischievous grin, pink tattoos on the arms, a dark crop top with pink straps and an ammo bandolier across the chest, dark shorts with pink details, mismatched striped stockings, black boots with pink details, fingerless gloves, and the big grey-and-pink minigun Pow-Pow held in both hands. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

VIEW (important): a three-quarter SIDE view, the character walking toward the RIGHT side of the image, body turned about 60 degrees to the right, so that BOTH LEGS ARE CLEARLY VISIBLE AND SEPARATE at all times and the stride is easy to read (this is NOT a front-facing view). The braids stay behind her and the minigun is held in front, neither hides her legs.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, and the lowest foot touches the same invisible baseline at y = 225 of the cell. At least 24 px of empty margin; nothing crosses the cell borders.

ROW 1, WALK CYCLE (6 frames, seamless loop), strongly readable legs, in this order:
(1) CONTACT: front leg extended forward with the heel on the ground, back leg extended behind with the toes on the ground, the stride is WIDE (legs make a clear inverted V); body at its lowest.
(2) RECOIL: weight moves onto the front foot, the back leg starts to lift and bend at the knee.
(3) PASSING: the standing leg is straight under the body, the other leg is bent and swinging forward with the foot clearly lifted off the ground (knee high); body at its highest.
(4) CONTACT with the OTHER leg: mirrored version of frame 1 (the legs have swapped places), wide stride.
(5) RECOIL with the other leg (mirror of frame 2).
(6) PASSING with the other leg (mirror of frame 3).
Add: body bobs 3 px up and down, a cocky swagger, the braids swing behind with the steps.

ROW 2, RUN CYCLE (6 frames, seamless loop), same view and same rules, but faster and more dramatic: body leaning forward about 15 degrees, long leaping strides with both feet briefly off the ground in frames 3 and 6, knees lifted high, the two braids streaming straight behind her, the minigun held tight against her side.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## D. Retrato (jinx-retrato.png)

```
Create a character-select portrait icon.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the same chunky pixel size and art style as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: bust portrait of Jinx (League of Legends, "the Loose Cannon") for a character-select screen: a tight crop, head and shoulders, three-quarter view facing slightly right, a wild crooked grin with a tiny fang, pink eyes. Same character exactly as the attached model sheet of JINX: bright cyan-blue braids falling over both shoulders, pink arm tattoos, the dark crop top with the golden ammo bandolier, and the barrels of the minigun Pow-Pow resting on her shoulder. Image size 256 x 256 px, the character filling the whole square like a close-up (face large and clearly readable), same framing as a big character-select bust.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadow, no texture. Do NOT use green anywhere on the character.
```
