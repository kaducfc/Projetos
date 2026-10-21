// Tela da partida: monta a simulação, o relógio, o canvas, o placar e os controles. A tela apenas lê o estado do motor.
import * as platform from '../../../../shared/platform.js';
import { mountSiteBar } from '../../../../shared/account.js';
import { t } from '../../../../shared/i18n.js';
import { gameById } from '../../../../shared/config.js';
import { Partida } from '../motor/partida.js';
import { Relogio } from '../motor/relogio.js';
import { Renderizador } from '../render/canvas.js';
import { CAMADAS, desenharDepuracao } from '../render/depuracao.js';
import { MAPA } from '../config/mapa.js';
import { MUNDO } from '../nucleo/coord.js';
import { elencoTeste } from '../dados/elencos-teste.js';
import { prepararImagens, campIcone, itemUrl } from '../../js/campeoes-img.js';
import { ITENS } from '../dados/itens.js';
import { tempoTexto } from '../motor/eventos.js';
import { REGRAS } from '../config/regras.js';
import { criarAnuncios } from './anuncios.js?v=7';
import { abrirDraft } from './draft-ui.js?v=17';

const api = platform.tecnico;

const app = document.getElementById('app');
mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../../' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
const consulta = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

const E = { partida: null, relogio: null, rend: null, catalogo: [], camadas: {}, config: null, modo: 'teste', fimMostrado: false, turbo: false, selecionado: null, ultFeed: 0, ultPlacar: 0 };

// Nick do jogador com a sigla do time (ex.: FNX Zeka); na sala de testes não há sigla.
const nick = (eq, nome) => esc([eq === 'azul' ? E.config.siglaAzul : E.config.siglaVermelho, nome].filter(Boolean).join(' '));

function msg(t) { app.innerHTML = `<p class="pt-msg">${esc(t)}</p>`; }

async function carregarCatalogo() {
  const d = await (await fetch('../../campeao/dados/campeoes.json')).json();
  E.catalogo = d.campeoes.map((c) => ({ ...c, id: c.nome }));
}
function carregarImagemMapa() {
  return new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = '../' + MAPA.imagem.arquivo; });
}

