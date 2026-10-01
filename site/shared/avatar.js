// Ícones de perfil: o mascote do site ou um campeão (imagem do Data Dragon,
// a mesma usada no Campeão Oculto). Guardado no perfil como 'mascote' ou
// 'champ:<Id do campeão>'.

const DDRAGON = 'https://ddragon.leagueoflegends.com';
const VERSION_KEY = 'site.ddragon';
const MASCOTE = '/shared/assets/marca/mascote-120.png?v=2';

// Ids do Data Dragon (sem espaço nem apóstrofo).
export const CAMPEOES = [
  'Ahri', 'Yasuo', 'Jinx', 'LeeSin', 'Thresh', 'Lux', 'Zed', 'Ezreal', 'Teemo', 'Garen',
  'Darius', 'Katarina', 'Vayne', 'Kaisa', 'Akali', 'Yone', 'Sett', 'Pyke', 'Leona', 'Annie',
  'Ashe', 'MissFortune', 'Viego', 'Jhin', 'Lulu', 'Nautilus', 'Riven', 'MasterYi', 'Blitzcrank', 'Ekko',
  'Caitlyn', 'Vi', 'Draven', 'Sylas', 'Gwen', 'Jayce', 'Senna', 'Rakan', 'Xayah', 'Kayn',
];
export const AVATARES = ['mascote', ...CAMPEOES.map((c) => `champ:${c}`)];

// Nome para mostrar ("MissFortune" → "Miss Fortune", "Kaisa" → "Kai'Sa").
const NOMES = { Kaisa: "Kai'Sa", LeeSin: 'Lee Sin', MissFortune: 'Miss Fortune', MasterYi: 'Master Yi' };
export const nomeAvatar = (id) => (id === 'mascote' ? 'Mascote do Rift Arcade' : NOMES[id?.slice(6)] || id?.slice(6) || '');

let version = null;
try {
  const c = JSON.parse(localStorage.getItem(VERSION_KEY) || 'null');
  if (c?.v) version = c.v;
} catch { /* sem armazenamento */ }
let versionPromise = null;

// Versão atual do Data Dragon (guardada por 1 dia).
function loadVersion() {
  if (versionPromise) return versionPromise;
  versionPromise = (async () => {
    try {
      const c = JSON.parse(localStorage.getItem(VERSION_KEY) || 'null');
      if (c?.v && Date.now() - c.at < 864e5) return (version = c.v);
    } catch { /* sem armazenamento */ }
    try {
      const v = (await (await fetch(`${DDRAGON}/api/versions.json`)).json())[0];
      try { localStorage.setItem(VERSION_KEY, JSON.stringify({ v, at: Date.now() })); } catch { /* sem armazenamento */ }
      return (version = v);
    } catch {
      return version;
    }
  })();
  return versionPromise;
}

const srcDe = (id, v) => (id === 'mascote' || !id?.startsWith('champ:') ? MASCOTE
  : v ? `${DDRAGON}/cdn/${v}/img/champion/${id.slice(6)}.png` : '');

// <img> do ícone. Sem ícone escolhido, mostra a inicial do nome.
export function avatarHtml(avatar, nome = '', size = 32, extra = '') {
  const inicial = (nome || '?').trim().charAt(0).toUpperCase();
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px`;
  if (!avatar) return `<span class="avatar avatar-letra ${extra}" style="${style}" aria-hidden="true">${inicial}</span>`;
  const src = srcDe(avatar, version);
  return `<span class="avatar ${extra}" style="${style}" aria-hidden="true" data-letra="${inicial}">`
    + `<img alt="" data-avatar="${avatar}" ${src ? `src="${src}"` : ''} width="${size}" height="${size}" decoding="async" onerror="this.remove()" /></span>`;
}

// Completa as imagens de campeão que ainda esperavam a versão do Data Dragon.
export async function hydrateAvatars(root = document) {
  const faltando = [...root.querySelectorAll('img[data-avatar]:not([src])')];
  if (!faltando.length) return;
  const v = await loadVersion();
  faltando.forEach((img) => {
    const src = srcDe(img.dataset.avatar, v);
    if (src) img.src = src; else img.remove();
  });
}
