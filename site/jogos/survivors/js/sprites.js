// Rift Survivors: pixel art desenhada em código (mapas de caracteres espelhados + formas), com contorno automático.
import { REINOS } from './data.js';
const PAL = {
  u: '#f1e8cf', U: '#b89c6a', z: '#ffd9a8', 
  w: '#ffffff', S: '#e4ebf7', s: '#aab6cf', d: '#6c7896', D: '#3b4363', b: '#2f62c8', B: '#6a98ff', n: '#1b2d6b',
  f: '#f3cda6', F: '#d9a47c', e: '#1a1226', g: '#f5c82e', G: '#b8860b', h: '#7a4521', H: '#a8672f',
  r: '#e04545', R: '#8e1f2a', o: '#f48a2a', O: '#b85a10', y: '#ffe36a', p: '#b45cff', P: '#7a2fd0', q: '#33145c',
  m: '#ff77b8', M: '#c23d82', c: '#58e8ff', C: '#1f9ec2', l: '#9be15d', L: '#4a9a2a', t: '#9a9fab', T: '#5d626f', i: '#eaf7ff', k: '#14101e', a: '#3a2a1e',
};
const OUT = '#14101e';

// Cada mapa descreve a METADE esquerda (a coluna do meio é a última). '.' é transparente.
const MAPAS = {
  garen: ['......S', '...SSSs', '..SsssS', '..sdffd', '..sfeff', '..dfffF', '...dfFF', '..bSSSg', '.bBsSgg', 'fbbbssg', 'fbnnsgg', '.dbnnbb', '..bbbbb', '..dsdds', '..DDDDD'],
  ahri: ['..q...q', '.qmq.qq', '.qqqqqq', '.qqqqqq', '.qffffq', '.qfefef', '..ffffF', '..qiiii', '.qiimmi', 'qfiiiii', 'f.iimmi', '..iiiii', '..iiiii', '..ffiff', '..mMmMm'],
  jinx: ['.c..ccc', '.cCccCc', '.ccccCc', '.cCffff', '.cCfefe', 'cCcfffF', 'cC.ffmF', '..DDmDD', '.fDmmDD', 'fCDDmDm', 'fCDDDDD', '.cDDDDD', '..mDDmD', '..DDDDm', '..mMmMm'],
  ashe: ['...iiii', '..ibbbb', '.ibBBBb', '.ibffff', '.ibfefe', '.iBffff', '..bbffF', '..BBBBB', '.BbbBBi', 'fBbbbBi', 'fBBbbBb', '.BBbbbb', '..bnbbb', '..bnnbn', '..DDDDD'],
  lux: ['...yyyy', '..yyyyg', '.yyyyyg', '.yyffff', '.yyfefe', '.ygfffF', '..yyffF', '..SSSSS', '.SBSSBg', 'fSSBBSg', 'fSBgSSg', '.SSSSgS', '..SSSSS', '..BsBsB', '..sSsSs'],
  zed: ['..D.D..', '.DDDDDD', '.DDDDDD', '.DsssDs', '.DsrsDr', '..DssDs', '..DDDDD', '..DrDDD', '.DDrDDD', 'sDDDDDr', 'sDDrDDD', '.DDDDDD', '..DDDDD', '..DrDrD', '..DDDDD'],
  minion: ['..tttT.', '.tttTTT', '.tttTTT', '..ffeff', '..ffffF', '..rrrrr', '.frrRRr', 'frrRRRr', 'frrrrrr', '.TrrrrR', '..rRRRr', '..TTrTT', '..TTTTT'],
  mago: ['....rr.', '...rrrR', '..rrrRR', '.rrrrRR', '..ffeff', '..ffffF', '.RRRRRR', 'oRRRRrR', 'oRrRRRR', 'tRRRRRR', 't.RRRRR', 't.RRRRR', '..RRRRR'],
  vazio: ['.......', '.p...p.', '.pp.pp.', '..ppPPP', '.pyPPyP', '.ppPPPP', 'pPpPPqq', '.PqPPPq', '.pPPPPP', 'p.PPqPq', 'p..PPPP', '...p.PP', '.......'],
  lobo: ['.......', '..TT...', '.tTTT..', '.TtyTT.', 'TTTTTTT', 'tTTTTTT', 'tTTTTTt', '.TTTTTT', '.TT.TT.', '.T..T..', '.......', '.......', '.......'],
  raptor: ['.......', '...ooo.', '..ooyoo', '..ooyyy', '..oooOO', '.OoooOO', 'OoooOOO', '.OoOOOO', '..OOoOO', '..yy.yy', '..y..y.', '.......', '.......'],
  krug: ['..tttTT', '.ttTTTT', '.tTcTTc', '.tTTTTT', 'ttTTtTT', 'ttTTTcT', 'tTTtTTT', 'tTTTTTT', 'TtTTTtT', '.TTTTTT', '.TTTTTT', '.TTT.TT', '.TT..TT'],
  golem: ['...ttTT', '..ttTTT', '.ttToTT', '.tTTTTT', 'TttTTTT', 'TtToTTo', 'TtTTTTO', 'TTTTTOo', 'TtTTTTT', '.TTTTTT', '.TTTTTT', '.TTT.TT', '.TTT..T'],
  monge: ['....SSS', '..SSSSS', '.SSSSSS', '..ffeff', '..ffffF', '..CCCCC', '.fCcccC', 'fCCcmmC', 'fCCCCCC', '.SCCCCC', '..SSSSS', '..SS.SS', '..CC.CC'],
  soldado_d: ['...bbbb', '..ssSSS', '.sSSSSS', '.sdffef', '.sdfffF', '..bbbbb', '.SbSSbS', 'SbBSSBb', 'sbBbbBb', '.dbbbbb', '..bbbbb', '..dd.dd', '..DD.DD'],
  soldado_n: ['..D.D.D', '.DDDDDD', '.DrDDDD', '.DDffef', '..DfffF', '..RRRRR', '.DRrrRR', 'DRRrrRR', 'DRRRRRR', '.DRRRRR', '..DDDDD', '..DD.DD', '..DD.DD'],
  mumia: ['..yyyyy', '.yuuuuu', '.uuUuuu', '.uueuue', '..uuuuu', '..yyyyy', '.uUuuUu', 'uuuyuuU', 'uUuuuuu', '.uuUuuu', '..uuuuu', '..uu.uu', '..UU.UU'],
  guerreiro: ['..iiiii', '.iiwwwi', '.iwwwww', '.iwffef', '..wfffF', '..bbbbb', '.wBBBBw', 'wwBbbBw', 'wBBBBBB', '.wBBBBB', '..hhhhh', '..hh.hh', '..TT.TT'],
  canhao: ['.......', '.......', '..TTTTT', '.TttttT', 'TttTTTt', 'ttTDDDT', 'rRTTDDD', 'rRTTTDD', 'TTTTTTT', 'TaaTaTa', 'TaaaTaa', '.aaa.aa', '.......'],
};

