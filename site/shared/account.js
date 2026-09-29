// Barra do site + conta (Entrar / Criar conta / menu do usuário).
// Usada pelo hub e por todos os jogos: mountSiteBar(el, { hubHref }).
import * as platform from './platform.js';
import { SITE_NAME } from './config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export function mountSiteBar(el, { hubHref = null, showBrand = true } = {}) {
  el.classList.add('site-bar');
  const paint = () => {
    const u = platform.getUser();
    const brand = showBrand
      ? (hubHref && !platform.isStandalone()
        ? `<a class="sb-brand" href="${hubHref}">← ${esc(SITE_NAME)}</a>`
        : `<span class="sb-brand">${esc(SITE_NAME)}</span>`)
      : '<span></span>';
    let account;
    if (!platform.cloudEnabled()) {
      account = '<span class="sb-note" title="Nesta versão o progresso fica só neste navegador.">Modo visitante</span>';
    } else if (u) {
      account = `
        <div class="sb-user">
          <button type="button" class="sb-btn" data-sb="menu" aria-haspopup="true">
            <span class="sb-dot"></span>${esc(u.username)}<span aria-hidden="true">▾</span>
          </button>
          <div class="sb-menu" hidden>
            <div class="sb-menu-email">${esc(u.email || '')}</div>
            ${hubHref ? `<a href="${hubHref}#historico">Meu histórico</a>` : '<a href="#historico">Meu histórico</a>'}
            <button type="button" data-sb="logout">Sair</button>
          </div>
        </div>`;
    } else {
      account = `<span class="sb-note">Visitante: o progresso fica neste navegador</span>
        <button type="button" class="sb-btn sb-primary" data-sb="login">Entrar</button>`;
    }
    el.innerHTML = `${brand}<div class="sb-right">${account}</div>`;
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

  platform.onChange((evt) => { if (evt.type === 'auth') paint(); });
  paint();
  platform.init().then(paint);
}

// ------------------------------------------------------------------ janela de login

let modal = null;

export function openAuthModal(tab = 'login') {
  modal?.remove();
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
      <form class="acc-form" novalidate>
        <label class="acc-field acc-username">
          <span>Nome de usuário</span>
          <input id="acc-username" name="username" autocomplete="username" maxlength="20" placeholder="ex.: kadu" />
        </label>
        <label class="acc-field">
          <span>E-mail</span>
          <input id="acc-email" name="email" type="email" autocomplete="email" required />
        </label>
        <label class="acc-field">
          <span>Senha</span>
          <input id="acc-password" name="password" type="password" minlength="6" required />
        </label>
        <p class="acc-msg" role="status"></p>
        <button type="submit" class="acc-submit"></button>
      </form>
    </div>`;
  document.body.appendChild(modal);

  const $ = (sel) => modal.querySelector(sel);
  let mode = tab;
  const setMode = (m) => {
    mode = m;
    modal.querySelectorAll('[data-acc^="tab-"]').forEach((t) => t.classList.toggle('on', t.dataset.acc === `tab-${m}`));
    $('.acc-username').hidden = m !== 'signup';
    $('#acc-password').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    $('.acc-title').textContent = m === 'signup' ? 'Crie sua conta' : 'Entre na sua conta';
    $('.acc-sub').textContent = m === 'signup'
      ? 'Guarde partidas, recordes e progresso de todos os jogos, em qualquer aparelho.'
      : 'Seu progresso e seu histórico continuam de onde parou.';
    $('.acc-submit').textContent = m === 'signup' ? 'Criar conta' : 'Entrar';
    $('.acc-msg').textContent = '';
    $('.acc-msg').className = 'acc-msg';
  };
  setMode(mode);

  const close = () => { modal?.remove(); modal = null; };
  modal.addEventListener('click', (e) => {
    if (e.target === modal) return close();
    const b = e.target.closest('[data-acc]');
    if (!b) return;
    if (b.dataset.acc === 'close') close();
    if (b.dataset.acc === 'tab-login') setMode('login');
    if (b.dataset.acc === 'tab-signup') setMode('signup');
  });
  modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  $('.acc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('.acc-msg');
    const submit = $('.acc-submit');
    const email = $('#acc-email').value.trim();
    const password = $('#acc-password').value;
    const username = $('#acc-username').value.trim();
    if (!email || !password) {
      msg.textContent = 'Preencha e-mail e senha.';
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
        submit.textContent = mode === 'signup' ? 'Criar conta' : 'Entrar';
      }
    }
  });

  (mode === 'signup' ? $('#acc-username') : $('#acc-email')).focus();
}
