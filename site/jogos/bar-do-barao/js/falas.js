// Falas dos personagens. São só ambientação: o motor de regras nunca as lê e nenhuma fala muda uma decisão.
// Escolhidas pela situação; cartas declaradas usam a frase da própria carta (config.js) com chance de variar por personagem.
import { CARTAS } from './config.js';

const FALAS = {
  b1: {
    acao: ['Toda dívida chega à minha mesa.', 'Hora de cobrar o que é meu.'],
    renda: ['Moeda pouca também enche o bolso.', 'Devagar, mas sempre cobrando.'],
    ataque: ['Nada pessoal. É só negócio.', 'Você me deve, e vai pagar caro.'],
    contesta: ['Mostre essa carta. Agora.', 'Eu não engulo essa história.'],
    blefePego: ['Hunf... você me pegou.', 'Foi só um deslize. Não se acostume.'],
    provaOk: ['Pagou para ver. Agora paga a conta.', 'Eu avisei. Eu sempre cobro.'],
    perdeu: ['Isso vai custar caro para alguém.', 'Arranhão. Só isso.'],
    eliminado: ['Esta dívida... ainda não está quitada.'],
    venceu: ['Todas as contas foram fechadas. A casa é minha.'],
    bloqueia: ['Aqui não passa.', 'Meu bolso não é de graça.'],
  },
  b2: {
    acao: ['Interessante. Você tem certeza dessa história?', 'Todo mundo fala. Eu anoto.'],
    renda: ['Paciência rende mais que pressa.', 'Um passo de cada vez.'],
    ataque: ['Eu observei bastante antes de decidir.', 'Os números não mentem.'],
    contesta: ['Isso não bate com o que eu ouvi.', 'Prove. Com a carta, por favor.'],
    blefePego: ['Hm. Subestimei a mesa.', 'Informação errada. Acontece.'],
    provaOk: ['Eu errei a conta. Foi caro.', 'Registrado: não duvidar de você.'],
    perdeu: ['Fica anotado.', 'Uma perda calculada, quase.'],
    eliminado: ['Meu caderno termina por aqui...'],
    venceu: ['Tudo se resolve para quem escuta com atenção.'],
    bloqueia: ['Isso eu sei que você não pode fazer.', 'Negado, com educação.'],
  },
  b3: {
    acao: ['Eu? Mentir? Nesta mesa, jamais.', 'Confie em mim. Todo mundo confia.'],
    renda: ['Às vezes a jogada esperta é parecer bobo.', 'Um trocadinho para o próximo golpe.'],
    ataque: ['Surpresa! A sorte vira rápido por aqui.', 'Era para ser uma noite tranquila.'],
    contesta: ['Aposto que está blefando. Eu sei como é.', 'Vai, mostra. Eu adoro suspense.'],
    blefePego: ['Ha! Valeu a tentativa.', 'Quase colou, não foi?'],
    provaOk: ['Ora, ora... dessa vez era verdade!', 'Que azar o seu. Que sorte a minha.'],
    perdeu: ['Era a carta que eu menos gostava mesmo.', 'Só um arranhão no show.'],
    eliminado: ['A casa sempre ganha... menos hoje.'],
    venceu: ['E você achando que eu estava mentindo. Eu estava, mas ganhei.'],
    bloqueia: ['Claro que eu tenho. Confie.', 'Não vai dar, amigo.'],
  },
};
// frases extras por carta declarada em contexto especial
const POR_CARTA = { magnata: CARTAS.magnata.fala, lamina: CARTAS.lamina.fala, cobrador: CARTAS.cobrador.fala, corretor: CARTAS.corretor.fala, sentinela: CARTAS.sentinela.fala };

// Sorteia uma fala de forma estável a partir do número do evento (não consome o gerador da partida).
export function fala(id, categoria, n = 0, inf = null) {
  if (inf && (categoria === 'acao' || categoria === 'bloqueia') && n % 2 === 0) return POR_CARTA[inf];
  const lista = FALAS[id]?.[categoria];
  return lista ? lista[n % lista.length] : null;
}
