// Passe de Batalha: monta a tela (progresso, trilha de recompensas) a partir da
// resposta de platform.passeEstado(). Sem dados de visitante: quem não está
// conectado não vê o passe.
import { EFEITOS, EFEITOS_TESTE, nickFxHtml } from './efeitos.js';
import { nomeRecompensa } from './recompensas.js';
import { avatarHtml, molduraHtml } from './avatar.js';
import { srcMoldura } from './molduras.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const fmt = (n) => Number(n).toLocaleString('pt-BR');
export const ABOBORA_IMG = '/shared/assets/passe/abobora-64.webp';
// Cada temporada tem a sua "moeda" de progresso (o servidor ainda chama de abobora_*) e o seu visual.
export const PASSES_UI = {
  'halloween-2026': { unidade: ['abóbora', 'abóboras'], img: ABOBORA_IMG, img2: '/shared/assets/passe/abobora-128.webp', tema: '' },
  'zaun-piltover-2026': { unidade: ['engrenagem', 'engrenagens'], img: '/shared/assets/passe/engrenagem-64.webp', img2: '/shared/assets/passe/engrenagem-128.webp', tema: 'ps-zaun',
    // Faixa grande da página inicial: duas cenas de fundo (Piltover à esquerda, Zaun à direita) e o título em duas cores.
    fundos: ['/shared/assets/icones/exc-pl-cidade.webp', '/shared/assets/icones/exc-zn-refinaria.webp'],
    titulo: '<b class="hp-t-z">Zaun</b> <i>e</i> <b class="hp-t-p">Piltover</b>' },
};
export const uiPasse = (id) => PASSES_UI[id] || PASSES_UI['halloween-2026'];
const aboboraImg = (tam = 18, ui = uiPasse()) => `<img class="ps-abobora" src="${ui.img}" srcset="${ui.img2} 2x" width="${tam}" height="${tam}" alt="" />`;

// Fim de cada passe (meia-noite de Brasília, UTC−3, ao fim do último dia). O servidor
// também confere (site_passes.fim, 0058_passe_fim.sql).
const FIM_PASSE = { 'halloween-2026': '2026-11-01T03:00:00Z' };

export function fimTexto(p) {
  // O fim vem do servidor (data do último dia, inclusive); sem ele, vale a tabela acima.
  const id = p.id;
  const fim = p.fim ? Date.parse(`${String(p.fim).slice(0, 10)}T23:59:59.999-03:00`) : (FIM_PASSE[id] ? Date.parse(FIM_PASSE[id]) : NaN);
  if (Number.isNaN(fim)) return '';
  const ms = fim - Date.now();
  if (ms <= 0) return '<span class="ps-tag ps-tag-fim">Passe encerrado</span>';
  const dias = Math.ceil(ms / 86400000);
  if (ms < 86400000) return '<span class="ps-tag ps-tag-fim">Termina hoje à meia-noite</span>';
  return `<span class="ps-tag ps-tag-fim">Termina em ${dias} ${dias === 1 ? 'dia' : 'dias'}</span>`;
}

// Como cada recompensa aparece no cartão do nível.
function recompensaHtml(r) {
  if (r.tipo === 'moeda') {
    return `<span class="ps-rec ps-rec-moeda"><img src="/shared/assets/moeda/rc-48.webp" width="48" height="48" alt="" /><b>${fmt(r.chave)} RC</b></span>`;
  }
  if (r.tipo === 'efeito') {
    const fx = [...EFEITOS, ...EFEITOS_TESTE].find((e) => e.id === r.chave);
    return `<span class="ps-rec ps-rec-efeito">${nickFxHtml(fx || { classe: '' }, fx?.nome || nomeRecompensa('efeito', r.chave))}<small>Efeito no nome</small></span>`;
  }
  if (r.tipo === 'icone') {
    return `<span class="ps-rec ps-rec-icone">${avatarHtml(`icone:${r.chave}`, '', 84)}<b>${esc(nomeRecompensa(r.tipo, r.chave))}</b><small>Ícone</small></span>`;
  }
  if (r.tipo === 'moldura') {
    return `<span class="ps-rec ps-rec-icone">${molduraHtml(r.chave, 100)}<b>${esc(nomeRecompensa(r.tipo, r.chave))}</b><small>Moldura</small></span>`;
  }
  return `<span class="ps-rec"><b>${esc(nomeRecompensa(r.tipo, r.chave))}</b><small>${r.tipo === 'icone' ? 'Ícone' : 'Recompensa'}</small></span>`;
}

