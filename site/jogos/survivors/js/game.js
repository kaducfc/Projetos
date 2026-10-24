// Rift Survivors: simulação. Sem DOM: recebe o estado e o dt e muda o estado (testável no Node).
import { CAMPEOES, ARMAS, ITENS, NIVEL_MAX_ITEM, MAX_ARMAS, MAX_ITENS, MAX_INIMIGOS, INIMIGOS, CHEFES, MISTURA, xpProximo, escalaVida, escalaDano, taxaSpawn, REINOS, RARIDADES, MALDICOES, MAX_MALDICOES, REROLAGENS, BANIMENTOS, COMBOS, JANELA_COMBO, EVOLUCOES } from './data.js';

export function criarRng(semente) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TAU = Math.PI * 2;
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export function criarJogo({ campeao = 'garen', meta = {}, semente = Date.now(), vista = { w: 384, h: 216 }, reino = 'ixtal' } = {}) {
  const c = CAMPEOES.find((x) => x.id === campeao) || CAMPEOES[0];
  const mel = meta.melhorias || {};
  const S = {
    reino: REINOS[reino] ? reino : 'ixtal', R: REINOS[reino] || REINOS.ixtal, marcas: [],
    rng: criarRng(semente), t: 0, estado: 'jogando', campeao: c.id, vista, meta: mel,
    p: { x: 0, y: 0, dx: 1, dy: 0, mx: 0, my: 0, hp: 1, hpMax: 1, raio: 5, inv: 0, flash: 0, andando: false, lean: 0, corre: false, dist: 0, passo: 0, pe: 1, face: 1, alvoX: 0, ataque: 0, ataqueCd: 0, especial: 0, espCd: 3, espT: 0, nivelAnim: 0 },
    inim: [], proj: [], eproj: [], gemas: [], itens: [], textos: [], efeitos: [], zonas: [], raios: [],
    armas: [], passivas: {}, nivel: 1, xp: 0, xpProx: xpProximo(1), pendentes: 0, opcoes: null,
    abates: 0, ouro: 0, spawnAc: 0, proxId: 1, onda: 1, chefes: {}, chefeVivo: null, revive: !!mel.revive, reviveu: false,
    infinito: false, evt: [], shake: 0, base: c,
    part: [], fant: [], pegadas: [],
    pot: {}, maldicoes: [], reroll: REROLAGENS, ban: BANIMENTOS, banidos: new Set(), combo: { n: 0, t: -99, max: 0 }, evolucoes: [],
  };
  adicionarArma(S, c.arma);
  recalcular(S);
  S.p.hp = S.p.hpMax;
  return S;
}

// Partículas: só visual. Usam Math.random (não mexem no gerador da simulação).
export function chispas(S, x, y, n, o = {}) {
  const { cor = '#fff6c0', vel = 50, vida = 0.35, tam = 1, grav = 0, brilho = true, dir = null, abre = Math.PI * 2 } = o;
  for (let i = 0; i < n && S.part.length < 420; i++) {
    const a = (dir == null ? Math.random() * Math.PI * 2 : dir + (Math.random() - 0.5) * abre); const v = vel * (0.4 + Math.random() * 0.8);
    S.part.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: vida * (0.6 + Math.random() * 0.6), d: vida, cor, tam, grav, brilho });
  }
}
// Atributos derivados (base do campeão + itens + melhorias da loja).
export function recalcular(S) {
  const c = S.base; const m = S.meta;
  const n = (id) => S.pot[id] ?? S.passivas[id] ?? 0; // com raridade, o item vale mais que o nível
  const cm = { dano: 0, area: 0, recarga: 0, hp: 1, cura: 1, semRegen: false, inimVel: 1, inimVida: 1, ouro: 0, xp: 0, qtd: 0, spawn: 1 };
  for (const id of S.maldicoes) { const x = MALDICOES[id].mod; cm.dano += x.dano || 0; cm.area += x.area || 0; cm.recarga += x.recarga || 0; cm.hp *= x.hp || 1; cm.cura *= x.cura || 1; cm.semRegen ||= !!x.semRegen; cm.inimVel *= x.inimVel || 1; cm.inimVida *= x.inimVida || 1; cm.ouro += x.ouro || 0; cm.xp += x.xp || 0; cm.qtd += x.qtd || 0; cm.spawn *= x.spawn || 1; }
  S.cm = cm;
  const hpAntes = S.p.hpMax;
  S.a = {
    dano: 1 + n('espada') * ITENS.espada.por + (m.dano || 0) * 0.05 + cm.dano,
    vel: c.vel * (1 + n('botas') * ITENS.botas.por + (m.vel || 0) * 0.04),
    armadura: c.armadura + n('cota') * ITENS.cota.por,
    area: 1 + n('cetro') * ITENS.cetro.por + cm.area,
    recarga: Math.max(0.4, 1 - n('ampulheta') * ITENS.ampulheta.por - cm.recarga),
    ima: 30 * (1 + n('vidente') * ITENS.vidente.por + (m.ima || 0) * 0.12),
    regen: cm.semRegen ? 0 : n('sangue') * ITENS.sangue.por,
    xp: 1 + n('tomo') * ITENS.tomo.por + (m.xp || 0) * 0.06 + cm.xp,
  };
  S.p.hpMax = Math.round((c.hp + n('doran') * ITENS.doran.por + (m.hp || 0) * 10) * cm.hp);
  if (S.p.hpMax > hpAntes && hpAntes > 1) S.p.hp += S.p.hpMax - hpAntes; // item de vida também cura o ganho
  S.p.hp = Math.min(S.p.hp, S.p.hpMax);
}
// Números da arma (com a evolução e a raridade das cartas já aplicadas).
export function statsDe(S, w) {
  let st = ARMAS[w.id].stats(w.nivel);
  if (w.evo) st = EVOLUCOES[w.id].mod(st);
  st = { ...st };
  if (st.dano) st.dano *= 1 + (w.pot || 0);
  if (st.qtd && S.cm.qtd && ['tiro', 'bumerangue', 'leque', 'perfura', 'encanto'].includes(ARMAS[w.id].tipo)) st.qtd += S.cm.qtd;
  return st;
}

