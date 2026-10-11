// Smite Challenge: golpeie (Smite) o objetivo no momento certo. A vida do dragão cai com o dano de
// aliados e adversários; o Smite mata se a vida for menor ou igual ao dano dele, e quanto mais perto
// do dano do Smite (para menos), mais pontos. O jogador também tem uma habilidade do campeão da selva.
// Enquanto o jogo é "oculto" (gameById('smite').soAdmin), só administradores conseguem jogar.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import { localeAtual } from '../../../shared/i18n.js';
import {
  OBJETIVO, RODADAS, TEMPO_MAX, RECARGA_HAB, PARTICIPANTES, CAMPEOES,
  aleatorio, criarRodada, resolverSmite,
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
const FICHAS = { // posição de cada jogador em volta do fosso (% do palco)
  a1: [34, 27], a2: [28.5, 47], a3: [51, 69], e1: [73, 21], e2: [71.5, 61],
};
const COR = { azul: '#3fa8ff', vermelho: '#e0352b', voce: '#f5cf5a' };

function fossoSvg() {
  // Anel de pedras ao redor de um fosso escuro, com ruído fixo (sempre o mesmo desenho).
  const rnd = aleatorio(20261011);
  const cx = 500; const cy = 300; const N = 34;
  let pedras = '';
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2; const a1 = ((i + 1) / N) * Math.PI * 2 - 0.01;
    const rIn = 0.80 + rnd() * 0.04; const rOut = 1.02 + rnd() * 0.16;
    const p = (a, r, dy = 0) => `${(cx + Math.cos(a) * 470 * r).toFixed(1)},${(cy + Math.sin(a) * 270 * r + dy).toFixed(1)}`;
    const topo = Math.sin((a0 + a1) / 2) > 0 ? 0 : -16; // pedras do fundo são mais altas
    const tom = 18 + Math.floor(rnd() * 14);
    const frente = Math.sin((a0 + a1) / 2) > 0;
    pedras += `<polygon points="${p(a0, rIn)} ${p(a0, rOut, topo)} ${p((a0 + a1) / 2, rOut + 0.05, topo - 8)} ${p(a1, rOut, topo)} ${p(a1, rIn)}" fill="hsl(190 ${12 + rnd() * 10}% ${tom}%)" stroke="rgba(150,200,200,${frente ? 0.22 : 0.12})" stroke-width="1.5"/>`;
  }
  let musgo = '';
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2; const r = 1.0 + rnd() * 0.18;
    musgo += `<ellipse cx="${(cx + Math.cos(a) * 470 * r).toFixed(0)}" cy="${(cy + Math.sin(a) * 270 * r).toFixed(0)}" rx="${(26 + rnd() * 40).toFixed(0)}" ry="${(12 + rnd() * 18).toFixed(0)}" fill="hsl(${120 + rnd() * 30} 40% ${12 + rnd() * 8}%)" opacity="0.8"/>`;
  }
  return `<svg viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><defs>
      <radialGradient id="smf" cx="50%" cy="48%" r="55%"><stop offset="0" stop-color="#1f7f7a"/><stop offset="0.45" stop-color="#0c3b3b"/><stop offset="1" stop-color="#041514"/></radialGradient>
      <radialGradient id="sma" cx="50%" cy="50%" r="50%"><stop offset="0.5" stop-color="rgba(63,217,208,0)"/><stop offset="1" stop-color="rgba(63,217,208,0.35)"/></radialGradient></defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${470 * 0.98}" ry="${270 * 0.98}" fill="url(#smf)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${470 * 0.7}" ry="${270 * 0.7}" fill="url(#sma)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${470 * 0.55}" ry="${270 * 0.55}" fill="none" stroke="rgba(63,217,208,0.25)" stroke-width="2" stroke-dasharray="6 10"/>
    ${pedras}${musgo}</svg>`;
}

const RUNA = `<svg class="sm-runas" viewBox="0 0 62 90" aria-hidden="true"><path d="M31 3 58 18v54L31 87 4 72V18z" fill="rgba(6,40,40,0.8)" stroke="#3fd9d0" stroke-width="2.5"/>
  <path d="M31 22 46 31v28L31 68 16 59V31z" fill="none" stroke="#7ff3ec" stroke-width="2"/><path d="M31 30v30M20 38l11 7 11-7" stroke="#7ff3ec" stroke-width="2" fill="none"/></svg>`;
