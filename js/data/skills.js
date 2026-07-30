// ---------------------------------------------------------------------
// Árvore de habilidades passivas — ÚNICA (sem distinção de classe: era 3
// árvores separadas, agora é uma só, misturando o melhor de cada uma). 1
// ponto por nível de caça (ver systems/leveling.js xpToNextLevel/grantXp) —
// os pontos em si nunca são guardados à parte, são sempre (hunterLevel - 1)
// menos o total já gasto (ver getTotalSkillPoints/getSpentSkillPoints em
// systems/skills.js), então não tem como duplicar bônus num reload nem
// ficar negativo.
//
// Formato: 5 ETAPAS, cada uma com 3 LINHAS normais (3 habilidades cada, uma
// por COLUNA) + 1 linha ESPECIAL logo depois (3 opções mutuamente
// exclusivas, só 1 pode ser comprada) que trava a etapa seguinte. Tudo
// gerado por tabela (colunas/valores por etapa) em vez de escrito à mão
// habilidade por habilidade — trocar um valor, nome ou quantidade de
// níveis é só mexer nas tabelas abaixo, sem tocar em systems/skills.js nem
// em stats.js.
//
// Cada coluna tem uma IDENTIDADE temática (Ofensivo/Defensivo/Atributos &
// Sorte) mas RODA por uma lista de 5 stats (não 3, como antes) — o ciclo
// não reseta a cada etapa, continua rolando pelas 15 linhas inteiras, então
// nenhuma etapa repete a mesma combinação de stats que a anterior. Menos
// repetitivo que "sempre os mesmos 3 stats toda etapa".
//
// Orçamento: 3 linhas × 3 colunas × (2,2,3,3,4) níveis por etapa = 18+18+27+
// 27+36 = 126, + 4 especiais (1 ponto cada) = 130 pontos pra completar a
// árvore inteira.
// ---------------------------------------------------------------------

// Nível máximo de cada habilidade normal, por etapa (0-based).
export const STAGE_MAX_LEVEL = [2, 2, 3, 3, 4];

// Pontos totais já gastos na árvore (soma de todas as habilidades normais +
// especiais compradas) necessários pra poder comprar o especial que destrava
// a etapa seguinte. 4 especiais (entre as 5 etapas — não tem especial depois
// da última).
export const SPECIAL_THRESHOLDS = [10, 30, 55, 80];

// Nomes exibidos por linha global (1ª linha da árvore inteira = I, última =
// XV) — só cosmético, pra toda habilidade não se chamar igual.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

// Nome legível de cada stat — reusado tanto pro nome gerado da habilidade
// quanto pra descrição (ver skillValueLabel em ui/render.js).
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
};

const ATTRIBUTE_STATS = new Set(['forca', 'destreza', 'inteligencia']);
const PERCENT_STATS = new Set([
  'critChancePercent', 'critDamagePercent', 'attackSpeedPercent', 'dodgePercent',
  'goldPercent', 'dropPercent', 'dpsPercent', 'hpPercent', 'armorPercent',
]);

// Progressão por etapa (0-based): atributos base +1/+2/+3/+4/+5 por nível,
// percentuais 1%/2%/3%/4%/5% por nível. Stats "flat" (vida/armadura/dano)
// escalam na mesma proporção, em tabelas próprias, fáceis de re-tunar aqui
// sem mexer em mais nada.
const ATTRIBUTE_PER_LEVEL = [1, 2, 3, 4, 5];
const PERCENT_PER_LEVEL = [1, 2, 3, 4, 5];
const FLAT_PER_LEVEL = {
  hpFlat: [6, 12, 18, 24, 30],
  armorFlat: [3, 6, 9, 12, 15],
  danoFisicoFlat: [5, 10, 15, 20, 25],
  danoPerfuracaoFlat: [5, 10, 15, 20, 25],
  danoMagicoFlat: [5, 10, 15, 20, 25],
};

function valuePerLevel(stat, stageIndex) {
  if (ATTRIBUTE_STATS.has(stat)) return ATTRIBUTE_PER_LEVEL[stageIndex];
  if (PERCENT_STATS.has(stat)) return PERCENT_PER_LEVEL[stageIndex];
  if (FLAT_PER_LEVEL[stat]) return FLAT_PER_LEVEL[stat][stageIndex];
  throw new Error(`Sem tabela de progressão pro stat ${stat}`);
}

// As 3 colunas da árvore, cada uma com uma rotação de 5 stats — o stat de
// uma linha é `rotation[globalRow % 5]` (globalRow 0..14, contínuo pelas 5
// etapas, não reseta): cada stat aparece só 3x na árvore inteira (contra 5x
// quando o ciclo era de 3), e a combinação de stats de uma etapa nunca é
// igual à da etapa anterior (o ciclo de 5 não bate com o período de 3
// linhas por etapa).
const OFFENSE_ROTATION = ['danoFisicoFlat', 'danoPerfuracaoFlat', 'danoMagicoFlat', 'critChancePercent', 'critDamagePercent'];
const DEFENSE_ROTATION = ['hpFlat', 'hpPercent', 'armorFlat', 'armorPercent', 'dodgePercent'];
const ATTRIBUTE_LUCK_ROTATION = ['forca', 'destreza', 'inteligencia', 'goldPercent', 'dropPercent'];

