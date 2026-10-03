// Cartão "Minha ranqueada" (perfil e página de ranking) e o "Como funciona".
import {
  ELOS, BENEFICIOS, PARTIDAS_POR_DIA, PDR_DIVISAO, NAO_TERMINOU, INATIVIDADE,
  VAGAS_DESAFIANTE, MIN_DESAFIANTE, VAGAS_GRAO_MESTRE, MIN_GRAO_MESTRE,
  PDR_CARREIRA, PDR_RUNETERMO, PDR_LENDAS, REGUA,
  eloInfo, nivelElo, emblemaHtml, divisaoDe, nomeDivisao, fmtPdr,
} from '../shared/ranked.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const ddmm = (iso) => {
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
};
const num = (n) => (n == null ? '—' : Math.round(Number(n)).toLocaleString('pt-BR'));
const pdrHtml = (n) => `<b class="${n > 0 ? 'pdr-mais' : n < 0 ? 'pdr-menos' : ''}">${fmtPdr(n)}</b>`;

export const JOGOS_RANQUEADA = [
  { id: 'carreira-no-rift', nome: 'Carreira no Rift', vagas: true, link: '/jogos/carreira-no-rift/' },
  { id: 'cblol', nome: 'Lendas do CBLOL (Oculto)', vagas: true, link: '/jogos/lendas-do-cblol/' },
  { id: 'runetermo', nome: 'Runetermo', link: '/jogos/runetermo/' },
  { id: 'campeao', nome: 'Campeão Oculto', link: '/jogos/campeao/' },
];
const MOTIVO = { partida: '', melhora: 'resultado melhor', nao_terminou: 'começou e não terminou', inatividade: 'inatividade', admin: 'ajuste' };
const nomeJogo = (id) => JOGOS_RANQUEADA.find((j) => j.id === id)?.nome.replace(' (Oculto)', '') || '';

