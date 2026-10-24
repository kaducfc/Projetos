// Percepção e avaliação usadas pela IA: valor de combate, ameaça, torres, ondas e posições na rota.
import { MUNDO_MAPA, outro } from '../nucleo/mapa-mundo.js';
import { conhecidos } from './visao.js';
import { dist, projetarNaPolilinha } from '../nucleo/coord.js';
import { pontoDaRota } from './entidades.js';
import { estimarDano, hpPct } from './combate.js';

// Valor de combate: quanto o campeão contribui em uma luta (dano por segundo x vida efetiva, em raiz para suavizar extremos).
export function valorCombate(u) {
  if (u.morto) return 0;
  const dpsAuto = u.ad / u.intervalo;
  let dpsHab = 0;
  for (const h of u.habilidades) { const r = u.rank[h.tecla.toLowerCase()]; if (!r || !h.dano) continue; dpsHab += estimarDano(u, h, null) * 0.7 / Math.max(3, h.cd * (1 - u.cdr)); }
  const dps = dpsAuto * 0.8 + dpsHab + (u.perfil.danoMagico ? u.ap * 0.4 : 0);
  const ehp = (u.hp + u.escudo) * (1 + (u.armadura + u.resist) / 220);
  return Math.sqrt(Math.max(1, dps) * ehp) * (u.m ? 1 : 1);
}
export const dpsDe = (u) => u.ad / u.intervalo * 0.8 + u.habilidades.reduce((s, h) => s + (u.rank[h.tecla.toLowerCase()] && h.dano ? estimarDano(u, h, null) * 0.7 / Math.max(3, h.cd * (1 - u.cdr)) : 0), 0);

export function aliadosPerto(P, u, x, y, raio, incluiSelf = true) {
  return P.campeoes.filter((c) => !c.morto && c.equipe === u.equipe && (incluiSelf || c !== u) && Math.hypot(c.x - x, c.y - y) <= raio);
}
export function inimigosConhecidosPerto(P, equipe, x, y, raio) {
  return conhecidos(P, equipe).filter((k) => Math.hypot(k.x - x, k.y - y) <= raio);
}
// Soma de valor de combate: aliados reais x inimigos conhecidos em torno de um ponto.
export function balancoLocal(P, u, x, y, raio = 1500) {
  let a = 0, e = 0;
  for (const c of aliadosPerto(P, u, x, y, raio)) a += valorCombate(c);
  for (const k of inimigosConhecidosPerto(P, u.equipe, x, y, raio)) e += valorCombate(k.u) * (k.visivel ? 1 : 0.9);
  return { a, e, razao: a / Math.max(1, e) };
}

// Torres inimigas (vivas) cujo alcance cobre o ponto.
export function torreInimigaEm(P, equipe, x, y, folga = 60) {
  for (const e of P.estruturas) if (!e.morto && e.equipe !== equipe && e.subtipo === 'torre' && Math.hypot(e.x - x, e.y - y) <= e.alcance + folga) return e;
  return null;
}
export function minionsPerto(P, equipe, x, y, raio, aliados = true) {
  let n = 0; P.indice.perto(x, y, raio, (m) => { if (m.tipo === 'minion' && !m.morto && ((m.equipe === equipe) === aliados)) n++; }); return n;
}

// ---- geometria da rota
export const rotaDe = (rota) => MUNDO_MAPA.rotas[rota];
export function sNaRota(rota, p) { return projetarNaPolilinha(rotaDe(rota).pts, p); }
// Progresso a partir da base da equipe (0 = na base, comprimento = base inimiga)
export const progresso = (rota, equipe, s) => (equipe === 'azul' ? s : rotaDe(rota).comprimento - s);
export function pontoNoProgresso(rota, equipe, prog) {
  const L = rotaDe(rota).comprimento; const s = equipe === 'azul' ? prog : L - prog;
  return pontoDaRota(rotaDe(rota), Math.max(0, Math.min(L, s)));
}
// Frente das ondas na rota: progresso (visão da equipe `equipe`) do minion aliado mais avançado e do inimigo mais avançado.
export function frentes(P, rota, equipe) {
  const L = rotaDe(rota).comprimento; let fa = -1, fe = -1, na = 0, ne = 0;
  for (const m of P.minions) {
    if (m.morto || m.rota !== rota) continue;
    const s = sNaRota(rota, m).s;
    if (m.equipe === equipe) { const p = progresso(rota, equipe, s); if (p > fa) fa = p; na++; }
    else { const p = L - progresso(rota, equipe, s); /* progresso do inimigo na própria direção */ const pi = progresso(rota, outro(equipe), s); if (pi > fe) fe = pi; ne++; }
  }
  return { fa, fe, na, ne, L };
}
export function torresDaRota(P, equipe, rota) { return P.estruturas.filter((e) => e.equipe === equipe && e.subtipo === 'torre' && e.rota === rota && !e.morto).sort((a, b) => a.nivel - b.nivel); }
export function proximaTorreInimiga(P, equipe, rota) { return P.estruturas.filter((e) => e.equipe === outro(equipe) && !e.morto && (e.rota === rota) && (e.subtipo === 'torre' || e.subtipo === 'inibidor')).sort((a, b) => dist(a, MUNDO_MAPA.bases[equipe].nexus) - dist(b, MUNDO_MAPA.bases[equipe].nexus))[0] || null; }
export function pontoSeguro(P, u) {
  // torre aliada mais próxima que esteja do lado da base; senão a fonte
  let melhor = null, md = Infinity;
  for (const e of P.estruturas) if (e.equipe === u.equipe && !e.morto && e.subtipo === 'torre') { const d = dist(e, u); if (d < md) { md = d; melhor = e; } }
  const fonte = MUNDO_MAPA.bases[u.equipe].fonte;
  if (melhor && dist(u, fonte) > dist(melhor, fonte) + 100) return { x: melhor.x - (melhor.x - fonte.x) * 0.0, y: melhor.y };
  return { x: fonte.x, y: fonte.y };
}
export const naFonte = (P, u) => dist(u, MUNDO_MAPA.bases[u.equipe].fonte) <= P.regras.campeao.recall.raioFonte;

// Cada campeão consulta os planos da equipe na ordem de prioridade (definidos em estrategia.js).
export function planoPara(P, u) {
  const pl = P.equipes[u.equipe].planos || [];
  return pl.find((p) => p.participantes.includes(u.id)) || null;
}
