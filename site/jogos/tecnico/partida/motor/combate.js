// Combate: dano, mitigação, escudos, cura, controle, ataques básicos, habilidades, projéteis e mortes.
// É o único lugar que altera vida. Renderização e IA só chamam estas funções.
import { registrar } from './eventos.js';
import { darOuro, darXp, xpDeUnidade } from './economia.js';
import { recalcular } from './entidades.js';
import { dist } from '../nucleo/coord.js';
import { criarRng } from '../nucleo/rng.js';
// Sorteio dos críticos: gerador próprio (não consome o sorteio da IA), mesma semente da partida.
const rngCrit = (P) => (P._rngCrit ||= criarRng((P.semente ?? 1) * 104729 + 7));

// ------------------------------------------------------------------ utilidades
export const mitigar = (dano, def) => (def >= 0 ? dano * 100 / (100 + def) : dano * (2 - 100 / (100 - def)));
export const vivo = (u) => u && !u.morto;
export const hostil = (a, b) => a.equipe !== b.equipe;
export const hpPct = (u) => u.hp / u.hpMax;

export function agendar(P, em, fn) {
  const a = P.agenda; const item = { t: em, fn, n: P.agendaSeq++ };
  let i = a.length; a.push(item);
  while (i > 0 && (a[i - 1].t > item.t)) { a[i] = a[i - 1]; i--; }
  a[i] = item;
}
export function processarAgenda(P) { while (P.agenda.length && P.agenda[0].t <= P.t) P.agenda.shift().fn(); }

export function porId(P, id) { return P.mapaUnidades.get(id) || null; }

// ------------------------------------------------------------------ estado de controle
export function incapacitado(u, t) { for (const e of u.efeitos) if (e.tipo === 'stun' && e.ate > t) return true; return false; }
export function silenciado(u, t) { for (const e of u.efeitos) if ((e.tipo === 'silencio' || e.tipo === 'stun') && e.ate > t) return true; return false; }
export function lentidao(u, t) { let p = 0; for (const e of u.efeitos) if (e.tipo === 'lentidao' && e.ate > t && e.pct > p) p = e.pct; return p; }

export function aplicarEfeito(P, alvo, ef, fonte) {
  if (alvo.morto) return;
  const C = P.regras.combate;
  let dur = ef.dur;
  if (ef.tipo === 'stun' || ef.tipo === 'silencio') {
    // resistência a controle em sequência: cada CC recente encurta o próximo; nunca fica incapacitado para sempre
    if (alvo.ccRecente) {
      alvo.ccRecente = alvo.ccRecente.filter((f) => f > P.t - C.resistenciaCC.janela);
      const n = alvo.ccRecente.length;
      dur *= Math.max(C.resistenciaCC.minimo, Math.pow(C.resistenciaCC.reducao, n));
      alvo.ccRecente.push(P.t + dur);
    }
    dur = Math.min(dur, C.duracaoMaxCC);
    if (alvo.tipo === 'campeao') alvo.recallAte = 0;
  }
  if (dur <= 0.05) return;
  alvo.efeitos.push({ tipo: ef.tipo, ate: P.t + dur, pct: ef.pct || 0, de: fonte?.id });
  if (alvo.efeitos.length > 12) alvo.efeitos.shift();
  P.fx.push({ k: 'cc', id: alvo.id, t: P.t, tipo: ef.tipo });
}

// ------------------------------------------------------------------ vulnerabilidade de estruturas e unidades
export function atacavel(P, a, por = null) {
  if (a.morto) return false;
  if (por && por.equipe && por.equipe !== 'neutro' && (a.tipo === 'campeao' || a.tipo === 'minion') && !P.visivelPara(por.equipe, a)) return false; // escondido numa moita
  if (a.tipo === 'estrutura') return P.estruturaVulneravel(a);
  if (a.tipo === 'campeao' && a.invulAte && a.invulAte > P.t) return false;
  return true;
}

export function linhaLivre(P, a, b, margem = 0) { return P.terreno.linhaDeAtaque(a.x, a.y, b.x, b.y); }
// Dentro do alcance e com linha de ataque válida (sem parede no meio). Estruturas e unidades grandes contam o raio.
export function podeAtacar(P, a, b, alcance = a.alcance) {
  const d = dist(a, b) - (b.raio || 0) * 0.6;
  if (d > alcance) return false;
  if (d < 160) return true;
  return linhaLivre(P, a, b, 0);
}

