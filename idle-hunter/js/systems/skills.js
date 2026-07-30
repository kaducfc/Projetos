import { getClassTree, findSkillById, findSpecialById, SPECIAL_THRESHOLDS } from '../data/skills.js';

/// Pontos totais já ganhos: 1 por nível de caça acima do 1 (nunca guardado
/// à parte — ver comentário em state.js). Sempre derivado, então nunca
/// desincroniza nem duplica num reload.
export function getTotalSkillPoints(state) {
  return Math.max(0, (state.hunterLevel || 1) - 1);
}

/// Pontos já gastos na árvore ativa: soma de todo nível comprado em
/// habilidades normais + 1 por especial escolhida. Só existe dado da classe
/// ATIVA em purchased/specials (trocar de classe reseta os dois, ver
/// chooseClass), então não precisa filtrar por classId aqui.
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

export function getActiveClass(state) {
  return state.skillTree?.classId || null;
}

/// Escolhe (ou troca de) classe — trocar reseta purchased/specials (respec
/// completo, pontos voltam a ficar disponíveis) já que cada árvore tem
/// identidade própria e não faz sentido misturar progresso entre elas.
/// Escolher a MESMA classe já ativa não faz nada (evita resetar à toa).
export function chooseClass(state, classId) {
  if (!getClassTree(classId)) return false;
  if (state.skillTree.classId === classId) return true;
  state.skillTree.classId = classId;
  state.skillTree.purchased = {};
  state.skillTree.specials = {};
  return true;
}

/// Reset completo: limpa classe/purchased/specials, todos os pontos gastos
/// voltam a ficar disponíveis. Usado pelo botão "Trocar de classe" (ver
/// ui/render.js "skill-class-active") — chooseClass() já faz isso
/// automaticamente ao trocar pra outra classe, esta função é só pro caso de
/// querer voltar pra "nenhuma classe escolhida" explicitamente.
export function respecClass(state) {
  state.skillTree.classId = null;
  state.skillTree.purchased = {};
  state.skillTree.specials = {};
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
  const tree = getClassTree(getActiveClass(state));
  if (!tree) return false;
  const prevRow = tree.stages[stageIndex].rows[rowIndex - 1];
  return prevRow.some((skill) => getSkillLevel(state, skill.id) > 0);
}

export function canBuySkillLevel(state, skillId) {
  const skill = findSkillById(skillId);
  if (!skill) return false;
  if (skill.classId !== getActiveClass(state)) return false;
  if (!isRowUnlocked(state, skill.stageIndex, skill.rowIndex)) return false;
  if (getSkillLevel(state, skillId) >= skill.maxLevel) return false;
  return getAvailableSkillPoints(state) >= 1;
}

export function buySkillLevel(state, skillId) {
  if (!canBuySkillLevel(state, skillId)) return false;
  state.skillTree.purchased[skillId] = getSkillLevel(state, skillId) + 1;
  return true;
}

/// A especial de uma etapa só pode ser comprada depois de gastar o total
/// de pontos exigido (ver SPECIAL_THRESHOLDS em data/skills.js) — na
/// prática, isso já é inalcançável fora de ordem, porque a etapa seguinte
/// só destrava (e vira gastável) depois da especial anterior (ver
/// isStageUnlocked), mas o check de "especial anterior escolhida" abaixo
/// deixa essa invariante explícita em vez de depender só da conta.
export function canBuySpecial(state, specialOptionId) {
  const option = findSpecialById(specialOptionId);
  if (!option) return false;
  if (option.classId !== getActiveClass(state)) return false;
  if (option.stageIndex > 0 && !isSpecialChosen(state, option.stageIndex - 1)) return false;
  if (isSpecialChosen(state, option.stageIndex)) return false;
  if (getSpentSkillPoints(state) < SPECIAL_THRESHOLDS[option.stageIndex]) return false;
  return getAvailableSkillPoints(state) >= 1;
}

export function buySpecial(state, specialOptionId) {
  if (!canBuySpecial(state, specialOptionId)) return false;
  const option = findSpecialById(specialOptionId);
  state.skillTree.specials[option.stageIndex] = option.id;
  return true;
}
