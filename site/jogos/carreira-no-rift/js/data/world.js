// Dados estáticos do mundo: atributos, rotas, regiões, nacionalidades e times.
//
// Os nomes de times/ligas são usados só como referência de fã; os escudos
// são gerados (sigla + cores), sem logos oficiais.

export const ATTRS = [
  { id: 'mec', name: 'Mecânica' },
  { id: 'rota', name: 'Fase de rotas' },
  { id: 'macro', name: 'Macro' },
  { id: 'tf', name: 'Teamfight' },
  { id: 'mental', name: 'Mental' },
];

// `w` = peso de cada atributo no OVR da rota (soma 1).
// `kda` = média de abates/mortes/assistências por partida de um jogador ~70.
export const ROLES = {
  top: {
    id: 'top', name: 'Top', short: 'TOP', desc: 'Ilha, duelos longos e teleporte na hora certa.',
    w: { mec: 0.22, rota: 0.32, macro: 0.16, tf: 0.2, mental: 0.1 },
    kda: { k: 2.6, d: 2.6, a: 4.8 },
  },
  jungle: {
    id: 'jungle', name: 'Jungle', short: 'JG', desc: 'Controle de objetivos, ganks e leitura do mapa.',
    w: { mec: 0.16, rota: 0.08, macro: 0.36, tf: 0.2, mental: 0.2 },
    kda: { k: 2.9, d: 2.7, a: 7.2 },
  },
  mid: {
    id: 'mid', name: 'Mid', short: 'MID', desc: 'O centro do mapa. Roaming, pressão e carregadas.',
    w: { mec: 0.3, rota: 0.26, macro: 0.2, tf: 0.14, mental: 0.1 },
    kda: { k: 3.9, d: 2.3, a: 6 },
  },
  adc: {
    id: 'adc', name: 'ADC', short: 'ADC', desc: 'Dano constante. Posicionamento é tudo na teamfight.',
    w: { mec: 0.32, rota: 0.24, macro: 0.08, tf: 0.26, mental: 0.1 },
    kda: { k: 4.8, d: 2.1, a: 5.2 },
  },
  support: {
    id: 'support', name: 'Suporte', short: 'SUP', desc: 'Visão, engage e a voz que organiza o time.',
    w: { mec: 0.1, rota: 0.16, macro: 0.3, tf: 0.2, mental: 0.24 },
    kda: { k: 0.9, d: 2.9, a: 10 },
  },
};

export const STYLES = {
  agressivo: {
    id: 'agressivo', name: 'Agressivo', desc: 'Mais abates, mais mortes',
    fx: { mec: 2, mental: -2 }, kda: { k: 1.15, d: 1.2, a: 1 },
  },
  controlado: {
    id: 'controlado', name: 'Controlado', desc: 'Menos riscos, mais visão',
    fx: { macro: 2, mec: -2 }, kda: { k: 0.9, d: 0.8, a: 1.1 },
  },
};

// Calendário de 2026 (simplificado): cada liga principal tem uma Copa e dois
// splits. Vagas internacionais: `firstStand` (pela Copa), `msi` (pelo Split 1)
// e `worlds` (pelo Split 2; as regiões dos finalistas do MSI ganham +1).
export const REGIONS = {
  br: {
    id: 'br', name: 'Brasil', flag: '🇧🇷', leagues: { 1: 'CBLOL', 2: 'CBLOL Academy', 3: 'Circuito Desafiante' },
    stages: ['Copa CBLOL', 'CBLOL · Split 1', 'CBLOL · Split 2'], firstStand: 1, msi: 1, worlds: 1,
  },
  kr: {
    id: 'kr', name: 'Coreia do Sul', flag: '🇰🇷', leagues: { 1: 'LCK', 2: 'LCK Challengers', 3: 'Liga Amadora Coreana' },
    stages: ['LCK Cup', 'LCK · Rounds 1–2', 'LCK · Rounds 3–4'], firstStand: 2, msi: 2, worlds: 3,
  },
  cn: {
    id: 'cn', name: 'China', flag: '🇨🇳', leagues: { 1: 'LPL', 2: 'LDL', 3: 'Copa Universitária Chinesa' },
    stages: ['LPL · Split 1', 'LPL · Split 2', 'LPL · Split 3'], firstStand: 2, msi: 2, worlds: 3,
  },
  eu: {
    id: 'eu', name: 'Europa', flag: '🇪🇺', leagues: { 1: 'LEC', 2: 'ERL Premier', 3: 'ERL Divisão 2' },
    stages: ['LEC Versus', 'LEC Spring', 'LEC Summer'], firstStand: 1, msi: 2, worlds: 3,
  },
  na: {
    id: 'na', name: 'América do Norte', flag: '🇺🇸', leagues: { 1: 'LCS', 2: 'NACL', 3: 'Liga Universitária NA' },
    stages: ['LCS Lock-In', 'LCS Spring', 'LCS Summer'], firstStand: 1, msi: 2, worlds: 2,
  },
};

