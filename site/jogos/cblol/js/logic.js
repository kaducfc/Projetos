// Regras do jogo do CBLOL (sem tela): sorteio de times históricos, escolha
// de jogadores, força do time e simulação da campanha.

export const ROTAS = ['top', 'jungle', 'mid', 'adc', 'sup'];
export const VAGAS = [...ROTAS, 'reserva', 'tecnico'];
export const NOME_VAGA = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', sup: 'Suporte', reserva: 'Reserva', tecnico: 'Técnico' };
export const FASE_GRUPOS = 7;
export const VITORIAS_PARA_PASSAR = 3;

const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];

export function novoJogo(modo = 'normal') {
  return { v: 1, modo, vagas: Object.fromEntries(VAGAS.map((v) => [v, null])), atual: null, bonusUsado: false, fase: 'montagem', campanha: null };
}

const pessoasDoTime = (t) => [
  ...t.jogadores.map((j) => ({ ...j, tipo: 'jogador' })),
  ...(t.tecnico ? [{ ...t.tecnico, tipo: 'tecnico', rota: 'tecnico' }] : []),
];

const nomesUsados = (jogo) => new Set(VAGAS.map((v) => jogo.vagas[v]?.nome).filter(Boolean));

// Em quais vagas esta pessoa pode entrar agora.
export function vagasPossiveis(jogo, pessoa) {
  if (nomesUsados(jogo).has(pessoa.nome)) return [];
  if (pessoa.tipo === 'tecnico') return jogo.vagas.tecnico ? [] : ['tecnico'];
  const out = [];
  if (!jogo.vagas[pessoa.rota]) out.push(pessoa.rota);
  if (!jogo.vagas.reserva) out.push('reserva');
  return out;
}

// Um time só vale no sorteio se tiver alguém que ainda caiba no seu time.
const serve = (jogo, t) => pessoasDoTime(t).some((p) => vagasPossiveis(jogo, p).length);

// Times que têm alguém já escolhido quase nunca saem no sorteio (peso baixo);
// se saírem, essa pessoa aparece desabilitada.
const PESO_REPETIDO = 0.06;
const temRepetido = (jogo, t) => {
  const usados = nomesUsados(jogo);
  return pessoasDoTime(t).some((p) => usados.has(p.nome));
};

function sortear(jogo, lista, rnd) {
  const pesos = lista.map((t) => (temRepetido(jogo, t) ? PESO_REPETIDO : 1));
  let x = rnd() * pesos.reduce((s, w) => s + w, 0);
  return lista.find((_, i) => (x -= pesos[i]) <= 0) || lista[lista.length - 1];
}

export function rolar(jogo, times, rnd = Math.random) {
  const ok = times.filter((t) => t.id !== jogo.atual && serve(jogo, t));
  jogo.atual = ok.length ? sortear(jogo, ok, rnd).id : null;
  return jogo.atual;
}

// Dado bônus (1 por partida): outro split do mesmo time ou outro time do mesmo ano.
export function opcoesBonus(jogo, times) {
  const t = times.find((x) => x.id === jogo.atual);
  if (!t || jogo.bonusUsado) return { org: [], ano: [] };
  return {
    org: times.filter((x) => x.org === t.org && x.id !== t.id && serve(jogo, x)),
    ano: times.filter((x) => x.ano === t.ano && x.org !== t.org && serve(jogo, x)),
  };
}

export function usarBonus(jogo, times, tipo, rnd = Math.random) {
  const lista = opcoesBonus(jogo, times)[tipo];
  if (!lista?.length) return null;
  jogo.bonusUsado = true;
  jogo.atual = sortear(jogo, lista, rnd).id;
  return jogo.atual;
}

export function escolher(jogo, times, nome, vaga) {
  const t = times.find((x) => x.id === jogo.atual);
  if (!t) throw new Error('Role o dado primeiro.');
  // A mesma pessoa pode aparecer em duas rotas (trocou de rota no split):
  // vale a entrada que cabe na vaga escolhida, de preferência a da própria rota.
  const candidatos = pessoasDoTime(t).filter((x) => x.nome === nome && (vaga === 'tecnico') === (x.tipo === 'tecnico')
    && vagasPossiveis(jogo, x).includes(vaga));
  const p = candidatos.find((x) => x.rota === vaga) || candidatos.sort((a, b) => b.ovr - a.ovr)[0];
  if (!p) throw new Error('Essa pessoa não pode entrar nessa vaga.');
  jogo.vagas[vaga] = { nome: p.nome, rota: p.rota, ovr: p.ovr, tipo: p.tipo, time: t.time, edicao: t.edicao, id: t.id };
  jogo.atual = null;
  return jogo.vagas[vaga];
}

export const completo = (jogo) => VAGAS.every((v) => jogo.vagas[v]);

