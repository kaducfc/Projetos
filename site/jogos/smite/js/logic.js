// Smite Challenge: regras puras (sem DOM), testadas em tests/smite.test.mjs.
//
// O objetivo (dragão, Barão ou Arauto) começa com a vida cheia e vai caindo conforme aliados e adversários
// causam dano. O jogador só tem dois botões que machucam o objetivo: o Smite (golpear) e uma
// habilidade do campeão da selva. O Smite mata na hora se a vida do objetivo for MENOR OU IGUAL ao
// dano dele; quanto mais perto do dano do Smite (para menos), melhor.

// Os objetivos: cada um com a sua vida, a sua arte e o seu cenário (`cenario`: a imagem do covil; os dragões usam o
// covil verde-água e o Barão e o Arauto usam o covil roxo; `tema`: as cores do resto da tela). `icone`: onde cortar o rosto
// na arte para o ícone redondo (background-position / background-size). `niveis`: faixa do nível do jogador
// quando o objetivo aparece (o Arauto vem cedo, o Ancião e o Barão tarde) e, com ele, o dano do Smite.
export const OBJETIVOS = [
  { id: 'dragao-elemental', nome: 'Dragão Elemental', vida: 8000, tema: 'elemental', arte: 'img/dragao.webp', cenario: 'img/cenario.webp', icone: '30% 62% / 320%', pos: [37, 20, 38], posM: [12, 31, 76], niveis: [5, 16] },
  { id: 'dragao-anciao', nome: 'Dragão Ancião', vida: 11000, tema: 'anciao', arte: 'img/dragao-anciao.webp', cenario: 'img/cenario.webp', icone: '17% 72% / 320%', pos: [36, 19, 40], posM: [8, 31, 84], niveis: [13, 18] },
  { id: 'barao', nome: 'Barão Nashor', vida: 12000, tema: 'barao', arte: 'img/barao.webp', cenario: 'img/cenario-barao.webp', icone: '62% 10% / 260%', pos: [46, 14, 17], posM: [30, 28, 40], niveis: [12, 18] },
  { id: 'arauto', nome: 'Arauto do Vale', vida: 7000, tema: 'arauto', arte: 'img/arauto.webp', cenario: 'img/cenario-barao.webp', icone: '72% 28% / 230%', pos: [41, 22, 31], posM: [14, 33, 72], niveis: [7, 11] },
];
export const RODADAS = 5;
export const TEMPO_MAX = 50; // segundos de cada rodada
export const RECARGA_HAB = 6; // segundos de recarga da habilidade
// O dano do Smite (Golpear) depende do nível do jogador: até o 8 → 600; do 9 ao 12 → 900; do 13 em diante → 1200.
export const DANOS_SMITE = [600, 900, 1200];
export const NIVEL_MIN = 1;
export const NIVEL_MAX = 18;
export function danoDoSmite(nivel) {
  if (nivel <= 8) return 600;
  if (nivel <= 12) return 900;
  return 1200;
}
// Quanto tempo o objetivo leva para morrer depois de chegar perto do dano do Smite: fica menor a cada rodada.
export const JANELAS = [3.4, 3.0, 2.6, 2.2, 1.8];
export const MARGEM_ZERO = 600; // a partir daqui (vida ≤ dano − 600) a rodada vale 0
// O caçador inimigo também pode usar o Smite (o mesmo dano do jogador) quando a vida do objetivo está entre
// 5% acima e 30% abaixo do dano do Smite. Quanto mais baixa a vida dentro dessa faixa, mais provável.
export const FAIXA_ACIMA = 0.05;
export const FAIXA_ABAIXO = 0.30;
export const PROB_SMITE_INIMIGO = 0.8; // em 80% das rodadas o inimigo tem o feitiço pronto
// Pontos quando o seu time fica com o objetivo sem o seu Golpear ter garantido (errou ou nem usou).
export const PONTOS_TIME = 25;

// Cada time tem 1 topo, 1 selva, 1 meio e 1 atirador. O jogador é sempre o selva do time azul.
export const ROTAS = ['topo', 'selva', 'meio', 'atirador'];
export const ROTA_NOME = { topo: 'Topo', selva: 'Selva', meio: 'Meio', atirador: 'Atirador' };
// Quanto cada rota costuma bater no objetivo (sorteio entre o mínimo e o máximo).
const PESO_ROTA = { topo: [0.8, 1.2], selva: [0.7, 1.1], meio: [1.0, 1.4], atirador: [1.1, 1.6] };