export function adicionarArma(S, id) {
  const a = S.armas.find((x) => x.id === id);
  if (a) { a.nivel = Math.min(5, a.nivel + 1); return a; }
  const nova = { id, nivel: 1, cd: 0.4, ang: 0, tick: 0, fila: 0, filaT: 0 };
  S.armas.push(nova); return nova;
}

// --------------------------------------------------------------------------- escolhas de nível
function sortearRaridade(S) {
  const sorte = Math.min(1, S.nivel / 40); // mais para o fim da partida, cartas melhores
  const pesos = RARIDADES.map((r, i) => r.peso * (i === 0 ? 1 - sorte * 0.4 : 1 + sorte * i * 0.5));
  let k = S.rng() * pesos.reduce((s, x) => s + x, 0);
  for (let i = 0; i < pesos.length; i++) { k -= pesos[i]; if (k <= 0) return i; }
  return 0;
}
function candidatos(S) {
  const L = []; const ban = S.banidos;
  for (const a of S.armas) if (a.nivel < 5) L.push({ tipo: 'arma', id: a.id, nivel: a.nivel + 1, peso: 3 });
  if (S.armas.length < MAX_ARMAS) for (const id of Object.keys(ARMAS)) if (!S.armas.some((a) => a.id === id)) L.push({ tipo: 'arma', id, nivel: 1, peso: 1.6 });
  for (const [id, nv] of Object.entries(S.passivas)) if (nv < NIVEL_MAX_ITEM) L.push({ tipo: 'item', id, nivel: nv + 1, peso: 2.4 });
  if (Object.keys(S.passivas).length < MAX_ITENS) for (const id of Object.keys(ITENS)) if (!S.passivas[id]) L.push({ tipo: 'item', id, nivel: 1, peso: 1.8 });
  return L.filter((x) => !ban.has(x.id));
}
function puxar(S, pool) {
  const total = pool.reduce((s, x) => s + x.peso, 0); let k = S.rng() * total; let i = 0;
  for (; i < pool.length - 1; i++) { k -= pool[i].peso; if (k <= 0) break; }
  return pool.splice(i, 1)[0];
}
function cartaMaldicao(S, usados) {
  const ok = Object.keys(MALDICOES).filter((id) => !S.maldicoes.includes(id) && !S.banidos.has(id) && !usados.has(id));
  return ok.length ? { tipo: 'maldicao', id: ok[Math.floor(S.rng() * ok.length)], nivel: 0, raridade: 0 } : null;
}
export function gerarOpcoes(S) {
  const pool = candidatos(S); const out = []; const usados = new Set();
  while (out.length < 3 && pool.length) { const o = puxar(S, pool); usados.add(o.id); out.push({ ...o, raridade: sortearRaridade(S) }); }
  if (out.length && S.maldicoes.length < MAX_MALDICOES && S.rng() < 0.3) { const m = cartaMaldicao(S, usados); if (m) out[Math.floor(S.rng() * out.length)] = m; }
  if (!out.length) out.push({ tipo: 'cura', id: 'cura', nivel: 0, raridade: 0 }, { tipo: 'ouro', id: 'ouro', nivel: 0, raridade: 0 });
  return out;
}
// Troca as 3 cartas (limite por partida).
export function rolar(S) {
  if (S.estado !== 'upgrade' || S.reroll <= 0) return false;
  S.reroll--; S.opcoes = gerarOpcoes(S); return true;
}
// Bane uma carta: ela some pelo resto da partida e outra entra no lugar.
export function banir(S, i) {
  if (S.estado !== 'upgrade' || S.ban <= 0 || !S.opcoes?.[i]) return false;
  const o = S.opcoes[i]; if (o.tipo === 'cura' || o.tipo === 'ouro') return false;
  S.ban--; S.banidos.add(o.id);
  const usados = new Set(S.opcoes.map((x) => x.id)); const pool = candidatos(S).filter((x) => !usados.has(x.id));
  const nova = pool.length ? { ...puxar(S, pool), raridade: sortearRaridade(S) } : cartaMaldicao(S, usados);
  if (nova) S.opcoes[i] = nova; else S.opcoes.splice(i, 1);
  return true;
}
export function escolher(S, op) {
  const r = RARIDADES[op.raridade || 0];
  if (op.tipo === 'arma') { const w = adicionarArma(S, op.id); w.pot = (w.pot || 0) + r.arma; }
  else if (op.tipo === 'item') { S.passivas[op.id] = (S.passivas[op.id] || 0) + 1; S.pot[op.id] = (S.pot[op.id] ?? (S.passivas[op.id] - 1)) + r.mult; recalcular(S); }
  else if (op.tipo === 'maldicao') { S.maldicoes.push(op.id); recalcular(S); S.evt.push({ tipo: 'maldicao', id: op.id }); }
  else if (op.tipo === 'cura') S.p.hp = S.p.hpMax;
  else if (op.tipo === 'ouro') S.ouro += 40;
  S.opcoes = null;
  if (S.pendentes > 0) S.pendentes--;
  if (S.pendentes > 0) { S.opcoes = gerarOpcoes(S); S.estado = 'upgrade'; } else S.estado = 'jogando';
}

function ganharXp(S, v) {
  S.xp += v * S.a.xp;
  while (S.xp >= S.xpProx) {
    S.xp -= S.xpProx; S.nivel++; S.xpProx = xpProximo(S.nivel); S.pendentes++;
    S.evt.push({ tipo: 'nivel' }); S.p.nivelAnim = 0.5; chispas(S, S.p.x, S.p.y, 26, { cor: '#ffe36a', vel: 80, vida: 0.7, tam: 2 });
  }
  if (S.pendentes > 0 && S.estado === 'jogando') { S.opcoes = gerarOpcoes(S); S.estado = 'upgrade'; }
}

