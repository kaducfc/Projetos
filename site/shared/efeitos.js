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
  { id: 'nv-cristal', nome: 'Cristal de Gelo', classe: 'fx-nv-cristal', preco: 1000, como: 'Compre por 1.000 RC.' },
  { id: 'gl-corrompido', nome: 'Dado Corrompido', classe: 'fx-gl-corrompido', preco: 10000, como: 'Compre por 10.000 RC.' },
  // Exclusivo do cartão de visita (código no verso). Visual provisório (o do Apoiador): troque `classe`
  // quando o efeito próprio estiver pronto.
  { id: 'ev-cartao', nome: 'Cartão Rift Arcade', classe: 'fx-reflexo', titulo: 'Exclusivo do cartão de visita do Rift Arcade',
    como: 'Exclusivo de quem recebeu o cartão de visita do Rift Arcade. Resgate o código em Meu perfil.' },
  // Só por código de recompensa (RIFTFINALCBLOL2026). `oculto`: só aparece na lista de quem já tem.
  { id: 'lj-negativo', nome: 'Final CBLOL 2026', classe: 'fx-lj-negativo', titulo: 'Final do CBLOL 2026', oculto: true,
    como: 'Exclusivo de quem resgatou o código da Final do CBLOL 2026.' },
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
  // Zaun e Piltover (cada letra anima por conta própria; ver nickFxHtml)
  { id: 'zn-cintila', nome: 'Cintila', classe: 'fx-zn-cintila', letras: true, tema: 'Zaun · a droga roxa de Vander: frasco de latão com líquido roxo e gota escorrendo' },
  { id: 'zn-vapor', nome: 'Válvula de Vapor', classe: 'fx-zn-vapor', letras: true, tema: 'Zaun · cano enferrujado e vapor de pressão' },
  { id: 'zn-neon', nome: 'Neon do Submundo', classe: 'fx-zn-neon', letras: true, tema: 'Zaun · letreiro roxo, letra defeituosa e descarga' },
  { id: 'pl-cristal', nome: 'Cristal Hextech', classe: 'fx-pl-cristal', letras: true, tema: 'Piltover · cristal azul, carga e reflexos' },
  { id: 'pl-latao', nome: 'Latão e Engrenagens', classe: 'fx-pl-latao', letras: true, tema: 'Piltover · latão polido e engrenagens girando' },
  { id: 'pl-holo', nome: 'Holograma de Progresso', classe: 'fx-pl-holo', letras: true, tema: 'Piltover · projeção azul com feixe de varredura' },
  { id: 'nv-magma', nome: 'Magma', classe: 'fx-nv-magma', tema: 'Laranja e preto · lava e brasas' },
  { id: 'nv-synth', nome: 'Noite Retrô', classe: 'fx-nv-synth', tema: 'Rosa, amarelo e ciano · listras anos 80' },
  { id: 'nv-raio', nome: 'Tempestade', classe: 'fx-nv-raio', tema: 'Azul elétrico · relâmpago' },
  { id: 'nv-sakura', nome: 'Sakura', classe: 'fx-nv-sakura', tema: 'Rosa · pétalas caindo' },
  { id: 'lj-ondas', nome: 'Ondas Sonoras', classe: 'fx-lj-ondas', tema: 'Laranja e preto · ondas que dividem o nome' },
  { id: 'lj-alerta', nome: 'Fita de Alerta', classe: 'fx-lj-alerta', tema: 'Preto e laranja · listras de aviso' },
  { id: 'lj-eclipse', nome: 'Eclipse', classe: 'fx-lj-eclipse', tema: 'Preto, laranja e branco · disco de fogo' },
  { id: 'lj-eq', nome: 'Equalizador', classe: 'fx-lj-eq', tema: 'Preto, laranja e branco · barras de som' },
  { id: 'lj-faisca', nome: 'Faíscas', classe: 'fx-lj-faisca', tema: 'Laranja e branco · ferro quente' },
  { id: 'lj-prata', nome: 'Faíscas Prata', classe: 'fx-lj-prata', tema: 'Preto, branco e laranja · metal com reflexo' },
  { id: 'lj-pulso', nome: 'Faíscas Pulso', classe: 'fx-lj-pulso', tema: 'Preto, branco e laranja · brilho que respira' },
];

// De EFEITOS_TESTE, só estes dá para equipar (o servidor só os libera para o
// administrador, via site_recompensas); os demais continuam só na aba Teste.
export const EQUIPAVEIS_TESTE = ['gl-matrix']; // Código Verde: recompensa do passe Zaun e Piltover (em teste)
export const efeitoPorId = (id) => EFEITOS.find((e) => e.id === id)
  || (EQUIPAVEIS_TESTE.includes(id) ? EFEITOS_TESTE.find((e) => e.id === id) : null) || null;

// Qual efeito aparece no nick. `escolha`: null = automático, 'nenhum' = sem
// efeito, ou o id. Um id que o site não conhece (ainda em teste) cai no automático.
export function efeitoAtivo(escolha, apoiador = false) {
  if (escolha === 'nenhum') return null;
  return efeitoPorId(escolha) || (apoiador ? efeitoPorId('reflexo') : null);
}

// HTML do nome com o efeito. Efeitos com `letras: true` recebem cada letra num <i> próprio (--i = posição, --n = total),
// para o CSS animar letra por letra (ondas, uma letra que falha, uma que pinga…). O texto inteiro continua em data-text
// e em aria-label (leitores de tela e as camadas ::before/::after que copiam o nome); cada letra também leva data-c,
// para o CSS desenhar uma cópia dela por cima (ex.: o líquido dentro da borda de metal da Cintila).
const escHtml = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function nickFxHtml(fx, nome, titulo = '') {
  const texto = String(nome ?? '');
  const t = titulo ? ` title="${escHtml(titulo)}"` : '';
  if (!fx?.letras) return `<span class="nick fx ${escHtml(fx?.classe || '')}" data-text="${escHtml(texto)}"${t}>${escHtml(texto)}</span>`;
  const letras = [...texto];
  // Classe de altura da letra (o CSS usa para achar a "linha do líquido" de cada uma): maiúsculas, números e hastes (k-a),
  // letras de altura do x (k-x), as de altura do x com cauda (k-d) e o resto, como _ e . (k-u).
  const alt = (c) => (/[A-Z0-9bdfhiklt]/.test(c) ? 'k-a' : /[gjpqy]/.test(c) ? 'k-d' : /[acemnorsuvwxz]/.test(c) ? 'k-x' : 'k-u');
  return `<span class="nick fx fx-l ${escHtml(fx.classe)}" data-text="${escHtml(texto)}" style="--n:${letras.length}" role="text" aria-label="${escHtml(texto)}"${t}>${letras.map((c, i) => `<i style="--i:${i}" class="${alt(c)}" data-c="${escHtml(c)}" aria-hidden="true">${escHtml(c)}</i>`).join('')}</span>`;
}
