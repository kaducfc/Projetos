# Prompts de arte do Rift Survivors (para gerar no ChatGPT)

Regra do processo: eu peço, você gera, coloca os PNG na pasta `site/` com os nomes sugeridos e me avisa. Eu recorto,
tiro o fundo, padronizo o tamanho e coloco no jogo.

## 0. Bloco de estilo (cole no começo de TODO prompt)

```
STYLE (apply to everything): Pixel art game sprite, 32-bit era, clean hand-placed pixels, crisp hard edges.
Absolutely NO anti-aliasing, NO blur, NO soft glow, NO painterly shading, NO gradients, NO dithering noise,
NO haze around the sprite. Every pixel block is a clear square. Strong 1-pixel dark outline (#14101E) around
the whole character. Limited palette (about 24 colors), 3 to 4 tones per material (shadow, base, light,
highlight), light from the top-left. Three-quarter top-down view (like Vampire Survivors): we see the front
and a little of the top of the head, character faces slightly to the RIGHT. Heroic but compact proportions,
about 3 heads tall, big readable head and hands, so it still reads when shrunk to 32 px. Faithful to the
League of Legends champion design identity (silhouette, colors, signature items). Background: fully
transparent PNG. No ground shadow, no text, no labels, no frames, no UI, no watermark, no checkerboard.
```

Se o ChatGPT não entregar transparência de verdade (fundo branco ou quadriculado), acrescente: "Use a flat solid pure
green background #00FF00, no gradient, no shadow, no texture" (eu removo o verde depois).

## 1. Formato das tiras (cole junto do prompt de cada animação)

```
FORMAT: one single PNG, N equal square cells of 256 x 256 px laid side by side in ONE ROW (total width
N x 256 px, height 256 px), invisible grid, no lines between cells. In every cell: the same character, same
scale (about 170 px tall), centered horizontally, feet touching the same invisible baseline at y = 225,
at least 24 px of empty margin, nothing crossing the cell borders. Identical costume, colors and proportions
in all cells. Facing right.
```

## 2. Garen (fazer primeiro)

**2.1 Ficha do personagem (trava o visual; use a imagem aprovada como referência nos próximos)**
```
[STYLE block]
Character model sheet of GAREN, "The Might of Demacia", from League of Legends. Three views side by side on a
transparent background: front, three-quarter right, and back, same scale, 512 x 512 px each (1536 x 512 total).
Design: bare head with short messy brown hair (#7A4521 base, #A8672F light), strong jaw, determined face.
Heavy Demacian plate armor in polished silver steel (#AAB6CF base, #E4EBF7 highlight, #6C7896 shadow) with gold
trim (#F5C82E / #B8860B). Huge layered shoulder pauldrons with a gold edge. Royal-blue (#2F62C8, light #6A98FF,
dark #1B2D6B) tabard and short cape with a simplified winged-shield Demacian crest in gold on the chest. Steel
gauntlets and greaves, brown leather boots. He holds a big Demacian broadsword (steel blade, gold crossguard,
brown grip) in his right hand, resting on his shoulder. No glow, no effects.
```

**2.2 Parada (4 quadros, N = 4, 1024 x 256)**
```
[STYLE block] [FORMAT block with N = 4]
Same Garen as the reference image. IDLE loop, 4 frames, seamless: subtle breathing (chest rises 1 px and falls),
cape sways slightly, sword tip bobs 1 px, a tiny blink in frame 3. Very small differences between frames.
```

**2.3 Andando (6 quadros, N = 6, 1536 x 256)**
```
[STYLE block] [FORMAT block with N = 6]
Same Garen as the reference image. WALK CYCLE, 6 frames, seamless loop, walking to the right: contact, down,
passing, contact (other leg), down, passing. Body bobs 2 px, cape flows backwards, sword stays on the
shoulder, shoulder pauldrons bounce slightly. Feet stay on the baseline at contact frames.
```

**2.4 Ataque (4 quadros, N = 4, 1024 x 256)**
```
[STYLE block] [FORMAT block with N = 4]
Same Garen as the reference image. SPIN ATTACK, 4 frames: (1) wind-up, body twisted, sword pulled back;
(2) fast horizontal spin slash with a crisp pixel-art slash arc in white and light blue (hard-edged pixels,
no blur, no glow); (3) follow-through, sword extended to the right, arc fading; (4) recover to a ready stance.
The slash arc may extend up to 40 px beyond the character but must stay inside its cell.
```

**2.5 Dano e morte (6 quadros, N = 6, 1536 x 256)**
```
[STYLE block] [FORMAT block with N = 6]
Same Garen as the reference image. Cells 1 and 2: HURT (flinches back, eyes squeezed shut, whole body tinted
slightly lighter). Cells 3 to 6: DEATH: staggers, drops to one knee dropping the sword, falls on his side,
lies on the ground (cell 6 is the final lying pose, flat and wide, still inside the cell).
```

**2.6 Retrato (1 imagem, 256 x 256)**
```
[STYLE block]
Bust portrait icon of Garen for a character-select screen: head and shoulders, three-quarter view facing
slightly right, confident smile, same armor, colors and hair as the reference image. 256 x 256 px, character
filling about 90% of the square, transparent background, no frame, no text.
```

## 3. Modelo para os outros campeões
Troque a descrição do desenho e as cores e repita os itens 2.1 a 2.6.

- **Jinx:** cabelo azul-ciano (#58E8FF) em duas tranças longas, olhos rosa, sorriso maluco; top preto e rosa (#FF77B8), shorts
  e tiras de munição, luvas desparelhadas; arma Fishbones (lançador de foguetes com cabeça de tubarão) e minigun Pow-Pow.
- **Ashe:** cabelo longo branco-prateado, capuz e capa azul e branca com pele nas bordas, arco de cristal de gelo azul-claro,
  aljava nas costas, olhos azuis; ataque: flecha de gelo.
- **Lux:** cabelo loiro-dourado longo em onda, armadura demaciana branca, prata e dourada com detalhes azuis, cajado/varinha de
  cristal, aura de luz branca-dourada (só em pixels duros, sem brilho borrado).
- **Zed:** ninja de sombras, armadura preta e roxo-escuro, máscara metálica com visor vermelho brilhante, cabelo preto espetado,
  duas lâminas curvas, detalhes em roxo e vermelho; ataque: cortes rápidos.

## 4. Dicas
- Gere cada tira numa conversa onde a **ficha aprovada** está anexada, e diga: "same character exactly as the attached model sheet".
- Se os quadros saírem com tamanhos diferentes ou o personagem trocar de roupa, peça de novo; não precisa ser perfeito, eu
  alinho os pés e igualo a escala, mas o traje precisa ser o mesmo.
- Prefira o pedido em 2 ou 3 tiras menores a uma folha enorme: a consistência é bem melhor.
- Nomes sugeridos: `garen-modelo.png`, `garen-parada.png`, `garen-andando.png`, `garen-ataque.png`,
  `garen-dano-morte.png`, `garen-retrato.png`.
