// Monster families: each spans a block of stages (FAMILY_BLOCK wide). Beyond
// the last family, stages keep scaling forever and reuse the last family so
// progression never hard-caps.
//
// NOTE: as of the BOSSES/WEAK_MONSTER_GROUPS roster below, families are no
// longer what actually spawns in combat (see getMonsterInfo at the bottom) —
// they're kept alive purely because equipment crafting (data/items.js),
// the event-boss rotation (data/events.js) and the Forge/Materials tabs
// still key off them, and none of that has a replacement defined yet. A
// player can no longer farm boar_tusk/wolf_fang/etc. from live combat, so
// crafting recipes tied to these materials are effectively frozen until
// the new roster gets its own equipment mapping.

export const FAMILY_BLOCK = 20;
export const BOSS_INTERVAL = 10;

export const MONSTER_FAMILIES = [
  {
    // Internal ids stay 'boar'/'boar_*' on purpose: they're save-file keys
    // (inventory itemIds, material counts), so renaming them would orphan
    // existing saves. Only display data changed in the Chispim rebrand.
    id: 'boar',
    name: 'Chispim',
    bossName: 'Chispim Alfa',
    emoji: '🐹',
    bossEmoji: '🐹',
    // Real reference art (see idle-hunter/assets/chispim/) — the only family
    // with actual sprites so far. Every other family falls back to emoji.
    image: 'assets/chispim/monster.png',
    images: {
      weapon: 'assets/chispim/dualblade.png',
      helmet: 'assets/chispim/helm.png',
      armor: 'assets/chispim/armor.png',
      pants: 'assets/chispim/pants.png',
      gloves: 'assets/chispim/luvas.png',
      boots: 'assets/chispim/botas.png',
    },
    element: 'eletrico',
    startStage: 1,
    endStage: 20,
    weapon: { name: 'Dual Blade de Chispim', emoji: '⚔️' },
    materials: {
      common: { id: 'boar_tusk', name: 'Pelo de Chispim', emoji: '⚡' },
      rare: { id: 'boar_alpha_hide', name: 'Cristal de Chispim', emoji: '🔷' },
      gem: { id: 'boar_gem', name: 'Gema do Chispim', emoji: '💎' },
    },
  },
  {
    id: 'wolf',
    name: 'Lobo das Sombras',
    bossName: 'Lobo Ancestral',
    emoji: '🐺',
    bossEmoji: '🐺',
    element: 'eletrico',
    startStage: 21,
    endStage: 40,
    weapon: { name: 'Adagas Sombrias', emoji: '🗡️' },
    materials: {
      common: { id: 'wolf_fang', name: 'Presa de Lobo', emoji: '🦴' },
      rare: { id: 'wolf_ancestral_pelt', name: 'Pelagem Ancestral', emoji: '🌑' },
      gem: { id: 'wolf_gem', name: 'Gema do Lobo das Sombras', emoji: '💎' },
    },
  },
  {
    id: 'spider',
    name: 'Aranha Venenosa',
    bossName: 'Rainha Aranha',
    emoji: '🕷️',
    bossEmoji: '🕷️',
    element: 'planta',
    startStage: 41,
    endStage: 60,
    weapon: { name: 'Arco Cravado de Veneno', emoji: '🏹' },
    materials: {
      common: { id: 'spider_silk', name: 'Teia Venenosa', emoji: '🕸️' },
      rare: { id: 'spider_queen_venom', name: 'Veneno da Rainha', emoji: '🧪' },
      gem: { id: 'spider_gem', name: 'Gema da Aranha Venenosa', emoji: '💎' },
    },
  },
  {
    id: 'golem',
    name: 'Golem de Pedra',
    bossName: 'Golem Ancião',
    emoji: '🗿',
    bossEmoji: '🗿',
    element: 'neutro',
    startStage: 61,
    endStage: 80,
    weapon: { name: 'Martelo de Pedra', emoji: '🔨' },
    materials: {
      common: { id: 'golem_shard', name: 'Fragmento de Pedra', emoji: '🪨' },
      rare: { id: 'golem_core', name: 'Núcleo do Golem Ancião', emoji: '💠' },
      gem: { id: 'golem_gem', name: 'Gema do Golem de Pedra', emoji: '💎' },
    },
  },
  {
    id: 'wyvern',
    name: 'Wyvern de Gelo',
    bossName: 'Wyvern Rei',
    emoji: '🐉',
    bossEmoji: '🐉',
    element: 'agua',
    startStage: 81,
    endStage: 100,
    weapon: { name: 'Machado Congelante', emoji: '🪓' },
    materials: {
      common: { id: 'wyvern_scale', name: 'Escama Congelante', emoji: '❄️' },
      rare: { id: 'wyvern_king_fang', name: 'Presa do Wyvern Rei', emoji: '🧊' },
      gem: { id: 'wyvern_gem', name: 'Gema do Wyvern de Gelo', emoji: '💎' },
    },
  },
  {
    id: 'dragon',
    name: 'Dragão Ancião',
    bossName: 'Dragão Primordial',
    emoji: '🐲',
    bossEmoji: '🐲',
    element: 'fogo',
    startStage: 101,
    endStage: 120,
    weapon: { name: 'Espada Flamejante', emoji: '⚔️' },
    materials: {
      common: { id: 'dragon_scale', name: 'Escama Draconiana', emoji: '🔴' },
      rare: { id: 'dragon_heart', name: 'Coração do Dragão Primordial', emoji: '❤️‍🔥' },
      gem: { id: 'dragon_gem', name: 'Gema do Dragão Ancião', emoji: '💎' },
    },
  },
];

