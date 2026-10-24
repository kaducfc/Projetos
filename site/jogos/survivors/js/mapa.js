// Rift Survivors: onde ficam os objetos do cenário (puro, sem navegador) e quais deles bloqueiam o caminho.
// Os mesmos pedaços de 128x128 servem ao desenho (temas.js/render.js) e à colisão (game.js).
export const CH = 128;
export const hash = (a, b) => { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// Peso de cada objeto pequeno (índice no atlas) e dos grandes. Mais peso = mais comum.
const PESOS_PEQ = {
  ixtal: [14, 6, 8, 4, 3, 4, 4, 2, 5, 5, 4, 1.5, 2, 1, 1.5, 1, 0.6, 1, 0.8, 1.2, 1, 0.5, 1.2, 1],
  ionia: [14, 6, 8, 4, 3, 4, 4, 2, 5, 5, 3, 1.5, 2, 1.5, 0.8, 4, 0.5, 1, 0.6, 2, 0.8, 0.8, 1, 1.5],
  demacia: [14, 6, 8, 4, 4, 4, 4, 2, 5, 5, 1.5, 1.5, 1.5, 1.2, 0.6, 2, 0.5, 1, 0.7, 1, 0.7, 0.6, 0.6, 0.6],
  noxus: [10, 7, 7, 4, 2, 3, 4, 1.5, 3, 5, 3, 2, 3, 1.5, 1, 3, 0.5, 1.5, 1.5, 1, 0.8, 0.5, 0.5, 0.5],
  shurima: [10, 6, 4, 3, 6, 3, 3, 1.5, 5, 2, 1.5, 2, 2, 1.5, 0.8, 2, 0.5, 1, 0.8, 1, 0.6, 1, 0.8, 0.6],
};
const PESOS_GRANDES = { ixtal: [5, 3, 1, 2, 1, 1], ionia: [5, 4, 3, 1, 1, 1], demacia: [5, 4, 1, 1, 0, 1], noxus: [4, 3, 1.5, 1.2, 1, 1.5] };
// Raio (em px do jogo) do que BLOQUEIA o caminho; 0 = dá para atravessar (mato, moitas, flores, bambu, cogumelos...).
// Pedras, troncos, caixas, estátuas, torres e os troncos das árvores são sólidos.
const SOLIDO_PEQ = {
  ixtal: [0, 0, 0, 0, 0, 9, 9, 11, 0, 0, 0, 8, 5, 0, 6, 0, 0, 0, 8, 8, 4, 4, 5, 0],
  ionia: [0, 0, 0, 0, 0, 9, 9, 11, 0, 0, 0, 8, 0, 4, 8, 0, 0, 0, 8, 0, 10, 6, 5, 0],
  demacia: [0, 0, 0, 0, 0, 9, 9, 11, 0, 0, 8, 8, 5, 0, 5, 0, 0, 0, 8, 8, 6, 6, 7, 9],
  noxus: [0, 0, 0, 0, 0, 9, 9, 11, 0, 0, 8, 8, 5, 7, 4, 0, 4, 0, 8, 8, 4, 6, 6, 9],
  shurima: [0, 0, 0, 6, 0, 9, 9, 11, 0, 0, 0, 8, 5, 7, 4, 0, 4, 8, 8, 7, 4, 5, 7, 9],
};
const SOLIDO_GRANDES = { ixtal: [6, 6, 0, 14, 12, 6], ionia: [6, 6, 0, 0, 12, 14], demacia: [6, 0, 10, 9, 0, 12], noxus: [6, 5, 12, 9, 0, 14] };
export const temObjetos = (tema) => !!PESOS_PEQ[tema];
// Os raios das tabelas valem para o desenho em tamanho original; os objetos são mostrados reduzidos (ver ESC_PROPS_* em sprites.js).
const ESC_SOLIDO_PEQ = 0.7; const ESC_SOLIDO_GRANDES = 0.85;
export const raioSolido = (tema, i, grande = false) => (((grande ? SOLIDO_GRANDES : SOLIDO_PEQ)[tema]?.[i]) || 0) * (grande ? ESC_SOLIDO_GRANDES : ESC_SOLIDO_PEQ);
export const TEMAS_COM_OBJETOS = Object.keys(PESOS_PEQ);
export const quantidade = (tema, grande) => (grande ? PESOS_GRANDES : PESOS_PEQ)[tema]?.length || 0;

const cacheP = new Map(); const cacheG = new Map();
const guardar = (c, k, v) => { c.set(k, v); if (c.size > 300) c.delete(c.keys().next().value); return v; };

// Objetos pequenos de um pedaço: [{ i, x, y }], y = base do objeto. Cerca de 70% da quantidade antiga.
export function objetosPequenos(tema, cx, cy) {
  const pesos = PESOS_PEQ[tema]; if (!pesos) return [];
  const k = `${tema}|${cx},${cy}`; const c = cacheP.get(k); if (c) return c;
  const total = pesos.reduce((s, p) => s + p, 0); const n = 3 + ((hash(cx * 3, cy * 5) * 3) | 0); const l = [];
  for (let j = 0; j < n; j++) {
    let m = hash(cx * 11 + j, cy * 13 + 7) * total; let i = 0; for (; i < pesos.length - 1; i++) { m -= pesos[i]; if (m <= 0) break; }
    l.push({ i, x: cx * CH + 8 + hash(cx * 17 + j, cy) * (CH - 16), y: cy * CH + 14 + hash(cx, cy * 19 + j) * (CH - 14) });
  }
  return guardar(cacheP, k, l);
}
// Objetos grandes (árvores, ruínas): de 0 a 2 por pedaço, mais raros.
export function objetosGrandes(tema, cx, cy) {
  const pesos = PESOS_GRANDES[tema]; if (!pesos) return [];
  const k = `${tema}|${cx},${cy}`; const c = cacheG.get(k); if (c) return c;
  const total = pesos.reduce((s, p) => s + p, 0); const h1 = hash(cx * 29, cy * 31); const n = h1 < 0.5 ? 0 : hash(cx * 37, cy * 41) < 0.76 ? 1 : 2; const l = [];
  for (let j = 0; j < n; j++) {
    let m = hash(cx * 43 + j, cy * 47 + 3) * total; let i = 0; for (; i < pesos.length - 1; i++) { m -= pesos[i]; if (m <= 0) break; }
    l.push({ i, x: cx * CH + 20 + hash(cx * 53 + j, cy) * (CH - 40), y: cy * CH + 30 + hash(cx, cy * 59 + j) * (CH - 30) });
  }
  return guardar(cacheG, k, l);
}

// Sólidos de um pedaço: [{ x, y, r }] (o círculo fica no chão, na base do objeto).
const cacheS = new Map();
function solidosDoPedaco(tema, cx, cy) {
  const k = `${tema}|${cx},${cy}`; const c = cacheS.get(k); if (c) return c;
  const l = [];
  const sp = SOLIDO_PEQ[tema]; const sg = SOLIDO_GRANDES[tema];
  if (sp) for (const o of objetosPequenos(tema, cx, cy)) if (sp[o.i] > 0) l.push({ x: o.x, y: o.y - 2, r: raioSolido(tema, o.i) });
  if (sg) for (const o of objetosGrandes(tema, cx, cy)) if (sg[o.i] > 0) l.push({ x: o.x, y: o.y - 3, r: raioSolido(tema, o.i, true) });
  return guardar(cacheS, k, l);
}
// Empurra o ponto (x, y) de raio r para fora dos sólidos próximos. Devolve [x, y] (o mesmo array se nada bloqueou).
export function empurrar(tema, x, y, r) {
  if (!SOLIDO_PEQ[tema]) return null;
  let ox = 0; let oy = 0; let bateu = false;
  const x0 = Math.floor((x - r - 16) / CH); const x1 = Math.floor((x + r + 16) / CH); const y0 = Math.floor((y - r - 16) / CH); const y1 = Math.floor((y + r + 16) / CH);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) for (const s of solidosDoPedaco(tema, cx, cy)) {
    const dx = x + ox - s.x; const dy = y + oy - s.y; const min = s.r + r; const d2 = dx * dx + dy * dy;
    if (d2 < min * min) { const d = Math.sqrt(d2) || 0.001; ox += (dx / d) * (min - d); oy += (dy / d) * (min - d); bateu = true; }
  }
  return bateu ? [ox, oy] : null;
}