function configTeste() {
  const q = (k, d) => Number(consulta.get(k) ?? d);
  return { modo: 'teste', pa: q('pa', 60), pv: q('pv', 60), semente: q('seed', 1), veloc: q('v', REGRAS.velocidadePadrao) };
}
async function configOficial(id) {
  const el = await api.partidaElencos(id);
  const jogs = (l) => l.map((j) => ({ id: j.id, nome: j.nome, pos: j.pos, atributos: j.atributos, poder: j.poder, eficiencia: j.eficiencia, favoritos: j.favoritos }));
  const f = el.partida.formato;
  return {
    modo: 'oficial', id, idAzul: el.azul.org.id, idVermelho: el.vermelho.org.id, mapa: el.mapa, semente: el.semente, versao: el.versao, azul: jogs(el.azul.jogadores), vermelho: jogs(el.vermelho.jogadores),
    nomeAzul: el.azul.org.nome, nomeVermelho: el.vermelho.org.nome, siglaAzul: el.azul.org.sigla, siglaVermelho: el.vermelho.org.sigla, veloc: REGRAS.velocidadePadrao,
    aviso: t('Partida oficial · mapa {x1} de uma série melhor de {x2} · {x3} (azul) × {x4} (vermelho). O resultado não pode ser refeito.', { x1: el.mapa, x2: f, x3: el.azul.org.nome, x4: el.vermelho.org.nome }),
    lado: { definido: !!el.lado?.definido, escolhe: el.lado?.escolhe, voceEscolhe: !!el.lado?.voce_escolhe },
    aoFim: (r, acoes) => botaoRegistrar(el, r, acoes),
  };
}
async function configAmistoso(id) {
  const el = await api.amistosoElencos(id);
  const jogs = (l) => l.map((j) => ({ id: j.id, nome: j.nome, pos: j.pos, atributos: j.atributos, poder: j.poder, eficiencia: j.eficiencia, favoritos: j.favoritos }));
  return {
    modo: 'amistoso', id, mapa: 1, semente: el.semente, versao: el.versao, azul: jogs(el.azul.jogadores), vermelho: jogs(el.vermelho.jogadores),
    nomeAzul: el.azul.org.nome, nomeVermelho: el.vermelho.org.nome, siglaAzul: el.azul.org.sigla, siglaVermelho: el.vermelho.org.sigla, veloc: REGRAS.velocidadePadrao,
    aviso: t('Amistoso (scrim) · {x1} (azul) × {x2} (vermelho). Não vale pontos de campeonato.', { x1: el.azul.org.nome, x2: el.vermelho.org.nome }),
    aoFim: (r, acoes) => botaoRegistrarAmistoso(id, r, acoes),
  };
}
function botaoRegistrarAmistoso(id, r, acoes) {
  if (!r.vencedor) { acoes.insertAdjacentHTML('afterbegin', '<p style="color:#fca5a5;flex-basis:100%">A partida foi interrompida pela proteção técnica e não pode ser registrada.</p>'); return; }
  const b = document.createElement('button'); b.className = 'pt-btn ouro'; b.textContent = 'Encerrar amistoso'; acoes.prepend(b);
  const fechar = acoes.querySelector('#r-fechar'); if (fechar) fechar.disabled = true; // só fecha depois de encerrar (senão o amistoso não conta)
  const aviso = document.createElement('p'); aviso.style.cssText = 'flex-basis:100%;margin:0;color:#8fa3bf;font-size:13px'; acoes.append(aviso);
  b.onclick = async () => {
    b.disabled = true; aviso.textContent = 'Registrando…';
    const { eventos, ...enviar } = r;
    try {
      const rr = await api.amistosoRegistrar(id, { ...enviar, bans: E.config.bans });
      if (fechar) { fechar.disabled = false; fechar.onclick = () => { location.href = '../'; }; } // depois de registrar, Fechar leva ao menu do jogo
      aviso.innerHTML = `${rr.exp ? `+${rr.exp_ganho} EXP e maestria nos campeões usados pelos seus titulares. ` : 'Sem EXP nem maestria neste amistoso (só os 5 primeiros do dia contam). '}<a style="color:#f5cf5a" href="../">Voltar ao simulador</a>`;
    } catch (e) { aviso.textContent = e.message || 'Não foi possível registrar o amistoso.'; b.disabled = false; }
  };
}
function botaoRegistrar(el, r, acoes) {
  const aqui = E.config;
  if (!r.vencedor) { acoes.insertAdjacentHTML('afterbegin', '<p style="color:#fca5a5;flex-basis:100%">A partida foi interrompida pela proteção técnica e não pode ser registrada.</p>'); return; }
  const b = document.createElement('button'); b.className = 'pt-btn ouro'; b.textContent = 'Registrar resultado'; acoes.prepend(b);
  const fechar = acoes.querySelector('#r-fechar'); if (fechar) fechar.disabled = true; // só fecha depois de registrar
  const aviso = document.createElement('p'); aviso.style.cssText = 'flex-basis:100%;margin:0;color:#8fa3bf;font-size:13px'; acoes.append(aviso);
  b.onclick = async () => {
    b.disabled = true; aviso.textContent = 'Registrando…';
    const { eventos, ...enviar } = r;
    try {
      const picks = (l) => Object.fromEntries(l.map((j) => [j.pos, typeof j.campeao === 'string' ? j.campeao : j.campeao?.nome]));
      await api.gameplayDraft(aqui.id, aqui.mapa, { picks: { azul: picks(aqui.azul), vermelho: picks(aqui.vermelho) }, bans: aqui.bans });
      const rr = await api.gameplayRegistrar(aqui.id, aqui.mapa, enviar);
      if (fechar) { fechar.disabled = false; fechar.onclick = () => { location.href = '../'; }; } // depois de registrar, Fechar leva ao menu do jogo
      if (rr.concluida) { aviso.innerHTML = `Partida concluída: ${rr.placar_a} × ${rr.placar_b}. <a style="color:#f5cf5a" href="../">Voltar ao simulador</a>`; }
      else { aviso.innerHTML = `Mapa registrado (${rr.placar_a} × ${rr.placar_b}). A série continua. <a style="color:#f5cf5a" href="" onclick="location.reload();return false">Jogar o próximo mapa</a>`; }
    } catch (e) { aviso.textContent = e.message || 'Não foi possível registrar o resultado.'; b.disabled = false; }
  };
}
function novaPartida(cfg) {
  const opc = { azul: cfg.azul || elencoTeste('A', cfg.pa, cfg.semente), vermelho: cfg.vermelho || elencoTeste('V', cfg.pv, cfg.semente), semente: cfg.semente, catalogo: E.catalogo };
  return new Partida(opc);
}

