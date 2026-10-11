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
  { id: 'dragao-elemental', nome: 'Dragão Elemental', vida: 8000, tema: 'elemental', arte: 'img/dragao.webp', cenario: 'img/cenario.webp', icone: '3% 99% / 290%', pos: [37, 20, 38], posM: [12, 28.4, 76], niveis: [5, 16] },
  { id: 'dragao-anciao', nome: 'Dragão Ancião', vida: 11000, tema: 'anciao', arte: 'img/dragao-anciao.webp', cenario: 'img/cenario.webp', icone: '3% 77% / 280%', pos: [36, 19, 40], posM: [8, 31, 84], niveis: [13, 18] },
  { id: 'barao', nome: 'Barão Nashor', vida: 12000, tema: 'barao', arte: 'img/barao.webp', cenario: 'img/cenario-barao.webp', icone: '37% 10% / 160%', pos: [41.4, 0, 21.7], posM: [27.3, 9.3, 42], niveis: [12, 18] },
  { id: 'arauto', nome: 'Arauto do Vale', vida: 7000, tema: 'arauto', arte: 'img/arauto.webp', cenario: 'img/cenario-barao.webp', icone: '42% 11% / 190%', pos: [41.5, 36.7, 22.4], posM: [21.1, 26.6, 56], niveis: [7, 11] },
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
// A partida (5 rodadas) é um jogo só, do começo ao fim: o nível dos campeões sobe a cada rodada.
export const NIVEIS_RODADA = [[6, 8], [8, 10], [10, 12], [13, 15], [16, 18]];
export const JANELAS = [3.4, 3.0, 2.6, 2.2, 1.8];
// Pontos do Golpear pelo TEMPO: desde que a vida do objetivo entrou na zona do Smite (vida ≤ dano do Smite, por qualquer
// causa, inclusive o seu Q) até o seu Golpear matar. Rápido = mais pontos; o mínimo, com o objetivo do seu time, é PONTOS_TIME.
export const TEMPO_PERFEITO = 0.1; // até aqui vale de 100 a 90
export const TEMPO_MINIMO_PONTOS = 1.5; // daqui em diante vale só o mínimo (PONTOS_TIME)
// O caçador inimigo também pode usar o Smite (o mesmo dano do jogador) quando a vida do objetivo está entre
// 5% acima e 30% abaixo do dano do Smite. Quanto mais baixa a vida dentro dessa faixa, mais provável.
export const FAIXA_ACIMA = 0.05;
export const FAIXA_ABAIXO = 0.30;
export const PROB_SMITE_INIMIGO = 0.8; // em 80% das rodadas o inimigo tem o feitiço pronto
// Pontos quando o seu time fica com o objetivo sem o seu Golpear ter garantido (errou ou nem usou).
export const PONTOS_TIME = 25;
// Pontos quando é a habilidade do seu campeão (Q) que finaliza o objetivo (em vez do Golpear).
export const PONTOS_HABILIDADE = 50;

// Cada time tem 1 topo, 1 selva, 1 meio e 1 atirador. O jogador é sempre o selva do time azul.
export const ROTAS = ['topo', 'selva', 'meio', 'atirador'];
export const ROTA_NOME = { topo: 'Topo', selva: 'Selva', meio: 'Meio', atirador: 'Atirador' };
// Quanto cada classe bate no objetivo, sempre nessa proporção (dano em 3 segundos): o atirador bate mais e
// de forma constante (5 golpes de 200 = 1000); o meio bate um pouco menos, mais pausado (2 golpes de 400 = 800);
// o selva (o jogador e o selva inimigo) fica no meio termo entre o topo e o meio (500); o topo é tanque e bate pouco (200).
export const DANO_3S = { atirador: 1000, meio: 800, selva: 500, topo: 200 };
// Multiplicador de todos os ataques (aliados, adversários e o próprio jogador): +50% de dano em cada golpe.
export const MULT_DANO = 1.5;
// Ritmo de cada classe: tempo entre golpes (s) e quanto o tempo e o dano de cada golpe variam (fração).
export const RITMO = {
  atirador: { periodo: 0.6, variaT: 0.06, variaD: 0.08 },
  meio: { periodo: 1.5, variaT: 0.18, variaD: 0.15 },
  selva: { periodo: 1.0, variaT: 0.15, variaD: 0.15 },
  topo: { periodo: 1.2, variaT: 0.2, variaD: 0.25 },
};

