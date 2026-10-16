// Simula partidas completas em lote (sem interface), em paralelo, e imprime estatísticas de equilíbrio.
// Uso: node simular-lote.mjs [n=12] [poderAzul=60] [poderVermelho=60] [semente0=1] [trabalhadores=4] [--json]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { elencoTeste } from '../dados/elencos-teste.js';

const aqui = new URL('.', import.meta.url);
const catalogo = () => JSON.parse(readFileSync(new URL('../../../campeao/dados/campeoes.json', aqui), 'utf8')).campeoes.map((c) => ({ ...c, id: c.nome }));

export async function jogar(semente, pa, pv, regras, catalogoMem) {
  const { Partida } = await import('../motor/partida.js');
  const P = new Partida({ azul: elencoTeste('A', pa, semente), vermelho: elencoTeste('V', pv, semente), semente, catalogo: catalogoMem || catalogo(), regras });
  const t0 = performance.now();
  const r = P.executarAteFim();
  const cs = P.campeoes.reduce((s, c) => s + c.estat.cs + c.estat.csSelva, 0) / 10 / (r.duracao / 60);
  const gk = P.eventos.filter((e) => e.tipo === 'gank_resultado');
  return { semente, vencedor: r.vencedor, motivo: r.motivo, duracao: r.duracao, azul: r.equipes.azul, vermelho: r.equipes.vermelho, cs, ms: performance.now() - t0,
    presos: r.diagnostico.presosGraves, ganks: gk.length, ganksAbate: gk.filter((e) => e.resultado === 'abate').length, objetivos: P.eventos.filter((e) => e.tipo === 'objetivo_abatido').length,
    minionsOciosos: P.diag.minionsOciosos || 0, primeiraTorre: (P.eventos.find((e) => e.tipo === 'torre_destruida') || {}).t || null, erros: r.diagnostico.erros };
}

if (!isMainThread) {
  const cat = catalogo();
  (async () => { for (const s of workerData.sementes) parentPort.postMessage(await jogar(s, workerData.pa, workerData.pv, workerData.regras, cat)); parentPort.postMessage({ fim: true }); })();
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const n = Number(args[0] || 12), pa = Number(args[1] || 60), pv = Number(args[2] || 60), s0 = Number(args[3] || 1), W = Number(args[4] || 4);
  const sementes = Array.from({ length: n }, (_, i) => s0 + i);
  const L = []; let vivos = 0;
  await new Promise((ok) => {
    for (let w = 0; w < W; w++) {
      const mine = sementes.filter((_, i) => i % W === w); if (!mine.length) continue; vivos++;
      const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { sementes: mine, pa, pv } });
      wk.on('message', (m) => { if (m.fim) { if (--vivos === 0) ok(); } else L.push(m); });
      wk.on('error', (e) => { console.error(e); if (--vivos === 0) ok(); });
    }
  });
  L.sort((a, b) => a.semente - b.semente);
  const mm = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (!process.argv.includes('--json')) for (const x of L) console.log(`#${x.semente} ${x.vencedor || 'SEM VENCEDOR'} ${mm(x.duracao)} abates ${x.azul.abates}-${x.vermelho.abates} torres ${x.vermelho.torresPerdidas}-${x.azul.torresPerdidas} inib ${x.vermelho.inibidoresPerdidos}-${x.azul.inibidoresPerdidos} dragoes ${x.azul.dragoes}-${x.vermelho.dragoes} baroes ${x.azul.baroes}-${x.vermelho.baroes} cs/min ${x.cs.toFixed(1)} ganks ${x.ganksAbate}/${x.ganks} presos ${x.presos} (${(x.ms / 1000).toFixed(1)}s)`);
  const med = (f) => (L.reduce((s, x) => s + f(x), 0) / L.length);
  const vit = L.filter((x) => x.vencedor === 'azul').length;
  const dur = L.map((x) => x.duracao).sort((a, b) => a - b);
  const resumo = { partidas: L.length, duracaoMediaMin: +(med((x) => x.duracao) / 60).toFixed(1), duracaoMinMax: [mm(dur[0]), mm(dur[dur.length - 1])], abates: +med((x) => x.azul.abates + x.vermelho.abates).toFixed(1), torresDerrubadas: +med((x) => x.azul.torresPerdidas + x.vermelho.torresPerdidas).toFixed(1),
    inibidores: +med((x) => x.azul.inibidoresPerdidos + x.vermelho.inibidoresPerdidos).toFixed(1), objetivos: +med((x) => x.objetivos).toFixed(1), csPorMin: +med((x) => x.cs).toFixed(1), ganksPorJogo: +med((x) => x.ganks).toFixed(1), ganksComAbate: +med((x) => x.ganksAbate).toFixed(1),
    azulVenceu: `${vit}/${L.length}`, semVencedor: L.filter((x) => !x.vencedor).length, motivos: Object.fromEntries([...new Set(L.map((x) => x.motivo))].map((m) => [m, L.filter((x) => x.motivo === m).length])), primeiraTorreMin: +(med((x) => x.primeiraTorre || x.duracao) / 60).toFixed(1), presosGraves: L.reduce((s, x) => s + x.presos, 0), minionsOciosos: L.reduce((s, x) => s + x.minionsOciosos, 0), erros: L.reduce((s, x) => s + x.erros, 0), cpuPorPartidaS: +(med((x) => x.ms) / 1000).toFixed(1) };
  console.log(process.argv.includes('--json') ? JSON.stringify(resumo) : '--- ' + JSON.stringify(resumo, null, 1));
}
