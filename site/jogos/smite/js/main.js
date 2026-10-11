// Desafio do Golpear (Smite Challenge): golpeie (Smite) o objetivo no momento certo. A vida do objetivo
// (Dragão Elemental, Dragão Ancião, Barão Nashor ou Arauto do Vale) cai com o dano dos outros jogadores;
// o Golpear mata se a vida for menor ou igual ao dano dele, e quanto mais perto (para menos), mais pontos.
// Dois times de 4 (topo, selva, meio e atirador); o jogador é o selva do time azul.
// Enquanto o jogo é "oculto" (gameById('smite').soAdmin), só administradores conseguem jogar.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import { t, localeAtual, onLangChange } from '../../../shared/i18n.js';
import {
  OBJETIVOS, RODADAS, TEMPO_MAX, ROTA_NOME, postoHab,
  aleatorio, criarPartida, criarRodada, nomeCampeao,
  novoEstado, avancar, usarHabilidade, soltarHabilidade, estadoQ, usarGolpear,
} from './logic.js';

const GAME_ID = 'smite';
const CHAVE_MELHOR = 'smite.melhor';
const CHAVE_MUDO = 'smite.mudo';
const app = document.getElementById('app');
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString(localeAtual());
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lerLS = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const celular = () => window.matchMedia('(max-width: 760px)').matches;

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

// --------------------------------------------------------------------------- imagens (Data Dragon)
let ddVersion = '14.24.1';
async function versaoDD() {
  const c = lerLS('smite.ddragon');
  if (c && Date.now() - c.at < 864e5) return c.v;
  try {
    const v = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0];
    gravarLS('smite.ddragon', { v, at: Date.now() });
    return v;
  } catch { return null; }
}
const imgCampeao = (id) => `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${id}.png`;
const imgSmite = () => `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/SummonerSmite.png`;

