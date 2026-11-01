// Estratégia coletiva: cada equipe avalia a partida a cada poucos segundos e escolhe prioridades (defender, objetivo épico,
// pressionar estruturas, finalizar, ajudar). As ordens são sugestões: cada campeão pode abandoná-las para sobreviver (campeao-ia.js).
import { MUNDO_MAPA, outro, ROTAS } from '../nucleo/mapa-mundo.js';
import { dist } from '../nucleo/coord.js';
import { conhecidos } from './visao.js';
import { irPara, parar } from './movimento.js';
import { atacarBasico, podeAtacar, atacavel, porId, hpPct, lancarHabilidade } from './combate.js';
import { valorCombate, dpsDe, aliadosPerto, minionsPerto, torreInimigaEm, rotaDe, sNaRota, progresso, pontoNoProgresso, torresDaRota } from './percepcao.js';
import { usarHabilidades, posFarm, golpear, golpePronto, danoGolpear } from './campeao-ia.js';
import { registrar } from './eventos.js';
import { incerteza, visaoSobre, macroDaEquipe, atraso, pol } from './inteligencia.js';
import { janelaOfensiva, janelaDeAbates, buffBaraoDe, aptos, cadeiaDeVitoria, ameacaDeContestar } from './janela.js';

const ID = (P) => ++P.proxPlano;

// Minion aliado mais avançado de uma rota (e o progresso dele a partir da base da equipe).
export function frenteAliada(P, eq, rota) {
  let melhor = null, bp = -1;
  for (const m of P.minions) {
    if (m.morto || m.equipe !== eq || m.rota !== rota || m.subtipo === 'arauto') continue;
    const pr = progresso(rota, eq, sNaRota(rota, m).s); if (pr > bp) { bp = pr; melhor = m; }
  }
  return melhor ? { m: melhor, p: bp } : null;
}

export function faseDaPartida(P) {
  const F = P.regras.fases; const torres = P.estruturas.filter((e) => e.subtipo === 'torre' && e.morto).length;
  if (P.t < F.inicial && torres < 3) return 'inicial';
  if (P.t < F.intermediaria && torres < 7) return 'intermediaria';
  return 'avancada';
}

const vivos = (P, eq) => P.campeoes.filter((c) => c.equipe === eq && !c.morto);
// Ponto de reunião de uma equipe para um objetivo: calculado uma vez (o terreno não muda). Entre pontos a ~1000 unidades do covil, escolhe o
// que tem caminho curto até ele (não atrás de uma parede) e é mais perto do caminho da base da equipe.
function stagingObjetivo(P, eq, covil) {
  const chave = eq + ':' + covil.id;
  P.staging ||= {};
  if (P.staging[chave]) return P.staging[chave];
  const nex = MUNDO_MAPA.bases[eq].nexus; let melhor = null, ms = Infinity;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    for (const r of [900, 1150]) {
      const c = { x: covil.x + Math.cos(a) * r, y: covil.y + Math.sin(a) * r };
      if (!P.terreno.caminhavel(c.x, c.y, 'campeao')) continue;
      const dl = P.nav.distancia(c.x, c.y, covil.x, covil.y, 'campeao'); if (!isFinite(dl) || dl > r * 1.35) continue;
      const db = P.nav.distancia(nex.x, nex.y, c.x, c.y, 'campeao'); if (!isFinite(db)) continue;
      if (db < ms) { ms = db; melhor = c; }
    }
  }
  return (P.staging[chave] = melhor || { x: covil.x, y: covil.y });
}

