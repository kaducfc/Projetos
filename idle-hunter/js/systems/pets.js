import {
  PET_MAX_LEVEL, getPetInventoryCap, getPetRecycleValue, getPetDamage, getPetSpecies, getPetDpsBonusPercent,
  rollPetCandidate, isPetCandidateBetter, xpToNextPetLevel, applyPetXp,
} from '../data/pets.js';
import { elementDamageModifier } from '../data/elements.js';
import { isVipActive } from '../state.js';

export const MAX_EQUIPPED_PETS = 4;

// ---------------------------------------------------------------------
// Pity de raridade ao chocar — sem isso, Lendário (1.5%) e Mítico (0.5%)
// dependem 100% de sorte e podem nunca sair. state.petHatchesSinceMythic/
// petHatchesSinceLegendary (ver state.js) contam ovos chocados desde a
// última vez que cada raridade saiu — cada um reseta só quando a raridade
// EXATA dele é chocada (respectivo contador, não um reset cruzado).
// ---------------------------------------------------------------------
export const MYTHIC_PITY_THRESHOLD = 60;
export const LEGENDARY_PITY_THRESHOLD = 20;

/// Qual raridade (se alguma) o PRÓXIMO choco deve garantir. Prioriza
/// Mítico sobre Lendário se os 2 gatilhos coincidirem no mesmo choco
/// (Mítico > Lendário, então cumpre a promessa dos dois de qualquer jeito
/// — o contador de Lendário simplesmente continua subindo até sair um
/// Lendário de verdade, igual documentado acima).
export function nextHatchGuaranteedRarity(state) {
  if (((state.petHatchesSinceMythic || 0) + 1) >= MYTHIC_PITY_THRESHOLD) return 'mitico';
  if (((state.petHatchesSinceLegendary || 0) + 1) >= LEGENDARY_PITY_THRESHOLD) return 'lendario';
  return null;
}

/// Rola os 2 candidatos de 1 choco de ovo, já respeitando a garantia de
/// pity acima. Quando há raridade garantida, os DOIS candidatos saem
/// nela (só espécie/Tier variam entre eles) — assim a garantia vale não
/// importa qual dos 2 o jogador escolher, sem precisar torcer a escolha
/// manual/automática em cada fluxo (choco manual em main.js, choco em
/// lote em hatchAllEggs abaixo).
export function rollHatchCandidates(state) {
  const forcedRarityId = nextHatchGuaranteedRarity(state);
  return [rollPetCandidate(forcedRarityId), rollPetCandidate(forcedRarityId)];
}

/// Atualiza os 2 contadores de pity depois que um choco é COMMITADO (o pet
/// escolhido realmente entra no inventário, não só rolado) — chamada
/// obrigatória de todo fluxo de choco (manual em main.js, lote em
/// hatchAllEggs abaixo), sempre com a raridade do pet que de fato foi
/// escolhido.
export function recordPetHatchOutcome(state, chosenRarityId) {
  state.petHatchesSinceMythic = (state.petHatchesSinceMythic || 0) + 1;
  state.petHatchesSinceLegendary = (state.petHatchesSinceLegendary || 0) + 1;
  if (chosenRarityId === 'mitico') state.petHatchesSinceMythic = 0;
  if (chosenRarityId === 'lendario') state.petHatchesSinceLegendary = 0;
}

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
/// quantidade que renderia se fosse reciclado (getPetRecycleValue).
export function addPetToInventory(state, candidate) {
  if (state.pets.length >= getPetInventoryCap(state)) {
    const fragments = getPetRecycleValue(candidate);
    state.petFragments = (state.petFragments || 0) + fragments;
    return { uid: null, discarded: true, fragments };
  }
  const uid = state.nextPetUid++;
  const pet = { uid, speciesId: candidate.speciesId, rarityId: candidate.rarityId, level: candidate.level || 1, xp: 0 };
  state.pets.push(pet);
  return { uid, discarded: false };
}

/// Só 1 mascote equipado por elemento — equipar um 2º do mesmo elemento
/// (fogo/planta/elétrico/água) é bloqueado, mesmo que sobre slot vazio;
/// desequipar o outro primeiro é intencional (mesmo padrão de "sem
/// substituição automática" que qualquer bloqueio explícito no jogo). Um
/// pet já equipado sempre pode "equipar de novo" nele mesmo (uid igual —
/// no-op via equipPet, usado por engano não deveria travar em nada).
export function canEquipPet(state, uid) {
  const pet = getPetEntry(state, uid);
  if (!pet) return false;
  const species = getPetSpecies(pet.speciesId);
  if (!species) return false;
  return !(state.equippedPetUids || []).some((eqUid) => {
    if (!eqUid || eqUid === uid) return false;
    const eqPet = getPetEntry(state, eqUid);
    const eqSpecies = eqPet ? getPetSpecies(eqPet.speciesId) : null;
    return eqSpecies && eqSpecies.element === species.element;
  });
}

