// Show do Barão: quiz de 10 perguntas sobre o universo e o competitivo de League of Legends,
// no estilo "Show do Milhão". Ajudas: Pinstouro (pular), Monstros do Vazio e Cartas do Twisted Fate.
// Enquanto o jogo é "oculto" (gameById('barao').soAdmin), só administradores conseguem jogar.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import { liberarAbobora } from '../../../shared/passe-aviso.js';
import { t, localeAtual, onLangChange } from '../../../shared/i18n.js';
import {
  NIVEIS, PREMIOS, SEGUROS, PULOS, CARTAS, MONSTROS, letra, semAjuda,
  novoJogo, responder, proxima, parar, pular, usarCarta, usarVazio, premioAoParar, premioAoErrar,
} from './logic.js';

const GAME_ID = 'barao';
const CHAVE_JOGO = 'barao.jogo';
const CHAVE_MELHOR = 'barao.melhor';
const CHAVE_MUDO = 'barao.mudo';
const app = document.getElementById('app');
const fmt = (n) => Number(n).toLocaleString(localeAtual()); // números no idioma da tela
const fmtPt = (n) => Number(n).toLocaleString('pt-BR'); // o que vai para o servidor fica em português
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lerLS = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const gravarLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

// --------------------------------------------------------------------------- áudio (WebAudio, sem arquivos)
let ctx = null;
let mudo = Boolean(lerLS(CHAVE_MUDO, false));
let drone = null;
function audio() {
  if (mudo) return null;
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function nota(freq, t0, dur, { tipo = 'triangle', vol = 0.12, fim = null } = {}) {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = tipo; o.frequency.setValueAtTime(freq, c.currentTime + t0);
  if (fim) o.frequency.exponentialRampToValueAtTime(fim, c.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
  o.connect(g).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05);
}
const SOM = {
  clique: () => nota(660, 0, 0.08, { tipo: 'square', vol: 0.05 }),
  travar: () => { nota(220, 0, 0.5, { tipo: 'sawtooth', vol: 0.07, fim: 160 }); nota(110, 0, 0.6, { tipo: 'sine', vol: 0.12 }); },
  acertou: () => [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.11, 0.35, { vol: 0.13 })),
  errou: () => { nota(300, 0, 0.5, { tipo: 'sawtooth', vol: 0.1, fim: 90 }); nota(150, 0.15, 0.7, { tipo: 'square', vol: 0.07, fim: 60 }); },
  ajuda: () => nota(300, 0, 0.35, { tipo: 'sine', vol: 0.12, fim: 900 }),
  carta: () => { nota(900, 0, 0.1, { tipo: 'square', vol: 0.05 }); nota(1200, 0.06, 0.12, { tipo: 'square', vol: 0.05 }); },
  vazio: () => { nota(90, 0, 0.9, { tipo: 'sawtooth', vol: 0.09, fim: 55 }); nota(180, 0.1, 0.6, { tipo: 'sine', vol: 0.08, fim: 360 }); },
  venceu: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => nota(f, i * 0.14, 0.5, { vol: 0.14 })),
};
function iniciarDrone() {
  const c = audio(); if (!c || drone) return;
  const g = c.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.03, c.currentTime + 2);
  const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
  const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 82.5;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.25; const lg = c.createGain(); lg.gain.value = 0.012;
  lfo.connect(lg).connect(g.gain);
  o1.connect(g); o2.connect(g); g.connect(c.destination);
  o1.start(); o2.start(); lfo.start();
  drone = { g, parar() { g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5); setTimeout(() => { o1.stop(); o2.stop(); lfo.stop(); }, 600); } };
}
function pararDrone() { drone?.parar(); drone = null; }

