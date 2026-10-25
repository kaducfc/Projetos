// Rift Survivors: sobreviva às hordas de Runeterra, evolua suas habilidades e derrote os chefes de cada região.
// Enquanto o jogo é "oculto" (gameById('survivors').soAdmin), só administradores e convidados conseguem jogar.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { gameById } from '../../../shared/config.js';
import { CAMPEOES, ARMAS, ITENS, MELHORIAS, bonusMelhoria, CORES_NIVEL, NIVEL_MAX_ITEM, TEMPO_BARAO, CHEFES, REINOS, ORDEM_REINOS, RARIDADES, MALDICOES, EVOLUCOES } from './data.js';
import { criarJogo, atualizar, escolher, essenciaGanha, rolar, banir } from './game.js';
import { criarRender } from './render.js';
import { urlSprite, urlIcone, carregarImagens, arteUrl, urlQuadro, nQuadros } from './sprites.js';
import { som, SOM_EVENTO, destravar, definirMudo, estaMudo } from './audio.js';
import * as Meta from './meta.js';

const GAME_ID = 'survivors';
const RETRATOS = { ahri: 'ahri/retrato.png', garen: 'garen/retrato.png', jinx: 'jinx/retrato.png', ashe: 'ashe/retrato.png', lux: 'lux/retrato.png', zed: 'zed/retrato.png' }; // campeões com arte própria
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const palco = document.getElementById('sv-palco');
const cv = document.getElementById('sv-cv');
const ui = document.getElementById('sv-ui');
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('pt-BR');
const tempoTxt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });

let meta = Meta.carregar();
let modo = 'menu'; // menu | selecao | loja | jogo
let S = null; let demo = null; let pausado = false; let escolhido = meta.ultimo; let reinoEscolhido = meta.ultimoReino || 'ixtal';
let escala = 3; const render = criarRender(cv);
let ult = 0; let fimTratado = false;
try { definirMudo(localStorage.getItem('survivors.mudo') === '1'); } catch { /* sem storage */ }

// --------------------------------------------------------------------------- tamanho (pixels nítidos)
function ajustar() {
  const r = palco.getBoundingClientRect();
  escala = Math.max(2, Math.round(Math.min(r.width / 400, r.height / 225)));
  const lw = Math.max(160, Math.floor(r.width / escala)); const lh = Math.max(120, Math.floor(r.height / escala));
  render.resize(lw, lh); cv.style.width = `${Math.round(r.width)}px`; cv.style.height = `${Math.round(r.height)}px`; // preenche a área (a escala fica quase inteira)
  if (S) S.vista = { w: lw, h: lh }; if (demo) demo.vista = { w: lw, h: lh };
}
window.addEventListener('resize', ajustar);

// --------------------------------------------------------------------------- entrada
const teclas = new Set();
const toque = { ativo: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
function entrada() {
  let x = 0; let y = 0;
  if (teclas.has('arrowleft') || teclas.has('a')) x -= 1; if (teclas.has('arrowright') || teclas.has('d')) x += 1;
  if (teclas.has('arrowup') || teclas.has('w')) y -= 1; if (teclas.has('arrowdown') || teclas.has('s')) y += 1;
  if (toque.ativo) { const dx = toque.x - toque.ox; const dy = toque.y - toque.oy; const m = Math.hypot(dx, dy); if (m > 6) { const k = Math.min(1, m / 40); x = (dx / m) * k; y = (dy / m) * k; } }
  return { x, y };
}
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(); destravar();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k) && modo === 'jogo') e.preventDefault();
  teclas.add(k);
  if (modo === 'jogo' && S) {
    if ((k === 'escape' || k === 'p') && S.estado === 'jogando') alternarPausa();
    else if (S.estado === 'upgrade' && ['1', '2', '3'].includes(k)) escolherOpcao(Number(k) - 1);
  }
});
window.addEventListener('keyup', (e) => teclas.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { teclas.clear(); if (modo === 'jogo' && S?.estado === 'jogando' && !pausado) alternarPausa(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && modo === 'jogo' && S?.estado === 'jogando' && !pausado) alternarPausa(true); });
const joy = document.getElementById('sv-joy'); const joyBola = document.getElementById('sv-joy-bola');
palco.addEventListener('pointerdown', (e) => {
  if (modo !== 'jogo' || e.pointerType === 'mouse' || toque.ativo || e.target.closest('button')) return;
  destravar(); toque.ativo = true; toque.id = e.pointerId; toque.ox = toque.x = e.clientX; toque.oy = toque.y = e.clientY;
  const r = palco.getBoundingClientRect(); joy.style.display = 'block'; joy.style.left = `${e.clientX - r.left}px`; joy.style.top = `${e.clientY - r.top}px`; joyBola.style.transform = 'translate(0,0)';
  palco.setPointerCapture?.(e.pointerId);
});
palco.addEventListener('pointermove', (e) => {
  if (!toque.ativo || e.pointerId !== toque.id) return; toque.x = e.clientX; toque.y = e.clientY;
  const dx = toque.x - toque.ox; const dy = toque.y - toque.oy; const m = Math.hypot(dx, dy) || 1; const k = Math.min(40, m) / m;
  joyBola.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
});
const soltar = (e) => { if (e.pointerId !== toque.id) return; toque.ativo = false; joy.style.display = 'none'; };
palco.addEventListener('pointerup', soltar); palco.addEventListener('pointercancel', soltar);
palco.addEventListener('contextmenu', (e) => e.preventDefault());

