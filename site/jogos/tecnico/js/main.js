// Simulador de Técnico (nome provisório): o usuário funda uma organização, monta o elenco, contrata no mercado oficial
// (créditos) ou de outros usuários (RC), disputa as ligas semanais e acumula troféus e Rank.
// O servidor decide tudo (saldos, propriedade, partidas, premiações); esta tela só mostra e pede ações.
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';
import { mountSiteFooter } from '../../../shared/footer.js';
import { gameById } from '../../../shared/config.js';
import {
  VAGAS, NOME_VAGA, SIGLA_VAGA, FAVORITOS_MAX, nomeMaestria, ATRIBUTOS, ELENCO_MAX, PRECO_RC, TAXA_MERCADO_PCT,
  fmt, esc, corPoder, escudoPoder, taxaDe, salarioDe, FORA_POSICAO,
} from './regras.js';
import { prepararImagens, campIcone } from './campeoes-img.js';
import { escudoOrg, retratoSvg, iconeVaga } from './art.js';
import { SIMBOLOS, N_SIMBOLOS, PALETA, ICONE_PADRAO, icClone, icTrocar, icCodificar, icDecodificar, icHtml, FONTES, TEXTO_PADRAO, TEXTO_MAX, txClone, txCodificar, txDecodificar, txLimpar, textoHtml, carregarFontes } from './icone.js?v=3';
import { tocar, somAtivo, definirSom } from './bau-anim.js';
import { subcategoriaDoCampeao } from './partida/dados/itemizacao.js';
import { iniciarExtras, carregarExtras, limparExtras, viewTreino, viewAmistoso, viewRecrutar, modalRecrutar, tratarAcao } from './extras.js?v=5';
import { iniciarAdm, carregarAdm, viewAdmJogadores, tratarAdm, aoDigitar as admDigitar, filtrarAdm } from './adm.js';
import { nomeMovimento, iniciarMarketing, carregarMarketing, limparMarketing, abrirComResumo, viewMarketingCentral, modalMktResumo, tratarMkt } from './marketing.js?v=5';

// Comunicação da equipe: idioma dos titulares e quanto cada um ganha por falar com os colegas (mesmo idioma nativo vale 1, idioma em comum vale 2/3).
const NOME_IDIOMA = { ko: 'Coreano', zh: 'Chinês', pt: 'Português', es: 'Espanhol', en: 'Inglês', vi: 'Vietnamita', ja: 'Japonês', tr: 'Turco', pl: 'Polonês' };
// Idiomas do jogador na ficha: nativo e, se houver, os que fala também.
function idiomasFichaHtml(j) {
  if (!j.idioma?.nativo) return '';
  const nome = (c) => NOME_IDIOMA[c] || String(c).toUpperCase(); const sec = j.idioma.sec || [];
  return `<p class="tc-idiomas-ficha"><span class="n" title="Idioma nativo">🗣 <b>${esc(nome(j.idioma.nativo))}</b> <small>nativo</small></span>${sec.map((c) => `<span class="s" title="Idioma secundário"><b>${esc(nome(c))}</b> <small>fala também</small></span>`).join('')}</p>`;
}
function comunicacaoHtml() {
  const I = S.idiomas; if (!I || !I.titulares?.length) return '';
  const nomeId = (c) => NOME_IDIOMA[c] || String(c).toUpperCase();
  const falados = (t) => new Set([t.idioma.nativo, ...(t.idioma.sec || [])]);
  const nivel = (t) => { const outros = I.titulares.filter((o) => o.id !== t.id); if (outros.some((o) => o.idioma.nativo === t.idioma.nativo)) return 'nativo'; return outros.some((o) => [...falados(t)].some((l) => falados(o).has(l))) ? 'comum' : 'nada'; }; // verde: mesmo idioma nativo · amarelo: só um idioma em comum · vermelho: nenhum
  const dica = { nativo: 'mesmo idioma nativo de um colega', comum: 'tem um idioma em comum com um colega, mas não o nativo', nada: 'sem idioma em comum com os colegas' };
  const chips = I.titulares.map((t) => { const n = nivel(t); return `<span class="tc-idioma ${n}" title="${esc(t.nome)}: ${dica[n]}${t.afinidade > 0 ? ` (+${(t.afinidade * I.eficiencia_pct).toFixed(1).replace('.', ',')}% de eficiência)` : ''}"><b>${esc(t.nome)}</b><small>${esc(nomeId(t.idioma.nativo))}${(t.idioma.sec || []).length ? ` · fala também ${esc(t.idioma.sec.map(nomeId).join(', '))}` : ''}</small></span>`; }).join('');
  return `<div class="tc-comunica"><span class="tc-eyebrow">Comunicação · idioma em comum aumenta a eficiência e a sinergia</span><div class="tc-idiomas">${chips}</div></div>`;
}

const PODER_MAX = 125; // teto do Poder em campo (as estrelas podem passar de 100): a barra enche só nele
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
  invOrd: { k: null, dir: 'desc' }, // ordenação rápida do inventário
  campeoes: null,
  gp: null,
  fc: { busca: '', pos: '', classe: '', regiao: '' },
  mercado: { aba: 'oficial', f: { ordem: 'poder' }, oficial: null, usuarios: null, meus: null },
  modal: null,
  ocupado: false,
  form: { nome: '', sigla: '', escudo: icCodificar(ICONE_PADRAO), cor1: ICONE_PADRAO.c[0], cor2: ICONE_PADRAO.c[1] || ICONE_PADRAO.c[0], estilo: 'classico', ic: icClone(ICONE_PADRAO), modo: 'simbolo', tx: txClone(TEXTO_PADRAO) },
  erro: '',
};

