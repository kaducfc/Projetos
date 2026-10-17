// Fábricas das entidades da partida. Toda entidade é um objeto simples (sem classes) com posição em unidades de mundo.
import { MUNDO_MAPA } from '../nucleo/mapa-mundo.js';
import { parametrosDeAtributos } from '../config/atributos.js';
import { ITENS } from '../dados/itens.js';

export const novaId = (P) => ++P.proxId;

export function criarCampeao(P, jog, equipe, perfil) {
  const base = MUNDO_MAPA.bases[equipe];
  const R = P.regras;
  const u = {
    id: novaId(P), tipo: 'campeao', equipe, nome: jog.nome, jogadorId: jog.id, pos: jog.pos, rota: jog.pos === 'top' ? 'topo' : jog.pos === 'meio' ? 'meio' : jog.pos === 'selva' ? null : 'baixo',
    campeao: perfil.nome, perfil, atrib: jog.atributos || {}, poder: jog.poder ?? 50,
    m: parametrosDeAtributos(jog.atributos || {}, R), bonusMaestria: (jog.bonusMaestriaPct || 0) / 100,
    x: base.fonte.x, y: base.fonte.y, raio: R.campeao.raio, vel: 0, alcance: 0, aquisicao: R.campeao.aquisicao,
    nivel: 1, xp: 0, ouro: R.economia.ouroInicial, ouroTotal: R.economia.ouroInicial, itens: [], 
    hp: 1, hpMax: 1, mana: 1, manaMax: 1, ad: 0, ap: 0, armadura: 0, resist: 0, asExtra: 0, intervalo: 1.5, proximoAtaque: 0, cdr: 0, vampiro: 0,
    escudo: 0, escudoAte: 0, efeitos: [], buffs: [], ccRecente: [],
    morto: false, renasceEm: 0, mortoEm: 0, vivoDesde: 0,
    habilidades: perfil.habilidades.map((h) => ({ ...h, proximo: 0 })),
    estado: 'nascendo', estadoDesde: 0, alvoId: null, destino: null, caminho: null, motivo: '', planoId: null,
    proxDecisao: 0, proxRota: 0, replan: 0, preso: 0, recallAte: 0, recallInicio: 0,
    ultimoDano: -99, ultimoAtaqueChamp: -99, ultimosAtacantes: {}, agressoes: {},
    visto: {}, ganks: 0,
    estat: { abates: 0, mortes: 0, assist: 0, cs: 0, csSelva: 0, dano: 0, danoSofrido: 0, torres: 0, objetivos: 0, ouroGasto: 0, curado: 0 },
    jungle: { campoAtual: null, ordem: [], idx: 0 },
  };
  // eficiência do jogador (posição x estrelas de evolução): vale como multiplicador do desempenho geral
  u.eficiencia = jog.eficiencia ?? 1;
  u.m.forca *= u.eficiencia;
  recalcular(u, P, true);
  u.hp = u.hpMax; u.mana = u.manaMax;
  return u;
}

// Atributos do campeão = base do arquétipo + crescimento por nível + itens + buffs temporários.
export function recalcular(u, P, cheio = false) {
  const b = u.perfil.base; const L = u.nivel - 1;
  const cresc = (v, nv) => v + nv * L * (0.7025 + 0.0175 * L); // fórmula de crescimento do jogo
  let hp = cresc(b.hp, b.hpNv), mana = cresc(b.mana, b.manaNv), ad = cresc(b.ad, b.adNv), ap = 0, arm = cresc(b.armadura, b.armNv), res = cresc(b.resist, b.resNv);
  let asEx = b.asNv * L * 0.7025 * 100 / 100 * 1; // crescimento percentual de velocidade de ataque por nível
  asEx = b.asNv * L; let ms = b.vel, cdr = 0, vamp = 0;
  for (const id of u.itens) {
    const s = ITENS[id].stats;
    hp += s.hp || 0; mana += s.mana || 0; ad += s.ad || 0; ap += s.ap || 0; arm += s.armadura || 0; res += s.resist || 0; asEx += s.as || 0; ms += s.ms || 0; cdr += s.cdr || 0; vamp += s.vampiro || 0;
  }
  let mult = 1 + u.bonusMaestria * 0.5; // maestria do campeão: bônus pequeno e limitado de desempenho
  let danoMult = 1 + u.bonusMaestria;
  for (const bf of u.buffs) {
    if (bf.ate <= P.t) continue;
    if (bf.armadura) arm += bf.armadura; if (bf.resist) res += bf.resist; if (bf.as) asEx += bf.as; if (bf.vel) ms += bf.vel;
    if (bf.adPct) ad *= 1 + bf.adPct; if (bf.apPct) ap = ap * (1 + bf.apPct); if (bf.danoPct) danoMult += bf.danoPct; if (bf.cdr) cdr += bf.cdr;
    if (bf.ap) ap += bf.ap; if (bf.adFlat) ad += bf.adFlat;
  }
  // bônus de dragões (pilhas): dano e resistências permanentes pequenos
  const eq = P.equipes?.[u.equipe];
  if (eq) { danoMult += (eq.pilhasDragao || 0) * P.regras.epicos.dragao.pilha.dano; arm *= 1 + (eq.pilhasDragao || 0) * P.regras.epicos.dragao.pilha.resist; res *= 1 + (eq.pilhasDragao || 0) * P.regras.epicos.dragao.pilha.resist; }
  const hpAntes = u.hpMax; const manaAntes = u.manaMax;
  u.hpMax = Math.round(hp * mult); u.manaMax = Math.round(mana); u.ad = ad; u.ap = ap; u.armadura = arm; u.resist = res;
  u.asExtra = asEx; u.vel = ms * (u.slowPct ? 1 : 1); u.velBase = ms; u.cdr = Math.min(0.4, cdr); u.vampiro = vamp; u.danoMult = danoMult;
  u.alcance = b.alcance; u.intervalo = 1 / (b.as * (1 + asEx));
  if (!cheio) { u.hp = Math.min(u.hpMax, u.hp + Math.max(0, u.hpMax - hpAntes)); u.mana = Math.min(u.manaMax, u.mana + Math.max(0, u.manaMax - manaAntes)); }
  // rank das habilidades: Q/W/E sobem de 2 em 2 níveis (máx. 5); R com 6/11/16
  u.rank = { q: Math.min(5, Math.ceil(u.nivel / 2)), w: Math.min(5, Math.max(1, Math.ceil((u.nivel - 1) / 2))), e: Math.min(5, Math.max(1, Math.ceil((u.nivel - 1) / 2))), r: u.nivel >= 16 ? 3 : u.nivel >= 11 ? 2 : u.nivel >= 6 ? 1 : 0 };
}

