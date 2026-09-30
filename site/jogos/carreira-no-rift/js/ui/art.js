// Artes geradas em SVG: escudos de time, troféus, camisa e minimapa.
import { esc } from '../util.js';
import { TEAM_LOGOS, OFFICIAL_LOGOS_ALLOWED } from '../../../../shared/config.js';
import { REGIONS, buildTeams } from '../data/world.js';
import { EVENTS } from '../data/events.js';

let uid = 0;

// Imagens dos times (caminhos relativos à página do jogo). O modo vem de
// shared/config.js: logo oficial (assets/times) ou escudo do site
// (assets/emblemas). Academias usam a imagem do time principal; times
// fictícios (antigas ligas amadoras, só em saves antigos) usam o escudo gerado. Sem arquivo, o escudo gerado
// continua aparecendo.
const ASSETS = '../../shared/assets/';
// Na versão em arquivo único (scripts/build-bundle.mjs) as imagens vêm embutidas.
const EMBEDDED = typeof window !== 'undefined' ? window.__TEAM_LOGO_DATA : null;

function logoSrc(team) {
  if (team.tier === 3 || team.fictional) return null;
  const id = team.id.replace(/_ac$/, '');
  const official = TEAM_LOGOS === 'oficiais' || OFFICIAL_LOGOS_ALLOWED.includes(id);
  const path = `${official ? 'times' : 'emblemas'}/${id}.png`;
  if (EMBEDDED) return EMBEDDED[path] || null;
  return ASSETS + path;
}

// Quando a logo carrega, o escudo gerado sai. Logos escuras (ex.: pretas)
// sumiriam no fundo preto do site, então ganham um contorno claro.
if (typeof window !== 'undefined') {
  window.__badgeLogoLoaded = (img) => {
    img.classList.add('loaded');
    img.previousElementSibling?.remove();
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 32, 32);
      const px = ctx.getImageData(0, 0, 32, 32).data;
      let lum = 0;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 128) continue;
        // Brilho = canal mais forte: vermelho/roxo vivos não contam como escuros.
        lum += Math.max(px[i], px[i + 1], px[i + 2]);
        n += 1;
      }
      if (n && lum / n < 80) img.classList.add('dark');
    } catch { /* imagem de outra origem: fica como está */ }
  };
}

function shieldSvg(team, size) {
  const fs = team.tag.length > 3 ? 8.5 : team.tag.length > 2 ? 10.5 : 13;
  return `<svg class="badge-shield" width="${size}" height="${Math.round(size * 1.15)}" viewBox="0 0 40 46" aria-hidden="true">
    <path d="M20 1.5 L37.5 7.5 V22 C37.5 33.5 30 40.5 20 44.5 C10 40.5 2.5 33.5 2.5 22 V7.5 Z" fill="${team.c1}" stroke="${team.c2}" stroke-width="2.2"/>
    <text x="20" y="${26 + (13 - fs) / 3}" text-anchor="middle" font-size="${fs}" font-weight="800" font-family="Inter, sans-serif" fill="${team.c2}">${esc(team.tag)}</text>
  </svg>`;
}

export function teamBadge(team, size = 28) {
  if (!team) return '';
  const src = logoSrc(team);
  const shield = shieldSvg(team, size);
  if (!src) return `<span class="badge">${shield}</span>`;
  // A logo carrega por cima; quando carrega, o escudo sai. Se falhar, a logo sai.
  return `<span class="badge has-img" style="width:${size}px;height:${Math.round(size * 1.15)}px">${shield}<img class="badge-logo" src="${src}" alt="" decoding="async" onload="__badgeLogoLoaded(this)" onerror="this.parentElement.classList.remove('has-img'); this.remove()"></span>`;
}

const TONES = {
  intl: ['#fff3c4', '#e0b54f', '#8a6420'],
  league: ['#f4f6f8', '#b9c2cb', '#5d6873'],
  award: ['#ffe1b0', '#d98c3a', '#7a4513'],
};

