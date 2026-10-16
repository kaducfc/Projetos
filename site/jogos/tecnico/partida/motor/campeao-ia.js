// Inteligência dos campeões: máquina de estados com histerese. A cada intervalo de decisão (escalado pelo atributo Macro) o campeão
// avalia sobrevivência, lutas, plano da equipe e função; entre decisões ele apenas executa a ação do estado atual.
//
// Estados: nascendo, saindo_base, indo_rota, farmando, lutando, selva, gank, ajudando, objetivo, estrutura, defendendo,
//          recuando, voltando_base (inclui o recall canalizado), comprando, morto.
import { MUNDO_MAPA, outro } from '../nucleo/mapa-mundo.js';
import { dist } from '../nucleo/coord.js';
import { irPara, parar } from './movimento.js';
import { atacarBasico, podeAtacar, habPronta, lancarHabilidade, curar, causarDano, porId, atacavel, estimarDano, incapacitado, hpPct, podeAgir } from './combate.js';
import { comprar, custoProximo } from './economia.js';
import { recalcular } from './entidades.js';
import { registrar } from './eventos.js';
import { conhecidos } from './visao.js';
import { valorCombate, balancoLocal, torreInimigaEm, minionsPerto, rotaDe, sNaRota, progresso, pontoNoProgresso, frentes, torresDaRota, proximaTorreInimiga, pontoSeguro, naFonte, aliadosPerto, planoPara } from './percepcao.js';

export const ESTADOS = ['nascendo', 'saindo_base', 'indo_rota', 'farmando', 'lutando', 'selva', 'gank', 'ajudando', 'objetivo', 'estrutura', 'defendendo', 'recuando', 'voltando_base', 'comprando', 'morto'];

function mudar(P, u, novo, motivo = '') {
  if (u.estado === novo) { if (motivo) u.motivo = motivo; return; }
  u.estadoAnt = u.estado; u.estado = novo; u.estadoDesde = P.t; u.motivo = motivo;
  u.hist.push([Math.round(P.t), novo, motivo]); if (u.hist.length > 12) u.hist.shift();
  if (novo !== 'lutando' && novo !== 'gank') u.alvoId = null;
  u.caminho = null; u.destino = null; u.replan = 0;
}

// ------------------------------------------------------------------ início e renascimento
export function posicaoInicial(P, u, idx) {
  const f = MUNDO_MAPA.bases[u.equipe].fonte; const esp = P.regras.campeao.saida.espacamento;
  const ang = (idx - 2) * 0.55;
  const rot = u.equipe === 'azul' ? 1 : -1;
  const p = { x: f.x + Math.cos(ang) * esp * 1.2 * rot, y: f.y + Math.sin(ang) * esp * 1.2 };
  return P.terreno.caminhavel(p.x, p.y, 'campeao') ? p : { x: f.x, y: f.y };
}
export function iniciarCampeao(P, u, idx) {
  u.hist = []; u.idxBase = idx;
  const p = posicaoInicial(P, u, idx); u.x = p.x; u.y = p.y;
  u.estado = 'saindo_base'; u.estadoDesde = 0;
  if (u.pos === 'selva') {
    const lado = u.equipe === 'azul' ? 'azul' : 'verm';
    // ordem de limpeza configurável por equipe/jogador (padrão: buff azul -> gromp -> lobos -> raptores -> buff vermelho -> krugs)
    u.jungle.ordem = (u.rotaSelva || P.config.rotaSelva?.[u.equipe] || ['buff', 'gromp', 'lobos', 'raptores', 'brambleback', 'krugs']).map((n) => `${lado}_${n}`);
    u.jungle.idx = 0;
  }
  u.proxDecisao = 0.2 + idx * 0.07;
  comprar(P, u); // itens iniciais
}
function renascer(P, u) {
  const base = MUNDO_MAPA.bases[u.equipe];
  const p = posicaoInicial(P, u, u.idxBase);
  u.morto = false; u.x = p.x; u.y = p.y; u.hp = u.hpMax; u.mana = u.manaMax; u.efeitos = []; u.escudo = 0; u.vivoDesde = P.t;
  u.ultimosAtacantes = {}; u.alvoId = null; u.caminho = null; u.destino = null; u.invulAte = P.t + 1.5; u.recallAte = 0; u.estado = 'saindo_base'; u.estadoDesde = P.t;
  comprar(P, u);
  u.forcarDecisao = true;
  registrar(P, 'renasceu', { equipe: u.equipe, campeao: u.id });
  P.fx.push({ k: 'renasce', id: u.id, t: P.t, x: u.x, y: u.y });
}

// ------------------------------------------------------------------ ciclo por passo
export function atualizarCampeao(P, u, dt) {
  if (u.morto) { if (P.t >= u.renasceEm) renascer(P, u); return; }
  const R = P.regras.campeao;
  // regeneração e efeitos
  const naBase = naFonte(P, u);
  const regen = naBase ? R.regenFonte : R.regenBase;
  u.hp = Math.min(u.hpMax, u.hp + u.hpMax * regen * dt);
  u.mana = Math.min(u.manaMax, u.mana + u.manaMax * (naBase ? R.regenFonte : R.regenBase_mana) * dt);
  if (u.buffs.length && P.t >= (u.proxBuff || 0)) { u.proxBuff = P.t + 1; const n = u.buffs.length; u.buffs = u.buffs.filter((b) => b.ate > P.t); if (n !== u.buffs.length) recalcular(u, P); }
  if (u.efeitos.length) u.efeitos = u.efeitos.filter((e) => e.ate > P.t);
  if (u.recallAte && P.t >= u.recallAte && u.estado === 'voltando_base') { concluirRecall(P, u); return; }
  if (P.t >= u.proxDecisao || u.forcarDecisao) {
    u.forcarDecisao = false;
    decidir(P, u);
    u.proxDecisao = P.t + R_int(P, u);
  }
  agir(P, u, dt);
}
const R_int = (P, u) => P.regras.ia.intervaloDecisao * u.m.decisaoIntervalo * (0.85 + P.rng() * 0.3);