// ------------------------------------------------------------------ dano
export function causarDano(P, fonte, alvo, bruto, tipo = 'fisico', o = {}) {
  if (alvo.morto || bruto <= 0) return 0;
  if (!atacavel(P, alvo)) return 0;
  const R = P.regras;
  let d = bruto;
  const fc = fonte && fonte.tipo === 'campeao';
  if (fc) {
    d *= (fonte.danoMult || 1) * (fonte.m.forca || 1);
    if (alvo.tipo === 'campeao') {
      // trocas na rota: vantagem do atributo "fase de rotas" só no começo da partida
      const f = R.atributos.rotas.fim; if (P.t < f) d *= 1 + (fonte.m.troca - 1) * (1 - P.t / f);
      // lutas de equipe: atributo "teamfight" com 3+ campeões envolvidos
      if (aliadosEmLuta(P, fonte) >= 3) d *= fonte.m.luta;
      d *= 1 - fonte.m.tilt * tilt(P, fonte);
      d *= 1 + R.atributos.mec.duelo * (fonte.m.mec - alvo.m.mec); // Mecânica relativa: quem tem mais leva vantagem nos duelos contra o adversário
    }
    if (o.hab) d *= fonte.m.execDano;
  }
  if (alvo.tipo === 'campeao' && aliadosEmLuta(P, alvo) >= 3) d /= 1 + (alvo.m.luta - 1) * 0.6;
  if (alvo.tipo === 'estrutura') {
    const E = R.estruturas;
    if (alvo.subtipo === 'torre' && alvo.nivel === 1 && P.t < E.protecaoInicial.ate) d *= 1 - E.protecaoInicial.reducao * (1 - P.t / E.protecaoInicial.ate);
    if (fc && !temMinionAliado(P, alvo)) d *= E.sentinela;
  }
  if (alvo.tipo === 'epico' || alvo.tipo === 'monstro') { if (fonte?.tipo === 'campeao') d *= 1; }
  if (tipo === 'fisico') d = mitigar(d, fc ? Math.max(0, (alvo.armadura || 0) * (1 - (fonte.penArmPct || 0)) - (fonte.penArm || 0)) : (alvo.armadura || 0));
  else if (tipo === 'magico') d = mitigar(d, fc ? Math.max(0, (alvo.resist || 0) * (1 - (fonte.penMagPct || 0)) - (fonte.penMag || 0)) : (alvo.resist || 0));
  d = Math.max(R.combate.dano.minimo, d);
  // escudo
  if (alvo.escudo > 0 && alvo.escudoAte > P.t) {
    const abs = Math.min(alvo.escudo, d); alvo.escudo -= abs; d -= abs;
  } else alvo.escudo = 0;
  const real = Math.min(d, alvo.hp);
  alvo.hp -= d;
  if (fonte) {
    if (fonte.id !== undefined) alvo.ultimosAtacantes[fonte.id] = P.t;
    if (fc) { fonte.estat.dano += real; if (alvo.tipo === 'campeao') fonte.estat.danoCamp += real; if (o.basico && fonte.vampiro) { const c = Math.min(fonte.hpMax - fonte.hp, real * fonte.vampiro); fonte.hp += c; fonte.estat.curado += c; } }
  }
  if (alvo.tipo === 'campeao') {
    alvo.estat.danoSofrido += real; alvo.ultimoDano = P.t;
    if (alvo.estado === 'recall' || alvo.recallAte) { alvo.recallAte = 0; }
    if (fonte && fonte.tipo === 'campeao') { P.provocacoes.set(fonte.id, { vitima: alvo.id, equipeVitima: alvo.equipe, ate: P.t + R.estruturas.duracaoAgressor }); alvo.ultimoAtaqueChamp = P.t; alvo.ultimoAgressor = fonte.id; fonte.ultimoAtaqueChamp = P.t; }
    if (fonte && fonte.tipo === 'estrutura') alvo.ultimoDanoTorre = P.t;
  }
  if (alvo.tipo === 'monstro' || alvo.tipo === 'epico') { alvo.ultimoAgressor = fonte?.id; alvo.ultimoCombate = P.t; if (alvo.tipo === 'epico' && fonte?.equipe && alvo.danoEq) alvo.danoEq[fonte.equipe] = (alvo.danoEq[fonte.equipe] || 0) + real; }
  if (o.fx !== false && real > 0) P.fx.push({ k: 'dano', id: alvo.id, t: P.t, v: Math.round(real), x: alvo.x, y: alvo.y, hab: !!o.hab, champ: alvo.tipo === 'campeao' });
  // Buff do Dragão Ancião: quem o tem executa o campeão inimigo que ficar com `execLimite` da vida ou menos depois do dano
  if (fc && alvo.tipo === 'campeao' && alvo.hp > 0 && fonte.buffExecucao && P.t < fonte.buffExecucao.ate && alvo.hp <= alvo.hpMax * R.epicos.anciao.efeito.execLimite) {
    P.fx.push({ k: 'executa', id: alvo.id, t: P.t, x: alvo.x, y: alvo.y }); alvo.hp = 0;
  }
  if (alvo.hp <= 0) matar(P, alvo, fonte);
  return real;
}

