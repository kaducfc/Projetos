// Painel do administrador: acessos do site, estatísticas dos jogos e apoios.
// Os números vêm da função site_admin_stats do Supabase, que só responde
// para contas cadastradas em site_admins.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { ROLES, REGIONS } from '../jogos/carreira-no-rift/js/data/world.js';
import { GAMES, gameById } from '../shared/config.js';
import { sinaisVigia, resumoJogadores } from '../shared/vigia.js';
import { nomeRecompensa, tipoTexto, codigoBonito } from '../shared/recompensas.js';
import { passeHtml } from '../shared/passe.js';
import { ligarCompraPremium } from '../shared/passe-compra.js';
import { EFEITOS, EFEITOS_TESTE } from '../shared/efeitos.js';
import { MOLDURAS_TESTE } from '../shared/molduras.js';
import { EXCLUSIVOS_TESTE, avatarHtml } from '../shared/avatar.js';

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
const ABAS = [['geral', 'Visão geral'], ['jogos', 'Jogos'], ['ranqueada', 'Ranqueada'], ['jogador', 'Jogador'], ['apoio', 'Apoio'], ['ferramentas', 'Ferramentas'], ['teste', 'Teste']];
let aba = 'geral';
try { aba = localStorage.getItem('site.painel.aba') || 'geral'; } catch { /* sem storage */ }
if (!ABAS.some(([id]) => id === aba)) aba = 'geral';
let ultimo = null; // última resposta de adminStats (para trocar de aba sem recarregar)
let rq = null; // platform.adminRanqueada(days)
let rqErro = '';
let cdModelos = []; // modelos salvos de recompensas
let cd = null; // platform.adminCodigos(): códigos de recompensa
let cdErro = '';
let cdNovo = null; // último código criado (para mostrar e copiar)
const cdAbertos = new Map(); // id do código → quem resgatou (lista) quando aberto
let vg = null; // platform.adminVigia(days): partidas dos outros jogos
let vgErro = '';
const vgFiltro = { so: true, q: '' };