const cache = new Map();
// Imagens de arquivo (arte da Ahri e efeitos). Carregadas uma vez; se faltarem, os desenhos em código continuam valendo.
const BASE_IMG = new URL('../img/', import.meta.url).href;
// Animações em arquivo (tiras horizontais de n quadros iguais). `semContorno`: a arte já tem contorno próprio.
const ANIM = {
  ahri: { parada: { src: 'ahri/ahri-parada.png', n: 5 }, andando: { src: 'ahri/ahri-andando.png', n: 5 } },
  garen: { semContorno: true, parada: { src: 'garen/garen-parada.png', n: 6 }, andando: { src: 'garen/garen-andando.png', n: 6 }, ataque: { src: 'garen/garen-ataque.png', n: 6 }, dano: { src: 'garen/garen-dano.png', n: 2 }, morte: { src: 'garen/garen-morte.png', n: 4 }, especial: { src: 'garen/garen-especial.png', n: 6 }, vitoria: { src: 'garen/garen-vitoria.png', n: 4 }, nivel: { src: 'garen/garen-nivel.png', n: 2 } },
};
const ESTATICAS = { orbe: 'ahri/orbe.png', coracao: 'ahri/coracao.png' };
const ICONES_IMG = { orbe: 'ahri/i-orbe.png', coracao: 'ahri/i-coracao.png' };
const quadros = {}; // nome -> anim -> [canvas]
const imgs = {};
export const arteUrl = (arq) => BASE_IMG + arq;
function carregarImg(arq) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = BASE_IMG + arq; }); }
export async function carregarImagens() {
  for (const [nome, anims] of Object.entries(ANIM)) {
    quadros[nome] = {};
    for (const [anim, d] of Object.entries(anims)) {
      if (anim === 'semContorno') continue;
      const img = await carregarImg(d.src); if (!img) { delete quadros[nome]; break; }
      const fw = Math.floor(img.width / d.n); quadros[nome][anim] = [];
      for (let i = 0; i < d.n; i++) { const c = canvasDe(fw, img.height); c.getContext('2d').drawImage(img, i * fw, 0, fw, img.height, 0, 0, fw, img.height); quadros[nome][anim].push(anims.semContorno ? c : contornar(c)); }
    }
    cache.delete(nome); cache.delete(nome + ':w');
  }
  for (const [nome, arq] of Object.entries(ESTATICAS)) { const img = await carregarImg(arq); if (img) { const c = canvasDe(img.width, img.height); c.getContext('2d').drawImage(img, 0, 0); imgs[nome] = contornar(c); cache.delete(nome); } }
  for (const [nome, arq] of Object.entries(ICONES_IMG)) { const img = await carregarImg(arq); if (img) { const c = canvasDe(12, 12); const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(img, 0, 0, 12, 12); imgs['i:' + nome] = c; cache.delete('i:' + nome); } }
}
// Quadro i de uma animação (limitado ao último); null se o campeão não tem essa animação.
export function quadroAnim(nome, anim, i, flash = false) {
  const fr = quadros[nome]?.[anim]; if (!fr) return null;
  const k = Math.max(0, Math.min(fr.length - 1, Math.floor(i)));
  if (!flash) return fr[k];
  const ck = `${nome}:${anim}:${k}:w`; let c = cache.get(ck);
  if (!c) { c = canvasDe(fr[k].width, fr[k].height); const x = c.getContext('2d'); x.drawImage(fr[k], 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); cache.set(ck, c); }
  return c;
}
export const nQuadros = (nome, anim) => quadros[nome]?.[anim]?.length || 0;
// Quadro de um laço (parada/andando) pelo tempo t.
export function animacao(nome, anim, t, flash = false) {
  const n = nQuadros(nome, anim); if (!n) return null;
  return quadroAnim(nome, anim, Math.floor(t * (anim === 'andando' ? 9 : 5)) % n, flash);
}
function canvasDe(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Desenha o contorno escuro de 1 px ao redor dos pixels opacos.
function contornar(src) {
  const w = src.width + 2; const h = src.height + 2;
  const out = canvasDe(w, h); const o = out.getContext('2d'); o.imageSmoothingEnabled = false;
  const sd = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
  const od = o.createImageData(w, h); const d = od.data;
  const opaco = (x, y) => x >= 0 && y >= 0 && x < src.width && y < src.height && sd[(y * src.width + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x - 1; const sy = y - 1; const k = (y * w + x) * 4;
    if (opaco(sx, sy)) { const j = (sy * src.width + sx) * 4; d[k] = sd[j]; d[k + 1] = sd[j + 1]; d[k + 2] = sd[j + 2]; d[k + 3] = 255; }
    else if (opaco(sx - 1, sy) || opaco(sx + 1, sy) || opaco(sx, sy - 1) || opaco(sx, sy + 1)) { d[k] = 20; d[k + 1] = 16; d[k + 2] = 30; d[k + 3] = 255; }
  }
  o.putImageData(od, 0, 0); return out;
}
function doMapa(linhas) {
  const meio = linhas[0].length; const w = meio * 2 - 1; const h = linhas.length;
  const c = canvasDe(w, h); const x = c.getContext('2d');
  linhas.forEach((l, y) => { for (let i = 0; i < meio; i++) { const ch = l[i]; const cor = PAL[ch]; if (ch === '.' || !cor) continue; x.fillStyle = cor; x.fillRect(i, y, 1, 1); x.fillRect(w - 1 - i, y, 1, 1); } });
  return contornar(c);
}

// ---- formas procedurais (chefes e efeitos)
function pix(x, X, Y, cor) { x.fillStyle = cor; x.fillRect(X | 0, Y | 0, 1, 1); }
function disco(x, cx, cy, r, cor) { for (let y = -r; y <= r; y++) for (let i = -r; i <= r; i++) if (i * i + y * y <= r * r + r * 0.6) pix(x, cx + i, cy + y, cor); }
function elipse(x, cx, cy, rx, ry, cor) { for (let y = -ry; y <= ry; y++) for (let i = -rx; i <= rx; i++) if ((i * i) / (rx * rx) + (y * y) / (ry * ry) <= 1.05) pix(x, cx + i, cy + y, cor); }
function ret(x, X, Y, w, h, cor) { x.fillStyle = cor; x.fillRect(X, Y, w, h); }

function chefeArauto() {
  const c = canvasDe(36, 32); const x = c.getContext('2d');
  elipse(x, 18, 18, 13, 10, '#5b3fa0'); elipse(x, 18, 16, 11, 8, '#7a5ad0');
  for (let i = 0; i < 4; i++) { ret(x, 4 + i * 2, 6 - i, 2, 6, '#3a2870'); ret(x, 30 - i * 2, 6 - i, 2, 6, '#3a2870'); } // chifres
  disco(x, 18, 17, 6, '#f0f4ff'); disco(x, 18, 17, 4, '#58e8ff'); disco(x, 18, 17, 2, '#14101e'); pix(x, 17, 16, '#ffffff');
  ret(x, 2, 22, 5, 6, '#3a2870'); ret(x, 29, 22, 5, 6, '#3a2870'); ret(x, 0, 26, 4, 3, '#5b3fa0'); ret(x, 32, 26, 4, 3, '#5b3fa0'); // garras
  for (let i = 0; i < 5; i++) ret(x, 9 + i * 4, 27, 2, 4, '#3a2870');
  return contornar(c);
}
function chefeDragao() {
  const c = canvasDe(44, 36); const x = c.getContext('2d');
  elipse(x, 14, 8, 12, 5, '#ff9a3c'); elipse(x, 30, 8, 12, 5, '#ff9a3c'); elipse(x, 14, 8, 8, 3, '#ffd27a'); elipse(x, 30, 8, 8, 3, '#ffd27a'); // asas
  elipse(x, 22, 22, 11, 9, '#d6451d'); elipse(x, 22, 24, 7, 6, '#ffb36b'); // corpo
  elipse(x, 22, 14, 7, 6, '#e8571f'); ret(x, 20, 9, 4, 3, '#ffd27a'); // cabeça
  pix(x, 18, 12, '#14101e'); pix(x, 26, 12, '#14101e'); pix(x, 18, 13, '#ffe36a'); pix(x, 26, 13, '#ffe36a');
  for (let i = 0; i < 3; i++) { ret(x, 15 + i * 7, 4, 2, 5, '#8e1f2a'); }
  ret(x, 12, 30, 5, 5, '#8e1f2a'); ret(x, 27, 30, 5, 5, '#8e1f2a'); ret(x, 19, 32, 6, 3, '#d6451d');
  return contornar(c);
}
function chefeBarao() {
  const c = canvasDe(60, 52); const x = c.getContext('2d');
  for (let i = 0; i < 6; i++) { ret(x, 4 + i * 9, 36 + (i % 2) * 3, 5, 12 - (i % 2) * 3, '#5a2a8f'); ret(x, 5 + i * 9, 38, 2, 8, '#b45cff'); } // tentáculos
  elipse(x, 30, 26, 22, 17, '#5a2a8f'); elipse(x, 30, 22, 19, 13, '#7a3fc0'); elipse(x, 30, 32, 14, 8, '#b45cff');
  for (let i = 0; i < 7; i++) { ret(x, 10 + i * 6, 6 - Math.abs(3 - i), 3, 8 + Math.abs(3 - i), '#d9c2ff'); } // espinhos
  disco(x, 21, 20, 5, '#ffe36a'); disco(x, 39, 20, 5, '#ffe36a'); disco(x, 21, 20, 2, '#14101e'); disco(x, 39, 20, 2, '#14101e');
  ret(x, 20, 33, 20, 5, '#14101e'); for (let i = 0; i < 6; i++) ret(x, 21 + i * 3, 33, 2, 3, '#ffffff'); // boca com dentes
  return contornar(c);
}

// ---- chefes de reino (formas procedurais)
function chefeDragaoIonia() {
  const c = canvasDe(70, 50); const x = c.getContext('2d');
  const corpo = [];
  for (let i = 0; i <= 26; i++) { const t = i / 26; corpo.push([6 + t * 44, 36 - t * 14 + Math.sin(t * 9) * 7, 7 - t * 3.2]); }
  for (const [px, py, r] of corpo) disco(x, Math.round(px), Math.round(py), Math.round(r), '#2fb8a8');
  for (const [px, py, r] of corpo) disco(x, Math.round(px), Math.round(py + r * 0.35), Math.max(1, Math.round(r * 0.55)), '#c9fff4');
  for (let i = 0; i < 26; i += 3) { const [px, py, r] = corpo[i]; ret(x, Math.round(px) - 1, Math.round(py - r) - 2, 3, 3, '#ff9ad0'); }
  elipse(x, 54, 18, 10, 7, '#2fb8a8'); elipse(x, 58, 21, 8, 4, '#c9fff4'); ret(x, 49, 7, 3, 7, '#f5c82e'); ret(x, 56, 6, 3, 8, '#f5c82e'); ret(x, 46, 9, 4, 2, '#ff9ad0');
  disco(x, 56, 16, 2, '#ffe36a'); pix(x, 57, 16, '#14101e'); ret(x, 62, 22, 6, 1, '#c9fff4'); ret(x, 62, 24, 7, 1, '#c9fff4'); ret(x, 60, 26, 4, 1, '#ffffff');
  disco(x, 31, 33, 3, '#ffe36a'); // pérola
  return contornar(c);
}
function chefeGalio() {
  const c = canvasDe(64, 58); const x = c.getContext('2d');
  elipse(x, 12, 22, 12, 10, '#6b7590'); elipse(x, 52, 22, 12, 10, '#6b7590'); elipse(x, 12, 20, 8, 6, '#9aa3b5'); elipse(x, 52, 20, 8, 6, '#9aa3b5'); // asas
  elipse(x, 32, 34, 15, 15, '#8a93a8'); elipse(x, 32, 30, 11, 9, '#b8c0d2'); ret(x, 22, 44, 8, 12, '#6b7590'); ret(x, 34, 44, 8, 12, '#6b7590'); ret(x, 20, 54, 11, 3, '#4b5268'); ret(x, 33, 54, 11, 3, '#4b5268'); // corpo e pernas
  disco(x, 32, 14, 8, '#9aa3b5'); ret(x, 26, 10, 12, 5, '#6b7590'); ret(x, 27, 13, 4, 3, '#58e8ff'); ret(x, 33, 13, 4, 3, '#58e8ff'); ret(x, 29, 18, 6, 2, '#4b5268'); // cabeça
  ret(x, 18, 8, 4, 8, '#6b7590'); ret(x, 42, 8, 4, 8, '#6b7590'); // chifres
  disco(x, 7, 40, 6, '#8a93a8'); disco(x, 57, 40, 6, '#8a93a8'); ret(x, 4, 28, 6, 10, '#6b7590'); ret(x, 54, 28, 6, 10, '#6b7590'); // punhos
  ret(x, 30, 30, 4, 8, '#58e8ff'); pix(x, 31, 28, '#ffffff'); // núcleo azul
  return contornar(c);
}
function chefeDarius() {
  const c = canvasDe(60, 58); const x = c.getContext('2d');
  ret(x, 8, 18, 14, 34, '#7a1d2c'); ret(x, 38, 18, 14, 34, '#7a1d2c'); // capa
  ret(x, 18, 22, 24, 22, '#3a2a38'); ret(x, 20, 24, 20, 8, '#c0283a'); ret(x, 28, 24, 4, 18, '#14101e'); ret(x, 14, 20, 8, 7, '#5d4a5c'); ret(x, 38, 20, 8, 7, '#5d4a5c'); // tronco e ombros
  ret(x, 20, 44, 8, 12, '#2a1e2a'); ret(x, 32, 44, 8, 12, '#2a1e2a'); ret(x, 18, 54, 11, 3, '#14101e'); ret(x, 31, 54, 11, 3, '#14101e');
  elipse(x, 30, 12, 8, 8, '#5d4a5c'); ret(x, 24, 10, 12, 4, '#14101e'); ret(x, 27, 11, 2, 2, '#ff4d5e'); ret(x, 32, 11, 2, 2, '#ff4d5e'); ret(x, 26, 16, 8, 4, '#d9a47c'); // elmo
  ret(x, 20, 2, 3, 8, '#c0283a'); ret(x, 37, 2, 3, 8, '#c0283a');
  ret(x, 50, 6, 3, 48, '#8a8f99'); elipse(x, 52, 12, 7, 9, '#c0283a'); elipse(x, 56, 12, 3, 8, '#14101e'); ret(x, 46, 10, 4, 8, '#e4ebf7'); // machado
  ret(x, 44, 28, 8, 6, '#5d4a5c');
  return contornar(c);
}
function chefeNasus() {
  const c = canvasDe(58, 62); const x = c.getContext('2d');
  ret(x, 16, 24, 26, 30, '#2a2438'); ret(x, 16, 24, 26, 3, '#f5c82e'); ret(x, 28, 24, 3, 30, '#f5c82e'); ret(x, 14, 52, 30, 4, '#f5c82e'); // manto com adornos
  ret(x, 20, 54, 7, 6, '#14101e'); ret(x, 31, 54, 7, 6, '#14101e');
  ret(x, 22, 12, 14, 14, '#3a3050'); elipse(x, 29, 10, 8, 8, '#3a3050'); ret(x, 33, 12, 12, 6, '#3a3050'); // cabeça de chacal
  ret(x, 18, 0, 5, 12, '#3a3050'); ret(x, 34, 0, 5, 12, '#3a3050'); ret(x, 19, 2, 2, 8, '#f5c82e'); ret(x, 35, 2, 2, 8, '#f5c82e'); // orelhas
  ret(x, 26, 9, 4, 3, '#ff9a3c'); ret(x, 35, 9, 4, 3, '#ff9a3c'); ret(x, 22, 6, 18, 2, '#f5c82e'); // olhos e coroa
  ret(x, 8, 4, 3, 54, '#a88a55'); disco(x, 9, 6, 6, '#ff9a3c'); disco(x, 9, 6, 3, '#ffe36a'); // cajado
  ret(x, 10, 28, 8, 6, '#f5c82e'); ret(x, 40, 28, 8, 6, '#f5c82e'); ret(x, 42, 34, 5, 6, '#3a3050');
  return contornar(c);
}
function chefeLissandra() {
  const c = canvasDe(54, 60); const x = c.getContext('2d');
  elipse(x, 27, 44, 14, 14, '#2a4a8a'); ret(x, 14, 40, 26, 18, '#2a4a8a'); ret(x, 22, 30, 10, 14, '#4a74c0'); ret(x, 24, 30, 6, 28, '#9be8ff'); // robe
  elipse(x, 27, 18, 8, 9, '#dff4ff'); ret(x, 22, 16, 3, 2, '#2a4a8a'); ret(x, 29, 16, 3, 2, '#2a4a8a'); ret(x, 25, 22, 4, 1, '#7aa9d9'); // rosto
  elipse(x, 27, 10, 11, 7, '#ffffff'); ret(x, 14, 14, 6, 26, '#ffffff'); ret(x, 34, 14, 6, 26, '#ffffff'); // cabelo
  for (let i = 0; i < 5; i++) ret(x, 16 + i * 5, 0 + Math.abs(2 - i) * 2, 3, 8 - Math.abs(2 - i), '#9be8ff'); // coroa de gelo
  ret(x, 4, 10, 3, 46, '#7aa9d9'); disco(x, 5, 8, 5, '#58e8ff'); disco(x, 5, 8, 2, '#ffffff'); // cajado
  ret(x, 42, 24, 4, 8, '#9be8ff'); ret(x, 46, 36, 3, 6, '#9be8ff'); ret(x, 40, 46, 4, 7, '#9be8ff'); // cristais
  return contornar(c);
}
// Muda o matiz do sprite (monstros dos reinos): name@reino
function recolorir(src, m) {
  const c = canvasDe(src.width, src.height); const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  const im = x.getImageData(0, 0, c.width, c.height); const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = d[i] / 255; let g = d[i + 1] / 255; let b = d[i + 2] / 255;
    const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); let l = (mx + mn) / 2;
    if (l < 0.12) continue; // contorno
    const dd = mx - mn; let h = 0; let sat = dd === 0 ? 0 : dd / (1 - Math.abs(2 * l - 1));
    if (dd) { if (mx === r) h = ((g - b) / dd) % 6; else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4; h *= 60; }
    if (sat < 0.2) { h = m.h; sat = 0.28; } else h += m.h;
    sat = Math.min(1, sat * m.s); l = Math.max(0.05, Math.min(0.95, l + m.l));
    h = ((h % 360) + 360) % 360;
    const cc = (1 - Math.abs(2 * l - 1)) * sat; const xx = cc * (1 - Math.abs(((h / 60) % 2) - 1)); const mm = l - cc / 2;
    const [r1, g1, b1] = h < 60 ? [cc, xx, 0] : h < 120 ? [xx, cc, 0] : h < 180 ? [0, cc, xx] : h < 240 ? [0, xx, cc] : h < 300 ? [xx, 0, cc] : [cc, 0, xx];
    d[i] = Math.round((r1 + mm) * 255); d[i + 1] = Math.round((g1 + mm) * 255); d[i + 2] = Math.round((b1 + mm) * 255);
  }
  x.putImageData(im, 0, 0); return c;
}

