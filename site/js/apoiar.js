// Página "Apoiar": doação opcional pelo Mercado Pago (Edge Function
// apoio-criar) e escolha do efeito de nick liberado pelo total apoiado.
import * as platform from '../shared/platform.js';
import { mountSiteBar, openAuthModal } from '../shared/account.js';
import { mountSiteFooter } from '../shared/footer.js';
import { APOIO_ATIVO } from '../shared/config.js';
import { EFEITOS, VALORES_SUGERIDOS, VALOR_MINIMO, VALOR_MAXIMO, efeitoLiberado, efeitoInfo, nickHtml } from '../shared/apoio.js';

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../' });
mountSiteFooter(document.getElementById('site-footer'));

const root = document.getElementById('apoiar');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const reais = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: Number(n) % 1 ? 2 : 0 });
const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const STATUS = { pendente: 'Aguardando pagamento', aprovado: 'Aprovado', recusado: 'Recusado', cancelado: 'Cancelado', estornado: 'Estornado' };

const params = new URLSearchParams(location.search);
const voltou = params.get('status'); // volta do Mercado Pago: aprovado / pendente / falhou
let valor = 10;
let apoios = [];
let enviando = false;

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
    aprovado: ['ok', 'Obrigado pelo apoio! 💛 O pagamento foi aprovado. Os efeitos liberados aparecem abaixo (pode levar alguns segundos).'],
    pendente: ['', 'Pagamento em andamento (Pix ou boleto). Assim que o Mercado Pago confirmar, os efeitos são liberados sozinhos.'],
    falhou: ['err', 'O pagamento não foi concluído. Nada foi cobrado. Se quiser, é só tentar de novo.'],
  }[voltou];
  return msg ? `<div class="ap-aviso ${msg[0]}">${msg[1]}</div>` : '';
}

function cartaoValor(u) {
  const chips = VALORES_SUGERIDOS.map((v) => `<button type="button" data-valor="${v}" class="${valor === v ? 'on' : ''}">${reais(v)}</button>`).join('');
  const outro = !VALORES_SUGERIDOS.includes(valor);
  let acao;
  if (!platform.cloudEnabled()) acao = '<p class="muted small">O apoio precisa de conexão com o servidor do site.</p>';
  else if (!u) acao = '<button type="button" class="btn-primary ap-pagar" data-act="entrar">Entrar para apoiar</button><p class="muted small">Os efeitos ficam guardados na sua conta, por isso é preciso entrar.</p>';
  else if (!APOIO_ATIVO) acao = '<button type="button" class="btn-primary ap-pagar" disabled>Em breve</button><p class="muted small">O pagamento pelo Mercado Pago está sendo configurado.</p>';
  else acao = `<button type="button" class="btn-primary ap-pagar" data-act="pagar" ${enviando ? 'disabled' : ''}>${enviando ? 'Abrindo o Mercado Pago…' : `Apoiar com ${reais(valor)}`}</button>
    <p class="muted small">Você vai para o Mercado Pago e paga com <b>Pix</b>, <b>cartão</b> ou <b>boleto</b>. O site não vê nem guarda os dados do pagamento.</p>`;
  return `<section class="pf-card ap-valor">
    <h2 class="display">Quanto quer apoiar?</h2>
    <div class="pf-chips ap-chips">${chips}<button type="button" data-valor="outro" class="${outro ? 'on' : ''}">Outro valor</button></div>
    ${outro ? `<label class="pf-label">Valor (de ${reais(VALOR_MINIMO)} a ${reais(VALOR_MAXIMO)}):
      <input type="number" inputmode="decimal" min="${VALOR_MINIMO}" max="${VALOR_MAXIMO}" step="1" value="${valor}" data-outro /></label>` : ''}
    ${acao}
  </section>`;
}

function seuApoio(u) {
  if (!u) return '';
  const total = u.apoioTotal || 0;
  const liberados = EFEITOS.filter((e) => efeitoLiberado(e.id, total)).length;
  const prox = EFEITOS.find((e) => !efeitoLiberado(e.id, total));
  return `<section class="pf-card ap-seu">
    <div><p class="eyebrow">Seu apoio</p>
      <p class="ap-total">${total ? reais(total) : 'Nenhum apoio ainda'}</p>
      <p class="muted small">${liberados} de ${EFEITOS.length} efeitos liberados${prox ? ` · próximo com ${reais(prox.minimo)} no total` : ' · todos liberados!'}</p></div>
    <div class="ap-preview"><span class="muted small">Seu nick hoje</span><b>${nickHtml(u.username, u.nickEfeito, total)}</b></div>
  </section>`;
}

