import {
  PET_MAX_LEVEL, getPetInventoryCap, getPetSellValue, getPetDamage, getPetSpecies, getPetDpsBonusPercent,
  rollPetCandidate, isPetCandidateBetter,
} from '../data/pets.js';
import { elementDamageModifier } from '../data/elements.js';

export const MAX_EQUIPPED_PETS = 4;

export function getPetEntry(state, uid) {
  return state.pets.find((p) => p.uid === uid) || null;
}

function isPetEquipped(state, uid) {
  return (state.equippedPetUids || []).includes(uid);
}

/// Adiciona um candidato já escolhido (ver hatch flow em main.js) ao
/// inventário de pets — se o inventário já estiver no limite (100, ou 150 com
/// VIP, ver getPetInventoryCap), o pet NOVO é descartado automaticamente em
/// vez de entrar, e vira Fragmentos (state.petFragments) na mesma
/// quantidade que renderia se fosse vendido (getPetSellValue).
export function addPetToInventory(state, candidate) {
  if (state.pets.length >= getPetInventoryCap(state)) {
    const fragments = getPetSellValue(candidate);
    state.petFragments = (state.petFragments || 0) + fragments;
    return { uid: null, discarded: true, fragments };
  }
  const uid = state.nextPetUid++;
  const pet = { uid, speciesId: candidate.speciesId, rarityId: candidate.rarityId, level: candidate.level || 1 };
  state.pets.push(pet);
  return { uid, discarded: false };
}

/// Equipa sem precisar escolher slot manualmente: primeiro slot vazio, ou
/// sobrescreve o slot 0 se os 4 já estiverem ocupados — mesmo padrão do
/// anel em systems/equipment.js (equipItem).
export function equipPet(state, uid) {
  if (!getPetEntry(state, uid)) return false;
  state.equippedPetUids = state.equippedPetUids.map((u) => (u === uid ? null : u));
  const emptyIndex = state.equippedPetUids.findIndex((u) => !u);
  state.equippedPetUids[emptyIndex !== -1 ? emptyIndex : 0] = uid;
  return true;
}

export function unequipPetSlot(state, slotIndex) {
  if (slotIndex < 0 || slotIndex >= MAX_EQUIPPED_PETS) return false;
  state.equippedPetUids[slotIndex] = null;
  return true;
}

export function sellPet(state, uid) {
  const pet = getPetEntry(state, uid);
  if (!pet) return null;
  const value = getPetSellValue(pet);
  state.gold += value;
  state.pets = state.pets.filter((p) => p.uid !== uid);
  state.equippedPetUids = state.equippedPetUids.map((u) => (u === uid ? null : u));
  return value;
}

/// Só funde 2 pets DIFERENTES (uids distintos), mesma espécie + raridade +
/// nível, nível ainda abaixo do máximo, e nenhum dos dois equipado (evita
/// sumir um slot em uso sem avisar — desequipar primeiro é intencional).
export function canFusePets(state, uidA, uidB) {
  if (uidA === uidB) return false;
  const a = getPetEntry(state, uidA);
  const b = getPetEntry(state, uidB);
  if (!a || !b) return false;
  if (a.speciesId !== b.speciesId || a.rarityId !== b.rarityId || a.level !== b.level) return false;
  if (a.level >= PET_MAX_LEVEL) return false;
  if (isPetEquipped(state, uidA) || isPetEquipped(state, uidB)) return false;
  return true;
}

/// Funde 2 pets iguais num só, nível+1 — consome os dois originais.
export function fusePets(state, uidA, uidB) {
  if (!canFusePets(state, uidA, uidB)) return null;
  const a = getPetEntry(state, uidA);
  const uid = state.nextPetUid++;
  const fused = { uid, speciesId: a.speciesId, rarityId: a.rarityId, level: a.level + 1 };
  state.pets = state.pets.filter((p) => p.uid !== uidA && p.uid !== uidB);
  state.pets.push(fused);
  return fused;
}

/// Parceiros elegíveis pra fundir com este pet (mesma espécie/raridade/
/// nível, outro uid, não equipado) — usado pelo seletor de fusão na UI.
export function getFusePartners(state, uid) {
  const pet = getPetEntry(state, uid);
  if (!pet) return [];
  return state.pets.filter((p) => p.uid !== uid
    && p.speciesId === pet.speciesId
    && p.rarityId === pet.rarityId
    && p.level === pet.level
    && !isPetEquipped(state, p.uid));
}

