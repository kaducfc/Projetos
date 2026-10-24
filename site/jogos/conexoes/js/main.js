// Conexões do League: 16 palavras do universo de League of Legends em 4 x 4; junte 4 que tenham algo em comum.
// Desafio do dia (igual para todos, o andamento fica salvo) e jogo livre (quebra-cabeças aleatórios).
// Enquanto o jogo é "oculto" (gameById('conexoes').soAdmin), só administradores conseguem jogar.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import { vantagens, fmtPdr } from '../../../shared/ranked.js';
import { avisoDiario } from '../../../shared/aviso-ranked.js';
import { t, onLangChange } from '../../../shared/i18n.js';
import {
  puzzleDoDia, criarPuzzle, aleatorio, novoJogo, alternar, conferir, dica, podeDica, misturar, palavrasRestantes,
  erros, pontos, textoCompartilhar, salvar, restaurar, TAMANHO, QUADRADOS, MAX_ERROS, estDeServidor,
} from './logic.js';

const GAME_ID = 'conexoes';
const CHAVE_DIA = 'conexoes.dia';
const CHAVE_AJUDA = 'conexoes.ajuda';
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lerLS = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

// Hoje no horário de Brasília (o desafio do dia troca à meia-noite de lá).
const hojeBR = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const dataBonita = (iso) => iso.split('-').reverse().join('/');

let modo = 'dia'; // 'dia' | 'livre'
let dia = hojeBR();
let est = null;
let srv = null; // partida de hoje na ranqueada (vem do servidor); null no jogo livre, sem conta ou sem servidor
const ranqueada = () => modo === 'dia' && Boolean(srv);
let msg = '';
let erroAnim = []; // palavras que tremem no erro
let ocupado = false;
let registrado = false; // o resultado do desafio do dia já foi enviado ao histórico
let ajudaAberta = false;
let grupoNovo = -1; // grupo recém-achado (só ele anima ao entrar)
let animar = true; // as peças sobem em sequência só quando o tabuleiro é desenhado do zero

const LAMPADA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>';

// --------------------------------------------------------------------------- andamento do dia
// Dicas da partida: 1, e 2 do Platina para cima (o número fica fixo depois da 1ª jogada, como no Campeão Oculto).
const dicasMax = () => vantagens(platform.getUser()?.elo).dicasConexoes;
function carregarDia() {
  const puzzle = puzzleDoDia(dia);
  const salvo = lerLS(CHAVE_DIA);
  if (salvo && salvo.dia === dia) { registrado = Boolean(salvo.registrado); return restaurar(salvo.estado, puzzle, { maxDicas: dicasMax() }); }
  registrado = false;
  return novoJogo(puzzle, { maxDicas: dicasMax() });
}
// Com conta e servidor, o desafio do dia vale ranqueada: o quebra-cabeça é sorteado e conferido lá (só os grupos acertados voltam).
// Se o servidor não responder, joga o desafio local (sem PDR).
async function abrirServidor() {
  srv = null;
  if (!platform.diarioNoServidor()) return;
  try { srv = await platform.conexoesAbrir(); } catch (e) { console.warn('Conexões: servidor indisponível, jogando sem ranqueada.', e.message); }
}
function guardar() { if (modo === 'dia' && !srv && est) gravarLS(CHAVE_DIA, { dia, estado: salvar(est), registrado }); }

// --------------------------------------------------------------------------- desenho
// No celular a peça é estreita: palavras compridas encolhem (fator --f) para caber sem quebrar no meio.
const fator = (w) => Math.max(0.62, Math.min(1, 8 / Math.max(...w.split(/\s+/).map((x) => x.length))));

