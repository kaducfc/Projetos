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
  OBJETIVOS, RODADAS, TEMPO_MAX, RECARGA_HAB, ROTA_NOME,
  aleatorio, criarRodada, proximoObjetivo, resolverSmite, nomeCampeao,
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

const COROA = '<svg viewBox="0 0 30 24" aria-hidden="true"><path d="M3 20 1 6l7 6 7-10 7 10 7-6-2 14z" fill="#f5cf5a" stroke="#7a5712" stroke-width="1.2" stroke-linejoin="round"/><circle cx="15" cy="3" r="2" fill="#fff1b3"/></svg>';
const AMPULHETA = '<svg viewBox="0 0 32 40" aria-hidden="true"><path d="M5 3h22M5 37h22M8 3c0 10 6 11 8 17-2 6-8 7-8 17M24 3c0 10-6 11-8 17 2 6 8 7 8 17" stroke="#f2d98a" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M11 33c1-4 3-5 5-5s4 1 5 5z" fill="#e0a93a"/></svg>';
const MIRA = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="rgba(4,16,15,0.7)" stroke="#c9961f" stroke-width="3"/>
  <g class="giro"><circle cx="60" cy="60" r="48" fill="none" stroke="rgba(245,207,90,0.5)" stroke-width="1.5" stroke-dasharray="3 7"/>
  <path d="M60 4v10M60 106v10M4 60h10M106 60h10" stroke="#f5cf5a" stroke-width="3"/></g>
  <path d="M60 28 66 54 92 60 66 66 60 92 54 66 28 60 54 54z" fill="rgba(63,217,208,0.28)" style="stroke:var(--glow)" stroke-width="2"/><circle cx="60" cy="60" r="7" fill="none" style="stroke:var(--glow)" stroke-width="2"/></svg>`;

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
      <div class="sm-logo">${COROA}<span>${t('DESAFIO DO')}</span><b>${t('GOLPEAR')}</b></div>
      <div class="sm-hp"><div class="nome" id="sm-nome-obj">&nbsp;</div>
        <div class="linha"><div class="ico" id="sm-ico"></div><div class="barra"><div class="cheia" id="sm-cheia"></div><i class="marca" id="sm-marca"></i><div class="num" id="sm-vida"></div></div></div></div>
      <div class="sm-tempo" id="sm-tempo">${AMPULHETA}<div><small>${t('Tempo restante')}</small><b id="sm-tempo-n">00:${TEMPO_MAX}</b></div></div>
    </div>
    <aside class="sm-painel sm-dano"><h3>${t('Dano no objetivo')}</h3><ul id="sm-dano"></ul></aside>
    <div class="sm-painel sm-obj"><div class="ico" id="sm-ico2"></div><div><b>${t('Objetivo')}</b><span id="sm-obj-txt"></span></div></div>
    <div class="sm-painel sm-info"><div class="texto">${t('O dano do Golpear é de')}<b id="sm-dano-smite">900</b></div></div>
    <div class="sm-mira">${MIRA}</div>
    <div class="sm-hab">
      <div class="fundo"></div>
      <div class="sm-retrato"><img id="sm-retrato" alt="" /></div><span class="sm-nivel" id="sm-nivel">11</span>
      <div class="sm-barras"><div class="v"><i></i><span>1.860 / 2.100</span></div><div class="m"><i></i><span>640 / 890</span></div></div>
      <div class="sm-botoes">
        <button type="button" class="sm-bt q" id="sm-q" aria-label="${t('Habilidade')} (Q)"><span class="quadro"><img id="sm-q-img" alt="" /><span class="recarga" id="sm-q-rec" hidden></span><span class="tecla">Q</span></span><span class="nome">${t('Habilidade')}</span></button>
        <button type="button" class="sm-bt f" id="sm-f" aria-label="${t('Golpear')} (F)"><span class="quadro"><img alt="" src="${imgSmite()}" /><span class="tecla">F</span></span><span class="nome">${t('Golpear')}</span></button>
      </div>
    </div>
    <button type="button" class="sm-som" id="sm-som" aria-label="${t('Som')}"></button>
    <div class="sm-tela" id="sm-tela" hidden></div>
  </div>`;
  atualizarSom();
  $('sm-q').addEventListener('click', usarHab);
  $('sm-f').addEventListener('click', usarSmite);
  $('sm-som').addEventListener('click', () => { mudo = !mudo; gravarLS(CHAVE_MUDO, mudo); atualizarSom(); });
}
function atualizarSom() { const b = $('sm-som'); if (b) b.textContent = mudo ? '🔇' : '🔊'; }
let refazerTela = null; // desenha de novo a tela que está aberta (ao trocar de idioma)
function tela(html, refazer = null) { const el = $('sm-tela'); el.innerHTML = html; el.hidden = !html; refazerTela = html ? refazer : null; }

