// Terreno navegável: grade lógica gerada a partir do mapa (config/terreno.js). É a única fonte de verdade sobre o que
// pode ser atravessado: a simulação, a IA e a renderização perguntam sempre a esta classe.
import { TERRENO } from '../config/terreno.js';
import { MUNDO } from './coord.js';

export const T = { PAREDE: 0, ROTA: 1, SELVA: 2, RIO: 3, BASE: 4, ACAMP: 5, COVIL: 6 };
export const NOME_TIPO = ['parede', 'rota', 'selva', 'rio', 'base', 'acampamento', 'covil'];

// Quais tipos de célula cada categoria de unidade pode pisar.
//   campeao: qualquer região aberta. minion: só rota e base (não corta a selva). monstro: só selva, rio, acampamentos e covis.
const PERMITE = {
  campeao: [0, 1, 1, 1, 1, 1, 1],
  minion: [0, 1, 0, 0, 1, 0, 0],
  monstro: [0, 0, 1, 1, 0, 1, 1],
  epico: [0, 0, 1, 1, 0, 1, 1],
};

export class Terreno {
  constructor(dados = TERRENO) {
    this.cols = dados.colunas; this.rows = dados.linhas;
    this.cel = dados.celulaPx * MUNDO.unidadesPorPixel; // tamanho da célula em unidades do mundo
    this.grade = new Uint8Array(this.cols * this.rows);
    dados.rle.forEach((linha, y) => {
      let x = 0;
      for (const tok of linha.split(' ')) {
        const [t, n] = tok.split('x').map(Number);
        for (let i = 0; i < n; i++) this.grade[y * this.cols + x++] = t;
      }
      if (x !== this.cols) throw new Error(`terreno: linha ${y} com ${x} colunas (esperado ${this.cols})`);
    });
    // Células vizinhas de parede: o planejador de caminhos as evita quando há alternativa.
    this.perto = new Uint8Array(this.cols * this.rows);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      if (!this.grade[y * this.cols + x]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows || !this.grade[ny * this.cols + nx]) { this.perto[y * this.cols + x] = 1; }
      }
    }
  }
  col(x) { return Math.floor(x / this.cel); }
  lin(y) { return Math.floor(y / this.cel); }
  idx(cx, cy) { return cy * this.cols + cx; }
  dentro(cx, cy) { return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows; }
  tipoCel(cx, cy) { return this.dentro(cx, cy) ? this.grade[cy * this.cols + cx] : 0; }
  tipoEm(x, y) { return this.tipoCel(this.col(x), this.lin(y)); }
  centro(cx, cy) { return { x: (cx + 0.5) * this.cel, y: (cy + 0.5) * this.cel }; }
  // Esta posição pode ser pisada por unidades desta categoria?
  caminhavel(x, y, perfil = 'campeao') { return PERMITE[perfil][this.tipoEm(x, y)] === 1; }
  celulaCaminhavel(cx, cy, perfil = 'campeao') { return PERMITE[perfil][this.tipoCel(cx, cy)] === 1; }
  // O segmento a-b está livre de paredes? Amostra a cada meia célula, também dos lados (margem) para não "raspar" quinas.
  linhaLivre(ax, ay, bx, by, perfil = 'campeao', margem = this.cel * 0.3) {
    const dx = bx - ax, dy = by - ay; const d = Math.hypot(dx, dy);
    if (d < 1e-6) return this.caminhavel(ax, ay, perfil);
    const passo = this.cel * 0.4; const n = Math.max(1, Math.ceil(d / passo));
    const ux = dx / d, uy = dy / d; const px = -uy * margem, py = ux * margem;
    for (let i = 0; i <= n; i++) {
      const t = i / n; const x = ax + dx * t, y = ay + dy * t;
      if (!this.caminhavel(x, y, perfil) || !this.caminhavel(x + px, y + py, perfil) || !this.caminhavel(x - px, y - py, perfil)) return false;
    }
    return true;
  }
  // Posição navegável mais próxima (busca em anéis de células).
  maisProximo(x, y, perfil = 'campeao') {
    const cx = this.col(x), cy = this.lin(y);
    if (this.celulaCaminhavel(cx, cy, perfil)) return { x, y };
    for (let r = 1; r < Math.max(this.cols, this.rows); r++) {
      let melhor = null, md = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!this.celulaCaminhavel(cx + dx, cy + dy, perfil)) continue;
        const c = this.centro(cx + dx, cy + dy); const d = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (d < md) { md = d; melhor = c; }
      }
      if (melhor) return melhor;
    }
    return null;
  }
}