const COROA = '<svg viewBox="0 0 30 24" aria-hidden="true"><path d="M3 20 1 6l7 6 7-10 7 10 7-6-2 14z" fill="#f5cf5a" stroke="#7a5712" stroke-width="1.2" stroke-linejoin="round"/><circle cx="15" cy="3" r="2" fill="#fff1b3"/></svg>';
const AMPULHETA = '<svg viewBox="0 0 32 40" aria-hidden="true"><path d="M5 3h22M5 37h22M8 3c0 10 6 11 8 17-2 6-8 7-8 17M24 3c0 10-6 11-8 17 2 6 8 7 8 17" stroke="#f2d98a" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M11 33c1-4 3-5 5-5s4 1 5 5z" fill="#e0a93a"/></svg>';
const MIRA = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="rgba(4,16,15,0.7)" stroke="#c9961f" stroke-width="3"/>
  <g class="giro"><circle cx="60" cy="60" r="48" fill="none" stroke="rgba(245,207,90,0.5)" stroke-width="1.5" stroke-dasharray="3 7"/>
  <path d="M60 4v10M60 106v10M4 60h10M106 60h10" stroke="#f5cf5a" stroke-width="3"/></g>
  <path d="M60 28 66 54 92 60 66 66 60 92 54 66 28 60 54 54z" fill="rgba(63,217,208,0.28)" stroke="#7ff3ec" stroke-width="2"/><circle cx="60" cy="60" r="7" fill="none" stroke="#7ff3ec" stroke-width="2"/></svg>`;

function montar() {
  const dano = PARTICIPANTES.map((p) => `<li data-p="${p.id}" style="--cor:${COR[p.lado]}"><img class="ic" alt="" src="${imgCampeao(p.champ)}" /><span class="nome">${p.nome}</span><span class="pct">0%</span><span class="barra"><i></i></span></li>`).join('')
    + `<li data-p="voce" style="--cor:${COR.voce}"><img class="ic" id="sm-dano-voce" alt="" /><span class="nome">Você</span><span class="pct">0%</span><span class="barra"><i></i></span></li>`;
  const fichas = PARTICIPANTES.map((p) => `<div class="sm-ficha ${p.lado}" data-p="${p.id}" style="left:${FICHAS[p.id][0]}%;top:${FICHAS[p.id][1]}%"><img class="ic" alt="" src="${imgCampeao(p.champ)}" /><span class="nv">11</span><span class="hp"><i></i></span></div>`).join('');
  app.innerHTML = `<div class="sm" id="sm">
    <div class="sm-bg"><div class="sm-nevoa"></div><div class="sm-fosso">${fossoSvg()}</div></div>${RUNA}
    <div class="sm-arena">
      <div class="sm-dragao" id="sm-dragao"><img src="img/dragao.webp" alt="${OBJETIVO.nome}" draggable="false" /></div>
      ${fichas}
      <div class="sm-voce" id="sm-voce"><img id="sm-voce-img" alt="" /></div>
      <div class="sm-feixe" id="sm-feixe"></div>
    </div>
    <div class="sm-numeros" id="sm-numeros"></div><div class="sm-flash" id="sm-flash"></div><div class="sm-vinheta"></div>
    <div class="sm-top">
      <div class="sm-logo">${COROA}<b>SMITE</b><span>CHALLENGE</span></div>
      <div class="sm-hp"><div class="nome" id="sm-nome-obj">${OBJETIVO.nome}</div>
        <div class="linha"><div class="ico"></div><div class="barra"><div class="cheia" id="sm-cheia"></div><i class="marca" id="sm-marca"></i><div class="num" id="sm-vida">${fmt(OBJETIVO.vida)} / ${fmt(OBJETIVO.vida)}</div></div></div></div>
      <div class="sm-tempo" id="sm-tempo">${AMPULHETA}<div><small>Tempo restante</small><b id="sm-tempo-n">00:${TEMPO_MAX}</b></div></div>
    </div>
    <aside class="sm-painel sm-dano"><h3>Dano no objetivo</h3><ul id="sm-dano">${dano}</ul></aside>
    <div class="sm-painel sm-obj"><div class="ico"></div><div><b>Objetivo</b><span>Golpeie o Dragão com o Smite no momento certo!</span></div></div>
    <div class="sm-painel sm-info"><div class="texto">O dano do Smite<br>é de<b id="sm-dano-smite">900</b></div></div>
    <div class="sm-mira">${MIRA}</div>
    <div class="sm-hab">
      <div class="fundo"></div>
      <div class="sm-retrato"><img id="sm-retrato" alt="" /></div><span class="sm-nivel">11</span>
      <div class="sm-barras"><div class="v"><i></i><span>1.860 / 2.100</span></div><div class="m"><i></i><span>640 / 890</span></div></div>
      <div class="sm-botoes">
        <button type="button" class="sm-bt q" id="sm-q" aria-label="Habilidade (Q)"><span class="quadro"><img id="sm-q-img" alt="" /><span class="recarga" id="sm-q-rec" hidden></span><span class="tecla">Q</span></span><span class="nome" id="sm-q-nome">Habilidade</span></button>
        <button type="button" class="sm-bt f" id="sm-f" aria-label="Smite (F)"><span class="quadro"><img alt="" src="${imgSmite()}" /><span class="tecla">F</span></span><span class="nome">Smite</span></button>
      </div>
    </div>
    <button type="button" class="sm-som" id="sm-som" aria-label="Som"></button>
    <div class="sm-tela" id="sm-tela" hidden></div>
  </div>`;
  atualizarSom();
  $('sm-q').addEventListener('click', usarHab);
  $('sm-f').addEventListener('click', usarSmite);
  $('sm-som').addEventListener('click', () => { mudo = !mudo; gravarLS(CHAVE_MUDO, mudo); atualizarSom(); });
}
function atualizarSom() { const b = $('sm-som'); if (b) b.textContent = mudo ? '🔇' : '🔊'; }
function tela(html) { const el = $('sm-tela'); el.innerHTML = html; el.hidden = !html; }

// --------------------------------------------------------------------------- estado do jogo
let R = null; // rodada atual (criarRodada)
let n = 0; // índice da rodada (0 a RODADAS - 1)
let resultados = []; // { pontos, resultado, margem, campeao }
let fase = 'intro'; // intro | preparo | jogando | fim
let t0 = 0; let raf = 0;
let idx = 0; // próximo golpe a aplicar
let vidaG = OBJETIVO.vida; // vida só pelos golpes dos outros
let qTotal = 0; let qPronto = 0; // dano da habilidade e quando ela volta (s)
let danos = {}; // quem → dano causado
let ultimoTxt = ''; let ultimoTempo = ''; let ultimoResta = TEMPO_MAX;

const vidaAgora = () => Math.max(0, vidaG - qTotal);
const tempoAgora = () => (performance.now() - t0) / 1000;

function hud() {
  const v = vidaAgora(); const cheia = $('sm-cheia');
  const pct = (v / OBJETIVO.vida) * 100;
  cheia.style.width = `${pct}%`;
  const dentro = R && v > 0 && v <= R.smite;
  cheia.classList.toggle('ouro', Boolean(dentro));
  $('sm-dragao').classList.toggle('zona', Boolean(dentro));
  $('sm-f').classList.toggle('pronto', Boolean(dentro) && fase === 'jogando');
  const txt = `${fmt(v)} / ${fmt(OBJETIVO.vida)}`;
  if (txt !== ultimoTxt) { $('sm-vida').textContent = txt; ultimoTxt = txt; }
  if (fase === 'jogando') ultimoResta = Math.max(0, Math.ceil(TEMPO_MAX - tempoAgora()));
  else if (fase !== 'fim') ultimoResta = TEMPO_MAX; // parado no fim da rodada; volta a 50 na próxima
  const resta = ultimoResta;
  const tt = `00:${String(resta).padStart(2, '0')}`;
  if (tt !== ultimoTempo) { $('sm-tempo-n').textContent = tt; ultimoTempo = tt; $('sm-tempo').classList.toggle('fim', resta <= 8 && fase === 'jogando'); }
  // recarga da habilidade
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
  const d = $('sm-dragao'); d.classList.remove('bate'); void d.offsetWidth; d.classList.add('bate');
}

function aplicarGolpes(t) {
  while (idx < R.golpes.length && R.golpes[idx].t <= t) {
    const g = R.golpes[idx++];
    vidaG = g.vida;
    danos[g.quem] = (danos[g.quem] || 0) + g.dano;
    const p = PARTICIPANTES.find((x) => x.id === g.quem);
    if (Math.random() < 0.4) numero(fmt(g.dano), p.lado, 50 + Math.random() * 14, 26 + Math.random() * 20);
    const f = document.querySelector(`.sm-ficha[data-p="${g.quem}"]`);
    if (f) { f.classList.remove('golpe'); void f.offsetWidth; f.classList.add('golpe'); }
    bateu(); SOM.golpe();
  }
  painelDano();
}

function laco() {
  if (fase !== 'jogando') return;
  const t = tempoAgora();
  aplicarGolpes(t);
  hud();
  if (vidaAgora() <= 0) { terminar({ resultado: 'roubado', margem: null, pontos: 0 }, 0, qTotal > 0 && vidaG > 0); return; }
  if (t >= TEMPO_MAX) { terminar({ resultado: 'roubado', margem: null, pontos: 0 }, vidaAgora()); return; }
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
  const x1 = (FICHA_VOCE[0] / 100) * palco.width; const y1 = (FICHA_VOCE[1] / 100) * palco.height;
  const x2 = 0.56 * palco.width; const y2 = 0.4 * palco.height;
  const f = $('sm-feixe');
  f.style.left = `${x1}px`; f.style.top = `${y1}px`;
  f.style.width = `${Math.hypot(x2 - x1, y2 - y1)}px`;
  f.style.transform = `rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
  f.classList.remove('vai'); void f.offsetWidth; f.classList.add('vai');
}
const FICHA_VOCE = [40, 59];

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
  if (res.resultado === 'garantido' || res.resultado === 'roubado') $('sm-dragao').classList.add('morto');
  resultados.push({ pontos: res.pontos, resultado: res.resultado, margem: res.margem, campeao: R.campeao.nome, smite: R.smite });
  await esperar(res.resultado === 'garantido' ? 1400 : 1100);
  (res.resultado === 'garantido' ? SOM.ok : SOM.mau)();
  telaResultado(res, vida, porHabilidade);
}