// Força: média dos 5 titulares; o reserva só entra na média se for melhor
// que ela (ajuda a subir um pouco); o técnico dá um ajuste de até ±3.
export function forca(vagas) {
  const tit = ROTAS.map((r) => vagas[r]?.ovr).filter((x) => x != null);
  if (!tit.length) return { media: 0, forca: 0, reservaConta: false, ajusteTecnico: 0 };
  let media = tit.reduce((s, x) => s + x, 0) / tit.length;
  const res = vagas.reserva?.ovr;
  const reservaConta = res != null && res > media && tit.length === 5;
  if (reservaConta) media = (media * 5 + res) / 6;
  const ajusteTecnico = vagas.tecnico ? Math.max(-3, Math.min(3, (vagas.tecnico.ovr - 75) * 0.15)) : 0;
  return { media: Math.round(media * 10) / 10, forca: media + ajusteTecnico, reservaConta, ajusteTecnico };
}

// Força de um time histórico (como ele era naquele split).
export function forcaTime(t) {
  const vagas = {};
  for (const r of ROTAS) vagas[r] = t.jogadores.find((j) => j.rota === r && j.titular) || null;
  vagas.tecnico = t.tecnico;
  return forca(vagas).forca;
}

// Chance de vencer um jogo. O OVR pesa muito: 3 pontos de vantagem ≈ 77%,
// 7 pontos ≈ 94% (o mais fraco só vence com sorte) e 12 ou mais: impossível.
export const DIFERENCA_IMPOSSIVEL = 12;
export function chanceVitoria(a, b) {
  const d = a - b;
  if (d >= DIFERENCA_IMPOSSIVEL) return 1;
  if (d <= -DIFERENCA_IMPOSSIVEL) return 0;
  return 1 / (1 + Math.exp(-d / 2.5));
}

// Adversário das quartas (entre times que jogaram playoffs): quanto mais
// vitórias na fase de pontos, mais fraco.
const FAIXA_QUARTAS = { 3: [0, 0.15], 4: [0.15, 0.35], 5: [0.35, 0.6], 6: [0.6, 0.8], 7: [0.8, 1] };

// Peso de cada rota para abates, mortes e assistências.
const PESO_ABATE = { top: 1, jungle: 0.9, mid: 1.25, adc: 1.45, sup: 0.3 };
const PESO_MORTE = { top: 1, jungle: 1.05, mid: 0.9, adc: 0.9, sup: 1.15 };
const PESO_ASSIST = { top: 0.7, jungle: 1.2, mid: 1, adc: 0.8, sup: 1.6 };

function sorteioPeso(pesos, rnd) {
  let x = rnd() * pesos.reduce((s, w) => s + w, 0);
  const i = pesos.findIndex((w) => (x -= w) <= 0);
  return i < 0 ? pesos.length - 1 : i;
}

// Abates, mortes e assistências de cada jogador de um lado, somando o placar.
function linhaDoTime(jogadores, abates, mortes, rnd) {
  const ls = jogadores.map((j) => ({ nome: j.nome, rota: j.rota, ovr: j.ovr, k: 0, d: 0, a: 0 }));
  const pk = ls.map((j) => PESO_ABATE[j.rota] * (j.ovr / 75) ** 3);
  const pd = ls.map((j) => PESO_MORTE[j.rota] * (75 / j.ovr) ** 3);
  for (let i = 0; i < abates; i++) {
    const autor = sorteioPeso(pk, rnd);
    ls[autor].k++;
    // Cada abate tem de 0 a 4 assistências (quase sempre 1 a 3).
    const n = sorteioPeso([0.08, 0.27, 0.35, 0.22, 0.08], rnd);
    const livres = ls.map((_, x) => x).filter((x) => x !== autor);
    for (let a = 0; a < n; a++) {
      const w = livres.map((x) => PESO_ASSIST[ls[x].rota]);
      const x = livres.splice(sorteioPeso(w, rnd), 1)[0];
      ls[x].a++;
    }
  }
  for (let i = 0; i < mortes; i++) ls[sorteioPeso(pd, rnd)].d++;
  return ls;
}

const titulares = (t) => ROTAS.map((r) => t.jogadores.find((j) => j.rota === r && j.titular) || t.jogadores.find((j) => j.rota === r));