// --------------------------------------------------------------------------- áudio (WebAudio, sem arquivos)
let ctx = null; let mudo = lerLS(CHAVE_MUDO, false);
function audio() {
  if (mudo) return null;
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function nota(freq, t0, dur, { tipo = 'triangle', vol = 0.1, fim = null } = {}) {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = tipo; o.frequency.setValueAtTime(freq, c.currentTime + t0);
  if (fim) o.frequency.exponentialRampToValueAtTime(fim, c.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
  o.connect(g).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05);
}
const SOM = {
  golpe: () => nota(180 + Math.random() * 60, 0, 0.06, { tipo: 'square', vol: 0.025, fim: 90 }),
  hab: () => { nota(500, 0, 0.22, { tipo: 'sawtooth', vol: 0.07, fim: 1300 }); nota(250, 0.05, 0.25, { tipo: 'sine', vol: 0.08 }); },
  smite: () => { nota(120, 0, 0.5, { tipo: 'sawtooth', vol: 0.16, fim: 40 }); nota(900, 0, 0.18, { tipo: 'square', vol: 0.07, fim: 200 }); },
  ok: () => [523, 659, 784, 1047].forEach((f, i) => nota(f, 0.12 + i * 0.1, 0.35, { vol: 0.11 })),
  mau: () => { nota(260, 0.1, 0.5, { tipo: 'sawtooth', vol: 0.1, fim: 80 }); nota(130, 0.25, 0.6, { tipo: 'square', vol: 0.06, fim: 50 }); },
  conta: () => nota(660, 0, 0.12, { tipo: 'square', vol: 0.05 }),
  vai: () => nota(990, 0, 0.3, { tipo: 'square', vol: 0.07 }),
};

// --------------------------------------------------------------------------- cenário e HUD
// Onde cada jogador fica em volta do covil (% do palco): [x, y] no computador e [x, y] no celular.
const FICHAS = {
  voce: [[40, 61], [27, 44]],
  'a-topo': [[30, 33], [13, 33]], 'a-meio': [[24.5, 55], [11, 42]], 'a-atirador': [[28.5, 69], [34, 49]],
  'e-topo': [[66, 24], [86, 31]], 'e-selva': [[83, 40], [91, 39]], 'e-meio': [[85, 62], [86, 47]], 'e-atirador': [[73, 71], [64, 50]],
};
const COR = { azul: '#3fa8ff', vermelho: '#e0352b', voce: '#f5cf5a' };

const AMPULHETA = '<svg viewBox="0 0 32 40" aria-hidden="true"><path d="M5 3h22M5 37h22M8 3c0 10 6 11 8 17-2 6-8 7-8 17M24 3c0 10-6 11-8 17 2 6 8 7 8 17" stroke="#f2d98a" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M11 33c1-4 3-5 5-5s4 1 5 5z" fill="#e0a93a"/></svg>';
const MIRA = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="rgba(4,16,15,0.7)" stroke="#c9961f" stroke-width="3"/>
  <g class="giro"><circle cx="60" cy="60" r="48" fill="none" stroke="rgba(245,207,90,0.5)" stroke-width="1.5" stroke-dasharray="3 7"/>
  <path d="M60 4v10M60 106v10M4 60h10M106 60h10" stroke="#f5cf5a" stroke-width="3"/></g>
</svg>`;

function montar() {
  app.innerHTML = `<div class="sm" id="sm" data-tema="elemental">
    <div class="sm-bg"><img class="sm-cenario" src="img/cenario.webp" alt="" draggable="false" /><div class="sm-nevoa"></div></div>
    <div class="sm-arena">
      <div class="sm-dragao" id="sm-alvo"><img id="sm-alvo-img" alt="" draggable="false" /></div>
      <div id="sm-fichas"></div>
      <div class="sm-voce" id="sm-voce"><img id="sm-voce-img" alt="" /></div>
      <div class="sm-feixe" id="sm-feixe"></div>
    </div>
    <div class="sm-numeros" id="sm-numeros"></div><div class="sm-flash" id="sm-flash"></div><div class="sm-vinheta"></div>
    <div class="sm-top">
      <div class="sm-logo"><span>${t('DESAFIO DO')}</span><b>${t('GOLPEAR')}</b></div>
      <div class="sm-hp"><div class="nome" id="sm-nome-obj">&nbsp;</div>
        <div class="linha"><div class="ico" id="sm-ico"></div><div class="barra"><div class="cheia" id="sm-cheia"></div><i class="marca" id="sm-marca"></i><div class="num" id="sm-vida"></div></div></div></div>
      <div class="sm-tempo" id="sm-tempo">${AMPULHETA}<div><small>${t('Tempo restante')}</small><b id="sm-tempo-n">00:${TEMPO_MAX}</b></div></div>
    </div>
    <aside class="sm-painel sm-dano"><h3>${t('Dano no objetivo')}</h3><ul id="sm-dano"></ul></aside>
    <div class="sm-painel sm-obj"><div class="ico" id="sm-ico2"></div><div><b>${t('Objetivo')}</b><span id="sm-obj-txt"></span></div></div>
    <div class="sm-painel sm-info"><div class="texto"><small>${t('DANO DO')}</small><b>${t('GOLPEAR')}</b></div></div>
    <div class="sm-mira">${MIRA}<b id="sm-dano-smite">900</b></div>
    <div class="sm-hab">
      <div class="fundo"></div>
      <div class="sm-retrato"><img id="sm-retrato" alt="" /></div><span class="sm-nivel" id="sm-nivel">11</span>
      <div class="sm-barras"><div class="v"><i></i><span>1.860 / 2.100</span></div><div class="m"><i></i><span>640 / 890</span></div></div>
      <div class="sm-botoes">
        <button type="button" class="sm-bt q" id="sm-q" aria-label="${t('Habilidade')} (Q)"><span class="quadro"><img id="sm-q-img" alt="" /><span class="recarga" id="sm-q-rec" hidden></span><span class="carga" id="sm-q-carga" hidden><i></i></span><span class="tecla">Q</span></span><span class="nome">${t('Habilidade')}</span></button>
        <button type="button" class="sm-bt f" id="sm-f" aria-label="${t('Golpear')} (F)"><span class="quadro"><img alt="" src="${imgSmite()}" /><span class="valor" id="sm-f-valor"></span><span class="tecla">F</span></span><span class="nome">${t('Golpear')}</span></button>
      </div>
    </div>
    <button type="button" class="sm-som" id="sm-som" aria-label="${t('Som')}"></button>
    <div class="sm-aviso" id="sm-aviso" hidden></div>
    <div class="sm-tela" id="sm-tela" hidden></div>
  </div>`;
  atualizarSom();
  const q = $('sm-q');
  q.addEventListener('pointerdown', (e) => { e.preventDefault(); usarHab(); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) q.addEventListener(ev, soltarHab);
  $('sm-f').addEventListener('click', usarSmite);
  $('sm-som').addEventListener('click', () => { mudo = !mudo; gravarLS(CHAVE_MUDO, mudo); atualizarSom(); });
}
function atualizarSom() { const b = $('sm-som'); if (b) b.textContent = mudo ? '🔇' : '🔊'; }
// o nome do Golpear muda de tamanho conforme o idioma: encolhe a letra até caber no painel
function ajustarGolpear() {
  const info = document.querySelector('.sm-info'), b = info && info.querySelector('.texto b');
  if (!b || !info.clientWidth) return;
  const cs = getComputedStyle(info), livre = info.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  b.style.fontSize = '';
  let px = parseFloat(getComputedStyle(b).fontSize);
  for (let i = 0; i < 30 && b.scrollWidth > livre && px > 6; i++) { px *= 0.94; b.style.fontSize = px + 'px'; }
}
{
  let pend = 0;
  const agenda = () => { if (!pend) pend = requestAnimationFrame(() => { pend = 0; ajustarGolpear(); }); };
  new MutationObserver(agenda).observe(app, { childList: true, characterData: true, subtree: true });
  addEventListener('resize', agenda);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(agenda);
}
let refazerTela = null; // desenha de novo a tela que está aberta (ao trocar de idioma)
function tela(html, refazer = null, leve = false) { const el = $('sm-tela'); el.innerHTML = html; el.hidden = !html; el.classList.toggle('leve', leve); refazerTela = html ? refazer : null; }

// --------------------------------------------------------------------------- estado do jogo
let R = null; // rodada atual (criarRodada)
let n = 0; // índice da rodada (0 a RODADAS - 1)
let resultados = []; // { pontos, resultado, margem, campeao, objetivo }
let fase = 'intro'; // intro | preparo | jogando | fim
let t0 = 0; let raf = 0;
let est = null; // estado da rodada (logic.js): vida, golpes aplicados, Golpear, Smite inimigo e o fim
let danos = {}; // quem → dano causado
let ultimoTxt = ''; let ultimoTempo = ''; let ultimoResta = TEMPO_MAX;
let partida = null; // a partida (5 rodadas): os mesmos campeões do começo ao fim

const vidaAgora = () => (est ? est.vida : 0);
const tempoAgora = () => (performance.now() - t0) / 1000;
const nomeObj = () => t(R.objetivo.nome);

// Ícone da Q: Lee Sin troca para o Golpe Ressonante durante a janela; o Kha'Zix usa a versão evoluída (laranja) do nível 11 em diante.
const NIVEL_EVOLUI = 11;
function imgQ(fase) {
  const id = R.campeao.id;
  let nome = { LeeSin: 'leesin-q1', Nunu: 'nunu-q', Khazix: 'khazix-q', Pantheon: 'pantheon-q', MonkeyKing: 'wukong-q' }[id];
  if (id === 'LeeSin' && fase === 'janela') nome = 'leesin-q2';
  if (id === 'Khazix' && R.nivel >= NIVEL_EVOLUI) nome = 'khazix-q-evoluida';
  return `img/skills/${nome}.webp`;
}

function hud() {
  const v = vidaAgora(); const cheia = $('sm-cheia');
  const pct = R ? (v / R.vidaMax) * 100 : 100;
  cheia.style.width = `${pct}%`;
  const dentro = R && est && v > 0 && v <= R.smite;
  cheia.classList.toggle('ouro', Boolean(dentro));
  $('sm-alvo').classList.toggle('zona', Boolean(dentro));
  $('sm-f').classList.toggle('pronto', Boolean(dentro) && fase === 'jogando' && !est?.smiteUsado);
  const txt = R ? `${fmt(v)} / ${fmt(R.vidaMax)}` : '';
  if (txt !== ultimoTxt) { $('sm-vida').textContent = txt; ultimoTxt = txt; }
  if (fase === 'jogando') ultimoResta = Math.max(0, Math.ceil(TEMPO_MAX - tempoAgora()));
  else if (fase !== 'fim') ultimoResta = TEMPO_MAX; // parado no fim da rodada; volta a 50 na próxima
  const tt = `00:${String(ultimoResta).padStart(2, '0')}`;
  if (tt !== ultimoTempo) { $('sm-tempo-n').textContent = tt; ultimoTempo = tt; $('sm-tempo').classList.toggle('fim', ultimoResta <= 8 && fase === 'jogando'); }
  const rec = $('sm-q-rec'); const car = $('sm-q-carga'); const qb = $('sm-q');
  const eq = fase === 'jogando' && est ? estadoQ(est, tempoAgora()) : { fase: 'pronto', falta: 0, carga: 0 };
  const mostra = eq.fase === 'recarga' || eq.fase === 'janela' || eq.fase === 'armado';
  rec.hidden = !mostra; rec.className = `recarga ${eq.fase}`;
  if (mostra) rec.textContent = eq.fase === 'recarga' ? String(Math.ceil(eq.falta)) : (eq.fase === 'janela' ? `Q2 ${eq.falta.toFixed(1)}` : eq.falta.toFixed(1));
  car.hidden = eq.fase !== 'segurando';
  if (!car.hidden) { car.firstElementChild.style.width = `${Math.round(eq.carga * 100)}%`; car.classList.toggle('cheia', eq.carga >= 1); }
  qb.dataset.fase = eq.fase;
  if (R) { const src = imgQ(eq.fase); const im = $('sm-q-img'); if (!im.src.endsWith(src)) im.src = src; }
  qb.disabled = fase !== 'jogando' || eq.fase === 'recarga' || (eq.fase === 'armado');
  $('sm-f').disabled = fase !== 'jogando' || Boolean(est?.smiteUsado);
}

function painelDano() {
  const total = Object.values(danos).reduce((a, b) => a + b, 0) || 1;
  document.querySelectorAll('#sm-dano li').forEach((li) => {
    const p = Math.round(((danos[li.dataset.p] || 0) / total) * 100);
    li.querySelector('.pct').textContent = fmt(Math.round(danos[li.dataset.p] || 0));
    li.querySelector('.barra i').style.width = `${p}%`;
  });
}

function numero(txt, classe, x, y) {
  const el = document.createElement('span');
  el.className = `sm-num ${classe}`; el.textContent = txt;
  el.style.left = `${x}%`; el.style.top = `${y}%`;
  $('sm-numeros').append(el);
  setTimeout(() => el.remove(), 1200);
}
// Marca vermelha que sobe pela tela quando o selva inimigo usa o Golpear.
function etiquetaInimigo(dano) {
  const el = document.createElement('div');
  el.className = 'sm-tag';
  el.innerHTML = `<img alt="" src="${imgSmite()}" /><span>${esc(t('Golpear Inimigo'))}</span><b>-${fmt(dano)}</b>`;
  $('sm-numeros').append(el);
  setTimeout(() => el.remove(), 2200);
}
function bateu() {
  const d = $('sm-alvo'); d.classList.remove('bate'); void d.offsetWidth; d.classList.add('bate');
}

// Avisos curtos no meio da tela.
let avisoTimer = 0;
function aviso(txt, ms = 2400) {
  const el = $('sm-aviso'); el.textContent = txt; el.hidden = false;
  el.classList.remove('vai'); void el.offsetWidth; el.classList.add('vai');
  clearTimeout(avisoTimer); avisoTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// Mostra na tela o que a lógica (logic.js) aplicou: golpes, Smite do inimigo, Golpear desperdiçado…
function aplicarEventos(eventos) {
  for (const e of eventos) {
    if (e.tipo === 'golpe') {
      danos[e.quem] = (danos[e.quem] || 0) + e.dano;
      const p = R.participantes.find((x) => x.id === e.quem);
      if (Math.random() < 0.4) numero(fmt(e.dano), p.lado, 50 + Math.random() * 14, 26 + Math.random() * 20);
      const f = e.quem === 'voce' ? $('sm-voce') : document.querySelector(`.sm-ficha[data-p="${e.quem}"]`);
      if (f) { f.classList.remove(e.quem === 'voce' ? 'usa' : 'golpe'); void f.offsetWidth; f.classList.add(e.quem === 'voce' ? 'usa' : 'golpe'); }
      bateu(); SOM.golpe();
    } else if (e.tipo === 'smite-inimigo') {
      danos[e.quem] = (danos[e.quem] || 0) + e.dano;
      etiquetaInimigo(e.dano);
      const f = document.querySelector(`.sm-ficha[data-p="e-selva"]`);
      if (f) { f.classList.remove('golpe'); void f.offsetWidth; f.classList.add('golpe'); }
      const fl = $('sm-flash'); fl.classList.add('inimigo'); fl.classList.remove('vai'); void fl.offsetWidth; fl.classList.add('vai');
      bateu(); SOM.smite();
    } else if (e.tipo === 'habilidade') {
      danos.voce = (danos.voce || 0) + e.dano;
      SOM.hab(); bateu();
      const v = $('sm-voce'); v.classList.remove('usa'); void v.offsetWidth; v.classList.add('usa');
      if (e.fase !== 'bonus') feixe();
      numero(fmt(e.dano), 'q', 54 + Math.random() * 6, 24 + Math.random() * 10);
    } else if (e.tipo === 'habilidade-armar') {
      SOM.hab(); aviso(t('Ataque armado! O seu próximo golpe causa dano extra.'), 1800);
    } else if (e.tipo === 'habilidade-fim') {
      if (e.motivo === 'janela') aviso(t('Perdeu a janela do segundo Q: a recarga começou.'), 2200);
      else if (e.motivo === 'segurou') aviso(t('Segurou demais! A recarga é a metade.'), 2200);
    } else if (e.tipo === 'golpear-cedo') {
      danos.voce = (danos.voce || 0) + e.dano;
      numero(fmt(e.dano), 'smite', 52, 22);
      const fl = $('sm-flash'); fl.classList.remove('inimigo'); fl.classList.remove('vai'); void fl.offsetWidth; fl.classList.add('vai');
      feixe(); bateu(); SOM.smite();
      aviso(t('Cedo demais! Seu Golpear foi desperdiçado, mas a rodada continua.'), 3200);
    }
  }
  painelDano();
}

function laco() {
  if (fase !== 'jogando') return;
  aplicarEventos(avancar(est, tempoAgora()));
  hud();
  if (est.fim) { terminar(); return; }
  raf = requestAnimationFrame(laco);
}

function usarHab() {
  if (fase !== 'jogando' || $('sm-q').disabled) return;
  aplicarEventos(avancar(est, tempoAgora()));
  if (est.fim) { hud(); terminar(); return; }
  aplicarEventos(usarHabilidade(est, tempoAgora()));
  hud();
  if (est.fim) { cancelAnimationFrame(raf); terminar(); }
}
function soltarHab() {
  if (fase !== 'jogando' || !est || R.campeao.tipo !== 'carga' || est.q.desde == null) return;
  aplicarEventos(avancar(est, tempoAgora()));
  if (est.fim) { hud(); terminar(); return; }
  aplicarEventos(soltarHabilidade(est, tempoAgora()));
  hud();
  if (est.fim) { cancelAnimationFrame(raf); terminar(); }
}
function feixe() {
  const palco = $('sm').getBoundingClientRect();
  const [fx, fy] = FICHAS.voce[celular() ? 1 : 0];
  const x1 = (fx / 100) * palco.width; const y1 = (fy / 100) * palco.height;
  const alvo = $('sm-alvo').getBoundingClientRect(); const pr = palco;
  const x2 = alvo.left - pr.left + alvo.width * 0.45; const y2 = alvo.top - pr.top + alvo.height * 0.5;
  const f = $('sm-feixe');
  f.style.left = `${x1}px`; f.style.top = `${y1}px`;
  f.style.width = `${Math.hypot(x2 - x1, y2 - y1)}px`;
  f.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
  f.classList.remove('vai'); void f.offsetWidth; f.classList.add('vai');
}

function usarSmite() {
  if (fase !== 'jogando' || est.smiteUsado) return;
  aplicarEventos(avancar(est, tempoAgora()));
  if (est.fim) { hud(); terminar(); return; }
  const eventos = usarGolpear(est);
  const ok = eventos.find((e) => e.tipo === 'golpear'); // com a vida ≤ dano do Smite: garantiu o objetivo
  if (ok) {
    danos.voce = (danos.voce || 0) + ok.dano; painelDano();
    SOM.smite();
    numero(fmt(R.smite), 'smite', 52, 22);
    const fl = $('sm-flash'); fl.classList.remove('inimigo'); fl.classList.remove('vai'); void fl.offsetWidth; fl.classList.add('vai');
    feixe(); bateu();
  } else aplicarEventos(eventos);
  hud();
  if (est.fim) { cancelAnimationFrame(raf); terminar(); }
}

async function terminar() {
  const fim = est.fim;
  fase = 'fim';
  cancelAnimationFrame(raf);
  hud();
  const garantido = fim.resultado === 'garantido';
  $('sm-alvo').classList.add('morto');
  resultados.push({ pontos: fim.pontos, resultado: fim.resultado, margem: fim.margem, campeao: R.campeao.nome, objetivo: R.objetivo.id });
  await esperar(garantido ? 1400 : 1100);
  (fim.resultado === 'roubado' ? SOM.mau : SOM.ok)();
  telaResultado(fim);
}

// --------------------------------------------------------------------------- telas
const total = () => resultados.reduce((s, r) => s + r.pontos, 0);

function telaBloqueada() {
  app.innerHTML = `<div class="sm" style="display:grid;place-items:center"><div class="sm-bg"></div><div class="sm-cartao" style="position:relative;z-index:2">
    <span class="sup">${t('Em desenvolvimento')}</span><h2>${t('Desafio do Golpear')}</h2>
    <p>${t('Este jogo ainda está sendo construído e chega em breve. Enquanto isso, o resto do Rift Arcade está aberto!')}</p>
    <div class="sm-acoes"><a class="sm-go" href="../../" style="text-decoration:none">${t('VOLTAR AO INÍCIO')}</a></div></div></div>`;
}

function telaInicio() {
  fase = 'intro';
  const melhor = lerLS(CHAVE_MELHOR, 0);
  tela(`<div class="sm-cartao">
    <span class="sup">${t('Desafio de timing · League of Legends')}</span>
    <h2>${t('Desafio do Golpear')}</h2>
    <p>${t('Um objetivo está quase morrendo e o time inimigo está de olho. Use o <b>Golpear</b> na hora certa para <b>garantir o objetivo</b>: quanto mais perto do dano do Golpear (para menos), mais pontos.')}</p>
    <div class="sm-regras">
      <div><b>${t('Observe')}</b>${t('A vida do objetivo cai com o dano dos aliados e dos adversários, inclusive o seu. Cada time tem topo, selva, meio e atirador, e você é o selva do time azul.')}</div>
      <div><b>${t('Golpeie')}</b>${t('O Golpear mata se a vida for menor ou igual ao dano dele (600 até o nível 8, 900 do 9 ao 12 e 1200 do 13 em diante). Se errar, a rodada continua: se o seu time ficar com o objetivo vale 25 pontos; se for o time inimigo, 0.')}</div>
      <div><b>${t('Cuidado')}</b>${t('O selva inimigo também usa o Golpear (o mesmo dano) quando a vida está perto do marcador, de 5% acima a 30% abaixo do dano do Golpear, com mais chance quanto mais baixa a vida.')}</div>
      <div><b>${t('Habilidade')}</b>${t('O botão Q do seu campeão também machuca o objetivo. Use para ajustar a vida (se ela finalizar o objetivo, vale 50 pontos).')}</div>
    </div>
    <p>${t('As {rodadas} rodadas formam uma partida, com os mesmos campeões do começo ao fim: dos objetivos mais fracos (Arauto do Vale e Dragão Elemental, campeões em nível baixo) ao Barão Nashor e ao Dragão Ancião (nível alto). Até <b>100 pontos</b> por rodada. Teclas: <b>F</b> ou <b>Espaço</b> = Golpear · <b>Q</b> = habilidade.', { rodadas: RODADAS })}${melhor ? `<br>${t('Seu recorde: <b>{n}</b> pontos', { n: fmt(melhor) })}` : ''}</p>
    <div class="sm-acoes"><button type="button" class="sm-go" data-a="jogar">${t('JOGAR')}</button></div></div>`, telaInicio);
}

// Constrói fichas, painel de dano e textos da rodada que vai começar.
function prepararHud() {
  const c = R.campeao; const o = R.objetivo; const cel = celular();
  $('sm').dataset.tema = o.tema;
  const alvo = $('sm-alvo'); alvo.className = 'sm-dragao';
  const [l, tp, w] = cel ? o.posM : o.pos;
  alvo.style.setProperty('--l', `${l}%`); alvo.style.setProperty('--t', `${tp}%`); alvo.style.setProperty('--w', `${w}cqw`);
  const img = $('sm-alvo-img'); img.src = o.arte; img.alt = t(o.nome);
  const cen = document.querySelector('.sm-cenario'); if (!cen.src.endsWith(o.cenario)) cen.src = o.cenario;
  for (const id of ['sm-ico', 'sm-ico2']) { const e = $(id); e.style.backgroundImage = `url(${o.arte})`; e.style.background = `#06191a url(${o.arte}) ${o.icone} no-repeat`; }
  $('sm-nome-obj').textContent = nomeObj();
  $('sm-obj-txt').textContent = t('Golpeie o {obj} com o Golpear no momento certo!', { obj: nomeObj() });
  $('sm-numeros').innerHTML = '';
  $('sm-dano-smite').textContent = fmt(R.smite); $('sm-f-valor').textContent = fmt(R.smite);
  $('sm-nivel').textContent = R.nivel;
  $('sm-marca').style.left = `${(R.smite / R.vidaMax) * 100}%`;
  $('sm-voce-img').src = imgCampeao(c.id); $('sm-retrato').src = imgCampeao(c.id); $('sm-q-img').src = imgQ('q');
  $('sm-fichas').innerHTML = R.participantes.filter((p) => p.id !== 'voce').map((p) => {
    const [x, y] = FICHAS[p.id][cel ? 1 : 0];
    return `<div class="sm-ficha ${p.lado}" data-p="${p.id}" title="${esc(nomeCampeao(p.champ))}" style="left:${x}%;top:${y}%"><img class="ic" alt="" src="${imgCampeao(p.champ)}" /><span class="nv">${p.nivel}</span><span class="hp"><i></i></span></div>`;
  }).join('');
  const nomeLinha = (p) => (p.id === 'voce' ? t('Você') : `${t(p.lado === 'azul' ? 'Aliado' : 'Adversário')} ${t(ROTA_NOME[p.rota])}`);
  $('sm-dano').innerHTML = R.participantes.map((p) => `<li data-p="${p.id}" style="--cor:${p.id === 'voce' ? COR.voce : COR[p.lado]}"><img class="ic" alt="" src="${imgCampeao(p.champ)}" /><span class="nome">${esc(nomeLinha(p))}</span><span class="pct">0</span><span class="barra"><i></i></span></li>`).join('');
}

