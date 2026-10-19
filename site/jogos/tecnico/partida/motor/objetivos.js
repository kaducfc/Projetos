// Objetivos épicos: Dragão (e Ancião), Arauto e Barão. Entidades com vida, dano e comportamento próprios; só perdem vida por ataques reais.
import { MUNDO_MAPA, outro } from '../nucleo/mapa-mundo.js';
import { causarDano, atacarBasico, podeAtacar, porId, aplicarEfeito, matar } from './combate.js';
import { rotaMaisProxima } from '../nucleo/regioes.js';
import { darOuro, xpDeUnidade } from './economia.js';
import { recalcular, novaId, criarMinion } from './entidades.js';
import { irPara, parar } from './movimento.js';
import { registrar } from './eventos.js';
import { dist } from '../nucleo/coord.js';
import { recuperarSemCombate } from './selva.js';

const ELEMENTOS = ['infernal', 'oceano', 'montanha', 'nuvem', 'hextec', 'quimtec'];

export function criarObjetivos(P) {
  const R = P.regras.epicos;
  P.objetivosEstado = {
    dragao: { vivo: null, proximo: R.dragao.spawn, mortes: 0, almaAlcancada: false },
    arauto: { vivo: null, proximo: R.arauto.spawn, mortes: 0, aposentado: false },
    barao: { vivo: null, proximo: R.barao.spawn, mortes: 0 },
  };
  P.objetivos = { aoMorrer };
}
const covil = (id) => MUNDO_MAPA.covis.find((c) => c.id === id);

function nascerEpico(P, tipo, cfgChave, covilId, extra = {}) {
  const R = P.regras.epicos[cfgChave]; const c = covil(covilId);
  const e = {
    id: novaId(P), tipo: 'epico', subtipo: tipo, nome: extra.nome || tipo, equipe: 'neutro', x: c.x, y: c.y, home: { x: c.x, y: c.y },
    hp: R.hp, hpMax: R.hp, dano: R.dano, armadura: R.armadura, resist: R.resist, alcance: R.alcance, intervalo: R.intervalo, raio: R.raio, vel: 400, aquisicao: R.aquisicao, leash: R.leash,
    ouro: R.ouro, xp: R.xp, estado: 'ocioso', alvoId: null, morto: false, proximoAtaque: 0, ultimosAtacantes: {}, efeitos: [], escudo: 0, ultimoCombate: -99, nascido: P.t, ultimoAlvoVisto: 0,
    elemento: extra.elemento || null, cfg: cfgChave,
  };
  P.epicos.push(e); P.mapaUnidades.set(e.id, e);
  registrar(P, 'objetivo_nasceu', { objetivo: tipo, elemento: e.elemento, id: e.id });
  return e;
}

