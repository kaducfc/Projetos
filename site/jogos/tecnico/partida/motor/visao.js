// Visão e fog: cada equipe só "conhece" os inimigos vistos por aliados (campeões, minions, torres e wards) ou vistos recentemente.
// Regras de ocultação (as únicas que escondem uma unidade; fora delas a visão é a de antes):
//   * Moita: quem está dentro só é visto por inimigos que também estão dentro da mesma moita (campeão, minion ou ward). Atacar ou lançar
//     uma habilidade revela o campeão por `wards.revelaAoAtacar` segundos.
//   * Ward inimiga: só é vista com uma Ward de Controle da equipe por perto (raio `wards.controleRaio`) ou depois de revelada.
// A IA usa `conhecidos` e nunca a posição real de inimigos fora de visão.
import { dist } from '../nucleo/coord.js';

// Fontes de visão de uma equipe: [{ x, y, r, moita? (id da moita onde está), tipo }]
export function fontesDeVisao(P, eq) {
  const fontes = [];
  for (const c of P.campeoes) if (c.equipe === eq && !c.morto) fontes.push({ x: c.x, y: c.y, r: P.regras.campeao.visao, tipo: 'campeao' });
  for (const m of P.minions) if (m.equipe === eq && !m.morto) fontes.push({ x: m.x, y: m.y, r: 900, tipo: 'minion' });
  for (const e of P.estruturas) if (e.equipe === eq && !e.morto && e.subtipo !== 'inibidor') fontes.push({ x: e.x, y: e.y, r: e.subtipo === 'nexus' ? 1400 : 1100, tipo: 'estrutura' });
  for (const w of P.wards) if (w.equipe === eq && !w.morto) fontes.push({ x: w.x, y: w.y, r: w.raio, tipo: 'ward', subtipo: w.subtipo });
  return fontes;
}
// Esta unidade (de outra equipe) é visível para `eq` considerando só moitas e wards (sem alcance de visão)?
export function visivelPara(P, eq, a) {
  if (!a || a.equipe === eq || a.tipo === 'estrutura') return true;
  if (a.reveladoAte && a.reveladoAte > P.t) return true;
  if (a.tipo === 'ward') return controleCobre(P, eq, a);
  if (a.tipo !== 'campeao' && a.tipo !== 'minion') return true;
  const m = P.terreno.moitaEm(a.x, a.y);
  if (!m) return true;
  return P.equipes[eq].moitasVistas.has(m);
}
export function controleCobre(P, eq, w) {
  for (const o of P.wards) if (!o.morto && o.equipe === eq && o.subtipo === 'controle' && dist(o, w) <= P.regras.wards.controleRaio) return true;
  return false;
}

export function atualizarVisao(P) {
  for (const eq of ['azul', 'vermelho']) {
    const E = P.equipes[eq]; const vis = E.visao;
    const fontes = fontesDeVisao(P, eq);
    // moitas em que a equipe tem alguém (campeão, minion ou ward): o interior dessas moitas fica visível
    const mv = new Set();
    for (const f of fontes) { if (f.tipo === 'estrutura') continue; const m = P.terreno.moitaEm(f.x, f.y); if (m) mv.add(m); }
    E.moitasVistas = mv; E.fontes = fontes;
    for (const c of P.campeoes) {
      if (c.equipe === eq || c.morto) continue;
      let visto = false;
      if (visivelPara(P, eq, c)) for (const f of fontes) { if (Math.abs(f.x - c.x) < f.r && Math.abs(f.y - c.y) < f.r && dist(f, c) <= f.r) { visto = true; break; } }
      if (visto) vis[c.id] = { x: c.x, y: c.y, t: P.t, visivel: true, hp: c.hp / c.hpMax };
      else if (vis[c.id]) vis[c.id].visivel = false;
    }
    // wards inimigas reveladas por uma Ward de Controle
    for (const w of P.wards) { if (w.equipe === eq || w.morto) continue; w.reveladaPara = w.reveladaPara || {}; w.reveladaPara[eq] = controleCobre(P, eq, w); }
  }
}
// Inimigos que a equipe conhece: visíveis agora, ou vistos há menos de `persistencia` segundos (com a última posição).
export function conhecidos(P, equipe, persistencia = P.regras.ia.visaoPersistencia) {
  const vis = P.equipes[equipe].visao; const out = [];
  for (const c of P.campeoes) {
    if (c.equipe === equipe || c.morto) continue;
    const v = vis[c.id]; if (!v) continue;
    if (v.visivel || P.t - v.t <= persistencia) out.push({ u: c, x: v.visivel ? c.x : v.x, y: v.visivel ? c.y : v.y, visivel: v.visivel, t: v.t, hp: v.visivel ? c.hp / c.hpMax : v.hp });
  }
  return out;
}
// Wards inimigas que a equipe enxerga agora (reveladas por uma Ward de Controle).
export function wardsInimigasVistas(P, equipe) { return P.wards.filter((w) => !w.morto && w.equipe !== equipe && w.reveladaPara && w.reveladaPara[equipe]); }
