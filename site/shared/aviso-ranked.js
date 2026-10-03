// Avisos da ranqueada nos jogos: quantas partidas ainda valem hoje, se a
// partida que terminou valeu e quantos PDR ela deu (ou tirou).
import * as platform from './platform.js';
import { PARTIDAS_POR_DIA, NAO_TERMINOU, eloInfo, divisaoDe, nomeDivisao, fmtPdr } from './ranked.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

let el = null;
let timer = null;
export function mostrar(html, ms = 9000) {
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
// Como chamar a partida de cada jogo nos textos.
const NOMES = {
  'carreira-no-rift': { uma: 'carreira', varias: 'carreiras', a: 'a' },
  cblol: { uma: 'partida no modo Oculto', varias: 'partidas no modo Oculto', a: 'a' },
};
const nomes = (jogo) => NOMES[jogo] || NOMES['carreira-no-rift'];

// "Ouro 2 · 45 PDR" com a cor do elo.
export function eloTexto(s) {
  const d = divisaoDe(s?.pts || 0, s?.elo);
  return `<b style="color:${eloInfo(d.elo).cor}">${esc(nomeDivisao(d))}</b> · ${d.pdr} PDR`;
}
const pdrHtml = (n) => `<b class="${n > 0 ? 'pdr-mais' : n < 0 ? 'pdr-menos' : ''}">${fmtPdr(n)}</b>`;

// Ao abrir o jogo: quantas partidas ainda valem hoje.
export async function avisoInicio(jogo = 'carreira-no-rift') {
  await platform.init();
  if (!platform.cloudEnabled()) return;
  const n = nomes(jogo);
  if (!platform.getUser()) {
    mostrar(`<b>Ranqueada:</b> entre na sua conta para as suas ${PARTIDAS_POR_DIA} primeiras ${n.varias} do dia valerem PDR.`, 7000);
    return;
  }
  const s = await platform.rankedStatus();
  if (!s) return;
  const feitas = s.hoje.vagas?.[jogo] ?? 0;
  const resta = Math.max(0, PARTIDAS_POR_DIA - feitas);
  const dia = s.hoje.jogos?.[jogo];
  mostrar(resta
    ? `<b>Ranqueada</b> (${eloTexto(s)}): ${resta === PARTIDAS_POR_DIA ? `suas ${PARTIDAS_POR_DIA} ${n.varias} ranqueadas de hoje estão disponíveis` : `falta${resta > 1 ? 'm' : ''} ${resta} ${resta > 1 ? n.varias : n.uma} ranqueada${resta > 1 ? 's' : ''} hoje`}${dia ? ` · hoje: ${pdrHtml(dia.pdr)}` : ''}. Cada uma vale o seu PDR. ${link}`
    : `<b>Ranqueada</b> (${eloTexto(s)}): as ${PARTIDAS_POR_DIA} ${n.varias} ranqueadas de hoje já foram começadas${dia ? ` (hoje: ${pdrHtml(dia.pdr)})` : ''}. Pode continuar jogando normalmente. ${link}`, 9000);
}

// Logo depois de começar: diz se esta partida vale para a ranqueada.
export function avisoComeco(r, jogo = 'carreira-no-rift') {
  if (!platform.cloudEnabled() || !platform.getUser()) return;
  const n = nomes(jogo);
  if (!r) {
    mostrar(`Não deu para registrar o começo desta ${n.uma} na <b>ranqueada</b> (sem conexão com o servidor). Ela não vai valer; se quiser, recarregue a página e comece de novo.`, 12000);
    return;
  }
  if (r.banido) {
    mostrar('Sua conta está <b>fora da ranqueada</b>. Você pode jogar normalmente, mas as partidas não valem PDR. Dúvidas: riftarcadeoficial@gmail.com', 12000);
    return;
  }
  if (!r.token) {
    mostrar(`Esta ${n.uma} <b>não vale para a ranqueada</b>: as ${PARTIDAS_POR_DIA} ${n.varias} ranqueadas de hoje já foram começadas. Pode jogar normalmente! ${link}`, 9000);
    return;
  }
  mostrar(`<b>${n.uma[0].toUpperCase()}${n.uma.slice(1)} ranqueada ${r.numero ?? ''} de ${r.limite ?? PARTIDAS_POR_DIA} de hoje.</b> Termine hoje (até meia-noite): se não terminar, perde ${Math.abs(NAO_TERMINOU)} PDR.`, 10000);
}

// Fim de partida: `entry` é a partida registrada e `ranked` o ingresso de
// quando ela começou ({ token, dia } ou nada).
export async function avisoFim(entry, ranked = null, jogo = 'carreira-no-rift') {
  if (!platform.cloudEnabled()) return;
  const n = nomes(jogo);
  if (!platform.getUser()) {
    mostrar(`Essa ${n.uma} não valeu PDR: entre na sua conta para as próximas valerem.`);
    return;
  }
  const d = await platform.rankedStatus();
  if (!d) return;
  const dia = d.hoje.jogos?.[jogo];
  const esta = (d.hoje.partidas || []).find((x) => x.client_id === entry?.clientId);
  if ((d.hoje.validas || []).includes(entry?.clientId) && dia) {
    const hoje = dia.partidas > 1 ? ` (hoje, neste jogo: ${pdrHtml(dia.pdr)})` : '';
    mostrar(`<b>Valeu para a ranqueada!</b> ${n.uma[0].toUpperCase()}${n.uma.slice(1)} ${esta ? `(${esta.n}ª de hoje)` : 'de hoje'}: ${pdrHtml(esta ? esta.pdr : dia.pdr)}${hoje} · agora: ${eloTexto(d)}. ${link}`, 12000);
  } else if (ranked && !ranked.token) {
    mostrar(`Essa ${n.uma} <b>não valeu PDR</b>: ela começou depois das ${PARTIDAS_POR_DIA} ranqueadas do dia. ${link}`, 12000);
  } else if (!ranked) {
    mostrar(`Essa ${n.uma} <b>não valeu PDR</b>: o começo dela não foi registrado no servidor (começou sem a conta conectada ou sem internet). ${link}`, 12000);
  } else if (ranked.dia !== String(d.hoje.dia).slice(0, 10)) {
    mostrar(`Essa ${n.uma} <b>não valeu PDR</b>: ela começou em outro dia. Só vale a que começa e termina no mesmo dia. ${link}`, 12000);
  } else {
    mostrar(`Essa ${n.uma} <b>não valeu PDR</b>. ${link}`, 12000);
  }
}

// Jogos diários (Runetermo e Campeão Oculto): resultado do dia.
export async function avisoDiario(estado) {
  if (!estado || estado.pdr == null) return;
  const d = await platform.rankedStatus();
  mostrar(`<b>Ranqueada:</b> ${pdrHtml(estado.pdr)} hoje${d ? ` · agora: ${eloTexto(d)}` : ''}. ${link}`, 12000);
}
