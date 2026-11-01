// Rift Survivors: progresso permanente (neste navegador): Essência Azul, campeões liberados e melhorias.
import { CAMPEOES, MELHORIAS, REINOS } from './data.js';
export const reinoLiberado = (m, id) => { const r = REINOS[id]; return !!r && (!r.abre || (m.reinos[r.abre]?.vitorias || 0) > 0); };
const CHAVE = 'survivors.meta.v1';
// Campeões que começam liberados (sem preço em EA nem em RC).
const gratis = () => CAMPEOES.filter((c) => !c.preco && !c.rc).map((c) => c.id);
const PADRAO = () => ({ essencia: 0, liberados: gratis(), melhorias: {}, melhor: { tempo: 0, abates: 0, nivel: 0 }, partidas: 0, vitorias: 0, ultimo: 'garen', reinos: {}, ultimoReino: 'ixtal' });
// Arruma um progresso vindo do navegador ou da conta (migra nomes antigos e completa campos que faltam).
export function normalizar(r) {
  if (!r || typeof r !== 'object') return PADRAO();
  if (r.reinos?.rift) { r.reinos.ixtal = r.reinos.rift; delete r.reinos.rift; }
  if (r.ultimoReino === 'rift') r.ultimoReino = 'ixtal';
  const m = { ...PADRAO(), ...r, melhor: { ...PADRAO().melhor, ...(r.melhor || {}) } };
  for (const id of gratis()) if (!m.liberados.includes(id)) m.liberados.push(id);
  return m;
}
// Com conta, cada conta tem a sua cópia no navegador (duas contas no mesmo aparelho não misturam o progresso).
let chave = CHAVE;
let aoMudar = null;
export const aoGravar = (fn) => { aoMudar = fn; };
export function usarConta(uid) { chave = uid ? `${CHAVE}.${uid}` : CHAVE; }
export function carregar() {
  try {
    let bruto = localStorage.getItem(chave);
    if (!bruto && chave !== CHAVE) bruto = localStorage.getItem(CHAVE); // primeira vez com conta: aproveita o que já havia no navegador
    const r = JSON.parse(bruto); if (r && typeof r === 'object') return normalizar(r);
  } catch { /* sem storage */ }
  return PADRAO();
}
export function gravarLocal(m) { try { localStorage.setItem(chave, JSON.stringify(m)); } catch { /* sem storage */ } }
export function gravar(m) { m.rev = Math.max(Date.now(), (m.rev || 0) + 1); gravarLocal(m); try { aoMudar?.(m); } catch { /* sincronização é opcional */ } }
export function comprarCampeao(m, id) {
  const c = CAMPEOES.find((x) => x.id === id); if (!c || !c.preco || m.liberados.includes(id) || m.essencia < c.preco) return false;
  m.essencia -= c.preco; m.liberados.push(id); gravar(m); return true;
}
export function comprarMelhoria(m, id) {
  const d = MELHORIAS[id]; const n = m.melhorias[id] || 0; if (!d || n >= d.max) return false;
  const p = d.preco(n); if (m.essencia < p) return false;
  m.essencia -= p; m.melhorias[id] = n + 1; gravar(m); return true;
}
export function registrarPartida(m, S, ganho) {
  m.essencia += ganho; m.partidas++; if (S.estado === 'vitoria') m.vitorias++;
  const rr = (m.reinos[S.reino] ||= { vitorias: 0, melhor: 0, partidas: 0 }); rr.partidas++; rr.melhor = Math.max(rr.melhor, Math.floor(S.t)); if (S.estado === 'vitoria') rr.vitorias++;
  m.melhor.tempo = Math.max(m.melhor.tempo, Math.floor(S.t)); m.melhor.abates = Math.max(m.melhor.abates, S.abates); m.melhor.nivel = Math.max(m.melhor.nivel, S.nivel);
  gravar(m);
}
// Campeões comprados com Rift Coins ficam na conta (recompensas, tipo 'campeao', chave 'sv-<id>'); aqui eles entram na lista de liberados.
export function liberarPorRC(m, id) { if (m.liberados.includes(id)) return false; m.liberados.push(id); gravar(m); return true; }
