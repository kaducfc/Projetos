// Rift Survivors: chão e cenário de cada reino (pedaços de 128x128 gerados com ruído por posição).
import { atlasDeProps, chaoDoReino } from './sprites.js';
import { CH, hash, objetosPequenos, objetosGrandes } from './mapa.js';
export { CH, hash };
const r = (x, X, Y, w, h, cor) => { x.fillStyle = cor; x.fillRect(X, Y, w, h); };
// Clareia (f > 0) ou escurece (f < 0) uma cor #rrggbb.
function misturar(hex, f) { const n = parseInt(hex.slice(1), 16); const alvo = f < 0 ? 0 : 255; const a = Math.abs(f); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (alvo - v) * a)); return `rgb(${c[0]},${c[1]},${c[2]})`; }
// Ruído de valor suave (0 a 1) em coordenadas do mundo; esc = tamanho das manchas em px.
function ruido(gx, gy, esc) { const X = gx / esc; const Y = gy / esc; const x0 = Math.floor(X); const y0 = Math.floor(Y); const fx = X - x0; const fy = Y - y0; const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy); const a = hash(x0, y0); const b = hash(x0 + 1, y0); const c = hash(x0, y0 + 1); const d = hash(x0 + 1, y0 + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }

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
    deco: [[0.24, (x, X, Y) => D.espinho(x, X, Y)], [0.2, (x, X, Y) => D.toco(x, X, Y)], [0.16, (x, X, Y) => D.caveira(x, X, Y)], [0.12, (x, X, Y) => D.bandeiraN(x, X, Y)], [0.08, (x, X, Y) => D.pedra(x, X, Y, ['#2a2024', '#4a3a40', '#6a5a60'])]] },
  shurima: { tile: ['#d8b86a', '#dcbe72'], tufo: ['#c4a252', '#efd994'], trilha: ['#b89c64', '#cdb27a', '#9a8250'], poco: ['#9a8250', '#2e9ac0', '#8ae0f0'],
    deco: [[0.24, (x, X, Y) => D.duna(x, X, Y)], [0.2, (x, X, Y) => D.ruina(x, X, Y)], [0.2, (x, X, Y) => D.cacto(x, X, Y)], [0.12, (x, X, Y) => D.sol(x, X, Y)], [0.12, (x, X, Y) => D.osso(x, X, Y)], [0.12, (x, X, Y) => D.pedra(x, X, Y, ['#a88a55', '#d9c08a', '#efe0b0'])]] },
  freljord: { tile: ['#cfe0f2', '#d6e6f6'], tufo: ['#b4cce4', '#ffffff'], trilha: ['#9ab4d0', '#b8cee6', '#7e98b8'], poco: ['#7e98b8', '#7ac8f0', '#e8fbff'],
    deco: [[0.28, (x, X, Y) => D.pinheiro(x, X, Y)], [0.2, (x, X, Y) => D.cristal(x, X, Y)], [0.24, (x, X, Y) => D.montinho(x, X, Y)], [0.14, (x, X, Y) => D.runa(x, X, Y)], [0.14, (x, X, Y) => D.pedra(x, X, Y, ['#6b7a96', '#9aaac6', '#d0def0'])]] },
};