function prepararRodada() {
  const rand = aleatorio((Date.now() ^ (n * 7919)) >>> 0);
  // `?obj=barao` (ou arauto, dragao-anciao, dragao-elemental) fixa o objetivo, para testar o visual de cada um.
  const fixo = OBJETIVOS.find((o) => o.id === new URLSearchParams(location.search).get('obj'));
  R = criarRodada(rand, n, { partida, objetivo: fixo || undefined });
  fase = 'preparo';
  est = novoEstado(R); danos = {}; ultimoTxt = ''; ultimoTempo = '';
  prepararHud(); painelDano(); hud();
  cartaoPreparo();
}
// Resume a Q do campeão no posto desta rodada (o posto sobe com o nível).
function descricaoQ(c) {
  const k = postoHab(R.nivel); const seg = String(c.recarga[k]).replace('.', ',');
  if (c.tipo === 'duplo') return t('Q: toque para a Onda Sônica; em até {janela}s toque de novo para o Chute, que bate mais quanto menos vida o objetivo tem. Recarga {seg}s.', { janela: c.janela, seg });
  if (c.tipo === 'carga') return t('Q: toque rápido para uma estocada ({dano}); segurando, causa mais dano.', { dano: fmt(c.dano[k]) });
  if (c.tipo === 'armar') return t('Q: arma o seu próximo ataque (até {janela}s) com +{dano} de dano; cada golpe seu corta 0,5s da recarga. Recarga {seg}s.', { janela: c.janela, dano: fmt(c.dano[k]), seg });
  return t('Q: {dano} de dano. Recarga {seg}s.', { dano: fmt(c.dano[k]), seg });
}
// Antes da contagem a tela fica livre: só uma faixa com o COMEÇAR, para o jogador olhar o palco (campeões, dano do Golpear, a Q).
function cartaoPreparo() {
  const c = R.campeao;
  tela(`<div class="sm-pronto">
    <span class="sup">${t('Rodada {n} de {total}', { n: n + 1, total: RODADAS })} · ${esc(nomeObj())}</span>
    <span class="hab"><b>${esc(c.nome)}</b> · ${descricaoQ(c)}</span>
    <button type="button" class="sm-go" data-a="comecar">${t('COMEÇAR')}</button></div>`, cartaoPreparo, true);
}