// ------------------------------------------------------------------ percepção
function perceber(P, u) {
  const R = P.regras.ia;
  const conh = conhecidos(P, u.equipe);
  const ini = conh.filter((k) => Math.hypot(k.x - u.x, k.y - u.y) <= 1900);
  const iniPerto = ini.filter((k) => Math.hypot(k.x - u.x, k.y - u.y) <= 1250);
  const aliados = aliadosPerto(P, u, u.x, u.y, 1500, false);
  const ctx = {
    ini, iniPerto, aliados, hp: hpPct(u),
    bal: balancoLocal(P, u, u.x, u.y, 1500),
    torreIni: torreInimigaEm(P, u.equipe, u.x, u.y),
    minAli: minionsPerto(P, u.equipe, u.x, u.y, 900, true), minIni: minionsPerto(P, u.equipe, u.x, u.y, 900, false),
    naBase: naFonte(P, u), plano: planoPara(P, u),
  };
  return ctx;
}
// ruído de avaliação (reduz com Macro): sem ele a IA seria perfeita
const ruido = (P, u, v) => v * (1 + (P.rng() - 0.5) * 2 * u.m.ruido);

// ------------------------------------------------------------------ decisão
function decidir(P, u) {
  const R = P.regras.ia;
  const ctx = perceber(P, u); u.ctx = ctx;
  const eq = P.equipes[u.equipe];
  // recall em andamento: só cancela se houver perigo
  if (u.estado === 'voltando_base' && u.recallAte) {
    if (ctx.iniPerto.some((k) => k.visivel && Math.hypot(k.x - u.x, k.y - u.y) < 1000)) u.recallAte = 0; else return;
  }
  if (u.estado === 'comprando') { if (P.t - u.estadoDesde < 1.2 || (ctx.hp < 0.92 && ctx.naBase && P.t - u.estadoDesde < 14)) return; }
  // 1) sobrevivência
  const rec = precisaRecuar(P, u, ctx);
  if (rec) { if (u.estado !== 'recuando' && u.estado !== 'voltando_base') mudar(P, u, 'recuando', rec); else if (u.estado === 'recuando') u.motivo = rec; if (u.estado === 'recuando') return; }
  if (u.estado === 'recuando') {
    // saiu do perigo: volta à base (se precisa) ou à rota
    if (!ctx.iniPerto.length || ctx.bal.razao > 1.2) { if (precisaBase(P, u, ctx)) mudar(P, u, 'voltando_base', 'seguro'); else mudar(P, u, u.pos === 'selva' ? 'selva' : 'indo_rota', 'seguro'); }
    return;
  }
  // 2) voltar à base para curar/comprar
  const pb = u.estado !== 'voltando_base' ? precisaBase(P, u, ctx) : null;
  if (pb && !(ctx.plano && ctx.plano.tipo === 'defender_base')) { mudar(P, u, 'voltando_base', pb); return; }
  if (u.estado === 'voltando_base') {
    if (ctx.naBase) {
      if (comprar(P, u)) { /* comprou */ }
      if (ctx.hp >= 0.9 && u.mana >= u.manaMax * 0.6) { P.fx.push({ k: 'comprou', id: u.id, t: P.t }); mudar(P, u, u.pos === 'selva' ? 'selva' : 'indo_rota', 'voltou'); }
      else { mudar(P, u, 'comprando', 'na base'); }
    }
    return;
  }
  // 3) lutas contra campeões
  const luta = avaliarLuta(P, u, ctx);
  if (luta) {
    if (u.estado !== 'lutando') mudar(P, u, 'lutando', luta.motivo);
    u.alvoId = luta.alvo.id; u.lutaOrigem = u.lutaOrigem || { x: u.x, y: u.y, t: P.t };
    return;
  }
  if (u.estado === 'lutando') { u.lutaOrigem = null; u.ultimaLuta = P.t; mudar(P, u, u.pos === 'selva' ? 'selva' : 'indo_rota', 'sem luta'); }
  // 4) plano da equipe
  const pl = atenderPlano(P, u, ctx);
  if (pl) { if (u.estado !== pl.estado || u.planoId !== pl.id) mudar(P, u, pl.estado, pl.motivo); u.planoId = pl.id; u.planoAlvo = pl.alvo || null; return; }
  if (['objetivo', 'estrutura', 'defendendo', 'ajudando'].includes(u.estado)) mudar(P, u, u.pos === 'selva' ? 'selva' : 'indo_rota', 'plano acabou');
  // 5) função padrão
  if (u.pos === 'selva') return decidirSelva(P, u, ctx);
  decidirLaner(P, u, ctx);
}

