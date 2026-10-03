// Escala de Runeterra: a figura azul tem tamanho fixo; o jogador ajusta o
// tamanho da vermelha até achar que está na proporção certa.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { msToNextDay, fmtCountdown } from '../../../shared/diario.js';
import {
  RODADAS, dayIndex, pontos, veredito, diferenca, rng, sortearRodada, rodadasDoDia,
  fmtAltura, proporcao, quadrado,
} from './logic.js';

const GAME_ID = 'escala';
const NAME = 'Escala de Runeterra';
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

// ------------------------------------------------------------------ dados

async function carregarDados() {
  const [lista, props] = await Promise.all([
    fetch('dados/itens.json').then((r) => r.json()),
    fetch('dados/silhuetas.json').then((r) => r.json()),
  ]);
  itens = lista.filter((i) => props[i.id] && i.altura > 0).map((i) => ({ ...i, prop: props[i.id] }));
  porId = new Map(itens.map((i) => [i.id, i]));
}

function carregarSave() {
  const s = platform.loadLocalSave(GAME_ID);
  save = { v: 1, diario: null, livre: { jogadas: 0, soma: 0, melhor: 0 }, ...(s && s.v === 1 ? s : {}) };
  if (!save.diario || save.diario.dia !== hoje || !Array.isArray(save.diario.rodadas)) {
    save.diario = { dia: hoje, rodadas: rodadasDoDia(itens, hoje).map((r) => ({ ...r, palpite: null, pontos: null })) };
  }
  // Se a tabela mudou e algum item sumiu, refaz o dia.
  if (save.diario.rodadas.some((r) => !porId.has(r.ref) || !porId.has(r.alvo))) {
    save.diario = { dia: hoje, rodadas: rodadasDoDia(itens, hoje).map((r) => ({ ...r, palpite: null, pontos: null })) };
  }
}
const guardar = (urgente = false) => platform.writeSave(GAME_ID, save, { urgent: urgente });

const feitas = () => save.diario.rodadas.filter((r) => r.pontos != null).length;
const totalDia = () => save.diario.rodadas.reduce((t, r) => t + (r.pontos || 0), 0);
const diaFim = () => feitas() >= RODADAS;

// Rodada em jogo (ou a última respondida, mostrando o resultado).
function rodadaAtual() {
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
  if (rodada) rodada.chute = porId.get(rodada.ref).altura; // começa do tamanho da referência
}

// ------------------------------------------------------------------ tela

function render() {
  const fim = modo === 'diario' && diaFim() && !rodada?.mostrando;
  const status = modo === 'diario'
    ? `<span>Rodada <b>${Math.min(RODADAS, feitas() + (rodada?.mostrando ? 0 : 1))}/${RODADAS}</b></span><span class="esc-dots">${save.diario.rodadas.map((r, i) => `<i class="${r.pontos != null ? quadradoCls(r.pontos) : i === feitas() ? 'agora' : ''}"></i>`).join('')}</span><span>⭐ <b>${totalDia()}</b></span>`
    : `<span>Rodadas: <b>${save.livre.jogadas}</b></span><span>Média: <b>${save.livre.jogadas ? Math.round(save.livre.soma / save.livre.jogadas) : '—'}</b></span>`;
  app.innerHTML = `
    <header class="esc-head">
      <div class="esc-tabs" role="tablist">
        <button type="button" role="tab" data-modo="diario" class="${modo === 'diario' ? 'on' : ''}">Diário</button>
        <button type="button" role="tab" data-modo="livre" class="${modo === 'livre' ? 'on' : ''}">Livre</button>
      </div>
      <h1 class="esc-title display">Escala de Runeterra</h1>
      <div class="esc-status">${status}</div>
      <button type="button" class="esc-ajuda" data-act="ajuda" aria-label="Como jogar">?</button>
    </header>
    ${fim ? telaFim() : telaRodada()}`;
  if (!fim) desenharPalco();
}

const quadradoCls = (p) => (p >= 80 ? 'q-verde' : p >= 50 ? 'q-amarelo' : p >= 25 ? 'q-laranja' : 'q-vermelho');

