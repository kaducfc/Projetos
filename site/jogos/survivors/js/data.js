// Rift Survivors: dados do jogo (campeões, armas, itens, inimigos, chefes). Tudo aqui é puro (sem DOM), para testar no Node.
export const TEMPO_BARAO = 15 * 60; // o Barão Nashor aparece aos 15:00; derrotá-lo vence a partida
export const MAX_ARMAS = 6;
export const MAX_ITENS = 6;
export const MAX_INIMIGOS = 320;

export const CAMPEOES = [
  { id: 'garen', nome: 'Garen', titulo: 'O Poder de Demacia', arma: 'lamina', hp: 150, vel: 60, armadura: 2, preco: 0, desc: 'Lâminas giram ao redor dele. Resistente, mas lento.' },
  { id: 'ahri', nome: 'Ahri', titulo: 'A Raposa de Nove Caudas', arma: 'orbe', hp: 100, vel: 68, armadura: 0, preco: 0, desc: 'Lança orbes que vão e voltam atravessando tudo.' },
  { id: 'jinx', nome: 'Jinx', titulo: 'A Atiradora Maluca', arma: 'tiro', hp: 95, vel: 64, armadura: 0, preco: 250, desc: 'Atira sem parar no inimigo mais próximo.' },
  { id: 'ashe', nome: 'Ashe', titulo: 'A Arqueira de Gelo', arma: 'flecha', hp: 105, vel: 63, armadura: 0, preco: 250, desc: 'Rajada de flechas geladas que deixam os inimigos lentos.' },
  { id: 'lux', nome: 'Lux', titulo: 'A Dama da Luz', arma: 'singular', hp: 90, vel: 63, armadura: 0, preco: 500, desc: 'Cria zonas de luz que seguram e explodem.' },
  { id: 'zed', nome: 'Zed', titulo: 'O Mestre das Sombras', arma: 'shuriken', hp: 100, vel: 70, armadura: 0, preco: 500, desc: 'Lâminas que atravessam fileiras de inimigos.' },
];

// Cada arma tem 5 níveis. `stats(n)` devolve os números do nível n (1 a 5).
const lin = (a, b, n) => a + ((b - a) * (n - 1)) / 4;
export const ARMAS = {
  lamina: { nome: 'Lâminas de Demacia', desc: 'Lâminas giram ao seu redor e cortam quem chega perto.', tipo: 'orbita',
    stats: (n) => ({ dano: 12 + (n - 1) * 3, qtd: [2, 2, 3, 3, 4][n - 1], raio: 30 + (n - 1) * 3, giro: 2.6 + (n - 1) * 0.25, golpe: 0.45 }) },
  orbe: { nome: 'Orbe da Ilusão', desc: 'Um orbe vai e volta atravessando os inimigos.', tipo: 'bumerangue',
    stats: (n) => ({ dano: 16 + (n - 1) * 4, cd: lin(1.7, 1.0, n), qtd: [1, 1, 2, 2, 3][n - 1], vel: 140, alcance: 90 + (n - 1) * 10 }) },
  tiro: { nome: 'Tiro Rápido', desc: 'Dispara no inimigo mais próximo.', tipo: 'tiro',
    stats: (n) => ({ dano: 7 + (n - 1) * 2, cd: lin(0.55, 0.28, n), qtd: [1, 1, 2, 2, 3][n - 1], vel: 210 }) },
  flecha: { nome: 'Rajada de Gelo', desc: 'Flechas em leque na direção em que você anda; deixam lentos.', tipo: 'leque',
    stats: (n) => ({ dano: 9 + (n - 1) * 2.5, cd: lin(1.5, 0.9, n), qtd: [3, 3, 5, 5, 7][n - 1], abertura: 0.55, vel: 170 }) },
  singular: { nome: 'Singularidade', desc: 'Zona de luz que prende os inimigos e explode no fim.', tipo: 'zona',
    stats: (n) => ({ dano: 5 + (n - 1) * 1.6, cd: lin(2.8, 1.8, n), qtd: [1, 1, 2, 2, 3][n - 1], raio: 26 + (n - 1) * 4, dur: 2.2 }) },
  shuriken: { nome: 'Lâmina das Sombras', desc: 'Lâmina rápida que atravessa vários inimigos.', tipo: 'perfura',
    stats: (n) => ({ dano: 13 + (n - 1) * 3.5, cd: lin(1.4, 0.8, n), qtd: [1, 1, 2, 2, 3][n - 1], vel: 190, perf: 3 + n }) },
  coracao: { nome: 'Beijo Encantado', desc: 'Um coração que encanta: quem é atingido fica parado.', tipo: 'encanto',
    stats: (n) => ({ dano: 9 + (n - 1) * 3, cd: lin(2.4, 1.3, n), qtd: [1, 1, 2, 2, 3][n - 1], vel: 120, perf: 2 + Math.floor(n / 2), encanta: 0.9 + (n - 1) * 0.25 }) },
  aura: { nome: 'Nevasca', desc: 'Frio ao seu redor: machuca e deixa os inimigos lentos.', tipo: 'aura',
    stats: (n) => ({ dano: 3 + (n - 1) * 1.4, raio: 34 + (n - 1) * 6, tick: 0.5, lento: 0.2 + (n - 1) * 0.04 }) },
  trovao: { nome: 'Trovão', desc: 'Raios caem sobre inimigos aleatórios.', tipo: 'raio',
    stats: (n) => ({ dano: 22 + (n - 1) * 6, cd: lin(1.9, 1.0, n), qtd: [1, 2, 2, 3, 4][n - 1], raio: 16 + (n - 1) * 2 }) },
};