// --------------------------------------------------------------------------- estado do jogo
let R = null; // rodada atual (criarRodada)
let n = 0; // índice da rodada (0 a RODADAS - 1)
let resultados = []; // { pontos, resultado, margem, campeao, objetivo }
let fase = 'intro'; // intro | preparo | jogando | fim
let t0 = 0; let raf = 0;
let idx = 0; // próximo golpe a aplicar
let vidaG = 0; // vida só pelos golpes dos outros
let qTotal = 0; let qPronto = 0; // dano da habilidade e quando ela volta (s)
let danos = {}; // quem → dano causado
let ultimoTxt = ''; let ultimoTempo = ''; let ultimoResta = TEMPO_MAX;
let objetivoAnterior = null;

const vidaAgora = () => Math.max(0, vidaG - qTotal);
const tempoAgora = () => (performance.now() - t0) / 1000;
const nomeObj = () => t(R.objetivo.nome);

function hud() {
  const v = vidaAgora(); const cheia = $('sm-cheia');
  const pct = R ? (v / R.vidaMax) * 100 : 100;
  cheia.style.width = `${pct}%`;
  const dentro = R && v > 0 && v <= R.smite;
  cheia.classList.toggle('ouro', Boolean(dentro));
  $('sm-alvo').classList.toggle('zona', Boolean(dentro));
  $('sm-f').classList.toggle('pronto', Boolean(dentro) && fase === 'jogando');
  const txt = R ? `${fmt(v)} / ${fmt(R.vidaMax)}` : '';
  if (txt !== ultimoTxt) { $('sm-vida').textContent = txt; ultimoTxt = txt; }
  if (fase === 'jogando') ultimoResta = Math.max(0, Math.ceil(TEMPO_MAX - tempoAgora()));
  else if (fase !== 'fim') ultimoResta = TEMPO_MAX; // parado no fim da rodada; volta a 50 na próxima
  const tt = `00:${String(ultimoResta).padStart(2, '0')}`;
  if (tt !== ultimoTempo) { $('sm-tempo-n').textContent = tt; ultimoTempo = tt; $('sm-tempo').classList.toggle('fim', ultimoResta <= 8 && fase === 'jogando'); }
  const rec = $('sm-q-rec'); const falta = fase === 'jogando' ? Math.ceil(qPronto - tempoAgora()) : 0;
  rec.hidden = falta <= 0; if (falta > 0) rec.textContent = String(falta);
  $('sm-q').disabled = fase !== 'jogando' || falta > 0;
  $('sm-f').disabled = fase !== 'jogando';
}