// --------------------------------------------------------------------------- inimigos
function sortearTipo(S) {
  const ok = MISTURA.filter((m) => S.t >= m.de);
  const total = ok.reduce((s, m) => s + m.peso, 0); let k = S.rng() * total;
  for (const m of ok) { k -= m.peso; if (k <= 0) return m.tipo; }
  return ok[0].tipo;
}
export function criarInimigo(S, tipo, x, y, chefe = false) {
  const d = chefe ? CHEFES[tipo] : INIMIGOS[tipo];
  const hp = d.hp * (chefe ? (1 + (S.R.dif - 1) * 0.4) * (1 + S.t / 900 * 0.1) : S.R.dif * escalaVida(S.t) * S.cm.inimVida);
  const e = { id: S.proxId++, tipo, chefe, x, y, hp, hpMax: hp, vel: d.vel * (chefe ? 1 : S.cm.inimVel), dano: d.dano * escalaDano(S.t) * (1 + (S.R.dif - 1) * 0.6), kit: d.kit, passo: 0, f2: false, raio: d.raio, xp: d.xp, ia: d.ia, cd: (d.cd || 3) * (0.5 + S.rng()), flash: 0, lento: 0, kx: 0, ky: 0, estado: 0, tEstado: 0, golpe: {}, elite: !!d.elite, face: 1 };
  S.inim.push(e); return e;
}
function aoRedor(S, folga = 24) {
  const R = Math.hypot(S.vista.w, S.vista.h) / 2 + folga; const a = S.rng() * TAU;
  return { x: S.p.x + Math.cos(a) * R, y: S.p.y + Math.sin(a) * R };
}
function diretor(S, dt) {
  // aparições contínuas
  S.spawnAc += taxaSpawn(S.t) * S.cm.spawn * dt;
  while (S.spawnAc >= 1) {
    S.spawnAc -= 1;
    if (S.inim.length >= MAX_INIMIGOS) continue;
    const pos = aoRedor(S); criarInimigo(S, sortearTipo(S), pos.x, pos.y);
  }
  // onda de tropas a cada 90s: um anel de tropas ao redor do campeão
  if (S.t >= S.onda * 90 && S.t < TEMPO_FIM_ONDAS) {
    S.onda++;
    const n = Math.min(26, 12 + S.onda * 2); const R = Math.hypot(S.vista.w, S.vista.h) / 2 + 16;
    for (let i = 0; i < n && S.inim.length < MAX_INIMIGOS + 40; i++) {
      const a = (i / n) * TAU; criarInimigo(S, 'minion', S.p.x + Math.cos(a) * R, S.p.y + Math.sin(a) * R);
    }
    S.evt.push({ tipo: 'onda' });
  }
  // chefes
  for (const id of S.R.chefes) {
    const d = CHEFES[id];
    if (S.t >= d.t && !S.chefes[id]) {
      S.chefes[id] = true; const pos = aoRedor(S, 40);
      S.chefeVivo = criarInimigo(S, id, pos.x, pos.y, true);
      S.evt.push({ tipo: 'chefe', id });
    }
  }
}
const TEMPO_FIM_ONDAS = 14 * 60;

export function ferir(S, e, dano, op = {}) {
  if (e.hp <= 0) return;
  const crit = S.rng() < 0.06; const d = Math.max(1, dano * (crit ? 2 : 1));
  S.p.alvoX = e.x;
  if (S.p.ataqueCd <= 0) { S.p.ataque = 0.42; S.p.ataqueCd = 1.5; }
  if (S.efeitos.length < 40) S.efeitos.push({ x: e.x, y: e.y - e.raio * 0.4, t: 0.24, d: 0.24, tipo: 'faisca', r: 0 });
  e.hp -= d; e.flash = 0.09; chispas(S, e.x, e.y, crit ? 6 : 3, { cor: crit ? '#ffd24a' : '#fff6c0', vel: crit ? 90 : 55, vida: 0.22 });
  if (op.kx != null) { e.kx += op.kx; e.ky += op.ky; }
  if (op.lento) e.lento = Math.max(e.lento, op.lento);
  if (op.encanta && !e.chefe) e.encantado = Math.max(e.encantado || 0, op.encanta);
  S.textos.push({ x: e.x + (S.rng() - 0.5) * 6, y: e.y - e.raio - 2, v: Math.round(d), t: 0.6, crit });
  if (S.textos.length > 60) S.textos.shift();
  if (e.hp <= 0) matar(S, e);
}
function matar(S, e) {
  S.abates++;
  if (S.t - S.combo.t <= JANELA_COMBO) S.combo.n++; else S.combo.n = 1;
  S.combo.t = S.t; S.combo.max = Math.max(S.combo.max, S.combo.n);
  const cb = COMBOS.find((x) => x.n === S.combo.n);
  if (cb) { S.ouro += Math.round(cb.ouro * (1 + S.cm.ouro)); S.evt.push({ tipo: 'combo', nome: cb.nome, n: cb.n, ouro: cb.ouro }); }
  S.evt.push({ tipo: 'morte', chefe: e.chefe });
  S.efeitos.push({ x: e.x, y: e.y, t: 0.35, d: 0.35, tipo: 'morte', r: e.raio });
  S.fant.push({ tipo: e.tipo, chefe: e.chefe, x: e.x, y: e.y, raio: e.raio, t: e.chefe ? 1.4 : 0.28, d: e.chefe ? 1.4 : 0.28 });
  chispas(S, e.x, e.y, e.chefe ? 40 : 7, { cor: S.R.po || '#cfc9ff', vel: e.chefe ? 120 : 45, vida: e.chefe ? 0.9 : 0.5, tam: e.chefe ? 2 : 1, grav: 40, brilho: false });
  const gv = e.xp;
  S.gemas.push({ x: e.x, y: e.y, v: gv, vx: 0, vy: 0, ima: false });
  if (S.gemas.length > 450) { // junta as mais antigas para não pesar
    const a = S.gemas.shift(); const b = S.gemas[0]; if (b) b.v += a.v;
  }
  const r = S.rng();
  if (e.chefe) {
    S.itens.push({ x: e.x, y: e.y, tipo: 'bau' });
    S.ouro += Math.round(CHEFES[e.tipo].ouro * (1 + S.cm.ouro));
    S.shake = 0.5; S.chefeVivo = null;
    if (CHEFES[e.tipo].final) { S.estado = 'vitoria'; S.evt.push({ tipo: 'vitoria' }); }
  } else if (e.elite) { S.itens.push({ x: e.x, y: e.y, tipo: r < 0.6 ? 'bau' : 'vida' }); S.ouro += 3; }
  else if (r < 0.012) S.itens.push({ x: e.x + 3, y: e.y, tipo: 'vida' });
  else if (r < 0.016) S.itens.push({ x: e.x - 3, y: e.y, tipo: 'ima' });
  else if (r < 0.10) S.itens.push({ x: e.x, y: e.y + 3, tipo: 'ouro' });
  const i = S.inim.indexOf(e); if (i >= 0) { S.inim[i] = S.inim[S.inim.length - 1]; S.inim.pop(); }
}

