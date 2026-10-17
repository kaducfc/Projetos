// Selva: acampamentos fixos (do mapa), monstros que atacam, perseguem dentro de um limite, voltam e renascem; recompensas únicas.
import { MUNDO_MAPA } from '../nucleo/mapa-mundo.js';
import { causarDano, atacarBasico, podeAtacar, porId, atacavel, aplicarEfeito } from './combate.js';
import { darOuro, xpDeUnidade } from './economia.js';
import { recalcular, novaId } from './entidades.js';
import { irPara, parar } from './movimento.js';
import { registrar } from './eventos.js';
import { dist } from '../nucleo/coord.js';

export function criarSelva(P) {
  const R = P.regras.selva;
  P.acampamentos = MUNDO_MAPA.acampamentos.map((a) => {
    const def = R.campos[a.tipo];
    const primeiro = a.tipo === 'caranguejo' ? R.primeiroSpawnCaranguejo : R.primeiroSpawn;
    return { id: a.id, tipo: a.tipo, lado: a.lado, x: a.x, y: a.y, raio: a.raio, def, estado: 'aguardando', respawnEm: primeiro, monstros: [], vivos: 0, spawns: 0, ultimaMorte: null, combatendo: null };
  });
  P.selva = { aoMorrer };
}

function nascer(P, c) {
  const R = P.regras.selva;
  c.estado = 'vivo'; c.spawns++; c.monstros = []; c.respawnEm = null;
  for (const d of c.def.monstros) {
    const lugar = P.terreno.maisProximo(c.x + d.off[0], c.y + d.off[1], 'monstro') || { x: c.x, y: c.y }; // acampamento ajustado à mão pode deixar o deslocamento em parede
    const m = {
      id: novaId(P), tipo: 'monstro', campo: c.id, nome: d.n, equipe: 'neutro', x: lugar.x, y: lugar.y, home: { x: lugar.x, y: lugar.y },
      hp: d.hp * R.escalaVida, hpMax: d.hp * R.escalaVida, dano: d.dano * R.escalaDano, intervalo: d.intervalo, alcance: d.alcance, raio: d.raio, armadura: 15, resist: 15, vel: 345, ouro: d.ouro, xp: d.xp, passivo: !!d.passivo,
      proximoAtaque: 0, estado: 'ocioso', alvoId: null, morto: false, ultimosAtacantes: {}, efeitos: [], escudo: 0, aquisicao: P.regras.selva.aquisicao, desde: P.t, ultimoCombate: -99,
    };
    c.monstros.push(m); P.monstros.push(m); P.mapaUnidades.set(m.id, m);
  }
  c.vivos = c.monstros.length;
  registrar(P, 'acampamento_nasceu', { campo: c.id, grupo: c.tipo, lado: c.lado, n: c.spawns });
}

