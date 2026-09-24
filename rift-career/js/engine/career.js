// Fluxo da carreira: propostas → temporada (splits, eventos, playoffs,
// torneios internacionais) → fim de temporada → nova janela … → aposentadoria.
//
// Toda a lógica muda `state` e define `state.screen`; a UI só desenha.

import { buildTeams, REGIONS, TIER_RANGE, nationById } from '../data/world.js';
import { EVENTS, eventById } from '../data/events.js';
import {
  createPlayer, ovrOf, effectiveOvr, applyFx, seasonGrowth, salaryFor, statusFor, STATUS,
} from './player.js';
import { simGame, simSeries, roundRobin, gameStats } from './sim.js';
import { clamp, pick, rand, randInt, roll, shuffle, weightedPick } from '../util.js';

export const START_YEAR = 2026;

const SEASON_QUEUE = [
  'ev0', 'reg1a', 'ev1a', 'reg1b', 'ev1b', 'po1', 'msi',
  'reg2a', 'ev2a', 'reg2b', 'ev2b', 'po2', 'worlds', 'end',
];

export const STAGE_LABEL = {
  ev0: 'PRÉ-TEMPORADA',
  ev1a: 'SPLIT 1 · MEIO DO SPLIT',
  ev1b: 'SPLIT 1 · RETA FINAL',
  ev2a: 'SPLIT 2 · MEIO DO SPLIT',
  ev2b: 'SPLIT 2 · RETA FINAL',
};

// ---------------------------------------------------------------- helpers

export const teamOf = (state, id) => state.world.teams[id];

export function leagueName(team) {
  if (team.region === 'wc') return 'Wildcard';
  return REGIONS[team.region].leagues[team.tier];
}

export function leagueTeams(state, team) {
  return Object.values(state.world.teams).filter((t) => t.region === team.region && t.tier === team.tier);
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
    v: 1,
    world: { year: START_YEAR, teams: buildTeams() },
    player: createPlayer({ ...form, region: nation.region }),
    season: null,
    screen: null,
    modals: [],
  };
  state.screen = {
    type: 'offers',
    first: true,
    offers: genOffers(state, true),
    stay: null,
    note: '',
  };
  return state;
}

// ---------------------------------------------------------------- propostas

function makeOffer(state, team, first) {
  const p = state.player;
  const ovr = ovrOf(p);
  return {
    teamId: team.id,
    salary: salaryFor(ovr, team.tier),
    years: first ? 2 : randInt(1, 3),
    status: statusFor(ovr, team.rating, 55),
    ambition: ambitionLabel(state, team),
  };
}

export function genOffers(state, first = false) {
  const p = state.player;
  const ovr = ovrOf(p);
  const score = ovr + p.fame / 20;
  const all = Object.values(state.world.teams).filter((t) => t.region !== 'wc' && t.id !== p.teamId);
  const lo = score - 12;
  const hi = score + 2;

  let cands;
  if (first) {
    // Primeiro contrato: base/academias da região de origem.
    cands = all.filter((t) => t.region === p.region && t.tier >= 2 && t.rating <= score + 6);
  } else {
    cands = all.filter((t) => {
      if (t.rating < lo || t.rating > hi) return false;
      if (t.region !== p.region) {
        if (t.tier > 1) return false;
        const strong = t.region === 'kr' || t.region === 'cn';
        const need = p.nat === 'KR' ? 74 : strong ? 84 : 77;
        if (ovr < need) return false;
      }
      return true;
    });
  }

  const offers = [];
  const pool = cands.slice();
  const count = first ? 3 : clamp(Math.round(1 + p.fame / 30 + rand(0, 2)), 1, 3);
  while (offers.length < count && pool.length) {
    const t = weightedPick(pool, (x) => Math.pow(Math.max(1, x.rating - lo), 1.4) * (x.region === p.region ? 1 : 0.6));
    pool.splice(pool.indexOf(t), 1);
    offers.push(makeOffer(state, t, first));
  }
  return offers;
}

