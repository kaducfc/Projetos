// Fluxo da carreira: propostas → temporada (splits, eventos, playoffs,
// torneios internacionais) → fim de temporada → nova janela … → aposentadoria.
//
// Toda a lógica muda `state` e define `state.screen`; a UI só desenha.

import { buildTeams, REGIONS, REGION_LEVEL, TIER_RANGE, WILDCARD_SLOTS, nationById, ofLeague, inLeague, lowestTier } from '../data/world.js';
import { EVENTS, eventById, roleAllows } from '../data/events.js';
import {
  createPlayer, ovrOf, effectiveOvr, applyFx, seasonGrowth, salaryFor, statusFor, STATUS,
} from './player.js';
import { simGame, simSeries, roundRobin, gameStats, formRoll } from './sim.js';
import { clamp, pick, rand, randInt, roll, shuffle, weightedPick } from '../util.js';

export const START_YEAR = 2026;

// 3 decisões por ano, uma antes de cada etapa. Cada etapa (fase de pontos +
// playoffs) é simulada de uma vez e mostrada numa tela só.
// Liga principal: Copa → First Stand → Split 1 → MSI → Split 2 → Mundial.
// Divisões de acesso: só os dois splits.
const QUEUE_TIER1 = ['ev0', 'cup', 'firstStand', 'ev1', 's1', 'msi', 'ev2', 's2', 'worlds', 'end'];
const QUEUE_LOWER = ['ev0', 's1', 'ev1', 's2', 'ev2', 'end'];

const STAGE_LABELS = {
  1: { ev0: 'PRÉ-TEMPORADA', ev1: 'ANTES DO SPLIT 1', ev2: 'ANTES DO SPLIT 2' },
  lower: { ev0: 'PRÉ-TEMPORADA', ev1: 'ENTRE OS SPLITS', ev2: 'FIM DE TEMPORADA' },
};

export const INTL = {
  firstStand: { name: 'First Stand', rank: 'cup' },
  msi: { name: 'MSI', rank: 's1' },
  worlds: { name: 'Mundial', rank: 's2' },
};

// Etapas da temporada para o calendário da UI: [id, passo da fila que a inicia].
export function seasonStages(s) {
  const names = s.tier === 1 ? REGIONS[s.region].stages : [`${s.league} · Split 1`, `${s.league} · Split 2`];
  const list = s.tier === 1
    ? [['cup', 'cup', names[0]], ['firstStand', 'firstStand', 'First Stand'], ['s1', 's1', names[1]],
      ['msi', 'msi', 'MSI'], ['s2', 's2', names[2]], ['worlds', 'worlds', 'Mundial']]
    : [['s1', 's1', names[0]], ['s2', 's2', names[1]]];
  const done = s.queue.slice(0, s.idx);
  return list.map(([id, start, name]) => {
    const result = INTL[id] ? s.intl[id] : s.placements[id];
    const started = done.includes(start);
    return { id, name, intl: !!INTL[id], result, started };
  });
}

// Premiações (parte do jogador, em US$), proporcionais ao peso de cada torneio.
// Liga: valor do campeão por região; Copa paga 60% de um split. As demais
// colocações recebem uma fração do valor do campeão.
const LEAGUE_PRIZE = { kr: 30000, cn: 30000, eu: 20000, na: 18000, br: 8000 };
const LOWER_PRIZE = { 2: 2000, 3: 600 };
const PLACE_SHARE = { 1: 1, 2: 0.5, 3: 0.25, 4: 0.25, 5: 0.1, 6: 0.1 };
// Internacionais por fase alcançada: 1 campeão, 2 vice, 3 semifinal, 5 quartas, 9 fase anterior.
const INTL_PRIZE = {
  worlds: { 1: 90000, 2: 45000, 3: 25000, 5: 12000, 9: 5000 },
  msi: { 1: 50000, 2: 25000, 3: 12000, 5: 6000, 9: 3000 },
  firstStand: { 1: 40000, 2: 20000, 3: 10000, 5: 5000, 9: 2500 },
};

function addPrize(state, label, amount) {
  if (!amount) return;
  const e = state.season.earnings;
  e.prizes += amount;
  e.items.push({ label, amount: Math.round(amount) });
}

// ---------------------------------------------------------------- helpers

export const teamOf = (state, id) => state.world.teams[id];

// Times em atividade. Times que saíram do jogo (RETIRED_TEAMS) só existem em
// saves antigos, para o histórico; não entram em ligas nem fazem propostas.
// Exceção: o time atual do jogador segue ativo até ele sair.
const activeTeams = (state) => Object.values(state.world.teams)
  .filter((t) => !t.retired || t.id === state.player?.teamId);

export function leagueName(team) {
  if (team.region === 'wc') return 'Wildcard';
  return REGIONS[team.region].leagues[team.tier];
}

export function leagueTeams(state, team) {
  return activeTeams(state).filter((t) => t.region === team.region && t.tier === team.tier);
}

function ambitionLabel(state, team) {
  const ranked = leagueTeams(state, team).sort((a, b) => b.rating - a.rating);
  const i = ranked.findIndex((t) => t.id === team.id);
  if (team.tier === 1 && i < REGIONS[team.region].worlds) return i < 2 ? 'Candidato ao título' : 'Vaga no Mundial';
  if (i < 2) return 'Candidato ao título';
  if (i < 4) return 'Briga pelos playoffs';
  if (i >= ranked.length - 2) return 'Reconstrução';
  return 'Meio da tabela';
}

export function standings(split) {
  return split.ids.slice().sort((a, b) => {
    const A = split.table[a];
    const B = split.table[b];
    return B.w - A.w || A.l - B.l || split.tb[b] - split.tb[a];
  });
}

function pushModal(state, modal) {
  state.modals.push(modal);
}

// ---------------------------------------------------------------- início