// Campeões da selva. `hab`: a habilidade que também machuca o objetivo (só o do jogador a usa).
export const CAMPEOES = [
  { id: 'LeeSin', nome: 'Lee Sin', hab: 'Onda Sônica', dano: 380 },
  { id: 'Warwick', nome: 'Warwick', hab: 'Mandíbulas da Besta', dano: 330 },
  { id: 'JarvanIV', nome: 'Jarvan IV', hab: 'Golpe do Dragão', dano: 350 },
  { id: 'Nunu', nome: 'Nunu e Willump', hab: 'Consumir', dano: 400 },
  { id: 'Amumu', nome: 'Amumu', hab: 'Lançar Bandagem', dano: 300 },
  { id: 'Khazix', nome: "Kha'Zix", hab: 'Garras Famintas', dano: 340 },
  { id: 'Elise', nome: 'Elise', hab: 'Neurotoxina', dano: 310 },
  { id: 'MasterYi', nome: 'Mestre Yi', hab: 'Golpe Alpha', dano: 360 },
];
export const POR_ROTA = {
  topo: ['Garen', 'Darius', 'Malphite', 'Ornn', 'Sion', 'Mordekaiser', 'Camille', 'Renekton', 'Fiora'],
  selva: CAMPEOES.map((c) => c.id),
  meio: ['Ahri', 'Lux', 'Syndra', 'Zed', 'Yasuo', 'Orianna', 'Viktor', 'Veigar', 'Annie'],
  atirador: ['Jinx', 'Caitlyn', 'Ashe', 'Jhin', 'Kaisa', 'Ezreal', 'MissFortune', 'Draven', 'Tristana', 'Vayne'],
};

const NOMES = { MissFortune: 'Miss Fortune', Kaisa: "Kai'Sa", Khazix: "Kha'Zix", LeeSin: 'Lee Sin', JarvanIV: 'Jarvan IV', MasterYi: 'Mestre Yi', Nunu: 'Nunu e Willump' };
export const nomeCampeao = (id) => NOMES[id] || id;

// Gerador pseudoaleatório com semente (as rodadas ficam reproduzíveis nos testes).
export function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entre = (rand, a, b) => a + rand() * (b - a);
const escolher = (rand, lista) => lista[Math.floor(rand() * lista.length)];

// Pontos de uma rodada pela margem (dano do Smite − vida do objetivo na hora do golpe).
// 0 → 100; 30 → 90; 60 → 81; 150 → 56; 300 → 25; 600 ou mais → 0.
export function pontosDaMargem(margem) {
  if (!(margem >= 0)) return 0;
  const x = Math.max(0, 1 - margem / MARGEM_ZERO);
  return Math.round(100 * x * x);
}

export function classificar(margem) {
  if (margem <= 25) return { id: 'perfeito', rotulo: 'Perfeito!' };
  if (margem <= 90) return { id: 'otimo', rotulo: 'Ótimo!' };
  if (margem <= 220) return { id: 'bom', rotulo: 'Bom' };
  return { id: 'longe', rotulo: 'Passou longe' };
}

// Sorteia o objetivo da rodada (sem repetir o da rodada anterior).
export function proximoObjetivo(rand, anteriorId = null) {
  return escolher(rand, OBJETIVOS.filter((o) => o.id !== anteriorId));
}

// Nível dos outros jogadores: perto do nível do jogador (±1).
const nivelProximo = (rand, nivel) => Math.min(NIVEL_MAX, Math.max(NIVEL_MIN, nivel + Math.floor(rand() * 3) - 1));

// Monta os dois times: 4 aliados (o jogador é o selva) e 4 adversários, sem campeão repetido.
function montarTimes(rand, campeao, nivel) {
  const usados = new Set([campeao.id]);
  const sortear = (rota) => {
    const livres = POR_ROTA[rota].filter((id) => !usados.has(id));
    const id = escolher(rand, livres);
    usados.add(id);
    return id;
  };
  const lista = [];
  for (const rota of ROTAS) {
    lista.push(rota === 'selva'
      ? { id: 'voce', lado: 'azul', rota, champ: campeao.id, nivel }
      : { id: `a-${rota}`, lado: 'azul', rota, champ: sortear(rota), nivel: nivelProximo(rand, nivel) });
  }
  for (const rota of ROTAS) lista.push({ id: `e-${rota}`, lado: 'vermelho', rota, champ: sortear(rota), nivel: nivelProximo(rand, nivel) });
  return lista;
}

