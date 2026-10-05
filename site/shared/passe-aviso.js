// Aviso "+N abóboras" ao terminar uma partida (passe de batalha): um cartão sobe
// do rodapé com a abóbora em destaque e a barra do nível enchendo. Montado pela
// barra do site (shared/account.js), então vale para o hub e para todos os jogos.
import * as platform from './platform.js';
import { ABOBORA_IMG } from './passe.js';

const reduzido = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let atual = null;

export function mostrarAbobora({ ganhou, nivelAntes, nivel, progresso, por, niveis }) {
  atual?.remove();
  const subiu = nivel > nivelAntes;
  const completo = nivel >= niveis;
  const pctFim = completo ? 100 : Math.min(100, Math.round((progresso / por) * 100));
  // A barra começa de onde estava e enche até onde chegou; se subiu de nível, enche, esvazia e recomeça.
  const pctIni = subiu ? 0 : Math.max(0, Math.round(((progresso - ganhou) / por) * 100));
  const el = document.createElement('div');
  el.className = 'ps-aviso-abobora';
  el.setAttribute('role', 'status');
  el.innerHTML = `<img class="pa-img" src="${ABOBORA_IMG}" srcset="/shared/assets/passe/abobora-128.webp 2x" width="56" height="56" alt="" />
    <div class="pa-txt">
      <b class="pa-qtd">+${ganhou} ${ganhou === 1 ? 'abóbora' : 'abóboras'}</b>
      <span class="pa-sub">${subiu ? `Subiu para o nível ${nivel}!` : completo ? 'Passe completo!' : `Passe de Batalha · nível ${nivel}`}</span>
      <div class="pa-barra"><i style="width:${reduzido ? pctFim : pctIni}%"></i></div>
    </div>`;
  document.body.append(el);
  atual = el;
  const barra = el.querySelector('.pa-barra i');
  if (!reduzido) {
    requestAnimationFrame(() => requestAnimationFrame(() => { barra.style.width = `${pctFim}%`; }));
  }
  if (subiu) el.classList.add('pa-sobe-nivel');
  const sair = () => {
    el.classList.add('pa-sai');
    setTimeout(() => { el.remove(); if (atual === el) atual = null; }, 400);
  };
  setTimeout(sair, subiu ? 4600 : 3400);
  el.addEventListener('click', sair);
}

export function montarAvisoAbobora() {
  platform.onChange((evt) => {
    if (evt.type === 'passe') mostrarAbobora(evt);
  });
}
