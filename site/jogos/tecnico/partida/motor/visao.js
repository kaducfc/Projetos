// Visão simplificada (sem wards): cada equipe só "conhece" os inimigos vistos por aliados (campeões, minions e torres) ou vistos recentemente.
// A IA usa `conhecidos` e nunca a posição real de inimigos fora de visão.
import { dist } from '../nucleo/coord.js';

export function atualizarVisao(P) {
  for (const eq of ['azul', 'vermelho']) {
    const E = P.equipes[eq]; const vis = E.visao;
    const fontes = [];
    for (const c of P.campeoes) if (c.equipe === eq && !c.morto) fontes.push([c, P.regras.campeao.visao]);
    for (const m of P.minions) if (m.equipe === eq && !m.morto) fontes.push([m, 900]);
    for (const e of P.estruturas) if (e.equipe === eq && !e.morto && e.subtipo !== 'inibidor') fontes.push([e, e.subtipo === 'nexus' ? 1400 : 1100]);
    for (const c of P.campeoes) {
      if (c.equipe === eq || c.morto) continue;
      let visto = false;
      for (const [f, r] of fontes) { if (Math.abs(f.x - c.x) < r && Math.abs(f.y - c.y) < r && dist(f, c) <= r) { visto = true; break; } }
      if (visto) vis[c.id] = { x: c.x, y: c.y, t: P.t, visivel: true, hp: c.hp / c.hpMax };
      else if (vis[c.id]) vis[c.id].visivel = false;
    }
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
