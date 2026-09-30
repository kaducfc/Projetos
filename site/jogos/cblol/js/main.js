// CBLOL dos Sonhos (nome provisório): monte um time com jogadores de todas as
// eras do CBLOL e simule a campanha.
import {
  ROTAS, VAGAS, NOME_VAGA, novoJogo, rolar, opcoesBonus, usarBonus, escolher, vagasPossiveis, completo, forca, simular,
  TITULO_RESULTADO, pontos,
} from './logic.js';
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';

const GAME_ID = 'cblol';
const NAME = gameById(GAME_ID)?.name || 'CBLOL dos Sonhos';
const app = document.getElementById('app');
mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

// Posição de cada rota no mapa (em % do quadrado).
const POS = { top: [17, 17], jungle: [30, 44], mid: [50, 50], adc: [74, 86], sup: [88, 70] };
const SIGLA = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'ADC', sup: 'SUP', reserva: 'RES', tecnico: 'TÉC', tecnico2: 'TÉC' };

let times = [];
let byId = new Map();
let jogo = novoJogo();
let historico = [];
let mostrados = 0; // quantas rodadas da campanha já apareceram na tela
let anim = null; // rodada sendo mostrada ao vivo
const abertos = new Set(); // rodadas com "Ver partida" aberto

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oculto = () => jogo.modo === 'oculto' && !completo(jogo);
const ovrTxt = (v) => (oculto() ? '?' : String(v));
const lugarTxt = (n) => (n ? `${n}º lugar` : '');

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
      <span class="drawn-label">Dado bônus ${jogo.bonusUsado ? '(já usado)' : '(1 por partida)'}</span>
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
  const dot = `<span class="dot">${p ? ovrTxt(p.ovr) : SIGLA[v]}</span>`;
  const txt = `<span class="lbl">${NOME_VAGA[v]}</span>${p ? `<span class="who">${esc(p.nome)}</span><span class="from">${esc(p.time)} · ${esc(p.edicao.replace(/^CBLOL |^LTA Sul /, ''))}</span>` : ''}`;
  return bench ? `<div class="${cls}">${dot}<span class="txt">${txt}</span></div>` : `<div class="${cls}"${style}>${dot}${txt}</div>`;
}

const RIFT_SVG = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <path d="M4 96 L96 4" stroke="rgba(80,140,200,.22)" stroke-width="9" fill="none"/>
  <path d="M9 91 L9 9 L91 9" stroke="rgba(214,190,140,.28)" stroke-width="2.4" fill="none"/>
  <path d="M9 91 L91 91 L91 9" stroke="rgba(214,190,140,.28)" stroke-width="2.4" fill="none"/>
  <path d="M11 89 L89 11" stroke="rgba(214,190,140,.28)" stroke-width="2.4" fill="none"/>
  <circle cx="6" cy="94" r="7" fill="rgba(60,110,190,.35)"/><circle cx="94" cy="6" r="7" fill="rgba(190,60,50,.35)"/>
