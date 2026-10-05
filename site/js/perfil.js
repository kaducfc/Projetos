// Página "Meu perfil": ícone, nome, ranqueada (em breve), estatísticas por
// jogo, histórico de partidas e configurações da conta.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { GAMES, gameById } from '../shared/config.js';
import { AVATARES, ESPECIAIS, EXCLUSIVOS, avatarHtml, nomeAvatar } from '../shared/avatar.js';
import { nomeRecompensa, tipoTexto } from '../shared/recompensas.js';
import { problemaNoNome } from '../shared/nomes.js';
import { cardMinhaRanqueada } from './ranqueada-card.js';
import { nickHtml } from '../shared/apoio.js';
import { EFEITOS, efeitoAtivo } from '../shared/efeitos.js';
import { localeAtual } from '../shared/i18n.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../' });
mountSiteFooter(document.getElementById('site-footer'));

const root = document.getElementById('perfil');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const num = (n) => (n == null ? '—' : Number(n).toLocaleString(localeAtual()));
const data = (iso, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => new Date(iso).toLocaleDateString(localeAtual(), opts);
const hora = (iso) => new Date(iso).toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' });
const nomeJogo = (id) => gameById(id)?.name || id;

let resultados = [];
let status = null; // situação na ranqueada
let filtro = 'todos';
let mostrar = 20;
// Histórico começa fechado (abre direto se vier do link "Meu histórico").
let histAberto = location.hash === '#historico';

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('pf-toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

// ------------------------------------------------------------------ partes da página

function cabecalho(u) {
  const contas = u.providers.map((p) => (p === 'google' ? 'Google' : 'E-mail e senha')).join(' + ');
  return `<section class="pf-card pf-head">
    <button type="button" class="pf-avatar" data-act="icone" title="Trocar ícone">
      ${avatarHtml(u.avatar, u.username, 104, u.elo ? `elo-${u.elo}` : '')}
      <span class="pf-avatar-edit">Trocar</span>
    </button>
    <div class="pf-who">
      <p class="eyebrow">◆ Meu perfil</p>
      <h1 class="display">${nickHtml(u.username, u.apoioTotal > 0, u.efeito)}</h1>
      <p class="muted small">${u.createdAt ? `No Rift Arcade desde ${data(u.createdAt, { month: 'long', year: 'numeric' })} · ` : ''}Entra com ${contas}</p>
    </div>
  </section>`;
}

// Efeito no nome: menu que abre e mostra uma prévia de cada efeito. Os que o
// jogador ainda não tem ficam apagados e, ao tocar, explicam como conseguir.
const EFEITOS_NENHUM = { id: 'nenhum' };
let efeitoAberto = false;
let efeitoInfo = null; // id do efeito travado que está mostrando o requisito
let efeitosGanhos = new Set(); // efeitos ganhos por código

const possuiEfeito = (u, id) => (id === 'reflexo' ? u.apoioTotal > 0 : efeitosGanhos.has(id));

function cardEfeito(u) {
  const atual = efeitoAtivo(u.efeito, u.apoioTotal > 0);
  const escolhido = atual?.id || 'nenhum';
  const opcao = ({ id, nome, classe, como, link }) => {
    const livre = id === 'nenhum' || possuiEfeito(u, id);
    const previa = id === 'nenhum' ? `<span class="nick">${esc(u.username)}</span>` : `<span class="nick fx ${classe}">${esc(u.username)}</span>`;
    const requisito = !livre && efeitoInfo === id
      ? `<p class="pf-ef-como" role="status">🔒 ${esc(como)}${link ? ` <a href="${link.href}">${esc(link.texto)}</a>` : ''}</p>` : '';
    return `<li class="pf-ef${livre ? '' : ' trava'}${escolhido === id ? ' on' : ''}" data-ef="${id}">
      <button type="button" class="pf-ef-previa" data-act="efeito-ver" data-ef="${id}" aria-label="Efeito ${esc(nome)}">${previa}</button>
      <span class="pf-ef-nome">${esc(nome)}</span>
      <button type="button" class="${escolhido === id ? 'btn-ghost' : 'btn-primary'} pf-ef-btn" data-act="efeito-escolher" data-ef="${id}"${livre ? '' : ' aria-disabled="true"'}${escolhido === id ? ' disabled' : ''}>${escolhido === id ? 'Selecionado' : livre ? 'Selecionar' : '🔒 Bloqueado'}</button>
      ${requisito}</li>`;
  };
  return `<section class="pf-card pf-efeito">
    <div class="pf-ef-topo">
      <div>
        <p class="eyebrow">✦ Efeito</p>
        <p class="pf-apoio-txt pf-ef-atual"><span class="pf-ef-rotulo">${esc(atual ? atual.nome : 'Sem efeito')}</span> : ${nickHtml(u.username, u.apoioTotal > 0, u.efeito)}</p>
      </div>
      <button type="button" class="btn-ghost pf-ef-abrir" data-act="efeito-abrir" aria-expanded="${efeitoAberto}">${efeitoAberto ? 'Fechar' : 'Abrir'}</button>
    </div>
    ${efeitoAberto ? `<ul class="pf-ef-lista">${opcao({ id: 'nenhum', nome: 'Sem efeito' })}${EFEITOS.map(opcao).join('')}</ul>
    <p class="muted small pf-ef-nota">Novos efeitos chegam por doação e por códigos de recompensa. Só muda a aparência do seu nome.</p>` : ''}
  </section>`;
}

// Apoio ao site: quem apoiou ganha o efeito Reflexo no nick.
function cardApoio(u) {
  const apoiou = u.apoioTotal > 0;
  return `<section class="pf-card pf-apoio">
    <div>
      <p class="eyebrow">♥ Apoie o Rift Arcade</p>
      <p class="pf-apoio-txt">${apoiou
    ? 'Obrigado pelo apoio! Seu nick ganhou o efeito <b>Apoiador</b> no perfil, no ranking e na barra do site.'
    : 'O site é gratuito. Apoiando com qualquer valor, você ajuda a mantê-lo no ar e seu nick ganha um <b>efeito dourado especial</b>, sem vantagem nos jogos.'}</p>
    </div>
    <a class="btn-primary pf-apoio-btn" href="/apoiar/">${apoiou ? 'Apoiar de novo' : '♥ Apoiar'}</a>
  </section>`;
}

// Código de recompensa: ícones exclusivos, efeitos no nome etc.
function cardCodigo() {
  return `<section class="pf-card pf-apoio pf-codigo">
    <div>
      <p class="eyebrow">🎁 Código de recompensa</p>
      <p class="pf-apoio-txt">Tem um código? Resgate para ganhar ícones exclusivos, efeitos no nome e outras surpresas.</p>
    </div>
    <button type="button" class="btn-primary pf-apoio-btn" data-act="codigo">Resgatar código</button>
  </section>`;
}

function resumo() {
  const total = resultados.length;
  const jogos = new Set(resultados.map((r) => r.gameId));
  const dias = new Set(resultados.map((r) => r.playedAt.slice(0, 10)));
  const tiles = [
    ['Partidas', num(total)],
    ['Jogos diferentes', `${jogos.size}<small>/${GAMES.length}</small>`],
    ['Dias jogando', num(dias.size)],
    ['Última partida', total ? data(resultados[0].playedAt, { day: '2-digit', month: '2-digit' }) : '—'],
  ];
  const porJogo = GAMES.map((g) => {
    const rs = resultados.filter((r) => r.gameId === g.id);
    const best = rs.reduce((m, r) => (r.score != null && (m == null || r.score > m) ? r.score : m), null);
    return `<a class="pf-game" href="../${g.path}">
      <span class="pf-game-kind">${esc(g.kind)}</span>
      <b>${esc(g.name)}</b>
      <span class="pf-game-nums"><span><em>${num(rs.length)}</em> ${rs.length === 1 ? 'partida' : 'partidas'}</span><span>recorde <em>${num(best)}</em></span></span>
    </a>`;
  }).join('');
  return `<section class="pf-sec">
    <h2 class="section-title">Resumo</h2>
    <div class="pf-tiles">${tiles.map(([l, v]) => `<div class="pf-tile"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    <div class="pf-games">${porJogo}</div>
  </section>`;
}

function historico() {
  const lista = filtro === 'todos' ? resultados : resultados.filter((r) => r.gameId === filtro);
  const chips = [['todos', 'Todos'], ...GAMES.map((g) => [g.id, g.name])]
    .map(([id, nome]) => `<button type="button" data-filtro="${id}" class="${filtro === id ? 'on' : ''}">${esc(nome)}</button>`).join('');
  const linhas = lista.slice(0, mostrar).map((r) => `<li>
      <span class="h-when">${data(r.playedAt, { day: '2-digit', month: '2-digit', year: '2-digit' })}<small>${hora(r.playedAt)}</small></span>
      <span class="h-what"><b>${esc(nomeJogo(r.gameId))}</b><span>${esc(r.summary?.text || '')}</span></span>
      <span class="h-score">${r.score != null ? `${num(r.score)}<small>pts</small>` : ''}</span>
    </li>`).join('');
  return `<section class="pf-sec" id="historico">
    <button type="button" class="pf-toggle" data-act="historico" aria-expanded="${histAberto}">
      <span class="section-title">Histórico de partidas</span>
      <span class="pf-toggle-n">${num(resultados.length)} ${resultados.length === 1 ? 'partida' : 'partidas'}</span>
      <span class="pf-toggle-seta" aria-hidden="true">▾</span>
    </button>
    ${histAberto ? `<div class="pf-chips" role="group" aria-label="Filtrar por jogo">${chips}</div>
    ${lista.length ? `<ul class="pf-hist">${linhas}</ul>` : '<p class="muted">Nenhuma partida aqui ainda.</p>'}
    ${lista.length > mostrar ? '<button type="button" class="pf-more" data-act="mais">Ver mais partidas</button>' : ''}` : ''}
  </section>`;
}

function conta(u) {
  const proxima = platform.nextUsernameChange();
  const temSenha = u.providers.includes('email');
  return `<section class="pf-sec">
    <h2 class="section-title">Conta</h2>
    <div class="pf-forms">
      <form class="pf-card pf-form" data-form="nome" novalidate>
        <h3>Nome de usuário</h3>
        <p class="muted small">Pode ser trocado 1 vez a cada ${platform.TROCA_NOME_DIAS} dias.${proxima ? ` Próxima troca liberada em <b>${platform.tempoAte(proxima)}</b>.` : ''}</p>
        <input name="nome" maxlength="20" autocomplete="username" value="${esc(u.username)}" aria-label="Nome de usuário" />
        <p class="pf-msg" role="status"></p>
        <button type="submit" class="btn-primary">Salvar nome</button>
      </form>
      <form class="pf-card pf-form" data-form="senha" novalidate>
        <h3>${temSenha ? 'Trocar senha' : 'Criar senha'}</h3>
        <p class="muted small">${temSenha ? 'Confirme a senha atual para escolher uma nova.' : 'Sua conta entra pelo Google. Criando uma senha, você também pode entrar com e-mail e senha.'}</p>
        <input type="email" name="email" value="${esc(u.email || '')}" autocomplete="username" hidden />
        ${temSenha ? '<input type="password" name="atual" autocomplete="current-password" placeholder="Senha atual" aria-label="Senha atual" />' : ''}
        <input type="password" name="nova" autocomplete="new-password" minlength="6" placeholder="Nova senha (mín. 6 caracteres)" aria-label="Nova senha" />
        <input type="password" name="confirma" autocomplete="new-password" placeholder="Repita a nova senha" aria-label="Repita a nova senha" />
        <p class="pf-msg" role="status"></p>
        <button type="submit" class="btn-primary">${temSenha ? 'Trocar senha' : 'Criar senha'}</button>
      </form>
      <div class="pf-card pf-form">
        <h3>E-mail</h3>
        <p class="pf-email">${esc(u.email || '')}</p>
        <p class="muted small">É por ele que você entra e recebe o link de "Esqueci minha senha".</p>
        <button type="button" class="btn-ghost" data-act="sair">Sair da conta</button>
      </div>
      <div class="pf-card pf-form pf-danger">
        <h3>Excluir conta</h3>
        <p class="muted small">Apaga a conta, o nome de usuário, o progresso salvo e todo o histórico. Não dá para desfazer.</p>
        <button type="button" class="btn-danger" data-act="excluir">Excluir minha conta</button>
      </div>
    </div>
  </section>`;
}

function render() {
  const u = platform.getUser();
  if (!platform.cloudEnabled()) {
    root.innerHTML = '<section class="pf-card pf-lock"><p>O perfil precisa de conexão com o servidor do site, que não está disponível nesta versão.</p></section>';
    return;
  }
  if (!u) {
    root.innerHTML = `<section class="pf-card pf-lock">
      <h1 class="display">Meu perfil</h1>
      <p>Entre na sua conta para ver o seu perfil: ícone, estatísticas, histórico de partidas e configurações.</p>
      <button type="button" class="btn-primary" data-act="entrar">Entrar ou criar conta</button>
    </section>`;
    return;
  }
  root.innerHTML = `${cabecalho(u)}${cardEfeito(u)}${cardMinhaRanqueada(status)}${cardApoio(u)}${cardCodigo()}${resumo()}${historico()}${conta(u)}`;
}

let carregando = true;
async function carregar() {
  await platform.init();
  if (platform.getUser()) {
    let recs;
    [resultados, status, recs] = await Promise.all([platform.listResults({ limit: 500 }), platform.rankedStatus(), platform.minhasRecompensas()]);
    efeitosGanhos = new Set(recs.filter((r) => r.tipo === 'efeito').map((r) => r.chave));
  }
  carregando = false;
  render();
  if (location.hash === '#historico') document.getElementById('historico')?.scrollIntoView();
}

// ------------------------------------------------------------------ janelas

function janela(html, onClick) {
  const el = document.createElement('div');
  el.className = 'pf-backdrop';
  el.innerHTML = `<div class="pf-modal" role="dialog" aria-modal="true">${html}</div>`;
  const fechar = () => { el.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-fechar]')) return fechar();
    onClick?.(e, fechar);
  });
  document.addEventListener('keydown', tecla);
  document.body.append(el);
  return el;
}

async function escolherIcone() {
  const u = platform.getUser();
  const botao = (id) => `<button type="button" class="pf-icone${u.avatar === id ? ' on' : ''}" data-icone="${id}" title="${esc(nomeAvatar(id))}" aria-label="${esc(nomeAvatar(id))}">${avatarHtml(id, nomeAvatar(id), 64)}</button>`;
  // Especiais de apoiador ficam na mesma grade: travados (cadeado) até o
  // servidor liberar; o clique num travado explica como liberar.
  const travado = (x) => `<button type="button" class="pf-icone pf-travado" data-travado="${x.id}" title="${esc(x.nome)} (bloqueado)" aria-label="${esc(`${x.nome} (bloqueado)`)}">${avatarHtml(`icone:${x.id}`, x.nome, 64)}<span class="pf-cadeado" aria-hidden="true">🔒</span></button>`;
  // Especial liberado: o clique mostra o título (com a ordem, no dos 100
  // primeiros) e um botão para usar.
  const especial = (x) => `<button type="button" class="pf-icone${u.avatar === `icone:${x.id}` ? ' on' : ''}" data-especial="${x.id}" title="${esc(x.nome)}" aria-label="${esc(x.nome)}">${avatarHtml(`icone:${x.id}`, x.nome, 64)}</button>`;
  // Exclusivos (de código de recompensa) só aparecem para quem ganhou.
  const grade = (selos, ganhos = new Set()) => [...AVATARES.map(botao),
    ...EXCLUSIVOS.filter((x) => ganhos.has(x.id)).map((x) => botao(`icone:${x.id}`)),
    ...ESPECIAIS.map((x) => (selos?.[x.selo] ? especial(x) : travado(x)))].join('');
  let selos = null;
  let ganhos = new Set();
  let vagas = null;
  const el = janela(`<h2 class="display">Escolha seu ícone</h2>
    <div class="pf-grade" data-grade>${grade(null)}</div>
    <p class="pf-info" data-info role="status" hidden></p>
    <button type="button" class="btn-ghost" data-fechar>Fechar</button>`, async (e, fechar) => {
    const t = e.target.closest('[data-travado]');
    if (t) {
      const x = ESPECIAIS.find((k) => k.id === t.dataset.travado);
      const extra = x.selo === 'pioneiro' && vagas != null ? (vagas ? ` Restam <b>${vagas}</b> vagas.` : ' As 100 vagas já foram preenchidas.') : '';
      const info = el.querySelector('[data-info]');
      info.innerHTML = `🔒 <b>${esc(x.nome)}</b> · ${esc(x.regra)}${extra} <a href="/apoiar/">Apoiar e liberar</a>`;
      info.hidden = false;
      return;
    }
    const sp = e.target.closest('[data-especial]');
    if (sp) {
      const x = ESPECIAIS.find((k) => k.id === sp.dataset.especial);
      const ordem = x.selo === 'pioneiro' && selos?.posicao
        ? `<span class="pf-ordem">${selos.posicao}/100</span> Você foi o apoiador nº ${selos.posicao} do site.`
        : 'Obrigado por apoiar o site!';
      const info = el.querySelector('[data-info]');
      info.innerHTML = `<span class="pf-info-tit">⭐ <b>${esc(x.nome)}</b></span> ${ordem}
        <button type="button" class="btn-primary pf-usar" data-icone="icone:${x.id}">${u.avatar === `icone:${x.id}` ? 'Em uso' : 'Usar este ícone'}</button>`;
      info.hidden = false;
      return;
    }
    const b = e.target.closest('[data-icone]');
    if (!b) return;
    try {
      await platform.setAvatar(b.dataset.icone);
      fechar();
      render();
      toast('Ícone atualizado!');
    } catch (err) {
      toast(err.message);
    }
  });
  let recompensas;
  [selos, vagas, recompensas] = await Promise.all([platform.meusSelos(), platform.pioneirosVagas(), platform.minhasRecompensas()]);
  ganhos = new Set(recompensas.filter((r) => r.tipo === 'icone').map((r) => r.chave));
  efeitosGanhos = new Set(recompensas.filter((r) => r.tipo === 'efeito').map((r) => r.chave));
  const g = el.querySelector('[data-grade]');
  if (g) g.innerHTML = grade(selos, ganhos);
}

// Janela "Resgatar código": digita, o servidor confere e mostra o que ganhou.
function resgatarCodigo() {
  const el = janela(`<h2 class="display">Resgatar código</h2>
    <p class="muted small">Digite o código que você recebeu. Cada código vale uma vez por conta.</p>
    <form data-form-codigo novalidate>
      <input name="codigo" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40" placeholder="XXXX-XXXX-XXXX-XXXX" aria-label="Código" />
      <p class="pf-msg" role="status"></p>
      <div class="pf-acts"><button type="button" class="btn-ghost" data-fechar>Fechar</button>
        <button type="submit" class="btn-primary">Resgatar</button></div>
    </form>`, (e, fechar) => {
    if (e.target.closest('[data-escolher-icone]')) { fechar(); escolherIcone(); }
  });
  const form = el.querySelector('[data-form-codigo]');
  const msg = form.querySelector('.pf-msg');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const botao = form.querySelector('button[type="submit"]');
    msg.textContent = '';
    msg.className = 'pf-msg';
    botao.disabled = true;
    try {
      const { recompensas, novas } = await platform.resgatarCodigo(form.codigo.value);
      const novaChave = new Set(novas.map((r) => `${r.tipo}:${r.chave}`));
      const linhas = recompensas.map((r) => `<li><span class="pf-rec-tipo">${esc(tipoTexto(r.tipo))}</span> <b>${esc(nomeRecompensa(r.tipo, r.chave))}</b>${novaChave.has(`${r.tipo}:${r.chave}`) ? '' : ' <small>(você já tinha)</small>'}</li>`).join('');
      const temIcone = recompensas.some((r) => r.tipo === 'icone');
      recompensas.filter((r) => r.tipo === 'efeito').forEach((r) => efeitosGanhos.add(r.chave));
      el.querySelector('.muted.small')?.remove();
      form.outerHTML = `<div class="pf-resgate-ok" role="status">
        <p class="pf-info-tit">🎉 <b>Código resgatado!</b></p>
        <ul class="pf-rec-lista">${linhas}</ul>
        <div class="pf-acts"><button type="button" class="btn-ghost" data-fechar>Fechar</button>
          ${temIcone ? '<button type="button" class="btn-primary" data-escolher-icone>Escolher ícone</button>' : ''}</div>
      </div>`;
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'pf-msg err';
      botao.disabled = false;
    }
  });
  form.codigo.focus();
}

function confirmarExclusao() {
  const u = platform.getUser();
  const el = janela(`<h2 class="display">Excluir conta?</h2>
    <p>Isso apaga <b>${esc(u.username)}</b>, o progresso salvo e todo o histórico de partidas. Não dá para desfazer.</p>
    <label class="pf-label">Para confirmar, digite o seu nome de usuário:
      <input name="confirma" autocomplete="off" />
    </label>
    <p class="pf-msg" role="status"></p>
    <div class="pf-acts"><button type="button" class="btn-ghost" data-fechar>Cancelar</button>
      <button type="button" class="btn-danger" data-act="confirmar-exclusao" disabled>Excluir para sempre</button></div>`, async (e, fechar) => {
    const b = e.target.closest('[data-act="confirmar-exclusao"]');
    if (!b) return;
    b.disabled = true;
    b.textContent = 'Excluindo…';
    try {
      await platform.deleteAccount();
      fechar();
      resultados = [];
      render();
      toast('Conta excluída.');
    } catch (err) {
      el.querySelector('.pf-msg').textContent = err.message;
      b.disabled = false;
      b.textContent = 'Excluir para sempre';
    }
  });
  const input = el.querySelector('input');
  input.addEventListener('input', () => {
    el.querySelector('[data-act="confirmar-exclusao"]').disabled = input.value.trim().toLowerCase() !== u.username.toLowerCase();
  });
  input.focus();
}

// ------------------------------------------------------------------ eventos

root.addEventListener('click', async (e) => {
  const f = e.target.closest('[data-filtro]');
  if (f) {
    filtro = f.dataset.filtro;
    mostrar = 20;
    render();
    document.getElementById('historico')?.scrollIntoView({ block: 'nearest' });
    return;
  }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'entrar') openAuthModal('login');
  if (act === 'icone') escolherIcone();
  if (act === 'codigo') resgatarCodigo();
  if (act === 'efeito-abrir') { efeitoAberto = !efeitoAberto; efeitoInfo = null; render(); }
  if (act === 'efeito-ver' || act === 'efeito-escolher') {
    const id = b.dataset.ef;
    const u = platform.getUser();
    const efeito = id === 'nenhum' ? EFEITOS_NENHUM : EFEITOS.find((x) => x.id === id);
    if (!efeito) return;
    if (id !== 'nenhum' && !possuiEfeito(u, id)) { efeitoInfo = efeitoInfo === id ? null : id; render(); return; }
    if (act === 'efeito-ver') return;
    efeitoInfo = null;
    b.disabled = true;
    try {
      await platform.setEfeito(id);
      toast('Efeito atualizado!');
    } catch (err) {
      toast(err.message);
      render();
    }
  }
  if (act === 'mais') { mostrar += 30; render(); }
  if (act === 'historico') { histAberto = !histAberto; render(); }
  if (act === 'excluir') confirmarExclusao();
  if (act === 'sair') { b.disabled = true; await platform.signOut(); }
});

root.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = form.querySelector('.pf-msg');
  const botao = form.querySelector('button[type="submit"]');
  const erro = (t) => { msg.textContent = t; msg.className = 'pf-msg err'; };
  msg.textContent = '';
  msg.className = 'pf-msg';
  if (form.dataset.form === 'nome') {
    const nome = form.nome.value.trim();
    const problema = problemaNoNome(nome);
    if (problema) return erro(problema);
    if (nome === platform.getUser().username) return erro('Esse já é o seu nome.');
  }
  if (form.dataset.form === 'senha') {
    if (form.nova.value.length < 6) return erro('A senha nova precisa ter pelo menos 6 caracteres.');
    if (form.nova.value !== form.confirma.value) return erro('As duas senhas novas não são iguais.');
  }
  botao.disabled = true;
  try {
    if (form.dataset.form === 'nome') {
      await platform.changeUsername(form.nome.value.trim());
      render();
      toast('Nome de usuário atualizado!');
    } else {
      await platform.changePassword({ current: form.atual?.value || '', password: form.nova.value });
      form.reset();
      render();
      toast('Senha salva!');
    }
  } catch (err) {
    erro(err.message);
  } finally {
    botao.disabled = false;
  }
});

platform.onChange(async (evt) => {
  if (evt.type !== 'auth' || carregando) return;
  // Entrou ou saiu: recarrega o histórico da conta. Só trocou nome/ícone: redesenha.
  if (evt.user && !resultados.length) resultados = await platform.listResults({ limit: 500 });
  if (evt.user && !status) status = await platform.rankedStatus();
  if (!evt.user) { resultados = []; status = null; }
  if (!document.querySelector('.pf-backdrop')) render();
});
platform.onChange((evt) => {
  if (evt.type === 'results' && platform.getUser()) platform.listResults({ limit: 500 }).then((r) => { resultados = r; render(); });
});

window.addEventListener('hashchange', () => {
  if (location.hash !== '#historico' || !platform.getUser()) return;
  histAberto = true;
  render();
  document.getElementById('historico')?.scrollIntoView();
});

carregar();
