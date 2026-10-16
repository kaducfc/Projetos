// Navegação: A* sobre a grade do terreno, com suavização por linha de visada e preferência por células afastadas de paredes.
// Cada categoria de unidade (campeão, minion, monstro, épico) só enxerga as regiões que pode pisar.
import { Terreno } from './terreno.js';

class Fila { // heap binário de (custo, célula)
  constructor() { this.c = []; this.v = []; }
  get tamanho() { return this.c.length; }
  empurrar(custo, valor) {
    const c = this.c, v = this.v; let i = c.length; c.push(custo); v.push(valor);
    while (i > 0) { const p = (i - 1) >> 1; if (c[p] <= custo) break; c[i] = c[p]; v[i] = v[p]; i = p; }
    c[i] = custo; v[i] = valor;
  }
  tirar() {
    const c = this.c, v = this.v; const topo = v[0]; const uc = c.pop(), uv = v.pop();
    if (c.length) {
      let i = 0; const n = c.length;
      for (;;) {
        let f = 2 * i + 1; if (f >= n) break;
        if (f + 1 < n && c[f + 1] < c[f]) f++;
        if (c[f] >= uc) break;
        c[i] = c[f]; v[i] = v[f]; i = f;
      }
      c[i] = uc; v[i] = uv;
    }
    return topo;
  }
}

const VIZ = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

export class Navegacao {
  constructor(terreno = new Terreno()) {
    this.t = terreno;
    const n = terreno.cols * terreno.rows;
    this.g = new Float32Array(n); this.pai = new Int32Array(n); this.visto = new Uint32Array(n); this.fechado = new Uint32Array(n);
    this.carimbo = 0;
    this.estat = { buscas: 0, expandidos: 0, falhas: 0 };
  }
  // Caminho de (ax, ay) até (bx, by) como lista de pontos do mundo (sem o ponto de partida). null se não houver caminho.
  caminho(ax, ay, bx, by, perfil = 'campeao') {
    const t = this.t;
    let a = { x: ax, y: ay }, b = { x: bx, y: by };
    if (!t.caminhavel(a.x, a.y, perfil)) { a = t.maisProximo(a.x, a.y, perfil); if (!a) return null; }
    if (!t.caminhavel(b.x, b.y, perfil)) { b = t.maisProximo(b.x, b.y, perfil); if (!b) return null; }
    if (t.linhaLivre(a.x, a.y, b.x, b.y, perfil)) return [{ x: b.x, y: b.y }];
    const sc = t.col(a.x), sl = t.lin(a.y), gc = t.col(b.x), gl = t.lin(b.y);
    const cols = t.cols; const s = sl * cols + sc, goal = gl * cols + gc;
    const stamp = ++this.carimbo; this.estat.buscas++;
    const fila = new Fila(); this.g[s] = 0; this.pai[s] = -1; this.visto[s] = stamp; fila.empurrar(0, s);
    let achou = false;
    while (fila.tamanho) {
      const cur = fila.tirar();
      if (this.fechado[cur] === stamp) continue;
      this.fechado[cur] = stamp; this.estat.expandidos++;
      if (cur === goal) { achou = true; break; }
      const cx = cur % cols, cy = (cur / cols) | 0;
      for (let k = 0; k < 8; k++) {
        const [dx, dy, w] = VIZ[k]; const nx = cx + dx, ny = cy + dy;
        if (!t.celulaCaminhavel(nx, ny, perfil)) continue;
        // sem cortar quinas: movimento diagonal exige as duas células ortogonais livres
        if (dx && dy && (!t.celulaCaminhavel(cx + dx, cy, perfil) || !t.celulaCaminhavel(cx, cy + dy, perfil))) continue;
        const ni = ny * cols + nx;
        if (this.fechado[ni] === stamp) continue;
        const custo = this.g[cur] + w * (1 + (t.perto[ni] ? 0.6 : 0));
        if (this.visto[ni] !== stamp || custo < this.g[ni]) {
          this.visto[ni] = stamp; this.g[ni] = custo; this.pai[ni] = cur;
          const h = Math.hypot(gc - nx, gl - ny);
          fila.empurrar(custo + h, ni);
        }
      }
    }
    if (!achou) { this.estat.falhas++; return null; }
    const cel = [];
    for (let c = goal; c !== -1; c = this.pai[c]) cel.push(c);
    cel.reverse();
    const pts = cel.map((c) => t.centro(c % cols, (c / cols) | 0));
    pts[0] = { x: a.x, y: a.y }; pts[pts.length - 1] = { x: b.x, y: b.y };
    // suaviza: do ponto atual, salta para o ponto mais distante ainda visível
    const out = []; let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !t.linhaLivre(pts[i].x, pts[i].y, pts[j].x, pts[j].y, perfil)) j--;
      out.push({ x: pts[j].x, y: pts[j].y }); i = j;
    }
    return out;
  }
  // Comprimento do caminho (útil para estimar tempo de deslocamento). Infinity se inalcançável.
  distancia(ax, ay, bx, by, perfil = 'campeao') {
    const c = this.caminho(ax, ay, bx, by, perfil); if (!c) return Infinity;
    let d = 0, x = ax, y = ay; for (const p of c) { d += Math.hypot(p.x - x, p.y - y); x = p.x; y = p.y; } return d;
  }
}