</svg>`;

function scoreBox() {
  const f = forca(jogo.vagas);
  const cheio = completo(jogo);
  const n = VAGAS.filter((v) => jogo.vagas[v]).length;
  const rows = VAGAS.map((v) => {
    const p = jogo.vagas[v];
    const ign = v === 'reserva' && p && cheio && !f.reservaConta;
    return `<div class="${ign ? 'ign' : ''}"><span>${NOME_VAGA[v]}</span><span>${p ? esc(p.nome) : '—'}</span><b>${p ? ovrTxt(p.ovr) : ''}</b></div>`;
  }).join('');
  const nota = cheio
    ? (f.reservaConta ? 'O reserva é melhor que a média e ajuda a subir o time.' : 'O reserva está abaixo da média e não entra na conta.')
      + (jogo.vagas.tecnico ? ` Técnico: ${f.ajusteTecnico >= 0 ? '+' : ''}${f.ajusteTecnico.toFixed(1)} de força.` : '')
    : '';
  return `<div class="box">
    <div class="score-big"><h3 style="margin:0">Seu time · ${n}/7</h3><b>${f.media ? (oculto() ? '??' : f.media.toFixed(0)) : '—'}</b></div>
    <div class="lineup">${rows}</div>
    ${nota ? `<p class="note">${nota}</p>` : ''}
  </div>`;
}

function renderMontagem() {
  const cheio = completo(jogo);
  const primeira = !Object.values(jogo.vagas).some(Boolean) && !jogo.atual;
  const left = cheio
    ? `<div class="box"><h3>Time completo</h3><p class="muted small" style="margin:0 0 12px">Força ${forca(jogo.vagas).forca.toFixed(1)}. Hora de ver até onde ele chega.</p>
        <button class="btn btn-gold" data-act="simular">Simular campanha →</button></div>`
    : `<div class="box">
        <h3>Modo</h3>
        <div class="seg">
          <button data-modo="normal" class="${jogo.modo === 'normal' ? 'on' : ''}" ${primeira ? '' : 'disabled'}>Normal</button>
          <button data-modo="oculto" class="${jogo.modo === 'oculto' ? 'on' : ''}" ${primeira ? '' : 'disabled'}>Oculto</button>
        </div>
        <p class="hint-text">${jogo.modo === 'oculto' ? 'Só os nomes: os OVRs aparecem quando o time estiver completo.' : 'Os OVRs aparecem durante a escolha.'}</p>
      </div>
      ${drawnBox()}
      <button class="btn btn-roll" data-act="rolar" ${jogo.atual ? 'disabled' : ''}>Rolar 🎲</button>`;
  app.innerHTML = `
    <header class="dt-head">
      <div><p class="eyebrow">◆ Monte · Simule · CBLOL de todas as eras</p><h1>${esc(NAME)}</h1></div>
      <span class="meta">Modo ${jogo.modo === 'oculto' ? 'Oculto' : 'Normal'}${jogo.bonusUsado ? ' · dado bônus usado' : ''}</span>
    </header>
    <div class="cols">
      <div class="col-left" style="display:flex;flex-direction:column;gap:12px">${left}</div>
      <div class="col-map">
        <div class="rift">${RIFT_SVG}${ROTAS.map((r) => slotHtml(r)).join('')}</div>
        <div class="bench">${slotHtml('reserva', true)}${slotHtml('tecnico', true)}</div>
      </div>
      <div>${scoreBox()}</div>
    </div>
    <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>`;
}

// ------------------------------------------------------------------ campanha

const relogio = (seg) => `${Math.floor(seg / 60)}:${String(Math.floor(seg % 60)).padStart(2, '0')}`;
const chipTxt = (g, i, n) => `${n > 1 ? `J${i + 1} · ` : ''}${g.placar[0]}–${g.placar[1]} abates${g.mvp ? ` · MVP ${esc(g.mvp)}` : ''}`;

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
      <p class="match-t"><b class="${g.venceu ? 'w' : 'l'}">${r.jogos.length > 1 ? `Jogo ${gi + 1} · ` : ''}${g.venceu ? 'Vitória' : 'Derrota'} ${g.placar[0]}–${g.placar[1]}</b><span>⏱ ${relogio(g.duracao)}</span></p>
      <div class="sides">${tabelaLado('Seu time', g.nos, g.mvp)}${tabelaLado(r.adv.time, g.eles, null)}</div>
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
      <div><p class="eyebrow">◆ A campanha</p><h1>${esc(NAME)}</h1></div>
      <span class="meta">Força ${c.forca} · Modo ${jogo.modo === 'oculto' ? 'Oculto' : 'Normal'}</span>
    </header>
    <div class="camp">
      <div class="camp-top"><span class="muted small">Fase de pontos: 7 jogos (3 vitórias classificam) · Quartas MD3 · Semi e final MD5</span>
        ${mostrados >= total ? '' : '<button class="btn-ghost" data-act="tudo">Mostrar tudo</button>'}</div>
      ${rs}
      ${fim ? `<div class="final${bom ? '' : ' bad'}">
          <p class="t">${TITULO_RESULTADO[c.resultado]}</p>
          <p>${c.vitoriasGrupos} ${c.vitoriasGrupos === 1 ? 'vitória' : 'vitórias'} na fase de pontos · ${pontos(c)} pontos</p>
          <div class="acts"><button class="btn btn-gold" data-act="compartilhar">Compartilhar</button>
            <button class="btn btn-roll" data-act="nova">Nova partida</button></div>
        </div>` : botao}
    </div>
    <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>`;
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
  const duracaoTela = r.jogos.length > 1 ? 2600 : 3400;
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
    const t0 = performance.now();
    for (;;) {
      if (eu.parar) return;
      const p = eu.pular ? 1 : Math.min(1, (performance.now() - t0) / duracaoTela);
      const agora = p * g.duracao;
      const feitos = abates.filter((x) => x.t <= agora);
      const nos = feitos.filter((x) => x.lado === 0).length;
      chip.textContent = `${r.jogos.length > 1 ? `J${gi + 1} · ` : ''}⏱ ${relogio(agora)} · ${nos}–${feitos.length - nos} abates`;
      if (p >= 1) break;
      await new Promise((ok) => { requestAnimationFrame(ok); });
    }
    chip.className = g.venceu ? 'w' : 'l';
    chip.innerHTML = chipTxt(g, gi, r.jogos.length);
    if (g.venceu) v++; else d++;
    res.textContent = `${v}–${d}`;
    if (!eu.pular && gi < r.jogos.length - 1) await espera(700);
  }
  if (eu.parar) return;
  anim = null;
  render();
}

