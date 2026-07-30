// ---------------------------------------------------------------------
// Árvore de habilidades passivas — 3 classes (Arqueiro/Guerreiro/Mago), cada
// uma com sua própria árvore. 1 ponto por nível de caça (ver
// systems/leveling.js xpToNextLevel/grantXp) — os pontos em si nunca são
// guardados à parte, são sempre (hunterLevel - 1) menos o total já gasto
// (ver getTotalSkillPoints/getSpentSkillPoints em systems/skills.js), então
// não tem como duplicar bônus num reload nem ficar negativo.
//
// Formato de cada árvore: 5 ETAPAS, cada uma com 3 LINHAS normais (3
// habilidades cada, uma por COLUNA) + 1 linha ESPECIAL logo depois (3
// opções mutuamente exclusivas, só 1 pode ser comprada) que trava a etapa
// seguinte. Tudo gerado por tabela (colunas/valores por etapa) em vez de
// escrito à mão habilidade por habilidade — trocar um valor, nome ou
// quantidade de níveis é só mexer nas tabelas abaixo, sem tocar em
// systems/skills.js nem em stats.js.
//
// Orçamento: 3 linhas × 3 colunas × (2,2,3,3,4) níveis por etapa = 18+18+27+
// 27+36 = 126, + 4 especiais (1 ponto cada) = 130 pontos pra completar a
// árvore inteira, como pedido.
// ---------------------------------------------------------------------

export const SKILL_CLASSES = ['arqueiro', 'guerreiro', 'mago'];

export const CLASS_META = {
  arqueiro: { name: 'Arqueiro', emoji: '🏹', color: '#27ae60', description: 'Destreza, crítico e velocidade de ataque.' },
  guerreiro: { name: 'Guerreiro', emoji: '⚔️', color: '#c0392b', description: 'Força, vida e armadura.' },
  mago: { name: 'Mago', emoji: '🔮', color: '#2980b9', description: 'Inteligência, dano mágico e sorte.' },
};

// Nível máximo de cada habilidade normal, por etapa (0-based).
export const STAGE_MAX_LEVEL = [2, 2, 3, 3, 4];

// Pontos totais já gastos na árvore (soma de todas as habilidades normais +
// especiais compradas) necessários pra poder comprar o especial que destrava
// a etapa seguinte. 4 especiais (entre as 5 etapas — não tem especial depois
// da última).
export const SPECIAL_THRESHOLDS = [10, 30, 55, 80];

// Nomes exibidos por estágio/linha global (1ª linha da árvore inteira = I,
// última = XV) — só cosmético, pra toda habilidade não se chamar igual
// dentro da mesma etapa.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

// Nome legível de cada stat — reusado tanto pro nome gerado da habilidade
// quanto pra descrição (ver skillDescription em ui/render.js).
export const STAT_DISPLAY_NAME = {
  forca: 'Força',
  destreza: 'Destreza',
  inteligencia: 'Inteligência',
  hpFlat: 'Vida',
  hpPercent: 'Vida',
  armorFlat: 'Armadura',
  armorPercent: 'Armadura',
  danoFisicoFlat: 'Dano Físico',
  danoPerfuracaoFlat: 'Dano Perfurante',
  danoMagicoFlat: 'Dano Mágico',
  critChancePercent: 'Chance Crítica',
  critDamagePercent: 'Dano Crítico',
  attackSpeedPercent: 'Velocidade de Ataque',
  dodgePercent: 'Esquiva',
  goldPercent: 'Ouro Obtido',
  dropPercent: 'Materiais Obtidos',
  dpsPercent: 'DPS',
  lifestealFlat: 'Cura por Acerto',
};

const ATTRIBUTE_STATS = new Set(['forca', 'destreza', 'inteligencia']);
const PERCENT_STATS = new Set([
  'critChancePercent', 'critDamagePercent', 'attackSpeedPercent', 'dodgePercent',
  'goldPercent', 'dropPercent', 'dpsPercent', 'hpPercent', 'armorPercent',
]);