export function newCareer(form) {
  const nation = nationById(form.nat);
  const state = {
    v: 2,
    world: { year: START_YEAR, teams: buildTeams() },
    player: createPlayer({ ...form, region: nation.region }),
    season: null,
    screen: null,
    modals: [],
  };
  state.screen = {
    type: 'offers',
    first: true,
    offers: genOffers(state, { first: true, max: randInt(2, 3) }),
    stay: null,
    note: '',
  };
  return state;
}

// ---------------------------------------------------------------- propostas

function makeOffer(state, team, { first = false, bet = false, loan = false } = {}) {
  const p = state.player;
  const ovr = ovrOf(p);
  let status = statusFor(ovr, team.rating, 55);
  // Numa aposta o time garante espaço: no mínimo disputa de vaga.
  if (bet && status === 'reserva') status = 'disputa';
  return {
    teamId: team.id,
    salary: Math.round(salaryFor(ovr, team) * (bet ? 1.2 : 1)),
    years: loan ? 1 : first ? 2 : bet ? 2 : randInt(1, 3),
    status,
    ambition: loan ? 'Empréstimo de 1 temporada' : bet ? 'Aposta no seu potencial' : ambitionLabel(state, team),
    bet,
    loan,
  };
}

// "Hype" do jogador: resultados recentes, prêmios, evolução e juventude.
// Quanto maior, mais chance de uma liga mais forte apostar nele.
function hypeOf(p) {
  const last = p.lastSeason || {};
  return (p.fame / 20) + (last.titles || 0) * 1.5 + (last.awards || 0) * 2
    + Math.max(0, last.growth || 0) * 0.5 + (p.age <= 20 ? 1.5 : 0) + (last.bestPlace === 1 ? 1 : 0);
}

const leagueRank = (team) => (team && team.tier === 1 ? REGION_LEVEL[team.region]?.rank ?? 1 : 0);

// Uma liga mais forte que a atual aposta no jogador: time acima do nível
// que ele normalmente alcançaria.
function betOffer(state, score) {
  const p = state.player;
  const curRank = leagueRank(teamOf(state, p.teamId));
  const hype = hypeOf(p);
  if (hype < 5 || !roll(hype * 4)) return null;
  const pool = activeTeams(state).filter((t) => t.tier === 1 && t.region !== 'wc'
    && t.id !== p.teamId && REGION_LEVEL[t.region].rank > curRank
    && (REGION_LEVEL[t.region].rank < 3 || ovrOf(p) >= 77 || p.nat === 'KR')
    && t.rating >= score - 4 && t.rating <= score + 7 + hype / 3);
  if (!pool.length) return null;
  const t = weightedPick(pool, (x) => REGION_LEVEL[x.region].rank);
  return makeOffer(state, t, { bet: true });
}

// Porta de entrada numa liga mais forte: um time de menor expressão de lá
// (os mais fracos da liga principal, ou a academia de um time grande para
// quem ainda é bem novo). É o caminho mais comum para sair do país.
function entryOffer(state, score) {
  const p = state.player;
  const cur = teamOf(state, p.teamId);
  const curRank = leagueRank(cur);
  if (curRank >= 3 || ovrOf(p) < 70) return null;
  const chance = clamp(8 + hypeOf(p) * 2.5 + (score - 74) * 1.2, 0, 40);
  if (!roll(chance)) return null;
  const pool = [];
  for (const region of Object.keys(REGION_LEVEL)) {
    if (REGION_LEVEL[region].rank <= curRank) continue;
    // LCK/LPL só abrem a porta para quem já tem nível de liga principal.
    if (REGION_LEVEL[region].rank === 3 && ovrOf(p) < 76 && p.nat !== 'KR') continue;
    const tier1 = activeTeams(state).filter((t) => t.region === region && t.tier === 1)
      .sort((x, y) => x.rating - y.rating).slice(0, 4);
    pool.push(...tier1);
    if (p.age <= 20) {
      pool.push(...activeTeams(state).filter((t) => t.region === region && t.tier === 2).slice(0, 3));
    }
  }
  const fits = pool.filter((t) => t.id !== p.teamId && t.rating <= score + 5 && t.rating >= score - 14);
  if (!fits.length) return null;
  const t = weightedPick(fits, (x) => REGION_LEVEL[x.region].rank);
  const offer = makeOffer(state, t);
  offer.entry = true;
  offer.ambition = t.tier === 1 ? `Porta de entrada ${inLeague(leagueName(t))}` : `Academia de ponta ${inLeague(leagueName(t))}`;
  return offer;
}