export function atualizarEstrategia(P, eq) {
  const E = P.equipes[eq]; const inim = outro(eq); const R = P.regras.ia;
  const meus = vivos(P, eq); const conh = conhecidos(P, eq, 8);
  const fase = faseDaPartida(P); P.fase = fase;
  const planos = []; const usados = new Set();
  const livres = () => meus.filter((c) => !usados.has(c.id));
  const marcar = (arr) => arr.forEach((c) => usados.add(c.id));
  const ouroDif = E.ouroTotal - P.equipes[inim].ouroTotal;
  const nexus = MUNDO_MAPA.bases[eq].nexus;

  // 0) janelas de vitória: o que esta equipe pode fazer para ACABAR o jogo e o que o adversário poderia fazer contra ela (ver janela.js)
  const Jme = janelaOfensiva(P, eq); const Jini = janelaOfensiva(P, inim, { ameaca: true });
  E.janela = Jme;
  if (Jme.comprometer) {
    if (!E.finalizando) { E.finalizando = { desde: P.t, ultimo: P.t }; registrar(P, 'investida_final', { equipe: eq, rota: Jme.rota, motivo: Jme.motivo, tempo: Math.round(Jme.tempo), razao: Math.round(Jme.razao * 100) / 100, mortos: Jme.mortos, barao: Jme.barao }); }
    E.finalizando.ultimo = P.t;
  } else if (E.finalizando && P.t - E.finalizando.ultimo > 8) E.finalizando = null;
  // o adversário tem a chance de acabar e a nossa não é mais rápida: todos defendem onde ele vai bater (inclusive quem estava na base)
  if (Jini.comprometer && Jini.alvo && (!Jme.comprometer || Jme.tempo > Jini.tempo * 0.9)) {
    const part = aptos(P, eq, pol(P, eq, 'janela.hpUrgente')).filter((c) => !usados.has(c.id));
    if (part.length) {
      planos.push({ id: ID(P), tipo: 'defender_base', pos: { x: Jini.alvo.x, y: Jini.alvo.y }, rota: Jini.alvo.rota || 'base', estrutura: Jini.alvo.id, participantes: part.map((c) => c.id), urgente: true, ameaca: true });
      marcar(part);
      if (!E.defendendoFinal || P.t - E.defendendoFinal > 30) registrar(P, 'defesa_final', { equipe: eq, rota: Jini.rota, alvo: Jini.alvo.id, tempo: Math.round(Jini.tempo), razao: Math.round(Jini.razao * 100) / 100 });
      E.defendendoFinal = P.t;
    }
  }
  // investida final: o caminho mais curto até o Nexus (uma rota, o inibidor, as torres do Nexus), sem passar por todas as outras estruturas
  if (Jme.comprometer && Jme.alvo && !planos.some((p) => p.tipo === 'defender_base' && p.ameaca)) {
    const part = aptos(P, eq, Jme.urgente ? pol(P, eq, 'janela.hpUrgente') : pol(P, eq, 'janela.hpMin')).filter((c) => !usados.has(c.id));
    if (part.length >= 2) {
      planos.push({ id: ID(P), tipo: 'finalizar', rota: Jme.rota, estrutura: Jme.alvo.id, pos: { x: Jme.alvo.x, y: Jme.alvo.y }, participantes: part.map((c) => c.id), urgente: Jme.urgente, motivo: Jme.motivo, nexusExposto: Jme.alvo.subtipo === 'nexus' || Jme.alvo.nivel === 4 });
      marcar(part);
    }
  }
  // 1) defender a base: inimigos (conhecidos) perto do Nexus ou de uma estrutura da base
  const inimigosBase = conh.filter((k) => dist(k, nexus) < 2800);
  const base = P.estruturas.filter((e) => e.equipe === eq && !e.morto && (e.subtipo === 'inibidor' || e.subtipo === 'nexus' || e.nivel === 4));
  const ameacaBase = base.find((e) => inimigosBase.some((k) => dist(k, e) < 1500));
  if (ameacaBase) {
    const part = livres().filter((c) => hpPct(c) > 0.3);
    if (part.length) { planos.push({ id: ID(P), tipo: 'defender_base', pos: { x: ameacaBase.x, y: ameacaBase.y }, rota: ameacaBase.rota || 'base', estrutura: ameacaBase.id, participantes: part.map((c) => c.id) }); marcar(part); }
  }
  // 2) defender estrutura sob ataque em uma rota
  for (const e of P.estruturas) {
    if (e.equipe !== eq || e.morto || e.subtipo === 'nexus') continue;
    const atacantes = conh.filter((k) => k.visivel && dist(k, e) < (e.alcance || 800) + 250);
    const hpAnt = E.hpEstr[e.id] ?? e.hp; E.hpEstr[e.id] = e.hp; const perdendo = e.hp < hpAnt - 5;
    const minIni = minionsPerto(P, eq, e.x, e.y, 1000, false);
    // só defende quando a estrutura está de fato sob pressão: perdendo vida, ou inimigos junto com minions dele
    if (!(perdendo && (atacantes.length || minIni >= 2)) && !(atacantes.length && minIni >= 3)) continue;
    const aliadosAli = livres().filter((c) => hpPct(c) > 0.4 && (c.rota === e.rota || dist(c, e) < 6500));
    const vAli = aliadosAli.reduce((s, c) => s + valorCombate(c), 0), vIni = atacantes.reduce((s, k) => s + valorCombate(k.u), 0);
    if (aliadosAli.length && (vAli >= vIni * 0.75 || e.nivel >= 3 || e.subtipo === 'inibidor') && (atacantes.length || vIni === 0)) {
      const part = aliadosAli.filter((c) => dist(c, e) < 5200 + (e.nivel >= 3 ? 3000 : 0));
      if (part.length) { planos.push({ id: ID(P), tipo: 'defender', rota: e.rota, pos: { x: e.x, y: e.y }, estrutura: e.id, participantes: part.map((c) => c.id) }); marcar(part); }
    }
  }
  // 3) finalizar: Nexus exposto ou vantagem para derrubar a base
  const nexIni = P.estruturas.find((e) => e.equipe === inim && e.subtipo === 'nexus');
  const inibIni = P.estruturas.filter((e) => e.equipe === inim && e.subtipo === 'inibidor' && e.morto).length;
  const mortosIni = P.campeoes.filter((c) => c.equipe === inim && c.morto).length;
  if (nexIni && !nexIni.morto && (P.estruturas.some((e) => e.equipe === inim && e.subtipo === 'torre' && e.nivel === 4 && e.morto) || (inibIni > 0 && mortosIni >= 2))) {
    const part = livres().filter((c) => hpPct(c) > 0.35);
    if (part.length >= 3 || (mortosIni >= 3 && part.length >= 2)) {
      const alvo = proximoAlvoBase(P, inim);
      if (alvo) { planos.push({ id: ID(P), tipo: 'finalizar', rota: alvo.rota || 'base', estrutura: alvo.id, pos: { x: alvo.x, y: alvo.y }, participantes: part.map((c) => c.id) }); marcar(part); }
    }
  }
  // 4) objetivos épicos
  const obj = escolherObjetivo(P, eq, conh, livres());
  if (obj) {
    const part = livres().filter((c) => hpPct(c) > 0.45 && obj.participam(c));
    if (part.length >= Math.min(obj.minimo || 4, meus.length) || (obj.cedo && part.length >= 3)) {
      const anterior = E.planos?.find((p) => p.tipo === 'objetivo' && p.objetivo === obj.nome);
      const pl = anterior || { id: ID(P), tipo: 'objetivo', objetivo: obj.nome, covil: obj.covil, pos: obj.staging, epicoId: obj.epico?.id || null, estado: 'reunindo', desde: P.t };
      pl.participantes = part.map((c) => c.id); pl.epicoId = obj.epico?.id || null;
      // começa quando os participantes chegaram ao ponto de reunião (ou o tempo passou) e o objetivo está vivo
      const reun = part.filter((c) => dist(c, obj.staging) < 900).length;
      // Macro: quem lê bem o jogo só entra no objetivo com visão sobre o covil (ou depois de esperar um tempo); quem lê mal vai às cegas
      const mac = macroDaEquipe(P, eq); const viu = visaoSobre(P, eq, obj.covil.x, obj.covil.y, 1100) || mac < 0.35 || P.t - pl.desde > 35;
      if (pl.estado === 'reunindo' && obj.epico && viu && (reun >= Math.min(obj.minimo || 4, part.length) || P.t - pl.desde > 30)) { pl.estado = 'executando'; registrar(P, 'objetivo_iniciado', { equipe: eq, objetivo: obj.nome, participantes: part.map((c) => c.id) }); }
      planos.push(pl); marcar(part);
    }
  }
  // 4b) contestar / roubar: o inimigo está matando um objetivo e a equipe sabe disso (viu ou tem visão)
  if (!planos.some((p) => p.tipo === 'objetivo')) {
    const c = avaliarContestar(P, eq, conh, livres());
    if (c) { planos.push(c); marcar(c.participantes.map((id) => porId(P, id))); }
  }
  // 4c) com o buff do Barão: o grupo inteiro empurra UMA rota junto da onda (o buff deixa os minions mais fortes enquanto há um campeão com buff por perto)
  // e leva as estruturas dela rápido, antes de o buff acabar; não se espalha pelo mapa nem volta à base à toa
  const buffBarao = buffBaraoDe(P, eq);
  if (buffBarao > 15 && livres().length >= 3 && !planos.some((p) => p.tipo === 'finalizar')) {
    let melhorR = null;
    for (const rota of ROTAS) {
      const ch = cadeiaDeVitoria(P, eq, rota); const alvo = ch.estruturas.find((x) => P.estruturaVulneravel(x)); if (!alvo) continue;
      const fr = frenteAliada(P, eq, rota); const L = rotaDe(rota).comprimento;
      const defensores = conh.filter((k) => k.visivel && dist(k, alvo) < 1800).length;
      const sc = (fr ? fr.p / L : 0) * 2 + (ch.aberto ? 0.6 : 0) + Math.min(1, minionsPerto(P, eq, alvo.x, alvo.y, 1500, true) / 6) * 0.6 - defensores * 0.25;
      if (!melhorR || sc > melhorR.sc) melhorR = { rota: ch.rota, alvo, sc };
    }
    const grupo = livres().filter((c) => hpPct(c) > 0.35);
    if (melhorR && grupo.length >= 3) { planos.push({ id: ID(P), tipo: 'pressionar', rota: melhorR.rota, estrutura: melhorR.alvo.id, pos: { x: melhorR.alvo.x, y: melhorR.alvo.y }, participantes: grupo.map((c) => c.id), grupo: true, barao: true }); marcar(grupo); }
  }
  // 5) pressionar estruturas: laner sozinho com a onda aliada na torre (a partir dos 10 min) e grupo quando há vantagem
  if (P.t >= pol(P, eq, 'pressaoDesde')) {
    const grupoLane = {};
    for (const rota of ROTAS) {
      const alvo = P.estruturas.filter((e) => e.equipe === inim && !e.morto && e.rota === rota && (e.subtipo === 'torre' || e.subtipo === 'inibidor') && P.estruturaVulneravel(e)).sort((a, b) => dist(a, nexus) - dist(b, nexus))[0];
      if (!alvo) continue;
      const defensores = conh.filter((k) => k.visivel && dist(k, alvo) < 1800).length;
      const minAli = minionsPerto(P, eq, alvo.x, alvo.y, 900, true);
      const laner = livres().find((c) => c.rota === rota && c.pos !== 'suporte' && hpPct(c) > 0.5);
      grupoLane[rota] = { alvo, defensores, minAli };
      if (laner && minAli >= 2 && defensores === 0) { planos.push({ id: ID(P), tipo: 'pressionar', rota, estrutura: alvo.id, pos: { x: alvo.x, y: alvo.y }, participantes: [laner.id] }); marcar([laner]); }
    }
    // grupo: com vantagem numérica/ouro (ou já no fim de jogo), todos empurram a rota mais exposta
    const inimVivos = P.campeoes.filter((c) => c.equipe === inim && !c.morto).length;
    const vantagem = meus.length - inimVivos;
    const querGrupo = (fase !== 'inicial' || (vantagem >= 2 && P.t >= 300)) && livres().length >= 4 && (vantagem >= 1 || ouroDif > 1800 || P.t >= pol(P, eq, 'grupoDesde'));
    if (querGrupo) {
      const opcoes = Object.entries(grupoLane).filter(([, g]) => g.defensores <= Math.max(1, vantagem + 1)).sort((a, b) => a[1].defensores - b[1].defensores || (a[0] === 'meio' ? -1 : 1));
      if (opcoes.length) {
        const [rota, g] = opcoes[0]; const grupo = livres().filter((c) => hpPct(c) > 0.55);
        if (grupo.length >= 3) { planos.push({ id: ID(P), tipo: 'pressionar', rota, estrutura: g.alvo.id, pos: { x: g.alvo.x, y: g.alvo.y }, participantes: grupo.map((c) => c.id), grupo: true }); marcar(grupo); }
      }
    }
  }
  // 6) rotação: meio e suporte ajudam uma rota com vantagem numérica (apenas depois da fase inicial)
  if (P.t >= pol(P, eq, 'rotacao.tempoMin') * (1.3 - 0.6 * macroDaEquipe(P, eq))) { // Macro: quem lê o jogo roda mais cedo para ajudar
    for (const rota of ['topo', 'baixo']) {
      const tIni = conh.filter((k) => k.visivel && k.u.rota === rota);
      if (!tIni.length) continue;
      const aliado = P.campeoes.find((c) => c.equipe === eq && c.rota === rota && !c.morto);
      if (!aliado || hpPct(aliado) > 0.6) continue;
      const ajuda = livres().find((c) => (c.pos === 'meio' || c.pos === 'suporte') && c.rota !== rota && hpPct(c) > 0.6);
      if (ajuda) { planos.push({ id: ID(P), tipo: 'ajudar', rota, pos: { x: aliado.x, y: aliado.y }, participantes: [ajuda.id] }); marcar([ajuda]); }
    }
  }
  E.planos = planos;
  E.plano = null; // planos individuais são resolvidos em `planoPara`
}
// Contestar ou roubar o objetivo que o time inimigo está fazendo. A equipe só decide se SABE (visão sobre o objetivo ou inimigos vistos perto dele).
// Vai quando consegue roubar (a vida que sobra na chegada cai com a rajada de quem chega) ou quando o valor de combate de quem chega é suficiente;
// atrás no placar e com Mental baixo, tenta até em condição ruim (principalmente Barão e Ancião, a única forma de virar o jogo).
function avaliarContestar(P, eq, conh, aliados) {
  const inim = outro(eq); const CF = P.regras.ia.contestar; const mac = macroDaEquipe(P, eq);
  for (const e of P.epicos) {
    if (e.morto || e.subtipo === 'arauto') continue;
    const ag = e.ultimoAgressor ? porId(P, e.ultimoAgressor) : null;
    if (!ag || ag.equipe !== inim || P.t - e.ultimoCombate > CF.janela) continue;
    if (!(visaoSobre(P, eq, e.x, e.y, 900) || conh.some((k) => k.visivel && dist(k, e) < 1800))) continue;
    const perto = P.campeoes.filter((c) => c.equipe === inim && !c.morto && dist(c, e) < 1800);
    const dpsIni = perto.reduce((s, c) => s + dpsDe(c) * 0.65, 0);
    const tRest = e.hp / Math.max(1, dpsIni);
    const chegam = aliados.filter((c) => hpPct(c) > 0.4).map((c) => ({ c, eta: P.nav.distancia(c.x, c.y, e.x, e.y, 'campeao') / c.vel })).filter((x) => isFinite(x.eta) && x.eta < tRest + 6);
    if (!chegam.length) continue;
    const etaMin = Math.min(...chegam.map((x) => x.eta));
    const hpChegada = Math.max(0, e.hp - dpsIni * etaMin);
    const golpe = chegam.some((x) => golpePronto(P, x.c)) ? danoGolpear(P) : 0;
    const roubo = hpChegada <= chegam.reduce((s, x) => s + dpsDe(x.c) * 0.65, 0) * CF.roubo + golpe;
    const vNos = chegam.reduce((s, x) => s + valorCombate(x.c), 0), vIni = perto.reduce((s, c) => s + valorCombate(c), 0);
    const razao = vNos / Math.max(1, vIni);
    const atras = atraso(P, eq); const mental = chegam.reduce((s, x) => s + x.c.m.mental, 0) / chegam.length;
    const des = atras * (1 - mental) * P.regras.ia.desespero; const decisivo = e.subtipo === 'barao' || e.subtipo === 'anciao';
    const exigencia = CF.minimo * (1 - 0.35 * des) * (decisivo && atras > 0.5 ? 0.75 : 1);
    if (!roubo && razao < exigencia) continue;
    if (P.rng() < (1 - mac) * 0.25) continue; // Macro baixo: às vezes nem percebe a chance
    const nome = e.subtipo === 'anciao' ? 'dragao' : e.subtipo;
    P._contestados ||= new Set(); const chaveC = `${eq}:${e.id}`;
    if (!P._contestados.has(chaveC)) { P._contestados.add(chaveC); registrar(P, 'objetivo_contestado', { equipe: eq, objetivo: e.subtipo, roubo, razao: Math.round(razao * 100) / 100, participantes: chegam.map((x) => x.c.id) }); }
    return { id: ID(P), tipo: 'objetivo', objetivo: nome, covil: MUNDO_MAPA.covis.find((x) => x.id === (e.subtipo === 'barao' ? 'barao' : 'dragao')), pos: { x: e.x, y: e.y }, epicoId: e.id, estado: 'executando', desde: P.t, contest: true, roubo, participantes: chegam.map((x) => x.c.id) };
  }
  return null;
}
function proximoAlvoBase(P, eqInim) {
  const todas = P.estruturas.filter((e) => e.equipe === eqInim && !e.morto && P.estruturaVulneravel(e));
  const nex = MUNDO_MAPA.bases[outro(eqInim)].nexus;
  return todas.sort((a, b) => (b.subtipo === 'nexus') - (a.subtipo === 'nexus') || dist(a, nex) - dist(b, nex))[0] || null;
}

