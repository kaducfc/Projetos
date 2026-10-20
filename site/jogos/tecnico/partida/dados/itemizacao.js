// Compra de itens SITUACIONAL e subcategorias dos campeões.
// Cada estilo (ver BUILDS em itens.js) ganha um modelo: itens fixos (o miolo da build) e vagas flexíveis que o jogador decide na hora da compra,
// olhando o time inimigo (motor/itemizacao.js). Vagas:
//   ?bota:<padrão>  botas: Blindadas/Mercúrio quando o inimigo tem quase só dano físico/mágico
//   ?def:<padrão>   defesa de tanque: armadura, resistência mágica ou vida, pelo tipo de dano que o inimigo causa
//   ?defs:<padrão>  o mesmo, com itens de suporte (Mikael, Zeke, Medalhão...)
//   ?pen:<padrão>   contra inimigos com muito tanque, troca por item de penetração (armadura ou mágica)
//   ?surv:<padrão>  item de sobrevivência do carregador: Anjo/Mortalha contra dano físico/mágico, Zhonya/Banshee para magos
import { ITENS } from './itens.js';
import { ESTILO_DO_CAMPEAO } from '../config/papeis.js';

export const MODELOS = {
  tanque:         ['rubi', 'botas', 'sunfire', '?bota:botas_arm', '?def:randuin', '?def:espinhos', 'warmog', '?def:kaenic'],
  tanque_ap:      ['rubi', 'botas', 'sunfire', '?bota:botas_mr', '?def:visagem', '?def:gargula', 'warmog', 'zhonya'],
  suporte_tank:   ['botas', 'medalhao', '?bota:botas_ion', 'redencao', '?defs:voto', '?defs:zeke', '?defs:mikael', '?defs:natureza'],
  encantador:     ['cajado', 'botas', 'incensario', '?bota:botas_ion', 'agua', '?defs:mikael', 'redencao', 'mandato'],
  mago:           ['cajado', 'botas', 'luden', '?bota:botas_feit', 'sombra', '?pen:chapeu', '?surv:zhonya', 'vazio'],
  mago_dot:       ['cajado', 'botas', 'liandry', '?bota:botas_feit', 'morello', '?pen:chapeu', '?surv:zhonya', 'vazio'],
  mago_tank:      ['cajado', 'botas', 'rylai', '?bota:botas_feit', 'liandry', '?surv:zhonya', '?pen:chapeu', 'vazio'],
  lutador_ap:     ['varinha', 'botas', 'liandry', '?bota:botas_ion', 'criador', '?surv:zhonya', 'demonico', '?pen:chapeu'],
  assassino_ap:   ['cajado', 'botas', 'luden', '?bota:botas_feit', 'sombra', '?surv:zhonya', '?pen:chapeu', 'vazio'],
  assassino_ad:   ['picareta', 'botas', 'youmuu', '?bota:botas_ion', 'serylda', 'hidra', '?surv:gume_noite', '?surv:anjo'],
  lutador:        ['picareta', 'botas', 'trindade', '?bota:botas_arm', '?pen:cutelo', 'sterak', '?surv:danca', '?surv:anjo'],
  lutador_tank:   ['rubi', 'botas', 'sunfire', '?bota:botas_arm', 'sterak', '?surv:danca', '?def:espinhos', 'warmog'],
  lutador_crit:   ['adaga', 'botas', 'fantasma', '?bota:botas_ag', '?pen:gume', 'dominik', '?surv:lamina_sangue', '?surv:anjo'],
  lutador_as:     ['adaga', 'botas', 'kraken', '?bota:botas_ag', '?pen:hidra', 'sterak', '?surv:lamina_sangue', '?surv:anjo'],
  hibrido_ad:     ['varinha', 'botas', 'gunblade', '?bota:botas_ion', 'trindade', 'nashor', '?surv:zhonya', '?surv:danca'],
  hibrido_ap:     ['varinha', 'botas', 'nashor', '?bota:botas_ion', 'gunblade', 'trindade', '?surv:zhonya', '?pen:rylai'],
  atirador:       ['adaga', 'botas', 'canhao', '?bota:botas_ag', '?pen:gume', 'fantasma', 'dominik', '?surv:lamina_sangue'],
  atirador_onhit: ['adaga', 'botas', 'kraken', '?bota:botas_ag', 'arco', 'furacao', 'dominik', '?surv:lamina_sangue'],
  atirador_ap:    ['varinha', 'botas', 'nashor', '?bota:botas_feit', 'liandry', '?surv:zhonya', '?pen:chapeu', 'lich'],
};

