// Configuração do site de minigames: nome, Supabase e catálogo de jogos.

export const SITE_NAME = 'Rift Arcade';

// Projeto Supabase próprio do site (separado do Idle Hunter).
// Preencha com Project Settings → API do projeto novo. Enquanto estiver
// vazio, o site funciona só em modo visitante (tudo no navegador).
// A chave "publishable" é pública por natureza: a segurança vem das regras
// RLS do banco. Nunca coloque aqui a chave service_role.
export const SUPABASE_URL = 'https://ixmtnizxirmmcpwdzoeu.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_gA7cL3RGWOnuLqwrlTGL5w_eMigpxdn';

// E-mail de contato mostrado nas páginas de privacidade, termos e "Quem somos".
export const CONTACT_EMAIL = 'riftarcadeoficial@gmail.com';

// Link de doação (Pix, Ko-fi, Livepix…). Vazio = botão "Apoiar" escondido.
// As doações são opcionais, só para manter o site no ar, e não dão vantagem
// nenhuma nos jogos.
export const DONATION_URL = '';

// Logos dos times nos jogos:
//   'oficiais' → logo oficial em assets/times/<id>.png para todos os times
//                que tiverem o arquivo (padrão atual).
//   'escudos'  → escudo próprio do site. Usa a arte em
//                assets/emblemas/<id>.png se existir; senão, o escudo gerado.
// Se algum time pedir para tirar a logo, troque para 'escudos' e libere só
// quem autorizou em OFFICIAL_LOGOS_ALLOWED.
export const TEAM_LOGOS = 'oficiais';

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
    id: 'runetermo',
    name: 'Runetermo',
    tagline: 'Uma palavra do universo de LoL por dia. Descubra em 6 tentativas.',
    kind: 'Palavra do dia',
    path: 'jogos/runetermo/',
    status: 'live',
    scoreLabel: 'Pontos',
  },
  {
    id: 'campeao',
    name: 'Campeão Oculto',
    tagline: 'Um campeão por dia. Descubra pelas pistas: região, posição, classe, espécie e mais.',
    kind: 'Campeão do dia',
    path: 'jogos/campeao/',
    status: 'live',
    scoreLabel: 'Pontos',
  },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