// --------------------------------------------------------------------------- peças visuais (SVG)
const ICO = {
  vazio: '<svg viewBox="0 0 48 48" fill="none"><path d="M3 24C10 11 38 11 45 24 38 37 10 37 3 24Z" fill="#2a0f55" stroke="#c995ff" stroke-width="2.4"/><ellipse cx="24" cy="24" rx="7" ry="10" fill="#c995ff"/><ellipse cx="24" cy="24" rx="2.4" ry="9" fill="#12062a"/><path d="M24 4v6M14 7l3 5M34 7l-3 5" stroke="#c995ff" stroke-width="2" stroke-linecap="round"/></svg>',
  coroa: '<svg viewBox="0 0 64 40"><path d="M4 34 L10 8 L22 22 L32 4 L42 22 L54 8 L60 34 Z" fill="url(#gc)" stroke="#8a6417" stroke-width="2" stroke-linejoin="round"/><defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b3"/><stop offset="1" stop-color="#d9a82b"/></linearGradient></defs><circle cx="10" cy="8" r="3" fill="#fff1b3"/><circle cx="32" cy="4" r="3.4" fill="#fff1b3"/><circle cx="54" cy="8" r="3" fill="#fff1b3"/><rect x="6" y="34" width="52" height="4" rx="2" fill="#a87414"/></svg>',
  banner: (cor, forma, emblema) => `<svg viewBox="0 0 110 220" preserveAspectRatio="none"><defs><linearGradient id="bn${forma}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2f70"/><stop offset="1" stop-color="#0a1233"/></linearGradient></defs><path d="M6 0h98v176l-49 38-49-38Z" fill="url(#bn${forma})" stroke="#d9a82b" stroke-width="3"/><path d="M14 8h82v164l-41 32-41-32Z" fill="none" stroke="${cor}" stroke-opacity=".5" stroke-width="1.5"/></svg><img class="bz-emb" src="img/${emblema}.webp?v=1" alt="" />`,
};

// --------------------------------------------------------------------------- estado
let jogo = null;
let ddVersion = null;
let sel = null; // opção selecionada, ainda sem travar
let ocupado = false; // revelando resposta
let souAdmin = false;
let cartaRevelando = false;

const iconeMonstro = (m) => (ddVersion ? `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${m.img}.png` : '');
async function versaoDD() {
  const c = lerLS('barao.ddragon');
  if (c && Date.now() - c.at < 864e5) return c.v;
  try {
    const v = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json())[0];
    gravarLS('barao.ddragon', { v, at: Date.now() });
    return v;
  } catch { return null; }
}

// --------------------------------------------------------------------------- montagem (uma vez)
function montar() {
  const escada = Array.from({ length: NIVEIS }, (_, i) => i + 1).map((n) => `<li data-n="${n}" class="${SEGUROS.includes(n) ? 'seguro' : ''}"><span class="n"></span><span class="v" data-p="${n}">${fmt(PREMIOS[n - 1])} pts</span></li>`).join('');
  app.innerHTML = `<div class="bz" id="bz">
    <div class="bz-bg" aria-hidden="true"><div class="bz-feixes"></div><div class="bz-arquibancada"></div><div class="bz-plateia"></div><div class="bz-faixas"></div><div class="bz-chao"></div><div class="bz-anel-chao"></div></div>
    <div class="bz-banner e2" aria-hidden="true">${ICO.banner('#6f8dff', 2, 'ionia')}</div><div class="bz-banner esq" aria-hidden="true">${ICO.banner('#6f8dff', 0, 'demacia')}</div>
    <div class="bz-banner d2" aria-hidden="true">${ICO.banner('#6f8dff', 3, 'freljord')}</div><div class="bz-banner dir" aria-hidden="true">${ICO.banner('#6f8dff', 1, 'noxus')}</div>
    <header class="bz-top">
      <button type="button" class="bz-btn-som" id="bz-som" aria-label="Som"></button>
    </header>
    <div class="bz-palco" aria-hidden="true"><div class="bz-aneis"></div><div class="bz-coroa">${ICO.coroa}</div>
      <h1 class="bz-titulo"><span>SHOW DO</span><b>BARÃO</b></h1>
      <img class="bz-host" src="img/apresentador.webp?v=1" alt="" /></div>
    <aside class="bz-escada"><ol id="bz-escada">${escada}</ol><button type="button" class="bz-parar" id="bz-parar">Parar<small id="bz-parar-v"></small></button></aside>
    <aside class="bz-ajudas" id="bz-ajudas">
      <button type="button" class="bz-aj vazio" id="bz-vazio" title="Monstros do Vazio: três monstros apontam o que acham que é a resposta"><span class="ic"><img src="img/vazio.webp?v=1" alt="" /></span><small>Vazio</small></button>
      <div><div class="bz-cartas" id="bz-cartas">${[0, 1, 2].map((i) => `<button type="button" class="bz-carta" data-slot="${i}" title="Carta do Twisted Fate: escolha uma, só vale uma vez por partida"><span class="miolo"><span class="verso"><img src="img/carta-verso.webp?v=1" alt="" /></span><span class="frente"><img data-f alt="" /><b></b></span></span></button>`).join('')}</div><div class="bz-aj-rot">Cartas do TF</div></div>
      <button type="button" class="bz-pular" id="bz-pular"><span class="ic"><img src="img/pinstouro.webp?v=1" alt="" /><span class="num" id="bz-pulos"></span></span><b>PULAR</b><small>ESPAÇO</small></button>
    </aside>
    <section class="bz-pergunta"><div class="bz-hex bz-pq"><p id="bz-q"></p></div></section>
    <div class="bz-opcoes" id="bz-opc">${[0, 1, 2, 3].map((i) => `<button type="button" class="bz-op bz-hex" data-i="${i}"><span class="in"><b class="l">${letra(i)}</b><span class="t"></span><span class="vt"></span></span></button>`).join('')}</div>
    <button type="button" class="bz-confirmar" id="bz-confirmar" hidden>TRAVAR RESPOSTA</button>
    <div class="bz-aviso" id="bz-aviso" role="status"></div>
    <div class="bz-tela" id="bz-tela"></div>
  </div>`;
  atualizarSom();
}