// --------------------------------------------------------------------------- modo demonstração (fundo do menu)
function botEntrada(Sx) {
  let x = 0; let y = 0; const P = Sx.p;
  for (const e of Sx.inim) { const dx = P.x - e.x; const dy = P.y - e.y; const d2 = dx * dx + dy * dy; if (d2 < 80 * 80 && d2 > 1) { x += dx / d2; y += dy / d2; } }
  if (Math.abs(x) + Math.abs(y) < 0.0005) {
    let g = null; let md = 140 * 140; for (const q of Sx.gemas) { const d2 = (q.x - P.x) ** 2 + (q.y - P.y) ** 2; if (d2 < md) { md = d2; g = q; } }
    if (g) { const d = Math.sqrt(md) || 1; return { x: (g.x - P.x) / d, y: (g.y - P.y) / d }; }
    const a = Sx.t * 0.5; return { x: Math.cos(a), y: Math.sin(a) };
  }
  const m = Math.hypot(x, y); return { x: x / m, y: y / m };
}
function novaDemo() { const lista = CAMPEOES; demo = criarJogo({ campeao: lista[Math.floor(Math.random() * lista.length)].id, reino: ORDEM_REINOS[Math.floor(Math.random() * 2)], vista: { w: render.w, h: render.h } }); demo.demo = true; demo.t = 150; }
function passoDemo(dt) {
  if (!demo || demo.estado !== 'jogando' && demo.estado !== 'upgrade') novaDemo();
  if (demo.estado === 'upgrade') escolher(demo, demo.opcoes[0]);
  atualizar(demo, dt, botEntrada(demo)); demo.evt.length = 0;
  if (demo.t > 700 || demo.p.hp < demo.p.hpMax * 0.25) { demo.p.hp = demo.p.hpMax; demo.p.inv = 1; }
}

// --------------------------------------------------------------------------- telas
function nomeEA() { return `<span class="sv-ea"><img alt="" src="${urlIcone('essencia')}" />${fmt(meta.essencia)} EA</span>`; }
function tela(html, cls = '') { ui.className = `sv-ui ${cls}`; ui.innerHTML = html; }

