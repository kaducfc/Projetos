// Conexões do Rift: regras puras (sem tela). Um quebra-cabeça tem 16 palavras e 4 grupos de 4; o jogador junta
// as palavras que têm algo em comum e o jogo acaba quando os 4 grupos são encontrados.
import { GRUPOS, FAMILIAS_CAMPEAO, norm } from './grupos.js';

export const TAMANHO = 4;
export const NOME_JOGO = 'Conexões do Rift';
export { GRUPOS, FAMILIAS_CAMPEAO, norm };

// Gerador pseudoaleatório com semente (o desafio do dia é igual para todo mundo; os testes são reproduzíveis).
export function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function semente(texto) {
  let h = 2166136261;
  for (const ch of String(texto)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const escolher = (rand, lista) => lista[Math.floor(rand() * lista.length)];
const embaralhar = (rand, lista) => {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Padrões de dificuldade dos 4 grupos (1 = fácil … 4 = difícil), com o peso de cada um.
export const PADROES = [
  [[1, 2, 3, 4], 28], [[1, 2, 3, 3], 20], [[1, 2, 2, 3], 16], [[1, 1, 2, 3], 10],
  [[2, 2, 3, 4], 10], [[1, 2, 2, 4], 8], [[2, 3, 3, 4], 4], [[1, 1, 2, 2], 4],
];
function sortearPadrao(rand) {
  const total = PADROES.reduce((s, [, p]) => s + p, 0);
  let x = rand() * total;
  for (const [padrao, peso] of PADROES) { x -= peso; if (x < 0) return padrao; }
  return PADROES[0][0];
}

// Monta um quebra-cabeça: 4 grupos de famílias diferentes (no máximo 2 só de campeões) e 4 palavras de cada que não
// pertencem a nenhum dos outros 3 grupos escolhidos (assim cada palavra tem um único lugar certo).
export function criarPuzzle(rand) {
  for (let tentativa = 0; tentativa < 400; tentativa++) {
    const padrao = sortearPadrao(rand);
    const escolhidos = [];
    const familias = new Set();
    let ok = true;
    for (const dif of padrao) {
      const candidatos = GRUPOS.filter((g) => g.dif === dif && !familias.has(g.fam) && !escolhidos.includes(g));
      if (!candidatos.length) { ok = false; break; }
      const g = escolher(rand, candidatos);
      escolhidos.push(g); familias.add(g.fam);
    }
    if (!ok || escolhidos.filter((g) => FAMILIAS_CAMPEAO.has(g.fam)).length > 2) continue;
    const grupos = [];
    for (const g of escolhidos) {
      const outros = escolhidos.filter((x) => x !== g);
      const livres = g.p.filter((w) => !outros.some((o) => o.chaves.has(norm(w))));
      if (livres.length < TAMANHO) { grupos.length = 0; break; }
      grupos.push({ id: g.id, tit: g.tit, dif: g.dif, fam: g.fam, palavras: embaralhar(rand, livres).slice(0, TAMANHO) });
    }
    if (grupos.length !== escolhidos.length) continue;
    const todas = grupos.flatMap((g) => g.palavras);
    if (new Set(todas.map(norm)).size !== todas.length) continue;
    // ordem de dificuldade (a cor): do mais fácil ao mais difícil
    grupos.forEach((g, i) => { g.ordem = i; });
    return { grupos, palavras: embaralhar(rand, todas) };
  }
  throw new Error('não foi possível montar um quebra-cabeça');
}
export const puzzleDoDia = (dia) => criarPuzzle(aleatorio(semente(`conexoes:${dia}`)));

// ------------------------------------------------------------------ partida
export function novoJogo(puzzle) {
  return { puzzle, sel: [], resolvidos: [], tentativas: 0, dicas: 0, marcadas: [], historico: [], quase: false, fim: false, ordem: [...puzzle.palavras] };
}
const grupoDe = (est, palavra) => est.puzzle.grupos.find((g) => g.palavras.includes(palavra));
export const palavrasRestantes = (est) => est.ordem.filter((w) => !est.resolvidos.some((i) => est.puzzle.grupos[i].palavras.includes(w)));

// Clique numa palavra: seleciona (até 4) ou desmarca.
export function alternar(est, palavra) {
  if (est.fim || !palavrasRestantes(est).includes(palavra)) return est;
  est.quase = false;
  const i = est.sel.indexOf(palavra);
  if (i >= 0) est.sel.splice(i, 1);
  else if (est.sel.length < TAMANHO) est.sel.push(palavra);
  return est;
}

// Com 4 palavras selecionadas, confere o grupo. Devolve { tipo: 'ok'|'erro'|'nada', grupo?, quase? }.
export function conferir(est) {
  if (est.fim || est.sel.length !== TAMANHO) return { tipo: 'nada' };
  est.tentativas++;
  const alvo = grupoDe(est, est.sel[0]);
  if (alvo && est.sel.every((w) => alvo.palavras.includes(w))) {
    const idx = est.puzzle.grupos.indexOf(alvo);
    est.resolvidos.push(idx);
    est.historico.push({ tipo: 'ok', ordem: alvo.ordem });
    est.sel = []; est.quase = false;
    if (est.resolvidos.length === est.puzzle.grupos.length) est.fim = true;
    return { tipo: 'ok', grupo: alvo };
  }
  // "falta só uma": 3 das 4 palavras são do mesmo grupo ainda não achado
  const quase = est.puzzle.grupos.some((g, i) => !est.resolvidos.includes(i) && est.sel.filter((w) => g.palavras.includes(w)).length === 3);
  est.historico.push({ tipo: 'erro' });
  est.sel = []; est.quase = quase;
  return { tipo: 'erro', quase };
}

// Dica: marca palavras de um grupo ainda não achado (2 na primeira dica daquele grupo, depois mais 1, até 3).
export const MAX_MARCADAS = 3;
export function podeDica(est) {
  return !est.fim && est.puzzle.grupos.some((g, i) => !est.resolvidos.includes(i) && g.palavras.filter((w) => est.marcadas.includes(w)).length < MAX_MARCADAS);
}
export function dica(est) {
  if (!podeDica(est)) return null;
  const idx = est.puzzle.grupos.findIndex((g, i) => !est.resolvidos.includes(i) && g.palavras.filter((w) => est.marcadas.includes(w)).length < MAX_MARCADAS);
  const g = est.puzzle.grupos[idx];
  const ja = g.palavras.filter((w) => est.marcadas.includes(w)).length;
  const novas = g.palavras.filter((w) => !est.marcadas.includes(w)).slice(0, ja === 0 ? 2 : 1);
  est.marcadas.push(...novas);
  est.dicas++;
  est.historico.push({ tipo: 'dica' });
  est.quase = false;
  return { grupo: g, palavras: novas };
}

// Embaralha as palavras que ainda estão no tabuleiro.
export function misturar(est, rand = Math.random) {
  const resto = embaralhar(rand, palavrasRestantes(est));
  const feitas = est.ordem.filter((w) => !resto.includes(w));
  est.ordem = [...feitas, ...resto];
  return est;
}

// Pontos da partida: 100 menos 10 por erro e 5 por dica (mínimo 0).
export const erros = (est) => Math.max(0, est.tentativas - est.resolvidos.length);
export const pontos = (est) => Math.max(0, 100 - 10 * erros(est) - 5 * est.dicas);

// Texto para compartilhar (sem as palavras, para não estragar o desafio dos outros).
export const QUADRADOS = ['🟧', '🟩', '🟦', '🟪'];
export function textoCompartilhar(est, { titulo = NOME_JOGO, dia = '', link = '' } = {}) {
  const linha = est.historico.map((h) => (h.tipo === 'dica' ? '💡' : h.tipo === 'ok' ? QUADRADOS[h.ordem] : '⬛')).join('');
  return `${titulo}${dia ? ` · ${dia}` : ''}\n${linha}\n${est.tentativas} tentativas · ${est.dicas} dicas${link ? `\n${link}` : ''}`;
}

// Para guardar o andamento (o desafio do dia continua se a página for recarregada).
export const salvar = (est) => ({ grupos: est.puzzle.grupos.map((g) => g.id), palavras: est.puzzle.palavras, sel: est.sel, resolvidos: est.resolvidos, tentativas: est.tentativas, dicas: est.dicas, marcadas: est.marcadas, historico: est.historico, ordem: est.ordem, fim: est.fim });
export function restaurar(dados, puzzle) {
  const est = novoJogo(puzzle);
  const ok = dados && Array.isArray(dados.resolvidos) && Array.isArray(dados.historico) && JSON.stringify(dados.palavras) === JSON.stringify(puzzle.palavras);
  if (!ok) return est;
  Object.assign(est, { sel: dados.sel || [], resolvidos: dados.resolvidos, tentativas: dados.tentativas | 0, dicas: dados.dicas | 0, marcadas: dados.marcadas || [], historico: dados.historico, ordem: dados.ordem || est.ordem, fim: Boolean(dados.fim) });
  return est;
}
