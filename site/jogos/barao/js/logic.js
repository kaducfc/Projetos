// Show do Barão: o que a tela precisa saber das regras. O jogo em si (sorteio das perguntas,
// conferência das respostas, ajudas e prêmio) roda no servidor (supabase/migrations/0066_barao_servidor.sql):
// aqui ficam só os números para desenhar a escada e o painel Acertar / Parar / Errar.
// 11 perguntas (3 fáceis, 3 médias, 4 difíceis e 1 quase impossível), três ajudas (Pinstouro = pular,
// Monstros do Vazio e Cartas do Twisted Fate) e sem pontos seguros: errar vale o degrau abaixo do
// que o jogador já tem.
export const NIVEIS = 11;
export const PREMIOS = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 250000, 500000, 1000000];
export const PULOS = 2;
// Na última pergunta nenhuma ajuda é permitida (Pinstouro, Monstros do Vazio ou cartas).
export const semAjuda = (nivel) => nivel >= NIVEIS;
// As três cartas começam viradas para baixo; ao escolher uma (só uma vez por partida), revela-se qual era.
export const CARTAS = [
  { id: 'azul', nome: 'Carta Azul', tira: 1 },
  { id: 'vermelha', nome: 'Carta Vermelha', tira: 2 },
  { id: 'dourada', nome: 'Carta Dourada', tira: 3 },
];
// Monstros do Vazio: o `img` é o id do campeão no Data Dragon (ícone quadrado).
export const MONSTROS = [
  { id: 'chogath', nome: 'Cho\'Gath', img: 'Chogath' },
  { id: 'khazix', nome: 'Kha\'Zix', img: 'Khazix' },
  { id: 'velkoz', nome: 'Vel\'Koz', img: 'Velkoz' },
];

export const letra = (i) => 'ABCD'[i];

// Prêmio ao parar na pergunta `nivel` (a pergunta atual ainda não foi respondida).
export const premioAoParar = (nivel) => (nivel > 1 ? PREMIOS[nivel - 2] : 0);
// Prêmio ao errar a pergunta `nivel`: o degrau abaixo do que o jogador já tinha.
export const premioAoErrar = (nivel) => (nivel > 2 ? PREMIOS[nivel - 3] : 0);