// ---------------------------------------------------------------------
// Live roster (what actually spawns in combat): 10 unique bosses, one per
// decade stage (10, 20, ... 100), plus 25 weak "filler" monsters grouped
// into 5 bands, spawned randomly on every non-boss stage in between.
// "Raio" in the design doc maps to the existing 'eletrico' element id —
// same element, no new id introduced, keeps the elemental cycle logic
// (data/elements.js) untouched.
// ---------------------------------------------------------------------

export const BOSSES = [
  {
    stage: 10,
    id: 'chispim',
    name: 'Chispim',
    element: 'eletrico',
    emoji: '🐹',
    image: 'assets/chispim/monster.png',
    // Idle-loop animation for the battle sprite (renderMonster() in
    // ui/render.js cycles through these on an interval while this boss is
    // on screen — see MONSTER_IDLE_FRAME_MS there for the shared
    // 150ms/frame cadence, locked in as the standard for every monster's
    // animation, not just Chispim's). `image` above stays as the single
    // static fallback used everywhere else (Forja cards, equipment icons,
    // drop popups) — only the big monster-sprite element animates.
    //
    // Reference pattern for adding animFrames to any other monster: crop
    // all frames to the same union bounding box (so the sprite doesn't
    // jump around as it cycles), convert the background to transparency,
    // and list the frame paths as literal quoted strings here (same
    // reasoning as SCENE_IMAGES in render.js — build-bundle.mjs's asset
    // inliner only recognizes literal quoted 'assets/...' paths in the
    // source text, and won't find them inside a dynamic template
    // literal). This exact 4-frame Chispim set is the calibrated
    // reference for "how many frames" and "how similar the poses should
    // be" — reuse its cadence/count/style rather than re-deriving it.
    animFrames: [
      'assets/chispim/anim/frame1.png',
      'assets/chispim/anim/frame3.png',
      'assets/chispim/anim/frame4.png',
      'assets/chispim/anim/frame2.png',
    ],
    // Boss-specific background for the battle scene (renderMonster() in
    // ui/render.js uses this instead of the random SCENE_IMAGES rotation
    // used for weak-monster stages). Optional — bosses without one fall
    // back to the plain CSS gradient backdrop, same as before.
    scene: 'assets/ui/scenes/boss-chispim.png',
    // Battle-sprite scale multiplier (renderMonster() in ui/render.js
    // applies this as font-size on #monster-sprite, since the sprite's
    // width/height are 1em) — bosses read as unimpressive next to weak
    // monsters at the default size, so the 3 with real art get a boost.
    spriteScale: 2.1,
    materials: {
      primary1: { id: 'chispim_heart', name: 'Núcleo de Faísca', emoji: '❤️', image: 'assets/chispim/nucleo_faisca.png' },
      primary2: { id: 'chispim_whisker', name: 'Cauda Condutora', emoji: '⚡', image: 'assets/chispim/cauda_condutora.png' },
    },
    crystal: { id: 'chispim_crystal', name: 'Cristal de Chispim', emoji: '💎', image: 'assets/crystals/chispim.png' },
  },
  {
    stage: 20,
    id: 'solkaiser',
    name: 'Solkaiser',
    element: 'fogo',
    emoji: '🦅',
    image: 'assets/solkaiser/monster.png',
    // Idle-loop animation — same standard as Chispim's (see that entry's
    // comment above): 150ms/frame, plain src swap, all 4 frames cropped to
    // the same union bounding box.
    animFrames: [
      'assets/solkaiser/anim/frame1.png',
      'assets/solkaiser/anim/frame2.png',
      'assets/solkaiser/anim/frame3.png',
      'assets/solkaiser/anim/frame4.png',
    ],
    // Boss-specific background (see Chispim's `scene` comment above).
    scene: 'assets/ui/scenes/boss-solkaiser.png',
    spriteScale: 2.1,
    materials: {
      primary1: { id: 'solkaiser_feather', name: 'Pena de Solkaiser', emoji: '🪶', image: 'assets/solkaiser/pena.png' },
      primary2: { id: 'solkaiser_core', name: 'Núcleo Solar', emoji: '☀️', image: 'assets/solkaiser/nucleo.png' },
    },
    crystal: { id: 'solkaiser_crystal', name: 'Cristal de Solkaiser', emoji: '💎', image: 'assets/crystals/solkaiser.png' },
  },
  {
    stage: 30,
    id: 'tartarok',
    name: 'Tartarok',
    element: 'agua',
    emoji: '🐢',
    image: 'assets/tartarok/monster.png',
    // Idle-loop animation — same standard as Chispim's (see that entry's
    // comment above): 150ms/frame, plain src swap, all 4 frames cropped to
    // the same union bounding box.
    animFrames: [
      'assets/tartarok/anim/frame1.png',
      'assets/tartarok/anim/frame2.png',
      'assets/tartarok/anim/frame3.png',
      'assets/tartarok/anim/frame4.png',
    ],
    // Boss-specific background (see Chispim's `scene` comment above).
    scene: 'assets/ui/scenes/boss-tartarok.png',
    spriteScale: 2.1,
    materials: {
      primary1: { id: 'tartarok_shell', name: 'Casco de Tartarok', emoji: '🐚', image: 'assets/tartarok/casco.png' },
      primary2: { id: 'tartarok_pearl', name: 'Pérola Primordial', emoji: '⚪', image: 'assets/tartarok/perola.png' },
    },
    crystal: { id: 'tartarok_crystal', name: 'Cristal de Tartarok', emoji: '💎', image: 'assets/crystals/tartarok.png' },
  },
  {
    stage: 40,
    id: 'colhedor_carmesim',
    name: 'Colhedor Carmesim',
    element: 'planta',
    emoji: '🌺',
    image: 'assets/colhedor_carmesim/monster.png',
    // Idle-loop animation — same standard as Chispim's (see that entry's
    // comment above): 150ms/frame, plain src swap. Only 3 frames this
    // time (vs. the usual 4), still cropped to the same union bounding box.
    animFrames: [
      'assets/colhedor_carmesim/anim/frame1.png',
      'assets/colhedor_carmesim/anim/frame2.png',
      'assets/colhedor_carmesim/anim/frame3.png',
    ],
    // Same size boost as the first 3 bosses (see Chispim's spriteScale
    // comment above) — explicitly requested to match, not the default 1x.
    spriteScale: 2.1,
    // Boss-specific background (see Chispim's `scene` comment above).
    scene: 'assets/ui/scenes/boss-colhedor-carmesim.png',
    materials: {
      // id kept as colhedor_carmesim_scythe (save-file key) even though the
      // item was re-arted/renamed from "Foice Carmesim" to "Rosa Escarlate".
      primary1: { id: 'colhedor_carmesim_scythe', name: 'Rosa Escarlate', emoji: '🌹', image: 'assets/colhedor_carmesim/rosa.png' },
      primary2: { id: 'colhedor_carmesim_root', name: 'Raiz Sanguínea', emoji: '🩸', image: 'assets/colhedor_carmesim/raiz.png' },
    },
    crystal: { id: 'colhedor_carmesim_crystal', name: 'Cristal do Colhedor Carmesim', emoji: '💎', image: 'assets/crystals/colhedor_carmesim.png' },
  },
  {
    stage: 50,
    id: 'grommuk',
    name: 'Grommuk',
    element: 'neutro',
    emoji: '👹',
    image: 'assets/grommuk/monster.png',
    materials: {
      primary1: { id: 'grommuk_fang', name: 'Presa de Grommuk', emoji: '🦷', image: 'assets/grommuk/presa.png' },
      primary2: { id: 'grommuk_medallion', name: 'Medalhão Tribal', emoji: '🥉', image: 'assets/grommuk/medalhao.png' },
    },
    crystal: { id: 'grommuk_crystal', name: 'Cristal de Grommuk', emoji: '💎', image: 'assets/crystals/grommuk.png' },
  },
  {
    stage: 60,
    id: 'vulkarion',
    name: 'Vulkarion',
    element: 'fogo',
    emoji: '🐂',
    image: 'assets/vulkarion/monster.png',
    materials: {
      primary1: { id: 'vulkarion_horn', name: 'Chifre de Vulkarion', emoji: '🐮', image: 'assets/vulkarion/chifre.png' },
      primary2: { id: 'vulkarion_heart', name: 'Coração Vulcânico', emoji: '🌋', image: 'assets/vulkarion/coracao.png' },
    },
    crystal: { id: 'vulkarion_crystal', name: 'Cristal de Vulkarion', emoji: '💎', image: 'assets/crystals/vulkarion.png' },
  },
  {
    stage: 70,
    id: 'leviargon',
    name: 'Leviargon',
    element: 'agua',
    emoji: '🐋',
    image: 'assets/leviargon/monster.png',
    materials: {
      primary1: { id: 'leviargon_fin', name: 'Barbatana de Leviargon', emoji: '🦈', image: 'assets/leviargon/barbatana.png' },
      primary2: { id: 'leviargon_eye', name: 'Olho Abissal', emoji: '👁️', image: 'assets/leviargon/olho.png' },
    },
    crystal: { id: 'leviargon_crystal', name: 'Cristal de Leviargon', emoji: '💎', image: 'assets/crystals/leviargon.png' },
  },
  {
    stage: 80,
    id: 'tempestron',
    name: 'Tempestron',
    element: 'eletrico',
    emoji: '⛈️',
    image: 'assets/tempestron/monster.png',
    materials: {
      primary1: { id: 'tempestron_heart', name: 'Coração Tempestuoso', emoji: '💜', image: 'assets/tempestron/coracao.png' },
      primary2: { id: 'tempestron_orb', name: 'Orbe Trovejante', emoji: '🔮', image: 'assets/tempestron/orbe.png' },
    },
    crystal: { id: 'tempestron_crystal', name: 'Cristal de Tempestron', emoji: '💎', image: 'assets/crystals/tempestron.png' },
  },
  {
    stage: 90,
    id: 'gaiatron',
    name: 'Gaiatron',
    element: 'planta',
    emoji: '🌳',
    image: 'assets/gaiatron/monster.png',
    materials: {
      primary1: { id: 'gaiatron_branch', name: 'Galho Primordial', emoji: '🌿', image: 'assets/gaiatron/galho.png' },
      primary2: { id: 'gaiatron_seed', name: 'Semente Ancestral', emoji: '🌰', image: 'assets/gaiatron/semente.png' },
    },
    crystal: { id: 'gaiatron_crystal', name: 'Cristal de Gaiatron', emoji: '💎', image: 'assets/crystals/gaiatron.png' },
  },
  {
    stage: 100,
    id: 'bahamorth',
    name: 'Bahamorth',
    element: 'neutro',
    emoji: '🐲',
    image: 'assets/bahamorth/monster.png',
    materials: {
      primary1: { id: 'bahamorth_scale', name: 'Escama de Bahamorth', emoji: '🩶', image: 'assets/bahamorth/escama.png' },
      primary2: { id: 'bahamorth_soul', name: 'Alma Dracônica', emoji: '👻', image: 'assets/bahamorth/alma.png' },
    },
    crystal: { id: 'bahamorth_crystal', name: 'Cristal de Bahamorth', emoji: '💎', image: 'assets/crystals/bahamorth.png' },
  },
];

