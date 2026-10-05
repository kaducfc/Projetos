// Passe de Batalha: monta a tela (progresso, trilha de recompensas) a partir da
// resposta de platform.passeEstado(). Sem dados de visitante: quem não está
// conectado não vê o passe.
import { EFEITOS, EFEITOS_TESTE } from './efeitos.js';
import { nomeRecompensa } from './recompensas.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const fmt = (n) => Number(n).toLocaleString('pt-BR');
export const ABOBORA_IMG = '/shared/assets/passe/abobora.svg';
const aboboraImg = (tam = 18) => `<img class="ps-abobora" src="${ABOBORA_IMG}" width="${tam}" height="${tam}" alt="" />`;

// Como cada recompensa aparece no cartão do nível.
function recompensaHtml(r) {
  if (r.tipo === 'moeda') {
    return `<span class="ps-rec ps-rec-moeda"><img src="/shared/assets/moeda/rc-48.webp" width="34" height="34" alt="" /><b>${fmt(r.chave)} RC</b></span>`;
  }
  if (r.tipo === 'efeito') {
    const fx = [...EFEITOS, ...EFEITOS_TESTE].find((e) => e.id === r.chave);
    return `<span class="ps-rec ps-rec-efeito"><span class="nick fx ${esc(fx?.classe || '')}">${esc(fx?.nome || nomeRecompensa('efeito', r.chave))}</span><small>Efeito no nome</small></span>`;
  }
  return `<span class="ps-rec"><b>${esc(nomeRecompensa(r.tipo, r.chave))}</b><small>${r.tipo === 'icone' ? 'Ícone' : 'Recompensa'}</small></span>`;
}

function cartaoNivel(n, e) {
  const premium = n.trilha === 'premium';
  const atingido = e.abobora >= n.exige;
  let estado;
  let acao;
  if (n.resgatado) { estado = 'feito'; acao = '<span class="ps-ok">✓ Resgatado</span>'; }
  else if (atingido && premium && !e.premium) { estado = 'sem-premium'; acao = '<span class="ps-trava">🔒 Só premium</span>'; }
  else if (atingido) { estado = 'pronto'; acao = `<button type="button" class="ps-resgatar" data-ps-resgatar="${n.nivel}">Resgatar</button>`; }
  else { estado = 'bloqueado'; acao = `<span class="ps-falta">${aboboraImg(13)} ${fmt(n.exige - e.abobora)}</span>`; }
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
  const dentro = completo ? por : e.abobora - e.nivel * por;
  const pct = Math.min(100, Math.round((dentro / por) * 100));
  return `<div class="ps">
    <div class="ps-topo">
      <div class="ps-titulo">
        <p class="eyebrow">${aboboraImg(16)} Passe de Batalha</p>
        <h3 class="ps-nome">${esc(e.passe.nome)}</h3>
        <p class="ps-sub">${e.premium ? '<span class="ps-tag ps-tag-premium">★ Passe premium</span>' : '<span class="ps-tag">Passe grátis</span>'}${e.passe.publico ? '' : ' <span class="ps-tag ps-tag-teste">Em teste: só administradores</span>'}</p>
      </div>
      <div class="ps-numeros">
        <div><b>${fmt(e.abobora)}</b><span>${aboboraImg(13)} abóboras</span></div>
        <div><b>${e.nivel}<small>/${e.passe.niveis}</small></b><span>nível</span></div>
        <div><b>${fmt(e.hoje)}<small>/${fmt(e.passe.limite_dia)}</small></b><span>hoje</span></div>
      </div>
    </div>
    <div class="ps-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${por}" aria-valuenow="${dentro}"><i style="width:${pct}%"></i></div>
    <p class="ps-legenda">${completo ? 'Passe completo! Resgate as recompensas que faltam.' : `${fmt(dentro)} de ${fmt(por)} abóboras para o nível ${e.nivel + 1}`}</p>
    ${extra}
    <ol class="ps-trilha-niveis">${e.niveis.map((n) => cartaoNivel(n, e)).join('')}</ol>
    <p class="ps-nota">Cada partida concluída (ranqueada ou não, ganhando ou perdendo) dá <b>${e.passe.abobora_por_partida}</b> abóboras, até <b>${fmt(e.passe.limite_dia)}</b> por dia. O limite zera à meia-noite (horário de Brasília). Cada nível pede ${fmt(por)} abóboras.</p>
  </div>`;
}