// --------------------------------------------------------------------------- telas
const total = () => resultados.reduce((s, r) => s + r.pontos, 0);

function telaBloqueada() {
  app.innerHTML = `<div class="sm" style="display:grid;place-items:center"><div class="sm-bg"></div><div class="sm-cartao" style="position:relative;z-index:2">
    <span class="sup">Em desenvolvimento</span><h2>Smite Challenge</h2>
    <p>Este jogo ainda está sendo construído e chega em breve. Enquanto isso, o resto do Rift Arcade está aberto!</p>
    <div class="sm-acoes"><a class="sm-go" href="../../" style="text-decoration:none">VOLTAR AO INÍCIO</a></div></div></div>`;
}

function telaInicio() {
  fase = 'intro';
  const melhor = lerLS(CHAVE_MELHOR, 0);
  tela(`<div class="sm-cartao">
    <span class="sup">Desafio de timing · League of Legends</span>
    <h2>Smite Challenge</h2>
    <p>O Dragão está quase morrendo e o inimigo está de olho. Use o <b>Smite</b> na hora certa para <b>garantir o objetivo</b>: quanto mais perto do dano do Smite (para menos), mais pontos.</p>
    <div class="sm-regras">
      <div><b>Observe</b>A vida do Dragão cai com o dano dos aliados e dos adversários.</div>
      <div><b>Golpeie</b>O Smite mata se a vida for menor ou igual ao dano dele. Cedo demais, falha; tarde demais, roubam.</div>
      <div><b>Habilidade</b>O botão Q do seu campeão também machuca o Dragão. Use para ajustar a vida (mas se ela matar, o objetivo está perdido).</div>
    </div>
    <p>${RODADAS} rodadas, até <b>100 pontos</b> cada. Teclas: <b>F</b> ou <b>Espaço</b> = Smite · <b>Q</b> = habilidade.${melhor ? `<br>Seu recorde: <b>${fmt(melhor)}</b> pontos` : ''}</p>
    <div class="sm-acoes"><button type="button" class="sm-go" data-a="jogar">JOGAR</button></div></div>`);
}

