// Monster families: each spans a block of stages (FAMILY_BLOCK wide). Beyond
// the last family, stages keep scaling forever and reuse the last family so
// progression never hard-caps. Independently, every BOSS_INTERVAL-th stage
// is a boss fight (so a family can have more than one boss checkpoint across
// its block, reusing the same boss identity at increasing difficulty).

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

// Filler monsters for non-boss stages (see isBossStage below): instead of
// showing the current family's own regular form, every non-boss kill now
// spawns a random pick from this shared pool. Placeholder roster of 5 for
// now — more will be added and this will get properly organized later, so
// keep this list easy to extend rather than tied to the family/tier system.
// Each drops exactly one material (no common/rare/gem split like families
// have), meant to feed into some equipment recipes once that's wired up.
// No element yet (kept 'neutro' in getMonsterInfo below) and no card yet —
// cards are per-family only for now (see data/cards.js).
export const WEAK_MONSTERS = [
  { id: 'bee', name: 'Abelha', emoji: '🐝', material: { id: 'bee_wax', name: 'Cera de Abelha', emoji: '🍯' } },
  { id: 'wildboar', name: 'Javali', emoji: '🐗', material: { id: 'wildboar_tusk', name: 'Presa de Javali', emoji: '🦷' } },
  { id: 'slime', name: 'Gosma', emoji: '🟢', material: { id: 'slime_goo', name: 'Gosma Viscosa', emoji: '🧫' } },
  { id: 'boulder', name: 'Pedregulho', emoji: '🪨', material: { id: 'boulder_pebble', name: 'Pedregulho Rachado', emoji: '🪨' } },
  { id: 'sheep', name: 'Ovelha', emoji: '🐑', material: { id: 'sheep_wool', name: 'Lã de Ovelha', emoji: '🧶' } },
];

export function pickRandomWeakMonster() {
  return WEAK_MONSTERS[Math.floor(Math.random() * WEAK_MONSTERS.length)];
}

export function getWeakMonster(id) {
  return WEAK_MONSTERS.find((m) => m.id === id) || WEAK_MONSTERS[0];
}

export function getFamilyForStage(stage) {
  for (const family of MONSTER_FAMILIES) {
    if (stage <= family.endStage) return family;
  }
  return MONSTER_FAMILIES[MONSTER_FAMILIES.length - 1];
}

export function isBossStage(stage) {
  return stage % BOSS_INTERVAL === 0;
}

/// weakMonsterId is the currently-spawned weak monster's id (persisted on
/// state, see combat.js ensureMonsterSpawned) — only meaningful on non-boss
/// stages. Boss stages always show the stage's family boss, exactly as
/// before; a weakMonsterId is ignored there.
export function getMonsterInfo(stage, weakMonsterId) {
  const boss = isBossStage(stage);

  if (!boss && weakMonsterId) {
    const weak = getWeakMonster(weakMonsterId);
    return {
      familyId: null,
      weakMonsterId: weak.id,
      name: weak.name,
      emoji: weak.emoji,
      image: null,
      element: 'neutro',
      isBoss: false,
      isWeak: true,
    };
  }

  const family = getFamilyForStage(stage);
  return {
    familyId: family.id,
    weakMonsterId: null,
    name: boss ? family.bossName : family.name,
    emoji: boss ? family.bossEmoji : family.emoji,
    image: family.image || null,
    element: family.element,
    isBoss: boss,
    isWeak: false,
  };
}