const novaChave = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`);
const nomeLiga = () => S.meu?.nomes || {};

let toastTimer = null;
function toast(msg, erro = false) {
  document.querySelector('.tc-toast')?.remove();
  const ms = erro ? 6000 : 4200;
  const el = document.createElement('div');
  el.className = `tc-toast${erro ? ' erro' : ''}`;
  el.setAttribute('role', erro ? 'alert' : 'status');
  el.style.setProperty('--dur', `${ms}ms`);
  tocar(erro ? 'erro' : 'ok');
  const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = erro ? '!' : '✓';
  const tx = document.createElement('span'); tx.className = 'tx'; tx.textContent = msg;
  el.append(ic, tx);
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

// Configuração: preferências só deste navegador (guardadas no próprio aparelho).
const CFG_KEY = 'tc_ui';
function lerCfg() { try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}') || {}; } catch { return {}; } }
function salvarCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch { /* sem armazenamento: vale só nesta sessão */ } }
function aplicarCfg() { document.documentElement.classList.toggle('tc-sem-anim', !!lerCfg().semAnim); }
aplicarCfg();
const RENOMEAR_RC = 200; // custo de trocar o nome do time (o servidor cobra o mesmo valor)
const NOME_OK = /^[\p{L}\p{N} ._'-]+$/u;
const chave = (on, acao, rotulo, ligado, desligado) => `<button type="button" class="tc-chave${on ? ' on' : ''}" data-act="${acao}" role="switch" aria-checked="${on}" aria-label="${rotulo}"><i></i><span>${on ? ligado : desligado}</span></button>`;
function configHtml() {
  const c = lerCfg(); const sem = !!c.semAnim; const som = somAtivo(); const org = S.meu?.org;
  return `<h2>Configuração</h2>
    <p class="tc-mudo tc-peq" style="margin:2px 0 12px">As preferências de som e animação ficam só neste navegador.</p>
    <div class="tc-cfg-linha"><div><b>Efeitos sonoros</b><small class="tc-mudo">Sons da abertura de baús e dos avisos do jogo (sucesso e erro).</small></div>
      ${chave(som, 'cfg-som', 'Efeitos sonoros', 'Ligados', 'Desligados')}</div>
    <div class="tc-cfg-linha"><div><b>Animações</b><small class="tc-mudo">Brilhos nas barras, estrelas, cartões e avisos. Desligue se o jogo ficar pesado ou se preferir uma tela mais calma.</small></div>
      ${chave(!sem, 'cfg-anim', 'Animações', 'Ligadas', 'Reduzidas')}</div>
    ${org ? `<div class="tc-cfg-linha tc-cfg-nome"><div><b>Nome do time</b><small class="tc-mudo">Trocar o nome custa <b>${RENOMEAR_RC} RC</b> (você tem ${fmt(S.meu.rc)} RC). Se o seu emblema for só a escrita, ele acompanha o nome novo.</small>
      <span class="tc-cfg-campo"><input class="tc-input" id="cfg-nome" maxlength="24" autocomplete="off" value="${esc(org.nome)}" aria-label="Novo nome do time" /><button type="button" class="tc-btn" data-act="cfg-renomear"${S.ocupado ? ' disabled' : ''}>Trocar (${RENOMEAR_RC} RC)</button></span></div></div>
    <div class="tc-cfg-linha"><div><b>Personalizar o time</b><small class="tc-mudo">Símbolo, cores e estilo da sua organização (é grátis).</small></div>
      <button type="button" class="tc-btn" data-act="cfg-pers">Abrir</button></div>` : ''}
    <div class="tc-cfg-linha"><div><b>Restaurar preferências</b><small class="tc-mudo">Volta o som e as animações para o padrão (ligados).</small></div>
      <button type="button" class="tc-btn" data-act="cfg-reset">Restaurar</button></div>
    <div class="tc-acoes"><button type="button" class="tc-btn" data-act="fechar">Fechar</button></div>`;
}

// Executa uma ação do servidor com proteção contra cliques repetidos e mensagens de erro claras.
async function agir(fn, { ok, recarregar = true } = {}) {
  if (S.ocupado) return null;
  S.ocupado = true;
  document.body.style.cursor = 'progress';
  try {
    const r = await fn();
    S.hist = null; // qualquer ação (baú, contrato, treino, mercado...) pode mexer no histórico: ele é recarregado na próxima vez que for aberto
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
    if (S.aba === 'hist' && !S.hist) carregarAba().then(render); // o histórico foi invalidado acima: se a aba está aberta, recarrega (antes ficava em "Carregando…" para sempre)
  }
}

async function atualizar() {
  S.meu = await api.meu();
  if (S.meu.org) { S.painel = await api.painel(); S.gp = await api.gameplayPendente().catch(() => null); S.avisosN = await api.avisosContagem().catch(() => 0); S.idiomas = await api.idiomas().catch(() => null); }
  S.camp = null; S.hist = null; S.rank = null; limparExtras(); limparMarketing();
  S.mercado.oficial = null; S.mercado.usuarios = null; S.mercado.meus = null;
  await carregarAba();
}

// ------------------------------------------------------------------ carga por aba
async function carregarAba() {
  if (!S.meu?.org) return;
  try {
    if (S.aba === 'camp' && !S.camp) S.camp = await api.campeonatos();
    if (S.aba === 'hist' && !S.hist) S.hist = await api.historico();
    if (S.aba === 'rank' && !S.rank) S.rank = await api.rank();
    if (S.aba === 'adm' && S.ehAdmin) {
      if ((S.admAba || 'campeoes') === 'campeoes' && !S.campeoes) [S.campeoes] = await Promise.all([api.campeoes(), prepararImagens()]);
      if (S.admAba === 'jogadores') await carregarAdm();
    }
    if (S.aba === 'contratar') await carregarMercado();
    if (['treino', 'amistoso', 'recrutar'].includes(S.aba)) await carregarExtras(S.aba);
    if (S.aba === 'marketing') await carregarMarketing();
  } catch (e) { toast(e.message, true); }
}
// Contagem para a próxima troca do mercado oficial (aparece no canto do quadro de filtros).
function rotacaoBloco() {
  const m = S.mercado; const r = m.rotacao; if (!r) return '';
  const restante = Math.max(0, r.restante_s - Math.round((Date.now() - (m.rotacaoEm || Date.now())) / 1000));
  const h = Math.floor(restante / 3600); const min = Math.floor((restante % 3600) / 60);
  return `<div class="tc-rotacao" title="A oferta do mercado oficial troca a cada ${r.horas} horas"><small>Novos jogadores em</small><b>${h}h ${String(min).padStart(2, '0')}min</b></div>`;
}
async function carregarMercado() {
  const m = S.mercado;
  if (m.aba === 'oficial' && !m.oficial) { [m.oficial, m.rotacao] = await Promise.all([api.mercadoOficial(m.f), api.mercadoRotacao().catch(() => null)]); m.rotacaoEm = Date.now(); }
  if (m.aba === 'usuarios' && !m.usuarios) { [m.usuarios, m.meus] = await Promise.all([api.mercadoUsuarios(m.f), api.meusAnuncios()]); }
}

// ------------------------------------------------------------------ peças visuais
const semanasRestantes = (j) => (j.contrato_fim == null ? null : j.contrato_fim - (S.meu?.semana ?? 0));

// Escudo do Poder (prata a challenger): a imagem fica atrás do número; sem imagem, sobra o escudo desenhado em CSS.
function escudoHtml(poder, grande = false) {
  const t = escudoPoder(poder);
  return `<span class="pw${grande ? ' pw-grande' : ''} tier-${t}" title="Poder ${poder}"><img src="../../shared/assets/trofeus/${t}.png" alt="" onerror="this.parentElement.classList.add('sem-img'); this.remove()" /><b>${poder}</b></span>`;
}

// Estrelas de evolução (0 a 10): cada uma dá +5% de eficiência dentro do jogo, sem mudar o Poder.
// A barra tem 5 casas: de 1 a 5 estrelas acende uma amarela por estrela; da 6ª em diante cada estrela nova pinta mais uma casa de vermelho (10 = cinco vermelhas).
function estrelasHtml(j) {
  const n = j.estrelas || 0; const max = j.estrela_max || 10;
  const estrelas = Array.from({ length: 5 }, (_, i) => `<em class="${n > 5 && i < n - 5 ? 'vermelha' : i < Math.min(n, 5) ? 'on' : 'off'}" style="--i:${i}">★</em>`).join('');
  return `<span class="tc-stars${n >= max ? ' cheia' : ''}${n > 5 ? ' alem' : ''}" title="${n} de ${max} estrelas (+${n * 5}% de eficiência)">${estrelas}</span>`;
}

function cartao(j, { tit = false, extra = '', acao = 'ficha', dados = '' } = {}) {
  const c = corPoder(j.poder);
  const resta = semanasRestantes(j);
  return `<button type="button" class="tc-jog${j.raridade ? ` r-${j.raridade}` : ''}" data-act="${acao}" data-id="${j.id}" ${dados} style="--c:${c}">
    <div class="foto">${retratoSvg(j, 160)}<span class="vg">${iconeVaga(j.pos)}</span>${escudoHtml(j.poder)}</div>
    <div class="inf">
      <span class="nm">${esc(j.nome)}${j.ficticio === false ? ' <i class="tc-estrela" title="Jogador Legado">◆</i>' : ''}</span><span class="pos">${esc(NOME_VAGA[j.pos])}</span>
      <div class="ln"><span>${j.idade} anos</span><span>Fama <b>${j.fama}</b></span></div>
      ${j.potencial != null ? `<div class="ln"><span>Potencial</span><b>${j.potencial}</b></div>` : ''}
      ${j.org_id ? `<div class="ln"><span>Estrelas</span>${estrelasHtml(j)}</div>` : ''}
      ${resta != null && j.org_id ? `<div class="ln"><span>Contrato</span><b>${resta <= 0 ? 'vence já' : `${resta} sem.`}</b></div>` : ''}
      ${extra}
    </div>${tit ? `<span class="tit">TITULAR · ${esc(NOME_VAGA[j.slot])}</span>` : ''}</button>`;
}

function barras(j) {
  const tier = (v) => (v >= 90 ? 'ouro' : v >= 80 ? 'teal' : v >= 65 ? 'azul' : v >= 50 ? 'cinza' : 'bronze');
  const cor = { ouro: '#f5cf5a', teal: '#5eead4', azul: '#67c7ff', cinza: '#a3b3c9', bronze: '#c99a6a' };
  return `<div class="fa-attrs">${ATRIBUTOS.map((a, i) => { const v = j[a.id]; const t = tier(v); return `<div class="fa-linha"><span class="nm">${a.nome}</span><div class="fa-barra"><i class="t-${t}" style="--w:${Math.max(0, Math.min(100, v))}%;--i:${i}"></i></div><b style="color:${cor[t]}">${v}</b></div>`; }).join('')}</div>`;
}

const IMG = (n, c = '') => `<img class="ic ${c}" src="img/${n}.webp" alt="" width="28" height="28" loading="lazy" />`;
function topo() {
  const o = S.meu.org;
  const novos = S.avisosN || 0;
  return `<header class="tc-topo">
    <div class="tc-org"><span class="logo">${escudoOrg(o, 54)}</span><div><div class="nome">${esc(o.nome)}</div><div class="sub">${o.divisao === 'principal' ? esc(nomeLiga().principal) : esc(nomeLiga().acesso)}</div><div class="xp"><i style="width:${Math.min(100, S.meu.poder / PODER_MAX * 100)}%"></i><span>Poder ${S.meu.poder}</span></div></div></div>
    <div class="tc-moedas">
      <div class="tc-moeda rc"><img src="../../shared/assets/moeda/rc-96.webp" alt="" width="34" height="34" /><div><b>${fmt(S.meu.rc)}</b><small>Rift Coins</small></div></div>
      <div class="tc-moeda cred"><img src="img/credito-96.webp" srcset="img/credito-192.webp 2x" alt="" width="36" height="36" /><div><b>${fmt(o.creditos)}</b><small>Créditos</small></div></div>
      <div class="tc-moeda frag"><span class="ic-frag" aria-hidden="true">◈</span><div><b>${fmt(o.fragmentos || 0)}</b><small>Fragmentos de jogador</small></div></div>
    </div>
    <div class="tc-atalhos">
      <button type="button" data-act="avisos">${IMG('ic-aviso')}${novos ? `<em>${Math.min(novos, 9)}${novos > 9 ? '+' : ''}</em>` : ''}<span>Avisos</span></button>
      <button type="button" data-act="calendario">${IMG('ic-calendario')}<span>Calendário</span></button>
      <button type="button" data-act="config">${IMG('ic-config')}<span>Configuração</span></button>
    </div>
    </header>`;
}

const ABAS = [
  ['visao', 'Início', 'ic-inicio'], ['elenco', 'Meu elenco', 'ic-elenco'], ['treino', 'Treinamento', 'ic-treino'], ['amistoso', 'Amistoso', 'ic-amistoso'], ['contratar', 'Mercado', 'ic-mercado'], ['recrutar', 'Recrutar', 'ic-recrutar'], ['marketing', 'Marketing', 'ic-marketing'], ['adm', 'ADM', 'i-conf'],
  ['camp', 'Campeonatos', 'ic-campeonatos'], ['rank', 'Rank', 'ic-rank'], ['hist', 'Histórico', 'ic-historico'], ['pers', 'Personalizar', 'ic-personalizar'],
];
function nav() {
  const novos = S.avisosN || 0;
  const sem = ((S.meu.semana % 4) + 4) % 4 + 1;
  return `<nav class="tc-nav" aria-label="Seções">${ABAS.filter(([id]) => id !== 'adm' || S.ehAdmin).map(([id, nome, ic]) => `<button type="button" data-act="aba" data-aba="${id}" class="${S.aba === id ? 'on' : ''}">${IMG(ic)}<span>${nome}</span>${id === 'visao' && novos ? `<span class="n">${Math.min(novos, 9)}</span>` : ''}</button>`).join('')}
    <div class="tc-temp"><span class="tc-eyebrow">Temporada atual</span><b>Semana ${sem} de 4</b><small>${S.meu.org.divisao === 'principal' ? esc(nomeLiga().principal) : esc(nomeLiga().acesso)}</small></div>${FECHADO ? '<a class="tc-peq" style="color:var(--ouro2);padding:8px 4px;text-align:center" href="partida/?teste=1">Sala de testes da partida (admin)</a>' : ''}</nav>`;
}

// ------------------------------------------------------------------ etapa 2: contratar os 5 primeiros jogadores
function viewEscolha() {
  const o = S.meu.org; const ofertas = S.meu.ofertas || []; const sel = S.escolha || (S.escolha = {});
  const n = VAGAS.filter((v) => sel[v]).length;
  const linhas = VAGAS.map((v) => `<section class="tc-card"><h3>${iconeVaga(v)} ${NOME_VAGA[v]}<span class="dir">${sel[v] ? 'escolhido' : 'escolha 1'}</span></h3>
    <div class="tc-jogs tc-ofertas">${ofertas.filter((j) => j.pos === v).map((j) => `<div class="tc-oferta ${sel[v] === j.id ? 'sel' : ''}">${cartao(j, { acao: 'escolher-inicial', dados: `data-pos="${v}"` })}</div>`).join('')}</div></section>`).join('');
  return `<div class="tc-criar tc-escolha"><p class="tc-eyebrow">◆ ${esc(o.nome)} · etapa 2 de 2</p>
    <h1 style="font-family:'Bebas Neue',sans-serif;font-size:42px;margin:4px 0">Contrate seus primeiros jogadores</h1>
    <p class="tc-mudo">Você começa sem jogadores. Escolha <b>1 de cada posição</b> entre as 15 opções: eles formam o seu time inicial (contrato de cortesia de 12 semanas). Depois você contrata mais no Mercado e nos baús.</p>
    ${linhas}
    <div class="tc-acoes" style="position:sticky;bottom:10px"><button type="button" class="tc-btn ouro" data-act="confirmar-inicial" ${n === 5 && !S.ocupado ? '' : 'disabled'}>Fechar contratos (${n}/5)</button></div></div>`;
}

// ------------------------------------------------------------------ editor do ícone (símbolo ou escrita)
// alvo: 'criar' (S.form) ou 'pers' (S.form.pers). O ícone vira texto no campo `escudo` e as cores principais alimentam cor1/cor2.
const formDe = (alvo) => (alvo === 'pers' ? S.form.pers : S.form);
// O emblema de escrita usa sempre o NOME do time (no máximo 14 caracteres, só letras, números e . & ! ' + -).
const nomeDoTime = (alvo) => String((alvo === 'pers' ? S.meu?.org?.nome : S.form.nome) ?? '').trim();
const nomeServeParaTexto = (nome) => { const n = String(nome ?? '').trim(); return n.length >= 1 && n.length <= TEXTO_MAX && txLimpar(n) === n; };
function aplicarIc(alvo) {
  const f = formDe(alvo);
  if (f.modo === 'texto') {
    f.tx.t = nomeServeParaTexto(nomeDoTime(alvo)) ? nomeDoTime(alvo) : (txLimpar(nomeDoTime(alvo)).trim() || 'TIME');
     f.escudo = txCodificar(f.tx); f.cor1 = f.tx.c[0]; f.cor2 = f.tx.c[1]; return; }
  f.escudo = icCodificar(f.ic); f.cor1 = f.ic.c[0]; f.cor2 = f.ic.c[1] || f.ic.c[0];
}
// Prévia do ícone do time (símbolo ou texto, conforme o modo escolhido).
const previaIcone = (f, size, rotulo = '') => (f.modo === 'texto' ? textoHtml(f.tx, size, rotulo) : icHtml(f.ic, size, rotulo));
function seletorCor(alvo, i, nome) {
  const f = formDe(alvo); const v = f.ic.c[i];
  return `<div class="tc-ic-cor"><span>${esc(nome)}</span><input type="color" value="${v}" data-ic="${alvo}:${i}" aria-label="${esc(nome)}" />${PALETA.map((c) => `<button type="button" class="sw" style="background:${c}" data-act="ic-cor" data-alvo="${alvo}" data-i="${i}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>`;
}
function editorIcone(alvo, sigla) {
  const f = formDe(alvo); const ic = f.ic;
  const modos = `<div class="tc-modos" role="tablist" aria-label="Tipo de ícone"><button type="button" role="tab" aria-selected="${f.modo !== 'texto'}" class="${f.modo !== 'texto' ? 'on' : ''}" data-act="ic-modo" data-alvo="${alvo}" data-v="simbolo">Símbolo</button><button type="button" role="tab" aria-selected="${f.modo === 'texto'}" class="${f.modo === 'texto' ? 'on' : ''}" data-act="ic-modo" data-alvo="${alvo}" data-v="texto">Só escrita</button></div>`;
  if (f.modo === 'texto') return editorTexto(alvo, f, modos);
  const info = SIMBOLOS[ic.s - 1]; const nc = info[2].length;
  const grade = SIMBOLOS.map((sy, k) => `<button type="button" data-act="ic-sim" data-alvo="${alvo}" data-v="${k + 1}" class="${ic.s === k + 1 ? 'on' : ''}" title="${esc(sy[0])}" aria-label="${esc(sy[0])}">${icHtml(icTrocar(k + 1), 52)}</button>`).join('');
  return `<div class="tc-ic-edit">
    ${modos}
    <div class="previa">${icHtml(ic, 120, 'Ícone do time')}<div><b>${esc(info[0])}</b><div class="tc-mudo tc-peq tc-sym-info">${nc === 1 ? `Muda a cor: ${esc(info[2][0][0].toLowerCase())}. O resto do símbolo fica na cor original.` : `Este símbolo aceita até ${nc} cores.`} A aparência não dá vantagem na competição.</div></div></div>
    <div><h4>Símbolo (${N_SIMBOLOS})</h4><div class="tc-ic-grade simbolos">${grade}</div></div>
    <div class="tc-ic-cores"><h4>${nc === 1 ? 'Cor do símbolo' : 'Cores do símbolo'}</h4>${info[2].map((c, i) => seletorCor(alvo, i, c[0])).join('')}<div class="tc-acoes" style="position:static;margin:0;padding:0;background:none"><button type="button" class="tc-btn peq" data-act="ic-orig" data-alvo="${alvo}">Cores originais</button></div></div>
  </div>`;
}

// Editor do emblema de TEXTO: escrita, fonte, cores (degradê de duas cores), contorno, sombra e placa de fundo.
function corTx(alvo, rotulo, campo, i = null) {
  const f = formDe(alvo); const v = i == null ? f.tx[campo] : f.tx[campo][i]; const chave = `${alvo}:${campo}:${i ?? ''}`;
  return `<div class="tc-ic-cor"><span>${rotulo}</span><input type="color" value="${v}" data-txc="${chave}" aria-label="${rotulo}" />${PALETA.map((c) => `<button type="button" class="sw" style="background:${c}" data-act="tx-cor" data-alvo="${alvo}" data-c="${campo}" data-i="${i ?? ''}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>`;
}
function editorTexto(alvo, f, modos) {
  const tx = f.tx;
  const num = (rot, campo, max) => `<label class="tc-tx-num"><span>${rot}</span><input type="range" min="0" max="${max}" step="1" name="tx_${campo}" data-tx="${campo}" data-alvo="${alvo}" value="${tx[campo]}" /><b>${tx[campo]}</b></label>`;
  return `<div class="tc-ic-edit">${modos}
    <div class="previa tc-previa-tx">${textoHtml(tx, 120, 'Ícone do time')}<div class="tc-mudo tc-peq">Escreva o nome que vai no emblema e personalize a fonte, as cores, o contorno e a sombra. A aparência não dá vantagem na competição.</div></div>
    <p class="tc-escrita"><span class="tc-mudo tc-peq">Escrita do emblema</span><b>${esc(tx.t)}</b><small class="tc-mudo">É sempre o nome do time.</small></p>
    <div><h4>Fonte</h4><div class="tc-fontes">${FONTES.map((fo) => `<button type="button" class="${tx.f === fo.id ? 'on' : ''}" data-act="tx-fonte" data-alvo="${alvo}" data-v="${fo.id}" style="font-family:${fo.css}" aria-label="${esc(fo.nome)}"><span>${esc(txLimpar(tx.t).trim() || 'Time')}</span><small>${esc(fo.nome)}</small></button>`).join('')}</div></div>
    <div class="tc-ic-cores"><h4>Cor da escrita</h4>${corTx(alvo, 'Cima', 'c', 0)}${corTx(alvo, 'Baixo', 'c', 1)}<p class="tc-mudo tc-peq" style="margin:2px 0 0">Com cores diferentes em cima e embaixo, a escrita fica em degradê.</p></div>
    <div class="tc-ic-cores"><h4>Contorno</h4>${num('Espessura', 'ow', 8)}${tx.ow ? corTx(alvo, 'Cor do contorno', 'oc') : ''}</div>
    <div class="tc-ic-cores"><h4>Sombra</h4>${num('Distância', 'sh', 6)}${tx.sh ? corTx(alvo, 'Cor da sombra', 'sc') : ''}</div>
    <div class="tc-acoes" style="position:static;margin:0;padding:0;background:none"><button type="button" class="tc-btn peq" data-act="tx-padrao" data-alvo="${alvo}">Restaurar padrão</button></div>
  </div>`;
}

// ------------------------------------------------------------------ criar organização
function viewCriar() {
  const f = S.form;
  return `<div class="tc-criar">
    <p class="tc-eyebrow">◆ Simulador de técnico · em teste</p>
    <h1 style="font-family:'Bebas Neue',sans-serif;font-size:46px;margin:4px 0 6px">Crie a sua organização</h1>
    <p class="tc-mudo">Dê nome ao seu time, escolha a sigla e monte o ícone (um símbolo com as suas cores, ou só a escrita do nome). Você recebe créditos e, na próxima etapa, escolhe seus 5 primeiros jogadores entre 15 opções para começar na ${esc(nomeLiga().acesso || 'divisão de acesso')}. A aparência não dá vantagem na competição.</p>
    <form class="tc-card tc-form" data-form="criar" novalidate style="margin-top:16px">
      <div class="duas">
        <label class="campo"><span>Nome do time</span><input class="tc-input" name="nome" maxlength="24" autocomplete="off" value="${esc(f.nome)}" placeholder="Ex.: Aurora Esports" /></label>
        <label class="campo"><span>Sigla (2 a 4)</span><input class="tc-input" name="sigla" maxlength="4" autocomplete="off" value="${esc(f.sigla)}" placeholder="AUR" style="text-transform:uppercase" /></label>
      </div>
      <div class="campo"><span>Ícone do time</span>${editorIcone('criar', f.sigla)}</div>
      <div class="tc-previa">${previaIcone(f, 76, f.nome)}<div><div style="font-family:'Bebas Neue',sans-serif;font-size:32px">${esc(f.nome || 'Nome do time')}</div><div class="tc-mudo tc-peq">Divisão de acesso · técnico ${esc(platform.getUser()?.username || '')}</div></div></div>
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
// Troféu de cada campeonato (arte em img/trofeus): Mundial, Copa, Nacional e Academy.
const trofeuChave = (t) => (/mundial/i.test(t) ? 'mundial' : /copa/i.test(t) ? 'copa' : /nacional|principal/i.test(t) ? 'nacional' : 'academy');
const trofeuImg = (t, h = 56) => `<img class="tc-trofeu" src="img/trofeus/${trofeuChave(t)}.webp" alt="" height="${h}" loading="lazy" />`;
// Notícias que já têm banner (img/banners/<chave>.webp, e a versão -800 para telas pequenas): campeao-<campeonato> e vice.
// Para uma notícia nova ganhar banner: salvar as duas imagens e incluir a chave em BANNERS.
const BANNERS = new Set(['campeao-academy', 'campeao-nacional', 'campeao-copa', 'campeao-mundial', 'vice', 'final', 'eliminado', 'vitoria', 'derrota', 'misto', 'emdia']);
const temBanner = (k) => (BANNERS.has(k) ? k : null);
const trofeusLista = (l) => `<ul class="tc-trofeus">${l.map((t) => `<li>${trofeuImg(t.titulo)}<span>${esc(t.titulo)}<small class="tc-mudo">Temporada ${esc(t.temporada)}</small></span></li>`).join('')}</ul>`;

// Notícias do Início: a partida do dia enquanto ela não foi jogada; depois, o que aconteceu (vitória, final, campeão...) até o dia virar.
function hojeIso() {
  const c = S.painel?.calendario;
  if (!c || c.antes || !c.inicio_semana) return null;
  const [y, m, d] = c.inicio_semana.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + c.dia - 1)).toISOString().slice(0, 10);
}
const ORD = (n) => `${n}º`;
// Dia sem partidas suas (por exemplo, já eliminado): o técnico assiste ao campeonato de casa.
const noticiaEmDia = () => ({ cls: 'neutro', selo: '•', banner: temBanner('emdia'), estiloBanner: 'azul', titulo: 'Tudo em dia', texto: 'Você não tem partidas hoje. Acompanhe o campeonato de casa e prepare o elenco.' });
function noticiaDestaque(minhas, hoje, minha) {
  const meu = S.meu.org.id;
  const liga = S.painel?.liga;
  const feitas = minhas.filter((x) => x.status === 'concluida');
  const ult = feitas[feitas.length - 1];
  if (!ult) return null;
  if (hoje && ult.dia < hoje) return noticiaEmDia(); // o resultado só vale como notícia no próprio dia
  const venci = (x) => x.vencedor === meu;
  const placar = (x) => (x.a.id === meu ? `${x.placar_a} × ${x.placar_b}` : `${x.placar_b} × ${x.placar_a}`);
  const adv = (x) => esc((x.a.id === meu ? x.b : x.a).nome);
  const ligaNome = ult.liga_nome || liga?.nome || '';
  const mesmaLiga = !!liga && ult.liga_id === liga.id; // a posição final só existe na tabela da liga da divisão
  const encerrada = mesmaLiga && liga.status === 'encerrada';
  if (ult.fase === 'final') {
    return venci(ult)
      ? { cls: 'campeao', selo: trofeuImg(ligaNome, 84), banner: temBanner(`campeao-${trofeuChave(ligaNome)}`), titulo: 'Você é campeão!', texto: `Venceu a final da ${esc(ligaNome)} contra ${adv(ult)} (${placar(ult)}).`, pos: 1 }
      : { cls: 'vice', selo: '🥈', banner: temBanner('vice'), textoTopo: true, titulo: 'Vice-campeão', texto: `Perdeu a final da ${esc(ligaNome)} para ${adv(ult)} (${placar(ult)}).`, pos: 2 };
  }
  if (ult.fase === 'semi' || ult.fase === 'quartas') {
    const nome = FASES[ult.fase].toLowerCase();
    if (venci(ult)) { const fin = minhas.find((x) => x.fase === 'final' && x.status === 'agendada' && x.liga_id === ult.liga_id); return { cls: 'bom', selo: '⚔', banner: ult.fase === 'semi' ? temBanner('final') : null, estiloBanner: 'azul', titulo: ult.fase === 'semi' ? 'Você está na final!' : 'Você avançou!', texto: `Venceu a ${nome} contra ${adv(ult)} (${placar(ult)}).${fin ? ` A final é em ${dataCurta(fin.dia)}.` : ''}` }; }
    const posF = mesmaLiga ? minha?.pos_final : null;
    return { cls: 'ruim', selo: '✖', banner: temBanner('eliminado'), estiloBanner: 'vermelho', titulo: `Eliminado na ${nome}`, texto: `Perdeu para ${adv(ult)} (${placar(ult)}).${encerrada && posF ? ` Terminou o campeonato em ${ORD(posF)}.` : ` Você termina entre os ${ult.fase === 'quartas' ? 8 : 4} primeiros.`}` };
  }
  if (ult.fase === 'treino') return { cls: 'neutro', selo: '•', banner: temBanner('emdia'), estiloBanner: 'azul', titulo: 'Treino concluído', texto: `Os jogos de treino do ${esc(ligaNome)} não valem pontos, mas deram XP e Maestria ao seu elenco.` };
  const deHoje = hoje ? feitas.filter((x) => x.dia === ult.dia) : [ult];
  const vit = deHoje.filter(venci).length; const der = deHoje.length - vit;
  const titulo = deHoje.length > 1 ? (vit === deHoje.length ? 'Duas vitórias hoje!' : der === deHoje.length ? 'Dia difícil' : 'Uma vitória e uma derrota') : (vit ? 'Vitória!' : 'Derrota');
  const linhas = deHoje.map((x) => `${venci(x) ? 'Venceu' : 'Perdeu'} ${venci(x) ? 'de' : 'para'} ${adv(x)} (${placar(x)})`).join(' · ');
  return { cls: der === 0 ? 'bom' : vit === 0 ? 'ruim' : 'neutro', banner: der === 0 ? temBanner('vitoria') : vit === 0 ? temBanner('derrota') : temBanner('misto'), estiloBanner: der === 0 ? 'verde' : vit === 0 ? 'vermelho' : 'azul', selo: der === 0 ? '✔' : vit === 0 ? '✖' : '•', titulo, texto: `${linhas}.${minha ? ` Você está em ${ORD(minha.pos)} lugar, com ${minha.pontos} pt${minha.pontos === 1 ? '' : 's'}.` : ''}` };
}
// Banner do confronto do dia: time azul à esquerda, vermelho à direita (as faixas livres do fundo), VS no centro e a data na base.
function confrontoBanner(p, meu) {
  // os dois nomes usam o mesmo tamanho de letra: o do maior nome, para caber numa linha só
  const maior = Math.max(String(p.a.nome).length, String(p.b.nome).length, 1);
  const nf = Math.min(3.8, 21 / (maior * 0.46)).toFixed(2);
  const lado = (o, cls) => `<div class="tc-conf-time ${cls}"><div class="emb">${escudoOrg(o, 96)}</div><b class="nome">${esc(o.nome)}</b>${o.id === meu ? '<small class="voce">Seu time</small>' : ''}</div>`;
  const info = [dataCurta(p.dia), p.fase === 'rodada' ? `rodada ${p.rodada}` : FASES[p.fase] || '', `melhor de ${p.formato}`].filter(Boolean).join(' · ');
  return `<div class="tc-confronto" style="--nf:${nf}cqw"><img src="img/banners/confronto.webp" srcset="img/banners/confronto-800.webp 800w, img/banners/confronto.webp 1400w" sizes="(max-width: 900px) 100vw, 860px" alt="" />
    <span class="tc-conf-topo">Partida do dia</span>${lado(p.a, 'a')}<b class="tc-conf-vs">VS</b>${lado(p.b, 'b')}<span class="tc-conf-info">${esc(info)}</span></div>`;
}
function viewNoticias(minha) {
  const p = S.painel || {}; const meu = S.meu.org.id;
  const hoje = hojeIso();
  const todas = new Map(); [...(p.liga?.partidas || []), ...(p.ultimos || []), ...(p.proxima && p.proxima.id ? [p.proxima] : [])].forEach((x) => todas.set(x.id, x)); // inclui Copa e Mundial
  const minhas = [...todas.values()].filter((x) => x.a.id === meu || x.b.id === meu).sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : a.id - b.id));
  const jogar = S.gp?.ativo && S.gp.partida ? `<p style="text-align:center;margin:12px 0 0"><a class="tc-btn ouro" style="display:inline-block;text-decoration:none" href="partida/?id=${S.gp.partida.id}">Jogar a partida · mapa ${S.gp.proximo?.mapa || 1}</a></p>` : '';
  const pendenteHoje = hoje && minhas.some((x) => x.dia <= hoje && x.status === 'agendada');
  const prox = p.proxima;
  if ((pendenteHoje || S.gp?.partida) && prox && prox.id) {
    const doDia = minhas.filter((x) => x.status === 'agendada' && (!hoje || x.dia <= hoje)).slice(0, 3);
    const itens = doDia.length ? doDia : [prox];
    const i = Math.min(Math.max(S.confIdx || 0, 0), itens.length - 1);
    const nav = itens.length > 1 ? `<button type="button" class="tc-conf-seta e" data-act="conf-nav" data-d="-1" aria-label="Partida anterior">‹</button><button type="button" class="tc-conf-seta d" data-act="conf-nav" data-d="1" aria-label="Próxima partida">›</button>
      <div class="tc-conf-pontos">${itens.map((_, k) => `<button type="button" class="${k === i ? 'on' : ''}" data-act="conf-nav" data-i="${k}" aria-label="Partida ${k + 1} de ${itens.length}"></button>`).join('')}</div>` : '';
    return `<section class="tc-card tc-prox"><h3>${IMG('i-msg')}Notícias<span class="dir">${itens.length > 1 ? `confronto ${i + 1} de ${itens.length}` : 'partida do dia'}</span></h3><div class="tc-confrontos">${confrontoBanner(itens[i], meu)}${nav}</div>${jogar}</section>`;
  }
  const d = noticiaDestaque(minhas, hoje, minha) || noticiaEmDia();
  const campEnc = p.liga?.status === 'encerrada';
  let rodape = '';
  if (prox && prox.id) rodape = `<div class="tc-noti-prox"><small>Próxima partida · ${dataCurta(prox.dia)}</small><div class="tc-noti-vs">${escudoOrg(prox.a, 30)}<b>${esc(prox.a.nome)}</b><span>×</span><b>${esc(prox.b.nome)}</b>${escudoOrg(prox.b, 30)}</div></div>`;
  else if (campEnc) rodape = '<p class="tc-mudo tc-peq" style="margin:10px 0 0;text-align:center">O campeonato terminou. As partidas do próximo começam quando a nova semana abrir.</p>';
  else rodape = '<p class="tc-mudo tc-peq" style="margin:10px 0 0;text-align:center">Sem partidas por agora. As próximas rodadas aparecem quando a semana começar.</p>';
  const corpo = d && d.banner
    ? `<div class="tc-noti-banner${d.textoTopo ? ' topo' : ''}${d.estiloBanner ? ` ${d.estiloBanner}` : ''}"><img src="img/banners/${d.banner}.webp" srcset="img/banners/${d.banner}-800.webp 800w, img/banners/${d.banner}.webp 1400w" sizes="(max-width: 900px) 100vw, 860px" alt="" /><div class="tc-noti-banner-txt"><b class="tit">${d.titulo}</b><p>${d.texto}</p></div></div>`
    : d
    ? `<div class="tc-noti ${d.cls}"><div class="selo" aria-hidden="true">${d.selo}</div><div><b class="tit">${d.titulo}</b><p>${d.texto}</p></div></div>`
    : '';
  return `<section class="tc-card tc-prox"><h3>${IMG('i-msg')}Notícias</h3>${corpo}${rodape}</section>`;
}

function viewVisao() {
  const m = S.meu; const p = S.painel || {};
  const tit = titulares();
  const liga = p.liga;
  const minha = liga?.tabela?.find((t) => t.org.id === m.org.id);
  const prox = p.proxima;
  return `
  <div class="tc-hero">
    ${viewNoticias(minha)}
    <section class="tc-card tc-eco"><h3>${IMG('i-bau')}Sua economia</h3>
      <div class="duo"><div class="bx ouro"><img src="../../shared/assets/moeda/rc-96.webp" srcset="../../shared/assets/moeda/rc-192.webp 2x" alt="" width="44" height="44" /><small>Rift Coins</small><b>${fmt(m.rc)}</b></div>
      <div class="bx azul"><img src="img/credito-96.webp" srcset="img/credito-192.webp 2x" alt="" width="48" height="48" /><small>Créditos</small><b>${fmt(m.org.creditos)}</b></div></div>
      <p class="tc-mudo tc-peq" style="margin:10px 0 0;text-align:center">Contratos em vigor: ${fmt(m.salarios_semana)} cr./semana (já pagos)</p></section>
  </div>
  <section class="tc-card"><h3>Poder da equipe<span class="dir">Semana ${((m.semana % 4) + 4) % 4 + 1}</span></h3>
      <div class="tc-poder"><div class="grande">${m.poder}</div><div style="flex:1"><div class="tc-barra"><i style="width:${Math.min(100, m.poder / PODER_MAX * 100)}%"></i></div>
        <p class="tc-mudo tc-peq" style="margin:8px 0 0">Média do Poder dos titulares na posição em que jogam, mais a sinergia (${S.idiomas ? `${S.idiomas.sinergia_total}/100: ${S.idiomas.sinergia_semanal} do tempo juntos + ${S.idiomas.sinergia_idiomas} da comunicação` : `${m.org.sinergia}/100`}). ${m.completo ? '' : '<b style="color:#fbbf24">Faltam titulares.</b>'}</p></div></div>${comunicacaoHtml()}</section>
  <section class="tc-card"><h3>Escalação titular<span class="dir">${fmt(m.salarios_semana)} cr./semana em contratos (pagos adiantado)</span></h3>
    <div class="tc-escala">${VAGAS.map((v) => `<div class="vaga"><span class="rot">${NOME_VAGA[v]}</span>${tit[v] ? cartao(tit[v], { tit: false }) : `<div class="tc-vazio">Vaga livre<br><button type="button" class="tc-btn peq" data-act="aba" data-aba="elenco" style="margin-top:8px">Escalar</button></div>`}</div>`).join('')}</div></section>
  <div class="tc-grade2">
    <section class="tc-card"><h3>Classificação${liga ? ` · ${esc(liga.nome)}` : ''}</h3>${liga ? tabelaHtml(liga.tabela, m.org.id, true) : '<p class="tc-mudo">Sua equipe entra na liga da próxima semana. Enquanto isso, monte o elenco e use o mercado.</p>'}</section>
    <div style="display:flex;flex-direction:column;gap:16px">
      <section class="tc-card"><h3>Avisos</h3>${(m.avisos || []).length ? `<ul class="tc-avisos">${m.avisos.slice(0, 6).map((a) => `<li>${esc(a.texto)}</li>`).join('')}</ul>` : '<p class="tc-mudo" style="margin:0">Nada por aqui. Contratos próximos do fim e vendas aparecem nesta lista.</p>'}</section>
    </div>
  </div>
  ${(p.ultimos || []).length ? `<section class="tc-card"><h3>Últimos resultados</h3><div class="tc-lista">${p.ultimos.map((x) => partidaLinha(x)).join('')}</div></section>` : ''}`;
}

function financasHtml(f) {
  if (!f || !f.length) return '<p class="tc-mudo" style="margin:0">Sem movimentações ainda.</p>';
  return `<table class="tc-tabela"><tbody>${f.slice(0, 20).map((x) => `<tr><td>${nomeMovimento(x)}</td><td class="n" style="color:${x.delta >= 0 ? 'var(--bom)' : 'var(--ruim)'}">${x.delta >= 0 ? '+' : '−'}${fmt(Math.abs(x.delta))}</td></tr>`).join('')}</tbody></table>`;
}

function tabelaHtml(tab, meuId, compacta = false) {
  return `<div class="tc-tabela-rolagem"><table class="tc-tabela"><thead><tr><th>#</th><th>Equipe</th>${compacta ? '' : '<th class="n">J</th>'}<th class="n">V</th><th class="n">D</th>${compacta ? '' : '<th class="n">Mapas</th><th class="n">Saldo</th>'}<th class="n">Pts</th>${compacta ? '' : '<th>Situação</th>'}</tr></thead><tbody>
    ${tab.map((t) => `<tr class="${t.org.id === meuId ? 'eu' : ''}"><td>${t.pos}</td><td><div class="org">${escudoOrg(t.org, 24)}<span>${esc(t.org.nome)}${t.org.usuario ? ' <span title="Técnico real">★</span>' : ''}</span></div></td>${compacta ? '' : `<td class="n">${t.partidas}</td>`}<td class="n">${t.vitorias}</td><td class="n">${t.derrotas}</td>${compacta ? '' : `<td class="n">${t.mapas_pro}-${t.mapas_contra}</td><td class="n">${t.saldo > 0 ? '+' : ''}${t.saldo}</td>`}<td class="n"><b>${t.pontos}</b></td>${compacta ? '' : `<td>${t.situacao ? `<span class="tc-sit ${t.situacao}">${{ promocao: 'Promoção', copa: 'Vaga na Copa', mundial: 'Vaga no Mundial', semi: 'Semifinais', quartas: 'Quartas', permanece: '—', eliminado: '—' }[t.situacao] || ''}</span>` : ''}</td>`}</tr>`).join('')}
  </tbody></table></div>`;
}

function dataCurta(d) { const [, m, dd] = String(d).split('-'); return `${dd}/${m}`; }
function vsCard(p) {
  return `<div class="tc-vs"><div class="lado">${escudoOrg(p.a, 84)}<b>${esc(p.a.nome)}</b></div><div class="x">VS</div><div class="lado">${escudoOrg(p.b, 84)}<b>${esc(p.b.nome)}</b></div></div>
    <p class="tc-vs-info">${dataCurta(p.dia)} · ${p.fase === 'rodada' ? `rodada ${p.rodada}` : FASES[p.fase] || ''} · melhor de ${p.formato}</p>`;
}
function partidaLinha(p, proxima = false, comLiga = false) {
  const feita = p.status === 'concluida';
  const meu = S.meu?.org?.id;
  return `<button type="button" class="tc-partida" data-act="partida" data-id="${p.id}" ${feita ? '' : 'disabled'}>
    <span class="time">${escudoOrg(p.a, 30)}<span>${esc(p.a.nome)}</span></span>
    <span class="meio">${feita ? `<span class="placar"><span class="${p.vencedor === p.a.id ? 'v' : ''}">${p.placar_a}</span> - <span class="${p.vencedor === p.b.id ? 'v' : ''}">${p.placar_b}</span></span>${p.wo ? '<span class="tc-wo" title="Derrota por W.O.: o time não jogou até a meia-noite">W.O.</span>' : ''}` : '<span class="placar">VS</span>'}<span class="qd">${comLiga && p.liga_nome ? `${esc(String(p.liga_nome).split(' · ')[0])} · ` : ''}${dataCurta(p.dia)} · ${p.fase === 'rodada' ? `rodada ${p.rodada}` : FASES[p.fase] || ''} · MD${p.formato}${feita && meu && (p.a.id === meu || p.b.id === meu) ? (p.vencedor === meu ? ' · <b style="color:var(--bom)">vitória</b>' : ' · <b style="color:var(--ruim)">derrota</b>') : ''}</span></span>
    <span class="time dir"><span>${esc(p.b.nome)}</span>${escudoOrg(p.b, 30)}</span></button>`;
}

// Ordenação rápida do inventário: clicar de novo no mesmo botão inverte a ordem (maior→menor / menor→maior).
const RARIDADE_N = { comum: 1, raro: 2, epico: 3, lendario: 4, mitico: 5 };
const ORD_INV = [
  ['poder', 'OVR', (j) => j.poder || 0, 'desc'], ['raridade', 'Raridade', (j) => RARIDADE_N[j.raridade] || 0, 'desc'], ['copias', 'Cópias', (j) => j.copias || 0, 'desc'],
  ['estrelas', 'Estrelas', (j) => j.estrelas || 0, 'desc'], ['potencial', 'Potencial', (j) => j.potencial ?? 0, 'desc'], ['fama', 'Fama', (j) => j.fama || 0, 'desc'],
  ['idade', 'Idade', (j) => j.idade || 0, 'asc'], ['pos', 'Posição', (j) => VAGAS.indexOf(j.pos), 'asc'], ['nome', 'Nome', (j) => String(j.nome || '').toLowerCase(), 'asc'],
];
function ordenarInventario(lista) {
  const o = S.invOrd; const def = ORD_INV.find((x) => x[0] === o.k); if (!def) return lista;
  const sinal = o.dir === 'asc' ? 1 : -1;
  return [...lista].sort((a, b) => { const x = def[2](a), y = def[2](b); const c = typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y; return c ? c * sinal : (b.poder || 0) - (a.poder || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
}
function barraOrdemInventario() {
  const o = S.invOrd;
  const chips = ORD_INV.map(([k, nome]) => { const on = o.k === k; return `<button type="button" class="tc-ord${on ? ' on' : ''}" data-act="inv-ord" data-k="${k}" aria-pressed="${on}" title="${on ? 'Clique para inverter a ordem' : `Ordenar por ${nome}`}">${nome}${on ? `<i>${o.dir === 'desc' ? '▼' : '▲'}</i>` : ''}</button>`; }).join('');
  return `<div class="tc-ords" role="group" aria-label="Ordenar inventário"><span class="tc-eyebrow">Ordenar</span>${chips}${o.k ? '<button type="button" class="tc-ord limpar" data-act="inv-ord" data-k="">Padrão</button>' : ''}</div>`;
}

// ------------------------------------------------------------------ elenco
function viewElenco() {
  const el = S.meu.elenco || [];
  const tit = el.filter((j) => j.slot); const res = el.filter((j) => !j.slot);
  const ativos = new Set(S.meu.ativos || []); const reservas = res.filter((j) => ativos.has(j.id)); const guardados = res.filter((j) => !ativos.has(j.id));
  return `<section class="tc-card"><h3>Titulares<span class="dir">${tit.length}/5</span></h3>
      <div class="tc-escala">${VAGAS.map((v) => { const j = tit.find((x) => x.slot === v); return `<div class="vaga"><span class="rot">${NOME_VAGA[v]}</span>${j ? cartao(j, { tit: false }) : '<div class="tc-vazio">Vaga livre</div>'}</div>`; }).join('')}</div></section>
    <section class="tc-card"><h3>Reservas<span class="dir">${reservas.length}/${S.meu.reservas_max || 5} </span></h3>
      ${reservas.length ? `<div class="tc-jogs">${reservas.map((j) => cartao(j)).join('')}</div>` : '<p class="tc-mudo" style="margin:0">Sem reservas. Contrate jogadores no Mercado.</p>'}</section>
    <section class="tc-card"><h3>Inventário<span class="dir">${el.length}/${ELENCO_MAX} jogadores</span></h3>
      <p class="tc-mudo tc-peq" style="margin:0 0 8px">Jogadores guardados para quando você precisar. As 5 melhores reservas (por Poder) ficam à mostra; o resto fica aqui. Repetidos de Legado viram cópia e não ocupam espaço.</p>
      ${guardados.length ? `${barraOrdemInventario()}<div class="tc-jogs">${ordenarInventario(guardados).map((j) => cartao(j)).join('')}</div>` : '<p class="tc-mudo" style="margin:0">Nenhum jogador guardado.</p>'}</section>`;
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
  </div><div class="tc-acoes"><button class="tc-btn ciano" type="submit">Aplicar filtros</button><button class="tc-btn" type="button" data-act="limpar-filtros">Limpar</button>${oficial ? rotacaoBloco() : ''}</div></form>`;
}
function viewContratar() {
  const m = S.mercado;
  const lista = m.aba === 'oficial' ? m.oficial : m.usuarios;
  return `<div class="tc-abas"><button type="button" data-act="mercado-aba" data-v="oficial" class="${m.aba === 'oficial' ? 'on' : ''}">Mercado oficial</button><button type="button" data-act="mercado-aba" data-v="usuarios" class="${m.aba === 'usuarios' ? 'on' : ''}">Mercado de usuários</button></div>
    <p class="tc-mudo tc-peq" style="margin:0">${m.aba === 'oficial' ? '' : `Anúncios de outros técnicos, pagos com Rift Coins (taxa de ${TAXA_MERCADO_PCT}% descontada do vendedor). Preço fixo.`}</p>
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
  return `<section class="tc-card"><h3>Campeonatos<span class="dir">Temporada ${l.temporada} · semana ${l.semana}</span></h3>
      <label class="campo" style="max-width:420px"><span class="tc-mudo tc-peq">Competição</span><select class="tc-input" data-act="liga-sel">${ligas.map((x) => `<option value="${x.id}" ${x.id === l.id ? 'selected' : ''}>${esc(x.nome)}${x.status === 'aberta' ? ' (em andamento)' : ''}</option>`).join('')}</select></label>
      ${regrasLiga(l) ? `<p class="tc-peq tc-mudo" style="margin:10px 0 0">${regrasLiga(l)}</p>` : ''}</section>
    ${vagasCard()}
    ${l.tipo !== 'divisao' ? tabelasIntl(l) : `<section class="tc-card"><h3>Classificação<span class="dir">${esc(l.nome)}</span></h3>${tabelaHtml(l.tabela, S.meu.org.id)}</section>`}
    ${chaveamento(l)}
    <section class="tc-card"><h3>Calendário e resultados</h3>${diasHtml(l)}</section>`;
}
const FASES = { rodada: 'Rodada', treino: 'Treino', quartas: 'Quartas de final', semi: 'Semifinal', final: 'Final' };
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
// Rodadas minimizadas: um bloco por dia (2 rodadas) com resumo dos seus resultados; clicar abre os confrontos.
function resumoDia(ps) { // devolve { html, cls }: vitórias em verde, derrotas em vermelho, jogos pendentes em dourado
  const meu = S.meu?.org?.id; const meus = ps.filter((p) => p.a.id === meu || p.b.id === meu);
  if (!meus.length) return { html: `<span class="chip">${plural(ps.length, 'partida', 'partidas')}</span>`, cls: '' };
  const feitas = meus.filter((p) => p.status === 'concluida'); const v = feitas.filter((p) => p.vencedor === meu).length; const d = feitas.length - v;
  const pend = meus.length - feitas.length;
  const chips = [];
  if (v) chips.push(`<span class="chip v">${plural(v, 'vitória', 'vitórias')}</span>`);
  if (d) chips.push(`<span class="chip d">${plural(d, 'derrota', 'derrotas')}</span>`);
  if (pend) chips.push(`<span class="chip a">${pend} a jogar</span>`);
  return { html: chips.join(''), cls: pend ? 'a' : v && !d ? 'v' : d && !v ? 'd' : 'm' };
}
function diasHtml(l) {
  const dias = {};
  l.partidas.filter((p) => p.fase === 'rodada' || !['semi', 'final'].includes(p.fase)).forEach((p) => { (dias[p.dia] ||= []).push(p); });
  const abertos = S.campAbertos || (S.campAbertos = {});
  return Object.keys(dias).sort().map((d) => {
    const ps = dias[d]; const chave = `${l.id}:${d}`; const aberto = !!abertos[chave];
    const rods = [...new Set(ps.map((p) => p.rodada))].sort((x, y) => x - y);
    const titulo = ps[0].fase === 'rodada' ? `${dataCurta(d)} · ${rods.length > 1 ? `Rodadas ${rods.join(' e ')}` : `Rodada ${rods[0]}`}` : `${dataCurta(d)} · ${FASES[ps[0].fase] || ''}`;
    const r = resumoDia(ps);
    return `<div class="tc-dia r-${r.cls} ${aberto ? 'aberto' : ''}"><button type="button" class="tc-dia-cab" data-act="camp-dia" data-k="${chave}" aria-expanded="${aberto}"><span class="seta">${aberto ? '▾' : '▸'}</span><b>${titulo}</b><span class="res">${r.html}</span></button>
      ${aberto ? `<div class="tc-lista">${ps.map((p) => partidaLinha(p)).join('')}</div>` : ''}</div>`;
  }).join('');
}
// Chaveamento (semifinais -> final -> campeão); os times aparecem avançando conforme os resultados.
function chaveamento(l) {
  const sem = l.partidas.filter((p) => p.fase === 'semi'); if (!sem.length && !l.partidas.some((p) => p.fase === 'final')) return '';
  const meu = S.meu?.org?.id;
  const time = (org, placar, venceu, perdeu) => (org ? `<div class="ch-t ${venceu ? 'v' : ''} ${perdeu ? 'p' : ''} ${org.id === meu ? 'eu' : ''}">${escudoOrg(org, 24)}<span>${esc(org.nome)}</span><b>${placar ?? ''}</b></div>` : '<div class="ch-t vazio"><span>A definir</span><b></b></div>');
  const cartao = (p, slots) => {
    if (!p) return `<div class="ch-c pend">${time(slots[0], null)}${time(slots[1], null)}</div>`;
    const feita = p.status === 'concluida';
    return `<button type="button" class="ch-c ${feita ? '' : 'pend'}" ${feita ? `data-act="partida" data-id="${p.id}"` : 'disabled'}>${time(p.a, feita ? p.placar_a : null, feita && p.vencedor === p.a.id, feita && p.vencedor !== p.a.id)}${time(p.b, feita ? p.placar_b : null, feita && p.vencedor === p.b.id, feita && p.vencedor !== p.b.id)}<small>${dataCurta(p.dia)} · MD${p.formato}</small></button>`;
  };
  const final = l.partidas.find((p) => p.fase === 'final');
  const venc = (p) => (p && p.status === 'concluida' ? (p.vencedor === p.a.id ? p.a : p.b) : null);
  const colunas = [];
  const quartas = l.partidas.filter((p) => p.fase === 'quartas'); if (quartas.length) colunas.push(['Quartas de final', quartas.map((p) => cartao(p)).join('')]);
  colunas.push(['Semifinais', sem.map((p) => cartao(p)).join('')]);
  colunas.push(['Final', cartao(final, [venc(sem[0]), venc(sem[1])])]);
  const campeao = venc(final);
  colunas.push(['Campeão', `<div class="ch-camp ${campeao ? 'tem' : ''}">${campeao ? `${escudoOrg(campeao, 56)}<b>${esc(campeao.nome)}</b><span>🏆 Campeão</span>` : '<span class="tc-mudo">A definir</span>'}</div>`]);
  return `<section class="tc-card"><h3>Chaveamento</h3><div class="ch">${colunas.map(([t, h]) => `<div class="ch-col"><h5>${t}</h5><div class="ch-cards">${h}</div></div>`).join('')}</div></section>`;
}
function regrasLiga(l) {
  const n = nomeLiga();
  if (l.tipo === 'copa') return `16 equipes (técnicos classificados e equipes do sistema). De segunda a sexta, 2 jogos por dia contra equipes diferentes (melhor de 1). Os 4 melhores jogam as semifinais no sábado (melhor de 3) e a final no domingo (melhor de 5). Contra a equipe de outro técnico você joga contra o bot dela, e cada um conta o próprio resultado. O campeão ganha vaga no ${esc(n.mundial)}.`;
  if (l.tipo === 'mundial') return `16 equipes em 4 grupos de 4, sorteados por potes de poder. Segunda: treino. Terça a quinta: 2 jogos por dia contra o seu grupo (cada adversário duas vezes). Sexta: quartas de final (melhor de 3) com os 2 primeiros de cada grupo; sábado, semifinais (melhor de 3); domingo, a final (melhor de 5).`;
  if (l.divisao === 'acesso') return `Os 2 primeiros sobem para a ${esc(n.principal)}; os demais continuam na ${esc(n.acesso)}.`;
  return l.semana === 1 || l.semana === 4
    ? `Os 2 primeiros ganham vaga na ${esc(n.copa)}${l.semana === 4 ? ' da próxima temporada' : ''}. Não há rebaixamento.`
    : `Os 2 primeiros ganham vaga no ${esc(n.mundial)}. Não há rebaixamento.`;
}
// Vagas internacionais já conquistadas pelo técnico.
function vagasCard() {
  const v = S.camp?.vagas || []; if (!v.length) return '';
  const n = nomeLiga();
  return `<section class="tc-card"><h3>Suas vagas</h3><ul class="tc-avisos">${v.map((x) => `<li>${x.tipo === 'copa' ? esc(n.copa) : esc(n.mundial)} · temporada ${x.temporada}</li>`).join('')}</ul></section>`;
}
// Copa: tabela geral de 16; Mundial: uma tabela por grupo.
function tabelasIntl(l) {
  const meuId = S.meu.org.id;
  if (l.tipo === 'copa') return `<section class="tc-card"><h3>Classificação</h3><p class="tc-mudo tc-peq" style="margin:0 0 8px">Os 4 primeiros vão às semifinais.</p>${tabelaHtml(l.tabela, meuId)}</section>`;
  const grupos = [...new Set(l.tabela.map((t) => t.grupo))].filter(Boolean).sort();
  return `<section class="tc-card"><h3>Fase de grupos</h3><p class="tc-mudo tc-peq" style="margin:0 0 8px">Os 2 primeiros de cada grupo vão às quartas de final.</p>
    <div class="tc-grupos">${grupos.map((g) => `<div><h4 class="tc-eyebrow">Grupo ${esc(g)}</h4>${tabelaHtml(l.tabela.filter((t) => t.grupo === g), meuId)}</div>`).join('')}</div></section>`;
}
// ------------------------------------------------------------------ rank de Poder (técnicos reais)
const RANK_POR_PAGINA = 10;
function viewRank() {
  const r = S.rank; if (!r) return '<p class="tc-carregando">Carregando…</p>';
  if (!r.length) return '<section class="tc-card"><p class="tc-mudo" style="margin:0">Ainda não há técnicos no rank.</p></section>';
  const paginas = Math.max(1, Math.ceil(r.length / RANK_POR_PAGINA)); const pag = Math.min(Math.max(1, S.rankPag || 1), paginas); S.rankPag = pag;
  const ini = (pag - 1) * RANK_POR_PAGINA; const vis = r.slice(ini, ini + RANK_POR_PAGINA);
  const eu = r.find((t) => t.meu); const euForaDaPagina = eu && !vis.includes(eu);
  const linha = (t, extra = false) => `<tr class="lnk${t.meu ? ' eu' : ''}${extra ? ' extra' : ''}" data-act="rank-time" data-org="${t.org.id}" tabindex="0" role="button" aria-label="Ver os titulares de ${esc(t.org.nome)}">
      <td class="pos p${t.pos <= 3 ? t.pos : 0}">${t.pos}</td>
      <td><div class="org">${escudoOrg(t.org, 34)}<span>${esc(t.org.nome)}${t.meu ? ' <small class="tc-mudo">(você)</small>' : ''}</span></div></td>
      <td class="c comp">${t.competicao ? esc(t.competicao) : '<span class="tc-mudo">—</span>'}</td>
      <td class="c"><b>${t.poder}</b></td>
      <td class="c"><span class="tc-tit">${t.titulos > 0 ? '🏆 ' : ''}${t.titulos}</span></td></tr>`;
  const nav = paginas > 1 ? `<div class="tc-pagina" role="navigation" aria-label="Páginas do rank"><button type="button" class="tc-btn peq" data-act="rank-pag" data-p="${pag - 1}" ${pag <= 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>
      ${Array.from({ length: paginas }, (_, i) => `<button type="button" class="tc-btn peq${i + 1 === pag ? ' on' : ''}" data-act="rank-pag" data-p="${i + 1}" ${i + 1 === pag ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')}
      <button type="button" class="tc-btn peq" data-act="rank-pag" data-p="${pag + 1}" ${pag >= paginas ? 'disabled' : ''} aria-label="Próxima página">›</button></div>` : '';
  return `<section class="tc-card"><h3>Rank de Poder<span class="dir">${r.length} time(s) · página ${pag} de ${paginas}</span></h3>
    <p class="tc-mudo tc-peq" style="margin:0 0 10px">Os times dos técnicos reais, do maior Poder para o menor. Clique em uma linha para ver os titulares.</p>
    <div class="tc-tabela-rolagem"><table class="tc-tabela tc-rank"><colgroup><col class="c-pos"><col class="c-time"><col class="c-comp"><col class="c-n"><col class="c-n"></colgroup>
      <thead><tr><th>#</th><th>Time</th><th class="c">Competição atual</th><th class="c">Poder</th><th class="c">Títulos</th></tr></thead><tbody>
      ${vis.map((t) => linha(t)).join('')}
      ${euForaDaPagina ? `<tr class="sep" aria-hidden="true"><td colspan="5"><span>Sua posição</span></td></tr>${linha(eu, true)}` : ''}
      </tbody></table></div>${nav}</section>`;
}
function rankTimeHtml(m) {
  if (!m.d) return '<p class="tc-carregando">Carregando…</p>';
  const d = m.d;
  const tier = (v) => (v >= 90 ? 'ouro' : v >= 80 ? 'teal' : v >= 65 ? 'azul' : v >= 50 ? 'cinza' : 'bronze');
  const cor = { ouro: '#f5cf5a', teal: '#5eead4', azul: '#67c7ff', cinza: '#a3b3c9', bronze: '#c99a6a' };
  const attr = (j) => ATRIBUTOS.filter((a) => a.id !== 'fama').map((a, i) => { const v = j[a.id]; const t = tier(v); return `<div class="fa-linha"><span class="nm">${a.nome}</span><div class="fa-barra"><i class="t-${t}" style="--w:${Math.max(0, Math.min(100, v))}%;--i:${i}"></i></div><b style="color:${cor[t]}">${v}</b></div>`; }).join('');
  const card = (j) => `<article class="tc-rt-j${j.raridade ? ` r-${j.raridade}` : ''}">
      <header><div class="foto tc-moldura${j.raridade ? ` r-${j.raridade}` : ''}">${retratoSvg(j, 64)}</div>
        <div class="id"><span class="pos">${NOME_VAGA[j.slot] || j.slot}</span><b>${esc(j.nome)}${j.legado ? ' <i class="tc-estrela">◆</i>' : ''}</b>${estrelasHtml(j)}</div>
        ${escudoHtml(j.poder)}</header>
      <div class="fa-attrs">${attr(j)}</div>
      <div class="mae"><span class="tc-eyebrow">Maestria</span>${(j.campeoes || []).length ? j.campeoes.slice(0, 3).map((c) => `<div class="${c.favorito ? 'fav' : ''}" title="${esc(c.nome)} · ${fmt(c.pontos)} pts">${campIcone(c.nome, 28)}<span><b>${esc(c.nome)}</b><small>${c.favorito ? '★ ' : ''}${nomeMaestria(c.nivel)}</small></span></div>`).join('') : '<small class="tc-mudo">Sem campeões ainda</small>'}</div>
    </article>`;
  return `<h2>${escudoOrg(d.org, 40)} ${esc(d.org.nome)}</h2>
    <p class="tc-mudo tc-peq" style="margin:2px 0 12px">Poder da equipe <b>${d.poder}</b> · ${d.titulos} título(s) · time titular</p>
    <div class="tc-rt">${d.titulares.length ? d.titulares.map(card).join('') : '<p class="tc-mudo">Este time ainda não tem titulares.</p>'}</div>`;
}

// ------------------------------------------------------------------ histórico
function viewHist() {
  const h = S.hist; if (!h) return '<p class="tc-carregando">Carregando…</p>';
  const tipos = { inicial: 'Elenco inicial', bau: 'Baú de Recrutamento', bau_copia: 'Baú de Recrutamento · cópia', contratacao: 'Contratação', compra_usuario: 'Compra entre usuários', renovacao: 'Renovação', liberado: 'Liberado', expirou: 'Contrato terminou', substituto: 'Substituto' };
  return `<div class="tc-grade2">
    <section class="tc-card"><h3>Transferências e contratos</h3>${h.transferencias.length ? `<table class="tc-tabela"><tbody>${h.transferencias.slice(0, 20).map((t) => `<tr><td><b>${esc(t.jogador)}</b><br><span class="tc-mudo tc-peq">${tipos[t.tipo] || t.tipo}${t.de ? ` · de ${esc(t.de)}` : ''}${t.para ? ` · para ${esc(t.para)}` : ''}</span></td><td class="n">${t.valor ? `<span class="tc-preco ${t.moeda === 'rc' ? 'rc' : 'cr'}">${fmt(t.valor)}</span>` : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="tc-mudo" style="margin:0">Nada ainda.</p>'}</section>
    <div style="display:flex;flex-direction:column;gap:16px">
      <section class="tc-card"><h3>Premiações</h3>${h.premios.length ? `<table class="tc-tabela"><tbody>${h.premios.map((p) => `<tr><td>${esc(p.liga)}<br><span class="tc-mudo tc-peq">${p.posicao}º lugar${p.pdr != null ? ` · ${p.pdr > 0 ? '+' : ''}${p.pdr} PDR` : ''}</span></td><td class="n"><span class="tc-preco cr">${fmt(p.creditos)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="tc-mudo" style="margin:0">Sem premiações ainda.</p>'}</section>
      <section class="tc-card"><h3>Troféus</h3>${h.trofeus.length ? `${trofeusLista(h.trofeus)}` : '<p class="tc-mudo" style="margin:0">Nenhum troféu ainda.</p>'}</section>
      <section class="tc-card"><h3>Finanças</h3>${financasHtml(h.financas)}</section></div></div>
    <section class="tc-card"><h3>Partidas</h3>${h.partidas.length ? `<div class="tc-lista">${h.partidas.slice(0, 10).map((p) => partidaLinha(p, false, true)).join('')}</div>` : '<p class="tc-mudo" style="margin:0">Nenhuma partida disputada.</p>'}</section>`;
}

// ------------------------------------------------------------------ ADM (só administradores): campeões e jogadores
function viewAdm() {
  const a = S.admAba || 'campeoes';
  return `<div class="tc-abas"><button type="button" data-act="adm-aba" data-v="campeoes" class="${a === 'campeoes' ? 'on' : ''}">Campeões</button><button type="button" data-act="adm-aba" data-v="jogadores" class="${a === 'jogadores' ? 'on' : ''}">Jogadores</button></div>
    ${a === 'campeoes' ? viewCampeoes() : viewAdmJogadores()}`;
}
function viewCampeoes() {
  const d = S.campeoes; if (!d) return '<p class="tc-carregando">Carregando…</p>';
  const f = S.fc; const q = f.busca.trim().toLowerCase();
  const todos = d.campeoes;
  const lista = todos.filter((c) => (!q || c.nome.toLowerCase().includes(q)) && (!f.pos || c.posicoes.includes(f.pos)) && (!f.classe || c.classes.includes(f.classe)) && (!f.regiao || c.regioes.includes(f.regiao)));
  const uniq = (k) => [...new Set(todos.flatMap((c) => c[k]))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sel = (nome, rot, ops, todosRot) => `<label>${rot}<select name="${nome}" data-fc>${`<option value="">${todosRot}</option>` + ops.map(([v, t]) => `<option value="${esc(v)}" ${f[nome] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const m = d.maestria || {};
  return `<section class="tc-card"><h3>${IMG('i-plantel')}Campeões<span class="dir">${lista.length} de ${todos.length}</span></h3>
    <div class="tc-filtros" style="margin-bottom:0"><label>Buscar<input name="busca" data-fc value="${esc(f.busca)}" placeholder="Nome do campeão" autocomplete="off" /></label>
      ${sel('pos', 'Posição', VAGAS.map((v) => [v, NOME_VAGA[v]]), 'Todas')}${sel('classe', 'Classe', uniq('classes').map((v) => [v, v]), 'Todas')}${sel('regiao', 'Região', uniq('regioes').map((v) => [v, v]), 'Todas')}</div>
    <p class="tc-mudo tc-peq" style="margin:10px 0 0">Cada jogador pode ter até <b>${m.favoritos_max || FAVORITOS_MAX} campeões favoritos</b>. Quanto mais ele joga com um campeão, mais maestria ganha: a cada mapa são ${m.pontos_vitoria || 30} pontos na vitória e ${m.pontos_derrota || 15} na derrota. Com ${m.limiar || 150} pontos ele entra na lista de favoritos e, ao jogar com o campeão, ganha um bônus de Poder que cresce com o nível (${(m.bonus_pct || []).slice(1).map((b) => `+${b}%`).join(', ')}).</p></section>
  <div class="tc-camps">${lista.map((c) => `<div class="tc-camp">${campIcone(c.nome, 56)}<div class="tx"><b>${esc(c.nome)}</b><span class="pp">${c.posicoes.map((p) => `<i class="tc-vaga-ic v-${p}">${SIGLA_VAGA[p]}</i>`).join('')}</span>${S.ehAdmin ? `<span class="pp tc-pos-edit" title="Só administradores: clique para incluir ou tirar uma posição">${VAGAS.map((v) => `<button type="button" class="tc-vaga-ic v-${v} ${c.posicoes.includes(v) ? 'on' : ''}" data-act="camp-pos" data-id="${esc(c.id)}" data-p="${v}" title="${esc(NOME_VAGA[v])}">${SIGLA_VAGA[v]}</button>`).join('')}</span>` : ''}<small>${esc(c.classes.join(' · '))}</small><small class="tc-mudo">${esc(c.regioes.join(', '))} · ${c.ano}</small></div></div>`).join('') || '<p class="tc-mudo">Nenhum campeão com esses filtros.</p>'}</div>`;
}

// ------------------------------------------------------------------ personalização
function viewPers() {
  const o = S.meu.org; const f = S.form.pers || (S.form.pers = { escudo: o.escudo, cor1: o.cor1, cor2: o.cor2, estilo: o.estilo, ic: icClone(icDecodificar(o.escudo) || ICONE_PADRAO), modo: txDecodificar(o.escudo) ? 'texto' : 'simbolo', tx: { ...txClone(txDecodificar(o.escudo) || TEXTO_PADRAO), pl: 0 } });
  if (!f.ic) f.ic = icClone(icDecodificar(o.escudo) || ICONE_PADRAO);
  if (!f.tx) { f.tx = { ...txClone(txDecodificar(o.escudo) || TEXTO_PADRAO), pl: 0 }; f.modo = txDecodificar(o.escudo) ? 'texto' : 'simbolo'; }
  return `<form class="tc-card tc-form" data-form="pers" style="max-width:720px"><h3>Personalizar a organização</h3>
    <p class="tc-mudo tc-peq" style="margin:0">Só a aparência muda. O nome e a sigla não podem ser alterados e nada aqui dá vantagem na competição.</p>
    <div class="campo"><span>Ícone do time</span>${editorIcone('pers', o.sigla)}</div>
    <div class="tc-previa">${previaIcone(f, 76, o.nome)}<div style="font-family:'Bebas Neue',sans-serif;font-size:32px">${esc(o.nome)}</div></div>
    <button type="submit" class="tc-btn ouro" ${S.ocupado ? 'disabled' : ''}>Salvar</button></form>`;
}

// ------------------------------------------------------------------ modais
const dataHora = (iso) => new Date(iso).toLocaleDateString('pt-BR') + ' ' + new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
// Janela de Avisos: Novidades (publicadas pelos administradores) e avisos pessoais do time.
function avisosHtml(m) {
  const d = m.d; if (!d) return '<p class="tc-carregando">Carregando…</p>';
  const form = S.ehAdmin ? `<form class="tc-novidade-form" data-form="novidade"><b class="tc-eyebrow">Publicar novidade (só administradores)</b>
      <input class="tc-input" name="titulo" maxlength="80" placeholder="Título" required /><textarea class="tc-input" name="texto" maxlength="1500" rows="3" placeholder="O que mudou? Atualizações, correções, eventos…" required></textarea>
      <button type="submit" class="tc-btn ouro">Publicar</button></form>` : '';
  const nov = d.novidades.length ? d.novidades.map((n) => `<article class="tc-novidade ${n.novo ? 'novo' : ''}"><header><b>${esc(n.titulo)}</b>${n.novo ? '<span class="tag">Novo</span>' : ''}<small class="tc-mudo">${dataHora(n.criado)}</small>${S.ehAdmin ? `<button type="button" class="tc-btn peq" data-act="novidade-apagar" data-id="${n.id}" aria-label="Apagar novidade">Apagar</button>` : ''}</header><p>${esc(n.texto).replace(/\n/g, '<br>')}</p></article>`).join('') : '<p class="tc-mudo">Nenhuma novidade por enquanto.</p>';
  return `<h2>Avisos</h2><p class="tc-mudo tc-peq" style="margin:0 0 10px">Novidades, atualizações e eventos do jogo.</p>${nov}${form}`;
}
// Janela de Calendário: as 4 semanas da temporada, com vagas, formato e premiações dos campeonatos internacionais.
function calendarioHtml(m) {
  const d = m.d; if (!d) return '<p class="tc-carregando">Carregando…</p>';
  const cal = d.calendario; if (cal.antes) return `<h2>Calendário</h2><p class="tc-mudo">A primeira temporada começa em ${esc(dataCurta(cal.inicio))}.</p>`;
  const n = d.nomes || {}; const pi = d.premios_intl || {};
  const somar = (iso, k) => { const [y, mo, di] = iso.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, di + k)).toISOString().slice(0, 10); };
  const semIni = (k) => somar(cal.inicio_semana, (k - cal.semana) * 7);
  const cr = (v) => (v ? `${fmt(v)} cr.` : '—');
  const premio = (tipo, chaves) => chaves.map(([k, nome]) => `<tr><td>${nome}</td><td class="n">${cr(pi[tipo]?.[k])}</td></tr>`).join('');
  const liga = (k, titulo) => `<section class="tc-cal ${cal.semana === k ? 'agora' : ''}"><h4><span>Semana ${k} · ${dataCurta(semIni(k))} a ${dataCurta(somar(semIni(k), 6))}</span>${cal.semana === k ? '<em>Esta semana</em>' : ''}</h4><b>${titulo}</b>
    <p class="tc-mudo tc-peq">Duas partidas por dia e a disputa pelo troféu da liga. Na ${esc(n.principal)}, os 2 primeiros ganham vaga ${k === 1 ? `na ${esc(n.copa)}` : `no ${esc(n.mundial)}`}; na ${esc(n.acesso)}, os 2 primeiros sobem de divisão.</p></section>`;
  const vagas = (d.vagas || []).length ? `<p class="tc-peq" style="margin:10px 0 0"><b>Suas vagas:</b> ${d.vagas.map((v) => `${v.tipo === 'copa' ? esc(n.copa) : esc(n.mundial)} (temporada ${v.temporada})`).join(' · ')}</p>` : '<p class="tc-mudo tc-peq" style="margin:10px 0 0">Você ainda não tem vaga em campeonato internacional nesta temporada.</p>';
  return `<h2>Calendário · temporada ${cal.temporada}</h2>
    ${liga(1, 'Liga Academy / Liga Nacional')}
    <section class="tc-cal ${cal.semana === 2 ? 'agora' : ''}"><h4><span>Semana 2 · ${dataCurta(semIni(2))} a ${dataCurta(somar(semIni(2), 6))}</span>${cal.semana === 2 ? '<em>Esta semana</em>' : ''}</h4><b>${esc(n.copa)}</b>
      <p class="tc-mudo tc-peq"><b>Requisito:</b> 2 primeiros da ${esc(n.principal)} na semana 1 (ou na semana 4 da temporada anterior).<br><b>Formato:</b> 16 equipes. Segunda a sexta: 2 jogos por dia contra equipes diferentes (melhor de 1). Sábado: semifinais com os 4 melhores (melhor de 3). Domingo: final (melhor de 5). O campeão ganha vaga no ${esc(n.mundial)}.</p>
      <table class="tc-tabela"><tbody>${premio('copa', [['1', 'Campeão'], ['2', 'Vice'], ['3', 'Semifinalistas']])}</tbody></table></section>
    ${liga(3, 'Liga Academy / Liga Nacional')}
    <section class="tc-cal ${cal.semana === 4 ? 'agora' : ''}"><h4><span>Semana 4 · ${dataCurta(semIni(4))} a ${dataCurta(somar(semIni(4), 6))}</span>${cal.semana === 4 ? '<em>Esta semana</em>' : ''}</h4><b>${esc(n.mundial)}</b>
      <p class="tc-mudo tc-peq"><b>Requisito:</b> 2 primeiros da ${esc(n.principal)} na semana 2 ou 3, ou campeão da ${esc(n.copa)}.<br><b>Formato:</b> 16 equipes em 4 grupos. Segunda: treino (2 jogos, sem pontos, só XP e Maestria). Terça a quinta: 2 jogos por dia no grupo (cada adversário duas vezes). Sexta: quartas (melhor de 3). Sábado: semifinais (melhor de 3). Domingo: final (melhor de 5).</p>
      <table class="tc-tabela"><tbody>${premio('mundial', [['1', 'Campeão'], ['2', 'Vice'], ['3', 'Semifinalistas'], ['5', 'Quartas de final']])}</tbody></table></section>
    ${vagas}`;
}
function modalHtml() {
  const m = S.modal; if (!m) return '';
  let corpo = '';
  if (m.t === 'ficha') corpo = fichaHtml(m);
  else if (m.t === 'contratar') corpo = contratarHtml(m);
  else if (m.t === 'comprar') corpo = comprarHtml(m);
  else if (m.t === 'anunciar') corpo = anunciarHtml(m);
  else if (m.t === 'contrato') corpo = contratoHtml(m);
  else if (m.t === 'encerrar') corpo = encerrarHtml(m);
  else if (m.t === 'escalar') corpo = escalarHtml(m);
  else if (m.t === 'partida') corpo = partidaHtml(m);
  else if (m.t === 'recrutar') corpo = modalRecrutar(m);
  else if (m.t === 'mkt_resumo') corpo = modalMktResumo(m);
  else if (m.t === 'demitir') corpo = demitirHtml(m);
  else if (m.t === 'avisos') corpo = avisosHtml(m);
  else if (m.t === 'calendario') corpo = calendarioHtml(m);
  else if (m.t === 'rank-time') corpo = rankTimeHtml(m);
  else if (m.t === 'config') corpo = configHtml(m);
  return `<div class="tc-fundo" data-act="fechar-fundo"><div class="tc-modal${m.t === 'rank-time' ? ' larga' : ''}" role="dialog" aria-modal="true"><button type="button" class="x" data-act="fechar" aria-label="Fechar">×</button>${corpo}</div></div>`;
}
function demitirHtml(m) {
  const j = m.j; const ganho = j.frag_demissao || 0; const atual = S.meu.org.fragmentos || 0; const base = j.frag_base || 0;
  const temCopias = j.legado && (j.copias || 0) > 0; const qtd = temCopias ? Math.min(j.copias, Math.max(1, m.qtd || j.copias)) : 0; const ganhoCop = qtd * base;
  const perdas = [`${esc(j.nome)} sai do seu elenco e volta ao mercado${j.legado ? ' (o Legado continua disponível nos baús)' : ''}.`];
  if (j.estrelas > 0) perdas.push(`As ${j.estrelas} estrela(s) de evolução dele se perdem${j.frag_gastos ? `; metade dos ${fmt(j.frag_gastos)} fragmentos gastos nelas volta para você` : ''}.`);
  if (temCopias) perdas.push(`As ${j.copias} cópia(s) repetida(s) dele viram fragmentos: ${fmt(j.copias * base)} (${fmt(base)} por cópia).`);
  perdas.push('Esta ação não pode ser desfeita.');
  const bloco = temCopias ? `<div class="tc-copias"><span class="tc-eyebrow">Só cópias repetidas</span><p class="tc-mudo tc-peq" style="margin:4px 0 8px">Quer se desfazer de algumas cópias e continuar com o jogador? Cada cópia rende ${fmt(base)} ◈.</p>
      <div class="tc-passo"><button type="button" class="tc-btn" data-act="cop-menos" ${qtd <= 1 ? 'disabled' : ''} aria-label="Menos uma cópia">−</button><b>${qtd}</b><small>de ${j.copias} cópia(s)</small><button type="button" class="tc-btn" data-act="cop-mais" ${qtd >= j.copias ? 'disabled' : ''} aria-label="Mais uma cópia">+</button><button type="button" class="tc-btn" data-act="cop-todas" ${qtd >= j.copias ? 'disabled' : ''}>Todas</button></div>
      <button type="button" class="tc-btn ouro" data-act="confirmar-demitir-copias" ${S.ocupado ? 'disabled' : ''}>Demitir ${qtd} cópia(s) e receber ${fmt(ganhoCop)} ◈</button></div>` : '';
  const titular = !!j.slot;
  return `<h2>Demitir ${esc(j.nome)}</h2>
    <div class="tc-ficha" style="grid-template-columns:110px 1fr;align-items:center"><div class="foto tc-moldura${j.raridade ? ` r-${j.raridade}` : ''}">${retratoSvg(j, 110)}</div><div>
      <p class="tc-mudo tc-peq" style="margin:0 0 6px">O que acontece ao demitir o jogador:</p><ul class="tc-lista-ul">${perdas.map((x) => `<li>${x}</li>`).join('')}</ul></div></div>
    ${bloco}
    <div class="tc-resumo"><div class="l"><span>Demitindo o jogador, você recebe</span><b class="tc-frag">◈ +${fmt(ganho)} fragmentos de jogador</b></div>
      <div class="l"><span>Seus fragmentos</span><b>${fmt(atual)} → ${fmt(atual + ganho)}</b></div>${j.reembolso_contrato > 0 ? `<div class="l"><span>Contrato não usado (50%)</span><b class="tc-preco cr">+${fmt(j.reembolso_contrato)} cr.</b></div>` : ''}</div>
    ${titular ? '<p class="tc-peq" style="color:var(--ruim)">Ele é titular: tire-o da escalação para poder demitir o jogador.</p>' : ''}
    <p class="tc-mudo tc-peq">Fragmentos servem para evoluir as estrelas dos seus jogadores (Legados também podem usar cópias repetidas).</p>
    <div class="tc-acoes"><button type="button" class="tc-btn perigo" data-act="confirmar-demitir" ${S.ocupado || titular ? 'disabled' : ''}>Demitir o jogador e receber ${fmt(ganho)} ◈</button><button type="button" class="tc-btn" data-act="voltar-ficha">Cancelar</button></div>`;
}
// Botões de evoluir a estrela: Legado pode gastar cópias repetidas ou fragmentos; jogador comum só fragmentos.
function botoesEstrela(j) {
  const frag = S.meu.org.fragmentos || 0; const off = S.ocupado ? ' disabled' : '';
  const bFrag = `<button type="button" class="tc-btn ouro" data-act="subir-estrela" data-via="fragmentos" data-id="${j.id}"${off || (frag < j.estrela_custo_frag ? ' disabled' : '')} title="Você tem ${fmt(frag)} fragmentos">Evoluir ★ · ${fmt(j.estrela_custo_frag)} fragmentos <small>(você tem ${fmt(frag)})</small></button>`;
  if (!j.legado) return bFrag;
  return `<button type="button" class="tc-btn ouro" data-act="subir-estrela" data-via="copias" data-id="${j.id}"${off || ((j.copias || 0) < j.estrela_custo_copias ? ' disabled' : '')} title="Você tem ${j.copias || 0} cópia(s) repetida(s)">Evoluir ★ · ${j.estrela_custo_copias} cópia(s) <small>(você tem ${j.copias || 0})</small></button>${bFrag}`;
}
function fichaHtml(m) {
  const j = m.j; const meu = j.org_id && j.org_id === S.meu.org.id;
  const resta = semanasRestantes(j);
  let acoes = '';
  if (!j.org_id && j.legado) acoes = '<span class="tc-mudo tc-peq">Jogador Legado: só sai dos baús de Recrutar.</span>';
  else if (!j.org_id) acoes = (S.meu.elenco || []).length >= ELENCO_MAX ? '<span class="tc-mudo tc-peq">Inventário cheio: demita ou venda alguém para contratar.</span>' : `<button type="button" class="tc-btn ouro" data-act="abrir-contratar" data-id="${j.id}">Contratar</button>`;
  else if (meu) {
    const cheioContrato = !j.contrato_ativo || (j.contrato_restante || 0) <= 1;
    acoes = `<button type="button" class="tc-btn ciano" data-act="abrir-escalar" data-id="${j.id}">Escalar</button>${cheioContrato ? `<button type="button" class="tc-btn" data-act="abrir-contrato" data-id="${j.id}">${j.contrato_ativo ? 'Renovar contrato' : 'Efetivar contrato'}</button>` : ''}${j.contrato_ativo ? `<button type="button" class="tc-btn" data-act="abrir-encerrar" data-id="${j.id}">Encerrar contrato</button>` : ''}<button type="button" class="tc-btn" data-act="abrir-anunciar" data-id="${j.id}">Anunciar por RC</button>${j.estrelas < j.estrela_max ? botoesEstrela(j) : ''}${j.slot && !(j.legado && j.copias > 0) ? '' : `<button type="button" class="tc-btn perigo" data-act="demitir" data-id="${j.id}">Demitir${j.legado && j.copias > 0 ? ' (jogador ou cópias)' : ''}</button>`}`;
  }
  else if (m.anuncio) acoes = (S.meu.elenco || []).length >= ELENCO_MAX ? '<span class="tc-mudo tc-peq">Inventário cheio: demita ou venda alguém para comprar.</span>' : `<button type="button" class="tc-btn ouro" data-act="abrir-comprar" data-anuncio="${m.anuncio.id}">Comprar por ${fmt(m.anuncio.preco_rc)} RC</button>`;
  return `<h2>${esc(j.nome)}${j.ficticio === false ? ' <span class="tc-estrela-selo">◆ Legado</span>' : ''}</h2><p class="tc-mudo tc-peq" style="margin:2px 0">${iconeVaga(j.pos)} ${NOME_VAGA[j.pos]}${(j.pos2 || []).length ? ` · também ${j.pos2.map((p) => NOME_VAGA[p]).join(', ')}` : ''} · ${j.idade} anos${j.regiao ? ` · ${esc(j.regiao)}` : ''}${j.ficticio ? '' : ' · jogador legado'}</p>
    ${idiomasFichaHtml(j)}
    <div class="tc-ficha"><div class="foto tc-moldura${j.raridade ? ` r-${j.raridade}` : ''}">${retratoSvg(j, 200)}</div><div>
      <div class="tc-poder" style="margin-bottom:10px">${escudoHtml(j.poder, true)}<span class="tc-mudo tc-peq">Poder individual<br>Experiência ${j.exp}${j.potencial != null ? `<br>Potencial ${j.potencial}` : ''}</span></div>
      ${barras(j)}</div></div>
    ${j.org_id ? `<div class="tc-resumo"><div class="l"><span>Estrelas</span><b>${estrelasHtml(j)} <small>+${j.bonus_estrelas_pct || 0}% de eficiência</small></b></div>${j.legado ? `<div class="l"><span>Cópias repetidas</span><b>${j.copias}</b></div>` : `<div class="l"><span>Seus fragmentos</span><b>${fmt(S.meu.org.fragmentos || 0)}</b></div>`}</div>` : ''}
    <div class="tc-resumo"><div class="l"><span>Salário${j.org_id ? '' : ' (se contratado)'}</span><b>${fmt(j.org_id ? j.salario : salarioDe(j.preco))} cr./semana</b></div>${j.org_id ? `<div class="l"><span>Contrato</span><b>${j.contrato_ativo ? `${j.contrato_restante} semana(s) · já pago` : 'Sem contrato'}</b></div><div class="l"><span>Organização</span><b>${esc(j.org?.nome || '')}</b></div>` : j.legado ? '<div class="l"><span>Obtenção</span><b>Baús de Recrutar</b></div>' : `<div class="l"><span>Preço de transferência</span><b class="tc-preco cr">${fmt(j.preco)}</b></div>`}${m.anuncio ? `<div class="l"><span>Anúncio</span><b class="tc-preco rc">${fmt(m.anuncio.preco_rc)}</b></div><div class="l"><span>Vendedor</span><b>${esc(m.anuncio.vendedor.nome)}</b></div><div class="l"><span>Publicado em</span><b>${new Date(m.anuncio.criado).toLocaleDateString('pt-BR')}</b></div>` : ''}</div>
    ${(j.campeoes || []).length ? `<h4 class="tc-eyebrow">Campeões</h4><div class="tc-maes">${j.campeoes.map((c) => `<div class="${c.favorito ? 'fav' : ''}">${campIcone(c.nome, 38)}<b>${esc(c.nome)}</b>${subcategoriaDoCampeao(c.nome, j.pos) ? `<em class="tc-sub">${esc(subcategoriaDoCampeao(c.nome, j.pos))}</em>` : ''}<span>${c.favorito ? '★ ' : ''}${nomeMaestria(c.nivel)}${c.favorito && c.bonus_pct ? ` · +${c.bonus_pct}% de Poder` : ''}</span><small>${fmt(c.pontos)} pts · ${c.jogos} jogo(s)</small></div>`).join('')}</div>` : ''}
    <div class="tc-acoes">${acoes}</div>`;
}
function contratarHtml(m) {
  const j = m.j; const o = S.meu.org;
  const cheio = (S.meu.elenco || []).length >= ELENCO_MAX;
  const falta = o.creditos < j.preco;
  return `<h2>Contratar ${esc(j.nome)}</h2><p class="tc-mudo tc-peq">Ele vai para o seu inventário. Para escalá-lo como titular você efetiva um contrato (1 semana ou 1 temporada) com salário em créditos.</p>
    <div class="tc-resumo"><div class="l"><span>Preço de transferência</span><b class="tc-preco cr">${fmt(j.preco)}</b></div><div class="l"><span>Salário base</span><b>${fmt(salarioDe(j.preco))} cr./semana de contrato</b></div><div class="l"><span>Seus créditos agora</span><b>${fmt(o.creditos)}</b></div><div class="l tot"><span>Créditos depois da contratação</span><b style="color:${falta ? 'var(--ruim)' : 'var(--bom)'}">${fmt(o.creditos - j.preco)}</b></div></div>
    ${falta ? '<p style="color:var(--ruim)">Créditos insuficientes.</p>' : ''}${cheio ? '<p style="color:var(--ruim)">Inventário cheio: demita ou venda um jogador antes.</p>' : ''}
    <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="confirmar-contratar" ${falta || cheio || S.ocupado ? 'disabled' : ''}>Contratar</button><button type="button" class="tc-btn" data-act="fechar">Cancelar</button></div>`;
}
function comprarHtml(m) {
  const a = m.anuncio; const j = a.jogador; const rc = S.meu.rc; const falta = rc < a.preco_rc;
  const repetido = j.ficticio === false && (S.meu.elenco || []).some((x) => x.ficticio === false && x.nome === j.nome); // Legado que você já tem vira cópia
  const cheio = !repetido && (S.meu.elenco || []).length >= ELENCO_MAX;
  return `<h2>Comprar ${esc(j.nome)}</h2><p class="tc-mudo tc-peq">Vendedor: ${esc(a.vendedor.nome)} (${esc(a.vendedor.sigla)}). A compra usa a sua carteira oficial de Rift Coins e é definitiva.</p>
    <div class="tc-resumo"><div class="l"><span>Preço</span><b class="tc-preco rc">${fmt(a.preco_rc)}</b></div><div class="l"><span>Taxa do mercado (paga pelo vendedor)</span><b>${taxaDe(a.preco_rc)} RC</b></div><div class="l"><span>Salário que passa a ser seu</span><b>${fmt(j.salario)} cr./semana</b></div><div class="l"><span>Contrato restante</span><b>${semanasRestantes(j) ?? '—'} semana(s)</b></div>
      <div class="l"><span>Seus Rift Coins agora</span><b>${fmt(rc)}</b></div><div class="l tot"><span>Depois da compra</span><b style="color:${falta ? 'var(--ruim)' : 'var(--bom)'}">${fmt(rc - a.preco_rc)}</b></div></div>
    ${repetido ? `<p class="tc-peq" style="color:var(--bom)">Você já tem este Legado: ao comprar, ele vira <b>+${1 + (j.copias || 0)} cópia(s)</b> do seu (não ocupa vaga no inventário).</p>` : ''}${falta ? '<p style="color:var(--ruim)">Rift Coins insuficientes.</p>' : ''}${cheio ? '<p style="color:var(--ruim)">Inventário cheio: demita ou venda um jogador antes.</p>' : ''}
    <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="confirmar-comprar" ${falta || cheio || S.ocupado ? 'disabled' : ''}>Confirmar compra</button><button type="button" class="tc-btn" data-act="fechar">Cancelar</button></div>`;
}
function anunciarHtml(m) {
  const j = m.j; const preco = Number(m.preco) || 0; const taxa = taxaDe(preco);
  return `<h2>Anunciar ${esc(j.nome)}</h2><p class="tc-mudo tc-peq">Preço fixo em Rift Coins. O jogador continua no seu elenco até alguém comprar, e você pode cancelar quando quiser.</p>
    <label class="campo"><span class="tc-mudo tc-peq">Preço em RC (${PRECO_RC.min} a ${fmt(PRECO_RC.max)})</span><input class="tc-input" type="number" name="preco" min="${PRECO_RC.min}" max="${PRECO_RC.max}" value="${m.preco}" data-act="preco-anuncio" /></label>
    <div class="tc-resumo"><div class="l"><span>Taxa do mercado (${TAXA_MERCADO_PCT}%)</span><b>${taxa} RC</b></div><div class="l tot"><span>Você recebe</span><b>${fmt(Math.max(0, preco - taxa))} RC</b></div></div>
    ${j.contrato_ativo ? `<p class="tc-peq tc-mudo">O contrato dele (${j.contrato_restante} semana(s) já pagas) só acaba quando alguém comprar: você recebe de volta <b>${fmt(j.reembolso_contrato)} cr.</b> (50% do que sobrou) e o comprador recebe o jogador sem contrato.</p>` : ''}${j.legado ? '<p class="tc-peq tc-mudo">As estrelas e as cópias repetidas dele vão junto com a venda. Se o comprador já tiver este Legado, o jogador vira cópia para ele.</p>' : ''}
    ${j.slot ? '<p style="color:#fbbf24" class="tc-peq">Esse jogador é titular. Se ele for vendido, a vaga é preenchida por um reserva ou por um substituto fraco.</p>' : ''}
    <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="confirmar-anunciar" ${preco < PRECO_RC.min || preco > PRECO_RC.max || S.ocupado ? 'disabled' : ''}>Publicar anúncio</button><button type="button" class="tc-btn" data-act="fechar">Cancelar</button></div>`;
}
const NOME_CONTRATO = (n) => (n === 1 ? '1 semana' : n === 4 ? '1 temporada (4 semanas)' : `${n} semanas`);
function contratoHtml(m) {
  const j = m.j; const o = S.meu.org; const op = (j.contrato_opcoes || []).find((x) => x.semanas === m.semanas) || (j.contrato_opcoes || [])[0];
  if (!op) return '<p>Contrato indisponível.</p>';
  const falta = o.creditos < op.preco;
  return `<h2>Efetivar contrato · ${esc(j.nome)}</h2>
    <p class="tc-mudo tc-peq">${m.vaga ? `Para escalar ${esc(j.nome)} como titular (${NOME_VAGA[m.vaga]}) é preciso um contrato.` : 'Escolha a duração do contrato.'} O valor é pago adiantado, em créditos. Se encerrar antes do fim, você recebe de volta 50% do que ainda não foi jogado.</p>
    <div class="tc-lista">${j.contrato_opcoes.map((x) => `<button type="button" class="tc-partida tc-contrato-op ${x.semanas === op.semanas ? 'on' : ''}" style="grid-template-columns:1fr auto" data-act="contrato-opcao" data-sem="${x.semanas}"><span class="time">${NOME_CONTRATO(x.semanas)}${x.desconto_pct ? ` <i class="tc-desc">-${x.desconto_pct}%</i>` : ''}</span><span class="tc-preco cr">${fmt(x.preco)} cr.</span></button>`).join('')}</div>
    <div class="tc-resumo"><div class="l"><span>Salário base</span><b>${fmt(j.salario)} cr./semana</b></div><div class="l"><span>Você paga agora</span><b class="tc-preco cr">${fmt(op.preco)} cr.</b></div><div class="l tot"><span>Créditos depois</span><b style="color:${falta ? 'var(--ruim)' : 'var(--bom)'}">${fmt(o.creditos - op.preco)}</b></div></div>
    ${falta ? '<p style="color:var(--ruim)">Créditos insuficientes.</p>' : ''}
    <div class="tc-acoes"><button type="button" class="tc-btn ouro" data-act="confirmar-contrato" ${falta || S.ocupado ? 'disabled' : ''}>${m.vaga ? 'Efetivar contrato e escalar' : 'Efetivar contrato'}</button><button type="button" class="tc-btn" data-act="voltar-ficha">Cancelar</button></div>`;
}
function encerrarHtml(m) {
  const j = m.j; const o = S.meu.org; const titular = !!j.slot;
  return `<h2>Encerrar contrato · ${esc(j.nome)}</h2>
    <p class="tc-mudo tc-peq">O contrato dele ainda tem ${j.contrato_restante} semana(s) já pagas.</p>
    <ul class="tc-lista-ul"><li>Você recebe de volta <b>50%</b> do salário que ele ainda não jogou.</li>${titular ? '<li>Ele sai da escalação titular e a vaga é completada automaticamente.</li>' : ''}<li>Para escalá-lo de novo será preciso efetivar um contrato novo.</li></ul>
    <div class="tc-resumo"><div class="l"><span>Você recebe</span><b class="tc-preco cr">+${fmt(j.reembolso_contrato)} cr.</b></div><div class="l"><span>Créditos depois</span><b>${fmt(o.creditos + j.reembolso_contrato)}</b></div></div>
    <div class="tc-acoes"><button type="button" class="tc-btn perigo" data-act="confirmar-encerrar" ${S.ocupado ? 'disabled' : ''}>Encerrar e receber ${fmt(j.reembolso_contrato)} cr.</button><button type="button" class="tc-btn" data-act="voltar-ficha">Cancelar</button></div>`;
}
function escalarHtml(m) {
  const j = m.j;
  const ocup = titulares();
  return `<h2>Escalar ${esc(j.nome)}</h2><p class="tc-mudo tc-peq">Escolha a vaga. Quem estiver nela vai para a reserva. Jogar fora da posição principal reduz a eficiência do jogador em ${Math.round((1 - FORA_POSICAO) * 100)}% e trocar titulares reduz a sinergia.</p>
    <div class="tc-lista">${VAGAS.map((v) => { const ok = v === j.pos || (j.pos2 || []).includes(v); return `<button type="button" class="tc-partida" style="grid-template-columns:1fr auto" data-act="confirmar-escalar" data-vaga="${v}"><span class="time">${iconeVaga(v)} ${NOME_VAGA[v]}${ocup[v] ? ` · hoje: ${esc(ocup[v].nome)}` : ' · livre'}</span><span class="tc-peq" style="color:${ok ? 'var(--bom)' : '#fbbf24'}">${ok ? 'na posição' : 'fora da posição'}</span></button>`; }).join('')}</div>
    <div class="tc-acoes"><button type="button" class="tc-btn" data-act="fechar">Fechar</button></div>`;
}
function partidaHtml(m) {
  const p = m.p; const r = p.resumo || { mapas: [] };
  const wo = p.wo || r.origem === 'wo'; const ausenteId = p.wo_ausente ?? r.ausente; const ausente = ausenteId === p.a.id ? p.a : ausenteId === p.b.id ? p.b : null;
  const num = (v, i) => Math.max(0, Math.round(Number(v?.[i]) || 0)); // números do gameplay: nunca texto cru na página
  return `<h2>${esc(p.a.nome)} ${p.placar_a} × ${p.placar_b} ${esc(p.b.nome)}</h2><p class="tc-mudo tc-peq">${dataCurta(p.dia)} · ${p.fase === 'rodada' ? `rodada ${p.rodada}` : FASES[p.fase] || ''} · melhor de ${p.formato} · Poder ${p.poder_a} × ${p.poder_b}${r.origem === 'gameplay' ? ' · partida jogada' : ''}</p>
    ${wo ? `<div class="tc-wo-aviso"><b>W.O.</b><span>${ausente ? `<b>${esc(ausente.nome)}</b> não jogou a partida até a meia-noite e perdeu por W.O.` : 'Uma das equipes não jogou a partida até a meia-noite e perdeu por W.O.'}</span></div>` : ''}
    ${(r.mapas || []).map((x) => x.gameplay ? `<div class="tc-resumo"><div class="l"><b>Mapa ${x.mapa}</b><span>${x.duracao} min · vitória ${esc(x.vencedor === 'a' ? p.a.nome : p.b.nome)}</span></div>
      <div class="l"><span>Abates</span><b>${num(x.abates, 0)} × ${num(x.abates, 1)}</b></div><div class="l"><span>Torres derrubadas</span><b>${num(x.torres, 0)} × ${num(x.torres, 1)}</b></div><div class="l"><span>Dragões</span><b>${num(x.dragoes, 0)} × ${num(x.dragoes, 1)}</b></div>${x.mvp ? `<div class="l"><span>Destaque do mapa</span><b>${esc(x.mvp)}</b></div>` : ''}</div>` : `<div class="tc-resumo"><div class="l"><b>Mapa ${x.mapa}</b><span>${x.duracao} min · vitória ${esc(x.vencedor === 'a' ? p.a.nome : p.b.nome)}</span></div>
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
    case 'rank': return viewRank();
    case 'hist': return viewHist();
    case 'treino': return viewTreino();
    case 'amistoso': return viewAmistoso();
    case 'recrutar': return viewRecrutar();
    case 'marketing': return viewMarketingCentral();
    case 'adm': return S.ehAdmin ? viewAdm() : viewVisao();
    case 'pers': return viewPers();
    default: return viewVisao();
  }
}
function render() {
  const foco = document.activeElement;
  const nomeFoco = foco?.name; const posFoco = foco?.selectionStart;
  if (!S.meu) return;
  if (S.meu.org?.elenco_pendente) {
    app.innerHTML = `${FECHADO ? '<div class="tc-aviso-teste">Jogo em teste: só administradores veem esta área.</div>' : ''}${viewEscolha()}`;
  } else if (S.meu.org) {
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
    const [j] = await Promise.all([api.ficha(Number(id)), prepararImagens()]);
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
  if (act === 'conf-nav') { const n = Number(b.closest('.tc-confrontos')?.querySelectorAll('.tc-conf-pontos button').length || 1); S.confIdx = b.dataset.i != null ? Number(b.dataset.i) : (((S.confIdx || 0) + Number(b.dataset.d) + n) % n); render(); return; }
  if (act === 'camp-dia') { const ab = S.campAbertos || (S.campAbertos = {}); ab[b.dataset.k] = !ab[b.dataset.k]; render(); return; }
  if (act === 'adm-aba') { S.admAba = b.dataset.v; render(); await carregarAba(); render(); return; }
  if (act.startsWith('adm-') && S.ehAdmin) { if (await tratarAdm(act, b)) render(); return; }
  if (act === 'camp-pos') { // administrador: inclui/tira uma posição do campeão (fica salvo no servidor)
    const c = S.campeoes?.campeoes.find((x) => x.id === b.dataset.id); if (!c || !S.ehAdmin) return;
    const p = b.dataset.p; const novas = c.posicoes.includes(p) ? c.posicoes.filter((x) => x !== p) : [...c.posicoes, p];
    if (!novas.length) { toast('O campeão precisa ter ao menos uma posição.', true); return; }
    try { const r = await api.campeaoPosicoes(c.id, novas); c.posicoes = r.posicoes; toast(`${c.nome}: ${c.posicoes.map((v) => NOME_VAGA[v]).join(', ')}`); } catch (err) { toast(err.message, true); }
    render(); return;
  }
  if (act.startsWith('mkt-')) { await tratarMkt(act, b); render(); return; }
  if (act === 'treinar' || act === 'amistoso' || act === 'recrutar' || act === 'treino-abrir') { await tratarAcao(act, b); render(); return; }
  if (act === 'avisos') {
    S.modal = { t: 'avisos', d: null }; render();
    try { const d = await api.avisosCentral(); if (S.modal?.t === 'avisos') { S.modal = { t: 'avisos', d }; S.avisosN = 0; render(); } } catch (err) { S.modal = null; render(); toast(err.message, true); }
    return;
  }
  if (act === 'calendario') {
    S.modal = { t: 'calendario', d: null }; render();
    try { const d = await api.calendarioCompeticoes(); if (S.modal?.t === 'calendario') { S.modal = { t: 'calendario', d }; render(); } } catch (err) { S.modal = null; render(); toast(err.message, true); }
    return;
  }
  if (act === 'novidade-apagar' && S.ehAdmin) {
    const id = Number(b.dataset.id);
    await agir(() => api.admNovidadeApagar(id), { ok: 'Novidade apagada.', recarregar: false });
    const d = await api.avisosCentral().catch(() => null); if (d && S.modal?.t === 'avisos') { S.modal = { t: 'avisos', d }; render(); }
    return;
  }
  if (act === 'fechar') { S.modal = null; render(); return; }
  if (act === 'ic-modo') { const f = formDe(b.dataset.alvo); f.modo = b.dataset.v === 'texto' && nomeServeParaTexto(nomeDoTime(b.dataset.alvo)) ? 'texto' : 'simbolo'; aplicarIc(b.dataset.alvo); render(); return; }
  if (act === 'tx-fonte') { const f = formDe(b.dataset.alvo); f.tx.f = Number(b.dataset.v); aplicarIc(b.dataset.alvo); render(); return; }
  if (act === 'tx-padrao') { const f = formDe(b.dataset.alvo); f.tx = txClone(TEXTO_PADRAO); aplicarIc(b.dataset.alvo); render(); return; }
  if (act === 'tx-cor') { const f = formDe(b.dataset.alvo); if (b.dataset.i === '') f.tx[b.dataset.c] = b.dataset.v; else f.tx[b.dataset.c][Number(b.dataset.i)] = b.dataset.v; aplicarIc(b.dataset.alvo); render(); return; }
  if (act === 'ic-sim') { const f = formDe(b.dataset.alvo); f.ic = icTrocar(Number(b.dataset.v)); aplicarIc(b.dataset.alvo); render(); return; }
  if (act === 'ic-orig') { const f = formDe(b.dataset.alvo); f.ic = icTrocar(f.ic.s); aplicarIc(b.dataset.alvo); render(); return; }
  if (act === 'ic-cor') { const f = formDe(b.dataset.alvo); f.ic.c[Number(b.dataset.i)] = b.dataset.v; aplicarIc(b.dataset.alvo); render(); return; }
  if (act === 'mercado-aba') { S.mercado.aba = b.dataset.v; S.mercado.f = { ordem: b.dataset.v === 'oficial' ? 'poder' : 'recente' }; render(); await agir(carregarMercado, { recarregar: false }); return; }
  if (act === 'limpar-filtros') { S.mercado.f = { ordem: S.mercado.aba === 'oficial' ? 'poder' : 'recente' }; S.mercado.oficial = null; S.mercado.usuarios = null; render(); await agir(carregarMercado, { recarregar: false }); return; }
  if (act === 'config') { S.modal = { t: 'config' }; render(); return; }
  if (act === 'cfg-som') { definirSom(!somAtivo()); if (somAtivo()) tocar('ok'); render(); return; }
  if (act === 'cfg-reset') { try { localStorage.removeItem(CFG_KEY); } catch { /* sem storage */ } definirSom(true); aplicarCfg(); toast('Preferências restauradas.'); render(); return; }
  if (act === 'cfg-renomear') {
    const nome = String(document.getElementById('cfg-nome')?.value ?? '').trim().replace(/\s+/g, ' ');
    if (nome.length < 3 || nome.length > 24 || !NOME_OK.test(nome)) { toast('Use de 3 a 24 caracteres (letras, números, espaço, ponto, hífen ou sublinhado).', true); return; }
    if (nome === S.meu?.org?.nome) { toast('O novo nome é igual ao atual.', true); return; }
    if ((S.meu?.rc ?? 0) < RENOMEAR_RC) { toast(`Trocar o nome custa ${RENOMEAR_RC} RC e você não tem Rift Coins suficientes.`, true); return; }
    if (!window.confirm(`Trocar o nome do time para "${nome}" por ${RENOMEAR_RC} RC?`)) return;
    const r = await agir(() => api.renomear(nome), { ok: `Nome alterado para ${nome}.` });
    if (r) { S.form.pers = null; S.modal = null; render(); }
    return;
  }
  if (act === 'cfg-anim') { const c = lerCfg(); c.semAnim = !c.semAnim; salvarCfg(c); aplicarCfg(); render(); return; }
  if (act === 'cfg-pers') { S.modal = null; S.aba = 'pers'; render(); await carregarAba(); render(); window.scrollTo({ top: 0 }); return; }
  if (act === 'rank-pag') { S.rankPag = Math.max(1, Number(b.dataset.p) || 1); render(); return; }
  if (act === 'rank-time') {
    S.modal = { t: 'rank-time', d: null }; render();
    try { const [d] = await Promise.all([api.rankTime(Number(b.dataset.org)), prepararImagens()]); if (S.modal?.t === 'rank-time') { S.modal = { t: 'rank-time', d }; render(); } }
    catch (e) { S.modal = null; render(); toast(e.message, true); }
    return;
  }
  if (act === 'ficha') { await abrirFicha(b.dataset.id); return; }
  if (act === 'ficha-anuncio') { const a = (S.mercado.usuarios || []).find((x) => x.id === Number(b.dataset.anuncio)); await abrirFicha(b.dataset.id, a || null); return; }
  if (act === 'partida') { await agir(async () => { S.modal = { t: 'partida', p: await api.partida(Number(b.dataset.id)) }; }, { recarregar: false }); return; }
  if (act === 'abrir-contratar') { const j = S.modal.j; S.modal = { t: 'contratar', j, semanas: 1, chave: novaChave() }; render(); return; }
  if (act === 'abrir-contrato') { const j = S.modal.j; S.modal = { t: 'contrato', j, vaga: null, semanas: 4 }; render(); return; }
  if (act === 'abrir-encerrar') { S.modal = { t: 'encerrar', j: S.modal.j }; render(); return; }
  if (act === 'contrato-opcao') { S.modal.semanas = Number(b.dataset.sem); render(); return; }
  if (act === 'abrir-anunciar') { S.modal = { t: 'anunciar', j: S.modal.j, preco: 500 }; render(); return; }
  if (act === 'abrir-escalar') { S.modal = { t: 'escalar', j: S.modal.j }; render(); return; }
  if (act === 'abrir-comprar') { S.modal = { t: 'comprar', anuncio: S.modal.anuncio, chave: novaChave() }; render(); return; }
  if (act === 'confirmar-contratar') {
    const m = S.modal;
    const r = await agir(() => api.contratar(m.j.id, m.semanas, m.chave), { ok: `${m.j.nome} contratado!` });
    if (r) { S.modal = null; render(); }
    return;
  }
  if (act === 'confirmar-contrato') {
    const m = S.modal;
    const r = await agir(() => (m.vaga ? api.escalar(m.vaga, m.j.id, m.semanas) : api.assinarContrato(m.j.id, m.semanas)), { ok: m.vaga ? `${m.j.nome} contratado e escalado!` : 'Contrato efetivado!' });
    if (r) { S.modal = null; render(); }
    return;
  }
  if (act === 'confirmar-encerrar') {
    const m = S.modal;
    const r = await agir(() => api.encerrarContrato(m.j.id), { ok: (x) => `Contrato encerrado: +${fmt(x.reembolso)} créditos de volta.` });
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
    if (!m.j.contrato_ativo) { S.modal = { t: 'contrato', j: m.j, vaga: b.dataset.vaga, semanas: 4 }; render(); return; } // sem contrato: efetiva antes de escalar
    const r = await agir(() => api.escalar(b.dataset.vaga, m.j.id), { ok: 'Escalação atualizada!' });
    if (r) { S.modal = null; render(); }
    return;
  }
  if (act === 'escolher-inicial') { const pos = b.dataset.pos; const id = Number(b.dataset.id); S.escolha = S.escolha || {}; S.escolha[pos] = S.escolha[pos] === id ? null : id; render(); return; }
  if (act === 'confirmar-inicial') {
    const ids = VAGAS.map((v) => (S.escolha || {})[v]).filter(Boolean);
    const r = await agir(() => api.escolherElencoInicial(ids), { ok: 'Time montado! Boa sorte, técnico.', recarregar: false });
    if (r) { S.escolha = null; await agir(atualizar, { recarregar: false }); S.aba = 'visao'; render(); }
    return;
  }
  if (act === 'inv-ord') {
    const k = b.dataset.k || null; const def = ORD_INV.find((x) => x[0] === k);
    if (!def) S.invOrd = { k: null, dir: 'desc' };
    else S.invOrd = S.invOrd.k === k ? { k, dir: S.invOrd.dir === 'desc' ? 'asc' : 'desc' } : { k, dir: def[3] };
    render(); return;
  }
  if (act === 'demitir') { S.modal = { t: 'demitir', j: S.modal.j, qtd: S.modal.j.copias || 0 }; render(); return; }
  if (act === 'cop-menos' || act === 'cop-mais' || act === 'cop-todas') {
    const j = S.modal.j; const q = S.modal.qtd || j.copias || 1;
    S.modal = { ...S.modal, qtd: act === 'cop-todas' ? j.copias : Math.min(j.copias, Math.max(1, q + (act === 'cop-mais' ? 1 : -1))) }; render(); return;
  }
  if (act === 'confirmar-demitir-copias') {
    const j = S.modal.j; const q = Math.min(j.copias, Math.max(1, S.modal.qtd || j.copias));
    const r = await agir(() => api.demitirCopias(j.id, q), { ok: (x) => `${q} cópia(s) de ${j.nome} demitida(s): +${fmt(x.fragmentos_ganhos)} fragmentos de jogador.` });
    if (r) { S.modal = r.jogador ? { t: 'ficha', j: { ...j, ...r.jogador } } : null; render(); }
    return;
  }
  if (act === 'voltar-ficha') { S.modal = { t: 'ficha', j: S.modal.j }; render(); return; }
  if (act === 'confirmar-demitir') {
    const j = S.modal.j;
    const r = await agir(() => api.demitir(j.id), { ok: (x) => `${j.nome} foi demitido: +${fmt(x.fragmentos_ganhos)} fragmentos de jogador.` });
    if (r) { S.modal = null; render(); }
    return;
  }
  if (act === 'subir-estrela') {
    const j = S.modal.j;
    const r = await agir(() => api.subirEstrela(j.id, b.dataset.via || null), { ok: `${j.nome} agora tem mais uma estrela!` });
    if (r) { S.modal = { ...S.modal, j: { ...j, ...r.jogador } }; render(); }
    return;
  }
  if (act === 'cancelar-anuncio') {
    if (!window.confirm('Cancelar este anúncio?')) return;
    await agir(() => api.cancelarAnuncio(Number(b.dataset.id)), { ok: 'Anúncio cancelado.' });
  }
});

document.addEventListener('input', (e) => {
  if (S.ehAdmin && S.aba === 'adm' && admDigitar(e)) return;
  const t = e.target;
  if (t.matches('[data-ic]')) { // seletor de cor nativo: atualiza só a prévia (renderizar de novo fecharia o seletor)
    const [alvo, i] = t.dataset.ic.split(':'); const f = formDe(alvo); f.ic.c[Number(i)] = t.value; aplicarIc(alvo);
    const camadas = t.closest('.tc-ic-edit')?.querySelectorAll('.previa .tc-ic i.p');
    if (camadas?.[Number(i)]) camadas[Number(i)].style.setProperty('--c', t.value);
    return;
  }
  if (t.matches('[data-txc]')) { // seletor de cor do texto: atualiza só a prévia (renderizar de novo fecharia o seletor)
    const [alvo, campo, i] = t.dataset.txc.split(':'); const f = formDe(alvo);
    if (i === '') f.tx[campo] = t.value; else f.tx[campo][Number(i)] = t.value; aplicarIc(alvo);
    const pv = t.closest('.tc-ic-edit')?.querySelector('.previa .tc-ict'); if (pv) pv.outerHTML = textoHtml(f.tx, 120, 'Ícone do time');
    return;
  }
  if (t.matches('[data-tx]')) { // escrita, espessura do contorno e distância da sombra
    const f = formDe(t.dataset.alvo); const c = t.dataset.tx;
    f.tx[c] = Number(t.value); aplicarIc(t.dataset.alvo); render(); return;
  }
  if (t.matches('[data-act="preco-anuncio"]')) { S.modal.preco = t.value; render(); return; }
  if (t.matches('[data-fc]')) { S.fc[t.name] = t.value; render(); return; }
  const form = t.closest('form[data-form="criar"]');
  if (form) { S.form[t.name] = t.name === 'sigla' ? t.value.toUpperCase() : t.value; if (t.name === 'nome') { if (S.form.modo === 'texto' && !nomeServeParaTexto(S.form.nome)) S.form.modo = 'simbolo'; aplicarIc('criar'); } render(); return; }
  const pf = t.closest('form[data-form="pers"]');
  if (pf) { S.form.pers[t.name] = t.value; render(); }
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-ic], [data-txc]')) { render(); return; } // seletor de cor fechado: atualiza as miniaturas
  if (e.target.matches('[data-fc]')) { S.fc[e.target.name] = e.target.value; render(); return; }
  if (e.target.matches('[data-act="liga-sel"]')) { S.ligaSel = Number(e.target.value); render(); }
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]'); if (!form) return;
  e.preventDefault();
  const tipo = form.dataset.form;
  if (tipo === 'adm-jog') { if (S.ehAdmin) await filtrarAdm(form); return; }
  if (tipo === 'novidade') {
    if (!S.ehAdmin) return;
    const v = Object.fromEntries(new FormData(form));
    const r = await agir(() => api.admNovidadePublicar(String(v.titulo || ''), String(v.texto || '')), { ok: 'Novidade publicada!', recarregar: false });
    if (r) { const d = await api.avisosCentral().catch(() => null); if (d && S.modal?.t === 'avisos') { S.modal = { t: 'avisos', d }; S.avisosN = 0; render(); } }
    return;
  }
  if (tipo === 'criar') {
    S.erro = '';
    const f = S.form; if (f.modo === 'texto' && !nomeServeParaTexto(f.nome)) f.modo = 'simbolo'; aplicarIc('criar');
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

iniciarAdm({ S, esc, agir, toast, render });
iniciarMarketing({ S, esc, fmt, IMG, agir, render, nomeVaga: (v) => NOME_VAGA[v] || v, atualizarMeu: async () => { S.meu = await api.meu(); if (S.meu.org) S.painel = await api.painel(); } });
iniciarExtras({
  S, esc, fmt, IMG, agir, toast, render, novaChave, escudoHtml, estrelasHtml, nomeLiga, dataCurta,
  nomeVaga: (v) => NOME_VAGA[v] || v,
  atualizarMeu: async () => { S.meu = await api.meu(); if (S.meu.org) S.painel = await api.painel(); },
});

// ------------------------------------------------------------------ início
carregarFontes().then((ok) => { if (ok && S.meu) render(); }); // com as fontes carregadas o emblema de texto é medido e desenhado certo
(async function iniciar() {
  await platform.init();
  const teste = ['localhost', '127.0.0.1'].includes(location.hostname) && /[?&]teste=1/.test(location.search);
  const user = platform.getUser();
  const souAdmin = await platform.podeJogosEmTeste();
  S.ehAdmin = await platform.isAdmin().catch(() => false);
  const aberto = !gameById(GAME_ID)?.soAdmin;
  if (!user && !teste) { telaMensagem('Entre na sua conta', 'O simulador de técnico precisa de uma conta para guardar a sua organização.', null); return; }
  if (!souAdmin && !teste && !aberto) { telaMensagem('Em desenvolvimento', 'Este jogo ainda está em teste e só administradores e convidados conseguem jogar por enquanto.', ['../../', 'Voltar ao início']); return; }
  try {
    await api.sincronizar();
    S.meu = await api.meu();
    if (S.meu.org && !S.meu.org.elenco_pendente) { await abrirComResumo(); S.meu = await api.meu(); }
    if (S.meu.org) { S.painel = await api.painel(); S.gp = await api.gameplayPendente().catch(() => null); S.avisosN = await api.avisosContagem().catch(() => 0); S.idiomas = await api.idiomas().catch(() => null); }
    render();
  } catch (e) {
    telaMensagem('Não foi possível abrir o jogo', e.message, ['../../', 'Voltar ao início']);
  }
}());