// Nível de cada região: `rank` (3 = mais forte) define as propostas-aposta
// vindas de ligas mais fortes; `growth` multiplica a evolução do OVR de quem
// joga na liga principal da região; `potential` é quanto o teto do jogador
// sobe por temporada treinando nesse ambiente.
export const REGION_LEVEL = {
  kr: { rank: 3, growth: 1.2, potential: 0.25 },
  cn: { rank: 3, growth: 1.18, potential: 0.25 },
  eu: { rank: 2, growth: 1.1, potential: 0.1 },
  na: { rank: 2, growth: 1.06, potential: 0.1 },
  br: { rank: 1, growth: 1, potential: 0 },
};

// Vagas dos convidados (Pacífico/Vietnã) em cada torneio internacional.
export const WILDCARD_SLOTS = { firstStand: 1, msi: 1, worlds: 2 };

export const NATIONS = [
  { id: 'BR', name: 'Brasil', flag: '🇧🇷', region: 'br' },
  { id: 'KR', name: 'Coreia do Sul', flag: '🇰🇷', region: 'kr' },
  { id: 'CN', name: 'China', flag: '🇨🇳', region: 'cn' },
  { id: 'PT', name: 'Portugal', flag: '🇵🇹', region: 'eu' },
  { id: 'AR', name: 'Argentina', flag: '🇦🇷', region: 'br' },
  { id: 'CL', name: 'Chile', flag: '🇨🇱', region: 'br' },
  { id: 'UY', name: 'Uruguai', flag: '🇺🇾', region: 'br' },
  { id: 'US', name: 'Estados Unidos', flag: '🇺🇸', region: 'na' },
  { id: 'CA', name: 'Canadá', flag: '🇨🇦', region: 'na' },
  { id: 'MX', name: 'México', flag: '🇲🇽', region: 'na' },
  { id: 'FR', name: 'França', flag: '🇫🇷', region: 'eu' },
  { id: 'ES', name: 'Espanha', flag: '🇪🇸', region: 'eu' },
  { id: 'DE', name: 'Alemanha', flag: '🇩🇪', region: 'eu' },
  { id: 'PL', name: 'Polônia', flag: '🇵🇱', region: 'eu' },
  { id: 'DK', name: 'Dinamarca', flag: '🇩🇰', region: 'eu' },
  { id: 'SE', name: 'Suécia', flag: '🇸🇪', region: 'eu' },
  { id: 'GB', name: 'Reino Unido', flag: '🇬🇧', region: 'eu' },
  { id: 'IT', name: 'Itália', flag: '🇮🇹', region: 'eu' },
  { id: 'TR', name: 'Turquia', flag: '🇹🇷', region: 'eu' },
];