/// Dentre os pets equipados, qual causaria mais dano agora contra
/// `monsterElement` — usado pra resolver automaticamente qual mascote ataca
/// a cada hit (ver systems/combat.js resolvePetHit, chamado do main.js).
/// Retorna null se nenhum pet estiver equipado. Só ESSE pet (o "ativo")
/// empresta seu bônus de %DPS ao caçador (ver dpsBonusPercent/
/// getActivePetDpsMultiplier abaixo) — os outros até 3 equipados ficam de
/// reserva, sem efeito nenhum até serem eles os escolhidos contra outro
/// elemento.
export function getBestEquippedPet(state, monsterElement) {
  let best = null;
  let bestDamage = -Infinity;
  for (const uid of state.equippedPetUids || []) {
    if (!uid) continue;
    const pet = getPetEntry(state, uid);
    if (!pet) continue;
    const species = getPetSpecies(pet.speciesId);
    if (!species) continue;
    const modifier = 1 + elementDamageModifier(species.element, monsterElement);
    const damage = getPetDamage(pet) * modifier;
    if (damage > bestDamage) {
      bestDamage = damage;
      best = { pet, species, damage, dpsBonusPercent: getPetDpsBonusPercent(pet) };
    }
  }
  return best;
}

/// Multiplicador de DPS do caçador vindo só do pet ATIVO no momento (ver
/// getBestEquippedPet acima) — 1 (sem efeito) se nenhum pet estiver
/// equipado. Cada um dos 4 contextos de combate (main.js) multiplica isso
/// no elementalMultiplier antes de chamar resolveHit(), igual já faz com
/// getCardDamageBonus.
export function getActivePetDpsMultiplier(state, monsterElement) {
  const best = getBestEquippedPet(state, monsterElement);
  return best ? 1 + best.dpsBonusPercent / 100 : 1;
}

// ---------------------------------------------------------------------
// VIP / escolha diária grátis do pet da direita (ver o fluxo de choco no
// main.js): sem VIP, só dá pra escolher o pet da esquerda ao chocar um
// ovo — a menos que ainda não tenha usado a escolha grátis de hoje, que
// libera escolher o da direita uma vez. VIP sempre pode escolher qualquer
// um dos dois, sem gastar a escolha diária.
// ---------------------------------------------------------------------
const DAILY_CYCLE_MS = 24 * 60 * 60 * 1000;

export function currentDailyCycle(now = Date.now()) {
  return Math.floor(now / DAILY_CYCLE_MS);
}

export function canChooseRightPet(state) {
  if (state.vip) return true;
  return state.freeRightPetChoiceCycle !== currentDailyCycle();
}

export function useFreeRightPetChoice(state) {
  state.freeRightPetChoiceCycle = currentDailyCycle();
}