// Propostas da janela. `max` = quantas no máximo (o total de opções na tela,
// contando "continuar no clube", fica entre 2 e 3).
export function genOffers(state, { first = false, max = 3 } = {}) {
  const p = state.player;
  const ovr = ovrOf(p);
  const score = ovr + p.fame / 20;
  const cur = teamOf(state, p.teamId);
  const all = activeTeams(state).filter((t) => t.region !== 'wc' && t.id !== p.teamId);
  const lo = score - 12;
  // Quem foi bem na temporada chama a atenção dos times grandes da própria liga.
  const last = p.lastSeason || {};
  const shined = (last.bestPlace || 99) <= 4 || (last.awards || 0) > 0 || (last.growth || 0) >= 2;
  const sameLeague = (t) => cur && t.region === cur.region && t.tier === cur.tier;
  const hiFor = (t) => score + 2 + (sameLeague(t) && shined ? 4 : 0);

  let cands;
  if (first) {
    // Primeiro contrato: base/academias da região de origem.
    cands = all.filter((t) => t.region === p.region && t.tier >= 2 && t.rating <= score + 6);
    // Regiões fortes (LCK CL, LDL) podem não ter time "no nível" de um
    // garoto de 16 anos: aí as academias mais modestas apostam nele.
    if (cands.length < 3) {
      cands = all.filter((t) => t.region === p.region && t.tier >= 2)
        .sort((a, b) => a.rating - b.rating).slice(0, 3);
    }
  } else {
    cands = all.filter((t) => {
      if (t.rating < lo || t.rating > hiFor(t)) return false;
      if (t.region !== p.region && !sameLeague(t)) {
        if (t.tier > 1) return false;
        const need = p.nat === 'KR' ? 72 : REGION_LEVEL[t.region].rank === 3 ? 88 : 75;
        if (ovr < need) return false;
      }
      return true;
    });
  }

  const offers = [];
  if (!first && max > 0) {
    const special = betOffer(state, score) || entryOffer(state, score);
    if (special) offers.push(special);
  }
  const pool = cands.filter((t) => !offers.some((o) => o.teamId === t.id));
  while (offers.length < max && pool.length) {
    // Times melhores, da mesma liga (quando o jogador brilhou) e de ligas
    // mais fortes chamam mais atenção.
    const t = weightedPick(pool, (x) => Math.pow(Math.max(1, x.rating - lo), 1.4)
      * (x.region === p.region || sameLeague(x) ? 1 : 0.5 + REGION_LEVEL[x.region].rank * 0.12)
      * (sameLeague(x) && shined && x.rating > (cur?.rating ?? 0) ? 1.8 : 1));
    pool.splice(pool.indexOf(t), 1);
    offers.push(makeOffer(state, t, { first }));
  }
  return offers;
}

function fallbackOffers(state, max) {
  const p = state.player;
  return activeTeams(state)
    .filter((t) => t.region === p.region && t.tier === lowestTier(p.region) && t.id !== p.teamId)
    .sort((a, b) => a.rating - b.rating)
    .slice(0, max)
    .map((t) => makeOffer(state, t));
}

// Empréstimo forçado: até 2 times do mesmo nível ou mais fracos que o atual
// (mesma região, nunca melhores). Sem opção possível, não há empréstimo.
function loanOffers(state) {
  const p = state.player;
  const cur = teamOf(state, p.teamId);
  const pool = activeTeams(state).filter((t) => t.region === cur.region && t.id !== cur.id
    && t.tier >= cur.tier && t.rating <= cur.rating);
  return pool
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2)
    .map((t) => ({ ...makeOffer(state, t, { loan: true }), salary: p.contract.salary }));
}

export function offseasonScreen(state) {
  const p = state.player;
  const team = teamOf(state, p.teamId);
  const ovr = ovrOf(p);
  const total = randInt(2, 3);

  // Desempenho muito ruim: a diretoria empresta o jogador, sem opção de ficar.
  if (p.pendingLoan) {
    p.pendingLoan = false;
    const offers = loanOffers(state);
    if (offers.length) {
      state.screen = {
        type: 'offers', kind: 'loan', first: false, offers, stay: null,
        note: `A diretoria de ${team.name} decidiu te emprestar por 1 temporada para você ganhar minutos. Escolha o destino.`,
      };
      return;
    }
  }

  let stay = null;
  let note = '';
  let offers;

  if (p.loan) {
    // Fim do empréstimo: volta para o clube dono do contrato, se ainda houver contrato.
    const parent = teamOf(state, p.loan.parentId);
    if (p.loan.years > 0) {
      stay = { teamId: parent.id, years: p.loan.years, salary: p.loan.salary, renew: false, back: true };
      note = `Seu empréstimo acabou. ${parent.name} quer você de volta, mas outros times também ligaram.`;
    } else {
      note = `Seu empréstimo acabou e o contrato com ${parent.name} terminou. Você está livre no mercado.`;
    }
    offers = genOffers(state, { max: total - (stay ? 1 : 0) });
  } else if (p.contract.years > 0) {
    stay = { teamId: team.id, years: p.contract.years, salary: p.contract.salary, renew: false };
    const interest = roll(55 + p.fame / 3) || ovr > team.rating + 3 || hypeOf(p) >= 8;
    offers = interest ? genOffers(state, { max: total - 1 }) : [];
    note = offers.length
      ? `Você ainda tem ${p.contract.years} ${p.contract.years > 1 ? 'anos' : 'ano'} de contrato com ${team.name}, mas chegaram propostas.`
      : `Nenhuma proposta nesta janela. Seu contrato com ${team.name} segue válido.`;
  } else {
    const wanted = team.rating <= ovr + p.fame / 20 + 5 && p.morale >= 25;
    if (wanted) {
      stay = { teamId: team.id, years: randInt(1, 3), salary: salaryFor(ovr, team), renew: true };
      note = `Seu contrato acabou. ${team.name} quer renovar, e outros times estão de olho.`;
    } else {
      note = `Seu contrato acabou e ${team.name} não quis renovar.`;
    }
    offers = genOffers(state, { max: total - (stay ? 1 : 0) });
    if (!stay && !offers.length) offers = fallbackOffers(state, total);
  }
  if (!stay && !offers.length) offers = fallbackOffers(state, total);
  if (offers.some((o) => o.bet)) {
    const bet = offers.find((o) => o.bet);
    note += ` ${leagueName(teamOf(state, bet.teamId))} está apostando em você!`;
  } else if (offers.some((o) => o.entry)) {
    const entry = teamOf(state, offers.find((o) => o.entry).teamId);
    note += ` Um time ${ofLeague(leagueName(entry))} quer te levar para ${entry.region === 'br' ? 'o' : 'a'} ${REGIONS[entry.region].name}.`;
  }

  state.screen = { type: 'offers', kind: 'transfer', first: false, offers, stay, note: note.trim() };
}