function telaMenu() {
  modo = 'menu'; pausado = false;
  const m = meta.melhor;
  tela(`<div class="sv-menu">
    <img class="sv-heroi" alt="" src="${arteUrl('ahri/arte.png')}" />
    <p class="sv-eyebrow">Rift Arcade · em teste</p>
    <h1 class="sv-titulo"><img class="sv-logo" alt="Rift Survivors" src="${arteUrl('logo.png')}" /></h1>
    <p class="sv-sub">Sobreviva às hordas, evolua suas habilidades e derrote os chefes de cada região de Runeterra.</p>
    <div class="sv-botoes">
      <button class="sv-btn grande" data-a="jogar">Jogar</button>
      <button class="sv-btn" data-a="campeoes">Campeões</button>
      <button class="sv-btn" data-a="loja">Melhorias</button>
      <button class="sv-btn" data-a="como">Como jogar</button>
    </div>
    <p class="sv-rodape">${nomeEA()} · melhor: ${tempoTxt(m.tempo)} · ${fmt(m.abates)} abates · ${fmt(meta.vitorias)} ${meta.vitorias === 1 ? 'vitória' : 'vitórias'}</p>
    <button class="sv-mudo" data-a="mudo" aria-label="Som">${estaMudo() ? '🔇' : '🔊'}</button>
  </div>`, 'menu');
}
function telaComo() {
  tela(`<div class="sv-painel"><h2>Como jogar</h2>
    <ul class="sv-lista">
      <li><b>Mover:</b> WASD ou setas. No celular, arraste o dedo na tela.</li>
      <li><b>Atacar:</b> automático. Seu campeão usa as habilidades sozinho.</li>
      <li><b>Evoluir:</b> colete as gemas azuis dos inimigos. A cada nível, escolha 1 de 3 melhorias (teclas 1, 2 e 3).</li>
      <li><b>Itens:</b> até ${6} habilidades e ${6} itens, cada um até o nível ${NIVEL_MAX_ITEM}.</li>
      <li><b>Baús:</b> chefes e monstros grandes soltam baús que dão uma melhoria extra.</li>
      <li><b>Reinos:</b> Ixtal, Ionia, Demacia, Noxus, Shurima e Freljord, cada um com cenário, monstros e chefes próprios. Vença um reino para abrir o próximo.</li>
      <li><b>Chefes:</b> um chefe menor aos 5:00 e o chefe final no fim do tempo (em Ixtal, a <b>Serpente de Jade aos ${tempoTxt(TEMPO_BARAO)}</b>). Fuja das áreas vermelhas no chão: elas avisam o golpe. Derrote o chefe final para vencer!</li>
      <li><b>Pausa:</b> Esc ou P.</li>
    </ul><div class="sv-botoes"><button class="sv-btn" data-a="menu">Voltar</button></div></div>`);
}
function cartaCampeao(c) {
  const lib = meta.liberados.includes(c.id); const sel = escolhido === c.id; const arma = ARMAS[c.arma];
  return `<div class="sv-carta ${sel ? 'sel' : ''} ${lib ? '' : 'trava'}" data-camp="${c.id}">
    <img class="sv-retrato ${RETRATOS[c.id] ? 'arte' : ''}" alt="" src="${RETRATOS[c.id] ? arteUrl(RETRATOS[c.id]) : urlSprite(c.id)}" />
    <b>${esc(c.nome)}</b><small>${esc(c.titulo)}</small>
    <span class="sv-arma"><img alt="" src="${urlIcone(c.arma)}" />${esc(arma.nome)}</span>
    <small class="sv-st">Vida ${c.hp} · Vel ${c.vel} · Arm ${c.armadura}</small>
    <small class="sv-desc">${esc(c.desc)}</small>
    ${lib ? `<button class="sv-btn mini" data-a="escolher" data-id="${c.id}">${sel ? 'Escolhido' : 'Escolher'}</button>` : c.rc ? `<button class="sv-btn mini ouro" data-a="liberar-rc" data-id="${c.id}">Liberar · ${fmt(c.rc)} RC</button>` : `<button class="sv-btn mini ouro" data-a="liberar" data-id="${c.id}" ${meta.essencia < c.preco ? 'disabled' : ''}>Liberar · ${fmt(c.preco)} EA</button>`}
  </div>`;
}
function telaCampeoes(paraJogar = false) {
  modo = 'selecao';
  tela(`<div class="sv-painel largo"><h2>${paraJogar ? 'Escolha seu campeão' : 'Campeões'}</h2><p class="sv-sub">${nomeEA()}</p>
    <div class="sv-cartas">${CAMPEOES.map(cartaCampeao).join('')}</div>
    <div class="sv-botoes">${paraJogar ? '<button class="sv-btn grande" data-a="reinos">Escolher reino</button>' : ''}<button class="sv-btn" data-a="menu">Voltar</button></div></div>`, 'rolar');
  ui.dataset.jogar = paraJogar ? '1' : '';
}
function telaReinos() {
  modo = 'selecao';
  const cartas = ORDEM_REINOS.map((id) => {
    const r = REINOS[id]; const lib = Meta.reinoLiberado(meta, id); const info = meta.reinos[id]; const sel = reinoEscolhido === id;
    const chefe = CHEFES[r.chefes.find((c) => CHEFES[c].final)];
    const estrelas = '★'.repeat(Math.max(1, Math.round((r.dif - 0.7) / 0.3)));
    return `<div class="sv-carta reino ${sel && lib ? 'sel' : ''} ${lib ? '' : 'trava'}" data-reino="${id}" style="--tema:${TEMA_COR[id]}">
      <span class="sv-reino-arte" ${REINO_IMG[id] ? `style="background-image: url('${arteUrl(REINO_IMG[id])}')"` : ''}></span><b>${esc(r.nome)}</b><small>${esc(r.sub)}</small>
      <small class="sv-st">${tempoTxt(r.tempo)} · Dificuldade ${estrelas}</small><small class="sv-desc">Chefe: ${esc(chefe.nome)}</small>
      ${lib ? `<small class="sv-st">${info?.vitorias ? `✔ ${info.vitorias} ${info.vitorias === 1 ? 'vitória' : 'vitórias'}` : 'Ainda não vencido'}</small><button class="sv-btn mini" data-a="reino" data-id="${id}">${sel ? 'Escolhido' : 'Escolher'}</button>`
        : `<small class="sv-st">🔒 Vença ${esc(REINOS[r.abre].nome)}</small>`}
    </div>`;
  }).join('');
  tela(`<div class="sv-painel largo"><h2>Escolha o reino</h2><p class="sv-sub">Cada reino tem cenário, monstros e chefes próprios. Vença um para abrir o próximo.</p>
    <div class="sv-cartas">${cartas}</div>
    <div class="sv-botoes"><button class="sv-btn grande" data-a="comecar">Começar partida</button><button class="sv-btn" data-a="jogar">Voltar</button></div></div>`, 'rolar');
}
const REINO_IMG = { ixtal: 'reinos/ixtal.webp', ionia: 'reinos/ionia.webp', demacia: 'reinos/demacia.webp', noxus: 'reinos/noxus.webp', shurima: 'reinos/shurima.webp', freljord: 'reinos/freljord.webp' }; // banners dos reinos (os que faltam usam o degradê da cor do reino)
const TEMA_COR = { ixtal: '#3a8a36', ionia: '#f29ac0', demacia: '#7ab4f0', noxus: '#c0283a', shurima: '#e8c97a', freljord: '#cfe0f2' };
// Quadradinhos de nível: cada 5 níveis forma uma camada de cor nova por cima da anterior (amarelo, vermelho, roxo...).
function pipsNivel(d, n) {
  const camada = n > 0 ? Math.floor((n - 1) / 5) : 0; const cheios = n > 0 ? ((n - 1) % 5) + 1 : 0;
  return Array.from({ length: Math.min(5, d.max) }, (_, i) => { const cor = i < cheios ? CORES_NIVEL[camada] : camada > 0 ? CORES_NIVEL[camada - 1] : null; return `<i class="${cor ? 'on' : ''}"${cor ? ` style="background:${cor};border-color:rgba(255,255,255,.55)"` : ''}></i>`; }).join('');
}
function telaLoja() {
  modo = 'loja';
  const linhas = Object.entries(MELHORIAS).map(([id, d]) => {
    const n = meta.melhorias[id] || 0; const cheio = n >= d.max; const p = cheio ? 0 : d.preco(n);
    return `<div class="sv-item"><div><b>${esc(d.nome)}</b><small>${esc(d.desc)}</small><span class="sv-pips">${pipsNivel(d, n)}</span>${d.max > 5 ? `<small class="sv-nv">Nível ${n}/${d.max}</small>` : ''}${d.total ? `<small class="sv-tot">Atual: <b>${d.total(bonusMelhoria(id, n))}</b>${cheio ? ' (máximo)' : ` · próximo nível: ${d.total(bonusMelhoria(id, n + 1))}`}</small>` : ''}</div>
      <button class="sv-btn mini ouro" data-a="melhorar" data-id="${id}" ${cheio || meta.essencia < p ? 'disabled' : ''}>${cheio ? 'Máximo' : `${p} EA`}</button></div>`;
  }).join('');
  tela(`<div class="sv-painel"><h2>Melhorias</h2><p class="sv-sub">${nomeEA()} · fica salvo neste navegador</p><div class="sv-itens">${linhas}</div><div class="sv-botoes"><button class="sv-btn" data-a="menu">Voltar</button></div></div>`, 'rolar');
}

