import { PET_MAX_LEVEL, getPetInventoryCap, getPetSellValue, getPetDamage, getPetSpecies } from '../data/pets.js';
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
/// Retorna null se nenhum pet estiver equipado.
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
      best = { pet, species, damage };
    }
  }
  return best;
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
