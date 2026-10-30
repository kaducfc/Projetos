// Histórico oficial da partida. É derivado só do motor: a interface lê daqui, não cria eventos por conta própria.
// Cada evento: { t, tipo, equipe, ...dados }. Eventos "únicos" (abates, torres, objetivos, fim) nunca se repetem porque o motor só
// os emite no momento da transição de estado (ex.: a vida chegar a zero), protegido por `u.morto`.
export function registrar(P, tipo, dados = {}) {
  const ev = { t: Math.round(P.t * 10) / 10, tipo, ...dados };
  P.eventos.push(ev);
  if (P.eventos.length > 5000) P.eventos.shift();
  return ev;
}
export function tempoTexto(t) { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
