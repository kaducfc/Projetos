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
    materials: {
      primary1: { id: 'chispim_heart', name: 'Coração de Chispim', emoji: '❤️' },
      primary2: { id: 'chispim_whisker', name: 'Bigode Condutor', emoji: '⚡' },
    },
    crystal: { id: 'chispim_crystal', name: 'Cristal de Chispim', emoji: '💎' },
  },
  {
    stage: 20,
    id: 'solkaiser',
    name: 'Solkaiser',
    element: 'fogo',
    emoji: '🦅',
    image: 'assets/solkaiser/monster.png',
    materials: {
      primary1: { id: 'solkaiser_feather', name: 'Pena de Solkaiser', emoji: '🪶', image: 'assets/solkaiser/pena.png' },
      primary2: { id: 'solkaiser_core', name: 'Núcleo Solar', emoji: '☀️', image: 'assets/solkaiser/nucleo.png' },
    },
    crystal: { id: 'solkaiser_crystal', name: 'Cristal de Solkaiser', emoji: '💎' },
  },
  {
    stage: 30,
    id: 'tartarok',
    name: 'Tartarok',
    element: 'agua',
    emoji: '🐢',
    image: 'assets/tartarok/monster.png',
    materials: {
      primary1: { id: 'tartarok_shell', name: 'Casco de Tartarok', emoji: '🐚', image: 'assets/tartarok/casco.png' },
      primary2: { id: 'tartarok_pearl', name: 'Pérola Primordial', emoji: '⚪', image: 'assets/tartarok/perola.png' },
    },
    crystal: { id: 'tartarok_crystal', name: 'Cristal de Tartarok', emoji: '💎' },
  },
  {
    stage: 40,
    id: 'colhedor_carmesim',
    name: 'Colhedor Carmesim',
    element: 'planta',
    emoji: '🌺',
    image: 'assets/colhedor_carmesim/monster.png',
    materials: {
      // id kept as colhedor_carmesim_scythe (save-file key) even though the
      // item was re-arted/renamed from "Foice Carmesim" to "Rosa Escarlate".
      primary1: { id: 'colhedor_carmesim_scythe', name: 'Rosa Escarlate', emoji: '🌹', image: 'assets/colhedor_carmesim/rosa.png' },
      primary2: { id: 'colhedor_carmesim_root', name: 'Raiz Sanguínea', emoji: '🩸', image: 'assets/colhedor_carmesim/raiz.png' },
    },
    crystal: { id: 'colhedor_carmesim_crystal', name: 'Cristal do Colhedor Carmesim', emoji: '💎' },
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
    crystal: { id: 'grommuk_crystal', name: 'Cristal de Grommuk', emoji: '💎' },
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
    crystal: { id: 'vulkarion_crystal', name: 'Cristal de Vulkarion', emoji: '💎' },
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
    crystal: { id: 'leviargon_crystal', name: 'Cristal de Leviargon', emoji: '💎' },
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
    crystal: { id: 'tempestron_crystal', name: 'Cristal de Tempestron', emoji: '💎' },
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
    crystal: { id: 'gaiatron_crystal', name: 'Cristal de Gaiatron', emoji: '💎' },
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
    crystal: { id: 'bahamorth_crystal', name: 'Cristal de Bahamorth', emoji: '💎' },
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
      { id: 'braslimo', name: 'Braslimo', element: 'fogo', emoji: '🔥', material: { id: 'braslimo_gel', name: 'Gel Incandescente', emoji: '🟠' } },
      { id: 'cristalino', name: 'Cristalino', element: 'agua', emoji: '🔷', material: { id: 'cristalino_shard', name: 'Fragmento de Cristal', emoji: '💠' } },
      { id: 'espinhoco', name: 'Espinhoco', element: 'neutro', emoji: '🦔', material: { id: 'espinhoco_thorn', name: 'Espinho Afiado', emoji: '🌵' } },
      { id: 'tronk', name: 'Tronk', element: 'planta', emoji: '🌳', material: { id: 'tronk_wood', name: 'Madeira Viva', emoji: '🪵' } },
      { id: 'aracneon', name: 'Aracneon', element: 'eletrico', emoji: '🕷️', material: { id: 'aracneon_silk', name: 'Seda Elétrica', emoji: '⚡' } },
    ],
  },
  {
    startStage: 21,
    endStage: 39,
    monsters: [
      { id: 'volpix', name: 'Volpix', element: 'fogo', emoji: '🦊', material: { id: 'volpix_fur', name: 'Pelo Flamejante', emoji: '🔥' } },
      { id: 'cascafria', name: 'Cascafria', element: 'agua', emoji: '🐢', material: { id: 'cascafria_shell', name: 'Casco Congelado', emoji: '❄️' } },
      { id: 'grunco', name: 'Grunco', element: 'neutro', emoji: '🐗', material: { id: 'grunco_hide', name: 'Couro Grosso', emoji: '🟤' } },
      { id: 'cogumeloide', name: 'Cogumeloide', element: 'planta', emoji: '🍄', material: { id: 'cogumeloide_fiber', name: 'Fibra Fúngica', emoji: '🍄' } },
      { id: 'faisca', name: 'Faísca', element: 'eletrico', emoji: '🐿️', material: { id: 'faisca_core', name: 'Núcleo Elétrico', emoji: '🔋' } },
    ],
  },
  {
    startStage: 41,
    endStage: 59,
    monsters: [
      { id: 'lamel', name: 'Lamel', element: 'fogo', emoji: '🦎', material: { id: 'lamel_scale', name: 'Escama Flamejante', emoji: '🔥' } },
      { id: 'marrelho', name: 'Marrelho', element: 'agua', emoji: '🦀', material: { id: 'marrelho_claw', name: 'Garra Marinha', emoji: '🦀' } },
      { id: 'casquelo', name: 'Casquelo', element: 'neutro', emoji: '🐌', material: { id: 'casquelo_shell', name: 'Casco Rochoso', emoji: '🪨' } },
      { id: 'folhante', name: 'Folhante', element: 'planta', emoji: '🌿', material: { id: 'folhante_leaf', name: 'Folha Carnívora', emoji: '🌿' } },
      { id: 'dentelha', name: 'Dentelha', element: 'eletrico', emoji: '🐟', material: { id: 'dentelha_fang', name: 'Presa Elétrica', emoji: '⚡' } },
    ],
  },
  {
    startStage: 61,
    endStage: 79,
    monsters: [
      { id: 'pimpira', name: 'Pimpira', element: 'fogo', emoji: '🦋', material: { id: 'pimpira_wing', name: 'Asa Flamejante', emoji: '🔥' } },
      { id: 'bolhumo', name: 'Bolhumo', element: 'agua', emoji: '🫧', material: { id: 'bolhumo_essence', name: 'Essência Aquática', emoji: '💧' } },
      { id: 'escamito', name: 'Escamito', element: 'neutro', emoji: '🦎', material: { id: 'escamito_scale', name: 'Escama Metálica', emoji: '⚙️' } },
      { id: 'muskar', name: 'Muskar', element: 'planta', emoji: '🦫', material: { id: 'muskar_fur', name: 'Pelo Musgoso', emoji: '🌿' } },
      { id: 'voltouro', name: 'Voltouro', element: 'eletrico', emoji: '🦏', material: { id: 'voltouro_horn', name: 'Chifre Condutor', emoji: '⚡' } },
    ],
  },
  {
    startStage: 81,
    endStage: 100,
    monsters: [
      { id: 'carvao', name: 'Carvão', element: 'fogo', emoji: '⚫', material: { id: 'carvao_vivo', name: 'Carvão Vivo', emoji: '🔥' } },
      { id: 'serpilha', name: 'Serpilha', element: 'agua', emoji: '🐍', material: { id: 'serpilha_skin', name: 'Pele Escamosa', emoji: '💧' } },
      { id: 'cascudon', name: 'Cascudon', element: 'neutro', emoji: '🐢', material: { id: 'cascudon_shell', name: 'Carapaça Grossa', emoji: '🛡️' } },
      { id: 'esporim', name: 'Esporim', element: 'planta', emoji: '🍄', material: { id: 'esporim_spore', name: 'Esporo Venenoso', emoji: '☠️' } },
      { id: 'ventrix', name: 'Ventrix', element: 'eletrico', emoji: '🦅', material: { id: 'ventrix_feather', name: 'Pena Celeste', emoji: '🪽' } },
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
    image: null,
    element: weak.element,
    isBoss: false,
    isWeak: true,
  };
}
