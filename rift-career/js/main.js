import { newCareer, chooseOffer, chooseEvent, advance, continueAfterSeason, retire } from './engine/career.js';
import { renderCreate } from './ui/create.js';
import { renderGame, careerSummaryText } from './ui/game.js';

const SAVE_KEY = 'riftcareer.save.v1';
const app = document.getElementById('app');

let state = load();

// Seletor de estilo (temporário, para comparar as 3 opções visuais).
const SKIN_KEY = 'riftcareer.skin';
const SKINS = [['1', 'Ouro Clássico'], ['2', 'Transmissão'], ['3', 'Troféu']];

function applySkin(id) {
  document.documentElement.dataset.skin = id;
  try { localStorage.setItem(SKIN_KEY, id); } catch { /* sem storage */ }
  document.querySelectorAll('.skin-picker button').forEach((b) => {
    b.classList.toggle('on', b.dataset.skin === id);
  });
}

function mountSkinPicker() {
  const el = document.createElement('div');
  el.className = 'skin-picker';
  el.innerHTML = `<span>Estilo</span>${SKINS.map(([id, name]) => `<button type="button" data-skin="${id}" title="${name}">${id} · ${name}</button>`).join('')}`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-skin]');
    if (b) applySkin(b.dataset.skin);
  });
  document.body.appendChild(el);
  let saved = null;
  try { saved = localStorage.getItem(SKIN_KEY); } catch { /* sem storage */ }
  applySkin(SKINS.some(([id]) => id === saved) ? saved : '1');
}

mountSkinPicker();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s && s.v === 2 ? s : null;
  } catch {
    return null;
  }
}

function save() {
  try {
    if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // Sem localStorage (aba anônima etc.): o jogo segue, só não salva.
  }
}

function render({ scrollTop = false } = {}) {
  if (!state) {
    renderCreate(app, (form) => {
      state = newCareer(form);
      save();
      render({ scrollTop: true });
    });
    return;
  }
  renderGame(app, state);
  if (scrollTop) {
    const center = document.getElementById('center');
    if (window.innerWidth < 1000 && center) center.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }
}

// Confirmação em dois cliques no próprio botão (sem confirm(), que alguns
// navegadores embutidos bloqueiam).
function confirmed(el, label) {
  if (el.dataset.armed) return true;
  const original = el.textContent;
  el.dataset.armed = '1';
  el.textContent = label;
  setTimeout(() => {
    if (el.isConnected) { delete el.dataset.armed; el.textContent = original; }
  }, 3000);
  return false;
}

function act(fn, opts = { scrollTop: true }) {
  fn();
  save();
  render(opts);
}

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !state) return;
  const i = Number(el.dataset.i);

  switch (el.dataset.act) {
    case 'offer': return act(() => chooseOffer(state, i));
    case 'stay': return act(() => chooseOffer(state, 'stay'));
    case 'choice': return act(() => chooseEvent(state, i), {});
    case 'next': return act(() => advance(state));
    case 'season-next': return act(() => continueAfterSeason(state));
    case 'retire':
      if (confirmed(el, 'Clique de novo para se aposentar')) act(() => retire(state));
      return;
    case 'modal-close':
      // Clique no fundo escuro ou no botão fecha; clique dentro do card não.
      if (e.target.closest('.modal') && !e.target.closest('button')) return;
      return act(() => state.modals.shift(), {});
    case 'restart':
      if (confirmed(el, 'Clique de novo: todo o progresso será perdido')) {
        state = null;
        save();
        render({ scrollTop: true });
      }
      return;
    case 'new-career':
      state = null;
      save();
      return render({ scrollTop: true });
    case 'copy-summary': {
      const text = careerSummaryText(state);
      navigator.clipboard?.writeText(text).then(
        () => { el.textContent = 'Copiado!'; },
        () => { el.textContent = 'Não foi possível copiar'; },
      );
      return;
    }
    default:
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state?.modals.length) act(() => state.modals.shift(), {});
});

render();
