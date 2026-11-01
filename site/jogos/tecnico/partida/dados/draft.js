// Picks e bans do amistoso: ordem, regras e escolhas do adversário (controlado pelo computador). Lógica pura, sem tela.
import { criarRng } from '../nucleo/rng.js';
import { posicoesDe } from './campeoes-sim.js';

export const VAGAS = ['top', 'selva', 'meio', 'atirador', 'suporte'];
const POS = { top: 'Top', selva: 'Jungle', meio: 'Mid', atirador: 'ADC', suporte: 'Suporte' };
const A = 'azul', V = 'vermelho';
// 3 bans de cada lado, 6 picks, mais 2 bans de cada lado e os 4 últimos picks (azul sempre abre).
export const ORDEM = [
  ...[A, V, A, V, A, V].map((lado) => ({ tipo: 'ban', lado })),
  ...[A, V, V, A, A, V].map((lado) => ({ tipo: 'pick', lado })),
  ...[V, A, V, A].map((lado) => ({ tipo: 'ban', lado })),
  ...[V, A, A, V].map((lado) => ({ tipo: 'pick', lado })),
];

// opc.invertida: quem joga na tela (o time "azul" do draft) é, na verdade, o lado vermelho da partida, então escolhe depois.
export function novoDraft(catalogo, azul, vermelho, semente, opc = {}) {
  const ordem = opc.invertida ? ORDEM.map((p) => ({ ...p, lado: p.lado === A ? V : A })) : ORDEM;
  return { ordem, catalogo, jogadores: { azul, vermelho }, passo: 0, bans: { azul: [], vermelho: [] }, picks: { azul: {}, vermelho: {} }, rng: criarRng((Number(semente) || 1) ^ 0x5bd1e995 ) };
}
export const passoAtual = (d) => (d.ordem || ORDEM)[d.passo] || null;
export const terminou = (d) => d.passo >= (d.ordem || ORDEM).length;
export const jogadorDaVaga = (d, lado, vaga) => d.jogadores[lado].find((j) => j.pos === vaga);
export const indisponiveis = (d) => new Set([...d.bans.azul, ...d.bans.vermelho, ...Object.values(d.picks.azul).map((c) => c.nome), ...Object.values(d.picks.vermelho).map((c) => c.nome)]);
export const serve = (c, vaga) => posicoesDe(c).includes(POS[vaga]); // campeão nativo da vaga
export const EFIC_FORA_POSICAO = 0.92; // campeão fora da posição nativa: -8% de eficiência (maestria continua valendo)
export const vagasLivres = (d, lado) => VAGAS.filter((v) => !d.picks[lado][v] && jogadorDaVaga(d, lado, v));
const favorito = (d, lado, vaga, c) => (jogadorDaVaga(d, lado, vaga)?.favoritos || []).some((f) => f.nome === c.nome || f.id === c.id);

// Escolhe um campeão (ban ou pick). Devolve false se a jogada for inválida.
export function banir(d, nome) {
  const p = passoAtual(d);
  if (!p || p.tipo !== 'ban') return false;
  const c = d.catalogo.find((x) => x.nome === nome);
  if (!c || indisponiveis(d).has(nome)) return false;
  d.bans[p.lado].push(nome); d.passo++;
  return true;
}
export function escolher(d, nome, vaga) {
  const p = passoAtual(d);
  if (!p || p.tipo !== 'pick') return false;
  const c = d.catalogo.find((x) => x.nome === nome);
  if (!c || indisponiveis(d).has(nome) || !vagasLivres(d, p.lado).includes(vaga)) return false; // qualquer campeão serve em qualquer vaga; fora da posição nativa há penalidade de eficiência
  d.picks[p.lado][vaga] = c; d.passo++;
  return true;
}

// Jogada do computador no passo atual.
export function jogadaIA(d) {
  const p = passoAtual(d); if (!p) return;
  const usados = indisponiveis(d);
  const livres = (vaga) => { const n = d.catalogo.filter((c) => !usados.has(c.nome) && serve(c, vaga)); return n.length ? n : d.catalogo.filter((c) => !usados.has(c.nome)); };
  if (p.tipo === 'ban') {
    const alvo = p.lado === A ? V : A; // bane o que o adversário mais gostaria de jogar
    const cobiçados = [];
    for (const j of d.jogadores[alvo]) for (const f of j.favoritos || []) { const c = d.catalogo.find((x) => x.nome === f.nome || x.id === f.id); if (c && !usados.has(c.nome) && !d.picks[alvo][j.pos]) cobiçados.push(c); }
    const pool = cobiçados.length && d.rng() < 0.7 ? cobiçados : d.catalogo.filter((c) => !usados.has(c.nome) && d.jogadores[alvo].some((j) => serve(c, j.pos)));
    banir(d, pool[Math.floor(d.rng() * pool.length)].nome);
    return;
  }
  const vagas = vagasLivres(d, p.lado);
  // prefere a vaga em que o jogador ainda tem um favorito disponível; senão a vaga com menos opções
  let melhor = null;
  for (const v of vagas) {
    const favs = livres(v).filter((c) => favorito(d, p.lado, v, c));
    const nOp = livres(v).length;
    const nota = favs.length ? -1000 + nOp : nOp;
    if (!melhor || nota < melhor.nota) melhor = { v, favs, nota };
  }
  const pool = melhor.favs.length ? melhor.favs : livres(melhor.v);
  escolher(d, pool[Math.floor(d.rng() * pool.length)].nome, melhor.v);
}

// Resultado final: jogadores com o campeão escolhido (formato esperado pelo motor da partida) e os bans.
export function resultadoDraft(d) {
  const com = (lado) => d.jogadores[lado].map((j) => { const campeao = d.picks[lado][j.pos]; return { ...j, campeao, eficiencia: (j.eficiencia ?? 1) * (campeao && !serve(campeao, j.pos) ? EFIC_FORA_POSICAO : 1) }; });
  return { azul: com(A), vermelho: com(V), bans: { azul: [...d.bans.azul], vermelho: [...d.bans.vermelho] } };
}