/// Monta a árvore inteira a partir das 3 rotações de coluna + as opções de
/// especial de cada etapa (specialsByStage[i] === undefined pra etapa sem
/// especial — só a última, ver STAGE_MAX_LEVEL, não tem uma depois dela).
function buildTree(columnRotations, specialsByStage) {
  const stages = STAGE_MAX_LEVEL.map((maxLevel, stageIndex) => {
    const rows = [0, 1, 2].map((rowIndex) => {
      const globalRow = stageIndex * 3 + rowIndex; // 0..14
      return columnRotations.map((rotation, colIndex) => {
        const stat = rotation[globalRow % rotation.length];
        const perLevel = valuePerLevel(stat, stageIndex);
        return {
          id: `${stageIndex}_${rowIndex}_${colIndex}`,
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
        id: `special${stageIndex}_${optionIndex}`,
        stageIndex,
        optionIndex,
        name: opt.name,
        bonuses: opt.bonuses,
      })),
    } : null;
    return { stageIndex, maxLevel, rows, special };
  });
  return { stages };
}

// Especiais: em cada etapa, 3 opções mutuamente exclusivas representando um
// "estilo de build" (ofensivo/defensivo/sorte) em vez de uma classe —
// reaproveita os mesmos números das antigas especiais de Arqueiro/
// Guerreiro/Mago (já calibrados), só sem o rótulo de classe.
const SPECIALS_BY_STAGE = [
  [
    { name: 'Golpe Certeiro', bonuses: [{ stat: 'critChancePercent', value: 3 }, { stat: 'critDamagePercent', value: 4 }] },
    { name: 'Pele de Aço', bonuses: [{ stat: 'hpFlat', value: 15 }, { stat: 'armorFlat', value: 10 }] },
    { name: 'Bolsa da Sorte', bonuses: [{ stat: 'goldPercent', value: 3 }, { stat: 'dropPercent', value: 3 }] },
  ],
  [
    { name: 'Instinto Assassino', bonuses: [{ stat: 'critChancePercent', value: 5 }, { stat: 'critDamagePercent', value: 5 }, { stat: 'dpsPercent', value: 6 }] },
    { name: 'Muralha Viva', bonuses: [{ stat: 'hpFlat', value: 40 }, { stat: 'armorFlat', value: 25 }, { stat: 'armorPercent', value: 5 }] },
    { name: 'Fortuna Redobrada', bonuses: [{ stat: 'goldPercent', value: 6 }, { stat: 'dropPercent', value: 6 }, { stat: 'dpsPercent', value: 5 }] },
  ],
  [
    { name: 'Fúria Crescente', bonuses: [{ stat: 'critChancePercent', value: 7 }, { stat: 'critDamagePercent', value: 8 }, { stat: 'attackSpeedPercent', value: 7 }] },
    { name: 'Bastião Inabalável', bonuses: [{ stat: 'hpFlat', value: 70 }, { stat: 'armorFlat', value: 45 }, { stat: 'armorPercent', value: 8 }] },
    { name: 'Fortuna Mística', bonuses: [{ stat: 'goldPercent', value: 10 }, { stat: 'dropPercent', value: 10 }, { stat: 'dpsPercent', value: 7 }] },
  ],
  [
    { name: 'Ceifador Implacável', bonuses: [{ stat: 'critChancePercent', value: 10 }, { stat: 'critDamagePercent', value: 12 }, { stat: 'attackSpeedPercent', value: 10 }, { stat: 'dpsPercent', value: 8 }] },
    { name: 'Fortaleza Ambulante', bonuses: [{ stat: 'hpFlat', value: 110 }, { stat: 'armorFlat', value: 70 }, { stat: 'armorPercent', value: 12 }] },
    { name: 'Riqueza Absoluta', bonuses: [{ stat: 'goldPercent', value: 16 }, { stat: 'dropPercent', value: 16 }, { stat: 'dpsPercent', value: 10 }] },
  ],
];

const SKILL_TREE = buildTree([OFFENSE_ROTATION, DEFENSE_ROTATION, ATTRIBUTE_LUCK_ROTATION], SPECIALS_BY_STAGE);

export function getSkillTree() {
  return SKILL_TREE;
}

/// Acha uma habilidade normal pelo id (usado quando só se tem o id salvo,
/// ex: state.skillTree.purchased).
export function findSkillById(skillId) {
  for (const stage of SKILL_TREE.stages) {
    for (const row of stage.rows) {
      for (const skill of row) {
        if (skill.id === skillId) return skill;
      }
    }
  }
  return null;
}

/// Acha uma opção de especial pelo id.
export function findSpecialById(specialId) {
  for (const stage of SKILL_TREE.stages) {
    if (!stage.special) continue;
    for (const option of stage.special.options) {
      if (option.id === specialId) return option;
    }
  }
  return null;
}

// Total de pontos possíveis pra completar a árvore inteira — só informativo
// pra UI.
export const TOTAL_TREE_POINTS = STAGE_MAX_LEVEL.reduce((sum, max) => sum + max * 9, 0) + SPECIAL_THRESHOLDS.length;