function cartaoNivel(n, e) {
  const premium = n.trilha === 'premium';
  const atingido = e.nivel >= n.nivel; // as recompensas abrem pelo NÍVEL do passe
  let estado;
  let acao;
  if (n.resgatado) { estado = 'feito'; acao = '<span class="ps-ok">✓ Resgatado</span>'; }
  else if (atingido && premium && !e.premium) { estado = 'sem-premium'; acao = '<button type="button" class="ps-premium-btn" data-ps-premium>★ Premium</button>'; }
  else if (atingido) { estado = 'pronto'; acao = `<button type="button" class="ps-resgatar" data-ps-resgatar="${n.nivel}">Resgatar</button>`; }
  else { estado = 'bloqueado'; acao = `<span class="ps-falta">Nível ${n.nivel}</span>`; }
  return `<li class="ps-nivel ps-${premium ? 'premium' : 'gratis'} ps-${estado}">
    <span class="ps-num">${n.nivel}</span>
    <span class="ps-trilha">${premium ? '★ Premium' : 'Grátis'}</span>
    ${recompensaHtml(n)}
    ${acao}
  </li>`;
}

// `extra`: HTML opcional (ex.: os controles de teste do painel) logo abaixo do cabeçalho.
export function passeHtml(e, { extra = '' } = {}) {
  if (!e) return '<p class="ps-aviso">Entre na sua conta para participar do passe de batalha.</p>';
  const por = e.passe.abobora_por_nivel;
  const ui = uiPasse(e.passe.id);
  const [un1, unN] = ui.unidade;
  const completo = e.nivel >= e.passe.niveis;
  const pct = completo ? 100 : Math.min(100, Math.round((e.progresso / por) * 100));
  return `<div class="ps ${ui.tema}" data-ps-id="${esc(e.passe.id)}">
    <div class="ps-topo">
      <div class="ps-titulo">
        <p class="eyebrow">${aboboraImg(16, ui)} Passe de Batalha</p>
        <h3 class="ps-nome">${esc(e.passe.nome)}</h3>
        <p class="ps-sub">${e.premium ? '<span class="ps-tag ps-tag-premium">★ Passe premium</span>' : `<span class="ps-tag">Passe grátis</span> <button type="button" class="ps-obter" data-ps-premium="${esc(e.passe.id)}">★ Obter Premium</button>`}${e.passe.publico ? '' : ' <span class="ps-tag ps-tag-teste">Em teste: só administradores</span>'} ${fimTexto(e.passe)}</p>
      </div>
      <div class="ps-numeros">
        <div><b>${e.nivel}<small>/${e.passe.niveis}</small></b><span>nível do passe</span></div>
        <div class="ps-dia"><b>${fmt(e.hoje)}<small>/${fmt(e.passe.limite_dia)}</small></b><span>${unN} hoje (limite diário)</span></div>
      </div>
    </div>
    <div class="ps-progresso">
      <span class="ps-lv">${aboboraImg(15, ui)} Nível ${e.nivel}</span>
      <div class="ps-barra-wrap">
        <div class="ps-barra" role="progressbar" aria-label="Progresso para o próximo nível" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <img class="ps-ponta" style="left:${pct}%" src="${ui.img}" srcset="${ui.img2} 2x" width="30" height="30" alt="" />
        <span class="ps-contagem">${completo ? '✓' : `${fmt(e.progresso)}/${fmt(por)}`}</span>
      </div>
      <span class="ps-lv ps-lv-prox">${completo ? '✓ Completo' : `Nível ${e.nivel + 1}`}</span>
    </div>
    ${extra}
    <ol class="ps-trilha-niveis">${e.niveis.map((n) => cartaoNivel(n, e)).join('')}</ol>
    <div class="ps-regras">
      <h4>Como ganhar ${unN}</h4>
      <ul>
        <li>Você ganha ${unN} jogando: cada partida concluída, em qualquer jogo, rende ${unN}.</li>
        <li>No Na Medida, o Diário e a Ranqueada rendem ${unN} pelo dia completo (as 5 rodadas); no modo Livre, a cada 5 rodadas.</li>
        <li>Dá para ganhar até ${e.passe.limite_dia} ${unN} por dia. O limite zera à meia-noite (horário de Brasília).</li>
        <li>A cada ${por} ${unN} você sobe um nível e libera a recompensa dele.</li>
      </ul>
    </div>
  </div>`;
}

