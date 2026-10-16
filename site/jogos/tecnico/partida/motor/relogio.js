// Relógio da simulação: converte tempo real em passos fixos do motor. Independe da taxa de quadros do navegador.
// Velocidade acelerada = mais passos por quadro (nunca passos maiores), então nenhum ataque, morte, onda ou respawn é pulado.
export class Relogio {
  constructor(partida, { velocidade, maxPassosPorQuadro } = {}) {
    this.p = partida;
    this.velocidades = partida.regras.velocidades;
    this.velocidade = velocidade || partida.regras.velocidadePadrao;
    this.max = maxPassosPorQuadro || partida.regras.maxPassosPorQuadro;
    this.pausado = true; this.acum = 0; this.alfa = 1; this.prev = new Map(); this.passosTotal = 0;
  }
  iniciar() { this.pausado = false; }
  pausar() { this.pausado = true; }
  retomar() { this.pausado = false; }
  alternar() { this.pausado = !this.pausado; return !this.pausado; }
  definirVelocidade(v) { if (this.velocidades.includes(v)) this.velocidade = v; }
  trocarPartida(p) { this.p = p; this.acum = 0; this.alfa = 1; this.prev.clear(); this.pausado = true; this.passosTotal = 0; }
  // dtReal em segundos reais desde o último quadro (limitado para que um quadro atrasado não cause salto grande).
  atualizar(dtReal) {
    const P = this.p; const passo = P.regras.passo;
    if (this.pausado || P.fim) { this.alfa = 1; return 0; }
    this.acum += Math.min(0.25, Math.max(0, dtReal)) * this.velocidade;
    let n = Math.floor(this.acum / passo + 1e-9);
    if (n > this.max) { n = this.max; this.acum = n * passo; } // atraso extremo: continua mais devagar, sem pular nada
    let feitos = 0;
    for (let i = 0; i < n; i++) {
      if (i === n - 1) this._guardar(P);
      if (!P.step()) break;
      feitos++;
    }
    this.acum -= feitos * passo; this.passosTotal += feitos;
    this.alfa = P.fim ? 1 : Math.min(1, Math.max(0, this.acum / passo));
    return feitos;
  }
  _guardar(P) { this.prev.clear(); for (const u of P.todasUnidades()) this.prev.set(u.id, { x: u.x, y: u.y }); }
}
