// Tela "Crie o seu jogador".
import { ATTRS, NATIONS, REGIONS, ROLES, STYLES } from '../data/world.js';
import { calcOvr, rollAttrs, OVR_INICIAL } from '../engine/player.js';
import { jerseySvg, minimapSvg } from './art.js';
import { esc } from '../util.js';

const NICK_RE = /^[\p{L}\p{N}_. -]{2,14}$/u;

// `bonusElo()` → { n, nome } (OVR inicial extra pelo elo da ranqueada). A
// função devolvida atualiza o bônus (ex.: o jogador entrou na conta agora).
export function renderCreate(root, onConfirm, { bonusElo = () => ({ n: 0, nome: null }) } = {}) {
  const f = { nick: '', nat: 'BR', role: null, style: 'agressivo', attrs: null, speed: 'normal' };

  root.innerHTML = `
  <div class="create-wrap">
    <div class="create card">
      <header class="create-head">
        <div class="brand"><span class="brand-mark">◆</span> CARREIRA NO RIFT</div>
        <h1>Crie o seu jogador</h1>
        <p>Aos 16 anos, você sai da SoloQ direto pro cenário. Escolha quem você é e onde começa.</p>
      </header>
      <div class="create-cols">
        <section class="create-col">
          <h3 class="col-title">Identidade</h3>
          <div class="jersey-box" id="jersey"></div>
          <label class="field">
            <span>Nick no jogo</span>
            <input id="nick" maxlength="14" autocomplete="off" placeholder="SeuNick" />
          </label>
          <div class="field">
            <span>Estilo de jogo</span>
            <div class="seg" id="style">
              ${Object.values(STYLES).map((s) => `<button type="button" data-style="${s.id}">${s.name}<small>${s.desc}</small></button>`).join('')}
            </div>
          </div>
          <div class="field">
            <span>Velocidade do jogo</span>
            <div class="seg" id="speed">
              <button type="button" data-speed="normal">Normal<small>3 decisões por ano</small></button>
              <button type="button" data-speed="rapido">Rápido<small>1 decisão por ano</small></button>
            </div>
          </div>
        </section>

        <section class="create-col">
          <h3 class="col-title">Nacionalidade</h3>
          <label class="search">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20 L16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <input id="nat-q" placeholder="Buscar país" autocomplete="off" />
          </label>
          <div class="nat-list" id="nat-list"></div>
          <p class="nat-note" id="nat-note"></p>
        </section>

        <section class="create-col">
          <h3 class="col-title">Posição</h3>
          <div id="map"></div>
          <div id="role-info" class="role-info"></div>
        </section>
      </div>
      <footer class="create-foot">
        <span id="create-hint" class="muted"></span>
        <button class="btn-primary" id="confirm" disabled>Confirmar jogador</button>
      </footer>
    </div>
  </div>`;

  const $ = (id) => root.querySelector(`#${id}`);

  const paintJersey = () => {
    $('jersey').innerHTML = jerseySvg(f.nick, f.role ? ROLES[f.role].short : '?');
  };

  const paintStyle = () => {
    root.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('on', b.dataset.style === f.style));
  };

  const paintSpeed = () => {
    root.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', b.dataset.speed === f.speed));
  };

  const paintNations = () => {
    const q = $('nat-q').value.trim().toLowerCase();
    const list = NATIONS.filter((n) => !q || n.name.toLowerCase().includes(q));
    $('nat-list').innerHTML = list.map((n) => `
      <button type="button" class="nat${n.id === f.nat ? ' on' : ''}" data-nat="${n.id}">
        <span class="flag">${n.flag}</span>${esc(n.name)}
      </button>`).join('') || '<p class="muted">Nenhum país encontrado.</p>';
    const nation = NATIONS.find((n) => n.id === f.nat);
    const reg = REGIONS[nation.region];
    $('nat-note').innerHTML = `Você começa na região <b>${reg.name}</b> (${reg.leagues[1]}).`;
  };

  const paintRole = () => {
    // O mapa é desenhado uma vez; depois só troca a posição marcada.
    const map = $('map');
    if (!map.firstElementChild) map.innerHTML = minimapSvg(f.role);
    map.firstElementChild.classList.toggle('picked', !!f.role);
    map.querySelectorAll('[data-role]').forEach((b) => {
      b.classList.toggle('on', b.dataset.role === f.role);
      b.setAttribute('aria-pressed', String(b.dataset.role === f.role));
    });
    if (!f.role) {
      $('role-info').innerHTML = '<p class="muted">Toque numa posição do mapa.</p>';
      return;
    }
    const r = ROLES[f.role];
    const ovr = calcOvr(f.attrs, f.role);
    const b = bonusElo();
    $('role-info').innerHTML = `
      <div class="role-head"><b>${r.name}</b><span class="ovr-mini">OVR <b>${ovr}</b></span></div>
      <p class="elo-bonus">${b.n
    ? `OVR inicial ${OVR_INICIAL} <b>+${b.n}</b> pelo seu elo (${esc(b.nome)}) na ranqueada.`
    : `OVR inicial ${OVR_INICIAL}. Cada elo da ranqueada dá +1 (Bronze +1 até Desafiante +9).`}</p>
      <p class="muted">${r.desc}</p>
      ${ATTRS.map((a) => `
        <div class="attr-row">
          <span>${a.name}</span>
          <div class="bar"><i style="width:${f.attrs[a.id]}%"></i></div>
          <b>${Math.round(f.attrs[a.id])}</b>
        </div>`).join('')}`;
  };

  const paintConfirm = () => {
    const okNick = NICK_RE.test(f.nick.trim());
    const ready = okNick && f.nat && f.role;
    $('confirm').disabled = !ready;
    $('create-hint').textContent = !okNick
      ? 'Escolha um nick (2 a 14 caracteres).'
      : !f.role ? 'Escolha sua posição no mapa.' : 'Tudo pronto. Boa sorte na carreira!';
  };

  const reroll = () => {
    if (f.role) f.attrs = rollAttrs(f.role, f.style, OVR_INICIAL + bonusElo().n);
  };

  $('nick').addEventListener('input', (e) => {
    f.nick = e.target.value;
    paintJersey();
    paintConfirm();
  });
  $('style').addEventListener('click', (e) => {
    const b = e.target.closest('[data-style]');
    if (!b) return;
    f.style = b.dataset.style;
    reroll();
    paintStyle();
    paintRole();
  });
  $('speed').addEventListener('click', (e) => {
    const b = e.target.closest('[data-speed]');
    if (!b) return;
    f.speed = b.dataset.speed;
    paintSpeed();
  });
  $('nat-q').addEventListener('input', paintNations);
  $('nat-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nat]');
    if (!b) return;
    f.nat = b.dataset.nat;
    paintNations();
    paintConfirm();
  });
  const pickRole = (e) => {
    const g = e.target.closest('[data-role]');
    if (!g) return;
    f.role = g.dataset.role;
    reroll();
    paintJersey();
    paintRole();
    paintConfirm();
  };
  $('map').addEventListener('click', pickRole);
  $('confirm').addEventListener('click', () => {
    onConfirm({ nick: f.nick.trim(), nat: f.nat, role: f.role, style: f.style, attrs: f.attrs, speed: f.speed });
  });

  paintJersey();
  paintStyle();
  paintSpeed();
  paintNations();
  paintRole();
  paintConfirm();
  return () => {
    reroll();
    paintRole();
  };
}