async function contagemEIniciar() {
  tela('');
  for (const nroto of [3, 2, 1]) {
    const el = document.createElement('div'); el.className = 'sm-contagem'; el.textContent = nroto; $('sm').append(el);
    SOM.conta(); await esperar(900); el.remove();
  }
  SOM.vai();
  fase = 'jogando';
  t0 = performance.now();
  hud();
  raf = requestAnimationFrame(laco);
}

function textoResultado(fim) {
  const obj = nomeObj();
  const p = R.participantes.find((x) => x.id === fim.quem);
  const quem = p ? nomeCampeao(p.champ) : '';
  const falhou = est.smiteFalhou;
  if (fim.resultado === 'garantido') {
    return { sup: t(fim.nota.rotulo), titulo: t('Objetivo garantido!'), corpo: t('Você golpeou com <b>{vida}</b> de vida no {obj}: <b>{margem}</b> abaixo do dano do Golpear ({smite}).', { vida: fmt(fim.vidaNoGolpe), obj, margem: fmt(fim.margem), smite: fmt(R.smite) }) };
  }
  if (fim.resultado === 'time') {
    let corpo = t('Seu time derrubou o {obj} antes do seu Golpear (golpe final de {quem}).', { obj, quem });
    if (falhou) corpo = t('Seu Golpear foi cedo demais (<b>{vida}</b> de vida, <b>{faltou}</b> acima do dano do Golpear), mas seu time ficou com o {obj} (golpe final de {quem}).', { vida: fmt(falhou.vida), faltou: fmt(falhou.faltou), obj, quem });
    else if (fim.via === 'habilidade') corpo = t('A sua habilidade finalizou o {obj} antes do Golpear: o objetivo ficou com o seu time.', { obj });
    return { sup: t('Seu time levou o objetivo'), titulo: t('Seu time ficou com o objetivo!'), corpo };
  }
  let corpo = t('O {obj} morreu antes do seu Golpear.', { obj });
  if (fim.via === 'smite-inimigo') corpo = t('O selva inimigo ({quem}) usou o Golpear e levou o {obj}.', { quem, obj });
  else if (p) corpo = t('O time inimigo levou o {obj}: o golpe final foi de {quem}.', { obj, quem });
  if (falhou) corpo += ` ${t('Seu Golpear tinha sido cedo demais: o objetivo ainda tinha <b>{vida}</b> de vida.', { vida: fmt(falhou.vida) })}`;
  return { sup: t('Tarde demais'), titulo: t('Roubaram o objetivo!'), corpo };
}

