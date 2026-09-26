// Artes geradas em SVG: escudos de time, troféus, camisa e minimapa.
import { esc } from '../util.js';
import { TEAM_LOGOS, OFFICIAL_LOGOS_ALLOWED } from '../../../../shared/config.js';
import { REGIONS } from '../data/world.js';

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
  return `<span class="badge" style="width:${size}px;height:${Math.round(size * 1.15)}px">${shield}<img class="badge-logo" src="${src}" alt="" loading="lazy" onload="__badgeLogoLoaded(this)" onerror="this.remove()"></span>`;
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
    if (!rest.length) { img.remove(); return; }
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
  return `<span class="trophy-img" style="width:${size}px;height:${h}px">${svg}<img src="${src}" alt="" data-next="${files.join(',')}" onload="this.previousElementSibling?.remove()" onerror="__trophyNext(this)"></span>`;
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

const NODES = {
  top: [40, 52], jungle: [62, 110], mid: [104, 96], adc: [118, 166], support: [158, 148],
};

// Minimapa esquematizado do Summoner's Rift com as 5 posições clicáveis.
export function minimapSvg(selected) {
  const nodes = Object.entries(NODES).map(([role, [x, y]]) => {
    const on = role === selected;
    const label = { top: 'TOP', jungle: 'JG', mid: 'MID', adc: 'ADC', support: 'SUP' }[role];
    return `<g class="map-node${on ? ' on' : ''}" data-role="${role}" tabindex="0" role="button" aria-label="${label}">
      <circle cx="${x}" cy="${y}" r="17"/>
      <text x="${x}" y="${y + 4}" text-anchor="middle">${label}</text>
    </g>`;
  }).join('');
  return `<svg class="minimap" viewBox="0 0 200 200">
    <rect x="2" y="2" width="196" height="196" rx="10" fill="#0e2a21" stroke="#2a4a3e" stroke-width="2"/>
    <path d="M22 22 L178 178" stroke="#16435a" stroke-width="16" stroke-linecap="round" opacity=".9"/>
    <g fill="none" stroke="#3a6b58" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M28 172 L28 28 L172 28"/>
      <path d="M28 172 L172 172 L172 28"/>
      <path d="M28 172 L172 28"/>
    </g>
    <circle cx="28" cy="172" r="14" fill="#1d5fa8" stroke="#8fc3ff" stroke-width="2"/>
    <circle cx="172" cy="28" r="14" fill="#a8321d" stroke="#ffb08f" stroke-width="2"/>
    ${nodes}
  </svg>`;
}

export function stars(rating) {
  const n = Math.max(1, Math.min(5, Math.round((rating - 45) / 10)));
  return `<span class="stars" aria-label="${n} de 5">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
}
