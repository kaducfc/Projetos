// Chance de título de cada time: ligas (réplica da fase de pontos + playoffs)
// e torneios internacionais (a simulação real do jogo, só com a IA).
// Uso: node scripts/odds.mjs [N]
import { buildTeams, REGIONS } from '../js/data/world.js';
import { __runIntlForTests as runIntl } from '../js/engine/career.js';
import { simSeries, roundRobin, formRoll } from '../js/engine/sim.js';

const N = Number(process.argv[2] || 3000);
const teams = buildTeams();
const pct = (n) => `${((n / N) * 100).toFixed(n / N < 0.01 ? 2 : 1)}%`;

// ---- ligas principais (split: MD3 turno único, 6 nos playoffs em MD5)
function league(ids) {
  const form = Object.fromEntries(ids.map((id) => [id, formRoll(4)]));
  const pw = (id) => teams[id].rating + form[id];
  const table = Object.fromEntries(ids.map((id) => [id, Math.random() * 0.1]));
  for (const pairs of roundRobin(ids)) for (const [a, b] of pairs) {
    const r = simSeries(pw(a), pw(b), 3);
    table[r.a > r.b ? a : b]++;
  }
  const seeds = ids.slice().sort((a, b) => table[b] - table[a]);
  const ser = (a, b) => { const r = simSeries(pw(a), pw(b), 5); return r.a > r.b ? a : b; };
  const q1 = ser(seeds[2], seeds[5]);
  const q2 = ser(seeds[3], seeds[4]);
  return ser(ser(seeds[0], q2), ser(seeds[1], q1));
}

const leagueWins = {};
for (const region of Object.keys(REGIONS)) {
  const ids = Object.values(teams).filter((t) => t.region === region && t.tier === 1).map((t) => t.id);
  for (let i = 0; i < N; i++) { const c = league(ids); leagueWins[c] = (leagueWins[c] || 0) + 1; }
}

// ---- internacionais
const intl = { firstStand: {}, msi: {}, worlds: {} };
const byRegion = { firstStand: {}, msi: {}, worlds: {} };
for (let i = 0; i < N; i++) {
  const st = {
    player: { teamId: null, trophies: [], fame: 0, morale: 50 },
    world: { teams },
    season: { tier: 2, region: 'br', teamId: '__none__', intl: {}, msiFinalRegions: [], rankings: {}, titles: [] },
  };
  for (const key of Object.keys(intl)) {
    runIntl(st, key);
    const c = st.season.intlChampions[key];
    intl[key][c] = (intl[key][c] || 0) + 1;
    const r = teams[c].region;
    byRegion[key][r] = (byRegion[key][r] || 0) + 1;
  }
}

for (const region of [...Object.keys(REGIONS), 'wc']) {
  const list = Object.values(teams).filter((t) => t.region === region && t.tier === 1).sort((a, b) => b.rating - a.rating);
  console.log(`\n${REGIONS[region]?.leagues[1] || 'Convidados'}`);
  console.log('time'.padEnd(22), 'força', 'liga'.padStart(7), 'F.Stand'.padStart(8), 'MSI'.padStart(7), 'Mundial'.padStart(8));
  for (const t of list) {
    console.log(t.name.slice(0, 21).padEnd(22), String(t.rating).padStart(5),
      (region === 'wc' ? '—' : pct(leagueWins[t.id] || 0)).padStart(7),
      pct(intl.firstStand[t.id] || 0).padStart(8), pct(intl.msi[t.id] || 0).padStart(7), pct(intl.worlds[t.id] || 0).padStart(8));
  }
}
console.log('\nPor região (First Stand · MSI · Mundial):');
for (const r of [...Object.keys(REGIONS), 'wc']) {
  console.log(r.padEnd(4), pct(byRegion.firstStand[r] || 0).padStart(7), pct(byRegion.msi[r] || 0).padStart(7), pct(byRegion.worlds[r] || 0).padStart(7));
}