/// Weak "filler" monsters: 5 bands of 5 (one per element), spawned randomly
/// on whatever non-boss stage falls in that band. Boundaries deliberately
/// match the design doc as given (not a clean formula — the last band
/// happens to be wider, spanning two boss checkpoints), so this is data,
/// not derived from BOSS_INTERVAL.
export const WEAK_MONSTER_GROUPS = [
  {
    startStage: 1,
    endStage: 19,
    monsters: [
      { id: 'braslimo', name: 'Braslimo', element: 'fogo', emoji: '🔥', image: 'assets/braslimo/monster.png', material: { id: 'braslimo_gel', name: 'Gel Incandescente', emoji: '🟠', image: 'assets/braslimo/gel.png' } },
      { id: 'cristalino', name: 'Cristalino', element: 'agua', emoji: '🔷', image: 'assets/cristalino/monster.png', material: { id: 'cristalino_shard', name: 'Fragmento de Cristal', emoji: '💠', image: 'assets/cristalino/shard.png' } },
      { id: 'espinhoco', name: 'Espinhoco', element: 'neutro', emoji: '🦔', image: 'assets/espinhoco/monster.png', material: { id: 'espinhoco_thorn', name: 'Espinho Afiado', emoji: '🌵', image: 'assets/espinhoco/thorn.png' } },
      { id: 'tronk', name: 'Tronk', element: 'planta', emoji: '🌳', image: 'assets/tronk/monster.png', material: { id: 'tronk_wood', name: 'Madeira Viva', emoji: '🪵', image: 'assets/tronk/wood.png' } },
      { id: 'aracneon', name: 'Aracneon', element: 'eletrico', emoji: '🕷️', image: 'assets/aracneon/monster.png', material: { id: 'aracneon_silk', name: 'Seda Elétrica', emoji: '⚡', image: 'assets/aracneon/silk.png' } },
    ],
  },
  {
    startStage: 21,
    endStage: 39,
    monsters: [
      { id: 'volpix', name: 'Volpix', element: 'fogo', emoji: '🦊', image: 'assets/volpix/monster.png', material: { id: 'volpix_fur', name: 'Pelo Flamejante', emoji: '🔥', image: 'assets/volpix/fur.png' } },
      { id: 'cascafria', name: 'Cascafria', element: 'agua', emoji: '🐢', image: 'assets/cascafria/monster.png', material: { id: 'cascafria_shell', name: 'Casco Congelado', emoji: '❄️', image: 'assets/cascafria/shell.png' } },
      { id: 'grunco', name: 'Grunco', element: 'neutro', emoji: '🐗', image: 'assets/grunco/monster.png', material: { id: 'grunco_hide', name: 'Couro Grosso', emoji: '🟤', image: 'assets/grunco/hide.png' } },
      { id: 'cogumeloide', name: 'Cogumeloide', element: 'planta', emoji: '🍄', image: 'assets/cogumeloide/monster.png', material: { id: 'cogumeloide_fiber', name: 'Fibra Fúngica', emoji: '🍄', image: 'assets/cogumeloide/fiber.png' } },
      { id: 'faisca', name: 'Faísca', element: 'eletrico', emoji: '🐿️', image: 'assets/faisca/monster.png', material: { id: 'faisca_core', name: 'Núcleo Elétrico', emoji: '🔋', image: 'assets/faisca/core.png' } },
    ],
  },
  {
    startStage: 41,
    endStage: 59,
    monsters: [
      { id: 'lamel', name: 'Lamel', element: 'fogo', emoji: '🦎', image: 'assets/lamel/monster.png', material: { id: 'lamel_scale', name: 'Escama Flamejante', emoji: '🔥', image: 'assets/lamel/scale.png' } },
      { id: 'marrelho', name: 'Marrelho', element: 'agua', emoji: '🦀', image: 'assets/marrelho/monster.png', material: { id: 'marrelho_claw', name: 'Garra Marinha', emoji: '🦀', image: 'assets/marrelho/claw.png' } },
      { id: 'casquelo', name: 'Casquelo', element: 'neutro', emoji: '🐌', image: 'assets/casquelo/monster.png', material: { id: 'casquelo_shell', name: 'Casco Rochoso', emoji: '🪨', image: 'assets/casquelo/shell.png' } },
      { id: 'folhante', name: 'Folhante', element: 'planta', emoji: '🌿', image: 'assets/folhante/monster.png', material: { id: 'folhante_leaf', name: 'Folha Carnívora', emoji: '🌿', image: 'assets/folhante/leaf.png' } },
      { id: 'dentelha', name: 'Dentelha', element: 'eletrico', emoji: '🐟', image: 'assets/dentelha/monster.png', material: { id: 'dentelha_fang', name: 'Presa Elétrica', emoji: '⚡', image: 'assets/dentelha/fang.png' } },
    ],
  },
  {
    startStage: 61,
    endStage: 79,
    monsters: [
      { id: 'pimpira', name: 'Pimpira', element: 'fogo', emoji: '🦋', image: 'assets/pimpira/monster.png', material: { id: 'pimpira_wing', name: 'Asa Flamejante', emoji: '🔥', image: 'assets/pimpira/wing.png' } },
      { id: 'bolhumo', name: 'Bolhumo', element: 'agua', emoji: '🫧', image: 'assets/bolhumo/monster.png', material: { id: 'bolhumo_essence', name: 'Essência Aquática', emoji: '💧', image: 'assets/bolhumo/essence.png' } },
      { id: 'escamito', name: 'Escamito', element: 'neutro', emoji: '🦎', image: 'assets/escamito/monster.png', material: { id: 'escamito_scale', name: 'Escama Metálica', emoji: '⚙️', image: 'assets/escamito/scale.png' } },
      { id: 'muskar', name: 'Muskar', element: 'planta', emoji: '🦫', image: 'assets/muskar/monster.png', material: { id: 'muskar_fur', name: 'Pelo Musgoso', emoji: '🌿', image: 'assets/muskar/fur.png' } },
      { id: 'voltouro', name: 'Voltouro', element: 'eletrico', emoji: '🦏', image: 'assets/voltouro/monster.png', material: { id: 'voltouro_horn', name: 'Chifre Condutor', emoji: '⚡', image: 'assets/voltouro/horn.png' } },
    ],
  },
  {
    startStage: 81,
    endStage: 100,
    monsters: [
      { id: 'carvao', name: 'Carvão', element: 'fogo', emoji: '⚫', image: 'assets/carvao/monster.png', material: { id: 'carvao_vivo', name: 'Carvão Vivo', emoji: '🔥', image: 'assets/carvao/coal.png' } },
      { id: 'serpilha', name: 'Serpilha', element: 'agua', emoji: '🐍', image: 'assets/serpilha/monster.png', material: { id: 'serpilha_skin', name: 'Pele Escamosa', emoji: '💧', image: 'assets/serpilha/skin.png' } },
      { id: 'cascudon', name: 'Cascudon', element: 'neutro', emoji: '🐢', image: 'assets/cascudon/monster.png', material: { id: 'cascudon_shell', name: 'Carapaça Grossa', emoji: '🛡️', image: 'assets/cascudon/shell.png' } },
      { id: 'esporim', name: 'Esporim', element: 'planta', emoji: '🍄', image: 'assets/esporim/monster.png', material: { id: 'esporim_spore', name: 'Esporo Venenoso', emoji: '☠️', image: 'assets/esporim/spore.png' } },
      { id: 'ventrix', name: 'Ventrix', element: 'eletrico', emoji: '🦅', image: 'assets/ventrix/monster.png', material: { id: 'ventrix_feather', name: 'Pena Celeste', emoji: '🪽', image: 'assets/ventrix/feather.png' } },
    ],
  },
];

