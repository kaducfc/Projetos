// Arte do jogo: ícone das organizações e retratos provisórios dos jogadores (SVG).
// Quando um jogador tiver `retrato` (arquivo de imagem), o retrato real substitui o desenho.
import { esc, SIGLA_VAGA } from './regras.js';
import { icDecodificar, icHtml, icPorNome, txDecodificar, textoHtml } from './icone.js?v=3';

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// Ícone da organização: escrita (v3), símbolo (v4) ou, para times do sistema e contas antigas, um símbolo fixo pelo nome com as cores do time.
export function escudoOrg(o, size = 44) {
  const tx = txDecodificar(o?.escudo);
  if (tx) return textoHtml(tx, Math.round(size * 1.1), o?.nome || o?.sigla || '');
  const ic = icDecodificar(o?.escudo) || icPorNome(o?.nome || o?.sigla, o?.cor1, o?.cor2);
  return icHtml(ic, Math.round(size * 1.1), o?.sigla || '');
}

const COR_VAGA = { top: ['#7c2d12', '#f97316'], selva: ['#14532d', '#4ade80'], meio: ['#1e3a8a', '#60a5fa'], atirador: ['#7f1d1d', '#f87171'], suporte: ['#581c87', '#c084fc'] };

// Retrato provisório determinístico (mesmo jogador, mesmo rosto).
export function retratoSvg(j, size = 96) {
  if (j.retrato) return `<img class="tc-retrato" src="${esc(j.retrato)}" alt="${esc(j.nome)}" width="${size}" height="${size}" loading="lazy" />`;
  const h = hash(j.nome + j.id);
  const [fundo, brilho] = COR_VAGA[j.pos] || COR_VAGA.meio;
  const pele = ['#f3d3b5', '#e0b48d', '#c68e63', '#a3693f', '#7a4a2a', '#f6dcc4'][h % 6];
  const cabelo = ['#1b1b1f', '#3b2a1a', '#6b3f1d', '#c9a227', '#7a1f1f', '#3f3f46', '#1e3a5f'][(h >> 3) % 7];
  const estilo = (h >> 6) % 4;
  const fone = (h >> 9) % 3 === 0;
  const cabeloSvg = [
    `<path d="M30 40 C30 22 70 22 70 40 C66 32 34 32 30 40 Z" fill="${cabelo}"/>`,
    `<path d="M28 44 C26 20 74 20 72 44 L68 36 C60 28 40 28 32 36 Z" fill="${cabelo}"/>`,
    `<path d="M30 42 C28 24 72 24 70 42 C62 30 38 30 30 42 Z" fill="${cabelo}"/><rect x="29" y="38" width="6" height="14" rx="3" fill="${cabelo}"/>`,
    `<path d="M32 38 C34 26 66 26 68 38 C60 34 40 34 32 38 Z" fill="${cabelo}"/>`,
  ][estilo];
  return `<svg class="tc-retrato" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(j.nome)}">
    <defs><linearGradient id="g${j.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${brilho}" stop-opacity=".55"/><stop offset="1" stop-color="${fundo}"/></linearGradient></defs>
    <rect width="100" height="100" fill="url(#g${j.id})"/>
    <path d="M10 100 C12 74 30 66 50 66 C70 66 88 74 90 100 Z" fill="#101828"/>
    <path d="M38 66 L50 78 L62 66" fill="none" stroke="${brilho}" stroke-width="3"/>
    <rect x="43" y="56" width="14" height="14" rx="5" fill="${pele}"/>
    <ellipse cx="50" cy="44" rx="17" ry="20" fill="${pele}"/>
    ${cabeloSvg}
    <circle cx="43" cy="46" r="2" fill="#1b1b1f"/><circle cx="57" cy="46" r="2" fill="#1b1b1f"/>
    <path d="M45 56 Q50 59 55 56" fill="none" stroke="#7a3b2a" stroke-width="1.6" stroke-linecap="round"/>
    ${fone ? `<path d="M30 46 C30 24 70 24 70 46" fill="none" stroke="#e5e7eb" stroke-width="3.5"/><rect x="26" y="42" width="7" height="12" rx="3" fill="#e5e7eb"/><rect x="67" y="42" width="7" height="12" rx="3" fill="#e5e7eb"/>` : ''}
  </svg>`;
}

export const iconeVaga = (v) => `<span class="tc-vaga-ic v-${v}">${SIGLA_VAGA[v] || v}</span>`;
