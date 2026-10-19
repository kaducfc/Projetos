// Estudo por simulação em massa (sem navegador): confrontos espelhados entre duas "configurações" (atributos e/ou política da IA), em paralelo.
// Cada seed joga duas partidas (X no azul e X no vermelho) com os mesmos campeões, para cancelar a vantagem de lado.
// Uso:
//   node estudo.mjs atributos [n=60]                  # cada atributo 90 contra 10 (os demais iguais)
//   node estudo.mjs politica caminho v1,v2,... [n=60] # X usa regras.ia[caminho]=v; Y usa o padrão
//   node estudo.mjs varredura [n=60]                  # roda todos os parâmetros da lista PARAMETROS e grava relatorio-estudo.json
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { elencoTeste } from '../dados/elencos-teste.js';
import { criarRng } from '../nucleo/rng.js';

const aqui = new URL('.', import.meta.url);
const catalogo = () => JSON.parse(readFileSync(new URL('../../../campeao/dados/campeoes.json', aqui), 'utf8')).campeoes.map((c) => ({ ...c, id: c.nome }));
const POS = { top: 'Top', selva: 'Jungle', meio: 'Mid', atirador: 'ADC', suporte: 'Suporte' };

// Campeões fixos por seed e posição (os mesmos nas duas partidas do par).
async function escolherCampeoes(seed, cat) {
  const { posicoesDe } = await import('../dados/campeoes-sim.js');
  const r = criarRng(`estudo:${seed}`); const usados = new Set(); const out = { x: {}, y: {} };
  for (const t of ['x', 'y']) for (const pos of Object.keys(POS)) {
    const pool = cat.filter((c) => !usados.has(c.nome) && posicoesDe(c).includes(POS[pos]));
    const c = pool[Math.floor(r() * pool.length)]; usados.add(c.nome); out[t][pos] = c;
  }
  return out;
}
function elenco(prefixo, seed, cfg, champs) {
  const base = elencoTeste(prefixo, cfg.poder ?? 60, seed);
  return base.map((j) => {
    const atributos = { ...j.atributos, ...(cfg.atributos || {}) };
    return { ...j, atributos, campeao: champs[j.pos], poder: Math.round((atributos.mec * 25 + atributos.rotas * 20 + atributos.macro * 20 + atributos.tf * 20 + atributos.mental * 15) / 100) };
  });
}
export async function jogarPar(seed, X, Y, cat) {
  const { Partida } = await import('../motor/partida.js');
  const champs = await escolherCampeoes(seed, cat); const res = [];
  for (const xAzul of [true, false]) {
    const ex = elenco(xAzul ? 'A' : 'V', seed, X, champs.x), ey = elenco(xAzul ? 'V' : 'A', seed, Y, champs.y);
    const P = new Partida({ azul: xAzul ? ex : ey, vermelho: xAzul ? ey : ex, semente: seed, catalogo: cat, regras: { ...(X.regras || {}) },
      politica: { azul: xAzul ? X.politica || {} : Y.politica || {}, vermelho: xAzul ? Y.politica || {} : X.politica || {} } });
    const r = P.executarAteFim();
    const eqX = xAzul ? 'azul' : 'vermelho', eqY = xAzul ? 'vermelho' : 'azul';
    const obj = P.eventos.filter((e) => e.tipo === 'objetivo_abatido');
    res.push({ seed, xAzul, vencedor: r.vencedor === null ? null : (r.vencedor === eqX ? 'x' : 'y'), duracao: r.duracao,
      ouroX: P.equipes[eqX].ouroTotal, ouroY: P.equipes[eqY].ouroTotal, abatesX: P.equipes[eqX].abates, abatesY: P.equipes[eqY].abates,
      objX: obj.filter((e) => e.equipe === eqX).length, objY: obj.filter((e) => e.equipe === eqY).length,
      roubosX: obj.filter((e) => e.equipe === eqX && e.roubado).length, roubosY: obj.filter((e) => e.equipe === eqY && e.roubado).length,
      contestX: P.eventos.filter((e) => e.tipo === 'objetivo_contestado' && e.equipe === eqX).length, contestY: P.eventos.filter((e) => e.tipo === 'objetivo_contestado' && e.equipe === eqY).length,
      wardsX: P.campeoes.filter((c) => c.equipe === eqX).reduce((s, c) => s + c.estat.wardsColocadas, 0), wardsY: P.campeoes.filter((c) => c.equipe === eqY).reduce((s, c) => s + c.estat.wardsColocadas, 0),
      erros: P.diag.erros.length });
  }
  return res;
}