export function chooseOffer(state, index) {
  const p = state.player;
  const scr = state.screen;
  const offer = index === 'stay' ? scr.stay : scr.offers[index];
  const moved = offer.teamId !== p.teamId;
  if (moved && p.teamId) p.fame = clamp(p.fame + (offer.bet ? 5 : 2), 0, 100);

  if (offer.loan) {
    // O contrato com o clube de origem continua; volta ao fim da temporada.
    p.loan = { parentId: p.teamId, years: p.contract.years, salary: p.contract.salary };
    p.contract = { years: 1, salary: offer.salary };
  } else {
    p.loan = null; // voltou ao clube de origem ou saiu de vez dele
    p.contract = { years: offer.years, salary: offer.salary };
  }
  p.teamId = offer.teamId;
  if (moved) p.morale = offer.bet ? 62 : 55;
  p.betSeason = Boolean(offer.bet);
  startSeason(state);
  advance(state);
}

// ---------------------------------------------------------------- temporada

function startSeason(state) {
  const p = state.player;
  const team = teamOf(state, p.teamId);
  p.morale = Math.round(p.morale + (55 - p.morale) * 0.3);
  p.status = statusFor(ovrOf(p), team.rating, p.morale);
  if (p.betSeason && p.status === 'reserva') p.status = 'disputa';
  state.season = {
    year: state.world.year,
    age: p.age,
    teamId: team.id,
    tier: team.tier,
    region: team.region,
    league: leagueName(team),
    ovrStart: ovrOf(p),
    queue: (team.tier === 1 ? QUEUE_TIER1 : QUEUE_LOWER).slice(),
    idx: 0,
    stats: { games: 0, wins: 0, k: 0, d: 0, a: 0, pog: 0, teamGames: 0, teamWins: 0 },
    titles: [],
    awards: [],
    placements: {},
    rankings: {},
    msiFinalRegions: [],
    intl: {},
    earnings: { salary: 0, prizes: 0, items: [] },
    split: null,
  };
}

export function advance(state) {
  const s = state.season;
  while (s.idx < s.queue.length) {
    const step = s.queue[s.idx++];
    if (step.startsWith('ev')) return eventScreen(state, step);
    if (INTL[step]) {
      // O torneio sempre é simulado (o resultado do MSI define vagas extras
      // no Mundial); a tela só aparece se o time do jogador estiver nele.
      if (runIntl(state, step)) return;
      continue;
    }
    if (step === 'end') return endSeason(state);
    return runStage(state, step);
  }
}

function playChance(p) {
  return clamp(STATUS[p.status].play + (p.morale - 50) / 200, 0.1, 1);
}

// Força do time do jogador numa partida, com ou sem ele em campo.
function myPower(state, plays) {
  const p = state.player;
  const team = teamOf(state, state.season.teamId);
  const form = state.season.split?.form[team.id] || 0;
  const base = team.rating + form;
  return plays ? base + (effectiveOvr(p) - team.rating) * 0.22 : base;
}

// Série envolvendo o time do jogador (atualiza as estatísticas).
function playerSeries(state, oppPower, bestOf) {
  const p = state.player;
  const st = state.season.stats;
  const need = Math.ceil(bestOf / 2);
  const line = { played: 0, k: 0, d: 0, a: 0, pog: 0 };
  let w = 0;
  let l = 0;
  while (w < need && l < need) {
    const plays = Math.random() < playChance(p);
    const win = simGame(myPower(state, plays), oppPower);
    st.teamGames++;
    if (win) { w++; st.teamWins++; } else l++;
    if (plays) {
      const g = gameStats(p, effectiveOvr(p), win);
      line.played++; line.k += g.k; line.d += g.d; line.a += g.a; line.pog += g.pog ? 1 : 0;
      st.games++; st.k += g.k; st.d += g.d; st.a += g.a; st.pog += g.pog ? 1 : 0;
      if (win) st.wins++;
      p.stats.games++; p.stats.k += g.k; p.stats.d += g.d; p.stats.a += g.a; p.stats.pog += g.pog ? 1 : 0;
      if (win) p.stats.wins++;
    }
  }
  return { w, l, won: w > l, line };
}

// ---------------------------------------------------------------- liga

// Copa: turno único em MD1, 4 nos playoffs.
// Splits da liga principal: turno único em MD3, 6 nos playoffs (1º e 2º direto na semi).
// Divisões de acesso: turno único em MD1, 4 nos playoffs.
function splitConfig(s, kind) {
  const n = kind === 'cup' ? 0 : Number(kind[1]);
  if (s.tier === 1) {
    return { n, name: REGIONS[s.region].stages[n], bo: kind === 'cup' ? 1 : 3, poSize: kind === 'cup' ? 4 : 6 };
  }
  return { n, name: `${s.league} · Split ${n}`, bo: 1, poSize: 4 };
}

function newSplit(state, kind) {
  const s = state.season;
  const team = teamOf(state, s.teamId);
  const ids = leagueTeams(state, team).map((t) => t.id);
  const split = { kind, ...splitConfig(s, kind), ids, table: {}, form: {}, tb: {}, rounds: roundRobin(ids), played: 0 };
  ids.forEach((id) => {
    split.table[id] = { w: 0, l: 0 };
    split.form[id] = formRoll(4);
    split.tb[id] = Math.random();
  });
  return split;
}

function aiPower(state, id) {
  const split = state.season.split;
  return teamOf(state, id).rating + (split?.form[id] || 0);
}

function playRegular(state) {
  const s = state.season;
  const split = s.split;
  const results = [];
  split.rounds.forEach((pairs, r) => {
    for (const [a, b] of pairs) {
      let winner;
      if (a === s.teamId || b === s.teamId) {
        const opp = a === s.teamId ? b : a;
        const res = playerSeries(state, aiPower(state, opp), split.bo);
        winner = res.won ? s.teamId : opp;
        results.push({ round: r + 1, oppId: opp, w: res.w, l: res.l, won: res.won, line: res.line });
      } else {
        const res = simSeries(aiPower(state, a), aiPower(state, b), split.bo);
        winner = res.a > res.b ? a : b;
      }
      const loser = winner === a ? b : a;
      split.table[winner].w++;
      split.table[loser].l++;
    }
  });
  split.played = split.rounds.length;
  return results;
}