function danoNoJogador(S, bruto) {
  if (S.p.inv > 0 || S.estado !== 'jogando') return;
  const d = Math.max(1, bruto - S.a.armadura);
  S.p.hp -= d; S.p.inv = 0.55; S.p.flash = 0.15; S.shake = Math.max(S.shake, 0.18);
  S.evt.push({ tipo: 'dano' });
  S.textos.push({ x: S.p.x, y: S.p.y - 10, v: Math.round(d), t: 0.6, jogador: true });
  if (S.p.hp <= 0) {
    if (S.revive && !S.reviveu) { S.reviveu = true; S.p.hp = S.p.hpMax / 2; S.p.inv = 2.5; S.evt.push({ tipo: 'revive' }); for (const e of S.inim) if (!e.chefe && dist2(e, S.p) < 90 * 90) { e.kx += (e.x - S.p.x) * 3; e.ky += (e.y - S.p.y) * 3; } }
    else { S.p.hp = 0; S.estado = 'derrota'; S.evt.push({ tipo: 'derrota' }); }
  }
}

// --------------------------------------------------------------------------- armas
function maisProximo(S, alcance) {
  let melhor = null; let md = alcance * alcance;
  for (const e of S.inim) { const d = dist2(e, S.p); if (d < md) { md = d; melhor = e; } }
  return melhor;
}
function dirAlvo(S, alvo) {
  if (!alvo) return { x: S.p.dx, y: S.p.dy };
  const d = Math.hypot(alvo.x - S.p.x, alvo.y - S.p.y) || 1; return { x: (alvo.x - S.p.x) / d, y: (alvo.y - S.p.y) / d };
}
function tiro(S, o) { S.proj.push({ golpeou: new Set(), vida: 1, perf: 1, raio: 3, ...o }); }