function prepararRodada() {
  R = criarRodada(aleatorio((Date.now() ^ (n * 7919)) >>> 0), n);
  fase = 'preparo';
  idx = 0; vidaG = OBJETIVO.vida; qTotal = 0; qPronto = 0; danos = {}; ultimoTxt = ''; ultimoTempo = '';
  const c = R.campeao;
  $('sm-dragao').className = 'sm-dragao';
  $('sm-numeros').innerHTML = '';
  $('sm-dano-smite').textContent = fmt(R.smite);
  const pos = $('sm-marca'); pos.style.left = `${(R.smite / OBJETIVO.vida) * 100}%`;
  $('sm-voce-img').src = imgCampeao(c.id); $('sm-retrato').src = imgCampeao(c.id); $('sm-q-img').src = imgCampeao(c.id);
  $('sm-dano-voce').src = imgCampeao(c.id);
  $('sm-q-nome').textContent = c.hab;
  painelDano(); hud();
  tela(`<div class="sm-cartao">
    <span class="sup">Rodada ${n + 1} de ${RODADAS}</span>
    <h2>${OBJETIVO.nome}</h2>
    <div class="sm-campeao"><img alt="" src="${imgCampeao(c.id)}" /><div><b>${esc(c.nome)}</b><span>Q · ${esc(c.hab)}: ${fmt(c.dano)} de dano · recarga ${RECARGA_HAB}s</span></div></div>
    <p>O dano do seu Smite é de <b>${fmt(R.smite)}</b>. Golpeie quando a vida do Dragão for <b>menor ou igual</b> a esse valor, o mais perto possível.</p>
    <div class="sm-acoes"><button type="button" class="sm-go" data-a="comecar">COMEÇAR</button></div></div>`);
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

function textoResultado(res, vida, porHabilidade) {
  if (res.resultado === 'garantido') {
    return { sup: res.nota.rotulo, titulo: 'Objetivo garantido!', corpo: `Você golpeou com <b>${fmt(vida)}</b> de vida no Dragão: <b>${fmt(res.margem)}</b> abaixo do dano do Smite (${fmt(R.smite)}).` };
  }
  if (res.resultado === 'cedo') {
    return { sup: 'Cedo demais', titulo: 'O Dragão sobreviveu!', corpo: `Ele ainda tinha <b>${fmt(vida)}</b> de vida, <b>${fmt(res.faltou)}</b> acima do dano do Smite (${fmt(R.smite)}). O time inimigo levou o objetivo.` };
  }
  return { sup: 'Tarde demais', titulo: 'Roubaram o objetivo!', corpo: porHabilidade ? 'A sua habilidade derrubou o Dragão antes do Smite. Só o Smite garante o objetivo!' : 'O Dragão morreu antes do seu Smite.' };
}

function telaResultado(res, vida, porHabilidade) {
  const x = textoResultado(res, vida, porHabilidade);
  const ultima = n >= RODADAS - 1;
  tela(`<div class="sm-cartao">
    <span class="sup">Rodada ${n + 1} de ${RODADAS} · ${x.sup}</span>
    <h2>${x.titulo}</h2>
    <div class="sm-pontos">+${res.pontos}<small>pontos</small></div>
    <p>${x.corpo}</p>
    <p>Total: <b>${total()}</b> pontos</p>
    <div class="sm-acoes"><button type="button" class="sm-go" data-a="${ultima ? 'fim' : 'proxima'}">${ultima ? 'VER RESULTADO' : 'PRÓXIMA RODADA'}</button></div></div>`);
}

function telaFim() {
  const pts = total();
  const melhor = lerLS(CHAVE_MELHOR, 0);
  const recorde = pts > melhor;
  if (recorde) gravarLS(CHAVE_MELHOR, pts);
  const nome = (r) => (r.resultado === 'garantido' ? `margem ${fmt(r.margem)}` : r.resultado === 'cedo' ? 'cedo demais' : 'roubado');
  const linhas = resultados.map((r, i) => `<div class="${r.pontos ? '' : 'ruim'}"><span>Rodada ${i + 1}</span><span>${esc(r.campeao)} · ${nome(r)}</span><b>${r.pontos}</b></div>`).join('');
  const perfeitas = resultados.filter((r) => r.resultado === 'garantido' && r.margem <= 25).length;
  tela(`<div class="sm-cartao">
    <span class="sup">Fim de jogo</span><h2>${pts >= RODADAS * 90 ? 'Smite perfeito!' : pts >= RODADAS * 60 ? 'Bela jungle!' : 'Fim da partida'}</h2>
    <div class="sm-pontos">${pts}<small>de ${RODADAS * 100} pontos</small></div>
    <div class="sm-resumo">${linhas}</div>
    <p>${recorde ? '<b>Novo recorde!</b>' : `Seu recorde: <b>${fmt(Math.max(melhor, pts))}</b> pontos`}${perfeitas ? ` · ${perfeitas} ${perfeitas === 1 ? 'golpe perfeito' : 'golpes perfeitos'}` : ''}</p>
    <div class="sm-acoes"><button type="button" class="sm-go" data-a="jogar">JOGAR DE NOVO</button><a class="sm-go sec" href="../../" style="text-decoration:none">VOLTAR AO INÍCIO</a></div></div>`);
  platform.track('game_end', GAME_ID, { pontos: pts, perfeitas });
  platform.recordResult(GAME_ID, { score: pts, summary: { text: `${pts} pontos`, rodadas: resultados.map((r) => ({ p: r.pontos, r: r.resultado, m: r.margem })) } }).catch(() => {});
}

// --------------------------------------------------------------------------- entradas
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (!a) return;
  if (a === 'jogar') { resultados = []; n = 0; $('sm-dragao').className = 'sm-dragao'; prepararRodada(); }
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
