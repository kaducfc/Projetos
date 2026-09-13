// ---------------------------------------------------------------
// Idioma / Tradução (js/i18n.js)
// ---------------------------------------------------------------
// O jogo é escrito inteiro em Português (texto estático no HTML, textos
// gerados dinamicamente em js/ui/render.js, toasts em js/main.js, nomes de
// itens/cartas/monstros/etc. gerados em js/data/*.js). Reescrever cada
// string como uma chave de tradução seria uma refatoração enorme (o
// codebase inteiro passa de 13 mil linhas). Em vez disso, essa varredura
// de texto (DOM sweep) faz 3 passes, do mais específico pro mais genérico:
//
//   A) EXACT_MAP     — frase inteira bate 100% -> tradução pronta.
//   B) REGEX_RULES    — texto com partes dinâmicas (números, nomes de
//                        itens, etc.) -> regex com grupos de captura,
//                        reconstrói a frase em inglês preservando os
//                        valores dinâmicos.
//   C) WORD_MAP        — fallback de palavra/expressão isolada (nomes de
//                        raridade, elemento, atributo, verbos comuns do
//                        jogo), aplicado com fronteira de palavra (\b)
//                        pra dar cobertura parcial em qualquer texto que
//                        as etapas A/B não bateram por inteiro (ex:
//                        nomes próprios de monstro/carta/pet ficam como
//                        estão — convenção padrão de localização de
//                        jogos — mas o resto da frase ao redor ainda
//                        traduz).
//
// translateContainer(root) varre os nós de texto (e os atributos
// title/placeholder) de um elemento já renderizado e aplica os 3 passes.
// Isso é chamado nos ~15 pontos onde o jogo escreve HTML/texto na tela
// (showModal, showToast, showLootPopup, e o início de cada renderXxxTab).
//
// t(key) é usado só nos poucos elementos que são atualizados em todo tick
// de combate (renderTopBar/renderHunterLevel/renderCombatStats/
// renderPlayerHp) — são strings curtas e fixas, direto por chave, sem
// varrer o DOM a cada 100-250ms.

let currentLang = 'pt';

export function getLanguage() {
  return currentLang;
}

export function initLanguage(state) {
  const lang = (state && state.settings && state.settings.language) || 'pt';
  currentLang = lang === 'en' ? 'en' : 'pt';
  return currentLang;
}

export function setLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'pt';
  return currentLang;
}

// ---------------------------------------------------------------
// A) Chaves curtas pra hot-path (atualizadas a cada tick de combate).
// ---------------------------------------------------------------
const T_KEYS = {
  huntLevel: { pt: (n) => `Nível de Caça ${n}`, en: (n) => `Hunt Level ${n}` },
  hunter: { pt: 'Caçador', en: 'Hunter' },
  attackSpeed: { pt: 'Velocidade de Ataque', en: 'Attack Speed' },
  dps: { pt: 'DPS', en: 'DPS' },
  armor: { pt: 'Armadura', en: 'Armor' },
  critChance: { pt: 'Taxa de Crítico', en: 'Crit Chance' },
  critDamage: { pt: 'Dano Crítico', en: 'Crit Damage' },
  element: { pt: 'Elemento', en: 'Element' },
};

export function t(key, ...args) {
  const entry = T_KEYS[key];
  if (!entry) return key;
  const value = entry[currentLang] || entry.pt;
  return typeof value === 'function' ? value(...args) : value;
}