export function isBossStage(stage) {
  return stage % BOSS_INTERVAL === 0;
}

/// Exact match by stage; beyond the last defined boss (100), keeps
/// reusing that last boss so progression never hard-caps, same pattern
/// the old family system used.
export function getBossForStage(stage) {
  return BOSSES.find((b) => b.stage === stage) || BOSSES[BOSSES.length - 1];
}

/// Looks up a material's display info ({id, name, emoji}) by id across
/// every source that can produce one — boss "drop principal"/Crystal, weak
/// monster material, or (for saves/inventory predating the boss-roster
/// rebuild) the old MONSTER_FAMILIES common/rare/gem. Used wherever a UI
/// needs to show a material it only knows the id of (e.g. a crafting
/// recipe's cost line), instead of each caller re-deriving which roster it
/// came from.
export function findMaterialInfo(materialId) {
  for (const boss of BOSSES) {
    if (boss.materials.primary1.id === materialId) return boss.materials.primary1;
    if (boss.materials.primary2.id === materialId) return boss.materials.primary2;
    if (boss.crystal.id === materialId) return boss.crystal;
  }
  for (const group of WEAK_MONSTER_GROUPS) {
    for (const monster of group.monsters) {
      if (monster.material.id === materialId) return monster.material;
    }
  }
  for (const family of MONSTER_FAMILIES) {
    if (family.materials.common.id === materialId) return family.materials.common;
    if (family.materials.rare.id === materialId) return family.materials.rare;
    if (family.materials.gem.id === materialId) return family.materials.gem;
  }
  return null;
}