// Itens (passivas) do Summoner's Rift. Cada nível soma `por` ao atributo.
export const ITENS = {
  espada: { nome: 'Espada Longa', desc: '+10% de dano', attr: 'dano', por: 0.10 },
  botas: { nome: 'Botas de Velocidade', desc: '+8% de velocidade', attr: 'vel', por: 0.08 },
  doran: { nome: 'Anel de Doran', desc: '+20 de vida máxima', attr: 'hp', por: 20 },
  cota: { nome: 'Cota de Malha', desc: '+1 de armadura', attr: 'armadura', por: 1 },
  cetro: { nome: 'Cetro Cristalino', desc: '+10% de área', attr: 'area', por: 0.10 },
  ampulheta: { nome: 'Ampulheta', desc: '-7% de recarga', attr: 'recarga', por: 0.07 },
  vidente: { nome: 'Pedra Vidente', desc: '+25% de alcance de coleta', attr: 'ima', por: 0.25 },
  sangue: { nome: 'Amuleto de Sangue', desc: '+0,3 de vida por segundo', attr: 'regen', por: 0.3 },
  tomo: { nome: 'Tomo Amplificador', desc: '+10% de experiência', attr: 'xp', por: 0.10 },
};
export const NIVEL_MAX_ITEM = 5;

// Melhorias permanentes (loja, compradas com Essência Azul).
export const MELHORIAS = {
  hp: { nome: 'Vitalidade', desc: '+10 de vida máxima por nível', max: 5, preco: (n) => 60 + n * 70 },
  dano: { nome: 'Poder', desc: '+5% de dano por nível', max: 5, preco: (n) => 80 + n * 90 },
  vel: { nome: 'Agilidade', desc: '+4% de velocidade por nível', max: 5, preco: (n) => 60 + n * 60 },
  xp: { nome: 'Sabedoria', desc: '+6% de experiência por nível', max: 5, preco: (n) => 70 + n * 80 },
  ima: { nome: 'Magnetismo', desc: '+12% de alcance de coleta por nível', max: 5, preco: (n) => 40 + n * 40 },
  revive: { nome: 'Ampulheta de Zhonya', desc: 'Revive uma vez por partida com metade da vida', max: 1, preco: () => 600 },
};

// Inimigos. `xp`: experiência da gema. `ia`: comportamento. Tamanhos em pixels do mundo.
export const INIMIGOS = {
  minion: { nome: 'Tropa', hp: 14, vel: 25, dano: 5, raio: 6, xp: 1, ia: 'perseguir' },
  mago: { nome: 'Tropa Mago', hp: 10, vel: 22, dano: 4, raio: 6, xp: 1, ia: 'atirar', alcance: 80, cd: 3.2 },
  vazio: { nome: 'Cria do Vazio', hp: 8, vel: 40, dano: 4, raio: 5, xp: 1, ia: 'perseguir' },
  lobo: { nome: 'Lobo Cinzento', hp: 24, vel: 44, dano: 6, raio: 6, xp: 2, ia: 'perseguir' },
  raptor: { nome: 'Raptor', hp: 12, vel: 54, dano: 4, raio: 5, xp: 2, ia: 'investir', cd: 3.5 },
  canhao: { nome: 'Tropa de Cerco', hp: 70, vel: 19, dano: 10, raio: 8, xp: 5, ia: 'perseguir' },
  krug: { nome: 'Krug', hp: 130, vel: 17, dano: 12, raio: 9, xp: 10, ia: 'perseguir', elite: true },
  golem: { nome: 'Golem de Pedra', hp: 260, vel: 16, dano: 15, raio: 10, xp: 18, ia: 'perseguir', elite: true },
};

// Chefes (só um de cada). Aparecem no tempo `t` (segundos).
export const CHEFES = {
  arauto: { nome: 'Arauto do Vale', t: 5 * 60, hp: 1500, vel: 24, dano: 14, raio: 14, xp: 40, ia: 'investir', cd: 4.5, ouro: 25 },
  dragao: { nome: 'Dragão Elemental', t: 10 * 60, hp: 4200, vel: 22, dano: 18, raio: 16, xp: 80, ia: 'cuspir', cd: 3.0, ouro: 50 },
  barao: { nome: 'Barão Nashor', t: TEMPO_BARAO, hp: 11000, vel: 20, dano: 24, raio: 22, xp: 200, ia: 'barao', cd: 3.4, ouro: 120 },
};

// Quando cada tipo começa a aparecer e o peso dele na mistura (por minuto de jogo: aumenta a variedade).
export const MISTURA = [
  { tipo: 'minion', de: 0, peso: 10 },
  { tipo: 'mago', de: 50, peso: 3 },
  { tipo: 'vazio', de: 100, peso: 5 },
  { tipo: 'lobo', de: 170, peso: 4 },
  { tipo: 'canhao', de: 230, peso: 2 },
  { tipo: 'raptor', de: 300, peso: 4 },
  { tipo: 'krug', de: 400, peso: 0.9 },
  { tipo: 'golem', de: 640, peso: 0.7 },
];

export const xpProximo = (nivel) => Math.round(4 + nivel * 6 + nivel * nivel * 0.9);
// Vida e dano dos inimigos crescem com o tempo.
export const escalaVida = (t) => 1 + t / 150 + (t / 600) ** 2;
export const escalaDano = (t) => 1 + t / 700;
// Aparições por segundo.
export const taxaSpawn = (t) => 0.9 + t / 60 * 0.6;