export function curar(P, alvo, v, fonte) {
  if (alvo.morto || v <= 0) return;
  const c = Math.min(alvo.hpMax - alvo.hp, v); alvo.hp += c;
  if (fonte && fonte.tipo === 'campeao') fonte.estat.curado += c;
  P.fx.push({ k: 'cura', id: alvo.id, t: P.t, v: Math.round(c) });
}
export function darEscudo(P, alvo, v, dur) { alvo.escudo = (alvo.escudoAte > P.t ? alvo.escudo : 0) + v; alvo.escudoAte = P.t + dur; P.fx.push({ k: 'escudo', id: alvo.id, t: P.t }); }

// Quantos campeões aliados de `u` estão em luta (levaram ou causaram dano a campeão há pouco, num raio curto).
export function aliadosEmLuta(P, u) {
  let n = 0;
  for (const c of P.campeoes) if (!c.morto && c.equipe === u.equipe && Math.hypot(c.x - u.x, c.y - u.y) < 1400 && P.t - Math.max(c.ultimoAtaqueChamp, c.ultimoDano) < 6) n++;
  return n;
}
// Desempenho cai quando a equipe está muito atrás, mais para quem tem pouco mental (mas nunca o suficiente para decidir sozinho a partida).
export function tilt(P, u) {
  const eq = P.equipes[u.equipe], ad = P.equipes[u.equipe === 'azul' ? 'vermelho' : 'azul'];
  const dif = (ad.ouroTotal - eq.ouroTotal) / Math.max(4000, ad.ouroTotal);
  return Math.max(0, Math.min(1, dif * 1.5));
}
export function temMinionAliado(P, e) {
  let achou = false;
  P.indice.perto(e.x, e.y, P.regras.estruturas.raioMinionPerto, (u) => { if (u.tipo === 'minion' && u.equipe === e.equipe && !u.morto) achou = true; });
  return achou;
}

