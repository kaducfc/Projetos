// Simula partidas completas em lote (sem interface) e imprime estatísticas de equilíbrio.
// Uso: node simular-lote.mjs [n=10] [poderAzul=60] [poderVermelho=60] [semente0=1]
import { Partida } from '../motor/partida.js';
import { readFileSync } from 'node:fs';
const aqui = new URL('.', import.meta.url);
const catalogo = JSON.parse(readFileSync(new URL('../../../campeao/dados/campeoes.json', aqui), 'utf8')).campeoes.map((c) => ({ ...c, id: c.nome }));
export const POS = ['top', 'selva', 'meio', 'atirador', 'suporte'];
export const time = (eq, p, variacao = 0) => POS.map((pos, i) => { const b = Math.max(1, Math.min(100, p + (((i * 7 + eq.charCodeAt(0)) % 5) - 2) * variacao)); return { id: `${eq}${i}`, nome: `${eq}-${pos}`, pos, poder: b, atributos: { mec: b, rotas: b, macro: b, tf: b, mental: b, fama: 50 } }; });
export function jogar(semente, pa, pv, regras) {
  const P = new Partida({ azul: time('A', pa, 3), vermelho: time('V', pv, 3), semente, catalogo, regras });
  const t0 = performance.now();
  const r = P.executarAteFim();
  return { P, r, ms: performance.now() - t0 };
}
if (process.argv[1] && process.argv[1].endsWith('simular-lote.mjs')) {
  const n = Number(process.argv[2] || 10), pa = Number(process.argv[3] || 60), pv = Number(process.argv[4] || 60), s0 = Number(process.argv[5] || 1);
  const L = [];
  for (let i = 0; i < n; i++) {
    const { P, r, ms } = jogar(s0 + i, pa, pv);
    const cs = P.campeoes.reduce((s, c) => s + c.estat.cs + c.estat.csSelva, 0) / 10 / (r.duracao / 60);
    L.push({ r, ms, cs });
    console.log(`#${s0 + i} ${r.vencedor || 'SEM VENCEDOR'} ${Math.floor(r.duracao / 60)}:${String(r.duracao % 60).padStart(2, '0')} abates ${r.equipes.azul.abates}-${r.equipes.vermelho.abates} torres ${r.equipes.vermelho.torresPerdidas}-${r.equipes.azul.torresPerdidas} inib ${r.equipes.vermelho.inibidoresPerdidos}-${r.equipes.azul.inibidoresPerdidos} dragoes ${r.equipes.azul.dragoes}-${r.equipes.vermelho.dragoes} baroes ${r.equipes.azul.baroes}-${r.equipes.vermelho.baroes} cs/min ${cs.toFixed(1)} presos ${r.diagnostico.presosGraves} ${r.motivo} (${(ms / 1000).toFixed(1)}s)`);
  }
  const med = (f) => (L.reduce((s, x) => s + f(x), 0) / L.length).toFixed(1);
  const vit = L.filter((x) => x.r.vencedor === 'azul').length;
  console.log(`--- média: duração ${med((x) => x.r.duracao / 60)} min | abates ${med((x) => x.r.equipes.azul.abates + x.r.equipes.vermelho.abates)} | torres ${med((x) => x.r.equipes.azul.torresPerdidas + x.r.equipes.vermelho.torresPerdidas)} | cs/min ${med((x) => x.cs)} | azul venceu ${vit}/${n} | sem vencedor ${L.filter((x) => !x.r.vencedor).length} | ${med((x) => x.ms / 1000)} s de CPU por partida`);
}