// Campeões que o jogador pode ser (sorteia um por partida). Cada um tem a sua habilidade (Q), que também machuca o
// objetivo, com o próprio jeito de usar (`tipo`) e valores por posto (1 a 5; o posto sobe com o nível, ver `postoHab`):
//   duplo ... Lee Sin: Q1 (Onda Sônica) abre uma janela; Q2 (Golpe Ressonante) bate mais quanto menos vida o objetivo tem.
//   simples . Nunu e Kha'Zix: um toque, dano e recarga próprios.
//   carga ... Pantheon: toque rápido = estocada curta (devolve 60% da recarga); segurar = arremesso, com mais dano
//             quanto mais tempo segurou; segurar demais sem soltar cancela e a recarga é a metade.
//   armar ... Wukong: arma o próximo ataque (até 5 s), que ganha dano extra; cada golpe seu corta 0,5 s da recarga.
export const CAMPEOES = [
  { id: 'LeeSin', nome: 'Lee Sin', hab: 'Onda Sônica', tipo: 'duplo', dano: [90, 115, 140, 165, 190], dano2: [120, 160, 200, 240, 280], recarga: [9, 8, 7, 6, 5], janela: 3 },
  { id: 'Nunu', nome: 'Nunu e Willump', hab: 'Consumir', tipo: 'simples', dano: [330, 430, 530, 630, 730], recarga: [13, 12, 11, 10, 9] },
  { id: 'Khazix', nome: "Kha'Zix", hab: 'Garras Famintas', tipo: 'simples', dano: [120, 150, 180, 210, 240], recarga: [3, 3, 3, 3, 3] },
  { id: 'Pantheon', nome: 'Pantheon', hab: 'Lança Cometa', tipo: 'carga', dano: [110, 140, 170, 200, 230], dano2: [160, 210, 260, 310, 360], recarga: [11, 10.25, 9.5, 8.75, 8], toqueMax: 0.35, cargaCheia: 2, segurarMax: 4, devolve: 0.6, segundo: 0.5, bonusCarga: 0.5 },
  { id: 'MonkeyKing', nome: 'Wukong', hab: 'Golpe Devastador', tipo: 'armar', dano: [110, 140, 170, 200, 230], recarga: [8, 7.5, 7, 6.5, 6], janela: 5, corta: 0.5 },
];
export const POR_ROTA = {
  topo: ['Garen', 'Darius', 'Malphite', 'Ornn', 'Sion', 'Mordekaiser', 'Camille', 'Renekton', 'Fiora'],
  selva: ['LeeSin', 'Nunu', 'Khazix', 'Pantheon', 'MonkeyKing', 'Warwick', 'JarvanIV', 'Amumu', 'Elise', 'MasterYi'], // o selva inimigo e o do jogador saem daqui (sem repetir)
  meio: ['Ahri', 'Lux', 'Syndra', 'Zed', 'Yasuo', 'Orianna', 'Viktor', 'Veigar', 'Annie'],
  atirador: ['Jinx', 'Caitlyn', 'Ashe', 'Jhin', 'Kaisa', 'Ezreal', 'MissFortune', 'Draven', 'Tristana', 'Vayne'],
};

const NOMES = { MissFortune: 'Miss Fortune', Kaisa: "Kai'Sa", Khazix: "Kha'Zix", LeeSin: 'Lee Sin', JarvanIV: 'Jarvan IV', MasterYi: 'Mestre Yi', MonkeyKing: 'Wukong', Nunu: 'Nunu e Willump' };
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

