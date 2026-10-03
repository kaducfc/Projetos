// Painel do administrador: acessos do site, estatísticas dos jogos e apoios.
// Os números vêm da função site_admin_stats do Supabase, que só responde
// para contas cadastradas em site_admins.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { ROLES, REGIONS } from '../jogos/carreira-no-rift/js/data/world.js';
import { GAMES, gameById } from '../shared/config.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../' });
mountSiteFooter(document.getElementById('site-footer'));

const body = document.getElementById('panel-body');
const range = document.querySelector('.range');
const tip = document.getElementById('chart-tip');
let days = 30;
try { days = Number(localStorage.getItem('site.painel.dias')) || 30; } catch { /* sem storage */ }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const dec = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
const dia = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
};
const reais = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const diaLongo = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

const roleName = (id) => Object.values(ROLES).find((r) => r.id === id || r.short?.toLowerCase() === id)?.name || id;
const regionName = (id) => REGIONS[id]?.name || (id === 'wc' ? 'Wildcard' : id);
const speedName = (id) => (id === 'rapido' ? 'Rápido' : id === 'normal' ? 'Normal' : id);

function tile(label, value, sub = '') {
  return `<div class="tile"><span class="t-label">${esc(label)}</span><span class="t-value">${value}</span>${sub ? `<span class="t-sub">${sub}</span>` : ''}</div>`;
}

// Colunas por dia (uma série só: o título diz o que é, sem legenda).
function columns(rows, key, unit, fmt = num) {
  const max = Math.max(1, ...rows.map((r) => Number(r[key])));
  const total = rows.reduce((s, r) => s + Number(r[key]), 0);
  const cols = rows.map((r) => {
    const v = Number(r[key]);
    const h = v ? Math.max(2, (v / max) * 100) : 0;
    return `<div class="col${v ? '' : ' zero'}" data-tip="${esc(diaLongo(r.dia))}: <b>${fmt(v)}</b> ${unit}"><i style="height:${h}%"></i></div>`;
  }).join('');
  const mid = rows[Math.floor(rows.length / 2)];
  return {
    total,
    html: `<div class="cols" role="img" aria-label="${esc(`${fmt(total)} ${unit} no período`)}">
      <span class="max">${fmt(max)}</span><span class="gridline"></span>${cols}</div>
      <div class="cols-x"><span>${dia(rows[0].dia)}</span>${rows.length > 2 ? `<span>${dia(mid.dia)}</span>` : ''}<span>${dia(rows.at(-1).dia)}</span></div>`,
  };
}

// Distribuição em barras horizontais, da maior para a menor.
function hbars(entries, nameOf = (x) => x, { sort = true, fmt = num } = {}) {
  const list = sort ? entries.slice().sort((a, b) => b[1] - a[1]) : entries;
  const total = list.reduce((s, [, n]) => s + n, 0);
  if (!total) return '<p class="p-empty">Sem dados no período.</p>';
  const max = Math.max(...list.map(([, n]) => n));
  return `<div class="hbars">${list.map(([k, n]) => `
    <div class="hbar"><span class="h-label">${esc(nameOf(k))}</span>
      <span class="h-val">${fmt(n)} <small>${Math.round((n / total) * 100)}%</small></span>
      <span class="h-track"><i class="h-fill" style="width:${(n / max) * 100}%"></i></span></div>`).join('')}</div>`;
}

// Abas do painel (a escolhida fica guardada neste navegador).
const ABAS = [['geral', 'Visão geral'], ['jogos', 'Jogos'], ['ranqueada', 'Ranqueada'], ['apoio', 'Apoio'], ['ferramentas', 'Ferramentas']];
let aba = 'geral';
try { aba = localStorage.getItem('site.painel.aba') || 'geral'; } catch { /* sem storage */ }
if (!ABAS.some(([id]) => id === aba)) aba = 'geral';
let ultimo = null; // última resposta de adminStats (para trocar de aba sem recarregar)
let rq = null; // platform.adminRanqueada(days)
let rqErro = '';

