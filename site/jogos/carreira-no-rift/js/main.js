import { newCareer, chooseOffer, chooseEvent, advance, continueAfterSeason, retire, legacyLabel, legacyScore, teamOf } from './engine/career.js';
import { renderCreate } from './ui/create.js';
import { renderGame, careerSummaryText } from './ui/game.js';
import { ROLES } from './data/world.js';
import { packState, unpackState } from './engine/save.js';
import * as platform from '../../../shared/platform.js';
import { mountSiteBar } from '../../../shared/account.js';

const GAME_ID = 'carreira-no-rift';
const OLD_SAVE_KEY = 'riftcareer.save.v1';
const app = document.getElementById('app');

const valid = (s) => (s && s.v === 2 ? unpackState(s) : null);

// Save antigo (antes do site ter contas): migra uma vez para a plataforma.
function migrateOldSave() {
  try {
    const raw = localStorage.getItem(OLD_SAVE_KEY);
    if (!raw) return null;
    localStorage.removeItem(OLD_SAVE_KEY);
    const s = valid(JSON.parse(raw));
    if (s) platform.writeSave(GAME_ID, packState(s));
    return s;
  } catch {
    return null;
  }
}

let state = valid(platform.loadLocalSave(GAME_ID)) ?? migrateOldSave();

// Salva no navegador a cada jogada; a plataforma manda para a nuvem no
// máximo 1 vez por minuto (na hora, se a carreira acabou de terminar).
function save() {
  if (state) platform.writeSave(GAME_ID, packState(state), { urgent: Boolean(state.player?.retired) });
  else platform.clearSave(GAME_ID);
}

// Carreira encerrada: vai para o histórico do site (uma vez só).
function recordIfRetired() {
  const p = state?.player;
  if (!p?.retired || state.resultRecorded) return;
  state.resultRecorded = true;
  const legacy = legacyLabel(p);
  const count = (name) => p.trophies.filter((t) => t.name === name).length;
  platform.recordResult(GAME_ID, {
    score: legacyScore(p),
    summary: {
      text: `${p.nick} · ${ROLES[p.role].name} · ${legacy.title} · OVR máx. ${p.peakOvr}`,
      nick: p.nick,
      role: p.role,
      legacy: legacy.title,
      peakOvr: p.peakOvr,
      seasons: p.history.length,
      games: p.stats.games,
      titles: {
        ligas: p.trophies.filter((t) => t.kind === 'league').length,
        firstStand: count('First Stand'),
        msi: count('MSI'),
        mundial: count('Mundial'),
      },
      clubs: [...new Set(p.history.map((h) => teamOf(state, h.teamId).name))],
    },
  });
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
  recordIfRetired();
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

mountSiteBar(document.getElementById('site-bar'), { hubHref: '../../' });

// Ao entrar na conta, a carreira salva na nuvem (se for mais recente)
// substitui a deste aparelho; ao sair, o aparelho é limpo.
platform.onChange((evt) => {
  if (evt.type === 'save' && evt.gameId === GAME_ID) {
    state = valid(evt.data);
    render({ scrollTop: true });
  }
  if (evt.type === 'auth' && evt.cleared) {
    state = null;
    render({ scrollTop: true });
  }
});

render();
platform.init();
