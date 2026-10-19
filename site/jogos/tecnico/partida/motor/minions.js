// Minions: ondas periódicas, marcha pelos pontos de passagem da própria rota, aquisição de alvos e combate com intervalo de ataque.
// Minions só pisam em rota e base (nunca cortam a selva) e não perseguem alvos longe da rota.
import { MUNDO_MAPA, ROTAS, outro } from '../nucleo/mapa-mundo.js';
import { criarMinion, pontoDaRota } from './entidades.js';
import { irPara, parar } from './movimento.js';
import { atacarBasico, podeAtacar, causarDano, porId, atacavel } from './combate.js';
import { dist } from '../nucleo/coord.js';
import { registrar } from './eventos.js';
import { atualizarAuraMinion, atualizarArautoCarga } from './objetivos.js';

const ORDEM_ALVO = { cerco: 0, super: 1, corpo: 2, conjurador: 3 };

export function iniciarOndas(P) {
  P.minionsSis = { proxOnda: P.regras.minions.primeiraOnda, numOnda: 0 };
}

function cadenciaCerco(P) {
  const tab = P.regras.minions.cercoCadaOnda; let n = tab[0][1];
  for (const [t, c] of tab) if (P.t >= t) n = c; return n;
}

// Nasce uma onda em cada rota, para as duas equipes de forma simétrica. As unidades saem escalonadas.
export function gerarOndas(P) {
  const S = P.minionsSis; const R = P.regras.minions;
  while (P.t >= S.proxOnda) {
    S.numOnda++;
    const cerco = S.numOnda % cadenciaCerco(P) === 0;
    registrar(P, 'onda', { numero: S.numOnda });
    for (const eq of ['azul', 'vermelho']) for (const rota of ROTAS) {
      const lane = MUNDO_MAPA.rotas[rota];
      const ib = MUNDO_MAPA.estruturas.find((e) => e.tipo === 'inibidor' && e.rota === rota && e.equipe === eq);
      const s0 = projetar(lane, ib); // distância ao longo da rota até o inibidor da própria equipe (vermelho: perto do fim da linha)
      const seq = [...R.onda];
      if (cerco) seq.push('cerco');
      // superminions: inibidor inimigo derrubado nesta rota (ou todas = duas por onda)
      const derrubados = P.equipes[eq].inibidoresCaidos; // inibidores inimigos que esta equipe derrubou (e ainda não renasceram)
      const supers = derrubados[rota] ? (Object.values(derrubados).filter(Boolean).length >= 3 ? 2 : 1) : 0;
      for (let i = 0; i < supers; i++) seq.push('super');
      const nx = MUNDO_MAPA.bases[eq].nexus; const deslocRota = (ROTAS.indexOf(rota) - 1) * 90; // as 3 ondas saem do Nexus, um pouco afastadas entre si
      const origem = { x: nx.x + deslocRota, y: nx.y - deslocRota * (eq === 'azul' ? 1 : -1) };
      seq.forEach((st, i) => P.filaSpawn.push({ t: S.proxOnda + i * R.espacamentoSpawn, subtipo: st, equipe: eq, rota, s: s0, origem }));
    }
    S.proxOnda += R.intervaloOnda;
  }
  while (P.filaSpawn.length && P.filaSpawn[0].t <= P.t) {
    const f = P.filaSpawn.shift();
    const m = criarMinion(P, f.subtipo, f.equipe, f.rota, f.s, f.origem);
    P.minions.push(m); P.mapaUnidades.set(m.id, m);
  }
  P.filaSpawn.sort((a, b) => a.t - b.t);
}
function projetar(lane, e) { // distância ao longo da rota do ponto mais próximo da estrutura
  let melhor = 0, md = Infinity, acum = 0;
  for (let i = 0; i < lane.pts.length - 1; i++) {
    const a = lane.pts[i], b = lane.pts[i + 1]; const vx = b.x - a.x, vy = b.y - a.y; const l2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((e.x - a.x) * vx + (e.y - a.y) * vy) / l2));
    const d = Math.hypot(e.x - (a.x + vx * t), e.y - (a.y + vy * t));
    if (d < md) { md = d; melhor = acum + Math.sqrt(l2) * t; }
    acum += Math.sqrt(l2);
  }
  return melhor;
}