export function atualizarObjetivos(P, dt) {
  const R = P.regras.epicos; const O = P.objetivosEstado;
  // Dragão / Dragão Ancião
  if (!O.dragao.vivo && P.t >= O.dragao.proximo) {
    const anciao = O.dragao.almaAlcancada;
    O.dragao.vivo = nascerEpico(P, anciao ? 'anciao' : 'dragao', anciao ? 'anciao' : 'dragao', 'dragao', { elemento: anciao ? 'anciao' : ELEMENTOS[Math.floor(P.rng() * ELEMENTOS.length)], nome: anciao ? 'Dragão Ancião' : 'Dragão' });
  }
  // Arauto: nasce no covil do Barão e some se não for derrubado
  if (!O.arauto.vivo && !O.arauto.aposentado && P.t >= O.arauto.proximo && P.t < R.arauto.desaparece) O.arauto.vivo = nascerEpico(P, 'arauto', 'arauto', 'barao', { nome: 'Arauto do Vale' });
  if (O.arauto.vivo && !O.arauto.vivo.morto && P.t >= R.arauto.desaparece) { const a = O.arauto.vivo; a.morto = true; a.hp = 0; O.arauto.vivo = null; O.arauto.aposentado = true; registrar(P, 'arauto_sumiu', {}); }
  if (!O.arauto.vivo && P.t >= R.arauto.desaparece) O.arauto.aposentado = true;
  // Barão: nasce depois que o Arauto saiu de cena
  if (!O.barao.vivo && P.t >= O.barao.proximo && !(O.arauto.vivo && !O.arauto.vivo.morto)) O.barao.vivo = nascerEpico(P, 'barao', 'barao', 'barao', { nome: 'Barão Na\'Shor' });

  atualizarArautos(P);
  for (const e of P.epicos) {
    if (e.morto) continue;
    recuperarSemCombate(P, e, dt);
    if (e.estado === 'ocioso') {
      let alvo = null, md = Infinity;
      P.indice.perto(e.home.x, e.home.y, e.aquisicao, (u) => { if (u.tipo === 'campeao' && !u.morto && dist(u, e.home) < md) { md = dist(u, e.home); alvo = u; } });
      const agr = e.ultimoCombate > P.t - 3 && e.ultimoAgressor ? porId(P, e.ultimoAgressor) : null;
      const a2 = agr && !agr.morto ? agr : (alvo && P.t - e.nascido > 1 && e.hp < e.hpMax ? alvo : null);
      if (a2) { e.estado = 'combate'; e.alvoId = a2.id; e.ultimoAlvoVisto = P.t; }
      else if (e.hp < e.hpMax) e.hp = Math.min(e.hpMax, e.hp + e.hpMax * 0.01 * dt);
    }
    if (e.estado === 'combate') {
      // alvo = o campeão mais próximo que esteja atacando
      let alvo = e.alvoId ? porId(P, e.alvoId) : null;
      if (!alvo || alvo.morto || dist(alvo, e.home) > e.leash) {
        alvo = null; let md = Infinity;
        P.indice.perto(e.x, e.y, e.aquisicao * 1.4, (u) => { if (u.tipo === 'campeao' && !u.morto && dist(u, e.home) <= e.leash && dist(u, e) < md) { md = dist(u, e); alvo = u; } });
      }
      if (alvo) { e.alvoId = alvo.id; e.ultimoAlvoVisto = P.t; }
      if (!alvo || P.t - e.ultimoAlvoVisto > 5 || dist(e, e.home) > e.leash) { e.estado = 'retornando'; e.alvoId = null; parar(e); continue; }
      if (podeAtacar(P, e, alvo)) { parar(e); atacarBasico(P, e, alvo); } else if (!irPara(P, e, alvo.x, alvo.y, { tol: e.alcance * 0.7, perfil: 'epico' })) { e.estado = 'retornando'; e.alvoId = null; parar(e); }
    } else if (e.estado === 'retornando') {
      e.hp = Math.min(e.hpMax, e.hp + e.hpMax * 0.08 * dt); e.ultimosAtacantes = {};
      if (dist(e, e.home) < 60) { e.estado = 'ocioso'; parar(e); } else irPara(P, e, e.home.x, e.home.y, { tol: 40, perfil: 'epico' });
    }
  }
}