function precisaRecuar(P, u, ctx) {
  const R = P.regras.ia.perigo;
  if (!ctx.iniPerto.length && !ctx.torreIni) return null;
  const hp = ctx.hp; const bal = ctx.bal;
  // erro de decisão (mental): às vezes o campeão não percebe o risco
  const erra = P.rng() < u.m.erro * (hp > R.vidaCritica ? 1 : 0.3);
  if (hp < R.vidaCritica && ctx.iniPerto.some((k) => k.visivel)) return erra ? null : 'vida crítica';
  if (hp < R.vidaBaixa && bal.razao < 1.1 && ctx.iniPerto.some((k) => k.visivel)) return erra ? null : 'vida baixa';
  if (ctx.iniPerto.length >= 2 && ruido(P, u, bal.razao) < 0.62) return erra ? null : 'em desvantagem';
  if (ctx.torreIni && !ctx.minAli && u.estado !== 'estrutura' && hp < 0.85 && !(ctx.plano && ctx.plano.tipo === 'finalizar')) return 'sob torre';
  return null;
}
function precisaBase(P, u, ctx) {
  const R = P.regras.campeao;
  if (u.estado === 'morto') return null;
  const perigo = ctx.iniPerto.some((k) => k.visivel);
  if (ctx.hp < R.recall.vidaBaixa) return 'vida baixa';
  if (u.pos === 'selva' && ctx.hp < 0.45 && !u.jungle.emCombate) return 'vida baixa (selva)';
  if (u.ouro >= Math.max(R.ouroCompraMin, custoProximo(u)) && u.ouro >= 1100 && !perigo && !(ctx.plano && ['objetivo', 'defender_base', 'finalizar'].includes(ctx.plano.tipo)) && P.t - (u.ultimaBase || 0) > 60) return 'ouro para comprar';
  if (u.mana < u.manaMax * 0.12 && u.pos !== 'selva' && !perigo && u.mana < 60) return 'sem mana';
  return null;
}

// ---- lutas
function avaliarLuta(P, u, ctx) {
  const R = P.regras.ia; const visiveis = ctx.iniPerto.filter((k) => k.visivel && !k.u.morto);
  if (!visiveis.length) return null;
  const emLuta = u.estado === 'lutando';
  const alcEng = Math.max(u.alcance, 300) + (emLuta ? 500 : 300);
  // candidatos ao alcance de engajamento (a luta em andamento aceita alvos um pouco mais distantes)
  const cand = visiveis.filter((k) => dist(u, k.u) <= alcEng + (k.u.raio || 0) && !protegidoPorTorre(P, u, k.u, ctx));
  if (!cand.length) return null;
  const alvo = escolherAlvo(P, u, cand);
  if (!alvo) return null;
  // balanço no ponto da luta
  const ponto = { x: (u.x + alvo.x) / 2, y: (u.y + alvo.y) / 2 };
  const b = balancoLocal(P, u, ponto.x, ponto.y, 1400);
  const razao = ruido(P, u, b.razao);
  const hpAlvo = alvo.hp / alvo.hpMax; const meuHp = ctx.hp;
  const exec = hpAlvo < 0.35 && razao > 0.85 && meuHp > 0.3;
  const nAliadosLuta = aliadosPerto(P, u, ponto.x, ponto.y, 1300, true).length;
  const equipe = nAliadosLuta >= 3; // luta de equipe
  if (u.estado === 'gank' && razao > 0.9) return { alvo, motivo: 'gank' };
  if (emLuta) {
    // continua enquanto a luta não virou: na fase de rotas, trocas curtas (recua depois de uma rajada)
    const lane = !equipe && P.t < 900 && ctx.minAli + ctx.minIni > 2;
    if (lane && P.t - u.estadoDesde > 7 && !exec) { u.ultimaLuta = P.t; return null; }
    if (razao >= 0.88 * R.perigo.margemLuta / 1.12 && meuHp > 0.28) return { alvo, motivo: 'luta' };
    if (exec) return { alvo, motivo: 'finalizar' };
    u.ultimaLuta = P.t; return null;
  }
  if (P.t - (u.ultimaLuta || -99) < 8 && !exec && !equipe) return null; // respira entre as trocas
  // trocas na rota exigem vantagem real (vida, nível, ondas); lutas de equipe e abates iminentes são mais permissivos
  const lane = !equipe && ctx.minAli + ctx.minIni > 2 && P.t < 1200;
  const vantagemLane = (meuHp - hpAlvo) * 0.6 + (u.nivel - alvo.nivel) * 0.08 + (ctx.minAli > ctx.minIni ? 0.06 : 0);
  if (lane && !exec) { if (meuHp > 0.65 && razao >= 1.2 && vantagemLane > 0.08) return { alvo, motivo: 'troca' }; return null; }
  if (exec) return { alvo, motivo: 'finalizar' };
  if (razao >= R.perigo.margemLuta * 1.08 && meuHp > 0.5) return { alvo, motivo: equipe ? 'luta de equipe' : 'luta favorável' };
  return null;
}
function protegidoPorTorre(P, u, alvo, ctx) {
  // não persegue para dentro de torre inimiga sem minions aliados e sem o plano de pressionar
  const t = torreInimigaEm(P, u.equipe, alvo.x, alvo.y, 40);
  if (!t) return false;
  if (ctx.plano && ['estrutura', 'finalizar'].includes(ctx.plano.tipo)) return false;
  return minionsPerto(P, u.equipe, alvo.x, alvo.y, 800, true) < 2 && hpPct(alvo) > 0.2;
}
function escolherAlvo(P, u, cand) {
  const atual = u.alvoId ? cand.find((k) => k.u.id === u.alvoId) : null;
  let melhor = null, ms = -1e9;
  for (const k of cand) {
    const e = k.u; const d = dist(u, e);
    let s = 100 - d / 15 + (1 - e.hp / e.hpMax) * 40;
    if (u.perfil.classe === 'assassino') s += (1 - e.hp / e.hpMax) * 40 + (e.perfil.classe === 'atirador' || e.perfil.classe === 'mago' ? 35 : 0) - (e.armadura + e.resist) / 6;
    else if (u.perfil.classe === 'tanque') s += (e.perfil.classe === 'atirador' ? 20 : 0) + 10;
    else if (u.perfil.classe === 'atirador' || u.perfil.classe === 'mago') s += -d / 30 + (e.perfil.classe === 'tanque' ? -20 : 0);
    // alvos que o resto do time já ataca
    for (const c of P.campeoes) if (!c.morto && c.equipe === u.equipe && c !== u && c.alvoId === e.id) s += 8;
    if (atual && e.id === atual.u.id && P.t - u.estadoDesde > 0.5) s += 25; // estabilidade de alvo
    if (s > ms) { ms = s; melhor = e; }
  }
  return melhor;
}