// Progressão por etapa (0-based) — ver enunciado: atributos base +1/+2/+3/
// +4/+5 por nível, percentuais 1%/2%/3%/4%/5% por nível (dentro da faixa
// pedida de 1-2/1.5-3/2-4/2.5-5/3-6). Stats "flat" (vida/armadura/dano/cura)
// não têm fórmula explícita no pedido — escalam na mesma proporção, em
// tabelas próprias, fáceis de re-tunar aqui sem mexer em mais nada.
const ATTRIBUTE_PER_LEVEL = [1, 2, 3, 4, 5];
const PERCENT_PER_LEVEL = [1, 2, 3, 4, 5];
const FLAT_PER_LEVEL = {
  hpFlat: [6, 12, 18, 24, 30],
  armorFlat: [3, 6, 9, 12, 15],
  danoFisicoFlat: [5, 10, 15, 20, 25],
  danoPerfuracaoFlat: [5, 10, 15, 20, 25],
  danoMagicoFlat: [5, 10, 15, 20, 25],
  lifestealFlat: [1, 2, 3, 4, 5],
};

function valuePerLevel(stat, stageIndex) {
  if (ATTRIBUTE_STATS.has(stat)) return ATTRIBUTE_PER_LEVEL[stageIndex];
  if (PERCENT_STATS.has(stat)) return PERCENT_PER_LEVEL[stageIndex];
  if (FLAT_PER_LEVEL[stat]) return FLAT_PER_LEVEL[stat][stageIndex];
  throw new Error(`Sem tabela de progressão pro stat ${stat}`);
}

/// Monta a árvore inteira de uma classe a partir de 3 "colunas": colA é o
/// mesmo stat em toda linha (o atributo da classe, aparece nas 15 linhas —
/// "deve aparecer com frequência em todas as etapas"); colB/colC alternam
/// entre os stats da lista, um por linha dentro da etapa (linha 1 usa
/// index 0, linha 2 usa index 1, linha 3 usa index 2, repete a cada etapa).
function buildClassTree(classId, colA, colBRotation, colCRotation, specialsByStage) {
  const stages = STAGE_MAX_LEVEL.map((maxLevel, stageIndex) => {
    const rows = [0, 1, 2].map((rowIndex) => {
      const globalRow = stageIndex * 3 + rowIndex; // 0..14
      const cols = [colA, colBRotation[rowIndex], colCRotation[rowIndex]];
      return cols.map((stat, colIndex) => {
        const perLevel = valuePerLevel(stat, stageIndex);
        return {
          id: `${classId}_${stageIndex}_${rowIndex}_${colIndex}`,
          classId,
          stageIndex,
          rowIndex,
          colIndex,
          stat,
          name: `${STAT_DISPLAY_NAME[stat]} ${ROMAN[globalRow]}`,
          maxLevel,
          perLevel,
        };
      });
    });
    const special = specialsByStage[stageIndex] ? {
      stageIndex,
      threshold: SPECIAL_THRESHOLDS[stageIndex],
      options: specialsByStage[stageIndex].map((opt, optionIndex) => ({
        id: `${classId}_special${stageIndex}_${optionIndex}`,
        classId,
        stageIndex,
        optionIndex,
        name: opt.name,
        bonuses: opt.bonuses,
      })),
    } : null;
    return { stageIndex, maxLevel, rows, special };
  });
  return { classId, stages };
}

