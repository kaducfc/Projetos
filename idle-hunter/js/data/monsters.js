// Monster families: each spans a block of stages. The last stage of each
// block is that family's boss. Beyond the last family, stages keep scaling
// forever and reuse the last family (bosses keep appearing every STAGE_BLOCK
// stages) so progression never hard-caps.

export const STAGE_BLOCK = 20;

export const MONSTER_FAMILIES = [
  {
    id: 'boar',
    name: 'Javali Selvagem',
    bossName: 'Javali Alfa',
    emoji: '🐗',
    bossEmoji: '🐗',
    startStage: 1,
    endStage: 20,
    weapon: { name: 'Lança de Presas', emoji: '🔱' },
    materials: {
      common: { id: 'boar_tusk', name: 'Presa de Javali', emoji: '🦷' },
      rare: { id: 'boar_alpha_hide', name: 'Couro do Javali Alfa', emoji: '🟫' },
    },
  },
  {
    id: 'wolf',
    name: 'Lobo das Sombras',
    bossName: 'Lobo Ancestral',
    emoji: '🐺',
    bossEmoji: '🐺',
    startStage: 21,
    endStage: 40,
    weapon: { name: 'Adagas Sombrias', emoji: '🗡️' },
    materials: {
      common: { id: 'wolf_fang', name: 'Presa de Lobo', emoji: '🦴' },
      rare: { id: 'wolf_ancestral_pelt', name: 'Pelagem Ancestral', emoji: '🌑' },
    },
  },
  {
    id: 'spider',
    name: 'Aranha Venenosa',
    bossName: 'Rainha Aranha',
    emoji: '🕷️',
    bossEmoji: '🕷️',
    startStage: 41,
    endStage: 60,
    weapon: { name: 'Arco Cravado de Veneno', emoji: '🏹' },
    materials: {
      common: { id: 'spider_silk', name: 'Teia Venenosa', emoji: '🕸️' },
      rare: { id: 'spider_queen_venom', name: 'Veneno da Rainha', emoji: '🧪' },
    },
  },
  {
    id: 'golem',
    name: 'Golem de Pedra',
    bossName: 'Golem Ancião',
    emoji: '🗿',
    bossEmoji: '🗿',
    startStage: 61,
    endStage: 80,
    weapon: { name: 'Martelo de Pedra', emoji: '🔨' },
    materials: {
      common: { id: 'golem_shard', name: 'Fragmento de Pedra', emoji: '🪨' },
      rare: { id: 'golem_core', name: 'Núcleo do Golem Ancião', emoji: '💠' },
    },
  },
  {
    id: 'wyvern',
    name: 'Wyvern de Gelo',
    bossName: 'Wyvern Rei',
    emoji: '🐉',
    bossEmoji: '🐉',
    startStage: 81,
    endStage: 100,
    weapon: { name: 'Machado Congelante', emoji: '🪓' },
    materials: {
      common: { id: 'wyvern_scale', name: 'Escama Congelante', emoji: '❄️' },
      rare: { id: 'wyvern_king_fang', name: 'Presa do Wyvern Rei', emoji: '🧊' },
    },
  },
  {
    id: 'dragon',
    name: 'Dragão Ancião',
    bossName: 'Dragão Primordial',
    emoji: '🐲',
    bossEmoji: '🐲',
    startStage: 101,
    endStage: 120,
    weapon: { name: 'Espada Flamejante', emoji: '⚔️' },
    materials: {
      common: { id: 'dragon_scale', name: 'Escama Draconiana', emoji: '🔴' },
      rare: { id: 'dragon_heart', name: 'Coração do Dragão Primordial', emoji: '❤️‍🔥' },
    },
  },
];

export function getFamilyForStage(stage) {
  for (const family of MONSTER_FAMILIES) {
    if (stage <= family.endStage) return family;
  }
  return MONSTER_FAMILIES[MONSTER_FAMILIES.length - 1];
}

export function isBossStage(stage) {
  return stage % STAGE_BLOCK === 0;
}

export function getMonsterInfo(stage) {
  const family = getFamilyForStage(stage);
  const boss = isBossStage(stage);
  return {
    familyId: family.id,
    name: boss ? family.bossName : family.name,
    emoji: boss ? family.bossEmoji : family.emoji,
    isBoss: boss,
  };
}
