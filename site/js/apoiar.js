// Página "Apoiar": doação opcional pelo Mercado Pago (Edge Function
// apoio-criar). Quem apoia ganha automaticamente o efeito Reflexo no nick.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { APOIO_ATIVO, APOIO_INTL_ATIVO } from '../shared/config.js';
import { VALORES_SUGERIDOS, VALOR_MINIMO, VALOR_MAXIMO, VALOR_CONFIRMAR, nickHtml } from '../shared/apoio.js';
import { ESPECIAIS, avatarHtml } from '../shared/avatar.js';
import { localeAtual, onLangChange, IDIOMA_PADRAO } from '../shared/i18n.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../' });
mountSiteFooter(document.getElementById('site-footer'));

const root = document.getElementById('apoiar');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const reais = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: Number(n) % 1 ? 2 : 0 });
const dataCurta = (iso) => new Date(iso).toLocaleDateString(localeAtual(), { day: '2-digit', month: '2-digit', year: '2-digit' });
// Fora do português (idioma do site): apoio internacional (Stripe, USD ou EUR).
const intl = () => localeAtual() !== IDIOMA_PADRAO;
const VALORES_INTL = [5, 10, 25, 50];
const MINIMO_INTL = 3;
const dinheiro = (n, moeda) => Number(n).toLocaleString(localeAtual(), { style: 'currency', currency: moeda, minimumFractionDigits: Number(n) % 1 ? 2 : 0 });
const STATUS = { pendente: 'Aguardando pagamento', aprovado: 'Aprovado', recusado: 'Recusado', cancelado: 'Cancelado', estornado: 'Estornado' };

const params = new URLSearchParams(location.search);
const voltou = params.get('status'); // volta do Mercado Pago ou Stripe: aprovado / pendente / falhou
let valor = 10;
let moeda = localeAtual() === 'en' ? 'USD' : 'EUR'; // moeda do apoio internacional
let vindoDe = null; // provedor internacional que está abrindo o pagamento
let apoios = [];
let enviando = false;
let vagas = null; // vagas restantes entre os 100 primeiros apoiadores
let selos = null;
let admin = false; // APOIO_ATIVO = 'admin': só administradores pagam (teste)

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('pf-toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function aviso() {
  if (!voltou) return '';
  const msg = {
    aprovado: ['ok', 'Obrigado pelo apoio! 💛 O pagamento foi aprovado. O efeito no seu nick aparece em alguns segundos.'],
    pendente: ['', intl() ? 'Pagamento em andamento. Assim que for confirmado, o efeito no seu nick é liberado sozinho.' : 'Pagamento em andamento (Pix ou boleto). Assim que o Mercado Pago confirmar, o efeito no seu nick é liberado sozinho.'],
    falhou: ['err', 'O pagamento não foi concluído. Nada foi cobrado. Se quiser, é só tentar de novo.'],
  }[voltou];
  return msg ? `<div class="ap-aviso ${msg[0]}">${msg[1]}</div>` : '';
}

