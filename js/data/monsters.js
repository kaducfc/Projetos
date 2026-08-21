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
    // id ficam 'chispim'/'chispim_crystal' de propósito —
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
    // Campo morto — cenário de batalha agora vem sempre de ZONES[].sceneImage
    // (1 por zona, ver o topo do arquivo), nenhum boss tem cenário próprio.
    scene: null,
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
    // Rank de poder dentro da Zona 1 (ver WEAK_MONSTER_GROUPS acima e
    // monsterMaxHp/monsterDamagePerSecond/monsterGoldReward em
    // systems/combat.js) — 4 é só 1 degrau acima do GranClaw (rank 3),
    // ~6.5% mais forte, não o multiplicador de chefe de sempre.
    powerRank: 4,
  },
  {
    stage: 20,
    // id ficam 'solkaiser'/'solkaiser_crystal' de
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
    // Rank de poder dentro da Zona 2 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4
    // é só 1 degrau acima do Hydrakon (rank 3).
    powerRank: 4,
  },
  {
    stage: 30,
    // id ficam 'tartarok'/'tartarok_crystal' de
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
    // Rank de poder dentro da Zona 3 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4
    // é só 1 degrau acima do Mimicus (rank 3).
    powerRank: 4,
  },
  {
    stage: 40,
    // id ficam 'colhedor_carmesim'/
    // 'colhedor_carmesim_crystal' de propósito — mesmo reskin display-only
    // das outras 3 zonas acima (ver comentário no Chispim). Fecha a Zona 4
    // (Plasmion/Corcel da Tempestade/Sabion/Serpentorax, ver
    // WEAK_MONSTER_GROUPS acima) como o 5º e mais forte monstro.
    id: 'colhedor_carmesim',
    name: 'Eletyra',
    element: 'eletrico',
    emoji: '⚡',
    image: 'assets/eletyra/monster.png',
    // Sem animação de frames (só 1 imagem estática recebida).
    animFrames: null,
    spriteScale: 2.1,
    // Só 1 material de drop de verdade (Círculo da Tempestade) — mesmo
    // truque das outras 3 zonas (primary1/primary2 apontam pro mesmo id).
    materials: {
      primary1: { id: 'colhedor_carmesim_scythe', name: 'Círculo da Tempestade', emoji: '🌀', image: 'assets/eletyra/circulo.png' },
      primary2: { id: 'colhedor_carmesim_scythe', name: 'Círculo da Tempestade', emoji: '🌀', image: 'assets/eletyra/circulo.png' },
    },
    // Rank de poder dentro da Zona 4 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4
    // é só 1 degrau acima do Serpentorax (rank 3).
    powerRank: 4,
  },
  {
    stage: 50,
    // id ficam 'grommuk'/'grommuk_crystal' de propósito —
    // mesmo reskin display-only das Zonas 1-4 acima (ver comentário no
    // Chispim). Fecha a Zona 5 (Lavasalam/Fornitus/Emberimp/Ember Warden,
    // ver WEAK_MONSTER_GROUPS abaixo) como o 5º e mais forte monstro.
    id: 'grommuk',
    name: 'Pyravalis',
    element: 'fogo',
    emoji: '🔥',
    image: 'assets/pyravalis/monster.png',
    // Sem animação de frames (só 1 imagem estática recebida).
    animFrames: null,
    spriteScale: 2.1,
    // Só 1 material de drop de verdade (Pena Ígnea) — mesmo truque das
    // outras 4 zonas (primary1/primary2 apontam pro mesmo id).
    materials: {
      primary1: { id: 'grommuk_fang', name: 'Pena Ígnea', emoji: '🪶', image: 'assets/pyravalis/pena.png' },
      primary2: { id: 'grommuk_fang', name: 'Pena Ígnea', emoji: '🪶', image: 'assets/pyravalis/pena.png' },
    },
    // Rank de poder dentro da Zona 5 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4 é
    // só 1 degrau acima do Ember Warden (rank 3).
    powerRank: 4,
  },
  {
    stage: 60,
    // id ficam 'vulkarion'/'vulkarion_crystal' de
    // propósito — mesmo reskin display-only das Zonas 1-5 acima (ver
    // comentário no Chispim). Fecha a Zona 6 (Luxoris/Ecliptor/Thundrak/
    // Minotauro do Trovão, ver WEAK_MONSTER_GROUPS abaixo) como o 5º e mais
    // forte monstro.
    id: 'vulkarion',
    name: 'Vortexor',
    element: 'eletrico',
    emoji: '🌀',
    image: 'assets/vortexor/monster.png',
    // Sem animação de frames (só 1 imagem estática recebida).
    animFrames: null,
    spriteScale: 2.1,
    // Só 1 material de drop de verdade (Talismã do Vortexor) — mesmo
    // truque das outras 4 zonas (primary1/primary2 apontam pro mesmo id).
    materials: {
      primary1: { id: 'vulkarion_horn', name: 'Talismã do Vortexor', emoji: '🌀', image: 'assets/vortexor/talisma.png' },
      primary2: { id: 'vulkarion_horn', name: 'Talismã do Vortexor', emoji: '🌀', image: 'assets/vortexor/talisma.png' },
    },
    // Rank de poder dentro da Zona 6 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4 é
    // só 1 degrau acima do Minotauro do Trovão (rank 3).
    powerRank: 4,
  },
  {
    stage: 70,
    // id ficam 'leviargon'/'leviargon_crystal' de
    // propósito — mesmo reskin display-only das Zonas 1-6 acima (ver
    // comentário no Chispim). Fecha a Zona 7 (Pyrorian/Infernus/Sentinela
    // de Magma/Ignivoran, ver WEAK_MONSTER_GROUPS abaixo) como o 5º e mais
    // forte monstro.
    id: 'leviargon',
    name: 'Magmarok',
    element: 'fogo',
    emoji: '🌋',
    image: 'assets/magmarok/monster.png',
    // Sem animação de frames (só 1 imagem estática recebida).
    animFrames: null,
    spriteScale: 2.1,
    // Só 1 material de drop de verdade (Fragmento de Magmarok) — mesmo
    // truque das outras zonas (primary1/primary2 apontam pro mesmo id).
    materials: {
      primary1: { id: 'leviargon_fin', name: 'Fragmento de Magmarok', emoji: '🌋', image: 'assets/magmarok/fragmento.png' },
      primary2: { id: 'leviargon_fin', name: 'Fragmento de Magmarok', emoji: '🌋', image: 'assets/magmarok/fragmento.png' },
    },
    // Rank de poder dentro da Zona 7 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4 é
    // só 1 degrau acima do Ignivoran (rank 3).
    powerRank: 4,
  },
  {
    stage: 80,
    // id ficam 'tempestron'/'tempestron_crystal' de
    // propósito — mesmo reskin display-only das Zonas 1-7 acima (ver
    // comentário no Chispim). Fecha a Zona 8 (Capitão Marvik/Abissorrok/
    // Thalassok/Serpentyra, ver WEAK_MONSTER_GROUPS acima) como o 5º e mais
    // forte monstro.
    id: 'tempestron',
    name: 'Hidraelion',
    element: 'agua',
    emoji: '🐙',
    image: 'assets/hidraelion/monster.png',
    // Sem animação de frames (só 1 imagem estática recebida).
    animFrames: null,
    spriteScale: 2.1,
    // Só 1 material de drop de verdade (Núcleo de Hidraelion) — mesmo
    // truque das outras zonas (primary1/primary2 apontam pro mesmo id).
    materials: {
      primary1: { id: 'tempestron_heart', name: 'Núcleo de Hidraelion', emoji: '🔮', image: 'assets/hidraelion/nucleo.png' },
      primary2: { id: 'tempestron_heart', name: 'Núcleo de Hidraelion', emoji: '🔮', image: 'assets/hidraelion/nucleo.png' },
    },
    // Rank de poder dentro da Zona 8 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4 é
    // só 1 degrau acima do Serpentyra (rank 3).
    powerRank: 4,
  },
  {
    stage: 90,
    // id ficam 'gaiatron'/'gaiatron_crystal' de propósito
    // — mesmo reskin display-only das Zonas 1-8 acima (ver comentário no
    // Chispim). Fecha a Zona 9 (Thornviel/Verdanthra/Guardião Verdor/
    // Granvorok, ver WEAK_MONSTER_GROUPS acima) como o 5º e mais forte
    // monstro.
    id: 'gaiatron',
    name: 'Florakar',
    element: 'planta',
    emoji: '🌳',
    image: 'assets/florakar/monster.png',
    // Sem animação de frames (só 1 imagem estática recebida).
    animFrames: null,
    spriteScale: 2.1,
    // Só 1 material de drop de verdade (Garra de Florakar) — mesmo truque
    // das outras zonas (primary1/primary2 apontam pro mesmo id).
    materials: {
      primary1: { id: 'gaiatron_branch', name: 'Garra de Florakar', emoji: '🌿', image: 'assets/florakar/garra.png' },
      primary2: { id: 'gaiatron_branch', name: 'Garra de Florakar', emoji: '🌿', image: 'assets/florakar/garra.png' },
    },
    // Rank de poder dentro da Zona 9 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4 é
    // só 1 degrau acima do Granvorok (rank 3).
    powerRank: 4,
  },
  {
    stage: 100,
    // id ficam 'bahamorth'/'bahamorth_crystal' de
    // propósito — mesmo reskin display-only das Zonas 1-9 acima (ver
    // comentário no Chispim). Fecha a Zona 10 (Draxorian/Grommash/
    // Morvanthal/Aurelion, ver WEAK_MONSTER_GROUPS acima) como o 5º e mais
    // forte monstro.
    id: 'bahamorth',
    name: 'Malgorath',
    element: 'neutro',
    emoji: '🗡️',
    image: 'assets/malgorath/monster.png',
    // Sem animação de frames (só 1 imagem estática recebida).
    animFrames: null,
    spriteScale: 2.1,
    // Só 1 material de drop de verdade (Espada do Vazio Eterno) — mesmo
    // truque das outras zonas (primary1/primary2 apontam pro mesmo id).
    materials: {
      primary1: { id: 'bahamorth_scale', name: 'Espada do Vazio Eterno', emoji: '🗡️', image: 'assets/malgorath/espada.png' },
      primary2: { id: 'bahamorth_scale', name: 'Espada do Vazio Eterno', emoji: '🗡️', image: 'assets/malgorath/espada.png' },
    },
    // Rank de poder dentro da Zona 10 (ver monsterMaxHp/
    // monsterDamagePerSecond/monsterGoldReward em systems/combat.js) — 4 é
    // só 1 degrau acima do Aurelion (rank 3).
    powerRank: 4,
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
  // Zona 4 (stage 30-39) — mesmo tratamento das Zonas 1/2/3: 4 monstros
  // próprios, elemento Elétrico, cada um um pouco mais forte que o
  // anterior (powerRank). O 5º e mais forte (Eletyra) é o chefe da zona
  // (ver BOSSES[3] abaixo).
  {
    startStage: 30,
    endStage: 39,
    monsters: [
      { id: 'plasmion', name: 'Plasmion', element: 'eletrico', emoji: '⚡', image: 'assets/plasmion/monster.png', powerRank: 0, spriteScale: 2.1, material: { id: 'plasmion_core', name: 'Núcleo Plasmático', emoji: '🔮', image: 'assets/plasmion/nucleo.png' } },
      { id: 'corcel_tempestade', name: 'Corcel da Tempestade', element: 'eletrico', emoji: '🐴', image: 'assets/corcel_tempestade/monster.png', powerRank: 1, spriteScale: 2.1, material: { id: 'corcel_tempestade_horseshoe', name: 'Ferradura Trovejante', emoji: '🧲', image: 'assets/corcel_tempestade/ferradura.png' } },
      { id: 'sabion', name: 'Sabion', element: 'eletrico', emoji: '🧙', image: 'assets/sabion/monster.png', powerRank: 2, spriteScale: 2.1, material: { id: 'sabion_scepter', name: 'Cetro do Oráculo', emoji: '🪄', image: 'assets/sabion/cetro.png' } },
      { id: 'serpentorax', name: 'Serpentorax', element: 'eletrico', emoji: '🐍', image: 'assets/serpentorax/monster.png', powerRank: 3, spriteScale: 2.1, material: { id: 'serpentorax_scale', name: 'Escama Trovejante', emoji: '🟡', image: 'assets/serpentorax/escama.png' } },
    ],
  },
  // Zona 5 (stage 41-49) — mesmo tratamento das Zonas 1-4 acima: 4 monstros
  // próprios, elemento Fogo (mesmo do chefe da zona), cada um um pouco mais
  // forte que o anterior (powerRank). O 5º e mais forte (Pyravalis) é o
  // chefe da zona (ver BOSSES[4] acima — id interno 'grommuk', mantido por
  // compatibilidade).
  {
    startStage: 41,
    endStage: 49,
    monsters: [
      { id: 'lavasalam', name: 'Lavasalam', element: 'fogo', emoji: '🦎', image: 'assets/lavasalam/monster.png', powerRank: 0, spriteScale: 2.1, material: { id: 'lavasalam_drop', name: 'Gota de Lava Pura', emoji: '🔥', image: 'assets/lavasalam/gota.png' } },
      { id: 'fornitus', name: 'Fornitus', element: 'fogo', emoji: '🌋', image: 'assets/fornitus/monster.png', powerRank: 1, spriteScale: 2.1, material: { id: 'fornitus_core', name: 'Núcleo de Magma', emoji: '🟠', image: 'assets/fornitus/nucleo.png' } },
      { id: 'emberimp', name: 'Emberimp', element: 'fogo', emoji: '👺', image: 'assets/emberimp/monster.png', powerRank: 2, spriteScale: 2.1, material: { id: 'emberimp_ember', name: 'Fragmento de Brasa', emoji: '🔥', image: 'assets/emberimp/fragmento.png' } },
      { id: 'ember_warden', name: 'Ember Warden', element: 'fogo', emoji: '🛡️', image: 'assets/ember_warden/monster.png', powerRank: 3, spriteScale: 2.1, material: { id: 'ember_warden_blade', name: 'Lâmina Encandescente', emoji: '⚔️', image: 'assets/ember_warden/lamina.png' } },
    ],
  },
  // Zona 6 (stage 51-59) — mesmo tratamento das Zonas 1-5 acima: 4 monstros
  // próprios, elemento Elétrico (mesmo do chefe da zona), cada um um pouco
  // mais forte que o anterior (powerRank). O 5º e mais forte (Vortexor) é
  // o chefe da zona (ver BOSSES[5] acima — id interno 'vulkarion', mantido
  // por compatibilidade).
  {
    startStage: 51,
    endStage: 59,
    monsters: [
      { id: 'luxoris', name: 'Luxoris', element: 'eletrico', emoji: '🌿', image: 'assets/luxoris/monster.png', powerRank: 0, spriteScale: 2.1, material: { id: 'luxoris_branch', name: 'Galhos de Luxoris', emoji: '🌿', image: 'assets/luxoris/galhos.png' } },
      { id: 'ecliptor', name: 'Ecliptor', element: 'eletrico', emoji: '🌒', image: 'assets/ecliptor/monster.png', powerRank: 1, spriteScale: 2.1, material: { id: 'ecliptor_chain', name: 'Corrente do Eclipse', emoji: '⛓️', image: 'assets/ecliptor/corrente.png' } },
      { id: 'thundrak', name: 'Thundrak', element: 'eletrico', emoji: '🐉', image: 'assets/thundrak/monster.png', powerRank: 2, spriteScale: 2.1, material: { id: 'thundrak_horn', name: 'Chifre Trovejante', emoji: '⚡', image: 'assets/thundrak/chifre.png' } },
      { id: 'minotauro_trovao', name: 'Minotauro do Trovão', element: 'eletrico', emoji: '🐂', image: 'assets/minotauro_trovao/monster.png', powerRank: 3, spriteScale: 2.1, material: { id: 'minotauro_trovao_hammer', name: 'Martelo Trovejante', emoji: '🔨', image: 'assets/minotauro_trovao/martelo.png' } },
    ],
  },
  // Zona 7 (stage 61-69) — mesmo tratamento das Zonas 1-6 acima: 4 monstros
  // próprios, elemento Fogo (mesmo do chefe da zona), cada um um pouco mais
  // forte que o anterior (powerRank). O 5º e mais forte (Magmarok) é o
  // chefe da zona (ver BOSSES[6] acima — id interno 'leviargon', mantido
  // por compatibilidade).
  {
    startStage: 61,
    endStage: 69,
    monsters: [
      { id: 'pyrorian', name: 'Pyrorian', element: 'fogo', emoji: '🔥', image: 'assets/pyrorian/monster.png', powerRank: 0, spriteScale: 2.1, material: { id: 'pyrorian_staff', name: 'Cajado Ígneo', emoji: '🔥', image: 'assets/pyrorian/cajado.png' } },
      { id: 'infernus', name: 'Infernus', element: 'fogo', emoji: '👹', image: 'assets/infernus/monster.png', powerRank: 1, spriteScale: 2.1, material: { id: 'infernus_axe', name: 'Machado Abissal', emoji: '🪓', image: 'assets/infernus/machado.png' } },
      { id: 'sentinela_magma', name: 'Sentinela de Magma', element: 'fogo', emoji: '🗿', image: 'assets/sentinela_magma/monster.png', powerRank: 2, spriteScale: 2.1, material: { id: 'sentinela_magma_shield', name: 'Escudo da Rocha Vulcânica', emoji: '🛡️', image: 'assets/sentinela_magma/escudo.png' } },
      { id: 'ignivoran', name: 'Ignivoran', element: 'fogo', emoji: '🦅', image: 'assets/ignivoran/monster.png', powerRank: 3, spriteScale: 2.1, material: { id: 'ignivoran_feather', name: 'Pena de Ignivoran', emoji: '🪶', image: 'assets/ignivoran/pena.png' } },
    ],
  },
  // Zona 8 (stage 71-79) — mesmo tratamento das Zonas 1-7 acima: 4 monstros
  // próprios, elemento Água (mesmo do chefe da zona), cada um um pouco mais
  // forte que o anterior (powerRank). O 5º e mais forte (Hidraelion) é o
  // chefe da zona (ver BOSSES[7] abaixo — id interno 'tempestron', mantido
  // por compatibilidade).
  {
    startStage: 71,
    endStage: 79,
    monsters: [
      { id: 'capitao_marvik', name: 'Capitão Marvik', element: 'agua', emoji: '🏴‍☠️', image: 'assets/capitao_marvik/monster.png', powerRank: 0, spriteScale: 2.1, material: { id: 'capitao_marvik_anchor', name: 'Âncora do Abismo', emoji: '⚓', image: 'assets/capitao_marvik/ancora.png' } },
      { id: 'abissorrok', name: 'Abissorrok', element: 'agua', emoji: '🐙', image: 'assets/abissorrok/monster.png', powerRank: 1, spriteScale: 2.1, material: { id: 'abissorrok_hammer', name: 'Marreta Abissal', emoji: '🔨', image: 'assets/abissorrok/marreta.png' } },
      { id: 'thalassok', name: 'Thalassok', element: 'agua', emoji: '🦑', image: 'assets/thalassok/monster.png', powerRank: 2, spriteScale: 2.1, material: { id: 'thalassok_pearls', name: 'Pérolas das Profundezas', emoji: '⚪', image: 'assets/thalassok/perolas.png' } },
      { id: 'serpentyra', name: 'Serpentyra', element: 'agua', emoji: '🐍', image: 'assets/serpentyra/monster.png', powerRank: 3, spriteScale: 2.1, material: { id: 'serpentyra_trident', name: 'Tridente da Serpente', emoji: '🔱', image: 'assets/serpentyra/tridente.png' } },
    ],
  },
  // Zona 9 (stage 81-89) — mesmo tratamento das Zonas 1-8 acima: 4 monstros
  // próprios, elemento Planta (mesmo do chefe da zona), cada um um pouco
  // mais forte que o anterior (powerRank). O 5º e mais forte (Florakar) é
  // o chefe da zona (ver BOSSES[8] abaixo — id interno 'gaiatron', mantido
  // por compatibilidade).
  {
    startStage: 81,
    endStage: 89,
    monsters: [
      { id: 'thornviel', name: 'Thornviel', element: 'planta', emoji: '🥷', image: 'assets/thornviel/monster.png', powerRank: 0, spriteScale: 2.1, material: { id: 'thornviel_hood', name: 'Capuz da Folhagem Sombria', emoji: '🌿', image: 'assets/thornviel/capuz.png' } },
      { id: 'verdanthra', name: 'Verdanthra', element: 'planta', emoji: '🌱', image: 'assets/verdanthra/monster.png', powerRank: 1, spriteScale: 2.1, material: { id: 'verdanthra_core', name: 'Núcleo da Fome Verde', emoji: '🟢', image: 'assets/verdanthra/nucleo.png' } },
      { id: 'guardiao_verdor', name: 'Guardião Verdor', element: 'planta', emoji: '🗿', image: 'assets/guardiao_verdor/monster.png', powerRank: 2, spriteScale: 2.1, material: { id: 'guardiao_verdor_shield', name: 'Escudo do Guardião Eterno', emoji: '🛡️', image: 'assets/guardiao_verdor/escudo.png' } },
      { id: 'granvorok', name: 'Granvorok', element: 'planta', emoji: '🐗', image: 'assets/granvorok/monster.png', powerRank: 3, spriteScale: 2.1, material: { id: 'granvorok_crystal', name: 'Fragmento de Cristal Vivo', emoji: '💠', image: 'assets/granvorok/fragmento.png' } },
    ],
  },
  // Zona 10 (stage 91-99) — mesmo tratamento das Zonas 1-9 acima: 4 monstros
  // próprios, elemento Neutro (mesmo do chefe da zona), cada um um pouco
  // mais forte que o anterior (powerRank). O 5º e mais forte (Malgorath) é
  // o chefe da zona (ver BOSSES[9] abaixo — id interno 'bahamorth', mantido
  // por compatibilidade).
  {
    startStage: 91,
    endStage: 99,
    monsters: [
      { id: 'draxorian', name: 'Draxorian', element: 'neutro', emoji: '🐉', image: 'assets/draxorian/monster.png', powerRank: 0, spriteScale: 2.1, material: { id: 'draxorian_chest', name: 'Peitoral do Devastador', emoji: '🛡️', image: 'assets/draxorian/peitoral.png' } },
      { id: 'grommash', name: 'Grommash', element: 'neutro', emoji: '👹', image: 'assets/grommash/monster.png', powerRank: 1, spriteScale: 2.1, material: { id: 'grommash_crown', name: 'Coroa do Colosso', emoji: '👑', image: 'assets/grommash/coroa.png' } },
      { id: 'morvanthal', name: 'Morvanthal', element: 'neutro', emoji: '💀', image: 'assets/morvanthal/monster.png', powerRank: 2, spriteScale: 2.1, material: { id: 'morvanthal_scepter', name: 'Cetro do Domínio Ósseo', emoji: '🦴', image: 'assets/morvanthal/cetro.png' } },
      { id: 'aurelion', name: 'Aurelion', element: 'neutro', emoji: '👼', image: 'assets/aurelion/monster.png', powerRank: 3, spriteScale: 2.1, material: { id: 'aurelion_spear', name: 'Lança da Sinfonia Celestial', emoji: '🗡️', image: 'assets/aurelion/lanca.png' } },
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
/// every source that can produce one — boss "drop principal", weak
/// monster material, or (for saves/inventory predating the boss-roster
/// rebuild) the old MONSTER_FAMILIES common/rare/gem. Used wherever a UI
/// needs to show a material it only knows the id of (e.g. a crafting
/// recipe's cost line), instead of each caller re-deriving which roster it
/// came from.
export function findMaterialInfo(materialId) {
  for (const boss of BOSSES) {
    if (boss.materials.primary1.id === materialId) return boss.materials.primary1;
    if (boss.materials.primary2.id === materialId) return boss.materials.primary2;
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

// Nome + cenário de fundo próprio por zona (1 imagem fixa cada) —
// substitui os 3 cenários genéricos sorteados aleatoriamente que existiam
// antes (ver ui/render.js). Caminhos escritos como literais completos (não
// via template `zone${n}.jpg`) de propósito — build-bundle.mjs só inlina
// como base64 os literais 'assets/...' que consegue casar por regex no
// texto-fonte, uma interpolação dinâmica passaria despercebida e quebraria
// o build publicado.
const ZONE_INFO = [
  { name: 'Fenda da Raiz Gigante', sceneImage: 'assets/ui/scenes/zone1.jpg' },
  { name: 'Trilha da Cachoeira', sceneImage: 'assets/ui/scenes/zone2.jpg' },
  { name: 'Catacumbas Antigas', sceneImage: 'assets/ui/scenes/zone3.jpg' },
  { name: 'Vale dos Ventos Elétricos', sceneImage: 'assets/ui/scenes/zone4.jpg' },
  { name: 'Floresta Incandescente', sceneImage: 'assets/ui/scenes/zone5.jpg' },
  { name: 'Gruta dos Cristais', sceneImage: 'assets/ui/scenes/zone6.jpg' },
  { name: 'Deserto Abrasador', sceneImage: 'assets/ui/scenes/zone7.jpg' },
  { name: 'Túnel Subterrâneo', sceneImage: 'assets/ui/scenes/zone8.jpg' },
  { name: 'Pântano da Corrupção', sceneImage: 'assets/ui/scenes/zone9.jpg' },
  { name: 'Ruína Cósmica', sceneImage: 'assets/ui/scenes/zone10.jpg' },
];

export const ZONES = BOSSES.map((boss, zoneIndex) => {
  const canonicalStage = (zoneIndex + 1) * ZONE_SIZE;
  const info = ZONE_INFO[zoneIndex] || { name: `Zona ${zoneIndex + 1}`, sceneImage: null };
  return {
    index: zoneIndex,
    name: info.name,
    sceneImage: info.sceneImage,
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

/// Acha QUEM dropa um material pelo id — chefe (2 materiais por chefe,
/// primary1/primary2) ou monstro fraco (1 cada) — devolvendo já pronto
/// { zoneIndex, kind, monsterId } pra alimentar state.selectedMonsters
/// (ver botão "Selecionar" no popup de aprimorar item, main.js
/// selectMonsterForMaterial). Um grupo de monstros fracos é compartilhado
/// por 2 zonas (ver comentário em WEAK_MONSTER_GROUPS) — pega sempre a
/// primeira (mais baixa) zona que bate, mesma escolha de findZoneForMonster
/// acima. null se o material não vier de monstro nenhum (ex: material de
/// evento/crafting sem drop de combate).
export function findMonsterSourceForMaterial(materialId) {
  for (const zone of ZONES) {
    if (zone.boss.materials.primary1.id === materialId || zone.boss.materials.primary2.id === materialId) {
      return { zoneIndex: zone.index, kind: 'boss', monsterId: zone.boss.id };
    }
    const weak = zone.weakMonsters.find((m) => m.material.id === materialId);
    if (weak) return { zoneIndex: zone.index, kind: 'weak', monsterId: weak.id };
  }
  return null;
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