// s = resposta de platform.rankedStatus() (ou null sem conta / sem servidor).
export function cardMinhaRanqueada(s, { link = true } = {}) {
  if (!s) {
    return `<section class="pf-card rk-card">
      <div class="rk-emb">${emblemaHtml('ferro', 84, { vazio: true })}</div>
      <div class="rk-info">
        <p class="eyebrow">Ranqueada</p>
        <h2 class="display">Sem ranque</h2>
        <p class="muted small">Entre na sua conta: Carreira no Rift, Lendas do CBLOL (modo Oculto), Runetermo e Campeão Oculto valem PDR para subir do Ferro ao Desafiante.</p>
      </div>
    </section>`;
  }
  const d = divisaoDe(s.pts, s.elo);
  const e = eloInfo(d.elo);
  const apex = nivelElo(d.elo) >= 7;
  let barra;
  if (!apex) {
    const prox = d.divisao > 1 ? `${e.nome} ${d.divisao - 1}` : eloInfo(ELOS[nivelElo(d.elo) + 1].id).nome;
    barra = `<div class="rk-meta">
      <div class="rk-meta-top"><span><b>${d.pdr}</b> de ${PDR_DIVISAO} PDR</span><span>para <b style="color:${e.cor}">${esc(prox)}</b></span></div>
      <div class="rk-barra"><i style="width:${Math.min(100, d.pdr)}%;background:${e.cor}"></i></div>
      ${d.pdr === 0 && s.pts > 0 ? `<p class="muted small rk-queda perigo">Com 0 PDR: a próxima perda volta para a divisão anterior (com 75).</p>` : ''}
    </div>`;
  } else {
    const c = s.cortes || {};
    barra = `<div class="rk-meta"><div class="rk-meta-top"><span><b>${num(d.pdr)}</b> PDR no topo${s.posicao_topo ? ` · <b>#${s.posicao_topo}</b>` : ''}</span></div>
      <p class="muted small">Atualiza todo dia à meia-noite: Desafiante = top ${VAGAS_DESAFIANTE} com ${MIN_DESAFIANTE}+ PDR${c.desafiante != null ? ` (corte atual: ${num(c.desafiante)})` : ''};
        Grão-Mestre = os próximos ${VAGAS_GRAO_MESTRE} com ${MIN_GRAO_MESTRE}+ PDR${c.grao_mestre != null ? ` (corte: ${num(c.grao_mestre)})` : ''}.</p></div>`;
  }
  // Hoje: PDR do dia e situação de cada jogo.
  const jogos = JOGOS_RANQUEADA.map((j) => {
    const r = s.hoje.jogos?.[j.id];
    const vagas = j.vagas ? s.hoje.vagas?.[j.id] ?? 0 : null;
    let txt;
    if (r) txt = pdrHtml(r.pdr);
    else if (vagas) txt = `<span class="muted">em andamento</span>`;
    else txt = '<span class="muted">disponível</span>';
    return `<a class="rk-jogo" href="${j.link}"><span>${esc(j.nome)}</span>${txt}${j.vagas ? `<small>${vagas} de ${PARTIDAS_POR_DIA} ${j.id === 'cblol' ? 'partidas' : 'carreiras'}</small>` : ''}</a>`;
  }).join('');
  // Inatividade (Ouro para cima).
  let inativo = '';
  if (s.jogou && s.pts > 900 && s.ultima_atividade) {
    const dias = Math.round((Date.parse(s.hoje.dia) - Date.parse(s.ultima_atividade)) / 864e5);
    if (dias >= 2) inativo = `<p class="small rk-queda perigo">${dias} dias sem jogar: do Ouro para cima, a partir do ${INATIVIDADE.dias + 1}º dia parado perde ${Math.abs(INATIVIDADE.pdr)} PDR por dia. Jogue qualquer jogo hoje para evitar.</p>`;
  }
  const n = s.jogou ? nivelElo(d.elo) : -1;
  const liberados = BENEFICIOS.filter((b) => nivelElo(b.elo) <= n);
  const hist = (s.historico || []).slice(0, 6).map((h) => {
    const a = divisaoDe(h.antes);
    const b = divisaoDe(h.depois);
    const mudou = nomeDivisao(a) !== nomeDivisao(b);
    return `<li><span class="muted">${ddmm(h.dia)}</span> ${esc(nomeJogo(h.jogo) || MOTIVO[h.motivo] || '')}${h.jogo && MOTIVO[h.motivo] ? ` <span class="muted">(${MOTIVO[h.motivo]})</span>` : ''} ${pdrHtml(h.delta)}${mudou ? ` <span class="muted">→ ${esc(nomeDivisao(b))}</span>` : ''}</li>`;
  }).join('');
  return `<section class="pf-card rk-card" style="--cor:${s.jogou ? e.cor : '#6b6455'}">
    <div class="rk-emb">${emblemaHtml(d.elo, 84, { vazio: !s.jogou })}</div>
    <div class="rk-info">
      <p class="eyebrow">Ranqueada · Temporada ${esc(s.temporada)}</p>
      <h2 class="display">${s.jogou ? esc(nomeDivisao(d)) : 'Ferro 3'}</h2>
      ${barra}
      <p class="muted small">Hoje: ${pdrHtml(s.hoje.pdr || 0)}</p>
      <div class="rk-jogos">${jogos}</div>
      ${inativo}
      ${liberados.length ? `<ul class="rk-benef">${liberados.map((b) => `<li><b>${esc(b.jogo)}:</b> ${esc(b.texto)}</li>`).join('')}</ul>` : ''}
      ${hist ? `<p class="eyebrow rk-hist-tit">Últimos PDR</p><ul class="rk-hist">${hist}</ul>` : ''}
      ${link ? '<a class="rk-link" href="/ranking/">Ver ranking →</a>' : ''}
    </div>
  </section>`;
}

// "Como funciona": regras, elos, PDR por jogo e benefícios.
export function comoFunciona() {
  const linhas = ELOS.map((e, i) => {
    const b = BENEFICIOS.filter((x) => x.elo === e.id);
    const div = i < 7 ? '3 · 2 · 1' : e.id === 'mestre' ? 'sem limite' : e.id === 'grao-mestre' ? `${VAGAS_GRAO_MESTRE} vagas, ${MIN_GRAO_MESTRE}+ PDR` : `${VAGAS_DESAFIANTE} vagas, ${MIN_DESAFIANTE}+ PDR`;
    return `<tr><td><span class="rk-elo" style="--cor:${e.cor}">${emblemaHtml(e.id, 22)}${esc(e.nome)}</span></td>
      <td>${div}</td>
      <td class="n">${REGUA[i] ? `−${REGUA[i]}` : '—'}</td>
      <td>+${i} OVR inicial na Carreira${b.length ? b.map((x) => `<br><b>${esc(x.jogo)}:</b> ${esc(x.texto)}`).join('') : ''}</td></tr>`;
  }).join('');
  const carreira = PDR_CARREIRA.map(([l, p]) => `<span>${num(l)}${l === 1600 ? '+' : ''} → <b>${p > 0 ? '+' : ''}${p}</b></span>`).join('');
  return `<section class="pf-sec">
    <h2 class="section-title">Como funciona</h2>
    <div class="pf-card rk-regras">
      <ul>
        <li>Valem <b>todos os jogos</b>, com a conta conectada: Carreira no Rift, Lendas do CBLOL (só o modo <b>Oculto</b>), Runetermo e Campeão Oculto. Cada jogo dá de <b>+5 a +38 PDR</b> por dia (acima de +32 é raro) ou tira de <b>−2 a −25</b>.</li>
        <li><b>Elos:</b> Ferro, Bronze, Prata, Ouro, Platina, Esmeralda e Diamante têm 3 divisões (3, 2 e 1). Cada divisão pede <b>${PDR_DIVISAO} PDR</b>: chegou, sobe na hora, e a sobra passa para a próxima. Depois do Diamante 1 vem o <b>Mestre</b> (sem limite de PDR).</li>
        <li><b>Grão-Mestre e Desafiante:</b> atualizados todo dia à meia-noite pela ordem de PDR: os ${VAGAS_DESAFIANTE} melhores com ${MIN_DESAFIANTE}+ PDR viram Desafiante; os ${VAGAS_GRAO_MESTRE} seguintes com ${MIN_GRAO_MESTRE}+ PDR, Grão-Mestre.</li>
        <li><b>Queda:</b> perdendo PDR, a divisão desce até 0. Perdendo com 0, volta para a divisão anterior com 75 PDR. Ferro 3 não cai.</li>
        <li><b>Régua:</b> quanto mais alto o elo, mais exigente: cada elo desconta alguns PDR de todo resultado (coluna "Régua"), então vitórias rendem menos e derrotas tiram mais.</li>
        <li><b>Carreira no Rift e Lendas do CBLOL:</b> valem as ${PARTIDAS_POR_DIA} primeiras partidas <b>começadas</b> no dia; conta a melhor. Começou e não terminou nenhuma no dia: <b>${NAO_TERMINOU} PDR</b> à meia-noite.</li>
        <li><b>Runetermo e Campeão Oculto:</b> 1 por dia, palavra e campeão diferentes para cada jogador. Acertar rápido rende mais; errar tira menos quanto mais você tiver descoberto. Começou e não terminou até a meia-noite conta como erro.</li>
        <li><b>Inatividade:</b> do Ouro para cima, depois de ${INATIVIDADE.dias} dias sem jogar, perde ${Math.abs(INATIVIDADE.pdr)} PDR por dia parado (até no máximo o Ouro 3 com 0 PDR). Qualquer partida de qualquer jogo conta como atividade.</li>
        <li>Rankings: <b>geral</b> (pelo elo, com filtro por elo) e <b>diário, semanal e mensal</b> (PDR ganhos no período).</li>
      </ul>
      <div class="table-wrap"><table class="rk-tabela">
        <thead><tr><th>Elo</th><th>Divisões / vagas</th><th class="n">Régua</th><th>Benefícios</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
      <h3 class="rk-sub">PDR por jogo (no Ferro; a régua do elo desconta)</h3>
      <p class="small"><b>Carreira no Rift</b> (pontuação de legado): <span class="rk-escala">${carreira}</span></p>
      <p class="small"><b>Lendas do CBLOL</b> (Oculto): ${PDR_LENDAS.map(([t, p]) => `${esc(t)} <b>${p}</b>`).join(' · ')}</p>
      <p class="small"><b>Runetermo</b>: acertou na tentativa 1 a 7 → ${PDR_RUNETERMO.map((p) => `<b>+${p}</b>`).join(' ')} · errou: −4 a −25.</p>
      <p class="small"><b>Campeão Oculto</b>: acertou na 1ª → <b>+36</b> … na última → <b>+5</b> (−4 por dica) · errou: −4 a −25.</p>
    </div>
  </section>`;
}
