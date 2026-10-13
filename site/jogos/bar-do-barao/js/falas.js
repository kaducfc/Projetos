// Falas dos personagens. São só ambientação: o motor de regras nunca as lê e nenhuma fala muda uma decisão.
// O "falador" decide SE o personagem comenta (chance por tipo de evento e por personalidade, com intervalo entre falas)
// e QUAL frase usa (nunca repete as últimas que ele mesmo disse). Usa um sorteio próprio, separado do da partida.
import { CARTAS } from './config.js';
import { ACOES } from './motor.js';

const FALAS = {
  b1: {
    acao: ['Toda dívida chega à minha mesa.', 'Hora de cobrar o que é meu.', 'Eu não peço duas vezes.', 'Aqui ninguém escapa da conta.', 'Anote aí: tributo é tributo.'],
    renda: ['Moeda pouca também enche o bolso.', 'Devagar, mas sempre cobrando.', 'Troco miúdo, juro graúdo.', 'Cada ficha conta.'],
    ataque: ['Nada pessoal. É só negócio.', 'Você me deve, e vai pagar caro.', 'A casa cobra, e a casa sou eu.', 'Hoje alguém sai mais leve.', 'Sem choro. Pagou, saiu.'],
    contesta: ['Mostre essa carta. Agora.', 'Eu não engulo essa história.', 'Mentira tem cheiro, amigo.', 'Vira essa carta, vamos ver.', 'Duvido. Prove.'],
    blefePego: ['Hunf... você me pegou.', 'Foi só um deslize. Não se acostume.', 'Ninguém viu isso, certo?', 'Que azar maldito.'],
    provaOk: ['Pagou para ver. Agora paga a conta.', 'Eu avisei. Eu sempre cobro.', 'Era de verdade. Surpreso?', 'Tá aqui. Pode chorar.'],
    perdeu: ['Isso vai custar caro para alguém.', 'Arranhão. Só isso.', 'Já levei pior em beco escuro.', 'Anotei quem fez isso.'],
    eliminado: ['Esta dívida... ainda não está quitada.', 'Vocês vão se arrepender de me cobrar assim.'],
    venceu: ['Todas as contas foram fechadas. A casa é minha.', 'Quem deve, paga. Eu sempre recebo.'],
    bloqueia: ['Aqui não passa.', 'Meu bolso não é de graça.', 'Tente outra porta.', 'Isso não vai rolar comigo.'],
  },
  b2: {
    acao: ['Interessante. Você tem certeza dessa história?', 'Todo mundo fala. Eu anoto.', 'Calculei isso há duas rodadas.', 'Tudo dentro do planejado.', 'Os fatos, apenas os fatos.'],
    renda: ['Paciência rende mais que pressa.', 'Um passo de cada vez.', 'Informação não custa, mas moeda ajuda.', 'Sem alarde.'],
    ataque: ['Eu observei bastante antes de decidir.', 'Os números não mentem.', 'Era só uma questão de tempo.', 'Dados não têm sentimento. Eu também não.'],
    contesta: ['Isso não bate com o que eu ouvi.', 'Prove. Com a carta, por favor.', 'Algo nessa história está fora do lugar.', 'Tenho minhas dúvidas, e elas têm fundamento.', 'Seu padrão não fecha.'],
    blefePego: ['Hm. Subestimei a mesa.', 'Informação errada. Acontece.', 'Registro corrigido.', 'Uma falha de leitura, nada mais.'],
    provaOk: ['Eu errei a conta. Foi caro.', 'Registrado: não duvidar de você.', 'Hum. Dessa vez estava certo.', 'Preciso revisar meu caderno.'],
    perdeu: ['Fica anotado.', 'Uma perda calculada, quase.', 'Interessante. Dói de verdade.', 'Ainda tenho informação suficiente.'],
    eliminado: ['Meu caderno termina por aqui...', 'Alguém vai me ler depois.'],
    venceu: ['Tudo se resolve para quem escuta com atenção.', 'Observar sempre rende mais que gritar.'],
    bloqueia: ['Isso eu sei que você não pode fazer.', 'Negado, com educação.', 'Não neste cenário.', 'Previsível. Bloqueado.'],
  },
  b3: {
    acao: ['Eu? Mentir? Nesta mesa, jamais.', 'Confie em mim. Todo mundo confia.', 'Olha só o que eu tenho aqui...', 'Juro que é verdade. Quase.', 'Aposta comigo? Eu empresto a sorte.'],
    renda: ['Às vezes a jogada esperta é parecer bobo.', 'Um trocadinho para o próximo golpe.', 'Quietinho. Por enquanto.', 'Sem pressa, eu tenho truques.'],
    ataque: ['Surpresa! A sorte vira rápido por aqui.', 'Era para ser uma noite tranquila.', 'Desculpa, escorregou a faca.', 'Cartas na mesa? Só as minhas.'],
    contesta: ['Aposto que está blefando. Eu sei como é.', 'Vai, mostra. Eu adoro suspense.', 'Esse sorriso é falso, eu reconheço.', 'Ih, cheirou a blefe.', 'Quer apostar quanto?'],
    blefePego: ['Ha! Valeu a tentativa.', 'Quase colou, não foi?', 'Ops. Ninguém viu, né?', 'Faz parte do show!'],
    provaOk: ['Ora, ora... dessa vez era verdade!', 'Que azar o seu. Que sorte a minha.', 'Eu sou honesto às vezes.', 'Viu? Eu não minto... sempre.'],
    perdeu: ['Era a carta que eu menos gostava mesmo.', 'Só um arranhão no show.', 'Dói, mas rende uma boa história.', 'Ainda tenho truque na manga.'],
    eliminado: ['A casa sempre ganha... menos hoje.', 'Foi divertido enquanto durou!'],
    venceu: ['E você achando que eu estava mentindo. Eu estava, mas ganhei.', 'Aplausos, por favor. Moderados.'],
    bloqueia: ['Claro que eu tenho. Confie.', 'Não vai dar, amigo.', 'Essa eu conheço de longe.', 'Ah, essa não.'],
  },
};
const POR_CARTA = { magnata: CARTAS.magnata.fala, lamina: CARTAS.lamina.fala, cobrador: CARTAS.cobrador.fala, corretor: CARTAS.corretor.fala, sentinela: CARTAS.sentinela.fala };