function montar() {
  const nomeA = E.config.nomeAzul || 'Equipe Azul', nomeV = E.config.nomeVermelho || 'Equipe Vermelha';
  app.innerHTML = `
    ${E.config.aviso ? `<div class="pt-aviso">${esc(E.config.aviso)}</div>` : ''}
    <div class="pt-topo">
      <div class="pt-eq a"><span class="nome">${esc(nomeA)}</span><span class="met">Abates<b id="ka">0</b></span><span class="met">Ouro<b id="ga">0</b></span><span class="met">Torres<b id="ta">0</b></span><span class="met">Dragões<b id="da">0</b></span></div>
      <div class="pt-relogio"><div class="t" id="rel">0:00</div><small id="fase">Fase inicial</small></div>
      <div class="pt-eq v"><span class="met">Dragões<b id="dv">0</b></span><span class="met">Torres<b id="tv">0</b></span><span class="met">Ouro<b id="gv">0</b></span><span class="met">Abates<b id="kv">0</b></span><span class="nome">${esc(nomeV)}</span></div>
    </div>
    <div class="pt-corpo">
      <div class="pt-mapa" id="mapa"><canvas id="cv" aria-label="Mapa da partida"></canvas><div class="pt-obj" id="obj"></div></div>
      <nav class="pt-menu" aria-label="Controles da partida"><div class="pt-controles" id="ctl"></div></nav>
      <aside class="pt-lado">
        <div class="pt-card"><h3>Placar <span id="vel"></span></h3><table class="pt-placar" id="placar"></table></div>
        <div class="pt-card"><h3>Foco</h3><div class="pt-foco" id="foco"><div id="foco-txt">Clique em um campeão no mapa ou no placar.</div><div id="foco-itens" class="pt-itens"></div></div></div>
        <div class="pt-card"><h3>Eventos</h3><div class="pt-feed" id="feed"></div></div>
      </aside>
    </div>
    <div class="pt-depur" id="depur"></div>
    ${E.config.modo === 'teste' ? `<div class="pt-teste"><label>Poder azul <input type="number" id="pa" min="1" max="100" value="${E.config.pa}"></label><label>Poder vermelho <input type="number" id="pv" min="1" max="100" value="${E.config.pv}"></label><label>Semente <input type="number" id="seed" value="${E.config.semente}"></label><span>A mesma semente reproduz a mesma partida.</span></div>` : ''}`;
  E.rend = new Renderizador(document.getElementById('cv'), E.imagem);
  E.anuncios = criarAnuncios(document.getElementById('mapa'));
  const mapa = document.getElementById('mapa');
  encaixar();
  document.getElementById('cv').addEventListener('click', (e) => {
    const r = e.target.getBoundingClientRect(); const u = E.rend.campeaoEm(E.partida, e.clientX - r.left, e.clientY - r.top);
    selecionar(u ? u.id : null);
  });
  // controles
  const ctl = document.getElementById('ctl');
  const meuLado = E.config.meuLado || 'azul'; const outroLado = meuLado === 'azul' ? 'vermelho' : 'azul';
  E.rend.fog = meuLado; // a partida começa com a visão do próprio time; os botões do menu trocam para a do adversário ou a visão total
  ctl.innerHTML = `<button class="pt-btn ouro" id="b-play">▶ Iniciar</button><span class="pt-sep"></span>${REGRAS.velocidades.map((v) => `<button class="pt-btn" data-v="${v}">${v}x</button>`).join('')}<span class="pt-sep"></span><button class="pt-btn" id="b-tela">⛶ Tela cheia</button><button class="pt-btn" id="b-fim">⏭ Ir até o fim</button><span class="pt-sep"></span><span class="pt-vis" role="group" aria-label="Visão do mapa"><button class="pt-btn on" data-vis="${meuLado}" title="Mostra só o que o seu time enxerga">👁 Meu time</button><button class="pt-btn" data-vis="${outroLado}" title="Mostra só o que o time inimigo enxerga">👁 Inimigo</button><button class="pt-btn" data-vis="todos" title="Mostra o mapa inteiro, sem névoa">👁 Visão total</button></span>${E.config.modo === 'oficial' ? '' : '<button class="pt-btn" id="b-reiniciar">↻ Reiniciar</button>'}`;
  ctl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.vis) { E.rend.fog = b.dataset.vis === 'todos' ? null : b.dataset.vis; ctl.querySelectorAll('[data-vis]').forEach((x) => x.classList.toggle('on', x === b)); return; }
    if (b.id === 'b-play') {
      if (E.partida.fim) return;
      if (E.turbo) E.pararTurbo?.();
      if (E.relogio.pausado) { E.relogio.definirVelocidade(1); E.relogio.retomar(); } else E.relogio.pausar(); // iniciar/retomar sempre volta ao 1x
      marcarVelocidade();
    } else if (b.dataset.v) { if (E.turbo) E.pararTurbo?.(); E.relogio.definirVelocidade(Number(b.dataset.v)); E.relogio.retomar(); marcarVelocidade(); }
    else if (b.id === 'b-reiniciar') { if (E.config.modo === 'teste') reiniciar(); }
    else if (b.id === 'b-fim') irAteOFim();
    else if (b.id === 'b-tela') telaCheia();
  });
  const dep = document.getElementById('depur');
  dep.innerHTML = '<span>Depuração:</span>' + CAMADAS.map(([k, n]) => `<label><input type="checkbox" data-k="${k}"/>${n}</label>`).join('');
  dep.addEventListener('change', (e) => { E.camadas[e.target.dataset.k] = e.target.checked; });
  document.getElementById('placar').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) selecionar(Number(tr.dataset.id)); });
  marcarVelocidade();
  encaixar(); requestAnimationFrame(encaixar);
}
// Faz a partida inteira caber na janela, sem rolar a página: o mapa ocupa o maior tamanho possível ao lado do placar.
function encaixar() {
  const app = document.getElementById('app'); const mapa = document.getElementById('mapa'); const corpo = document.querySelector('.pt-corpo');
  if (!app || !mapa || !corpo || !E.rend) return;
  app.classList.add('ao-vivo'); app.dataset.modo = E.config.modo;
  const topo = app.getBoundingClientRect().top + window.scrollY;
  const mb = parseFloat(getComputedStyle(document.body).marginBottom) || 0;
  app.style.height = `${Math.max(320, window.innerHeight - topo - mb)}px`;
  const estreito = window.matchMedia('(max-width: 1000px)').matches;
  const lado = estreito ? 0 : (document.querySelector('.pt-lado')?.offsetWidth || 340) + (document.querySelector('.pt-menu')?.offsetWidth || 90) + 24;
  const largDisp = corpo.clientWidth - lado;
  const altDisp = estreito ? Infinity : corpo.clientHeight;
  const w = Math.max(280, Math.floor(Math.min(largDisp, altDisp * MUNDO.largura / MUNDO.altura)));
  E.rend.ajustar(w);
  mapa.style.width = `${w}px`; mapa.style.height = `${E.rend.h}px`;
}
function telaCheia() {
  const app = document.getElementById('app');
  if (document.fullscreenElement) document.exitFullscreen?.(); else app.requestFullscreen?.().catch(() => {});
}
// Pausado: nenhuma velocidade fica marcada e o botão de pausa fica marcado; rodando: só a velocidade atual fica marcada.
function marcarVelocidade() {
  const pausado = E.relogio.pausado;
  document.querySelectorAll('#ctl [data-v]').forEach((b) => b.classList.toggle('on', !pausado && Number(b.dataset.v) === E.relogio.velocidade));
  const play = document.getElementById('b-play');
  if (play && !E.partida.fim) { const iniciou = E.partida.t > 0; play.textContent = !pausado ? '⏸ Pausar' : iniciou ? '▶ Retomar' : '▶ Iniciar'; play.classList.toggle('on', pausado && iniciou); }
  const v = document.getElementById('vel'); if (v) v.textContent = E.relogio.velocidade + 'x';
}
function selecionar(id) { E.selecionado = id; E.rend.selecionado = id; E.ultPlacar = 0; }

