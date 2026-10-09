// Página de ranking da ranqueada (todos os jogos valem PDR): minha situação,
// ranking geral (pelo elo, com filtro por elo), rankings diário/semanal/mensal
// (PDR ganhos no período) e as regras.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { avatarHtml } from '../shared/avatar.js';
import { ELOS, eloInfo, emblemaHtml, divisaoDe, nomeDivisao, fmtPdr } from '../shared/ranked.js';
import { cardMinhaRanqueada, comoFunciona } from './ranqueada-card.js';
import { nickHtml } from '../shared/apoio.js';
import { localeAtual } from '../shared/i18n.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../' });
mountSiteFooter(document.getElementById('site-footer'));

const root = document.getElementById('ranking');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const num = (n) => (n == null ? '—' : Number(n).toLocaleString(localeAtual()));
const ddmm = (iso) => {
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
};
const PERIODOS = [['geral', 'Geral'], ['diario', 'Hoje'], ['semanal', 'Semana'], ['mensal', 'Mês']];
// Filtro do ranking geral: do topo para baixo.
const FILTROS = [['', 'Todos'], ...ELOS.slice().reverse().map((e) => [e.id, e.nome])];

let periodo = 'geral';
let elo = '';
try {
  periodo = localStorage.getItem('site.ranking.periodo2') || 'geral';
  elo = localStorage.getItem('site.ranking.elo') || '';
} catch { /* sem armazenamento */ }
if (!PERIODOS.some(([id]) => id === periodo)) periodo = 'geral';
if (!FILTROS.some(([id]) => id === elo)) elo = '';
const POR_PAGINA = 10;
let pagina = 1;
let status = null;
let dados = null;
let erro = '';

function linha(j) {
  const d = divisaoDe(j.pts, j.elo);
  const e = eloInfo(d.elo);
  const valor = periodo === 'geral'
    ? `${num(d.pdr)}<small>PDR</small>`
    : `<span class="${j.valor > 0 ? 'pdr-mais' : j.valor < 0 ? 'pdr-menos' : ''}">${fmtPdr(j.valor).replace(' PDR', '')}</span><small>PDR</small>`;
  return `<li class="${j.eu ? 'eu' : ''}${j.pos <= 3 ? ` top${j.pos}` : ''}">
    <span class="rk-pos">${j.pos}</span>
    <span class="rk-quem">${avatarHtml(j.avatar, j.username, 34, `elo-${e.id}`, j.moldura)}<b>${nickHtml(j.username, j.apoiador, j.efeito)}</b></span>
    <span class="rk-elo" style="--cor:${e.cor}">${emblemaHtml(e.id, 18)}<span>${esc(nomeDivisao(d))}</span></span>
    <span class="rk-pts">${valor}</span>
  </li>`;
}

// Marcador de páginas: « ‹ 1 2 [3] 4 5 › » (no máximo 5 números por vez).
function paginacao(total) {
  if (total <= 1) return '';
  let ini = Math.max(1, pagina - 2);
  const fim = Math.min(total, ini + 4);
  ini = Math.max(1, fim - 4);
  const num_ = (n) => `<button type="button" data-pag="${n}" class="${n === pagina ? 'on' : ''}"${n === pagina ? ' aria-current="page"' : ''}>${n}</button>`;
  const seta = (txt, alvo, rotulo, off) => `<button type="button" data-pag="${alvo}" aria-label="${rotulo}"${off ? ' disabled' : ''}>${txt}</button>`;
  const nums = [];
  for (let n = ini; n <= fim; n++) nums.push(num_(n));
  return `<nav class="rk-pag" aria-label="Páginas do ranking">
    ${seta('«', 1, 'Primeira página', pagina === 1)}${seta('‹', pagina - 1, 'Página anterior', pagina === 1)}
    ${nums.join('')}
    ${seta('›', pagina + 1, 'Próxima página', pagina === total)}${seta('»', total, 'Última página', pagina === total)}
  </nav>`;
}