export function getWeakMonsterGroupForStage(stage) {
  for (const group of WEAK_MONSTER_GROUPS) {
    if (stage >= group.startStage && stage <= group.endStage) return group;
  }
  return WEAK_MONSTER_GROUPS[WEAK_MONSTER_GROUPS.length - 1];
}

export function pickRandomWeakMonster(stage) {
  const group = getWeakMonsterGroupForStage(stage);
  return group.monsters[Math.floor(Math.random() * group.monsters.length)];
}

/// ids are unique across every band, so a flat lookup by id alone is safe
/// (no need to know which band/stage it came from).
export function getWeakMonster(id) {
  for (const group of WEAK_MONSTER_GROUPS) {
    const found = group.monsters.find((m) => m.id === id);
    if (found) return found;
  }
  return WEAK_MONSTER_GROUPS[0].monsters[0];
}

/// weakMonsterId is the currently-spawned weak monster's id (persisted on
/// state, see combat.js ensureMonsterSpawned) — only meaningful on non-boss
/// stages; boss stages always show that decade's unique boss and ignore it.
export function getMonsterInfo(stage, weakMonsterId) {
  const boss = isBossStage(stage);

  if (boss) {
    const b = getBossForStage(stage);
    return {
      bossId: b.id,
      weakMonsterId: null,
      name: b.name,
      emoji: b.emoji,
      image: b.image || null,
      animFrames: b.animFrames || null,
      scene: b.scene || null,
      scenePosition: b.scenePosition || null,
      spriteScale: b.spriteScale || 1,
      element: b.element,
      isBoss: true,
      isWeak: false,
    };
  }

  const weak = weakMonsterId ? getWeakMonster(weakMonsterId) : pickRandomWeakMonster(stage);
  return {
    bossId: null,
    weakMonsterId: weak.id,
    name: weak.name,
    emoji: weak.emoji,
    image: weak.image || null,
    animFrames: weak.animFrames || null,
    element: weak.element,
    isBoss: false,
    isWeak: true,
  };
}