const ELO_NOMES = { ferro: 'Ferro', bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', platina: 'Platina', esmeralda: 'Esmeralda', diamante: 'Diamante', mestre: 'Mestre', 'grao-mestre': 'Grão-Mestre', desafiante: 'Desafiante' };
const NOME_JOGO = (id) => gameById(id)?.name || id;

function suspeitasRk() {
  return (rk?.partidas || []).filter((x) => sinais(x).length).length;
}

function render(st) {
  ultimo = st;
  const contador = { ranqueada: suspeitasRk(), apoio: ap?.periodo?.status?.pendente || 0 };
  const nav = `<nav class="p-tabs" role="tablist">${ABAS.map(([id, nome]) => `<button type="button" role="tab" data-aba="${id}" class="${aba === id ? 'on' : ''}">${nome}${contador[id] ? ` <span class="p-badge">${num(contador[id])}</span>` : ''}</button>`).join('')}</nav>`;
  const conteudo = { geral: abaGeral, jogos: abaJogos, ranqueada: abaRanqueada, apoio: abaApoio, ferramentas: abaFerramentas }[aba](st);
  body.innerHTML = nav + conteudo;
}

// ----------------------------------------------------------- aba: visão geral

function avisos() {
  const itens = [];
  const susp = suspeitasRk();
  if (susp) itens.push(`<b>${num(susp)}</b> ${susp === 1 ? 'partida ranqueada da Carreira' : 'partidas ranqueadas da Carreira'} com sinais de suspeita. <button type="button" class="p-link" data-aba="ranqueada">Ver</button>`);
  const pend = ap?.periodo?.status?.pendente || 0;
  if (pend) itens.push(`<b>${num(pend)}</b> ${pend === 1 ? 'doação aguardando' : 'doações aguardando'} pagamento (Pix/boleto). <button type="button" class="p-link" data-aba="apoio">Ver</button>`);
  for (const e of [rkErro, apErro, rqErro]) if (e) itens.push(esc(e));
  if (!itens.length) return '<div class="p-ok">✓ Nada pedindo atenção agora.</div>';
  return `<div class="p-avisos"><h3>Atenção</h3><ul>${itens.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
}

function abaGeral(st) {
  const rows = st.por_dia || [];
  const visits = columns(rows, 'visitantes', 'visitantes');
  const games = columns(rows, 'partidas', 'partidas iniciadas');
  const perGame = st.jogos || {};
  return `${avisos()}
  <section class="p-section">
    <h2>Hoje</h2>
    <div class="tiles">
      ${tile('Visitantes', num(st.hoje.visitantes), 'navegadores diferentes')}
      ${tile('Partidas iniciadas', num(st.hoje.partidas), 'todos os jogos')}
      ${tile('Partidas terminadas', num(st.hoje.terminadas), 'todos os jogos')}
      ${tile('Contas novas', num(st.hoje.contas))}
      ${rq ? tile('Na ranqueada hoje', num(rq.ativos_hoje), 'jogadores com PDR hoje') : ''}
      ${ap ? tile('Apoio hoje', reais(ap.hoje.arrecadado), `${num(ap.hoje.doacoes)} ${ap.hoje.doacoes === 1 ? 'doação' : 'doações'}`) : ''}
    </div>
  </section>
  <section class="p-section">
    <h2>Últimos ${st.dias} dias</h2>
    <div class="tiles">
      ${tile('Visitantes', num(st.periodo.visitantes), 'navegadores diferentes')}
      ${tile('Jogadores', num(st.periodo.jogadores), 'começaram ao menos 1 partida')}
      ${tile('Partidas iniciadas', num(st.periodo.partidas), `${num(st.periodo.terminadas)} terminadas`)}
      ${tile('Contas novas', num(st.periodo.contas), `${num(st.total.contas)} no total`)}
    </div>
    <div class="cards">
      <div class="card"><h3>Visitantes por dia</h3><p class="c-sub">${num(visits.total)} visitas diárias somadas</p>${visits.html}</div>
      <div class="card"><h3>Partidas iniciadas por dia</h3><p class="c-sub">${num(games.total)} no período</p>${games.html}</div>
    </div>
    <div class="card"><h3>Por jogo</h3><div class="table-wrap"><table class="p-table">
      <thead><tr><th>Jogo</th><th class="n">Jogadores</th><th class="n">Iniciadas</th><th class="n">Terminadas</th><th class="n">Concluem</th></tr></thead>
      <tbody>${GAMES.filter((g) => g.status === 'live').map((g) => {
        const x = perGame[g.id] || {};
        const pct = x.iniciadas ? `${Math.round(((x.terminadas || 0) / x.iniciadas) * 100)}%` : '—';
        return `<tr><td>${esc(g.name)}</td><td class="n">${num(x.jogadores || 0)}</td><td class="n">${num(x.iniciadas || 0)}</td><td class="n">${num(x.terminadas || 0)}</td><td class="n">${pct}</td></tr>`;
      }).join('')}</tbody>
    </table></div></div>
    <details class="p-details"><summary>Ver tabela por dia</summary>
      <div class="table-wrap"><table class="p-table">
        <thead><tr><th>Dia</th><th class="n">Visitantes</th><th class="n">Partidas iniciadas</th><th class="n">Terminadas</th><th class="n">Contas novas</th></tr></thead>
        <tbody>${rows.slice().reverse().map((r) => `<tr><td>${esc(diaLongo(r.dia))}</td><td class="n">${num(r.visitantes)}</td><td class="n">${num(r.partidas)}</td><td class="n">${num(r.terminadas)}</td><td class="n">${num(r.contas)}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>
  </section>`;
}

// ------------------------------------------------------------------ aba: jogos

function abaJogos(st) {
  const c = st.carreira || {};
  const rows = st.por_dia || [];
  const pw = st.palavra || {};
  const pwDays = columns(pw.por_dia || rows.map((x) => ({ dia: x.dia, jogadas: 0 })), 'jogadas', 'palavras jogadas');
  const conclusao = c.iniciadas ? Math.round((c.terminadas / c.iniciadas) * 100) : null;
  const d = rq?.diarios || {};
  const diario = (id, x, extra) => `<div class="card"><h3>${esc(NOME_JOGO(id))}</h3>
      ${x ? `<div class="mini-tiles">
        ${tile('Partidas', num(x.jogadas))}
        ${extra(x)}
        ${tile('Abandonadas', num(x.abandonos), 'começou e não terminou')}
      </div>` : `<p class="p-note">${esc(rqErro || (rq ? 'Sem dados ainda.' : 'Carregando…'))}</p>`}</div>`;
  return `
  <section class="p-section">
    <h2>Ranqueada dos jogos diários · últimos ${st.dias} dias</h2>
    <p class="p-note">Só quem jogou com conta (as partidas conferidas no servidor).</p>
    <div class="cards">
      ${diario('runetermo', d.runetermo, (x) => `${tile('Acertaram', `${dec(x.acertos_pct)}%`)}${tile('Tentativas', dec(x.chutes_medio), 'média de quem acertou')}`)}
      ${diario('campeao', d.campeao, (x) => `${tile('Acertaram', `${dec(x.acertos_pct)}%`)}${tile('Chutes', dec(x.chutes_medio), 'média de quem acertou')}`)}
      ${diario('escala', d.escala, (x) => `${tile('Média', x.media != null ? `${dec(x.media)}/100` : '—')}${tile('Rodadas recomeçadas', num(x.reinicios), 'internet caiu')}`)}
    </div>
  </section>

  <section class="p-section">
    <h2>${esc(NOME_JOGO('runetermo'))} · todos (com e sem conta) · últimos ${st.dias} dias</h2>
    <div class="tiles">
      ${tile('Jogaram hoje', num(pw.hoje_jogadas), pw.hoje_vitorias_pct != null ? `${dec(pw.hoje_vitorias_pct)}% acertaram` : '')}
      ${tile('Jogadas no período', num(pw.jogadas), `${num(pw.jogadores)} jogadores`)}
      ${tile('Acertaram', pw.vitorias_pct != null ? `${dec(pw.vitorias_pct)}%` : '—', 'das jogadas')}
      ${tile('Tentativas', pw.tentativas_media != null ? dec(pw.tentativas_media) : '—', 'média de quem acertou')}
    </div>
    <div class="cards">
      <div class="card"><h3>Jogadas por dia</h3><p class="c-sub">${num(pwDays.total)} no período</p>${pwDays.html}</div>
      <div class="card"><h3>Distribuição de tentativas</h3><p class="c-sub">Em quantas tentativas acertaram</p>
        ${hbars((pw.dist || []).map((n, i) => [i < 6 ? `${i + 1} tentativa${i ? 's' : ''}` : 'Não acertou', n]), undefined, { sort: false })}</div>
    </div>
  </section>

  <section class="p-section">
    <h2>Carreira no Rift · últimos ${st.dias} dias</h2>
    <div class="tiles">
      ${tile('Carreiras iniciadas', num(c.iniciadas))}
      ${tile('Carreiras terminadas', num(c.terminadas), conclusao != null ? `${conclusao}% das iniciadas` : '')}
      ${tile('OVR máximo médio', dec(c.ovr_medio), c.ovr_mediana != null ? `mediana ${dec(c.ovr_mediana)}` : '')}
      ${tile('Temporadas por carreira', dec(c.temporadas_media))}
      ${tile('Troféus e prêmios', dec(c.trofeus_media), 'média por carreira')}
      ${tile('Ganharam Mundial', c.mundial_pct != null ? `${dec(c.mundial_pct)}%` : '—', 'das carreiras terminadas')}
    </div>
    ${c.terminadas ? '' : '<p class="p-note">As médias aparecem quando alguém terminar uma carreira (aposentadoria).</p>'}
    <div class="cards">
      <div class="card"><h3>OVR máximo alcançado</h3><p class="c-sub">Carreiras terminadas por faixa</p>
        ${hbars((c.ovr_faixas || []).map((f) => [f.faixa, f.n]), undefined, { sort: false })}</div>
      <div class="card"><h3>Legado</h3><p class="c-sub">Título final das carreiras terminadas</p>${hbars(Object.entries(c.legados || {}))}</div>
    </div>
    <details class="p-details"><summary>Mais detalhes da Carreira (rota, região, velocidade, melhores carreiras)</summary>
      <div class="cards">
        <div class="card"><h3>Rota escolhida</h3><p class="c-sub">Carreiras iniciadas</p>${hbars(Object.entries(c.rotas || {}), roleName)}</div>
        <div class="card"><h3>Região inicial</h3><p class="c-sub">Carreiras iniciadas</p>${hbars(Object.entries(c.regioes || {}), regionName)}</div>
        <div class="card"><h3>Velocidade</h3><p class="c-sub">Carreiras iniciadas</p>${hbars(Object.entries(c.velocidade || {}), speedName)}</div>
      </div>
      <div class="card"><h3>Melhores carreiras do período</h3>
        ${(c.top || []).length ? `<div class="table-wrap"><table class="p-table">
          <thead><tr><th>#</th><th>Jogador</th><th>Rota</th><th>Legado</th><th class="n">OVR máx.</th><th class="n">Troféus</th><th class="n">Pontos</th></tr></thead>
          <tbody>${c.top.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.nick)}${t.conta ? ` <small>@${esc(t.conta)}</small>` : ' <small>visitante</small>'}</td><td>${esc(roleName(t.rota))}</td><td>${esc(t.legado)}</td><td class="n">${num(t.ovr)}</td><td class="n">${num(t.trofeus)}</td><td class="n">${num(t.pontos)}</td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="p-empty">Nenhuma carreira terminada no período.</p>'}
      </div>
    </details>
  </section>`;
}

// -------------------------------------------------------------- aba: ranqueada

function resumoRanqueada(dias) {
  if (!rq) return `<div class="card"><p class="p-note">${esc(rqErro || 'Carregando…')}</p></div>`;
  const elos = Object.keys(ELO_NOMES).map((id) => [id, rq.elos?.[id] || 0]);
  const jogos = Object.entries(rq.por_jogo || {});
  return `<div class="tiles">
      ${tile('Jogadores na ranqueada', num(rq.jogadores), `temporada ${num(rq.temporada)}`)}
      ${tile('Ativos hoje', num(rq.ativos_hoje), 'ganharam ou perderam PDR')}
      ${tile(`Ativos em ${dias} dias`, num(rq.ativos_periodo))}
      ${tile('Não terminaram', num(rq.nao_terminou), 'perdas de −15 no período')}
      ${tile('Inatividade', num(rq.inatividade), 'perdas no período')}
    </div>
    <div class="cards">
      <div class="card"><h3>Jogadores por elo</h3><p class="c-sub">Agora</p>${hbars(elos.filter(([, n]) => n), (k) => ELO_NOMES[k] || k, { sort: false })}</div>
      <div class="card"><h3>PDR por jogo</h3><p class="c-sub">Partidas que valeram no período</p>
        ${jogos.length ? `<div class="table-wrap"><table class="p-table">
          <thead><tr><th>Jogo</th><th class="n">Partidas</th><th class="n">Jogadores</th><th class="n">PDR médio</th><th class="n">Positivas</th></tr></thead>
          <tbody>${jogos.sort((a, b) => b[1].partidas - a[1].partidas).map(([id, x]) => `<tr><td>${esc(NOME_JOGO(id))}</td><td class="n">${num(x.partidas)}</td><td class="n">${num(x.jogadores)}</td>
            <td class="n">${x.pdr_medio > 0 ? '+' : ''}${dec(x.pdr_medio)}</td><td class="n">${dec(x.positivas_pct)}%</td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="p-empty">Nenhuma partida no período.</p>'}</div>
    </div>
    <div class="cards">
      <div class="card"><h3>Top 10 agora</h3>
        ${(rq.top || []).length ? `<div class="table-wrap"><table class="p-table">
          <thead><tr><th>#</th><th>Usuário</th><th>Elo</th><th class="n">Pontos</th><th>Última atividade</th></tr></thead>
          <tbody>${rq.top.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.username)}</td><td>${esc(ELO_NOMES[t.elo] || t.elo)}</td><td class="n">${num(t.pts)}</td><td>${t.ultima_atividade ? esc(dia(t.ultima_atividade)) : '—'}</td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="p-empty">Ninguém na ranqueada ainda.</p>'}</div>
      <div class="card"><h3>Ajustar PDR</h3>
        <p class="c-sub">Dar ou tirar PDR de alguém (ex.: compensar um erro do site). Use número negativo para tirar. Fica no histórico do jogador como "ajuste" e não entra nos rankings do dia, semana e mês.</p>
        <div class="ap-filtros">
          <label class="p-label">Nome de usuário <input data-aj-nome autocomplete="off" /></label>
          <label class="p-label">PDR <input type="number" step="1" data-aj-valor placeholder="ex.: 25 ou -25" /></label>
          <button type="button" class="p-btn" data-aj-enviar>Aplicar</button>
        </div>
        <p class="p-note" data-aj-msg role="status"></p>
        ${(rq.ajustes || []).length ? `<details class="p-details"><summary>Últimos ajustes (${num(rq.ajustes.length)})</summary><div class="table-wrap"><table class="p-table">
          <thead><tr><th>Quando</th><th>Usuário</th><th class="n">PDR</th><th class="n">Antes → depois</th></tr></thead>
          <tbody>${rq.ajustes.map((x) => `<tr><td>${esc(dataHora(x.criado))}</td><td>${esc(x.username)}</td><td class="n">${x.delta > 0 ? '+' : ''}${num(x.delta)}</td><td class="n">${num(x.antes)} → ${num(x.depois)}</td></tr>`).join('')}</tbody>
        </table></div></details>` : ''}
      </div>
    </div>`;
}

function abaRanqueada(st) {
  return `
  <section class="p-section">
    <h2>Ranqueada · últimos ${st.dias} dias</h2>
    ${resumoRanqueada(st.dias)}
  </section>
  <section class="p-section">
    <h2>Vigilância · Carreira no Rift</h2>
    ${secaoVigia(st.dias)}
  </section>
  <section class="p-section">
    <h2>Zona de perigo</h2>
    <details class="p-details p-danger-box"><summary>Zerar a ranqueada (nova temporada)</summary>
      <div class="card p-danger">
        <p class="c-sub">Para o lançamento oficial (ou uma nova temporada): todo mundo volta para o Ferro 3 com 0 PDR e os rankings recomeçam. O histórico de partidas de cada conta continua.</p>
        <label class="p-label">Temporada que começa: <input type="number" min="1" value="${num((rq?.temporada || 0) + 1)}" data-temporada /></label>
        <label class="p-label">Para confirmar, digite <b>ZERAR</b>: <input data-confirma autocomplete="off" /></label>
        <button type="button" class="p-btn p-btn-danger" data-zerar disabled>Zerar ranqueada</button>
        <p class="p-note" data-zerar-msg role="status"></p>
      </div>
    </details>
  </section>`;
}

// ------------------------------------------------------------------ aba: apoio

function abaApoio(st) {
  return secaoApoio(st.dias);
}

// ------------------------------------------------------------ aba: ferramentas

function abaFerramentas() {
  const link = (href, titulo, texto) => `<a class="card p-tool" href="${href}"><h3>${titulo} →</h3><p class="c-sub">${texto}</p></a>`;
  return `<section class="p-section">
    <h2>Ferramentas e atalhos</h2>
    <div class="cards">
      ${link('cblol/', 'Dados do CBLOL', 'Baixar de novo os times, jogadores e estatísticas da Leaguepedia (Lendas do CBLOL).')}
      ${link('../jogos/escala/tabela/', 'Tabela de alturas (Na Medida)', 'Ver todas as alturas e silhuetas lado a lado, por faixa.')}
      ${link('../ranking/', 'Ranking público', 'Como os jogadores veem o ranking da ranqueada.')}
      ${link('../apoiar/', 'Página de apoio', 'A página onde os jogadores apoiam o site.')}
    </div>
    <div class="card">
      <h3>Lembretes</h3>
      <ul class="p-steps">
        <li>Mudou alguma altura do Na Medida (<code>jogos/escala/dados/itens.json</code>)? Gere e rode o SQL novo de alturas, senão a ranqueada usa as antigas.</li>
        <li>A Edge Function <code>apoio-criar</code> precisa estar com o valor máximo novo (sem teto) no Supabase.</li>
        <li>Se um quadro do painel disser "Rode o arquivo 00XX…", é um SQL que ainda falta rodar no Supabase.</li>
      </ul>
    </div>
  </section>`;
}

// ------------------------------------------------------------ ranqueada: vigia

// Sinais de suspeita numa partida ranqueada (os limites dá para ajustar na tela).
const NOTA_ALTA = 1400; // ~top 0,5% das carreiras simuladas
let rk = null; // resposta de platform.adminRanked(days)
let rkErro = '';
const rkFiltro = { so: true, min: 3, q: '' };

function sinais(x) {
  const out = [];
  if (x.duracao_s != null && x.duracao_s < rkFiltro.min * 60) out.push(['rapida', 'Rápida demais']);
  if (x.esperado_min != null && (x.score < x.esperado_min || x.score > x.esperado_max)) out.push(['naobate', 'Não bate com os troféus']);
  if (x.score >= NOTA_ALTA) out.push(['alta', 'Nota muito alta']);
  return out;
}
const duracao = (s) => (s == null ? '—' : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`);

function rkTabela() {
  const q = rkFiltro.q.trim().toLowerCase();
  const lista = (rk?.partidas || []).map((x) => ({ ...x, sinais: sinais(x) }))
    .filter((x) => (!rkFiltro.so || x.sinais.length) && (!q || (x.username || '').toLowerCase().includes(q)));
  if (!lista.length) return `<p class="p-empty">${rkFiltro.so ? 'Nenhuma partida com sinais de suspeita no período.' : 'Nenhuma partida ranqueada no período.'}</p>`;
  return `<div class="table-wrap"><table class="p-table">
    <thead><tr><th>Quando</th><th>Usuário</th><th class="n">Nota</th><th class="n">Duração</th><th class="n">Faixa possível</th><th>Sinais</th><th></th></tr></thead>
    <tbody>${lista.slice(0, 300).map((x) => `<tr>
      <td>${esc(dataHora(x.criado))}</td>
      <td>${esc(x.username)}${x.ovr != null ? ` <small>OVR ${x.ovr} · ${num(x.temporadas)} temp.</small>` : ' <small>sem detalhes</small>'}</td>
      <td class="n"><b>${num(x.score)}</b></td>
      <td class="n">${duracao(x.duracao_s)}</td>
      <td class="n">${x.esperado_min != null ? `${num(x.esperado_min)}–${num(x.esperado_max)}` : '—'}</td>
      <td>${x.sinais.map(([c, t]) => `<span class="rk-sinal rk-${c}">${t}</span>`).join(' ') || '<small>—</small>'}</td>
      <td><button type="button" class="p-mini" data-rk-anular="${x.id}" data-rk-info="${esc(`${x.username} · ${num(x.score)} pontos`)}">Anular</button></td></tr>`).join('')}</tbody>
  </table></div>`;
}

function rkJogadores() {
  const por = new Map();
  for (const x of rk?.partidas || []) {
    const j = por.get(x.username) || { nome: x.username, n: 0, soma: 0, maior: 0, sinais: 0 };
    j.n++; j.soma += x.score; j.maior = Math.max(j.maior, x.score); j.sinais += sinais(x).length ? 1 : 0;
    por.set(x.username, j);
  }
  const lista = [...por.values()].sort((a, b) => b.sinais - a.sinais || b.soma - a.soma).slice(0, 30);
  if (!lista.length) return '<p class="p-empty">Ninguém jogou ranqueada no período.</p>';
  return `<div class="table-wrap"><table class="p-table">
    <thead><tr><th>Usuário</th><th class="n">Partidas</th><th class="n">Pontos</th><th class="n">Maior nota</th><th class="n">Com sinais</th><th></th></tr></thead>
    <tbody>${lista.map((j) => `<tr><td>${esc(j.nome)}</td><td class="n">${num(j.n)}</td><td class="n">${num(j.soma)}</td><td class="n">${num(j.maior)}</td>
      <td class="n">${j.sinais ? `<b class="rk-alerta">${num(j.sinais)}</b>` : '0'}</td>
      <td><button type="button" class="p-mini p-mini-danger" data-rk-banir="${esc(j.nome)}">Tirar da ranqueada</button></td></tr>`).join('')}</tbody>
  </table></div>`;
}

function secaoVigia(dias) {
  if (!rk) return `<div class="card"><h3>Vigilância</h3><p class="p-note">${esc(rkErro || 'Carregando…')}</p></div>`;
  const ps = rk.partidas || [];
  const suspeitas = ps.filter((x) => sinais(x).length).length;
  return `<div class="tiles">
      ${tile('Partidas ranqueadas', num(ps.length), `últimos ${dias} dias`)}
      ${tile('Jogadores', num(new Set(ps.map((x) => x.username)).size))}
      ${tile('Com sinais de suspeita', num(suspeitas), ps.length ? `${Math.round((suspeitas / ps.length) * 100)}% das partidas` : '')}
      ${tile('Fora da ranqueada', num((rk.banidos || []).length), 'jogadores tirados')}
    </div>
    <div class="card"><h3>Partidas ranqueadas</h3>
      <p class="c-sub">Sinais: <b>rápida demais</b> (do começo ao fim da carreira, pelo relógio do servidor), <b>não bate com os troféus</b> (a nota está fora da faixa possível para o OVR, troféus e temporadas informados; nenhuma carreira honesta simulada ficou fora) e <b>nota muito alta</b> (${num(NOTA_ALTA)}+, raro mas possível). Um sinal sozinho não prova trapaça; confira antes de agir.</p>
      <div class="ap-filtros">
        <label class="p-check"><input type="checkbox" data-rk-f="so"${rkFiltro.so ? ' checked' : ''} /> Só com sinais</label>
        <label class="p-label">Rápida se menos de (min) <input type="number" min="1" max="60" step="1" data-rk-f="min" value="${rkFiltro.min}" /></label>
        <label class="p-label">Usuário <input type="search" data-rk-f="q" value="${esc(rkFiltro.q)}" autocomplete="off" /></label>
      </div>
      <div data-rk-lista>${rkTabela()}</div>
    </div>
    <div class="card"><h3>Jogadores do período</h3><p class="c-sub">Quem tem mais partidas com sinais aparece primeiro. "Tirar da ranqueada" apaga as partidas ranqueadas e o elo do jogador e as próximas carreiras dele não valem (dá para devolver depois).</p>
      <div data-rk-jog>${rkJogadores()}</div></div>
    ${(rk.banidos || []).length ? `<div class="card"><h3>Fora da ranqueada</h3><div class="table-wrap"><table class="p-table">
      <thead><tr><th>Usuário</th><th>Motivo</th><th>Desde</th><th></th></tr></thead>
      <tbody>${rk.banidos.map((b) => `<tr><td>${esc(b.username)}</td><td>${esc(b.motivo || '—')}</td><td>${esc(dataCurta(b.criado))}</td>
        <td><button type="button" class="p-mini" data-rk-devolver="${esc(b.username)}">Devolver</button></td></tr>`).join('')}</tbody>
    </table></div></div>` : ''}`;
}

body.addEventListener('input', (e) => {
  const f = e.target.closest('[data-rk-f]');
  if (!f) return;
  const k = f.dataset.rkF;
  rkFiltro[k] = k === 'so' ? f.checked : k === 'min' ? Math.max(1, Number(f.value) || 3) : f.value;
  body.querySelector('[data-rk-lista]').innerHTML = rkTabela();
  body.querySelector('[data-rk-jog]').innerHTML = rkJogadores();
});
body.addEventListener('click', async (e) => {
  const an = e.target.closest('[data-rk-anular]');
  const ban = e.target.closest('[data-rk-banir]');
  const dev = e.target.closest('[data-rk-devolver]');
  try {
    if (an) {
      if (!window.confirm(`Anular esta partida ranqueada (${an.dataset.rkInfo})? Ela sai da nota do dia e do ranking.`)) return;
      an.disabled = true;
      await platform.adminAnularPartida(Number(an.dataset.rkAnular));
      await load();
    } else if (ban) {
      const nome = ban.dataset.rkBanir;
      const motivo = window.prompt(`Tirar ${nome} da ranqueada? As partidas ranqueadas e o elo dele serão apagados.\n\nMotivo (opcional, só você vê):`, '');
      if (motivo === null) return;
      ban.disabled = true;
      await platform.adminBanirRanked(nome, { motivo });
      await load();
    } else if (dev) {
      if (!window.confirm(`Devolver ${dev.dataset.rkDevolver} para a ranqueada? As próximas carreiras dele voltam a valer (as partidas apagadas não voltam).`)) return;
      dev.disabled = true;
      await platform.adminBanirRanked(dev.dataset.rkDevolver, { banir: false });
      await load();
    }
  } catch (err) {
    window.alert(err.message);
    [an, ban, dev].forEach((b) => { if (b) b.disabled = false; });
  }
});

// ------------------------------------------------------------------ apoio

const AP_STATUS = { aprovado: 'Aprovado', pendente: 'Aguardando', recusado: 'Recusado', cancelado: 'Cancelado', estornado: 'Estornado' };
const AP_ORIGEM = { mercadopago: 'Mercado Pago', manual: 'Registrado à mão' };
let ap = null; // resposta de platform.adminApoios(days)
let apErro = '';
const apFiltro = { status: '', origem: '', q: '', min: '', limite: 50 };

function apFiltrados() {
  const q = apFiltro.q.trim().toLowerCase();
  const min = Number(apFiltro.min) || 0;
  return (ap?.lista || []).filter((a) => (!apFiltro.status || a.status === apFiltro.status)
    && (!apFiltro.origem || a.origem === apFiltro.origem)
    && (!q || (a.username || '').toLowerCase().includes(q) || String(a.mp_payment_id || '').includes(q))
    && Number(a.valor_pago ?? a.valor) >= min);
}

function apLista() {
  const lista = apFiltrados();
  if (!lista.length) return '<p class="p-empty">Nenhuma doação com esses filtros.</p>';
  const aprovadas = lista.filter((a) => a.status === 'aprovado');
  const soma = aprovadas.reduce((t, a) => t + Number(a.valor_pago ?? a.valor), 0);
  const vis = lista.slice(0, apFiltro.limite);
  return `<p class="p-note">${num(lista.length)} ${lista.length === 1 ? 'doação' : 'doações'} · ${num(aprovadas.length)} aprovadas somando <b>${reais(soma)}</b></p>
    <div class="table-wrap"><table class="p-table ap-tabela">
      <thead><tr><th>Quando</th><th>Usuário</th><th class="n">Valor</th><th>Situação</th><th>Origem</th><th>Pagamento MP</th></tr></thead>
      <tbody>${vis.map((a) => `<tr>
        <td>${esc(dataHora(a.criado))}</td>
        <td>${a.username ? esc(a.username) : '<small>conta apagada</small>'}</td>
        <td class="n">${reais(a.valor_pago ?? a.valor)}</td>
        <td><span class="ap-st ap-${esc(a.status)}">${esc(AP_STATUS[a.status] || a.status)}</span></td>
        <td>${esc(AP_ORIGEM[a.origem] || a.origem)}</td>
        <td>${a.mp_payment_id ? `<small>${esc(a.mp_payment_id)}</small>` : '<small>—</small>'}</td></tr>`).join('')}</tbody>
    </table></div>
    ${lista.length > vis.length ? `<button type="button" class="p-btn p-btn-ghost" data-ap-mais>Mostrar mais (${num(lista.length - vis.length)} restantes)</button>` : ''}`;
}

function secaoApoio(dias) {
  const registrar = `<div class="card">
      <h3>Registrar apoio feito por fora</h3>
      <p class="c-sub">Para quem apoiou sem passar pela página (ex.: Pix direto para você). O valor soma no total da conta e libera o efeito no nick.</p>
      <label class="p-label">Nome de usuário: <input data-apoio-nome autocomplete="off" /></label>
      <label class="p-label">Valor (R$): <input type="number" min="1" step="0.01" data-apoio-valor /></label>
      <button type="button" class="p-btn" data-apoio-registrar>Registrar apoio</button>
      <p class="p-note" data-apoio-msg role="status"></p>
    </div>`;
  if (!ap) {
    return `<section class="p-section"><h2>Apoio</h2>
      <p class="p-note">${esc(apErro || 'Carregando as doações…')}</p>${registrar}</section>`;
  }
  const t = ap.total;
  const p = ap.periodo;
  const porDia = columns(ap.por_dia || [], 'valor', 'arrecadados', reais);
  const st = Object.entries(p.status || {}).map(([k, n]) => [k, n]);
  const opt = (obj, atual) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${atual === k ? ' selected' : ''}>${esc(v)}</option>`).join('');
  return `<section class="p-section" id="apoio">
    <h2>Apoio · desde sempre</h2>
    <div class="tiles">
      ${tile('Arrecadado', reais(t.arrecadado), 'doações aprovadas')}
      ${tile('Doações', num(t.doacoes), `${num(t.apoiadores)} ${t.apoiadores === 1 ? 'apoiador' : 'apoiadores'}`)}
      ${tile('Ticket médio', reais(t.ticket_medio), 'por doação')}
      ${tile('Maior doação', reais(t.maior))}
      ${tile('Estornado', reais(t.estornado), 'devolvido')}
    </div>
  </section>
  <section class="p-section">
    <h2>Apoio · últimos ${dias} dias</h2>
    <div class="tiles">
      ${tile('Hoje', reais(ap.hoje.arrecadado), `${num(ap.hoje.doacoes)} ${ap.hoje.doacoes === 1 ? 'doação' : 'doações'}`)}
      ${tile('No período', reais(p.arrecadado), `${num(p.doacoes)} ${p.doacoes === 1 ? 'doação' : 'doações'}`)}
      ${tile('Apoiadores', num(p.apoiadores), `${num(p.novos)} ${p.novos === 1 ? 'novo' : 'novos'} no período`)}
      ${tile('Ticket médio', reais(p.ticket_medio), p.maior != null ? `maior: ${reais(p.maior)}` : '')}
      ${tile('Concluíram o pagamento', p.conversao_pct != null ? `${dec(p.conversao_pct)}%` : '—', `de ${num(p.tentativas)} tentativas`)}
      ${tile('Aguardando', num(p.status?.pendente || 0), 'Pix/boleto ainda não pago')}
    </div>
    <p class="p-note">Valores brutos, antes da taxa do Mercado Pago. Uma doação conta no dia em que foi criada.</p>
    <div class="cards">
      <div class="card"><h3>Arrecadado por dia</h3><p class="c-sub">${reais(porDia.total)} no período</p>${porDia.html}</div>
      <div class="card"><h3>Situação das tentativas</h3><p class="c-sub">Quem clicou em apoiar, no período</p>${hbars(st, (k) => AP_STATUS[k] || k)}</div>
      <div class="card"><h3>Faixas de valor</h3><p class="c-sub">Doações aprovadas no período</p>${hbars((p.faixas || []).map((f) => [f.faixa, f.n]), undefined, { sort: false })}</div>
      <div class="card"><h3>Origem</h3><p class="c-sub">Valor aprovado no período</p>${hbars(Object.entries(p.origem || {}), (k) => AP_ORIGEM[k] || k, { fmt: reais })}</div>
    </div>
    <div class="card"><h3>Quem mais apoiou</h3><p class="c-sub">Desde sempre, só doações aprovadas</p>
      ${(ap.top || []).length ? `<div class="table-wrap"><table class="p-table">
        <thead><tr><th>#</th><th>Usuário</th><th class="n">Total</th><th class="n">Doações</th><th>Desde</th><th>Última</th></tr></thead>
        <tbody>${ap.top.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.username)}</td><td class="n">${reais(x.total)}</td><td class="n">${num(x.doacoes)}</td><td>${esc(dataCurta(x.desde))}</td><td>${esc(dataCurta(x.ultima))}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="p-empty">Ninguém apoiou ainda.</p>'}
    </div>
    <div class="card"><h3>Doações dos últimos ${dias} dias</h3><p class="c-sub">Todas as tentativas, inclusive as não pagas. Filtre e baixe em planilha.</p>
      <div class="ap-filtros">
        <label class="p-label">Situação <select data-ap-f="status"><option value="">Todas</option>${opt(AP_STATUS, apFiltro.status)}</select></label>
        <label class="p-label">Origem <select data-ap-f="origem"><option value="">Todas</option>${opt(AP_ORIGEM, apFiltro.origem)}</select></label>
        <label class="p-label">Usuário ou nº do pagamento <input type="search" data-ap-f="q" value="${esc(apFiltro.q)}" autocomplete="off" /></label>
        <label class="p-label">Valor mínimo (R$) <input type="number" min="0" step="1" data-ap-f="min" value="${esc(apFiltro.min)}" /></label>
        <button type="button" class="p-btn p-btn-ghost" data-ap-csv>Baixar CSV</button>
      </div>
      <div data-ap-lista>${apLista()}</div>
    </div>
    ${registrar}
  </section>`;
}

function apCsv() {
  const linhas = [['quando', 'usuario', 'valor', 'situacao', 'origem', 'pagamento_mp']];
  for (const a of apFiltrados()) {
    linhas.push([dataHora(a.criado), a.username || '', Number(a.valor_pago ?? a.valor).toFixed(2).replace('.', ','),
      AP_STATUS[a.status] || a.status, AP_ORIGEM[a.origem] || a.origem, a.mp_payment_id || '']);
  }
  const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `apoios-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

body.addEventListener('input', (e) => {
  const f = e.target.closest('[data-ap-f]');
  if (!f) return;
  apFiltro[f.dataset.apF] = f.value;
  apFiltro.limite = 50;
  body.querySelector('[data-ap-lista]').innerHTML = apLista();
});
body.addEventListener('click', (e) => {
  if (e.target.closest('[data-ap-mais]')) {
    apFiltro.limite += 100;
    body.querySelector('[data-ap-lista]').innerHTML = apLista();
  }
  if (e.target.closest('[data-ap-csv]')) apCsv();
});

function lock(msg, withLogin) {
  range.hidden = true;
  body.innerHTML = `<div class="p-lock"><p>${esc(msg)}</p>${withLogin ? '<button type="button" data-login>Entrar</button>' : ''}</div>`;
  body.querySelector('[data-login]')?.addEventListener('click', () => openAuthModal('login'));
}

let loadSeq = 0;
async function load() {
  const seq = ++loadSeq;
  await platform.init();
  if (seq !== loadSeq) return;
  if (!platform.cloudEnabled()) return lock('O painel só funciona no site publicado.', false);
  if (!platform.getUser()) return lock('Entre com a conta de administrador para ver o painel.', true);
  range.hidden = false;
  range.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.days) === days));
  body.innerHTML = '<p class="muted">Carregando…</p>';
  try {
    // Apoio e vigilância podem faltar (SQL ainda não rodado) sem travar o resto.
    const opcional = (pr) => pr.then((r) => ({ r }), (err) => ({ err }));
    const [st, apoios, ranked, resumo] = await Promise.all([
      platform.adminStats(days), opcional(platform.adminApoios(days)), opcional(platform.adminRanked(days)),
      opcional(platform.adminRanqueada(days)),
    ]);
    if (seq !== loadSeq) return;
    rk = ranked.r || null;
    rkErro = ranked.err?.message || '';
    ap = apoios.r || null;
    apErro = apoios.err?.message || '';
    rq = resumo.r || null;
    rqErro = resumo.err?.message || '';
    render(st);
  } catch (err) {
    if (seq === loadSeq) lock(err.message, false);
  }
}

