// Motor da partida: estado oficial, relógio de passo fixo, ordem dos sistemas e condição de vitória (única).
// Nada aqui depende do navegador: roda igual no Node (testes) e no canvas.
import { REGRAS, mesclarRegras } from '../config/regras.js';
import { criarRng } from '../nucleo/rng.js';
import { Terreno } from '../nucleo/terreno.js';
import { Navegacao } from '../nucleo/navegacao.js';
import { IndiceEspacial } from '../nucleo/espacial.js';
import { MUNDO_MAPA } from '../nucleo/mapa-mundo.js';
import { perfilDoCampeao, escolherCampeao } from '../dados/campeoes-sim.js';
import { criarCampeao, recalcular } from './entidades.js';
import { registrar } from './eventos.js';
import { processarAgenda, atualizarProjeteis, atualizarDash, matar } from './combate.js';
import { iniciarOndas, gerarOndas, atualizarMinion } from './minions.js';
import { construirEstruturas, atualizarEstruturas, aoDestruir, vulneravel } from './estruturas.js';
import { criarSelva, atualizarSelva } from './selva.js';
import { criarObjetivos, atualizarObjetivos, aoMorrer as aoMorrerEpico } from './objetivos.js';
import { atualizarVisao } from './visao.js';
import { atualizarCampeao, iniciarCampeao } from './campeao-ia.js';
import { atualizarEstrategia, agirObjetivo, agirEstrutura, agirDefender, agirAjudar } from './estrategia.js';
import { moverUnidade, separar, vigiarPresos } from './movimento.js';
import { construirResultado } from './resultado.js';

let _terreno = null, _nav = null;
export function terrenoCompartilhado() { if (!_terreno) { _terreno = new Terreno(); _nav = new Navegacao(_terreno); } return { terreno: _terreno, nav: _nav }; }

const novaEquipe = () => ({ ouroTotal: 0, abates: 0, mortes: 0, pilhasDragao: 0, dragoes: [], alma: false, inibidoresCaidos: { topo: false, meio: false, baixo: false }, visao: {}, planos: [], hpEstr: {}, buffBarao: null, buffAnciao: null });