// Monstro (ou épico) que passa alguns segundos sem tomar dano recupera a vida toda rápido: quem larga o monstro perde o progresso.
export function recuperarSemCombate(P, m, dt) {
  const R = P.regras.selva;
  if (m.hp >= m.hpMax || P.t - m.ultimoCombate < R.resetSemCombateS) return;
  m.hp = Math.min(m.hpMax, m.hp + m.hpMax * dt / R.resetRecuperaS);
}
export function atualizarSelva(P, dt) {
  const R = P.regras.selva;
  for (const c of P.acampamentos) {
    if ((c.estado === 'aguardando' || c.estado === 'morto') && P.t >= c.respawnEm) nascer(P, c);
  }
  for (const m of P.monstros) {
    if (m.morto) continue;
    recuperarSemCombate(P, m, dt);
    const c = P.acampamentos.find((x) => x.id === m.campo);
    // aquisição: campeão inimigo que entre na área ou que tenha agredido o monstro
    if (m.estado === 'ocioso') {
      if (m.passivo) continue;
      let alvo = null, md = Infinity;
      P.indice.perto(m.home.x, m.home.y, m.aquisicao, (u) => { if (u.tipo === 'campeao' && !u.morto && dist(u, m.home) < md && P.terreno.linhaLivre(m.x, m.y, u.x, u.y, 'campeao', 0)) { md = dist(u, m.home); alvo = u; } });
      const agr = m.ultimoCombate > P.t - 3 && m.ultimoAgressor ? porId(P, m.ultimoAgressor) : null;
      const a2 = agr && !agr.morto ? agr : alvo;
      if (a2) { alertarCampo(P, c, a2); }
    }
    if (m.estado === 'combate') {
      const alvo = m.alvoId ? porId(P, m.alvoId) : null;
      const fora = !alvo || alvo.morto || dist(m, m.home) > P.regras.selva.leash || dist(alvo, m.home) > P.regras.selva.leash * 0.9 || P.t - m.ultimoAlvoVisto > 6;
      if (alvo && !alvo.morto && dist(m, alvo) < m.aquisicao * 2.2) m.ultimoAlvoVisto = P.t;
      if (fora) { m.estado = 'retornando'; m.alvoId = null; parar(m); continue; }
      if (podeAtacar(P, m, alvo)) { parar(m); if (!m.passivo) { atacarBasico(P, m, alvo); m.atacandoDesde = P.t; } }
      else if (!irPara(P, m, alvo.x, alvo.y, { tol: m.alcance * 0.7 })) { m.estado = 'retornando'; m.alvoId = null; parar(m); } // alvo fora do alcance do terreno dos monstros: desiste
    } else if (m.estado === 'retornando') {
      m.hp = Math.min(m.hpMax, m.hp + m.hpMax * P.regras.selva.regenFora * dt);
      m.ultimosAtacantes = {};
      if (dist(m, m.home) < 80) { m.x = m.home.x; m.y = m.home.y; m.estado = 'ocioso'; parar(m); m.hp = m.hpMax; }
      else irPara(P, m, m.home.x, m.home.y, { tol: 40 });
    } else if (m.estado === 'ocioso' && m.hp < m.hpMax) m.hp = Math.min(m.hpMax, m.hp + m.hpMax * 0.02 * dt);
  }
}
function alertarCampo(P, c, alvo) {
  for (const x of c.monstros) {
    if (x.morto || x.passivo) continue;
    x.estado = 'combate'; x.alvoId = alvo.id; x.ultimoAlvoVisto = P.t; x.ultimoCombate = P.t;
  }
  c.combatendo = alvo.id;
}

// Um acampamento só concede recompensa de cada monstro uma vez: `aoMorrer` roda uma única vez por monstro (guardado por `morto`).
export function aoMorrer(P, m, fonte) {
  const c = P.acampamentos.find((x) => x.id === m.campo);
  const killer = fonte && fonte.tipo === 'campeao' ? fonte : (m.ultimoAgressor ? porId(P, m.ultimoAgressor) : null);
  const k = killer && killer.tipo === 'campeao' ? killer : null;
  if (k) { darOuro(P, k, m.ouro); k.estat.csSelva++; }
  const eqV = k ? k.equipe : null;
  if (eqV) xpDeUnidade(P, eqV, m.x, m.y, m.xp, k);
  c.vivos--;
  if (c.vivos <= 0 && c.estado === 'vivo') {
    c.estado = 'morto'; c.ultimaMorte = P.t;
    c.respawnEm = P.t + (c.def.respawn || P.regras.selva.respawn);
    c.combatendo = null;
    if (k) {
      const bf = c.def.buff;
      if (bf === 'azul') { k.buffs.push({ cdr: 0.1, ate: P.t + P.regras.selva.buffs.azul.dur, mana: 1 }); k.mana = k.manaMax; recalcular(k, P); }
      else if (bf === 'vermelho') { k.buffs.push({ adPct: P.regras.selva.buffs.vermelho.ad, ate: P.t + P.regras.selva.buffs.vermelho.dur }); recalcular(k, P); }
    }
    registrar(P, 'acampamento_limpo', { campo: c.id, grupo: c.tipo, lado: c.lado, equipe: k ? k.equipe : null, campeao: k ? k.id : null, n: c.spawns });
  }
  P.fx.push({ k: 'morte_mon', id: m.id, t: P.t, x: m.x, y: m.y });
}