function render(opts) {
  if (jogo.fase === 'fim' && jogo.campanha) renderCampanha(opts);
  else renderMontagem();
}

function terminar() {
  const c = jogo.campanha;
  const time = VAGAS.map((v) => jogo.vagas[v]?.nome).filter(Boolean);
  historico.unshift({ quando: new Date().toISOString(), resultado: c.resultado, pontos: pontos(c), forca: c.forca, modo: jogo.modo });
  historico = historico.slice(0, 50);
  platform.track('game_end', GAME_ID, { resultado: c.resultado, vitorias: c.vitoriasGrupos, forca: c.forca, modo: jogo.modo, bonus: jogo.bonusUsado });
  platform.recordResult(GAME_ID, {
    score: pontos(c),
    summary: { text: `${TITULO_RESULTADO[c.resultado]} · força ${c.forca} · ${time.slice(0, 5).join(', ')}`, resultado: c.resultado, modo: jogo.modo },
  });
}

async function compartilhar() {
  const c = jogo.campanha;
  const linha = (r) => `${r.venceu ? '✅' : '❌'} ${r.fase === 'Fase de pontos' ? '' : `${r.fase}: `}${r.placar.join('–')} vs ${r.adv.time} (${r.adv.edicao.replace(/^CBLOL |^LTA Sul /, '')})`;
  const text = [
    `${NAME}: ${TITULO_RESULTADO[c.resultado]} (${c.vitoriasGrupos}-${7 - c.vitoriasGrupos} na fase de pontos)`,
    ROTAS.map((r) => `${NOME_VAGA[r]}: ${jogo.vagas[r].nome}`).join(' · '),
    `Reserva: ${jogo.vagas.reserva.nome} · Técnico: ${jogo.vagas.tecnico.nome}`,
    '',
    ...c.rodadas.filter((r) => r.fase !== 'Fase de pontos').map(linha),
    '',
    'Monte o seu: riftarcade.com.br/jogos/cblol',
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
    if (b.dataset.modo) { jogo.modo = b.dataset.modo; salvar(); render(); return; }
    if (b.dataset.pick) {
      if (!Object.values(jogo.vagas).some(Boolean)) platform.track('game_start', GAME_ID, { modo: jogo.modo });
      escolher(jogo, times, b.dataset.pick, b.dataset.vaga);
      salvar(); render();
      if (completo(jogo)) toast('Time completo!');
      return;
    }
    if (b.dataset.bonus) { usarBonus(jogo, times, b.dataset.bonus); salvar(); render(); return; }
    const act = b.dataset.act;
    if (act === 'rolar') {
      if (!rolar(jogo, times)) toast('Nenhum time com vaga disponível.');
      salvar(); render();
    } else if (act === 'simular') {
      simular(jogo, times); mostrados = 0; abertos.clear(); salvar(true); render();
    } else if (act === 'proximo') {
      if (anim) return;
      mostrados++;
      if (mostrados >= jogo.campanha.rodadas.length) terminar();
      salvar(); animar(mostrados - 1);
    } else if (act === 'pular') {
      if (anim) anim.pular = true;
    } else if (act === 'tudo') {
      const faltava = mostrados < jogo.campanha.rodadas.length;
      if (anim) { anim.parar = true; anim = null; }
      mostrados = jogo.campanha.rodadas.length;
      if (faltava) terminar();
      salvar(); render();
    } else if (act === 'nova') {
      const modo = jogo.modo;
      jogo = novoJogo(modo); mostrados = 0; abertos.clear(); salvar(); render(); window.scrollTo(0, 0);
    } else if (act === 'compartilhar') compartilhar();
  } catch (err) {
    toast(err.message);
  }
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
})();