// ------------------------------------------------------------------ mortes e recompensas (único ponto onde algo morre)
export function matar(P, alvo, fonte) {
  if (alvo.morto) return;
  alvo.morto = true; alvo.hp = 0; alvo.mortoEm = P.t;
  if (alvo.tipo === 'campeao') { alvo.buffBarao = null; alvo.buffExecucao = null; } // morrer tira o buff do Barão e o de execução do Ancião
  alvo.caminho = null; alvo.destino = null; alvo.alvoId = null;
  const E = P.regras.economia;
  // quem recebe o crédito: o último atacante que for campeão (para torres/minions que dão o golpe final)
  const quemAbateu = (a) => (a && a.tipo === 'campeao' ? a : null);
  if (alvo.tipo === 'campeao') {
    const eqA = P.equipes[alvo.equipe]; const eqV = P.equipes[alvo.equipe === 'azul' ? 'vermelho' : 'azul'];
    let killer = quemAbateu(fonte);
    // sem campeão no golpe final (minion, monstro, torre...), o abate vai para o último campeão adversário que causou dano
    // nos últimos `janelaCredito` segundos; passado esse tempo é uma "execução" (o campeão morreu sozinho).
    if (!killer) {
      let melhor = null; let tMelhor = -Infinity;
      for (const [id, t] of Object.entries(alvo.ultimosAtacantes)) {
        const c = porId(P, Number(id));
        if (c && c.tipo === 'campeao' && c.equipe !== alvo.equipe && P.t - t <= P.regras.combate.janelaCredito && t > tMelhor) { melhor = c; tMelhor = t; }
      }
      killer = melhor;
    }
    const assist = [];
    for (const [id, t] of Object.entries(alvo.ultimosAtacantes)) {
      const c = porId(P, Number(id));
      if (c && c.tipo === 'campeao' && c.equipe !== alvo.equipe && P.t - t <= P.regras.combate.janelaAssistencia && c !== killer) assist.push(c);
    }
    let bounty = E.abate;
    if (!P.primeiroAbate && killer) { P.primeiroAbate = true; bounty += E.bonusPrimeiroAbate; registrar(P, 'primeiro_abate', { equipe: killer.equipe, campeao: killer.id, vitima: alvo.id }); }
    if (killer) { darOuro(P, killer, bounty); killer.estat.abates++; darXp(P, killer, E.xpAbate[Math.max(0, alvo.nivel - 1)]); eqV.abates++; }
    const parte = assist.length ? bounty * E.assistenciaPct / assist.length : 0;
    for (const a of assist) { darOuro(P, a, parte); a.estat.assist++; darXp(P, a, E.xpAbate[Math.max(0, alvo.nivel - 1)] * 0.5); }
    alvo.estat.mortes++; eqA.mortes++;
    if (!killer) eqV.ouroTotal += 0; // abate por estrutura/minion sem campeão: sem bounty
    const R = P.regras.campeao; const min = P.t / 60;
    const fator = Math.min(R.respawnMaxFator, 1 + Math.max(0, (P.t - R.respawnInicioEscala) / 60) * R.respawnPorMinuto);
    alvo.renasceEm = P.t + R.respawn[Math.min(R.respawn.length - 1, alvo.nivel - 1)] * Math.max(1, fator);
    alvo.estado = 'morto'; alvo.estadoDesde = P.t; alvo.recallAte = 0; alvo.efeitos = []; alvo.escudo = 0; alvo.dashAte = 0;
    registrar(P, 'abate', { equipe: killer ? killer.equipe : (alvo.equipe === 'azul' ? 'vermelho' : 'azul'), vitima: alvo.id, abatedor: killer ? killer.id : null, assist: assist.map((a) => a.id), por: killer ? 'campeao' : (fonte ? fonte.tipo : null), executado: !killer, fonteSubtipo: !killer && fonte ? (fonte.subtipo || fonte.campo || null) : null, fonteEquipe: !killer && fonte ? fonte.equipe : null, x: Math.round(alvo.x), y: Math.round(alvo.y) });
    P.fx.push({ k: 'morte', id: alvo.id, t: P.t, x: alvo.x, y: alvo.y });
  } else if (alvo.tipo === 'minion') {
    const eqVenc = alvo.equipe === 'azul' ? 'vermelho' : 'azul';
    const k = quemAbateu(fonte) || ultimoGolpeDeRota(P, alvo, fonte);
    const mm = (P.diag.minionsMortos ||= { campeao: 0, minion: 0, estrutura: 0, outro: 0 }); mm[k ? 'campeao' : fonte?.tipo === 'minion' ? 'minion' : fonte?.tipo === 'estrutura' ? 'estrutura' : 'outro']++;
    const pesoCs = alvo.subtipo === 'cerco' ? P.regras.minions.csCanhao : 1; // o canhão vale vários minions na contagem de farm
    if (k) { darOuro(P, k, alvo.ouro); k.estat.cs += pesoCs; }
    xpDeUnidade(P, eqVenc, alvo.x, alvo.y, alvo.xp, k);
    // minion abatido pelo suporte: ouro, XP e contagem de farm também vão para o atirador da dupla
    if (k && k.pos === 'suporte') {
      const adc = P.campeoes.find((c) => c.equipe === k.equipe && c.pos === 'atirador' && !c.morto && dist(c, alvo) <= P.regras.economia.raioXp);
      if (adc) { darOuro(P, adc, alvo.ouro); adc.estat.cs += pesoCs; } // o XP já é dividido entre os aliados perto, o atirador incluído
    }
    P.fx.push({ k: 'morte_min', id: alvo.id, t: P.t, x: alvo.x, y: alvo.y });
  } else if (alvo.tipo === 'monstro') {
    P.selva.aoMorrer(P, alvo, fonte);
  } else if (alvo.tipo === 'epico') {
    P.objetivos.aoMorrer(P, alvo, fonte);
  } else if (alvo.tipo === 'estrutura') {
    P.estruturasSis.aoDestruir(P, alvo, fonte);
  }
}

