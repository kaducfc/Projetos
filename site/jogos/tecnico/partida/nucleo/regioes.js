// Identificação de regiões: em que rota, base, selva ou rio uma posição está.
import { T, NOME_TIPO } from './terreno.js';
import { MUNDO_MAPA } from './mapa-mundo.js';
import { projetarNaPolilinha, dist } from './coord.js';

const meio = MUNDO_MAPA.rotas.meio.pts;
const A = meio[0], B = meio[meio.length - 1];
// Lado da diagonal do meio: > 0 = lado do topo (acima/esquerda), < 0 = lado de baixo.
export const ladoDoMeio = (p) => Math.sign((B.x - A.x) * (A.y - p.y) - (B.y - A.y) * (A.x - p.x)) || 1;

export function rotaMaisProxima(p) {
  let melhor = null, md = Infinity;
  for (const r of Object.values(MUNDO_MAPA.rotas)) {
    const pr = projetarNaPolilinha(r.pts, p);
    if (pr.d < md) { md = pr.d; melhor = { id: r.id, s: pr.s, d: pr.d, frac: pr.s / r.comprimento }; }
  }
  return melhor;
}
// { tipo, rota?, lado?, zona? }  zona = 'topo' | 'baixo' para a selva; lado = equipe dona da região (a base ou a metade do mapa).
export function regiaoDe(terreno, x, y) {
  const t = terreno.tipoEm(x, y);
  const p = { x, y };
  const r = { tipo: NOME_TIPO[t] };
  const dAz = dist(p, MUNDO_MAPA.bases.azul.nexus), dVm = dist(p, MUNDO_MAPA.bases.vermelho.nexus);
  r.lado = dAz <= dVm ? 'azul' : 'vermelho';
  if (t === T.ROTA || t === T.BASE) { const rt = rotaMaisProxima(p); r.rota = rt.id; r.frac = rt.frac; }
  if (t === T.SELVA || t === T.ACAMP || t === T.RIO || t === T.COVIL) r.zona = ladoDoMeio(p) > 0 ? 'topo' : 'baixo';
  return r;
}
