// Movimento: caminhos pela grade de navegação, avanço sem atravessar paredes, separação entre unidades e detecção de unidades presas.
import { dist } from '../nucleo/coord.js';
import { lentidao, incapacitado } from './combate.js';
import { registrar } from './eventos.js';

export const perfilNav = (u) => (u.tipo === 'campeao' ? 'campeao' : u.tipo === 'minion' ? 'minion' : u.tipo === 'monstro' ? 'monstro' : u.tipo === 'epico' ? 'epico' : 'campeao');

export function velocidadeEfetiva(P, u) {
  if (u.morto || incapacitado(u, P.t) || (u.dashAte && u.dashAte > P.t) || (u.recallAte && u.recallAte > P.t)) return 0;
  let v = u.vel; const l = lentidao(u, P.t);
  if (l > 0) v *= 1 - l;
  return v;
}

// Define o destino. Recalcula o caminho só quando o destino mudou de célula ou o caminho acabou/envelheceu.
export function irPara(P, u, x, y, o = {}) {
  const perfil = o.perfil || perfilNav(u);
  const d = u.destino;
  if (u.semCaminhoAte && P.t < u.semCaminhoAte && d && Math.hypot(d.x - x, d.y - y) < P.terreno.cel * 2) return false; // destino sem caminho: não insiste a cada passo
  const mudou = !d || Math.hypot(d.x - x, d.y - y) > P.terreno.cel * 1.2;
  const acabou = !u.caminho || (!u.caminho.length && dist(u, { x, y }) > (o.tol ?? 60));
  // limita a frequência de recálculo (perseguir um alvo em movimento não precisa de um A* novo a cada decisão)
  if ((mudou && (!u.caminho || P.t >= (u.planMin || 0))) || acabou || P.t >= u.replan) {
    u.destino = { x, y };
    u.caminho = P.nav.caminho(u.x, u.y, x, y, perfil);
    u.planMin = P.t + 0.7; u.replan = P.t + 2.5 + P.rng() * 0.8;
    if (!u.caminho) { u.semCaminho = (u.semCaminho || 0) + 1; u.semCaminhoAte = P.t + 3; return false; }
    u.semCaminho = 0; u.semCaminhoAte = 0;
  } else if (mudou && u.destino) { /* mantém o caminho atual por enquanto */ }
  return true;
}
export function parar(u) { u.caminho = null; u.destino = null; }

export function moverUnidade(P, u, dt) {
  const ox = u.x, oy = u.y;
  const vel = velocidadeEfetiva(P, u);
  if (!u.caminho || !u.caminho.length || vel <= 0) { u.vx = 0; u.vy = 0; return; }
  const perfil = perfilNav(u);
  let resta = vel * dt; let g = 0;
  while (resta > 0 && u.caminho && u.caminho.length && g++ < 8) {
    const w = u.caminho[0]; const dx = w.x - u.x, dy = w.y - u.y; const d = Math.hypot(dx, dy);
    if (d <= resta) {
      if (u.caminho.length === 1 && o_parar(u, w)) { u.caminho.shift(); break; }
      u.x = w.x; u.y = w.y; resta -= d; u.caminho.shift(); continue;
    }
    const nx = u.x + dx / d * resta, ny = u.y + dy / d * resta;
    if (P.terreno.caminhavel(nx, ny, perfil)) { u.x = nx; u.y = ny; resta = 0; }
    else if (P.terreno.caminhavel(nx, u.y, perfil)) { u.x = nx; resta = 0; }
    else if (P.terreno.caminhavel(u.x, ny, perfil)) { u.y = ny; resta = 0; }
    else { u.caminho = null; u.replan = 0; u.preso = (u.preso || 0) + 1; break; }
  }
  u.vx = (u.x - ox) / dt; u.vy = (u.y - oy) / dt;
}
const o_parar = () => false;

// Separação simples: unidades vivas próximas se afastam um pouco, sem entrar em parede e sem teletransporte.
export function separar(P, u) {
  if (u.morto || (u.dashAte && u.dashAte > P.t)) return;
  const perfil = perfilNav(u); let px = 0, py = 0, n = 0;
  P.indice.perto(u.x, u.y, 130, (o) => {
    if (o === u || o.morto || o.tipo === 'estrutura') return;
    if (u.tipo === 'monstro' && o.tipo === 'monstro') { /* monstros do mesmo acampamento também se afastam */ }
    const dx = u.x - o.x, dy = u.y - o.y; const d = Math.hypot(dx, dy) || 0.01;
    const lim = (u.raio + o.raio) * 0.85;
    if (d < lim) { const f = (lim - d) / lim; px += dx / d * f; py += dy / d * f; n++; if (d < 1) { px += P.rng() - 0.5; py += P.rng() - 0.5; } }
  });
  if (!n) return;
  const forca = Math.min(60, 40 * n);
  const mx = u.x + px * forca * 0.5, my = u.y + py * forca * 0.5;
  if (P.terreno.caminhavel(mx, my, perfil)) { u.x = mx; u.y = my; }
  else if (P.terreno.caminhavel(mx, u.y, perfil)) u.x = mx;
  else if (P.terreno.caminhavel(u.x, my, perfil)) u.y = my;
}

// Diagnóstico de unidades presas (sem teletransporte): registra, força novo planejamento e, em último caso, pede nova decisão.
export function vigiarPresos(P, u) {
  if (u.morto) return;
  const ult = u.ult || (u.ult = { x: u.x, y: u.y, t: P.t });
  if (P.t - ult.t < 3) return;
  const moveu = Math.hypot(u.x - ult.x, u.y - ult.y);
  const querIr = u.destino && u.caminho && u.caminho.length && dist(u, u.destino) > 300;
  if (querIr && moveu < 40 && velocidadeEfetiva(P, u) > 0 && !(u.alvoId && u.atacandoDesde && P.t - u.atacandoDesde < 3)) {
    u.presoTempo = (u.presoTempo || 0) + 1;
    u.caminho = null; u.replan = 0;
    P.diag.presos++;
    if (u.presoTempo >= 3) {
      P.diag.presosGraves++;
      if (P.diag.registros.length < 50) P.diag.registros.push({ t: Math.round(P.t), id: u.id, tipo: u.tipo, nome: u.nome || u.subtipo, x: Math.round(u.x), y: Math.round(u.y), destino: u.destino && { x: Math.round(u.destino.x), y: Math.round(u.destino.y) }, estado: u.estado });
      registrar(P, 'diagnostico', { equipe: u.equipe, id: u.id, motivo: 'preso', x: Math.round(u.x), y: Math.round(u.y) });
      u.destino = null; u.presoTempo = 0; u.forcarDecisao = true;
    }
  } else u.presoTempo = 0;
  u.ult = { x: u.x, y: u.y, t: P.t };
}
