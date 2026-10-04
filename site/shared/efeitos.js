// Efeitos no nome (cosmético, sem vantagem nos jogos). O desenho de cada um
// fica em shared/account.css (classes .fx-*). Para lançar um efeito de
// EFEITOS_TESTE para todo mundo: mover o item para EFEITOS e trocar `tema`
// por `como` (o texto que explica como conseguir).

export const EFEITOS = [
  { id: 'reflexo', nome: 'Apoiador', classe: 'fx-reflexo', titulo: 'Apoiador do Rift Arcade',
    como: 'Apoie o Rift Arcade com qualquer valor e o efeito dourado fica liberado.', link: { href: '/apoiar/', texto: '♥ Apoiar o site' } },
];

// Só aparecem no painel do administrador (aba Teste) até serem aprovados.
export const EFEITOS_TESTE = [
  { id: 'st-nebulosa', nome: 'Nebulosa', classe: 'fx-st-nebulosa', tema: 'Streamer · roxo' },
  { id: 'st-neon', nome: 'Neon violeta', classe: 'fx-st-neon', tema: 'Streamer · roxo' },
  { id: 'st-galaxia', nome: 'Galáxia', classe: 'fx-st-galaxia', tema: 'Streamer · roxo' },
  { id: 'st-brasa', nome: 'Brasa', classe: 'fx-st-brasa', tema: 'Streamer · cor livre' },
  { id: 'st-aurora', nome: 'Aurora', classe: 'fx-st-aurora', tema: 'Streamer · cor livre' },
  { id: 'st-contorno', nome: 'Contorno Twitch', classe: 'fx-st-contorno', tema: 'Streamer · Twitch' },
  { id: 'st-glitch', nome: 'Glitch', classe: 'fx-st-glitch', tema: 'Streamer · Twitch' },
  { id: 'st-aovivo', nome: 'Ao vivo', classe: 'fx-st-aovivo', tema: 'Streamer · Twitch' },
];

export const efeitoPorId = (id) => EFEITOS.find((e) => e.id === id) || null;

// Qual efeito aparece no nick. `escolha`: null = automático, 'nenhum' = sem
// efeito, ou o id. Um id que o site não conhece (ainda em teste) cai no automático.
export function efeitoAtivo(escolha, apoiador = false) {
  if (escolha === 'nenhum') return null;
  return efeitoPorId(escolha) || (apoiador ? efeitoPorId('reflexo') : null);
}
