// Janelas de oportunidade: a equipe avalia, com o que sabe do estado da partida, se existe um caminho curto para ACABAR o jogo (derrubar o Nexus)
// antes de o adversário se reorganizar, e o mesmo olhar serve para a defesa (o que o adversário poderia fazer contra ela).
//
// O objetivo do jogo é o Nexus, não "todas as torres e todos os inibidores": o caminho mais curto passa por UMA rota (3 torres e o inibidor),
// pelas torres do Nexus e pelo Nexus. Se um inibidor já caiu, a rota dele já está aberta e só faltam as torres do Nexus e o Nexus.
//
// Tudo aqui é leitura do estado: nada é alterado. As decisões que usam isto estão em estrategia.js (planos) e campeao-ia.js.
import { MUNDO_MAPA, outro, ROTAS } from '../nucleo/mapa-mundo.js';
import { dpsDe, valorCombate } from './percepcao.js';
import { hpPct } from './combate.js';
import { pol } from './inteligencia.js';

const VIAGEM_RENASCER = 9; // segundos entre renascer na fonte e chegar a uma luta (além da distância)

// Valor de combate mesmo para quem está morto (para contar quem volta a tempo).
const valorMesmoMorto = (c) => (c.morto ? valorCombate({ ...c, morto: false }) : valorCombate(c));

export const buffBaraoDe = (P, eq) => { const b = P.equipes[eq].buffBarao; return b && P.t < b.ate ? b.ate - P.t : 0; };

// Campeões da equipe que podem participar de uma investida: vivos e com vida acima do mínimo.
export function aptos(P, eq, hpMin) { return P.campeoes.filter((c) => c.equipe === eq && !c.morto && hpPct(c) >= hpMin); }

// Tempo (s) até cada campeão inimigo estar de volta ao combate perto de um ponto: vivo = distância; morto = renascimento + viagem desde a fonte.
function chegadas(P, eq, ponto) {
  const fonte = MUNDO_MAPA.bases[eq].fonte;
  return P.campeoes.filter((c) => c.equipe === eq).map((c) => {
    const o = c.morto ? fonte : c; const rest = c.morto ? Math.max(0, c.renasceEm - P.t) + VIAGEM_RENASCER : 0;
    return { c, t: rest + (Math.hypot(o.x - ponto.x, o.y - ponto.y) * 1.25) / Math.max(250, c.vel || 340), morto: c.morto };
  });
}

// Estruturas do adversário que precisam cair, em ordem, para o ataque que passa pela rota `rota` chegar ao Nexus.
// Se algum inibidor já está caído (e vai demorar a renascer), o caminho é por ele: só faltam as torres do Nexus e o Nexus.
export function cadeiaDeVitoria(P, atacante, rota) {
  const inim = outro(atacante);
  const est = P.estruturas.filter((e) => e.equipe === inim);
  const nex = est.find((e) => e.subtipo === 'nexus');
  const torresNexus = est.filter((e) => e.subtipo === 'torre' && e.nivel === 4 && !e.morto);
  const aberto = est.find((e) => e.subtipo === 'inibidor' && e.morto && e.renasceEm - P.t > 20);
  const lista = [];
  let rotaFinal = rota;
  if (aberto) rotaFinal = aberto.rota;
  else {
    for (let n = 1; n <= 3; n++) { const t = est.find((e) => e.subtipo === 'torre' && e.rota === rota && e.nivel === n); if (t && !t.morto) lista.push(t); }
    const ib = est.find((e) => e.subtipo === 'inibidor' && e.rota === rota); if (ib && !ib.morto) lista.push(ib);
  }
  // as torres do Nexus só ficam vulneráveis depois de um inibidor caído; entram na cadeia em ordem de proximidade da rota final
  const ref = lista[lista.length - 1] || est.find((e) => e.subtipo === 'inibidor' && e.rota === rotaFinal) || nex;
  torresNexus.sort((a, b) => Math.hypot(a.x - ref.x, a.y - ref.y) - Math.hypot(b.x - ref.x, b.y - ref.y));
  for (const t of torresNexus) lista.push(t);
  if (nex && !nex.morto) lista.push(nex);
  return { rota: rotaFinal, estruturas: lista, aberto: !!aberto };
}

// Quanto da potência dos campeões vira dano na estrutura: sem minion aliado por perto o dano cai (regras.estruturas.sentinela); ondas na rota ajudam.
function fatorMinions(P, eq, rota) {
  const n = P.minions.reduce((s, m) => s + (!m.morto && m.equipe === eq && m.rota === rota ? 1 : 0), 0);
  const sent = P.regras.estruturas.sentinela;
  return sent + (1 - sent) * Math.min(1, n / 4);
}

function tempoDaCadeia(P, eq, ch, atac) {
  if (!atac.length || !ch.estruturas.length) return Infinity;
  const v = atac.reduce((s, c) => s + c.vel, 0) / atac.length || 340;
  const cx = atac.reduce((s, c) => s + c.x, 0) / atac.length, cy = atac.reduce((s, c) => s + c.y, 0) / atac.length;
  const dps = atac.reduce((s, c) => s + dpsDe(c), 0) * 0.8 * fatorMinions(P, eq, ch.rota);
  let t = 0, pos = { x: cx, y: cy };
  for (const s of ch.estruturas) {
    t += (Math.hypot(s.x - pos.x, s.y - pos.y) * 1.25) / v + 3;
    pos = s;
    t += s.hp / Math.max(1, dps * (100 / (100 + (s.armadura || 0))));
  }
  return t;
}

