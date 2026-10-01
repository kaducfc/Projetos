// Página "Meu perfil": ícone, nome, ranqueada (em breve), estatísticas por
// jogo, histórico de partidas e configurações da conta.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { GAMES, gameById } from '../shared/config.js';
import { AVATARES, avatarHtml, hydrateAvatars, nomeAvatar } from '../shared/avatar.js';
import { problemaNoNome } from '../shared/nomes.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../' });
mountSiteFooter(document.getElementById('site-footer'));

const root = document.getElementById('perfil');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const data = (iso, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => new Date(iso).toLocaleDateString('pt-BR', opts);
const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const nomeJogo = (id) => gameById(id)?.name || id;

let resultados = [];
let filtro = 'todos';
let mostrar = 20;

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('pf-toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

// ------------------------------------------------------------------ ranqueada

// Elos do modo ranqueado (do Bronze ao Challenger, como no LoL).
const ELOS = [
  ['bronze', 'Bronze', '#a8714a'], ['prata', 'Prata', '#aab4be'], ['ouro', 'Ouro', '#e2b33f'],
  ['platina', 'Platina', '#4fc1b4'], ['esmeralda', 'Esmeralda', '#3fbf6f'], ['diamante', 'Diamante', '#6f8cff'],
  ['mestre', 'Mestre', '#b26cf0'], ['grao-mestre', 'Grão-Mestre', '#e5534b'], ['challenger', 'Challenger', '#f5cf5a'],
];

// Quando o ranqueado existir, `rank` virá do perfil:
// { elo: 'ouro', divisao: 'II', pontos: 45, vitorias: 12, derrotas: 9, temporada: 1 }
function cardRanqueada(rank) {
  const escada = ELOS.map(([id, nome, cor]) => `<span class="elo${rank?.elo === id ? ' on' : ''}" style="--cor:${cor}">${nome}</span>`).join('');
  if (!rank) {
    return `<section class="pf-card pf-rank">
      <div class="rank-emblema vazio" aria-hidden="true"><svg viewBox="0 0 64 72"><path d="M32 3 60 14v22c0 17-12 28-28 33C16 64 4 53 4 36V14Z"/></svg><span>?</span></div>
      <div class="rank-info">
        <p class="eyebrow">Ranqueada</p>
        <h2 class="display">Sem ranque</h2>
        <p class="muted small">O modo ranqueado está chegando. Jogue as partidas de classificação e suba do Bronze ao Challenger.</p>
        <div class="escada">${escada}</div>
      </div>
    </section>`;
  }
  const [, nome, cor] = ELOS.find(([id]) => id === rank.elo) || ELOS[0];
  const jogos = (rank.vitorias || 0) + (rank.derrotas || 0);
  return `<section class="pf-card pf-rank" style="--cor:${cor}">
    <div class="rank-emblema" aria-hidden="true"><svg viewBox="0 0 64 72"><path d="M32 3 60 14v22c0 17-12 28-28 33C16 64 4 53 4 36V14Z"/></svg><span>${esc(rank.divisao || '')}</span></div>
    <div class="rank-info">
      <p class="eyebrow">Ranqueada · Temporada ${esc(rank.temporada || 1)}</p>
      <h2 class="display">${esc(nome)} ${esc(rank.divisao || '')}</h2>
      <p class="muted small">${num(rank.pontos)} pontos · ${num(rank.vitorias)}V ${num(rank.derrotas)}D${jogos ? ` · ${Math.round((rank.vitorias / jogos) * 100)}% de vitórias` : ''}</p>
      <div class="escada">${escada}</div>
    </div>
  </section>`;
}

// ------------------------------------------------------------------ partes da página

function cabecalho(u) {
  const contas = u.providers.map((p) => (p === 'google' ? 'Google' : 'E-mail e senha')).join(' + ');
  return `<section class="pf-card pf-head">
    <button type="button" class="pf-avatar" data-act="icone" title="Trocar ícone">
      ${avatarHtml(u.avatar, u.username, 104)}
      <span class="pf-avatar-edit">Trocar</span>
    </button>
    <div class="pf-who">
      <p class="eyebrow">◆ Meu perfil</p>
      <h1 class="display">${esc(u.username)}</h1>
      <p class="muted small">${u.createdAt ? `No Rift Arcade desde ${data(u.createdAt, { month: 'long', year: 'numeric' })} · ` : ''}Entra com ${contas}</p>
    </div>
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
    <h2 class="section-title">Histórico de partidas</h2>
    <div class="pf-chips" role="group" aria-label="Filtrar por jogo">${chips}</div>
    ${lista.length ? `<ul class="pf-hist">${linhas}</ul>` : '<p class="muted">Nenhuma partida aqui ainda.</p>'}
    ${lista.length > mostrar ? '<button type="button" class="pf-more" data-act="mais">Ver mais partidas</button>' : ''}
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
        <p class="muted small">Pode ser trocado 1 vez a cada 7 dias.${proxima ? ` Próxima troca liberada em <b>${data(proxima.toISOString())}</b>.` : ''}</p>
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
  root.innerHTML = `${cabecalho(u)}${cardRanqueada(u.rank || null)}${resumo()}${historico()}${conta(u)}`;
  hydrateAvatars(root);
}

async function carregar() {
  await platform.init();
  if (platform.getUser()) resultados = await platform.listResults({ limit: 500 });
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

function escolherIcone() {
  const u = platform.getUser();
  const grade = AVATARES.map((id) => `<button type="button" class="pf-icone${u.avatar === id ? ' on' : ''}" data-icone="${id}" title="${esc(nomeAvatar(id))}" aria-label="${esc(nomeAvatar(id))}">${avatarHtml(id, nomeAvatar(id), 64)}</button>`).join('');
  const el = janela(`<h2 class="display">Escolha seu ícone</h2>
    <div class="pf-grade">${grade}</div>
    <button type="button" class="btn-ghost" data-fechar>Fechar</button>`, async (e, fechar) => {
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
  hydrateAvatars(el);
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
  if (act === 'mais') { mostrar += 30; render(); }
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
  if (evt.type !== 'auth') return;
  // Entrou ou saiu: recarrega o histórico da conta. Só trocou nome/ícone: redesenha.
  if (evt.user && !resultados.length) resultados = await platform.listResults({ limit: 500 });
  if (!evt.user) resultados = [];
  if (!document.querySelector('.pf-backdrop')) render();
});
platform.onChange((evt) => {
  if (evt.type === 'results' && platform.getUser()) platform.listResults({ limit: 500 }).then((r) => { resultados = r; render(); });
});

carregar();