// Etapa completa: fase de pontos + playoffs, numa tela só.
function runStage(state, kind) {
  const s = state.season;
  s.split = newSplit(state, kind);
  const results = playRegular(state);
  const regularPos = standings(s.split).indexOf(s.teamId) + 1;
  const po = playoffs(state);
  state.screen = {
    type: 'stage',
    kind,
    name: s.split.name,
    bo: s.split.bo,
    poSize: s.split.poSize,
    results,
    regularPos,
    ...po,
  };
}

function playoffs(state) {
  const s = state.season;
  const split = s.split;
  const table = standings(split);
  const seeds = table.slice(0, split.poSize);
  const bo = s.tier === 3 ? 3 : 5;
  const matches = [];
  const out = { qf: [], sf: [] };

  const series = (a, b, label, round) => {
    let sa;
    let sb;
    if (a === s.teamId || b === s.teamId) {
      const opp = a === s.teamId ? b : a;
      const res = playerSeries(state, aiPower(state, opp) + rand(-1, 1), bo);
      sa = a === s.teamId ? res.w : res.l;
      sb = a === s.teamId ? res.l : res.w;
    } else {
      const res = simSeries(aiPower(state, a), aiPower(state, b), bo);
      sa = res.a;
      sb = res.b;
    }
    const winner = sa > sb ? a : b;
    matches.push({ label, a, b, sa, sb, winner });
    if (out[round]) out[round].push(winner === a ? b : a);
    return winner;
  };

  let semis;
  if (seeds.length === 6) {
    const q1 = series(seeds[2], seeds[5], 'Quartas de final', 'qf');
    const q2 = series(seeds[3], seeds[4], 'Quartas de final', 'qf');
    semis = [[seeds[0], q2], [seeds[1], q1]];
  } else {
    semis = [[seeds[0], seeds[3]], [seeds[1], seeds[2]]];
  }
  const w1 = series(semis[0][0], semis[0][1], 'Semifinal', 'sf');
  const w2 = series(semis[1][0], semis[1][1], 'Semifinal', 'sf');
  const champ = series(w1, w2, 'Final', 'final');

  // Classificação final: campeão, vice, semifinalistas, quartas, resto da tabela.
  const bySeed = (a, b) => table.indexOf(a) - table.indexOf(b);
  const ranking = [champ, champ === w1 ? w2 : w1, ...out.sf.sort(bySeed), ...out.qf.sort(bySeed)];
  table.forEach((id) => { if (!ranking.includes(id)) ranking.push(id); });
  s.rankings[split.kind] = ranking;

  const placement = ranking.indexOf(s.teamId) + 1;
  s.placements[split.kind] = placement;
  const top = s.tier === 1 ? LEAGUE_PRIZE[s.region] * (split.kind === 'cup' ? 0.6 : 1) : LOWER_PRIZE[s.tier];
  if (PLACE_SHARE[placement]) addPrize(state, `${split.name} · ${placement}º lugar`, top * PLACE_SHARE[placement]);

  if (champ === s.teamId) {
    const detail = { 1: 'Liga principal', 2: 'Divisão de acesso', 3: 'Liga amadora' }[s.tier];
    const trophy = { kind: 'league', name: split.name, detail, year: s.year, teamId: s.teamId, tier: s.tier };
    s.titles.push(trophy);
    state.player.trophies.push(trophy);
    state.player.fame = clamp(state.player.fame + (4 - s.tier) * 3, 0, 100);
    state.player.morale = clamp(state.player.morale + 8, 0, 100);
    pushModal(state, { kind: 'trophy', trophy });
  }

  return { matches, inPlayoffs: seeds.includes(s.teamId), placement, championId: champ };
}

// ---------------------------------------------------------------- internacional

// Representantes de cada região. Na região do jogador (liga principal), as
// vagas seguem a classificação real da etapa; nas outras, sorteio por força.
function intlField(state, key) {
  const s = state.season;
  const ranking = s.tier === 1 ? s.rankings[INTL[key].rank] : null;
  const field = [];
  for (const region of Object.values(REGIONS)) {
    let n = region[key];
    if (key === 'worlds' && s.msiFinalRegions.includes(region.id)) n++;
    if (ranking && region.id === s.region) {
      field.push(...ranking.slice(0, n));
      continue;
    }
    activeTeams(state)
      .filter((t) => t.region === region.id && t.tier === 1)
      .map((t) => ({ id: t.id, v: t.rating + rand(-4, 4) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, n)
      .forEach((t) => field.push(t.id));
  }
  activeTeams(state)
    .filter((t) => t.region === 'wc')
    .slice(0, WILDCARD_SLOTS[key])
    .forEach((t) => field.push(t.id));
  return field;
}

// Forma de cada time no torneio internacional (sorteada uma vez por evento).
function intlForm(state, ids) {
  const form = {};
  ids.forEach((id) => { form[id] = formRoll(5); });
  return form;
}

function intlSeries(state, a, b, bo, form) {
  const s = state.season;
  if (a === s.teamId || b === s.teamId) {
    const opp = a === s.teamId ? b : a;
    const res = playerSeries(state, teamOf(state, opp).rating + form[opp], bo);
    return a === s.teamId ? { sa: res.w, sb: res.l } : { sa: res.l, sb: res.w };
  }
  const res = simSeries(teamOf(state, a).rating + form[a], teamOf(state, b).rating + form[b], bo);
  return { sa: res.a, sb: res.b };
}

function knockout(state, ids, labels, matches, form) {
  let round = shuffle(ids);
  let li = 0;
  while (round.length > 1) {
    const next = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i];
      const b = round[i + 1];
      const { sa, sb } = intlSeries(state, a, b, 5, form);
      const winner = sa > sb ? a : b;
      matches.push({ label: labels[li], a, b, sa, sb, winner });
      next.push(winner);
    }
    round = next;
    li++;
  }
  return round[0];
}

