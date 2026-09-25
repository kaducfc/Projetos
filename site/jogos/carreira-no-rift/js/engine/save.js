// Formato compacto do save. A maior parte do estado era a lista completa de
// times (nome, cores, sigla…), que é igual para todo mundo e já vem de
// data/world.js. O save guarda só:
//   - a força atual dos times que mudou em relação ao nível histórico;
//   - os dados completos dos times por onde o jogador passou (para a
//     carreira continuar legível mesmo se a lista de times mudar no futuro).
import { buildTeams, RETIRED_TEAMS } from '../data/world.js';

function playerTeamIds(state) {
  const p = state.player;
  const ids = new Set(p.history.map((h) => h.teamId));
  p.trophies.forEach((t) => ids.add(t.teamId));
  if (p.teamId) ids.add(p.teamId);
  if (state.season?.teamId) ids.add(state.season.teamId);
  return ids;
}

export function packState(state) {
  const { teams } = state.world;
  const ratings = {};
  for (const t of Object.values(teams)) {
    if (t.rating !== t.base) ratings[t.id] = t.rating;
  }
  const keep = {};
  for (const id of playerTeamIds(state)) {
    if (teams[id]) keep[id] = teams[id];
  }
  return { ...state, world: { year: state.world.year, ratings, keep } };
}

export function unpackState(saved) {
  if (!saved || saved.world?.teams) return saved; // formato antigo (completo)
  const teams = buildTeams();
  const raw = JSON.stringify(saved);
  for (const [id, team] of Object.entries(RETIRED_TEAMS)) {
    if (raw.includes(`"${id}"`)) teams[id] = { ...team };
  }
  for (const [id, team] of Object.entries(saved.world.keep || {})) {
    teams[id] = { ...teams[id], ...team };
  }
  for (const [id, rating] of Object.entries(saved.world.ratings || {})) {
    if (teams[id]) teams[id].rating = rating;
  }
  return { ...saved, world: { year: saved.world.year, teams } };
}