// Chance base de comentar cada tipo de evento (lances grandes sempre rendem fala) e quanto cada um fala em geral.
const CHANCE = { acao: 0.4, renda: 0.15, ataque: 0.7, contesta: 0.6, blefePego: 0.85, provaOk: 0.85, perdeu: 0.5, eliminado: 1, venceu: 1, bloqueia: 0.5 };
const FALANTE = { b1: 1, b2: 0.7, b3: 1.3 };
const FORTES = new Set(['eliminado', 'venceu', 'blefePego', 'provaOk']);
const INTERVALO = 3; // eventos mínimos entre duas falas de qualquer personagem (menos nos lances fortes)
const MEMORIA = 6; // quantas falas recentes de um personagem não podem se repetir

// Evento do histórico → quem comenta, em que categoria e com qual influência declarada.
export function situacao(e, humano = 'eu') {
  let id; let cat; let inf = null;
  switch (e.tipo) {
    case 'acao': id = e.quem; inf = ACOES[e.acao].alegacao; cat = ['renda', 'ajuda'].includes(e.acao) ? 'renda' : ['assassinato', 'golpe'].includes(e.acao) ? 'ataque' : 'acao'; break;
    case 'bloqueio': id = e.quem; cat = 'bloqueia'; inf = e.inf; break;
    case 'desafio': id = e.desafiante; cat = 'contesta'; break;
    case 'prova': id = e.quem; cat = 'provaOk'; break;
    case 'blefe': id = e.quem; cat = 'blefePego'; break;
    case 'perdeu': id = e.quem; cat = 'perdeu'; break;
    case 'eliminado': id = e.quem; cat = 'eliminado'; break;
    case 'vitoria': id = e.quem; cat = 'venceu'; break;
    default: return null;
  }
  return id === humano ? null : { id, cat, inf };
}

export function criarFalador(rng = Math.random) {
  const recentes = {}; // id -> últimas falas
  let desdeUltima = 99; // eventos desde a última fala (de qualquer um)
  return {
    // devolve { id, txt } ou null (o personagem fica quieto)
    comentar(e, humano = 'eu') {
      const s = situacao(e, humano);
      desdeUltima++;
      if (!s) return null;
      const forte = FORTES.has(s.cat);
      if (!forte && desdeUltima < INTERVALO) return null;
      if (rng() >= Math.min(1, CHANCE[s.cat] * (FALANTE[s.id] ?? 1))) return null;
      const lista = [...(FALAS[s.id]?.[s.cat] ?? [])];
      if (s.inf && (s.cat === 'acao' || s.cat === 'bloqueia')) lista.push(POR_CARTA[s.inf]);
      const hist = recentes[s.id] ?? (recentes[s.id] = []);
      let livres = lista.filter((x) => !hist.includes(x));
      if (!livres.length) livres = lista;
      if (!livres.length) return null;
      const txt = livres[Math.floor(rng() * livres.length)];
      hist.push(txt); if (hist.length > MEMORIA) hist.shift();
      desdeUltima = 0;
      return { id: s.id, txt };
    },
  };
}