function winIntl(state, name) {
  const s = state.season;
  const trophy = { kind: 'intl', name, detail: 'Internacional', year: s.year, teamId: s.teamId, tier: 0 };
  s.titles.push(trophy);
  state.player.trophies.push(trophy);
  const fame = { Mundial: 20, MSI: 12, 'First Stand': 8 }[name];
  state.player.fame = clamp(state.player.fame + fame, 0, 100);
  state.player.morale = clamp(state.player.morale + 10, 0, 100);
  pushModal(state, { kind: 'trophy', trophy });
}

// First Stand e MSI: os times mais fracos disputam um play-in até sobrar
// uma chave de 8. Mundial: fase suíça + chave de 8.
// Retorna true quando há tela para mostrar (Mundial com o time do jogador).
function runIntl(state, key) {
  const s = state.season;
  const { name } = INTL[key];
  const field = intlField(state, key);
  const form = intlForm(state, field);
  const involved = field.includes(s.teamId);
  const matches = [];
  let bracket;
  let swiss = null;
  let advanced = true;

  if (key === 'worlds') {
    const others = field.filter((id) => id !== s.teamId);
    bracket = [];
    if (involved) {
      // Fase suíça do jogador: avança com 3 vitórias, cai com 3 derrotas.
      swiss = { w: 0, l: 0, matches: [] };
      const opps = shuffle(others);
      let i = 0;
      while (swiss.w < 3 && swiss.l < 3) {
        const opp = opps[i++ % opps.length];
        const decisive = swiss.w === 2 || swiss.l === 2;
        const { sa, sb } = intlSeries(state, s.teamId, opp, decisive ? 3 : 1, form);
        if (sa > sb) swiss.w++; else swiss.l++;
        swiss.matches.push({ oppId: opp, w: sa, l: sb, won: sa > sb });
      }
      advanced = swiss.w === 3;
      if (advanced) bracket.push(s.teamId);
    }
    const pool = others.slice();
    while (bracket.length < 8) {
      const t = weightedPick(pool, (id) => Math.pow(Math.max(1, teamOf(state, id).rating + form[id] - 65), 2));
      pool.splice(pool.indexOf(t), 1);
      bracket.push(t);
    }
  } else {
    const seeded = field.slice().sort((a, b) => teamOf(state, b).rating - teamOf(state, a).rating);
    const extra = Math.max(0, seeded.length - 8);
    bracket = seeded.slice(0, seeded.length - extra * 2);
    const playIn = seeded.slice(seeded.length - extra * 2);
    for (let i = 0; i < extra; i++) {
      const a = playIn[i];
      const b = playIn[playIn.length - 1 - i];
      const { sa, sb } = intlSeries(state, a, b, 5, form);
      const winner = sa > sb ? a : b;
      matches.push({ label: 'Play-in', a, b, sa, sb, winner });
      bracket.push(winner);
      if (winner !== s.teamId && (a === s.teamId || b === s.teamId)) advanced = false;
    }
  }

  const champ = knockout(state, bracket, ['Quartas de final', 'Semifinal', 'Final'], matches, form);
  if (key === 'msi') {
    const final = matches[matches.length - 1];
    s.msiFinalRegions = [teamOf(state, final.a).region, teamOf(state, final.b).region];
  }
  s.intl[key] = !involved ? 'out' : champ === s.teamId ? 'champion' : 'eliminated';
  s.intlChampions = { ...(s.intlChampions || {}), [key]: champ };
  if (involved) {
    // Fase alcançada: campeão, vice, semifinal, quartas ou antes disso.
    const lost = matches.find((m) => (m.a === s.teamId || m.b === s.teamId) && m.winner !== s.teamId);
    const finish = champ === s.teamId ? 1
      : { Final: 2, Semifinal: 3, 'Quartas de final': 5 }[lost?.label] ?? 9;
    const stage = { 1: 'campeão', 2: 'vice', 3: 'semifinal', 5: 'quartas de final', 9: 'fase inicial' }[finish];
    addPrize(state, `${name} · ${stage}`, INTL_PRIZE[key][finish]);
  }
  if (!involved) return false;
  if (champ === s.teamId) winIntl(state, name);
  const result = { key, name, swiss, advanced, matches, championId: champ, eliminated: champ !== s.teamId };
  // First Stand e MSI não têm tela própria: o resumo aparece no topo da
  // próxima decisão. Só o Mundial ganha tela.
  if (key !== 'worlds') {
    s.recap = result;
    return false;
  }
  state.screen = { type: 'intl', ...result };
  return true;
}

// ---------------------------------------------------------------- eventos

// Nenhuma escolha é garantida nem impossível: chance sempre entre 20% e 80%.
const CHANCE_MIN = 20;
const CHANCE_MAX = 80;

// Escolhas do evento que valem para a rota do jogador (índices originais).
function choicesFor(ev, role) {
  return ev.choices.map((c, idx) => ({ c, idx })).filter(({ c }) => roleAllows(c, role));
}

