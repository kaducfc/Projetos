// Sistema de coordenadas. Três espaços, todos derivados da mesma imagem:
//   normalizado (nx, ny)  : 0 a 1 sobre a imagem. É o formato dos dados de configuração.
//   mundo       (x, y)    : unidades de jogo (10 por pixel da imagem). É o espaço da simulação (isotrópico: 1 u = 1 u nos dois eixos).
//   tela        (px, py)  : pixels do canvas, dependem do tamanho em que o mapa está sendo exibido.
// A simulação só enxerga o mundo; a tela só aparece na renderização e na depuração.
import { MAPA } from '../config/mapa.js';

export const MUNDO = MAPA.mundo; // { unidadesPorPixel, largura, altura }
export const normParaMundo = (nx, ny) => ({ x: nx * MUNDO.largura, y: ny * MUNDO.altura });
export const mundoParaNorm = (x, y) => ({ nx: x / MUNDO.largura, ny: y / MUNDO.altura });
export const ponto = (n) => normParaMundo(n[0], n[1]); // [nx, ny] -> {x, y}

// `vista` = { largura, altura } em pixels de tela em que a imagem inteira está desenhada (mais um deslocamento opcional).
export const mundoParaTela = (x, y, vista) => ({ px: (vista.x0 || 0) + (x / MUNDO.largura) * vista.largura, py: (vista.y0 || 0) + (y / MUNDO.altura) * vista.altura });
export const telaParaMundo = (px, py, vista) => ({ x: ((px - (vista.x0 || 0)) / vista.largura) * MUNDO.largura, y: ((py - (vista.y0 || 0)) / vista.altura) * MUNDO.altura });
export const normParaTela = (nx, ny, vista) => mundoParaTela(nx * MUNDO.largura, ny * MUNDO.altura, vista);
export const telaParaNorm = (px, py, vista) => { const m = telaParaMundo(px, py, vista); return mundoParaNorm(m.x, m.y); };

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
export const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);

// Posição a `d` unidades do início de uma polilinha; devolve também a direção do segmento.
export function pontoNaPolilinha(pts, d) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= seg || i === pts.length - 2) {
      const t = seg ? Math.min(1, d / seg) : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, i, dx: seg ? (b.x - a.x) / seg : 0, dy: seg ? (b.y - a.y) / seg : 0 };
    }
    d -= seg;
  }
  return { ...pts[pts.length - 1], i: pts.length - 1, dx: 0, dy: 0 };
}
export const comprimento = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
// Projeta p na polilinha: devolve a distância ao longo dela (s) e a distância lateral (d).
export function projetarNaPolilinha(pts, p) {
  let melhor = { s: 0, d: Infinity, i: 0 }; let acum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const vx = b.x - a.x, vy = b.y - a.y; const l2 = vx * vx + vy * vy || 1;
    const t = limitar(((p.x - a.x) * vx + (p.y - a.y) * vy) / l2, 0, 1);
    const qx = a.x + vx * t, qy = a.y + vy * t; const d = Math.hypot(p.x - qx, p.y - qy);
    if (d < melhor.d) melhor = { s: acum + Math.sqrt(l2) * t, d, i };
    acum += Math.sqrt(l2);
  }
  return melhor;
}
