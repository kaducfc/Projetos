// Na Medida: a figura azul tem tamanho fixo; o jogador ajusta o
// tamanho da vermelha até achar que está na proporção certa.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { msToNextDay, fmtCountdown } from '../../../shared/diario.js';
import { avisoDiario, eloTexto } from '../../../shared/aviso-ranked.js';
import { emblemaHtml, divisaoDe } from '../../../shared/ranked.js';
import {
  RODADAS, dayIndex, pontos, veredito, diferenca, rng, sortearRodada, rodadasDoDia,
  fmtAltura, proporcao, quadrado,
} from './logic.js';
import { localeAtual } from '../../../shared/i18n.js';
import { liberarAbobora } from '../../../shared/passe-aviso.js';

const GAME_ID = 'escala';
const NAME = 'Na Medida';
// Proporção do palpite em relação à azul (sem revelar nenhuma altura): "1,6×".
const fmtRazao = (r) => `${r.toLocaleString(localeAtual(), { maximumFractionDigits: r < 10 ? 2 : 1, minimumFractionDigits: r < 10 ? 2 : 1 })}×`;
const razaoDe = (a, b) => Math.max(a.altura, b.altura) / Math.min(a.altura, b.altura);
const LIMITE = 15; // o palpite vai de 1/15 a 15× a referência
// Endereço completo: url() dentro de variável CSS resolve a partir do .css.
const SIL = new URL('dados/silhuetas/', location.href).href;

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const CONF = { comunidade: 'estimativa da comunidade', desenvolvedores: 'informada pela Riot', interpretativo: 'tamanho discutível ou variável', rift: 'proporção no Rift (Garen = 1,95 m)' };

let itens = [];
let porId = new Map();
let hoje = dayIndex();
let save = null; // { v, diario: { dia, rodadas: [...] }, livre: { jogadas, soma, melhor } }
let modo = 'diario';
let rodada = null; // { ref, alvo, palpite, pontos? }
let livreAtual = null;
// Ranqueada (com conta): o diário é do servidor. `srv` = estado de hoje (null
// = ainda não começou); `ranq` = está valendo (conta + servidor respondendo).
let ranq = false;
let srv = null;
let enviando = false;
let eloAgora = null; // platform.rankedStatus() depois de fechar a ranqueada

// ------------------------------------------------------------------ dados