function eventScreen(state, stage) {
  const p = state.player;
  const ctx = { stage, team: teamOf(state, p.teamId), year: state.season.year };
  const ok = (e) => (!e.when || e.when(p, ctx)) && roleAllows(e, p.role) && choicesFor(e, p.role).length >= 2;
  let pool = EVENTS.filter((e) => ok(e) && !p.usedEvents.includes(e.id));
  if (!pool.length) pool = EVENTS.filter(ok);
  const ev = pick(pool);
  p.usedEvents.push(ev.id);
  if (p.usedEvents.length > 16) p.usedEvents.shift();

  const options = choicesFor(ev, p.role).map(({ c, idx }) => {
    const attrBonus = c.attr ? (p.attrs[c.attr] - 60) * 0.5 : 0;
    return { idx, chance: Math.round(clamp(c.base + attrBonus + (p.morale - 50) * 0.1, CHANCE_MIN, CHANCE_MAX)) };
  });
  const label = STAGE_LABELS[state.season.tier === 1 ? 1 : 'lower'][stage];
  const recap = state.season.recap || null;
  state.season.recap = null;
  state.screen = { type: 'event', stage, label, eventId: ev.id, options, choice: null, ok: null, ovrDelta: 0, recap };
}

// Opções da tela de evento (compatível com saves antigos, que tinham `chances`).
export function eventOptions(scr) {
  const opts = scr.options || scr.chances.map((chance, idx) => ({ idx, chance }));
  return opts.map((o) => ({ ...o, chance: clamp(o.chance, CHANCE_MIN, CHANCE_MAX) }));
}

export function chooseEvent(state, pos) {
  const scr = state.screen;
  const ev = eventById(scr.eventId);
  const opt = eventOptions(scr)[pos];
  const choice = ev.choices[opt.idx];
  const ok = roll(opt.chance);
  const before = ovrOf(state.player);
  applyFx(state.player, (ok ? choice.ok : choice.fail).fx);
  const team = teamOf(state, state.player.teamId);
  state.player.status = statusFor(ovrOf(state.player), team.rating, state.player.morale);
  scr.choice = opt.idx;
  scr.ok = ok;
  scr.ovrDelta = ovrOf(state.player) - before;
}

// ---------------------------------------------------------------- fim de temporada

function computeAwards(state, playedRatio) {
  const s = state.season;
  const p = state.player;
  const ovr = ovrOf(p);
  const team = teamOf(state, s.teamId);
  const leagueTop = Math.max(...leagueTeams(state, team).map((t) => t.rating));
  const best = Math.min(99, ...Object.values(s.placements));
  const pogRate = s.stats.pog / Math.max(1, s.stats.games);
  const awards = [];

  if (playedRatio >= 0.5) {
    const place = best === 1 ? 15 : best === 2 ? 6 : 0;
    if (roll(clamp((ovr - leagueTop) * 6 + 12 + place + pogRate * 40, 0, 75))) {
      awards.push(`MVP ${ofLeague(s.league)}`);
    } else if (roll(clamp((ovr - leagueTop + 8) * 8 + place, 0, 85))) {
      awards.push(`Seleção ${ofLeague(s.league)}`);
    }
    const firstInTier = !p.history.some((h) => h.tier === s.tier);
    if (s.tier === 1 && firstInTier && p.age <= 20 && roll(clamp((ovr - 68) * 7 + 25, 0, 85))) {
      awards.push(`Revelação ${ofLeague(s.league)}`);
    }
  }
  if (s.titles.some((t) => t.name === 'Mundial') && roll(clamp(30 + (ovr - 85) * 4, 10, 70))) {
    awards.push('MVP da Final do Mundial');
  }

  const mvpPrize = s.tier === 1 ? { kr: 10000, cn: 10000, eu: 7000, na: 6000, br: 3000 }[s.region] : { 2: 1000, 3: 300 }[s.tier];
  for (const name of awards) {
    const amount = name === 'MVP da Final do Mundial' ? 20000
      : name.startsWith('MVP') ? mvpPrize
        : name.startsWith('Seleção') ? mvpPrize / 2
          : 3000;
    addPrize(state, name, amount);
    const trophy = { kind: 'award', name, detail: 'Prêmio individual', year: s.year, teamId: s.teamId, tier: s.tier };
    p.trophies.push(trophy);
    s.awards.push(trophy);
    p.fame = clamp(p.fame + 4, 0, 100);
    pushModal(state, { kind: 'trophy', trophy });
  }
}

function driftWorld(state) {
  for (const t of activeTeams(state)) {
    const [lo, hi] = TIER_RANGE[t.tier];
    // Oscila em torno do nível histórico do clube, pra manter a hierarquia entre regiões.
    const pull = ((t.base ?? t.rating) - t.rating) * 0.2;
    t.rating = Math.round(clamp(t.rating + rand(-3, 3) + pull, lo, hi));
  }
}

