// Simulador de Técnico (nome provisório): o usuário funda uma organização, monta o elenco, contrata no mercado oficial
// (créditos) ou de outros usuários (RC), disputa as ligas semanais e acumula troféus e Rank.
// O servidor decide tudo (saldos, propriedade, partidas, premiações); esta tela só mostra e pede ações.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import {
  VAGAS, NOME_VAGA, ATRIBUTOS, ELENCO_MAX, CONTRATO_MIN, CONTRATO_MAX, PRECO_RC, TAXA_MERCADO_PCT,
  fmt, esc, corPoder, taxaDe, salarioDe,
} from './regras.js';
import { ESCUDOS, escudoSvg, escudoOrg, retratoSvg, iconeVaga } from './art.js';

const GAME_ID = 'tecnico';
const app = document.getElementById('app');
const { tecnico: api } = platform;
const FECHADO = Boolean(gameById(GAME_ID)?.soAdmin);

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });
mountSiteFooter(document.getElementById('site-footer'));

// ------------------------------------------------------------------ estado
const S = {
  aba: 'visao',
  meu: null,
  painel: null,
  camp: null,
  ligaSel: null,
  hist: null,
  mercado: { aba: 'oficial', f: { ordem: 'poder' }, oficial: null, usuarios: null, meus: null },
  modal: null,
  ocupado: false,
  form: { nome: '', sigla: '', escudo: 'escudo-1', cor1: '#1b3a6b', cor2: '#d9a82b', estilo: 'classico' },
  erro: '',
};

