// Simula carreiras inteiras escolhendo opções ao acaso, pra calibrar o
// balanceamento (OVR de pico, títulos, idade de aposentadoria…).
// Uso: node scripts/simulate.mjs [quantidade] [região]
import { newCareer, chooseOffer, chooseEvent, advance, continueAfterSeason, legacyLabel, teamOf } from '../js/engine/career.js';
import { rollAttrs, ovrOf } from '../js/engine/player.js';
import { ROLES } from '../js/data/world.js';

const N = Number(process.argv[2] || 500);
const NAT = process.argv[3] || 'BR';
const roles = Object.keys(ROLES);
const agg = { peak: [], seasons: [], worlds: 0, msi: 0, t1: 0, legacy: {}, t1Players: 0, abroad: 0, games: [], windows: 0, maxOptions: 0, optionHist: {}, bets: 0, betTaken: 0, loans: 0, entries: 0, entryTaken: 0, climbed: 0, strong: 0, peakStrong: [], peakHome: [], intlBy: {} };
const STRATEGY = process.argv[4] || 'ambicioso';

for (let i = 0; i < N; i++) {
  const role = roles[i % roles.length];
  const style = i % 2 ? 'agressivo' : 'controlado';
  const state = newCareer({ nick: 'sim', nat: NAT, role, style, attrs: rollAttrs(role, style) });
  let guard = 0;
  while (!state.player.retired && guard++ < 2000) {
    const s = state.screen;
    state.modals.length = 0;
    if (s.type === 'offers') {
      const n = s.offers.length + (s.stay ? 1 : 0);
      agg.windows++; agg.maxOptions = Math.max(agg.maxOptions, n); agg.optionHist[n] = (agg.optionHist[n] || 0) + 1;
      if (s.kind === 'loan') agg.loans++;
      if (s.offers.some((o) => o.bet)) agg.bets++;
      if (s.offers.some((o) => o.entry)) agg.entries++;
      const opts = s.offers.map((o, j) => ({ j, r: teamOf(state, o.teamId).rating, bet: o.bet, entry: o.entry }));
      if (s.stay) opts.push({ j: 'stay', r: teamOf(state, s.stay.teamId).rating - 1 });
      // ambicioso: sempre o time mais forte; aleatorio: qualquer opção.
      const pickd = STRATEGY === 'aleatorio' ? opts[Math.floor(Math.random() * opts.length)] : opts.sort((a, b) => b.r - a.r)[0];
      if (pickd.bet) agg.betTaken++;
      if (pickd.entry) agg.entryTaken++;
      chooseOffer(state, pickd.j);
    } else if (s.type === 'event' && s.choice === null) {
      chooseEvent(state, Math.floor(Math.random() * s.options.length));
    } else if (s.type === 'seasonEnd') {
      if (s.canRetire && state.player.age >= 32 && Math.random() < 0.4) state.player.retired = true;
      else continueAfterSeason(state);
    } else {
      advance(state);
    }
  }
  const p = state.player;
  agg.peak.push(p.peakOvr);
  agg.seasons.push(p.history.length);
  agg.games.push(p.stats.games / Math.max(1, p.history.length));
  agg.worlds += p.trophies.filter((t) => t.name === 'Mundial').length;
  agg.msi += p.trophies.filter((t) => t.name === 'MSI').length;
  for (const t of p.trophies.filter((x) => x.kind === 'intl')) {
    const k = `${t.name} · ${teamOf(state, t.teamId).region}`;
    agg.intlBy[k] = (agg.intlBy[k] || 0) + 1;
  }
  agg.t1 += p.trophies.filter((t) => t.kind === 'league' && t.tier === 1).length;
  if (p.history.some((h) => h.tier === 1)) agg.t1Players++;
  if (p.history.some((h) => teamOf(state, h.teamId).region !== p.region)) agg.abroad++;
  const wentStrong = p.history.some((h) => h.tier === 1 && ['kr', 'cn'].includes(teamOf(state, h.teamId).region));
  if (wentStrong) { agg.strong++; agg.peakStrong.push(p.peakOvr); } else agg.peakHome.push(p.peakOvr);
  // Subiu de time dentro da mesma liga estrangeira (entrou por baixo e cresceu lá).
  const abroadT1 = p.history.filter((h) => h.tier === 1 && teamOf(state, h.teamId).region !== p.region);
  if (abroadT1.some((h, i) => i > 0 && h.teamId !== abroadT1[i - 1].teamId
    && teamOf(state, h.teamId).region === teamOf(state, abroadT1[i - 1].teamId).region
    && teamOf(state, h.teamId).base > teamOf(state, abroadT1[i - 1].teamId).base)) agg.climbed++;
  const l = legacyLabel(p).title;
  agg.legacy[l] = (agg.legacy[l] || 0) + 1;
}

const avg = (a) => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
const pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.floor(a.length * q)];
console.log(`carreiras: ${N} (${NAT})`);
console.log(`OVR pico: média ${avg(agg.peak)} · p10 ${pct(agg.peak, 0.1)} · p50 ${pct(agg.peak, 0.5)} · p90 ${pct(agg.peak, 0.9)} · max ${Math.max(...agg.peak)}`);
console.log(`temporadas: média ${avg(agg.seasons)} · jogos/temporada ${avg(agg.games)}`);
console.log(`chegou ao tier 1: ${(agg.t1Players / N * 100).toFixed(0)}% · jogou no exterior: ${(agg.abroad / N * 100).toFixed(0)}%`);
console.log(`títulos por carreira: liga T1 ${(agg.t1 / N).toFixed(2)} · MSI ${(agg.msi / N).toFixed(2)} · Mundial ${(agg.worlds / N).toFixed(2)}`);
console.log(`estratégia: ${STRATEGY}`);
console.log('títulos internacionais por região do time (por 1000 carreiras):',
  Object.fromEntries(Object.entries(agg.intlBy).sort().map(([k, v]) => [k, +(v / N * 1000).toFixed(1)])));
console.log(`janelas: ${agg.windows} · máx. opções numa janela: ${agg.maxOptions} · distribuição:`, agg.optionHist);
console.log(`janelas com aposta: ${(agg.bets / agg.windows * 100).toFixed(1)}% · apostas aceitas: ${agg.betTaken} · empréstimos: ${(agg.loans / N).toFixed(2)} por carreira`);
console.log(`jogou na LCK/LPL: ${(agg.strong / N * 100).toFixed(0)}% · OVR pico de quem foi: ${agg.peakStrong.length ? avg(agg.peakStrong) : '—'} · de quem não foi: ${agg.peakHome.length ? avg(agg.peakHome) : '—'}`);
console.log(`janelas com proposta de entrada no exterior: ${(agg.entries / agg.windows * 100).toFixed(1)}% · aceitas: ${agg.entryTaken} · subiu de time dentro da liga estrangeira: ${(agg.climbed / N * 100).toFixed(0)}% das carreiras`);
const bucket = (lo, hi) => (agg.peak.filter((x) => x >= lo && x < hi).length / N * 100).toFixed(0) + '%';
console.log(`OVR máximo: <75 ${bucket(0, 75)} · 75-79 ${bucket(75, 80)} · 80-84 ${bucket(80, 85)} · 85-89 ${bucket(85, 90)} · 90+ ${bucket(90, 100)}`);
console.log('legado:', agg.legacy);