// [id, nome, sigla, rating, cor principal, cor secundária]
const TIER1 = {
  kr: [
    ['gen', 'Gen.G', 'GEN', 91, '#a88a3a', '#111111'],
    ['t1', 'T1', 'T1', 90, '#e2012d', '#111111'],
    ['hle', 'Hanwha Life Esports', 'HLE', 88, '#f37321', '#ffffff'],
    ['kt', 'KT Rolster', 'KT', 84, '#ff1a1a', '#111111'],
    ['dk', 'Dplus KIA', 'DK', 83, '#1b1b1b', '#2fd6c3'],
    ['fox', 'BNK FEARX', 'FOX', 79, '#f4a300', '#111111'],
    ['ns', 'Nongshim RedForce', 'NS', 78, '#de2027', '#ffffff'],
    ['drx', 'Kiwoom DRX', 'DRX', 77, '#5a8dee', '#0b1a3a'],
    ['bro', 'HANJIN BRION', 'BRO', 76, '#0f5c3a', '#ffffff'],
    ['dnf', 'DN SOOPers', 'DNS', 75, '#1f5bd8', '#ffffff'],
  ],
  cn: [
    ['blg', 'Bilibili Gaming', 'BLG', 89, '#00a1d6', '#ffffff'],
    ['al', "Anyone's Legend", 'AL', 88, '#b91c1c', '#f5f5f5'],
    ['tes', 'Top Esports', 'TES', 87, '#ff6b00', '#1b1b1b'],
    ['jdg', 'JD Gaming', 'JDG', 84, '#c8102e', '#ffffff'],
    ['wbg', 'Weibo Gaming', 'WBG', 83, '#f5c400', '#1b1b1b'],
    ['ig', 'Invictus Gaming', 'IG', 81, '#1f1f1f', '#d4af37'],
    ['edg', 'EDward Gaming', 'EDG', 81, '#111111', '#ffffff'],
    ['lng', 'LNG Esports', 'LNG', 80, '#2b6cb0', '#ffffff'],
    ['nip', 'Ninjas in Pyjamas', 'NIP', 77, '#1b1b1b', '#f0e14a'],
    ['we', 'Team WE', 'WE', 75, '#e02a2f', '#ffffff'],
  ],
  eu: [
    ['g2', 'G2 Esports', 'G2', 85, '#ef3d23', '#111111'],
    ['fnc', 'Fnatic', 'FNC', 82, '#ff5900', '#111111'],
    ['mkoi', 'Movistar KOI', 'MKOI', 81, '#6b3fa0', '#ffffff'],
    ['kc', 'Karmine Corp', 'KC', 80, '#1d4ed8', '#ffffff'],
    ['vit', 'Team Vitality', 'VIT', 79, '#f5d000', '#111111'],
    ['gx', 'GIANTX', 'GX', 78, '#6ad3a8', '#111111'],
    ['th', 'Team Heretics', 'TH', 76, '#1b1b1b', '#e0b45a'],
    ['sk', 'SK Gaming', 'SK', 75, '#1b1b1b', '#ffffff'],
    ['bds', 'Shifters', 'SHFT', 75, '#7a5bd0', '#ffffff'],
    ['navi', 'Natus Vincere', 'NAVI', 74, '#fde100', '#111111'],
  ],
  na: [
    ['fly', 'FlyQuest', 'FLY', 81, '#1e8f4e', '#ffffff'],
    ['c9', 'Cloud9 Kia', 'C9', 80, '#1ea1f2', '#ffffff'],
    ['tl', 'Team Liquid Alienware', 'TL', 79, '#0c223f', '#6cc0ff'],
    ['sen', 'Sentinels', 'SEN', 75, '#ce0037', '#ffffff'],
    ['dig', 'Dignitas', 'DIG', 74, '#f7b500', '#111111'],
    ['sr', 'Shopify Rebellion', 'SR', 74, '#95bf47', '#111111'],
    ['lyon', 'LYON', 'LYON', 72, '#0033a0', '#ffffff'],
    ['dsg', 'Disguised', 'DSG', 71, '#7c3aed', '#ffffff'],
  ],
  br: [
    ['png', 'paiN Gaming', 'PNG', 78, '#e10600', '#111111'],
    ['loud', 'LOUD', 'LOUD', 77, '#13d552', '#111111'],
    ['vks', 'Vivo Keyd Stars', 'VKS', 76, '#660099', '#ffffff'],
    ['fur', 'FURIA', 'FUR', 75, '#1b1b1b', '#ffffff'],
    ['red', 'RED Canids', 'RED', 74, '#d4002a', '#ffffff'],
    ['lev', 'Leviatán', 'LEV', 73, '#1c3f94', '#ffffff'],
    ['fx', 'Fluxo W7M', 'FX', 72, '#ff4d00', '#111111'],
    ['lg', 'Los Grandes', 'LG', 69, '#0e7c3a', '#ffd400'],
  ],
};