function reiniciar() {
  if (E.config.modo !== 'teste') return; // partida oficial ou amistoso: o resultado não pode ser refeito
  if (E.config.modo === 'teste') {
    const g = (id, d) => Number(document.getElementById(id)?.value ?? d);
    E.config.pa = g('pa', 60); E.config.pv = g('pv', 60); E.config.semente = g('seed', 1);
  }
  E.partida = novaPartida(E.config);
  E.relogio.trocarPartida(E.partida); E.relogio.definirVelocidade(1);
  E.fimMostrado = false; E.turbo = false; E.selecionado = null; E.rend.selecionado = null; E.ultFeed = 0; E.anuncios?.reiniciar();
  document.getElementById('b-play').disabled = false; marcarVelocidade();
  document.querySelectorAll('.pt-fundo').forEach((x) => x.remove());
  atualizarPlacar(true);
}
// Simula o restante da partida em blocos para não travar a tela (e sem pular nada: são os mesmos passos fixos).
function irAteOFim() {
  const botao = document.getElementById('b-fim'); const play = document.getElementById('b-play');
  const parar = () => { E.turbo = false; botao.classList.remove('on'); botao.textContent = '⏭ Ir até o fim'; };
  E.pararTurbo = () => { parar(); marcarVelocidade(); };
  if (E.turbo) { // segundo clique desmarca: volta ao tempo normal
    parar(); if (!E.partida.fim) E.relogio.retomar(); marcarVelocidade();
    return;
  }
  if (E.partida.fim) return;
  E.turbo = true; E.relogio.pausar(); botao.classList.add('on'); marcarVelocidade();
  const bloco = () => {
    if (!E.turbo) return;
    const t0 = performance.now();
    while (!E.partida.fim && performance.now() - t0 < 25) E.partida.step();
    botao.textContent = `⏭ ${tempoTexto(E.partida.t)}… (parar)`;
    if (!E.partida.fim) setTimeout(bloco, 0); else parar();
  };
  bloco();
}

