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
  const resta = Math.max(0, PARTIDAS_POR_DIA - (s.hoje.iniciadas ?? s.hoje.partidas));
  const elo = s.jogou ? ` · elo <b style="color:${eloInfo(s.elo).cor}">${esc(eloInfo(s.elo).nome)}</b>` : '';
  mostrar(resta
    ? `<b>Ranqueada:</b> ${resta === PARTIDAS_POR_DIA ? 'suas 3 carreiras ranqueadas de hoje estão disponíveis' : `falta${resta > 1 ? 'm' : ''} ${resta} carreira${resta > 1 ? 's' : ''} ranqueada${resta > 1 ? 's' : ''} hoje`}${elo}. Valem as 3 primeiras carreiras <b>começadas</b> no dia (abandonar também gasta a vaga). ${link}`
    : `<b>Ranqueada:</b> as 3 carreiras ranqueadas de hoje já foram começadas${s.hoje.melhor != null ? ` (nota do dia: ${s.hoje.melhor})` : ''}. Pode continuar jogando normalmente. ${link}`, 9000);
}

// Logo depois de criar o jogador: diz se esta carreira vale para a ranqueada.
export function avisoComeco(r) {
  if (!platform.cloudEnabled() || !platform.getUser()) return;
  if (!r) {
    mostrar('Não deu para registrar o começo desta carreira na <b>ranqueada</b> (sem conexão com o servidor). Ela não vai valer; se quiser, recarregue a página e crie o jogador de novo.', 12000);
    return;
  }
  if (!r.token) {
    mostrar(`Esta carreira <b>não vale para a ranqueada</b>: as 3 carreiras ranqueadas de hoje já foram começadas. Pode jogar normalmente! ${link}`, 9000);
    return;
  }
  mostrar(`<b>Carreira ranqueada ${r.numero ?? ''} de ${PARTIDAS_POR_DIA} de hoje.</b> Termine hoje (até meia-noite) para valer. Se abandonar, a vaga é perdida.`, 9000);
}

const ddmm = (iso) => {
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
};

// Fim de carreira: `entry` é a partida que acabou de ser registrada e
// `ranked` o ingresso de quando ela começou ({ token, dia } ou nada).
export async function avisoFim(entry, ranked = null) {
  if (!platform.cloudEnabled()) return;
  if (!platform.getUser()) {
    mostrar('Essa carreira não entrou na <b>ranqueada</b>: entre na sua conta para as próximas valerem.');
    return;
  }
  const d = await platform.rankedStatus();
  if (!d) return;
  if ((d.hoje.validas || []).includes(entry?.clientId)) {
    mostrar(`<b>Valeu para a ranqueada!</b> Carreira ${d.hoje.partidas} de ${PARTIDAS_POR_DIA} de hoje · nota do dia (a melhor): <b>${d.hoje.melhor}</b>. ${link}`, 12000);
  } else if (ranked && !ranked.token) {
    mostrar(`Essa carreira <b>não entrou na ranqueada</b>: ela começou depois das 3 carreiras ranqueadas do dia. ${link}`, 12000);
  } else if (!ranked) {
    mostrar(`Essa carreira <b>não entrou na ranqueada</b>: o começo dela não foi registrado no servidor (começou sem a conta conectada ou sem internet). Para valer, a carreira precisa começar e terminar com a conta conectada, no mesmo dia. ${link}`, 12000);
  } else if (ranked.dia !== String(d.hoje.dia).slice(0, 10)) {
    mostrar(`Essa carreira <b>não entrou na ranqueada</b>: ela começou em outro dia (${ddmm(ranked.dia)}). Só vale a carreira que começa e termina no mesmo dia. ${link}`, 12000);
  } else {
    mostrar(`Essa carreira <b>não entrou na ranqueada</b>: as 3 vagas de hoje já foram usadas (nota do dia: ${d.hoje.melhor ?? '—'}). Amanhã tem mais! ${link}`, 12000);
  }
}