// Escolhe alvo para um minion segundo a prioridade configurada.
function escolherAlvo(P, m) {
  const aq = m.aquisicao;
  // 1) quem acabou de agredir um campeão aliado ao alcance dos minions
  let melhor = null, mp = 99;
  for (const [id, pr] of P.provocacoes) {
    if (pr.ate < P.t || pr.equipeVitima !== m.equipe) continue;
    const ag = porId(P, id); if (!ag || ag.morto || ag.equipe === m.equipe) continue;
    if (dist(m, ag) <= m.alcance + 350) { melhor = ag; mp = 0; break; }
  }
  if (melhor) return melhor;
  let ordem = 99, md = Infinity, escolhido = null;
  P.indice.perto(m.x, m.y, aq, (u) => {
    if (u.morto || u.equipe === m.equipe || u.equipe === 'neutro' || u.tipo === 'monstro' || u.tipo === 'epico') return;
    if (!atacavel(P, u, m)) return;
    let prio;
    if (u.tipo === 'minion') prio = 1 + ORDEM_ALVO[u.subtipo] * 0.01;
    else if (u.tipo === 'campeao') prio = 3;
    else if (u.tipo === 'estrutura') prio = 2;
    else return;
    if (u.tipo === 'estrutura' && dist(m, u) > m.alcance + 500) return;
    if (u.tipo === 'campeao' && dist(m, u) > m.alcance + 250) return;
    const d = dist(m, u);
    if (prio < ordem || (prio === ordem && d < md)) { ordem = prio; md = d; escolhido = u; }
  });
  return escolhido;
}

export function atualizarMinion(P, m, dt) {
  atualizarAuraMinion(P, m);
  if (m.subtipo === 'arauto' && atualizarArautoCarga(P, m)) return; // avançando contra uma estrutura
  const R = P.regras.minions; const lane = MUNDO_MAPA.rotas[m.rota];
  // validade do alvo atual
  let alvo = m.alvoId ? porId(P, m.alvoId) : null;
  if (alvo && (alvo.morto || !atacavel(P, alvo, m) || dist(m, alvo) > m.aquisicao * 1.5)) alvo = null;
  if (m.alvoId && alvo && P.t - m.alvoDesde < R.persistencia && !(alvo.tipo === 'minion')) { /* persiste */ }
  if (!alvo || P.t >= (m.proxBusca || 0)) {
    const novo = (!alvo || P.t - m.alvoDesde > 0.8) ? escolherAlvo(P, m) : alvo;
    if (novo && novo !== alvo) { m.alvoId = novo.id; m.alvoDesde = P.t; alvo = novo; }
    else if (!novo && !alvo) m.alvoId = null;
    m.proxBusca = P.t + 0.35 + P.rng() * 0.1;
  }
  if (alvo) {
    if (podeAtacar(P, m, alvo)) { parar(m); atacarBasico(P, m, alvo); m.atacandoDesde = P.t; return; }
    // aproxima-se dentro da rota; se o alvo estiver inacessível para minions, desiste dele
    const ok = irPara(P, m, alvo.x, alvo.y, { tol: m.alcance * 0.8 });
    if (!ok) { m.alvoId = null; return; }
    // para a uma distância confortável do alvo para não "empilhar"
    if (dist(m, alvo) <= m.alcance * 0.8 + (alvo.raio || 0) * 0.5) parar(m);
    return;
  }
  // marcha pelos pontos de passagem; depois do último, segue para o Nexus inimigo (dentro da base)
  const dir = m.equipe === 'azul' ? 1 : -1;
  const n = lane.pts.length;
  const wp = lane.pts[Math.max(0, Math.min(n - 1, m.idxWp))];
  if (dist(m, wp) < 220 && m.idxWp + dir >= 0 && m.idxWp + dir < n) m.idxWp += dir;
  let alvoWp = lane.pts[Math.max(0, Math.min(n - 1, m.idxWp))];
  const fimDaRota = (dir === 1 && m.idxWp === n - 1) || (dir === -1 && m.idxWp === 0);
  if (fimDaRota && dist(m, alvoWp) < 260) alvoWp = MUNDO_MAPA.bases[outro(m.equipe)].nexus;
  irPara(P, m, alvoWp.x, alvoWp.y, { tol: 160 });
  // minion que não faz nada por muito tempo (por exemplo, esperando estruturas protegidas) sai da partida: excepcional e registrado
  if (!m.ocioso) m.ocioso = { x: m.x, y: m.y, t: P.t };
  if (Math.hypot(m.x - m.ocioso.x, m.y - m.ocioso.y) > 80 || m.alvoId) m.ocioso = { x: m.x, y: m.y, t: P.t };
  if (P.t - m.ocioso.t > P.regras.minions.ociosoMax) { m.morto = true; m.hp = 0; P.diag.minionsOciosos = (P.diag.minionsOciosos || 0) + 1; }
}
