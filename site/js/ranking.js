// Página de ranking da ranqueada (Carreira no Rift): minha situação,
// rankings diário/semanal/mensal e as regras.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { avatarHtml, hydrateAvatars } from '../shared/avatar.js';
import { eloInfo, emblemaHtml } from '../shared/ranked.js';
import { cardMinhaRanqueada, comoFunciona } from './ranqueada-card.js';
import { nickHtml } from '../shared/apoio.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../' });
mountSiteFooter(document.getElementById('site-footer'));

const root = document.getElementById('ranking');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const ddmm = (iso) => {
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
};
const PERIODOS = [['diario', 'Hoje'], ['semanal', 'Semana'], ['mensal', 'Mês']];

let periodo = 'diario';
try { periodo = localStorage.getItem('site.ranking.periodo') || 'diario'; } catch { /* sem armazenamento */ }
if (!PERIODOS.some(([id]) => id === periodo)) periodo = 'diario';
let status = null;
let dados = null;
let erro = '';

function linha(j) {
  const e = eloInfo(j.elo);
  return `<li class="${j.eu ? 'eu' : ''}${j.pos <= 3 ? ` top${j.pos}` : ''}">
    <span class="rk-pos">${j.pos}</span>
    <span class="rk-quem">${avatarHtml(j.avatar, j.username, 34, `elo-${e.id}`)}<b>${nickHtml(j.username, j.apoiador)}</b></span>
    <span class="rk-elo" style="--cor:${e.cor}">${emblemaHtml(e.id, 18)}<span>${esc(e.nome)}</span></span>
    <span class="rk-pts">${num(j.pontos)}${periodo !== 'diario' ? `<small>${j.dias} ${j.dias === 1 ? 'dia' : 'dias'}</small>` : ''}</span>
  </li>`;
}

function tabela() {
  const tabs = PERIODOS.map(([id, nome]) => `<button type="button" data-periodo="${id}" class="${periodo === id ? 'on' : ''}">${nome}</button>`).join('');
  let corpo;
  if (erro) corpo = `<p class="muted">${esc(erro)}</p>`;
  else if (!dados) corpo = '<p class="muted">Carregando…</p>';
  else if (!dados.lista.length) corpo = `<p class="muted">Ninguém jogou ${periodo === 'diario' ? 'hoje' : periodo === 'semanal' ? 'nesta semana' : 'neste mês'} ainda. Seja o primeiro!</p>`;
  else {
    const fora = dados.eu && !dados.lista.some((j) => j.eu);
    const u = platform.getUser();
    corpo = `<ol class="rk-lista">${dados.lista.map(linha).join('')}
      ${fora ? `<li class="eu sep"><span class="rk-pos">${dados.eu.pos}</span><span class="rk-quem">${avatarHtml(u.avatar, u.username, 34, `elo-${u.elo || 'bronze'}`)}<b>${nickHtml(u.username, u.apoioTotal > 0)}</b></span><span></span><span class="rk-pts">${num(dados.eu.pontos)}</span></li>` : ''}
    </ol>`;
  }
  const quando = dados ? (periodo === 'diario' ? `Hoje (${ddmm(dados.fim)})` : `${ddmm(dados.inicio)} a ${ddmm(dados.fim)}`) : '';
  return `<section class="pf-sec">
    <h2 class="section-title">Ranking</h2>
    <div class="rk-topo"><div class="pf-chips" role="group" aria-label="Período">${tabs}</div>
      <span class="muted small">${quando}${dados ? ` · ${num(dados.jogadores)} ${dados.jogadores === 1 ? 'jogador' : 'jogadores'}` : ''}</span></div>
    ${corpo}
  </section>`;
}

function render() {
  const u = platform.getUser();
  const cta = !platform.cloudEnabled() ? ''
    : u ? '<a class="btn-primary" href="../jogos/carreira-no-rift/">Jogar Carreira no Rift</a>'
      : '<button type="button" class="btn-primary" data-act="entrar">Entrar para jogar a ranqueada</button>';
  root.innerHTML = `
    <header class="rk-head">
      <div><p class="eyebrow">◆ Ranqueada · Carreira no Rift</p><h1 class="display">Ranking</h1></div>
      ${cta}
    </header>
    ${u ? cardMinhaRanqueada(status, { link: false }) : ''}
    ${tabela()}
    ${comoFunciona()}`;
  hydrateAvatars(root);
}

async function carregarTabela() {
  dados = null;
  erro = '';
  render();
  try {
    dados = await platform.ranking(periodo);
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

root.addEventListener('click', (e) => {
  const p = e.target.closest('[data-periodo]');
  if (p && p.dataset.periodo !== periodo) {
    periodo = p.dataset.periodo;
    try { localStorage.setItem('site.ranking.periodo', periodo); } catch { /* sem armazenamento */ }
    carregarTabela();
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