if (!isMainThread) {
  const cat = catalogo();
  parentPort.on('message', async (t) => {
    if (t.fim) { process.exit(0); }
    try { parentPort.postMessage({ id: t.id, r: await jogarPar(t.seed, t.X, t.Y, cat) }); } catch (e) { parentPort.postMessage({ id: t.id, erro: String(e.stack || e) }); }
  });
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const W = Math.max(1, Math.min(cpus().length, 8));
  const workers = Array.from({ length: W }, () => new Worker(fileURLToPath(import.meta.url)));
  // Executa uma lista de tarefas { seed, X, Y } e devolve os resultados na mesma ordem.
  const rodar = (tarefas) => new Promise((ok) => {
    const sai = new Array(tarefas.length); let prox = 0, feitas = 0;
    const dar = (w) => { if (prox >= tarefas.length) return; const id = prox++; w.postMessage({ id, ...tarefas[id] }); };
    for (const w of workers) { w.on('message', (m) => { sai[m.id] = m.erro ? { erro: m.erro } : m.r; feitas++; if (feitas === tarefas.length) ok(sai); else dar(w); }); dar(w); }
  });
  const resumo = (L) => {
    const p = L.flat().filter((x) => !x.erro); const n = p.length; const v = p.filter((x) => x.vencedor === 'x').length, d = p.filter((x) => x.vencedor === 'y').length, e = n - v - d;
    const wr = (v + e / 2) / n; const z = (wr - 0.5) / Math.sqrt(0.25 / n);
    const m = (f) => p.reduce((s, x) => s + f(x), 0) / n;
    return { n, vitoriasX: v, vitoriasY: d, empates: e, winX: +(wr * 100).toFixed(1), z: +z.toFixed(2), duracaoMin: +(m((x) => x.duracao) / 60).toFixed(1), abatesX: +m((x) => x.abatesX).toFixed(1), abatesY: +m((x) => x.abatesY).toFixed(1),
      objX: +m((x) => x.objX).toFixed(2), objY: +m((x) => x.objY).toFixed(2), roubosX: +m((x) => x.roubosX).toFixed(2), roubosY: +m((x) => x.roubosY).toFixed(2), contestX: +m((x) => x.contestX).toFixed(2), contestY: +m((x) => x.contestY).toFixed(2),
      wardsX: +m((x) => x.wardsX).toFixed(1), wardsY: +m((x) => x.wardsY).toFixed(1), erros: p.reduce((s, x) => s + x.erros, 0), falhas: L.flat().length - n };
  };
  const confronto = async (X, Y, n, s0 = 1000) => resumo(await rodar(Array.from({ length: n }, (_, i) => ({ seed: s0 + i, X, Y }))));
  const [modo, ...args] = process.argv.slice(2);
  const fmtR = (r) => `X ${r.winX}% (z=${r.z}) · ${r.vitoriasX}-${r.vitoriasY}${r.empates ? `-${r.empates}e` : ''} · ${r.duracaoMin}min · abates ${r.abatesX}x${r.abatesY} · obj ${r.objX}x${r.objY} · roubos ${r.roubosX}x${r.roubosY} · contest ${r.contestX}x${r.contestY} · wards ${r.wardsX}x${r.wardsY}${r.erros ? ` · ERROS ${r.erros}` : ''}`;
  if (modo === 'atributos') {
    const n = Number(args[0] || 60); const out = {};
    for (const a of ['mec', 'rotas', 'macro', 'tf', 'mental']) { out[a] = await confronto({ atributos: { [a]: 90 } }, { atributos: { [a]: 10 } }, n); console.log(a.padEnd(7), fmtR(out[a])); }
    out.todos = await confronto({ poder: 80 }, { poder: 40 }, n); console.log('todos  ', fmtR(out.todos));
    out.igual = await confronto({}, {}, n); console.log('igual  ', fmtR(out.igual));
    if (args.includes('--json')) writeFileSync(new URL('relatorio-atributos.json', aqui), JSON.stringify(out, null, 1));
  } else if (modo === 'politica') {
    const [caminho, valores, nn] = args; const n = Number(nn || 60);
    for (const v of valores.split(',')) { const r = await confronto({ politica: { [caminho]: Number(v) } }, {}, n); console.log(`${caminho}=${v}`.padEnd(32), fmtR(r)); }
  } else if (modo === 'varredura') {
    const n = Number(args[0] || 60); const out = [];
    const PARAMETROS = JSON.parse(readFileSync(new URL('estudo-parametros.json', aqui), 'utf8'));
    for (const [caminho, valores] of Object.entries(PARAMETROS)) for (const v of valores) { const r = await confronto({ politica: { [caminho]: v } }, {}, n); out.push({ caminho, valor: v, ...r }); console.log(`${caminho}=${v}`.padEnd(34), fmtR(r)); }
    writeFileSync(new URL('relatorio-varredura.json', aqui), JSON.stringify(out, null, 1));
  }
  for (const w of workers) w.postMessage({ fim: true });
}