async function carregarDados() {
  const [lista, props, versoes] = await Promise.all([
    fetch('dados/itens.json', { cache: 'no-cache' }).then((r) => r.json()),
    fetch('dados/silhuetas.json', { cache: 'no-cache' }).then((r) => r.json()),
    fetch('dados/versoes.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({})),
  ]);
  itens = lista.filter((i) => props[i.id] && i.altura > 0).map((i) => ({ ...i, prop: props[i.id], v: versoes[i.id] || '' }));
  porId = new Map(itens.map((i) => [i.id, i]));
}

function carregarSave() {
  const s = platform.loadLocalSave(GAME_ID);
  save = { v: 1, diario: null, livre: { jogadas: 0, soma: 0, melhor: 0 }, ...(s && s.v === 1 ? s : {}) };
  if (!save.semente) save.semente = 1 + Math.floor(Math.random() * 1e6); // sorteio próprio deste aparelho
  if (!save.diario || save.diario.dia !== hoje || !Array.isArray(save.diario.rodadas) || save.diario.rodadas.length !== RODADAS) {
    save.diario = { dia: hoje, rodadas: rodadasDoDia(itens, hoje, save.semente).map((r) => ({ ...r, palpite: null, pontos: null })) };
  }
  // Se a tabela mudou e algum item sumiu, refaz o dia.
  if (save.diario.rodadas.some((r) => !porId.has(r.ref) || !porId.has(r.alvo))) {
    save.diario = { dia: hoje, rodadas: rodadasDoDia(itens, hoje, save.semente).map((r) => ({ ...r, palpite: null, pontos: null })) };
  }
}
const guardar = (urgente = false) => platform.writeSave(GAME_ID, save, { urgent: urgente });

// Rodadas do dia: do servidor (ranqueada) ou deste aparelho (sem conta).
const rodadasDia = () => (ranq
  ? Array.from({ length: RODADAS }, (_, i) => ({ ref: null, alvo: null, palpite: null, pontos: null, ...(srv?.rodadas?.[i] || {}) }))
  : save.diario.rodadas);
const feitas = () => rodadasDia().filter((r) => r.pontos != null).length;
const totalDia = () => rodadasDia().reduce((t, r) => t + (r.pontos || 0), 0);
const diaFim = () => (ranq ? srv?.status === 'terminou' : feitas() >= RODADAS);

// Rodada em jogo (ou a última respondida, mostrando o resultado).
function rodadaAtual() {
  if (modo === 'diario' && ranq) {
    if (!srv || srv.status === 'terminou') return null;
    const r = srv.rodadas[srv.atual];
    if (!r || !porId.has(r.ref) || !porId.has(r.alvo)) return null;
    return { ref: r.ref, alvo: r.alvo, indice: srv.atual, prazo: Date.now() + (srv.restante ?? 60) * 1000 };
  }
  if (modo === 'diario') {
    const rs = save.diario.rodadas;
    const i = rs.findIndex((r) => r.pontos == null);
    if (i < 0) return null;
    return { ...rs[i], indice: i };
  }
  if (!livreAtual) livreAtual = { ...sortearRodada(itens, Math.random), palpite: null, pontos: null };
  return livreAtual;
}

function novaRodada() {
  rodada = rodadaAtual();
  if (rodada) {
    rodada.chute = porId.get(rodada.ref).altura; // começa do tamanho da referência
    rodada.dx = 0; // deslocamento da figura vermelha (arrastada para os lados)
    rodada.sobre = false; // vermelha centralizada em cima da azul
  }
}

// ------------------------------------------------------------------ tela

function render() {
  const inicio = modo === 'diario' && ranq && !srv;
  const fim = modo === 'diario' && !inicio && (diaFim() || !rodada) && !rodada?.mostrando;
  const status = modo === 'diario'
    ? `<span>Rodada <b>${Math.min(RODADAS, feitas() + (rodada?.mostrando ? 0 : 1))}/${RODADAS}</b></span><span class="esc-dots">${rodadasDia().map((r, i) => `<i class="${r.pontos != null ? quadradoCls(r.pontos) : i === feitas() ? 'agora' : ''}"></i>`).join('')}</span><span>⭐ <b>${totalDia()}</b></span>`
    : `<span>Rodadas: <b>${save.livre.jogadas}</b></span><span>Média: <b>${save.livre.jogadas ? Math.round(save.livre.soma / save.livre.jogadas) : '—'}</b></span>`;
  app.innerHTML = `
    <header class="esc-head">
      <div class="esc-tabs" role="tablist">
        <button type="button" role="tab" data-modo="diario" class="${modo === 'diario' ? 'on' : ''}">${ranq ? 'Ranqueada' : 'Diário'}</button>
        <button type="button" role="tab" data-modo="livre" class="${modo === 'livre' ? 'on' : ''}">Livre</button>
      </div>
      <h1 class="esc-title display">Na Medida</h1>
      <div class="esc-status">${status}</div>
      <button type="button" class="esc-ajuda" data-act="ajuda" aria-label="Como jogar">?</button>
    </header>
    ${inicio ? telaInicio() : fim ? telaFim() : telaRodada()}`;
  if (!fim && !inicio) desenharPalco();
}

// Antes de começar a ranqueada do dia.
function telaInicio() {
  return `<section class="esc-fim esc-inicio">
      <p class="eyebrow">Ranqueada de hoje</p>
      <h2 class="display">${RODADAS} rodadas · 1 chance por dia</h2>
      <ul class="esc-regras">
        <li>Cada rodada tem <b>1 minuto</b>. Acabou o tempo, vale o tamanho em que a figura estiver.</li>
        <li>No fim, a <b>média</b> das ${RODADAS} rodadas vira PDR.</li>
        <li>Se não terminar até a meia-noite, o que faltar vale 0.</li>
      </ul>
      <div class="esc-fim-acoes">
        <button type="button" class="esc-confirmar" data-act="comecar" ${enviando ? 'disabled' : ''}>${enviando ? 'Começando…' : 'Ranqueada'}</button>
        <button type="button" class="esc-sec" data-modo="livre">Modo Livre</button>
      </div>
    </section>`;
}

const quadradoCls = (p) => (p >= 80 ? 'q-verde' : p >= 50 ? 'q-amarelo' : p >= 25 ? 'q-laranja' : 'q-vermelho');

function telaRodada() {
  const ref = porId.get(rodada.ref);
  const alvo = porId.get(rodada.alvo);
  const mostrando = rodada.mostrando;
  return `
    <section class="esc-cards">
      <div class="esc-card ref"><small>Referência</small><b>${esc(ref.nome)}</b><span>${mostrando ? `Altura ${fmtAltura(ref.altura)}` : 'Altura ?'}</span></div>
      <div class="esc-card alvo"><small>Ajuste o tamanho</small><b>${esc(alvo.nome)}</b><span>${mostrando ? `Altura ${fmtAltura(alvo.altura)}` : 'Altura ?'}</span></div>
    </section>
    <section class="esc-palco${mostrando ? ' revelado' : ''}" data-palco aria-label="Comparação de tamanhos">
      <div class="esc-chao"></div>
      <div class="esc-figs" data-figs></div>
      ${mostrando ? '' : '<p class="esc-dica"><span class="longa">Arraste o vermelho para mover · arraste fora dele para mudar o tamanho</span><span class="curta">Arraste o vermelho para mover · fora dele, o tamanho</span></p>'}
    </section>
    ${mostrando ? painelResultado(ref, alvo) : controles(ref)}`;
}

function controles(ref) {
  const v = Math.round((Math.log(rodada.chute / ref.altura) / Math.log(LIMITE)) * 1000);
  return `<section class="esc-ctrl">
      <button type="button" class="esc-btn" data-act="menos" aria-label="Diminuir">−</button>
      <input type="range" min="-1000" max="1000" step="1" value="${v}" data-slider aria-label="Tamanho" />
      <button type="button" class="esc-btn" data-act="mais" aria-label="Aumentar">+</button>
      <button type="button" class="esc-btn esc-sobrepor" data-act="sobrepor" aria-label="Sobrepor ou separar as figuras" title="Sobrepor / separar">${rodada.sobre ? '↔' : '⇄'}</button>
    </section>
    <div class="esc-acoes">
      <span class="esc-chute">Vermelho: <b data-chute>${fmtRazao(rodada.chute / ref.altura)}</b> o azul${rodada.prazo ? ` · <span class="esc-tempo" data-tempo>${tempoRestante()}s</span>` : ''}</span>
      <button type="button" class="esc-confirmar" data-act="confirmar" ${enviando ? 'disabled' : ''}>${enviando ? 'Conferindo…' : '✓ Confirmar'}</button>
    </div>
    <p class="esc-teclado muted small">Teclado: ← → ou ↑ ↓ para ajustar (Shift para ajuste fino), Enter para confirmar.</p>`;
}

// Ranqueada encerrada: PDR do dia, fixo na tela (o aviso some sozinho).
function caixaPdr() {
  if (!ranq || srv?.status !== 'terminou' || srv.pdr == null) return '';
  const v = srv.pdr;
  const d = eloAgora ? divisaoDe(eloAgora.pts, eloAgora.elo) : null;
  return `<section class="esc-rk ${v > 0 ? 'ganhou' : v < 0 ? 'perdeu' : ''}">
      <p class="esc-rk-pdr">${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)}<small>PDR</small></p>
      <div class="esc-rk-txt">
        <b>Ranqueada de hoje</b>
        <span>Média ${Number(srv.media).toLocaleString(localeAtual())}/100 nas ${RODADAS} rodadas</span>
        ${d ? `<span class="esc-rk-elo">${emblemaHtml(d.elo, 22)} Agora: ${eloTexto(eloAgora)}</span>` : ''}
      </div>
      <a class="esc-rk-link" href="/ranking/">Ver ranking →</a>
    </section>`;
}

function painelResultado(ref, alvo) {
  const p = rodada.pontos;
  const ultima = modo === 'diario' && feitas() >= RODADAS;
  return `<div class="esc-acoes"><span></span>
      <button type="button" class="esc-confirmar" data-act="proxima">${ultima ? 'Ver resultado do dia →' : 'Próxima →'}</button></div>
    ${caixaPdr()}
    <section class="esc-res">
      <div class="esc-res-top"><span class="esc-pts ${quadradoCls(p)}">${p}<small>/100</small></span>
        <div><b>${rodada.esgotou ? 'Tempo esgotado' : veredito(p)}</b><p>${rodada.esgotou ? 'A resposta chegou depois de 1 minuto.' : diferenca(rodada.palpite, alvo.altura)}</p></div></div>
      <ul>
        <li><span>Tamanho real · ${esc(ref.nome)}</span><b>Altura ${fmtAltura(ref.altura)}</b></li>
        <li><span>Tamanho real · ${esc(alvo.nome)}</span><b>Altura ${fmtAltura(alvo.altura)}</b></li>
        <li><span>Seu palpite</span><b>Altura ${fmtAltura(rodada.palpite)}</b></li>
        <li><span>Proporção real</span><b>${esc(proporcao(alvo, ref))}</b></li>
        <li class="esc-fonte"><span>Fonte da altura de ${esc(alvo.nome)}</span><b>${esc(CONF[alvo.confianca] || alvo.confianca)}${alvo.nota ? ` · ${esc(alvo.nota)}` : ''}</b></li>
      </ul>
    </section>`;
}

function telaFim() {
  const total = totalDia();
  const rs = rodadasDia();
  const linhas = rs.map((r, i) => {
    const a = porId.get(r.alvo);
    const b = porId.get(r.ref);
    return `<li><span class="esc-n">${i + 1}</span><span>${esc(a?.nome || '—')} <small class="muted">vs ${esc(b?.nome || '—')}</small></span><b class="${quadradoCls(r.pontos || 0)}">${r.pontos ?? 0}</b></li>`;
  }).join('');
  return `<section class="esc-fim">
      <p class="eyebrow">${ranq ? 'Ranqueada de hoje' : 'Resultado do dia'}</p>
      <p class="esc-total display">${total}<small>/${RODADAS * 100}</small></p>
      ${caixaPdr()}
      <p class="esc-quads">${rs.map((r) => quadrado(r.pontos || 0)).join('')}</p>
      <ol class="esc-lista">${linhas}</ol>
      <div class="esc-fim-acoes">
        <button type="button" class="esc-confirmar" data-act="compartilhar">Compartilhar</button>
        <button type="button" class="esc-sec" data-modo="livre">Jogar no modo Livre</button>
      </div>
      <p class="muted small">Novas rodadas em <b data-cd>${fmtCountdown(msToNextDay())}</b></p>
    </section>`;
}

// Figuras no palco, as duas apoiadas no chão; a escala se ajusta para a
// maior caber.
function desenharPalco() {
  const palco = app.querySelector('[data-palco]');
  const figs = app.querySelector('[data-figs]');
  if (!palco || !figs) return;
  const ref = porId.get(rodada.ref);
  const alvo = porId.get(rodada.alvo);
  const mostrando = rodada.mostrando;
  const hRed = mostrando ? alvo.altura : rodada.chute;
  const maior = Math.max(ref.altura, hRed, mostrando ? rodada.palpite : 0);
  const util = Math.max(120, palco.clientHeight - 74);
  let k = util / maior; // pixels por metro
  // Também precisa caber na largura (figuras largas, celular).
  const larguras = ref.altura * ref.prop + hRed * alvo.prop + (mostrando ? rodada.palpite * alvo.prop : 0);
  const folga = mostrando ? 150 : 110; // réguas, espaços e margens
  const precisa = larguras * k + folga;
  if (precisa > palco.clientWidth) k *= Math.max(0.15, (palco.clientWidth - folga) / (precisa - folga));
  const fig = (it, h, cls) => {
    const ph = Math.max(3, h * k);
    const pw = Math.max(2, ph * it.prop);
    return `<div class="esc-sil ${cls}" style="width:${pw}px;height:${ph}px;--img:url('${SIL}${it.id}.webp?v=${it.v}')"></div>`;
  };
  const colRef = `<div class="esc-col ref"><p class="esc-rot"><b>${esc(ref.nome)}</b><span>${mostrando ? `Altura ${fmtAltura(ref.altura)}` : 'Altura ?'}</span></p>
      <div class="esc-fig"><i class="esc-regua" style="height:${Math.max(3, ref.altura * k)}px"></i>${fig(ref, ref.altura, 'azul')}</div></div>`;
  let colAlvo;
  if (mostrando) {
    // Resultado: o tamanho real e o palpite lado a lado.
    colAlvo = `<div class="esc-col alvo"><p class="esc-rot"><b>${esc(alvo.nome)}</b><span>Altura ${fmtAltura(alvo.altura)}</span></p>
      <div class="esc-fig">${fig(alvo, alvo.altura, 'vermelho')}<i class="esc-regua v" style="height:${Math.max(3, alvo.altura * k)}px"></i></div></div>
      <div class="esc-col palpite"><p class="esc-rot"><b>Seu palpite</b><span>Altura ${fmtAltura(rodada.palpite)}</span></p>
      <div class="esc-fig"><div class="esc-fantasma" title="Seu palpite">${fig(alvo, rodada.palpite, 'fantasma')}</div></div></div>`;
  } else {
    colAlvo = `<div class="esc-col alvo"><p class="esc-rot"><b>${esc(alvo.nome)}</b><span>Altura ?</span></p>
      <div class="esc-fig"><div class="esc-caixa">${fig(alvo, hRed, 'vermelho')}<i class="esc-alca" aria-hidden="true">⤢</i></div></div></div>`;
  }
  figs.innerHTML = colRef + colAlvo;
  posicionar();
}

// Aplica o deslocamento da figura vermelha, sem deixar sair do palco, e
// marca quando ela está por cima da azul.
function posicionar() {
  const palco = app.querySelector('[data-palco]');
  const col = app.querySelector('.esc-col.alvo');
  if (!palco || !col || !rodada) return;
  if (rodada.sobre) {  // mantém centralizada em cima da azul, mesmo mudando o tamanho
    col.style.transform = '';
    const az = app.querySelector('.esc-sil.azul')?.getBoundingClientRect();
    const vm = col.querySelector('.esc-sil.vermelho')?.getBoundingClientRect();
    if (az && vm) rodada.dx = (az.left + az.width / 2) - (vm.left + vm.width / 2);
  }
  const dx = rodada.dx || 0;
  col.style.transform = dx ? `translateX(${dx}px)` : '';
  const p = palco.getBoundingClientRect();
  const c = col.querySelector('.esc-sil.vermelho')?.getBoundingClientRect() || col.getBoundingClientRect();
  let ajuste = 0;
  if (c.left < p.left + 4) ajuste = p.left + 4 - c.left;
  else if (c.right > p.right - 4) ajuste = p.right - 4 - c.right;
  if (ajuste && c.width < p.width - 8) {
    rodada.dx = dx + ajuste;
    col.style.transform = `translateX(${rodada.dx}px)`;
  }
  const azul = app.querySelector('.esc-sil.azul')?.getBoundingClientRect();
  const verm = col.querySelector('.esc-sil.vermelho')?.getBoundingClientRect();
  const sobre = Boolean(azul && verm && verm.left < azul.right && verm.right > azul.left);
  palco.classList.toggle('sobreposto', sobre);
}

// Centro da vermelha em cima do centro da azul (ou volta para o lado).
function sobrepor() {
  if (!rodada || rodada.mostrando) return;
  rodada.sobre = !rodada.sobre;
  if (!rodada.sobre) rodada.dx = 0;
  const b = app.querySelector('[data-act="sobrepor"]');
  if (b) b.textContent = rodada.sobre ? '↔' : '⇄';
  posicionar();
}

// ------------------------------------------------------------------ ajuste

function ajustar(fator) {
  const ref = porId.get(rodada.ref);
  const min = ref.altura / LIMITE;
  const max = ref.altura * LIMITE;
  rodada.chute = Math.min(max, Math.max(min, rodada.chute * fator));
  const s = app.querySelector('[data-slider]');
  if (s) s.value = Math.round((Math.log(rodada.chute / ref.altura) / Math.log(LIMITE)) * 1000);
  const c = app.querySelector('[data-chute]');
  if (c) c.textContent = fmtRazao(rodada.chute / ref.altura);
  desenharPalco();
}

function tempoRestante() {
  return Math.max(0, Math.ceil(((rodada?.prazo || 0) - Date.now()) / 1000));
}

// Ranqueada: o palpite vai para o servidor, que devolve a nota e as alturas.
async function confirmarServidor() {
  if (enviando) return;
  const ref = porId.get(rodada.ref);
  const indice = rodada.indice;
  enviando = true;
  render();
  try {
    srv = await platform.escalaPalpite(indice, rodada.chute / ref.altura);
  } catch (e) {
    enviando = false;
    aviso(e.message);
    // Fora de sincronia (ex.: outra aba): recarrega o estado do servidor.
    try { srv = await platform.escalaAbrir(false); } catch { /* sem servidor */ }
    novaRodada();
    render();
    return;
  }
  enviando = false;
  if (srv.reiniciada) {
    aviso('A conexão demorou: a rodada recomeçou com outra comparação.', 7000);
    novaRodada();
    render();
    return;
  }
  const r = srv.rodadas[indice];
  // As alturas que valem são as do servidor.
  const a = porId.get(r.alvo);
  const b = porId.get(r.ref);
  if (a && r.alvo_altura) a.altura = Number(r.alvo_altura);
  if (b && r.ref_altura) b.altura = Number(r.ref_altura);
  Object.assign(rodada, { palpite: Number(r.palpite), pontos: r.pontos, esgotou: r.esgotou, mostrando: true, dx: 0, sobre: false, prazo: null });
  if (indice === 0) platform.track('game_start', GAME_ID, { day: hoje, modo: 'ranqueada' });
  if (srv.status === 'terminou') terminarDia();
  render();
}

function confirmar() {
  if (!rodada || rodada.mostrando) return;
  if (modo === 'diario' && ranq) {
    confirmarServidor();
    return;
  }
  const alvo = porId.get(rodada.alvo);
  rodada.palpite = rodada.chute;
  rodada.pontos = pontos(rodada.palpite, alvo.altura, razaoDe(porId.get(rodada.ref), alvo));
  rodada.mostrando = true;
  rodada.dx = 0; // no resultado, as figuras voltam lado a lado
  rodada.sobre = false;
  if (modo === 'diario') {
    const r = save.diario.rodadas[rodada.indice];
    r.palpite = Math.round(rodada.palpite * 1000) / 1000;
    r.pontos = rodada.pontos;
    if (feitas() === 1) platform.track('game_start', GAME_ID, { day: hoje, modo: 'diario' });
    if (diaFim()) terminarDia();
  } else {
    save.livre.jogadas += 1;
    save.livre.soma += rodada.pontos;
    save.livre.melhor = Math.max(save.livre.melhor, rodada.pontos);
    if (save.livre.jogadas % 5 === 0) platform.passeRodadaLivre(GAME_ID).then(() => liberarAbobora()); // abóboras do passe a cada 5 rodadas
  }
  guardar(modo === 'diario' && diaFim());
  render();
}


function terminarDia() {
  const total = totalDia();
  const pdr = ranq ? srv?.pdr ?? null : null;
  platform.track('game_end', GAME_ID, { day: hoje, modo: ranq ? 'ranqueada' : 'diario', total });
  platform.recordResult(GAME_ID, {
    score: total,
    summary: {
      text: `Dia ${hoje + 1} · ${total}/${RODADAS * 100} · ${rodadasDia().map((r) => quadrado(r.pontos || 0)).join('')}${pdr != null ? ` · ${pdr > 0 ? '+' : ''}${pdr} PDR` : ''}`,
      day: hoje + 1, modo: ranq ? 'ranqueada' : 'diario', total, pdr,
    },
  });
  if (ranq) {
    avisoDiario(srv);
    platform.rankedStatus().then((d) => {
      eloAgora = d;
      if (rodada?.mostrando || diaFim()) render();
    }).catch(() => {});
  }
}

async function comecar() {
  if (enviando || srv) return;
  enviando = true;
  render();
  try {
    srv = await platform.escalaAbrir(true);
  } catch (e) {
    aviso(e.message);
  }
  enviando = false;
  novaRodada();
  render();
}

function proxima() {
  if (modo === 'livre') livreAtual = null;
  novaRodada();
  render();
}

// ------------------------------------------------------------------ janelas

let modal = null;
function abrirModal(html) {
  fecharModal();
  modal = document.createElement('div');
  modal.className = 'esc-modal-fundo';
  modal.innerHTML = `<div class="esc-modal" role="dialog" aria-modal="true"><button type="button" class="esc-fechar" data-fechar aria-label="Fechar">×</button>${html}</div>`;
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-fechar]')) fecharModal();
  });
  document.body.append(modal);
}
function fecharModal() {
  modal?.remove();
  modal = null;
}