// ---------------------------------------------------------------------
// ARQUEIRO — Destreza sempre na coluna A. Coluna B alterna Dano Perfurante/
// Chance Crítica/Dano Crítico; coluna C alterna Velocidade de Ataque/
// Esquiva/DPS.
// ---------------------------------------------------------------------
const ARQUEIRO_TREE = buildClassTree(
  'arqueiro',
  'destreza',
  ['danoPerfuracaoFlat', 'critChancePercent', 'critDamagePercent'],
  ['attackSpeedPercent', 'dodgePercent', 'dpsPercent'],
  [
    [
      { name: 'Precisão Aguçada', bonuses: [{ stat: 'destreza', value: 4 }, { stat: 'critChancePercent', value: 3 }] },
      { name: 'Reflexos Rápidos', bonuses: [{ stat: 'destreza', value: 4 }, { stat: 'attackSpeedPercent', value: 3 }] },
      { name: 'Golpe Perfurante', bonuses: [{ stat: 'danoPerfuracaoFlat', value: 15 }, { stat: 'critDamagePercent', value: 4 }] },
    ],
    [
      { name: 'Olho de Falcão', bonuses: [{ stat: 'destreza', value: 8 }, { stat: 'critChancePercent', value: 5 }, { stat: 'critDamagePercent', value: 5 }] },
      { name: 'Passo Fantasma', bonuses: [{ stat: 'destreza', value: 8 }, { stat: 'dodgePercent', value: 5 }, { stat: 'attackSpeedPercent', value: 4 }] },
      { name: 'Chuva de Flechas', bonuses: [{ stat: 'danoPerfuracaoFlat', value: 30 }, { stat: 'dpsPercent', value: 6 }] },
    ],
    [
      { name: 'Instinto Predador', bonuses: [{ stat: 'destreza', value: 14 }, { stat: 'critChancePercent', value: 7 }, { stat: 'critDamagePercent', value: 8 }, { stat: 'dpsPercent', value: 5 }] },
      { name: 'Vento Cortante', bonuses: [{ stat: 'destreza', value: 14 }, { stat: 'attackSpeedPercent', value: 7 }, { stat: 'dodgePercent', value: 6 }] },
      { name: 'Marca da Caça', bonuses: [{ stat: 'danoPerfuracaoFlat', value: 50 }, { stat: 'critDamagePercent', value: 10 }, { stat: 'dpsPercent', value: 6 }] },
    ],
    [
      { name: 'Fúria do Arqueiro', bonuses: [{ stat: 'destreza', value: 22 }, { stat: 'critChancePercent', value: 10 }, { stat: 'critDamagePercent', value: 12 }, { stat: 'dpsPercent', value: 8 }] },
      { name: 'Sombra Veloz', bonuses: [{ stat: 'destreza', value: 22 }, { stat: 'attackSpeedPercent', value: 10 }, { stat: 'dodgePercent', value: 10 }, { stat: 'dpsPercent', value: 6 }] },
      { name: 'Tempestade de Flechas', bonuses: [{ stat: 'danoPerfuracaoFlat', value: 80 }, { stat: 'critChancePercent', value: 8 }, { stat: 'dpsPercent', value: 10 }] },
    ],
  ],
);

// ---------------------------------------------------------------------
// GUERREIRO — Força sempre na coluna A. Coluna B alterna Vida/Vida%/Dano
// Físico; coluna C alterna Armadura/Armadura%/DPS.
// ---------------------------------------------------------------------
const GUERREIRO_TREE = buildClassTree(
  'guerreiro',
  'forca',
  ['hpFlat', 'hpPercent', 'danoFisicoFlat'],
  ['armorFlat', 'armorPercent', 'dpsPercent'],
  [
    [
      { name: 'Coração Bravo', bonuses: [{ stat: 'forca', value: 4 }, { stat: 'hpPercent', value: 3 }] },
      { name: 'Pele de Pedra', bonuses: [{ stat: 'forca', value: 4 }, { stat: 'armorFlat', value: 10 }] },
      { name: 'Punho de Ferro', bonuses: [{ stat: 'danoFisicoFlat', value: 15 }, { stat: 'forca', value: 4 }] },
    ],
    [
      { name: 'Sangue Fervente', bonuses: [{ stat: 'forca', value: 8 }, { stat: 'hpFlat', value: 40 }, { stat: 'hpPercent', value: 5 }] },
      { name: 'Muralha Viva', bonuses: [{ stat: 'forca', value: 8 }, { stat: 'armorFlat', value: 25 }, { stat: 'armorPercent', value: 5 }] },
      { name: 'Fúria Bruta', bonuses: [{ stat: 'danoFisicoFlat', value: 30 }, { stat: 'forca', value: 8 }, { stat: 'dpsPercent', value: 5 }] },
    ],
    [
      { name: 'Vontade de Aço', bonuses: [{ stat: 'forca', value: 14 }, { stat: 'hpFlat', value: 70 }, { stat: 'hpPercent', value: 8 }] },
      { name: 'Bastião Inabalável', bonuses: [{ stat: 'forca', value: 14 }, { stat: 'armorFlat', value: 45 }, { stat: 'armorPercent', value: 8 }, { stat: 'hpFlat', value: 30 }] },
      { name: 'Golpe Devastador', bonuses: [{ stat: 'danoFisicoFlat', value: 50 }, { stat: 'forca', value: 14 }, { stat: 'dpsPercent', value: 7 }] },
    ],
    [
      { name: 'Sede de Sangue', bonuses: [{ stat: 'forca', value: 22 }, { stat: 'hpFlat', value: 110 }, { stat: 'hpPercent', value: 12 }, { stat: 'dpsPercent', value: 6 }] },
      { name: 'Fortaleza Ambulante', bonuses: [{ stat: 'forca', value: 22 }, { stat: 'armorFlat', value: 70 }, { stat: 'armorPercent', value: 12 }, { stat: 'hpFlat', value: 50 }] },
      { name: 'Avatar da Guerra', bonuses: [{ stat: 'danoFisicoFlat', value: 80 }, { stat: 'forca', value: 22 }, { stat: 'dpsPercent', value: 10 }] },
    ],
  ],
);