/// Equipa sem precisar escolher slot manualmente: primeiro slot vazio, ou
/// sobrescreve o slot 0 se os 4 já estiverem ocupados — mesmo padrão do
/// anel em systems/equipment.js (equipItem). Com a regra de 1-por-elemento
/// acima, "os 4 já estiverem ocupados" na prática só acontece quando os 4
/// elementos diferentes já estão representados — nesse ponto canEquipPet já
/// teria barrado antes de chegar aqui pra qualquer pet cujo elemento já
/// esteja equipado, então esse fallback de sobrescrever o slot 0 nunca
/// chega a rodar de verdade nesse caso (documentado, não removido, pra não
/// mudar o formato do array por engano).
export function equipPet(state, uid) {
  if (!canEquipPet(state, uid)) return false;
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

/// Só recicla um mascote que não esteja equipado — desequipar primeiro é
/// intencional (mesmo padrão de "sem ação destrutiva num slot em uso sem
/// avisar" já usado em canFusePets).
export function canRecyclePet(state, uid) {
  const pet = getPetEntry(state, uid);
  if (!pet) return false;
  return !isPetEquipped(state, uid);
}

/// Recicla um mascote em Fragmento de Mascote (ver getPetRecycleValue em
/// data/pets.js) — era "Vender" por ouro antes, virou reciclagem por
/// pedido do usuário. Fragmento é a moeda do 2º caminho de evolução (ver
/// donatePetFragments abaixo).
export function recyclePet(state, uid) {
  if (!canRecyclePet(state, uid)) return null;
  const pet = getPetEntry(state, uid);
  const value = getPetRecycleValue(pet);
  state.petFragments = (state.petFragments || 0) + value;
  state.pets = state.pets.filter((p) => p.uid !== uid);
  return value;
}

// ---------------------------------------------------------------------
// Doar Fragmento de Mascote pra barra de XP de um pet — 2º caminho pra
// evoluir nível, além de fundir 2 pets iguais (ver xpToNextPetLevel/
// applyPetXp em data/pets.js). Cada clique doa só o que falta pro PRÓXIMO
// nível (nunca mais que isso, mesmo com fragmento de sobra) — pedido
// explícito do usuário: precisa de 100 e tem 50 -> doa os 50, fica 50/100;
// precisa de 100 e tem 200 -> doa só 100, os outros 100 continuam
// guardados pro jogador decidir depois (outro pet, ou o próximo nível
// deste mesmo). Sem fragmento suficiente pro nível inteiro, doa tudo que
// tiver disponível (banked como XP parcial, sem desperdiçar nada).
// ---------------------------------------------------------------------
export function canDonatePetFragments(state, uid) {
  const pet = getPetEntry(state, uid);
  if (!pet || pet.level >= PET_MAX_LEVEL) return false;
  return (state.petFragments || 0) > 0;
}

/// Fragmentos realmente gastos numa doação agora (min entre o que falta
/// pro próximo nível e o que o jogador tem disponível) — usado tanto pra
/// executar a doação quanto pra UI mostrar de antemão quanto vai sair.
export function petFragmentsToDonateNow(state, uid) {
  const pet = getPetEntry(state, uid);
  if (!pet || pet.level >= PET_MAX_LEVEL) return 0;
  const needed = Math.max(0, xpToNextPetLevel(pet) - (pet.xp || 0));
  return Math.min(state.petFragments || 0, needed);
}

/// Retorna { levelsGained, fragmentsSpent } ou null se não deu pra doar.
export function donatePetFragments(state, uid) {
  if (!canDonatePetFragments(state, uid)) return null;
  const pet = getPetEntry(state, uid);
  const fragmentsSpent = petFragmentsToDonateNow(state, uid);
  state.petFragments = (state.petFragments || 0) - fragmentsSpent;
  const levelsGained = applyPetXp(pet, fragmentsSpent);
  return { levelsGained, fragmentsSpent };
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

/// Funde 2 pets iguais num só — o nível sobe +1 automaticamente (sempre,
/// não depende de XP), e a XP que cada um já tinha acumulado (doações
/// parciais, ver donatePetFragments) é somada e aplicada por cima no pet
/// resultante — se a soma já bastar pro próximo nível também, sobe mais
/// de 1 de uma vez (applyPetXp cascateia). Consome os dois originais.
export function fusePets(state, uidA, uidB) {
  if (!canFusePets(state, uidA, uidB)) return null;
  const a = getPetEntry(state, uidA);
  const b = getPetEntry(state, uidB);
  const uid = state.nextPetUid++;
  const fused = { uid, speciesId: a.speciesId, rarityId: a.rarityId, level: a.level + 1, xp: 0 };
  applyPetXp(fused, (a.xp || 0) + (b.xp || 0));
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
export function getBestEquippedPet(state, monsterElement, hunterDps) {
  let best = null;
  let bestDamage = -Infinity;
  for (const uid of state.equippedPetUids || []) {
    if (!uid) continue;
    const pet = getPetEntry(state, uid);
    if (!pet) continue;
    const species = getPetSpecies(pet.speciesId);
    if (!species) continue;
    const modifier = 1 + elementDamageModifier(species.element, monsterElement);
    const damage = getPetDamage(pet, hunterDps) * modifier;
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
/// no elementalMultiplier antes de chamar resolveHit().
export function getActivePetDpsMultiplier(state, monsterElement) {
  // dps=1 (valor fictício): só interessa QUAL pet ganha o desempate (o
  // elemento/vantagem decide isso, não o valor de DPS em si — todo pet
  // equipado escala pelo MESMO DPS, então o ranking nunca muda), não o
  // dano de verdade — dpsBonusPercent independe de dano/DPS.
  const best = getBestEquippedPet(state, monsterElement, 1);
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
  if (isVipActive(state)) return true;
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
        // Mesma regra de fusePets: nível+1 sempre, XP dos 2 somada e
        // aplicada por cima (pode cascatear além de nextLevel se a soma
        // bastar) — o pet resultante entra no balde do nível FINAL dele
        // depois da cascata, não sempre em nextLevel.
        const merged = { uid: null, speciesId: a.speciesId, rarityId: a.rarityId, level: level + 1, xp: 0 };
        applyPetXp(merged, (a.xp || 0) + (b.xp || 0));
        if (!byLevel.has(merged.level)) byLevel.set(merged.level, []);
        byLevel.get(merged.level).push(merged);
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
// Chocar todos os ovos de uma vez (botão "Chocar Todos" na aba Mascotes)
// — funcionalidade exclusiva de VIP ativo (ver isVipActive em state.js).
// Cada ovo continua rolando os mesmos 2 candidatos independentes de
// sempre (ver rollPetCandidate em data/pets.js) — só a ESCOLHA entre os 2
// é automática aqui em vez de abrir o modal, priorizando sempre maior
// raridade e, empatado, maior Tier (ver isPetCandidateBetter). Como só
// roda com VIP ativo, canChooseRightPet(state) já dá true sempre aqui
// dentro (VIP sempre pode o lado direito, sem gastar a escolha diária) —
// mantido explícito mesmo assim, e útil se essa função algum dia rodar
// fora do gate de VIP.
//
// PARA no limite do inventário de mascotes: diferente do choco manual (1
// ovo por clique, ver addPetToInventory — lá o descarte automático em
// Fragmentos é aceitável, é 1 ovo por vez, escolha consciente), chocar
// TODOS de uma vez com o inventário quase cheio poderia consumir uma
// pilha inteira de ovos e converter a maioria em Fragmentos de baixo
// valor sem o jogador perceber. Em vez disso, hatchAllEggs para assim que
// o inventário enche — os ovos restantes ficam intactos em state.eggCount
// pra serem chocados depois (com mais espaço livre), nunca viram
// Fragmentos aqui.
export function canHatchAllEggs(state) {
  return isVipActive(state) && (state.eggCount || 0) > 0;
}

export function hatchAllEggs(state) {
  const summary = { hatched: 0, discardedCount: 0, fragmentsGained: 0, byRarity: {}, stoppedInventoryFull: false };
  if (!canHatchAllEggs(state)) return summary;
  while ((state.eggCount || 0) > 0) {
    if (state.pets.length >= getPetInventoryCap(state)) {
      summary.stoppedInventoryFull = true;
      break;
    }
    const [left, right] = rollHatchCandidates(state);
    let chosen = left;
    if (canChooseRightPet(state) && isPetCandidateBetter(right, left)) {
      chosen = right;
      if (!isVipActive(state)) useFreeRightPetChoice(state);
    }
    state.eggCount -= 1;
    const { discarded, fragments } = addPetToInventory(state, chosen);
    recordPetHatchOutcome(state, chosen.rarityId);
    summary.hatched += 1;
    if (discarded) {
      summary.discardedCount += 1;
      summary.fragmentsGained += fragments;
    }
    summary.byRarity[chosen.rarityId] = (summary.byRarity[chosen.rarityId] || 0) + 1;
  }
  return summary;
}
