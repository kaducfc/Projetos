// Rift Survivors: progresso permanente (neste navegador): Essência Azul, campeões liberados e melhorias.
import { CAMPEOES, MELHORIAS } from './data.js';
const CHAVE = 'survivors.meta.v1';
const PADRAO = () => ({ essencia: 0, liberados: CAMPEOES.filter((c) => !c.preco).map((c) => c.id), melhorias: {}, melhor: { tempo: 0, abates: 0, nivel: 0 }, partidas: 0, vitorias: 0, ultimo: 'garen' });
export function carregar() {
  try { const r = JSON.parse(localStorage.getItem(CHAVE)); if (r && typeof r === 'object') return { ...PADRAO(), ...r, melhor: { ...PADRAO().melhor, ...(r.melhor || {}) } }; } catch { /* sem storage */ }
  return PADRAO();
}
export function gravar(m) { try { localStorage.setItem(CHAVE, JSON.stringify(m)); } catch { /* sem storage */ } }
export function comprarCampeao(m, id) {
  const c = CAMPEOES.find((x) => x.id === id); if (!c || m.liberados.includes(id) || m.essencia < c.preco) return false;
  m.essencia -= c.preco; m.liberados.push(id); gravar(m); return true;
}
export function comprarMelhoria(m, id) {
  const d = MELHORIAS[id]; const n = m.melhorias[id] || 0; if (!d || n >= d.max) return false;
  const p = d.preco(n); if (m.essencia < p) return false;
  m.essencia -= p; m.melhorias[id] = n + 1; gravar(m); return true;
}
export function registrarPartida(m, S, ganho) {
  m.essencia += ganho; m.partidas++; if (S.estado === 'vitoria') m.vitorias++;
  m.melhor.tempo = Math.max(m.melhor.tempo, Math.floor(S.t)); m.melhor.abates = Math.max(m.melhor.abates, S.abates); m.melhor.nivel = Math.max(m.melhor.nivel, S.nivel);
  gravar(m);
}