export function trophySvg(kind = 'league', size = 120) {
  const id = `tg${++uid}`;
  const [a, b, c] = TONES[kind] || TONES.league;
  if (kind === 'award') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
      <path d="M40 6 H56 L64 40 H48 Z M80 6 H64 L56 40 H72 Z" fill="#1d6fb8"/>
      <circle cx="60" cy="72" r="36" fill="url(#${id})" stroke="${c}" stroke-width="3"/>
      <circle cx="60" cy="72" r="27" fill="none" stroke="${a}" stroke-opacity=".6" stroke-width="2"/>
      <path d="M60 52 L65.5 64 L78.5 65.5 L68.8 74.3 L71.6 87 L60 80.5 L48.4 87 L51.2 74.3 L41.5 65.5 L54.5 64 Z" fill="${a}"/>
    </svg>`;
  }
  return `<svg width="${size}" height="${Math.round(size * 1.15)}" viewBox="0 0 120 138" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
    <path d="M31 18 H15 C13 42 23 52 36 54" fill="none" stroke="url(#${id})" stroke-width="7" stroke-linecap="round"/>
    <path d="M89 18 H105 C107 42 97 52 84 54" fill="none" stroke="url(#${id})" stroke-width="7" stroke-linecap="round"/>
    <path d="M28 8 H92 V38 C92 62 78 78 60 80 C42 78 28 62 28 38 Z" fill="url(#${id})" stroke="${c}" stroke-width="2"/>
    <path d="M60 24 L64.5 34 L75 35 L67 42 L69.5 52.5 L60 47 L50.5 52.5 L53 42 L45 35 L55.5 34 Z" fill="${a}" opacity=".85"/>
    <rect x="53" y="80" width="14" height="20" fill="url(#${id})"/>
    <path d="M38 100 H82 L88 116 H32 Z" fill="url(#${id})" stroke="${c}" stroke-width="1.5"/>
    <rect x="26" y="116" width="68" height="14" rx="3" fill="${c}"/>
  </svg>`;
}

// Imagens dos troféus e medalhas (shared/assets/trofeus). Cada prêmio tem
// uma lista de arquivos em ordem de preferência (ex.: medalha da liga antes
// da genérica); sem nenhum arquivo, fica o troféu desenhado acima.
const TROPHY_FILES = {
  intl: { Mundial: 'mundial', MSI: 'msi', 'First Stand': 'first-stand' },
  lower: {
    'Circuito Desafiante': 'circuito-desafiante', 'LCK Challengers': 'lck-challengers',
    LDL: 'ldl', 'ERL Premier': 'erl', NACL: 'nacl',
  },
};
// Arquivos opcionais (troféu próprio da Copa, medalha por liga) só são
// procurados se estiverem listados aqui, para o site não pedir arquivos que
// não existem. Ex.: 'copa-cblol', 'mvp-cblol', 'selecao-lck'.
const OPTIONAL_TROPHIES = new Set([]);
// Arquivos principais (lista em shared/assets/trofeus/README.md).
const MAIN_TROPHIES = new Set([
  'mundial', 'msi', 'first-stand', 'cblol', 'lck', 'lpl', 'lec', 'lcs',
  'circuito-desafiante', 'lck-challengers', 'ldl', 'erl', 'nacl',
  'mvp', 'selecao', 'revelacao', 'mvp-final-mundial',
]);
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function trophyFiles(t) {
  if (t.kind === 'intl') return TROPHY_FILES.intl[t.name] ? [TROPHY_FILES.intl[t.name]] : [];
  if (t.kind === 'award') {
    if (t.name === 'MVP da Final do Mundial') return ['mvp-final-mundial', 'mvp'];
    const [type, ...rest] = t.name.split(' ');
    const league = rest.slice(1).join(' '); // "MVP do CBLOL" → "CBLOL"
    const base = { MVP: 'mvp', 'Seleção': 'selecao', 'Revelação': 'revelacao' }[type];
    return base ? [`${base}-${slug(league)}`, base] : [];
  }
  // Liga: a Copa pode ter troféu próprio (ex.: copa-cblol, lck-cup).
  if (t.tier === 1) {
    const region = Object.values(REGIONS).find((r) => r.stages.includes(t.name));
    if (!region) return [];
    const main = slug(region.leagues[1]);
    return t.name.includes('·') ? [main] : [slug(t.name), main]; // a Copa não tem "·" no nome
  }
  if (t.tier === 2) {
    const league = Object.keys(TROPHY_FILES.lower).find((l) => t.name.startsWith(l));
    return league ? [TROPHY_FILES.lower[league]] : [];
  }
  return []; // antigas ligas amadoras (saves antigos): troféu desenhado
}

if (typeof window !== 'undefined') {
  // Arquivo não existe: tenta o próximo da lista; acabou, fica o desenho.
  window.__trophyNext = (img) => {
    const rest = (img.dataset.next || '').split(',').filter(Boolean);
    if (!rest.length) { img.parentElement?.classList.remove('has-img'); img.remove(); return; }
    img.dataset.next = rest.slice(1).join(',');
    img.src = `${ASSETS}trofeus/${rest[0]}.png`;
  };
}

// Troféu de um título/prêmio: imagem quando existir, senão o desenho.
export function trophyArt(t, size = 120) {
  const svg = trophySvg(t.kind, size);
  let files = trophyFiles(t);
  files = files.filter((f) => EMBEDDED || MAIN_TROPHIES.has(f) || OPTIONAL_TROPHIES.has(f));
  let src;
  if (EMBEDDED) {
    const f = files.find((x) => EMBEDDED[`trofeus/${x}.png`]);
    if (!f) return svg;
    src = EMBEDDED[`trofeus/${f}.png`];
    files = [];
  } else {
    if (!files.length) return svg;
    src = `${ASSETS}trofeus/${files[0]}.png`;
    files = files.slice(1);
  }
  const h = Math.round(size * 1.15);
  return `<span class="trophy-img has-img" style="width:${size}px;height:${h}px">${svg}<img src="${src}" alt="" decoding="async" data-next="${files.join(',')}" onload="this.classList.add('loaded'); this.previousElementSibling?.remove()" onerror="__trophyNext(this)"></span>`;
}

// Imagem de fundo das decisões (img/eventos/<id>.jpg). Sem arquivo, fica o
// fundo com o emoji da cena.
export function eventScene(ev) {
  const src = EMBEDDED ? EMBEDDED[`eventos/${ev.id}.jpg`] : `img/eventos/${ev.id}.jpg`;
  const img = src
    ? `<img class="scene-img" src="${src}" alt="" decoding="async" onload="this.classList.add('loaded')" onerror="this.parentElement.classList.remove('has-img'); this.remove()">`
    : '';
  return `<div class="scene scene-${ev.scene}${src ? ' has-img' : ''}">${img}<span class="scene-icon">${ev.icon}</span></div>`;
}

// Escudo do OVR, pela faixa: prata (<70), ouro (70–79), platina (80–89),
// diamante (90–94) e challenger (95+). Imagens em shared/assets/trofeus.
export function ovrTier(ovr) {
  if (ovr >= 95) return 'challenger';
  if (ovr >= 90) return 'diamante';
  if (ovr >= 80) return 'platina';
  if (ovr >= 70) return 'ouro';
  return 'prata';
}

export function ovrShield(ovr, extraClass = '') {
  const tier = ovrTier(ovr);
  const src = EMBEDDED ? EMBEDDED[`trofeus/${tier}.png`] : `${ASSETS}trofeus/${tier}.png`;
  const img = src
    ? `<img class="ovr-shield-img" src="${src}" alt="" onload="this.classList.add('loaded')" onerror="this.parentElement.classList.add('no-img'); this.remove()">`
    : '';
  return `<div class="ovr-badge ovr-shield tier-${tier}${src ? '' : ' no-img'}${extraClass ? ` ${extraClass}` : ''}" title="OVR ${ovr}">${img}<span class="ovr-shine"></span><small>OVR</small><b>${ovr}</b></div>`;
}

// Reflexo de luz que passa pelos escudos de vez em quando (a cada 5–10 s).
// O brilho usa a própria imagem do escudo como máscara, então só aparece
// dentro do desenho.
export function startShieldShine() {
  if (typeof window === 'undefined' || window.__shieldShine) return;
  window.__shieldShine = true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const style = document.createElement('style');
  style.textContent = ['prata', 'ouro', 'platina', 'diamante', 'challenger'].map((tier) => {
    const src = EMBEDDED ? EMBEDDED[`trofeus/${tier}.png`] : `${ASSETS}trofeus/${tier}.png`;
    return src ? `.ovr-shield.tier-${tier} .ovr-shine { -webkit-mask-image: url("${src}"); mask-image: url("${src}"); }` : '';
  }).join('\n');
  document.head.appendChild(style);
  const tick = () => {
    document.querySelectorAll('.ovr-shield:not(.no-img) .ovr-shine').forEach((el) => {
      setTimeout(() => {
        el.classList.remove('on');
        void el.offsetWidth; // reinicia a animação
        el.classList.add('on');
      }, Math.random() * 500);
    });
    setTimeout(tick, 5000 + Math.random() * 5000);
  };
  setTimeout(tick, 1500 + Math.random() * 2500);
}

// Baixa as imagens do jogo em segundo plano (logos, troféus, escudos e, por
// último, as imagens das decisões), para que já estejam no cache quando
// aparecerem. Poucas por vez, para não atrapalhar o carregamento da página.
// Na versão de arquivo único as imagens já vêm embutidas: nada a fazer.
export function preloadArt() {
  if (typeof window === 'undefined' || EMBEDDED || window.__artPreloaded) return;
  window.__artPreloaded = true;
  const logos = [...new Set(Object.values(buildTeams()).map(logoSrc).filter(Boolean))];
  const trophies = [...MAIN_TROPHIES, 'prata', 'ouro', 'platina', 'diamante', 'challenger']
    .map((f) => `${ASSETS}trofeus/${f}.png`);
  const saveData = navigator.connection?.saveData;
  const events = saveData ? [] : EVENTS.map((e) => `img/eventos/${e.id}.jpg`);
  const queue = [...trophies.slice(-5), ...logos, ...trophies, ...events];
  let active = 0;
  const next = () => {
    while (active < 4 && queue.length) {
      const img = new Image();
      active += 1;
      img.onload = img.onerror = () => { active -= 1; next(); };
      img.decoding = 'async';
      img.src = queue.shift();
    }
  };
  const start = () => next();
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2500 });
  else setTimeout(start, 800);
}

// Camisa usada na tela de criação (nick nas costas).
export function jerseySvg(nick, roleShort) {
  const id = `jg${++uid}`;
  const name = esc((nick || 'NICK').toUpperCase().slice(0, 14));
  const fs = name.length > 9 ? 15 : 19;
  return `<svg class="jersey" viewBox="0 0 200 190" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232018"/><stop offset="1" stop-color="#0c0b09"/></linearGradient>
    </defs>
    <path d="M62 12 L84 5 Q100 20 116 5 L138 12 L194 42 L174 84 L150 72 L150 182 L50 182 L50 72 L26 84 L6 42 Z" fill="url(#${id})" stroke="#d9a82b" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M84 5 Q100 20 116 5" fill="none" stroke="#d9a82b" stroke-width="4"/>
    <path d="M50 72 L50 182 M150 72 L150 182" stroke="#d9a82b" stroke-opacity=".35" stroke-width="6"/>
    <text x="100" y="62" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="${fs}" letter-spacing="1.5" fill="#f0e6d2">${name}</text>
    <text x="100" y="128" text-anchor="middle" font-family="'Bebas Neue', Inter, sans-serif" font-size="44" font-weight="700" fill="#d9a82b">${esc(roleShort || '?')}</text>
  </svg>`;
}

// Posição de cada marcação no desenho do mapa (em % da largura e da altura).
export const MAP_PINS = {
  top: [16.6, 12.9], jungle: [27.8, 34.4], mid: [50.4, 44.7], adc: [71.4, 78.0], support: [87.6, 60.5],
};
const MAP_FILE = 'mapa/summoners-rift-640.webp';

// Mapa do Summoner's Rift (imagem com as marcações das rotas) e um botão
// transparente sobre cada marcação.
export function minimapSvg(selected) {
  const src = EMBEDDED ? EMBEDDED[MAP_FILE] : ASSETS + MAP_FILE;
  const nodes = Object.entries(MAP_PINS).map(([role, [x, y]]) => {
    const label = { top: 'Top', jungle: 'Jungle', mid: 'Mid', adc: 'ADC', support: 'Suporte' }[role];
    return `<button type="button" class="map-node${role === selected ? ' on' : ''}" data-role="${role}" style="left:${x}%;top:${y}%" aria-label="${label}" aria-pressed="${role === selected}"></button>`;
  }).join('');
  return `<div class="minimap${selected ? ' picked' : ''}">
    <img src="${src}" alt="Mapa do Summoner's Rift com as posições" width="640" height="629" decoding="async" />
    ${nodes}
  </div>`;
}

export function stars(rating) {
  const n = Math.max(1, Math.min(5, Math.round((rating - 45) / 10)));
  return `<span class="stars" aria-label="${n} de 5">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
}
