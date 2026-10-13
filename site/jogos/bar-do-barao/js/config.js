// Coup: O Bar do Barão — textos e parâmetros ajustáveis (nada aqui altera as regras, que ficam em motor.js).
// Personalidades dos bots: cada número vai de 0 a 1.
//   agressividade  — chance de atacar/roubar em vez de juntar moedas
//   blefe          — vontade de declarar uma carta que não tem
//   desconfianca   — quanto contesta as alegações dos outros
//   cautela        — quanto protege as próprias cartas (bloqueia/evita arriscar com poucas cartas)
//   vingança       — foco em quem o atacou ou o contestou antes
export const PERSONAGENS = {
  b1: { id: 'b1', nome: 'Brutus', titulo: 'o Cobrador', cor: '#c2410c', simbolo: '⚔', retrato: 'img/b1.webp',
    perfil: { agressividade: 0.85, blefe: 0.35, desconfianca: 0.4, cautela: 0.25, vinganca: 0.8 } },
  b2: { id: 'b2', nome: 'Sibil', titulo: 'a Informante', cor: '#2f7f9e', simbolo: '◈', retrato: 'img/b2.webp',
    perfil: { agressividade: 0.4, blefe: 0.12, desconfianca: 0.7, cautela: 0.75, vinganca: 0.3 } },
  b3: { id: 'b3', nome: 'Vexel', titulo: 'o Trapaceiro', cor: '#8b5cf6', simbolo: '♠', retrato: 'img/b3.webp',
    perfil: { agressividade: 0.55, blefe: 0.8, desconfianca: 0.5, cautela: 0.35, vinganca: 0.45 } },
};
export const JOGADOR_HUMANO = { id: 'eu', nome: 'Você', titulo: 'Forasteiro', cor: '#d9a82b', simbolo: '★' };
export const MESA = ['eu', 'b1', 'b2', 'b3'];

// Cartas: nome, símbolo (SVG simples feito em CSS/emoji-free), cor da moldura e a frase que elas "dizem" ao ser declaradas.
export const CARTAS = {
  magnata: { nome: 'Magnata', cor: '#4aa3ff', simbolo: '♛', acao: 'Cobrar tributos', original: 'Duque', fala: 'O preço da paz acaba de subir.' },
  lamina: { nome: 'Lâmina', cor: '#ef4444', simbolo: '†', acao: 'Assassinato', original: 'Assassino', fala: 'Você não vai sentir nada.' },
  cobrador: { nome: 'Ladrão', cor: '#f5cf5a', simbolo: '⛓', acao: 'Roubo', original: 'Capitão', fala: 'Toda dívida chega à minha mesa.' },
  corretor: { nome: 'Reciclador', cor: '#b57bff', simbolo: '⇄', acao: 'Troca de cartas', original: 'Embaixador', fala: 'Identidades são apenas mercadorias.' },
  sentinela: { nome: 'Sentinela', cor: '#4ade80', simbolo: '⛨', acao: 'Bloqueia assassinato', original: 'Condessa', fala: 'Este ataque termina aqui.' },
};
export const NOME_ACAO = {
  renda: 'Renda', ajuda: 'Ajuda Externa', tributos: 'Cobrar tributos', roubo: 'Roubo', troca: 'Troca de cartas', assassinato: 'Assassinato', golpe: 'Golpe',
};
export const DESCRICAO_ACAO = {
  renda: 'Pega 1 moeda. Não pode ser contestada nem bloqueada.',
  ajuda: 'Pega 2 moedas. Qualquer um pode bloquear dizendo ser o Magnata.',
  tributos: 'Pega 3 moedas. Exige o Magnata e pode ser contestada.',
  roubo: 'Rouba até 2 moedas de alguém. Exige o Ladrão; o alvo bloqueia com Ladrão ou Reciclador.',
  troca: 'Compra 2 cartas e devolve as que sobrarem. Exige o Reciclador.',
  assassinato: 'Paga 3 moedas e o alvo perde uma carta. Exige a Lâmina; o alvo bloqueia com a Sentinela.',
  golpe: 'Paga 7 moedas e o alvo perde uma carta. Não pode ser bloqueado nem contestado.',
};
// Tempo (ms) que cada bot "pensa" antes de agir, e do intervalo entre eventos na tela.
export const RITMO = { pensar: 900, evento: 650 };
// Imagens reais (cenário, logotipo, retratos) entram aqui quando forem enviadas; null usa a arte substituta em CSS/SVG.
export const ARTE = { cenario: 'img/cenario.webp', logo: null };