function cartaoIntl(u) {
  const chips = VALORES_INTL.map((v) => `<button type="button" data-valor="${v}" class="${valor === v ? 'on' : ''}">${dinheiro(v, moeda)}</button>`).join('');
  const outro = !VALORES_INTL.includes(valor);
  const moedas = ['USD', 'EUR'].map((m) => `<button type="button" data-moeda="${m}" class="${moeda === m ? 'on' : ''}">${m === 'USD' ? '$ USD' : '€ EUR'}</button>`).join('');
  let acao;
  if (!platform.cloudEnabled()) acao = '<p class="muted small">O apoio precisa de conexão com o servidor do site.</p>';
  else if (!u) acao = '<button type="button" class="btn-primary ap-pagar" data-act="entrar">Entrar para apoiar</button><p class="muted small">O efeito fica guardado na sua conta, por isso é preciso entrar.</p>';
  else if (!(APOIO_INTL_ATIVO === true || (APOIO_INTL_ATIVO === 'admin' && admin))) acao = '<button type="button" class="btn-primary ap-pagar" disabled>Em breve</button>';
  else {
    const rotulo = (txt) => (vindoDe ? 'Abrindo o pagamento…' : txt);
    acao = `<div class="ap-pagar-intl">
      <button type="button" class="btn-primary ap-pagar" data-act="pagar-stripe" ${vindoDe ? 'disabled' : ''}>${rotulo(`Pagar ${dinheiro(valor, moeda)} com cartão`)}</button>
    </div>
    <p class="muted small">Você será levado ao Stripe (cartão, Apple Pay, Google Pay) para pagar. O site não vê nem guarda os dados do pagamento.</p>
    ${APOIO_INTL_ATIVO === 'admin' ? '<p class="muted small"><b>Modo de teste:</b> só administradores veem estes botões. Para o público, aparece "Em breve".</p>' : ''}`;
  }
  return `<section class="pf-card ap-valor">
    <h2 class="display">Quanto quer apoiar?</h2>
    <div class="pf-chips ap-chips ap-moedas">${moedas}</div>
    <div class="pf-chips ap-chips">${chips}<button type="button" data-valor="outro" class="${outro ? 'on' : ''}">Outro valor</button></div>
    ${outro ? `<label class="pf-label">${dinheiro(MINIMO_INTL, moeda)} min.:
      <input type="number" inputmode="decimal" min="${MINIMO_INTL}" step="1" value="${valor}" data-outro /></label>` : ''}
    ${acao}
  </section>`;
}

function cartaoValor(u) {
  if (intl()) return cartaoIntl(u);
  const chips = VALORES_SUGERIDOS.map((v) => `<button type="button" data-valor="${v}" class="${valor === v ? 'on' : ''}">${reais(v)}</button>`).join('');
  const outro = !VALORES_SUGERIDOS.includes(valor);
  let acao;
  if (!platform.cloudEnabled()) acao = '<p class="muted small">O apoio precisa de conexão com o servidor do site.</p>';
  else if (!u) acao = '<button type="button" class="btn-primary ap-pagar" data-act="entrar">Entrar para apoiar</button><p class="muted small">O efeito fica guardado na sua conta, por isso é preciso entrar.</p>';
  else if (!(APOIO_ATIVO === true || (APOIO_ATIVO === 'admin' && admin))) acao = '<button type="button" class="btn-primary ap-pagar" disabled>Em breve</button><p class="muted small">O pagamento pelo Mercado Pago está sendo configurado.</p>';
  else acao = `<button type="button" class="btn-primary ap-pagar" data-act="pagar" ${enviando ? 'disabled' : ''}>${enviando ? 'Abrindo o Mercado Pago…' : `Apoiar com ${reais(valor)}`}</button>
    <p class="muted small">Você vai para o Mercado Pago e paga com <b>Pix</b>, <b>cartão</b> ou <b>boleto</b>. O site não vê nem guarda os dados do pagamento.</p>
    ${APOIO_ATIVO === 'admin' ? '<p class="muted small"><b>Modo de teste:</b> só administradores veem este botão. Para o público, ele aparece como "Em breve".</p>' : ''}`;
  return `<section class="pf-card ap-valor">
    <h2 class="display">Quanto quer apoiar?</h2>
    <div class="pf-chips ap-chips">${chips}<button type="button" data-valor="outro" class="${outro ? 'on' : ''}">Outro valor</button></div>
    ${outro ? `<label class="pf-label">Valor (mínimo ${reais(VALOR_MINIMO)}):
      <input type="number" inputmode="decimal" min="${VALOR_MINIMO}" step="1" value="${valor}" data-outro /></label>` : ''}
    ${acao}
  </section>`;
}

// Prévia do efeito Reflexo no próprio nick (e o total, para quem já apoiou).
function efeito(u) {
  const nome = u?.username || 'Invocador';
  const apoiou = u?.apoioTotal > 0;
  return `<section class="pf-card ap-efeito">
    <div class="ap-efeito-nick">${nickHtml(nome, true)}</div>
    <div class="ap-efeito-txt">
      <p class="eyebrow">Efeito de apoiador</p>
      <p>${apoiou
    ? `Obrigado! Você já apoiou com <b>${reais(u.apoioTotal)}</b> e seu nick brilha assim no perfil, no ranking e na barra do site.`
    : 'Apoiando com qualquer valor, seu nick fica assim, automaticamente, no perfil, no ranking e na barra do site. Não dá nenhuma vantagem nos jogos.'}</p>
    </div>
  </section>
  ${icones()}`;
}

