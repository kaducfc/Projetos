# Lux: prompts completos para refazer a personagem no padrão do Garen, da Ahri, da Jinx e da Ashe (copie e cole cada bloco inteiro no ChatGPT)

O 1 vai com a imagem do Garen (ou do kit da Ahri) anexada, só para o ChatGPT copiar o estilo e o tamanho do pixel. Nos de A a D, anexe a ficha aprovada da Lux (`lux-modelo.png`). Nomes sugeridos: `lux-modelo.png`, `lux-kit.png`, `lux-especiais.png`, `lux-andando.png`, `lux-retrato.png`.

## 1. Ficha da personagem (lux-modelo.png)

```
Create a game character model sheet image.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the SAME chunky pixel size and the same art style as the attached reference character. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette (about 28 colors), 3 to 4 tones per material (shadow, base, light, highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front and a little of the top of the head, character faces slightly to the RIGHT. Compact proportions, about 3.5 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the League of Legends champion design identity (silhouette, colors, signature items). No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: LUX, "the Lady of Luminosity", from League of Legends. Show three views side by side on one canvas: front view, three-quarter right view, and back view (the back view must show the ponytail, the tabard and the golden wings of the headpiece clearly), all at the same scale, each in its own 512 x 512 px area (total image 1536 x 512 px). Full body, standing in a cheerful, confident pose, the staff held in her right hand pointing up.

DESIGN DETAILS: fair skin (#F6DCC8, shade #D9A89A). Long golden-blonde hair (#F7D45A base, #FFEFA0 light, #C99A2A shade) in a high ponytail falling to the waist, with two long wavy locks framing the face and a side-swept fringe. Bright blue eyes (#58A8FF), a cheerful confident smile. A gold winged headpiece (#F5C82E, #B8860B) with a small blue gem. Outfit: a white and silver Demacian mage dress with royal-blue (#2F62C8 base, #6A98FF light, #1B2D6B dark) lining and panels, gold trim and a short pleated skirt, a blue-and-white tabard hanging in front with a simplified golden winged-shield crest, white detached sleeves with gold cuffs, a golden shoulder piece, white-and-gold knee-high boots. Her signature weapon: an ornate golden-and-white light STAFF taller than her, with a winged gold top holding a glowing white-yellow crystal core (hard-edged pixels, no glow haze). Hard-edged pixels everywhere, no other effects.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no shadow, no texture. Do NOT use green anywhere on the character. Do not use a white or checkerboard background.
```

## A. Kit principal (lux-kit.png, 1536 x 1024: parada, andando, ataque, dano e morte)

```
Create ONE complete sprite sheet image with the full animation kit of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Lux, the Lady of Luminosity, League of Legends): long golden-blonde hair in a high ponytail with two long wavy side locks, bright blue eyes, a cheerful confident smile, a white-silver-and-gold Demacian mage outfit with a royal-blue lining and golden trim, a winged tiara-like gold headpiece, a short skirt with a blue-and-white tabard, gold-trimmed white boots, and her ornate golden-and-white light staff with a glowing white crystal core held in her right hand. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 1024 px, divided into an invisible grid of 6 columns x 4 rows of equal 256 x 256 px cells (24 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally in the cell, with her feet touching the same invisible baseline at y = 225 of the cell (lying poses sit on that same baseline). At least 24 px of empty margin around her; nothing crosses the cell borders (ponytail, tabard and staff included).

ROWS (top to bottom):
ROW 1, IDLE loop (6 frames, seamless): cheerful breathing, chest rises and falls 1 px, the ponytail and the tabard sway slightly, the staff tip bobs 1 px and the crystal pulses a little brighter in frame 3, a blink in frame 5, tiny hard-edged golden sparkles drifting near the staff. Differences between frames are small.
ROW 2, WALK CYCLE to the right (6 frames, seamless loop): contact, down, passing, contact with the other leg, down, passing. Body bobs 2 px, ponytail and tabard flow backwards, staff held in the right hand.
ROW 3, ATTACK "LIGHT BOLT" (6 frames): (1) she raises the staff and gathers a small white-yellow light orb at its tip, body turned slightly; (2) the orb grows, arm pulled back; (3) release: a bright bolt of light shoots out to the right from the staff tip with a short trail of crisp yellow-white sparkles (hard-edged pixels, no blur, no glow); (4) follow-through, staff pointing right, hair and ponytail whipping; (5) recovery, lowering the staff; (6) back to the ready stance. The bolt and sparkles may extend up to 40 px beyond the character but must stay inside the cell.
ROW 4, HURT and DEATH: cells 1 and 2 = HURT (flinches back, eyes squeezed shut, body slightly lighter, ponytail flying). Cells 3 to 6 = DEATH: staggers, drops the staff, falls to her knees, then onto her side with the ponytail and tabard spread around her, final pose lying flat on the ground (wide pose, still inside its cell), the staff lying next to her.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## B. Especiais (lux-especiais.png, 1536 x 512: ataque especial, vitória e subir de nível)

```
Create ONE sprite sheet image with the SPECIAL moves of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. Three-quarter top-down view (like Vampire Survivors), character faces to the RIGHT in every frame. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Lux, the Lady of Luminosity, League of Legends): long golden-blonde hair in a high ponytail with two long wavy side locks, bright blue eyes, a cheerful confident smile, a white-silver-and-gold Demacian mage outfit with a royal-blue lining and golden trim, a winged tiara-like gold headpiece, a short skirt with a blue-and-white tabard, gold-trimmed white boots, and her ornate golden-and-white light staff with a glowing white crystal core held in her right hand. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225 of the cell. At least 24 px of margin; nothing crosses the cell borders.