// --------------------------------------------------------------------------- partida
function iniciar() {
  meta.ultimo = escolhido; Meta.gravar(meta);
  if (!Meta.reinoLiberado(meta, reinoEscolhido)) reinoEscolhido = 'ixtal';
  meta.ultimoReino = reinoEscolhido;
  S = criarJogo({ campeao: escolhido, meta, vista: { w: render.w, h: render.h }, reino: reinoEscolhido });
  modo = 'jogo'; pausado = false; fimTratado = false; ui.className = 'sv-ui jogo'; ui.innerHTML = '';
  destravar(); avisar(`${CAMPEOES.find((c) => c.id === escolhido).nome} em ${REINOS[reinoEscolhido].nome}!`);
}
function avisar(txt, cls = '') {
  const a = document.createElement('div'); a.className = `sv-aviso ${cls}`; a.textContent = txt; palco.appendChild(a); setTimeout(() => a.remove(), 2600);
}
function alternarPausa(forcar = false) {
  if (!S || S.estado !== 'jogando') return;
  pausado = forcar ? true : !pausado;
  if (pausado) tela(`<div class="sv-painel pequeno"><h2>Pausado</h2><div class="sv-botoes"><button class="sv-btn grande" data-a="continuar">Continuar</button><button class="sv-btn" data-a="mudo">${estaMudo() ? 'Ligar som' : 'Desligar som'}</button><button class="sv-btn perigo" data-a="desistir">Desistir</button></div></div>`, 'jogo');
  else { ui.innerHTML = ''; ui.className = 'sv-ui jogo'; }
}
let modoBanir = false;
function mostrarUpgrade() {
  const ops = S.opcoes; if (!ops) return;
  const cartas = ops.map((o, i) => {
    let nome; let desc; let ic; let nivel; const rar = RARIDADES[o.raridade || 0];
    if (o.tipo === 'arma') { const d = ARMAS[o.id]; nome = d.nome; desc = o.nivel === 1 ? d.desc : `Nível ${o.nivel}: mais ${descreverSalto(o.id, o.nivel)}`; ic = o.id; nivel = o.nivel === 1 ? 'NOVA' : `NV ${o.nivel}`; const ev = EVOLUCOES[o.id]; if (ev && o.nivel >= 5) desc += ` · Evolui com ${ITENS[ev.item].nome}`; }
    else if (o.tipo === 'item') { const d = ITENS[o.id]; nome = d.nome; desc = d.desc + (o.raridade ? ` (x${rar.mult})` : ''); ic = o.id; nivel = o.nivel === 1 ? 'NOVO' : `NV ${o.nivel}`; }
    else if (o.tipo === 'maldicao') { const d = MALDICOES[o.id]; nome = d.nome; desc = `<span class="bom">${esc(d.bom)}</span><span class="ruim">${esc(d.ruim)}</span>`; ic = 'maldicao'; nivel = 'MALDIÇÃO'; }
    else if (o.tipo === 'cura') { nome = 'Poção de Cura'; desc = 'Recupera toda a vida'; ic = 'cura'; nivel = ''; }
    else { nome = 'Bolsa de Ouro'; desc = '+40 de ouro'; ic = 'ouro'; nivel = ''; }
    const cls = o.tipo === 'maldicao' ? 'maldicao' : `r${o.raridade || 0}`;
    return `<button class="sv-op ${cls} ${modoBanir ? 'banindo' : ''}" data-op="${i}" style="--rar:${o.tipo === 'maldicao' ? '#ff4d5e' : rar.cor}"><span class="sv-op-n">${i + 1}</span><img alt="" src="${urlIcone(ic)}" /><b>${esc(nome)}</b><span class="sv-op-nv ${nivel.startsWith('N') && !nivel.startsWith('NV') ? 'novo' : ''}">${o.tipo === 'maldicao' ? nivel : `${'★'.repeat(o.raridade || 0)}${o.raridade ? ' ' : ''}${rar.nome.toUpperCase()}${nivel ? ` · ${nivel}` : ''}`}</span><small>${desc}</small></button>`;
  }).join('');
  tela(`<div class="sv-upgrade"><h2>Nível ${S.nivel}!</h2><p class="sv-sub">${modoBanir ? 'Toque na carta que quer banir pelo resto da partida' : 'Escolha uma melhoria'}</p><div class="sv-ops">${cartas}</div>
    <div class="sv-acoes"><button class="sv-btn mini" data-a="rolar" ${S.reroll <= 0 ? 'disabled' : ''}><img alt="" src="${urlIcone('reroll')}" />Rolar de novo (${S.reroll})</button><button class="sv-btn mini ${modoBanir ? 'ouro' : ''}" data-a="banir" ${S.ban <= 0 ? 'disabled' : ''}>${modoBanir ? 'Cancelar' : `<img alt="" src="${urlIcone('ban')}" />Banir carta (${S.ban})`}</button></div></div>`, 'jogo');
}
function descreverSalto(id, n) {
  const a = ARMAS[id].stats(n - 1); const b = ARMAS[id].stats(n); const t = [];
  if (b.dano > a.dano) t.push('dano'); if (b.qtd > a.qtd) t.push('projéteis'); if ((b.cd || 9) < (a.cd || 9)) t.push('velocidade'); if (b.raio > a.raio) t.push('alcance'); if (b.giro > a.giro) t.push('giro'); if (b.perf > a.perf) t.push('perfuração');
  return t.length ? t.join(' e ') : 'poder';
}
function escolherOpcao(i) {
  if (!S || S.estado !== 'upgrade' || !S.opcoes?.[i]) return;
  if (modoBanir) { modoBanir = false; if (banir(S, i)) som('clique'); mostrarUpgrade(); return; }
  escolher(S, S.opcoes[i]); som('escolha');
  if (S.estado === 'upgrade') mostrarUpgrade(); else { ui.innerHTML = ''; ui.className = 'sv-ui jogo'; }
}
function processarEventos() {
  for (const e of S.evt) {
    const s = SOM_EVENTO[e.tipo]; if (s) som(s);
    if (e.tipo === 'chefe') avisar(`${CHEFES[e.id].nome.toUpperCase()} APARECEU!`, 'chefe');
    else if (e.tipo === 'onda') avisar('ONDA DE TROPAS!', 'onda');
    else if (e.tipo === 'fase2') avisar(`${CHEFES[e.id].nome.split(',')[0].toUpperCase()} ENFURECEU!`, 'chefe');
    else if (e.tipo === 'onda_chefe') som('chefe');
    else if (e.tipo === 'combo') { avisar(`${e.nome} ${e.n} abates · +${e.ouro} ouro`, 'chefe'); som('ima'); }
    else if (e.tipo === 'evolucao') { avisar(`EVOLUÇÃO! ${EVOLUCOES[e.id].nome}`, 'chefe'); som('revive'); }
    else if (e.tipo === 'maldicao') avisar(`Maldição: ${MALDICOES[e.id].nome}`, 'onda');
    else if (e.tipo === 'revive') avisar('Anjo Guardião!', 'onda');
  }
  S.evt.length = 0;
}
let animVit = null;
function fimDeJogo() {
  fimTratado = true; const venceu = S.estado === 'vitoria'; som(venceu ? 'vitoria' : 'derrota');
  const ganho = essenciaGanha(S); Meta.registrarPartida(meta, S, ganho);
  try { platform.recordResult(GAME_ID, { score: S.abates * 10 + Math.floor(S.t) + (venceu ? 5000 : 0), summary: { campeao: S.campeao, tempo: Math.floor(S.t), abates: S.abates, nivel: S.nivel, venceu } }); } catch { /* sem conexão */ }
  const c = CAMPEOES.find((x) => x.id === S.campeao);
  clearInterval(animVit);
  tela(`<div class="sv-painel ${venceu ? 'vitoria' : 'derrota'}"><h2>${venceu ? 'VITÓRIA!' : 'DERROTA'}</h2>
    <p class="sv-sub">${venceu ? 'Chefe derrotado. O reino é seu!' : 'Você caiu em Runeterra...'}</p>
    <img class="sv-retrato ${RETRATOS[S.campeao] ? 'arte' : ''}" alt="" src="${RETRATOS[S.campeao] ? arteUrl(RETRATOS[S.campeao]) : urlSprite(S.campeao)}" />
    <div class="sv-stats"><span>Campeão<b>${esc(c.nome)}</b></span><span>Tempo<b>${tempoTxt(S.t)}</b></span><span>Abates<b>${fmt(S.abates)}</b></span><span>Nível<b>${S.nivel}</b></span><span>Ouro<b>${fmt(S.ouro)}</b></span><span>Essência<b class="ea">+${fmt(ganho)} EA</b></span></div>
    <div class="sv-botoes"><button class="sv-btn grande" data-a="denovo">Jogar de novo</button>${venceu ? '<button class="sv-btn" data-a="infinito">Continuar (infinito)</button>' : ''}<button class="sv-btn" data-a="menu">Menu</button></div></div>`, 'jogo');
  if (venceu && nQuadros(S.campeao, 'vitoria')) { const img = ui.querySelector('.sv-retrato'); let k = 0; if (img) { img.classList.remove('arte'); img.classList.add('anim'); animVit = setInterval(() => { img.src = urlQuadro(S.campeao, 'vitoria', k++ % nQuadros(S.campeao, 'vitoria')); }, 180); } }
}

