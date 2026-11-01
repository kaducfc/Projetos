// Elencos sintéticos para a sala de testes e para as simulações em lote: cinco titulares com atributos iguais ao Poder pedido, com pequena variação.
import { criarRng } from '../nucleo/rng.js';
const NOMES = ['Zy', 'Kro', 'Vex', 'Ny', 'Tor', 'Kae', 'Mir', 'Dax', 'Lun', 'Ori', 'Bra', 'Sol', 'Ika', 'Rho', 'Vel', 'Axi'];
const SUF = ['n', 'x', 'ra', 'lis', 'ko', 'th', 'vik', 'zen'];
export const POSICOES = ['top', 'selva', 'meio', 'atirador', 'suporte'];
export function elencoTeste(equipe, poder, semente = 1, variacao = 6) {
  const r = criarRng(`${equipe}:${semente}:${poder}`);
  return POSICOES.map((pos, i) => {
    const v = (x) => Math.max(1, Math.min(100, Math.round(x + (r() - 0.5) * 2 * variacao)));
    const atributos = { mec: v(poder), rotas: v(poder), macro: v(poder), tf: v(poder), mental: v(poder), fama: v(50) };
    const nome = NOMES[Math.floor(r() * NOMES.length)] + SUF[Math.floor(r() * SUF.length)];
    return { id: `${equipe}${i + 1}`, nome, pos, atributos, poder: Math.round((atributos.mec * 25 + atributos.rotas * 20 + atributos.macro * 20 + atributos.tf * 20 + atributos.mental * 15) / 100) };
  });
}