function pecas() {
  const marcadas = new Set(est.marcadas);
  return palavrasRestantes(est).map((w, i) => {
    const cls = ['cx-pec', est.sel.includes(w) ? 'sel' : '', erroAnim.includes(w) ? 'erro' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" style="--f:${fator(w).toFixed(2)};--i:${animar ? i : 0}" data-a="palavra" data-w="${esc(w)}" aria-pressed="${est.sel.includes(w)}">${esc(w)}${marcadas.has(w) ? '<i class="marca" title="' + esc(t('Dica')) + '"></i>' : ''}</button>`;
  }).join('');
}
function resolvidos() {
  const html = (i, extra = '') => {
    const g = est.puzzle.grupos[i];
    return `<div class="cx-grupo o${g.ordem}${i === grupoNovo ? ' novo' : ''}${extra}"><b>${esc(g.tit)}</b><span>${g.palavras.map(esc).join(', ')}</span></div>`;
  };
  // ao perder, mostra os grupos que faltavam (esmaecidos)
  const faltam = est.perdeu ? est.puzzle.grupos.map((_, i) => i).filter((i) => !est.resolvidos.includes(i)) : [];
  return est.resolvidos.map((i) => html(i)).join('') + faltam.map((i) => html(i, ' perdido')).join('');
}
function cartaoFim() {
  const quad = est.historico.map((h) => (h.tipo === 'dica' ? '💡' : h.tipo === 'ok' ? QUADRADOS[h.ordem] : '⬛')).join('');
  const d = est.dicas === 0 ? t('sem dicas') : est.dicas === 1 ? t('1 dica') : t('{n} dicas', { n: est.dicas });
  const titulo = est.perdeu ? t('Não foi dessa vez') : t('Parabéns!');
  const texto = est.perdeu ? t('Você usou os {n} erros. Os grupos que faltavam aparecem abaixo.', { n: MAX_ERROS }) : t('Você acertou em {t} tentativas e {d}.', { t: est.tentativas, d });
  return `<div class="cx-fim cx-quadro${grupoNovo >= 0 ? ' novo' : ''}${est.perdeu ? ' perdeu' : ''}"><h2>${titulo}</h2>
    <p>${texto}</p>
    <div class="quadrados" aria-hidden="true">${quad}</div>
    <p class="pts">${pontos(est)}<small>${t('pontos')}</small></p>
    ${srv && srv.pdr != null ? `<p class="rk-pdr"><b>${t('Ranqueada:')}</b> ${t('{pdr} hoje', { pdr: fmtPdr(srv.pdr) })}</p>` : ''}
    <div class="cx-acoes"><button type="button" class="cx-bt principal" data-a="compartilhar">${t('Compartilhe')}</button>
      <button type="button" class="cx-bt" data-a="${modo === 'dia' ? 'livre' : 'novo'}">${modo === 'dia' ? t('Jogar um quebra-cabeça livre') : t('Outro quebra-cabeça')}</button>
      ${modo === 'livre' ? `<button type="button" class="cx-bt" data-a="dia">${t('Voltar ao desafio do dia')}</button>` : ''}</div></div>`;
}
function modalAjuda() {
  return `<div class="cx-modal" id="cx-ajuda" ${ajudaAberta ? '' : 'hidden'}><div class="cx-quadro" role="dialog" aria-modal="true" aria-label="${esc(t('Como jogar'))}">
    <h2>${t('Como jogar')}</h2>
    <ol><li><span>${t('Forme grupos de 4 palavras que tenham algo em comum.')}</span></li>
      <li><span>${t('Clique em uma palavra para selecioná-la. Se precisar, você pode clicar novamente para desselecionar.')}</span></li>
      <li><span>${t('Assim que você selecionar 4 palavras o jogo irá automaticamente conferir se o grupo está correto.')}</span></li>
      <li><span>${t('Se estiver correto, a categoria será revelada. Senão, tente novamente.')}</span></li>
      <li><span>${t('Descubra os 4 grupos.')}</span></li>
      <li><span>${t('Você pode errar até {n} vezes: no erro seguinte a partida acaba.', { n: MAX_ERROS })}</span></li>
      <li><span>${t('Você tem {n} dica(s) por partida; o elo Platina dá uma a mais.', { n: vantagens(platform.getUser()?.elo).dicasConexoes })}</span></li></ol>
    <p class="nota">${t('Tudo vem do universo de League of Legends: campeões, itens, regiões, monstros, eSports e muito mais. As palavras ficam em português.')}</p>
    <div class="cx-acoes"><button type="button" class="cx-bt principal" data-a="fechar">${t('Entendi')}</button></div></div></div>`;
}

function desenhar() {
  const fim = est.fim;
  const achados = est.resolvidos.length;
  app.innerHTML = `<div class="cx-topo"><div><p class="cx-eyebrow">${t('Quebra-cabeça')} · League of Legends</p><h1>${t('Conexões do League')}</h1>
      <span class="cx-modo"><i></i>${modo === 'dia' ? (srv ? t('Desafio do dia · Ranqueada') : t('Desafio do dia')) : t('Jogo livre')}</span></div>
      <button type="button" class="cx-bt pequeno" data-a="ajuda">${t('Como jogar')}</button></div>
    <div class="cx-info cx-quadro">
      ${modo === 'dia' ? `<div class="cx-dado dia"><small>${t('Data')}</small><b>${dataBonita(dia)}</b></div>` : ''}
      <div class="cx-dado"><small>${t('Erros')}</small><b>${erros(est)} / ${MAX_ERROS}</b></div>
      <div class="cx-dado"><small>${t('Dicas')}</small><b>${est.dicas} / ${est.maxDicas}</b></div>
      <span class="esp"></span>
      <span class="cx-prog" aria-label="${achados}/4">${[0, 1, 2, 3].map((i) => `<i class="${i < achados ? 'on' : ''}"></i>`).join('')}</span>
      <button type="button" class="dica" data-a="dica" ${podeDica(est) && !ocupado ? '' : 'disabled'}>${LAMPADA}${t('Dica')}</button></div>
    ${fim ? cartaoFim() : `<div class="cx-msg" role="status">${esc(msg)}</div>`}
    <div data-no-i18n>
      <div class="cx-resolvidos">${resolvidos()}</div>
      ${fim ? '' : `<div class="cx-tabuleiro${animar ? ' entra' : ''}">${pecas()}</div>`}
    </div>
    ${fim ? '' : `<div class="cx-acoes"><button type="button" class="cx-bt" data-a="misturar">${t('Embaralhar')}</button>
      <button type="button" class="cx-bt" data-a="limpar" ${est.sel.length ? '' : 'disabled'}>${t('Limpar')}</button></div>`}
    ${modalAjuda()}`;
  animar = false;
}

// --------------------------------------------------------------------------- ações
async function clicarPalavra(w) {
  if (ocupado || est.fim) return;
  alternar(est, w);
  msg = ''; grupoNovo = -1;
  desenhar();
  if (est.sel.length === TAMANHO) {
    ocupado = true;
    await esperar(280);
    const antes = [...est.sel];
    let r; let falha = '';
    if (ranqueada()) {
      try {
        const resp = await platform.conexoesTentar(antes);
        srv = resp.estado; est = estDeServidor(srv, est);
        r = { tipo: resp.tipo, quase: resp.quase, perdeu: srv.status === 'perdeu' };
      } catch (e) {
        est.sel = [];
        r = { tipo: e.codigo === 'chute_repetido' ? 'repetido' : 'falha' };
        falha = e.message;
      }
    } else r = conferir(est);
    if (r.tipo === 'ok') grupoNovo = est.resolvidos[est.resolvidos.length - 1];
    if (r.tipo === 'erro') {
      erroAnim = antes;
      msg = r.perdeu ? '' : r.quase ? t('Falta só uma palavra!') : t('Não é esse grupo. Tente de novo.');
    } else if (r.tipo === 'repetido') msg = t('Você já tentou esse grupo.');
    else if (r.tipo === 'falha') msg = falha || t('Não deu para falar com o servidor. Tente de novo.');
    ocupado = false;
    guardar();
    desenhar();
    if (r.tipo === 'erro') setTimeout(() => { erroAnim = []; if (!est.fim) desenhar(); }, 520);
    if (est.fim) terminar();
  }
}

async function pedirDica() {
  if (ocupado) return;
  if (ranqueada()) {
    if (!podeDica(est)) return;
    ocupado = true; msg = ''; grupoNovo = -1;
    try { srv = await platform.conexoesDica(); est = estDeServidor(srv, est); } catch (e) { msg = e.message; }
    ocupado = false;
    desenhar();
    return;
  }
  if (!dica(est)) return;
  msg = ''; grupoNovo = -1;
  guardar();
  desenhar();
}

function terminar() {
  if (modo !== 'dia' || registrado) return;
  registrado = true;
  if (!srv) guardar();
  platform.track('game_end', GAME_ID, { tentativas: est.tentativas, dicas: est.dicas, perdeu: est.perdeu });
  Promise.resolve(platform.recordResult(GAME_ID, {
    score: pontos(est),
    summary: { text: `${est.tentativas} ${t('tentativas')} · ${est.dicas} ${t('dicas')}`, dia, tentativas: est.tentativas, dicas: est.dicas, erros: erros(est), perdeu: est.perdeu, pdr: srv?.pdr ?? null },
  })).catch(() => {});
  if (srv) avisoDiario(srv);
}

async function compartilhar() {
  const texto = textoCompartilhar(est, { titulo: t('Conexões do League'), dia: modo === 'dia' ? dataBonita(dia) : t('Jogo livre'), link: `${location.origin}${location.pathname}` });
  try {
    if (navigator.share) { await navigator.share({ text: texto }); return; }
  } catch { /* cancelou */ }
  try { await navigator.clipboard.writeText(texto); msg = t('Copiado!'); } catch { msg = t('Não deu para copiar.'); }
  const b = app.querySelector('[data-a="compartilhar"]');
  if (b) { const antes = b.textContent; b.textContent = msg; setTimeout(() => { if (b.isConnected) b.textContent = antes; }, 1600); }
}

function novoLivre() {
  modo = 'livre'; grupoNovo = -1;
  est = novoJogo(criarPuzzle(aleatorio((Date.now() ^ 0x9e3779b9) >>> 0)), { maxDicas: dicasMax() });
  msg = ''; erroAnim = []; animar = true;
  desenhar();
}
async function voltarDia() {
  modo = 'dia'; grupoNovo = -1; dia = hojeBR(); msg = ''; erroAnim = []; animar = true;
  await abrirServidor();
  est = srv ? estDeServidor(srv) : carregarDia();
  desenhar();
}

app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]');
  if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (a === 'palavra') clicarPalavra(b.dataset.w);
  else if (a === 'dica') pedirDica();
  else if (a === 'misturar') { misturar(est); guardar(); animar = true; desenhar(); }
  else if (a === 'limpar') { est.sel = []; msg = ''; desenhar(); }
  else if (a === 'ajuda') { ajudaAberta = true; desenhar(); }
  else if (a === 'fechar') { ajudaAberta = false; gravarLS(CHAVE_AJUDA, true); desenhar(); }
  else if (a === 'compartilhar') compartilhar();
  else if (a === 'livre' || a === 'novo') novoLivre();
  else if (a === 'dia') voltarDia();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ajudaAberta) { ajudaAberta = false; gravarLS(CHAVE_AJUDA, true); desenhar(); } });

function telaBloqueada() {
  app.innerHTML = `<div class="cx-fim" style="margin-top:40px"><h2>${t('Em desenvolvimento')}</h2>
    <p>${t('Este jogo ainda está sendo construído e chega em breve. Enquanto isso, o resto do Rift Arcade está aberto!')}</p>
    <div class="cx-acoes"><a class="cx-bt principal" href="../../" style="text-decoration:none">${t('VOLTAR AO INÍCIO')}</a></div></div>`;
}

onLangChange(() => { if (est) desenhar(); });

(async function iniciar() {
  await platform.init();
  const teste = ['localhost', '127.0.0.1'].includes(location.hostname) && /[?&]teste=1/.test(location.search);
  const souAdmin = await platform.isAdmin();
  const aberto = !gameById(GAME_ID)?.soAdmin;
  if (!souAdmin && !teste && !aberto) { telaBloqueada(); return; }
  await abrirServidor();
  est = srv ? estDeServidor(srv) : carregarDia(); animar = true;
  ajudaAberta = !lerLS(CHAVE_AJUDA, false) && !est.tentativas && !est.dicas; // 1ª vez: mostra o "Como jogar"
  desenhar();
  platform.track('game_start', GAME_ID, {});
})();