// --------------------------------------------------------------------------- cliques
ui.addEventListener('click', (e) => {
  destravar();
  const op = e.target.closest('[data-op]'); if (op) { escolherOpcao(Number(op.dataset.op)); return; }
  const cartaEl = e.target.closest('[data-camp]'); const reinoEl = e.target.closest('[data-reino]');
  const b = e.target.closest('[data-a]');
  if (!b) { if (reinoEl && Meta.reinoLiberado(meta, reinoEl.dataset.reino)) { reinoEscolhido = reinoEl.dataset.reino; telaReinos(); return; } if (cartaEl && meta.liberados.includes(cartaEl.dataset.camp)) { escolhido = cartaEl.dataset.camp; telaCampeoes(!!ui.dataset.jogar); } return; }
  const a = b.dataset.a; const id = b.dataset.id; som('clique');
  if (a === 'jogar') telaCampeoes(true);
  else if (a === 'campeoes') telaCampeoes(false);
  else if (a === 'loja') telaLoja();
  else if (a === 'como') telaComo();
  else if (a === 'menu') { clearInterval(animVit); S = null; telaMenu(); }
  else if (a === 'escolher') { escolhido = id; telaCampeoes(!!ui.dataset.jogar); }
  else if (a === 'liberar-rc') { comprarCampeaoRC(id).then(() => telaCampeoes(!!ui.dataset.jogar)); }
  else if (a === 'liberar') { if (Meta.comprarCampeao(meta, id)) { escolhido = id; som('bau'); } telaCampeoes(!!ui.dataset.jogar); }
  else if (a === 'melhorar') { if (Meta.comprarMelhoria(meta, id)) som('escolha'); telaLoja(); }
  else if (a === 'reinos') telaReinos();
  else if (a === 'reino') { reinoEscolhido = id; telaReinos(); }
  else if (a === 'comecar' || a === 'denovo') { clearInterval(animVit); iniciar(); }
  else if (a === 'continuar') alternarPausa();
  else if (a === 'rolar') { if (rolar(S)) { som('clique'); modoBanir = false; mostrarUpgrade(); } }
  else if (a === 'banir') { modoBanir = !modoBanir; mostrarUpgrade(); }
  else if (a === 'desistir') { pausado = false; S.estado = 'derrota'; S.p.hp = 0; }
  else if (a === 'infinito') { S.infinito = true; S.estado = 'jogando'; fimTratado = false; ui.innerHTML = ''; ui.className = 'sv-ui jogo'; avisar('Modo infinito!'); }
  else if (a === 'mudo') { definirMudo(!estaMudo()); try { localStorage.setItem('survivors.mudo', estaMudo() ? '1' : '0'); } catch { /* sem storage */ } if (modo === 'jogo') alternarPausa(true); else telaMenu(); }
});