// ---- jungler
function proximoCampo(P, u) {
  const ordem = u.jungle.ordem;
  for (let i = 0; i < ordem.length; i++) {
    const c = P.acampamentos.find((a) => a.id === ordem[(u.jungle.idx + i) % ordem.length]);
    if (c && c.estado === 'vivo' && c.vivos > 0) { u.jungle.idx = (u.jungle.idx + i) % ordem.length; return c; }
  }
  // sem acampamento da ordem: caranguejos e, em último caso, a selva inimiga
  for (const a of P.acampamentos) if (a.tipo === 'caranguejo' && a.estado === 'vivo' && a.vivos > 0) return a;
  return null;
}
function decidirSelva(P, u, ctx) {
  const R = P.regras.ia.gank;
  // gank oportunista
  if (P.t >= R.tempoMin && u.nivel >= 3 && ctx.hp >= R.vidaMin && P.t >= (u.proxGank || 0) && u.estado !== 'gank') {
    u.proxGank = P.t + R.intervalo;
    const g = avaliarGanks(P, u, ctx);
    if (g && g.pontos >= R.pontuacaoMin) {
      u.gankInfo = { rota: g.rota, alvoId: g.alvo.id, inicio: P.t, abatesAntes: u.estat.abates + u.estat.assist, pontos: g.pontos, hpIni: ctx.hp };
      u.ganks++; registrar(P, 'gank_iniciado', { equipe: u.equipe, campeao: u.id, rota: g.rota, alvo: g.alvo.id, pontos: Math.round(g.pontos) });
      mudar(P, u, 'gank', 'gank ' + g.rota); return;
    }
  }
  if (u.estado === 'gank') {
    const gi = u.gankInfo; const alvo = gi && porId(P, gi.alvoId);
    const conhecido = alvo && conhecidos(P, u.equipe, 9).find((k) => k.u.id === alvo.id);
    const fim = !gi || P.t - gi.inicio > R.duracaoMax || !alvo || alvo.morto || !conhecido || ctx.hp < 0.35;
    if (fim) { terminarGank(P, u, gi, alvo && alvo.morto ? 'abate' : (ctx.hp < 0.35 ? 'recuou' : 'falhou')); mudar(P, u, 'selva', 'gank acabou'); }
    return;
  }
  if (u.estado !== 'selva') mudar(P, u, 'selva', 'rota de farm');
}
function terminarGank(P, u, gi, motivo) {
  if (!gi) return;
  const kills = u.estat.abates + u.estat.assist - gi.abatesAntes;
  const resultado = kills > 0 ? 'abate' : (u.morto ? 'jungler_morreu' : motivo);
  registrar(P, 'gank_resultado', { equipe: u.equipe, campeao: u.id, rota: gi.rota, resultado, abates: kills, duracao: Math.round(P.t - gi.inicio) });
  u.proxGank = P.t + P.regras.ia.gank.esfriamento * (resultado === 'abate' ? 0.5 : 1);
  u.gankInfo = null;
}
function avaliarGanks(P, u, ctx) {
  const R = P.regras.ia; let melhor = null;
  const conh = conhecidos(P, u.equipe, 8);
  for (const rota of ['topo', 'meio', 'baixo']) {
    const aliado = P.campeoes.find((c) => c.equipe === u.equipe && !c.morto && c.rota === rota && c.pos !== 'suporte');
    const inimigos = conh.filter((k) => k.u.rota === rota && k.u.pos !== 'suporte');
    if (!aliado || !inimigos.length) continue;
    const alvo = inimigos[0];
    const dPath = P.nav.distancia(u.x, u.y, alvo.x, alvo.y, 'campeao');
    if (!isFinite(dPath)) continue;
    const tempo = dPath / u.vel;
    if (tempo > 16) continue;
    let s = 40;
    const tIni = torreInimigaEm(P, u.equipe, alvo.x, alvo.y, 200);
    s += tIni ? -28 : 18;
    s += (hpPct(aliado) - alvo.hp) * 32;
    if (alvo.hp < 0.5) s += 14;
    s += dist(aliado, alvo) < 1400 ? 10 : -6;
    s -= Math.max(0, tempo - 6) * 2.2;
    const jIni = conh.find((k) => k.u.pos === 'selva');
    if (jIni && Math.hypot(jIni.x - alvo.x, jIni.y - alvo.y) < 2600) s -= 20;
    const sup = inimigos.length + (conh.filter((k) => k.u.rota === rota && k.u.pos === 'suporte').length);
    s -= (sup - 1) * 12;
    if (aliado.habilidades.some((h) => h.efeitos?.some((e) => e.tipo === 'stun'))) s += 5;
    const campoPerto = P.acampamentos.some((c) => c.estado === 'vivo' && c.vivos > 0 && dist(c, u) < 1100);
    if (campoPerto && ctx.hp > 0.6) s -= 8; // acampamento na mão: prefere limpar
    s = ruido(P, u, s) + (P.rng() - 0.5) * 8 * (1 - u.m.macro);
    if (!melhor || s > melhor.pontos) melhor = { rota, alvo: alvo.u, pontos: s };
  }
  return melhor;
}

