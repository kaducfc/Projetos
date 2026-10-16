// Estruturas: torres (alvos e disparos), inibidores (renascem), Nexus (fim de jogo) e regras de proteção/progressão.
import { MUNDO_MAPA, outro } from '../nucleo/mapa-mundo.js';
import { criarEstrutura } from './entidades.js';
import { causarDano, porId, atacavel, atualizarProjeteis, agendar } from './combate.js';
import { darOuro, xpDeUnidade } from './economia.js';
import { registrar } from './eventos.js';
import { dist } from '../nucleo/coord.js';

export function construirEstruturas(P) {
  P.estruturas = MUNDO_MAPA.estruturas.map((d) => criarEstrutura(P, d));
  for (const e of P.estruturas) P.mapaUnidades.set(e.id, e);
}
export const achar = (P, equipe, subtipo, rota, nivel) => P.estruturas.find((e) => e.equipe === equipe && e.subtipo === subtipo && (rota === undefined || e.rota === rota) && (nivel === undefined || e.nivel === nivel));

// Progressão: T1 -> T2 -> T3 -> inibidor; torres do Nexus só depois de um inibidor caído; Nexus só sem as torres do Nexus.
export function vulneravel(P, e) {
  if (e.morto) return false;
  const eq = e.equipe;
  if (e.subtipo === 'torre') {
    if (e.nivel === 1) return true;
    if (e.nivel === 2) return !!achar(P, eq, 'torre', e.rota, 1)?.morto;
    if (e.nivel === 3) return !!achar(P, eq, 'torre', e.rota, 2)?.morto;
    if (e.nivel === 4) return P.estruturas.some((x) => x.equipe === eq && x.subtipo === 'inibidor' && x.morto);
  }
  if (e.subtipo === 'inibidor') return !!achar(P, eq, 'torre', e.rota, 3)?.morto;
  if (e.subtipo === 'nexus') {
    const torres = P.estruturas.filter((x) => x.equipe === eq && x.subtipo === 'torre' && x.nivel === 4);
    return P.regras.estruturas.nexus.exige === 'uma' ? torres.some((t) => t.morto) : torres.every((t) => t.morto);
  }
  return false;
}

export function atualizarEstruturas(P, dt) {
  const R = P.regras.estruturas;
  for (const e of P.estruturas) {
    if (e.subtipo === 'inibidor' && e.morto && P.t >= e.renasceEm) {
      e.morto = false; e.hp = e.hpMax; e.ultimosAtacantes = {};
      P.equipes[outro(e.equipe)].inibidoresCaidos[e.rota] = false;
      registrar(P, 'inibidor_renasceu', { equipe: e.equipe, rota: e.rota, id: e.id });
    }
    if (e.morto) continue;
    if (e.subtipo === 'nexus' && e.hp < e.hpMax) e.hp = Math.min(e.hpMax, e.hp + R.nexus.regen * dt);
    if (e.subtipo !== 'torre') continue;
    // validade do alvo atual
    let alvo = e.alvoId ? porId(P, e.alvoId) : null;
    if (alvo && (alvo.morto || dist(e, alvo) > e.alcance + (alvo.raio || 0) * 0.5 || !atacavel(P, alvo))) alvo = null;
    // campeão que agrediu um campeão aliado dentro do alcance tem prioridade
    let agressor = null;
    for (const [id, pr] of P.provocacoes) {
      if (pr.ate < P.t || pr.equipeVitima !== e.equipe) continue;
      const ag = porId(P, id); if (!ag || ag.morto || ag.equipe === e.equipe) continue;
      const vit = porId(P, pr.vitima);
      if (dist(e, ag) <= e.alcance && vit && dist(e, vit) <= e.alcance + 100) { agressor = ag; break; }
    }
    if (agressor) alvo = agressor;
    if (!alvo && P.t >= (e.proxBusca || 0)) {
      e.proxBusca = P.t + 0.3;
      let melhor = null, mp = -1;
      P.indice.perto(e.x, e.y, e.alcance + 60, (u) => {
        if (u.morto || u.equipe === e.equipe || u.equipe === 'neutro' || !atacavel(P, u)) return;
        let p;
        if (u.tipo === 'minion') p = R.prioridadeTorre[u.subtipo] ?? 0.6; else if (u.tipo === 'campeao') p = R.prioridadeTorre.campeao; else return;
        if (dist(e, u) > e.alcance + (u.raio || 0) * 0.5) return;
        if (p > mp || (p === mp && melhor && dist(e, u) < dist(e, melhor))) { mp = p; melhor = u; }
      });
      alvo = melhor;
    }
    if (!alvo) { e.alvoId = null; e.pilha = 0; continue; }
    if (alvo.id !== e.alvoId) { e.alvoId = alvo.id; e.pilha = 0; }
    if (P.t >= e.proximoAtaque) {
      e.proximoAtaque = P.t + e.intervalo;
      const dano = e.dano * (1 + Math.min(R.danoEscalaMax, e.pilha) * R.danoEscalaPorTiro);
      e.pilha = Math.min(R.danoEscalaMax, e.pilha + 1);
      P.fx.push({ k: 'ataque', de: e.id, para: alvo.id, t: P.t, proj: true, x0: e.x, y0: e.y, torre: true });
      const al = alvo;
      agendar(P, P.t + dist(e, alvo) / 1800, () => { if (!al.morto) causarDano(P, e, al, dano, 'fisico', { fx: true }); });
    }
  }
}

// Chamado pelo combate quando a vida de uma estrutura chega a zero (acontece uma única vez, protegido por `morto`).
export function aoDestruir(P, e, fonte) {
  e.destruidaEm = P.t;
  const eqAtaque = outro(e.equipe); const E = P.regras.economia;
  const killer = fonte && fonte.tipo === 'campeao' ? fonte : null;
  const evt = { equipe: eqAtaque, estrutura: e.id, rota: e.rota, nivel: e.nivel, abatedor: killer ? killer.id : null };
  if (e.subtipo === 'torre') {
    const perto = P.campeoes.filter((c) => c.equipe === eqAtaque && !c.morto && dist(c, e) < 1800);
    for (const c of P.campeoes) if (c.equipe === eqAtaque) darOuro(P, c, E.torre.ouroEquipe);
    const por = perto.length ? perto : (killer ? [killer] : []);
    for (const c of por) { darOuro(P, c, E.torre.ouro / por.length); c.estat.torres++; }
    registrar(P, 'torre_destruida', evt);
  } else if (e.subtipo === 'inibidor') {
    e.renasceEm = P.t + P.regras.estruturas.inibidor.respawn;
    P.equipes[eqAtaque].inibidoresCaidos[e.rota] = true;
    for (const c of P.campeoes) if (c.equipe === eqAtaque) darOuro(P, c, E.inibidor.ouro);
    registrar(P, 'inibidor_destruido', evt);
  } else if (e.subtipo === 'nexus') {
    registrar(P, 'nexus_destruido', evt);
    P.verificarVitoria(eqAtaque, 'nexus');
  }
  P.fx.push({ k: 'destruicao', id: e.id, t: P.t, x: e.x, y: e.y, tipo: e.subtipo });
  P.estrategiaMudou = true;
}
