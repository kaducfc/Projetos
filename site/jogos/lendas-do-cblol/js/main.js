// Lendas do CBLOL: monte um time com jogadores de todas as
// eras do CBLOL e simule a campanha.
import {
  ROTAS, VAGAS, NOME_VAGA, novoJogo, rolar, opcoesBonus, usarBonus, escolher, vagasPossiveis, completo, forca, simular,
  dadosRestantes, dadosTotal, dadosUsados,
  TITULO_RESULTADO, pontos,
} from './logic.js';
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import { vantagens } from '../../../shared/ranked.js';
import { avisoInicio, avisoComeco, avisoFim } from '../../../shared/aviso-ranked.js';

const GAME_ID = 'cblol';
const NAME = gameById(GAME_ID)?.name || 'Lendas do CBLOL';
const app = document.getElementById('app');
mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

// Posição de cada marcação de rota no desenho do mapa (em % da largura e da altura).
const POS = { top: [16.56, 12.88], jungle: [27.88, 34.98], mid: [50.51, 45.05], adc: [71.39, 78.6], sup: [87.66, 60.67] };
const MAPA = '../../shared/assets/mapa/summoners-rift-1100.webp';
const SIGLA = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'ADC', sup: 'SUP', reserva: 'RES', tecnico: 'TÉC', tecnico2: 'TÉC' };

let times = [];
let byId = new Map();
let jogo = novoJogo();
let historico = [];
let mostrados = 0; // quantas rodadas da campanha já apareceram na tela
let anim = null; // rodada sendo mostrada ao vivo
const abertos = new Set(); // rodadas com "Ver partida" aberto