function escolherObjetivo(P, eq, conh, aliados) {
  const O = P.objetivosEstado; const R = P.regras.epicos; const M = pol(P, eq, 'objetivoMargem');
  const inim = outro(eq);
  const candidatos = [];
  const tryObj = (nome, epico, proximo, covilId, cedo = false) => {
    const c = MUNDO_MAPA.covis.find((x) => x.id === covilId);
    const aVivo = epico && !epico.morto;
    const FR = { ate: pol(P, eq, 'faseDeRotas.ate'), dragaoDesde: pol(P, eq, 'faseDeRotas.dragaoDesde'), arautoDesde: pol(P, eq, 'faseDeRotas.arautoDesde') }; // fase de rotas: laners farmando antes de ir aos primeiros objetivos
    if (P.t < FR.ate && ((nome === 'dragao' && P.t < FR.dragaoDesde) || (nome === 'arauto' && P.t < FR.arautoDesde))) return;
    const faltam = aVivo ? 0 : (proximo - P.t);
    if (!aVivo) {
      // sai com antecedência só o suficiente para chegar ao ponto de reunião (os que estão longe saem antes)
      const stg = stagingObjetivo(P, eq, c);
      const viagem = Math.max(0, ...aliados.map((x) => Math.hypot(x.x - stg.x, x.y - stg.y) * 1.3 / x.vel));
      if (faltam > Math.min(40, viagem + 4)) return;
    }
    // quem participa depende do objetivo e da fase: no início, só selva + rota de baixo (+ meio) no Dragão, e selva + topo + meio no Arauto
    let papeis = null, minimo = 4;
    if (nome === 'dragao' && P.t < 840) { papeis = ['selva', 'atirador', 'suporte']; minimo = 3; } // fase de rotas: o meio e o topo ficam farmando
    else if (nome === 'arauto') { papeis = ['selva', 'top', 'meio']; minimo = 3; }
    candidatos.push({ nome, epico: aVivo ? epico : null, covil: c, staging: stagingObjetivo(P, eq, c), cedo, minimo, participam: (x) => !papeis || papeis.includes(x.pos) });
  };
  tryObj('dragao', O.dragao.vivo, O.dragao.proximo, 'dragao');
  if (!O.arauto.aposentado) tryObj('arauto', O.arauto.vivo, O.arauto.proximo, 'barao', true);
  tryObj('barao', O.barao.vivo, O.barao.proximo, 'barao');
  const jan = janelaDeAbates(P, eq, 4); // segundos até o adversário voltar a ter 4 campeões (0 se já tem): depois de abates, dá para fazer um objetivo antes disso?
  let melhor = null, ms = -1;
  for (const c of candidatos) {
    // prioridade: Barão > Ancião/Dragão > Arauto, ponderada pela vantagem e pelo risco
    const base = c.nome === 'barao' ? 3 : c.nome === 'dragao' ? 2.2 : 1.6;
    const inimPerto = conh.filter((k) => dist(k, c.covil) < 2600);
    const vIni = inimPerto.reduce((s, k) => s + valorCombate(k.u), 0);
    const vivosIni = P.campeoes.filter((x) => x.equipe === inim && !x.morto).length;
    const part = aliados.filter((x) => hpPct(x) > 0.45 && c.participam(x));
    const vAli = part.reduce((s, x) => s + valorCombate(x), 0);
    const dps = part.reduce((s, x) => s + dpsDe(x) * 0.65, 0);
    const hp = c.epico ? c.epico.hp : P.regras.epicos[c.nome === 'dragao' ? 'dragao' : c.nome].hp;
    const tempo = hp / Math.max(1, dps);
    const limiteTempo = c.nome === 'barao' ? pol(P, eq, 'baraoLimite') : pol(P, eq, 'dragaoLimite');
    // Quem pode contestar: pensa no tempo que cada inimigo levaria para chegar (viagem do grupo + matar o monstro). Quem está longe demais não conta;
    // quem o time não vê conta pela última posição vista (Macro: quem lê o jogo supõe que ele se aproximou). Sem visão de ninguém é arriscado, mas possível.
    const viagemGrupo = part.length ? Math.max(...part.map((x) => { const d = P.nav.distancia(x.x, x.y, c.covil.x, c.covil.y, 'campeao'); return isFinite(d) ? d / x.vel : 0; })) : 0;
    const am = ameacaDeContestar(P, eq, c.covil, viagemGrupo + tempo, new Set(inimPerto.map((k) => k.u.id)));
    const risco = vIni / Math.max(1, vAli) + (am.valor / Math.max(1, vAli)) * (0.6 + 0.4 * macroDaEquipe(P, eq)) + (incerteza(P, eq) > 0.6 ? 0.08 : 0);
    let vantagemNum = part.length - vivosIni;
    let janelaServe = false;
    if (jan > 8 && part.length >= 3) {
      const viagem = Math.max(...part.map((x) => P.nav.distancia(x.x, x.y, c.covil.x, c.covil.y, 'campeao') / x.vel));
      janelaServe = isFinite(viagem) && viagem + tempo <= jan + 6;
      if (janelaServe) vantagemNum = Math.max(vantagemNum, 1);
    }
    // só vai quando: consegue matar a tempo e o risco é aceitável (ou o inimigo está morto/longe)
    if (part.length < Math.min(c.minimo, aliados.length) && !(vantagemNum >= 2 && part.length >= 3)) continue;
    if (tempo > limiteTempo) continue;
    if (risco > 1 / M && vantagemNum < 1) continue;
    if (c.nome === 'barao' && (P.t < pol(P, eq, 'baraoDesde') || (vantagemNum < 1 && risco > 0.6))) continue;
    // disputa pelo mesmo objetivo: se o inimigo já o está fazendo (visto perto e o monstro apanhando), só entra com vantagem
    const score = base * (1.2 - Math.min(1, risco)) + vantagemNum * 0.2 + (c.epico ? 0.4 : 0) + (janelaServe ? 0.6 : 0);
    if (score > ms) { ms = score; melhor = c; }
  }
  return melhor;
}