function fallbackOffers(state) {
  const p = state.player;
  const pool = Object.values(state.world.teams)
    .filter((t) => t.region === p.region && t.tier === 3 && t.id !== p.teamId)
    .sort((a, b) => a.rating - b.rating)
    .slice(0, 3);
  return pool.map((t) => makeOffer(state, t, false));
}

export function offseasonScreen(state) {
  const p = state.player;
  const team = teamOf(state, p.teamId);
  const ovr = ovrOf(p);
  let stay = null;
  let note = '';
  let offers;

  if (p.contract.years > 0) {
    stay = { teamId: team.id, years: p.contract.years, salary: p.contract.salary, renew: false };
    const interest = roll(55 + p.fame / 3) || ovr > team.rating + 3;
    offers = interest ? genOffers(state) : [];
    note = offers.length
      ? `Você ainda tem ${p.contract.years} ${p.contract.years > 1 ? 'anos' : 'ano'} de contrato com ${team.name}, mas chegaram propostas.`
      : `Nenhuma proposta nesta janela. Seu contrato com ${team.name} segue válido.`;
  } else {
    const wanted = team.rating <= ovr + p.fame / 20 + 5 && p.morale >= 25;
    if (wanted) {
      stay = { teamId: team.id, years: randInt(1, 3), salary: salaryFor(ovr, team.tier), renew: true };
      note = `Seu contrato acabou. ${team.name} quer renovar, e outros times estão de olho.`;
    } else {
      note = `Seu contrato acabou e ${team.name} não quis renovar.`;
    }
    offers = genOffers(state);
    if (!stay && !offers.length) offers = fallbackOffers(state);
  }

  state.screen = { type: 'offers', first: false, offers, stay, note };
}

export function chooseOffer(state, index) {
  const p = state.player;
  const scr = state.screen;
  const offer = index === 'stay' ? scr.stay : scr.offers[index];
  const moved = offer.teamId !== p.teamId;
  if (moved && p.teamId) p.fame = clamp(p.fame + 2, 0, 100);
  p.teamId = offer.teamId;
  p.contract = { years: offer.years, salary: offer.salary };
  if (moved) p.morale = 55;
  startSeason(state);
  advance(state);
}

// ---------------------------------------------------------------- temporada

function startSeason(state) {
  const p = state.player;
  const team = teamOf(state, p.teamId);
  p.morale = Math.round(p.morale + (55 - p.morale) * 0.3);
  p.status = statusFor(ovrOf(p), team.rating, p.morale);
  state.season = {
    year: state.world.year,
    age: p.age,
    teamId: team.id,
    tier: team.tier,
    region: team.region,
    league: leagueName(team),
    ovrStart: ovrOf(p),
    queue: SEASON_QUEUE.slice(),
    idx: 0,
    stats: { games: 0, wins: 0, k: 0, d: 0, a: 0, pog: 0, teamGames: 0, teamWins: 0 },
    titles: [],
    awards: [],
    placements: {},
    split: null,
  };
}