// ------------------------------------------------------------------ ataque básico
export function podeAgir(P, u) { return !u.morto && !incapacitado(u, P.t) && !(u.dashAte && u.dashAte > P.t); }
// Último golpe de rota: quando um minion inimigo morre para minions/torre perto de um campeão em rota, a Mecânica dele
// (u.m.farm) define se ele garantiu o golpe a tempo. Quem acerta leva o ouro e o XP e gasta o tempo do ataque.
const ESTADOS_SEM_FARM = new Set(['morto', 'comprando', 'voltando_base', 'recuando', 'objetivo', 'selva', 'gank', 'ajudando', 'nascendo', 'saindo_base']);
function ultimoGolpeDeRota(P, minion, fonte) {
  const F = P.regras.minions.farm; if (!F || minion.subtipo === 'arauto') return null;
  const candidatos = [];
  for (const c of P.campeoes) {
    if (c.morto || c.equipe === minion.equipe || c.pos === 'selva' || ESTADOS_SEM_FARM.has(c.estado) || !podeAgir(P, c)) continue;
    if (c.pos === 'suporte' && P.campeoes.some((x) => x.equipe === c.equipe && x.pos === 'atirador' && !x.morto)) continue; // o suporte não disputa minions com o atirador vivo
    if (P.t < c.proximoAtaque - F.tolerancia) continue; // ainda no intervalo do ataque anterior
    const d = dist(c, minion), alc = c.alcance + minion.raio * 0.5;
    // perto: o campeão acompanha o minion e acerta; na janela de farm da rota (só quem está farmando) o acerto é mais difícil
    const fator = d <= alc + F.raioExtra ? 1 : (c.rota === minion.rota && d <= alc + F.raioJanela ? (c.estado === 'farmando' ? F.fatorJanela : F.fatorJanela * 0.5) : 0);
    if (fator > 0) candidatos.push({ c, fator });
  }
  if (!candidatos.length) return null;
  for (let i = candidatos.length - 1; i > 0; i--) { const j = Math.floor(P.rng() * (i + 1)); [candidatos[i], candidatos[j]] = [candidatos[j], candidatos[i]]; }
  for (const { c, fator } of candidatos) {
    const chance = c.m.farm * fator * (c.pos === 'suporte' ? F.suporte : 1);
    if (P.rng() >= chance) continue;
    c.proximoAtaque = Math.max(c.proximoAtaque, P.t) + c.intervalo * F.cadencia;
    c.recallAte = 0;
    P.fx.push({ k: 'ataque', de: c.id, para: minion.id, t: P.t, proj: false, x0: c.x, y0: c.y });
    return c;
  }
  return null;
}

export function atacarBasico(P, u, alvo) {
  if (!podeAgir(P, u) || P.t < u.proximoAtaque || alvo.morto || !atacavel(P, alvo, u)) return false;
  if (!podeAtacar(P, u, alvo)) return false;
  const campeao = u.tipo === 'campeao';
  const intervalo = campeao ? u.intervalo : u.intervalo;
  u.proximoAtaque = P.t + intervalo;
  u.alvoId = alvo.id;
  u.recallAte = 0;
  if (campeao) u.reveladoAte = P.t + P.regras.wards.revelaAoAtacar; // atacar de dentro da moita revela o campeão por um instante
  let dano = campeao ? u.ad : u.dano;
  if (campeao && u.crit > 0 && rngCrit(P)() < u.crit) dano *= 1.75; // crítico: 175% do dano
  const tipo = u.dano !== undefined && !campeao && u.subtipoMagico ? 'magico' : 'fisico';
  const projVel = campeao ? (u.alcance > 300 ? 2000 : 0) : (u.proj || 0);
  const aplicar = () => {
    if (u.morto && campeao) return;
    if (alvo.morto) return;
    causarDano(P, u, alvo, dano, tipo, { basico: true });
  };
  P.fx.push({ k: 'ataque', de: u.id, para: alvo.id, t: P.t, proj: projVel > 0, x0: u.x, y0: u.y });
  if (projVel > 0) agendar(P, P.t + dist(u, alvo) / projVel, aplicar); else aplicar();
  return true;
}