export class Partida {
  // opc: { azul: [jogador x5], vermelho: [jogador x5], semente, regras?, catalogo, config? }
  // jogador: { id, nome, pos: 'top'|'selva'|'meio'|'atirador'|'suporte', atributos: {mec,rotas,macro,tf,mental,fama}, poder?, campeao? (objeto do catálogo), favoritos?, bonusMaestriaPct? }
  constructor(opc) {
    this.regras = mesclarRegras(REGRAS, opc.regras);
    this.config = opc.config || {};
    this.semente = opc.semente ?? 1;
    this.rng = criarRng(this.semente);
    const { terreno, nav } = opc.terreno ? { terreno: opc.terreno, nav: opc.nav || new Navegacao(opc.terreno) } : terrenoCompartilhado();
    this.terreno = terreno; this.nav = nav;
    this.t = 0; this.tick = 0; this.proxId = 0; this.proxPlano = 0; this.agendaSeq = 0;
    this.eventos = []; this.fx = []; this.agenda = []; this.projeteis = []; this.provocacoes = new Map(); this.mapaUnidades = new Map();
    this.campeoes = []; this.minions = []; this.monstros = []; this.epicos = []; this.estruturas = []; this.filaSpawn = [];
    this.equipes = { azul: novaEquipe(), vermelho: novaEquipe() };
    this.indice = new IndiceEspacial(800);
    this.fim = null; this.resultadoFinal = null; this.resultadoEntregue = false; this.primeiroAbate = false; this.fase = 'inicial';
    this.diag = { presos: 0, presosGraves: 0, registros: [], erros: [] };
    this.lutas = [];
    this.estruturaVulneravel = (e) => vulneravel(this, e);
    this.estruturasSis = { aoDestruir };
    this.estrategia = { agirObjetivo, agirEstrutura, agirDefender, agirAjudar };
    this.verificarVitoria = (eq, motivo) => this._vitoria(eq, motivo);
    this._montar(opc);
    registrar(this, 'inicio', { semente: this.semente, versaoRegras: this.regras.versao });
  }
  _montar(opc) {
    const usados = new Set();
    const catalogo = opc.catalogo || [];
    for (const eq of ['azul', 'vermelho']) {
      const lista = opc[eq] || [];
      lista.forEach((j, i) => {
        let c = j.campeao;
        if (!c) { c = escolherCampeao(j, catalogo, usados, this.rng); }
        usados.add(c.nome);
        const perfil = perfilDoCampeao(c);
        const u = criarCampeao(this, j, eq, perfil);
        this.campeoes.push(u); this.mapaUnidades.set(u.id, u);
        iniciarCampeao(this, u, i);
      });
    }
    construirEstruturas(this); criarSelva(this); criarObjetivos(this); iniciarOndas(this);
    for (const u of this.campeoes) { recalcular(u, this, true); u.hp = u.hpMax; u.mana = u.manaMax; }
  }
  *todasUnidades() {
    for (const u of this.campeoes) yield u;
    for (const u of this.minions) yield u;
    for (const u of this.monstros) yield u;
    for (const u of this.epicos) yield u;
  }
  // Um passo fixo da simulação.
  step() {
    if (this.fim) return false;
    const R = this.regras; const dt = R.passo;
    this.t = Math.round((this.t + dt) * 1000) / 1000; this.tick++;
    try {
      processarAgenda(this);
      gerarOndas(this); atualizarSelva(this, dt); atualizarObjetivos(this, dt);
      this._indexar();
      if (this.tick % 5 === 0) atualizarVisao(this);
      if (this.tick % Math.round(R.ia.intervaloEstrategia / dt) === 0) { atualizarEstrategia(this, 'azul'); atualizarEstrategia(this, 'vermelho'); }
      const ordem = this.tick % 2 ? this.campeoes : [...this.campeoes].reverse();
      for (const u of ordem) { atualizarCampeao(this, u, dt); if (!u.morto) { atualizarDash(this, u); moverUnidade(this, u, dt); } }
      for (const m of this.minions) if (!m.morto) { if (m.expira && this.t >= m.expira) { matar(this, m, null); continue; } atualizarMinion(this, m, dt); moverUnidade(this, m, dt); }
      atualizarEstruturas(this, dt);
      atualizarProjeteis(this, dt);
      for (const m of this.monstros) if (!m.morto) moverUnidade(this, m, dt);
      for (const e of this.epicos) if (!e.morto) moverUnidade(this, e, dt);
      // separação e vigilância
      for (const u of this.campeoes) if (!u.morto) separar(this, u);
      for (const m of this.minions) if (!m.morto) separar(this, m);
      for (const m of this.monstros) if (!m.morto) separar(this, m);
      if (this.tick % 20 === 0) { for (const u of this.todasUnidades()) vigiarPresos(this, u); this._lutas(); }
      this._economia(dt);
      this._limpar();
      if (this.t >= R.limiteTecnico && !this.fim) this._interromper();
    } catch (e) {
      this.diag.erros.push({ t: this.t, msg: String(e && e.stack || e) });
      if (this.diag.erros.length > 5) { this._interromper('erro_interno'); throw e; }
      throw e;
    }
    return true;
  }
  _indexar() {
    this.indice.limpar();
    for (const u of this.campeoes) if (!u.morto) this.indice.inserir(u);
    for (const u of this.minions) if (!u.morto) this.indice.inserir(u);
    for (const u of this.monstros) if (!u.morto) this.indice.inserir(u);
    for (const u of this.epicos) if (!u.morto) this.indice.inserir(u);
    for (const u of this.estruturas) if (!u.morto) this.indice.inserir(u);
  }
  _economia(dt) {
    const E = this.regras.economia;
    if (this.t >= E.ouroPassivoInicio) for (const u of this.campeoes) if (!u.morto) { u.ouro += E.ouroPassivo * dt; u.ouroTotal += E.ouroPassivo * dt; }
    if (this.tick % 10 === 0) {
      for (const eq of ['azul', 'vermelho']) this.equipes[eq].ouroTotal = this.campeoes.filter((c) => c.equipe === eq).reduce((s, c) => s + c.ouroTotal, 0);
      for (const u of this.campeoes) if (!u.morto && u.buffs.length) recalcular(u, this);
    }
  }
  _limpar() {
    if (this.tick % 5) return;
    this.minions = this.minions.filter((m) => { if (m.morto) { this.mapaUnidades.delete(m.id); return false; } return true; });
    this.monstros = this.monstros.filter((m) => { if (m.morto && this.t - m.mortoEm > 2) { this.mapaUnidades.delete(m.id); return false; } return true; });
    this.epicos = this.epicos.filter((m) => { if (m.morto && this.t - m.mortoEm > 3) { this.mapaUnidades.delete(m.id); return false; } return true; });
    for (const [id, pr] of this.provocacoes) if (pr.ate < this.t) this.provocacoes.delete(id);
    while (this.fx.length && this.t - this.fx[0].t > 4) this.fx.shift();
  }
  _lutas() {
    // regiões de combate: campeões de equipes opostas a menos de 1300 unidades uns dos outros
    const L = []; const vivos = this.campeoes.filter((c) => !c.morto);
    for (const a of vivos) for (const b of vivos) {
      if (a.equipe !== 'azul' || b.equipe !== 'vermelho') continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 1300) L.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, raio: Math.max(500, d) });
    }
    this.lutas = L;
  }
  _vitoria(eqVencedora, motivo) {
    if (this.fim) return; // o resultado nunca é registrado duas vezes
    const perdedor = eqVencedora === 'azul' ? 'vermelho' : 'azul';
    this.fim = { vencedor: eqVencedora, perdedor, motivo, duracao: this.t };
    registrar(this, 'fim', { equipe: eqVencedora, motivo, duracao: Math.round(this.t) });
    this.resultadoFinal = construirResultado(this);
  }
  _interromper(motivo = 'limite_tecnico') {
    if (this.fim) return;
    this.fim = { vencedor: null, perdedor: null, motivo, duracao: this.t, interrompida: true };
    registrar(this, 'fim', { equipe: null, motivo, duracao: Math.round(this.t) });
    this.resultadoFinal = construirResultado(this);
  }
  // Avança `segundos` de jogo em passos fixos. Devolve quantos passos foram executados.
  avancar(segundos, maxPassos = Infinity) {
    const n = Math.min(maxPassos, Math.round(segundos / this.regras.passo)); let k = 0;
    while (k < n && this.step()) k++;
    return k;
  }
  executarAteFim(limite = this.regras.limiteTecnico) {
    while (!this.fim && this.t < limite) this.step();
    if (!this.fim) this._interromper();
    return this.resultadoFinal;
  }
  // Entrega o resultado oficial a quem pediu (sistema de campeonatos) uma única vez.
  entregarResultado(handler) {
    if (!this.fim) throw new Error('partida em andamento');
    if (this.resultadoEntregue) return { duplicado: true, resultado: this.resultadoFinal };
    this.resultadoEntregue = true;
    const retorno = handler ? handler(this.resultadoFinal) : null;
    return { duplicado: false, resultado: this.resultadoFinal, retorno };
  }
}