export function aoMorrer(P, e, fonte) {
  const R = P.regras.epicos; const O = P.objetivosEstado;
  const k = fonte && fonte.tipo === 'campeao' ? fonte : (e.ultimoAgressor ? porId(P, e.ultimoAgressor) : null);
  const eq = k && k.tipo === 'campeao' ? k.equipe : null;
  if (!eq) { registrar(P, 'objetivo_sem_dono', { objetivo: e.subtipo }); return; }
  const E = P.equipes[eq];
  const cfg = R[e.cfg];
  const part = P.campeoes.filter((c) => c.equipe === eq && !c.morto && dist(c, e) < 1800);
  if (!part.includes(k)) part.push(k);
  const bonus = cfg.bonusEquipe?.ouro || 0;
  for (const c of P.campeoes) if (c.equipe === eq) darOuro(P, c, bonus);
  for (const c of part) { darOuro(P, c, e.ouro / part.length); c.estat.objetivos++; }
  xpDeUnidade(P, eq, e.x, e.y, e.xp, k);
  let efeito = null;
  if (e.subtipo === 'dragao') {
    E.pilhasDragao++; E.dragoes.push(e.elemento);
    O.dragao.mortes++; O.dragao.vivo = null; O.dragao.proximo = P.t + R.dragao.respawn;
    if (E.pilhasDragao >= R.dragao.almaPilhas) { O.dragao.almaAlcancada = true; E.alma = true; registrar(P, 'alma_dragao', { equipe: eq }); }
    for (const c of P.campeoes) if (c.equipe === eq) recalcular(c, P);
    efeito = { pilhas: E.pilhasDragao };
  } else if (e.subtipo === 'anciao') {
    O.dragao.vivo = null; O.dragao.proximo = P.t + R.anciao.respawn; O.dragao.mortes++;
    E.buffAnciao = { ate: P.t + R.anciao.efeito.duracao };
    for (const c of P.campeoes) if (c.equipe === eq) { c.buffs.push({ danoPct: R.anciao.efeito.dano, ate: P.t + R.anciao.efeito.duracao }); recalcular(c, P); if (!c.morto) c.buffExecucao = { ate: P.t + R.anciao.efeito.execDuracao }; } // execução: só quem está vivo na hora (morto não recebe)
    efeito = { duracao: R.anciao.efeito.duracao, execucao: R.anciao.efeito.execDuracao, execLimite: R.anciao.efeito.execLimite };
  } else if (e.subtipo === 'arauto') {
    O.arauto.vivo = null; O.arauto.mortes++; O.arauto.aposentado = true;
    // quem deu o último golpe conquista o Arauto: tem alguns minutos para usá-lo (decidido em atualizarArautos)
    const cg = R.arauto.carga;
    if (k && k.tipo === 'campeao') { k.arautoDisp = { ate: P.t + cg.usoAte, desde: P.t }; efeito = { dono: k.id, usoAte: cg.usoAte }; }
  } else if (e.subtipo === 'barao') {
    O.barao.vivo = null; O.barao.mortes++; O.barao.proximo = P.t + R.barao.respawn;
    E.buffBarao = { ate: P.t + R.barao.efeito.duracao };
    const ef = R.barao.efeito;
    for (const c of P.campeoes) if (c.equipe === eq && !c.morto) { // quem estava vivo ganha o buff (quem morrer perde; quem renascer depois não recebe)
      c.buffBarao = { ate: P.t + ef.duracao };
      if (ef.ad || ef.ap || ef.vel) { c.buffs.push({ adPct: ef.ad, apPct: ef.ap, vel: ef.vel * 335, ate: P.t + ef.duracao }); recalcular(c, P); }
    }
    efeito = { duracao: ef.duracao };
  }
  registrar(P, 'objetivo_abatido', { equipe: eq, objetivo: e.subtipo, elemento: e.elemento, abatedor: k.id, participantes: part.map((c) => c.id), ouro: Math.round(e.ouro + bonus), xp: e.xp, efeito });
  P.fx.push({ k: 'destruicao', id: e.id, t: P.t, x: e.x, y: e.y, tipo: e.subtipo });
  P.estrategiaMudou = true;
}

// Alcance da aura do Barão: distância entre a torre 1 e a torre 2 do meio (média dos dois times), calculada do mapa.
let _raioAura = null;
export function raioAuraBarao() {
  if (_raioAura) return _raioAura;
  const ds = ['azul', 'vermelho'].map((eq) => {
    const t = (n) => MUNDO_MAPA.estruturas.find((e) => e.tipo === 'torre' && e.rota === 'meio' && e.nivel === n && e.equipe === eq);
    const a = t(1), b = t(2); return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 1200;
  });
  return (_raioAura = (ds[0] + ds[1]) / 2);
}
// Minion do time com o buff: se há um campeão vivo com o buff do Barão dentro do alcance, o minion fica roxo (+vida, +dano); fora do alcance volta ao normal.
export function atualizarAuraMinion(P, m) {
  if (m.subtipo === 'arauto') return; // o Arauto conquistado nunca recebe o buff do Barão (a aura roxa dele no mapa é só visual)
  const cfg = P.regras.epicos.barao.efeito.minion;
  const buff = P.equipes[m.equipe].buffBarao;
  let com = false;
  if (buff && P.t < buff.ate) {
    const r = raioAuraBarao();
    com = P.campeoes.some((c) => c.equipe === m.equipe && !c.morto && c.buffBarao && P.t < c.buffBarao.ate && dist(c, m) <= r);
  }
  if (com === !!m.auraBarao) return;
  const pct = m.hpMax > 0 ? m.hp / m.hpMax : 1;
  if (m.hpBase == null) { m.hpBase = m.hpMax; m.danoBase = m.dano; }
  m.auraBarao = com;
  m.hpMax = m.hpBase * (com ? 1 + cfg.hp : 1); m.hp = Math.max(1, pct * m.hpMax); m.dano = m.danoBase * (com ? 1 + cfg.dano : 1);
}