function atualizarArmas(S, dt) {
  for (const w of S.armas) {
    const def = ARMAS[w.id]; const st = statsDe(S, w); const dano = (st.dano || 0) * S.a.dano;
    const cd = (st.cd || 0) * S.a.recarga;
    if (def.tipo === 'orbita') {
      w.ang += st.giro * dt; const R = st.raio * S.a.area;
      for (let i = 0; i < st.qtd; i++) {
        const a = w.ang + (i * TAU) / st.qtd; const bx = S.p.x + Math.cos(a) * R; const by = S.p.y + Math.sin(a) * R;
        for (const e of S.inim) {
          if ((e.x - bx) ** 2 + (e.y - by) ** 2 > (e.raio + 6) ** 2) continue;
          if (S.t - (e.golpe[w.id + i] ?? -9) < st.golpe) continue;
          e.golpe[w.id + i] = S.t; ferir(S, e, dano, { kx: Math.cos(a + 1.57) * 25, ky: Math.sin(a + 1.57) * 25 });
        }
      }
    } else if (def.tipo === 'aura') {
      w.tick -= dt; const R = st.raio * S.a.area;
      for (const e of S.inim) if (dist2(e, S.p) < (R + e.raio) ** 2) e.lento = Math.max(e.lento, 0.3);
      if (w.tick <= 0) { w.tick = st.tick; for (const e of S.inim) if (dist2(e, S.p) < (R + e.raio) ** 2) ferir(S, e, dano, { lento: 0.4 }); }
    } else {
      w.cd -= dt;
      if (w.fila > 0) { // rajada: tiros em sequência
        w.filaT -= dt;
        if (w.filaT <= 0) { w.fila--; w.filaT = 0.09; const al = maisProximo(S, 170); const d = dirAlvo(S, al); tiro(S, { x: S.p.x, y: S.p.y, vx: d.x * st.vel, vy: d.y * st.vel, dano, vida: 0.9, perf: 1, tipo: 'bala', cor: 'tiro' }); S.evt.push({ tipo: 'tiro' }); }
      }
      if (w.cd > 0) continue;
      if (def.tipo === 'tiro') {
        const al = maisProximo(S, 170); if (!al) { w.cd = 0.1; continue; }
        w.cd = cd; w.fila = st.qtd; w.filaT = 0;
      } else if (def.tipo === 'bumerangue') {
        const al = maisProximo(S, 200); if (!al) { w.cd = 0.15; continue; }
        w.cd = cd; const base = Math.atan2(al.y - S.p.y, al.x - S.p.x);
        for (let i = 0; i < st.qtd; i++) { const a = base + (i - (st.qtd - 1) / 2) * 0.35; tiro(S, { x: S.p.x, y: S.p.y, vx: Math.cos(a) * st.vel, vy: Math.sin(a) * st.vel, dano, vida: 6, perf: 99, raio: 6 * S.a.area, tipo: 'orbe', volta: false, alc: st.alcance, ox: S.p.x, oy: S.p.y, vel: st.vel, rearme: 0 }); }
        S.evt.push({ tipo: 'orbe' });
      } else if (def.tipo === 'leque') {
        if (!S.inim.length) { w.cd = 0.2; continue; }
        w.cd = cd; const base = Math.atan2(S.p.dy, S.p.dx);
        for (let i = 0; i < st.qtd; i++) { const a = base + (st.qtd === 1 ? 0 : (i / (st.qtd - 1) - 0.5) * st.abertura * 2); tiro(S, { x: S.p.x, y: S.p.y, vx: Math.cos(a) * st.vel, vy: Math.sin(a) * st.vel, dano, vida: 1.1, perf: 2, tipo: 'flecha', ang: a, lento: 0.8, raio: 3 }); }
        S.evt.push({ tipo: 'flecha' });
      } else if (def.tipo === 'perfura') {
        const al = maisProximo(S, 200); if (!al) { w.cd = 0.15; continue; }
        w.cd = cd; const base = Math.atan2(al.y - S.p.y, al.x - S.p.x);
        for (let i = 0; i < st.qtd; i++) { const a = base + (i - (st.qtd - 1) / 2) * 0.28; tiro(S, { x: S.p.x, y: S.p.y, vx: Math.cos(a) * st.vel, vy: Math.sin(a) * st.vel, dano, vida: 1.5, perf: st.perf, tipo: 'shuriken', raio: 5 * S.a.area, ang: 0 }); }
        S.evt.push({ tipo: 'shuriken' });
      } else if (def.tipo === 'encanto') {
        const al = maisProximo(S, 200); if (!al) { w.cd = 0.15; continue; }
        w.cd = cd; const base = Math.atan2(al.y - S.p.y, al.x - S.p.x);
        for (let i = 0; i < st.qtd; i++) { const a = base + (i - (st.qtd - 1) / 2) * 0.3; tiro(S, { x: S.p.x, y: S.p.y, vx: Math.cos(a) * st.vel, vy: Math.sin(a) * st.vel, dano, vida: 1.8, perf: st.perf, tipo: 'coracao', ang: a, raio: 5 * S.a.area, encanta: st.encanta }); }
        S.evt.push({ tipo: 'orbe' });
      } else if (def.tipo === 'zona') {
        if (!S.inim.length) { w.cd = 0.2; continue; }
        w.cd = cd;
        for (let i = 0; i < st.qtd; i++) {
          const cand = S.inim.filter((e) => dist2(e, S.p) < 150 * 150); const e = cand.length ? cand[Math.floor(S.rng() * cand.length)] : S.inim[0];
          S.zonas.push({ x: e.x, y: e.y, r: st.raio * S.a.area, t: st.dur, d: st.dur, dano, tick: 0, w: w.id });
        }
        S.evt.push({ tipo: 'zona' });
      } else if (def.tipo === 'raio') {
        if (!S.inim.length) { w.cd = 0.2; continue; }
        w.cd = cd;
        for (let i = 0; i < st.qtd; i++) {
          const cand = S.inim.filter((e) => dist2(e, S.p) < 140 * 140); if (!cand.length) break;
          const e = cand[Math.floor(S.rng() * cand.length)]; S.raios.push({ x: e.x, y: e.y, t: 0.35, d: 0.35, r: st.raio * S.a.area, dano, feito: false });
        }
      }
    }
  }
}

