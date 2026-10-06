// Passe de Batalha: monta a tela (progresso, trilha de recompensas) a partir da
// resposta de platform.passeEstado(). Sem dados de visitante: quem não está
// conectado não vê o passe.
import { EFEITOS, EFEITOS_TESTE } from './efeitos.js';
import { nomeRecompensa } from './recompensas.js';
import { avatarHtml, molduraHtml } from './avatar.js';
import { srcMoldura } from './molduras.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const fmt = (n) => Number(n).toLocaleString('pt-BR');
export const ABOBORA_IMG = '/shared/assets/passe/abobora-64.webp';
const aboboraImg = (tam = 18) => `<img class="ps-abobora" src="${ABOBORA_IMG}" srcset="/shared/assets/passe/abobora-128.webp 2x" width="${tam}" height="${tam}" alt="" />`;

// Como cada recompensa aparece no cartão do nível.
function recompensaHtml(r) {
  if (r.tipo === 'moeda') {
    return `<span class="ps-rec ps-rec-moeda"><img src="/shared/assets/moeda/rc-48.webp" width="34" height="34" alt="" /><b>${fmt(r.chave)} RC</b></span>`;
  }
  if (r.tipo === 'efeito') {
    const fx = [...EFEITOS, ...EFEITOS_TESTE].find((e) => e.id === r.chave);
    return `<span class="ps-rec ps-rec-efeito"><span class="nick fx ${esc(fx?.classe || '')}">${esc(fx?.nome || nomeRecompensa('efeito', r.chave))}</span><small>Efeito no nome</small></span>`;
  }
  if (r.tipo === 'icone') {
    return `<span class="ps-rec ps-rec-icone">${avatarHtml(`icone:${r.chave}`, '', 52)}<b>${esc(nomeRecompensa(r.tipo, r.chave))}</b><small>Ícone</small></span>`;
  }
  if (r.tipo === 'moldura') {
    return `<span class="ps-rec ps-rec-icone">${molduraHtml(r.chave, 62)}<b>${esc(nomeRecompensa(r.tipo, r.chave))}</b><small>Moldura</small></span>`;
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
  const completo = e.nivel >= e.passe.niveis;
  const pct = completo ? 100 : Math.min(100, Math.round((e.progresso / por) * 100));
  return `<div class="ps">
    <div class="ps-topo">
      <div class="ps-titulo">
        <p class="eyebrow">${aboboraImg(16)} Passe de Batalha</p>
        <h3 class="ps-nome">${esc(e.passe.nome)}</h3>
        <p class="ps-sub">${e.premium ? '<span class="ps-tag ps-tag-premium">★ Passe premium</span>' : '<span class="ps-tag">Passe grátis</span> <button type="button" class="ps-obter" data-ps-premium>★ Obter Premium</button>'}${e.passe.publico ? '' : ' <span class="ps-tag ps-tag-teste">Em teste: só administradores</span>'}</p>
      </div>
      <div class="ps-numeros">
        <div><b>${e.nivel}<small>/${e.passe.niveis}</small></b><span>nível do passe</span></div>
      </div>
    </div>
    <div class="ps-progresso">
      <span class="ps-lv">${aboboraImg(15)} Nível ${e.nivel}</span>
      <div class="ps-barra-wrap">
        <div class="ps-barra" role="progressbar" aria-label="Progresso para o próximo nível" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <img class="ps-ponta" style="left:${pct}%" src="${ABOBORA_IMG}" srcset="/shared/assets/passe/abobora-128.webp 2x" width="30" height="30" alt="" />
        <span class="ps-contagem">${completo ? '✓' : `${fmt(e.progresso)}/${fmt(por)}`}</span>
      </div>
      <span class="ps-lv ps-lv-prox">${completo ? '✓ Completo' : `Nível ${e.nivel + 1}`}</span>
    </div>
    ${extra}
    <ol class="ps-trilha-niveis">${e.niveis.map((n) => cartaoNivel(n, e)).join('')}</ol>
    <p class="ps-nota">Termine partidas para ganhar abóboras e encher a barra: ao completá-la, você sobe de nível e libera a recompensa dele. Cada partida concluída, ranqueada ou não, rende abóboras (há um limite por dia, que zera à meia-noite, horário de Brasília).</p>
  </div>`;
}
