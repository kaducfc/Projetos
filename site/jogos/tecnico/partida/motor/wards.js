// Wards: totem amarelo (cargas que recarregam, duração limitada) e Ward de Controle (comprada, dura até ser destruída).
// A ward é uma entidade própria (P.wards) que serve de fonte de visão; é destruída a golpes (1 de dano por ataque básico).
import { dist } from '../nucleo/coord.js';
import { novaId } from './entidades.js';
import { registrar } from './eventos.js';
import { irPara, parar } from './movimento.js';
import { darOuro } from './economia.js';
import { MUNDO_MAPA } from '../nucleo/mapa-mundo.js';
import { criarRng } from '../nucleo/rng.js';

// Gerador próprio das wards (mesma semente da partida): não consome o sorteio da IA, então mexer em wards não muda o resto da simulação.
const rngWard = (P) => (P._rngWard ||= criarRng((P.semente ?? 1) * 7919 + 13));

export function iniciarWards(P, u) {
  const W = P.regras.wards;
  u.wards = { cargas: W.cargas, proxCarga: null, controleEstoque: 0, alvo: null, proxBusca: 15 + rngWard(P)() * 20, limpando: null };
  u.estat.wardsColocadas = 0; u.estat.wardsDestruidas = 0;
}
// Duração e recarga do totem sobem com o nível.
export const duracaoAmarela = (P, u) => { const W = P.regras.wards; return W.duracaoBase + (W.duracaoMax - W.duracaoBase) * (u.nivel - 1) / 17; };
export const recargaAmarela = (P, u) => { const W = P.regras.wards; return W.recargaBase - (W.recargaBase - W.recargaMin) * (u.nivel - 1) / 17; };
export const wardsDe = (P, u, subtipo) => P.wards.filter((w) => !w.morto && w.dono === u.id && (!subtipo || w.subtipo === subtipo));

export function podeColocar(P, u, subtipo) {
  const W = P.regras.wards; if (!W.ativo || u.morto || !u.wards) return false;
  if (subtipo === 'amarela') return u.wards.cargas > 0 && wardsDe(P, u, 'amarela').length < W.maxAmarelas;
  return u.wards.controleEstoque > 0 && wardsDe(P, u, 'controle').length < W.maxControle;
}
export function colocarWard(P, u, subtipo, x, y) {
  if (!podeColocar(P, u, subtipo)) return null;
  const W = P.regras.wards;
  if (subtipo === 'amarela') {
    u.wards.cargas--; if (u.wards.proxCarga == null) u.wards.proxCarga = P.t + recargaAmarela(P, u);
    // acima do limite o totem mais antigo some (o limite já impede, mas protege contra erros)
  } else u.wards.controleEstoque--;
  const w = {
    id: novaId(P), tipo: 'ward', subtipo, equipe: u.equipe, dono: u.id, x, y, raio: W.raio, hp: subtipo === 'controle' ? W.hpControle : W.hpAmarela,
    hpMax: subtipo === 'controle' ? W.hpControle : W.hpAmarela, criadaEm: P.t, expira: subtipo === 'controle' ? Infinity : P.t + duracaoAmarela(P, u), morto: false, reveladaPara: {},
  };
  P.wards.push(w); u.estat.wardsColocadas++;
  registrar(P, 'ward', { equipe: u.equipe, campeao: u.id, subtipo, x: Math.round(x), y: Math.round(y) });
  P.fx.push({ k: 'ward', id: w.id, t: P.t, x, y, equipe: u.equipe, subtipo });
  return w;
}
export function destruirWard(P, w, por = null) {
  if (w.morto) return;
  w.morto = true; w.mortaEm = P.t;
  if (por && por.tipo === 'campeao') { por.estat.wardsDestruidas = (por.estat.wardsDestruidas || 0) + 1; darOuro(P, por, P.regras.wards.ouroDestruir); }
  P.fx.push({ k: 'wardfim', id: w.id, t: P.t, x: w.x, y: w.y });
}
// 1 de dano (um ataque básico); devolve true se destruiu.
export function golpearWard(P, u, w) {
  if (w.morto) return false;
  w.hp -= 1; P.fx.push({ k: 'wardhit', id: w.id, t: P.t, x: w.x, y: w.y });
  if (w.hp <= 0) { destruirWard(P, w, u); return true; }
  return false;
}
// Passo do sistema: expira os totens, recarrega as cargas e remove wards antigas da lista.
export function atualizarWards(P) {
  for (const w of P.wards) if (!w.morto && P.t >= w.expira) { w.morto = true; w.mortaEm = P.t; P.fx.push({ k: 'wardfim', id: w.id, t: P.t, x: w.x, y: w.y }); }
  for (const u of P.campeoes) {
    const W = u.wards; if (!W) continue;
    if (W.proxCarga != null && P.t >= W.proxCarga) {
      W.cargas = Math.min(P.regras.wards.cargas, W.cargas + 1);
      W.proxCarga = W.cargas < P.regras.wards.cargas ? P.t + recargaAmarela(P, u) : null;
    }
  }
  if (P.wards.length > 60) P.wards = P.wards.filter((w) => !w.morto || P.t - w.mortaEm < 3);
}