// Cria uma rodada: o objetivo, o dano do Smite, o campeão do jogador, os times e a lista de golpes
// (quem bate, quando e quanto). `n`: 0 a RODADAS - 1. Rodadas mais para a frente têm rajadas e janela menor.
export function criarRodada(rand, n = 0, objetivo = null) {
  const alvo = objetivo || proximoObjetivo(rand);
  const nivel = Math.floor(entre(rand, alvo.niveis[0], alvo.niveis[1] + 1));
  const smite = danoDoSmite(nivel);
  const campeao = escolher(rand, CAMPEOES);
  const participantes = montarTimes(rand, campeao, nivel);
  // Gatilho do Smite inimigo: a vida em que ele golpeia (ou nenhum). x = sqrt(sorteio) deixa a faixa mais
  // provável perto do fim (30% abaixo do dano do Smite) do que no começo (5% acima).
  const usaSmite = rand() < PROB_SMITE_INIMIGO;
  const x = Math.sqrt(rand());
  const gatilhoInimigo = usaSmite ? Math.round(smite * (1 + FAIXA_ACIMA - (FAIXA_ACIMA + FAIXA_ABAIXO) * x)) : null;
  const janela = JANELAS[Math.min(n, JANELAS.length - 1)] * entre(rand, 0.9, 1.1);
  const tx = entre(rand, 18, 32); // quando a vida chega perto do dano do Smite
  const folga = entre(rand, 60, 360); // quanto a vida ainda passa do dano do Smite nesse momento
  const vx = smite + folga;
  const r1 = (alvo.vida - vx) / tx;
  const r2 = vx / janela;
  // Só os outros jogadores batem sozinhos (o jogador só tem a habilidade e o Smite).
  const batedores = participantes.filter((p) => p.id !== 'voce');
  const pesos = batedores.map((p) => entre(rand, ...PESO_ROTA[p.rota]));
  const soma = pesos.reduce((a, b) => a + b, 0);
  const prob = 0.04 + 0.03 * n; // chance de rajada (golpe grande) em cada batida
  const eventos = [];
  batedores.forEach((p, i) => {
    const periodo = entre(rand, 0.55, 1.0);
    for (let t = entre(rand, 0.2, 0.9); t < TEMPO_MAX; t += periodo * entre(rand, 0.85, 1.15)) {
      const taxa = t < tx ? r1 : r2;
      let dano = taxa * (pesos[i] / soma) * periodo * entre(rand, 0.75, 1.25);
      if (rand() < prob) dano *= entre(rand, 1.6, 2.2);
      eventos.push({ t: Math.round(t * 1000) / 1000, quem: p.id, dano: Math.max(1, Math.round(dano)) });
    }
  });
  eventos.sort((a, b) => a.t - b.t);
  // A vida acumulada: o último golpe é cortado para a vida chegar a zero (e nada vem depois).
  let vida = alvo.vida;
  const golpes = [];
  for (const e of eventos) {
    if (vida <= 0) break;
    const dano = Math.min(e.dano, vida);
    vida -= dano;
    golpes.push({ ...e, dano, vida });
  }
  const ultimo = golpes[golpes.length - 1];
  return {
    n, objetivo: alvo, vidaMax: alvo.vida, nivel, smite, campeao, participantes, janela, tx, golpes, gatilhoInimigo,
    faixaMin: Math.round(smite * (1 - FAIXA_ABAIXO)), faixaMax: Math.round(smite * (1 + FAIXA_ACIMA)),
    morreEm: vida <= 0 ? ultimo.t : null, quemMata: vida <= 0 ? ultimo.quem : null,
  };
}

// Vida do objetivo no instante t (s) só pelos golpes dos outros jogadores.
export function vidaEm(rodada, t, danoExtra = 0) {
  let vida = rodada.vidaMax;
  for (const g of rodada.golpes) {
    if (g.t > t) break;
    vida = g.vida;
  }
  return Math.max(0, vida - danoExtra);
}

// O que acontece quando o jogador usa o Smite com `vida` de vida no objetivo.
export function resolverSmite(vida, smite) {
  if (vida <= 0) return { resultado: 'roubado', margem: null, pontos: 0 };
  if (vida > smite) return { resultado: 'cedo', margem: null, pontos: 0, faltou: vida - smite };
  const margem = smite - vida;
  return { resultado: 'garantido', margem, pontos: pontosDaMargem(margem), nota: classificar(margem) };
}