// ---------------------------------------------------------------------
// MAGO — Inteligência sempre na coluna A. Coluna B alterna Dano Mágico/
// Dano Mágico/Cura por Acerto (dano mágico é o foco, aparece 2 em 3);
// coluna C alterna Ouro Obtido/Materiais Obtidos/DPS.
// ---------------------------------------------------------------------
const MAGO_TREE = buildClassTree(
  'mago',
  'inteligencia',
  ['danoMagicoFlat', 'danoMagicoFlat', 'lifestealFlat'],
  ['goldPercent', 'dropPercent', 'dpsPercent'],
  [
    [
      { name: 'Chama Arcana', bonuses: [{ stat: 'inteligencia', value: 4 }, { stat: 'danoMagicoFlat', value: 15 }] },
      { name: 'Toque Vital', bonuses: [{ stat: 'inteligencia', value: 4 }, { stat: 'lifestealFlat', value: 2 }] },
      { name: 'Bolsa Encantada', bonuses: [{ stat: 'goldPercent', value: 3 }, { stat: 'dropPercent', value: 3 }] },
    ],
    [
      { name: 'Explosão Arcana', bonuses: [{ stat: 'inteligencia', value: 8 }, { stat: 'danoMagicoFlat', value: 30 }, { stat: 'dpsPercent', value: 5 }] },
      { name: 'Pacto Vital', bonuses: [{ stat: 'inteligencia', value: 8 }, { stat: 'lifestealFlat', value: 4 }, { stat: 'danoMagicoFlat', value: 15 }] },
      { name: 'Sorte do Mago', bonuses: [{ stat: 'goldPercent', value: 6 }, { stat: 'dropPercent', value: 6 }] },
    ],
    [
      { name: 'Ruptura Arcana', bonuses: [{ stat: 'inteligencia', value: 14 }, { stat: 'danoMagicoFlat', value: 50 }, { stat: 'dpsPercent', value: 7 }] },
      { name: 'Ciclo Vital', bonuses: [{ stat: 'inteligencia', value: 14 }, { stat: 'lifestealFlat', value: 6 }, { stat: 'danoMagicoFlat', value: 25 }] },
      { name: 'Fortuna Mística', bonuses: [{ stat: 'goldPercent', value: 10 }, { stat: 'dropPercent', value: 10 }, { stat: 'dpsPercent', value: 4 }] },
    ],
    [
      { name: 'Supremacia Arcana', bonuses: [{ stat: 'inteligencia', value: 22 }, { stat: 'danoMagicoFlat', value: 80 }, { stat: 'dpsPercent', value: 10 }] },
      { name: 'Renascer Místico', bonuses: [{ stat: 'inteligencia', value: 22 }, { stat: 'lifestealFlat', value: 9 }, { stat: 'danoMagicoFlat', value: 40 }] },
      { name: 'Riqueza Absoluta', bonuses: [{ stat: 'goldPercent', value: 16 }, { stat: 'dropPercent', value: 16 }, { stat: 'dpsPercent', value: 6 }] },
    ],
  ],
);

const TREES = {
  arqueiro: ARQUEIRO_TREE,
  guerreiro: GUERREIRO_TREE,
  mago: MAGO_TREE,
};

export function getClassTree(classId) {
  return TREES[classId] || null;
}

/// Acha uma habilidade normal pelo id, em qualquer classe (usado quando só
/// se tem o id salvo, ex: state.skillTree.purchased).
export function findSkillById(skillId) {
  for (const tree of Object.values(TREES)) {
    for (const stage of tree.stages) {
      for (const row of stage.rows) {
        for (const skill of row) {
          if (skill.id === skillId) return skill;
        }
      }
    }
  }
  return null;
}

/// Acha uma opção de especial pelo id, em qualquer classe.
export function findSpecialById(specialId) {
  for (const tree of Object.values(TREES)) {
    for (const stage of tree.stages) {
      if (!stage.special) continue;
      for (const option of stage.special.options) {
        if (option.id === specialId) return option;
      }
    }
  }
  return null;
}

// Total de pontos possíveis pra completar a árvore inteira (mesmo em toda
// classe, pela simetria da estrutura) — só informativo pra UI.
export const TOTAL_TREE_POINTS = STAGE_MAX_LEVEL.reduce((sum, max) => sum + max * 9, 0) + SPECIAL_THRESHOLDS.length;
