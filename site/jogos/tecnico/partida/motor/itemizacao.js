// Itemização situacional: o jogador monta a build olhando o time inimigo (dano físico x mágico, quantos tanques, quem está forte).
// Cada vaga flexível do modelo (dados/itemizacao.js) é decidida quando chega a vez de comprar; depois de comprada, fica fixa.
import { ITENS } from '../dados/itens.js';
import { MODELOS, POOLS, estiloNaPosicao } from '../dados/itemizacao.js';
import { CATEGORIA_DO_ESTILO } from '../config/papeis.js';

const SHARE_AP = { ap: 1, ad: 0, hibrido: 0.5, tank: 0.2, suporte: 0.5 };
const TANQUE = { tanque: 1, tanque_ap: 1, lutador_tank: 0.7, suporte_tank: 0.6 };

// Leitura do time inimigo: parcela do dano mágico e físico (inimigos com mais abates pesam mais), fração de tanques e defesas médias.
export function analisarInimigos(P, u) {
  const ini = (P.campeoes || []).filter((c) => c.equipe !== u.equipe && c.perfil);
  if (!ini.length) return { n: 0, ap: 0.5, ad: 0.5, tankFrac: 0, armMed: 0, resMed: 0, assassinos: 0 };
  let ap = 0; let ad = 0; let tot = 0; let tank = 0; let arm = 0; let res = 0; let ass = 0;
  for (const c of ini) {
    const cat = c.perfil.papel; const est = c.perfil.estilo;
    const peso = (cat === 'tank' || cat === 'suporte' ? 0.55 : 1) * (1 + Math.min(1, (c.estat?.abates || 0) / 6) * 0.6);
    const sa = est === 'tanque_ap' ? 0.8 : est === 'encantador' ? 0.6 : (SHARE_AP[cat] ?? 0.5);
    ap += peso * sa; ad += peso * (1 - sa); tot += peso; tank += TANQUE[est] || 0; arm += c.armadura || 0; res += c.resist || 0;
    if (est === 'assassino_ad' || est === 'assassino_ap') ass++;
  }
  return { n: ini.length, ap: ap / tot, ad: ad / tot, tankFrac: tank / ini.length, armMed: arm / ini.length, resMed: res / ini.length, assassinos: ass };
}

const RESERVA = ['anjo', 'maw', 'sterak', 'danca', 'gume_noite', 'zhonya', 'veu', 'randuin', 'sunfire', 'warmog']; // se o item pedido repetir um que já está na build
const estiloDe = (u) => estiloNaPosicao(u.perfil.estilo, u.pos);
const somaStat = (u, k) => u.itens.reduce((s, id) => s + (ITENS[id].stats[k] || 0), 0);
const pct = (x) => `${Math.round(x * 100)}%`;

function botaSituacional(est, cat, padrao, A) {
  const defensivo = ['tanque', 'tanque_ap', 'lutador_tank', 'suporte_tank', 'encantador'].includes(est);
  const lim = defensivo ? 0.62 : 0.78;
  if (A.ad >= lim) return { id: 'botas_arm', motivo: `time inimigo com ${pct(A.ad)} de dano físico` };
  if (A.ap >= lim) return { id: 'botas_mr', motivo: `time inimigo com ${pct(A.ap)} de dano mágico` };
  return { id: padrao };
}

function defesaSituacional(u, A, pool, padrao, fora) {
  const arm = somaStat(u, 'armadura'); const res = somaStat(u, 'resist');
  const aw = (A.n ? A.ad : 0.5) / (1 + arm / 120); const mw = (A.n ? A.ap : 0.5) / (1 + res / 120);
  let melhor = null; let nota = -1;
  for (const id of pool) {
    if (fora.has(id)) continue;
    const s = ITENS[id].stats; const v = ((s.armadura || 0) * aw + (s.resist || 0) * mw + (s.hp || 0) * 0.04 + (s.cdr || 0) * 40) / ITENS[id].custo * 1000;
    if (v > nota) { nota = v; melhor = id; }
  }
  if (!melhor) return { id: padrao };
  const s = ITENS[melhor].stats; const motivo = A.n ? (aw >= mw * 1.3 && s.armadura ? `muito dano físico no time inimigo (${pct(A.ad)})` : mw >= aw * 1.3 && s.resist ? `muito dano mágico no time inimigo (${pct(A.ap)})` : 'dano misto no time inimigo') : null;
  return { id: melhor, motivo: melhor === padrao ? null : motivo };
}