ROWS:
ROW 1, SPECIAL "FINAL SPARK BURST" (6 frames): she raises the staff above her head with both hands, a ring of golden-white light rays and sparkles (hard-edged pixels, no blur, no glow haze) bursts outward in a circle around her, growing frame by frame, peaks in frame 4 with long pointed rays of light in all directions around her, then breaks into small floating sparkles and fades by frame 6.
ROW 2: cells 1 to 4 = VICTORY (she twirls the staff and strikes a cheerful pose with a wink and a peace sign, ponytail swinging, golden sparkles around, small loop); cells 5 and 6 = LEVEL UP (cell 5: crouch, cell 6: jump up with the staff raised, shooting a bright light bolt into the sky).

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## C. Caminhada e corrida com pernas bem marcadas (lux-andando.png, 1536 x 512)

```
Create ONE sprite sheet image with the WALK and RUN cycles of this character.

Pixel art game sprite sheet, 32-bit era, clean hand-placed pixels, crisp hard edges, same chunky pixel size as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze around the sprite. Strong dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No text, no labels, no numbers, no frames, no UI, no watermark, no ground shadow.

CHARACTER: use EXACTLY the character from the attached model sheet (Lux, the Lady of Luminosity, League of Legends): long golden-blonde hair in a high ponytail with two long wavy side locks, bright blue eyes, a cheerful confident smile, a white-silver-and-gold Demacian mage outfit with a royal-blue lining and golden trim, a winged tiara-like gold headpiece, a short skirt with a blue-and-white tabard, gold-trimmed white boots, and her ornate golden-and-white light staff with a glowing white crystal core held in her right hand. Same colors, same proportions and same pixel size in every frame. Do not redesign anything.

VIEW (important): a three-quarter SIDE view, the character walking toward the RIGHT side of the image, body turned about 60 degrees to the right, so that BOTH LEGS ARE CLEARLY VISIBLE AND SEPARATE at all times and the stride is easy to read (this is NOT a front-facing view). The ponytail stays behind her and the staff is held low in front, neither hides her legs.

GRID: image size 1536 x 512 px, divided into an invisible grid of 6 columns x 2 rows of equal 256 x 256 px cells (12 cells), no lines between cells. In EVERY cell the character is the same size (about 170 px tall), centered horizontally, and the lowest foot touches the same invisible baseline at y = 225 of the cell. At least 24 px of empty margin; nothing crosses the cell borders.

ROW 1, WALK CYCLE (6 frames, seamless loop), strongly readable legs, in this order:
(1) CONTACT: front leg extended forward with the heel on the ground, back leg extended behind with the toes on the ground, the stride is WIDE (legs make a clear inverted V); body at its lowest.
(2) RECOIL: weight moves onto the front foot, the back leg starts to lift and bend at the knee.
(3) PASSING: the standing leg is straight under the body, the other leg is bent and swinging forward with the foot clearly lifted off the ground (knee high); body at its highest.
(4) CONTACT with the OTHER leg: mirrored version of frame 1 (the legs have swapped places), wide stride.
(5) RECOIL with the other leg (mirror of frame 2).
(6) PASSING with the other leg (mirror of frame 3).
Add: body bobs 3 px up and down, a lively bouncy stride, the ponytail flows behind with the steps.

ROW 2, RUN CYCLE (6 frames, seamless loop), same view and same rules, but faster and more dramatic: body leaning forward about 15 degrees, long leaping strides with both feet briefly off the ground in frames 3 and 6, knees lifted high, the ponytail and tabard streaming straight behind her, the staff held tight against her side.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key) in the whole image, no gradient, no texture, no shadows, no lighting variation. Do NOT use green anywhere on the character or effects. Do not use a white or checkerboard background.
```

## D. Retrato (lux-retrato.png)

```
Create a character-select portrait icon.

Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges, the same chunky pixel size and art style as the attached reference. Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise, NO haze. Strong 1-pixel dark outline (#14101E) around the whole character. Limited palette, 3 to 4 tones per material, light from the top-left. No ground shadow, no text, no labels, no frames, no UI, no watermark.

SUBJECT: bust portrait of Lux (League of Legends, "the Lady of Luminosity") for a character-select screen: a tight crop, head and shoulders, three-quarter view facing slightly right, a bright cheerful smile with a wink-like sparkle in the eye, bright blue eyes. Same character exactly as the attached model sheet of LUX: golden-blonde ponytail and side locks, the gold winged headpiece, the white and blue mage outfit with gold trim, and the glowing crystal top of her golden staff held up in front of her shoulder. Image size 256 x 256 px, the character filling the whole square like a close-up (face large and clearly readable), same framing as a big character-select bust.

BACKGROUND: perfectly flat, uniform, solid pure green #00FF00 (chroma key), no gradient, no shadow, no texture. Do NOT use green anywhere on the character.
```
