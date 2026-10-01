// Barra do site + conta (Entrar / Criar conta / menu do usuário).
// Usada pelo hub e por todos os jogos: mountSiteBar(el, { hubHref }).
import * as platform from './platform.js';
import { SITE_NAME } from './config.js';
import { avatarHtml, hydrateAvatars } from './avatar.js';

// Logo para fundo escuro, a partir da raiz do domínio (serve em qualquer página).
const LOGO_URL = '/shared/assets/marca/logo-barra.png?v=2';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export function mountSiteBar(el, { hubHref = null, showBrand = true } = {}) {
  el.classList.add('site-bar');
  const paint = () => {
    const u = platform.getUser();
    const logo = `<img class="sb-logo" src="${LOGO_URL}" alt="${esc(SITE_NAME)}" width="96" height="36" />`;
    let brand = '<span></span>';
    if (showBrand && platform.isStandalone()) brand = `<span class="sb-brand">${esc(SITE_NAME)}</span>`;
    else if (showBrand && hubHref) brand = `<a class="sb-brand" href="${hubHref}" title="Voltar ao início"><span aria-hidden="true">←</span>${logo}</a>`;
    else if (showBrand) brand = `<span class="sb-brand">${logo}</span>`;
    let account;
    if (!platform.cloudEnabled()) {
      account = '<span class="sb-note" title="Nesta versão o progresso fica só neste navegador.">Modo visitante</span>';
    } else if (u) {
      account = `
        <div class="sb-user">
          <button type="button" class="sb-btn" data-sb="menu" aria-haspopup="true">
            ${avatarHtml(u.avatar, u.username, 22, 'sb-avatar')}${esc(u.username)}<span aria-hidden="true">▾</span>
          </button>
          <div class="sb-menu" hidden>
            <div class="sb-menu-email">${esc(u.email || '')}</div>
            <a href="/perfil/">Meu perfil</a>
            <a href="/perfil/#historico">Meu histórico</a>
            <a href="/painel/" data-sb-admin hidden>Painel</a>
            <button type="button" data-sb="logout">Sair</button>
          </div>
        </div>`;
    } else {
      account = `<span class="sb-note">Visitante: o progresso fica neste navegador</span>
        <button type="button" class="sb-btn sb-primary" data-sb="login">Entrar</button>`;
    }
    el.innerHTML = `${brand}<div class="sb-right">${account}</div>`;
    hydrateAvatars(el);
    if (u) revealAdmin(u.id);
  };
  // Link do painel só para administradores (checado uma vez por conta).
  let adminFor = null;
  let admin = false;
  const revealAdmin = (id) => {
    const show = () => { const a = el.querySelector('[data-sb-admin]'); if (a) a.hidden = !admin; };
    if (adminFor === id) return show();
    adminFor = id;
    platform.isAdmin().then((ok) => { admin = ok; show(); });
  };

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-sb]');
    if (!b) return;
    if (b.dataset.sb === 'login') openAuthModal('login');
    if (b.dataset.sb === 'menu') {
      const menu = el.querySelector('.sb-menu');
      menu.hidden = !menu.hidden;
    }
    if (b.dataset.sb === 'logout') {
      b.disabled = true;
      b.textContent = 'Saindo…';
      await platform.signOut();
    }
  });
  document.addEventListener('click', (e) => {
    if (!el.contains(e.target)) el.querySelector('.sb-menu')?.setAttribute('hidden', '');
  });

  const askUsername = () => {
    const u = platform.getUser();
    if (u?.needsUsername && !platform.isRecovering() && modalMode !== 'username') openAuthModal('username');
  };
  platform.onChange((evt) => {
    if (evt.type === 'auth') {
      paint();
      askUsername();
    }
    if (evt.type === 'recovery') openAuthModal('reset');
    if (evt.type === 'recovery-failed') {
      openAuthModal('forgot', 'Esse link de redefinição venceu ou já foi usado. Peça um novo abaixo.');
    }
  });
  if (platform.isRecovering()) openAuthModal('reset');
  paint();
  platform.init().then(() => { paint(); askUsername(); });
}

// ------------------------------------------------------------------ janela de login

let modal = null;
let modalMode = null;