const novaChave = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`);
const nomeLiga = () => S.meu?.nomes || {};

let toastTimer = null;
function toast(msg, erro = false) {
  document.querySelector('.tc-toast')?.remove();
  const el = document.createElement('div');
  el.className = `tc-toast${erro ? ' erro' : ''}`;
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 4200);
}

// Executa uma ação do servidor com proteção contra cliques repetidos e mensagens de erro claras.
async function agir(fn, { ok, recarregar = true } = {}) {
  if (S.ocupado) return null;
  S.ocupado = true;
  document.body.style.cursor = 'progress';
  try {
    const r = await fn();
    if (ok) toast(typeof ok === 'function' ? ok(r) : ok);
    if (recarregar) await atualizar();
    return r ?? true;
  } catch (e) {
    toast(e.message || 'Não foi possível concluir.', true);
    return null;
  } finally {
    S.ocupado = false;
    document.body.style.cursor = '';
    render();
  }
}

async function atualizar() {
  S.meu = await api.meu();
  if (S.meu.org) S.painel = await api.painel();
  S.camp = null; S.hist = null;
  S.mercado.oficial = null; S.mercado.usuarios = null; S.mercado.meus = null;
  await carregarAba();
}

// ------------------------------------------------------------------ carga por aba
async function carregarAba() {
  if (!S.meu?.org) return;
  try {
    if ((S.aba === 'camp' || S.aba === 'class') && !S.camp) S.camp = await api.campeonatos();
    if (S.aba === 'hist' && !S.hist) S.hist = await api.historico();
    if (S.aba === 'contratar') await carregarMercado();
  } catch (e) { toast(e.message, true); }
}
async function carregarMercado() {
  const m = S.mercado;
  if (m.aba === 'oficial' && !m.oficial) m.oficial = await api.mercadoOficial(m.f);
  if (m.aba === 'usuarios' && !m.usuarios) { [m.usuarios, m.meus] = await Promise.all([api.mercadoUsuarios(m.f), api.meusAnuncios()]); }
}

// ------------------------------------------------------------------ peças visuais
const semanasRestantes = (j) => (j.contrato_fim == null ? null : j.contrato_fim - (S.meu?.semana ?? 0));

function cartao(j, { tit = false, extra = '', acao = 'ficha', dados = '' } = {}) {
  const c = corPoder(j.poder);
  const resta = semanasRestantes(j);
  return `<button type="button" class="tc-jog" data-act="${acao}" data-id="${j.id}" ${dados} style="--c:${c}">
    <div class="foto">${retratoSvg(j, 160)}<span class="vg">${iconeVaga(j.pos)}</span><span class="pw">${j.poder}</span></div>
    <div class="inf">
      <span class="nm">${esc(j.nome)}</span><span class="pos">${esc(NOME_VAGA[j.pos])}</span>
      <div class="ln"><span>${j.idade} anos</span><span>Fama <b>${j.fama}</b></span></div>
      ${j.potencial != null ? `<div class="ln"><span>Potencial</span><b>${j.potencial}</b></div>` : ''}
      ${resta != null && j.org_id ? `<div class="ln"><span>Contrato</span><b>${resta <= 0 ? 'vence já' : `${resta} sem.`}</b></div>` : ''}
      ${extra}
    </div>${tit ? `<span class="tit">TITULAR · ${esc(NOME_VAGA[j.slot])}</span>` : ''}</button>`;
}

function barras(j) {
  return `<div class="tc-attrs">${ATRIBUTOS.map((a) => `<div class="tc-attr"><span>${a.nome}</span><div class="tc-barra"><i style="width:${j[a.id]}%"></i></div><b>${j[a.id]}</b></div>`).join('')}</div>`;
}

const IMG = (n, c = '') => `<img class="ic ${c}" src="img/${n}.webp" alt="" width="28" height="28" loading="lazy" />`;
function topo() {
  const o = S.meu.org;
  const novos = (S.meu.avisos || []).filter((a) => !a.lido).length;
  const sem = ((S.meu.semana % 4) + 4) % 4 + 1;
  return `<header class="tc-topo">
    <div class="tc-org"><span class="logo">${escudoOrg(o, 54)}</span><div><div class="nome">${esc(o.nome)}</div><div class="sub">${o.divisao === 'principal' ? esc(nomeLiga().principal) : esc(nomeLiga().acesso)}</div><div class="xp"><i style="width:${Math.min(100, S.meu.poder)}%"></i><span>Poder ${S.meu.poder}</span></div></div></div>
    <div class="tc-moedas">
      <div class="tc-moeda rc"><img src="img/moeda.webp" alt="" width="34" height="34" /><div><b>${fmt(S.meu.rc)}</b><small>Rift Coins</small></div></div>
      <div class="tc-moeda cred"><img src="img/gema.webp" alt="" width="26" height="34" /><div><b>${fmt(o.creditos)}</b><small>Créditos de equipe</small></div></div>
    </div>
    <div class="tc-atalhos">
      <button type="button" data-act="aba" data-aba="visao">${IMG('i-sino')}${novos ? `<em>${Math.min(novos, 9)}</em>` : ''}<span>Avisos</span></button>
      <button type="button" data-act="aba" data-aba="hist">${IMG('i-msg')}<span>Histórico</span></button>
      <button type="button" data-act="aba" data-aba="camp">${IMG('i-agenda')}<span>Calendário</span></button>
      <button type="button" data-act="aba" data-aba="pers">${IMG('i-conf')}<span>Ajustes</span></button>
    </div>
    <div class="tc-usuario"><span class="av">${escudoOrg(o, 38)}</span><div><b>${esc(platform.getUser()?.username || 'Técnico')}</b><small>Semana ${sem} · Poder ${S.meu.poder}</small></div></div></header>`;
}

const ABAS = [
  ['visao', 'Início', 'i-home'], ['elenco', 'Meu elenco', 'i-time'], ['contratar', 'Mercado', 'i-mercado'],
  ['camp', 'Campeonatos', 'i-trofeu'], ['class', 'Classificação', 'i-stats'], ['hist', 'Histórico', 'i-financas'], ['pers', 'Personalização', 'i-engrenagem'],
];
function nav() {
  const novos = (S.meu.avisos || []).filter((a) => !a.lido).length;
  const sem = ((S.meu.semana % 4) + 4) % 4 + 1;
  return `<nav class="tc-nav" aria-label="Seções">${ABAS.map(([id, nome, ic]) => `<button type="button" data-act="aba" data-aba="${id}" class="${S.aba === id ? 'on' : ''}">${IMG(ic)}<span>${nome}</span>${id === 'visao' && novos ? `<span class="n">${Math.min(novos, 9)}</span>` : ''}</button>`).join('')}
    <div class="tc-temp"><span class="tc-eyebrow">Temporada atual</span><b>Semana ${sem} de 4</b><small>${S.meu.org.divisao === 'principal' ? esc(nomeLiga().principal) : esc(nomeLiga().acesso)}</small></div></nav>`;
}

// ------------------------------------------------------------------ criar organização
function viewCriar() {
  const f = S.form;
  return `<div class="tc-criar">
    <p class="tc-eyebrow">◆ Simulador de técnico · em teste</p>
    <h1 style="font-family:'Bebas Neue',sans-serif;font-size:46px;margin:4px 0 6px">Crie a sua organização</h1>
    <p class="tc-mudo">Dê nome ao seu time, escolha a sigla, o escudo e as cores. Você recebe créditos e cinco jogadores de base para começar na ${esc(nomeLiga().acesso || 'divisão de acesso')}. A aparência não dá vantagem na competição.</p>
    <form class="tc-card tc-form" data-form="criar" novalidate style="margin-top:16px">
      <div class="duas">
        <label class="campo"><span>Nome do time</span><input class="tc-input" name="nome" maxlength="24" autocomplete="off" value="${esc(f.nome)}" placeholder="Ex.: Aurora Esports" /></label>
        <label class="campo"><span>Sigla (2 a 4)</span><input class="tc-input" name="sigla" maxlength="4" autocomplete="off" value="${esc(f.sigla)}" placeholder="AUR" style="text-transform:uppercase" /></label>
      </div>
      <div class="campo"><span>Escudo</span><div class="tc-escudos">${ESCUDOS.map((e) => `<button type="button" data-act="escudo" data-v="${e}" class="${f.escudo === e ? 'on' : ''}" aria-label="${e}">${escudoSvg(e, f.cor1, f.cor2, '', 54)}</button>`).join('')}</div></div>
      <div class="duas">
        <label class="campo"><span>Cor principal</span><input class="tc-cor" type="color" name="cor1" value="${f.cor1}" /></label>
        <label class="campo"><span>Cor secundária</span><input class="tc-cor" type="color" name="cor2" value="${f.cor2}" /></label>
      </div>
      <label class="campo"><span>Estilo visual</span><select class="tc-input" name="estilo">${[['classico', 'Clássico'], ['moderno', 'Moderno'], ['tecnologico', 'Tecnológico']].map(([v, n]) => `<option value="${v}" ${f.estilo === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="tc-previa">${escudoSvg(f.escudo, f.cor1, f.cor2, (f.sigla || 'SIG').toUpperCase(), 76)}<div><div style="font-family:'Bebas Neue',sans-serif;font-size:32px">${esc(f.nome || 'Nome do time')}</div><div class="tc-mudo tc-peq">Divisão de acesso · técnico ${esc(platform.getUser()?.username || '')}</div></div></div>
      ${S.erro ? `<p style="color:var(--ruim);margin:0" role="alert">${esc(S.erro)}</p>` : ''}
      <button type="submit" class="tc-btn ouro" ${S.ocupado ? 'disabled' : ''}>Criar organização</button>
    </form></div>`;
}

// ------------------------------------------------------------------ visão geral
function titulares() {
  const por = {};
  (S.meu.elenco || []).filter((j) => j.slot).forEach((j) => { por[j.slot] = j; });
  return por;
}
function viewVisao() {
  const m = S.meu; const p = S.painel || {};
  const tit = titulares();
  const liga = p.liga;
  const minha = liga?.tabela?.find((t) => t.org.id === m.org.id);
  const prox = p.proxima;
  return `
  <div class="tc-hero">
    <section class="tc-card tc-prox"><h3>${IMG('i-agenda')}Próxima partida</h3>${prox && prox.id ? vsCard(prox) : '<p class="tc-mudo" style="margin:0">Sem partidas agendadas. As próximas rodadas aparecem quando a semana começar.</p>'}
      ${minha ? `<p class="tc-peq tc-mudo" style="margin:10px 0 0;text-align:center">Posição na divisão: <b style="color:var(--ouro2)">${minha.pos}º</b> · ${minha.pontos} pts · ${minha.vitorias}V ${minha.derrotas}D</p>` : ''}</section>
    <section class="tc-card tc-eco"><h3>${IMG('i-bau')}Sua economia</h3>
      <div class="duo"><div class="bx ouro"><img src="img/moeda.webp" alt="" width="40" height="40" /><small>Rift Coins</small><b>${fmt(m.rc)}</b></div>
      <div class="bx azul"><img src="img/gema.webp" alt="" width="30" height="40" /><small>Créditos de equipe</small><b>${fmt(m.org.creditos)}</b></div></div>
      <p class="tc-mudo tc-peq" style="margin:10px 0 0;text-align:center">Salários: ${fmt(m.salarios_semana)} créditos por semana</p></section>
  </div>
  <section class="tc-card"><h3>Poder da equipe<span class="dir">Semana ${((m.semana % 4) + 4) % 4 + 1}</span></h3>
      <div class="tc-poder"><div class="grande">${m.poder}</div><div style="flex:1"><div class="tc-barra"><i style="width:${m.poder}%"></i></div>
        <p class="tc-mudo tc-peq" style="margin:8px 0 0">Média do Poder dos titulares na posição em que jogam, mais a sinergia (${m.org.sinergia}/100). ${m.completo ? '' : '<b style="color:#fbbf24">Faltam titulares.</b>'}</p></div></div></section>
  <section class="tc-card"><h3>Escalação titular<span class="dir">${fmt(m.salarios_semana)} créditos de salários por semana</span></h3>
    <div class="tc-escala">${VAGAS.map((v) => `<div class="vaga"><span class="rot">${NOME_VAGA[v]}</span>${tit[v] ? cartao(tit[v], { tit: false }) : `<div class="tc-vazio">Vaga livre<br><button type="button" class="tc-btn peq" data-act="aba" data-aba="elenco" style="margin-top:8px">Escalar</button></div>`}</div>`).join('')}</div></section>
  <div class="tc-grade2">
    <section class="tc-card"><h3>Classificação${liga ? ` · ${esc(liga.nome)}` : ''}</h3>${liga ? tabelaHtml(liga.tabela, m.org.id, true) : '<p class="tc-mudo">Sua equipe entra na liga da próxima semana. Enquanto isso, monte o elenco e use o mercado.</p>'}</section>
    <div style="display:flex;flex-direction:column;gap:16px">
      <section class="tc-card"><h3>Avisos</h3>${(m.avisos || []).length ? `<ul class="tc-avisos">${m.avisos.slice(0, 6).map((a) => `<li>${esc(a.texto)}</li>`).join('')}</ul>` : '<p class="tc-mudo" style="margin:0">Nada por aqui. Contratos próximos do fim e vendas aparecem nesta lista.</p>'}</section>
      <section class="tc-card"><h3>Finanças</h3>${financasHtml(p.financas)}</section>
      ${(p.trofeus || []).length ? `<section class="tc-card"><h3>Troféus</h3><ul class="tc-avisos">${p.trofeus.map((t) => `<li>🏆 ${esc(t.titulo)}</li>`).join('')}</ul></section>` : ''}
    </div>
  </div>
  ${(p.ultimos || []).length ? `<section class="tc-card"><h3>Últimos resultados</h3><div class="tc-lista">${p.ultimos.map((x) => partidaLinha(x)).join('')}</div></section>` : ''}`;
}

function financasHtml(f) {
  if (!f || !f.length) return '<p class="tc-mudo" style="margin:0">Sem movimentações ainda.</p>';
  const nomes = { inicial: 'Créditos iniciais', contratacao: 'Contratação', renovacao: 'Renovação', salarios: 'Salários da semana', premiacao: 'Premiação' };
  return `<table class="tc-tabela"><tbody>${f.map((x) => `<tr><td>${nomes[x.motivo] || esc(x.motivo)}</td><td class="n" style="color:${x.delta >= 0 ? 'var(--bom)' : 'var(--ruim)'}">${x.delta >= 0 ? '+' : '−'}${fmt(Math.abs(x.delta))}</td></tr>`).join('')}</tbody></table>`;
}

function tabelaHtml(tab, meuId, compacta = false) {
  return `<div class="tc-tabela-rolagem"><table class="tc-tabela"><thead><tr><th>#</th><th>Equipe</th>${compacta ? '' : '<th class="n">J</th>'}<th class="n">V</th><th class="n">D</th>${compacta ? '' : '<th class="n">Mapas</th><th class="n">Saldo</th>'}<th class="n">Pts</th>${compacta ? '' : '<th>Situação</th>'}</tr></thead><tbody>
    ${tab.map((t) => `<tr class="${t.org.id === meuId ? 'eu' : ''}"><td>${t.pos}</td><td><div class="org">${escudoOrg(t.org, 24)}<span>${esc(t.org.nome)}${t.org.usuario ? ' <span title="Técnico real">★</span>' : ''}</span></div></td>${compacta ? '' : `<td class="n">${t.partidas}</td>`}<td class="n">${t.vitorias}</td><td class="n">${t.derrotas}</td>${compacta ? '' : `<td class="n">${t.mapas_pro}-${t.mapas_contra}</td><td class="n">${t.saldo > 0 ? '+' : ''}${t.saldo}</td>`}<td class="n"><b>${t.pontos}</b></td>${compacta ? '' : `<td>${t.situacao ? `<span class="tc-sit ${t.situacao}">${{ promocao: 'Promoção', rebaixamento: 'Rebaixamento', copa: 'Vaga na Copa', permanece: '—' }[t.situacao] || ''}</span>` : ''}</td>`}</tr>`).join('')}
  </tbody></table></div>`;
}

function dataCurta(d) { const [, m, dd] = String(d).split('-'); return `${dd}/${m}`; }
function vsCard(p) {
  return `<div class="tc-vs"><div class="lado">${escudoOrg(p.a, 84)}<b>${esc(p.a.nome)}</b></div><div class="x">VS</div><div class="lado">${escudoOrg(p.b, 84)}<b>${esc(p.b.nome)}</b></div></div>
    <p class="tc-vs-info">${dataCurta(p.dia)} · ${p.fase === 'rodada' ? `rodada ${p.rodada}` : FASES[p.fase] || ''} · melhor de ${p.formato}</p>`;
}
function partidaLinha(p, proxima = false) {
  const feita = p.status === 'concluida';
  const meu = S.meu?.org?.id;
  return `<button type="button" class="tc-partida" data-act="partida" data-id="${p.id}" ${feita ? '' : 'disabled'}>
    <span class="time">${escudoOrg(p.a, 30)}<span>${esc(p.a.nome)}</span></span>
    <span class="meio">${feita ? `<span class="placar"><span class="${p.vencedor === p.a.id ? 'v' : ''}">${p.placar_a}</span> - <span class="${p.vencedor === p.b.id ? 'v' : ''}">${p.placar_b}</span></span>` : '<span class="placar">VS</span>'}<span class="qd">${dataCurta(p.dia)} · ${p.fase === 'rodada' ? `rodada ${p.rodada}` : FASES[p.fase] || ''} · MD${p.formato}${feita && meu && (p.a.id === meu || p.b.id === meu) ? (p.vencedor === meu ? ' · <b style="color:var(--bom)">vitória</b>' : ' · <b style="color:var(--ruim)">derrota</b>') : ''}</span></span>
    <span class="time dir"><span>${esc(p.b.nome)}</span>${escudoOrg(p.b, 30)}</span></button>`;
}

// ------------------------------------------------------------------ elenco
function viewElenco() {
  const el = S.meu.elenco || [];
  const tit = el.filter((j) => j.slot); const res = el.filter((j) => !j.slot);
  return `<section class="tc-card"><h3>Titulares<span class="dir">${tit.length}/5</span></h3>
      <div class="tc-escala">${VAGAS.map((v) => { const j = tit.find((x) => x.slot === v); return `<div class="vaga"><span class="rot">${NOME_VAGA[v]}</span>${j ? cartao(j, { tit: false }) : '<div class="tc-vazio">Vaga livre</div>'}</div>`; }).join('')}</div></section>
    <section class="tc-card"><h3>Reserva<span class="dir">${el.length}/${ELENCO_MAX} no elenco</span></h3>
      ${res.length ? `<div class="tc-jogs">${res.map((j) => cartao(j)).join('')}</div>` : '<p class="tc-mudo" style="margin:0">Sem reservas. Contrate jogadores na aba Contratações.</p>'}</section>`;
}

// ------------------------------------------------------------------ contratações
const FILTROS = [
  ['pos', 'Posição', 'select', [['', 'Todas'], ...VAGAS.map((v) => [v, NOME_VAGA[v]])]],
  ['poder_min', 'Poder mín.', 'number'], ['poder_max', 'Poder máx.', 'number'],
  ['mec_min', 'Mecânica mín.', 'number'], ['rotas_min', 'Rotas mín.', 'number'], ['macro_min', 'Macro mín.', 'number'], ['tf_min', 'Teamfight mín.', 'number'], ['mental_min', 'Mental mín.', 'number'],
  ['fama_min', 'Fama mín.', 'number'], ['idade_max', 'Idade máx.', 'number'],
];
function filtrosHtml(oficial) {
  const f = S.mercado.f;
  const campos = [...FILTROS];
  if (oficial) { campos.push(['pot_min', 'Potencial mín.', 'number'], ['preco_max', 'Preço máx. (cr.)', 'number']); campos.push(['ordem', 'Ordenar por', 'select', [['poder', 'Poder'], ['potencial', 'Potencial'], ['fama', 'Fama'], ['preco', 'Menor preço'], ['idade', 'Mais jovem']]]); }
  else { campos.push(['preco_min', 'Preço mín. (RC)', 'number'], ['preco_max', 'Preço máx. (RC)', 'number']); campos.push(['ordem', 'Ordenar por', 'select', [['recente', 'Mais recentes'], ['poder', 'Poder'], ['preco', 'Menor preço'], ['fama', 'Fama']]]); }
  return `<form class="tc-card" data-form="filtros"><div class="tc-filtros">
    <label>Buscar<input name="busca" type="search" value="${esc(f.busca || '')}" placeholder="Nome do jogador" /></label>
    ${campos.map(([k, nome, tipo, ops]) => `<label>${nome}${tipo === 'select' ? `<select name="${k}">${ops.map(([v, n]) => `<option value="${v}" ${String(f[k] ?? (k === 'ordem' ? (oficial ? 'poder' : 'recente') : '')) === v ? 'selected' : ''}>${n}</option>`).join('')}</select>` : `<input name="${k}" type="number" min="1" max="${k.startsWith('preco') && !oficial ? PRECO_RC.max : 999999999}" value="${esc(f[k] ?? '')}" />`}</label>`).join('')}
  </div><div class="tc-acoes"><button class="tc-btn ciano" type="submit">Aplicar filtros</button><button class="tc-btn" type="button" data-act="limpar-filtros">Limpar</button></div></form>`;
}
function viewContratar() {
  const m = S.mercado;
  const lista = m.aba === 'oficial' ? m.oficial : m.usuarios;
  return `<div class="tc-abas"><button type="button" data-act="mercado-aba" data-v="oficial" class="${m.aba === 'oficial' ? 'on' : ''}">Mercado oficial</button><button type="button" data-act="mercado-aba" data-v="usuarios" class="${m.aba === 'usuarios' ? 'on' : ''}">Mercado de usuários</button></div>
    <p class="tc-mudo tc-peq" style="margin:0">${m.aba === 'oficial' ? 'Jogadores do próprio jogo, pagos com créditos de equipe. Os preços são definidos pelo sistema.' : `Anúncios de outros técnicos, pagos com Rift Coins (taxa de ${TAXA_MERCADO_PCT}% descontada do vendedor). Preço fixo.`}</p>
    ${filtrosHtml(m.aba === 'oficial')}
    ${lista == null ? '<p class="tc-carregando">Carregando…</p>' : lista.length ? `<div class="tc-jogs">${lista.map((x) => m.aba === 'oficial' ? cartao(x, { extra: `<div class="ln"><span>Preço</span><span class="tc-preco cr">${fmt(x.preco)}</span></div>` })
      : cartao(x.jogador, { acao: 'ficha-anuncio', dados: `data-anuncio="${x.id}"`, extra: `<div class="ln"><span>${esc(x.vendedor.sigla)}</span><span class="tc-preco rc">${fmt(x.preco_rc)}</span></div>` })).join('')}</div>` : '<div class="tc-vazio">Nenhum jogador encontrado com esses filtros.</div>'}
    ${m.aba === 'usuarios' ? meusAnunciosHtml() : ''}`;
}
function meusAnunciosHtml() {
  const meus = (S.mercado.meus || []).filter((a) => a.status === 'aberto');
  return `<section class="tc-card"><h3>Meus anúncios<span class="dir">${meus.length}/5 abertos</span></h3>${meus.length ? `<div class="tc-lista">${meus.map((a) => `<div class="tc-partida" style="grid-template-columns:1fr auto auto"><span class="time">${esc(a.jogador.nome)} · ${NOME_VAGA[a.jogador.pos]} · Poder ${a.jogador.poder}</span><span class="tc-preco rc">${fmt(a.preco_rc)}</span><button type="button" class="tc-btn peq perigo" data-act="cancelar-anuncio" data-id="${a.id}">Cancelar</button></div>`).join('')}</div>` : '<p class="tc-mudo" style="margin:0">Você não tem anúncios abertos. Para vender um jogador, abra a ficha dele em Meu elenco e toque em Anunciar.</p>'}</section>`;
}

// ------------------------------------------------------------------ campeonatos
function ligaAtual() {
  const ligas = S.camp?.ligas || [];
  if (!ligas.length) return null;
  return ligas.find((l) => l.id === S.ligaSel) || ligas.find((l) => l.tabela.some((t) => t.org.id === S.meu.org.id)) || ligas[0];
}
function viewCamp() {
  if (!S.camp) return '<p class="tc-carregando">Carregando…</p>';
  if (S.camp.antes) return `<section class="tc-card"><p class="tc-mudo" style="margin:0">A primeira temporada começa em ${esc(dataCurta(S.camp.inicio))}.</p></section>`;
  const ligas = S.camp.ligas; const l = ligaAtual();
  if (!l) return '<section class="tc-card"><p class="tc-mudo" style="margin:0">Ainda não há campeonatos em andamento.</p></section>';
  const dias = {};
  l.partidas.forEach((p) => { (dias[p.dia] ||= []).push(p); });
  return `<section class="tc-card"><h3>Campeonatos<span class="dir">Temporada ${l.temporada} · semana ${l.semana}</span></h3>
      <label class="campo" style="max-width:420px"><span class="tc-mudo tc-peq">Competição</span><select class="tc-input" data-act="liga-sel">${ligas.map((x) => `<option value="${x.id}" ${x.id === l.id ? 'selected' : ''}>${esc(x.nome)}${x.status === 'aberta' ? ' (em andamento)' : ''}</option>`).join('')}</select></label>
      <p class="tc-peq tc-mudo" style="margin:10px 0 0">${regrasLiga(l)}</p></section>
    ${l.tipo !== 'divisao' ? `<section class="tc-card"><h3>Classificados</h3>${tabelaClassificados(l)}</section>` : ''}
    <section class="tc-card"><h3>Calendário e resultados</h3>${Object.keys(dias).sort().map((d) => `<h4 class="tc-eyebrow" style="margin:12px 0 6px">${dataCurta(d)} · ${FASES[dias[d][0].fase] || ''}${dias[d][0].fase === 'rodada' ? ` ${dias[d][0].rodada}` : ''}</h4><div class="tc-lista">${dias[d].map((p) => partidaLinha(p)).join('')}</div>`).join('')}</section>`;
}
const FASES = { rodada: 'Rodada', quartas: 'Quartas de final', semi: 'Semifinal', final: 'Final' };
function regrasLiga(l) {
  if (l.tipo === 'copa') return `Os 4 primeiros da ${esc(nomeLiga().principal)} na semana 1 disputam semifinais e final, sempre em melhor de cinco mapas.`;
  if (l.tipo === 'mundial') return `Os 6 melhores da ${esc(nomeLiga().principal)} por pontos nas semanas 1 a 3, mais o campeão da ${esc(nomeLiga().copa)}, disputam quartas, semifinais e final em melhor de cinco. A vaga é conquistada no campo: não dá para comprar com RC.`;
  return `Todos contra todos, uma rodada por dia, melhor de três mapas. Os dois primeiros da ${esc(nomeLiga().acesso)} sobem; os dois últimos da ${esc(nomeLiga().principal)} descem; os 4 primeiros da ${esc(nomeLiga().principal)} na semana 1 vão para a ${esc(nomeLiga().copa)}.`;
}
function tabelaClassificados(l) {
  return `<table class="tc-tabela"><thead><tr><th>Semente</th><th>Equipe</th><th class="n">Poder</th></tr></thead><tbody>${l.tabela.map((t) => `<tr class="${t.org.id === S.meu.org.id ? 'eu' : ''}"><td>${t.pos}</td><td><div class="org">${escudoOrg(t.org, 24)}<span>${esc(t.org.nome)}${t.org.usuario ? ' ★' : ''}</span></div></td><td class="n">${t.poder}</td></tr>`).join('')}</tbody></table>`;
}
function viewClass() {
  if (!S.camp) return '<p class="tc-carregando">Carregando…</p>';
  const ligas = S.camp.ligas || [];
  const mine = ligas.find((l) => l.tipo === 'divisao' && l.tabela.some((t) => t.org.id === S.meu.org.id) && l.status === 'aberta') || ligas.find((l) => l.tabela.some((t) => t.org.id === S.meu.org.id));
  if (!mine) return '<section class="tc-card"><p class="tc-mudo" style="margin:0">Sem classificação ainda.</p></section>';
  return `<section class="tc-card"><h3>${esc(mine.nome)}</h3>${tabelaHtml(mine.tabela, S.meu.org.id)}
    <p class="tc-peq tc-mudo" style="margin:10px 0 0">Pontos: vitória por 2-0 = 3, por 2-1 = 2; derrota por 1-2 = 1, por 0-2 = 0. Desempate: pontos, saldo de mapas, mapas ganhos e, por fim, a ordem de cadastro da organização.</p></section>`;
}

// ------------------------------------------------------------------ histórico
function viewHist() {
  const h = S.hist; if (!h) return '<p class="tc-carregando">Carregando…</p>';
  const tipos = { inicial: 'Elenco inicial', contratacao: 'Contratação', compra_usuario: 'Compra entre usuários', renovacao: 'Renovação', liberado: 'Liberado', expirou: 'Contrato terminou', substituto: 'Substituto' };
  return `<div class="tc-grade2">
    <section class="tc-card"><h3>Transferências e contratos</h3>${h.transferencias.length ? `<table class="tc-tabela"><tbody>${h.transferencias.map((t) => `<tr><td><b>${esc(t.jogador)}</b><br><span class="tc-mudo tc-peq">${tipos[t.tipo] || t.tipo}${t.de ? ` · de ${esc(t.de)}` : ''}${t.para ? ` · para ${esc(t.para)}` : ''}</span></td><td class="n">${t.valor ? `<span class="tc-preco ${t.moeda === 'rc' ? 'rc' : 'cr'}">${fmt(t.valor)}</span>` : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="tc-mudo" style="margin:0">Nada ainda.</p>'}</section>
    <div style="display:flex;flex-direction:column;gap:16px">
      <section class="tc-card"><h3>Premiações</h3>${h.premios.length ? `<table class="tc-tabela"><tbody>${h.premios.map((p) => `<tr><td>${esc(p.liga)}<br><span class="tc-mudo tc-peq">${p.posicao}º lugar${p.pdr != null ? ` · ${p.pdr > 0 ? '+' : ''}${p.pdr} PDR` : ''}</span></td><td class="n"><span class="tc-preco cr">${fmt(p.creditos)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="tc-mudo" style="margin:0">Sem premiações ainda.</p>'}</section>
      <section class="tc-card"><h3>Troféus</h3>${h.trofeus.length ? `<ul class="tc-avisos">${h.trofeus.map((t) => `<li>🏆 ${esc(t.titulo)}</li>`).join('')}</ul>` : '<p class="tc-mudo" style="margin:0">Nenhum troféu ainda.</p>'}</section>
      <section class="tc-card"><h3>Finanças</h3>${financasHtml(h.financas)}</section></div></div>
    <section class="tc-card"><h3>Partidas</h3>${h.partidas.length ? `<div class="tc-lista">${h.partidas.map((p) => partidaLinha(p)).join('')}</div>` : '<p class="tc-mudo" style="margin:0">Nenhuma partida disputada.</p>'}</section>`;
}

// ------------------------------------------------------------------ personalização
function viewPers() {
  const o = S.meu.org; const f = S.form.pers || (S.form.pers = { escudo: o.escudo, cor1: o.cor1, cor2: o.cor2, estilo: o.estilo });
  return `<form class="tc-card tc-form" data-form="pers" style="max-width:720px"><h3>Personalizar a organização</h3>
    <p class="tc-mudo tc-peq" style="margin:0">Só a aparência muda. O nome e a sigla não podem ser alterados e nada aqui dá vantagem na competição.</p>
    <div class="campo"><span>Escudo</span><div class="tc-escudos">${ESCUDOS.map((e) => `<button type="button" data-act="pers-escudo" data-v="${e}" class="${f.escudo === e ? 'on' : ''}">${escudoSvg(e, f.cor1, f.cor2, '', 54)}</button>`).join('')}</div></div>
    <div class="duas"><label class="campo"><span>Cor principal</span><input class="tc-cor" type="color" name="cor1" value="${f.cor1}" /></label><label class="campo"><span>Cor secundária</span><input class="tc-cor" type="color" name="cor2" value="${f.cor2}" /></label></div>
    <label class="campo"><span>Estilo visual</span><select class="tc-input" name="estilo">${[['classico', 'Clássico'], ['moderno', 'Moderno'], ['tecnologico', 'Tecnológico']].map(([v, n]) => `<option value="${v}" ${f.estilo === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="tc-previa">${escudoSvg(f.escudo, f.cor1, f.cor2, o.sigla, 76)}<div style="font-family:'Bebas Neue',sans-serif;font-size:32px">${esc(o.nome)}</div></div>
    <button type="submit" class="tc-btn ouro" ${S.ocupado ? 'disabled' : ''}>Salvar</button></form>`;
}

// ------------------------------------------------------------------ modais
function modalHtml() {
  const m = S.modal; if (!m) return '';
  let corpo = '';
  if (m.t === 'ficha') corpo = fichaHtml(m);
  else if (m.t === 'contratar') corpo = contratarHtml(m);
  else if (m.t === 'comprar') corpo = comprarHtml(m);
  else if (m.t === 'anunciar') corpo = anunciarHtml(m);
  else if (m.t === 'renovar') corpo = renovarHtml(m);
  else if (m.t === 'escalar') corpo = escalarHtml(m);
  else if (m.t === 'partida') corpo = partidaHtml(m);
  return `<div class="tc-fundo" data-act="fechar-fundo"><div class="tc-modal" role="dialog" aria-modal="true"><button type="button" class="x" data-act="fechar" aria-label="Fechar">×</button>${corpo}</div></div>`;
}
function fichaHtml(m) {
  const j = m.j; const meu = j.org_id && j.org_id === S.meu.org.id;
  const resta = semanasRestantes(j);
  const hist = (j.historico || []).slice(0, 5);
  let acoes = '';
  if (!j.org_id) acoes = `<button type="button" class="tc-btn ouro" data-act="abrir-contratar" data-id="${j.id}">Contratar</button>`;
  else if (meu) acoes = `<button type="button" class="tc-btn ciano" data-act="abrir-escalar" data-id="${j.id}">Escalar</button><button type="button" class="tc-btn" data-act="abrir-renovar" data-id="${j.id}">Renovar contrato</button><button type="button" class="tc-btn" data-act="abrir-anunciar" data-id="${j.id}">Anunciar por RC</button>${j.slot ? '' : `<button type="button" class="tc-btn perigo" data-act="liberar" data-id="${j.id}">Liberar</button>`}`;
  else if (m.anuncio) acoes = `<button type="button" class="tc-btn ouro" data-act="abrir-comprar" data-anuncio="${m.anuncio.id}">Comprar por ${fmt(m.anuncio.preco_rc)} RC</button>`;
  return `<h2>${esc(j.nome)}</h2><p class="tc-mudo tc-peq" style="margin:2px 0">${iconeVaga(j.pos)} ${NOME_VAGA[j.pos]}${(j.pos2 || []).length ? ` · também ${j.pos2.map((p) => NOME_VAGA[p]).join(', ')}` : ''} · ${j.idade} anos${j.regiao ? ` · ${esc(j.regiao)}` : ''}${j.ficticio ? ' · jogador fictício' : ''}</p>
    <div class="tc-ficha"><div class="foto">${retratoSvg(j, 200)}</div><div>
      <div class="tc-poder" style="margin-bottom:10px"><div class="grande" style="color:${corPoder(j.poder)}">${j.poder}</div><span class="tc-mudo tc-peq">Poder individual<br>Forma ${j.forma} · Experiência ${j.exp}${j.potencial != null ? `<br>Potencial ${j.potencial}` : ''}</span></div>
      ${barras(j)}</div></div>
    <div class="tc-resumo"><div class="l"><span>Salário${j.org_id ? '' : ' (se contratado)'}</span><b>${fmt(j.org_id ? j.salario : salarioDe(j.preco))} cr./semana</b></div>${j.org_id ? `<div class="l"><span>Contrato</span><b>${resta == null ? '—' : resta <= 0 ? 'vence nesta semana' : `${resta} semana(s)`}</b></div><div class="l"><span>Organização</span><b>${esc(j.org?.nome || '')}</b></div>` : `<div class="l"><span>Preço de transferência</span><b class="tc-preco cr">${fmt(j.preco)}</b></div>`}${m.anuncio ? `<div class="l"><span>Anúncio</span><b class="tc-preco rc">${fmt(m.anuncio.preco_rc)}</b></div><div class="l"><span>Vendedor</span><b>${esc(m.anuncio.vendedor.nome)}</b></div><div class="l"><span>Publicado em</span><b>${new Date(m.anuncio.criado).toLocaleDateString('pt-BR')}</b></div>` : ''}</div>
    ${hist.length ? `<h4 class="tc-eyebrow">Histórico</h4><ul class="tc-avisos">${hist.map((h) => `<li>${new Date(h.criado).toLocaleDateString('pt-BR')} · ${{ inicial: 'Elenco inicial', contratacao: 'Contratado', compra_usuario: 'Vendido entre usuários', renovacao: 'Renovou', liberado: 'Liberado', expirou: 'Contrato terminou', substituto: 'Substituto' }[h.tipo] || h.tipo}${h.para ? ` · ${esc(h.para)}` : ''}${h.valor ? ` · ${fmt(h.valor)} ${h.moeda === 'rc' ? 'RC' : 'cr.'}` : ''}</li>`).join('')}</ul>` : ''}
    <div class="tc-acoes">${acoes}</div>`;
}
const seletorSemanas = (v, nome = 'semanas') => `<label class="campo"><span class="tc-mudo tc-peq">Duração do contrato (semanas)</span><input class="tc-input" type="number" name="${nome}" min="${CONTRATO_MIN}" max="${CONTRATO_MAX}" value="${v}" data-act="semanas" /></label>`;
function contratarHtml(m) {
  const j = m.j; const o = S.meu.org; const sal = m.salario; const total = sal * m.semanas;
  const cheio = (S.meu.elenco || []).length >= ELENCO_MAX;
  const falta = o.creditos < j.preco;
  return `<h2>Contratar ${esc(j.nome)}</h2><p class="tc-mudo tc-peq">Confirme os valores antes de fechar.</p>
    ${seletorSemanas(m.semanas)}
    <div class="tc-resumo"><div class="l"><span>Preço de transferência</span><b class="tc-preco cr">${fmt(j.preco)}</b></div><div class="l"><span>Salário</span><b>${fmt(sal)} cr./semana</b></div><div class="l"><span>Custo de salários no contrato</span><b>${fmt(total)} cr.</b></div>
      <div class="l"><span>Seus créditos agora</span><b>${fmt(o.creditos)}</b></div><div class="l tot"><span>Créditos depois da contratação</span><b style="color:${falta ? 'var(--ruim)' : 'var(--bom)'}">${fmt(o.creditos - j.preco)}</b></div><div class="l"><span>Elenco</span><b>${(S.meu.elenco || []).length + 1}/${ELENCO_MAX}</b></div></div>
    ${falta ? '<p style="color:var(--ruim)">Créditos insuficientes.</p>' : ''}${cheio ? '<p style="color:var(--ruim)">Elenco cheio: libere um jogador antes.</p>' : ''}
    <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="confirmar-contratar" ${falta || cheio || S.ocupado ? 'disabled' : ''}>Confirmar contratação</button><button type="button" class="tc-btn" data-act="fechar">Cancelar</button></div>`;
}
function comprarHtml(m) {
  const a = m.anuncio; const j = a.jogador; const rc = S.meu.rc; const falta = rc < a.preco_rc;
  const cheio = (S.meu.elenco || []).length >= ELENCO_MAX;
  return `<h2>Comprar ${esc(j.nome)}</h2><p class="tc-mudo tc-peq">Vendedor: ${esc(a.vendedor.nome)} (${esc(a.vendedor.sigla)}). A compra usa a sua carteira oficial de Rift Coins e é definitiva.</p>
    <div class="tc-resumo"><div class="l"><span>Preço</span><b class="tc-preco rc">${fmt(a.preco_rc)}</b></div><div class="l"><span>Taxa do mercado (paga pelo vendedor)</span><b>${taxaDe(a.preco_rc)} RC</b></div><div class="l"><span>Salário que passa a ser seu</span><b>${fmt(j.salario)} cr./semana</b></div><div class="l"><span>Contrato restante</span><b>${semanasRestantes(j) ?? '—'} semana(s)</b></div>
      <div class="l"><span>Seus Rift Coins agora</span><b>${fmt(rc)}</b></div><div class="l tot"><span>Depois da compra</span><b style="color:${falta ? 'var(--ruim)' : 'var(--bom)'}">${fmt(rc - a.preco_rc)}</b></div></div>
    ${falta ? '<p style="color:var(--ruim)">Rift Coins insuficientes.</p>' : ''}${cheio ? '<p style="color:var(--ruim)">Elenco cheio: libere um jogador antes.</p>' : ''}
    <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="confirmar-comprar" ${falta || cheio || S.ocupado ? 'disabled' : ''}>Confirmar compra</button><button type="button" class="tc-btn" data-act="fechar">Cancelar</button></div>`;
}
function anunciarHtml(m) {
  const j = m.j; const preco = Number(m.preco) || 0; const taxa = taxaDe(preco);
  return `<h2>Anunciar ${esc(j.nome)}</h2><p class="tc-mudo tc-peq">Preço fixo em Rift Coins. O jogador continua no seu elenco até alguém comprar, e você pode cancelar quando quiser.</p>
    <label class="campo"><span class="tc-mudo tc-peq">Preço em RC (${PRECO_RC.min} a ${fmt(PRECO_RC.max)})</span><input class="tc-input" type="number" name="preco" min="${PRECO_RC.min}" max="${PRECO_RC.max}" value="${m.preco}" data-act="preco-anuncio" /></label>
    <div class="tc-resumo"><div class="l"><span>Taxa do mercado (${TAXA_MERCADO_PCT}%)</span><b>${taxa} RC</b></div><div class="l tot"><span>Você recebe</span><b>${fmt(Math.max(0, preco - taxa))} RC</b></div></div>
    ${j.slot ? '<p style="color:#fbbf24" class="tc-peq">Esse jogador é titular. Se ele for vendido, a vaga é preenchida por um reserva ou por um substituto fraco.</p>' : ''}
    <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="confirmar-anunciar" ${preco < PRECO_RC.min || preco > PRECO_RC.max || S.ocupado ? 'disabled' : ''}>Publicar anúncio</button><button type="button" class="tc-btn" data-act="fechar">Cancelar</button></div>`;
}
function renovarHtml(m) {
  const j = m.j; const custo = Math.floor((m.salario * m.semanas) / 2); const falta = S.meu.org.creditos < custo;
  return `<h2>Renovar ${esc(j.nome)}</h2><p class="tc-mudo tc-peq">O contrato novo soma à duração atual. O custo é metade dos salários do período.</p>${seletorSemanas(m.semanas)}
    <div class="tc-resumo"><div class="l"><span>Salário</span><b>${fmt(m.salario)} cr./semana</b></div><div class="l"><span>Custo da renovação</span><b class="tc-preco cr">${fmt(custo)}</b></div><div class="l tot"><span>Créditos depois</span><b style="color:${falta ? 'var(--ruim)' : 'var(--bom)'}">${fmt(S.meu.org.creditos - custo)}</b></div></div>
    <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="confirmar-renovar" ${falta || S.ocupado ? 'disabled' : ''}>Renovar</button><button type="button" class="tc-btn" data-act="fechar">Cancelar</button></div>`;
}
function escalarHtml(m) {
  const j = m.j;
  const ocup = titulares();
  return `<h2>Escalar ${esc(j.nome)}</h2><p class="tc-mudo tc-peq">Escolha a vaga. Quem estiver nela vai para a reserva. Jogar fora da posição principal reduz o Poder em ${Math.round((1 - 0.9) * 100)}% e trocar titulares reduz a sinergia.</p>
    <div class="tc-lista">${VAGAS.map((v) => { const ok = v === j.pos || (j.pos2 || []).includes(v); return `<button type="button" class="tc-partida" style="grid-template-columns:1fr auto" data-act="confirmar-escalar" data-vaga="${v}"><span class="time">${iconeVaga(v)} ${NOME_VAGA[v]}${ocup[v] ? ` · hoje: ${esc(ocup[v].nome)}` : ' · livre'}</span><span class="tc-peq" style="color:${ok ? 'var(--bom)' : '#fbbf24'}">${ok ? 'na posição' : 'fora da posição'}</span></button>`; }).join('')}</div>
    <div class="tc-acoes"><button type="button" class="tc-btn" data-act="fechar">Fechar</button></div>`;
}
function partidaHtml(m) {
  const p = m.p; const r = p.resumo || { mapas: [] };
  return `<h2>${esc(p.a.nome)} ${p.placar_a} × ${p.placar_b} ${esc(p.b.nome)}</h2><p class="tc-mudo tc-peq">${dataCurta(p.dia)} · ${p.fase === 'rodada' ? `rodada ${p.rodada}` : FASES[p.fase] || ''} · melhor de ${p.formato} · Poder ${p.poder_a} × ${p.poder_b}</p>
    ${(r.mapas || []).map((x) => `<div class="tc-resumo"><div class="l"><b>Mapa ${x.mapa}</b><span>${x.duracao} min · vitória ${esc(x.vencedor === 'a' ? p.a.nome : p.b.nome)}</span></div>
      ${[['Rotas', x.rotas], ['Controle de objetivos', x.objetivos], ['Teamfights', x.teamfight]].map(([n, v]) => { const a = Math.max(1, v[0]); const bb = Math.max(1, v[1]); const pa = Math.round((a / (a + bb)) * 100); return `<div class="l"><span>${n}</span><span style="display:flex;gap:8px;align-items:center;min-width:55%"><b>${pa}%</b><div class="tc-barra" style="flex:1"><i style="width:${pa}%"></i></div><b>${100 - pa}%</b></span></div>`; }).join('')}
      <div class="l"><span>Destaque do mapa</span><b>${esc(x.mvp || '')}</b></div></div>`).join('')}
    <div class="tc-acoes"><button type="button" class="tc-btn" data-act="fechar">Fechar</button></div>`;
}

// ------------------------------------------------------------------ desenho
function conteudo() {
  switch (S.aba) {
    case 'elenco': return viewElenco();
    case 'contratar': return viewContratar();
    case 'camp': return viewCamp();
    case 'class': return viewClass();
    case 'hist': return viewHist();
    case 'pers': return viewPers();
    default: return viewVisao();
  }
}
function render() {
  const foco = document.activeElement;
  const nomeFoco = foco?.name; const posFoco = foco?.selectionStart;
  if (!S.meu) return;
  if (S.meu.org) {
    app.innerHTML = `${FECHADO ? '<div class="tc-aviso-teste">Jogo em teste: só administradores veem esta área.</div>' : ''}${topo()}<div class="tc-corpo">${nav()}<div class="tc-main">${conteudo()}</div></div>${modalHtml()}`;
  } else {
    app.innerHTML = `<div class="tc-aviso-teste">Jogo em teste: só administradores veem esta área.</div>${viewCriar()}`;
  }
  // devolve o foco ao campo que estava sendo digitado
  if (nomeFoco) {
    const el = app.querySelector(`[name="${nomeFoco}"]`);
    if (el && el.type !== 'color') { el.focus(); try { if (posFoco != null) el.setSelectionRange(posFoco, posFoco); } catch { /* campo sem seleção */ } }
  }
}
function telaMensagem(titulo, texto, link) {
  app.innerHTML = `<div class="tc-criar"><p class="tc-eyebrow">◆ Simulador de técnico</p><h1 style="font-family:'Bebas Neue',sans-serif;font-size:42px;margin:4px 0">${esc(titulo)}</h1><p class="tc-mudo">${esc(texto)}</p>${link ? `<p><a class="tc-btn ouro" style="display:inline-block;text-decoration:none" href="${link[0]}">${esc(link[1])}</a></p>` : ''}</div>`;
}

// ------------------------------------------------------------------ eventos
const porId = (id) => (S.meu.elenco || []).find((j) => j.id === Number(id));
async function abrirFicha(id, anuncio = null) {
  const r = await agir(async () => {
    const j = await api.ficha(Number(id));
    S.modal = { t: 'ficha', j, anuncio };
    return true;
  }, { recarregar: false });
  return r;
}
function filtrosDoForm(form) {
  const f = {};
  new FormData(form).forEach((v, k) => { const s = String(v).trim(); if (s !== '') f[k] = /^(busca|pos|ordem)$/.test(k) ? s : Number(s); });
  return f;
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b || !S.meu) return;
  const act = b.dataset.act;
  if (act === 'fechar-fundo') { if (e.target === b) { S.modal = null; render(); } return; }
  if (act === 'semanas' || act === 'liga-sel' || act === 'preco-anuncio') return;
  if (act === 'aba') { S.aba = b.dataset.aba; render(); await carregarAba(); render(); window.scrollTo({ top: 0 }); return; }
  if (act === 'fechar') { S.modal = null; render(); return; }
  if (act === 'escudo') { S.form.escudo = b.dataset.v; render(); return; }
  if (act === 'pers-escudo') { S.form.pers.escudo = b.dataset.v; render(); return; }
  if (act === 'mercado-aba') { S.mercado.aba = b.dataset.v; S.mercado.f = { ordem: b.dataset.v === 'oficial' ? 'poder' : 'recente' }; render(); await agir(carregarMercado, { recarregar: false }); return; }
  if (act === 'limpar-filtros') { S.mercado.f = { ordem: S.mercado.aba === 'oficial' ? 'poder' : 'recente' }; S.mercado.oficial = null; S.mercado.usuarios = null; render(); await agir(carregarMercado, { recarregar: false }); return; }
  if (act === 'ficha') { await abrirFicha(b.dataset.id); return; }
  if (act === 'ficha-anuncio') { const a = (S.mercado.usuarios || []).find((x) => x.id === Number(b.dataset.anuncio)); await abrirFicha(b.dataset.id, a || null); return; }
  if (act === 'partida') { await agir(async () => { S.modal = { t: 'partida', p: await api.partida(Number(b.dataset.id)) }; }, { recarregar: false }); return; }
  if (act === 'abrir-contratar') { const j = S.modal.j; S.modal = { t: 'contratar', j, semanas: 12, salario: Math.max(300, Math.round((j.preco * 0.015) / 100) * 100), chave: novaChave() }; render(); return; }
  if (act === 'abrir-renovar') { const j = S.modal.j; S.modal = { t: 'renovar', j, semanas: 12, salario: Math.max(300, Math.round((j.preco * 0.015) / 100) * 100), chave: novaChave() }; render(); return; }
  if (act === 'abrir-anunciar') { S.modal = { t: 'anunciar', j: S.modal.j, preco: 500 }; render(); return; }
  if (act === 'abrir-escalar') { S.modal = { t: 'escalar', j: S.modal.j }; render(); return; }
  if (act === 'abrir-comprar') { S.modal = { t: 'comprar', anuncio: S.modal.anuncio, chave: novaChave() }; render(); return; }
  if (act === 'confirmar-contratar') {
    const m = S.modal;
    const r = await agir(() => api.contratar(m.j.id, m.semanas, m.chave), { ok: `${m.j.nome} contratado!` });
    if (r) { S.modal = null; render(); }
    return;
  }
  if (act === 'confirmar-renovar') {
    const m = S.modal;
    const r = await agir(() => api.renovar(m.j.id, m.semanas, m.chave), { ok: 'Contrato renovado!' });
    if (r) { S.modal = null; render(); }
    return;
  }
  if (act === 'confirmar-anunciar') {
    const m = S.modal;
    const r = await agir(() => api.anunciar(m.j.id, Number(m.preco)), { ok: 'Anúncio publicado!' });
    if (r) { S.modal = null; render(); }
    return;
  }
  if (act === 'confirmar-comprar') {
    const m = S.modal;
    const r = await agir(() => api.comprarAnuncio(m.anuncio.id, m.chave), { ok: `${m.anuncio.jogador.nome} é seu!` });
    if (r) { S.modal = null; await agir(async () => { S.meu = await api.meu(); }, { recarregar: false }); }
    return;
  }
  if (act === 'confirmar-escalar') {
    const m = S.modal;
    const r = await agir(() => api.escalar(b.dataset.vaga, m.j.id), { ok: 'Escalação atualizada!' });
    if (r) { S.modal = null; render(); }
    return;
  }
  if (act === 'liberar') {
    const j = S.modal.j;
    if (!window.confirm(`Liberar ${j.nome}? Ele volta ao mercado oficial e você não recebe nada em troca.`)) return;
    const r = await agir(() => api.liberar(j.id), { ok: `${j.nome} foi liberado.` });
    if (r) { S.modal = null; render(); }
    return;
  }
  if (act === 'cancelar-anuncio') {
    if (!window.confirm('Cancelar este anúncio?')) return;
    await agir(() => api.cancelarAnuncio(Number(b.dataset.id)), { ok: 'Anúncio cancelado.' });
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.matches('[data-act="semanas"]')) {
    S.modal.semanas = Math.min(CONTRATO_MAX, Math.max(CONTRATO_MIN, Number(t.value) || CONTRATO_MIN)); render(); return;
  }
  if (t.matches('[data-act="preco-anuncio"]')) { S.modal.preco = t.value; render(); return; }
  const form = t.closest('form[data-form="criar"]');
  if (form) { S.form[t.name] = t.name === 'sigla' ? t.value.toUpperCase() : t.value; render(); return; }
  const pf = t.closest('form[data-form="pers"]');
  if (pf) { S.form.pers[t.name] = t.value; render(); }
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-act="liga-sel"]')) { S.ligaSel = Number(e.target.value); render(); }
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]'); if (!form) return;
  e.preventDefault();
  const tipo = form.dataset.form;
  if (tipo === 'criar') {
    S.erro = '';
    const f = S.form;
    const r = await agir(() => api.criarOrg(f), { ok: 'Organização criada! Boa sorte, técnico.', recarregar: false });
    if (r) { await agir(atualizar, { recarregar: false }); S.aba = 'visao'; render(); } else { S.erro = 'Confira os dados e tente de novo.'; render(); }
  } else if (tipo === 'pers') {
    const f = S.form.pers;
    await agir(() => api.personalizar(f), { ok: 'Aparência atualizada!' });
  } else if (tipo === 'filtros') {
    S.mercado.f = filtrosDoForm(form); S.mercado.oficial = null; S.mercado.usuarios = null;
    render(); await agir(carregarMercado, { recarregar: false });
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.modal) { S.modal = null; render(); } });

// ------------------------------------------------------------------ início
(async function iniciar() {
  await platform.init();
  const teste = ['localhost', '127.0.0.1'].includes(location.hostname) && /[?&]teste=1/.test(location.search);
  const user = platform.getUser();
  const souAdmin = await platform.isAdmin();
  const aberto = !gameById(GAME_ID)?.soAdmin;
  if (!user && !teste) { telaMensagem('Entre na sua conta', 'O simulador de técnico precisa de uma conta para guardar a sua organização.', null); return; }
  if (!souAdmin && !teste && !aberto) { telaMensagem('Em desenvolvimento', 'Este jogo ainda está em teste e só administradores conseguem jogar por enquanto.', ['../../', 'Voltar ao início']); return; }
  try {
    await api.sincronizar();
    S.meu = await api.meu();
    if (S.meu.org) S.painel = await api.painel();
    render();
  } catch (e) {
    telaMensagem('Não foi possível abrir o jogo', e.message, ['../../', 'Voltar ao início']);
  }
}());