function tabela() {
  const tabs = PERIODOS.map(([id, nome]) => `<button type="button" data-periodo="${id}" class="${periodo === id ? 'on' : ''}">${nome}</button>`).join('');
  const filtros = periodo === 'geral'
    ? `<div class="pf-chips rk-filtro" role="group" aria-label="Filtrar por elo">${FILTROS.map(([id, nome]) => `<button type="button" data-elo="${id}" class="${elo === id ? 'on' : ''}"${id ? ` style="--cor:${eloInfo(id).cor}"` : ''}>${id ? emblemaHtml(id, 18) : ''}${esc(nome)}</button>`).join('')}</div>`
    : '';
  let corpo;
  if (erro) corpo = `<p class="muted">${esc(erro)}</p>`;
  else if (!dados) corpo = '<p class="muted">Carregando…</p>';
  else if (!dados.lista.length) {
    corpo = `<p class="muted">${periodo === 'geral'
      ? (elo ? `Ninguém no ${esc(eloInfo(elo).nome)} ainda.` : 'Ninguém na ranqueada ainda. Seja o primeiro!')
      : `Ninguém ganhou PDR ${periodo === 'diario' ? 'hoje' : periodo === 'semanal' ? 'nesta semana' : 'neste mês'} ainda.`}</p>`;
  } else {
    const total = Math.max(1, Math.ceil(dados.lista.length / POR_PAGINA));
    pagina = Math.min(Math.max(1, pagina), total);
    const visiveis = dados.lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
    // Fora desta página (ou além do top 100): a própria posição aparece logo abaixo, separada.
    const fora = dados.eu && !visiveis.some((j) => j.eu);
    const u = platform.getUser();
    const meu = fora ? linha({ ...dados.eu, eu: true, username: u.username, avatar: u.avatar, apoiador: u.apoioTotal > 0, efeito: u.efeito, moldura: u.moldura }) : '';
    corpo = `<ol class="rk-lista">${visiveis.map(linha).join('')}</ol>
      ${meu ? `<ol class="rk-lista rk-meu" aria-label="Sua posição">${meu}</ol>` : ''}
      ${paginacao(total)}`;
  }
  const quando = !dados ? '' : periodo === 'geral' ? 'Pelo elo e PDR'
    : periodo === 'diario' ? `Hoje (${ddmm(dados.fim)})` : `${ddmm(dados.inicio)} – ${ddmm(dados.fim)}`;
  return `<section class="pf-sec">
    <h2 class="section-title">Ranking</h2>
    <div class="rk-topo"><div class="pf-chips" role="group" aria-label="Período">${tabs}</div>
      <span class="muted small">${quando}${dados ? ` · ${num(dados.jogadores)} ${dados.jogadores === 1 ? 'jogador' : 'jogadores'}` : ''}</span></div>
    ${filtros}
    ${corpo}
  </section>`;
}

function render() {
  const u = platform.getUser();
  const cta = !platform.cloudEnabled() || u ? ''
    : '<button type="button" class="btn-primary" data-act="entrar">Entrar para jogar a ranqueada</button>';
  root.innerHTML = `
    <header class="rk-head">
      <div><p class="eyebrow">◆ Ranqueada · todos os jogos</p><h1 class="display">Ranking</h1></div>
      ${cta}
    </header>
    ${u ? cardMinhaRanqueada(status, { link: false }) : ''}
    ${tabela()}
    ${comoFunciona()}`;
}

async function carregarTabela() {
  dados = null;
  erro = '';
  render();
  try {
    dados = await platform.ranking(periodo, periodo === 'geral' && elo ? elo : null);
  } catch (e) {
    erro = platform.cloudEnabled() ? 'O ranking ainda não está disponível.' : 'O ranking precisa de conexão com o servidor do site.';
    console.warn(e);
  }
  render();
}

let carregando = true;
async function carregar() {
  await platform.init();
  if (platform.getUser()) status = await platform.rankedStatus();
  carregando = false;
  await carregarTabela();
}

const guardar = () => {
  try {
    localStorage.setItem('site.ranking.periodo2', periodo);
    localStorage.setItem('site.ranking.elo', elo);
  } catch { /* sem armazenamento */ }
};

root.addEventListener('click', (e) => {
  const p = e.target.closest('[data-periodo]');
  if (p && p.dataset.periodo !== periodo) {
    periodo = p.dataset.periodo;
    pagina = 1;
    guardar();
    carregarTabela();
  }
  const f = e.target.closest('[data-elo]');
  if (f && f.dataset.elo !== elo) {
    elo = f.dataset.elo;
    pagina = 1;
    guardar();
    carregarTabela();
  }
  const g = e.target.closest('[data-pag]');
  if (g && !g.disabled) {
    pagina = Number(g.dataset.pag);
    render();
    document.querySelector('.rk-topo')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  if (e.target.closest('[data-act="entrar"]')) openAuthModal('login');
});

platform.onChange(async (evt) => {
  if (evt.type !== 'auth' || carregando) return;
  if (evt.user && !status) {
    status = await platform.rankedStatus();
    carregarTabela();
  } else if (!evt.user) {
    status = null;
    render();
  }
});

carregar();
