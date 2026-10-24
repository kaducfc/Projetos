// Dica discreta para ícones sem texto (troféus da galeria, 🏆 da tabela).
// Qualquer elemento com data-tip mostra o texto ao passar o mouse, ao focar
// pelo teclado ou ao tocar/clicar (celular). Fica num balão fixo na tela,
// para não ser cortado por áreas com rolagem.
let box = null;
let current = null;
let pinned = null; // aberto por toque/clique: fica até tocar de novo ou fora

function show(el) {
  if (!box) {
    box = document.createElement('div');
    box.className = 'tipbox';
    box.setAttribute('role', 'tooltip');
    document.body.appendChild(box);
  }
  current = el;
  box.textContent = el.dataset.tip;
  box.classList.add('on');
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const left = Math.min(window.innerWidth - b.width - 8, Math.max(8, r.left + r.width / 2 - b.width / 2));
  const above = r.top - b.height - 8;
  box.style.left = `${left}px`;
  box.style.top = `${above >= 8 ? above : r.bottom + 8}px`;
}

function hide() {
  current = null;
  pinned = null;
  box?.classList.remove('on');
}

export function mountTooltips(root = document) {
  root.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el && el !== current) show(el);
  });
  root.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el && el !== pinned && !el.contains(e.relatedTarget)) hide();
  });
  root.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) show(el);
  });
  root.addEventListener('focusout', (e) => { if (e.target !== pinned) hide(); });
  // Toque/clique: abre; tocar de novo ou fora fecha.
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el && el !== pinned) { show(el); pinned = el; } else hide();
  });
  window.addEventListener('scroll', hide, { passive: true });
}
