// Tela da partida: monta a simulação, o relógio, o canvas, o placar e os controles. A tela apenas lê o estado do motor.
import * as platform from '../../../../shared/platform.js';
import { mountSiteBar } from '../../../../shared/account.js';
import { gameById } from '../../../../shared/config.js';
import { Partida } from '../motor/partida.js';
import { Relogio } from '../motor/relogio.js';
import { Renderizador } from '../render/canvas.js';
import { CAMADAS, desenharDepuracao } from '../render/depuracao.js';
import { MAPA } from '../config/mapa.js';
import { elencoTeste } from '../dados/elencos-teste.js';
import { prepararImagens, campIcone } from '../../js/campeoes-img.js';
import { tempoTexto } from '../motor/eventos.js';
import { REGRAS } from '../config/regras.js';
import { abrirDraft } from './draft-ui.js?v=10';

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
    modo: 'oficial', id, mapa: el.mapa, semente: el.semente, versao: el.versao, azul: jogs(el.azul.jogadores), vermelho: jogs(el.vermelho.jogadores),
    nomeAzul: el.azul.org.nome, nomeVermelho: el.vermelho.org.nome, siglaAzul: el.azul.org.sigla, siglaVermelho: el.vermelho.org.sigla, veloc: REGRAS.velocidadePadrao,
    aviso: `Partida oficial · mapa ${el.mapa} de uma série melhor de ${f} · ${el.azul.org.nome} (azul) × ${el.vermelho.org.nome} (vermelho). O resultado não pode ser refeito.`,
    aoFim: (r, acoes) => botaoRegistrar(el, r, acoes),
  };
}
async function configAmistoso(id) {
  const el = await api.amistosoElencos(id);
  const jogs = (l) => l.map((j) => ({ id: j.id, nome: j.nome, pos: j.pos, atributos: j.atributos, poder: j.poder, eficiencia: j.eficiencia, favoritos: j.favoritos }));
  return {
    modo: 'amistoso', id, mapa: 1, semente: el.semente, versao: el.versao, azul: jogs(el.azul.jogadores), vermelho: jogs(el.vermelho.jogadores),
    nomeAzul: el.azul.org.nome, nomeVermelho: el.vermelho.org.nome, siglaAzul: el.azul.org.sigla, siglaVermelho: el.vermelho.org.sigla, veloc: REGRAS.velocidadePadrao,
    aviso: `Amistoso (scrim) · ${el.azul.org.nome} (azul) × ${el.vermelho.org.nome} (vermelho). Não vale pontos de campeonato.`,
    aoFim: (r, acoes) => botaoRegistrarAmistoso(id, r, acoes),
  };
}
function botaoRegistrarAmistoso(id, r, acoes) {
  if (!r.vencedor) { acoes.insertAdjacentHTML('afterbegin', '<p style="color:#fca5a5;flex-basis:100%">A partida foi interrompida pela proteção técnica e não pode ser registrada.</p>'); return; }
  const b = document.createElement('button'); b.className = 'pt-btn ouro'; b.textContent = 'Encerrar amistoso'; acoes.prepend(b);
  const aviso = document.createElement('p'); aviso.style.cssText = 'flex-basis:100%;margin:0;color:#8fa3bf;font-size:13px'; acoes.append(aviso);
  b.onclick = async () => {
    b.disabled = true; aviso.textContent = 'Registrando…';
    const { eventos, ...enviar } = r;
    try {
      const rr = await api.amistosoRegistrar(id, { ...enviar, bans: E.config.bans });
      aviso.innerHTML = `${rr.exp ? `+${rr.exp_ganho} EXP para os seus titulares. ` : 'Sem EXP neste amistoso (só os primeiros do dia contam). '}<a style="color:#f5cf5a" href="../">Voltar ao simulador</a>`;
    } catch (e) { aviso.textContent = e.message || 'Não foi possível registrar o amistoso.'; b.disabled = false; }
  };
}
function botaoRegistrar(el, r, acoes) {
  const aqui = E.config;
  if (!r.vencedor) { acoes.insertAdjacentHTML('afterbegin', '<p style="color:#fca5a5;flex-basis:100%">A partida foi interrompida pela proteção técnica e não pode ser registrada.</p>'); return; }
  const b = document.createElement('button'); b.className = 'pt-btn ouro'; b.textContent = 'Registrar resultado'; acoes.prepend(b);
  const aviso = document.createElement('p'); aviso.style.cssText = 'flex-basis:100%;margin:0;color:#8fa3bf;font-size:13px'; acoes.append(aviso);
  b.onclick = async () => {
    b.disabled = true; aviso.textContent = 'Registrando…';
    const { eventos, ...enviar } = r;
    try {
      const rr = await api.gameplayRegistrar(aqui.id, aqui.mapa, enviar);
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
      <aside class="pt-lado">
        <div class="pt-card"><h3>Placar <span id="vel"></span></h3><table class="pt-placar" id="placar"></table></div>
        <div class="pt-card"><h3>Foco</h3><div class="pt-foco" id="foco">Clique em um campeão no mapa ou no placar.</div></div>
        <div class="pt-card"><h3>Eventos</h3><div class="pt-feed" id="feed"></div></div>
      </aside>
    </div>
    <div class="pt-controles" id="ctl"></div>
    <div class="pt-depur" id="depur"></div>
    ${E.config.modo === 'teste' ? `<div class="pt-teste"><label>Poder azul <input type="number" id="pa" min="1" max="100" value="${E.config.pa}"></label><label>Poder vermelho <input type="number" id="pv" min="1" max="100" value="${E.config.pv}"></label><label>Semente <input type="number" id="seed" value="${E.config.semente}"></label><span>A mesma semente reproduz a mesma partida.</span></div>` : ''}`;
  E.rend = new Renderizador(document.getElementById('cv'), E.imagem);
  const mapa = document.getElementById('mapa');
  E.rend.ajustar(Math.floor(mapa.clientWidth));
  document.getElementById('cv').addEventListener('click', (e) => {
    const r = e.target.getBoundingClientRect(); const u = E.rend.campeaoEm(E.partida, e.clientX - r.left, e.clientY - r.top);
    selecionar(u ? u.id : null);
  });
  // controles
  const ctl = document.getElementById('ctl');
  ctl.innerHTML = `<button class="pt-btn ouro" id="b-play">▶ Iniciar</button><span class="pt-sep"></span>${REGRAS.velocidades.map((v) => `<button class="pt-btn" data-v="${v}">${v}x</button>`).join('')}<span class="pt-sep"></span><button class="pt-btn" id="b-fim">⏭ Ir até o fim</button>${E.config.modo === 'oficial' ? '' : '<button class="pt-btn" id="b-reiniciar">↻ Reiniciar</button>'}`;
  ctl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'b-play') { if (E.partida.fim) return; const rodando = E.relogio.alternar(); b.textContent = rodando ? '⏸ Pausar' : '▶ Retomar'; }
    else if (b.dataset.v) { E.relogio.definirVelocidade(Number(b.dataset.v)); marcarVelocidade(); }
    else if (b.id === 'b-reiniciar') { if (E.config.modo === 'teste') reiniciar(); }
    else if (b.id === 'b-fim') irAteOFim();
  });
  const dep = document.getElementById('depur');
  dep.innerHTML = '<span>Depuração:</span>' + CAMADAS.map(([k, n]) => `<label><input type="checkbox" data-k="${k}"/>${n}</label>`).join('');
  dep.addEventListener('change', (e) => { E.camadas[e.target.dataset.k] = e.target.checked; });
  document.getElementById('placar').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) selecionar(Number(tr.dataset.id)); });
  marcarVelocidade();
}
function marcarVelocidade() {
  document.querySelectorAll('#ctl [data-v]').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === E.relogio.velocidade));
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
  E.relogio.trocarPartida(E.partida);
  E.fimMostrado = false; E.turbo = false; E.selecionado = null; E.rend.selecionado = null; E.ultFeed = 0;
  document.getElementById('b-play').textContent = '▶ Iniciar';
  document.getElementById('b-play').disabled = false;
  document.querySelectorAll('.pt-fundo').forEach((x) => x.remove());
  atualizarPlacar(true);
}
// Simula o restante da partida em blocos para não travar a tela (e sem pular nada: são os mesmos passos fixos).
function irAteOFim() {
  if (E.partida.fim || E.turbo) return;
  E.turbo = true; E.relogio.pausar();
  const botao = document.getElementById('b-fim'); botao.disabled = true;
  const bloco = () => {
    const t0 = performance.now();
    while (!E.partida.fim && performance.now() - t0 < 25) E.partida.step();
    botao.textContent = `⏭ ${tempoTexto(E.partida.t)}…`;
    if (!E.partida.fim) setTimeout(bloco, 0); else { E.turbo = false; botao.disabled = false; botao.textContent = '⏭ Ir até o fim'; }
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
  const O = P.objetivosEstado; const obj = [];
  const d = O.dragao; obj.push(d.vivo && !d.vivo.morto ? `<span class="on">Dragão vivo · ${Math.round(d.vivo.hp)}</span>` : `<span>Dragão em ${Math.max(0, Math.ceil(d.proximo - P.t))}s</span>`);
  if (!O.arauto.aposentado) obj.push(O.arauto.vivo && !O.arauto.vivo.morto ? `<span class="on">Arauto vivo</span>` : `<span>Arauto em ${Math.max(0, Math.ceil(O.arauto.proximo - P.t))}s</span>`);
  const b = O.barao; obj.push(b.vivo && !b.vivo.morto ? `<span class="on">Barão vivo · ${Math.round(b.vivo.hp)}</span>` : `<span>Barão em ${Math.max(0, Math.ceil(b.proximo - P.t))}s</span>`);
  document.getElementById('obj').innerHTML = obj.join('');
  // foco
  const f = E.selecionado ? P.mapaUnidades.get(E.selecionado) : null;
  const foco = document.getElementById('foco');
  if (f) {
    const hab = f.habilidades.map((h) => { const r = f.rank[h.tecla.toLowerCase()]; const cd = Math.max(0, h.proximo - P.t); return `${h.tecla}${r ? '' : '·'}${cd > 0 ? ` ${cd.toFixed(0)}s` : ' ✓'}`; }).join(' · ');
    foco.innerHTML = `<b>${esc(f.campeao)}</b> (${esc(f.nome)}) · nível ${f.nivel}<br>Estado: <b>${esc(f.estado)}</b> ${f.motivo ? `(${esc(f.motivo)})` : ''}<br>Vida ${Math.round(f.hp)}/${f.hpMax} · Mana ${Math.round(f.mana)}<br>AD ${Math.round(f.ad)} · AP ${Math.round(f.ap)} · Arm ${Math.round(f.armadura)} · RM ${Math.round(f.resist)}<br>Habilidades: ${hab}<br>Itens: ${f.itens.length ? f.itens.join(', ') : '—'}`;
  } else foco.textContent = 'Clique em um campeão no mapa ou no placar.';
}
const TEXTOS = {
  abate: (e, P) => { const v = P.mapaUnidades.get(e.vitima); const a = e.abatedor ? P.mapaUnidades.get(e.abatedor) : null; return `${a ? esc(a.campeao) : 'Estrutura/monstro'} eliminou ${v ? esc(v.campeao) : '?'}`; },
  torre_destruida: (e) => `Torre derrubada (${e.rota || 'base'})`, inibidor_destruido: (e) => `Inibidor derrubado (${e.rota})`,
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
    const e = P.eventos[i]; const f = TEXTOS[e.tipo]; if (!f) continue;
    const div = document.createElement('div'); div.className = e.equipe === 'azul' ? 'a' : e.equipe === 'vermelho' ? 'v' : '';
    div.innerHTML = `<time>${tempoTexto(e.t)}</time>${f(e, P)}`; feed.prepend(div);
    while (feed.children.length > 40) feed.lastChild.remove();
  }
  E.ultFeed = P.eventos.length;
}

// ------------------------------------------------------------------ resultado
function mostrarResultado() {
  const P = E.partida; const r = P.resultadoFinal; E.fimMostrado = true;
  const nome = (eq) => (eq === 'azul' ? E.config.nomeAzul || 'Equipe Azul' : E.config.nomeVermelho || 'Equipe Vermelha');
  const titulo = r.vencedor ? `${esc(nome(r.vencedor))} venceu` : 'Partida interrompida';
  const linhas = r.jogadores.map((j) => `<tr class="${j.equipe === 'azul' ? 'a' : 'v'}"><td>${esc(j.campeao)} <small>${nick(j.equipe, j.nome)}</small></td><td>${esc(j.pos)}</td><td class="n">${j.nivel}</td><td class="n">${j.abates}/${j.mortes}/${j.assistencias}</td><td class="n">${j.cs}</td><td class="n">${fmt(j.dano)}</td><td class="n">${fmt(j.ouro)}</td><td class="n">${j.ganks}</td></tr>`).join('');
  const eqa = r.equipes.azul, eqv = r.equipes.vermelho;
  const d = document.createElement('div'); d.className = 'pt-fundo';
  d.innerHTML = `<div class="pt-modal"><h2 class="${r.vencedor === 'azul' ? 'a' : 'v'}">${titulo}</h2>
    <p style="color:#8fa3bf;margin:4px 0 8px">Duração ${tempoTexto(r.duracao)} · motivo: ${esc(r.motivo || '')} · semente ${r.semente}${r.mvp ? ` · destaque: <b style="color:#f5cf5a">${esc(r.mvp.campeao)}</b> (${esc(r.mvp.nome)})` : ''}</p>
    <table class="pt-res"><tr><th>Equipe</th><th class="n">Abates</th><th class="n">Ouro</th><th class="n">Torres perdidas</th><th class="n">Inibidores perdidos</th><th class="n">Dragões</th><th class="n">Barões</th></tr>
      <tr class="a"><td>${esc(nome('azul'))}</td><td class="n">${eqa.abates}</td><td class="n">${fmt(eqa.ouro)}</td><td class="n">${eqa.torresPerdidas}</td><td class="n">${eqa.inibidoresPerdidos}</td><td class="n">${eqa.dragoes}</td><td class="n">${eqa.baroes}</td></tr>
      <tr class="v"><td>${esc(nome('vermelho'))}</td><td class="n">${eqv.abates}</td><td class="n">${fmt(eqv.ouro)}</td><td class="n">${eqv.torresPerdidas}</td><td class="n">${eqv.inibidoresPerdidos}</td><td class="n">${eqv.dragoes}</td><td class="n">${eqv.baroes}</td></tr></table>
    <table class="pt-res"><tr><th>Campeão</th><th>Posição</th><th class="n">Nv</th><th class="n">K/D/A</th><th class="n">CS</th><th class="n">Dano</th><th class="n">Ouro</th><th class="n">Ganks</th></tr>${linhas}</table>
    <div id="res-acoes" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="pt-btn" id="r-fechar">Fechar</button><button class="pt-btn ouro" id="r-novo">Jogar de novo</button></div></div>`;
  document.body.appendChild(d);
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
    E.relogio.atualizar(dt);
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
  if (aid) {
    E.config = await configAmistoso(aid);
    const dr = await abrirDraft({ catalogo: E.catalogo, azul: E.config.azul, vermelho: E.config.vermelho, semente: E.config.semente, nomeAzul: E.config.nomeAzul, nomeVermelho: E.config.nomeVermelho });
    E.config.veloc = 4; // depois do draft a simulação já começa sozinha, em 4x
    E.config.azul = dr.azul; E.config.vermelho = dr.vermelho; E.config.bans = dr.bans;
    E.config.aviso += ` Bans: ${dr.bans.azul.join(', ')} | ${dr.bans.vermelho.join(', ')}.`;
  } else if (id) E.config = await configOficial(id);
  else { E.config = configTeste(); E.config.aviso = 'Sala de testes da simulação: times sintéticos com o Poder escolhido. Só administradores veem esta área.'; }
  E.partida = novaPartida(E.config);
  E.relogio = new Relogio(E.partida, { velocidade: E.config.veloc });
  montar();
  if (aid) { E.relogio.retomar(); const bp = document.getElementById('b-play'); if (bp) bp.textContent = '⏸ Pausar'; }
  atualizarPlacar(true);
  window.__partida = E; // facilita a depuração no console
  window.addEventListener('resize', () => { E.rend.ajustar(Math.floor(document.getElementById('mapa').clientWidth)); });
  requestAnimationFrame(quadro);
})().catch((e) => { console.error(e); msg('Não foi possível abrir a partida: ' + (e.message || e)); });