// ------------------------------------------------------------------ habilidades
const danoDe = (u, h, alvo) => {
  const d = h.dano; if (!d) return 0;
  const r = u.rank[h.tecla.toLowerCase()];
  let v = d.base + d.rank * (r - 1) + (d.ad ? d.ad * u.ad : 0) + (d.ap ? d.ap * (u.ap + (u.perfil.danoMagico ? u.ad * 0 : 0)) : 0) + (d.hpPct && alvo ? d.hpPct * alvo.hpMax : 0);
  if (d.execucao && alvo && alvo.hp / alvo.hpMax < 0.4) v *= 1 + d.execucao;
  return v;
};
export const estimarDano = danoDe;

export function habPronta(P, u, h) {
  if (!podeAgir(P, u) || silenciado(u, P.t)) return false;
  const r = u.rank[h.tecla.toLowerCase()]; if (!r) return false;
  return P.t >= h.proximo && u.mana >= h.custo;
}
function pagar(P, u, h) { u.mana -= h.custo; h.proximo = P.t + h.cd * (1 - u.cdr); u.recallAte = 0; u.reveladoAte = P.t + P.regras.wards.revelaAoAtacar; }

function alvosEmArea(P, u, x, y, raio, lista) {
  const out = [];
  P.indice.perto(x, y, raio + 150, (a) => {
    if (a.morto || a.equipe === u.equipe || a.tipo === 'estrutura') return;
    if (Math.hypot(a.x - x, a.y - y) <= raio + (a.raio || 0) * 0.5) out.push(a);
  });
  return out;
}
function aplicarHab(P, u, h, a, ctx = {}) {
  const dano = danoDe(u, h, a);
  if (dano > 0) causarDano(P, u, a, dano, h.dano.fis ? 'fisico' : 'magico', { hab: true });
  if (h.efeitos) for (const e of h.efeitos) aplicarEfeito(P, a, e, u);
  if (h.puxa && !a.morto) puxar(P, a, u);
}
function puxar(P, a, u) {
  const d = dist(a, u); if (d < 200) return;
  const k = Math.min(1, 350 / d);
  const nx = a.x + (u.x - a.x) * k, ny = a.y + (u.y - a.y) * k;
  if (P.terreno.caminhavel(nx, ny, 'campeao') && P.terreno.linhaLivre(a.x, a.y, nx, ny, 'campeao', 0)) { a.x = nx; a.y = ny; a.caminho = null; }
}