const COR_RASTRO = { orbe: '#6aa8ff', coracao: '#ff77b8', flecha: '#8ae8ff', shuriken: '#b45cff', bala: '#ffe36a' };
function atualizarProjeteis(S, dt) {
  for (let i = S.proj.length - 1; i >= 0; i--) {
    const q = S.proj[i];
    if (q.tipo === 'orbe') {
      if (!q.volta) { if ((q.x - q.ox) ** 2 + (q.y - q.oy) ** 2 > q.alc * q.alc) { q.volta = true; q.golpeou.clear(); } }
      else { const d = Math.hypot(S.p.x - q.x, S.p.y - q.y) || 1; q.vx = ((S.p.x - q.x) / d) * q.vel * 1.15; q.vy = ((S.p.y - q.y) / d) * q.vel * 1.15; if (d < 8) { S.proj.splice(i, 1); continue; } }
      q.vida -= dt;
    } else q.vida -= dt;
    q.x += q.vx * dt; q.y += q.vy * dt; q.ang = (q.ang || 0) + (q.tipo === 'shuriken' ? 14 * dt : 0);
    if (Math.random() < 0.5) chispas(S, q.x, q.y, 1, { cor: COR_RASTRO[q.tipo] || '#fff', vel: 8, vida: 0.28, tam: q.tipo === 'orbe' ? 2 : 1 });
    if (q.vida <= 0) { S.proj.splice(i, 1); continue; }
    for (const e of S.inim) {
      if (q.golpeou.has(e.id)) continue;
      if ((e.x - q.x) ** 2 + (e.y - q.y) ** 2 > (e.raio + q.raio) ** 2) continue;
      q.golpeou.add(e.id);
      const l = Math.hypot(q.vx, q.vy) || 1;
      ferir(S, e, q.dano, { kx: (q.vx / l) * 20, ky: (q.vy / l) * 20, lento: q.lento || 0, encanta: q.encanta || 0 });
      if (--q.perf <= 0) { q.vida = 0; break; }
    }
    if (q.vida <= 0 && q.tipo !== 'orbe') S.proj.splice(i, 1);
  }
  for (let i = S.eproj.length - 1; i >= 0; i--) {
    const q = S.eproj[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vida -= dt;
    if (q.vida <= 0) { S.eproj.splice(i, 1); continue; }
    if ((q.x - S.p.x) ** 2 + (q.y - S.p.y) ** 2 < (q.raio + S.p.raio) ** 2) { danoNoJogador(S, q.dano); S.eproj.splice(i, 1); }
  }
  for (let i = S.zonas.length - 1; i >= 0; i--) {
    const z = S.zonas[i]; z.t -= dt; z.tick -= dt;
    for (const e of S.inim) if ((e.x - z.x) ** 2 + (e.y - z.y) ** 2 < (z.r + e.raio) ** 2) { e.lento = Math.max(e.lento, 0.25); if (z.tick <= 0) ferir(S, e, z.dano, { lento: 0.4 }); }
    if (z.tick <= 0) z.tick = 0.3;
    if (z.t <= 0) { for (const e of S.inim.slice()) if ((e.x - z.x) ** 2 + (e.y - z.y) ** 2 < (z.r * 1.4 + e.raio) ** 2) ferir(S, e, z.dano * 6); S.efeitos.push({ x: z.x, y: z.y, t: 0.3, d: 0.3, tipo: 'explosao', r: z.r * 1.4 }); S.zonas.splice(i, 1); }
  }
  for (let i = S.marcas.length - 1; i >= 0; i--) {
    const m = S.marcas[i]; m.t -= dt; if (m.ancora) { if (m.ancora.hp <= 0) { S.marcas.splice(i, 1); continue; } m.x = m.ancora.x; m.y = m.ancora.y; }
    if (m.t <= 0) {
      if ((m.x - S.p.x) ** 2 + (m.y - S.p.y) ** 2 < (m.r + S.p.raio) ** 2) danoNoJogador(S, m.dano);
      S.efeitos.push({ x: m.x, y: m.y, t: 0.3, d: 0.3, tipo: 'explosao', r: m.r }); S.shake = Math.max(S.shake, 0.1); S.marcas.splice(i, 1);
    }
  }
  for (let i = S.raios.length - 1; i >= 0; i--) {
    const r = S.raios[i]; r.t -= dt;
    if (!r.feito && r.t <= r.d * 0.5) { r.feito = true; for (const e of S.inim.slice()) if ((e.x - r.x) ** 2 + (e.y - r.y) ** 2 < (r.r + e.raio) ** 2) ferir(S, e, r.dano); S.shake = Math.max(S.shake, 0.06); }
    if (r.t <= 0) S.raios.splice(i, 1);
  }
}

// Ações dos chefes. 'marcas' e 'onda' avisam no chão antes de machucar (t = tempo de aviso).
function acaoChefe(S, e, acao, vx, vy) {
  const P = S.p; e.animAtq = 0.9;
  if (acao === 'investida') { e.estado = 1; e.tEstado = 0.5; e.dx = vx; e.dy = vy; }
  else if (acao === 'anel') {
    const n = e.f2 ? 16 : 12; const base = S.rng() * TAU;
    for (let i = 0; i < n; i++) { const a = base + (i / n) * TAU; S.eproj.push({ x: e.x, y: e.y, vx: Math.cos(a) * 62, vy: Math.sin(a) * 62, dano: e.dano * 0.55, raio: 4, vida: 4.5 }); }
    S.evt.push({ tipo: 'cuspe' });
  } else if (acao === 'marcas') {
    const n = e.f2 ? 7 : 5;
    for (let i = 0; i < n; i++) { const a = S.rng() * TAU; const r = i === 0 ? 0 : 14 + S.rng() * 46; S.marcas.push({ x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, r: 20, t: 1.1 + i * 0.07, d: 1.1 + i * 0.07, dano: e.dano * 0.9 }); }
  } else if (acao === 'onda') {
    S.marcas.push({ x: e.x, y: e.y, r: e.f2 ? 96 : 80, t: 1.2, d: 1.2, dano: e.dano, ancora: e });
    S.evt.push({ tipo: 'onda_chefe' });
  } else if (acao === 'invocar') {
    for (let i = 0; i < 5 && S.inim.length < MAX_INIMIGOS + 40; i++) { const a = S.rng() * TAU; criarInimigo(S, i % 3 === 0 ? 'lobo' : 'minion', e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26); }
    S.evt.push({ tipo: 'cuspe' });
  }
}

// --------------------------------------------------------------------------- inimigos: movimento e ataques
function atualizarInimigos(S, dt) {
  const P = S.p; const dmax = 520 * 520;
  // grade para separar inimigos (evita pilha única)
  const G = 14; const grade = new Map();
  for (const e of S.inim) { const k = Math.floor(e.x / G) * 7919 + Math.floor(e.y / G); let l = grade.get(k); if (!l) grade.set(k, l = []); l.push(e); }
  for (const e of S.inim) {
    e.flash = Math.max(0, e.flash - dt); if (e.animAtq > 0) e.animAtq -= dt; e.lento = Math.max(0, e.lento - dt); e.encantado = Math.max(0, (e.encantado || 0) - dt); e.tEstado -= dt; e.cd -= dt;
    const dx = P.x - e.x; const dy = P.y - e.y; const d = Math.hypot(dx, dy) || 1;
    if (!e.chefe && d * d > dmax) { const pos = aoRedor(S, 8); e.x = pos.x; e.y = pos.y; continue; }
    let vx = dx / d; let vy = dy / d; let v = e.vel * (e.lento > 0 ? 0.55 : 1);
    if (e.encantado > 0) { e.cd = Math.max(e.cd, 0.2); v = 0; if (e.estado === 1) e.estado = 0; }
    if (e.ia === 'atirar') {
      if (d < INIMIGOS.mago.alcance) { v = d < 55 ? -v * 0.6 : 0; }
      if (e.cd <= 0 && d < 140) { e.cd = INIMIGOS.mago.cd; S.eproj.push({ x: e.x, y: e.y, vx: vx * 70, vy: vy * 70, dano: e.dano, raio: 3, vida: 2.4 }); }
    } else if (e.ia === 'investir' || e.ia === 'chefe') {
      if (e.ia === 'chefe') {
        if (!e.f2 && e.hp < e.hpMax * 0.5) { e.f2 = true; e.vel *= 1.25; S.evt.push({ tipo: 'fase2', id: e.tipo }); S.shake = 0.5; }
        if (e.estado === 0 && e.cd <= 0) { const acao = e.kit[e.passo++ % e.kit.length]; e.cd = CHEFES[e.tipo].cd * (e.f2 ? 0.7 : 1); acaoChefe(S, e, acao, vx, vy); }
      }
      if (e.ia === 'investir' && e.estado === 0 && e.cd <= 0 && d < 150) { e.estado = 1; e.tEstado = 0.45; e.dx = vx; e.dy = vy; } // mira
      else if (e.estado === 1) { v = 0; if (e.tEstado <= 0) { e.estado = 2; e.tEstado = e.chefe ? 0.8 : 0.5; } }
      else if (e.estado === 2) { vx = e.dx; vy = e.dy; v = e.vel * (e.chefe ? 7 : 5); if (e.tEstado <= 0) { e.estado = 0; e.cd = (e.chefe ? CHEFES[e.tipo].cd * (e.f2 ? 0.7 : 1) : INIMIGOS[e.tipo].cd); } }
    } else if (e.ia === 'cuspir' || e.ia === 'barao') {
      if (e.cd <= 0) {
        e.cd = CHEFES[e.tipo].cd; const n = e.ia === 'barao' ? 10 : 8; const base = S.rng() * TAU;
        for (let i = 0; i < n; i++) { const a = base + (i / n) * TAU; S.eproj.push({ x: e.x, y: e.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, dano: e.dano * 0.6, raio: 4, vida: 4 }); }
        if (e.ia === 'barao') { for (let i = 0; i < 4 && S.inim.length < MAX_INIMIGOS + 40; i++) criarInimigo(S, 'vazio', e.x + (S.rng() - 0.5) * 30, e.y + (S.rng() - 0.5) * 30); }
        S.evt.push({ tipo: 'cuspe' });
      }
    }
    // separação suave
    let sx = 0; let sy = 0; const cx = Math.floor(e.x / G); const cy = Math.floor(e.y / G);
    for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) {
      const l = grade.get((cx + ix) * 7919 + (cy + iy)); if (!l) continue;
      for (const o of l) { if (o === e) continue; const ox = e.x - o.x; const oy = e.y - o.y; const dd = ox * ox + oy * oy; const m = (e.raio + o.raio) * 0.8; if (dd < m * m && dd > 0.01) { const dl = Math.sqrt(dd); sx += (ox / dl) * (m - dl); sy += (oy / dl) * (m - dl); } }
    }
    e.x += (vx * v + sx * 6 + e.kx) * dt; e.y += (vy * v + sy * 6 + e.ky) * dt;
    e.kx *= Math.max(0, 1 - 9 * dt); e.ky *= Math.max(0, 1 - 9 * dt);
    if (Math.abs(vx) > 0.2) e.face = vx > 0 ? 1 : -1;
    if (d < e.raio + P.raio && !(e.encantado > 0)) danoNoJogador(S, e.dano);
  }
}