// Como a campanha é mostrada (fica guardado neste navegador).
// [nome, segundos reais de uma partida média, pausa entre partidas em ms]
const VELOCIDADES = { lenta: ['Lenta', 20, 1400], normal: ['Normal', 14, 1100], rapida: ['Rápida', 8, 700], ultra: ['Ultra', 3, 300] };
const DURACAO_MEDIA = 29 * 60; // segundos de jogo de uma partida média
const PREF_KEY = 'cblol.exibicao';
let pref = { auto: false, vel: 'normal' };
try { pref = { ...pref, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { /* sem armazenamento */ }
if (!VELOCIDADES[pref.vel]) pref.vel = 'normal';
const salvarPref = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch { /* sem armazenamento */ } };
const pausa = () => VELOCIDADES[pref.vel][2];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oculto = () => jogo.modo === 'oculto' && !completo(jogo);
const ovrTxt = (v) => (oculto() ? '?' : String(v));
const lugarTxt = (n) => (n ? `${n}º lugar` : '');
const nomeTime = () => (jogo.nome || '').trim() || 'Seu time';

// Escudo do OVR, com as mesmas faixas da Carreira no Rift: prata (<70),
// ouro (70–79), platina (80–89), diamante (90–94) e challenger (95+).
const ovrTier = (ovr) => (ovr >= 95 ? 'challenger' : ovr >= 90 ? 'diamante' : ovr >= 80 ? 'platina' : ovr >= 70 ? 'ouro' : 'prata');
function ovrShield(ovr) {
  const tier = ovrTier(ovr);
  return `<div class="ovr-shield tier-${tier}" title="OVR médio ${ovr}">
    <img src="../../shared/assets/trofeus/${tier}.png" alt="" onload="this.classList.add('loaded')" onerror="this.parentElement.classList.add('no-img'); this.remove()" />
    <small>OVR</small><b>${ovr}</b></div>`;
}

function salvar(urgent = false) {
  platform.writeSave(GAME_ID, { v: 1, jogo, historico, mostrados }, { urgent });
}

function carregar() {
  const s = platform.loadLocalSave(GAME_ID);
  if (s?.v === 1 && s.jogo) {
    jogo = s.jogo;
    historico = s.historico || [];
    mostrados = s.mostrados || 0;
    if (jogo.atual && !byId.has(jogo.atual)) jogo.atual = null;
  }
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
}

// ------------------------------------------------------------------ montagem

function pessoasAtual() {
  const t = byId.get(jogo.atual);
  if (!t) return [];
  return [...t.jogadores.map((j) => ({ ...j, tipo: 'jogador' })), ...(t.tecnico ? [{ ...t.tecnico, tipo: 'tecnico', rota: 'tecnico' }] : [])];
}

function drawnBox() {
  const t = byId.get(jogo.atual);
  if (!t) {
    return `<div class="box"><p class="muted small" style="margin:0">${Object.values(jogo.vagas).some(Boolean)
      ? 'Role de novo para sortear o próximo time.'
      : 'Role o dado: sai um time de algum split do CBLOL. Escolha um jogador (ou o técnico) dele e role de novo até completar o seu time.'}</p></div>`;
  }
  const bonus = opcoesBonus(jogo, times);
  const people = pessoasAtual().map((p) => {
    const vs = vagasPossiveis(jogo, p);
    const acts = vs.map((v) => `<button class="pick${v === 'reserva' ? ' res' : ''}" data-pick="${esc(p.nome)}" data-vaga="${v}">${v === 'reserva' ? 'Reserva' : v === 'tecnico' ? 'Técnico' : 'Titular'}</button>`).join('');
    const sub = p.tipo === 'tecnico' ? 'técnico' : `${p.jogos} ${p.jogos === 1 ? 'jogo' : 'jogos'}${p.titular ? '' : ' · reserva'}`;
    return `<div class="person${vs.length ? '' : ' off'}">
      <span class="role">${p.tipo === 'tecnico' ? 'Técnico' : NOME_VAGA[p.rota]}</span>
      <span class="nm">${esc(p.nome)}<small>${sub}</small></span>
      <span class="ovr${oculto() ? ' hidden' : ''}">${ovrTxt(p.ovr)}</span>
      <span class="acts">${acts}</span>
    </div>`;
  }).join('');
  return `<div class="box">
    <div class="drawn-head"><span class="drawn-label">Saiu</span><span class="drawn-place">${lugarTxt(t.colocacao)}</span></div>
    <p class="drawn-team">${esc(t.time)}</p>
    <p class="drawn-ed">${esc(t.edicao)}</p>
    <div class="bonus">
      <span class="drawn-label">${dadosTotal(jogo) > 1 ? `Dados bônus (${dadosRestantes(jogo)} de ${dadosTotal(jogo)})` : `Dado bônus ${dadosRestantes(jogo) ? '(1 por partida)' : '(já usado)'}`}</span>
      <div class="seg">
        <button data-bonus="org" ${bonus.org.length ? '' : 'disabled'}>🎲 Outro split do ${esc(t.org)}</button>
        <button data-bonus="ano" ${bonus.ano.length ? '' : 'disabled'}>🎲 Outro time de ${t.ano}</button>
      </div>
    </div>
    <div class="people">${people}</div>
  </div>`;
}

function slotHtml(v, bench = false) {
  const p = jogo.vagas[v];
  const podeEntrar = !p && pessoasAtual().some((x) => vagasPossiveis(jogo, x).includes(v));
  const cls = `slot${p ? ' full' : ''}${podeEntrar ? ' can' : ''}`;
  const style = bench ? '' : ` style="left:${POS[v][0]}%;top:${POS[v][1]}%"`;
  // No mapa a vaga vazia deixa ver a marcação da rota que já está no desenho.
  const dot = `<span class="dot">${p ? ovrTxt(p.ovr) : bench ? SIGLA[v] : ''}</span>`;
  const txt = `<span class="lbl">${NOME_VAGA[v]}</span>${p ? `<span class="who">${esc(p.nome)}</span><span class="from">${esc(p.time)} · ${esc(p.edicao.replace(/^CBLOL |^LTA Sul /, ''))}</span>` : ''}`;
  return bench ? `<div class="${cls}">${dot}<span class="txt">${txt}</span></div>` : `<div class="${cls}"${style}>${dot}${txt}</div>`;
}


function scoreBox() {
  const f = forca(jogo.vagas);
  const cheio = completo(jogo);
  const n = VAGAS.filter((v) => jogo.vagas[v]).length;
  const rows = VAGAS.map((v) => {
    const p = jogo.vagas[v];
    return `<div><span>${NOME_VAGA[v]}</span><span>${p ? esc(p.nome) : '—'}</span><b>${p ? ovrTxt(p.ovr) : ''}</b></div>`;
  }).join('');
  return `<div class="box">
    <div class="score-big"><h3 style="margin:0"><span class="team-name">${esc(nomeTime())}</span>${n}/7${f.media && !oculto() ? ' · OVR médio' : ''}</h3>
      ${f.media && !oculto() ? ovrShield(Math.round(f.media)) : ''}</div>
    <div class="lineup">${rows}</div>
  </div>`;
}

function renderMontagem() {
  const cheio = completo(jogo);
  const primeira = !Object.values(jogo.vagas).some(Boolean) && !jogo.atual;
  const left = cheio
    ? `<div class="box"><h3>Time completo</h3><p class="muted small" style="margin:0 0 12px">Força ${Math.round(forca(jogo.vagas).forca)}. Hora de ver até onde ele chega.</p>
        <button class="btn btn-gold" data-act="simular">Simular campanha →</button></div>`
    : `${primeira || !(jogo.nome || '').trim() ? `<div class="box">
        <h3><label for="nome-time">Nome do seu time</label></h3>
        <input id="nome-time" class="name-input" maxlength="24" autocomplete="off" value="${esc(jogo.nome || '')}" />
      </div>` : ''}<div class="box">
        <h3>Modo</h3>
        <div class="seg">
          <button data-modo="normal" class="${jogo.modo === 'normal' ? 'on' : ''}" ${primeira ? '' : 'disabled'}>Normal</button>
          <button data-modo="oculto" class="${jogo.modo === 'oculto' ? 'on' : ''}" ${primeira ? '' : 'disabled'}>Oculto</button>
        </div>
        <p class="hint-text">${jogo.modo === 'oculto' ? 'Só os nomes: os OVRs aparecem quando o time estiver completo. <b>Vale PDR na ranqueada</b> (as 3 primeiras do dia; conta a melhor).' : 'Os OVRs aparecem durante a escolha. Modo para treinar: <b>não vale ranqueada</b>.'}</p>
      </div>
      ${drawnBox()}
      <button class="btn btn-roll" data-act="rolar" ${jogo.atual ? 'disabled' : ''}>Rolar 🎲</button>`;
  app.innerHTML = `
    <header class="dt-head">
      <div><p class="eyebrow">◆ Monte · Simule · CBLOL de todas as eras</p><h1>${esc(NAME)}</h1></div>
      <span class="meta">Modo ${jogo.modo === 'oculto' ? 'Oculto' : 'Normal'}${dadosUsados(jogo) ? ` · ${dadosUsados(jogo)} de ${dadosTotal(jogo)} ${dadosTotal(jogo) > 1 ? 'dados bônus usados' : 'dado bônus usado'}` : ''}</span>
    </header>
    <div class="cols">
      <div class="col-left" style="display:flex;flex-direction:column;gap:12px">${left}</div>
      <div class="col-map">
        <div class="rift"><img src="${MAPA}" alt="Mapa do Summoner's Rift" width="1100" height="1081" decoding="async" />${ROTAS.map((r) => slotHtml(r)).join('')}</div>
        <div class="bench">${slotHtml('reserva', true)}${slotHtml('tecnico', true)}</div>
      </div>
      <div>${scoreBox()}</div>
    </div>
    <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>`;
}

// ------------------------------------------------------------------ campanha

const relogio = (seg) => `${Math.floor(seg / 60)}:${String(Math.floor(seg % 60)).padStart(2, '0')}`;
const chipTxt = (g, i, n) => `${n > 1 ? `Game ${i + 1} · ` : ''}${g.placar[0]}–${g.placar[1]} abates${g.mvp ? ` · MVP ${esc(g.mvp)}` : ''}`;

function tabelaLado(titulo, linhas, mvp) {
  const rows = linhas.map((j) => `<tr${j.nome === mvp ? ' class="mvp"' : ''}>
      <td class="r">${SIGLA[j.rota]}</td><td class="nm">${esc(j.nome)}${j.nome === mvp ? ' <span class="star">MVP</span>' : ''}</td>
      <td class="n">${j.ovr}</td><td class="n kda">${j.k}/${j.d}/${j.a}</td></tr>`).join('');
  return `<div class="side"><p class="side-t">${esc(titulo)}</p>
    <table class="stats"><thead><tr><th></th><th>Jogador</th><th class="n">OVR</th><th class="n">K/D/A</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function detalhesHtml(r, i) {
  if (!r.jogos.every((g) => g.nos)) return '';
  const partes = r.jogos.map((g, gi) => `<div class="match">
      <p class="match-t"><b class="${g.venceu ? 'w' : 'l'}">${r.jogos.length > 1 ? `Game ${gi + 1} · ` : ''}${g.venceu ? 'Vitória' : 'Derrota'} ${g.placar[0]}–${g.placar[1]}</b><span>⏱ ${relogio(g.duracao)}</span></p>
      <div class="sides">${tabelaLado(nomeTime(), g.nos, g.mvp)}${tabelaLado(r.adv.time, g.eles, null)}</div>
    </div>`).join('');
  return `<details class="more" data-i="${i}"${abertos.has(i) ? ' open' : ''}><summary>Ver ${r.jogos.length > 1 ? 'as partidas' : 'a partida'}</summary>${partes}</details>`;
}

function roundHtml(r, i, { nova = false, pendente = false } = {}) {
  const gs = pendente ? '' : r.jogos.map((g, gi) => `<span class="${g.venceu ? 'w' : 'l'}">${chipTxt(g, gi, r.jogos.length)}</span>`).join('');
  return `<div class="round${nova ? ' new' : ''}" data-round="${i}">
    <span class="ph">${esc(r.fase)}${r.melhorDe ? ` · MD${r.melhorDe}` : ''}</span>
    <span class="vs">vs ${esc(r.adv.time)}<small>${esc(r.adv.edicao)} · OVR ${r.adv.ovr.toFixed(0)}</small></span>
    <span class="res ${pendente ? 'live' : r.venceu ? 'w' : 'l'}">${pendente ? (r.jogos.length > 1 ? '0–0' : '') : `${r.placar[0]}–${r.placar[1]}`}</span>
    <div class="games">${gs}</div>
    ${pendente ? '' : detalhesHtml(r, i)}
  </div>`;
}

function controlesHtml() {
  const opts = Object.entries(VELOCIDADES).map(([k, [nome]]) => `<option value="${k}"${pref.vel === k ? ' selected' : ''}>${nome}</option>`).join('');
  return `<div class="ctrl">
    <div class="seg modo-exib">
      <button data-exib="jogo" class="${pref.auto ? '' : 'on'}">Jogo a jogo</button>
      <button data-exib="auto" class="${pref.auto ? 'on' : ''}">Automático</button>
    </div>
    <label class="vel"><span>Velocidade</span><select data-vel aria-label="Velocidade">${opts}</select></label>
    <button class="btn-ghost" data-act="tudo">Mostrar tudo</button>
  </div>`;
}

function renderCampanha({ nova = false } = {}) {
  const c = jogo.campanha;
  const total = c.rodadas.length;
  const fim = mostrados >= total && !anim;
  const rs = c.rodadas.slice(0, mostrados).map((r, i) => roundHtml(r, i, { nova: nova && i === mostrados - 1, pendente: anim?.idx === i })).join('');
  const bom = ['campeao', 'vice', 'final'].includes(c.resultado);
  const botao = anim ? '<button class="btn btn-roll" data-act="pular">Pular ⏩</button>'
    : `<button class="btn btn-roll" data-act="proximo">${mostrados ? 'Próximo jogo →' : 'Começar →'}</button>`;
  app.innerHTML = `
    <header class="dt-head">
      <div><p class="eyebrow">◆ A campanha · ${esc(NAME)}</p><h1>${esc(nomeTime())}</h1></div>
      <span class="meta">Força ${Math.round(c.forca)} · Modo ${jogo.modo === 'oculto' ? 'Oculto' : 'Normal'}</span>
    </header>
    <div class="camp">
      <div class="camp-top"><span class="muted small">Fase de pontos: 7 jogos (3 vitórias classificam) · Quartas MD3 · Semi e final MD5</span>
        ${mostrados >= total ? '' : controlesHtml()}</div>
      ${rs}
      ${fim ? `<div class="final${bom ? '' : ' bad'}">
          <p class="final-team">${esc(nomeTime())}</p>
          <p class="t">${TITULO_RESULTADO[c.resultado]}</p>
          <p>${c.vitoriasGrupos} ${c.vitoriasGrupos === 1 ? 'vitória' : 'vitórias'} na fase de pontos · ${pontos(c)} pontos</p>
          <div class="acts"><button class="btn btn-gold" data-act="compartilhar">Compartilhar</button>
            <button class="btn btn-roll" data-act="nova">Nova partida</button></div>
        </div>` : botao}
    </div>
    <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>`;
}

// Comemoração do título (igual à da Carreira no Rift quando vem um troféu).
function comemorar() {
  const c = jogo.campanha;
  if (!c || c.resultado !== 'campeao' || c.comemorado || mostrados < c.rodadas.length) return;
  c.comemorado = true;
  salvar(true);
  const jogos = c.rodadas.flatMap((r) => r.jogos);
  const v = jogos.filter((g) => g.venceu).length;
  const d = jogos.length - v;
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.innerHTML = `<div class="modal trophy-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-campeao">
      <div class="rays"></div>
      <div class="trophy-art"><img src="../../shared/assets/trofeus/cblol.png?v=2" alt="Troféu do CBLOL" width="150" /></div>
      <p class="eyebrow">Campeão do CBLOL · ${esc(NAME)}</p>
      <h2 id="titulo-campeao">${esc(nomeTime())}</h2>
      <p class="parabens">Parabéns! O seu time levantou a taça.</p>
      <div class="t-stats">
        <div><b>${v}</b><small>${v === 1 ? 'vitória' : 'vitórias'}</small></div>
        <div><b>${d}</b><small>${d === 1 ? 'derrota' : 'derrotas'}</small></div>
        <div><b>${pontos(c)}</b><small>pontos</small></div>
      </div>
      <button class="btn btn-gold" data-fechar>Continuar</button>
    </div>`;
  const fechar = () => { el.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = (e) => { if (e.key === 'Escape') fechar(); };
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-fechar]')) fechar(); });
  document.addEventListener('keydown', esc_);
  document.body.append(el);
  el.querySelector('[data-fechar]').focus();
}

// Mostra o jogo acontecendo: relógio correndo e abates aparecendo aos
// poucos; o resultado só aparece no fim. "Pular" termina na hora.
const espera = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

async function animar(idx) {
  const r = jogo.campanha.rodadas[idx];
  const eu = { idx, pular: false, parar: false };
  anim = eu;
  render({ nova: true });
  const el = app.querySelector(`[data-round="${idx}"]`);
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const res = el.querySelector('.res');
  const games = el.querySelector('.games');
  let v = 0;
  let d = 0;
  for (const [gi, g] of r.jogos.entries()) {
    const chip = document.createElement('span');
    chip.className = 'live';
    games.append(chip);
    // Momento (em segundos de jogo) de cada abate, em ordem.
    const abates = [...Array(g.placar[0]).fill(0), ...Array(g.placar[1]).fill(1)]
      .map((lado) => ({ lado, t: (0.1 + Math.random() * 0.88) * g.duracao }))
      .sort((a, b) => a.t - b.t);
    let p = 0;
    let antes = performance.now();
    for (;;) {
      if (eu.parar) return;
      const agoraMs = performance.now();
      // Soma aos poucos: trocar a velocidade no meio do jogo vale na hora.
      // Partida mais longa demora um pouco mais que a média na tela.
      const msTela = VELOCIDADES[pref.vel][1] * 1000 * (g.duracao / DURACAO_MEDIA);
      p = eu.pular ? 1 : Math.min(1, p + (agoraMs - antes) / msTela);
      antes = agoraMs;
      const agora = p * g.duracao;
      const feitos = abates.filter((x) => x.t <= agora);
      const nos = feitos.filter((x) => x.lado === 0).length;
      chip.innerHTML = `${r.jogos.length > 1 ? `Game ${gi + 1} · ` : ''}⏱ ${relogio(agora)} · <b class="ka">${nos}</b>–<b class="ke">${feitos.length - nos}</b> abates`;
      if (p >= 1) break;
      await new Promise((ok) => { requestAnimationFrame(ok); });
    }
    chip.className = g.venceu ? 'w' : 'l';
    chip.innerHTML = chipTxt(g, gi, r.jogos.length);
    if (g.venceu) v++; else d++;
    res.textContent = `${v}–${d}`;
    if (!eu.pular && gi < r.jogos.length - 1) await espera(pausa());
  }
  if (eu.parar) return;
  anim = null;
  render();
  comemorar();
  // Automático: acabou um confronto, começa o próximo.
  if (pref.auto && mostrados < jogo.campanha.rodadas.length) {
    await espera(pausa());
    if (pref.auto && !anim && jogo.fase === 'fim' && jogo.campanha && mostrados < jogo.campanha.rodadas.length) avancar();
  }
}

function avancar() {
  if (anim || !jogo.campanha || mostrados >= jogo.campanha.rodadas.length) return;
  mostrados++;
  if (mostrados >= jogo.campanha.rodadas.length) terminar();
  salvar();
  animar(mostrados - 1);
}

function render(opts) {
  if (jogo.fase === 'fim' && jogo.campanha) renderCampanha(opts);
  else renderMontagem();
}

// Campeão sem perder nenhum jogo: 7-0 na fase de pontos e todas as séries
// dos playoffs vencidas sem derrota.
const invicto = (c) => c.resultado === 'campeao' && c.vitoriasGrupos === 7
  && c.rodadas.filter((r) => r.fase !== 'Fase de pontos').every((r) => r.placar[1] === 0);

// O resultado vai para o histórico (e para a ranqueada, no modo Oculto)
// assim que a campanha é simulada: ver a animação até o fim não muda nada.
let entradaRanqueada = null;
function registrar() {
  const c = jogo.campanha;
  const time = VAGAS.map((v) => jogo.vagas[v]?.nome).filter(Boolean);
  entradaRanqueada = platform.recordResult(GAME_ID, {
    score: pontos(c),
    summary: {
      text: `${TITULO_RESULTADO[c.resultado]} · força ${Math.round(c.forca)} · ${time.slice(0, 5).join(', ')}`,
      resultado: c.resultado, modo: jogo.modo, vitorias: c.vitoriasGrupos, invicto: invicto(c),
      ranked: jogo.modo === 'oculto' ? jogo.ranked?.token : undefined, // ingresso do dia (Oculto vale PDR)
    },
  });
}

function terminar() {
  const c = jogo.campanha;
  historico.unshift({ quando: new Date().toISOString(), resultado: c.resultado, pontos: pontos(c), forca: c.forca, modo: jogo.modo });
  historico = historico.slice(0, 50);
  platform.track('game_end', GAME_ID, { resultado: c.resultado, vitorias: c.vitoriasGrupos, forca: c.forca, modo: jogo.modo, bonus: jogo.bonusUsado });
  // Só no fim da animação conta quantos PDR a campanha deu.
  if (jogo.modo === 'oculto') Promise.resolve(entradaRanqueada).then((entry) => avisoFim(entry, jogo.ranked, GAME_ID));
}

async function compartilhar() {
  const c = jogo.campanha;
  const linha = (r) => `${r.venceu ? '✅' : '❌'} ${r.fase === 'Fase de pontos' ? '' : `${r.fase}: `}${r.placar.join('–')} vs ${r.adv.time} (${r.adv.edicao.replace(/^CBLOL |^LTA Sul /, '')})`;
  const text = [
    `${NAME} · ${nomeTime()}: ${TITULO_RESULTADO[c.resultado]} (${c.vitoriasGrupos}-${7 - c.vitoriasGrupos} na fase de pontos)`,
    ROTAS.map((r) => `${NOME_VAGA[r]}: ${jogo.vagas[r].nome}`).join(' · '),
    `Reserva: ${jogo.vagas.reserva.nome} · Técnico: ${jogo.vagas.tecnico.nome}`,
    '',
    ...c.rodadas.filter((r) => r.fase !== 'Fase de pontos').map(linha),
    '',
    'Monte o seu: riftarcade.com.br/jogos/lendas-do-cblol',
  ].join('\n');
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast('Resultado copiado!'); }
  } catch { toast('Não foi possível compartilhar'); }
}

// ------------------------------------------------------------------ eventos

app.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  try {
    if (b.dataset.exib) {
      pref.auto = b.dataset.exib === 'auto';
      salvarPref();
      app.querySelectorAll('[data-exib]').forEach((x) => x.classList.toggle('on', x === b));
      if (pref.auto && !anim) avancar();
      return;
    }
    if (b.dataset.modo) { jogo.modo = b.dataset.modo; salvar(); render(); return; }
    if (b.dataset.pick) {
      if (!Object.values(jogo.vagas).some(Boolean)) {
        platform.track('game_start', GAME_ID, { modo: jogo.modo });
        // Modo Oculto vale ranqueada: o servidor anota o começo (3 por dia).
        if (jogo.modo === 'oculto') {
          const atual = jogo;
          platform.rankedIniciar(GAME_ID).then((r) => {
            if (r && jogo === atual) { jogo.ranked = r; salvar(); }
            avisoComeco(r, GAME_ID);
          });
        }
      }
      escolher(jogo, times, b.dataset.pick, b.dataset.vaga);
      salvar(); render();
      if (completo(jogo)) toast('Time completo!');
      return;
    }
    if (b.dataset.bonus) { usarBonus(jogo, times, b.dataset.bonus); salvar(); render(); return; }
    const act = b.dataset.act;
    if (act === 'rolar') {
      // Dados bônus do elo da ranqueada (Ouro: 2; Desafiante: 3), fixos na partida.
      if (!jogo.dadosTotal) jogo.dadosTotal = vantagens(platform.getUser()?.elo).dadosBonus;
      if (!(jogo.nome || '').trim()) {
        toast('Dê um nome ao seu time primeiro');
        document.getElementById('nome-time')?.focus();
        return;
      }
      if (!rolar(jogo, times)) toast('Nenhum time com vaga disponível.');
      salvar(); render();
    } else if (act === 'simular') {
      simular(jogo, times); registrar(); mostrados = 0; abertos.clear(); salvar(true); render();
    } else if (act === 'proximo') {
      avancar();
    } else if (act === 'pular') {
      if (anim) anim.pular = true;
    } else if (act === 'tudo') {
      const faltava = mostrados < jogo.campanha.rodadas.length;
      if (anim) { anim.parar = true; anim = null; }
      mostrados = jogo.campanha.rodadas.length;
      if (faltava) terminar();
      salvar(); render(); comemorar();
    } else if (act === 'nova') {
      const modo = jogo.modo;
      const nome = jogo.nome;
      jogo = novoJogo(modo); jogo.nome = nome; mostrados = 0; abertos.clear(); salvar(); render(); window.scrollTo(0, 0);
    } else if (act === 'compartilhar') compartilhar();
  } catch (err) {
    toast(err.message);
  }
});

// Nome do time: guarda enquanto digita (sem redesenhar a tela).
app.addEventListener('input', (e) => {
  if (e.target.id !== 'nome-time') return;
  jogo.nome = e.target.value.slice(0, 24);
  salvar();
});
app.addEventListener('keydown', (e) => {
  if (e.target.id === 'nome-time' && e.key === 'Enter') app.querySelector('[data-act="rolar"]')?.click();
});

app.addEventListener('change', (e) => {
  if (!e.target.matches('[data-vel]')) return;
  pref.vel = e.target.value;
  salvarPref();
});

// Lembra quais "Ver partida" estão abertos quando a tela é redesenhada.
app.addEventListener('toggle', (e) => {
  const i = Number(e.target.dataset?.i);
  if (!e.target.matches?.('details.more')) return;
  if (e.target.open) abertos.add(i); else abertos.delete(i);
}, true);

platform.onChange((evt) => {
  if (evt.type === 'save' && evt.gameId === GAME_ID && times.length && !anim) { carregar(); render(); }
});

(async () => {
  app.innerHTML = '<p class="loading">Carregando os times do CBLOL…</p>';
  try {
    times = (await (await fetch('dados/times.json')).json()).times;
  } catch {
    app.innerHTML = '<p class="loading">Não foi possível carregar o jogo. Recarregue a página.</p>';
    return;
  }
  byId = new Map(times.map((t) => [t.id, t]));
  carregar();
  render();
  avisoInicio(GAME_ID);
})();