function penetracao(est, cat, A, padrao, fora) {
  const tanky = A.n && (A.tankFrac >= 0.4 || (cat === 'ap' ? A.resMed >= 100 : A.armMed >= 110));
  if (!tanky) return { id: padrao };
  const pool = cat === 'ap' ? POOLS.penAP : (est === 'assassino_ad' ? POOLS.penAD.assassino : ['lutador_crit', 'atirador', 'atirador_onhit'].includes(est) ? POOLS.penAD.crit : POOLS.penAD.padrao);
  const id = pool.find((x) => !fora.has(x));
  return id ? { id, motivo: `${Math.round(A.tankFrac * A.n)} tanque(s) no time inimigo: penetração de ${cat === 'ap' ? 'resistência mágica' : 'armadura'}` } : { id: padrao };
}

function sobrevivencia(cat, A, padrao, fora) {
  if (!A.n) return { id: padrao };
  const ap = cat === 'ap' || cat === 'hibrido' ? POOLS.survAP : POOLS.survAD;
  const lim = 0.6;
  const lista = A.ad >= lim ? ap.contraAD : A.ap >= lim ? ap.contraAP : null;
  if (!lista) return { id: padrao };
  const id = lista.find((x) => !fora.has(x));
  return id ? { id, motivo: A.ad >= lim ? `muito dano físico no time inimigo (${pct(A.ad)})` : `muito dano mágico no time inimigo (${pct(A.ap)})` } : { id: padrao };
}

// Lista concreta de itens (ids) para este campeão agora. Itens já comprados em vagas flexíveis ficam fixos em u.buildFixo.
export function construirBuild(P, u) {
  const est = estiloDe(u); const modelo = MODELOS[est];
  if (!modelo) return u.perfil.build;
  const A = analisarInimigos(P, u); const cat = CATEGORIA_DO_ESTILO[est] || 'ad';
  u.buildFixo = u.buildFixo || []; u.buildMotivo = u.buildMotivo || {};
  const fora = new Set([...u.itens, ...modelo.filter((x) => !x.startsWith('?')), ...u.buildFixo.filter(Boolean)]);
  const lista = [];
  modelo.forEach((e, i) => {
    if (u.buildFixo[i]) { lista.push(u.buildFixo[i]); return; }
    if (!e.startsWith('?')) { lista.push(e); return; }
    const [tipo, padrao] = e.slice(1).split(':');
    let r;
    if (tipo === 'bota') r = botaSituacional(est, cat, padrao, A);
    else if (tipo === 'def') r = defesaSituacional(u, A, POOLS.def, padrao, fora);
    else if (tipo === 'defs') r = defesaSituacional(u, A, POOLS.defs, padrao, fora);
    else if (tipo === 'pen') r = penetracao(est, cat, A, padrao, fora);
    else r = sobrevivencia(cat, A, padrao, fora);
    let id = fora.has(r.id) ? padrao : r.id; // o item escolhido já está na build ou no inventário: volta ao padrão
    if (fora.has(id)) id = (tipo === 'def' || tipo === 'defs' ? defesaSituacional(u, A, tipo === 'def' ? POOLS.def : POOLS.defs, padrao, fora).id : null) || RESERVA.find((x) => !fora.has(x));
    if (fora.has(id)) id = RESERVA.concat(Object.keys(ITENS)).find((x) => !fora.has(x) && ITENS[x].categoria !== 'botas');
    fora.add(id); lista.push(id);
    if (id !== padrao && r.motivo) u.buildMotivo[id] = r.motivo; else delete u.buildMotivo[id];
  });
  return lista;
}
// Depois de comprar `id` (lista = a build usada na compra), a vaga flexível que ele ocupa passa a ser fixa.
export function fixarCompra(u, lista, id) {
  const modelo = MODELOS[estiloDe(u)]; if (!modelo) return;
  u.buildFixo = u.buildFixo || [];
  const i = lista.findIndex((x, k) => x === id && !u.buildFixo[k] && modelo[k].startsWith('?'));
  if (i >= 0) u.buildFixo[i] = id;
}