// Lança uma habilidade em um alvo (unidade) ou posição. Devolve true se foi lançada. Valida estado, recurso, recarga, alcance e linha.
export function lancarHabilidade(P, u, h, alvo, pos = null) {
  if (!habPronta(P, u, h)) return false;
  const rk = u.rank[h.tecla.toLowerCase()];
  const ponto = pos || (alvo ? { x: alvo.x, y: alvo.y } : null);
  switch (h.tipo) {
    case 'alvo': {
      if (!alvo || alvo.morto || !atacavel(P, alvo, u) || alvo.tipo === 'estrutura') return false;
      if (dist(u, alvo) > h.alcance + (alvo.raio || 0) * 0.5 || !linhaLivre(P, u, alvo, 0)) return false;
      pagar(P, u, h);
      P.fx.push({ k: 'hab', de: u.id, tecla: h.tecla, x: alvo.x, y: alvo.y, t: P.t, tipo: 'alvo', x0: u.x, y0: u.y });
      aplicarHab(P, u, h, alvo);
      return true;
    }
    case 'projetil': {
      if (!alvo || alvo.morto) return false;
      if (dist(u, alvo) > h.alcance) return false;
      if (!linhaLivre(P, u, alvo, 0)) return false;
      pagar(P, u, h);
      // mira com antecipação do movimento; a pontaria (Mecânica) define o erro angular
      const vel = h.vel; const d = dist(u, alvo); const tvoo = d / vel;
      const vx = alvo.vx || 0, vy = alvo.vy || 0;
      let tx = alvo.x + vx * tvoo, ty = alvo.y + vy * tvoo;
      const falha = Math.min(0.9, Math.max(0.03, 1 - u.m.execAcerto + (alvo.m ? (alvo.m.mec - 0.5) * 0.18 : 0))); // pontaria do atacante contra a esquiva de quem tem mais Mecânica
      const ang = Math.atan2(ty - u.y, tx - u.x) + (P.rng() - 0.5) * 2 * falha * 0.32;
      P.projeteis.push({ id: ++P.proxId, equipe: u.equipe, fonte: u.id, x: u.x, y: u.y, dx: Math.cos(ang), dy: Math.sin(ang), vel, resta: h.alcance + 100, largura: h.largura || 80, hab: h });
      P.fx.push({ k: 'hab', de: u.id, tecla: h.tecla, x: ponto.x, y: ponto.y, t: P.t, tipo: 'projetil', x0: u.x, y0: u.y });
      return true;
    }
    case 'area': {
      let c;
      if (h.alcance === 0) c = { x: u.x, y: u.y };
      else { if (!alvo) return false; if (dist(u, alvo) > h.alcance + 60) return false; if (!linhaLivre(P, u, alvo, 0)) return false; c = { x: alvo.x + (alvo.vx || 0) * (h.atraso || 0.3) * 0.6, y: alvo.y + (alvo.vy || 0) * (h.atraso || 0.3) * 0.6 }; }
      if (!P.terreno.caminhavel(c.x, c.y, 'campeao')) c = { x: alvo ? alvo.x : u.x, y: alvo ? alvo.y : u.y };
      pagar(P, u, h);
      P.fx.push({ k: 'hab', de: u.id, tecla: h.tecla, x: c.x, y: c.y, t: P.t, tipo: 'area', raio: h.raio, atraso: h.atraso || 0.3, x0: u.x, y0: u.y });
      const em = P.t + (h.atraso || 0.3);
      agendar(P, em, () => {
        if (u.morto && h.alcance !== 0) { /* a habilidade já foi lançada: ainda atinge */ }
        for (const a of alvosEmArea(P, u, c.x, c.y, h.raio)) aplicarHab(P, u, h, a);
      });
      return true;
    }
    case 'dash': {
      // engage (em direção ao alvo) ou fuga (para longe do perigo: usa `fugaDe`)
      let alvoPos;
      if (h.uso === 'fuga') { const de = alvo || { x: u.x - 1, y: u.y }; const d = dist(u, de) || 1; alvoPos = { x: u.x + (u.x - de.x) / d * h.dist, y: u.y + (u.y - de.y) / d * h.dist }; }
      else { if (!alvo) return false; const d = dist(u, alvo) || 1; const k = Math.min(1, Math.max(0, (d - 100)) / d); const passo = Math.min(h.dist, d - 100); if (passo <= 0) return false; alvoPos = { x: u.x + (alvo.x - u.x) / d * passo, y: u.y + (alvo.y - u.y) / d * passo }; }
      // só salta se o caminho estiver livre; senão para antes da parede
      let fim = null; const n = 12;
      for (let i = n; i >= 1; i--) { const t = i / n; const px = u.x + (alvoPos.x - u.x) * t, py = u.y + (alvoPos.y - u.y) * t; if (P.terreno.linhaLivre(u.x, u.y, px, py, 'campeao', 20) && P.terreno.caminhavel(px, py, 'campeao')) { fim = { x: px, y: py }; break; } }
      if (!fim || Math.hypot(fim.x - u.x, fim.y - u.y) < 80) return false;
      pagar(P, u, h);
      const d = Math.hypot(fim.x - u.x, fim.y - u.y); const vel = 1700;
      u.dashDe = { x: u.x, y: u.y }; u.dashPara = fim; u.dashIni = P.t; u.dashAte = P.t + d / vel; u.caminho = null;
      P.fx.push({ k: 'hab', de: u.id, tecla: h.tecla, x: fim.x, y: fim.y, t: P.t, tipo: 'dash', x0: u.x, y0: u.y });
      u.dashHab = h;
      return true;
    }
    case 'escudo': {
      const a = h.alvo === 'aliado' && alvo && alvo.equipe === u.equipe ? alvo : u;
      if (a !== u && dist(u, a) > h.alcance) return false;
      pagar(P, u, h);
      const e = h.escudo; const v = e.base + e.rank * (rk - 1) + (e.ad ? e.ad * u.ad : 0) + (e.ap ? e.ap * u.ap : 0) + (e.hpPct ? e.hpPct * a.hpMax : 0);
      darEscudo(P, a, v, e.dur);
      P.fx.push({ k: 'hab', de: u.id, tecla: h.tecla, x: a.x, y: a.y, t: P.t, tipo: 'escudo', x0: u.x, y0: u.y });
      return true;
    }
    case 'cura': {
      pagar(P, u, h);
      const c = h.cura; const v = c.base + c.rank * (rk - 1) + (c.ap ? c.ap * u.ap : 0);
      if (h.area) { for (const a of P.campeoes) if (!a.morto && a.equipe === u.equipe && dist(a, u) <= (h.raio || 700)) curar(P, a, v, u); }
      else { const a = alvo && alvo.equipe === u.equipe ? alvo : u; curar(P, a, v, u); }
      P.fx.push({ k: 'hab', de: u.id, tecla: h.tecla, x: u.x, y: u.y, t: P.t, tipo: 'cura', x0: u.x, y0: u.y });
      return true;
    }
    case 'buff': {
      pagar(P, u, h);
      const b = h.buff; const alvos = h.area ? P.campeoes.filter((a) => !a.morto && a.equipe === u.equipe && dist(a, u) <= (h.raio || 650)) : [u];
      for (const a of alvos) { a.buffs.push({ ...b, ate: P.t + b.dur }); recalcular(a, P); }
      P.fx.push({ k: 'hab', de: u.id, tecla: h.tecla, x: u.x, y: u.y, t: P.t, tipo: 'buff', x0: u.x, y0: u.y });
      return true;
    }
    default: return false;
  }
}

