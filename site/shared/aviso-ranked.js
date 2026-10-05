// Avisos da ranqueada nos jogos: quantas partidas ainda valem hoje, se a
// partida que terminou valeu e quantos PDR ela deu (ou tirou).
import * as platform from './platform.js';
import { t } from './i18n.js';
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

const link = () => `<a href="/ranking/">${t('Ver ranking')}</a>`;
// Como chamar a partida de cada jogo nos textos (todos femininos em todos os idiomas).
const NOMES = {
  'carreira-no-rift': { uma: 'carreira', varias: 'carreiras' },
  cblol: { uma: 'partida no modo Oculto', varias: 'partidas no modo Oculto' },
};
const nomes = (jogo) => {
  const n = NOMES[jogo] || NOMES['carreira-no-rift'];
  const uma = t(n.uma);
  return { uma, varias: t(n.varias), Uma: uma[0].toUpperCase() + uma.slice(1) };
};

// "Ouro 2 · 45 PDR" com a cor do elo.
export function eloTexto(s) {
  const d = divisaoDe(s?.pts || 0, s?.elo);
  return `<b style="color:${eloInfo(d.elo).cor}">${esc(t(nomeDivisao(d)))}</b> · ${d.pdr} PDR`;
}
const pdrHtml = (n) => `<b class="${n > 0 ? 'pdr-mais' : n < 0 ? 'pdr-menos' : ''}">${fmtPdr(n)}</b>`;

// Ao abrir o jogo: quantas partidas ainda valem hoje.
export async function avisoInicio(jogo = 'carreira-no-rift') {
  await platform.init();
  if (!platform.cloudEnabled()) return;
  const n = nomes(jogo);
  if (!platform.getUser()) {
    mostrar(t('<b>Ranqueada:</b> entre na sua conta para as suas {max} primeiras {varias} do dia valerem PDR.', { max: PARTIDAS_POR_DIA, varias: n.varias }), 7000);
    return;
  }
  const s = await platform.rankedStatus();
  if (!s) return;
  const feitas = s.hoje.vagas?.[jogo] ?? 0;
  const resta = Math.max(0, PARTIDAS_POR_DIA - feitas);
  const dia = s.hoje.jogos?.[jogo];
  const elo = eloTexto(s);
  const hojeTxt = dia ? ` · ${t('hoje: {pdr}', { pdr: pdrHtml(dia.pdr) })}` : '';
  mostrar(resta
    ? `${t('<b>Ranqueada</b> ({elo}):', { elo })} ${resta === PARTIDAS_POR_DIA
      ? t('suas {max} {varias} ranqueadas de hoje estão disponíveis', { max: PARTIDAS_POR_DIA, varias: n.varias })
      : resta > 1 ? t('faltam {resta} {varias} ranqueadas hoje', { resta, varias: n.varias }) : t('falta {resta} {uma} ranqueada hoje', { resta, uma: n.uma })}${hojeTxt}. ${t('Cada uma vale o seu PDR.')} ${link()}`
    : `${t('<b>Ranqueada</b> ({elo}):', { elo })} ${t('as {max} {varias} ranqueadas de hoje já foram começadas', { max: PARTIDAS_POR_DIA, varias: n.varias })}${dia ? ` (${t('hoje: {pdr}', { pdr: pdrHtml(dia.pdr) })})` : ''}. ${t('Pode continuar jogando normalmente.')} ${link()}`, 9000);
}

// Logo depois de começar: diz se esta partida vale para a ranqueada.
export function avisoComeco(r, jogo = 'carreira-no-rift') {
  if (!platform.cloudEnabled() || !platform.getUser()) return;
  const n = nomes(jogo);
  if (!r) {
    mostrar(t('Não deu para registrar o começo desta {uma} na <b>ranqueada</b> (sem conexão com o servidor). Ela não vai valer; se quiser, recarregue a página e comece de novo.', { uma: n.uma }), 12000);
    return;
  }
  if (r.banido) {
    mostrar(t('Sua conta está <b>fora da ranqueada</b>. Você pode jogar normalmente, mas as partidas não valem PDR. Dúvidas: riftarcadeoficial@gmail.com'), 12000);
    return;
  }
  if (!r.token) {
    mostrar(`${t('Esta {uma} <b>não vale para a ranqueada</b>: as {max} {varias} ranqueadas de hoje já foram começadas. Pode jogar normalmente!', { uma: n.uma, max: PARTIDAS_POR_DIA, varias: n.varias })} ${link()}`, 9000);
    return;
  }
  mostrar(t('<b>{Uma} ranqueada {numero} de {limite} de hoje.</b> Termine hoje (até meia-noite): se não terminar, perde {perde} PDR.', { Uma: n.Uma, numero: r.numero ?? '', limite: r.limite ?? PARTIDAS_POR_DIA, perde: Math.abs(NAO_TERMINOU) }), 10000);
}

// Fim de partida: `entry` é a partida registrada e `ranked` o ingresso de
// quando ela começou ({ token, dia } ou nada).
export async function avisoFim(entry, ranked = null, jogo = 'carreira-no-rift') {
  if (!platform.cloudEnabled()) return;
  const n = nomes(jogo);
  if (!platform.getUser()) {
    mostrar(t('Essa {uma} não valeu PDR: entre na sua conta para as próximas valerem.', { uma: n.uma }));
    return;
  }
  const d = await platform.rankedStatus();
  if (!d) return;
  const dia = d.hoje.jogos?.[jogo];
  const esta = (d.hoje.partidas || []).find((x) => x.client_id === entry?.clientId);
  if ((d.hoje.validas || []).includes(entry?.clientId) && dia) {
    const hoje = dia.partidas > 1 ? ` (${t('hoje, neste jogo: {pdr}', { pdr: pdrHtml(dia.pdr) })})` : '';
    const qual = esta ? t('({n}ª de hoje)', { n: esta.n }) : t('de hoje');
    mostrar(`<b>${t('Valeu para a ranqueada!')}</b> ${n.Uma} ${qual}: ${pdrHtml(esta ? esta.pdr : dia.pdr)}${hoje} · ${t('agora: {elo}', { elo: eloTexto(d) })}. ${link()}`, 12000);
  } else if (ranked && !ranked.token) {
    mostrar(`${t('Essa {uma} <b>não valeu PDR</b>: ela começou depois das {max} ranqueadas do dia.', { uma: n.uma, max: PARTIDAS_POR_DIA })} ${link()}`, 12000);
  } else if (!ranked) {
    mostrar(`${t('Essa {uma} <b>não valeu PDR</b>: o começo dela não foi registrado no servidor (começou sem a conta conectada ou sem internet).', { uma: n.uma })} ${link()}`, 12000);
  } else if (ranked.dia !== String(d.hoje.dia).slice(0, 10)) {
    mostrar(`${t('Essa {uma} <b>não valeu PDR</b>: ela começou em outro dia. Só vale a que começa e termina no mesmo dia.', { uma: n.uma })} ${link()}`, 12000);
  } else {
    mostrar(`${t('Essa {uma} <b>não valeu PDR</b>.', { uma: n.uma })} ${link()}`, 12000);
  }
}

// Jogos diários (Runetermo e Campeão Oculto): resultado do dia.
export async function avisoDiario(estado) {
  if (!estado || estado.pdr == null) return;
  const d = await platform.rankedStatus();
  mostrar(`<b>${t('Ranqueada:')}</b> ${t('{pdr} hoje', { pdr: pdrHtml(estado.pdr) })}${d ? ` · ${t('agora: {elo}', { elo: eloTexto(d) })}` : ''}. ${link()}`, 12000);
}