function ajuda() {
  abrirModal(`<h2 class="display">Como jogar</h2>
    <p>A figura <b class="azul-txt">azul</b> é a referência e está no tamanho real dela. Ajuste a figura <b class="verm-txt">vermelha</b> até ela ficar no tamanho que você acha certo <b>em relação à azul</b>.</p>
    <p>Arraste para cima ou para baixo, use a barra ou os botões − e +. Depois confirme.</p>
    <p>Quanto mais perto da proporção real, mais pontos ganhará.</p>
    <p>${ranq ? '<b>Ranqueada:</b> uma partida com 5 rodadas por dia, 1 minuto cada, valendo PDR.' : '<b>Diário:</b> uma partida com 5 rodadas por dia. Com a conta conectada, ela vira a Ranqueada e vale PDR.'}</p>
    <p class="muted small">As alturas são baseadas em alguns dados públicos da lore do universo de Runeterra e especulações da comunidade.</p>`);
}

function textoCompartilhar() {
  return `${NAME} · dia ${hoje + 1}\n${totalDia()}/${RODADAS * 100}\n${rodadasDia().map((r) => quadrado(r.pontos || 0)).join('')}\nriftarcade.com.br/jogos/escala/`;
}

async function compartilhar() {
  const t = textoCompartilhar();
  try {
    if (navigator.share) await navigator.share({ text: t });
    else {
      await navigator.clipboard.writeText(t);
      aviso('Resultado copiado!');
    }
  } catch { /* cancelou */ }
}

