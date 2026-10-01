// Cartão "Minha ranqueada" (perfil e página de ranking).
import { ELOS, BENEFICIOS, PARTIDAS_POR_DIA, VAGAS_DESAFIANTE, eloInfo, nivelElo, emblemaHtml } from '../shared/ranked.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const ddmm = (iso) => {
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
};
const num = (n) => (n == null ? '—' : Math.round(Number(n)).toLocaleString('pt-BR'));

// s = resposta de platform.rankedStatus() (ou null sem conta / sem servidor).
export function cardMinhaRanqueada(s, { link = true } = {}) {
  if (!s) {
    return `<section class="pf-card rk-card">
      <div class="rk-emb">${emblemaHtml('bronze', 84, { vazio: true })}</div>
      <div class="rk-info">
        <p class="eyebrow">Ranqueada · Carreira no Rift</p>
        <h2 class="display">Sem ranque</h2>
        <p class="muted small">Entre na sua conta e termine carreiras na Carreira no Rift: as 3 primeiras do dia valem para o ranking e para subir de elo.</p>
      </div>
    </section>`;
  }
  const e = eloInfo(s.elo);
  const hoje = String(s.hoje.dia).slice(0, 10);
  const dias = s.ciclo.dias.map((d) => {
    const dia = String(d.dia).slice(0, 10);
    const futuro = dia > hoje;
    return `<div class="rk-dia${dia === hoje ? ' hoje' : ''}${futuro ? ' futuro' : ''}">
      <span>${dia === hoje ? 'Hoje' : ddmm(dia)}</span><b>${d.melhor != null ? num(d.melhor) : '—'}</b></div>`;
  }).join('');
  const prox = s.proximo;
  let meta;
  if (prox) {
    const pct = Math.min(100, Math.round((Number(s.ciclo.media) / prox.media) * 100));
    const pe = eloInfo(prox.elo);
    meta = `<div class="rk-meta">
      <div class="rk-meta-top"><span>Média do ciclo: <b>${num(s.ciclo.media)}</b></span><span>${esc(pe.nome)}: <b>${num(prox.media)}</b>${prox.elo === 'desafiante' ? ' + top 100' : ''}</span></div>
      <div class="rk-barra"><i style="width:${pct}%;background:${pe.cor}"></i></div>
    </div>`;
  } else {
    meta = `<div class="rk-meta"><div class="rk-meta-top"><span>Média do ciclo: <b>${num(s.ciclo.media)}</b></span>
      <span>Desafiantes: <b>${num(s.desafiantes)}/${VAGAS_DESAFIANTE}</b></span></div>
      <p class="muted small">Só os ${VAGAS_DESAFIANTE} com maior média ficam no Desafiante a cada atualização.</p></div>`;
  }
  const n = s.jogou ? nivelElo(s.elo) : -1;
  const liberados = BENEFICIOS.filter((b) => nivelElo(b.elo) <= n);
  const hist = (s.historico || []).slice(0, 3).map((h) => {
    const sobe = nivelElo(h.para) > nivelElo(h.de);
    return `<li>${sobe ? '▲ Subiu' : '▼ Caiu'} para <b style="color:${eloInfo(h.para).cor}">${esc(eloInfo(h.para).nome)}</b> <span class="muted">(média ${num(h.media)})</span></li>`;
  }).join('');
  return `<section class="pf-card rk-card" style="--cor:${s.jogou ? e.cor : '#6b6455'}">
    <div class="rk-emb">${emblemaHtml(s.elo, 84, { vazio: !s.jogou })}</div>
    <div class="rk-info">
      <p class="eyebrow">Ranqueada · Temporada ${esc(s.temporada)}</p>
      <h2 class="display">${s.jogou ? esc(e.nome) : 'Sem ranque'}</h2>
      <p class="muted small">Hoje: <b>${s.hoje.partidas} de ${PARTIDAS_POR_DIA}</b> carreiras ranqueadas${s.hoje.melhor != null ? ` · nota do dia: <b>${num(s.hoje.melhor)}</b>` : ''}</p>
      <div class="rk-dias">${dias}</div>
      ${meta}
      <p class="muted small">Próxima atualização de elo: <b>${ddmm(s.ciclo.atualiza)} à meia-noite</b> (horário de Brasília).</p>
      ${liberados.length ? `<ul class="rk-benef">${liberados.map((b) => `<li><b>${esc(b.jogo)}:</b> ${esc(b.texto)}</li>`).join('')}</ul>` : ''}
      ${hist ? `<ul class="rk-hist">${hist}</ul>` : ''}
      ${link ? '<a class="rk-link" href="/ranking/">Ver ranking →</a>' : ''}
    </div>
  </section>`;
}

// Tabela "Como funciona" (elos, médias e benefícios).
export function comoFunciona() {
  const linhas = ELOS.map((e) => {
    const b = BENEFICIOS.find((x) => x.elo === e.id);
    return `<tr><td><span class="rk-elo" style="--cor:${e.cor}">${emblemaHtml(e.id, 22)}${esc(e.nome)}</span></td>
      <td class="n">${e.media ? num(e.media) : '—'}${e.id === 'desafiante' ? ' + top 100' : ''}</td>
      <td>${b ? `<b>${esc(b.jogo)}:</b> ${esc(b.texto)}` : '<span class="muted">—</span>'}</td></tr>`;
  }).join('');
  return `<section class="pf-sec">
    <h2 class="section-title">Como funciona</h2>
    <div class="pf-card rk-regras">
      <ul>
        <li>Vale só a <b>Carreira no Rift</b>, com a conta conectada.</li>
        <li>Por dia, contam as <b>3 primeiras carreiras</b> terminadas. A <b>nota do dia</b> é a maior das 3. Depois disso dá para continuar jogando normalmente, mas não vale mais para o rank. O dia vira à meia-noite (horário de Brasília).</li>
        <li>A cada <b>3 dias</b> fecha um ciclo: a média das notas dos 3 dias (dia sem jogar conta 0). Quem bater a média do próximo elo sobe <b>1 elo</b> na atualização da meia-noite.</li>
        <li><b>Desafiante</b> tem só ${VAGAS_DESAFIANTE} vagas: a cada atualização, ficam os ${VAGAS_DESAFIANTE} com maior média; os outros voltam para o Diamante.</li>
        <li>Rankings: <b>diário</b> (nota de hoje), <b>semanal</b> e <b>mensal</b> (soma das notas dos dias).</li>
        <li>Cada elo libera um pequeno benefício nos outros jogos (e mantém os dos elos abaixo).</li>
      </ul>
      <div class="table-wrap"><table class="rk-tabela">
        <thead><tr><th>Elo</th><th class="n">Média para subir</th><th>Benefício</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
    </div>
  </section>`;
}
