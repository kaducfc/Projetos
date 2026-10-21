// Tela de entrada do Simulador de Técnico (visitante sem conta): apresentação do jogo + login / cadastro / recuperação de senha.
import * as platform from '../../../shared/platform.js';
import { t } from '../../../shared/i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GOOGLE = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

const MODOS = {
  login: { titulo: 'Entre na sua conta', sub: 'Seu progresso e seu histórico continuam de onde parou.', enviar: 'Entrar' },
  signup: { titulo: 'Crie sua conta', sub: 'Guarde partidas, recordes e progresso de todos os jogos, em qualquer aparelho.', enviar: 'Criar conta' },
  forgot: { titulo: 'Esqueceu a senha?', sub: 'Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.', enviar: 'Enviar link' },
};

const DESTAQUES = [
  ['ic-elenco', 'Elenco e treino', 'Contrate, escale e evolua os seus jogadores.'],
  ['ic-amistoso', 'Picks e bans', 'Partidas com draft e simulação ao vivo no mapa.'],
  ['ic-campeonatos', 'Ligas e campeonatos', 'Suba de divisão e dispute a Copa e o Mundial.'],
  ['ic-recrutar', 'Baús e Legados', 'Recrute ídolos reais do cenário competitivo.'],
];

export function telaLogin(app) {
  let modo = 'login';
  app.classList.add('tc-sem-fundo');
  app.innerHTML = `<section class="tcl">
    <div class="tcl-fundo" aria-hidden="true"></div>
    <div class="tcl-grade">
      <div class="tcl-marca">
        <p class="tc-eyebrow">◆ Rift Manager</p>
        <h1>Comande a sua organização</h1>
        <p class="tcl-lead">Monte o elenco, treine os jogadores, vença ligas e dispute campeonatos contra técnicos de todo o mundo.</p>
        <ul class="tcl-dest">${DESTAQUES.map(([ic, tit, txt]) => `<li><img src="img/${ic}.webp" alt="" width="40" height="40" /><div><b>${esc(t(tit))}</b><span>${esc(t(txt))}</span></div></li>`).join('')}</ul>
      </div>
      <div class="tcl-card" role="region" aria-labelledby="tcl-tit">
        <div class="tcl-abas" role="tablist">
          <button type="button" role="tab" data-modo="login">${esc(t('Entrar'))}</button>
          <button type="button" role="tab" data-modo="signup">${esc(t('Criar conta'))}</button>
        </div>
        <h2 id="tcl-tit"></h2>
        <p class="tcl-sub"></p>
        <div class="tcl-social">
          <button type="button" class="tcl-google" data-google>${GOOGLE}<span>${esc(t('Continuar com Google'))}</span></button>
          <div class="tcl-ou"><span>${esc(t('ou com e-mail'))}</span></div>
        </div>
        <form class="tcl-form" novalidate>
          <label class="tcl-campo" data-campo="username"><span>${esc(t('Nome de usuário'))}</span><input name="username" autocomplete="username" maxlength="20" placeholder="${esc(t('ex.: kadu'))}" /></label>
          <label class="tcl-campo" data-campo="email"><span>${esc(t('E-mail'))}</span><input name="email" type="email" autocomplete="email" inputmode="email" /></label>
          <label class="tcl-campo" data-campo="password"><span>${esc(t('Senha'))}</span><input name="password" type="password" minlength="6" /></label>
          <button type="button" class="tcl-link" data-modo="forgot">${esc(t('Esqueci minha senha'))}</button>
          <p class="tcl-msg" role="status"></p>
          <button type="submit" class="tcl-enviar"></button>
          <button type="button" class="tcl-link tcl-voltar" data-modo="login">${esc(t('← Voltar para o login'))}</button>
        </form>
        <p class="tcl-nota">${esc(t('A mesma conta vale para todos os jogos do Rift Arcade.'))}</p>
      </div>
    </div>
  </section>`;

  const $ = (s) => app.querySelector(s);
  const msg = $('.tcl-msg');
  const dizer = (txt, tipo = '') => { msg.textContent = txt; msg.className = `tcl-msg ${tipo}`; };
  const aplicar = (m) => {
    modo = m; const d = MODOS[m];
    app.querySelectorAll('.tcl-abas [data-modo]').forEach((b) => { b.classList.toggle('on', b.dataset.modo === m); b.setAttribute('aria-selected', String(b.dataset.modo === m)); });
    $('.tcl-abas').hidden = m === 'forgot'; $('.tcl-social').hidden = m === 'forgot' || !platform.cloudEnabled();
    $('[data-campo="username"]').hidden = m !== 'signup'; $('[data-campo="password"]').hidden = m === 'forgot';
    $('.tcl-form > .tcl-link[data-modo="forgot"]').hidden = m !== 'login'; $('.tcl-voltar').hidden = m !== 'forgot';
    $('#tcl-tit').textContent = t(d.titulo); $('.tcl-sub').textContent = t(d.sub); $('.tcl-enviar').textContent = t(d.enviar);
    $('input[name="password"]').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    dizer('');
  };
  aplicar('login');

  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]'); if (b) { aplicar(b.dataset.modo); return; }
    const g = e.target.closest('[data-google]');
    if (g) { g.disabled = true; platform.signInWithGoogle().catch((err) => { g.disabled = false; dizer(err.message, 'err'); }); }
  });
  $('.tcl-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget; const email = f.email.value.trim(); const password = f.password.value; const username = f.username.value.trim();
    if (modo === 'forgot' ? !email : !email || !password) { dizer(t(modo === 'forgot' ? 'Digite o seu e-mail.' : 'Preencha e-mail e senha.'), 'err'); return; }
    const botao = $('.tcl-enviar'); botao.disabled = true; botao.textContent = t('Aguarde…'); dizer('');
    try {
      if (modo === 'signup') {
        const r = await platform.signUp({ email, password, username });
        if (r.needsConfirmation) { aplicar('login'); dizer(t('Conta criada! Enviamos um link de confirmação para {x}. Depois de confirmar, é só entrar.', { x: email }), 'ok'); }
        else { location.reload(); return; }
      } else if (modo === 'forgot') {
        await platform.requestPasswordReset(email);
        dizer(t('Pronto! Se existir uma conta com {x}, enviamos um link para criar uma senha nova. Confira também o spam.', { x: email }), 'ok');
      } else { await platform.signIn({ email, password }); location.reload(); return; }
    } catch (err) { dizer(err.message, 'err'); } finally { botao.disabled = false; botao.textContent = t(MODOS[modo].enviar); }
  });
}