function painelDano() {
  const total = Object.values(danos).reduce((a, b) => a + b, 0) || 1;
  document.querySelectorAll('#sm-dano li').forEach((li) => {
    const p = Math.round(((danos[li.dataset.p] || 0) / total) * 100);
    li.querySelector('.pct').textContent = `${p}%`;
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
function bateu() {
  const d = $('sm-alvo'); d.classList.remove('bate'); void d.offsetWidth; d.classList.add('bate');
}

function aplicarGolpes(tempo) {
  while (idx < R.golpes.length && R.golpes[idx].t <= tempo) {
    const g = R.golpes[idx++];
    vidaG = g.vida;
    danos[g.quem] = (danos[g.quem] || 0) + g.dano;
    const p = R.participantes.find((x) => x.id === g.quem);
    if (Math.random() < 0.4) numero(fmt(g.dano), p.lado, 50 + Math.random() * 14, 26 + Math.random() * 20);
    const f = document.querySelector(`.sm-ficha[data-p="${g.quem}"]`);
    if (f) { f.classList.remove('golpe'); void f.offsetWidth; f.classList.add('golpe'); }
    bateu(); SOM.golpe();
  }
  painelDano();
}

function laco() {
  if (fase !== 'jogando') return;
  const tempo = tempoAgora();
  aplicarGolpes(tempo);
  hud();
  if (vidaAgora() <= 0) { terminar({ resultado: 'roubado', margem: null, pontos: 0 }, 0, qTotal > 0 && vidaG > 0); return; }
  if (tempo >= TEMPO_MAX) { terminar({ resultado: 'roubado', margem: null, pontos: 0 }, vidaAgora()); return; }
  raf = requestAnimationFrame(laco);
}

function usarHab() {
  if (fase !== 'jogando' || tempoAgora() < qPronto) return;
  const c = R.campeao;
  qTotal += c.dano; qPronto = tempoAgora() + RECARGA_HAB;
  danos.voce = (danos.voce || 0) + c.dano;
  SOM.hab(); bateu();
  const v = $('sm-voce'); v.classList.remove('usa'); void v.offsetWidth; v.classList.add('usa');
  feixe(); numero(fmt(c.dano), 'q', 54 + Math.random() * 6, 24 + Math.random() * 10);
  aplicarGolpes(tempoAgora());
  hud();
  if (vidaAgora() <= 0) { cancelAnimationFrame(raf); terminar({ resultado: 'roubado', margem: null, pontos: 0 }, 0, true); }
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
  if (fase !== 'jogando') return;
  aplicarGolpes(tempoAgora());
  const vida = vidaAgora();
  cancelAnimationFrame(raf);
  const res = resolverSmite(vida, R.smite);
  SOM.smite();
  numero(fmt(R.smite), 'smite', 52, 22);
  const fl = $('sm-flash'); fl.classList.remove('vai'); void fl.offsetWidth; fl.classList.add('vai');
  feixe(); bateu();
  terminar(res, vida);
}

async function terminar(res, vida, porHabilidade = false) {
  fase = 'fim';
  cancelAnimationFrame(raf);
  hud();
  if (res.resultado === 'garantido' || res.resultado === 'roubado') $('sm-alvo').classList.add('morto');
  resultados.push({ pontos: res.pontos, resultado: res.resultado, margem: res.margem, campeao: R.campeao.nome, objetivo: R.objetivo.id });
  await esperar(res.resultado === 'garantido' ? 1400 : 1100);
  (res.resultado === 'garantido' ? SOM.ok : SOM.mau)();
  const quem = R.quemMata;
  telaResultado(res, vida, porHabilidade, quem);
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
      <div><b>${t('Observe')}</b>${t('A vida do objetivo cai com o dano dos aliados e dos adversários. Cada time tem topo, selva, meio e atirador, e você é o selva do time azul.')}</div>
      <div><b>${t('Golpeie')}</b>${t('O Golpear mata se a vida for menor ou igual ao dano dele (600 até o nível 8, 900 do 9 ao 12 e 1200 do 13 em diante). Cedo demais, falha; tarde demais, roubam.')}</div>
      <div><b>${t('Habilidade')}</b>${t('O botão Q do seu campeão também machuca o objetivo. Use para ajustar a vida (mas se ela matar, o objetivo está perdido).')}</div>
    </div>
    <p>${t('{rodadas} rodadas (Dragão Elemental, Dragão Ancião, Barão Nashor e Arauto do Vale), até <b>100 pontos</b> cada. Teclas: <b>F</b> ou <b>Espaço</b> = Golpear · <b>Q</b> = habilidade.', { rodadas: RODADAS })}${melhor ? `<br>${t('Seu recorde: <b>{n}</b> pontos', { n: fmt(melhor) })}` : ''}</p>
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
  for (const id of ['sm-ico', 'sm-ico2']) { const e = $(id); e.style.backgroundImage = `url(${o.arte})`; e.style.background = `#06191a url(${o.arte}) ${o.icone} no-repeat`; }
  $('sm-nome-obj').textContent = nomeObj();
  $('sm-obj-txt').textContent = t('Golpeie o {obj} com o Golpear no momento certo!', { obj: nomeObj() });
  $('sm-numeros').innerHTML = '';
  $('sm-dano-smite').textContent = fmt(R.smite);
  $('sm-nivel').textContent = R.nivel;
  $('sm-marca').style.left = `${(R.smite / R.vidaMax) * 100}%`;
  $('sm-voce-img').src = imgCampeao(c.id); $('sm-retrato').src = imgCampeao(c.id); $('sm-q-img').src = imgCampeao(c.id);
  $('sm-fichas').innerHTML = R.participantes.filter((p) => p.id !== 'voce').map((p) => {
    const [x, y] = FICHAS[p.id][cel ? 1 : 0];
    return `<div class="sm-ficha ${p.lado}" data-p="${p.id}" title="${esc(nomeCampeao(p.champ))}" style="left:${x}%;top:${y}%"><img class="ic" alt="" src="${imgCampeao(p.champ)}" /><span class="nv">${p.nivel}</span><span class="hp"><i></i></span></div>`;
  }).join('');
  const nomeLinha = (p) => (p.id === 'voce' ? t('Você') : `${t(p.lado === 'azul' ? 'Aliado' : 'Adversário')} ${t(ROTA_NOME[p.rota])}`);
  $('sm-dano').innerHTML = R.participantes.map((p) => `<li data-p="${p.id}" style="--cor:${p.id === 'voce' ? COR.voce : COR[p.lado]}"><img class="ic" alt="" src="${imgCampeao(p.champ)}" /><span class="nome">${esc(nomeLinha(p))}</span><span class="pct">0%</span><span class="barra"><i></i></span></li>`).join('');
}

function prepararRodada() {
  const rand = aleatorio((Date.now() ^ (n * 7919)) >>> 0);
  // `?obj=barao` (ou arauto, dragao-anciao, dragao-elemental) fixa o objetivo, para testar o visual de cada um.
  const fixo = OBJETIVOS.find((o) => o.id === new URLSearchParams(location.search).get('obj'));
  const objetivo = fixo || proximoObjetivo(rand, objetivoAnterior);
  objetivoAnterior = objetivo.id;
  R = criarRodada(rand, n, objetivo);
  fase = 'preparo';
  idx = 0; vidaG = R.vidaMax; qTotal = 0; qPronto = 0; danos = {}; ultimoTxt = ''; ultimoTempo = '';
  prepararHud(); painelDano(); hud();
  cartaoPreparo();
}
function cartaoPreparo() {
  const c = R.campeao;
  tela(`<div class="sm-cartao">
    <span class="sup">${t('Rodada {n} de {total}', { n: n + 1, total: RODADAS })}</span>
    <h2>${esc(nomeObj())}</h2>
    <div class="sm-campeao"><img alt="" src="${imgCampeao(c.id)}" /><div><b>${esc(c.nome)}</b><span>${t('Você é o selva do time azul · Q: {dano} de dano · recarga {seg}s', { dano: fmt(c.dano), seg: RECARGA_HAB })}</span></div></div>
    <p>${t('Você está no nível <b>{nivel}</b>: o dano do seu Golpear é de <b>{smite}</b>. Golpeie quando a vida do {obj} for <b>menor ou igual</b> a esse valor, o mais perto possível.', { nivel: R.nivel, smite: fmt(R.smite), obj: nomeObj() })}</p>
    <div class="sm-acoes"><button type="button" class="sm-go" data-a="comecar">${t('COMEÇAR')}</button></div></div>`, cartaoPreparo);
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

function textoResultado(res, vida, porHabilidade, quem) {
  const obj = nomeObj();
  if (res.resultado === 'garantido') {
    return { sup: t(res.nota.rotulo), titulo: t('Objetivo garantido!'), corpo: t('Você golpeou com <b>{vida}</b> de vida no {obj}: <b>{margem}</b> abaixo do dano do Golpear ({smite}).', { vida: fmt(vida), obj, margem: fmt(res.margem), smite: fmt(R.smite) }) };
  }
  if (res.resultado === 'cedo') {
    return { sup: t('Cedo demais'), titulo: t('O objetivo sobreviveu!'), corpo: t('Ele ainda tinha <b>{vida}</b> de vida, <b>{faltou}</b> acima do dano do Golpear ({smite}). O time inimigo levou o objetivo.', { vida: fmt(vida), faltou: fmt(res.faltou), smite: fmt(R.smite) }) };
  }
  const p = R.participantes.find((x) => x.id === quem);
  const nome = p ? nomeCampeao(p.champ) : '';
  let corpo = t('O {obj} morreu antes do seu Golpear.', { obj });
  if (porHabilidade) corpo = t('A sua habilidade derrubou o {obj} antes do Golpear. Só o Golpear garante o objetivo!', { obj });
  else if (p?.lado === 'vermelho') corpo = t('O time inimigo levou o {obj}: o golpe final foi de {quem}.', { obj, quem: nome });
  else if (p) corpo = t('Seu time derrubou o {obj} antes do seu Golpear (golpe final de {quem}).', { obj, quem: nome });
  return { sup: t('Tarde demais'), titulo: t('Roubaram o objetivo!'), corpo };
}

function telaResultado(res, vida, porHabilidade, quem) {
  const x = textoResultado(res, vida, porHabilidade, quem);
  const ultima = n >= RODADAS - 1;
  tela(`<div class="sm-cartao">
    <span class="sup">${t('Rodada {n} de {total}', { n: n + 1, total: RODADAS })} · ${x.sup}</span>
    <h2>${x.titulo}</h2>
    <div class="sm-pontos">+${res.pontos}<small>${t('pontos')}</small></div>
    <p>${x.corpo}</p>
    <p>${t('Total: <b>{n}</b> pontos', { n: total() })}</p>
    <div class="sm-acoes"><button type="button" class="sm-go" data-a="${ultima ? 'fim' : 'proxima'}">${ultima ? t('VER RESULTADO') : t('PRÓXIMA RODADA')}</button></div></div>`, () => telaResultado(res, vida, porHabilidade, quem));
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
  const nome = (r) => (r.resultado === 'garantido' ? t('margem {n}', { n: fmt(r.margem) }) : r.resultado === 'cedo' ? t('cedo demais') : t('roubado'));
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
  if (a === 'jogar') { resultados = []; n = 0; objetivoAnterior = null; prepararRodada(); }
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
