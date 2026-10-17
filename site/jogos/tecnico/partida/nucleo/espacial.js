// Índice espacial simples (grade de baldes) para achar vizinhos sem comparar todas as unidades entre si.
export class IndiceEspacial {
  constructor(tam = 800) { this.tam = tam; this.baldes = new Map(); }
  limpar() { this.baldes.clear(); }
  _k(cx, cy) { return cx * 4096 + cy; }
  inserir(u) {
    const k = this._k(Math.floor(u.x / this.tam), Math.floor(u.y / this.tam));
    let b = this.baldes.get(k); if (!b) { b = []; this.baldes.set(k, b); } b.push(u);
  }
  // Chama fn(u) para toda unidade a menos de `raio` de (x, y).
  perto(x, y, raio, fn) {
    const r2 = raio * raio;
    const x0 = Math.floor((x - raio) / this.tam), x1 = Math.floor((x + raio) / this.tam);
    const y0 = Math.floor((y - raio) / this.tam), y1 = Math.floor((y + raio) / this.tam);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const b = this.baldes.get(this._k(cx, cy)); if (!b) continue;
      for (let i = 0; i < b.length; i++) { const u = b[i]; const dx = u.x - x, dy = u.y - y; if (dx * dx + dy * dy <= r2) fn(u); }
    }
  }
}