// ------------------------------------------------------------------ placar e eventos
function dragoes(P, eq) { return P.equipes[eq].pilhasDragao; }
function torresCaidas(P, eq) { return P.estruturas.filter((e) => e.equipe !== eq && e.subtipo === 'torre' && e.morto).length; }
function atualizarPlacar(forcar = false) {
  const P = E.partida; const agora = performance.now();
  if (!forcar && agora - E.ultPlacar < 250) return; E.ultPlacar = agora;
  const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== String(v)) el.textContent = v; };
  set('rel', tempoTexto(P.t)); set('fase', { inicial: 'Fase inicial', intermediaria: 'Fase intermediária', avancada: 'Fase avançada' }[P.fase] || '');
  const gA = P.campeoes.filter((c) => c.equipe === 'azul').reduce((s, c) => s + c.ouroTotal, 0), gV = P.campeoes.filter((c) => c.equipe === 'vermelho').reduce((s, c) => s + c.ouroTotal, 0);
  set('ka', P.equipes.azul.abates); set('kv', P.equipes.vermelho.abates); set('ga', fmt(gA)); set('gv', fmt(gV));
  set('ta', torresCaidas(P, 'azul')); set('tv', torresCaidas(P, 'vermelho')); set('da', dragoes(P, 'azul')); set('dv', dragoes(P, 'vermelho'));
  const linha = (c) => `<tr data-id="${c.id}" class="${c.morto ? 'morto' : ''} ${E.selecionado === c.id ? 'sel' : ''}"><td>${campIcone(c.campeao, 26)}</td><td class="nm">${esc(c.campeao)}<small>${nick(c.equipe, c.nome)}</small></td><td class="n">${c.nivel}</td><td class="n">${c.estat.abates}/${c.estat.mortes}/${c.estat.assist}</td><td class="n">${c.estat.cs + c.estat.csSelva}</td><td class="n">${fmt(c.ouro)}</td><td><div class="vida"><i style="width:${Math.round(c.hp / c.hpMax * 100)}%;background:${c.equipe === 'azul' ? '#4aa3ff' : '#ff6a6a'}"></i></div></td></tr>`;
  document.getElementById('placar').innerHTML = `<tr><th></th><th></th><th class="n">N</th><th class="n">K/D/A</th><th class="n">CS</th><th class="n">Ouro</th><th></th></tr>` + P.campeoes.map(linha).join('');
  // objetivos
  const O = P.objetivosEstado;
  // contadores dos épicos: no começo Arauto e Dragão; sem o Arauto, Barão e Dragão; com a Alma de um time (4 dragões), Dragão Ancião
  const viva = (o) => o.vivo && !o.vivo.morto;
  const lista = [];
  const arautoFora = O.arauto.aposentado || O.arauto.mortes > 0;
  lista.push(O.dragao.almaAlcancada ? ['anciao', O.dragao] : ['dragao', O.dragao]);
  lista.push(arautoFora ? ['barao', O.barao] : ['arauto', O.arauto]);
  const segs = (o) => Math.max(0, Math.ceil(o.proximo - P.t));
  const visiveis = lista.filter(([, o]) => viva(o) || segs(o) <= 180); // só aparece quando faltam 3 min para nascer (ou enquanto vivo)
  lista.length = 0; lista.push(...visiveis);
  const chave = lista.map((x) => x[0]).join();
  const caixa = document.getElementById('obj');
  if (caixa.dataset.k !== chave) { caixa.dataset.k = chave; caixa.innerHTML = lista.map(([id]) => `<div class="ep-b ep-${id}" data-ep="${id}"><img src="img/epicos/${id}.webp" alt="${id}" /><span class="tx"></span></div>`).join(''); }
  for (const [id, o] of lista) {
    const el = caixa.querySelector(`[data-ep="${id}"]`); if (!el) continue;
    const v = viva(o); const seg = Math.max(0, Math.ceil(o.proximo - P.t));
    el.classList.toggle('on', !!v);
    el.querySelector('.tx').textContent = v ? 'VIVO' : `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
  }
  // foco
  const f = E.selecionado ? P.mapaUnidades.get(E.selecionado) : null;
  const foco = document.getElementById('foco-txt'); const focoItens = document.getElementById('foco-itens');
  if (f) {
    const hab = f.habilidades.map((h) => { const r = f.rank[h.tecla.toLowerCase()]; const cd = Math.max(0, h.proximo - P.t); return `${h.tecla}${r ? '' : '·'}${cd > 0 ? ` ${cd.toFixed(0)}s` : ' ✓'}`; }).join(' · ');
    foco.innerHTML = `<b>${esc(f.campeao)}</b> (${esc(f.nome)}) · nível ${f.nivel}<br>Estado: <b>${esc(f.estado)}</b> ${f.motivo ? `(${esc(f.motivo)})` : ''}<br>Vida ${Math.round(f.hp)}/${f.hpMax} · Mana ${Math.round(f.mana)}<br>AD ${Math.round(f.ad)} · AP ${Math.round(f.ap)} · Arm ${Math.round(f.armadura)} · RM ${Math.round(f.resist)}<br>Habilidades: ${hab}<br>Itens: ${f.itens.length ? '' : '—'}`;
    const chave = f.id + ':' + f.itens.join(',') + (f.wards ? `:${f.wards.cargas}:${f.wards.controleEstoque}` : '');
    if (focoItens.dataset.k !== chave) {
      focoItens.dataset.k = chave;
      focoItens.innerHTML = f.itens.map((id) => { const it = ITENS[id]; const u = itemUrl(it.ddragon); return `<span class="pt-item" title="${esc(it.nome)}"><span class="ini">${esc(it.nome[0])}</span>${u ? `<img src="${u}" alt="${esc(it.nome)}" width="32" height="32" loading="lazy">` : ''}</span>`; }).join('')
        + (f.wards && f.wards.controleEstoque ? '<span class="pt-item" title="Ward de Controle (na mochila)"><img src="img/ward_controle.webp" alt="Ward de Controle" width="32" height="32"></span>' : '');
    }
  } else { foco.textContent = 'Clique em um campeão no mapa ou no placar.'; focoItens.innerHTML = ''; focoItens.dataset.k = ''; }
}
const TEXTOS = {
  abate: (e, P) => { const v = P.mapaUnidades.get(e.vitima); const a = e.abatedor ? P.mapaUnidades.get(e.abatedor) : null; return `${a ? esc(a.campeao) : 'Estrutura/monstro'} eliminou ${v ? esc(v.campeao) : '?'}`; },
  torre_destruida: (e) => `Torre derrubada (${e.rota || 'base'})`, inibidor_destruido: (e) => `Inibidor derrubado (${e.rota})`,
  arauto_usado: (e) => `Arauto liberado na rota ${e.rota}`,
  arauto_impacto: (e) => `Arauto avançou contra uma estrutura (-${e.dano})`,
  objetivo_abatido: (e) => `${{ dragao: 'Dragão', anciao: 'Dragão Ancião', arauto: 'Arauto', barao: 'Barão' }[e.objetivo] || e.objetivo} conquistado`,
  nexus_destruido: () => 'NEXUS DESTRUÍDO', alma_dragao: () => 'Alma do dragão', primeiro_abate: () => 'Primeiro abate',
  gank_iniciado: (e, P) => { const c = P.mapaUnidades.get(e.campeao); return `${c ? esc(c.campeao) : 'Jungler'} inicia um gank (${e.rota})`; },
  gank_resultado: (e, P) => { const c = P.mapaUnidades.get(e.campeao); return `Gank de ${c ? esc(c.campeao) : '?'}: ${e.resultado}`; },
  objetivo_iniciado: (e) => `Disputa pelo ${{ dragao: 'Dragão', arauto: 'Arauto', barao: 'Barão', anciao: 'Dragão Ancião' }[e.objetivo] || e.objetivo}`,
};
function atualizarFeed() {
  const P = E.partida; if (E.ultFeed >= P.eventos.length) return;
  const feed = document.getElementById('feed');
  for (let i = E.ultFeed; i < P.eventos.length; i++) {
    const e = P.eventos[i];
    if (!E.turbo) E.anuncios?.evento(e, P);
    const f = TEXTOS[e.tipo]; if (!f) continue;
    const div = document.createElement('div'); div.className = e.equipe === 'azul' ? 'a' : e.equipe === 'vermelho' ? 'v' : '';
    div.innerHTML = `<time>${tempoTexto(e.t)}</time>${f(e, P)}`; feed.prepend(div);
    while (feed.children.length > 40) feed.lastChild.remove();
  }
  E.ultFeed = P.eventos.length;
}

// ------------------------------------------------------------------ resultado
const ORDEM_POS = { top: 0, selva: 1, meio: 2, atirador: 3, suporte: 4 };
const NOME_POS = { top: 'Topo', selva: 'Selva', meio: 'Meio', atirador: 'Atirador', suporte: 'Suporte' };
function mostrarResultado() {
  const P = E.partida; const r = P.resultadoFinal; E.fimMostrado = true;
  const nome = (eq) => (eq === 'azul' ? E.config.nomeAzul || 'Equipe Azul' : E.config.nomeVermelho || 'Equipe Vermelha');
  const min = Math.max(1, r.duracao / 60);
  const maxDano = Math.max(1, ...r.jogadores.map((j) => j.dano)); const maxSofrido = Math.max(1, ...r.jogadores.map((j) => j.danoSofrido));
  const topDano = r.jogadores.reduce((m, j) => (j.dano > m.dano ? j : m), r.jogadores[0]);
  const kda = (j) => (j.mortes === 0 ? (j.abates + j.assistencias > 0 ? 'Perfeito' : '0.0 KDA') : `${((j.abates + j.assistencias) / j.mortes).toFixed(1)} KDA`);
  const slot = (id) => { const it = id ? ITENS[id] : null; if (!it) return '<span class="pt-item rs-it vazio"></span>'; const u = itemUrl(it.ddragon); return `<span class="pt-item rs-it" title="${esc(it.nome)}"><span class="ini">${esc(it.nome[0])}</span>${u ? `<img src="${u}" alt="${esc(it.nome)}" width="32" height="32" loading="lazy">` : ''}</span>`; };
  const itens = (j) => { const l = [...j.itens]; while (l.length < 6) l.push(null); return l.slice(0, 6).map(slot).join('') + '<span class="pt-item rs-it ward" title="Totem de Vigia"><img src="img/ward.webp" alt="" width="32" height="32"></span>'; };
  const linha = (j) => {
    const mvp = r.mvp && r.mvp.id === j.id && r.mvp.campeao === j.campeao;
    return `<div class="rs-l ${j.equipe === 'azul' ? 'a' : 'v'}${mvp ? ' mvp' : ''}">
      <div class="rs-nv"><b>${j.nivel}</b></div>
      <div class="rs-ch">${campIcone(j.campeao, 46)}</div>
      <div class="rs-nm"><b>${nick(j.equipe, j.nome)}</b><small>${esc(j.campeao)} · ${esc(NOME_POS[j.pos] || j.pos)}</small></div>
      <div class="rs-its">${itens(j)}</div>
      <div class="rs-kda"><b>${j.abates} / ${j.mortes} / ${j.assistencias}</b><small>${kda(j)}</small></div>
      <div class="rs-dano"><span class="dc"><b>${j === topDano ? '<i class="st">★</i>' : ''}${fmt(j.dano)}</b><u><i style="width:${Math.round(j.dano / maxDano * 100)}%"></i></u></span><span class="ds"><b>${fmt(j.danoSofrido)}</b><u><i style="width:${Math.round(j.danoSofrido / maxSofrido * 100)}%"></i></u></span></div>
      <div class="rs-ouro"><span class="oc"><b>${fmt(j.ouro)}</b><small>${fmt(j.ouro / min)} / min</small></span><span class="cs"><b>${fmt(j.cs)}</b><small>${(j.cs / min).toFixed(1)} / min</small></span></div>
    </div>`;
  };
  const bloco = (eq, rotulo) => {
    const t = r.equipes[eq]; const js = r.jogadores.filter((j) => j.equipe === eq).sort((x, y) => (ORDEM_POS[x.pos] ?? 9) - (ORDEM_POS[y.pos] ?? 9));
    const venceu = r.vencedor === eq; const torresDerrubadas = r.equipes[eq === 'azul' ? 'vermelho' : 'azul'].torresPerdidas; const inibDerrubados = r.equipes[eq === 'azul' ? 'vermelho' : 'azul'].inibidoresPerdidos;
    return `<section class="rs-eq ${eq === 'azul' ? 'a' : 'v'}">
      <header><h3>${rotulo}</h3><span class="rs-nome">${esc(nome(eq))}</span><em class="rs-vd ${venceu ? 'v' : 'd'}">${r.vencedor ? (venceu ? 'Vitória' : 'Derrota') : ''}</em>
        <span class="rs-tot"><i class="ic">⚔</i>${t.abates} / ${t.mortes} / ${js.reduce((s, j) => s + j.assistencias, 0)}</span>
        <span class="rs-tot"><i class="ic-o"></i>${fmt(t.ouro)}</span>
        <span class="rs-obj" title="Torres derrubadas"><img src="img/torre_${eq === 'azul' ? 'azul' : 'vermelho'}.webp" alt="">${torresDerrubadas}</span>
        <span class="rs-obj" title="Inibidores derrubados"><img src="img/inibidor_${eq === 'azul' ? 'azul' : 'vermelho'}.webp" alt="">${inibDerrubados}</span>
        <span class="rs-obj" title="Dragões"><img src="img/dragao.webp" alt="">${t.dragoes}</span>
        <span class="rs-obj" title="Arautos"><img src="img/arauto.webp" alt="">${t.arautos}</span>
        <span class="rs-obj" title="Barões"><img src="img/barao.webp" alt="">${t.baroes}</span></header>
      ${js.map(linha).join('')}</section>`;
  };
  const titulo = r.vencedor ? `${esc(nome(r.vencedor))} venceu` : 'Partida interrompida';
  const d = document.createElement('div'); d.className = 'pt-fundo';
  d.innerHTML = `<div class="pt-modal rs" data-dano="causado" data-ouro="ouro"><div class="rs-topo"><h2 class="${r.vencedor === 'azul' ? 'a' : 'v'}">${titulo}</h2>
    <p>Duração <b>${tempoTexto(r.duracao)}</b> · ${esc(r.motivo || '')}${r.mvp ? ` · destaque: <b class="ouro">${esc(r.mvp.campeao)}</b> (${esc(r.mvp.nome)})` : ''}<span class="rs-sem">semente ${r.semente}</span></p></div>
    <div class="rs-cab"><span></span><span></span><span></span><span class="c">Itens</span><span class="c">K / D / A</span>
      <span class="c rs-alt"><button data-alt="dano" aria-label="Alternar dano">‹</button><span class="dc">Dano causado</span><span class="ds">Dano sofrido</span><button data-alt="dano" aria-label="Alternar dano">›</button></span>
      <span class="c rs-alt"><button data-alt="ouro" aria-label="Alternar ouro e CS">‹</button><span class="oc">Ouro</span><span class="cs">Farm (CS)</span><button data-alt="ouro" aria-label="Alternar ouro e CS">›</button></span></div>
    ${bloco('azul', 'TIME AZUL')}${bloco('vermelho', 'TIME VERMELHO')}
    <div id="res-acoes" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="pt-btn" id="r-fechar">Fechar</button><button class="pt-btn ouro" id="r-novo">Jogar de novo</button></div></div>`;
  document.body.appendChild(d);
  d.querySelectorAll('[data-alt]').forEach((b) => { b.onclick = () => { const m = d.querySelector('.rs'); if (b.dataset.alt === 'dano') m.dataset.dano = m.dataset.dano === 'causado' ? 'sofrido' : 'causado'; else m.dataset.ouro = m.dataset.ouro === 'ouro' ? 'cs' : 'ouro'; }; });
  d.querySelector('#r-fechar').onclick = () => d.remove();
  if (E.config.modo !== 'teste') d.querySelector('#r-novo').remove(); else d.querySelector('#r-novo').onclick = () => { d.remove(); reiniciar(); };
  if (E.config.aoFim) E.config.aoFim(r, d.querySelector('#res-acoes'), d);
  const play = document.getElementById('b-play'); if (play) { play.textContent = '▶ Iniciar'; play.disabled = true; }
}

// ------------------------------------------------------------------ laço principal
let ultTs = 0;
function quadro(ts) {
  const dt = ultTs ? (ts - ultTs) / 1000 : 0; ultTs = ts;
  try {
    E.relogio.atualizar(dt); E.anuncios?.definirVelocidade(E.relogio.velocidade);
    E.rend.interp.a = E.relogio.alfa; E.rend.interp.prev = E.relogio.prev;
    const depur = Object.values(E.camadas).some(Boolean) ? (ctx) => desenharDepuracao(ctx, E.rend.vista(), E.camadas, E.partida.terreno, E.partida) : null;
    E.rend.desenhar(E.partida, depur);
    atualizarPlacar(); atualizarFeed();
    if (E.partida.fim && !E.fimMostrado) mostrarResultado();
  } catch (e) { console.error(e); }
  requestAnimationFrame(quadro);
}

(async function iniciar() {
  await platform.init();
  const user = platform.getUser();
  const souAdmin = await platform.isAdmin();
  const convidado = souAdmin || await platform.podeJogosEmTeste();
  const teste = consulta.get('teste') === '1' && (LOCAL || souAdmin); // sala de testes: local ou administrador (não registra nada)
  const aberto = !gameById('tecnico')?.soAdmin;
  if (!teste && !user) return msg('Entre na sua conta para ver a partida.');
  if (!teste && !convidado && !aberto) return msg('Esta área ainda está em desenvolvimento e só administradores têm acesso.');
  await Promise.all([carregarCatalogo(), prepararImagens(), carregarImagemMapa().then((i) => { E.imagem = i; })]);
  const id = Number(consulta.get('id') || 0);
  const aid = Number(consulta.get('amistoso') || 0);
  let comDraft = false;
  if (aid) {
    E.config = await configAmistoso(aid);
    const dr = await abrirDraft({ catalogo: E.catalogo, azul: E.config.azul, vermelho: E.config.vermelho, semente: E.config.semente, nomeAzul: E.config.nomeAzul, nomeVermelho: E.config.nomeVermelho });
    E.config.veloc = 4; // depois do draft a simulação já começa sozinha, em 4x
    E.config.azul = dr.azul; E.config.vermelho = dr.vermelho; E.config.bans = dr.bans;
    E.config.aviso += ` ${t('Bans: {x1} | {x2}.', { x1: dr.bans.azul.join(', '), x2: dr.bans.vermelho.join(', ') })}`;
  } else if (id) {
    E.config = await configOficial(id);
    // picks e bans de cada mapa da partida oficial. Quem joga é o lado da sua organização (pode ser o vermelho): ele escolhe na ordem certa.
    // O melhor colocado escolhe o lado (azul = primeiro pick) na própria tela de picks e bans, antes do primeiro ban; no mapa seguinte, o adversário.
    const meuId = (await api.meu().catch(() => null))?.org?.id;
    let C = E.config;
    const ld = C.lado;
    // minha equipe fica sempre à esquerda da tela de draft; sem ser técnico de nenhuma das duas (admin), vale quem escolhe o lado
    const minhaOrg = meuId && (C.idAzul === meuId || C.idVermelho === meuId) ? meuId : (ld.voceEscolhe ? ld.escolhe : (ld.escolhe === C.idAzul ? C.idVermelho : C.idAzul));
    const minha = C.idAzul === minhaOrg;
    const aguardar = async () => { for (;;) { await new Promise((ok) => setTimeout(ok, 3000)); const novo = await configOficial(id); if (novo.lado.definido) return novo.idAzul === minhaOrg ? 'azul' : 'vermelho'; } };
    const dr = await abrirDraft({ catalogo: E.catalogo, azul: minha ? C.azul : C.vermelho, vermelho: minha ? C.vermelho : C.azul, semente: C.semente,
      nomeAzul: minha ? C.nomeAzul : C.nomeVermelho, nomeVermelho: minha ? C.nomeVermelho : C.nomeAzul,
      invertida: ld.definido && C.idVermelho === minhaOrg,
      lado: ld.definido ? null : { escolhe: ld.escolhe === minhaOrg ? 'eu' : 'adv', escolher: (l) => api.gameplayEscolherLado(id, l), aguardar } });
    if (!ld.definido) E.config = C = await configOficial(id); // agora com o lado definido pelo servidor
    const euVerm = C.idVermelho === minhaOrg;
    C.meuLado = euVerm ? 'vermelho' : 'azul'; // o fog mostra a visão do time do técnico
    C.veloc = 4; // depois do draft a simulação já começa sozinha, em 4x
    C.azul = euVerm ? dr.vermelho : dr.azul; C.vermelho = euVerm ? dr.azul : dr.vermelho;
    C.bans = euVerm ? { azul: dr.bans.vermelho, vermelho: dr.bans.azul } : dr.bans;
    C.aviso += ` ${t('Bans: {x1} | {x2}.', { x1: C.bans.azul.join(', '), x2: C.bans.vermelho.join(', ') })}`;
    comDraft = true;
  }
  else { E.config = configTeste(); E.config.aviso = 'Sala de testes da simulação: times sintéticos com o Poder escolhido. Só administradores veem esta área.'; }
  E.partida = novaPartida(E.config);
  E.relogio = new Relogio(E.partida, { velocidade: E.config.veloc });
  montar();
  if (aid || comDraft) { E.relogio.retomar(); marcarVelocidade(); }
  atualizarPlacar(true);
  window.__partida = E; // facilita a depuração no console
  window.addEventListener('resize', encaixar); document.addEventListener('fullscreenchange', () => { encaixar(); const f = document.getElementById('b-tela'); if (f) f.textContent = document.fullscreenElement ? '⤢ Sair da tela cheia' : '⛶ Tela cheia'; });
  requestAnimationFrame(quadro);
})().catch((e) => { console.error(e); msg('Não foi possível abrir a partida: ' + (e.message || e)); });