function galeria(u) {
  const nome = u?.username || 'Invocador';
  const total = u?.apoioTotal || 0;
  const cards = EFEITOS.map((e) => {
    const livre = u && efeitoLiberado(e.id, total);
    const usando = u?.nickEfeito === e.id;
    return `<div class="ap-fx${livre ? ' livre' : ''}${usando ? ' usando' : ''}">
      <span class="ap-fx-nick">${nickHtml(nome, e.id)}</span>
      <span class="ap-fx-nome">${esc(e.nome)}</span>
      <span class="ap-fx-desc">${esc(e.desc)}</span>
      ${livre
    ? `<button type="button" class="ap-fx-btn" data-efeito="${e.id}" ${usando ? 'disabled' : ''}>${usando ? 'Em uso' : 'Usar'}</button>`
    : `<span class="ap-fx-lock">🔒 a partir de ${reais(e.minimo)}</span>`}
    </div>`;
  }).join('');
  return `<section class="pf-sec">
    <h2 class="section-title">Efeitos de nick</h2>
    <p class="muted small ap-nota">Aparecem no seu nome no perfil, no ranking e na barra do site. Os valores somam: quem apoia ${reais(5)} hoje e ${reais(5)} outro dia libera os de ${reais(10)}.</p>
    <div class="ap-grade">${cards}</div>
    ${u?.nickEfeito ? '<button type="button" class="pf-more" data-efeito="">Usar sem efeito</button>' : ''}
  </section>`;
}

function historico() {
  if (!apoios.length) return '';
  return `<section class="pf-sec">
    <h2 class="section-title">Seus apoios</h2>
    <ul class="pf-hist">${apoios.map((a) => `<li>
      <span class="h-when">${dataCurta(a.criado)}</span>
      <span class="h-what"><b>${esc(STATUS[a.status] || a.status)}</b><span>Apoio ao Rift Arcade</span></span>
      <span class="h-score">${reais(a.valor_pago ?? a.valor)}</span></li>`).join('')}</ul>
  </section>`;
}

function perguntas() {
  return `<section class="pf-sec">
    <h2 class="section-title">Perguntas</h2>
    <div class="pf-card ap-faq">
      <p><b>O apoio dá vantagem nos jogos?</b> Não. Só cosméticos (efeitos no nome). Ranking e jogos são iguais para todos.</p>
      <p><b>Para onde vai o dinheiro?</b> Para manter o site no ar: servidor, domínio e o tempo de criar jogos novos.</p>
      <p><b>É seguro?</b> O pagamento é feito no site do Mercado Pago. O Rift Arcade recebe só o aviso de que foi aprovado e o valor; nunca vê dados de cartão ou de conta.</p>
      <p><b>Quanto tempo para liberar?</b> Pix e cartão: na hora. Boleto: quando o banco compensar (até 3 dias úteis).</p>
      <p><b>Posso pedir o dinheiro de volta?</b> Sim, em até 7 dias, pelo e-mail <a data-contact href="mailto:riftarcadeoficial@gmail.com">riftarcadeoficial@gmail.com</a>. Com o estorno, os efeitos ligados àquele valor deixam de valer.</p>
    </div>
  </section>`;
}

function render() {
  const u = platform.getUser();
  root.innerHTML = `
    <header class="rk-head ap-head">
      <div><p class="eyebrow">◆ Apoie o Rift Arcade</p><h1 class="display">Apoiar</h1>
        <p class="lead">O Rift Arcade é gratuito e feito por fã. Se você curte, pode ajudar a manter o site no ar.
          Em troca, ganha <b>efeitos especiais no nick</b>, sem nenhuma vantagem nos jogos.</p></div>
    </header>
    ${aviso()}
    ${seuApoio(u)}
    ${cartaoValor(u)}
    ${galeria(u)}
    ${historico()}
    ${perguntas()}`;
}

async function carregar() {
  await platform.init();
  if (platform.getUser()) {
    await platform.refreshApoio();
    apoios = await platform.meusApoios();
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
      render();
      if (platform.getUser().apoioTotal > antes || apoios.some((a) => a.id === params.get('apoio') && a.status === 'aprovado')) break;
    }
  }
}

root.addEventListener('click', async (e) => {
  const v = e.target.closest('[data-valor]');
  if (v) {
    valor = v.dataset.valor === 'outro' ? (VALORES_SUGERIDOS.includes(valor) ? 15 : valor) : Number(v.dataset.valor);
    render();
    root.querySelector('[data-outro]')?.focus();
    return;
  }
  const f = e.target.closest('[data-efeito]');
  if (f) {
    try {
      await platform.setNickEfeito(f.dataset.efeito || null);
      render();
      toast(f.dataset.efeito ? `Efeito ${efeitoInfo(f.dataset.efeito).nome} ativado!` : 'Efeito removido');
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'entrar') openAuthModal('login');
  if (act === 'pagar' && !enviando) {
    if (!(valor >= VALOR_MINIMO && valor <= VALOR_MAXIMO)) return toast(`Escolha um valor entre ${reais(VALOR_MINIMO)} e ${reais(VALOR_MAXIMO)}.`);
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
});

platform.onChange((evt) => { if (evt.type === 'auth') render(); });

carregar();