// ---- Arauto conquistado: o campeão pode usá-lo; ele nasce onde foi usado, segue a rota mais próxima como um minion e avança em até 2 estruturas.
// Decisão do campeão (computador): usa quando está perto de uma rota (e já passou alguns segundos da conquista) ou quando o tempo de uso está acabando.
export function atualizarArautos(P) {
  const cg = P.regras.epicos.arauto.carga;
  for (const c of P.campeoes) {
    const d = c.arautoDisp; if (!d) continue;
    if (P.t >= d.ate) { c.arautoDisp = null; continue; }
    if (c.morto) { c.arautoDisp = null; continue; } // quem morre com o Arauto na mão o perde
    if (P.t - d.desde < 8) continue;
    const rt = rotaMaisProxima(c);
    const perto = rt && rt.d < 600;
    const acabando = d.ate - P.t < 45;
    if (perto || acabando) usarArauto(P, c);
  }
}
export function usarArauto(P, c) {
  const cg = P.regras.epicos.arauto.carga;
  const rt = rotaMaisProxima(c); const rota = rt.id; const lane = MUNDO_MAPA.rotas[rota];
  const m = criarMinion(P, 'corpo', c.equipe, rota, 0, { x: c.x, y: c.y });
  m.subtipo = 'arauto'; m.hp = m.hpMax = cg.hp; m.dano = cg.dano; m.intervalo = cg.intervalo; m.vel = cg.vel; m.velBase = cg.vel; m.alcance = 220; m.raio = 90; m.ouro = 0; m.xp = 0; m.armadura = 40; m.resist = 40; m.danoEstruturaMult = 1;
  m.expira = P.t + cg.duracao; m.carga = { avancos: 0, alvoId: null, ultimo: null };
  // próximo ponto de passagem da rota mais próxima, no sentido do Nexus inimigo
  let melhor = 0, md = Infinity;
  for (let i = 0; i < lane.pts.length - 1; i++) { const a = lane.pts[i], b = lane.pts[i + 1]; const vx = b.x - a.x, vy = b.y - a.y; const t = Math.max(0, Math.min(1, ((c.x - a.x) * vx + (c.y - a.y) * vy) / ((vx * vx + vy * vy) || 1))); const d = Math.hypot(c.x - (a.x + vx * t), c.y - (a.y + vy * t)); if (d < md) { md = d; melhor = i; } }
  m.idxWp = c.equipe === 'azul' ? Math.min(lane.pts.length - 1, melhor + 1) : melhor;
  P.minions.push(m); P.mapaUnidades.set(m.id, m);
  c.arautoDisp = null;
  registrar(P, 'arauto_usado', { equipe: c.equipe, jogador: c.id, rota });
  P.fx.push({ k: 'hab', de: c.id, tecla: 'R', x: c.x, y: c.y, t: P.t, tipo: 'buff', x0: c.x, y0: c.y });
  return m;
}
// Avanço do Arauto: perto de uma estrutura inimiga vulnerável (alcance do Barão), ele investe nela: tira 70% da vida máxima da estrutura
// e perde 70% da própria. No máximo 2 avanços, sempre em estruturas diferentes. Devolve true quando o Arauto está avançando neste quadro.
export function atualizarArautoCarga(P, m) {
  const cg = P.regras.epicos.arauto.carga; const av = cg.avanco; const c = m.carga;
  if (!c || m.morto) return false;
  if (c.alvoId) {
    const alvo = porId(P, c.alvoId);
    if (!alvo || alvo.morto || !P.estruturaVulneravel(alvo)) { c.alvoId = null; m.vel = m.velBase; return false; }
    irPara(P, m, alvo.x, alvo.y, { tol: 40 });
    if (dist(m, alvo) <= (alvo.raio || 100) + m.alcance * 0.6) { // impacto
      c.alvoId = null; c.ultimo = alvo.id; c.avancos++; m.vel = m.velBase; parar(m);
      const dano = alvo.hpMax * av.danoEstrutura;
      alvo.hp = Math.max(0, alvo.hp - dano); alvo.ultimoDano = P.t; alvo.ultimoDanoTorre = P.t;
      P.fx.push({ k: 'destruicao', id: alvo.id, t: P.t, x: alvo.x, y: alvo.y, tipo: 'arauto_impacto' });
      registrar(P, 'arauto_impacto', { equipe: m.equipe, estrutura: alvo.id, dano: Math.round(dano) });
      if (alvo.hp <= 0) matar(P, alvo, m);
      m.hp -= m.hpMax * av.danoProprio;
      if (m.hp <= 0) matar(P, m, alvo);
    }
    return true;
  }
  if (c.avancos >= av.maximo) return false;
  const R = raioAuraBarao();
  let alvo = null, md = Infinity;
  for (const e of P.estruturas) { if (e.equipe === m.equipe || e.morto || e.id === c.ultimo || !P.estruturaVulneravel(e)) continue; const d = dist(m, e); if (d <= R && d < md) { md = d; alvo = e; } }
  if (alvo) { c.alvoId = alvo.id; m.vel = m.velBase * av.velMult; }
  return false;
}
