// Simula carreiras inteiras escolhendo opções ao acaso, pra calibrar o
// balanceamento (OVR de pico, títulos, idade de aposentadoria…).
// Uso: node scripts/simulate.mjs [quantidade] [região]
import { newCareer, chooseOffer, chooseEvent, advance, continueAfterSeason, legacyLabel, teamOf } from '../js/engine/career.js';
import { rollAttrs, ovrOf } from '../js/engine/player.js';
import { ROLES } from '../js/data/world.js';

const N = Number(process.argv[2] || 500);
const NAT = process.argv[3] || 'BR';
const roles = Object.keys(ROLES);
const agg = { peak: [], seasons: [], worlds: 0, msi: 0, t1: 0, legacy: {}, t1Players: 0, abroad: 0, games: [] };

for (let i = 0; i < N; i++) {
  const role = roles[i % roles.length];
  const style = i % 2 ? 'agressivo' : 'controlado';
  const state = newCareer({ nick: 'sim', nat: NAT, role, style, attrs: rollAttrs(role, style) });
  let guard = 0;
  while (!state.player.retired && guard++ < 2000) {
    const s = state.screen;
    state.modals.length = 0;
    if (s.type === 'offers') {
      // Escolhe a melhor proposta (maior rating), como um jogador ambicioso.
      const opts = s.offers.map((o, j) => ({ j, r: teamOf(state, o.teamId).rating }));
      if (s.stay) opts.push({ j: 'stay', r: teamOf(state, s.stay.teamId).rating - 1 });
      opts.sort((a, b) => b.r - a.r);
      chooseOffer(state, opts[0].j);
    } else if (s.type === 'event' && s.choice === null) {
      chooseEvent(state, Math.floor(Math.random() * s.chances.length));
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
  agg.t1 += p.trophies.filter((t) => t.kind === 'league' && t.tier === 1).length;
  if (p.history.some((h) => h.tier === 1)) agg.t1Players++;
  if (p.history.some((h) => teamOf(state, h.teamId).region !== p.region)) agg.abroad++;
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
console.log('legado:', agg.legacy);
