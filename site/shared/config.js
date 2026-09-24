// Configuração do site de minigames: nome, Supabase e catálogo de jogos.

export const SITE_NAME = 'Rift Arcade';

// Mesmo projeto Supabase do Idle Hunter. A chave "publishable" é pública
// por natureza (a segurança vem das regras RLS do banco).
export const SUPABASE_URL = 'https://xkcvvcvyzobnojgkkngy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_IpU7-k0nwnkQMxjBjjgNmA_TOkaIb_e';

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