// ------------------------------------------------------------------ ações dos estados coletivos
export function agirObjetivo(P, u) {
  const pl = u.planoAlvo; if (!pl) { u.forcarDecisao = true; return; }
  const ctx = u.ctx || {};
  const ep = pl.epicoId ? porId(P, pl.epicoId) : null;
  if (pl.estado === 'reunindo' || !ep || ep.morto) {
    irPara(P, u, pl.pos.x, pl.pos.y, { tol: 260 });
    return;
  }
  // executando: ataca o objetivo a partir de uma posição válida
  const alc = u.alcance > 300 ? u.alcance * 0.85 : Math.max(100, u.alcance * 0.7);
  if (!podeAtacar(P, u, ep)) { irPara(P, u, ep.x, ep.y, { tol: alc }); }
  else parar(u);
  golpear(P, u, ep);
  usarHabilidades(P, u, ep, ctx);
  atacarBasico(P, u, ep);
}
export function agirEstrutura(P, u) {
  const pl = u.planoAlvo; if (!pl) { u.forcarDecisao = true; return; }
  const e = porId(P, pl.estrutura);
  const ctx = u.ctx || {};
  if (!e || e.morto || !P.estruturaVulneravel(e)) { u.forcarDecisao = true; return; }
  // só se aproxima quando há minions aliados para absorver os tiros (ou na finalização)
  const minAli = minionsPerto(P, u.equipe, e.x, e.y, 900, true);
  // investida final e pressão com o Barão: fica junto da onda aliada (sem minion perto a estrutura quase não toma dano e o buff do Barão se perde)
  if ((pl.barao || pl.tipo === 'finalizar') && e.subtipo !== 'nexus' && minAli < 2) {
    const rota = pl.rota || e.rota; const fr = rota ? frenteAliada(P, u.equipe, rota) : null;
    if (fr && dist(u, fr.m) < 3500) {
      const p = pontoNoProgresso(rota, u.equipe, fr.p + 140);
      if (dist(u, p) > 160) irPara(P, u, p.x, p.y, { tol: 100 }); else parar(u);
      atacarProximo(P, u, ctx); return;
    }
  }
  const seguro = pl.tipo === 'finalizar' || minAli >= 2;
  const alc = u.alcance > 300 ? u.alcance * 0.9 : 130;
  if (!seguro) { const p = posFarm(P, { ...u, rotaAtual: pl.rota, rota: pl.rota, pos: u.pos === 'suporte' ? 'top' : u.pos }); irPara(P, u, p.x, p.y, { tol: 120 }); atacarProximo(P, u, ctx); return; }
  if (!podeAtacar(P, u, e)) {
    // aproxima-se pelo lado da própria base
    const nex = MUNDO_MAPA.bases[u.equipe].nexus; const d = dist(e, nex) || 1; const k = (alc * 0.9 + (e.raio || 0)) / d;
    let px = e.x + (nex.x - e.x) * k, py = e.y + (nex.y - e.y) * k;
    if (!P.terreno.caminhavel(px, py, 'campeao')) { const q = P.terreno.maisProximo(px, py, 'campeao'); if (q) { px = q.x; py = q.y; } }
    irPara(P, u, px, py, { tol: 40 });
  } else parar(u);
  // minions inimigos e campeões próximos têm prioridade imediata sobre a estrutura
  let defensor = null, md = Infinity;
  P.indice.perto(u.x, u.y, u.alcance + 100, (m) => { if (m.morto || m.equipe === u.equipe || m.equipe === 'neutro' || m.tipo === 'estrutura' || !atacavel(P, m, u)) return; const d = dist(u, m) - (m.tipo === 'campeao' ? 200 : 0); if (d < md) { md = d; defensor = m; } });
  if (defensor && defensor.tipo === 'campeao') { usarHabilidades(P, u, defensor, ctx); atacarBasico(P, u, defensor); return; }
  usarHabilidades(P, u, e, ctx);
  atacarBasico(P, u, e);
}
function atacarProximo(P, u, ctx) {
  let a = null, md = Infinity;
  P.indice.perto(u.x, u.y, u.alcance + 80, (m) => { if (m.morto || m.equipe === u.equipe || m.equipe === 'neutro' || m.tipo === 'estrutura' || !atacavel(P, m, u)) return; const d = dist(u, m); if (d < md) { md = d; a = m; } });
  if (a) { usarHabilidades(P, u, a, ctx); atacarBasico(P, u, a); }
}
export function agirDefender(P, u) {
  const pl = u.planoAlvo; if (!pl) { u.forcarDecisao = true; return; }
  const ctx = u.ctx || {};
  const e = porId(P, pl.estrutura);
  // alvo: inimigo mais perto da estrutura (minions e campeões)
  let alvo = null, md = Infinity; const centro = e && !e.morto ? e : pl.pos;
  P.indice.perto(centro.x, centro.y, 1600, (m) => { if (m.morto || m.equipe === u.equipe || m.equipe === 'neutro' || m.tipo === 'estrutura' || !atacavel(P, m, u)) return; const d = dist(u, m) - (m.tipo === 'campeao' ? 400 : 0); if (d < md) { md = d; alvo = m; } });
  if (!alvo) { irPara(P, u, centro.x, centro.y, { tol: 500 }); return; }
  const alc = u.alcance > 300 ? u.alcance * 0.85 : 120;
  if (!podeAtacar(P, u, alvo)) irPara(P, u, alvo.x, alvo.y, { tol: alc }); else parar(u);
  usarHabilidades(P, u, alvo, ctx);
  atacarBasico(P, u, alvo);
}
export function agirAjudar(P, u) {
  const pl = u.planoAlvo; if (!pl) { u.forcarDecisao = true; return; }
  const ctx = u.ctx || {};
  const rota = pl.rota;
  const p = posFarm(P, { ...u, rotaAtual: rota, rota, pos: 'top' });
  irPara(P, u, p.x, p.y, { tol: 150 });
  atacarProximo(P, u, ctx);
}