// Ícones especiais de perfil (liberados pelo servidor, ver 0014_icones.sql).
function icones() {
  const item = (x) => {
    const livre = selos?.[x.selo];
    const extra = x.selo === 'pioneiro'
      ? (livre ? ` Você é o apoiador nº <b>${selos.posicao}/100</b>!` : vagas != null ? (vagas ? ` Restam <b>${vagas}</b> vagas.` : ' As 100 vagas já foram preenchidas.') : '')
      : '';
    return `<div class="ap-icone${livre ? ' livre' : ''}">${avatarHtml(`icone:${x.id}`, x.nome, 72)}
      <div><b>${esc(x.nome)}</b>${livre ? ' <span class="ap-ok">✓ liberado</span>' : ''}<p class="muted small">${esc(x.regra)}${extra}</p></div></div>`;
  };
  return `<section class="pf-card ap-icones">
    <p class="eyebrow">Ícones especiais de perfil</p>
    ${ESPECIAIS.map(item).join('')}
    ${selos?.apoiador ? '<p class="muted small">Escolha o ícone em <a href="/perfil/">Meu perfil</a> → Trocar ícone.</p>' : ''}
  </section>`;
}

function historico() {
  if (!apoios.length) return '';
  return `<section class="pf-sec">
    <h2 class="section-title">Seus apoios</h2>
    <ul class="pf-hist">${apoios.map((a) => `<li>
      <span class="h-when">${dataCurta(a.criado)}</span>
      <span class="h-what"><b>${esc(STATUS[a.status] || a.status)}</b><span>Apoio ao Rift Arcade</span></span>
      <span class="h-score">${a.moeda && a.moeda !== 'BRL' && a.valor_original != null ? dinheiro(a.valor_original, a.moeda) : reais(a.valor_pago ?? a.valor)}</span></li>`).join('')}</ul>
  </section>`;
}

function perguntas() {
  return `<section class="pf-sec">
    <h2 class="section-title">Perguntas</h2>
    <div class="pf-card ap-faq">
      <p><b>O apoio dá vantagem nos jogos?</b> Não. Só o efeito dourado no nome e os ícones especiais de perfil. Ranking e jogos são iguais para todos.</p>
      <p><b>Para onde vai o dinheiro?</b> Para manter o site no ar: servidor, domínio e o tempo de criar jogos novos.</p>
      ${intl() ? `<p><b>É seguro?</b> O pagamento é feito no site do Stripe. O Rift Arcade recebe só o aviso de que foi aprovado e o valor; nunca vê dados de cartão ou de conta.</p>
      <p><b>Quanto tempo para o efeito aparecer?</b> Cartão: na hora.</p>`
    : `<p><b>É seguro?</b> O pagamento é feito no site do Mercado Pago. O Rift Arcade recebe só o aviso de que foi aprovado e o valor; nunca vê dados de cartão ou de conta.</p>
      <p><b>Quanto tempo para o efeito aparecer?</b> Pix e cartão: na hora. Boleto: quando o banco compensar (até 3 dias úteis).</p>`}
      <p><b>Posso pedir o dinheiro de volta?</b> Sim, em até 7 dias, pelo e-mail <a data-contact href="mailto:riftarcadeoficial@gmail.com">riftarcadeoficial@gmail.com</a>. Se todo o apoio for estornado, o efeito sai do nick e os ícones especiais deixam de valer.</p>
    </div>
  </section>`;
}

function render() {
  const u = platform.getUser();
  root.innerHTML = `
    <header class="rk-head ap-head">
      <div><p class="eyebrow">◆ Apoie o Rift Arcade</p><h1 class="display">Apoiar</h1>
        <p class="lead">O Rift Arcade é gratuito e feito por fã. Se você curte, pode ajudar a manter o site no ar.
          Em troca, seu nick ganha um <b>efeito dourado especial</b> e você libera <b>ícones de perfil exclusivos</b>, sem nenhuma vantagem nos jogos.</p></div>
    </header>
    ${aviso()}
    ${efeito(u)}
    ${cartaoValor(u)}
    ${historico()}
    ${perguntas()}`;
}

