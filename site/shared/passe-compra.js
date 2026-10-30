// Compra do Passe Premium: a janela com o preço e o botão de pagar. Só com dinheiro:
// em português do Brasil, R$ 15 pelo Mercado Pago (Pix, cartão ou boleto); nos outros
// idiomas, US$ 10 pelo Stripe (cartão, Apple Pay, Google Pay). O servidor confere o
// preço de verdade (Edge Function passe-premium-criar); aqui é só a vitrine.
import * as platform from './platform.js';
import { localeAtual } from './i18n.js';

// Preço de cada passe (o servidor decide o valor de verdade: Edge Function passe-premium-criar).
export const PRECOS_PASSE = {
  'halloween-2026': { titulo: 'Halloween 2026', brl: 15, usd: 10 },
  'zaun-piltover-2026': { titulo: 'Zaun e Piltover', brl: 25, usd: 15 },
};
export const PRECO_BRL = 15;
export const PRECO_USD = 10;
const brasil = () => localeAtual() === 'pt-BR';
const dinheiro = (n, moeda) => Number(n).toLocaleString(localeAtual(), { style: 'currency', currency: moeda, minimumFractionDigits: 0 });

export function abrirCompraPremium(passe = 'halloween-2026') {
  const pt = brasil();
  const dados = PRECOS_PASSE[passe] || PRECOS_PASSE['halloween-2026'];
  const preco = pt ? dinheiro(dados.brl, 'BRL') : dinheiro(dados.usd, 'USD');
  const el = document.createElement('div');
  el.className = 'ps-backdrop';
  el.innerHTML = `<div class="ps-modal" role="dialog" aria-modal="true">
    <button type="button" class="ps-modal-x" data-fechar aria-label="Fechar">×</button>
    <p class="eyebrow">★ Passe Premium</p>
    <h3 class="ps-modal-tit">${dados.titulo}</h3>
    <p class="ps-modal-txt">Libera as recompensas do Passe Premium.</p>
    <p class="ps-modal-preco"><b>${preco}</b></p>
    <button type="button" class="ps-comprar" data-comprar>${pt ? `Pagar ${preco} pelo Mercado Pago` : `Pagar ${preco} com cartão`}</button>
    <p class="ps-modal-nota">${pt ? 'Você paga pelo Mercado Pago: Pix, cartão ou boleto.' : 'Você paga pelo Stripe: cartão, Apple Pay ou Google Pay.'}</p>
    <p class="ps-modal-msg" data-msg role="alert"></p>
  </div>`;
  const fechar = () => { el.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  el.addEventListener('click', async (e) => {
    if (e.target === el || e.target.closest('[data-fechar]')) return fechar();
    const b = e.target.closest('[data-comprar]');
    if (!b) return;
    b.disabled = true;
    const msg = el.querySelector('[data-msg]');
    msg.textContent = '';
    try {
      const { url } = await platform.passeComprar(pt ? 'mercadopago' : 'stripe', PRECOS_PASSE[passe] ? passe : 'halloween-2026');
      location.href = url;
    } catch (err) {
      msg.textContent = err.message;
      b.disabled = false;
    }
  });
  document.addEventListener('keydown', tecla);
  document.body.append(el);
  return el;
}

// Liga os botões "Premium" / "Obter Premium" do passe dentro de `raiz`.
export function ligarCompraPremium(raiz) {
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ps-premium]');
    if (b) abrirCompraPremium(b.dataset.psPremium || b.closest('[data-ps-id]')?.dataset.psId || 'halloween-2026');
  });
}