// --------------------------------------------------------------------------- laço
function laco(ts) {
  const dt = Math.min(0.05, ult ? (ts - ult) / 1000 : 0.016); ult = ts;
  try {
    if (modo === 'jogo' && S) {
      if (S.estado === 'jogando' && !pausado) atualizar(S, dt, entrada());
      if (S.evt.length) processarEventos();
      if (S.estado === 'upgrade' && !ui.querySelector('.sv-upgrade')) { mostrarUpgrade(); som('nivel'); }
      render.quadro(S);
      if ((S.estado === 'derrota' || S.estado === 'vitoria') && !fimTratado) fimDeJogo();
    } else { passoDemo(dt); render.quadro(demo); }
  } catch (err) { console.error(err); }
  requestAnimationFrame(laco);
}

// --------------------------------------------------------------------------- início (acesso restrito enquanto estiver em teste)
async function acesso() {
  if (LOCAL && new URLSearchParams(location.search).has('teste')) return true;
  const com = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), 4000))]);
  await com(platform.init());
  const aberto = !gameById(GAME_ID)?.soAdmin;
  if (aberto) return true;
  if (!platform.getUser()) return 'Entre com a conta de administrador para jogar o Rift Survivors.';
  return (await com(platform.podeJogosEmTeste())) ? true : 'Este jogo ainda está em desenvolvimento e só administradores têm acesso.';
}
// Progresso na conta: ao entrar vale o mais recente (conta ou navegador) e cada alteração é enviada ao servidor.
let envio = null; let emEnvio = false;
async function enviarProgresso() {
  if (emEnvio) { envio = setTimeout(enviarProgresso, 1500); return; }
  emEnvio = true;
  try {
    const rev = meta.rev; const r = await platform.survivorsSalvar(rev, meta);
    if (r && !r.ok && r.rev > (meta.rev || 0)) { const c = await platform.survivorsCarregar(); if (c?.dados) { Object.assign(meta, Meta.normalizar(c.dados), { rev: c.rev }); Meta.gravarLocal(meta); } }
  } catch { /* fica só no navegador */ } finally { emEnvio = false; }
}
// Compra de campeão com Rift Coins: o servidor desconta as moedas e guarda a compra na conta.
async function comprarCampeaoRC(id) {
  const c = CAMPEOES.find((x) => x.id === id); if (!c?.rc) return;
  try { await platform.comprarItem('campeao', `sv-${id}`); Meta.liberarPorRC(meta, id); escolhido = id; som('bau'); avisar(`${c.nome} liberada!`, 'onda'); }
  catch (e) { avisar(e?.message || 'Não foi possível comprar agora.', 'onda'); }
}
// Campeões já comprados com RC (em outro aparelho, por exemplo) voltam a ficar liberados.
async function liberarCompradosRC() {
  try { for (const r of await platform.minhasRecompensas()) if (r.tipo === 'campeao' && /^sv-/.test(r.chave)) Meta.liberarPorRC(meta, r.chave.slice(3)); } catch { /* sem servidor: vale o que está salvo */ }
}
async function sincronizar() {
  const u = platform.getUser(); if (!u) return;
  Meta.usarConta(u.id); meta = Meta.carregar();
  try {
    const c = await Promise.race([platform.survivorsCarregar(), new Promise((r) => setTimeout(() => r(null), 4000))]);
    if (c?.dados && !meta.rev && meta.partidas > (c.dados.partidas || 0)) { meta.rev = Date.now(); enviarProgresso(); } // progresso antigo só deste navegador, mais adiantado que o da conta
    else if (c?.dados && c.rev > (meta.rev || 0)) { meta = Meta.normalizar(c.dados); meta.rev = c.rev; Meta.gravarLocal(meta); }
    else if (!c || c.rev < (meta.rev || 0)) { if (!meta.rev) meta.rev = Date.now(); if (c !== null || meta.partidas > 0 || meta.essencia > 0) enviarProgresso(); }
  } catch { /* sem conta/servidor: vale o navegador */ }
  await liberarCompradosRC();
  escolhido = meta.ultimo; reinoEscolhido = meta.ultimoReino || 'ixtal';
  Meta.aoGravar(() => { clearTimeout(envio); envio = setTimeout(enviarProgresso, 800); });
}
(async function iniciarPagina() {
  ajustar(); try { await carregarImagens(); } catch { /* usa os desenhos em código */ } novaDemo(); requestAnimationFrame(laco);
  try { document.fonts?.load('8px "Press Start 2P"'); } catch { /* sem fonte */ }
  const r = await acesso();
  if (r !== true) { tela(`<div class="sv-painel pequeno"><h2>Rift Survivors</h2><p class="sv-sub">${esc(r)}</p><div class="sv-botoes"><a class="sv-btn" href="../../">Voltar ao início</a></div></div>`); return; }
  if (new URLSearchParams(location.search).has('auto')) { escolhido = new URLSearchParams(location.search).get('auto') || 'garen'; iniciar(); return; }
  await sincronizar();
  telaMenu();
})();
// ganchos para teste automatizado
window.__sv = { avancar(seg) { for (let i = 0; i < seg * 30 && S && S.estado !== 'derrota' && S.estado !== 'vitoria'; i++) { if (S.estado === 'upgrade') escolher(S, S.opcoes[0]); atualizar(S, 1 / 30, botEntrada(S)); S.evt.length = 0; } }, get S() { return S; }, get meta() { return meta; }, iniciar: (c, rei) => { if (c) escolhido = c; if (rei) { for (const id of ORDEM_REINOS) meta.reinos[id] ||= { vitorias: 1, melhor: 0, partidas: 0 }; reinoEscolhido = rei; } iniciar(); }, escolherOpcao, get modo() { return modo; } };
