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
];

// Só aparecem no painel do administrador (aba Teste) até serem aprovados.
export const EFEITOS_TESTE = [
  { id: 'st-neon', nome: 'Neon violeta', classe: 'fx-st-neon', tema: 'Streamer · roxo' },
  { id: 'st-aurora', nome: 'Aurora', classe: 'fx-st-aurora', tema: 'Streamer · cor livre' },
  { id: 'st-contorno', nome: 'Contorno Twitch', classe: 'fx-st-contorno', tema: 'Streamer · Twitch' },
  { id: 'st-glitch', nome: 'Glitch', classe: 'fx-st-glitch', tema: 'Streamer · Twitch' },
  { id: 'st-aovivo', nome: 'Ao vivo', classe: 'fx-st-aovivo', tema: 'Streamer · Twitch' },
  { id: 'hw-bruxas', nome: 'Galáxia das Bruxas', classe: 'fx-hw-bruxas', tema: 'Halloween · morcegos e chapéus' },
  { id: 'hw-nebulosa', nome: 'Nebulosa Abóbora', classe: 'fx-hw-nebulosa', tema: 'Halloween · abóboras' },
  { id: 'hw-assombrada', nome: 'Noite Assombrada', classe: 'fx-hw-assombrada', tema: 'Halloween · fantasmas' },
  { id: 'hw-teia', nome: 'Teia de Aranha', classe: 'fx-hw-teia', tema: 'Halloween · teia e aranhas' },
  { id: 'hw-neon', nome: 'Halloween 2026', classe: 'fx-hw-neon', tema: 'Halloween · contorno neon' },
  { id: 'hw-eclipse', nome: 'Eclipse Sangrento', classe: 'fx-hw-eclipse', tema: 'Halloween · caveiras e brasas' },
];

// De EFEITOS_TESTE, só estes dá para equipar (o servidor só os libera para o
// administrador, via site_recompensas); os demais continuam só na aba Teste.
export const EQUIPAVEIS_TESTE = ['hw-teia', 'hw-neon'];
export const efeitoPorId = (id) => EFEITOS.find((e) => e.id === id)
  || (EQUIPAVEIS_TESTE.includes(id) ? EFEITOS_TESTE.find((e) => e.id === id) : null) || null;

// Qual efeito aparece no nick. `escolha`: null = automático, 'nenhum' = sem
// efeito, ou o id. Um id que o site não conhece (ainda em teste) cai no automático.
export function efeitoAtivo(escolha, apoiador = false) {
  if (escolha === 'nenhum') return null;
  return efeitoPorId(escolha) || (apoiador ? efeitoPorId('reflexo') : null);
}