function gema(cor, cor2, r) { const c = canvasDe(r * 2 + 1, r * 2 + 3); const x = c.getContext('2d'); for (let y = 0; y < r * 2 + 1; y++) { const w = y <= r ? y : r * 2 - y; ret(x, r - w, y + 1, w * 2 + 1, 1, cor); } pix(x, r - 1, 3, cor2); pix(x, r, 2, cor2); return contornar(c); }

const FABRICA = {
  ...Object.fromEntries(Object.keys(MAPAS).map((k) => [k, () => doMapa(MAPAS[k])])),
  arauto: chefeArauto, dragao: chefeDragao, barao: chefeBarao,
  b_dragao_ionia: chefeDragaoIonia, b_galio: chefeGalio, b_darius: chefeDarius, b_nasus: chefeNasus, b_lissandra: chefeLissandra,
  gema1: () => gema('#58e8ff', '#ffffff', 2), gema2: () => gema('#9be15d', '#ffffff', 3), gema3: () => gema('#ff77b8', '#ffffff', 4),
  vida: () => { const c = canvasDe(9, 9); const x = c.getContext('2d'); ret(x, 3, 0, 3, 2, '#9a9fab'); ret(x, 1, 2, 7, 6, '#e04545'); ret(x, 2, 3, 2, 2, '#ffb3b3'); return contornar(c); },
  ima: () => { const c = canvasDe(9, 9); const x = c.getContext('2d'); ret(x, 1, 1, 3, 7, '#e04545'); ret(x, 5, 1, 3, 7, '#e04545'); ret(x, 1, 1, 3, 2, '#e4ebf7'); ret(x, 5, 1, 3, 2, '#e4ebf7'); ret(x, 3, 6, 3, 2, '#e04545'); return contornar(c); },
  ouro: () => { const c = canvasDe(7, 7); const x = c.getContext('2d'); disco(x, 3, 3, 3, '#f5c82e'); pix(x, 2, 2, '#fff3b0'); pix(x, 3, 4, '#b8860b'); return contornar(c); },
  bau: () => { const c = canvasDe(13, 11); const x = c.getContext('2d'); ret(x, 1, 3, 11, 7, '#a8672f'); ret(x, 1, 1, 11, 3, '#c98240'); ret(x, 1, 5, 11, 1, '#f5c82e'); ret(x, 5, 4, 3, 4, '#f5c82e'); pix(x, 6, 6, '#14101e'); return contornar(c); },
  orbe: () => { const c = canvasDe(11, 11); const x = c.getContext('2d'); disco(x, 5, 5, 5, '#ff77b8'); disco(x, 5, 5, 3, '#ffd0ea'); pix(x, 4, 4, '#ffffff'); return c; },
  bala: () => { const c = canvasDe(5, 3); const x = c.getContext('2d'); ret(x, 0, 1, 5, 1, '#ffe36a'); ret(x, 2, 0, 2, 3, '#ffffff'); return c; },
  flecha: () => { const c = canvasDe(9, 5); const x = c.getContext('2d'); ret(x, 0, 2, 7, 1, '#e4ebf7'); ret(x, 6, 1, 2, 3, '#58e8ff'); pix(x, 8, 2, '#ffffff'); ret(x, 0, 1, 2, 3, '#58e8ff'); return c; },
  shuriken: () => { const c = canvasDe(11, 11); const x = c.getContext('2d'); for (let i = 0; i < 11; i++) { pix(x, i, 5, '#c9c0e8'); pix(x, 5, i, '#c9c0e8'); } for (let i = 1; i < 10; i++) { pix(x, i, i, '#6c4fb0'); pix(x, 10 - i, i, '#6c4fb0'); } disco(x, 5, 5, 2, '#e04545'); return c; },
  lamina: () => { const c = canvasDe(5, 13); const x = c.getContext('2d'); ret(x, 2, 0, 1, 9, '#e4ebf7'); ret(x, 1, 1, 1, 7, '#aab6cf'); ret(x, 0, 9, 5, 1, '#f5c82e'); ret(x, 2, 10, 1, 3, '#7a4521'); return contornar(c); },
  eorbe: () => { const c = canvasDe(7, 7); const x = c.getContext('2d'); disco(x, 3, 3, 3, '#b45cff'); disco(x, 3, 3, 1, '#ffffff'); return c; },
};