// ---------------------------------------------------------------
// B) Frases inteiras (texto estático de HTML, banners, toasts sem parte
// dinâmica, títulos/labels de botão, etc.)
// ---------------------------------------------------------------
const EXACT_MAP = {
  // index.html (chrome estático)
  'Perfil': 'Profile',
  'Versão do jogo': 'Game version',
  'Caça': 'Hunt',
  'Selecionar Monstros': 'Select Monsters',
  'Escolher quais monstros caçar': 'Choose which monsters to hunt',
  'Informações de Batalha': 'Battle Info',
  '🟢 Seus Atributos': '🟢 Your Stats',
  '💀 Informações do Inimigo': '💀 Enemy Info',
  '⚡ Velocidade de Ataque': '⚡ Attack Speed',
  '💥 DPS': '💥 DPS',
  '🛡️ Armadura': '🛡️ Armor',
  '🎯 Taxa de Crítico': '🎯 Crit Chance',
  '💢 Dano Crítico': '💢 Crit Damage',
  '✨ Elemento': '✨ Element',
  '❤️ Vida Atual': '❤️ Current HP',
  '⚔️ Dano de Ataque': '⚔️ Attack Damage',
  'Nível de Caça 1': 'Hunt Level 1',
  'Cartas': 'Cards',
  'Loja': 'Shop',
  'Conquistas': 'Achievements',
  'Missão Diária': 'Daily Mission',
  'Transcender': 'Transcend',
  'Arena': 'Arena',
  'Ranks': 'Ranks',
  'Correio': 'Mailbox',
  'Equipamentos': 'Equipment',
  'Habilidades': 'Skills',
  'Mascotes': 'Pets',
  'Eventos': 'Events',
  'Outros': 'More',
  'Fechar': 'Close',
  'Linguagem': 'Language',
  'Áudio': 'Audio',

  // toasts sem parte dinâmica
  '⚔️ Chefe! 30 segundos para derrotá-lo, ou ele foge.': '⚔️ Boss! 30 seconds to defeat it, or it flees.',
  '💀 Seu personagem morreu! Recuperando e tentando novamente...': '💀 Your character died! Recovering and trying again...',
  '⏳ Tempo esgotado contra o chefe! Ele fugiu — tentando novamente...': '⏳ Time ran out against the boss! It fled — trying again...',
  '❌ Selecione ao menos 1 monstro.': '❌ Select at least 1 monster.',
  '🔒 Monstro ainda não liberado nesse nível.': '🔒 Monster not yet unlocked at this level.',
  '✅ Esse monstro já está selecionado pra caça.': '✅ This monster is already selected for the hunt.',
  '✅ Nick atualizado!': '✅ Nickname updated!',
  '⬆️ Item aprimorado!': '⬆️ Item upgraded!',
  '✨ Item evoluiu para Rank Master!': '✨ Item evolved to Master Rank!',
  '🌟 Item ascendeu de raridade!': '🌟 Item rarity ascended!',
  '✨ Bônus escolhido!': '✨ Bonus chosen!',
  '🔒 Só dá pra equipar 1 mascote por elemento — desequipe o outro do mesmo elemento primeiro.': '🔒 You can only equip 1 pet per element — unequip the other one of the same element first.',
  '🌟 Nenhum par de mascotes iguais (mesma espécie/raridade/nível) disponível pra fundir agora.': '🌟 No matching pet pair (same species/rarity/level) available to fuse right now.',
  '🛒 Compra realizada!': '🛒 Purchase complete!',
  '⚡ Turbo de DPS ativado! +30% de DPS por 30 min.': '⚡ DPS Boost activated! +30% DPS for 30 min.',
  '⏰ +30 min no limite de recompensa offline!': '⏰ +30 min to the offline reward limit!',
  '🚫 Missão abandonada.': '🚫 Mission abandoned.',
  '❌ Não foi possível conectar à Arena PvP agora. Tente de novo mais tarde.': '❌ Could not connect to the PvP Arena right now. Try again later.',
  '👑 Chocar Todos é uma funcionalidade exclusiva de VIP — compre na loja de Cash.': '👑 Hatch All is a VIP-exclusive feature — buy it in the Cash shop.',
  '🐣 Novo mascote chocado!': '🐣 New pet hatched!',
  '⚔️ Combate Permanente iniciado! Cause o máximo de dano possível em 30 segundos.': '⚔️ Endless Combat started! Deal as much damage as possible in 30 seconds.',
  '🎒 Inventário de mascotes já está cheio — nenhum ovo chocado.': '🎒 Pet inventory is already full — no eggs hatched.',
  'Bônus das Cartas Ativas': 'Active Card Bonus',
  'Nenhuma carta equipada ainda.': 'No card equipped yet.',
  'Nenhuma mensagem por enquanto.': 'No messages yet.',
  'Carregando...': 'Loading...',
  'elemento de ataque': 'attack element',
  'Destruir': 'Destroy',
  'Confirmar destruição': 'Confirm destruction',
  'Selecionar Todos': 'Select All',
  'Destruir selecionados': 'Destroy selected',
  'Sair da seleção': 'Exit selection',
  'Desequipar': 'Unequip',
  'Equipar': 'Equip',
  '🔒 Equipar': '🔒 Equip',
  '🔒 Reciclar': '🔒 Recycle',
  'Confirmar reset': 'Confirm reset',
  '🔒 VIP': '🔒 VIP',
  'Escolher': 'Choose',
  'Escolhida': 'Chosen',
  'Um monstro que não revida, cause o máximo de dano possível em 30 segundos, suba de rank e ganhe recompensas.': 'A monster that won\'t fight back — deal as much damage as possible in 30 seconds, climb the rank, and earn rewards.',
  'Confirmar Transcendência': 'Confirm Transcend',
  'Nenhum item ainda. Derrote monstros na Caça para conseguir equipamentos.': 'No items yet. Defeat monsters in the Hunt to get equipment.',

  // Arco/Aljava por zona (ver ZONE_BOW_NAMES em data/items.js) — nome e
  // adjetivo juntos sem conector "de/da/do", então a REGEX_RULE genérica
  // de item não serve (ela exige um conector) — precisa do par exato.
  'Arco Novato': 'Novice Bow',
  'Aljava Novato': 'Novice Quiver',
  'Arco Iniciante': 'Beginner Bow',
  'Aljava Iniciante': 'Beginner Quiver',
  'Arco Élfico': 'Elven Bow',
  'Aljava Élfica': 'Elven Quiver',
  'Arco Real': 'Royal Bow',
  'Aljava Real': 'Royal Quiver',
  'Arco Sombrio': 'Shadow Bow',
  'Aljava Sombria': 'Shadow Quiver',
  'Arco Tempestuoso': 'Stormy Bow',
  'Aljava Tempestuosa': 'Stormy Quiver',
  'Arco Dracônico': 'Draconic Bow',
  'Aljava Dracônica': 'Draconic Quiver',
  'Arco Primordial': 'Primordial Bow',
  'Aljava Primordial': 'Primordial Quiver',
  'Ver Estatísticas': 'View Stats',

  // Conquistas (data/achievements.js) — nomes das 10 conquistas
  'Nível de Caçador': 'Hunter Level',
  'Monstros Caçados': 'Monsters Hunted',
  'Cartas Adquiridas': 'Cards Acquired',
  'Transcendências': 'Transcendences',
  'Tier da Arena': 'Arena Tier',
  'Missões Diárias Feitas': 'Daily Missions Done',
  'Itens Rank Master': 'Master Rank Items',
  'Ovos Chocados': 'Eggs Hatched',
  'Ouro Acumulado': 'Gold Accumulated',
  'Vitórias na Arena': 'Arena Wins',
};