// --------------------------------------------------------------------------- atualização da tela
const $ = (id) => document.getElementById(id);
function avisar(txt, ms = 2200) { const el = $('bz-aviso'); el.textContent = txt; el.classList.add('on'); clearTimeout(avisar.t); avisar.t = setTimeout(() => el.classList.remove('on'), ms); }
function atualizarSom() { const b = $('bz-som'); if (b) { b.textContent = mudo ? '🔇' : '🔊'; b.title = mudo ? t('Ligar o som') : t('Desligar o som'); } }
function atualizarEscada() { document.querySelectorAll('#bz-escada [data-p]').forEach((el) => { el.textContent = `${fmt(PREMIOS[Number(el.dataset.p) - 1])} pts`; }); }

function desenhar() {
  if (!jogo) return;
  const p = jogo.pergunta;
  const jogando = jogo.status === 'jogando';
  $('bz-q').textContent = p.q;
  document.querySelectorAll('#bz-escada li').forEach((li) => {
    const n = Number(li.dataset.n);
    li.classList.toggle('atual', n === jogo.nivel);
    li.classList.toggle('feito', n < jogo.nivel);
  });
  const ativo = document.querySelector('#bz-escada li.atual');
  const ol = $('bz-escada');
  if (ativo && ol.scrollWidth > ol.clientWidth) ol.scrollLeft = ativo.offsetLeft - ol.clientWidth / 2 + ativo.clientWidth / 2; // celular: centraliza o nível atual
  document.querySelectorAll('.bz-op').forEach((b, i) => {
    const fora = p.eliminadas.includes(i);
    b.querySelector('.t').textContent = p.opcoes[i];
    b.disabled = !jogando || fora || ocupado;
    b.className = `bz-op bz-hex${fora ? ' fora' : ''}${sel === i && jogando ? ' sel' : ''}`;
    const votos = p.votos ? p.votos.filter((v) => v.voto === i) : [];
    b.querySelector('.vt').innerHTML = votos.map((v) => { const m = MONSTROS.find((x) => x.id === v.id); return ddVersion ? `<img src="${iconeMonstro(m)}" alt="${esc(m.nome)}" title="${esc(m.nome)}" onerror="this.outerHTML='<span class=&quot;vf&quot;>${esc(m.nome[0])}</span>'" />` : `<span class="vf" title="${esc(m.nome)}">${esc(m.nome[0])}</span>`; }).join('');
  });
  $('bz-confirmar').hidden = !(jogando && sel != null && !ocupado);
  const livre = !semAjuda(jogo.nivel); // na última pergunta não há ajudas
  document.getElementById('bz-ajudas')?.classList.toggle('travadas', !livre);
  $('bz-vazio').disabled = !jogando || jogo.vazio || ocupado || !livre;
  desenharCartas(jogando);
  $('bz-pulos').textContent = `×${jogo.pulos}`;
  $('bz-pular').disabled = !jogando || jogo.pulos <= 0 || ocupado || !livre;
  const pv = premioAoParar(jogo.nivel);
  $('bz-parar').disabled = !jogando || jogo.nivel <= 1 || ocupado;
  $('bz-parar-v').textContent = jogo.nivel > 1 ? t('levar {valor} pts', { valor: fmt(pv) }) : 'responda a 1ª pergunta';
}

