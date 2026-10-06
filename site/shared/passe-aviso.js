// Aviso "+N abóboras" do passe de batalha. Aparece no FIM da partida (junto do aviso
// de PDR, que é quando o jogo vê o resultado) e fica parado até o jogador fechar no ×.
// A barra do site (shared/account.js) escuta o evento 'passe' e guarda o ganho; cada
// jogo chama liberarAbobora() quando mostra o resultado (shared/aviso-ranked.js faz isso
// nos avisos de fim de partida).
import * as platform from './platform.js';
import { ABOBORA_IMG } from './passe.js';

const reduzido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let atual = null;
let pendente = null; // ganho já calculado, esperando o fim da partida
let reserva = null;

// Duas partidas antes de liberar (ex.: duas rodadas seguidas): soma os ganhos.
function juntar(a, b) {
  return { ...b, ganhou: a.ganhou + b.ganhou, nivelAntes: a.nivelAntes, progressoAntes: a.progressoAntes ?? (a.progresso - a.ganhou) };
}

export function mostrarAbobora({ ganhou, nivelAntes, nivel, progresso, por, niveis, hoje, limite }) {
  atual?.remove();
  const subiu = nivel > nivelAntes;
  const completo = nivel >= niveis;
  const pctFim = completo ? 100 : Math.min(100, Math.round((progresso / por) * 100));
  // A barra começa de onde estava e enche até onde chegou; se subiu de nível, recomeça do zero.
  const pctIni = subiu ? 0 : Math.max(0, Math.round(((progresso - ganhou) / por) * 100));
  const el = document.createElement('div');
  el.className = `ps-aviso-abobora${subiu ? ' pa-sobe-nivel' : ''}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<button type="button" class="pa-x" aria-label="Fechar">×</button>
    <img class="pa-img" src="${ABOBORA_IMG}" srcset="/shared/assets/passe/abobora-128.webp 2x" width="56" height="56" alt="" />
    <div class="pa-txt">
      <b class="pa-qtd">+${ganhou} ${ganhou === 1 ? 'abóbora' : 'abóboras'}</b>
      <span class="pa-sub">${subiu ? `Subiu para o nível ${nivel}!` : completo ? 'Passe completo!' : `Passe de Batalha · nível ${nivel}`}</span>
      ${hoje != null && limite ? `<span class="pa-dia">Hoje: ${hoje}/${limite}</span>` : ''}
      <div class="pa-barra"><i style="width:${reduzido ? pctFim : pctIni}%"></i></div>
      <a class="pa-ir" href="/passe/">Ir para o passe</a>
    </div>`;
  // Fica logo acima do aviso de PDR, se ele estiver na tela.
  const ajustar = () => {
    const r = document.querySelector('.rk-aviso');
    el.style.bottom = `${r ? r.offsetHeight + 30 : 20}px`;
  };
  ajustar();
  const vigia = setInterval(() => { if (!el.isConnected) clearInterval(vigia); else ajustar(); }, 700);
  document.body.append(el);
  atual = el;
  if (!reduzido) {
    const barra = el.querySelector('.pa-barra i');
    requestAnimationFrame(() => requestAnimationFrame(() => { barra.style.width = `${pctFim}%`; }));
  }
  el.querySelector('.pa-x').addEventListener('click', () => {
    el.classList.add('pa-sai');
    setTimeout(() => { el.remove(); if (atual === el) atual = null; }, 350);
  });
}

// Chamado pelo jogo quando mostra o resultado da partida: se ela rendeu abóboras, o aviso sobe.
export async function liberarAbobora() {
  try { await platform.passeAguardar(); } catch { /* sem passe */ }
  if (!pendente) return;
  const p = pendente;
  pendente = null;
  clearTimeout(reserva);
  mostrarAbobora(p);
}

export function montarAvisoAbobora() {
  platform.onChange((evt) => {
    if (evt.type !== 'passe') return;
    pendente = pendente ? juntar(pendente, evt) : evt;
    // Reserva: se o jogo não avisar o fim da partida, mostra mesmo assim depois de um tempo.
    clearTimeout(reserva);
    reserva = setTimeout(() => { if (pendente) { const p = pendente; pendente = null; mostrarAbobora(p); } }, 120000);
  });
}