function endSeason(state) {
  const s = state.season;
  const p = state.player;
  const st = s.stats;
  const playedRatio = st.games / Math.max(1, st.teamGames);
  const winRate = st.games ? st.wins / st.games : st.teamWins / Math.max(1, st.teamGames);

  computeAwards(state, playedRatio);

  // Ambiente de treino: ligas mais fortes fazem o jogador evoluir mais e
  // aumentam o teto dele; títulos internacionais e MVP também. A divisão de
  // acesso de uma região forte (LCK CL, LDL) também ajuda, em 60%.
  const regionLevel = REGION_LEVEL[s.region];
  const envScale = s.tier === 1 ? 1 : 0.6;
  const level = regionLevel && {
    growth: 1 + (regionLevel.growth - 1) * envScale,
    potential: regionLevel.potential * envScale,
  };
  const tierFactor = { 1: 1, 2: 0.9, 3: 0.8 }[s.tier];
  const intlTitle = s.titles.some((t) => t.kind === 'intl');
  const mvp = s.awards.some((a) => a.name.startsWith('MVP'));
  p.potential = Math.min(96, p.potential + ((level?.potential || 0) + (intlTitle ? 0.5 : 0) + (mvp ? 0.5 : 0)) * (p.potential >= 88 ? 0.6 : 1));
  const growth = seasonGrowth(p, { playedRatio, winRate, env: (level?.growth ?? 1) * tierFactor });
  const ovrEnd = ovrOf(p);
  p.lastSeason = {
    titles: s.titles.length, awards: s.awards.length, growth, playedRatio,
    bestPlace: Math.min(99, ...Object.values(s.placements)),
  };

  // Salário do ano (contrato mensal × 12) + premiações da temporada.
  const earn = s.earnings || { salary: 0, prizes: 0, items: [] };
  earn.salary = Math.round(p.contract.salary * 12);
  p.earnings = p.earnings || { salary: 0, prizes: 0 };
  p.earnings.salary += earn.salary;
  p.earnings.prizes += earn.prizes;

  p.history.push({
    age: s.age, year: s.year, teamId: s.teamId, tier: s.tier, ovr: ovrEnd,
    games: st.games, wins: st.wins, k: st.k, d: st.d, a: st.a, pog: st.pog, titles: s.titles.length,
    earnings: earn.salary + earn.prizes,
  });
  p.contract.years = Math.max(0, p.contract.years - 1);
  if (p.loan) p.loan.years = Math.max(0, p.loan.years - 1);

  // Temporada muito ruim (quase não jogou, nível bem abaixo do time ou em
  // atrito com o técnico): a diretoria pode forçar um empréstimo.
  const team = teamOf(state, s.teamId);
  const poor = playedRatio < 0.35 || ovrEnd < team.rating - 9 || p.morale < 25;
  p.pendingLoan = !p.loan && p.contract.years > 0 && poor && roll(75);
  p.betSeason = false;
  p.fame = clamp(Math.round(p.fame * 0.93), 0, 100);
  p.age++;
  state.world.year++;
  driftWorld(state);

  const forced = p.age >= 35 || (ovrEnd < 52 && p.age >= 24);
  state.screen = {
    type: 'seasonEnd',
    year: s.year,
    ovrStart: s.ovrStart,
    ovrEnd,
    stats: { ...st },
    titles: s.titles.slice(),
    awards: s.awards.slice(),
    earnings: { salary: earn.salary, prizes: Math.round(earn.prizes), items: earn.items.slice() },
    forced,
    canRetire: p.age >= 27,
    loanNext: p.pendingLoan,
    growth,
  };
}

export function continueAfterSeason(state) {
  if (state.screen.forced) return retire(state);
  offseasonScreen(state);
  // Sem propostas e com contrato em vigor não há o que decidir: segue direto.
  const scr = state.screen;
  if (!scr.offers.length && scr.stay && !scr.stay.renew) chooseOffer(state, 'stay');
}

// ---------------------------------------------------------------- aposentadoria

export function legacyLabel(p) {
  const worlds = p.trophies.filter((t) => t.name === 'Mundial').length;
  const msi = p.trophies.filter((t) => t.name === 'MSI').length;
  const t1 = p.trophies.filter((t) => t.kind === 'league' && t.tier === 1).length;
  const playedT1 = p.history.some((h) => h.tier === 1);
  if (worlds >= 3 || (worlds >= 2 && p.peakOvr >= 92)) return { title: 'Lenda do Rift', tone: 'gold' };
  if (worlds) return { title: 'Campeão mundial', tone: 'gold' };
  if (msi || t1 >= 5) return { title: 'Ídolo da região', tone: 'silver' };
  if (t1) return { title: 'Campeão nacional', tone: 'silver' };
  if (playedT1) return { title: 'Profissional de elite', tone: 'bronze' };
  if (p.trophies.some((t) => t.kind === 'league')) return { title: 'Ídolo do cenário de acesso', tone: 'bronze' };
  return { title: 'Talento que não decolou', tone: 'plain' };
}

export const careerEarnings = (p) => (p.earnings ? p.earnings.salary + p.earnings.prizes : 0);

// Pontos de legado, parte por parte (o relatório final mostra a conta).
export function legacyBreakdown(p) {
  const count = (fn) => p.trophies.filter(fn).length;
  const parts = [
    { label: `OVR máximo (${p.peakOvr} × 2)`, points: p.peakOvr * 2 },
    { label: 'Mundiais', n: count((t) => t.name === 'Mundial'), each: 120 },
    { label: 'MSI', n: count((t) => t.name === 'MSI'), each: 60 },
    { label: 'First Stand', n: count((t) => t.name === 'First Stand'), each: 35 },
    { label: 'Títulos de liga principal', n: count((t) => t.kind === 'league' && t.tier === 1), each: 20 },
    { label: 'Títulos de divisão de acesso', n: count((t) => t.kind === 'league' && t.tier === 2), each: 8 },
    { label: 'Títulos de liga amadora', n: count((t) => t.kind === 'league' && t.tier === 3), each: 4 }, // só em saves antigos
    { label: 'MVP da Final do Mundial', n: count((t) => t.name === 'MVP da Final do Mundial'), each: 25 },
    { label: 'Outros prêmios individuais', n: count((t) => t.kind === 'award' && t.name !== 'MVP da Final do Mundial'), each: 10 },
  ].map((x) => (x.points != null ? x : { label: x.n ? `${x.label} (${x.n} × ${x.each})` : x.label, points: x.n * x.each }));
  // Dinheiro conta pouco: +10 por US$ 100 mil, +20 por US$ 1 milhão, +30 por US$ 10 milhões.
  const money = careerEarnings(p);
  parts.push({ label: 'Dinheiro arrecadado', points: money > 10000 ? Math.round(10 * Math.log10(money / 10000)) : 0 });
  return parts.filter((x) => x.points > 0);
}

// Pontuação única da carreira (histórico e recordes do site).
export function legacyScore(p) {
  return legacyBreakdown(p).reduce((sum, x) => sum + x.points, 0);
}

export function retire(state) {
  state.player.retired = true;
  state.screen = { type: 'retired' };
}

// Só para scripts de balanceamento (scripts/odds.mjs).
export const __runIntlForTests = runIntl;