export function criarMinion(P, subtipo, equipe, rota, s, origem = null) {
  const R = P.regras.minions; const d = R.tipos[subtipo];
  const lane = MUNDO_MAPA.rotas[rota];
  const idx = origem ? (equipe === 'azul' ? 0 : lane.pts.length - 1) : (equipe === 'azul' ? 1 : lane.pts.length - 2); // próximo ponto de passagem (nascendo no Nexus, o primeiro é o início da rota)
  const pos = origem || pontoDaRota(lane, s);
  const k = Math.floor(P.t / R.crescimentoCada);
  const f = (sub) => 1 + k * R.crescimento[sub];
  const buffB = null; // o buff do Barão agora é uma aura que depende da distância do campeão (atualizarAuraMinion)
  const u = {
    id: novaId(P), tipo: 'minion', subtipo, equipe, rota, x: pos.x, y: pos.y,
    hp: d.hp * f('hp') * (buffB ? 1 + buffB.hp : 1), hpMax: 0, dano: d.dano * f('dano') * (buffB ? 1 + buffB.dano : 1), armadura: d.armadura, resist: d.resist, vel: d.vel, alcance: d.alcance, intervalo: d.intervalo,
    raio: d.raio, proj: d.proj, ouro: d.ouro, xp: d.xp, aquisicao: R.aquisicao,
    idxWp: idx, proximoAtaque: P.t + 0.4, alvoId: null, alvoDesde: 0, destino: null, caminho: null, morto: false, ultimosAtacantes: {}, preso: 0, nascido: P.t, efeitos: [], escudo: 0,
    ult: { x: pos.x, y: pos.y, t: P.t },
  };
  u.hpMax = u.hp;
  return u;
}
export function pontoDaRota(lane, s) {
  let d = s;
  for (let i = 0; i < lane.pts.length - 1; i++) {
    const a = lane.pts[i], b = lane.pts[i + 1]; const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= seg) { const t = seg ? d / seg : 0; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    d -= seg;
  }
  const f = lane.pts[lane.pts.length - 1]; return { x: f.x, y: f.y };
}

export function criarEstrutura(P, def) {
  const R = P.regras.estruturas;
  let d;
  if (def.tipo === 'torre') d = R.torre[def.nivel];
  else if (def.tipo === 'inibidor') d = { hp: R.inibidor.hp, armadura: R.inibidor.armadura, resist: R.inibidor.resist, alcance: 0, dano: 0, intervalo: 1 };
  else d = { hp: R.nexus.hp, armadura: R.nexus.armadura, resist: R.nexus.resist, alcance: 0, dano: 0, intervalo: 1 };
  return {
    id: def.id, tipo: 'estrutura', subtipo: def.tipo, nivel: def.nivel || 0, rota: def.rota || null, equipe: def.equipe, x: def.x, y: def.y,
    hp: d.hp, hpMax: d.hp, armadura: d.armadura, resist: d.resist, alcance: d.alcance, dano: d.dano, intervalo: d.intervalo,
    raio: def.tipo === 'nexus' ? R.nexus.raio : def.tipo === 'inibidor' ? R.inibidor.raio : 90,
    proximoAtaque: 0, alvoId: null, pilha: 0, ultimoAlvo: null, morto: false, renasceEm: 0, ultimosAtacantes: {}, efeitos: [], escudo: 0, destruidaEm: null,
  };
}
export const rotuloEstrutura = (e) => (e.subtipo === 'torre' ? (e.nivel === 4 ? 'Torre do Nexus' : `Torre ${e.nivel} · ${e.rota}`) : e.subtipo === 'inibidor' ? `Inibidor · ${e.rota}` : 'Nexus');