function desenharCartas(jogando) {
  const usada = jogo.cartaUsada;
  document.querySelectorAll('.bz-carta').forEach((b) => {
    const slot = Number(b.dataset.slot);
    const id = jogo.cartaOrdem[slot];
    const c = CARTAS.find((x) => x.id === id);
    b.dataset.cor = id;
    b.querySelector('.frente img').src = `img/carta-${id}.webp?v=1`;
    b.querySelector('.frente b').textContent = `−${c.tira}`;
    b.classList.toggle('virada', Boolean(usada));
    b.classList.toggle('escolhida', usada?.slot === slot);
    b.classList.toggle('descartada', Boolean(usada) && usada.slot !== slot);
    b.disabled = Boolean(usada) || !jogando || ocupado || cartaRevelando || semAjuda(jogo.nivel);
    b.title = !usada ? t('Carta do Twisted Fate: escolha uma, só vale uma vez por partida')
      : usada.slot === slot ? t(c.tira === 1 ? '{carta}: tirou 1 opção errada' : '{carta}: tirou {n} opções erradas', { carta: t(c.nome), n: c.tira }) : t('Era a {carta} (tira {n})', { carta: t(c.nome), n: c.tira });
  });
}

// --------------------------------------------------------------------------- telas
let telaAtual = null; // para redesenhar a tela aberta quando o idioma muda
function tela(html, refazer = null) { const el = $('bz-tela'); el.innerHTML = html; el.hidden = !html; telaAtual = html ? refazer : null; }
function telaInicio() {
  pararDrone();
  const melhor = lerLS(CHAVE_MELHOR, 0);
  const salvo = lerLS(CHAVE_JOGO);
  const retomar = salvo && salvo.v === 2 && (salvo.status === 'jogando' || salvo.status === 'acertou');
  tela(`<div class="bz-cartao">
    <span class="sup">Quiz de League of Legends</span>
    <h2>Show do Barão</h2>
    <p>Avance a cada pergunta, acumule pontos e mostre o quanto você conhece do universo de League of Legends. Será que você chega até o fim e se torna o grande campeão?</p>
    <div class="bz-regras">
      <div><b>Pinstouro</b>Pule ${PULOS} vezes: a pergunta é trocada por outra, mas você continua na mesma etapa e no mesmo prêmio.</div>
      <div class="v"><b>Monstros do Vazio</b>Cho'Gath, Kha'Zix e Vel'Koz apontam a resposta que acham certa.</div>
      <div><b>Cartas do TF</b>Três cartas viradas: escolha uma, uma única vez na partida. Ela revela se tira 1, 2 ou 3 opções erradas.</div>
    </div>
    ${melhor ? `<div class="bz-melhor">Seu recorde: <b>${fmt(melhor)} pts</b></div>` : ''}
    <div class="bz-acoes">
      ${retomar ? '<button type="button" class="bz-go" id="bz-continuar">CONTINUAR</button><button type="button" class="bz-go sec" id="bz-novo">Novo jogo</button>' : '<button type="button" class="bz-go" id="bz-novo">COMEÇAR</button>'}
    </div></div>`, telaInicio);
}
function telaFim() {
  const j = jogo;
  const titulos = { ganhou: ['Você é o Barão!', `Todas as ${NIVEIS} respostas certas. Lenda do Rift!`], parou: ['Você parou!', 'Decisão sábia: ficou com o prêmio garantido.'], errou: ['Resposta errada!', `A resposta certa era ${letra(j.pergunta.certa)}: ${esc(j.pergunta.opcoes[j.pergunta.certa])}.`] };
  const [h, txt] = titulos[j.resultado];
  const melhor = lerLS(CHAVE_MELHOR, 0);
  tela(`<div class="bz-cartao"><span class="sup">Fim de jogo</span><h2>${h}</h2><p>${txt}</p>
    <div class="premio">${fmt(j.premio)}<small>pts</small></div>
    <div class="bz-melhor">Seu recorde: <b>${fmt(Math.max(melhor, j.premio))} pts</b>${j.premio > melhor && j.premio > 0 ? ' · novo recorde!' : ''}</div>
    <div class="bz-acoes"><button type="button" class="bz-go" id="bz-novo">JOGAR DE NOVO</button><a class="bz-go sec" href="../../">Voltar ao início</a></div></div>`, telaFim);
}
function telaBloqueada() {
  app.innerHTML = `<div class="bz" style="display:grid;place-items:center"><div class="bz-bg"><div class="bz-feixes"></div></div><div class="bz-cartao" style="position:relative;z-index:2">
    <span class="sup">Em desenvolvimento</span><h2>Show do Barão</h2>
    <p>Este jogo ainda está sendo construído e chega em breve. Enquanto isso, o resto do Rift Arcade está aberto!</p>
    <div class="bz-acoes"><a class="bz-go" href="../../">VOLTAR AO INÍCIO</a></div></div></div>`;
}