async function carregar() {
  await platform.init();
  vagas = await platform.pioneirosVagas();
  if (platform.getUser()) {
    if (APOIO_ATIVO === 'admin' || APOIO_INTL_ATIVO === 'admin') admin = await platform.isAdmin();
    await platform.refreshApoio();
    [apoios, selos] = await Promise.all([platform.meusApoios(), platform.meusSelos()]);
  }
  render();
  // Voltou do Mercado Pago com pagamento aprovado: o aviso do Mercado Pago
  // pode chegar uns segundos depois; confere algumas vezes.
  if (voltou === 'aprovado' && platform.getUser()) {
    for (let i = 0; i < 6; i++) {
      await new Promise((ok) => { setTimeout(ok, 4000); });
      apoios = await platform.meusApoios();
      const antes = platform.getUser().apoioTotal;
      await platform.refreshApoio();
      selos = await platform.meusSelos();
      render();
      if (platform.getUser().apoioTotal > antes || apoios.some((a) => a.id === params.get('apoio') && a.status === 'aprovado')) break;
    }
  }
}

root.addEventListener('click', async (e) => {
  const m = e.target.closest('[data-moeda]');
  if (m) { moeda = m.dataset.moeda; render(); return; }
  const v = e.target.closest('[data-valor]');
  if (v) {
    const sugeridos = intl() ? VALORES_INTL : VALORES_SUGERIDOS;
    valor = v.dataset.valor === 'outro' ? (sugeridos.includes(valor) ? 15 : valor) : Number(v.dataset.valor);
    render();
    root.querySelector('[data-outro]')?.focus();
    return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'entrar') openAuthModal('login');
  if (act === 'pagar-stripe' && !vindoDe) {
    if (!(valor >= MINIMO_INTL)) return toast(`O valor mínimo é ${dinheiro(MINIMO_INTL, moeda)}.`);
    if (!(valor <= 10000)) return toast('Valor alto demais.');
    if (valor >= VALOR_CONFIRMAR && !confirm(`Confirma o apoio de ${dinheiro(valor, moeda)}?`)) return;
    vindoDe = true;
    render();
    try {
      const { url } = await platform.apoiarIntl(valor, moeda);
      location.href = url;
    } catch (err) {
      vindoDe = null;
      render();
      toast(err.message);
    }
    return;
  }
  if (act === 'pagar' && !enviando) {
    if (!(valor >= VALOR_MINIMO)) return toast(`O valor mínimo é ${reais(VALOR_MINIMO)}.`);
    if (!(valor <= VALOR_MAXIMO)) return toast('Valor alto demais.');
    if (valor >= VALOR_CONFIRMAR && !confirm(`Confirma o apoio de ${reais(valor)}?`)) return;
    enviando = true;
    render();
    try {
      const { url } = await platform.apoiar(valor);
      location.href = url;
    } catch (err) {
      enviando = false;
      render();
      toast(err.message);
    }
  }
});

root.addEventListener('input', (e) => {
  if (!e.target.matches('[data-outro]')) return;
  const n = Math.round(Number(e.target.value) * 100) / 100;
  valor = Number.isFinite(n) ? n : 0;
  const b = root.querySelector('[data-act="pagar"]');
  if (b) b.textContent = `Apoiar com ${reais(valor || 0)}`;
  const bs = root.querySelector('[data-act="pagar-stripe"]');
  if (bs) bs.textContent = `Pagar ${dinheiro(valor || 0, moeda)} com cartão`;
});

onLangChange(() => {
  valor = 10;
  moeda = localeAtual() === 'en' ? 'USD' : 'EUR';
  render();
});

platform.onChange(async (evt) => {
  if (evt.type !== 'auth') return;
  if (APOIO_ATIVO === 'admin' || APOIO_INTL_ATIVO === 'admin') admin = evt.user ? await platform.isAdmin() : false;
  selos = evt.user ? await platform.meusSelos() : null;
  render();
});

carregar();