// Passo dos projéteis (movimento e colisão com o primeiro inimigo no caminho) e dos saltos em andamento.
export function atualizarProjeteis(P, dt) {
  const L = P.projeteis;
  for (let i = L.length - 1; i >= 0; i--) {
    const p = L[i]; const passo = Math.min(p.vel * dt, p.resta);
    const nx = p.x + p.dx * passo, ny = p.y + p.dy * passo;
    let atingido = null;
    // verifica ao longo do trecho percorrido em fatias para não "atravessar" unidades
    const fatias = Math.max(1, Math.ceil(passo / 60));
    for (let k = 1; k <= fatias && !atingido; k++) {
      const cx = p.x + (nx - p.x) * k / fatias, cy = p.y + (ny - p.y) * k / fatias;
      P.indice.perto(cx, cy, p.largura + 120, (a) => {
        if (atingido || a.morto || a.equipe === p.equipe || a.tipo === 'estrutura' || a.invulAte > P.t) return;
        if (a.tipo === 'minion' && p.hab.ignoraMinion) return;
        if (Math.hypot(a.x - cx, a.y - cy) <= (a.raio || 50) + p.largura * 0.5) atingido = a;
      });
    }
    p.x = nx; p.y = ny; p.resta -= passo;
    const parede = !P.terreno.caminhavel(p.x, p.y, 'campeao') && !P.terreno.caminhavel(p.x - p.dx * 60, p.y - p.dy * 60, 'campeao');
    if (atingido) {
      const fonte = porId(P, p.fonte) || { tipo: 'campeao', equipe: p.equipe, id: p.fonte, m: { execDano: 1 }, estat: { dano: 0, curado: 0 } };
      aplicarHab(P, fonte, p.hab, atingido);
      L.splice(i, 1);
    } else if (p.resta <= 0 || parede) L.splice(i, 1);
  }
}
export function atualizarDash(P, u) {
  if (!u.dashAte) return;
  if (P.t >= u.dashAte) {
    u.x = u.dashPara.x; u.y = u.dashPara.y; u.dashAte = 0; u.caminho = null;
    const h = u.dashHab; u.dashHab = null;
    if (h && h.dano) for (const a of alvosEmArea(P, u, u.x, u.y, 260)) aplicarHab(P, u, h, a);
    return;
  }
  const f = (P.t - u.dashIni) / Math.max(0.001, u.dashAte - u.dashIni);
  u.x = u.dashDe.x + (u.dashPara.x - u.dashDe.x) * f; u.y = u.dashDe.y + (u.dashPara.y - u.dashDe.y) * f;
}
