// Rift Survivors: chão e cenário de cada reino (pedaços de 128x128 gerados com ruído por posição).
import { atlasDeProps } from './sprites.js';
export const CH = 128;
export const hash = (a, b) => { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const r = (x, X, Y, w, h, cor) => { x.fillStyle = cor; x.fillRect(X, Y, w, h); };

// ---- cenário (desenhado com o pé em (X, Y+h)); cada função recebe o contexto e o canto superior esquerdo
const D = {
  arbusto: (x, X, Y) => { r(x, X, Y + 6, 11, 6, '#1f4f22'); r(x, X + 1, Y + 3, 9, 7, '#2a6a2a'); r(x, X + 3, Y + 2, 5, 3, '#3a8a36'); },
  pedra: (x, X, Y, c = ['#5d626f', '#8a8f99', '#b0b5bf']) => { r(x, X, Y + 3, 9, 6, c[0]); r(x, X + 1, Y + 2, 7, 4, c[1]); r(x, X + 2, Y + 2, 3, 1, c[2]); },
  flor: (x, X, Y, k, cores = ['#ff77b8', '#ffe36a', '#ffffff', '#58e8ff']) => { const cor = cores[(k * 100 | 0) % cores.length]; r(x, X + 1, Y + 3, 1, 3, '#2a6a2a'); r(x, X, Y + 1, 3, 3, cor); r(x, X + 1, Y + 2, 1, 1, '#ffe36a'); },
  arvore: (x, X, Y, cp = ['#1f4f22', '#2a6a2a', '#3a8a36']) => { r(x, X + 4, Y + 9, 4, 6, '#5a3a1e'); r(x, X, Y + 2, 12, 9, cp[0]); r(x, X + 1, Y, 10, 8, cp[1]); r(x, X + 3, Y + 1, 4, 3, cp[2]); },
  sakura: (x, X, Y) => { r(x, X + 5, Y + 10, 4, 7, '#5a3a2a'); r(x, X, Y + 3, 14, 9, '#d9739f'); r(x, X + 1, Y, 12, 8, '#f29ac0'); r(x, X + 3, Y + 1, 5, 3, '#ffd0e4'); r(x, X + 9, Y + 5, 2, 2, '#ffffff'); r(x, X + 2, Y + 7, 2, 2, '#ffffff'); },
  lanterna: (x, X, Y) => { r(x, X + 2, Y + 8, 6, 3, '#8a8f99'); r(x, X + 3, Y + 3, 4, 6, '#6b7080'); r(x, X + 4, Y + 4, 2, 3, '#ffe9a0'); r(x, X + 1, Y + 1, 8, 3, '#8a8f99'); },
  bambu: (x, X, Y) => { for (let i = 0; i < 3; i++) { r(x, X + i * 4, Y + 2 - i, 2, 14, '#5fae4a'); r(x, X + i * 4, Y + 7, 2, 1, '#2e6a2a'); r(x, X + i * 4 + 2, Y + 4, 3, 1, '#8ed46a'); } },
  torii: (x, X, Y) => { r(x, X, Y, 22, 3, '#2a1a1a'); r(x, X + 1, Y + 3, 20, 2, '#c0283a'); r(x, X + 3, Y + 5, 3, 13, '#c0283a'); r(x, X + 16, Y + 5, 3, 13, '#c0283a'); r(x, X + 2, Y + 8, 18, 2, '#c0283a'); },
  estandarte: (x, X, Y, c1 = '#f2f6ff', c2 = '#2f62c8') => { r(x, X + 2, Y, 2, 20, '#8a8f99'); r(x, X + 4, Y + 1, 9, 10, c1); r(x, X + 4, Y + 1, 9, 2, c2); r(x, X + 7, Y + 4, 3, 5, c2); r(x, X + 4, Y + 11, 3, 2, c1); },
  pilar: (x, X, Y, c = ['#d8dde8', '#aeb6c8', '#8a93a8']) => { r(x, X, Y + 14, 10, 3, c[1]); r(x, X + 1, Y + 2, 8, 13, c[0]); r(x, X + 6, Y + 2, 3, 13, c[1]); r(x, X, Y, 10, 3, c[0]); r(x, X + 2, Y + 4, 1, 8, c[2]); },
  feno: (x, X, Y) => { r(x, X, Y + 4, 13, 8, '#c9a64a'); r(x, X + 1, Y + 2, 11, 4, '#e4c566'); r(x, X + 2, Y + 7, 9, 1, '#a78630'); },
  espinho: (x, X, Y) => { r(x, X + 1, Y + 8, 9, 5, '#2a1e2a'); r(x, X + 4, Y, 3, 9, '#3a2a38'); r(x, X + 1, Y + 4, 2, 6, '#3a2a38'); r(x, X + 8, Y + 3, 2, 7, '#3a2a38'); r(x, X + 5, Y + 1, 1, 6, '#6b3a4a'); },
  toco: (x, X, Y) => { r(x, X + 1, Y + 4, 8, 7, '#2a1e1e'); r(x, X + 2, Y + 3, 6, 3, '#4a3028'); r(x, X + 4, Y + 4, 2, 1, '#c0283a'); r(x, X + 6, Y, 2, 5, '#2a1e1e'); },
  lava: (x, X, Y) => { for (let i = 0; i < 6; i++) { r(x, X + i * 3, Y + (i % 2) * 2, 3, 2, '#ff6a2a'); r(x, X + i * 3, Y + (i % 2) * 2, 3, 1, '#ffd24a'); } },
  caveira: (x, X, Y) => { r(x, X + 4, Y, 2, 14, '#3a2a38'); r(x, X + 1, Y - 3, 8, 6, '#e4dcc8'); r(x, X + 2, Y - 1, 2, 2, '#14101e'); r(x, X + 6, Y - 1, 2, 2, '#14101e'); r(x, X + 3, Y + 3, 4, 1, '#14101e'); },
  bandeiraN: (x, X, Y) => D.estandarte(x, X, Y, '#c0283a', '#14101e'),
  duna: (x, X, Y) => { r(x, X, Y + 6, 22, 3, '#e8c97a'); r(x, X + 3, Y + 3, 16, 3, '#f4dc98'); r(x, X + 7, Y, 8, 3, '#fff0b8'); r(x, X + 2, Y + 9, 18, 2, '#c9a85a'); },
  ruina: (x, X, Y) => { r(x, X, Y + 12, 10, 3, '#a88a55'); r(x, X + 1, Y + 4, 8, 9, '#d9c08a'); r(x, X + 6, Y + 4, 3, 9, '#b89c64'); r(x, X + 1, Y + 2, 5, 3, '#d9c08a'); r(x, X + 3, Y + 6, 2, 3, '#7a6238'); },
  cacto: (x, X, Y) => { r(x, X + 4, Y, 4, 14, '#3f8a46'); r(x, X, Y + 5, 3, 5, '#3f8a46'); r(x, X + 1, Y + 9, 4, 2, '#3f8a46'); r(x, X + 9, Y + 3, 3, 5, '#3f8a46'); r(x, X + 8, Y + 7, 3, 2, '#3f8a46'); r(x, X + 5, Y, 1, 14, '#5fb86a'); },
  sol: (x, X, Y) => { r(x, X + 3, Y, 8, 11, '#c9a85a'); r(x, X, Y + 3, 14, 5, '#c9a85a'); r(x, X + 4, Y + 3, 6, 5, '#f5c82e'); r(x, X + 6, Y + 4, 2, 3, '#ffe9a0'); },
  osso: (x, X, Y) => { r(x, X, Y + 3, 10, 2, '#efe6cc'); r(x, X, Y + 2, 2, 4, '#efe6cc'); r(x, X + 8, Y + 2, 2, 4, '#efe6cc'); r(x, X + 3, Y + 7, 6, 1, '#d9cfae'); },
  pinheiro: (x, X, Y) => { r(x, X + 5, Y + 12, 3, 5, '#4a3020'); r(x, X + 3, Y + 8, 7, 5, '#1f5a3a'); r(x, X + 2, Y + 4, 9, 5, '#2a7a4a'); r(x, X + 4, Y, 5, 5, '#2a7a4a'); r(x, X + 3, Y + 6, 7, 2, '#f2f8ff'); r(x, X + 4, Y + 2, 5, 2, '#f2f8ff'); r(x, X + 2, Y + 10, 3, 2, '#f2f8ff'); },
  cristal: (x, X, Y) => { r(x, X + 4, Y, 3, 12, '#9be8ff'); r(x, X + 1, Y + 4, 3, 8, '#7ac8f0'); r(x, X + 7, Y + 5, 3, 7, '#7ac8f0'); r(x, X + 5, Y + 1, 1, 6, '#ffffff'); },
  montinho: (x, X, Y) => { r(x, X, Y + 5, 14, 4, '#e8f2ff'); r(x, X + 2, Y + 2, 10, 4, '#ffffff'); r(x, X + 1, Y + 8, 12, 1, '#b8d0ea'); },
  runa: (x, X, Y) => { r(x, X + 1, Y + 2, 8, 11, '#6b7a96'); r(x, X + 2, Y + 1, 6, 2, '#8a9ab6'); r(x, X + 4, Y + 4, 2, 5, '#58e8ff'); r(x, X + 3, Y + 6, 4, 1, '#58e8ff'); },
};

export const TEMAS = {
  ixtal: { tile: ['#2f6b2e', '#317030'], tufo: ['#285c28', '#4a9a3a'], trilha: ['#8a7a52', '#9c8c62', '#76683f'], poco: ['#7a6a45', '#2e7fc0', '#4aa3e0'],
    deco: [[0.34, (x, X, Y) => D.arbusto(x, X, Y)], [0.21, (x, X, Y) => D.pedra(x, X, Y)], [0.25, (x, X, Y, k) => D.flor(x, X, Y, k)], [0.2, (x, X, Y) => D.arvore(x, X, Y)]] },
  ionia: { tile: ['#3d8a6a', '#43946f'], tufo: ['#2f7058', '#6fcf9a'], trilha: ['#a8b8a0', '#c0d0b8', '#8a9a84'], poco: ['#8a9a84', '#3aa8c0', '#8ae8f0'],
    deco: [[0.3, (x, X, Y) => D.sakura(x, X, Y)], [0.16, (x, X, Y) => D.lanterna(x, X, Y)], [0.2, (x, X, Y) => D.bambu(x, X, Y)], [0.24, (x, X, Y, k) => D.flor(x, X, Y, k, ['#ffb3d1', '#ffffff', '#c9a6ff'])], [0.1, (x, X, Y) => D.torii(x, X, Y)]] },
  demacia: { tile: ['#4a9a3a', '#4fa43e'], tufo: ['#3a8030', '#7fd45a'], trilha: ['#aab0bc', '#c8cdd8', '#8a90a0'], poco: ['#8a90a0', '#3a7fd0', '#7ab4f0'],
    deco: [[0.2, (x, X, Y) => D.estandarte(x, X, Y)], [0.24, (x, X, Y) => D.pilar(x, X, Y)], [0.16, (x, X, Y) => D.feno(x, X, Y)], [0.24, (x, X, Y) => D.arvore(x, X, Y, ['#2a6a2a', '#3a8a36', '#5ab04a'])], [0.16, (x, X, Y, k) => D.flor(x, X, Y, k, ['#ffffff', '#ffe36a', '#9ec6ff'])]] },
  noxus: { tile: ['#4a3430', '#52382f'], tufo: ['#3a2622', '#7a3a2a'], trilha: ['#2a2024', '#3a2c30', '#1a1418'], poco: ['#2a2024', '#c03a1a', '#ff8a3a'],
    deco: [[0.24, (x, X, Y) => D.espinho(x, X, Y)], [0.2, (x, X, Y) => D.toco(x, X, Y)], [0.2, (x, X, Y) => D.lava(x, X, Y)], [0.16, (x, X, Y) => D.caveira(x, X, Y)], [0.12, (x, X, Y) => D.bandeiraN(x, X, Y)], [0.08, (x, X, Y) => D.pedra(x, X, Y, ['#2a2024', '#4a3a40', '#6a5a60'])]] },
  shurima: { tile: ['#d8b86a', '#dcbe72'], tufo: ['#c4a252', '#efd994'], trilha: ['#b89c64', '#cdb27a', '#9a8250'], poco: ['#9a8250', '#2e9ac0', '#8ae0f0'],
    deco: [[0.24, (x, X, Y) => D.duna(x, X, Y)], [0.2, (x, X, Y) => D.ruina(x, X, Y)], [0.2, (x, X, Y) => D.cacto(x, X, Y)], [0.12, (x, X, Y) => D.sol(x, X, Y)], [0.12, (x, X, Y) => D.osso(x, X, Y)], [0.12, (x, X, Y) => D.pedra(x, X, Y, ['#a88a55', '#d9c08a', '#efe0b0'])]] },
  freljord: { tile: ['#cfe0f2', '#d6e6f6'], tufo: ['#b4cce4', '#ffffff'], trilha: ['#9ab4d0', '#b8cee6', '#7e98b8'], poco: ['#7e98b8', '#7ac8f0', '#e8fbff'],
    deco: [[0.28, (x, X, Y) => D.pinheiro(x, X, Y)], [0.2, (x, X, Y) => D.cristal(x, X, Y)], [0.24, (x, X, Y) => D.montinho(x, X, Y)], [0.14, (x, X, Y) => D.runa(x, X, Y)], [0.14, (x, X, Y) => D.pedra(x, X, Y, ['#6b7a96', '#9aaac6', '#d0def0'])]] },
};

export function pedaco(tema, cx, cy) {
  const T = TEMAS[tema] || TEMAS.ixtal;
  const c = document.createElement('canvas'); c.width = CH; c.height = CH; const x = c.getContext('2d');
  for (let ty = 0; ty < CH / 8; ty++) for (let tx = 0; tx < CH / 8; tx++) {
    const q = hash(cx * 16 + tx, cy * 16 + ty);
    r(x, tx * 8, ty * 8, 8, 8, (tx + ty) % 2 ? T.tile[0] : T.tile[1]);
    if (q < 0.16) { r(x, tx * 8 + ((q * 97) % 6 | 0), ty * 8 + ((q * 53) % 6 | 0), 2, 1, T.tufo[0]); r(x, tx * 8 + 1 + ((q * 31) % 5 | 0), ty * 8 + 2 + ((q * 17) % 5 | 0), 1, 2, T.tufo[0]); }
    else if (q > 0.94) { r(x, tx * 8 + 2, ty * 8 + 3, 1, 2, T.tufo[1]); r(x, tx * 8 + 5, ty * 8 + 1, 1, 2, T.tufo[1]); }
  }
  if (hash(cx, cy) < 0.18) { // trilha
    const y0 = 40 + ((hash(cx + 9, cy) * 40) | 0);
    r(x, 0, y0, CH, 14, T.trilha[0]); r(x, 0, y0 + 2, CH, 3, T.trilha[1]); r(x, 0, y0 + 11, CH, 3, T.trilha[2]);
    for (let i = 0; i < 10; i++) r(x, (hash(cx + i, cy + 7) * CH) | 0, y0 + 3 + ((hash(cx + 3, cy + i) * 8) | 0), 2, 1, T.trilha[2]);
  } else if (hash(cx + 5, cy + 3) < 0.07) { // lago
    const px = 20 + ((hash(cx, cy + 1) * 60) | 0); const py = 20 + ((hash(cx + 1, cy) * 60) | 0);
    r(x, px - 1, py - 1, 38, 24, T.poco[0]); r(x, px + 2, py + 2, 32, 16, T.poco[1]); r(x, px + 6, py + 5, 10, 1, T.poco[2]); r(x, px + 18, py + 11, 12, 1, T.poco[2]);
  }
  if (atlasDeProps(tema)) return c; // os objetos do cenário vêm do atlas (desenhados à parte, ordenados por profundidade)
  const n = 3 + ((hash(cx, cy * 3) * 4) | 0); const total = T.deco.reduce((s, d) => s + d[0], 0);
  for (let i = 0; i < n; i++) {
    const dx = (hash(cx * 7 + i, cy) * (CH - 24)) | 0; const dy = (hash(cx, cy * 7 + i) * (CH - 24)) | 0; const k = hash(cx + i * 3, cy + i * 5);
    let m = k * total; let f = T.deco[0][1]; for (const [p, fn] of T.deco) { m -= p; if (m <= 0) { f = fn; break; } }
    f(x, dx, dy, k);
  }
  return c;
}

// Objetos de cenário de um pedaço (posições fixas por hash): [{ i: índice no atlas, x, y }], y = base do objeto.
const PESOS_PEQ = {
  ixtal: [14, 6, 8, 4, 3, 4, 4, 2, 5, 5, 4, 1.5, 2, 1, 1.5, 1, 0.6, 1, 0.8, 1.2, 1, 0.5, 1.2, 1],
  ionia: [14, 6, 8, 4, 3, 4, 4, 2, 5, 5, 3, 1.5, 2, 1.5, 0.8, 4, 0.5, 1, 0.6, 2, 0.8, 0.8, 1, 1.5],
};
const cachePropsPedaco = new Map();
export function propsDoPedaco(tema, cx, cy) {
  const A = atlasDeProps(tema); if (!A) return [];
  const k = `${tema}|${cx},${cy}`; let l = cachePropsPedaco.get(k); if (l) return l;
  const pesos = PESOS_PEQ[tema] || PESOS_PEQ.ixtal; const total = pesos.reduce((s, p) => s + p, 0);
  const n = 4 + ((hash(cx * 3, cy * 5) * 4) | 0); l = [];
  for (let j = 0; j < n; j++) {
    let m = hash(cx * 11 + j, cy * 13 + 7) * total; let i = 0; for (; i < pesos.length - 1; i++) { m -= pesos[i]; if (m <= 0) break; }
    l.push({ i, x: cx * CH + 8 + hash(cx * 17 + j, cy) * (CH - 16), y: cy * CH + 14 + hash(cx, cy * 19 + j) * (CH - 14) });
  }
  cachePropsPedaco.set(k, l); if (cachePropsPedaco.size > 200) cachePropsPedaco.delete(cachePropsPedaco.keys().next().value);
  return l;
}

// Objetos grandes (árvores, ruínas): mais raros, cada pedaço tem de 0 a 2. Pesos por índice no atlas.
const PESOS_GRANDES = [5, 3, 1, 2, 1, 1];
const cacheGrandes = new Map();
export function grandesDoPedaco(tema, cx, cy) {
  const A = atlasDeProps(tema + '_g'); if (!A) return [];
  const k = `${tema}|${cx},${cy}`; let l = cacheGrandes.get(k); if (l) return l;
  const total = PESOS_GRANDES.reduce((s, p) => s + p, 0); const n = hash(cx * 29, cy * 31) < 0.3 ? 0 : hash(cx * 37, cy * 41) < 0.8 ? 1 : 2; l = [];
  for (let j = 0; j < n; j++) {
    let m = hash(cx * 43 + j, cy * 47 + 3) * total; let i = 0; for (; i < PESOS_GRANDES.length - 1; i++) { m -= PESOS_GRANDES[i]; if (m <= 0) break; }
    l.push({ i, x: cx * CH + 20 + hash(cx * 53 + j, cy) * (CH - 40), y: cy * CH + 30 + hash(cx, cy * 59 + j) * (CH - 30) });
  }
  cacheGrandes.set(k, l); if (cacheGrandes.size > 200) cacheGrandes.delete(cacheGrandes.keys().next().value);
  return l;
}