// ---- laners
function decidirLaner(P, u, ctx) {
  if (u.estado === 'saindo_base' || u.estado === 'nascendo') mudar(P, u, 'indo_rota', 'rota inicial');
  if (u.estado === 'indo_rota') {
    const p = posFarm(P, u);
    if (dist(u, p) < 450) mudar(P, u, 'farmando', 'chegou');
    return;
  }
  if (u.estado === 'farmando') return;
  if (!['farmando', 'indo_rota'].includes(u.estado)) mudar(P, u, 'indo_rota', 'volta à rota');
}

// ------------------------------------------------------------------ plano da equipe
function atenderPlano(P, u, ctx) {
  const pl = ctx.plano; if (!pl) return null;
  const hp = ctx.hp;
  const part = pl.participantes && pl.participantes.includes(u.id);
  if (!part) return null;
  if (hp < 0.4) return null;
  switch (pl.tipo) {
    case 'objetivo': return { id: pl.id, estado: 'objetivo', motivo: pl.objetivo, alvo: pl };
    case 'defender': case 'defender_base': return { id: pl.id, estado: 'defendendo', motivo: 'defender ' + (pl.rota || 'base'), alvo: pl };
    case 'pressionar': case 'finalizar': return { id: pl.id, estado: 'estrutura', motivo: pl.tipo, alvo: pl };
    case 'ajudar': return { id: pl.id, estado: 'ajudando', motivo: 'ajudar ' + pl.rota, alvo: pl };
    default: return null;
  }
}

// ------------------------------------------------------------------ posições
export function posFarm(P, u) {
  const rota = u.rotaAtual || u.rota || 'meio'; const L = rotaDe(rota).comprimento;
  const eq = u.equipe;
  const t1 = MUNDO_MAPA.estruturas.find((e) => e.tipo === 'torre' && e.nivel === 1 && e.rota === rota && e.equipe === eq);
  const progT1 = progresso(rota, eq, sNaRota(rota, t1).s);
  // frente das ondas, em progresso a partir da MINHA base: minion aliado mais avançado e minion inimigo mais próximo da minha base
  let aliadoFrente = -1, inimigoFrente = 1e9;
  for (const m of P.minions) {
    if (m.morto || m.rota !== rota) continue;
    const pm = progresso(rota, eq, sNaRota(rota, m).s);
    if (m.equipe === eq) { if (pm > aliadoFrente) aliadoFrente = pm; } else if (pm < inimigoFrente) inimigoFrente = pm;
  }
  const alc = u.alcance > 300 ? u.alcance * 0.55 : Math.max(80, u.alcance * 0.4);
  let prog;
  if (aliadoFrente >= 0 && inimigoFrente < 1e9) prog = Math.min(inimigoFrente - alc, aliadoFrente - 40);
  else if (aliadoFrente >= 0) prog = aliadoFrente - 260;
  else if (inimigoFrente < 1e9) prog = inimigoFrente - alc;
  else prog = progT1;
  // limite: fora do alcance da torre inimiga mais próxima (a menos que minions aliados a protejam)
  const tIni = proximaTorreInimiga(P, eq, rota);
  if (tIni && tIni.subtipo === 'torre') {
    const pT = progresso(rota, eq, sNaRota(rota, tIni).s);
    const lim = pT - (tIni.alcance + 40);
    if (prog > lim) prog = Math.max(lim, 0);
  }
  prog = Math.max(120, Math.min(prog, L - 200));
  // não fica muito atrás da primeira torre aliada viva
  const aliadaT = torresDaRota(P, eq, rota)[0];
  if (aliadaT) { const pA = progresso(rota, eq, sNaRota(rota, aliadaT).s); if (prog < pA - 250) prog = pA - 250; }
  const p = pontoNoProgresso(rota, eq, prog);
  // suporte: junto ao atirador
  if (u.pos === 'suporte') {
    const adc = P.campeoes.find((c) => c.equipe === eq && c.pos === 'atirador' && !c.morto);
    if (adc) return { x: adc.x + (eq === 'azul' ? -120 : 120), y: adc.y + 90 };
  }
  return p;
}

// ------------------------------------------------------------------ ação por estado
function agir(P, u, dt) {
  if (!podeAgir(P, u)) { if (u.dashAte) return; return; }
  switch (u.estado) {
    case 'saindo_base': case 'nascendo': return agirIrRota(P, u);
    case 'indo_rota': return agirIrRota(P, u);
    case 'farmando': return u.pos === 'suporte' ? agirSuporte(P, u) : agirFarm(P, u);
    case 'lutando': return agirLuta(P, u);
    case 'selva': return agirSelva(P, u);
    case 'gank': return agirGank(P, u);
    case 'recuando': return agirRecuar(P, u);
    case 'voltando_base': return agirVoltarBase(P, u);
    case 'comprando': return agirComprando(P, u);
    case 'objetivo': return P.estrategia.agirObjetivo(P, u);
    case 'estrutura': return P.estrategia.agirEstrutura(P, u);
    case 'defendendo': return P.estrategia.agirDefender(P, u);
    case 'ajudando': return P.estrategia.agirAjudar(P, u);
    default: return;
  }
}

function agirIrRota(P, u) {
  if (u.pos === 'selva') { return agirSelva(P, u); }
  const p = posFarm(P, u);
  irPara(P, u, p.x, p.y, { tol: 80 });
  if (dist(u, p) < 450 && u.estado !== 'saindo_base') return;
  // enquanto caminha, ataca minions ou inimigos que estiverem ao alcance
  atacarOportunidade(P, u);
}
function atacarOportunidade(P, u) {
  let alvo = null, md = Infinity;
  P.indice.perto(u.x, u.y, u.alcance + 80, (m) => { if (m.morto || m.equipe === u.equipe || m.tipo === 'estrutura' || m.tipo === 'epico' || m.tipo === 'monstro') return; const d = dist(u, m); if (d < md && atacavel(P, m)) { md = d; alvo = m; } });
  if (alvo) atacarBasico(P, u, alvo);
}