// Próximas recompensas, em miniatura (faixa da página inicial): primeiro as que já dá para resgatar, depois as seguintes.
export function proximasRecompensas(e, max = 4) {
  const pronta = (n) => n.nivel <= e.nivel && (n.trilha === 'gratis' || e.premium);
  const lista = e.niveis.filter((n) => !n.resgatado).sort((a, b) => (pronta(b) - pronta(a)) || a.nivel - b.nivel).slice(0, max);
  const visual = (r) => {
    if (r.tipo === 'moeda') return `<span class="hp-rec-v"><img src="/shared/assets/moeda/rc-48.webp" width="34" height="34" alt="" /></span><b>${fmt(r.chave)} RC</b>`;
    if (r.tipo === 'efeito') { const fx = [...EFEITOS, ...EFEITOS_TESTE].find((x) => x.id === r.chave); const nome = fx?.nome || nomeRecompensa('efeito', r.chave); return `<span class="hp-rec-v hp-rec-fx">${nickFxHtml(fx || { classe: '' }, nome)}</span><b>Efeito</b>`; }
    if (r.tipo === 'icone') return `<span class="hp-rec-v">${avatarHtml(`icone:${r.chave}`, '', 46)}</span><b>${esc(nomeRecompensa(r.tipo, r.chave))}</b>`;
    if (r.tipo === 'moldura') return `<span class="hp-rec-v">${molduraHtml(r.chave, 56)}</span><b>${esc(nomeRecompensa(r.tipo, r.chave))}</b>`;
    return `<b>${esc(nomeRecompensa(r.tipo, r.chave))}</b>`;
  };
  return lista.map((n) => `<span class="hp-rec ${pronta(n) ? 'hp-rec-pronta' : ''} ${n.trilha === 'premium' ? 'hp-rec-prem' : ''}" title="Nível ${n.nivel} · ${n.trilha === 'premium' ? 'Premium' : 'Grátis'}">${visual(n)}<small>${pronta(n) ? 'Resgatar!' : `Nível ${n.nivel}${n.trilha === 'premium' ? ' ★' : ''}`}</small></span>`).join('');
}

// Faixa grande do Passe de Batalha na página inicial (js/hub.js): título da temporada, progresso e as próximas recompensas.
export function faixaHubHtml(e) {
  const completo = e.nivel >= e.passe.niveis;
  const pct = completo ? 100 : Math.min(100, Math.round((e.progresso / e.passe.abobora_por_nivel) * 100));
  const ui = uiPasse(e.passe.id);
  const fundos = (ui.fundos || []).map((f, i) => `<span class="hp-fundo hp-fundo-${i ? 'd' : 'e'}" style="background-image:url('${f}')"></span>`).join('');
  return `<a class="hp-link hp-grande ${ui.tema ? `hp-${ui.tema.replace('ps-', '')}` : ''}" href="passe/">
      ${fundos}
      <span class="hp-conteudo">
        <span class="hp-topo"><span class="hp-nome"><img src="${ui.img}" width="18" height="18" alt="" /> Passe de Batalha</span>${fimTexto(e.passe) || ''}${e.premium ? '<span class="ps-tag ps-tag-premium">★ Premium</span>' : '<span class="ps-tag">Grátis</span>'}</span>
        <span class="hp-titulo display">${ui.titulo || esc(e.passe.nome)}</span>
        <span class="hp-prog">
          <span class="hp-nivel">Nível ${e.nivel}</span>
          <span class="hp-barra-wrap"><span class="hp-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></span><img class="hp-ponta" style="left:${pct}%" src="${ui.img}" srcset="${ui.img2} 2x" width="26" height="26" alt="" /></span>
          <span class="hp-prox">${completo ? '✓ Completo' : `${fmt(e.progresso)}/${fmt(e.passe.abobora_por_nivel)} ${ui.unidade[1]}`}</span>
        </span>
      </span>
      <span class="hp-lado">
        <span class="hp-recs">${proximasRecompensas(e)}</span>
        <span class="hp-ir">Ir para o passe →</span>
      </span>
    </a>`;
}
