// Página do Passe de Batalha: progresso (nível + barra) e as recompensas de cada
// nível. Só para quem está conectado; enquanto o passe está em teste, só administradores.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { passeHtml } from '../shared/passe.js';
import { nomeRecompensa } from '../shared/recompensas.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../' });
mountSiteFooter(document.getElementById('site-footer'));

const root = document.getElementById('passe');
let estado = null;
let erro = '';
let msg = '';

function render() {
  const u = platform.getUser();
  if (!platform.cloudEnabled()) {
    root.innerHTML = '<section class="pf-card pf-lock"><p>O passe de batalha precisa de conexão com o servidor do site, que não está disponível nesta versão.</p></section>';
    return;
  }
  if (!u) {
    root.innerHTML = `<section class="pf-card pf-lock">
      <h1 class="display">Passe de Batalha</h1>
      <p>Entre na sua conta para participar do passe de batalha.</p>
      <button type="button" class="btn-primary" data-act="entrar">Entrar ou criar conta</button>
    </section>`;
    return;
  }
  if (erro) {
    root.innerHTML = `<section class="pf-card pf-lock"><h1 class="display">Passe de Batalha</h1><p>${erro}</p></section>`;
    return;
  }
  if (!estado) {
    root.innerHTML = '<p class="muted">Carregando…</p>';
    return;
  }
  root.innerHTML = `<section class="pf-card passe-card">${passeHtml(estado)}<p class="ps-nota" data-msg role="status">${msg}</p></section>`;
}

async function carregar() {
  await platform.init();
  if (!platform.getUser()) { render(); return; }
  try {
    estado = await platform.passeEstado();
    erro = '';
  } catch (err) {
    estado = null;
    erro = err.message;
  }
  render();
}

root.addEventListener('click', async (e) => {
  if (e.target.closest('[data-act="entrar"]')) { openAuthModal('login'); return; }
  const b = e.target.closest('[data-ps-resgatar]');
  if (!b) return;
  b.disabled = true;
  try {
    const x = await platform.passeResgatar(Number(b.dataset.psResgatar));
    msg = x.tipo === 'moeda' ? `Nível ${x.nivel}: +${Number(x.chave).toLocaleString('pt-BR')} Rift Coins!` : `Nível ${x.nivel}: ${nomeRecompensa(x.tipo, x.chave)} resgatado!`;
    estado = await platform.passeEstado();
  } catch (err) {
    msg = err.message;
  }
  render();
});

platform.onChange((evt) => {
  if (evt.type === 'auth') carregar();
});

carregar();
