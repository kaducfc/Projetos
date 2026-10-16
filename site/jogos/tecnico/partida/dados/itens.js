// Itens da partida (ouro de partida, não tem relação com RC nem com créditos da organização).
// Estrutura extensível: { id, nome, custo, categoria, stats, efeito?, restricao? }
// stats: ad, ap, hp, armadura, resist, as (fração de velocidade de ataque extra), ms (unidades), mana, vampiro (fração de roubo de vida), cdr (fração)
export const ITENS = {
  botas:          { id: 'botas', nome: 'Botas de Velocidade', custo: 300, categoria: 'botas', stats: { ms: 25 }, restricao: 'uma_bota' },
  botas_arm:      { id: 'botas_arm', nome: 'Botas Blindadas', custo: 1100, categoria: 'botas', stats: { ms: 45, armadura: 25 }, restricao: 'uma_bota' },
  botas_mr:       { id: 'botas_mr', nome: 'Botas de Mercúrio', custo: 1100, categoria: 'botas', stats: { ms: 45, resist: 25 }, restricao: 'uma_bota' },
  botas_ag:       { id: 'botas_ag', nome: 'Botas de Agilidade', custo: 1100, categoria: 'botas', stats: { ms: 45, as: 0.25 }, restricao: 'uma_bota' },
  botas_feit:     { id: 'botas_feit', nome: 'Botas do Feiticeiro', custo: 1100, categoria: 'botas', stats: { ms: 45, ap: 15 }, restricao: 'uma_bota' },
  espada_longa:   { id: 'espada_longa', nome: 'Espada Longa', custo: 350, categoria: 'ataque', stats: { ad: 10 } },
  picareta:       { id: 'picareta', nome: 'Picareta', custo: 875, categoria: 'ataque', stats: { ad: 25 } },
  lamina_sangue:  { id: 'lamina_sangue', nome: 'Lâmina Sanguinária', custo: 3000, categoria: 'ataque', stats: { ad: 55, vampiro: 0.1 } },
  gume:           { id: 'gume', nome: 'Gume do Infinito', custo: 3400, categoria: 'ataque', stats: { ad: 75 } },
  adaga:          { id: 'adaga', nome: 'Adaga', custo: 300, categoria: 'velocidade', stats: { as: 0.12 } },
  canhao:         { id: 'canhao', nome: 'Canhão Flamejante', custo: 2600, categoria: 'velocidade', stats: { as: 0.4, ad: 25 } },
  cajado:         { id: 'cajado', nome: 'Cajado Ampliador', custo: 350, categoria: 'magia', stats: { ap: 20 } },
  varinha:        { id: 'varinha', nome: 'Varinha Explosiva', custo: 850, categoria: 'magia', stats: { ap: 40 } },
  vazio:          { id: 'vazio', nome: 'Cajado do Vazio', custo: 2800, categoria: 'magia', stats: { ap: 85, mana: 200 } },
  chapeu:         { id: 'chapeu', nome: 'Chapéu da Morte', custo: 3600, categoria: 'magia', stats: { ap: 120 } },
  rubi:           { id: 'rubi', nome: 'Cristal Rubi', custo: 400, categoria: 'vida', stats: { hp: 150 } },
  colete:         { id: 'colete', nome: 'Colete de Cota', custo: 300, categoria: 'defesa', stats: { armadura: 15 } },
  peitoral:       { id: 'peitoral', nome: 'Peitoral de Placas', custo: 2700, categoria: 'defesa', stats: { armadura: 70, hp: 300 } },
  manto:          { id: 'manto', nome: 'Manto Nulificador', custo: 450, categoria: 'defesa', stats: { resist: 25 } },
  veu:            { id: 'veu', nome: 'Véu da Banshee', custo: 2900, categoria: 'defesa', stats: { resist: 60, hp: 350 } },
  coracao:        { id: 'coracao', nome: 'Coração Gelado', custo: 3000, categoria: 'defesa', stats: { hp: 400, armadura: 30, cdr: 0.2 } },
  amuleto:        { id: 'amuleto', nome: 'Amuleto do Suporte', custo: 1800, categoria: 'suporte', stats: { hp: 200, mana: 250, cdr: 0.1, ap: 30 } },
  pedra:          { id: 'pedra', nome: 'Pedra da Aliança', custo: 2300, categoria: 'suporte', stats: { hp: 250, ap: 50, mana: 300, cdr: 0.15 } },
};

// Ordem de compra por perfil de campeão (compra o próximo da lista quando tem ouro).
export const BUILDS = {
  tanque:    ['botas', 'colete', 'rubi', 'botas_arm', 'peitoral', 'coracao', 'veu', 'manto', 'peitoral'],
  lutador:   ['picareta', 'botas', 'rubi', 'lamina_sangue', 'botas_arm', 'coracao', 'gume', 'peitoral'],
  assassino: ['espada_longa', 'botas', 'picareta', 'lamina_sangue', 'botas_ag', 'gume', 'colete', 'peitoral'],
  mago:      ['cajado', 'botas', 'varinha', 'vazio', 'botas_feit', 'chapeu', 'colete', 'veu'],
  atirador:  ['adaga', 'botas', 'picareta', 'canhao', 'botas_ag', 'gume', 'lamina_sangue', 'colete'],
  suporte:   ['botas', 'amuleto', 'rubi', 'pedra', 'botas_mr', 'veu', 'coracao', 'peitoral'],
};
