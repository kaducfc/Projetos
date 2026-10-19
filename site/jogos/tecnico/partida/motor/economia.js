// Ouro, experiência, níveis e itens da partida. Ouro e XP de partida valem só dentro da partida (não são RC nem créditos da organização).
import { ITENS } from '../dados/itens.js';
import { recalcular } from './entidades.js';
import { registrar } from './eventos.js';

export function darOuro(P, u, v) { if (!u || u.tipo !== 'campeao' || v <= 0) return; v *= P.regras.economia.escalaOuro; u.ouro += v; u.ouroTotal += v; }

export function darXp(P, u, v) {
  if (u.morto || v <= 0) return;
  const E = P.regras.economia;
  if (u.nivel >= E.nivelMax) return;
  u.xp += v * E.escalaXp;
  while (u.nivel < E.nivelMax && u.xp >= E.xpNivel[u.nivel]) {
    u.nivel++;
    recalcular(u, P);
    registrar(P, 'nivel', { equipe: u.equipe, campeao: u.id, nivel: u.nivel });
  }
}
const DIV = [1, 0.652, 0.55, 0.45, 0.38];
// Distribui XP de uma unidade que morreu entre os campeões aliados do vencedor ao redor dela.
export function xpDeUnidade(P, equipeVencedora, x, y, xp, killer) {
  const perto = P.campeoes.filter((c) => c.equipe === equipeVencedora && !c.morto && Math.hypot(c.x - x, c.y - y) <= P.regras.economia.raioXp);
  if (killer && killer.tipo === 'campeao' && !perto.includes(killer) && !killer.morto) perto.push(killer);
  if (!perto.length) return;
  const q = xp * (DIV[Math.min(perto.length, DIV.length) - 1]);
  for (const c of perto) darXp(P, c, q);
}

// Custo de um item para este campeão: os componentes que ele já tem (item.comp) saem do inventário e abatem o custo.
export function custoDe(u, id) {
  const it = ITENS[id]; let custo = it.custo; const remover = []; const inv = [...u.itens];
  for (const c of it.comp || []) { const i = inv.indexOf(c); if (i >= 0) { inv.splice(i, 1); custo -= ITENS[c].custo; remover.push(c); } }
  return { custo, remover };
}
// Compra: na fonte da base, comprando o próximo item da build que o ouro cobre.
export function comprar(P, u) {
  const build = u.perfil.build; let comprou = false;
  for (let guarda = 0; guarda < 4; guarda++) {
    const id = proximoItem(u, build);
    if (!id) break;
    const { custo, remover } = custoDe(u, id);
    if (u.ouro < custo || u.itens.length - remover.length + 1 > 6) break;
    u.ouro -= custo; u.estat.ouroGasto += custo;
    for (const c of remover) u.itens.splice(u.itens.indexOf(c), 1);
    u.itens.push(id); comprou = true;
    registrar(P, 'compra', { equipe: u.equipe, campeao: u.id, item: id, custo, itens: u.itens.length });
  }
  // Ward de Controle (não ocupa vaga de item): uma por vez, depois dos itens; suporte e caçador compram com mais frequência
  const W = P.regras.wards;
  if (W.ativo && u.wards && u.wards.controleEstoque === 0 && !P.wards.some((w) => !w.morto && w.dono === u.id && w.subtipo === 'controle')
      && u.ouro >= W.custoControle && (u.pos === 'suporte' || u.pos === 'selva' || u.ouro >= W.custoControle * 3 || (u.m.macro > 0.6 && u.ouro >= W.custoControle * 1.5))) {
    u.ouro -= W.custoControle; u.estat.ouroGasto += W.custoControle; u.wards.controleEstoque = 1; comprou = true;
    registrar(P, 'compra', { equipe: u.equipe, campeao: u.id, item: 'ward_controle', custo: W.custoControle, itens: u.itens.length });
  }
  if (comprou) recalcular(u, P);
  return comprou;
}
export function proximoItem(u, build) {
  for (const id of build) {
    const it = ITENS[id];
    if (it.restricao === 'uma_bota' && u.itens.some((x) => ITENS[x].restricao === 'uma_bota' && (x !== 'botas' || id === 'botas'))) continue;
    if (u.itens.filter((x) => x === id).length >= build.filter((x) => x === id).length) continue;
    if (u.itens.length - custoDe(u, id).remover.length >= 6) continue; // sem vaga
    return id;
  }
  return null;
}
// Custo do próximo item (para a IA decidir se vale voltar à base).
export function custoProximo(u) { const id = proximoItem(u, u.perfil.build); return id ? custoDe(u, id).custo : Infinity; }