// ---- farm na rota: último golpe com probabilidade dada pelo atributo Fase de rotas; poke e troca quando vantajoso
function agirFarm(P, u) {
  const ctx = u.ctx || {};
  const p = posFarm(P, u);
  if (dist(u, p) > 140) irPara(P, u, p.x, p.y, { tol: 60 }); else parar(u);
  // alvo: minion inimigo ao alcance, priorizando quem morre no próximo golpe
  let alvo = null, menor = Infinity; const dano = u.ad;
  P.indice.perto(u.x, u.y, u.alcance + 120, (m) => {
    if (m.morto || m.equipe === u.equipe || m.tipo !== 'minion') return;
    if (dist(u, m) > u.alcance + m.raio * 0.5) return;
    if (m.hp < menor) { menor = m.hp; alvo = m; }
  });
  // habilidade de limpeza de onda ('sempre' em área) e último golpe com habilidade quando o ataque básico não basta
  if (alvo) usarLimpeza(P, u, alvo);
  if (alvo && alvo.hp > dano * 1.2 && u.mana > u.manaMax * 0.5) {
    for (const h of u.habilidades) if ((h.uso === 'poke' || h.uso === 'sempre') && h.tipo !== 'dash' && h.dano && habPronta(P, u, h) && estimarDano(u, h, alvo) * 0.85 >= alvo.hp && dist(u, alvo) <= (h.alcance || 0) && P.rng() < u.m.farm) { lancarHabilidade(P, u, h, alvo); break; }
  }
  // poke/troca em campeão inimigo ao alcance
  const inim = (ctx.iniPerto || []).filter((k) => k.visivel && dist(u, k.u) <= u.alcance + 40 && !torreInimigaEm(P, u.equipe, k.x, k.y, 0));
  if (inim.length && (P.t - (u.proxPoke || 0) > 0) && u.mana > u.manaMax * 0.3) {
    const k = inim[0].u; u.proxPoke = P.t + 0.6;
    for (const h of u.habilidades) if (h.uso === 'poke' && habPronta(P, u, h) && dist(u, k) <= h.alcance) { lancarHabilidade(P, u, h, k); break; }
  }
  if (alvo && P.t >= u.proximoAtaque) {
    // último golpe: bate quando o minion morre com este ataque (ou quase); o atributo "Fase de rotas" define a chance de acertar o tempo certo
    // antecipa o dano que o minion vai receber enquanto o ataque chega (taxa medida nos últimos instantes)
    const mk = alvo.marca; let taxa = 0;
    if (!mk || P.t - mk.t > 0.9) alvo.marca = { t: P.t, hp: alvo.hp };
    else if (P.t - mk.t >= 0.3) { taxa = Math.max(0, (mk.hp - alvo.hp) / (P.t - mk.t)); alvo.marca = { t: P.t, hp: alvo.hp, taxa }; } else taxa = mk.taxa || 0;
    const atraso = u.alcance > 300 ? 0.3 : 0.12;
    const acerta = u.m.farm; const ultimoGolpe = alvo.hp - taxa * atraso <= dano * 1.3;
    if (ultimoGolpe) {
      // tempo de reação: jogadores com pouca "fase de rotas" demoram mais para bater no momento certo
      if (!u.reacao || u.reacao.id !== alvo.id) u.reacao = { id: alvo.id, ate: P.t + (1 - acerta) * 1.4 * P.rng() };
      if (P.t >= u.reacao.ate) atacarBasico(P, u, alvo);
    }
    else if ((ctx.minIni || 0) > 0 && (ctx.minAli || 0) <= 1 && alvo.hp > dano * 3) atacarBasico(P, u, alvo); // onda aliada fraca: ajuda a segurar
    } else if (!alvo && inim.length && P.t >= u.proximoAtaque && trocaFavoravel(P, u, inim[0].u, ctx)) { atacarBasico(P, u, inim[0].u); }
}
function trocaFavoravel(P, u, e, ctx) {
  const eu = hpPct(u), el = hpPct(e);
  const dif = (u.nivel - e.nivel) * 0.06 + (eu - el) * 0.8 + (ctx.minAli > ctx.minIni ? 0.08 : -0.05);
  return dif > 0.05 && eu > 0.55;
}
function usarLimpeza(P, u, alvo) {
  if (u.mana < u.manaMax * 0.55) return;
  let n = 0; P.indice.perto(alvo.x, alvo.y, 350, (m) => { if (m.tipo === 'minion' && !m.morto && m.equipe !== u.equipe) n++; });
  if (n < 3) return;
  for (const h of u.habilidades) if (h.uso === 'sempre' && habPronta(P, u, h) && dist(u, alvo) <= (h.alcance || 0) + 100) { lancarHabilidade(P, u, h, alvo); break; }
}
function agirSuporte(P, u) {
  const ctx = u.ctx || {};
  const adc = P.campeoes.find((c) => c.equipe === u.equipe && c.pos === 'atirador' && !c.morto);
  if (adc) {
    const p = posFarm(P, u);
    if (dist(u, p) > 200) irPara(P, u, p.x, p.y, { tol: 100 }); else parar(u);
  } else { const p = posFarm(P, u); irPara(P, u, p.x, p.y, { tol: 100 }); }
  // protege o aliado: cura/escudo quando precisa; incomoda o inimigo com poke
  usarSuporte(P, u, ctx);
  const inim = (ctx.iniPerto || []).filter((k) => k.visivel && dist(u, k.u) <= u.alcance && !torreInimigaEm(P, u.equipe, k.x, k.y, 0));
  if (inim.length && P.t - (u.proxPoke || 0) > 0 && u.mana > u.manaMax * 0.4) {
    u.proxPoke = P.t + 0.8;
    for (const h of u.habilidades) if ((h.uso === 'poke' || h.uso === 'iniciar') && habPronta(P, u, h) && dist(u, inim[0].u) <= h.alcance && hpPct(u) > 0.6 && (ctx.minIni || 0) >= 0) { if (h.uso === 'iniciar' && !adc) break; lancarHabilidade(P, u, h, inim[0].u); break; }
  }
  // o suporte não ataca minions enquanto o atirador está vivo
  if (!adc) atacarOportunidade(P, u);
}
function usarSuporte(P, u, ctx) {
  for (const h of u.habilidades) {
    if (h.uso !== 'suporte' || !habPronta(P, u, h)) continue;
    const alvos = P.campeoes.filter((c) => !c.morto && c.equipe === u.equipe && dist(c, u) <= (h.alcance || h.raio || 700));
    const f = alvos.filter((c) => hpPct(c) < 0.7 || (c.ultimoDano > P.t - 2.5));
    if (h.tipo === 'cura' && f.length) { lancarHabilidade(P, u, h, f.sort((a, b) => hpPct(a) - hpPct(b))[0]); return; }
    if (h.tipo === 'escudo' && f.length) { lancarHabilidade(P, u, h, f.sort((a, b) => hpPct(a) - hpPct(b))[0]); return; }
    if (h.tipo === 'buff' && alvos.length >= 2 && (ctx.iniPerto || []).length) { lancarHabilidade(P, u, h, u); return; }
  }
}

