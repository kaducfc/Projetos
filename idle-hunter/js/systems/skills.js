import { getSkillTree, findSkillById, findSpecialById, SPECIAL_THRESHOLDS } from '../data/skills.js';
import { SKILL_TREE_VERSION } from '../state.js';

/// Pontos totais já ganhos: 1 por nível de caça acima do 1 (nunca guardado
/// à parte — ver comentário em state.js). Sempre derivado, então nunca
/// desincroniza nem duplica num reload.
export function getTotalSkillPoints(state) {
  return Math.max(0, (state.hunterLevel || 1) - 1);
}

/// Pontos já gastos na árvore: soma de todo nível comprado em habilidades
/// normais + 1 por especial escolhida.
export function getSpentSkillPoints(state) {
  const tree = state.skillTree;
  if (!tree) return 0;
  const fromSkills = Object.values(tree.purchased || {}).reduce((sum, lvl) => sum + lvl, 0);
  const fromSpecials = Object.keys(tree.specials || {}).length;
  return fromSkills + fromSpecials;
}

export function getAvailableSkillPoints(state) {
  return Math.max(0, getTotalSkillPoints(state) - getSpentSkillPoints(state));
}

export function getSkillLevel(state, skillId) {
  return state.skillTree?.purchased?.[skillId] || 0;
}

export function isSpecialChosen(state, stageIndex) {
  return state.skillTree?.specials?.[stageIndex] != null;
}

export function getChosenSpecialId(state, stageIndex) {
  return state.skillTree?.specials?.[stageIndex] ?? null;
}

/// Etapa 0 sempre acessível; etapa N (N>0) só depois que a especial da
/// etapa anterior foi escolhida.
export function isStageUnlocked(state, stageIndex) {
  if (stageIndex === 0) return true;
  return isSpecialChosen(state, stageIndex - 1);
}

/// Linha 0 de uma etapa segue a regra da etapa (isStageUnlocked); as
/// demais linhas destravam assim que qualquer habilidade da linha anterior
/// (mesma etapa) tiver pelo menos 1 nível comprado — não precisa maximizar.
export function isRowUnlocked(state, stageIndex, rowIndex) {
  if (!isStageUnlocked(state, stageIndex)) return false;
  if (rowIndex === 0) return true;
  const tree = getSkillTree();
  const prevRow = tree.stages[stageIndex].rows[rowIndex - 1];
  return prevRow.some((skill) => getSkillLevel(state, skill.id) > 0);
}

export function canBuySkillLevel(state, skillId) {
  const skill = findSkillById(skillId);
  if (!skill) return false;
  if (!isRowUnlocked(state, skill.stageIndex, skill.rowIndex)) return false;
  if (getSkillLevel(state, skillId) >= skill.maxLevel) return false;
  return getAvailableSkillPoints(state) >= 1;
}

export function buySkillLevel(state, skillId) {
  if (!canBuySkillLevel(state, skillId)) return false;
  state.skillTree.purchased[skillId] = getSkillLevel(state, skillId) + 1;
  return true;
}

/// A especial de uma etapa só pode ser comprada com 2 requisitos: (1) o
/// total de pontos gastos na árvore inteira (ver SPECIAL_THRESHOLDS em
/// data/skills.js) e (2) pelo menos 1 nível comprado na ÚLTIMA linha
/// daquela etapa — sem isso, dava pra "pular" a etapa inteira comprando só
/// habilidades de OUTRAS etapas até acumular pontos suficientes, sem nunca
/// ter chegado na linha de cima da especial. Isso também já é inalcançável
/// fora de ordem, porque a etapa seguinte só destrava (e vira gastável)
/// depois da especial anterior (ver isStageUnlocked), mas o check de
/// "especial anterior escolhida" abaixo deixa essa invariante explícita em
/// vez de depender só da conta.
export function canBuySpecial(state, specialOptionId) {
  const option = findSpecialById(specialOptionId);
  if (!option) return false;
  if (option.stageIndex > 0 && !isSpecialChosen(state, option.stageIndex - 1)) return false;
  if (isSpecialChosen(state, option.stageIndex)) return false;
  if (getSpentSkillPoints(state) < SPECIAL_THRESHOLDS[option.stageIndex]) return false;
  const stage = getSkillTree().stages[option.stageIndex];
  const lastRow = stage.rows[stage.rows.length - 1];
  if (!lastRow.some((skill) => getSkillLevel(state, skill.id) > 0)) return false;
  return getAvailableSkillPoints(state) >= 1;
}

export function buySpecial(state, specialOptionId) {
  if (!canBuySpecial(state, specialOptionId)) return false;
  const option = findSpecialById(specialOptionId);
  state.skillTree.specials[option.stageIndex] = option.id;
  return true;
}

/// Reseta a árvore inteira: limpa purchased/specials, devolvendo todos os
/// pontos gastos (nunca ficam "perdidos" — getAvailableSkillPoints já é
/// sempre hunterLevel-1 menos o total gasto aqui, então esvaziar
/// purchased/specials já basta pra devolver tudo, sem precisar guardar um
/// contador de pontos à parte). Mantém treeVersion (mesmo formato de
/// árvore, só o progresso zera) pra loadState() não achar que é um save
/// desatualizado.
export function resetSkillTree(state) {
  state.skillTree = { purchased: {}, specials: {}, treeVersion: SKILL_TREE_VERSION };
  return true;
}
