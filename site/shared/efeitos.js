// Efeitos no nome (cosmético, sem vantagem nos jogos). O desenho de cada um
// fica em shared/account.css (classes .fx-*). Para lançar um efeito de
// EFEITOS_TESTE para todo mundo: mover o item para EFEITOS e trocar `tema`
// por `como` (o texto que explica como conseguir).

export const EFEITOS = [
  { id: 'reflexo', nome: 'Apoiador', classe: 'fx-reflexo', titulo: 'Apoiador do Rift Arcade',
    como: 'Apoie o Rift Arcade com qualquer valor e o efeito dourado fica liberado.', link: { href: '/apoiar/', texto: '♥ Apoiar o site' } },
  { id: 'st-nebulosa', nome: 'Streamer', classe: 'fx-st-nebulosa', titulo: 'Streamer parceiro do Rift Arcade',
    como: 'Efeito exclusivo para Streamers parceiros.' },
  // À venda por Rift Coins (site_loja, 0055_loja_efeitos.sql): `preco` só serve para mostrar.
  { id: 'st-galaxia', nome: 'Galáxia', classe: 'fx-st-galaxia', preco: 2000, como: 'Compre por 2.000 RC.' },
  { id: 'st-brasa', nome: 'Brasa', classe: 'fx-st-brasa', preco: 2000, como: 'Compre por 2.000 RC.' },
  { id: 'gl-corrompido', nome: 'Dado Corrompido', classe: 'fx-gl-corrompido', preco: 10000, como: 'Compre por 10.000 RC.' },
  // Exclusivo do cartão de visita (código no verso). Visual provisório (o do Apoiador): troque `classe`
  // quando o efeito próprio estiver pronto.
  { id: 'ev-cartao', nome: 'Cartão Rift Arcade', classe: 'fx-reflexo', titulo: 'Exclusivo do cartão de visita do Rift Arcade',
    como: 'Exclusivo de quem recebeu o cartão de visita do Rift Arcade. Resgate o código em Meu perfil.' },
  // Recompensas do Passe de Batalha Halloween 2026.
  { id: 'hw-teia', nome: 'Teia de Aranha', classe: 'fx-hw-teia', titulo: 'Passe de Batalha Halloween 2026',
    como: 'Recompensa do nível 6 do Passe de Batalha.', link: { href: '/passe/', texto: 'Ver o passe' } },
  { id: 'hw-neon', nome: 'Halloween 2026', classe: 'fx-hw-neon', titulo: 'Passe de Batalha Halloween 2026',
    como: 'Recompensa do nível 10 do Passe de Batalha.', link: { href: '/passe/', texto: 'Ver o passe' } },
];

// Só aparecem no painel do administrador (aba Teste) até serem aprovados.
export const EFEITOS_TESTE = [
  { id: 'st-contorno', nome: 'Contorno Twitch', classe: 'fx-st-contorno', tema: 'Streamer · Twitch' },
  { id: 'gl-fatiado', nome: 'Fatiado', classe: 'fx-gl-fatiado', tema: 'Glitch · intenso · faixas que escorregam' },
  { id: 'gl-matrix', nome: 'Código Verde', classe: 'fx-gl-matrix', tema: 'Glitch · médio · terminal verde' },
  { id: 'nv-magma', nome: 'Magma', classe: 'fx-nv-magma', tema: 'Laranja e preto · lava e brasas' },
  { id: 'nv-cristal', nome: 'Cristal de Gelo', classe: 'fx-nv-cristal', tema: 'Azul gelo · faceta e brilhos em estrela' },
  { id: 'nv-synth', nome: 'Noite Retrô', classe: 'fx-nv-synth', tema: 'Rosa, amarelo e ciano · listras anos 80' },
  { id: 'nv-raio', nome: 'Tempestade', classe: 'fx-nv-raio', tema: 'Azul elétrico · relâmpago' },
  { id: 'nv-sakura', nome: 'Sakura', classe: 'fx-nv-sakura', tema: 'Rosa · pétalas caindo' },
  { id: 'lj-ondas', nome: 'Ondas Sonoras', classe: 'fx-lj-ondas', tema: 'Laranja e branco · onda que divide o nome' },
  { id: 'lj-alerta', nome: 'Fita de Alerta', classe: 'fx-lj-alerta', tema: 'Preto e laranja · listras de aviso' },
  { id: 'lj-eclipse', nome: 'Eclipse', classe: 'fx-lj-eclipse', tema: 'Preto, laranja e branco · disco de fogo' },
  { id: 'lj-eq', nome: 'Equalizador', classe: 'fx-lj-eq', tema: 'Preto, laranja e branco · barras de som' },
  { id: 'lj-faisca', nome: 'Faíscas', classe: 'fx-lj-faisca', tema: 'Laranja e branco · ferro quente' },
];

// De EFEITOS_TESTE, só estes dá para equipar (o servidor só os libera para o
// administrador, via site_recompensas); os demais continuam só na aba Teste.
export const EQUIPAVEIS_TESTE = [];
export const efeitoPorId = (id) => EFEITOS.find((e) => e.id === id)
  || (EQUIPAVEIS_TESTE.includes(id) ? EFEITOS_TESTE.find((e) => e.id === id) : null) || null;

// Qual efeito aparece no nick. `escolha`: null = automático, 'nenhum' = sem
// efeito, ou o id. Um id que o site não conhece (ainda em teste) cai no automático.
export function efeitoAtivo(escolha, apoiador = false) {
  if (escolha === 'nenhum') return null;
  return efeitoPorId(escolha) || (apoiador ? efeitoPorId('reflexo') : null);
}