let avisoTimer = null;
function aviso(msg, ms = 1800) {
  let el = document.querySelector('.esc-aviso');
  if (!el) {
    el = document.createElement('div');
    el.className = 'esc-aviso';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ------------------------------------------------------------------ eventos

app.addEventListener('click', (e) => {
  const m = e.target.closest('[data-modo]');
  if (m && m.dataset.modo !== modo) {
    modo = m.dataset.modo;
    novaRodada();
    render();
    return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'menos') ajustar(e.shiftKey ? 1 / 1.01 : 1 / 1.06);
  else if (act === 'mais') ajustar(e.shiftKey ? 1.01 : 1.06);
  else if (act === 'confirmar') confirmar();
  else if (act === 'proxima') proxima();
  else if (act === 'sobrepor') sobrepor();
  else if (act === 'ajuda') ajuda();
  else if (act === 'compartilhar') compartilhar();
  else if (act === 'comecar') comecar();
});

app.addEventListener('input', (e) => {
  if (!e.target.matches('[data-slider]') || !rodada || rodada.mostrando) return;
  const ref = porId.get(rodada.ref);
  rodada.chute = ref.altura * LIMITE ** (Number(e.target.value) / 1000);
  ajustar(1);
});

// Arrastar no palco: para cima aumenta, para baixo diminui.
let arrasto = null;
app.addEventListener('pointerdown', (e) => {
  const palco = e.target.closest('[data-palco]');
  if (!palco || !rodada || rodada.mostrando) return;
  // Em cima da figura vermelha (fora da bolinha): move para os lados.
  const mover = Boolean(e.target.closest('.esc-caixa')) && !e.target.closest('.esc-alca');
  arrasto = { x: e.clientX, y: e.clientY, chute: rodada.chute, dx: rodada.dx || 0, mover, id: e.pointerId };
  palco.setPointerCapture(e.pointerId);
  palco.classList.add('arrastando');
});
app.addEventListener('pointermove', (e) => {
  if (!arrasto || e.pointerId !== arrasto.id) return;
  if (arrasto.mover) {
    rodada.sobre = false;
    rodada.dx = arrasto.dx + (e.clientX - arrasto.x);
    posicionar();
    const b = app.querySelector('[data-act="sobrepor"]');
    if (b) b.textContent = '⇄';
    return;
  }
  const ref = porId.get(rodada.ref);
  const fator = Math.exp((arrasto.y - e.clientY) * 0.006);
  rodada.chute = arrasto.chute;
  ajustar(fator);
  if (rodada.chute <= ref.altura / LIMITE || rodada.chute >= ref.altura * LIMITE) {
    arrasto.chute = rodada.chute;
    arrasto.y = e.clientY;
  }
});
const soltar = () => {
  if (!arrasto) return;
  arrasto = null;
  app.querySelector('[data-palco]')?.classList.remove('arrastando');
};
app.addEventListener('pointerup', soltar);
app.addEventListener('pointercancel', soltar);

document.addEventListener('keydown', (e) => {
  if (modal) {
    if (e.key === 'Escape') fecharModal();
    return;
  }
  if (!rodada || e.target.closest('input:not([data-slider]), textarea')) return;
  if (rodada.mostrando) {
    if (e.key === 'Enter') proxima();
    return;
  }
  if (e.target.matches('[data-slider]') && e.key.startsWith('Arrow')) return; // a barra já cuida
  const fino = e.shiftKey;
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); ajustar(fino ? 1.01 : 1.06); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); ajustar(fino ? 1 / 1.01 : 1 / 1.06); }
  if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
});

