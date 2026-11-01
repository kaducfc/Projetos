// Inteligência de jogo derivada dos atributos e da informação que a equipe realmente tem:
//   * Macro: visão do mapa (saber onde o inimigo está e agir com cautela quando não sabe), objetivos, rotações, wards.
//   * Mental: "desespero" quando o time está atrás: jogadas forçadas que pioram a situação (quanto mais Mental, menos isso acontece).
//   * Fase de rotas: no começo da partida, aproveitar vacilos do adversário e errar menos minions.
//   * Teamfight: escolha de alvo, posicionamento e quando ir com tudo (usado em campeao-ia.js).
import { dist } from '../nucleo/coord.js';

const lim = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * lim(t);

// Parâmetros de política por equipe: `P.politica[eq]` (opcional) sobrepõe `regras.ia` — usado nos estudos de calibração (ferramentas/estudo.mjs).
export function pol(P, eq, caminho) {
  const o = P.politica && P.politica[eq];
  if (o && caminho in o) return o[caminho];
  return caminho.split('.').reduce((a, k) => a[k], P.regras.ia);
}

// ---- informação
// Inimigos vivos que a equipe não vê agora e não viu nos últimos `janela` segundos (ou nunca viu).
export function inimigosSumidos(P, eq, janela = 12) {
  const vis = P.equipes[eq].visao; let n = 0, vivos = 0;
  for (const c of P.campeoes) {
    if (c.equipe === eq || c.morto) continue;
    vivos++; const v = vis[c.id];
    if (!v || (!v.visivel && P.t - v.t > janela)) n++;
  }
  return { n, vivos };
}
// 0..1: quanto da equipe inimiga está "no escuro".
export const incerteza = (P, eq) => { const s = inimigosSumidos(P, eq); return s.vivos ? s.n / s.vivos : 0; };
// A equipe tem visão (campeão, minion, estrutura ou ward) a até `raio` de um ponto?
export function visaoSobre(P, eq, x, y, raio = 1000) {
  for (const f of P.equipes[eq].fontes || []) if (Math.hypot(f.x - x, f.y - y) <= raio + Math.min(f.r, 400)) return true;
  return false;
}
// Macro médio da equipe (os decisores coletivos usam o time todo).
export const macroDaEquipe = (P, eq) => { const v = P.campeoes.filter((c) => c.equipe === eq); return v.length ? v.reduce((s, c) => s + c.m.macro, 0) / v.length : 0.5; };
// Quanto a falta de visão pesa nas decisões: quem tem Macro alto respeita o que não vê; quem tem pouco ignora.
export const cautelaDeVisao = (u) => lerp(0.15, 1, u.m.macro);

// ---- situação da partida
// 0..1: o quanto a equipe está atrás (ouro, abates, torres).
export function atraso(P, eq) {
  const E = P.equipes[eq], A = P.equipes[eq === 'azul' ? 'vermelho' : 'azul'];
  const ouro = (A.ouroTotal - E.ouroTotal) / Math.max(6000, A.ouroTotal);
  const ab = (A.abates - E.abates) / 10;
  const torres = (P.estruturas.filter((e) => e.equipe === eq && e.subtipo === 'torre' && e.morto).length - P.estruturas.filter((e) => e.equipe !== eq && e.subtipo === 'torre' && e.morto).length) / 6;
  return lim(ouro * 1.8 + ab * 0.4 + torres * 0.5);
}
// Desespero: estar atrás empurra o jogador a forçar jogadas ruins; o Mental alto o mantém racional.
export const desespero = (P, u) => atraso(P, u.equipe) * (1 - u.m.mental) * P.regras.ia.desespero;

// ---- fase de rotas: 1 no começo da partida, cai a 0 em `rotas.fim`; multiplicado pelo atributo
export function rotasCedo(P, u) {
  const fim = P.regras.atributos.rotas.fim; if (P.t >= fim) return 0;
  return u.m.rotas * (1 - 0.5 * P.t / fim);
}