// Pontos de uma rodada pelo tempo (s) entre a vida entrar na zona do Smite e o Golpear matar.
// 0 → 100; 0,1 s → 90 (nessa faixa cai de 100 a 90); de 0,1 a 1,5 s cai em linha reta de 90 até 25; 1,5 s ou mais → 25.
export function pontosDoTempo(seg) {
  if (!(seg >= 0)) return 0;
  if (seg <= TEMPO_PERFEITO) return Math.round(100 - 10 * (seg / TEMPO_PERFEITO));
  if (seg >= TEMPO_MINIMO_PONTOS) return PONTOS_TIME;
  return Math.round(90 - (90 - PONTOS_TIME) * ((seg - TEMPO_PERFEITO) / (TEMPO_MINIMO_PONTOS - TEMPO_PERFEITO)));
}

export function classificar(seg) {
  if (seg <= 0.1) return { id: 'perfeito', rotulo: 'Perfeito!' };
  if (seg <= 0.5) return { id: 'otimo', rotulo: 'Ótimo!' };
  if (seg <= 1.0) return { id: 'bom', rotulo: 'Bom' };
  return { id: 'longe', rotulo: 'Passou longe' };
}

// Sorteia o objetivo (sem repetir o anterior). Usado quando a rodada é criada sozinha (sem partida).
export function proximoObjetivo(rand, anteriorId = null) {
  return escolher(rand, OBJETIVOS.filter((o) => o.id !== anteriorId));
}

const objetivoPorId = (id) => OBJETIVOS.find((o) => o.id === id);

// Nível dos outros jogadores: perto do nível do jogador.
const limitarNivel = (n) => Math.min(NIVEL_MAX, Math.max(NIVEL_MIN, n));

// Monta os dois times: 4 aliados (o jogador é o selva) e 4 adversários, sem campeão repetido. `desloc`: quantos
// níveis o jogador está acima ou abaixo do jogador (-1, 0 ou +1, fixo na partida); `forca`: leve variação de dano.
function montarTimes(rand, campeao) {
  const usados = new Set([campeao.id]);
  const sortear = (rota) => {
    const livres = POR_ROTA[rota].filter((id) => !usados.has(id));
    const id = escolher(rand, livres);
    usados.add(id);
    return id;
  };
  const outro = (id, lado, rota) => ({ id, lado, rota, champ: sortear(rota), desloc: Math.floor(rand() * 3) - 1, forca: entre(rand, 0.92, 1.08) });
  const lista = [];
  for (const rota of ROTAS) lista.push(rota === 'selva' ? { id: 'voce', lado: 'azul', rota, champ: campeao.id, desloc: 0, forca: 1 } : outro(`a-${rota}`, 'azul', rota));
  for (const rota of ROTAS) lista.push(outro(`e-${rota}`, 'vermelho', rota));
  return lista;
}

// Cria uma partida: um jogo de RODADAS objetivos, com os mesmos campeões do começo ao fim, do objetivo mais fraco
// (campeões em nível baixo) ao mais forte (nível alto):
//   rodadas 1 e 2: Arauto do Vale e Dragão Elemental (em qualquer ordem)
//   rodada 3: Dragão Elemental · rodada 4: Dragão Elemental ou Barão · rodada 5: Barão ou Dragão Ancião
// Minuto mais cedo (em segundos de jogo) em que cada objetivo pode nascer: Dragão a partir dos 5 min, Arauto dos 15,
// Barão dos 20 e Dragão Ancião dos 30. A partida simulada só avança no tempo e cada objetivo nasce alguns segundos depois do mínimo.
export const TEMPO_MINIMO = { 'dragao-elemental': 300, arauto: 900, barao: 1200, 'dragao-anciao': 1800 };
const sortearTempo = (rand, objetivo, anterior) => Math.max(TEMPO_MINIMO[objetivo.id] + Math.floor(rand() * 240), anterior == null ? 0 : anterior + 150 + Math.floor(rand() * 150));