// Candidatos de cada tipo de vaga.
export const POOLS = {
  def: ['peitoral', 'randuin', 'espinhos', 'voto', 'homem_morto', 'manopla', 'coracao', 'sunfire', 'jaksho', 'gargula', 'veu', 'kaenic', 'visagem', 'mascara', 'natureza', 'warmog', 'coracao_aco'],
  defs: ['medalhao', 'zeke', 'mikael', 'voto', 'natureza', 'kaenic', 'visagem', 'mascara', 'randuin', 'gargula', 'manopla'],
  penAD: { crit: ['dominik', 'serylda', 'youmuu'], assassino: ['youmuu', 'serylda', 'dominik'], padrao: ['serylda', 'dominik', 'youmuu'] },
  penAP: ['vazio', 'sombra'],
  survAD: { contraAD: ['anjo', 'danca', 'gume_noite'], contraAP: ['maw', 'gume_noite', 'sterak'] },
  survAP: { contraAD: ['zhonya', 'anjo'], contraAP: ['veu', 'mascara'] },
};

// ------------------------------------------------------------------ posição e subcategoria
export const NOME_POSICAO = { top: 'Top', selva: 'Caçador', meio: 'Mid', atirador: 'ADC', suporte: 'Suporte' };
export const SUBCATEGORIA_DO_ESTILO = {
  tanque: 'Tanque', tanque_ap: 'Tanque', suporte_tank: 'Engajador', encantador: 'Encantador',
  mago: 'Mago', mago_dot: 'Mago', mago_tank: 'Mago', lutador_ap: 'Bruiser', assassino_ap: 'Assassino', assassino_ad: 'Assassino',
  lutador: 'Lutador', lutador_tank: 'Bruiser', lutador_crit: 'Lutador', lutador_as: 'Lutador', hibrido_ad: 'Híbrido', hibrido_ap: 'Híbrido',
  atirador: 'Atirador', atirador_onhit: 'Atirador', atirador_ap: 'Atirador',
};
// O mesmo campeão pode jogar em mais de uma posição e muda de papel (Karma no meio é mago, no suporte é encantadora).
export function estiloNaPosicao(estilo, pos) {
  if (!estilo || !MODELOS[estilo]) return estilo;
  if (pos === 'suporte') return ['tanque', 'tanque_ap', 'lutador_tank'].includes(estilo) ? 'suporte_tank' : estilo;
  if (estilo === 'encantador') return pos === 'atirador' ? 'atirador_ap' : 'mago';
  if (estilo === 'suporte_tank') return 'tanque';
  if (pos === 'atirador' && ['mago', 'mago_dot', 'mago_tank'].includes(estilo)) return 'atirador_ap';
  return estilo;
}
export const subcategoriaDoEstilo = (estilo, pos) => SUBCATEGORIA_DO_ESTILO[estiloNaPosicao(estilo, pos)] || 'Lutador';

// Subcategoria de um campeão numa posição (null se não estiver em config/papeis.js).
export const subcategoriaDoCampeao = (nome, pos) => (ESTILO_DO_CAMPEAO[nome] ? subcategoriaDoEstilo(ESTILO_DO_CAMPEAO[nome], pos) : null);

// Sanidade: todo item citado existe.
for (const [e, l] of Object.entries(MODELOS)) for (const x of l) if (!x.startsWith('?') && !ITENS[x]) throw new Error(`modelo ${e}: item ${x}`);