// ---- luta
function agirLuta(P, u) {
  const alvo = u.alvoId ? porId(P, u.alvoId) : null;
  if (!alvo || alvo.morto) { u.forcarDecisao = true; return; }
  const ctx = u.ctx || {};
  const d = dist(u, alvo);
  // posição: a distância adequada do alvo
  const alcDes = u.alcance > 300 ? u.alcance * 0.88 : Math.max(60, u.alcance * 0.6);
  const unida = u.perfil.funcao === 'proteger' ? aliadosPerto(P, u, u.x, u.y, 1200, false).sort((a, b) => dist(a, alvo) - dist(b, alvo))[0] : null;
  if (d > alcDes + 20) irPara(P, u, alvo.x, alvo.y, { tol: alcDes });
  else if (u.alcance > 300 && d < u.alcance * 0.45 && alvo.alcance <= 300 && hpPct(u) < 0.7) { /* recua um pouco do corpo a corpo */ const k = (u.alcance * 0.7) / Math.max(1, d); const px = alvo.x + (u.x - alvo.x) * k, py = alvo.y + (u.y - alvo.y) * k; if (P.terreno.caminhavel(px, py, 'campeao')) irPara(P, u, px, py, { tol: 40 }); else parar(u); }
  else parar(u);
  usarHabilidades(P, u, alvo, ctx);
  atacarBasico(P, u, alvo);
  // supera-se o limite de perseguição: desiste
  if (u.lutaOrigem && dist(u, u.lutaOrigem) > P.regras.combate.persecucaoMax) { u.forcarDecisao = true; }
}
export function usarHabilidades(P, u, alvo, ctx) {
  if (alvo && alvo.tipo === 'estrutura') return; // habilidades não atingem estruturas nesta versão
  const luta = u.estado === 'lutando' || u.estado === 'gank' || u.estado === 'estrutura' || u.estado === 'objetivo' || u.estado === 'defendendo';
  for (const ordem of ['r', 'e', 'q', 'w']) {
    const h = u.habilidades.find((x) => x.tecla.toLowerCase() === ordem); if (!h || !habPronta(P, u, h)) continue;
    const d = alvo ? dist(u, alvo) : 1e9; const hpA = alvo ? alvo.hp / alvo.hpMax : 1; const hp = hpPct(u);
    switch (h.uso) {
      case 'iniciar': if (alvo && luta && d <= h.alcance + 40) { if (u.perfil.classe === 'atirador' && h.tipo === 'dash') break; lancarHabilidade(P, u, h, alvo); } break;
      case 'poke': if (alvo && d <= h.alcance && u.mana > u.manaMax * 0.2) lancarHabilidade(P, u, h, alvo); break;
      case 'sempre': if (alvo && d <= (h.alcance || 0) + (h.raio || 0) * 0.6 + 60) lancarHabilidade(P, u, h, alvo); break;
      case 'finalizar': if (alvo && d <= h.alcance && (hpA < 0.5 || estimarDano(u, h, alvo) >= alvo.hp * 0.9)) lancarHabilidade(P, u, h, alvo); break;
      case 'defesa': if (hp < 0.6 && ((ctx.iniPerto || []).length || alvo)) lancarHabilidade(P, u, h, u); break;
      case 'suporte': usarSuporte(P, u, ctx || {}); break;
      case 'fuga': break;
    }
  }
}