export function criarPartida(rand, campeaoId) {
  const campeao = CAMPEOES.find((c) => c.id === campeaoId) || escolher(rand, CAMPEOES);
  const [arauto, elemental, barao, anciao] = ['arauto', 'dragao-elemental', 'barao', 'dragao-anciao'].map(objetivoPorId);
  const objetivos = [
    ...(rand() < 0.5 ? [arauto, elemental] : [elemental, arauto]),
    elemental,
    rand() < 0.5 ? elemental : barao,
    rand() < 0.5 ? barao : anciao,
  ];
  const niveis = [];
  NIVEIS_RODADA.forEach(([a, b], i) => { niveis.push(Math.max(i ? niveis[i - 1] : 0, Math.floor(entre(rand, a, b + 1)))); });
  const tempos = [];
  objetivos.forEach((o, i) => tempos.push(sortearTempo(rand, o, i ? tempos[i - 1] : null)));
  return { campeao, equipe: montarTimes(rand, campeao), objetivos, niveis, tempos };
}

// Cria uma rodada: o objetivo, o dano do Smite, o campeão do jogador, os times e a lista de golpes
// (quem bate, quando e quanto). `n`: 0 a RODADAS - 1. Rodadas mais para a frente têm rajadas e janela menor.
// `opcoes.partida`: usa os campeões, o objetivo e o nível dessa rodada da partida. Sem partida, sorteia tudo
// (o terceiro argumento também pode ser só um objetivo, como nos testes).
export function criarRodada(rand, n = 0, opcoes = null) {
  const op = opcoes && opcoes.vida ? { objetivo: opcoes } : (opcoes || {});
  const partida = op.partida || null;
  const alvo = op.objetivo || (partida ? partida.objetivos[n] : proximoObjetivo(rand));
  const nivel = partida ? partida.niveis[n] : Math.floor(entre(rand, alvo.niveis[0], alvo.niveis[1] + 1));
  const smite = danoDoSmite(nivel);
  const campeao = partida ? partida.campeao : escolher(rand, CAMPEOES);
  const equipe = partida ? partida.equipe : montarTimes(rand, campeao);
  const participantes = equipe.map((p) => ({ ...p, nivel: limitarNivel(nivel + p.desloc) }));
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
  // Todos os 8 jogadores batem sozinhos, cada classe no seu ritmo (DANO_3S e RITMO): o atirador bate muito e sempre
  // igual, o meio bate pouco e forte, o selva (você e o inimigo) fica no meio termo, o topo bate pouco. Além disso,
  // o jogador tem a habilidade (Q) e o Golpear.
  const batedores = participantes;
  const pesos = batedores.map((p) => DANO_3S[p.rota] * p.forca);
  const soma = pesos.reduce((a, b) => a + b, 0);
  const prob = 0.04 + 0.03 * n; // chance de rajada (golpe grande) em cada batida (o topo, tanque, não dá rajada)
  const eventos = [];
  batedores.forEach((p, i) => {
    const ritmo = RITMO[p.rota];
    const periodo = ritmo.periodo * entre(rand, 0.95, 1.05);
    for (let t = entre(rand, 0.1, periodo); t < TEMPO_MAX; t += periodo * entre(rand, 1 - ritmo.variaT, 1 + ritmo.variaT)) {
      const taxa = t < tx ? r1 : r2;
      let dano = taxa * (pesos[i] / soma) * periodo * entre(rand, 1 - ritmo.variaD, 1 + ritmo.variaD) * MULT_DANO;
      if (p.rota !== 'topo' && rand() < prob) dano *= entre(rand, 1.6, 2.2);
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
    n, objetivo: alvo, vidaMax: alvo.vida, nivel, tempoInicio: Math.max(partida && partida.tempos ? partida.tempos[n] : 0, TEMPO_MINIMO[alvo.id] + (partida ? 0 : Math.floor(rand() * 240))), smite, campeao, participantes, janela, tx, golpes, gatilhoInimigo, partida: Boolean(partida),
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

// O que acontece quando o jogador usa o Smite com `vida` de vida no objetivo, `seg` segundos depois de a vida entrar na zona.
export function resolverSmite(vida, smite, seg = 0) {
  if (vida <= 0) return { resultado: 'roubado', margem: null, pontos: 0 };
  if (vida > smite) return { resultado: 'cedo', margem: null, pontos: 0, faltou: vida - smite };
  return { resultado: 'garantido', margem: smite - vida, tempo: seg, pontos: Math.max(PONTOS_TIME, pontosDoTempo(seg)), nota: classificar(seg) };
}

// ---------------------------------------------------------------------------------------------
// A rodada em andamento. A rodada só acaba quando o objetivo morre (por qualquer um) ou o tempo
// acaba; errar o Golpear não encerra nada. Quem dá o último golpe decide de que time é o objetivo:
//   - seu Golpear com a vida ≤ dano do Smite ........ 'garantido' (pontos pelo tempo desde que a vida entrou na zona)
//   - sua habilidade (Q) finaliza ................... 'time' via 'habilidade' (PONTOS_HABILIDADE = 50)
//   - um aliado finaliza ............................ 'time' (PONTOS_TIME = 25)
//   - time inimigo (golpe ou Smite do selva) ........ 'roubado' (0)
export function novoEstado(rodada) {
  return { R: rodada, vida: rodada.vidaMax, idx: 0, smiteUsado: false, smiteFalhou: null, inimigoUsou: false, inimigoEspera: false, fim: null, t: 0, tZona: null,
    q: { prontoEm: 0, janelaAte: null, desde: null, armadoAte: null } };
}

const encerrar = (est, fim) => { est.fim = fim; };

// Tira vida do objetivo e marca o instante em que ele entra na zona do Smite (vida ≤ dano do Smite).
function tirar(est, dano) {
  est.vida = Math.max(0, est.vida - dano);
  if (est.tZona == null && est.vida <= est.R.smite) est.tZona = est.t;
}

function morreu(est, quem, via) {
  const p = est.R.participantes.find((x) => x.id === quem);
  if (p && p.lado === 'azul') encerrar(est, { resultado: 'time', pontos: via === 'habilidade' ? PONTOS_HABILIDADE : PONTOS_TIME, quem, via, margem: null });
  else encerrar(est, { resultado: 'roubado', pontos: 0, quem, via, margem: null });
}

// O selva inimigo nunca golpeia nos primeiros ATRASO_INIMIGO s depois de a vida entrar na zona do Smite (vida ≤ dano do Smite):
// o gatilho fica esperando e dispara no instante tZona + ATRASO_INIMIGO (se a vida ainda estiver na faixa dele).
export const ATRASO_INIMIGO = 0.2;

// O selva inimigo golpeia quando a vida chega ao gatilho dele (se ainda estiver dentro da faixa).
function checarInimigo(est, eventos) {
  const R = est.R;
  if (est.fim || est.inimigoUsou || R.gatilhoInimigo == null || est.vida > R.gatilhoInimigo) return;
  if (est.tZona != null && est.vida <= R.smite && est.t < est.tZona + ATRASO_INIMIGO) { est.inimigoEspera = true; return; }
  golpeInimigo(est, eventos);
}
function golpeInimigo(est, eventos) {
  const R = est.R;
  est.inimigoEspera = false; est.inimigoUsou = true;
  if (est.vida < R.faixaMin) return; // a vida passou direto pela faixa (ex.: rajada): ele perdeu a hora
  const antes = est.vida;
  tirar(est, R.smite);
  eventos.push({ tipo: 'smite-inimigo', quem: 'e-selva', dano: R.smite, antes, depois: est.vida });
  if (est.vida <= 0) morreu(est, 'e-selva', 'smite-inimigo');
}
// Dispara o Golpear inimigo que estava esperando, se o atraso já passou até o instante `ate`.
function liberarInimigo(est, ate, eventos) {
  if (est.fim || !est.inimigoEspera || est.inimigoUsou) return;
  const quando = est.tZona + ATRASO_INIMIGO;
  if (quando > ate) return;
  est.t = quando;
  golpeInimigo(est, eventos);
}

// Aplica os golpes dos outros jogadores até o instante t (s). Devolve os eventos para a tela.
export function avancar(est, t) {
  const eventos = [];
  const R = est.R;
  while (!est.fim && est.idx < R.golpes.length && R.golpes[est.idx].t <= t) {
    const g = R.golpes[est.idx++];
    liberarInimigo(est, g.t, eventos);
    if (est.fim) break;
    atualizarQ(est, g.t, eventos);
    const c = R.campeao; const q = est.q;
    let bonus = 0;
    if (g.quem === 'voce' && c.tipo === 'armar') {
      if (q.armadoAte != null && g.t <= q.armadoAte) { bonus = c.dano[postoHab(R.nivel)]; q.armadoAte = null; }
      q.prontoEm = Math.max(0, q.prontoEm - c.corta); // cada golpe do Wukong corta 0,5 s da recarga
    }
    est.t = g.t;
    tirar(est, g.dano + bonus);
    eventos.push({ tipo: 'golpe', quem: g.quem, dano: g.dano, vida: est.vida });
    if (bonus) eventos.push({ tipo: 'habilidade', fase: 'bonus', quem: 'voce', dano: bonus, vida: est.vida });
    if (est.vida <= 0) morreu(est, g.quem, bonus ? 'habilidade' : 'golpe');
    else checarInimigo(est, eventos);
  }
  liberarInimigo(est, t, eventos);
  if (!est.fim) { est.t = Math.max(est.t, t); atualizarQ(est, t, eventos); }
  if (!est.fim && t >= TEMPO_MAX) encerrar(est, { resultado: 'roubado', pontos: 0, quem: null, via: 'tempo', margem: null });
  return eventos;
}

// Posto da habilidade (0 a 4): sobe junto com o nível do campeão (e, portanto, a cada rodada da partida).
export const postoHab = (nivel) => (nivel <= 7 ? 0 : nivel <= 10 ? 1 : nivel <= 13 ? 2 : nivel <= 16 ? 3 : 4);

// Fecha o que acabou por tempo: a janela do Lee Sin, o segurar longo do Pantheon e o ataque armado do Wukong.
function atualizarQ(est, t, eventos) {
  const c = est.R.campeao; const q = est.q; const posto = postoHab(est.R.nivel);
  if (q.janelaAte != null && t > q.janelaAte) { // perdeu a janela do Q2: a recarga começa agora
    q.prontoEm = q.janelaAte + c.recarga[posto]; q.janelaAte = null;
    eventos.push({ tipo: 'habilidade-fim', motivo: 'janela' });
  }
  if (q.desde != null && t - q.desde >= c.segurarMax) { // segurou demais: cancela, recarga pela metade
    q.prontoEm = q.desde + c.segurarMax + c.recarga[posto] / 2; q.desde = null;
    eventos.push({ tipo: 'habilidade-fim', motivo: 'segurou' });
  }
  if (q.armadoAte != null && t > q.armadoAte) { q.armadoAte = null; eventos.push({ tipo: 'habilidade-fim', motivo: 'armado' }); }
}

// O que o botão Q está fazendo agora: { fase: 'pronto'|'recarga'|'janela'|'segurando'|'armado', falta (s), carga (0 a 1) }.
export function estadoQ(est, t) {
  const q = est.q; const c = est.R.campeao;
  if (q.desde != null) return { fase: 'segurando', falta: Math.max(0, c.segurarMax - (t - q.desde)), carga: Math.max(0, Math.min(1, (t - q.desde - c.toqueMax) / (c.cargaCheia - c.toqueMax))) };
  if (q.janelaAte != null) return { fase: 'janela', falta: Math.max(0, q.janelaAte - t), carga: 0 };
  if (q.armadoAte != null) return { fase: 'armado', falta: Math.max(0, q.armadoAte - t), carga: 0 };
  if (t < q.prontoEm) return { fase: 'recarga', falta: q.prontoEm - t, carga: 0 };
  return { fase: 'pronto', falta: 0, carga: 0 };
}

function golpeQ(est, eventos, dano, fase) {
  tirar(est, dano);
  eventos.push({ tipo: 'habilidade', fase, quem: 'voce', dano, vida: est.vida });
  if (est.vida <= 0) morreu(est, 'voce', 'habilidade');
  else checarInimigo(est, eventos);
}

// Aperta o Q no instante t. Se a habilidade derruba o objetivo, o seu time fica com ele e vale PONTOS_HABILIDADE.
export function usarHabilidade(est, t = 0) {
  const eventos = [];
  if (est.fim) return eventos;
  est.t = t;
  atualizarQ(est, t, eventos);
  const c = est.R.campeao; const q = est.q; const posto = postoHab(est.R.nivel);
  const fase = estadoQ(est, t).fase;
  if (c.tipo === 'duplo') {
    if (fase === 'pronto') { // Q1: abre a janela para o Q2; a recarga só conta depois
      q.janelaAte = t + c.janela; q.prontoEm = Infinity;
      golpeQ(est, eventos, c.dano[posto], 'q1');
    } else if (fase === 'janela') { // Q2: mais dano quanto menos vida o objetivo tem (até o dobro)
      const falta = 1 - est.vida / est.R.vidaMax;
      const dano = Math.round(c.dano2[posto] * (1 + Math.max(0, Math.min(1, falta))));
      q.janelaAte = null; q.prontoEm = t + c.recarga[posto];
      golpeQ(est, eventos, dano, 'q2');
    }
  } else if (c.tipo === 'simples') {
    if (fase === 'pronto') { q.prontoEm = t + c.recarga[posto]; golpeQ(est, eventos, c.dano[posto], 'unico'); }
  } else if (c.tipo === 'carga') {
    if (fase === 'pronto') { q.desde = t; eventos.push({ tipo: 'habilidade-segurar' }); }
  } else if (c.tipo === 'armar') {
    if (fase === 'pronto') { q.prontoEm = t + c.recarga[posto]; q.armadoAte = t + c.janela; eventos.push({ tipo: 'habilidade-armar' }); }
  }
  return eventos;
}

// Solta o Q (só o Pantheon usa): toque rápido = estocada; segurou mais = arremesso com dano crescente.
export function soltarHabilidade(est, t = 0) {
  const eventos = [];
  if (est.fim) return eventos;
  est.t = t;
  atualizarQ(est, t, eventos);
  const c = est.R.campeao; const q = est.q; const posto = postoHab(est.R.nivel);
  if (c.tipo !== 'carga' || q.desde == null) return eventos;
  const seg = t - q.desde; q.desde = null;
  if (seg <= c.toqueMax) {
    q.prontoEm = t + c.recarga[posto] * (1 - c.devolve);
    golpeQ(est, eventos, c.dano[posto], 'toque');
  } else {
    const carga = Math.max(0, Math.min(1, (seg - c.toqueMax) / (c.cargaCheia - c.toqueMax)));
    const dano = Math.round(c.dano2[posto] * (1 + c.segundo) * (1 + c.bonusCarga * carga));
    q.prontoEm = t + c.recarga[posto];
    golpeQ(est, eventos, dano, 'arremesso');
  }
  return eventos;
}

// O Golpear do jogador. Com a vida ≤ dano do Smite, garante o objetivo (a rodada acaba). Com a vida acima,
// o Golpear é desperdiçado (bate no objetivo mas não mata) e a rodada continua.
export function usarGolpear(est, t = 0) {
  const eventos = [];
  if (est.fim || est.smiteUsado) return eventos;
  est.smiteUsado = true; est.t = t;
  const smite = est.R.smite; const vida = est.vida;
  if (vida <= smite) {
    est.vida = 0;
    const margem = smite - vida;
    const tempo = est.tZona == null ? 0 : Math.max(0, t - est.tZona); // desde que a vida entrou na zona do Smite
    eventos.push({ tipo: 'golpear', quem: 'voce', dano: smite, vida: 0, margem, tempo });
    encerrar(est, { resultado: 'garantido', pontos: Math.max(PONTOS_TIME, pontosDoTempo(tempo)), margem, tempo, quem: 'voce', via: 'golpear', nota: classificar(tempo), vidaNoGolpe: vida });
    return eventos;
  }
  est.smiteFalhou = { vida, faltou: vida - smite };
  tirar(est, smite);
  eventos.push({ tipo: 'golpear-cedo', quem: 'voce', dano: smite, vida: est.vida, faltou: vida - smite });
  checarInimigo(est, eventos);
  return eventos;
}