export function sprite(nome) {
  let c = cache.get(nome); if (c) return c;
  if (quadros[nome]?.parada) { c = quadros[nome].parada[0]; cache.set(nome, c); return c; }
  if (imgs[nome]) { cache.set(nome, imgs[nome]); return imgs[nome]; }
  if (nome.includes('@')) { const [base, rei] = nome.split('@'); const sb = sprite(base); const R0 = REINOS[rei]; const m = base === 'arauto' ? (R0?.matizMini || R0?.matiz) : R0?.matiz; if (!sb) return null; c = m ? recolorir(sb, m) : sb; cache.set(nome, c); return c; }
  const f = FABRICA[nome]; if (!f) return null;
  c = f(); cache.set(nome, c); return c;
}
// Versão toda branca (piscada de dano).
export function spriteBranco(nome) {
  const k = `${nome}:w`; let c = cache.get(k); if (c) return c;
  const s = sprite(nome); if (!s) return null;
  c = canvasDe(s.width, s.height); const x = c.getContext('2d'); x.drawImage(s, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  cache.set(k, c); return c;
}
export const NOMES_SPRITES = Object.keys(FABRICA);

// ---- ícones 12x12 das armas e dos itens (mapas simples, sem espelho)
const ICONES = {
  lamina: ['....ss......', '...sSSs.....', '..sSSs......', '.sSSs....g..', 'sSSs...g.g..', '.sSs..ggg...', '..s...g.g...', '.......g....', '...hh.......', '..hh........', '.hh.........', '............'],
  orbe: ['....mmmm....', '..mmMMMMmm..', '.mmwwMMMMm..', '.mwwMMMMMMm.', 'mmwMMMMMMMMm', 'mMMMMMMMMMMm', 'mMMMMMMMMMMm', '.mMMMMMMMMm.', '.mmMMMMMMmm.', '..mmMMMMmm..', '....mmmm....', '............'],
  tiro: ['............', '........yy..', '.......yww..', '..ttTTTTyy..', '.tTTTTTTT...', 'ttTTDDTT....', 'tTTTDD......', '..TD........', '..TD........', '..DD........', '............', '............'],
  flecha: ['............', '.......c....', '......cwc...', '.....cwc....', '..c.cwc.c...', '..cwcwc.....', '...cwcc.....', '..c.cw.c....', '....c.......', '............', '............', '............'],
  singular: ['.....yy.....', '....yyyy....', '.y.yywwyy.y.', '..yywwwwyy..', 'yyywwwwwwyyy', '.yywwwwwwyy.', '..yywwwwyy..', '.y.yywwyy.y.', '....yyyy....', '.....yy.....', '............', '............'],
  shuriken: ['.....pp.....', '.....pp.....', '....pPPp....', '..pppPPppp..', 'ppPPPrrPPPpp', 'ppPPPrrPPPpp', '..pppPPppp..', '....pPPp....', '.....pp.....', '.....pp.....', '............', '............'],
  coracao: ['............', '..mm....mm..', '.mmmm..mmmm.', 'mmwwmmmmMMMm', 'mmwmmmmmMMMm', 'mmmmmmmmMMMm', '.mmmmmmmMMm.', '..mmmmmMMm..', '...mmmMMm...', '....mmMm....', '.....mm.....', '............'],
  aura: ['.....ii.....', '..i..ii..i..', '...i.ii.i...', '....iccci...', 'iii.cwwc.iii', 'iiiicwwciiii', 'iii.cwwc.iii', '....iccci...', '...i.ii.i...', '..i..ii..i..', '.....ii.....', '............'],
  trovao: ['.....yyy....', '....yyy.....', '...yyy......', '..yyyyyy....', '....yyy.....', '...yyy......', '..yy........', '.yy.........', 'yy..........', 'y...........', '............', '............'],
  espada: ['.........ss.', '........sSs.', '.......sSs..', '......sSs...', '.....sSs....', '..g.sSs.....', '...gSs......', '...ggh......', '..hh.g......', '.hh.........', '............', '............'],
  botas: ['............', '..hhhh......', '..hHHh......', '..hHHh......', '..hHHh......', '..hHHhhhh...', '..hHHHHHHh..', '.hHHHHHHHh..', '.hhhhhhhhh..', '............', '............', '............'],
  doran: ['............', '...gggggg...', '..gGGGGGGg..', '.gG......Gg.', '.gG..rr..Gg.', '.gG..rr..Gg.', '.gG......Gg.', '..gGGGGGGg..', '...gggggg...', '............', '............', '............'],
  cota: ['............', '.ss.ssss.ss.', 'sSssSSSSssSs', 'sSsssSSsssSs', '.sSSssssSSs.', '..sSsSSsSs..', '..sSSssSSs..', '...sSssSs...', '....sSSs....', '.....ss.....', '............', '............'],
  cetro: ['.....cc.....', '....cwwc....', '...cwwwwc...', '....cwwc....', '.....cc.....', '.....hh.....', '.....hh.....', '.....hh.....', '.....hh.....', '.....hh.....', '............', '............'],
  ampulheta: ['.gggggggggg.', '.gSSSSSSSSg.', '..gSSSSSSg..', '...gSyySg...', '....gSSg....', '.....gg.....', '....gyyg....', '...gyyyyg...', '..gyyyyyyg..', '.gggggggggg.', '............', '............'],
  vidente: ['............', '....pppp....', '..ppPPPPpp..', '.ppPPccPPpp.', '.pPPcwwcPPp.', '.pPPcwwcPPp.', '.ppPPccPPpp.', '..ppPPPPpp..', '....pppp....', '............', '............', '............'],
  sangue: ['............', '.....rr.....', '....rRRr....', '...rRwRRr...', '..rRRRRRRr..', '..rRRRRRRr..', '...rRRRRr...', '....rRRr....', '.....rr.....', '............', '............', '............'],
  tomo: ['.bbbbbbbbb..', 'bBBBBBBBBBb.', 'bBwwwwwwBBb.', 'bBBBBBBBBBb.', 'bBwwwwwBBBb.', 'bBBBBBBBBBb.', 'bBwwwwwwBBb.', 'bBBBBBBBBBb.', '.bbbbbbbbb..', '............', '............', '............'],
  cura: ['............', '....rrrr....', '....rRRr....', '..rrrRRrrr..', '..rRRRRRRr..', '..rrrRRrrr..', '....rRRr....', '....rrrr....', '............', '............', '............', '............'],
  ouro: ['............', '...gggggg...', '..gyyyyyyg..', '.gywwyyyyyg.', '.gywyyGyyyg.', '.gyyyyGyyyg.', '.gyyyyyyyyg.', '..gyyyyyyg..', '...gggggg...', '............', '............', '............'],
};
export function icone(nome) {
  const k = `i:${nome}`; let c = cache.get(k); if (c) return c;
  if (imgs[k]) { c = contornar(imgs[k]); cache.set(k, c); return c; }
  const m = ICONES[nome]; if (!m) return null;
  c = canvasDe(12, 12); const x = c.getContext('2d');
  m.forEach((l, y) => { for (let i = 0; i < 12; i++) { const cor = PAL[l[i]]; if (l[i] === '.' || !cor) continue; x.fillStyle = cor; x.fillRect(i, y, 1, 1); } });
  c = contornar(c); cache.set(k, c); return c;
}
export const urlIcone = (nome) => { if (ICONES_IMG[nome] && imgs['i:' + nome]) return BASE_IMG + ICONES_IMG[nome]; const c = icone(nome); return c ? c.toDataURL() : ''; };
export const urlSprite = (nome) => { const c = sprite(nome); return c ? c.toDataURL() : ''; };

// Quadro de animação como imagem (para as telas em HTML).
export const urlQuadro = (nome, anim, i) => { const c = quadroAnim(nome, anim, i); return c ? c.toDataURL() : ''; };