// --------------------------------------------------------------------------- coletáveis
function atualizarColetaveis(S, dt) {
  const P = S.p; const R = S.a.ima;
  for (let i = S.gemas.length - 1; i >= 0; i--) {
    const g = S.gemas[i]; const d2 = dist2(g, P);
    if (!g.ima && d2 < R * R) g.ima = true;
    if (g.ima) { const d = Math.sqrt(d2) || 1; const v = 120 + 120 * Math.min(1, 40 / d); g.x += ((P.x - g.x) / d) * v * dt; g.y += ((P.y - g.y) / d) * v * dt; if (d < 5) { ganharXp(S, g.v); S.gemas.splice(i, 1); S.evt.push({ tipo: 'gema' }); chispas(S, S.p.x, S.p.y - 4, 2, { cor: '#8ad8ff', vel: 30, vida: 0.25 }); } }
  }
  for (let i = S.itens.length - 1; i >= 0; i--) {
    const it = S.itens[i]; const d2 = dist2(it, P);
    if (d2 > 9 * 9 && !(it.tipo === 'ouro' && d2 < R * R)) continue;
    if (it.tipo === 'ouro' && d2 >= 9 * 9) { const d = Math.sqrt(d2) || 1; it.x += ((P.x - it.x) / d) * 140 * dt; it.y += ((P.y - it.y) / d) * 140 * dt; continue; }
    S.itens.splice(i, 1);
    if (it.tipo === 'vida') { S.p.hp = Math.min(S.p.hpMax, S.p.hp + S.p.hpMax * 0.3 * S.cm.cura); S.evt.push({ tipo: 'cura' }); chispas(S, S.p.x, S.p.y - 4, 10, { cor: '#7dffa8', vel: 40, vida: 0.7, grav: -40 }); }
    else if (it.tipo === 'ouro') { S.ouro += 1 + S.cm.ouro; S.evt.push({ tipo: 'ouro' }); }
    else if (it.tipo === 'ima') { for (const g of S.gemas) g.ima = true; S.evt.push({ tipo: 'ima' }); }
    else if (it.tipo === 'bau') {
      S.efeitos.push({ x: it.x, y: it.y, t: 0.7, d: 0.7, tipo: 'bauaberto', r: 0 });
      const ev = S.armas.find((w) => w.nivel >= 5 && !w.evo && EVOLUCOES[w.id] && S.passivas[EVOLUCOES[w.id].item]);
      if (ev) { ev.evo = true; S.evolucoes.push(ev.id); S.evt.push({ tipo: 'evolucao', id: ev.id }); S.shake = 0.4; chispas(S, S.p.x, S.p.y, 60, { cor: '#ffffff', vel: 140, vida: 1.0, tam: 2 }); }
      else { S.evt.push({ tipo: 'bau' }); S.pendentes++; if (S.estado === 'jogando') { S.opcoes = gerarOpcoes(S); S.estado = 'upgrade'; } }
    }
  }
}