function jogoSimulado(meu, adv, jogadores, rnd) {
  const venceu = rnd() < chanceVitoria(meu, adv.forca);
  // Placar de abates acompanha a diferença de força: atropelo quando o
  // vencedor é bem melhor, jogo apertado quando é equilibrado (ou zebra).
  const vant = venceu ? meu - adv.forca : adv.forca - meu;
  const kv = 12 + Math.floor(rnd() * 15);
  const razao = Math.max(0.12, Math.min(0.92, 0.6 - vant * 0.035 + (rnd() - 0.5) * 0.2));
  const kp = Math.max(1, Math.min(kv - 1, Math.round(kv * razao)));
  const placar = venceu ? [kv, kp] : [kp, kv];
  // Duração de 23 a 40 minutos: atropelo acaba cedo, jogo parelho vai longe (em segundos).
  const parelho = (razao - 0.12) / 0.8;
  const duracao = Math.round((23 + 13 * parelho + rnd() * 4) * 60);
  const nos = linhaDoTime(jogadores, placar[0], placar[1], rnd);
  const eles = linhaDoTime(titulares(adv), placar[1], placar[0], rnd);
  // MVP: melhor atuação do time que venceu.
  const nota = (j) => j.k * 3 + j.a * 1.5 - j.d * 2 + j.ovr / 25;
  const mvp = venceu ? nos.slice().sort((a, b) => nota(b) - nota(a))[0].nome : null;
  return { venceu, placar, mvp, duracao, nos, eles };
}

function serie(meu, adv, melhorDe, jogadores, rnd) {
  const precisa = Math.ceil(melhorDe / 2);
  const jogos = [];
  let v = 0;
  let d = 0;
  while (v < precisa && d < precisa) {
    const g = jogoSimulado(meu, adv, jogadores, rnd);
    jogos.push(g);
    if (g.venceu) v++; else d++;
  }
  return { venceu: v > d, placar: [v, d], jogos };
}

const resumoTime = (t) => ({ id: t.id, time: t.time, edicao: t.edicao, ovr: t.ovr, forca: Math.round(t.forca * 10) / 10 });

export function simular(jogo, times, rnd = Math.random) {
  const f = forca(jogo.vagas);
  const jogadores = ROTAS.map((r) => jogo.vagas[r]);
  // Adversários: times sem ninguém do seu elenco (senão a mesma pessoa
  // estaria dos dois lados).
  const meus = new Set(VAGAS.map((v) => jogo.vagas[v]?.nome).filter(Boolean));
  const semMeus = (lista) => {
    const l = lista.filter((t) => !pessoasDoTime(t).some((p) => meus.has(p.nome)));
    return l.length >= 5 ? l : lista;
  };
  const comForca = semMeus(times).map((t) => ({ ...t, forca: forcaTime(t) }));
  // Mata-mata: só times que chegaram àquela fase no CBLOL de verdade.
  const chegou = (fases) => semMeus(times.filter((t) => fases.includes(t.playoffs))).map((t) => ({ ...t, forca: forcaTime(t) }));
  const doQuartas = chegou(['quartas', 'semi', 'final']);
  const daSemi = chegou(['semi', 'final']);
  const daFinal = chegou(['final']);
  const rodadas = [];

  // Fase de pontos: 7 jogos (MD1) contra times sorteados.
  const sorteados = [];
  while (sorteados.length < FASE_GRUPOS) {
    const t = pick(comForca, rnd);
    if (!sorteados.includes(t)) sorteados.push(t);
  }
  let vit = 0;
  for (const adv of sorteados) {
    const s = serie(f.forca, adv, 1, jogadores, rnd);
    if (s.venceu) vit++;
    rodadas.push({ fase: 'Fase de pontos', adv: resumoTime(adv), ...s });
  }
  let resultado = 'fase';
  if (vit >= VITORIAS_PARA_PASSAR) {
    const ordem = doQuartas.slice().sort((a, b) => b.forca - a.forca);
    const [lo, hi] = FAIXA_QUARTAS[vit];
    const faixa = ordem.slice(Math.floor(lo * ordem.length), Math.max(Math.floor(lo * ordem.length) + 1, Math.floor(hi * ordem.length)));
    const etapas = [['Quartas de final', 3, faixa], ['Semifinal', 5, daSemi], ['Final', 5, daFinal]];
    resultado = 'quartas';
    for (const [nome, md, lista] of etapas) {
      const adv = pick(lista, rnd);
      const s = serie(f.forca, adv, md, jogadores, rnd);
      rodadas.push({ fase: nome, adv: resumoTime(adv), melhorDe: md, ...s });
      if (!s.venceu) break;
      resultado = { 'Quartas de final': 'semi', Semifinal: 'final', Final: 'campeao' }[nome];
    }
    if (resultado === 'final' && rodadas.at(-1).fase === 'Final') resultado = 'vice';
  }
  jogo.campanha = { rodadas, vitoriasGrupos: vit, resultado, forca: Math.round(f.forca * 10) / 10 };
  jogo.fase = 'fim';
  return jogo.campanha;
}

export const TITULO_RESULTADO = {
  campeao: 'Campeão!', vice: 'Vice-campeão', final: 'Vice-campeão', semi: 'Eliminado na semifinal', quartas: 'Eliminado nas quartas', fase: 'Eliminado na fase de pontos',
};

export const pontos = (c) => ({ campeao: 100, vice: 70, final: 70, semi: 50, quartas: 30, fase: 0 }[c.resultado] + c.vitoriasGrupos * 5);
