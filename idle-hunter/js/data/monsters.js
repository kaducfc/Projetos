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
    // id/crystalMaterialId ficam 'chispim'/'chispim_crystal' de propósito —
    // são chaves de save (materials/inventory), cartas (data/cards.js) e
    // rotação de evento (data/events.js). Reskin de display only, mesmo
    // padrão já usado quando a família 'boar' virou "Chispim" (ver
    // MONSTER_FAMILIES acima): só nome/arte/elemento mudam, o resto do
    // jogo continua funcionando sem saber que o chefe agora se chama
    // Thornak. Fecha a nova Zona 1 (Sylkar/Musgorn/Guardião Druida/
    // GranClaw, ver WEAK_MONSTER_GROUPS acima) como o 5º e mais forte
    // monstro — só um pouco mais forte que o GranClaw (ver powerRank
    // abaixo e monsterMaxHp/monsterDamagePerSecond/monsterGoldReward em
    // systems/combat.js), não o salto grande de sempre (BOSS_HP_MULT
    // etc.), que continua valendo pra todo o resto do jogo.
    id: 'chispim',
    name: 'Thornak',
    element: 'planta',
    emoji: '👹',
    image: 'assets/thornak/monster.png',
    // Sem animação de frames pra esse (só 1 imagem estática recebida) —
    // renderMonster() em ui/render.js já lida bem com isso, mostra a
    // imagem parada.
    animFrames: null,
    // Sem cena de fundo própria pra esse (nenhuma arte de cenário
    // recebida) — cai no gradiente CSS padrão, igual todo boss sem scene.
    scene: null,
    // Boss-specific background for the battle scene (renderMonster() in
    // ui/render.js uses this instead of the random SCENE_IMAGES rotation
    // used for weak-monster stages). Optional — bosses without one fall
    // back to the plain CSS gradient backdrop, same as before.
    // Battle-sprite scale multiplier (renderMonster() in ui/render.js
    // applies this as font-size on #monster-sprite, since the sprite's
    // width/height are 1em) — bosses read as unimpressive next to weak
    // monsters at the default size, so the ones with real art get a boost.
    spriteScale: 2.1,
    // Só 1 material de drop de verdade agora (Crânio de Thornak) — o
    // schema compartilhado por todo boss ainda exige primary1 E primary2
    // (ver systems/combat.js rollDrops, data/events.js, data/shop.js), só
    // que os dois apontam pro MESMO id/material aqui (dropa até 2 por
    // kill, já que cada um rola sua própria chance — só reforça que o
    // chefe rende mais desse material que um fraco, sem introduzir um 2º
    // material de verdade). shop.js já pula a 2ª linha duplicada quando os
    // ids batem — ver eventShopItemsForBoss.
    materials: {
      primary1: { id: 'chispim_heart', name: 'Crânio de Thornak', emoji: '💀', image: 'assets/thornak/cranio.png' },
      primary2: { id: 'chispim_heart', name: 'Crânio de Thornak', emoji: '💀', image: 'assets/thornak/cranio.png' },
    },
    crystal: { id: 'chispim_crystal', name: 'Cristal de Thornak', emoji: '💎', image: 'assets/crystals/chispim.png' },
    // Rank de poder dentro da Zona 1 (ver WEAK_MONSTER_GROUPS acima e
    // monsterMaxHp/monsterDamagePerSecond/monsterGoldReward em
    // systems/combat.js) — 4 é só 1 degrau acima do GranClaw (rank 3),
    // ~6.5% mais forte, não o multiplicador de chefe de sempre.
    powerRank: 4,
  },
  {
    stage: 20,
    // id/crystalMaterialId ficam 'solkaiser'/'solkaiser_crystal' de
    // propósito — mesmo reskin display-only do Chispim→Thornak acima (ver
    // comentário lá). Fecha a Zona 2 (Marfang/Mizan/Lyria/Hydrakon, ver
    // WEAK_MONSTER_GROUPS acima) como o 5º e mais forte monstro.
    id: 'solkaiser',
    name: 'Marokar',
    element: 'agua',
    emoji: '🔱',
    image: 'assets/marokar/monster.png',
    // Sem animação de frames (só 1 imagem estática recebida).
    animFrames: null,
    spriteScale: 2.1,
    // Só 1 material de drop de verdade (Tridente de Marokar) — mesmo
    // truque do Thornak (primary1/primary2 apontam pro mesmo id, ver
    // comentário lá + eventShopItemsForBoss em data/shop.js).
    materials: {
      primary1: { id: 'solkaiser_feather', name: 'Tridente de Marokar', emoji: '🔱', image: 'assets/marokar/tridente.png' },
      primary2: { id: 'solkaiser_feather', name: 'Tridente de Marokar', emoji: '🔱', image: 'assets/marokar/tridente.png' },
    },
    crystal: { id: 'solkaiser_crystal', name: 'Cristal de Marokar', emoji: '💎', image: 'assets/crystals/solkaiser.png' },
    // Rank de poder dentro da Zona 2 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4
    // é só 1 degrau acima do Hydrakon (rank 3).
    powerRank: 4,
  },
  {
    stage: 30,
    // id/crystalMaterialId ficam 'tartarok'/'tartarok_crystal' de
    // propósito — mesmo reskin display-only do Chispim→Thornak/
    // Solkaiser→Marokar acima (ver comentário no Chispim). Fecha a Zona 3
    // (Esqueleto Guerreiro/Assassino Sombrio/Garruk/Mimicus, ver
    // WEAK_MONSTER_GROUPS acima) como o 5º e mais forte monstro.
    id: 'tartarok',
    name: 'Vorlith',
    element: 'neutro',
    emoji: '👻',
    image: 'assets/vorlith/monster.png',
    // Sem animação de frames (só 1 imagem estática recebida).
    animFrames: null,
    spriteScale: 2.1,
    // Só 1 material de drop de verdade (Manto Esvaído) — mesmo truque do
    // Thornak/Marokar (primary1/primary2 apontam pro mesmo id).
    materials: {
      primary1: { id: 'tartarok_shell', name: 'Manto Esvaído', emoji: '🖤', image: 'assets/vorlith/manto.png' },
      primary2: { id: 'tartarok_shell', name: 'Manto Esvaído', emoji: '🖤', image: 'assets/vorlith/manto.png' },
    },
    crystal: { id: 'tartarok_crystal', name: 'Cristal de Vorlith', emoji: '💎', image: 'assets/crystals/tartarok.png' },
    // Rank de poder dentro da Zona 3 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4
    // é só 1 degrau acima do Mimicus (rank 3).
    powerRank: 4,
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
    animFrames: [
      'assets/grommuk/anim/frame1.png',
      'assets/grommuk/anim/frame2.png',
      'assets/grommuk/anim/frame3.png',
      'assets/grommuk/anim/frame4.png',
      'assets/grommuk/anim/frame5.png',
      'assets/grommuk/anim/frame6.png',
    ],
    // Same size boost as the earlier animated bosses (see Chispim's
    // spriteScale comment above).
    spriteScale: 2.1,
    // Boss-specific background (see Chispim's `scene` comment above).
    scene: 'assets/ui/scenes/boss-grommuk.png',
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
    animFrames: [
      'assets/vulkarion/anim/frame1.png',
      'assets/vulkarion/anim/frame2.png',
      'assets/vulkarion/anim/frame3.png',
      'assets/vulkarion/anim/frame4.png',
      'assets/vulkarion/anim/frame5.png',
      'assets/vulkarion/anim/frame6.png',
    ],
    // Same size boost as the earlier animated bosses (see Chispim's
    // spriteScale comment above).
    spriteScale: 2.1,
    // Boss-specific background (see Chispim's `scene` comment above).
    scene: 'assets/ui/scenes/boss-vulkarion.png',
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
    animFrames: [
      'assets/leviargon/anim/frame1.png',
      'assets/leviargon/anim/frame2.png',
      'assets/leviargon/anim/frame3.png',
      'assets/leviargon/anim/frame4.png',
      'assets/leviargon/anim/frame5.png',
      'assets/leviargon/anim/frame6.png',
    ],
    // Same size boost as the earlier animated bosses (see Chispim's
    // spriteScale comment above).
    spriteScale: 2.1,
    // Boss-specific background (see Chispim's `scene` comment above).
    scene: 'assets/ui/scenes/boss-leviargon.png',
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

/// Weak "filler" monsters: bands spawned randomly on whatever non-boss
/// stage falls dentro delas. Boundaries deliberately match the design doc
/// as given (not a clean formula — the last band happens to be wider,
/// spanning two boss checkpoints), so this is data, not derived from
/// BOSS_INTERVAL.
///
/// A banda da Zona 1 (stage 1-9) é EXCLUSIVA dela agora — só 4 monstros
/// (não 5: o 5º "monstro" da zona é o próprio chefe, ver BOSSES[0]
/// Thornak abaixo), todos elemento Planta (tema da arte, uma "tribo da
/// floresta"), cada um um pouco mais forte que o anterior (ver powerRank,
/// consumido por monsterMaxHp/monsterDamagePerSecond/monsterGoldReward em
/// systems/combat.js — só usado quando presente, então não afeta as
/// outras zonas/bandas). A banda seguinte (stage 10-19, Zona 2) continua
/// com o roster de sempre, sem mudança nenhuma.
export const WEAK_MONSTER_GROUPS = [
  {
    startStage: 1,
    endStage: 9,
    monsters: [
      { id: 'sylkar', name: 'Sylkar', element: 'planta', emoji: '🗡️', image: 'assets/sylkar/monster.png', powerRank: 0, spriteScale: 2.1, material: { id: 'sylkar_blade', name: 'Lâmina de Sylkar', emoji: '🍃', image: 'assets/sylkar/lamina.png' } },
      { id: 'musgorn', name: 'Musgorn', element: 'planta', emoji: '🍄', image: 'assets/musgorn/monster.png', powerRank: 1, spriteScale: 2.1, material: { id: 'musgorn_hat', name: 'Chapéu Musgoso', emoji: '🍄', image: 'assets/musgorn/chapeu.png' } },
      { id: 'guardiao_druida', name: 'Guardião Druida', element: 'planta', emoji: '🌳', image: 'assets/guardiao_druida/monster.png', powerRank: 2, spriteScale: 2.1, material: { id: 'guardiao_druida_antler', name: 'Galhada Ancestral', emoji: '🌿', image: 'assets/guardiao_druida/galhada.png' } },
      { id: 'granclaw', name: 'GranClaw', element: 'planta', emoji: '🦀', image: 'assets/granclaw/monster.png', powerRank: 3, spriteScale: 2.1, material: { id: 'granclaw_claw', name: 'Garra Petrificada', emoji: '🪨', image: 'assets/granclaw/garra.png' } },
    ],
  },
  // Zona 2 (stage 10-19) — mesmo tratamento da Zona 1 acima: 4 monstros
  // próprios, elemento Água, cada um um pouco mais forte que o anterior
  // (powerRank). O 5º e mais forte (Marokar) é o chefe da zona (ver
  // BOSSES[1] abaixo).
  {
    startStage: 10,
    endStage: 19,
    monsters: [
      { id: 'marfang', name: 'Marfang', element: 'agua', emoji: '🐺', image: 'assets/marfang/monster.png', powerRank: 0, spriteScale: 2.1, material: { id: 'marfang_fang', name: 'Presa de Marfang', emoji: '🦷', image: 'assets/marfang/presa.png' } },
      { id: 'mizan', name: 'Mizan', element: 'agua', emoji: '🥷', image: 'assets/mizan/monster.png', powerRank: 1, spriteScale: 2.1, material: { id: 'mizan_kunai', name: 'Kunai Ninja', emoji: '🗡️', image: 'assets/mizan/kunai.png' } },
      { id: 'lyria', name: 'Lyria', element: 'agua', emoji: '🧜', image: 'assets/lyria/monster.png', powerRank: 2, spriteScale: 2.1, material: { id: 'lyria_scale', name: 'Escama de Sereia', emoji: '🐟', image: 'assets/lyria/escama.png' } },
      { id: 'hydrakon', name: 'Hydrakon', element: 'agua', emoji: '🌊', image: 'assets/hydrakon/monster.png', powerRank: 3, spriteScale: 2.1, material: { id: 'hydrakon_heart', name: 'Coração Gelado', emoji: '💙', image: 'assets/hydrakon/coracao.png' } },
    ],
  },
  // Zona 3 (stage 21-29) — mesmo tratamento das Zonas 1/2: 4 monstros
  // próprios, elemento Neutro, cada um um pouco mais forte que o anterior
  // (powerRank). O 5º e mais forte (Vorlith) é o chefe da zona (ver
  // BOSSES[2] abaixo).
  {
    startStage: 21,
    endStage: 29,
    monsters: [
      { id: 'esqueleto_guerreiro', name: 'Esqueleto Guerreiro', element: 'neutro', emoji: '💀', image: 'assets/esqueleto_guerreiro/monster.png', powerRank: 0, spriteScale: 2.1, material: { id: 'esqueleto_guerreiro_shield', name: 'Escudo Quebrado', emoji: '🛡️', image: 'assets/esqueleto_guerreiro/escudo.png' } },
      { id: 'assassino_sombrio', name: 'Assassino Sombrio', element: 'neutro', emoji: '🗡️', image: 'assets/assassino_sombrio/monster.png', powerRank: 1, spriteScale: 2.1, material: { id: 'assassino_sombrio_hood', name: 'Capuz da Sombra', emoji: '🥷', image: 'assets/assassino_sombrio/capuz.png' } },
      { id: 'garruk', name: 'Garruk', element: 'neutro', emoji: '🐺', image: 'assets/garruk/monster.png', powerRank: 2, spriteScale: 2.1, material: { id: 'garruk_pelt', name: 'Pele de Lupino', emoji: '🐾', image: 'assets/garruk/pele.png' } },
      { id: 'mimicus', name: 'Mimicus', element: 'neutro', emoji: '📦', image: 'assets/mimicus/monster.png', powerRank: 3, spriteScale: 2.1, material: { id: 'mimicus_lock', name: 'Fechadura Mimética', emoji: '🔒', image: 'assets/mimicus/fechadura.png' } },
    ],
  },
  {
    startStage: 30,
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
// ---------------------------------------------------------------------
// Zonas (substitui a progressão linear por estágio): 10 zonas "achatadas",
// uma por chefe/década (BOSSES já está ordenado por stage ascendente, então
// ZONES[i] = BOSSES[i]). Cada zona tem 5 monstros fracos + 1 chefe, sem
// sub-estágio — o jogador escolhe até 4 monstros específicos (de qualquer
// zona liberada) pra caçar, e o "estágio canônico" da zona (10, 20, ...100)
// é usado por monsterMaxHp/monsterGoldReward/monsterDamagePerSecond em
// combat.js pra escalar TODOS os 5 fracos + o chefe daquela zona (o chefe
// ainda aplica seu próprio multiplicador BOSS_* por cima).
//
// NOTA: só existem 5 bandas de monstro fraco (WEAK_MONSTER_GROUPS) pra 10
// zonas — cada banda hoje cobre 2 décadas de estágio (ex: banda 1-19 cobre
// as zonas 1 e 2). Sem arte nova pra 5 bandas extras, cada par de zonas
// compartilha os mesmos 5 monstros fracos (só a escala de poder difere,
// via canonicalStage). Ver getZoneWeakMonsters abaixo.
export const ZONE_SIZE = BOSS_INTERVAL; // 10
export const ZONE_COUNT = BOSSES.length; // 10

// Nível de caçador pra liberar o chefe da zona N (1-based): 10*N.
// Nível pra liberar a PRÓPRIA zona N+1: 20*N. Zona 1 sempre liberada.
// Valores de partida, fáceis de re-tunar depois (ver data/monsters.js
// ZONES[].zoneUnlockLevel/bossUnlockLevel).
function zoneUnlockLevelFor(zoneIndex) {
  return zoneIndex === 0 ? 0 : 20 * zoneIndex;
}
function bossUnlockLevelFor(zoneIndex) {
  return 10 * (zoneIndex + 1);
}

export const ZONES = BOSSES.map((boss, zoneIndex) => {
  const canonicalStage = (zoneIndex + 1) * ZONE_SIZE;
  return {
    index: zoneIndex,
    name: `Zona ${zoneIndex + 1}`,
    canonicalStage,
    weakMonsters: getWeakMonsterGroupForStage(canonicalStage - 1).monsters,
    boss,
    zoneUnlockLevel: zoneUnlockLevelFor(zoneIndex),
    bossUnlockLevel: bossUnlockLevelFor(zoneIndex),
  };
});

export function getZone(zoneIndex) {
  return ZONES[zoneIndex] || null;
}

/// Acha a zona que contém um monstro fraco ou chefe pelo id (usado pra
/// resolver uma entrada de state.selectedMonsters de volta pro objeto
/// completo da zona/monstro).
export function findZoneForMonster(kind, monsterId) {
  if (kind === 'boss') return ZONES.find((z) => z.boss.id === monsterId) || null;
  return ZONES.find((z) => z.weakMonsters.some((m) => m.id === monsterId)) || null;
}

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