// --------------------------------------------------------------------------- fluxo
function salvar() { gravarLS(CHAVE_JOGO, jogo); }
function comecar() {
  jogo = novoJogo(); sel = null; ocupado = false; salvar();
  platform.track('game_start', GAME_ID, {});
  tela(''); desenhar(); iniciarDrone();
}
function continuar() { tela(''); desenhar(); iniciarDrone(); }
function escolher(i) {
  if (ocupado || jogo.status !== 'jogando' || jogo.pergunta.eliminadas.includes(i)) return;
  sel = i; SOM.clique(); desenhar();
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function travar() {
  if (ocupado || sel == null || jogo.status !== 'jogando') return;
  ocupado = true; const escolhida = sel;
  const botoes = [...document.querySelectorAll('.bz-op')];
  desenhar(); botoes[escolhida].classList.add('travada'); botoes.forEach((b) => { b.disabled = true; });
  SOM.travar();
  await esperar(2200);
  jogo = responder(jogo, escolhida);
  botoes.forEach((b, i) => b.classList.remove('travada', 'sel'));
  botoes[jogo.pergunta.certa].classList.add('certa');
  if (escolhida !== jogo.pergunta.certa) botoes[escolhida].classList.add('errada');
  salvar();
  if (jogo.status === 'acertou') {
    SOM.acertou();
    await esperar(1800);
    jogo = proxima(jogo); sel = null; ocupado = false; salvar(); desenhar();
    if (SEGUROS.includes(jogo.nivel - 1)) avisar(t('Prêmio garantido: {valor} pts!', { valor: fmt(PREMIOS[jogo.nivel - 2]) }), 2400);
    return;
  }
  (jogo.resultado === 'ganhou' ? SOM.venceu : SOM.errou)();
  await esperar(jogo.resultado === 'ganhou' ? 1800 : 2400);
  ocupado = false; fim();
}
function fim() {
  pararDrone();
  const j = jogo;
  const melhor = lerLS(CHAVE_MELHOR, 0);
  telaFim();
  if (j.premio > melhor) gravarLS(CHAVE_MELHOR, j.premio);
  gravarLS(CHAVE_JOGO, { ...j, status: 'fim' });
  platform.track('game_end', GAME_ID, { nivel: j.nivel, resultado: j.resultado, premio: j.premio });
  platform.recordResult(GAME_ID, {
    score: j.premio,
    summary: { text: `${fmtPt(j.premio)} pts`, nivel: j.nivel, resultado: j.resultado, premio: j.premio },
  });
  liberarAbobora(); // as abóboras do passe aparecem junto do resultado
}
function pararJogo() {
  if (ocupado || jogo.status !== 'jogando' || jogo.nivel <= 1) return;
  if (!window.confirm(t('Parar e levar {valor} pts?', { valor: fmt(premioAoParar(jogo.nivel)) }))) return;
  jogo = parar(jogo); salvar(); fim();
}
function ajudaPular() {
  if (ocupado || jogo.status !== 'jogando' || jogo.pulos <= 0 || semAjuda(jogo.nivel)) return;
  jogo = pular(jogo); sel = null; salvar(); SOM.ajuda(); avisar(t('Pinstouro! Pergunta trocada.')); desenhar();
}
function ajudaVazio() {
  if (ocupado || jogo.status !== 'jogando' || jogo.vazio || semAjuda(jogo.nivel)) return;
  jogo = usarVazio(jogo); salvar(); SOM.vazio(); avisar(t('Os monstros do Vazio apontam suas respostas…'), 2800); desenhar();
}
async function ajudaCarta(slot) {
  if (ocupado || cartaRevelando || jogo.status !== 'jogando' || jogo.cartaUsada) return;
  const antes = jogo;
  jogo = usarCarta(jogo, slot);
  if (!jogo.cartaUsada) { jogo = antes; return; }
  salvar(); SOM.carta();
  cartaRevelando = true; desenhar(); // a carta vira e mostra a cor
  const c = CARTAS.find((x) => x.id === jogo.cartaUsada.id);
  await esperar(900);
  cartaRevelando = false;
  if (sel != null && jogo.pergunta.eliminadas.includes(sel)) sel = null;
  avisar(t(c.tira === 1 ? '{carta}: 1 opção errada eliminada!' : '{carta}: {n} opções erradas eliminadas!', { carta: t(c.nome), n: c.tira }), 2600); desenhar();
}

// --------------------------------------------------------------------------- eventos
app.addEventListener('click', (e) => {
  const op = e.target.closest('.bz-op'); if (op && jogo) return escolher(Number(op.dataset.i));
  const carta = e.target.closest('[data-slot]'); if (carta && jogo) return ajudaCarta(Number(carta.dataset.slot));
  const id = e.target.closest('button')?.id;
  if (id === 'bz-confirmar') travar();
  else if (id === 'bz-vazio') ajudaVazio();
  else if (id === 'bz-pular') ajudaPular();
  else if (id === 'bz-parar') pararJogo();
  else if (id === 'bz-novo') comecar();
  else if (id === 'bz-continuar') continuar();
  else if (id === 'bz-som') { mudo = !mudo; gravarLS(CHAVE_MUDO, mudo); atualizarSom(); if (mudo) pararDrone(); else if (jogo?.status === 'jogando') iniciarDrone(); }
});
document.addEventListener('keydown', (e) => {
  if (!jogo || !$('bz-tela')?.hidden) return;
  if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); ajudaPular(); return; }
  const i = 'abcd'.indexOf(e.key.toLowerCase());
  if (i >= 0 && e.key.length === 1) escolher(i);
  else if (e.key === 'Enter') travar();
});

onLangChange(() => { if (!jogo) return; atualizarEscada(); atualizarSom(); desenhar(); telaAtual?.(); });

// --------------------------------------------------------------------------- início
(async function iniciar() {
  await platform.init();
  const teste = ['localhost', '127.0.0.1'].includes(location.hostname) && /[?&]teste=1/.test(location.search);
  souAdmin = await platform.isAdmin();
  const aberto = !gameById(GAME_ID)?.soAdmin;
  if (!souAdmin && !teste && !aberto) { telaBloqueada(); return; }
  montar();
  versaoDD().then((v) => { ddVersion = v; if (!ocupado) desenhar(); });
  const salvo = lerLS(CHAVE_JOGO);
  jogo = salvo && salvo.v === 2 && (salvo.status === 'jogando' || salvo.status === 'acertou') ? (salvo.status === 'acertou' ? proxima(salvo) : salvo) : novoJogo();
  desenhar();
  telaInicio();
}());