function telaRodada() {
  const ref = porId.get(rodada.ref);
  const alvo = porId.get(rodada.alvo);
  const mostrando = rodada.mostrando;
  return `
    <section class="esc-cards">
      <div class="esc-card ref"><small>Referência</small><b>${esc(ref.nome)}</b><span>Altura ${fmtAltura(ref.altura)}</span></div>
      <div class="esc-card alvo"><small>Ajuste o tamanho</small><b>${esc(alvo.nome)}</b><span>${mostrando ? `Altura ${fmtAltura(alvo.altura)}` : 'Altura ?'}</span></div>
    </section>
    <section class="esc-palco${mostrando ? ' revelado' : ''}" data-palco aria-label="Comparação de tamanhos">
      <div class="esc-chao"></div>
      <div class="esc-figs" data-figs></div>
      ${mostrando ? '' : '<p class="esc-dica">Arraste para cima ou para baixo</p>'}
    </section>
    ${mostrando ? painelResultado(ref, alvo) : controles(ref)}`;
}

function controles(ref) {
  const v = Math.round((Math.log(rodada.chute / ref.altura) / Math.log(LIMITE)) * 1000);
  return `<section class="esc-ctrl">
      <button type="button" class="esc-btn" data-act="menos" aria-label="Diminuir">−</button>
      <input type="range" min="-1000" max="1000" step="1" value="${v}" data-slider aria-label="Tamanho" />
      <button type="button" class="esc-btn" data-act="mais" aria-label="Aumentar">+</button>
    </section>
    <div class="esc-acoes">
      <span class="esc-chute">Seu palpite: <b data-chute>${fmtAltura(rodada.chute)}</b></span>
      <button type="button" class="esc-confirmar" data-act="confirmar">✓ Confirmar</button>
    </div>
    <p class="esc-teclado muted small">Teclado: ← → ou ↑ ↓ para ajustar (Shift para ajuste fino), Enter para confirmar.</p>`;
}

function painelResultado(ref, alvo) {
  const p = rodada.pontos;
  const ultima = modo === 'diario' && feitas() >= RODADAS;
  return `<div class="esc-acoes"><span></span>
      <button type="button" class="esc-confirmar" data-act="proxima">${ultima ? 'Ver resultado do dia →' : 'Próxima →'}</button></div>
    <section class="esc-res">
      <div class="esc-res-top"><span class="esc-pts ${quadradoCls(p)}">${p}<small>/100</small></span>
        <div><b>${veredito(p)}</b><p>${diferenca(rodada.palpite, alvo.altura)}</p></div></div>
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
  const linhas = save.diario.rodadas.map((r, i) => {
    const a = porId.get(r.alvo);
    const b = porId.get(r.ref);
    return `<li><span class="esc-n">${i + 1}</span><span>${esc(a.nome)} <small class="muted">vs ${esc(b.nome)}</small></span><b class="${quadradoCls(r.pontos)}">${r.pontos}</b></li>`;
  }).join('');
  return `<section class="esc-fim">
      <p class="eyebrow">Resultado do dia</p>
      <p class="esc-total display">${total}<small>/${RODADAS * 100}</small></p>
      <p class="esc-quads">${save.diario.rodadas.map((r) => quadrado(r.pontos)).join('')}</p>
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
  const k = util / maior; // pixels por metro
  const fig = (it, h, cls) => {
    const ph = Math.max(3, h * k);
    const pw = Math.max(2, ph * it.prop);
    return `<div class="esc-sil ${cls}" style="width:${pw}px;height:${ph}px;--img:url('${SIL}${it.id}.webp')"></div>`;
  };
  const colRef = `<div class="esc-col ref"><p class="esc-rot"><b>${esc(ref.nome)}</b><span>Altura ${fmtAltura(ref.altura)}</span></p>
      <div class="esc-fig"><i class="esc-regua" style="height:${Math.max(3, ref.altura * k)}px"></i>${fig(ref, ref.altura, 'azul')}</div></div>`;
  let colAlvo;
  if (mostrando) {
    const fantasma = fig(alvo, rodada.palpite, 'fantasma');
    colAlvo = `<div class="esc-col alvo"><p class="esc-rot"><b>${esc(alvo.nome)}</b><span>Altura ${fmtAltura(alvo.altura)}</span></p>
      <div class="esc-fig">${fig(alvo, alvo.altura, 'vermelho')}<i class="esc-regua v" style="height:${Math.max(3, alvo.altura * k)}px"></i>
        <div class="esc-fantasma" title="Seu palpite">${fantasma}</div></div></div>`;
  } else {
    colAlvo = `<div class="esc-col alvo"><p class="esc-rot"><b>${esc(alvo.nome)}</b><span>Altura ?</span></p>
      <div class="esc-fig"><div class="esc-caixa">${fig(alvo, hRed, 'vermelho')}<i class="esc-alca" aria-hidden="true">⤢</i></div></div></div>`;
  }
  figs.innerHTML = colRef + colAlvo;
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
  if (c) c.textContent = fmtAltura(rodada.chute);
  desenharPalco();
}