const ELO_NOMES = { ferro: 'Ferro', bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro', platina: 'Platina', esmeralda: 'Esmeralda', diamante: 'Diamante', mestre: 'Mestre', 'grao-mestre': 'Grão-Mestre', desafiante: 'Desafiante' };
const NOME_JOGO = (id) => gameById(id)?.name || id;

function suspeitasRk() {
  return (rk?.partidas || []).filter((x) => sinais(x).length).length;
}
function suspeitasVg() {
  return (vg?.partidas || []).filter((x) => sinaisVigia(x).length).length;
}

function render(st) {
  ultimo = st;
  const contador = { ranqueada: suspeitasRk() + suspeitasVg(), apoio: ap?.periodo?.status?.pendente || 0 };
  const nav = `<nav class="p-tabs" role="tablist">${ABAS.map(([id, nome]) => `<button type="button" role="tab" data-aba="${id}" class="${aba === id ? 'on' : ''}">${nome}${contador[id] ? ` <span class="p-badge">${num(contador[id])}</span>` : ''}</button>`).join('')}</nav>`;
  const conteudo = { geral: abaGeral, jogos: abaJogos, ranqueada: abaRanqueada, jogador: abaJogador, apoio: abaApoio, ferramentas: abaFerramentas, teste: abaTeste }[aba](st);
  body.innerHTML = nav + conteudo;
  if (aba === 'teste' && ps === null && !psErro && !psCarregando && platform.getUser()) carregarPasse();
}

// ----------------------------------------------------------- aba: visão geral

function avisos() {
  const itens = [];
  const susp = suspeitasRk();
  if (susp) itens.push(`<b>${num(susp)}</b> ${susp === 1 ? 'partida ranqueada da Carreira' : 'partidas ranqueadas da Carreira'} com sinais de suspeita. <button type="button" class="p-link" data-aba="ranqueada">Ver</button>`);
  const sv = suspeitasVg();
  if (sv) itens.push(`<b>${num(sv)}</b> ${sv === 1 ? 'partida' : 'partidas'} com sinais de suspeita nos outros jogos da ranqueada. <button type="button" class="p-link" data-aba="ranqueada">Ver</button>`);
  const pend = ap?.periodo?.status?.pendente || 0;
  if (pend) itens.push(`<b>${num(pend)}</b> ${pend === 1 ? 'doação aguardando' : 'doações aguardando'} pagamento (Pix/boleto). <button type="button" class="p-link" data-aba="apoio">Ver</button>`);
  if (es.length) itens.push(`<b>${num(es.length)}</b> ${es.length === 1 ? 'estorno' : 'estornos'} para verificar (jogador pode ter usufruído da compra). <button type="button" class="p-link" data-aba="apoio">Ver</button>`);
  for (const e of [rkErro, vgErro, apErro, rqErro, esErro]) if (e) itens.push(esc(e));
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
          <tbody>${rq.top.map((t, i) => `<tr><td>${i + 1}</td><td>${nickLink(t.username)}</td><td>${esc(ELO_NOMES[t.elo] || t.elo)}</td><td class="n">${num(t.pts)}</td><td>${t.ultima_atividade ? esc(dia(t.ultima_atividade)) : '—'}</td></tr>`).join('')}</tbody>
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
          <tbody>${rq.ajustes.map((x) => `<tr><td>${esc(dataHora(x.criado))}</td><td>${nickLink(x.username)}</td><td class="n">${x.delta > 0 ? '+' : ''}${num(x.delta)}</td><td class="n">${num(x.antes)} → ${num(x.depois)}</td></tr>`).join('')}</tbody>
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
    <h2>Vigilância · Lendas, Runetermo, Campeão Oculto e Na Medida</h2>
    ${secaoVigiaJogos(st.dias)}
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
    ${secaoCodigos()}
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

// ------------------------------------------------------------------ aba: teste
// Coisas que ainda não foram para o público: o administrador vê e aprova aqui.
// Para lançar um efeito: mover de EFEITOS_TESTE para EFEITOS (shared/efeitos.js).

let testeNick = '';

function testeCartoes(nick) {
  const nome = esc(nick || 'NomeDoJogador');
  const grupo = (lista, rotulo) => lista.map((e) => `<article class="card t-efeito">
      <div class="t-ef-cab"><h3>${esc(e.nome)}</h3><span class="p-badge">${esc(e.tema || rotulo)}</span></div>
      <div class="t-ef-grande"><span class="nick fx ${e.classe}">${nome}</span></div>
      <div class="t-ef-linha"><span class="t-ef-mini"><span class="nick fx ${e.classe}">${nome}</span></span>
        <span class="t-ef-rk"><b>7</b> <span class="nick fx ${e.classe}">${nome}</span> <small>Ouro 2 · 1.250 PDR</small></span></div>
      <p class="c-sub">Id para o código: <code>${esc(e.id)}</code> <button type="button" class="p-link" data-t-copiar="${esc(e.id)}">copiar</button></p>
    </article>`).join('');
  return `<h3 class="t-tit">Em teste (só você vê)</h3><div class="cards t-grade">${grupo(EFEITOS_TESTE, 'Teste')}</div>
    <h3 class="t-tit">Já no ar, para comparar</h3><div class="cards t-grade">${grupo(EFEITOS, 'Público')}</div>`;
}

// Ícones exclusivos em teste, nos tamanhos em que aparecem no site.
function testeIcones() {
  if (!EXCLUSIVOS_TESTE.length) return '';
  const id = (i) => `icone:${i.id}`;
  return `<h3 class="t-tit">Ícones em teste (só você vê)</h3><div class="cards t-grade">${EXCLUSIVOS_TESTE.map((i) => `<article class="card t-efeito">
      <div class="t-ef-cab"><h3>${esc(i.nome)}</h3><span class="p-badge">Ícone exclusivo</span></div>
      <div class="t-ic-linha">${avatarHtml(id(i), i.nome, 104, 'elo-ouro')}${avatarHtml(id(i), i.nome, 64)}${avatarHtml(id(i), i.nome, 34, 'elo-diamante')}${avatarHtml(id(i), i.nome, 22)}</div>
      <p class="c-sub">Perfil (com borda de elo), seletor de ícones, ranking e barra do site.</p>
      <p class="c-sub">Id para o código: <code>${esc(i.id)}</code> <button type="button" class="p-link" data-t-copiar="${esc(i.id)}">copiar</button></p>
    </article>`).join('')}</div>`;
}

// Molduras em teste, em volta de um ícone de exemplo, nos tamanhos do site.
function testeMolduras() {
  if (!MOLDURAS_TESTE.length) return '';
  return `<h3 class="t-tit">Molduras em teste (só você vê)</h3><div class="cards t-grade">${MOLDURAS_TESTE.map((m) => `<article class="card t-efeito">
      <div class="t-ef-cab"><h3>${esc(m.nome)}</h3><span class="p-badge">Moldura</span></div>
      <div class="t-ic-linha" style="padding:22px 26px;gap:34px">${avatarHtml('mascote', m.nome, 104, 'elo-ouro', m.id)}${avatarHtml('mascote', m.nome, 64, '', m.id)}${avatarHtml('mascote', m.nome, 34, 'elo-diamante', m.id)}${avatarHtml('mascote', m.nome, 22, '', m.id)}</div>
      <p class="c-sub">O tamanho é calculado pelo buraco central da imagem. Aparece no perfil, ranking e barra do site.</p>
      <p class="c-sub">Id: <code>${esc(m.id)}</code> <button type="button" class="p-link" data-t-copiar="${esc(m.id)}">copiar</button></p>
    </article>`).join('')}</div>`;
}

// Passe de Batalha (em teste): o administrador joga o passe com a própria conta.
let ps = null; // platform.passeEstado()
let psErro = '';
let psCarregando = false;

async function carregarPasse() {
  psCarregando = true;
  try {
    ps = await platform.passeEstado();
    psErro = '';
  } catch (err) {
    ps = null;
    psErro = err.message;
  }
  psCarregando = false;
  if (aba === 'teste' && ultimo) render(ultimo);
}

function passeCard() {
  const eu = platform.getUser();
  if (!eu) return '<div class="card"><h3>Passe de Batalha</h3><p class="p-note">Entre na sua conta para ver o passe.</p></div>';
  if (psErro) return `<div class="card"><h3>Passe de Batalha</h3><p class="p-note">${esc(psErro)}</p><button type="button" class="p-mini" data-ps-recarregar>Tentar de novo</button></div>`;
  if (!ps) return '<div class="card"><h3>Passe de Batalha</h3><p class="p-note">Carregando…</p></div>';
  const controles = `<div class="ps-testebox"><span>Controles de teste (sua conta) · barra ${ps.progresso}/${ps.passe.abobora_por_nivel} · hoje ${ps.hoje}/${ps.passe.limite_dia} abóboras</span>
      <button type="button" class="p-mini" data-ps-acao="aboboras" data-valor="100">+100 abóboras</button>
      <button type="button" class="p-mini" data-ps-acao="aboboras" data-valor="-100">−100 abóboras</button>
      <button type="button" class="p-mini" data-ps-acao="premium" data-valor="${ps.premium ? 0 : 1}">${ps.premium ? 'Tirar o passe premium' : 'Ativar o passe premium'}</button>
      <button type="button" class="p-mini p-mini-danger" data-ps-acao="zerar" data-valor="0">Zerar meu progresso</button>
      <button type="button" class="p-mini" data-ps-publicar="${ps.passe.publico ? 0 : 1}">${ps.passe.publico ? 'Voltar para teste (esconder dos jogadores)' : 'Publicar para todos os jogadores'}</button>
    </div><p class="p-note" data-ps-msg role="status"></p>`;
  return `<div class="card"><h3>Passe de Batalha</h3>
    <p class="c-sub">Só você vê. Jogue qualquer jogo logado para ganhar abóboras de verdade; os botões de teste mexem só na sua conta. Os níveis ímpares são <b>premium</b> e os pares são <b>grátis</b>; as recompensas ficam na tabela <code>site_passe_niveis</code> (por enquanto, 500 RC em todos, e o efeito <b>Halloween 2026</b> no nível 15).</p>
    ${passeHtml(ps, { extra: controles })}</div>`;
}

function abaTeste() {
  const eu = platform.getUser();
  if (!testeNick && eu) testeNick = eu.username;
  return `<section class="p-section">
    <h2>Teste</h2>
    ${passeCard()}
    <div class="card">
      <p class="c-sub">Aqui ficam as novidades antes de irem para todo mundo. Os efeitos abaixo (para streamers) <b>não aparecem para os jogadores</b>: nem no perfil, nem no ranking. Para ver o efeito no seu nome de verdade, é só esperar o lançamento.</p>
      <label class="p-label">Nick de exemplo <input type="text" data-t-nick value="${esc(testeNick)}" maxlength="24" autocomplete="off" spellcheck="false" /></label>
      <ul class="p-steps">
        <li>Para dar um destes efeitos a um streamer: <b>Ferramentas → Códigos de recompensa</b>, recompensa tipo efeito, com o <b>id</b> do cartão (ex.: <code>st-nebulosa</code>).</li>
        <li>Depois de aprovar, me diga quais ficam e eu os movo para a lista pública (o jogador que tiver o código já passa a poder selecionar).</li>
      </ul>
    </div>
    ${testeIcones()}${testeMolduras()}
    <div data-t-previas>${testeCartoes(testeNick)}</div>
  </section>`;
}

body.addEventListener('input', (e) => {
  const i = e.target.closest('[data-t-nick]');
  if (!i) return;
  testeNick = i.value.trim().slice(0, 24);
  const el = body.querySelector('[data-t-previas]');
  if (el) el.innerHTML = testeCartoes(testeNick);
});
body.addEventListener('click', (e) => {
  const b = e.target.closest('[data-t-copiar]');
  if (!b) return;
  navigator.clipboard?.writeText(b.dataset.tCopiar).then(() => { b.textContent = 'copiado!'; }, () => {});
});

// ------------------------------------------------------------ ranqueada: vigia

// Sinais de suspeita numa partida ranqueada (os limites dá para ajustar na tela).
const NOTA_ALTA = 1600; // ~top 0,5% das carreiras simuladas (legado novo)
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
      <td>${nickLink(x.username)}${x.ovr != null ? ` <small>OVR ${x.ovr} · ${num(x.temporadas)} temp.</small>` : ' <small>sem detalhes</small>'}</td>
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
    <tbody>${lista.map((j) => `<tr><td>${nickLink(j.nome)}</td><td class="n">${num(j.n)}</td><td class="n">${num(j.soma)}</td><td class="n">${num(j.maior)}</td>
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

// ------------------------------------------------ vigilância dos outros jogos

const VG_TEXTO = {
  cblol: 'Lendas: campeão invicto (raro) ou campanha concluída em menos de 30 s.',
  runetermo: 'Runetermo e Campeão Oculto: acertou de primeira (raro) ou resolveu em menos de 5 s.',
  escala: 'Na Medida: média 95 ou mais (raro) ou as 5 rodadas em menos de 15 s.',
};

const VG_RESULTADO = { campeao: 'Campeão', vice: 'Vice', final: 'Vice', semi: 'Semifinal', quartas: 'Quartas', fase: 'Fase de pontos' };
function vgDetalhe(x) {
  if (x.jogo === 'cblol') return `${esc(VG_RESULTADO[x.resultado] || x.resultado || '—')} · ${num(x.vitorias)} ${x.vitorias === 1 ? 'vitória' : 'vitórias'}`;
  if (x.jogo === 'escala') return `média ${num(x.media)} · pior rodada ${num(x.pior_rodada)}${x.reinicios ? ` · ${num(x.reinicios)} reinício` : ''}`;
  return `${x.status === 'ganhou' ? 'Acertou' : x.status === 'perdeu' ? 'Errou' : esc(x.status || '—')} · ${num(x.chutes)} ${x.chutes === 1 ? 'chute' : 'chutes'}${x.dicas ? ` · ${num(x.dicas)} ${x.dicas === 1 ? 'dica' : 'dicas'}` : ''}`;
}

function vgTabela() {
  const q = vgFiltro.q.trim().toLowerCase();
  const lista = (vg?.partidas || []).map((x) => ({ ...x, sinais: sinaisVigia(x) }))
    .filter((x) => (!vgFiltro.so || x.sinais.length) && (!q || (x.username || '').toLowerCase().includes(q)));
  if (!lista.length) return `<p class="p-empty">${vgFiltro.so ? 'Nenhuma partida com sinais de suspeita no período.' : 'Nenhuma partida no período.'}</p>`;
  return `<div class="table-wrap"><table class="p-table">
    <thead><tr><th>Quando</th><th>Usuário</th><th>Jogo</th><th>Resultado</th><th class="n">PDR</th><th class="n">Duração</th><th>Sinais</th></tr></thead>
    <tbody>${lista.slice(0, 300).map((x) => `<tr>
      <td>${esc(dataHora(x.criado))}</td><td>${nickLink(x.username)}</td><td>${esc(NOME_JOGO(x.jogo))}</td>
      <td>${vgDetalhe(x)}</td><td class="n">${x.pdr > 0 ? '+' : ''}${num(x.pdr)}</td><td class="n">${duracao(x.duracao_s)}</td>
      <td>${x.sinais.map(([c, t]) => `<span class="rk-sinal rk-${c}">${t}</span>`).join(' ') || '<small>—</small>'}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

function vgJogadores() {
  const lista = resumoJogadores(vg?.partidas || []).filter((j) => j.comSinais).slice(0, 30);
  if (!lista.length) return '<p class="p-empty">Ninguém com sinais no período.</p>';
  return `<div class="table-wrap"><table class="p-table">
    <thead><tr><th>Usuário</th><th class="n">Dias com sinais</th><th class="n">Partidas com sinais</th><th class="n">Partidas</th><th>Onde</th><th></th></tr></thead>
    <tbody>${lista.map((j) => `<tr><td>${nickLink(j.nome)}</td><td class="n">${j.dias >= 3 ? `<b class="rk-alerta">${num(j.dias)}</b>` : num(j.dias)}</td>
      <td class="n">${num(j.comSinais)}</td><td class="n">${num(j.partidas)}</td>
      <td>${Object.entries(j.jogos).map(([g, n]) => `${esc(NOME_JOGO(g))} ×${n}`).join(', ')}</td>
      <td><button type="button" class="p-mini p-mini-danger" data-rk-banir="${esc(j.nome)}">Tirar da ranqueada</button></td></tr>`).join('')}</tbody>
  </table></div>`;
}

function secaoVigiaJogos(dias) {
  if (!vg) return `<div class="card"><p class="p-note">${esc(vgErro || 'Carregando…')}</p></div>`;
  const ps = vg.partidas || [];
  const susp = ps.filter((x) => sinaisVigia(x).length).length;
  return `<div class="tiles">
      ${tile('Partidas', num(ps.length), `últimos ${dias} dias`)}
      ${tile('Jogadores', num(new Set(ps.map((x) => x.username)).size))}
      ${tile('Com sinais de suspeita', num(susp), ps.length ? `${Math.round((susp / ps.length) * 100)}% das partidas` : '')}
    </div>
    <div class="card"><h3>Partidas</h3>
      <p class="c-sub">${Object.values(VG_TEXTO).join(' ')} Um sinal sozinho não prova nada: o que importa é <b>repetir em vários dias</b> (veja a tabela de jogadores abaixo).</p>
      <div class="ap-filtros">
        <label class="p-check"><input type="checkbox" data-vg-f="so"${vgFiltro.so ? ' checked' : ''} /> Só com sinais</label>
        <label class="p-label">Usuário <input type="search" data-vg-f="q" value="${esc(vgFiltro.q)}" autocomplete="off" /></label>
      </div>
      <div data-vg-lista>${vgTabela()}</div>
    </div>
    <div class="card"><h3>Jogadores com sinais</h3><p class="c-sub">Em dias diferentes, do que mais se repete para o que menos. Três dias ou mais ficam destacados.</p>
      <div data-vg-jog>${vgJogadores()}</div></div>`;
}

body.addEventListener('input', (e) => {
  const f = e.target.closest('[data-vg-f]');
  if (!f) return;
  const k = f.dataset.vgF;
  vgFiltro[k] = k === 'so' ? f.checked : f.value;
  body.querySelector('[data-vg-lista]').innerHTML = vgTabela();
});

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
      if (!window.confirm(`Anular esta partida ranqueada (${an.dataset.rkInfo})? Os PDR que ela deu são tirados.`)) return;
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
const AP_ORIGEM = { mercadopago: 'Mercado Pago', stripe: 'Stripe', manual: 'Registrado à mão' };
const AP_TIPO = { doacao: 'Doação', passe: 'Passe Premium', rc: 'Rift Coins' };
let es = []; // estornos ainda não verificados (platform.adminEstornos)
let esErro = '';
let apTipo = ''; // '' = tudo junto; 'doacao' ou 'passe' isola
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
  if (!lista.length) return '<p class="p-empty">Nenhum pagamento com esses filtros.</p>';
  const aprovadas = lista.filter((a) => a.status === 'aprovado');
  const soma = aprovadas.reduce((t, a) => t + Number(a.valor_pago ?? a.valor), 0);
  const vis = lista.slice(0, apFiltro.limite);
  return `<p class="p-note">${num(lista.length)} ${lista.length === 1 ? 'pagamento' : 'pagamentos'} · ${num(aprovadas.length)} aprovados somando <b>${reais(soma)}</b></p>
    <div class="table-wrap"><table class="p-table ap-tabela">
      <thead><tr><th>Quando</th><th>Usuário</th><th>Tipo</th><th class="n">Valor</th><th>Situação</th><th>Origem</th><th>Pagamento MP</th><th></th></tr></thead>
      <tbody>${vis.map((a) => `<tr>
        <td>${esc(dataHora(a.criado))}</td>
        <td>${a.username ? nickLink(a.username) : '<small>conta apagada</small>'}</td>
        <td>${esc(AP_TIPO[a.tipo] || 'Doação')}</td>
        <td class="n">${reais(a.valor_pago ?? a.valor)}</td>
        <td><span class="ap-st ap-${esc(a.status)}">${esc(AP_STATUS[a.status] || a.status)}</span></td>
        <td>${esc(AP_ORIGEM[a.origem] || a.origem)}</td>
        <td>${a.mp_payment_id ? `<small>${esc(a.mp_payment_id)}</small>` : '<small>—</small>'}</td>
        <td>${['pendente', 'recusado', 'cancelado'].includes(a.status) ? `<button type="button" class="p-btn p-btn-ghost" data-ap-del="${esc(a.tipo || 'doacao')}:${esc(a.id)}">Excluir</button>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
    ${lista.length > vis.length ? `<button type="button" class="p-btn p-btn-ghost" data-ap-mais>Mostrar mais (${num(lista.length - vis.length)} restantes)</button>` : ''}`;
}

// Aviso de estornos: o que a pessoa já aproveitou, para decidir entre banir ou cobrar de volta.
function detalheEstorno(x) {
  if (x.tipo === 'rc') {
    const gasto = Math.max(0, x.rc - Number(x.rc_retiradas || 0));
    return gasto > 0
      ? `Comprou ${num(x.rc)} RC; só ${num(x.rc_retiradas)} voltaram, então <b>${num(gasto)} RC já foram gastos</b> (saldo atual: ${num(x.saldo)} RC).`
      : `Comprou ${num(x.rc)} RC e todas voltaram ao ser estornado (saldo atual: ${num(x.saldo)} RC).`;
  }
  if (x.tipo === 'passe') {
    return x.resgates_premium > 0
      ? `<b>Já resgatou ${num(x.resgates_premium)} ${x.resgates_premium === 1 ? 'recompensa premium' : 'recompensas premium'}</b>; o Premium foi desligado, mas o que resgatou continua na conta.`
      : 'Ainda não tinha resgatado recompensa premium; o Premium foi desligado.';
  }
  return 'Doação estornada (o valor foi devolvido ao doador).';
}

function cardEstornos() {
  if (!es.length) return '';
  return `<section class="p-section p-estornos" id="estornos">
    <h2>⚠ Estornos para verificar</h2>
    <p class="p-note">Alguém pediu o dinheiro de volta. Veja se já usufruiu da compra e decida: banir o jogador ou pedir o valor de volta. Clique no nome para abrir a ficha (lá dá para banir). Depois, marque como verificado.</p>
    <div class="table-wrap"><table class="p-table">
      <thead><tr><th>Quando</th><th>Usuário</th><th>Tipo</th><th class="n">Valor</th><th>Situação</th><th></th></tr></thead>
      <tbody>${es.map((x) => `<tr>
        <td>${esc(dataHora(x.quando))}</td>
        <td>${x.username ? nickLink(x.username) : '<small>conta apagada</small>'}</td>
        <td>${esc(AP_TIPO[x.tipo] || x.tipo)} <small>${esc(AP_ORIGEM[x.provedor] || x.provedor || '')}</small></td>
        <td class="n">${reais(x.valor)}</td>
        <td>${detalheEstorno(x)}</td>
        <td><button type="button" class="p-btn p-btn-ghost" data-es-visto="${esc(x.tipo)}:${esc(x.id)}">Marcar como verificado</button></td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

function secaoApoio(dias) {
  const registrar = `<div class="card">
      <h3>Registrar apoio feito por fora</h3>
      <p class="c-sub">Para quem apoiou sem passar pela página (ex.: Pix direto para você). O valor soma no total da conta e libera o efeito no nick.</p>
      <label class="p-label">Nome de usuário: <input data-apoio-nome autocomplete="off" /></label>
      <label class="p-label">Valor (R$): <input type="number" min="1" step="0.01" data-apoio-valor /></label>
      <button type="button" class="p-btn" data-apoio-registrar>Registrar apoio</button>
      <p class="p-note" data-apoio-msg role="status"></p>
    </div>
    <div class="card">
      <h3>Conceder Passe de Batalha Premium</h3>
      <p class="c-sub">Libera o Passe Premium (Halloween 2026) para um jogador, sem cobrança: não entra nos totais de arrecadação. Dá para remover depois.</p>
      <label class="p-label">Nome de usuário: <input data-premium-nome autocomplete="off" /></label>
      <button type="button" class="p-btn" data-premium-dar="1">Conceder Premium</button>
      <button type="button" class="p-btn p-btn-ghost" data-premium-dar="0">Remover Premium</button>
      <p class="p-note" data-premium-msg role="status"></p>
    </div>`;
  if (!ap) {
    return `${cardEstornos()}<section class="p-section"><h2>Apoio</h2>
      <p class="p-note">${esc(apErro || 'Carregando os pagamentos…')}</p>${registrar}</section>`;
  }
  const t = ap.total;
  const p = ap.periodo;
  const porDia = columns(ap.por_dia || [], 'valor', 'arrecadados', reais);
  const st = Object.entries(p.status || {}).map(([k, n]) => [k, n]);
  const opt = (obj, atual) => Object.entries(obj).map(([k, v]) => `<option value="${k}"${atual === k ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const pt = ap.por_tipo?.total || {};
  const resumoTipos = ['doacao', 'passe', 'rc'].map((k) => `${AP_TIPO[k]}: <b>${reais(pt[k]?.arrecadado || 0)}</b> (${num(pt[k]?.n || 0)})`).join(' · ');
  const filtroTipo = `<div class="ap-filtros"><label class="p-label">Mostrar <select data-ap-tipo><option value="">Tudo junto</option>${opt(AP_TIPO, apTipo)}</select></label></div>
    <p class="p-note">Desde sempre — ${resumoTipos}. Doações, Passe Premium e Rift Coins entram no mesmo total; use o filtro para ver um só.</p>`;
  return `${cardEstornos()}<section class="p-section" id="apoio">
    <h2>Apoio · desde sempre</h2>
    ${filtroTipo}
    <div class="tiles">
      ${tile('Arrecadado', reais(t.arrecadado), 'pagamentos aprovados')}
      ${tile(apTipo === 'passe' ? 'Compras' : apTipo === 'doacao' ? 'Doações' : 'Pagamentos', num(t.doacoes), `${num(t.apoiadores)} ${t.apoiadores === 1 ? 'apoiador' : 'apoiadores'}`)}
      ${tile('Ticket médio', reais(t.ticket_medio), 'por pagamento')}
      ${tile('Maior pagamento', reais(t.maior))}
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
    <p class="p-note">Valores brutos, antes das taxas (Stripe em dólar entra convertido para reais). Um pagamento conta no dia em que foi criada.</p>
    <div class="cards">
      <div class="card"><h3>Arrecadado por dia</h3><p class="c-sub">${reais(porDia.total)} no período</p>${porDia.html}</div>
      <div class="card"><h3>Situação das tentativas</h3><p class="c-sub">Quem clicou em apoiar, no período</p>${hbars(st, (k) => AP_STATUS[k] || k)}</div>
      <div class="card"><h3>Faixas de valor</h3><p class="c-sub">Pagamentos aprovados no período</p>${hbars((p.faixas || []).map((f) => [f.faixa, f.n]), undefined, { sort: false })}</div>
      <div class="card"><h3>Origem</h3><p class="c-sub">Valor aprovado no período</p>${hbars(Object.entries(p.origem || {}), (k) => AP_ORIGEM[k] || k, { fmt: reais })}</div>
    </div>
    <div class="card"><h3>Quem mais apoiou</h3><p class="c-sub">Desde sempre, só doações aprovadas</p>
      ${(ap.top || []).length ? `<div class="table-wrap"><table class="p-table">
        <thead><tr><th>#</th><th>Usuário</th><th class="n">Total</th><th class="n">Doações</th><th>Desde</th><th>Última</th></tr></thead>
        <tbody>${ap.top.map((x, i) => `<tr><td>${i + 1}</td><td>${nickLink(x.username)}</td><td class="n">${reais(x.total)}</td><td class="n">${num(x.doacoes)}</td><td>${esc(dataCurta(x.desde))}</td><td>${esc(dataCurta(x.ultima))}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="p-empty">Ninguém apoiou ainda.</p>'}
    </div>
    <div class="card"><h3>Pagamentos dos últimos ${dias} dias</h3><p class="c-sub">Todas as tentativas, inclusive as não pagas. Filtre e baixe em planilha.</p>
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
  const linhas = [['quando', 'usuario', 'tipo', 'valor', 'situacao', 'origem', 'pagamento_mp']];
  for (const a of apFiltrados()) {
    linhas.push([dataHora(a.criado), a.username || '', AP_TIPO[a.tipo] || 'Doação', Number(a.valor_pago ?? a.valor).toFixed(2).replace('.', ','),
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

body.addEventListener('change', (e) => {
  const t = e.target.closest('[data-ap-tipo]');
  if (!t) return;
  apTipo = t.value;
  load();
});
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
  const visto = e.target.closest('[data-es-visto]');
  if (visto) {
    const [tipo, id] = visto.dataset.esVisto.split(':');
    visto.disabled = true;
    platform.adminEstornoVisto(tipo, id).then(load, (err) => { visto.disabled = false; window.alert(err.message); });
  }
  const del = e.target.closest('[data-ap-del]');
  if (del) {
    const [tipo, id] = del.dataset.apDel.split(':');
    if (!window.confirm('Excluir este pagamento não concluído? Não dá para desfazer.')) return;
    del.disabled = true;
    platform.adminApoioExcluir(tipo, id).then(load, (err) => { del.disabled = false; window.alert(err.message); });
  }
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
    const [st, apoios, ranked, estornos, resumo, vigia, codigos, modelos] = await Promise.all([
      platform.adminStats(days), opcional(platform.adminApoios(days, apTipo || null)), opcional(platform.adminRanked(days)), opcional(platform.adminEstornos()),
      opcional(platform.adminRanqueada(days)), opcional(platform.adminVigia(Math.min(days, 90))), opcional(platform.adminCodigos()), opcional(platform.adminModelos()),
    ]);
    if (seq !== loadSeq) return;
    rk = ranked.r || null;
    rkErro = ranked.err?.message || '';
    ap = apoios.r || null;
    es = estornos.r || [];
    esErro = estornos.err?.message || '';
    apErro = apoios.err?.message || '';
    rq = resumo.r || null;
    rqErro = resumo.err?.message || '';
    vg = vigia.r || null;
    vgErro = vigia.err?.message || '';
    cd = codigos.r || null;
    cdErro = codigos.err?.message || '';
    cdModelos = modelos.r || [];
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
  const pb = e.target.closest('[data-premium-dar]');
  if (pb) {
    const nome = body.querySelector('[data-premium-nome]').value.trim();
    const msg = body.querySelector('[data-premium-msg]');
    const dar = pb.dataset.premiumDar === '1';
    if (!nome) { msg.textContent = 'Digite o nome de usuário.'; return; }
    if (!window.confirm(`${dar ? 'Conceder' : 'Remover'} o Passe Premium ${dar ? 'para' : 'de'} ${nome}?`)) return;
    pb.disabled = true;
    try {
      const r = await platform.adminPasse(nome, 'premium', dar ? 1 : 0);
      msg.textContent = `Pronto! ${nome} ${r.premium ? 'agora tem' : 'não tem mais'} o Passe Premium.`;
    } catch (err) {
      msg.textContent = err.message;
    }
    pb.disabled = false;
    return;
  }
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
  if (aba === 'teste') { ps = null; psErro = ''; } // relê o passe ao abrir a aba
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

// ------------------------------------------------- códigos de recompensa (admin)

const CD_STATUS = { ativo: 'Ativo', esgotado: 'Esgotado', expirado: 'Expirado', desativado: 'Desativado' };
const recTxt = (r) => `${tipoTexto(r.tipo)}: ${nomeRecompensa(r.tipo, r.chave)}`;

function cdTabela() {
  if (!cd) return `<p class="p-note">${esc(cdErro || 'Carregando…')}</p>`;
  if (!cd.length) return '<p class="p-empty">Nenhum código criado ainda.</p>';
  return `<div class="table-wrap"><table class="p-table">
    <thead><tr><th>Código</th><th>Recompensas</th><th class="n">Usos</th><th>Validade</th><th>Situação</th><th>Nota</th><th></th></tr></thead>
    <tbody>${cd.map((c) => `<tr>
      <td><b class="cd-codigo-mini">${esc(codigoBonito(c.codigo))}</b></td>
      <td>${c.recompensas.map((r) => esc(recTxt(r))).join('<br>')}</td>
      <td class="n">${num(c.usos)} / ${c.usos_max == null ? '∞' : num(c.usos_max)}</td>
      <td>${c.expira_em ? esc(dataHora(c.expira_em)) : 'sem validade'}</td>
      <td><span class="ap-st ap-${c.status === 'ativo' ? 'aprovado' : 'cancelado'}">${esc(CD_STATUS[c.status] || c.status)}</span></td>
      <td><small>${esc(c.nota || '')}</small></td>
      <td><button type="button" class="p-mini" data-cd-copiar="${esc(c.codigo)}">Copiar</button>
        <button type="button" class="p-mini" data-cd-resgates="${esc(c.id)}">Quem resgatou</button>
        <button type="button" class="p-mini ${c.ativo ? 'p-mini-danger' : ''}" data-cd-ativar="${esc(c.id)}" data-valor="${c.ativo ? '0' : '1'}">${c.ativo ? 'Desativar' : 'Reativar'}</button></td>
      </tr>${cdAbertos.has(c.id) ? `<tr><td colspan="7"><small>${cdAbertos.get(c.id).length
    ? cdAbertos.get(c.id).map((x) => `${nickLink(x.username)} (${esc(dataHora(x.resgatado))})`).join(' · ')
    : 'Ninguém resgatou ainda.'}</small></td></tr>` : ''}`).join('')}</tbody>
  </table></div>`;
}

const CD_LINHAS = 5;
const cdModeloOpcoes = (sel = '') => `<option value="">— escolher para preencher —</option>${cdModelos.map((m) => `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(m.nome)} (${m.recompensas.length} ${m.recompensas.length === 1 ? 'item' : 'itens'})</option>`).join('')}`;

function secaoCodigos() {
  const linha = (i) => `<div class="cd-rec"><select data-cd-tipo="${i}" aria-label="Tipo da recompensa ${i + 1}"><option value="icone">Ícone</option><option value="efeito">Efeito no nome</option><option value="moeda">Rift Coins</option></select>
    <input data-cd-chave="${i}" placeholder="${i === 0 ? 'ex.: exc-lenda (ou 250 para Rift Coins)' : 'outra recompensa (opcional)'}" autocomplete="off" spellcheck="false" aria-label="Id da recompensa ${i + 1}" /></div>`;
  return `<div class="card"><h3>Códigos de recompensa</h3>
    <p class="c-sub">O jogador resgata em <b>Meu perfil</b> → "Resgatar código". Cada conta usa o mesmo código uma vez. O id de ícone precisa começar com <code>exc-</code> (a arte entra no site). Em <b>Rift Coins</b>, escreva a quantidade (ex.: <code>250</code>). Para recompensa valiosa, deixe o código ser <b>gerado</b>: os escolhidos à mão são fáceis de adivinhar.</p>
    <form data-cd-form class="cd-form" novalidate>
      <div class="cd-modelos">
        <label class="p-label">Modelo salvo <select data-cd-modelo>${cdModeloOpcoes()}</select></label>
        <button type="button" class="p-mini" data-cd-modelo-salvar>Salvar como modelo</button>
        <button type="button" class="p-mini p-mini-danger" data-cd-modelo-apagar>Apagar modelo</button>
      </div>
      ${Array.from({ length: CD_LINHAS }, (_, i) => linha(i)).join('')}
      <div class="ap-filtros">
        <label class="p-label">Código (vazio = gerar) <input data-cd-codigo autocomplete="off" spellcheck="false" maxlength="40" /></label>
        <label class="p-label">Usos máximos (vazio = ilimitado) <input type="number" min="1" step="1" data-cd-usos /></label>
        <label class="p-label">Vale até (vazio = sem validade) <input type="date" data-cd-validade /></label>
        <label class="p-label">Nota (só você vê) <input data-cd-nota maxlength="200" autocomplete="off" /></label>
        <button type="submit" class="p-btn">Criar código</button>
      </div>
      <p class="p-note" data-cd-msg role="status"></p>
    </form>
    ${cdNovo ? `<div class="cd-novo" role="status">Código criado: <b class="cd-codigo">${esc(codigoBonito(cdNovo.codigo))}</b>
      <button type="button" class="p-mini" data-cd-copiar="${esc(cdNovo.codigo)}">Copiar</button></div>` : ''}
    <div data-cd-lista>${cdTabela()}</div>
  </div>`;
}

async function cdAtualizar() {
  try { cd = await platform.adminCodigos(); cdErro = ''; } catch (err) { cdErro = err.message; }
  if (ultimo) render(ultimo);
}

body.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-cd-form]');
  if (!f) return;
  e.preventDefault();
  const msg = f.querySelector('[data-cd-msg]');
  const recompensas = Array.from({ length: CD_LINHAS }, (_, i) => i).map((i) => ({ tipo: f.querySelector(`[data-cd-tipo="${i}"]`).value, chave: f.querySelector(`[data-cd-chave="${i}"]`).value.trim().toLowerCase() }))
    .filter((r) => r.chave);
  if (!recompensas.length) { msg.textContent = 'Escreva pelo menos uma recompensa.'; return; }
  const validade = f.querySelector('[data-cd-validade]').value;
  const botao = f.querySelector('button[type="submit"]');
  botao.disabled = true;
  try {
    cdNovo = await platform.adminCodigoCriar({
      recompensas,
      codigo: f.querySelector('[data-cd-codigo]').value.trim() || null,
      usosMax: Number(f.querySelector('[data-cd-usos]').value) || null,
      expiraEm: validade ? new Date(`${validade}T23:59:59`).toISOString() : null,
      nota: f.querySelector('[data-cd-nota]').value.trim() || null,
    });
    await cdAtualizar();
  } catch (err) {
    msg.textContent = err.message;
    botao.disabled = false;
  }
});
// Lê as linhas de recompensa do formulário.
function cdLinhas(f) {
  return Array.from({ length: CD_LINHAS }, (_, i) => ({ tipo: f.querySelector(`[data-cd-tipo="${i}"]`).value, chave: f.querySelector(`[data-cd-chave="${i}"]`).value.trim().toLowerCase() }))
    .filter((r) => r.chave);
}
// Escolher um modelo preenche as linhas.
body.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-cd-modelo]');
  if (!sel) return;
  const f = sel.closest('[data-cd-form]');
  const m = cdModelos.find((x) => x.id === sel.value);
  for (let i = 0; i < CD_LINHAS; i += 1) {
    const r = m?.recompensas[i];
    f.querySelector(`[data-cd-tipo="${i}"]`).value = r?.tipo || 'icone';
    f.querySelector(`[data-cd-chave="${i}"]`).value = r?.chave || '';
  }
  f.querySelector('[data-cd-msg]').textContent = '';
});
body.addEventListener('click', async (e) => {
  const salvar = e.target.closest('[data-cd-modelo-salvar]');
  const apagar = e.target.closest('[data-cd-modelo-apagar]');
  if (!salvar && !apagar) return;
  const f = e.target.closest('[data-cd-form]');
  const sel = f.querySelector('[data-cd-modelo]');
  const msg = f.querySelector('[data-cd-msg]');
  try {
    if (salvar) {
      const recompensas = cdLinhas(f);
      if (!recompensas.length) { msg.textContent = 'Preencha as recompensas que o modelo deve ter.'; return; }
      const atual = cdModelos.find((x) => x.id === sel.value);
      const nome = window.prompt('Nome do modelo (se já existir, é atualizado):', atual?.nome || '');
      if (!nome || !nome.trim()) return;
      const m = await platform.adminModeloSalvar(nome.trim(), recompensas);
      cdModelos = await platform.adminModelos();
      sel.innerHTML = cdModeloOpcoes(m.id);
      msg.textContent = `Modelo "${m.nome}" salvo.`;
    } else {
      const m = cdModelos.find((x) => x.id === sel.value);
      if (!m) { msg.textContent = 'Escolha primeiro o modelo que quer apagar.'; return; }
      if (!window.confirm(`Apagar o modelo "${m.nome}"? Os códigos já criados não mudam.`)) return;
      await platform.adminModeloApagar(m.id);
      cdModelos = await platform.adminModelos();
      sel.innerHTML = cdModeloOpcoes();
      msg.textContent = `Modelo "${m.nome}" apagado.`;
    }
  } catch (err) {
    msg.textContent = err.message;
  }
});
body.addEventListener('click', async (e) => {
  const copiar = e.target.closest('[data-cd-copiar]');
  const ativar = e.target.closest('[data-cd-ativar]');
  const quem = e.target.closest('[data-cd-resgates]');
  try {
    if (copiar) {
      await navigator.clipboard.writeText(codigoBonito(copiar.dataset.cdCopiar));
      copiar.textContent = 'Copiado!';
    } else if (ativar) {
      const desativar = ativar.dataset.valor === '0';
      if (desativar && !window.confirm('Desativar este código? Ninguém mais consegue resgatar (quem já resgatou continua com a recompensa).')) return;
      ativar.disabled = true;
      await platform.adminCodigoAtivar(ativar.dataset.cdAtivar, !desativar);
      await cdAtualizar();
    } else if (quem) {
      const id = quem.dataset.cdResgates;
      if (cdAbertos.has(id)) cdAbertos.delete(id);
      else cdAbertos.set(id, await platform.adminCodigoResgates(id));
      if (ultimo) render(ultimo);
    }
  } catch (err) {
    window.alert(err.message);
    ativar && (ativar.disabled = false);
  }
});

// -------------------------------------------------------- aba: ficha do jogador

let jg = null; // platform.adminJogador(nome): ficha ou { encontrado: false, sugestoes }
let jgErro = '';
let jgBusca = '';
let jgCarregando = false;
let jgRec = null; // recompensas e códigos resgatados do jogador da ficha
let jgRecErro = '';
let jgMoedas = null; // saldo e extrato de Rift Coins do jogador da ficha
let jgMoedasErro = '';

const nickLink = (n) => `<button type="button" class="p-link" data-jogador="${esc(n)}">${esc(n)}</button>`;
const MOTIVOS = { partida: 'partida', melhora: 'resultado melhor', nao_terminou: 'começou e não terminou', inatividade: 'inatividade', admin: 'ajuste do administrador' };
const quando = (iso) => (iso ? esc(dataHora(iso)) : '—');
const vazio = (txt) => `<p class="p-empty">${txt}</p>`;

async function buscarJogador(nome) {
  jgBusca = nome;
  jgErro = '';
  jgCarregando = true;
  if (aba === 'jogador' && ultimo) render(ultimo);
  try {
    jg = await platform.adminJogador(nome);
    jgRec = null;
    jgRecErro = '';
    jgMoedas = null;
    jgMoedasErro = '';
    if (jg?.encontrado) {
      try { jgMoedas = await platform.adminMoedasJogador(jg.conta.username); } catch (err) { jgMoedasErro = err.message; }
      try { jgRec = await platform.adminRecompensasJogador(jg.conta.username); } catch (err) { jgRecErro = err.message; }
    }
  } catch (err) {
    jg = null;
    jgErro = err.message;
  }
  jgCarregando = false;
  if (aba === 'jogador' && ultimo) render(ultimo);
}

function jgPartidas(j) {
  const ps = (j.partidas || []).map((x) => ({ ...x, sinais: sinaisVigia(x) }));
  if (!ps.length) return vazio('Nenhuma partida ranqueada nos últimos 30 dias.');
  const detalhe = (x) => (x.jogo === 'carreira-no-rift' ? `nota ${num(x.score)}${x.ovr != null ? ` · OVR ${num(x.ovr)}` : ''}` : vgDetalhe(x));
  return `<div class="table-wrap"><table class="p-table">
    <thead><tr><th>Quando</th><th>Jogo</th><th>Resultado</th><th class="n">PDR</th><th class="n">Duração</th><th>Sinais</th></tr></thead>
    <tbody>${ps.map((x) => `<tr><td>${quando(x.criado)}</td><td>${esc(NOME_JOGO(x.jogo))}${x.n > 1 || x.jogo === 'carreira-no-rift' || x.jogo === 'cblol' ? ` <small>#${num(x.n)}</small>` : ''}</td>
      <td>${detalhe(x)}</td><td class="n">${x.pdr > 0 ? '+' : ''}${num(x.pdr)}</td><td class="n">${duracao(x.duracao_s)}</td>
      <td>${x.sinais.map(([c, t]) => `<span class="rk-sinal rk-${c}">${t}</span>`).join(' ') || '<small>—</small>'}</td></tr>`).join('')}</tbody></table></div>`;
}

const MOTIVO_MOEDA = { codigo: 'código', admin: 'ajuste do administrador', passe: 'passe de batalha', compra: 'compra na loja' };
function jgMoedasHtml(nome) {
  if (jgMoedasErro) return `<p class="p-note">${esc(jgMoedasErro)}</p>`;
  if (!jgMoedas) return '<p class="p-note">Carregando…</p>';
  const ext = jgMoedas.extrato.length ? `<div class="table-wrap"><table class="p-table">
      <thead><tr><th>Quando</th><th>Motivo</th><th class="n">Mudança</th><th class="n">Saldo</th></tr></thead>
      <tbody>${jgMoedas.extrato.map((l) => `<tr><td>${quando(l.criado)}</td><td>${esc(MOTIVO_MOEDA[l.motivo] || l.motivo)}${l.ref ? ` <small>(${esc(l.ref)})</small>` : ''}</td><td class="n">${l.delta > 0 ? '+' : ''}${num(l.delta)}</td><td class="n">${num(l.saldo)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="p-empty">Nenhuma movimentação ainda.</p>';
  return `<p class="c-sub">Saldo: <b>${num(jgMoedas.saldo)} RC</b></p>
    <form class="ap-filtros" data-jg-moedas data-nome="${esc(nome)}" novalidate>
      <label class="p-label">Quantidade (use negativo para tirar) <input type="number" step="1" data-jg-moedas-qtd placeholder="ex.: 100 ou -50" /></label>
      <label class="p-label">Nota (opcional) <input data-jg-moedas-nota maxlength="200" autocomplete="off" placeholder="ex.: prêmio do torneio" /></label>
      <button type="submit" class="p-mini">Aplicar</button>
    </form><p class="p-note" data-jg-moedas-msg role="status"></p>${ext}`;
}

function jgRecHtml(nome) {
  if (jgRecErro) return `<p class="p-note">${esc(jgRecErro)}</p>`;
  if (!jgRec) return '<p class="p-note">Carregando…</p>';
  const rec = jgRec.recompensas.length ? `<ul class="cd-lista">${jgRec.recompensas.map((r) => `<li>${esc(recTxt(r))} <small>(${r.origem === 'admin' ? 'dada por você' : 'código'} · ${esc(dataHora(r.criado))})</small>
      <button type="button" class="p-mini p-mini-danger" data-jg-rec-tirar="${esc(r.tipo)}|${esc(r.chave)}" data-nome="${esc(nome)}">Tirar</button></li>`).join('')}</ul>` : '<p class="p-empty">Nenhuma recompensa ainda.</p>';
  const cods = jgRec.codigos.length ? `<p class="c-sub">Códigos resgatados: ${jgRec.codigos.map((x) => `<b>${esc(codigoBonito(x.codigo))}</b> (${esc(dataHora(x.resgatado))}${x.nota ? ` · ${esc(x.nota)}` : ''})`).join(' · ')}</p>` : '';
  return `${rec}${cods}
    <form class="ap-filtros" data-jg-rec-dar data-nome="${esc(nome)}" novalidate>
      <label class="p-label">Dar uma recompensa <select data-jg-rec-tipo><option value="icone">Ícone</option><option value="efeito">Efeito no nome</option></select></label>
      <label class="p-label">Id <input data-jg-rec-chave placeholder="exc-lenda" autocomplete="off" spellcheck="false" /></label>
      <button type="submit" class="p-mini">Dar</button>
    </form><p class="p-note" data-jg-rec-msg role="status"></p>`;
}

function jgFicha(j) {
  const c = j.conta;
  const r = j.ranqueada;
  const sinaisN = (j.partidas || []).filter((x) => sinaisVigia(x).length).length;
  const jogadas = Object.values(j.jogos || {}).reduce((t, x) => t + (x.partidas || 0), 0);
  const doado = (j.apoios || []).filter((a) => a.status === 'aprovado').reduce((t, a) => t + Number(a.valor_pago ?? a.valor), 0);
  const etiquetas = [
    c.admin ? '<span class="p-badge">Administrador</span>' : '',
    c.apoio_total > 0 ? `<span class="p-badge">Apoiador · ${reais(c.apoio_total)}</span>` : '',
    j.banido ? `<span class="rk-sinal rk-naobate">Fora da ranqueada${j.banido.motivo ? `: ${esc(j.banido.motivo)}` : ''}</span>` : '',
  ].filter(Boolean).join(' ');
  const entrada = (c.login || []).filter(Boolean).map((x) => ({ google: 'Google', email: 'E-mail e senha' }[x] || x)).join(', ') || '—';
  return `
  <section class="p-section">
    <h2>${esc(c.username)} ${etiquetas}</h2>
    <div class="tiles">
      ${tile('Ranqueada', r ? esc(ELO_NOMES[r.elo] || r.elo) : 'Sem partidas', r ? `${num(r.pts)} pontos` : 'nunca jogou a ranqueada')}
      ${tile('Partidas jogadas', num(jogadas), 'todos os jogos, desde sempre')}
      ${tile('Ranqueadas (30 dias)', num((j.partidas || []).length), `${num(sinaisN)} com sinais de suspeita`)}
      ${tile('Apoio', reais(doado), `${num((j.apoios || []).length)} ${(j.apoios || []).length === 1 ? 'doação' : 'doações'}`)}
    </div>
    <div class="card"><h3>Conta</h3>
      <div class="table-wrap"><table class="p-table"><tbody>
        <tr><th>E-mail</th><td>${esc(c.email || '—')}</td></tr>
        <tr><th>Entra com</th><td>${esc(entrada)}</td></tr>
        <tr><th>Conta criada</th><td>${quando(c.criada)}</td></tr>
        <tr><th>Último acesso</th><td>${quando(c.ultimo_acesso)}</td></tr>
        <tr><th>Último nick trocado</th><td>${quando(c.nick_trocado_em)}</td></tr>
        <tr><th>Ícone</th><td>${esc(c.avatar || 'padrão')}</td></tr>
        <tr><th>Atividade</th><td>${num(j.atividade?.eventos)} eventos em ${num(j.atividade?.aparelhos)} ${j.atividade?.aparelhos === 1 ? 'aparelho' : 'aparelhos'}${j.atividade?.primeiro ? ` · de ${quando(j.atividade.primeiro)} até ${quando(j.atividade.ultimo)}` : ''}</td></tr>
      </tbody></table></div>
    </div>
  </section>
  <section class="p-section"><h2>Ranqueada</h2>
    <div class="card">
      <p class="c-sub">${r ? `${esc(ELO_NOMES[r.elo] || r.elo)} · ${num(r.pts)} pontos · última atividade ${r.ultima_atividade ? esc(dia(r.ultima_atividade)) : '—'} · começou em ${quando(r.desde)}` : 'Ainda não jogou a ranqueada.'}
        Vagas de hoje: Carreira <b>${num(j.vagas_hoje?.['carreira-no-rift'] || 0)}</b> · Lendas <b>${num(j.vagas_hoje?.cblol || 0)}</b>.</p>
      <div class="ap-filtros">
        <label class="p-label">Dar ou tirar PDR <input type="number" step="1" data-jg-delta placeholder="25 ou -25" style="width: 140px" /></label>
        <button type="button" class="p-mini" data-jg-ajustar="${esc(c.username)}">Aplicar</button>
        ${j.banido
    ? `<button type="button" class="p-mini" data-rk-devolver="${esc(c.username)}">Devolver à ranqueada</button>`
    : `<button type="button" class="p-mini p-mini-danger" data-rk-banir="${esc(c.username)}">Tirar da ranqueada</button>`}
      </div>
      <p class="p-note" data-jg-msg role="status"></p>
    </div>
    <div class="card"><h3>Partidas ranqueadas · últimos 30 dias</h3>${jgPartidas(j)}</div>
    <div class="card"><h3>Histórico de PDR</h3>${(j.historico || []).length ? `<div class="table-wrap"><table class="p-table">
      <thead><tr><th>Quando</th><th>Jogo</th><th>Motivo</th><th class="n">PDR</th><th class="n">Pontos</th></tr></thead>
      <tbody>${j.historico.map((h) => `<tr><td>${quando(h.criado)}</td><td>${h.jogo ? esc(NOME_JOGO(h.jogo)) : '—'}</td><td>${esc(MOTIVOS[h.motivo] || h.motivo)}</td>
        <td class="n">${h.delta > 0 ? '+' : ''}${num(h.delta)}</td><td class="n">${num(h.antes)} → ${num(h.depois)}</td></tr>`).join('')}</tbody></table></div>` : vazio('Sem movimentos de PDR.')}</div>
  </section>
  <section class="p-section"><h2>Partidas e jogos</h2>
    <div class="card"><h3>Por jogo</h3>${Object.keys(j.jogos || {}).length ? `<div class="table-wrap"><table class="p-table">
      <thead><tr><th>Jogo</th><th class="n">Partidas</th><th class="n">Melhor nota</th><th>Última</th></tr></thead>
      <tbody>${Object.entries(j.jogos).map(([g, x]) => `<tr><td>${esc(NOME_JOGO(g))}</td><td class="n">${num(x.partidas)}</td><td class="n">${num(x.melhor)}</td><td>${quando(x.ultima)}</td></tr>`).join('')}</tbody></table></div>` : vazio('Nenhuma partida registrada.')}</div>
    <div class="card"><h3>Últimas partidas</h3>${(j.ultimas || []).length ? `<div class="table-wrap"><table class="p-table">
      <thead><tr><th>Quando</th><th>Jogo</th><th class="n">Nota</th><th>Resumo</th><th></th></tr></thead>
      <tbody>${j.ultimas.map((x) => `<tr><td>${quando(x.quando)}</td><td>${esc(NOME_JOGO(x.jogo))}</td><td class="n">${num(x.nota)}</td><td>${esc(x.texto || '—')}</td><td>${x.ranqueada ? '<small>ranqueada</small>' : ''}</td></tr>`).join('')}</tbody></table></div>` : vazio('Sem partidas.')}</div>
    <div class="card"><h3>Runetermo, Campeão Oculto e Na Medida · 14 dias</h3>${(j.diarios || []).length || (j.escala || []).length ? `<div class="table-wrap"><table class="p-table">
      <thead><tr><th>Dia</th><th>Jogo</th><th>Resultado</th><th class="n">PDR</th></tr></thead>
      <tbody>${[...(j.diarios || []).map((x) => ({ dia: x.dia, jogo: x.jogo, txt: `${x.status === 'ganhou' ? 'Acertou' : x.status === 'perdeu' ? 'Errou' : esc(x.status)} · ${num(x.chutes)} ${x.chutes === 1 ? 'chute' : 'chutes'}${x.dicas ? ` · ${num(x.dicas)} ${x.dicas === 1 ? 'dica' : 'dicas'}` : ''}`, pdr: x.pdr })),
        ...(j.escala || []).map((x) => ({ dia: x.dia, jogo: 'escala', txt: `${x.status === 'terminou' ? `média ${num(x.media)}` : 'em andamento'}${x.reinicios ? ` · ${num(x.reinicios)} reinício` : ''}`, pdr: x.pdr }))]
    .sort((a, b) => String(b.dia).localeCompare(String(a.dia)))
    .map((x) => `<tr><td>${esc(dia(x.dia))}</td><td>${esc(NOME_JOGO(x.jogo))}</td><td>${x.txt}</td><td class="n">${x.pdr == null ? '—' : `${x.pdr > 0 ? '+' : ''}${num(x.pdr)}`}</td></tr>`).join('')}</tbody></table></div>` : vazio('Nada nos últimos 14 dias.')}</div>
  </section>
  <section class="p-section"><h2>Doações, atividade e progresso salvo</h2>
    <div class="card"><h3>Doações</h3>${(j.apoios || []).length ? `<div class="table-wrap"><table class="p-table">
      <thead><tr><th>Quando</th><th class="n">Valor</th><th>Situação</th><th>Origem</th></tr></thead>
      <tbody>${j.apoios.map((a) => `<tr><td>${quando(a.criado)}</td><td class="n">${reais(a.valor_pago ?? a.valor)}</td><td>${esc(AP_STATUS[a.status] || a.status)}</td><td>${esc(AP_ORIGEM[a.origem] || a.origem)}</td></tr>`).join('')}</tbody></table></div>` : vazio('Nenhuma doação.')}</div>
    <div class="card"><h3>Atividade recente</h3>${(j.atividade?.recentes || []).length ? `<div class="table-wrap"><table class="p-table">
      <thead><tr><th>Quando</th><th>O que</th><th>Jogo</th></tr></thead>
      <tbody>${j.atividade.recentes.map((v) => `<tr><td>${quando(v.quando)}</td><td>${esc({ visit: 'visitou o site', game_start: 'começou uma partida', game_end: 'terminou uma partida' }[v.tipo] || v.tipo)}</td><td>${v.jogo ? esc(NOME_JOGO(v.jogo)) : '—'}</td></tr>`).join('')}</tbody></table></div>` : vazio('Sem atividade registrada.')}</div>
    <div class="card"><h3>Rift Coins</h3>${jgMoedasHtml(c.username)}</div>
    <div class="card"><h3>Recompensas e códigos</h3>${jgRecHtml(c.username)}</div>
    <div class="card"><h3>Progresso salvo na nuvem</h3>${(j.saves || []).length ? `<div class="table-wrap"><table class="p-table">
      <thead><tr><th>Jogo</th><th>Atualizado</th><th class="n">Tamanho</th></tr></thead>
      <tbody>${j.saves.map((s) => `<tr><td>${esc(NOME_JOGO(s.jogo))}</td><td>${quando(s.atualizado)}</td><td class="n">${num(Math.round(s.bytes / 100) / 10)} KB</td></tr>`).join('')}</tbody></table></div>` : vazio('Nenhum jogo salvo na nuvem.')}</div>
  </section>`;
}

function abaJogador() {
  const sug = jg && jg.encontrado === false ? `<div class="card"><p class="c-sub">Nenhum jogador com o nick <b>${esc(jgBusca)}</b>.${(jg.sugestoes || []).length ? ' Quem sabe um destes:' : ''}</p>
    ${(jg.sugestoes || []).length ? `<p>${jg.sugestoes.map(nickLink).join(' · ')}</p>` : ''}</div>` : '';
  return `<section class="p-section">
    <h2>Ficha do jogador</h2>
    <div class="card">
      <p class="c-sub">Digite o nick (não precisa ser exato nas maiúsculas) para ver tudo sobre a conta: ranqueada, partidas, doações, atividade e progresso salvo. Também dá para clicar num nick nas tabelas de vigilância.</p>
      <form class="ap-filtros" data-jg-form>
        <label class="p-label">Nick <input type="search" data-jg-nome value="${esc(jgBusca)}" autocomplete="off" /></label>
        <button type="submit" class="p-btn"${jgCarregando ? ' disabled' : ''}>${jgCarregando ? 'Buscando…' : 'Buscar'}</button>
      </form>
      ${jgErro ? `<p class="p-note">${esc(jgErro)}</p>` : ''}
    </div>
    ${sug}
  </section>${jg?.encontrado ? jgFicha(jg) : ''}`;
}

body.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-jg-form]');
  if (!f) return;
  e.preventDefault();
  const nome = f.querySelector('[data-jg-nome]').value.trim();
  if (nome) buscarJogador(nome);
});
// Clicar num nick em qualquer tabela abre a ficha.
body.addEventListener('click', (e) => {
  const b = e.target.closest('[data-jogador]');
  if (!b || !ultimo) return;
  aba = 'jogador';
  try { localStorage.setItem('site.painel.aba', aba); } catch { /* sem storage */ }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  buscarJogador(b.dataset.jogador);
});
ligarCompraPremium(body); // botões "Premium" do passe abrem a compra

// Passe de batalha: resgatar, controles de teste e publicar.
body.addEventListener('click', async (e) => {
  const r = e.target.closest('[data-ps-resgatar]');
  const a = e.target.closest('[data-ps-acao]');
  const pub = e.target.closest('[data-ps-publicar]');
  if (e.target.closest('[data-ps-recarregar]')) { psErro = ''; carregarPasse(); return; }
  if (!r && !a && !pub) return;
  const msg = () => body.querySelector('[data-ps-msg]');
  const btn = r || a || pub;
  btn.disabled = true;
  try {
    if (r) {
      const x = await platform.passeResgatar(Number(r.dataset.psResgatar));
      await carregarPasse();
      const m = msg();
      if (m) m.textContent = x.tipo === 'moeda' ? `Nível ${x.nivel}: +${Number(x.chave).toLocaleString('pt-BR')} Rift Coins!` : `Nível ${x.nivel}: ${nomeRecompensa(x.tipo, x.chave)} resgatado!`;
      return;
    }
    if (a) {
      if (a.dataset.psAcao === 'zerar' && !window.confirm('Zerar o seu progresso no passe (abóboras, limite do dia e recompensas resgatadas)? As moedas e efeitos já recebidos continuam com você.')) { btn.disabled = false; return; }
      await platform.adminPasse(platform.getUser().username, a.dataset.psAcao, Number(a.dataset.valor));
    } else {
      if (pub.dataset.psPublicar === '1' && !window.confirm('Publicar o passe? A partir de agora todos os jogadores conectados ganham abóboras e podem resgatar.')) { btn.disabled = false; return; }
      await platform.adminPassePublicar(pub.dataset.psPublicar === '1');
    }
    await carregarPasse();
  } catch (err) {
    const m = msg();
    if (m) m.textContent = err.message;
    btn.disabled = false;
  }
});

// Dar ou tirar Rift Coins pela ficha.
body.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-jg-moedas]');
  if (!f) return;
  e.preventDefault();
  const msg = body.querySelector('[data-jg-moedas-msg]');
  const qtd = Number(f.querySelector('[data-jg-moedas-qtd]').value);
  if (!Number.isInteger(qtd) || qtd === 0) { msg.textContent = 'Digite uma quantidade inteira, diferente de zero.'; return; }
  const nota = f.querySelector('[data-jg-moedas-nota]').value.trim();
  if (!window.confirm(`${qtd > 0 ? 'Dar' : 'Tirar'} ${num(Math.abs(qtd))} Rift Coins ${qtd > 0 ? 'para' : 'de'} ${f.dataset.nome}?`)) return;
  try {
    await platform.adminMoedas(f.dataset.nome, qtd, nota || null);
    await buscarJogador(f.dataset.nome);
  } catch (err) {
    msg.textContent = err.message;
  }
});
// Dar ou tirar recompensa pela ficha.
body.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-jg-rec-dar]');
  if (!f) return;
  e.preventDefault();
  const msg = body.querySelector('[data-jg-rec-msg]');
  const chave = f.querySelector('[data-jg-rec-chave]').value.trim().toLowerCase();
  if (!chave) { msg.textContent = 'Digite o id da recompensa.'; return; }
  try {
    await platform.adminRecompensa(f.dataset.nome, f.querySelector('[data-jg-rec-tipo]').value, chave, true);
    await buscarJogador(f.dataset.nome);
  } catch (err) {
    msg.textContent = err.message;
  }
});
body.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-jg-rec-tirar]');
  if (!t) return;
  const [tipo, chave] = t.dataset.jgRecTirar.split('|');
  if (!window.confirm(`Tirar "${nomeRecompensa(tipo, chave)}" de ${t.dataset.nome}? Se for o ícone em uso, ele volta para a inicial do nome.`)) return;
  t.disabled = true;
  try {
    await platform.adminRecompensa(t.dataset.nome, tipo, chave, false);
    await buscarJogador(t.dataset.nome);
  } catch (err) {
    window.alert(err.message);
    t.disabled = false;
  }
});

// Dar ou tirar PDR pela ficha.
body.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-jg-ajustar]');
  if (!b) return;
  const nome = b.dataset.jgAjustar;
  const delta = Math.round(Number(body.querySelector('[data-jg-delta]').value));
  const msg = body.querySelector('[data-jg-msg]');
  if (!delta) { msg.textContent = 'Digite um PDR diferente de zero (positivo dá, negativo tira).'; return; }
  if (!window.confirm(`${delta > 0 ? 'Dar' : 'Tirar'} ${Math.abs(delta)} PDR ${delta > 0 ? 'para' : 'de'} ${nome}?`)) return;
  b.disabled = true;
  try {
    const r = await platform.adminAjustarPdr(nome, delta);
    await buscarJogador(nome);
    const m = body.querySelector('[data-jg-msg]');
    if (m) m.textContent = `Pronto! ${r.username}: ${num(r.antes)} → ${num(r.depois)} pontos (${ELO_NOMES[r.elo] || r.elo}).`;
    return;
  } catch (err) {
    msg.textContent = err.message;
  }
  b.disabled = false;
});

platform.onChange((evt) => { if (evt.type === 'auth') load(); });
load();