// Avalia a investida final da equipe `eq` contra `outro(eq)`. `opc.ameaca`: leitura mais tolerante, usada pela defesa do alvo (antecipa o adversário).
// Devolve { comprometer, urgente, rota, alvo, tempo, razao, mortos, barao, motivo }.
export function janelaOfensiva(P, eq, opc = {}) {
  const inim = outro(eq); const E = P.equipes[eq];
  const tol = opc.ameaca ? 1.25 : 1;
  const mem = !!(E.finalizando && P.t - E.finalizando.desde < pol(P, eq, 'janela.memoria') && !opc.ameaca); // já decidiu e está indo: tolera mais para não desistir no meio
  const memF = mem ? 1.3 : 1;
  const hpMin = opc.ameaca ? 0.15 : pol(P, eq, 'janela.hpMin');
  const atac = aptos(P, eq, hpMin);
  const mortosIni = P.campeoes.filter((c) => c.equipe === inim && c.morto && c.renasceEm - P.t > 6).length;
  const barao = buffBaraoDe(P, eq);
  const regraBarao = barao > 0 && mortosIni >= pol(P, eq, 'janela.baraoMortos');
  const vazio = { comprometer: false, urgente: false, rota: null, alvo: null, tempo: Infinity, razao: 0, mortos: mortosIni, barao: barao > 0, motivo: '' };
  if (atac.length < (regraBarao || mem ? 2 : 3)) return vazio;
  // melhor rota: a de menor tempo total
  let melhor = null;
  for (const r of ROTAS) {
    const ch = cadeiaDeVitoria(P, eq, r); if (!ch.estruturas.length) continue;
    const T = tempoDaCadeia(P, eq, ch, atac);
    if (!melhor || T < melhor.T) melhor = { ch, T };
  }
  if (!melhor || !isFinite(melhor.T)) return vazio;
  const { ch, T } = melhor;
  const alvo = ch.estruturas.find((s) => P.estruturaVulneravel(s)) || null;
  if (!alvo) return vazio;
  // defensores que chegam antes de a investida terminar (os mortos contam quando renascem a tempo)
  const nexus = ch.estruturas[ch.estruturas.length - 1];
  const cheg = chegadas(P, inim, nexus).filter((x) => x.t <= T * 0.75);
  const vIni = cheg.reduce((s, x) => s + valorMesmoMorto(x.c), 0);
  const vMeu = atac.reduce((s, c) => s + valorCombate(c) * (0.6 + 0.4 * hpPct(c)), 0);
  const razao = vIni > 0 ? vMeu / vIni : 9;
  const nexusExposto = !P.estruturas.some((e) => e.equipe === inim && e.subtipo === 'torre' && e.nivel === 4 && !e.morto);
  const tMax = (barao > 0 ? Math.min(barao + 10, pol(P, eq, 'janela.tempoMaxBarao')) : pol(P, eq, 'janela.tempoMax')) * tol * memF + (nexusExposto ? 25 : 0);
  const razaoMin = (barao > 0 ? pol(P, eq, 'janela.razaoBarao') : pol(P, eq, 'janela.razaoMin')) / tol / memF * (nexusExposto ? 0.8 : 1);
  const poucosDefensores = cheg.length <= 1 && atac.length >= 2;
  // vantagem numérica real na hora de acabar (quem chega a tempo para defender já descontado); com o Barão basta 1 a mais
  const vant = atac.length - cheg.length; const vantMin = (barao > 0 ? 1 : 2) - (mem ? 1 : 0);
  const minions = fatorMinions(P, eq, ch.rota); // poucos minions na rota: as torres cobram caro, exige mais folga
  let ok = P.t >= 420 && T <= tMax && (poucosDefensores || (vant >= vantMin && razao >= razaoMin * (minions < 0.6 ? 1.3 : 1)));
  // regra explícita: com o Barão e 3+ inimigos mortos, o time tenta acabar com o jogo (se der tempo)
  if (!ok && regraBarao && T <= tMax * 1.15 && razao >= 0.4) ok = true;
  const urgente = ok && (T <= 45 || regraBarao || nexusExposto || mortosIni >= 3);
  const motivo = !ok ? '' : regraBarao ? 'Barão com ' + mortosIni + ' inimigos mortos' : nexusExposto ? 'Nexus exposto' : mortosIni >= 2 ? mortosIni + ' inimigos mortos' : poucosDefensores ? 'inimigos longe' : 'vantagem para acabar';
  return { comprometer: ok, urgente, rota: ch.rota, alvo, tempo: T, razao, mortos: mortosIni, barao: barao > 0, motivo, caminho: ch.estruturas.length };
}

// Tempo (s) até o adversário voltar a ter `n` campeões vivos; 0 se já tem. Usado para decidir se dá tempo de um objetivo/torre depois de abates.
export function janelaDeAbates(P, eq, n = 4) {
  const rest = P.campeoes.filter((c) => c.equipe === outro(eq)).map((c) => (c.morto ? Math.max(0, c.renasceEm - P.t) : 0)).sort((a, b) => a - b);
  return rest[Math.min(n, rest.length) - 1] ?? 0;
}