range.addEventListener('click', (e) => {
  const b = e.target.closest('[data-days]');
  if (!b) return;
  days = Number(b.dataset.days);
  try { localStorage.setItem('site.painel.dias', String(days)); } catch { /* sem storage */ }
  load();
});

// Dica ao passar o mouse (ou tocar) numa coluna.
function showTip(col, x, y) {
  tip.innerHTML = col.dataset.tip;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2))}px`;
  tip.style.top = `${Math.max(8, y - r.height - 12)}px`;
}
body.addEventListener('pointermove', (e) => {
  const col = e.target.closest('.col');
  document.querySelectorAll('.col.on').forEach((c) => c !== col && c.classList.remove('on'));
  if (!col) { tip.hidden = true; return; }
  col.classList.add('on');
  showTip(col, e.clientX, col.getBoundingClientRect().top + 18);
});
body.addEventListener('pointerleave', () => { tip.hidden = true; });

// Zerar a ranqueada (pede "ZERAR" digitado e mais uma confirmação).
body.addEventListener('input', (e) => {
  if (!e.target.matches('[data-confirma]')) return;
  body.querySelector('[data-zerar]').disabled = e.target.value.trim() !== 'ZERAR';
});
body.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-zerar]');
  if (!b) return;
  const temporada = Math.max(1, Number(body.querySelector('[data-temporada]').value) || 1);
  if (!window.confirm(`Zerar TODA a ranqueada e começar a Temporada ${temporada} hoje? Não dá para desfazer.`)) return;
  const msg = body.querySelector('[data-zerar-msg]');
  b.disabled = true;
  try {
    const r = await platform.adminResetRanked(temporada);
    msg.textContent = `Pronto! Ranqueada zerada (${num(r.jogadores_zerados)} jogadores voltaram ao Ferro 3). Temporada ${r.temporada} começou em ${r.inicio}.`;
    body.querySelector('[data-confirma]').value = '';
  } catch (err) {
    msg.textContent = err.message;
    b.disabled = false;
  }
});

body.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-apoio-registrar]');
  if (!b) return;
  const nome = body.querySelector('[data-apoio-nome]').value.trim();
  const valor = Number(body.querySelector('[data-apoio-valor]').value);
  const msg = body.querySelector('[data-apoio-msg]');
  if (!nome || !(valor > 0)) { msg.textContent = 'Preencha o nome de usuário e o valor.'; return; }
  if (!window.confirm(`Registrar apoio de R$ ${valor.toFixed(2)} para ${nome}?`)) return;
  b.disabled = true;
  try {
    const r = await platform.adminRegistrarApoio(nome, valor);
    const pronto = `Pronto! ${r.username} agora tem ${reais(r.total)} de apoio no total.`;
    await load();
    const m = body.querySelector('[data-apoio-msg]');
    if (m) m.textContent = pronto;
    return;
  } catch (err) {
    msg.textContent = err.message;
  }
  b.disabled = false;
});

body.addEventListener('click', (e) => {
  const t = e.target.closest('[data-aba]');
  if (!t || !ultimo) return;
  aba = t.dataset.aba;
  try { localStorage.setItem('site.painel.aba', aba); } catch { /* sem storage */ }
  render(ultimo);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Ajuste manual de PDR.
body.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-aj-enviar]');
  if (!b) return;
  const nome = body.querySelector('[data-aj-nome]').value.trim();
  const delta = Math.round(Number(body.querySelector('[data-aj-valor]').value));
  const msg = body.querySelector('[data-aj-msg]');
  if (!nome || !delta) { msg.textContent = 'Preencha o nome de usuário e o PDR (diferente de zero).'; return; }
  if (!window.confirm(`${delta > 0 ? 'Dar' : 'Tirar'} ${Math.abs(delta)} PDR ${delta > 0 ? 'para' : 'de'} ${nome}?`)) return;
  b.disabled = true;
  try {
    const r = await platform.adminAjustarPdr(nome, delta);
    const pronto = `Pronto! ${r.username}: ${num(r.antes)} → ${num(r.depois)} pontos (${ELO_NOMES[r.elo] || r.elo}).`;
    await load();
    const m = body.querySelector('[data-aj-msg]');
    if (m) m.textContent = pronto;
    return;
  } catch (err) {
    msg.textContent = err.message;
  }
  b.disabled = false;
});

platform.onChange((evt) => { if (evt.type === 'auth') load(); });
load();
