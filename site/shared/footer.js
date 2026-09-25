// Rodapé do site (hub e jogos): aviso de projeto de fã e doações.
import { DONATION_URL, SITE_NAME } from './config.js';

// Frases curtas para reaproveitar em outros pontos (criação, login, relatório).
export const FAN_NOTICE = 'Projeto de fã, gratuito e sem fins lucrativos. Sem vínculo com a Riot Games, ligas ou times.';
export const DONATION_NOTICE = 'Doações são opcionais e servem só para manter o site no ar. Não dão vantagem nos jogos.';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export function mountSiteFooter(el) {
  el.classList.add('site-footer');
  const donate = DONATION_URL
    ? `<a class="sf-donate" href="${esc(DONATION_URL)}" target="_blank" rel="noopener">♥ Apoiar o projeto</a>`
    : '';
  el.innerHTML = `
    <div class="sf-inner">
      <div class="sf-main">
        <p class="sf-title">${esc(SITE_NAME)} · feito por fã, para fãs</p>
        <p>O ${esc(SITE_NAME)} é um projeto de fã, <b>gratuito e sem fins lucrativos</b>. Não tem vínculo nem aprovação
          da Riot Games, das ligas (CBLOL, LCK, LPL, LEC, LCS) ou dos times citados. League of Legends é marca da
          Riot Games, Inc.; nomes e logos de times e ligas pertencem aos seus donos.</p>
        <p>Os jogos são e continuarão grátis. As <b>doações são opcionais</b> e servem só para pagar a manutenção
          (servidor e domínio) e manter o site no ar. Doar não dá nenhuma vantagem nos jogos.</p>
      </div>
      ${donate}
    </div>`;
}
