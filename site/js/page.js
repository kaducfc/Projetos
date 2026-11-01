// Páginas institucionais (Quem somos, Privacidade, Termos): barra, rodapé
// e e-mail de contato vindos da configuração do site.
import { mountSiteBar } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { CONTACT_EMAIL, DONATION_URL } from '../shared/config.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: document.body.dataset.inicio || '../' }); // a página 404 aparece em qualquer pasta e usa '/'
mountSiteFooter(document.getElementById('site-footer'));

document.querySelectorAll('[data-contact]').forEach((el) => {
  el.textContent = CONTACT_EMAIL;
  el.href = `mailto:${CONTACT_EMAIL}`;
});
document.querySelectorAll('[data-donate]').forEach((el) => {
  if (DONATION_URL) el.href = DONATION_URL;
  else el.closest('[data-donate-block]')?.remove();
});