// ---------------------------------------------------------------------
// Fundir tudo de uma vez (botão "Fundir Tudo" na aba Mascotes).
//
// Regra de fusão continua EXATAMENTE a de canFusePets/fusePets acima: só
// 2 pets de mesma espécie + mesma raridade + mesmo nível, nenhum dos dois
// equipado. Essa função só automatiza aplicar essa regra em cascata em
// todo o inventário de uma vez, sem mudar o que é ou não permitido fundir.
//
// Cascata: 4 pets Tier1/Comum/nv1 devem virar 1 pet Tier1/Comum/nv3 (2
// fusões nv1->nv2 sobre os 4, depois 1 fusão nv2->nv3 sobre os 2
// resultantes) — não só "1 fusão e para". Pra isso, agrupa por
// espécie+raridade (só aí que uma fusão é válida), e dentro de cada grupo
// resolve nível a nível, do mais baixo pro mais alto: casa pares no nível
// N, manda o resultado pro "balde" do nível N+1, e só então passa a
// processar esse balde. Isso é equivalente a somar em binário (cada par
// vira 1 "carry" pro nível seguinte) — dado importante pra não fundir 2x
// o mesmo pet nem perder pets pelo caminho:
//   - Todo pet elegível (não equipado) entra em exatamente 1 balde
//     (speciesId+raridade+nível) no início.
//   - Cada `pop()` de um balde marca aquele pet como CONSUMIDO (uid real
//     -> vai pra consumedUids, removido de state.pets no fim). Um pet só
//     é removido de state.pets se realmente foi consumido numa fusão.
//   - O resultado de cada fusão (uid: null) só vira um pet de verdade
//     (uid novo + entra em state.pets) se sobreviver até o fim sem ser
//     ele mesmo consumido por uma fusão de nível seguinte.
// Pets já no nível máximo (PET_MAX_LEVEL) nunca entram no loop de fusão
// (o `for` de nível para em PET_MAX_LEVEL - 1), então ficam sempre
// intocados — mesma regra de canFusePets (a.level >= PET_MAX_LEVEL bloqueia).
export function fuseAllPossiblePets(state) {
  const groups = new Map(); // "speciesId|rarityId" -> Map(level -> [pets])
  for (const pet of state.pets) {
    if (isPetEquipped(state, pet.uid)) continue;
    const key = `${pet.speciesId}|${pet.rarityId}`;
    if (!groups.has(key)) groups.set(key, new Map());
    const byLevel = groups.get(key);
    if (!byLevel.has(pet.level)) byLevel.set(pet.level, []);
    byLevel.get(pet.level).push(pet);
  }

  const consumedUids = new Set();
  let fusionsPerformed = 0;

  for (const byLevel of groups.values()) {
    for (let level = 1; level < PET_MAX_LEVEL; level++) {
      const bucket = byLevel.get(level);
      if (!bucket) continue;
      while (bucket.length >= 2) {
        const a = bucket.pop();
        const b = bucket.pop();
        if (a.uid != null) consumedUids.add(a.uid);
        if (b.uid != null) consumedUids.add(b.uid);
        fusionsPerformed += 1;
        const nextLevel = level + 1;
        if (!byLevel.has(nextLevel)) byLevel.set(nextLevel, []);
        byLevel.get(nextLevel).push({ uid: null, speciesId: a.speciesId, rarityId: a.rarityId, level: nextLevel });
      }
    }
  }

  if (fusionsPerformed === 0) return { fusionsPerformed: 0, resultingPets: 0 };

  state.pets = state.pets.filter((p) => !consumedUids.has(p.uid));
  let resultingPets = 0;
  for (const byLevel of groups.values()) {
    for (const bucket of byLevel.values()) {
      for (const pet of bucket) {
        if (pet.uid == null) {
          pet.uid = state.nextPetUid++;
          state.pets.push(pet);
          resultingPets += 1;
        }
      }
    }
  }
  return { fusionsPerformed, resultingPets };
}

// ---------------------------------------------------------------------
// Chocar todos os ovos de uma vez (botão "Chocar Todos" na aba Mascotes).
// Cada ovo continua rolando os mesmos 2 candidatos independentes de
// sempre (ver rollPetCandidate em data/pets.js) — só a ESCOLHA entre os 2
// é automática aqui em vez de abrir o modal, priorizando sempre maior
// raridade e, empatado, maior Tier (ver isPetCandidateBetter). A regra de
// VIP/escolha grátis diária pro lado direito continua valendo igual ao
// choco manual (canChooseRightPet/useFreeRightPetChoice) — processa ovo a
// ovo, então só o 1º ovo do lote pode usar a escolha grátis do dia se o
// jogador não for VIP; os demais ficam restritos ao lado esquerdo até lá,
// exatamente como aconteceria chocando um por um.
export function hatchAllEggs(state) {
  const summary = { hatched: 0, discardedCount: 0, fragmentsGained: 0, byRarity: {} };
  while ((state.eggCount || 0) > 0) {
    const left = rollPetCandidate();
    const right = rollPetCandidate();
    let chosen = left;
    if (canChooseRightPet(state) && isPetCandidateBetter(right, left)) {
      chosen = right;
      if (!state.vip) useFreeRightPetChoice(state);
    }
    state.eggCount -= 1;
    const { discarded, fragments } = addPetToInventory(state, chosen);
    summary.hatched += 1;
    if (discarded) {
      summary.discardedCount += 1;
      summary.fragmentsGained += fragments;
    }
    summary.byRarity[chosen.rarityId] = (summary.byRarity[chosen.rarityId] || 0) + 1;
  }
  return summary;
}
