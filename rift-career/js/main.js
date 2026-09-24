import { newCareer, chooseOffer, chooseEvent, advance, continueAfterSeason, retire } from './engine/career.js';
import { renderCreate } from './ui/create.js';
import { renderGame, careerSummaryText } from './ui/game.js';

const SAVE_KEY = 'riftcareer.save.v1';
const app = document.getElementById('app');

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s && s.v === 1 ? s : null;
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
      if (confirm('Anunciar a aposentadoria? A carreira termina aqui.')) act(() => retire(state));
      return;
    case 'modal-close':
      // Clique no fundo escuro ou no botão fecha; clique dentro do card não.
      if (e.target.closest('.modal') && !e.target.closest('button')) return;
      return act(() => state.modals.shift(), {});
    case 'restart':
      if (confirm('Reiniciar a carreira? Todo o progresso será perdido.')) {
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