function telaResultado(fim) {
  const x = textoResultado(fim);
  const ultima = n >= RODADAS - 1;
  tela(`<div class="sm-cartao">
    <span class="sup">${t('Rodada {n} de {total}', { n: n + 1, total: RODADAS })} · ${x.sup}</span>
    <h2>${x.titulo}</h2>
    <div class="sm-pontos">+${fim.pontos}<small>${t('pontos')}</small></div>
    <p>${x.corpo}</p>
    <p>${t('Total: <b>{n}</b> pontos', { n: total() })}</p>
    <div class="sm-acoes"><button type="button" class="sm-go" data-a="${ultima ? 'fim' : 'proxima'}">${ultima ? t('VER RESULTADO') : t('PRÓXIMA RODADA')}</button></div></div>`, () => telaResultado(fim));
}

function telaFim() {
  const pts = total();
  const melhor = lerLS(CHAVE_MELHOR, 0);
  const recorde = pts > melhor;
  if (recorde) gravarLS(CHAVE_MELHOR, pts);
  const perfeitas = resultados.filter((r) => r.resultado === 'garantido' && r.margem <= 25).length;
  desenharFim(pts, melhor, recorde, perfeitas);
  platform.track('game_end', GAME_ID, { pontos: pts, perfeitas });
  platform.recordResult(GAME_ID, { score: pts, summary: { text: `${pts} ${t('pontos')}`, rodadas: resultados.map((r) => ({ p: r.pontos, r: r.resultado, m: r.margem, o: r.objetivo })) } }).catch(() => {});
}
function desenharFim(pts, melhor, recorde, perfeitas) {
  const nome = (r) => (r.resultado === 'garantido' ? t('margem {n}', { n: fmt(r.margem) }) : r.resultado === 'time' ? t('seu time') : t('roubado'));
  const objNome = { 'dragao-elemental': 'Dragão Elemental', 'dragao-anciao': 'Dragão Ancião', barao: 'Barão Nashor', arauto: 'Arauto do Vale' };
  const linhas = resultados.map((r, i) => `<div class="${r.pontos ? '' : 'ruim'}"><span>${t('Rodada {n}', { n: i + 1 })}</span><span>${esc(t(objNome[r.objetivo] || ''))} · ${nome(r)}</span><b>${r.pontos}</b></div>`).join('');
  tela(`<div class="sm-cartao">
    <span class="sup">${t('Fim de jogo')}</span><h2>${pts >= RODADAS * 90 ? t('Golpear perfeito!') : pts >= RODADAS * 60 ? t('Bela selva!') : t('Fim da partida')}</h2>
    <div class="sm-pontos">${pts}<small>${t('de {max} pontos', { max: RODADAS * 100 })}</small></div>
    <div class="sm-resumo">${linhas}</div>
    <p>${recorde ? `<b>${t('Novo recorde!')}</b>` : t('Seu recorde: <b>{n}</b> pontos', { n: fmt(Math.max(melhor, pts)) })}${perfeitas ? ` · ${perfeitas === 1 ? t('1 golpe perfeito') : t('{n} golpes perfeitos', { n: perfeitas })}` : ''}</p>
    <div class="sm-acoes"><button type="button" class="sm-go" data-a="jogar">${t('JOGAR DE NOVO')}</button><a class="sm-go sec" href="../../" style="text-decoration:none">${t('VOLTAR AO INÍCIO')}</a></div></div>`, () => desenharFim(pts, melhor, recorde, perfeitas));
}