// Habilidade própria do campeão (ex.: Garen e o Julgamento): giro em área com recarga, quando há inimigos perto.
function habilidadeEspecial(S, dt) {
  const esp = S.base.especial; if (!esp) return; const P = S.p;
  P.especial = Math.max(0, P.especial - dt); P.espCd -= dt;
  const raio = esp.raio * S.a.area;
  if (P.espT > 0) {
    P.espT -= dt;
    if (P.espT <= 0) {
      const lam = S.armas[0] ? statsDe(S, S.armas[0]) : null; const dano = ((lam?.dano || 12) * esp.mult) * S.a.dano;
      for (const e of S.inim.slice()) { const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < raio + e.raio) ferir(S, e, dano, { kx: ((e.x - P.x) / (d || 1)) * 60, ky: ((e.y - P.y) / (d || 1)) * 60 }); }
      S.efeitos.push({ x: P.x, y: P.y, t: 0.35, d: 0.35, tipo: 'explosao', r: raio }); S.shake = Math.max(S.shake, 0.15);
      chispas(S, P.x, P.y, 24, { cor: '#bfe4ff', vel: 110, vida: 0.45 });
    }
  } else if (P.espCd <= 0) {
    const perto = S.inim.reduce((n, e) => n + (Math.hypot(e.x - P.x, e.y - P.y) < raio + e.raio ? 1 : 0), 0);
    if (perto >= 2) { P.especial = 0.5; P.espT = 0.22; P.espCd = esp.cd * S.a.recarga; S.evt.push({ tipo: 'zona' }); }
  }
}

// --------------------------------------------------------------------------- passo principal
export function atualizar(S, dt, entrada = { x: 0, y: 0 }) {
  if (S.estado !== 'jogando') return;
  dt = Math.min(dt, 0.05);
  S.t += dt; const P = S.p;
  // movimento do campeão
  let mx = entrada.x; let my = entrada.y; const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  P.andando = m > 0.05; P.mx = mx; P.my = my;
  if (P.andando) { const n = Math.hypot(mx, my); P.dx = mx / n; P.dy = my / n; }
  P.x += mx * S.a.vel * dt; P.y += my * S.a.vel * dt;
  // inclinação do corpo no sentido do movimento, passos (um a cada ~11 px andados) e pegadas no chão
  P.lean += (Math.max(-1, Math.min(1, mx)) - P.lean) * Math.min(1, 12 * dt);
  P.corre = S.a.vel >= S.base.vel * 1.2; const dPasso = P.corre ? 17 : 11; // correndo (botas, pena...) os passos são mais longos
  const andou = Math.hypot(mx, my) * S.a.vel * dt; const passoAntes = Math.floor(P.dist / dPasso); P.dist += andou;
  for (let k = passoAntes + 1; k <= Math.floor(P.dist / dPasso); k++) { // um passo por vez que o pé toca o chão (quadros 0 e 3 do ciclo)
    P.pe = k % 2 ? 1 : -1; S.evt.push({ tipo: 'passo' });
    S.pegadas.push({ x: P.x + P.pe * 3, y: P.y + 6, t: 1.6, d: 1.6 }); if (S.pegadas.length > 40) S.pegadas.shift();
    chispas(S, P.x + P.pe * 3, P.y + 6, 2, { cor: S.R.po || '#cfc9ff', vel: 16, vida: 0.35, grav: -14, brilho: false });
  }
  // para onde ele olha: o lado em que anda; parado e atacando, olha para o alvo
  if (Math.abs(mx) > 0.15) P.face = mx > 0 ? 1 : -1; else if ((P.ataque > 0 || P.especial > 0) && Math.abs(P.alvoX - P.x) > 3) P.face = P.alvoX > P.x ? 1 : -1;
  habilidadeEspecial(S, dt);
  P.nivelAnim = Math.max(0, P.nivelAnim - dt);
  P.inv = Math.max(0, P.inv - dt); P.flash = Math.max(0, P.flash - dt); P.ataque = Math.max(0, P.ataque - dt); P.ataqueCd = Math.max(0, P.ataqueCd - dt);
  if (S.a.regen) P.hp = Math.min(P.hpMax, P.hp + S.a.regen * dt);
  S.shake = Math.max(0, S.shake - dt);
  diretor(S, dt);
  atualizarArmas(S, dt);
  atualizarInimigos(S, dt);
  atualizarProjeteis(S, dt);
  atualizarColetaveis(S, dt);
  for (let i = S.part.length - 1; i >= 0; i--) { const q = S.part[i]; q.t -= dt; if (q.t <= 0) { S.part[i] = S.part[S.part.length - 1]; S.part.pop(); continue; } q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - 3 * dt; q.vy *= 1 - 1.5 * dt; }
  for (let i = S.pegadas.length - 1; i >= 0; i--) { S.pegadas[i].t -= dt; if (S.pegadas[i].t <= 0) S.pegadas.splice(i, 1); }
  for (let i = S.fant.length - 1; i >= 0; i--) { S.fant[i].t -= dt; if (S.fant[i].t <= 0) S.fant.splice(i, 1); }
  for (let i = S.textos.length - 1; i >= 0; i--) { const x = S.textos[i]; x.t -= dt; x.y -= 14 * dt; if (x.t <= 0) S.textos.splice(i, 1); }
  for (let i = S.efeitos.length - 1; i >= 0; i--) { S.efeitos[i].t -= dt; if (S.efeitos[i].t <= 0) S.efeitos.splice(i, 1); }
}

// Essência Azul ganha na partida (moeda da loja).
export function essenciaGanha(S) {
  return Math.floor((S.abates * 0.35 + S.ouro * 0.8 + S.t / 12 + (S.estado === 'vitoria' ? 150 : 0)) * (1 + S.maldicoes.length * 0.1) * S.R.dif);
}
export const nomeArma = (id) => ARMAS[id]?.nome || id;
export const campeaoPorId = (id) => CAMPEOES.find((c) => c.id === id);