// Times da 3ª divisão são fictícios.
const TIER3 = {
  br: ['Vórtex Gaming', 'Caiçara Esports', 'Hydra Clã', 'Rei do Norte', 'Nordeste Legends', 'Tempest BR', 'Aurora Gaming', 'Serpentes Azuis'],
  kr: ['Seoul Dynamo', 'Busan Tide', 'Incheon Phoenix', 'Daegu Storm', 'Gwangju Rising', 'Jeju Waves', 'Ulsan Titans', 'Suwon Blaze'],
  cn: ['Chengdu Pandas', 'Wuhan River', 'Hangzhou Mist', "Xi'an Terracota", 'Shenzhen Volt', 'Nanjing Lotus', 'Qingdao Tide', 'Harbin Frost'],
  eu: ['Berlin Wolves', 'Lisboa Navigators', 'Madrid Toros', 'Warsaw Hussars', 'Nordic Aurora', 'Milano Vespa', 'London Ravens', 'Paris Lumière'],
  na: ['Austin Outlaws', 'Seattle Rain', 'Toronto Maple', 'Chicago Wind', 'Miami Heatwave', 'Denver Peaks', 'Boston Harbor', 'Vegas Aces'],
};
const TIER3_COLORS = [
  ['#7c3aed', '#f5f5f5'], ['#0ea5e9', '#0b1a2a'], ['#16a34a', '#f5f5f5'], ['#dc2626', '#f5f5f5'],
  ['#f59e0b', '#1b1b1b'], ['#475569', '#f5f5f5'], ['#db2777', '#f5f5f5'], ['#0d9488', '#f5f5f5'],
];

// Convidados do Mundial/MSI que não são regiões jogáveis.
const WILDCARDS = [
  ['cfo', 'CTBC Flying Oyster', 'CFO', 78, '#0f766e', '#ffffff'],
  ['gam', 'GAM Esports', 'GAM', 75, '#facc15', '#111111'],
];

// Times que saíram do jogo. Só voltam para carreiras salvas que ainda os
// citam (histórico, temporada em andamento), para nada quebrar.
export const RETIRED_TEAMS = {
  fpx: { id: 'fpx', name: 'FunPlus Phoenix', tag: 'FPX', region: 'cn', tier: 1, rating: 76, base: 76, c1: '#e4002b', c2: '#1b1b1b', retired: true },
  '100t': { id: '100t', name: '100 Thieves', tag: '100T', region: 'na', tier: 1, rating: 77, base: 77, c1: '#e3202b', c2: '#111111', retired: true },
  '100t_ac': { id: '100t_ac', name: '100 Thieves Academy', tag: '100T.A', region: 'na', tier: 2, rating: 62, base: 62, c1: '#e3202b', c2: '#111111', retired: true },
};

export const TIER_RANGE = { 1: [66, 95], 2: [55, 80], 3: [44, 66] };

function tagFromName(name) {
  const words = name.replace(/['’]/g, '').split(/\s+/);
  const t = words.length > 1 ? words.map((w) => w[0]).join('') : name.slice(0, 3);
  return t.toUpperCase().slice(0, 4);
}

// Cria o estado inicial de todos os times (os ratings mudam a cada ano).
export function buildTeams() {
  const teams = {};
  for (const [region, list] of Object.entries(TIER1)) {
    list.forEach(([id, name, tag, rating, c1, c2]) => {
      teams[id] = { id, name, tag, region, tier: 1, rating, c1, c2 };
    });
    // Academias (2ª divisão) das 8 primeiras organizações.
    list.slice(0, 8).forEach(([id, name, tag, rating, c1, c2], i) => {
      const aid = `${id}_ac`;
      teams[aid] = {
        id: aid, name: `${name} Academy`, tag: `${tag}.A`, region, tier: 2,
        rating: rating - 15 + ((i * 7) % 5) - 2, c1, c2,
      };
    });
    TIER3[region].forEach((name, i) => {
      const id = `${region}_t3_${i}`;
      const [c1, c2] = TIER3_COLORS[i % TIER3_COLORS.length];
      teams[id] = { id, name, tag: tagFromName(name), region, tier: 3, rating: 50 + ((i * 5) % 12), c1, c2 };
    });
  }
  WILDCARDS.forEach(([id, name, tag, rating, c1, c2]) => {
    teams[id] = { id, name, tag, region: 'wc', tier: 1, rating, c1, c2 };
  });
  // `base` = nível histórico do clube; o rating oscila em torno dele.
  for (const t of Object.values(teams)) t.base = t.rating;
  return teams;
}

export const nationById = (id) => NATIONS.find((n) => n.id === id);

// Gênero do nome das ligas: "o CBLOL", "a LCK", "o Circuito Desafiante".
const MASCULINE_LEAGUES = new Set(['CBLOL', 'CBLOL Academy', 'Circuito Desafiante']);
export const ofLeague = (name) => `${MASCULINE_LEAGUES.has(name) ? 'do' : 'da'} ${name}`;
export const inLeague = (name) => `${MASCULINE_LEAGUES.has(name) ? 'no' : 'na'} ${name}`;