// ------------------------------------------------------------------ IA
// Pontos onde vale colocar ward: centro de cada moita e as entradas dos covis do Dragão e do Barão (lado do rio).
export function pontosDeWard(P) {
  if (P._pontosWard) return P._pontosWard;
  const pts = P.terreno.moitas.map((m) => ({ x: m.x, y: m.y, moita: m.id }));
  const cx = P.terreno.cols * P.terreno.cel / 2, cy = P.terreno.rows * P.terreno.cel / 2;
  for (const c of MUNDO_MAPA.covis || []) { // entrada do covil: do lado do centro do mapa
    const d = Math.hypot(cx - c.x, cy - c.y) || 1; const k = (c.raio + 600) / d;
    const p = P.terreno.maisProximo(c.x + (cx - c.x) * k, c.y + (cy - c.y) * k, 'campeao'); if (p) pts.push({ x: p.x, y: p.y, moita: 0 });
  }
  P._pontosWard = pts; return pts;
}
// Melhor ponto para esta ward: perto do campeão, longe da base aliada (visão avançada), sem ward aliada próxima.
function escolherPonto(P, u, maxDist) {
  const base = MUNDO_MAPA.bases[u.equipe].fonte; let melhor = null, ms = -Infinity;
  for (const p of pontosDeWard(P)) {
    const d = dist(u, p); if (d > maxDist) continue;
    if (P.wards.some((w) => !w.morto && w.equipe === u.equipe && dist(w, p) < 1100)) continue;
    const s = -d * 0.6 + Math.min(dist(p, base), 9000) * 0.35 + (p.moita ? 600 : 0);
    if (s > ms) { ms = s; melhor = p; }
  }
  return melhor;
}
// Comportamento de visão do campeão. Devolve true quando assumiu o controle do movimento neste passo.
// Só age em estados tranquilos e sem inimigos por perto: a luta, o recuo e os objetivos têm prioridade.
export function agirWard(P, u) {
  const Wr = P.regras.wards; const W = u.wards;
  if (!Wr.ativo || !W || u.morto) return false;
  const calmo = ['indo_rota', 'farmando', 'selva'].includes(u.estado) && !(u.ctx && u.ctx.iniPerto && u.ctx.iniPerto.length) && !(u.ctx && u.ctx.torreIni);
  if (!calmo) { W.alvo = null; W.limpando = null; return false; }
  // 1) destruir uma ward inimiga revelada ao alcance próximo
  const alvoW = P.wards.find((w) => !w.morto && w.equipe !== u.equipe && w.reveladaPara && w.reveladaPara[u.equipe] && dist(u, w) < 1100);
  if (alvoW && u.pos !== 'atirador' && P.t >= (W.proxLimpa || 0)) {
    if (dist(u, alvoW) > u.alcance + 20) { irPara(P, u, alvoW.x, alvoW.y, { tol: u.alcance * 0.8 }); return true; }
    parar(u);
    if (P.t >= u.proximoAtaque) { u.proximoAtaque = P.t + u.intervalo; golpearWard(P, u, alvoW); u.reveladoAte = P.t + Wr.revelaAoAtacar; }
    return true;
  }
  // 2) colocar a Ward de Controle quando houver (no ponto mais valioso por perto)
  const tipo = podeColocar(P, u, 'controle') ? 'controle' : podeColocar(P, u, 'amarela') ? 'amarela' : null;
  if (!tipo || u.nivel < Wr.nivelMinColocar) { W.alvo = null; return false; }
  if (!W.alvo) {
    if (P.t < W.proxBusca) return false;
    // laners só fazem desvio curto enquanto caminham para a rota; suporte e caçador procuram mais longe
    const maxD = u.pos === 'suporte' || u.pos === 'selva' ? 2600 : u.estado === 'indo_rota' ? 1800 : 0;
    if (!maxD) { W.proxBusca = P.t + 8; return false; }
    const p = escolherPonto(P, u, maxD);
    W.proxBusca = P.t + Wr.intervaloBusca * (0.8 + rngWard(P)() * 0.5);
    if (!p) return false;
    W.alvo = { x: p.x, y: p.y, desde: P.t, tipo };
  }
  const a = W.alvo;
  if (P.t - a.desde > 16) { W.alvo = null; return false; } // desistiu
  if (dist(u, a) > Wr.alcanceColocar * 0.7) { irPara(P, u, a.x, a.y, { tol: Wr.alcanceColocar * 0.5 }); return true; }
  colocarWard(P, u, a.tipo === 'controle' && podeColocar(P, u, 'controle') ? 'controle' : 'amarela', a.x, a.y);
  W.alvo = null; return false;
}
