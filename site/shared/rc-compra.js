// Comprar Rift Coins (RC) com dinheiro: janela que abre ao clicar no indicador de moedas
// da barra do site. Brasil (pt-BR): Mercado Pago em reais. Outros idiomas: Stripe em
// dólar (inglês) ou euro (demais idiomas; o euro é o dólar convertido pelo servidor).
// Os preços valem os do servidor (Edge Function rc-comprar-criar); aqui é só a vitrine.
import * as platform from './platform.js';
import { localeAtual } from './i18n.js';

const PACOTES = [1000, 3000, 5000, 10000];
const BRL = { 1000: 10, 3000: 25, 5000: 40, 10000: 70 };
const USD = { 1000: 7, 3000: 17, 5000: 27, 10000: 47 };
const brasil = () => localeAtual() === 'pt-BR';
const moedaIntl = () => (localeAtual() === 'en' ? 'USD' : 'EUR');
const dinheiro = (n, moeda) => Number(n).toLocaleString(localeAtual(), { style: 'currency', currency: moeda, minimumFractionDigits: Number(n) % 1 ? 2 : 0 });
const rcTxt = (n) => Number(n).toLocaleString(localeAtual());

export function abrirCompraRc() {
  const pt = brasil();
  const moeda = pt ? 'BRL' : moedaIntl();
  const provedor = pt ? 'mercadopago' : 'stripe';
  const el = document.createElement('div');
  el.className = 'rc-backdrop';
  el.innerHTML = `<div class="rc-modal" role="dialog" aria-modal="true">
    <button type="button" class="rc-x" data-fechar aria-label="Fechar">×</button>
    <p class="eyebrow">Rift Coins</p>
    <h3 class="rc-tit">Comprar Rift Coins</h3>
    <div class="rc-lista" data-lista></div>
    <p class="rc-nota">${pt ? 'Você paga pelo Mercado Pago: Pix, cartão ou boleto.' : 'Você paga pelo Stripe: cartão, Apple Pay ou Google Pay.'}</p>
    <p class="rc-msg" data-msg role="alert"></p>
  </div>`;
  const lista = el.querySelector('[data-lista]');
  const desenhar = (precos) => {
    lista.innerHTML = PACOTES.map((rc) => {
      const v = precos?.[rc];
      return `<button type="button" class="rc-pacote" data-rc="${rc}"${v == null ? ' disabled' : ''}>
        <b data-no-i18n>${rcTxt(rc)}</b><span class="rc-un">RC</span>
        <em data-no-i18n>${v == null ? '…' : dinheiro(v, moeda)}</em></button>`;
    }).join('');
  };
  desenhar(pt ? BRL : moeda === 'USD' ? USD : null);
  if (!pt && moeda === 'EUR') platform.rcPrecos().then((t) => desenhar(t?.EUR)).catch(() => desenhar(null));
  const fechar = () => { el.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') fechar(); };
  el.addEventListener('click', async (e) => {
    if (e.target === el || e.target.closest('[data-fechar]')) return fechar();
    const b = e.target.closest('[data-rc]');
    if (!b || b.disabled) return;
    const msg = el.querySelector('[data-msg]');
    msg.textContent = '';
    lista.querySelectorAll('button').forEach((x) => { x.disabled = true; });
    try {
      const { url } = await platform.rcComprar(Number(b.dataset.rc), provedor, moeda);
      location.href = url;
    } catch (err) {
      msg.textContent = err.message;
      lista.querySelectorAll('button').forEach((x) => { x.disabled = false; });
    }
  });
  document.addEventListener('keydown', tecla);
  document.body.append(el);
  return el;
}

// Voltando do pagamento (/?rc=aprovado): avisa e confere o saldo algumas vezes, porque
// a confirmação chega pelo webhook alguns segundos depois.
export function avisoRetornoRc() {
  let status = null;
  try { status = new URLSearchParams(location.search).get('rc'); } catch { return; }
  if (!status) return;
  try {
    const url = new URL(location.href);
    url.searchParams.delete('rc');
    history.replaceState(null, '', url);
  } catch { /* sem history */ }
  const msg = status === 'aprovado' ? 'Pagamento recebido! Suas Rift Coins chegam em instantes.'
    : status === 'pendente' ? 'Pagamento pendente. As Rift Coins chegam assim que for confirmado.'
      : 'O pagamento não foi concluído.';
  const el = document.createElement('div');
  el.className = 'rc-aviso';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 9000);
  if (status === 'aprovado' || status === 'pendente') {
    let n = 0;
    const t = setInterval(() => { platform.refreshMoedas().catch(() => {}); if (++n >= 8) clearInterval(t); }, 4000);
  }
}