addEventListener('resize', () => { if (rodada) desenharPalco(); });
setInterval(async () => {
  app.querySelectorAll('[data-cd]').forEach((el) => { el.textContent = fmtCountdown(msToNextDay()); });
  // Ranqueada: cronômetro da rodada; no zero, vale o tamanho em que estiver.
  if (rodada?.prazo && !rodada.mostrando) {
    const t = tempoRestante();
    const el = app.querySelector('[data-tempo]');
    if (el) {
      el.textContent = `${t}s`;
      el.classList.toggle('pouco', t <= 10);
    }
    if (t <= 0 && !enviando) confirmar();
  }
  if (dayIndex() !== hoje && !rodada?.mostrando && !enviando) {
    hoje = dayIndex();
    carregarSave();
    if (ranq) {
      try { srv = await platform.escalaAbrir(false); } catch { srv = null; }
    }
    novaRodada();
    render();
  }
}, 1000);

// ------------------------------------------------------------------ início

// Com conta e servidor: o diário vira a ranqueada (conferida no servidor).
// Se o servidor não responder, joga o diário deste aparelho (sem PDR).
async function carregarRanqueada() {
  ranq = false;
  srv = null;
  await platform.init();
  if (!platform.diarioNoServidor()) return;
  try {
    srv = await platform.escalaAbrir(false);
    ranq = true;
    if (srv?.status === 'terminou') eloAgora = await platform.rankedStatus().catch(() => null);
  } catch (e) {
    console.warn('Escala: ranqueada indisponível, jogando sem PDR.', e.message);
  }
}

// Entrou ou saiu da conta.
platform.onChange(async (evt) => {
  if (evt.type !== 'auth' || enviando || (rodada && !rodada.mostrando && rodada.prazo)) return;
  const antes = ranq;
  await carregarRanqueada();
  if (antes === ranq && !ranq) return;
  novaRodada();
  render();
});

async function iniciar() {
  app.innerHTML = '<p class="muted">Carregando…</p>';
  await carregarDados();
  carregarSave();
  await carregarRanqueada();
  // Já terminou o diário hoje: abre direto no resultado.
  novaRodada();
  render();
  if (ranq && srv?.reiniciada) aviso('A conexão demorou: a rodada recomeçou com outra comparação.', 7000);
  if (!platform.loadLocalSave(GAME_ID)) ajuda();
  guardar();
}

iniciar();