// Chão com textura de arquivo: cada quadro vira um canvas duplicado (2x2) para recortar qualquer deslocamento sem emenda.
const cacheTex = new Map();
function quadrosChao(tema) {
  const F = chaoDoReino(tema); if (!F) return null; let q = cacheTex.get(tema); if (q) return q;
  q = { ts: F.ts, v: [] };
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas'); c.width = F.ts * 2; c.height = F.ts * 2; const x = c.getContext('2d'); const sx = (k % 3) * F.ts; const sy = Math.floor(k / 3) * F.ts;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) x.drawImage(F.img, sx, sy, F.ts, F.ts, i * F.ts, j * F.ts, F.ts, F.ts);
    q.v.push(c);
  }
  cacheTex.set(tema, q); return q;
}
function chaoComTextura(x, Q, cx, cy) {
  const { ts, v } = Q; const ox = (((cx * CH) % ts) + ts) % ts; const oy = (((cy * CH) % ts) + ts) % ts;
  x.drawImage(v[0], ox, oy, CH, CH, 0, 0, CH, CH); // base
  // manchas escuras e claras, detalhes e trechos gastos: as mesmas manchas de ruído em coordenadas do mundo (sem emenda entre pedaços)
  for (let ty = 0; ty < CH / 4; ty++) for (let tx = 0; tx < CH / 4; tx++) {
    const gx = cx * CH + tx * 4; const gy = cy * CH + ty * 4;
    const n = 0.62 * ruido(gx, gy, 64) + 0.38 * ruido(gx + 977, gy + 311, 22) + (hash(gx, gy) - 0.5) * 0.05;
    const lim = (v) => Math.max(0, Math.min(0.9, v));
    const camadas = [[1, lim((0.46 - n) / 0.16)], [2, lim((n - 0.56) / 0.16)], [3, lim((ruido(gx + 5000, gy + 1300, 44) - 0.76) / 0.07)], [4, lim((ruido(gx + 321, gy + 7000, 70) - 0.8) / 0.07)]];
    for (const [k, al] of camadas) if (al > 0.04) { x.globalAlpha = al; x.drawImage(v[k], ox + tx * 4, oy + ty * 4, 4, 4, tx * 4, ty * 4, 4, 4); }
    x.globalAlpha = 1;
  }
}

export function pedaco(tema, cx, cy) {
  const T = TEMAS[tema] || TEMAS.ixtal;
  const c = document.createElement('canvas'); c.width = CH; c.height = CH; const x = c.getContext('2d');
  const Q = quadrosChao(tema);
  if (Q) { chaoComTextura(x, Q, cx, cy); if (atlasDeProps(tema)) return c; }
  else {
    // Chão em manchas suaves (ruído contínuo entre os pedaços), em vez do xadrez de dois tons.
    const base = T.tile[0]; const claro = misturar(T.tile[1], 0.07); const escuro = misturar(T.tile[0], -0.08);
    for (let ty = 0; ty < CH / 4; ty++) for (let tx = 0; tx < CH / 4; tx++) {
      const gx = cx * CH + tx * 4; const gy = cy * CH + ty * 4;
      const n = 0.62 * ruido(gx, gy, 56) + 0.38 * ruido(gx + 977, gy + 311, 18); const q = hash(gx, gy);
      const ruidoBorda = (q - 0.5) * 0.06;
      const v = n + ruidoBorda; const cor = v < 0.4 ? escuro : v > 0.62 ? claro : base;
      r(x, tx * 4, ty * 4, 4, 4, cor);
      const dens = cor === escuro ? 0.075 : cor === claro ? 0.02 : 0.04;
      if (q < dens) { const k = (q * 977) % 1; const c2 = cor === claro ? T.tufo[0] : T.tufo[1]; const px = tx * 4 + ((k * 7) | 0) % 3; const py = ty * 4 + ((k * 13) | 0) % 2; r(x, px, py + 1, 1, 2, c2); if (k > 0.4) r(x, px + 2, py, 1, 3, c2); if (k > 0.75) r(x, px + 1, py + 2, 1, 1, c2); }
      else if (q > 0.992) r(x, tx * 4 + 1, ty * 4 + 1, 2, 1, T.tufo[1]);
    }
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

// Objetos de cenário de um pedaço (posições fixas por hash, ver mapa.js): [{ i: índice no atlas, x, y }], y = base do objeto.
export const propsDoPedaco = (tema, cx, cy) => (atlasDeProps(tema) ? objetosPequenos(tema, cx, cy) : []);
export const grandesDoPedaco = (tema, cx, cy) => (atlasDeProps(tema + '_g') ? objetosGrandes(tema, cx, cy) : []);