function confirmar() {
  if (!rodada || rodada.mostrando) return;
  const alvo = porId.get(rodada.alvo);
  rodada.palpite = rodada.chute;
  rodada.pontos = pontos(rodada.palpite, alvo.altura);
  rodada.mostrando = true;
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
  }
  guardar(modo === 'diario' && diaFim());
  render();
}

function terminarDia() {
  const total = totalDia();
  platform.track('game_end', GAME_ID, { day: hoje, modo: 'diario', total });
  platform.recordResult(GAME_ID, {
    score: total,
    summary: { text: `Dia ${hoje + 1} · ${total}/${RODADAS * 100} · ${save.diario.rodadas.map((r) => quadrado(r.pontos)).join('')}`, day: hoje + 1, modo: 'diario', total },
  });
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
    <p>A figura <b class="azul-txt">azul</b> é a referência e tem a altura real dela. Ajuste a figura <b class="verm-txt">vermelha</b> até ela ficar no tamanho que você acha certo <b>em relação à azul</b>.</p>
    <p>Arraste para cima ou para baixo, use a barra ou os botões − e +. Depois confirme.</p>
    <p>Quanto mais perto da proporção real, mais pontos (até 100 por rodada). Errar 20% para mais ou para menos vale o mesmo.</p>
    <p><b>Diário:</b> ${RODADAS} rodadas por dia, iguais para todo mundo. <b>Livre:</b> rodadas sem fim.</p>
    <p class="muted small">As alturas são as de Runeterra (lore), do pé ao ponto mais alto. A Riot quase nunca publica alturas, então a maioria é estimativa da comunidade. As silhuetas vêm dos modelos do jogo.</p>`);
}

function textoCompartilhar() {
  return `${NAME} · dia ${hoje + 1}\n${totalDia()}/${RODADAS * 100}\n${save.diario.rodadas.map((r) => quadrado(r.pontos)).join('')}\nriftarcade.com.br/jogos/escala/`;
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
function aviso(msg) {
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
  avisoTimer = setTimeout(() => { el.hidden = true; }, 1800);
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
  else if (act === 'ajuda') ajuda();
  else if (act === 'compartilhar') compartilhar();
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
  arrasto = { y: e.clientY, chute: rodada.chute, id: e.pointerId };
  palco.setPointerCapture(e.pointerId);
  palco.classList.add('arrastando');
});
app.addEventListener('pointermove', (e) => {
  if (!arrasto || e.pointerId !== arrasto.id) return;
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
setInterval(() => {
  app.querySelectorAll('[data-cd]').forEach((el) => { el.textContent = fmtCountdown(msToNextDay()); });
  if (dayIndex() !== hoje && !rodada?.mostrando) {
    hoje = dayIndex();
    carregarSave();
    novaRodada();
    render();
  }
}, 1000);

// ------------------------------------------------------------------ início

async function iniciar() {
  app.innerHTML = '<p class="muted">Carregando…</p>';
  await carregarDados();
  carregarSave();
  // Já terminou o diário hoje: abre direto no resultado.
  novaRodada();
  render();
  if (!platform.loadLocalSave(GAME_ID)) ajuda();
  guardar();
}

iniciar();