const GOOGLE_ICON = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
</svg>`;

const MODES = {
  login: {
    title: 'Entre na sua conta',
    sub: 'Seu progresso e seu histórico continuam de onde parou.',
    submit: 'Entrar',
  },
  signup: {
    title: 'Crie sua conta',
    sub: 'Guarde partidas, recordes e progresso de todos os jogos, em qualquer aparelho.',
    submit: 'Criar conta',
  },
  forgot: {
    title: 'Esqueceu a senha?',
    sub: 'Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.',
    submit: 'Enviar link',
  },
  reset: {
    title: 'Crie uma nova senha',
    sub: 'Escolha a senha que vai usar daqui em diante.',
    submit: 'Salvar nova senha',
  },
  username: {
    title: 'Escolha seu nome de usuário',
    sub: 'É assim que você vai aparecer no site. Dá para usar letras, números, "_" e ".".',
    submit: 'Salvar',
  },
};

export function openAuthModal(tab = 'login', notice = '') {
  modal?.remove();
  modalMode = tab;
  modal = document.createElement('div');
  modal.className = 'acc-backdrop';
  modal.innerHTML = `
    <div class="acc-modal" role="dialog" aria-modal="true" aria-labelledby="acc-title">
      <button type="button" class="acc-close" data-acc="close" aria-label="Fechar">×</button>
      <div class="acc-tabs" role="tablist">
        <button type="button" role="tab" data-acc="tab-login">Entrar</button>
        <button type="button" role="tab" data-acc="tab-signup">Criar conta</button>
      </div>
      <h2 id="acc-title" class="acc-title"></h2>
      <p class="acc-sub"></p>
      <div class="acc-social">
        <button type="button" class="acc-google" data-acc="google">${GOOGLE_ICON}<span>Continuar com Google</span></button>
        <div class="acc-or"><span>ou com e-mail</span></div>
      </div>
      <form class="acc-form" novalidate>
        <label class="acc-field acc-username">
          <span>Nome de usuário</span>
          <input id="acc-username" name="username" autocomplete="username" maxlength="20" placeholder="ex.: kadu" />
        </label>
        <label class="acc-field acc-email">
          <span>E-mail</span>
          <input id="acc-email" name="email" type="email" autocomplete="email" required />
        </label>
        <label class="acc-field acc-password">
          <span>Senha</span>
          <input id="acc-password" name="password" type="password" minlength="6" required />
        </label>
        <button type="button" class="acc-link acc-forgot" data-acc="forgot">Esqueci minha senha</button>
        <p class="acc-msg" role="status"></p>
        <button type="submit" class="acc-submit"></button>
        <button type="button" class="acc-link acc-back" data-acc="tab-login">← Voltar para o login</button>
      </form>
    </div>`;
  document.body.appendChild(modal);

  const $ = (sel) => modal.querySelector(sel);
  let mode = tab;
  const setMode = (m) => {
    mode = m;
    modal.querySelectorAll('[data-acc^="tab-"]').forEach((t) => t.classList.toggle('on', t.dataset.acc === `tab-${m}`));
    modalMode = m;
    const onlyOne = m === 'forgot' || m === 'reset' || m === 'username';
    $('.acc-tabs').hidden = onlyOne;
    $('.acc-social').hidden = onlyOne || !platform.cloudEnabled();
    $('.acc-username').hidden = m !== 'signup' && m !== 'username';
    $('.acc-email').hidden = m === 'reset' || m === 'username';
    $('.acc-password').hidden = m === 'forgot' || m === 'username';
    $('.acc-password span').textContent = m === 'reset' ? 'Nova senha' : 'Senha';
    $('#acc-password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    $('#acc-password').value = '';
    $('.acc-forgot').hidden = m !== 'login';
    $('.acc-back').hidden = m !== 'forgot';
    $('.acc-title').textContent = MODES[m].title;
    $('.acc-sub').textContent = MODES[m].sub;
    $('.acc-submit').textContent = MODES[m].submit;
    $('.acc-msg').textContent = '';
    $('.acc-msg').className = 'acc-msg';
  };
  setMode(mode);
  if (mode === 'username') $('#acc-username').value = platform.getUser()?.suggestedUsername || '';
  if (notice) {
    $('.acc-msg').textContent = notice;
    $('.acc-msg').className = 'acc-msg err';
  }

  const close = () => { modal?.remove(); modal = null; modalMode = null; };
  modal.addEventListener('click', (e) => {
    if (e.target === modal) return close();
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    if (b.dataset.acc === 'close') close();
    if (b.dataset.acc === 'tab-login') setMode('login');
    if (b.dataset.acc === 'tab-signup') setMode('signup');
    if (b.dataset.acc === 'google') {
      b.disabled = true;
      platform.signInWithGoogle().catch((err) => {
        b.disabled = false;
        $('.acc-msg').textContent = err.message;
        $('.acc-msg').className = 'acc-msg err';
      });
    }
    if (b.dataset.acc === 'forgot') {
      setMode('forgot');
      $('#acc-email').focus();
    }
  });
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  $('.acc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('.acc-msg');
    const submit = $('.acc-submit');
    const email = $('#acc-email').value.trim();
    const password = $('#acc-password').value;
    const username = $('#acc-username').value.trim();
    const missing = mode === 'forgot' ? (!email ? 'Digite o seu e-mail.' : '')
      : mode === 'reset' ? (!password ? 'Digite a nova senha.' : '')
      : mode === 'username' ? (!username ? 'Digite um nome de usuário.' : '')
        : (!email || !password ? 'Preencha e-mail e senha.' : '');
    if (missing) {
      msg.textContent = missing;
      msg.className = 'acc-msg err';
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Aguarde…';
    msg.textContent = '';
    try {
      if (mode === 'signup') {
        const res = await platform.signUp({ email, password, username });
        if (res.needsConfirmation) {
          setMode('login');
          msg.textContent = `Conta criada! Enviamos um link de confirmação para ${email}. Depois de confirmar, é só entrar.`;
          msg.className = 'acc-msg ok';
        } else {
          close();
        }
      } else if (mode === 'forgot') {
        await platform.requestPasswordReset(email);
        msg.textContent = `Pronto! Se existir uma conta com ${email}, enviamos um link para criar uma senha nova. Confira também o spam.`;
        msg.className = 'acc-msg ok';
      } else if (mode === 'username') {
        await platform.claimUsername(username);
        close();
      } else if (mode === 'reset') {
        await platform.updatePassword(password);
        $('.acc-password').hidden = true;
        $('.acc-submit').hidden = true;
        msg.textContent = 'Senha alterada! Você já está conectado.';
        msg.className = 'acc-msg ok';
        setTimeout(close, 2200);
      } else {
        await platform.signIn({ email, password });
        close();
      }
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'acc-msg err';
    } finally {
      if (modal) {
        submit.disabled = false;
        submit.textContent = MODES[mode].submit;
      }
    }
  });

  ({ signup: $('#acc-username'), username: $('#acc-username'), reset: $('#acc-password') }[mode] || $('#acc-email')).focus();
}
