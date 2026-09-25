// Configuração do site de minigames: nome, Supabase e catálogo de jogos.

export const SITE_NAME = 'Rift Arcade';

// Projeto Supabase próprio do site (separado do Idle Hunter).
// Preencha com Project Settings → API do projeto novo. Enquanto estiver
// vazio, o site funciona só em modo visitante (tudo no navegador).
// A chave "publishable" é pública por natureza: a segurança vem das regras
// RLS do banco. Nunca coloque aqui a chave service_role.
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

// Logos dos times nos jogos:
//   'escudos'  → escudo próprio do site (padrão). Usa a arte em
//                assets/emblemas/<id>.png se existir; senão, o escudo gerado.
//   'oficiais' → logo oficial em assets/times/<id>.png para todos os times
//                que tiverem o arquivo.
export const TEAM_LOGOS = 'escudos';

// Times com logo oficial liberada mesmo no modo 'escudos' (ex.: times que
// autorizaram o uso). Use o id do time, como em assets/times/README.md.
// Exemplo: export const OFFICIAL_LOGOS_ALLOWED = ['loud', 'png'];
export const OFFICIAL_LOGOS_ALLOWED = [];

// Catálogo exibido no hub. `path` é relativo à raiz do site.
// status: 'live' (jogável) ou 'soon' (em breve).
export const GAMES = [
  {
    id: 'carreira-no-rift',
    name: 'Carreira no Rift',
    tagline: 'Crie seu jogador aos 16 anos e leve a carreira da base ao Mundial.',
    kind: 'Simulador de carreira',
    path: 'jogos/carreira-no-rift/',
    status: 'live',
    scoreLabel: 'Pontos de legado',
  },
  {
    id: 'quiz-do-rift',
    name: 'Quiz do Rift',
    tagline: 'Perguntas rápidas sobre campeões, times e a história do cenário.',
    kind: 'Quiz',
    status: 'soon',
  },
  {
    id: 'adivinhe-o-pro',
    name: 'Adivinhe o Pro',
    tagline: 'Descubra o jogador profissional pelas dicas: time, rota, país e títulos.',
    kind: 'Adivinhação diária',
    status: 'soon',
  },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
