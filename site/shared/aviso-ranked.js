// Aviso da ranqueada na Carreira no Rift: quantas partidas ranqueadas
// restam hoje e se a carreira que terminou valeu.
import * as platform from './platform.js';
import { PARTIDAS_POR_DIA, eloInfo } from './ranked.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

let el = null;
let timer = null;
function mostrar(html, ms = 9000) {
  el?.remove();
  clearTimeout(timer);
  el = document.createElement('div');
  el.className = 'rk-aviso';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div>${html}</div><button type="button" aria-label="Fechar">×</button>`;
  el.querySelector('button').addEventListener('click', () => el?.remove());
  document.body.append(el);
  timer = setTimeout(() => el?.remove(), ms);
}

const link = '<a href="/ranking/">Ver ranking</a>';

// Ao abrir o jogo: quantas ranqueadas ainda valem hoje.
export async function avisoInicio() {
  await platform.init();
  if (!platform.cloudEnabled()) return;
  if (!platform.getUser()) {
    mostrar('<b>Ranqueada:</b> entre na sua conta para as suas 3 primeiras carreiras do dia valerem no ranking.', 7000);
    return;
  }
  const s = await platform.rankedStatus();
  if (!s) return;
  const resta = Math.max(0, PARTIDAS_POR_DIA - s.hoje.partidas);
  const elo = s.jogou ? ` · elo <b style="color:${eloInfo(s.elo).cor}">${esc(eloInfo(s.elo).nome)}</b>` : '';
  mostrar(resta
    ? `<b>Ranqueada:</b> ${resta === PARTIDAS_POR_DIA ? 'suas 3 carreiras ranqueadas de hoje estão disponíveis' : `falta${resta > 1 ? 'm' : ''} ${resta} carreira${resta > 1 ? 's' : ''} ranqueada${resta > 1 ? 's' : ''} hoje`}${elo}. ${link}`
    : `<b>Ranqueada:</b> as 3 carreiras ranqueadas de hoje já foram usadas (nota do dia: ${s.hoje.melhor}). Pode continuar jogando normalmente. ${link}`, 7000);
}

// Fim de carreira: `entry` é a partida que acabou de ser registrada.
export async function avisoFim(entry) {
  if (!platform.cloudEnabled()) return;
  if (!platform.getUser()) {
    mostrar('Essa carreira não entrou na <b>ranqueada</b>: entre na sua conta para as próximas valerem.');
    return;
  }
  const d = await platform.rankedStatus();
  if (!d) return;
  if ((d.hoje.validas || []).includes(entry?.clientId)) {
    mostrar(`<b>Valeu para a ranqueada!</b> Carreira ${d.hoje.partidas} de ${PARTIDAS_POR_DIA} de hoje · nota do dia (a melhor): <b>${d.hoje.melhor}</b>. ${link}`, 12000);
  } else {
    mostrar(`Essa carreira <b>não entrou na ranqueada</b>: as 3 de hoje já foram usadas (nota do dia: ${d.hoje.melhor ?? '—'}). Amanhã tem mais! ${link}`, 12000);
  }
}