// ---------------------------------------------------------------------------------------------
// A rodada em andamento. A rodada só acaba quando o objetivo morre (por qualquer um) ou o tempo
// acaba; errar o Golpear não encerra nada. Quem dá o último golpe decide de que time é o objetivo:
//   - seu Golpear com a vida ≤ dano do Smite ........ 'garantido' (pontos pela margem)
//   - seu time (aliado ou sua habilidade) ........... 'time' (PONTOS_TIME)
//   - time inimigo (golpe ou Smite do selva) ........ 'roubado' (0)
export function novoEstado(rodada) {
  return { R: rodada, vida: rodada.vidaMax, idx: 0, smiteUsado: false, smiteFalhou: null, inimigoUsou: false, fim: null };
}

const encerrar = (est, fim) => { est.fim = fim; };

function morreu(est, quem, via) {
  const p = est.R.participantes.find((x) => x.id === quem);
  if (p && p.lado === 'azul') encerrar(est, { resultado: 'time', pontos: PONTOS_TIME, quem, via, margem: null });
  else encerrar(est, { resultado: 'roubado', pontos: 0, quem, via, margem: null });
}

// O selva inimigo golpeia quando a vida chega ao gatilho dele (se ainda estiver dentro da faixa).
function checarInimigo(est, eventos) {
  const R = est.R;
  if (est.fim || est.inimigoUsou || R.gatilhoInimigo == null || est.vida > R.gatilhoInimigo) return;
  est.inimigoUsou = true;
  if (est.vida < R.faixaMin) return; // a vida passou direto pela faixa (ex.: rajada): ele perdeu a hora
  const antes = est.vida;
  est.vida = Math.max(0, est.vida - R.smite);
  eventos.push({ tipo: 'smite-inimigo', quem: 'e-selva', dano: R.smite, antes, depois: est.vida });
  if (est.vida <= 0) morreu(est, 'e-selva', 'smite-inimigo');
}

// Aplica os golpes dos outros jogadores até o instante t (s). Devolve os eventos para a tela.
export function avancar(est, t) {
  const eventos = [];
  const R = est.R;
  while (!est.fim && est.idx < R.golpes.length && R.golpes[est.idx].t <= t) {
    const g = R.golpes[est.idx++];
    est.vida = Math.max(0, est.vida - g.dano);
    eventos.push({ tipo: 'golpe', quem: g.quem, dano: g.dano, vida: est.vida });
    if (est.vida <= 0) morreu(est, g.quem, 'golpe');
    else checarInimigo(est, eventos);
  }
  if (!est.fim && t >= TEMPO_MAX) encerrar(est, { resultado: 'roubado', pontos: 0, quem: null, via: 'tempo', margem: null });
  return eventos;
}

// A habilidade do campeão do jogador (Q). Se ela derruba o objetivo, é o seu time que fica com ele.
export function usarHabilidade(est) {
  const eventos = [];
  if (est.fim) return eventos;
  const dano = est.R.campeao.dano;
  est.vida = Math.max(0, est.vida - dano);
  eventos.push({ tipo: 'habilidade', quem: 'voce', dano, vida: est.vida });
  if (est.vida <= 0) morreu(est, 'voce', 'habilidade');
  else checarInimigo(est, eventos);
  return eventos;
}

// O Golpear do jogador. Com a vida ≤ dano do Smite, garante o objetivo (a rodada acaba). Com a vida acima,
// o Golpear é desperdiçado (bate no objetivo mas não mata) e a rodada continua.
export function usarGolpear(est) {
  const eventos = [];
  if (est.fim || est.smiteUsado) return eventos;
  est.smiteUsado = true;
  const smite = est.R.smite; const vida = est.vida;
  if (vida <= smite) {
    est.vida = 0;
    const margem = smite - vida;
    eventos.push({ tipo: 'golpear', quem: 'voce', dano: smite, vida: 0, margem });
    encerrar(est, { resultado: 'garantido', pontos: pontosDaMargem(margem), margem, quem: 'voce', via: 'golpear', nota: classificar(margem), vidaNoGolpe: vida });
    return eventos;
  }
  est.vida = vida - smite;
  est.smiteFalhou = { vida, faltou: vida - smite };
  eventos.push({ tipo: 'golpear-cedo', quem: 'voce', dano: smite, vida: est.vida, faltou: vida - smite });
  checarInimigo(est, eventos);
  return eventos;
}
