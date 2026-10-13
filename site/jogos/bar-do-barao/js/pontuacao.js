// Pontuação da partida: de 10 a 100 pontos, somando colocação, cartas que sobraram e jogadas boas, menos os erros.
// Calcula tudo a partir do estado final (`est.historico` público + `est.registro` privado do motor) e é só leitura.
import { jogador, ativas, colocacao } from './motor.js';

export const PONTOS_MIN = 10;
export const PONTOS_MAX = 100;
export const BASE_COLOCACAO = { 1: 50, 2: 30, 3: 20, 4: 10 };
export const BONUS_CARTAS_FINAIS = { 2: 16, 1: 10 }; // só quem termina vivo (o vencedor)
export const POR_CARTA_TIRADA = 6; // tirou uma influência de um adversário (duvidando certo ou com Assassinato/Golpe)
export const MAX_CARTAS_TIRADAS = 6;
export const POR_ELIMINACAO = 6; // deu a última carta de um adversário
export const MAX_ELIMINACOES = 3;
export const POR_BLEFE_PASSOU = 2; // declarou uma carta que não tinha e ninguém duvidou
export const MAX_BLEFES = 5;
export const MOEDAS_POR_PONTO = 2; // 1 ponto a cada 2 moedas no cofre, no máximo 4
export const MAX_COFRE = 4;
export const SOBREVIVENCIA_MAX = 8; // proporcional ao tempo que ficou na mesa
export const PENA_DUVIDA_ERRADA = 3; // duvidou de uma alegação verdadeira
export const PENA_BLEFE_DESCOBERTO = 2; // teve o blefe descoberto

// Quem tirou cada carta: duvidar certo (blefe descoberto) credita o desafiante; Assassinato e Golpe creditam o autor da ação.
// Duvidar errado NÃO credita ninguém (quem duvidou é quem perdeu a carta).
export function cartasTiradas(est) {
  const creditos = []; // { de, para, eliminou }
  let ultimaAcao = null; let ultimoDesafio = null;
  est.historico.forEach((e, i) => {
    if (e.tipo === 'acao') ultimaAcao = e;
    else if (e.tipo === 'desafio') ultimoDesafio = e;
    else if (e.tipo === 'perdeu') {
      let quem = null;
      if (e.motivo === 'blefe_descoberto') quem = ultimoDesafio?.desafiante;
      else if (e.motivo === 'assassinato' || e.motivo === 'golpe') quem = ultimaAcao?.quem;
      if (quem && quem !== e.quem) creditos.push({ de: quem, para: e.quem, eliminou: est.historico[i + 1]?.tipo === 'eliminado' && est.historico[i + 1].quem === e.quem });
    }
  });
  return creditos;
}

// Detalhe e total de um jogador. `itens` só traz as linhas que valeram algo (para mostrar na tela).
export function pontuar(est, id) {
  const j = jogador(est, id);
  const col = colocacao(est, id) ?? 4;
  const itens = [];
  const add = (chave, valor, qtd = null) => { if (valor !== 0) itens.push({ chave, valor, qtd }); };

  add('colocacao', BASE_COLOCACAO[col], col);
  if (est.vencedor === id) add('cartas_finais', BONUS_CARTAS_FINAIS[ativas(j).length] ?? 0, ativas(j).length);

  const creditos = cartasTiradas(est).filter((c) => c.de === id);
  const tiradas = Math.min(MAX_CARTAS_TIRADAS, creditos.length);
  const elim = Math.min(MAX_ELIMINACOES, creditos.filter((c) => c.eliminou).length);
  add('cartas_tiradas', tiradas * POR_CARTA_TIRADA, tiradas);
  add('eliminacoes', elim * POR_ELIMINACAO, elim);

  const blefes = Math.min(MAX_BLEFES, est.registro.filter((r) => r.quem === id && !r.verdadeira).length);
  add('blefes', blefes * POR_BLEFE_PASSOU, blefes);

  const cofre = Math.min(MAX_COFRE, Math.floor(j.moedas / MOEDAS_POR_PONTO));
  add('cofre', cofre, j.moedas);

  const turnoFim = est.numTurno;
  const quandoSaiu = est.historico.find((e) => e.tipo === 'eliminado' && e.quem === id)?.turno ?? turnoFim;
  add('sobrevivencia', Math.round(SOBREVIVENCIA_MAX * Math.min(1, quandoSaiu / Math.max(1, turnoFim))));

  const duvidaErrada = est.historico.filter((e) => e.tipo === 'perdeu' && e.quem === id && e.motivo === 'desafio_perdido').length;
  const descoberto = est.historico.filter((e) => e.tipo === 'perdeu' && e.quem === id && e.motivo === 'blefe_descoberto').length;
  add('duvida_errada', -PENA_DUVIDA_ERRADA * duvidaErrada, duvidaErrada);
  add('blefe_descoberto', -PENA_BLEFE_DESCOBERTO * descoberto, descoberto);

  const bruto = itens.reduce((s, x) => s + x.valor, 0);
  return { total: Math.max(PONTOS_MIN, Math.min(PONTOS_MAX, bruto)), bruto, itens, colocacao: col };
}