export function advance(state) {
  const s = state.season;
  while (s.idx < s.queue.length) {
    const step = s.queue[s.idx++];
    if (step.startsWith('ev')) return eventScreen(state, step);
    if (step === 'reg1a' || step === 'reg2a') {
      s.split = newSplit(state, step === 'reg1a' ? 1 : 2);
      return regularBlock(state);
    }
    if (step === 'reg1b' || step === 'reg2b') return regularBlock(state);
    if (step === 'po1' || step === 'po2') return playoffs(state);
    if (step === 'msi') {
      if (qualifies(state, 'msi')) return runMsi(state);
      continue;
    }
    if (step === 'worlds') {
      if (qualifies(state, 'worlds')) return runWorlds(state);
      continue;
    }
    if (step === 'end') return endSeason(state);
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

function newSplit(state, n) {
  const team = teamOf(state, state.season.teamId);
  const ids = leagueTeams(state, team).map((t) => t.id);
  const split = { n, ids, table: {}, form: {}, tb: {}, rounds: roundRobin(ids), played: 0 };
  ids.forEach((id) => {
    split.table[id] = { w: 0, l: 0 };
    split.form[id] = rand(-4, 4);
    split.tb[id] = Math.random();
  });
  return split;
}

function aiPower(state, id) {
  const split = state.season.split;
  return teamOf(state, id).rating + (split?.form[id] || 0);
}

function regularBlock(state) {
  const s = state.season;
  const split = s.split;
  const half = Math.ceil(split.rounds.length / 2);
  const target = split.played < half ? half : split.rounds.length;
  const from = split.played;
  const results = [];

  for (let r = from; r < target; r++) {
    for (const [a, b] of split.rounds[r]) {
      let winner;
      if (a === s.teamId || b === s.teamId) {
        const opp = a === s.teamId ? b : a;
        const res = playerSeries(state, aiPower(state, opp), 1);
        winner = res.won ? s.teamId : opp;
        results.push({ round: r + 1, oppId: opp, w: res.w, l: res.l, won: res.won, line: res.line });
      } else {
        const res = simSeries(aiPower(state, a), aiPower(state, b), 1);
        winner = res.a > res.b ? a : b;
      }
      const loser = winner === a ? b : a;
      split.table[winner].w++;
      split.table[loser].l++;
    }
  }
  split.played = target;

  state.screen = {
    type: 'regular',
    split: split.n,
    from: from + 1,
    to: target,
    total: split.rounds.length,
    final: target === split.rounds.length,
    results,
  };
}

function playoffs(state) {
  const s = state.season;
  const split = s.split;
  const table = standings(split);
  const top4 = table.slice(0, 4);
  const bo = s.tier === 3 ? 3 : 5;
  const matches = [];

  const series = (a, b, label) => {
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
    return winner;
  };

  const w1 = series(top4[0], top4[3], 'Semifinal');
  const w2 = series(top4[1], top4[2], 'Semifinal');
  const champ = series(w1, w2, 'Final');

  let placement;
  const inPlayoffs = top4.includes(s.teamId);
  if (champ === s.teamId) placement = 1;
  else if (w1 === s.teamId || w2 === s.teamId) placement = 2;
  else if (inPlayoffs) placement = top4.indexOf(s.teamId) < 2 ? 3 : 4;
  else placement = table.indexOf(s.teamId) + 1;
  s.placements[split.n] = placement;

  if (champ === s.teamId) {
    const trophy = {
      kind: 'league', name: s.league, detail: `Split ${split.n}`, year: s.year, teamId: s.teamId, tier: s.tier,
    };
    s.titles.push(trophy);
    state.player.trophies.push(trophy);
    state.player.fame = clamp(state.player.fame + (4 - s.tier) * 3, 0, 100);
    state.player.morale = clamp(state.player.morale + 8, 0, 100);
    pushModal(state, { kind: 'trophy', trophy });
  }

  state.screen = {
    type: 'playoffs',
    split: split.n,
    matches,
    inPlayoffs,
    placement,
    championId: champ,
  };
}

// ---------------------------------------------------------------- internacional

function qualifies(state, key) {
  const s = state.season;
  if (s.tier !== 1 || s.region === 'wc') return false;
  const slots = REGIONS[s.region][key];
  if (key === 'msi') return s.placements[1] <= slots;
  return s.placements[2] <= slots || (slots > 1 && s.placements[1] === 1);
}

// Seleciona os representantes de cada região (o time do jogador ocupa uma vaga).
function intlField(state, key) {
  const s = state.season;
  const field = [s.teamId];
  for (const region of Object.values(REGIONS)) {
    const n = region[key] - (region.id === s.region ? 1 : 0);
    const pool = Object.values(state.world.teams)
      .filter((t) => t.region === region.id && t.tier === 1 && t.id !== s.teamId)
      .map((t) => ({ id: t.id, v: t.rating + rand(-4, 4) }))
      .sort((a, b) => b.v - a.v);
    pool.slice(0, n).forEach((t) => field.push(t.id));
  }
  if (key === 'worlds') {
    Object.values(state.world.teams).filter((t) => t.region === 'wc').forEach((t) => field.push(t.id));
  }
  return field;
}

// Forma de cada time no torneio internacional (sorteada uma vez por evento).
function intlForm(state, ids) {
  const form = {};
  ids.forEach((id) => { form[id] = rand(-5, 5); });
  return form;
}

function knockout(state, ids, labels, matches, form) {
  const s = state.season;
  let round = shuffle(ids);
  let li = 0;
  while (round.length > 1) {
    const next = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i];
      const b = round[i + 1];
      let sa;
      let sb;
      if (a === s.teamId || b === s.teamId) {
        const opp = a === s.teamId ? b : a;
        const res = playerSeries(state, teamOf(state, opp).rating + form[opp], 5);
        sa = a === s.teamId ? res.w : res.l;
        sb = a === s.teamId ? res.l : res.w;
      } else {
        const res = simSeries(teamOf(state, a).rating + form[a], teamOf(state, b).rating + form[b], 5);
        sa = res.a;
        sb = res.b;
      }
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
  state.player.fame = clamp(state.player.fame + (name === 'Mundial' ? 20 : 12), 0, 100);
  state.player.morale = clamp(state.player.morale + 10, 0, 100);
  pushModal(state, { kind: 'trophy', trophy });
}

function runMsi(state) {
  const s = state.season;
  const field = intlField(state, 'msi');
  const matches = [];
  const champ = knockout(state, field, ['Quartas de final', 'Semifinal', 'Final'], matches, intlForm(state, field));
  if (champ === s.teamId) winIntl(state, 'MSI');
  state.screen = { type: 'intl', name: 'MSI', swiss: null, matches, championId: champ, eliminated: champ !== s.teamId };
}

function runWorlds(state) {
  const s = state.season;
  const field = intlField(state, 'worlds');
  const others = field.filter((id) => id !== s.teamId);
  const form = intlForm(state, field);

  // Fase suíça: avança com 3 vitórias, cai com 3 derrotas.
  const swiss = { w: 0, l: 0, matches: [] };
  const opps = shuffle(others);
  let i = 0;
  while (swiss.w < 3 && swiss.l < 3) {
    const opp = opps[i++ % opps.length];
    const decisive = swiss.w === 2 || swiss.l === 2;
    const res = playerSeries(state, teamOf(state, opp).rating + form[opp], decisive ? 3 : 1);
    if (res.won) swiss.w++; else swiss.l++;
    swiss.matches.push({ oppId: opp, w: res.w, l: res.l, won: res.won });
  }

  const advanced = swiss.w === 3;
  const pool = others.slice();
  const bracket = advanced ? [s.teamId] : [];
  while (bracket.length < 8) {
    const t = weightedPick(pool, (id) => Math.pow(Math.max(1, teamOf(state, id).rating - 65), 2));
    pool.splice(pool.indexOf(t), 1);
    bracket.push(t);
  }
  const matches = [];
  const champ = knockout(state, bracket, ['Quartas de final', 'Semifinal', 'Final'], matches, form);
  if (champ === s.teamId) winIntl(state, 'Mundial');
  state.screen = { type: 'intl', name: 'Mundial', swiss, advanced, matches, championId: champ, eliminated: champ !== s.teamId };
}

// ---------------------------------------------------------------- eventos

function eventScreen(state, stage) {
  const p = state.player;
  const ctx = { stage, team: teamOf(state, p.teamId) };
  const ok = (e) => !e.when || e.when(p, ctx);
  let pool = EVENTS.filter((e) => ok(e) && !p.usedEvents.includes(e.id));
  if (!pool.length) pool = EVENTS.filter(ok);
  const ev = pick(pool);
  p.usedEvents.push(ev.id);
  if (p.usedEvents.length > 16) p.usedEvents.shift();

  const chances = ev.choices.map((c) => {
    const attrBonus = c.attr ? (p.attrs[c.attr] - 60) * 0.5 : 0;
    return Math.round(clamp(c.base + attrBonus + (p.morale - 50) * 0.1, 5, 95));
  });
  state.screen = { type: 'event', stage, eventId: ev.id, chances, choice: null, ok: null, ovrDelta: 0 };
}

export function chooseEvent(state, index) {
  const scr = state.screen;
  const ev = eventById(scr.eventId);
  const choice = ev.choices[index];
  const ok = roll(scr.chances[index]);
  const before = ovrOf(state.player);
  applyFx(state.player, (ok ? choice.ok : choice.fail).fx);
  const team = teamOf(state, state.player.teamId);
  state.player.status = statusFor(ovrOf(state.player), team.rating, state.player.morale);
  scr.choice = index;
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
  const best = Math.min(s.placements[1] || 99, s.placements[2] || 99);
  const pogRate = s.stats.pog / Math.max(1, s.stats.games);
  const awards = [];

  if (playedRatio >= 0.5) {
    const place = best === 1 ? 15 : best === 2 ? 6 : 0;
    if (roll(clamp((ovr - leagueTop) * 6 + 12 + place + pogRate * 40, 0, 75))) {
      awards.push(`MVP da ${s.league}`);
    } else if (roll(clamp((ovr - leagueTop + 8) * 8 + place, 0, 85))) {
      awards.push(`Seleção da ${s.league}`);
    }
    const firstInTier = !p.history.some((h) => h.tier === s.tier);
    if (s.tier === 1 && firstInTier && p.age <= 20 && roll(clamp((ovr - 68) * 7 + 25, 0, 85))) {
      awards.push(`Revelação da ${s.league}`);
    }
  }
  if (s.titles.some((t) => t.name === 'Mundial') && roll(clamp(30 + (ovr - 85) * 4, 10, 70))) {
    awards.push('MVP da Final do Mundial');
  }

  for (const name of awards) {
    const trophy = { kind: 'award', name, detail: 'Prêmio individual', year: s.year, teamId: s.teamId, tier: s.tier };
    p.trophies.push(trophy);
    s.awards.push(trophy);
    p.fame = clamp(p.fame + 4, 0, 100);
    pushModal(state, { kind: 'trophy', trophy });
  }
}

function driftWorld(state) {
  for (const t of Object.values(state.world.teams)) {
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
  seasonGrowth(p, { playedRatio, winRate });
  const ovrEnd = ovrOf(p);

  p.history.push({
    age: s.age, year: s.year, teamId: s.teamId, tier: s.tier, ovr: ovrEnd,
    games: st.games, wins: st.wins, k: st.k, d: st.d, a: st.a, pog: st.pog, titles: s.titles.length,
  });
  p.contract.years = Math.max(0, p.contract.years - 1);
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
    forced,
    canRetire: p.age >= 27,
  };
}

export function continueAfterSeason(state) {
  if (state.screen.forced) return retire(state);
  offseasonScreen(state);
}

// ---------------------------------------------------------------- aposentadoria

export function legacyLabel(p) {
  const worlds = p.trophies.filter((t) => t.name === 'Mundial').length;
  const msi = p.trophies.filter((t) => t.name === 'MSI').length;
  const t1 = p.trophies.filter((t) => t.kind === 'league' && t.tier === 1).length;
  const playedT1 = p.history.some((h) => h.tier === 1);
  if (worlds >= 3 || (worlds >= 2 && p.peakOvr >= 92)) return { title: 'Lenda do Rift', tone: 'gold' };
  if (worlds) return { title: 'Campeão mundial', tone: 'gold' };
  if (msi || t1 >= 3) return { title: 'Ídolo da região', tone: 'silver' };
  if (t1) return { title: 'Campeão nacional', tone: 'silver' };
  if (playedT1) return { title: 'Profissional de elite', tone: 'bronze' };
  if (p.trophies.some((t) => t.kind === 'league')) return { title: 'Ídolo do cenário de acesso', tone: 'bronze' };
  return { title: 'Talento que não decolou', tone: 'plain' };
}

export function retire(state) {
  state.player.retired = true;
  state.screen = { type: 'retired' };
}