// --------------------------------------------------------------------------- entradas
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (!a) return;
  if (a === 'jogar') { resultados = []; n = 0; partida = criarPartida(aleatorio((Date.now() ^ 0x9e3779b9) >>> 0), new URLSearchParams(location.search).get('camp')); prepararRodada(); } // ?camp=LeeSin fixa o campeão (teste)
  else if (a === 'comecar') contagemEIniciar();
  else if (a === 'proxima') { n += 1; prepararRodada(); }
  else if (a === 'fim') telaFim();
});
document.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'q') { e.preventDefault(); usarHab(); } else if (k === 'f' || k === ' ') {
    if (fase === 'jogando') { e.preventDefault(); usarSmite(); }
  }
});

document.addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'q') soltarHab(); });

// Trocou o idioma: os textos fixos do palco e a tela aberta são refeitos (a partida em andamento continua).
onLangChange(() => {
  if (!$('sm') || fase === 'jogando') return;
  const refazer = refazerTela;
  montar();
  if (R) prepararHud();
  painelDano(); hud();
  if (refazer) refazer(); else tela('');
});

// --------------------------------------------------------------------------- início
(async function iniciar() {
  await platform.init();
  const teste = ['localhost', '127.0.0.1'].includes(location.hostname) && /[?&]teste=1/.test(location.search);
  const souAdmin = await platform.isAdmin();
  const aberto = !gameById(GAME_ID)?.soAdmin;
  if (!souAdmin && !teste && !aberto) { telaBloqueada(); return; }
  montar();
  hud();
  telaInicio();
  versaoDD().then((v) => {
    if (!v || v === ddVersion) return;
    ddVersion = v;
    document.querySelectorAll('.sm img[src*="ddragon"]').forEach((img) => { img.src = img.src.replace(/cdn\/[^/]+\//, `cdn/${v}/`); });
  });
}());
