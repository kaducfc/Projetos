// Rodapé do site (hub, jogos e páginas institucionais): aviso curto de
// projeto de fã e links para Quem somos, Privacidade e Termos.
import { DONATION_URL, SITE_NAME } from './config.js';

// Links a partir da raiz do domínio: o mesmo rodapé serve em qualquer pasta.
// Na versão em arquivo único (fora do site) não há para onde apontar.
const LINKS = [
  ['/sobre/', 'Quem somos'],
  ['/privacidade/', 'Privacidade'],
  ['/termos/', 'Termos de uso'],
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export function mountSiteFooter(el) {
  el.classList.add('site-footer');
  const donate = DONATION_URL
    ? `<a class="sf-donate" href="${esc(DONATION_URL)}">♥ Apoiar o projeto</a>`
    : '';
  const links = globalThis.__SITE_OFFLINE
    ? ''
    : `<nav class="sf-links" aria-label="Sobre o site">${LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</nav>`;
  const mascot = globalThis.__SITE_OFFLINE
    ? ''
    : `<img class="sf-mascot" src="/shared/assets/marca/mascote-120.png?v=2" alt="" width="28" height="28" />`;
  el.innerHTML = `
    <div class="sf-inner">
      <div class="sf-main">
        <p class="sf-title">${mascot}${esc(SITE_NAME)} · feito por fã, para fãs</p>
        <p>Projeto de fã, <b>gratuito e sem fins lucrativos</b>. Sem vínculo nem aprovação da Riot Games,
          das ligas ou dos times citados. League of Legends é marca da Riot Games, Inc.; nomes e logos
          de times e ligas pertencem aos seus donos.</p>
        ${links}
      </div>
      ${donate}
    </div>`;
}