// ---------------------------------------------------------------
// C) Regras com partes dinâmicas (número, nome de item/carta/mascote,
// etc.) — cada regra casa a frase inteira e reconstrói em inglês,
// preservando os grupos capturados como estão (nomes próprios não são
// traduzidos).
// ---------------------------------------------------------------
const REGEX_RULES = [
  [/^Carta de (.+)$/, (_, name) => `${name} Card`],
  [/^Nenhum mascote ainda\. Derrote monstros ou vença eventos pra achar ovos, depois choque na aba aqui em cima\.$/,
    () => 'No pets yet. Defeat monsters or win events to find eggs, then hatch them in this tab.'],
  [/^Ovos:$/, () => 'Eggs:'],
  [/^Chocar Ovo$/, () => 'Hatch Egg'],
  [/^Chocar Todos \((\d+)\)$/, (_, n) => `Hatch All (${n})`],
  [/^Equipados \(até (\d+), 1 por elemento\)$/, (_, n) => `Equipped (up to ${n}, 1 per element)`],
  [/^Etapa (\d+)$/, (_, n) => `Stage ${n}`],
  [/^🔹 Pontos disponíveis:$/, () => '🔹 Available points:'],
  [/^\((\d+)\/(\d+) gastos\)$/, (_, spent, total) => `(${spent}/${total} spent)`],
  [/^🔒 Especial da Etapa (\d+) — precisa gastar (\d+) pontos no total\s*\((.+)\)\s*e ter pelo menos 1 nível na linha de cima (.+)$/,
    (_, stage, total, ratio, check) => `🔒 Stage ${stage} Special — needs ${total} total points spent (${ratio}) and at least 1 level in the row above ${check}`],
  [/^Nível (\d+) \/ (\d+)$/, (_, cur, max) => `Level ${cur} / ${max}`],
  [/^Aprimorar para \+(\d+)$/, (_, n) => `Upgrade to +${n}`],
  [/^\+([\d.,]+%?) Dano de Perfuração$/, (_, v) => `+${v} Piercing Damage`],
  [/^Alcance o nível de caça (\d+)\.$/, (_, n) => `Reach hunt level ${n}.`],
  [/^Derrote ([\d.,]+) monstros\.$/, (_, n) => `Defeat ${n} monsters.`],
  [/^Colecione (\d+) cartas diferentes\.$/, (_, n) => `Collect ${n} different cards.`],
  [/^Transcenda (\d+) (?:vez|vezes)\.$/, (_, n) => `Transcend ${n} time${n === '1' ? '' : 's'}.`],
  [/^Alcance o tier (.+) na Arena\.$/, (_, tier) => `Reach ${applyWordMap(tier)} tier in the Arena.`],
  [/^Complete (\d+) missões diárias\.$/, (_, n) => `Complete ${n} daily missions.`],
  [/^Evolua (\d+) itens pra Rank Master\.$/, (_, n) => `Evolve ${n} items to Master Rank.`],
  [/^Choque (\d+) ovos de mascote\.$/, (_, n) => `Hatch ${n} pet eggs.`],
  [/^Acumule ([\d.,]+) de ouro ao longo do jogo\.$/, (_, n) => `Accumulate ${n} gold throughout the game.`],
  [/^Vença (\d+) combates na Arena\.$/, (_, n) => `Win ${n} Arena battles.`],
  [/^Fragmento de Carta: (.+)$/, (_, n) => `Card Fragment: ${n}`],
  [/^Fragmento de Mascote: (.+)$/, (_, n) => `Pet Fragment: ${n}`],
  [/^(.+) DPS \((.+)\)$/, (_, icon, dmgType) => `${icon} DPS (${applyWordMap(dmgType)})`],
  [/^⚔️ Vantagem elemental \(\+(\d+)%\)$/, (_, pct) => `⚔️ Elemental advantage (+${pct}%)`],
  [/^⚠️ Desvantagem elemental \((-?\d+)%\)$/, (_, pct) => `⚠️ Elemental disadvantage (${pct}%)`],
  [/^🎒 Inventário de itens cheio! Item convertido em \+(\d+) (.*)\.$/, (_, qty, mat) => `🎒 Item inventory full! Item converted into +${qty} ${mat}.`],
  [/^🎁 Item dropado: (.+) \((.+)\)!$/, (_, name, rarity) => `🎁 Item dropped: ${name} (${rarity})!`],
  [/^⭐ Nível de caça (\d+)! Novas zonas\/chefes podem ter sido liberados\.$/, (_, n) => `⭐ Hunt level ${n}! New zones/bosses may have been unlocked.`],
  [/^(.+) Ovo de mascote encontrado!$/, (_, icon) => `${icon} Pet egg found!`],
  [/^(.+) Transcender desbloqueado! Veja a aba Transcender em Outros\.$/, (_, icon) => `${icon} Transcend unlocked! Check the Transcend tab under More.`],
  [/^🎯 (.+) selecionado pra caça!$/, (_, name) => `🎯 ${name} selected for the hunt!`],
  [/^❌ (.+) insuficiente pra trocar o nick\.$/, (_, icon) => `❌ Not enough ${icon} to change your nickname.`],
  [/^(.+) Recompensa resgatada!$/, (_, icon) => `${icon} Reward claimed!`],
  [/^(.+) Já havia (\d+) cartas dessa equipadas — a carta voltou pro inventário\.$/, (_, icon, n) => `${icon} You already had ${n} copies of this card equipped — the card went back to your inventory.`],
  [/^❌ Você só pode ter (\d+) cartas iguais equipadas ao mesmo tempo\.$/, (_, n) => `❌ You can only have ${n} matching cards equipped at the same time.`],
  [/^(.+) Carta encaixada!$/, (_, icon) => `${icon} Card socketed!`],
  [/^(.+) Carta removida\.$/, (_, icon) => `${icon} Card removed.`],
  [/^🗑️ (.+) destruído! ?(.*)$/, (_, name, refund) => `🗑️ ${name} destroyed! ${refund}`.trim()],
  [/^(.+) \+(.+) Esmeralda!$/, (_, icon, amount) => `${icon} +${amount} Emerald!`],
  [/^♻️ (.+) reciclada: \+(\d+) (.+)!$/, (_, name, val, frag) => `♻️ ${name} recycled: +${val} ${frag}!`],
  [/^🛠️ (.+) craftada!$/, (_, name) => `🛠️ ${name} crafted!`],
  [/^♻️ Mascote reciclado: \+(.+) Fragmentos\.$/, (_, val) => `♻️ Pet recycled: +${val} Fragments.`],
  [/^✨ Mascotes fundidos! Novo nível: \+(\d+)$/, (_, lvl) => `✨ Pets fused! New level: +${lvl}`],
  [/^🎒 Inventário de mascotes cheio! Mascote convertido em \+(.+) Fragmentos\.$/, (_, val) => `🎒 Pet inventory full! Pet converted into +${val} Fragments.`],
  [/^🗑️ (\d+) (?:item destruído|itens destruídos)! ?(.*)$/, (_, n, refund) => `🗑️ ${n} item${n === '1' ? '' : 's'} destroyed! ${refund}`.trim()],
  [/^(.+) Pontos de habilidade resetados!$/, (_, icon) => `${icon} Skill points reset!`],
  [/^🌌 Carta recebida: (.*)!$/, (_, name) => `🌌 Card received: ${name}!`],
  [/^✨ (.+) comprado! Escolha os atributos no inventário\.$/, (_, name) => `✨ ${name} purchased! Choose the attributes in your inventory.`],
  [/^(.+) \+(.+) Esmeralda!$/, (_, icon, val) => `${icon} +${val} Emerald!`],
  [/^(.+) Missão selecionada — boa sorte!$/, (_, icon) => `${icon} Mission selected — good luck!`],
  [/^(.+) Nova missão sorteada!$/, (_, icon) => `${icon} New mission drawn!`],
  [/^(.+) Recompensas resgatadas!$/, (_, icon) => `${icon} Rewards claimed!`],
  [/^(.+) Você Transcendeu! Uma nova jornada começa\.$/, (_, icon) => `${icon} You Transcended! A new journey begins.`],

  // Nomes de item/equipamento/material gerados proceduralmente (ver
  // buildItemTemplate em data/items.js e os drops de monstro/boss em
  // data/monsters.js) — sempre "Palavra Palavra" com Iniciais Maiúsculas,
  // ligadas por "de/da/do". Detecta esse formato (frases comuns não usam
  // Maiúscula em cada palavra) e traduz cada pedaço, preservando nomes
  // próprios de boss (que não batem em nenhuma entrada do WORD_MAP, então
  // saem sem alteração). "+1"/"+2" de nível de aprimoramento (se houver)
  // fica de fora do grupo capturado e é preservado como está.
  [/^([A-ZÀ-Ö][a-zà-ÿ']*(?: [A-ZÀ-Ö][a-zà-ÿ']*)*) (?:de|da|do|dos|das) ([A-ZÀ-Ö][a-zà-ÿ']*(?: [A-ZÀ-Ö][a-zà-ÿ']*)*) (?:de|da|do|dos|das) ([A-ZÀ-Ö][a-zà-ÿ']*(?: [A-ZÀ-Ö][a-zà-ÿ']*)*)$/,
    (_, a, b, c) => `${applyWordMap(a)} of ${applyWordMap(b)} of ${applyWordMap(c)}`],
  [/^([A-ZÀ-Ö][a-zà-ÿ']*(?: [A-ZÀ-Ö][a-zà-ÿ']*)*) (?:de|da|do|dos|das) ([A-ZÀ-Ö][a-zà-ÿ']*(?: [A-ZÀ-Ö][a-zà-ÿ']*)*)$/,
    (_, a, b) => `${applyWordMap(a)} of ${applyWordMap(b)}`],
  // "Categoria Adjetivo" sem conector (ex: "Capuz Sombrio", "Anel Astral")
  // — em português o adjetivo vem depois; em inglês antes, então inverte
  // a ordem ao traduzir. Só dispara se a 1ª palavra for uma categoria de
  // item conhecida, pra não capturar frases genéricas de 2 palavras.
  [/^(Anel|Arco|Aljava|Armadura|Bota|Botas|Cajado|Calça|Capuz|Colar|Elmo|Escudo|Espada|Grimório|Luva|Luvas|Túnica|Peito|Sapatos) ([A-ZÀ-Ö][a-zà-ÿ']*)$/,
    (_, category, adj) => `${applyWordMap(adj)} ${applyWordMap(category)}`],
];

// ---------------------------------------------------------------
// D) Fallback genérico palavra/expressão (raridades, atributos,
// elementos, verbos e substantivos comuns do jogo). Ordem importa —
// expressões maiores primeiro, pra não quebrar em pedaços.
// ---------------------------------------------------------------
const WORD_MAP = [
  // Frases mais específicas SEMPRE antes das palavras que as compõem —
  // a substituição é sequencial e muta o texto a cada passo, então uma
  // palavra genérica cedo (ex: "Perfil" -> "Profile") quebraria uma
  // frase mais específica depois (ex: "Ícone do Perfil") se a ordem
  // fosse invertida.
  ['Rank Master', 'Master Rank'],
  ['Ícone do Perfil', 'Profile Icon'],

  // Vocabulário de itens/equipamentos/materiais — usado tanto isolado
  // quanto pelas REGEX_RULES de "X de/da/do Y" mais abaixo (que montam
  // nomes de item tipo "Peito da Força de Sylkar" -> "Chest of Strength
  // of Sylkar", mantendo nomes próprios de boss como estão).
  ['Cabeça', 'Head'],
  ['Peito', 'Chest'],
  ['Calça', 'Legs'],
  ['Mãos', 'Hands'],
  ['Luvas', 'Gloves'],
  ['Luva', 'Glove'],
  ['Botas', 'Boots'],
  ['Bota', 'Boot'],
  ['Sapatos', 'Shoes'],
  ['Anel', 'Ring'],
  ['Colar', 'Necklace'],
  ['Espada', 'Sword'],
  ['Arco', 'Bow'],
  ['Cajado', 'Staff'],
  ['Escudo', 'Shield'],
  ['Aljava', 'Quiver'],
  ['Livro', 'Book'],
  ['Capuz', 'Hood'],
  ['Dual Blade', 'Dual Blade'],
  ['Adagas', 'Daggers'],
  ['Martelo', 'Hammer'],
  ['Machado', 'Axe'],
  ['Tridente', 'Trident'],
  ['Manto', 'Cloak'],
  // temas de conjuntos de item (não são nomes próprios)
  ['Floresta', 'Forest'],
  ['Montanha', 'Mountain'],
  ['Sombria', 'Shadow'],
  ['Sombrio', 'Shadow'],
  ['Selvagem', 'Wild'],
  ['Tempestuosa', 'Stormy'],
  ['Tempestuoso', 'Stormy'],
  ['Tempestade', 'Storm'],
  ['Cristal', 'Crystal'],
  ['Élfica', 'Elven'],
  ['Élfico', 'Elven'],
  ['Dracônica', 'Draconic'],
  ['Dracônico', 'Draconic'],
  ['Novato', 'Novice'],
  ['Iniciante', 'Beginner'],
  ['Vento', 'Wind'],
  ['Despertar', 'Awakening'],
  ['Arqueiro', 'Archer'],
  ['Congelante', 'Freezing'],
  ['Flamejante', 'Flaming'],
  ['Venenosa', 'Venomous'],
  ['Venenoso', 'Venomous'],
  ['Cravado', 'Studded'],
  ['Esvaído', 'Faded'],
  ['Ancião', 'Elder'],
  ['Rainha', 'Queen'],
  ['Rei', 'King'],
  // materiais de drop
  ['Pelo', 'Fur'],
  ['Gema', 'Gem'],
  ['Presa', 'Fang'],
  ['Pelagem', 'Pelt'],
  ['Teia', 'Web'],
  ['Veneno', 'Venom'],
  ['Fragmento', 'Fragment'],
  ['Núcleo', 'Core'],
  ['Escama', 'Scale'],
  ['Coração', 'Heart'],
  ['Crânio', 'Skull'],
  ['Garra', 'Claw'],
  ['Dente', 'Tooth'],
  ['Chifre', 'Horn'],
  ['Sangue', 'Blood'],
  ['Pena', 'Feather'],
  ['Chama', 'Flame'],
  ['Gelo', 'Ice'],
  ['Pedra', 'Stone'],
  ['Rocha', 'Rock'],
  ['Osso', 'Bone'],
  ['Couro', 'Leather'],
  ['Casco', 'Hoof'],
  ['Espinho', 'Thorn'],
  ['Raiz', 'Root'],
  ['Folha', 'Leaf'],
  ['Casca', 'Bark'],
  ['Olho', 'Eye'],
  ['Asa', 'Wing'],
  ['Cauda', 'Tail'],
  ['Concha', 'Shell'],
  ['Elmo', 'Helmet'],
  ['Grimório', 'Grimoire'],
  ['Túnica', 'Robe'],
  ['Gelada', 'Frozen'],
  ['Gelado', 'Frozen'],
  ['Mística', 'Mystic'],
  ['Místico', 'Mystic'],
  ['Nobre', 'Noble'],
  ['Rúnica', 'Runic'],
  ['Rúnico', 'Runic'],
  ['Alquimista', 'Alchemist'],
  ['Aprendiz', 'Apprentice'],
  ['Bastião', 'Bastion'],
  ['Cavaleiro', 'Knight'],
  ['Caçador', 'Hunter'],
  ['Dragão', 'Dragon'],
  ['Cronomante', 'Chronomancer'],
  ['Ferreiro', 'Blacksmith'],
  ['Grifo', 'Griffin'],
  ['Guerreiro', 'Warrior'],
  ['Lobo', 'Wolf'],
  ['Mago', 'Mage'],
  ['Patrulheiro', 'Ranger'],
  ['Sereia', 'Mermaid'],
  ['Trovejante', 'Thundering'],
  ['Trovão', 'Thunder'],
  ['Corcel', 'Steed'],
  ['Coroa', 'Crown'],
  ['Colosso', 'Colossus'],
  ['Corrente', 'Chain'],
  ['Quebrado', 'Broken'],
  ['Quebrada', 'Broken'],
  ['Vulcânica', 'Volcanic'],
  ['Vulcânico', 'Volcanic'],
  ['Guardião', 'Guardian'],
  ['Eterno', 'Eternal'],
  ['Eterna', 'Eternal'],
  ['Vazio', 'Void'],
  ['Fenda', 'Rift'],
  ['Gigante', 'Giant'],
  ['Ferradura', 'Horseshoe'],
  ['Galhada', 'Antlers'],
  ['Galhos', 'Branches'],
  ['Petrificada', 'Petrified'],
  ['Petrificado', 'Petrified'],
  ['Gota', 'Drop'],
  ['Pura', 'Pure'],
  ['Puro', 'Pure'],
  ['Deserto', 'Desert'],
  ['Abrasador', 'Scorching'],
  ['Incandescente', 'Blazing'],
  ['Encandescente', 'Blazing'],
  ['Antigas', 'Ancient'],
  ['Antigo', 'Ancient'],
  ['Catacumbas', 'Catacombs'],
  ['Pântano', 'Swamp'],
  ['Corrupção', 'Corruption'],
  ['Trilha', 'Trail'],
  ['Cachoeira', 'Waterfall'],
  ['Túnel', 'Tunnel'],
  ['Subterrâneo', 'Underground'],
  ['Vale', 'Valley'],
  ['Ventos', 'Winds'],
  ['Elétricos', 'Electric'],
  ['Ruína', 'Ruin'],
  ['Cósmica', 'Cosmic'],
  ['Lança', 'Spear'],
  ['Sinfonia', 'Symphony'],
  ['Lâmina', 'Blade'],
  ['Abissal', 'Abyssal'],
  ['Marreta', 'Mace'],
  ['Peitoral', 'Chestplate'],
  ['Devastador', 'Devastator'],
  ['Fome', 'Hunger'],
  ['Verde', 'Green'],
  ['Talismã', 'Talisman'],
  ['Chapéu', 'Hat'],
  ['Musgoso', 'Mossy'],
  ['Círculo', 'Circle'],
  ['Cetro', 'Scepter'],
  ['Domínio', 'Dominion'],
  ['Ósseo', 'Bone'],
  ['Oráculo', 'Oracle'],
  ['Ígneo', 'Fiery'],
  ['Ígnea', 'Fiery'],
  ['Folhagem', 'Foliage'],
  ['Sombra', 'Shadow'],
  ['Fechadura', 'Lock'],
  ['Mimética', 'Mimic'],
  ['Brasa', 'Ember'],
  ['Vivo', 'Living'],
  ['Cristais', 'Crystals'],
  ['Gruta', 'Grotto'],
  ['Serpente', 'Serpent'],
  ['por nível', 'per level'],
  ['ainda.', 'yet.'],
  ['📋 Padrão', '📋 Default'],
  ['Padrão', 'Default'],
  ['Salvar', 'Save'],
  ['Cancelar', 'Cancel'],
  ['Confirmar', 'Confirm'],
  ['Sincronizar Stats', 'Sync Stats'],
  ['Conectar à Arena', 'Connect to Arena'],
  ['Carregar Ranks', 'Load Ranks'],
  ['Resgatar Todos', 'Claim All'],
  ['Fundir Tudo', 'Fuse All'],
  ['Assistir Anúncio', 'Watch Ad'],
  ['Seu nick', 'Your nickname'],
  ['Como aparece pros outros', 'How you appear to others'],
  ['Grátis (1ª troca)', 'Free (1st change)'],
  ['Grátis', 'Free'],
  ['Troca de nick', 'Nickname change'],
  ['Esmeralda insuficiente', 'Not enough Emerald'],
  ['Efeitos Sonoros', 'Sound Effects'],
  ['Equipados', 'Equipped'],
  ['Colecionadas', 'Collected'],
  ['Sua vida', 'Your HP'],
  ['Cartas Deus', 'God Cards'],
  ['Cartas de Boss', 'Boss Cards'],
  ['Cartas de Monstros', 'Monster Cards'],
  ['Reseta em', 'Resets in'],
  ['Você já concluiu a missão hoje. Volte amanhã!', "You've already completed the mission today. Come back tomorrow!"],
  ['Recompensa diária em', 'Daily reward in'],
  ['Você tem', 'You have'],
  ['Avisos e recompensas da Arena chegam aqui.', 'Arena notices and rewards arrive here.'],
  ['Nível de Caça', 'Hunt Level'],
  ['Dano Crítico', 'Crit Damage'],
  ['Taxa de Crítico', 'Crit Chance'],
  ['Chance Crítica', 'Crit Chance'],
  ['Chance de Material', 'Material Chance'],
  ['Dano do Mascote', 'Pet Damage'],
  ['Cura por Golpe', 'Lifesteal per Hit'],
  ['Esquiva', 'Dodge'],
  ['Velocidade de Ataque', 'Attack Speed'],
  ['Vida Máxima', 'Max HP'],
  ['Perfil', 'Profile'],
  ['Música', 'Music'],
  ['Atualizar', 'Refresh'],
  ['Disponível', 'Available'],
  ['Bloqueado', 'Locked'],
  ['Concluído', 'Completed'],
  ['Vitórias', 'Wins'],
  ['Derrotas', 'Losses'],
  ['Ranking', 'Ranking'],
  ['Posição', 'Position'],
  ['Grupo', 'Group'],
  ['Semana', 'Week'],
  ['Hoje', 'Today'],
  ['Amanhã', 'Tomorrow'],
  ['segundos', 'seconds'],
  ['minutos', 'minutes'],
  ['horas', 'hours'],
  ['Nenhuma', 'No'],
  ['Nenhum', 'No'],
  ['Detalhes', 'Details'],
  ['Selecionado', 'Selected'],
  ['Selecionar', 'Select'],
  ['Escolher', 'Choose'],
  ['Escolha', 'Choose'],
  ['Recolher', 'Collect'],
  ['Ativo', 'Active'],
  ['Inativo', 'Inactive'],
  ['Ligado', 'On'],
  ['Desligado', 'Off'],
  ['Zona', 'Zone'],
  ['Nível', 'Level'],
  ['Vida Máxima', 'Max HP'],
  ['Vida', 'HP'],
  ['Armadura', 'Armor'],
  ['Ataque', 'Attack'],
  ['Defesa', 'Defense'],
  ['Dano', 'Damage'],
  ['Crítico', 'Crit'],
  ['Elemento', 'Element'],
  ['Físico', 'Physical'],
  ['Perfuração', 'Piercing'],
  ['Perfurante', 'Piercing'],
  ['Mágico', 'Magic'],
  ['Força', 'Strength'],
  ['Destreza', 'Dexterity'],
  ['Inteligência', 'Intelligence'],
  ['Raridade máxima', 'Max rarity'],
  ['Raridade', 'Rarity'],
  ['Comum', 'Common'],
  ['Incomum', 'Uncommon'],
  ['Raro', 'Rare'],
  ['Épico', 'Epic'],
  ['Lendário', 'Legendary'],
  ['Prata', 'Silver'],
  ['Ouro', 'Gold'],
  ['Platina', 'Platinum'],
  ['Diamante', 'Diamond'],
  ['Mítico', 'Mythic'],
  ['Deus', 'God'],
  ['Inventário', 'Inventory'],
  ['cheio', 'full'],
  ['convertido em', 'converted into'],
  ['Item dropado', 'Item dropped'],
  ['equipado', 'equipped'],
  ['Equipar', 'Equip'],
  ['Desequipar', 'Unequip'],
  ['Vender', 'Sell'],
  ['Destruir', 'Destroy'],
  ['selecionado', 'selected'],
  ['Comprar com Esmeralda', 'Buy with Emerald'],
  ['Comprar', 'Buy'],
  ['Esmeralda', 'Emerald'],
  ['Bônus (Assistir Anúncio)', 'Bonuses (Watch Ad)'],
  ['Turbo de DPS', 'DPS Boost'],
  ['Bônus Idle', 'Idle Bonus'],
  ['Saco de Ouro', 'Bag of Gold'],
  ['Baú de Ouro', 'Chest of Gold'],
  ['Fundir', 'Fuse'],
  ['Chocar', 'Hatch'],
  ['ovo', 'egg'],
  ['Ovo', 'Egg'],
  ['mascote', 'pet'],
  ['Mascote', 'Pet'],
  ['carta', 'card'],
  ['Carta', 'Card'],
  ['item', 'item'],
  ['Item', 'Item'],
  ['monstro', 'monster'],
  ['Monstro', 'Monster'],
  ['chefe', 'boss'],
  ['Chefe', 'Boss'],
  ['jogador', 'player'],
  ['Jogador', 'Player'],
  ['recompensa', 'reward'],
  ['Recompensa', 'Reward'],
  ['resgatada', 'claimed'],
  ['resgatado', 'claimed'],
  ['resgatadas', 'claimed'],
  ['missão', 'mission'],
  ['Missão', 'Mission'],
  ['diária', 'daily'],
  ['Diária', 'Daily'],
  ['semanal', 'weekly'],
  ['Semanal', 'Weekly'],
  ['fragmentos', 'fragments'],
  ['Fragmentos', 'Fragments'],
];

// \b nativo do JS só considera [A-Za-z0-9_] como "palavra" — qualquer frase
// que comece/termine com letra acentuada (Ícone, Épico, área, etc.) nunca
// bateria a fronteira. Usa lookaround manual cobrindo letras acentuadas
// latinas também.
const WORD_CHAR = 'A-Za-z0-9_À-ÖØ-öø-ÿ';
function applyWordMap(text) {
  let out = text;
  for (const [pt, en] of WORD_MAP) {
    const escaped = pt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?<![${WORD_CHAR}])${escaped}(?![${WORD_CHAR}])`, 'g'), en);
  }
  return out;
}

export function translateText(str) {
  if (currentLang !== 'en') return str;
  if (!str) return str;
  const trimmed = str.trim();
  if (!trimmed) return str;

  if (EXACT_MAP[trimmed]) {
    return str.replace(trimmed, EXACT_MAP[trimmed]);
  }
  for (const [re, fn] of REGEX_RULES) {
    if (re.test(trimmed)) {
      return str.replace(trimmed, trimmed.replace(re, fn));
    }
  }
  return applyWordMap(str);
}

// ---------------------------------------------------------------
// Varredura de DOM: aplica translateText em todo nó de texto + nos
// atributos title/placeholder de um container já renderizado. `alt` é
// deliberadamente ignorado (texto de imagem não aparece na tela).
// ---------------------------------------------------------------
export function translateContainer(root) {
  if (currentLang !== 'en' || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue && node.nodeValue.trim()) nodes.push(node);
  }
  for (const n of nodes) {
    n.nodeValue = translateText(n.nodeValue);
  }
  const attrEls = root.querySelectorAll('[title], [placeholder]');
  for (const el of attrEls) {
    if (el.title) el.title = translateText(el.title);
    if (el.placeholder) el.placeholder = translateText(el.placeholder);
  }
  if (root.title) root.title = translateText(root.title);
}