// ---- recuo e volta à base
function agirRecuar(P, u) {
  const ctx = u.ctx || {};
  const seg = pontoSeguro(P, u);
  // fuga com mobilidade quando alguém colado
  const perto = (ctx.iniPerto || []).filter((k) => k.visivel && dist(u, k.u) < 650)[0];
  if (perto) for (const h of u.habilidades) if (h.uso === 'fuga' && habPronta(P, u, h)) { lancarHabilidade(P, u, h, perto.u); break; }
  if (perto && hpPct(u) < 0.5) for (const h of u.habilidades) if (h.uso === 'defesa' && habPronta(P, u, h)) { lancarHabilidade(P, u, h, u); break; }
  irPara(P, u, seg.x, seg.y, { tol: 150 });
  if (perto && u.alcance > 300 && dist(u, perto.u) < u.alcance && Math.random() < 0) atacarBasico(P, u, perto.u);
  if (dist(u, seg) < 250) { u.forcarDecisao = true; }
}
function agirVoltarBase(P, u) {
  const ctx = u.ctx || {}; const R = P.regras.campeao.recall; const fonte = MUNDO_MAPA.bases[u.equipe].fonte;
  if (naFonte(P, u)) { parar(u); return; }
  const perigo = (ctx.iniPerto || []).some((k) => k.visivel && Math.hypot(k.x - u.x, k.y - u.y) < 1100) || P.t - u.ultimoDano < 2.5;
  if (!perigo && !u.recallAte && u.recallTent !== Math.floor(P.t / 3)) {
    // canaliza o recall parado, no lugar seguro
    u.recallAte = P.t + R.canal; u.recallInicio = P.t; parar(u);
    P.fx.push({ k: 'recall', id: u.id, t: P.t });
    return;
  }
  if (u.recallAte) return; // canalizando
  irPara(P, u, fonte.x, fonte.y, { tol: 200 }); // com perigo: caminha em direção à fonte
}
function concluirRecall(P, u) {
  // recall canalizado concluído: mecânica explícita (teletransporte para a fonte), nunca usada como atalho da navegação
  const f = MUNDO_MAPA.bases[u.equipe].fonte;
  u.recallAte = 0; u.x = f.x; u.y = f.y; u.caminho = null; u.destino = null; u.ultimaBase = P.t;
  registrar(P, 'recall', { equipe: u.equipe, campeao: u.id });
  comprar(P, u); u.hp = Math.min(u.hpMax, u.hp + u.hpMax * 0.2); u.forcarDecisao = true;
}
function agirComprando(P, u) {
  parar(u);
  if (comprar(P, u)) P.fx.push({ k: 'comprou', id: u.id, t: P.t });
  if (u.hp / u.hpMax >= 0.92 && u.mana >= u.manaMax * 0.6) u.forcarDecisao = true;
}

// ---- selva
function agirSelva(P, u) {
  const J = u.jungle; const ctx = u.ctx || {};
  // monstros ao alcance
  let campo = J.campoAtual ? P.acampamentos.find((c) => c.id === J.campoAtual) : null;
  if (!campo || campo.vivos <= 0 || campo.estado !== 'vivo') { campo = proximoCampo(P, u); J.campoAtual = campo ? campo.id : null; }
  J.emCombate = false;
  if (!campo) {
    // nada para limpar agora: espera perto do próximo acampamento a renascer ou vai ajudar uma rota
    const prox = P.acampamentos.filter((c) => u.jungle.ordem.includes(c.id)).sort((a, b) => (a.respawnEm || 0) - (b.respawnEm || 0))[0];
    if (prox) { irPara(P, u, prox.x, prox.y - 250, { tol: 150 }); }
    return;
  }
  const monstros = campo.monstros.filter((m) => !m.morto);
  const dCampo = dist(u, campo);
  if (dCampo > campo.raio + 260 && !monstros.some((m) => dist(u, m) <= u.alcance + 80)) { irPara(P, u, campo.x, campo.y, { tol: 120 }); return; }
  J.emCombate = true;
  // alvo: o monstro mais próximo; Golpear no monstro quase morto
  let alvo = null, md = Infinity;
  for (const m of monstros) { const d = dist(u, m); if (d < md) { md = d; alvo = m; } }
  if (!alvo) return;
  if (!podeAtacar(P, u, alvo)) { irPara(P, u, alvo.x, alvo.y, { tol: u.alcance * 0.7 }); }
  else parar(u);
  golpear(P, u, alvo);
  for (const h of u.habilidades) if ((h.uso === 'sempre' || h.uso === 'poke' || h.uso === 'iniciar') && habPronta(P, u, h) && dist(u, alvo) <= (h.alcance || 0) + 60 && h.tipo !== 'dash' && u.mana > u.manaMax * 0.3) { lancarHabilidade(P, u, h, alvo); break; }
  const antes = alvo.hp;
  if (atacarBasico(P, u, alvo)) { const cura = u.ad * P.regras.selva.sustentoAtaque; u.hp = Math.min(u.hpMax, u.hp + cura); } // sustentação de selva
}
// Golpear (Smite): dano verdadeiro em monstros, com recarga longa; também serve para roubar objetivos.
export function golpear(P, u, alvo) {
  if (u.pos !== 'selva' || P.t < (u.golpearEm || 0)) return false;
  const dano = 450 + u.nivel * 40;
  if (alvo.hp > dano * 1.0 && !(alvo.tipo === 'monstro' && alvo.ouro >= 90 && alvo.hp < dano * 1.8 && false)) return false;
  if (dist(u, alvo) > 600) return false;
  u.golpearEm = P.t + 90;
  P.fx.push({ k: 'golpear', id: u.id, para: alvo.id, t: P.t });
  causarDano(P, u, alvo, dano, 'verdadeiro', { fx: true });
  return true;
}
function agirGank(P, u) {
  const gi = u.gankInfo; if (!gi) { u.forcarDecisao = true; return; }
  const alvo = porId(P, gi.alvoId);
  if (!alvo || alvo.morto) { u.forcarDecisao = true; return; }
  // vai até o inimigo pelo caminho mais curto da selva; a luta começa quando a avaliação de luta aprovar
  const k = conhecidos(P, u.equipe, 9).find((x) => x.u.id === alvo.id);
  if (!k) { u.forcarDecisao = true; return; }
  const px = k.x, py = k.y;
  irPara(P, u, px, py, { tol: Math.max(300, u.alcance * 0.6) });
}
