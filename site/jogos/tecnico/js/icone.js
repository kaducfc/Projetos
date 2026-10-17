// Ícone da organização: emblema (30, 3 partes de cor) + bandeira opcional (20, moldura e tecido).
// Tudo é montado com máscaras CSS sobre as imagens em img/icones/: cada parte vira uma camada colorida.
// O ícone viaja no campo `escudo` da organização em texto: v2:<emblema>:<c1>:<c2>:<c3>:<bandeira ou 0>:<moldura>:<tecido>
import { esc } from './regras.js';

export const N_EMBLEMAS = 30;
export const N_BANDEIRAS = 20;
export const PARTES_EMBLEMA = ['Contorno', 'Corpo', 'Detalhe'];
export const PARTES_BANDEIRA = ['Moldura (metal)', 'Tecido'];
// Onde o emblema fica dentro de cada bandeira (centro do maior círculo do tecido e lado do emblema, em fração do quadrado).
export const BANDEIRAS = [{"id": 1, "cx": 0.4961, "cy": 0.5195, "s": 0.5202}, {"id": 2, "cx": 0.5078, "cy": 0.5469, "s": 0.6052}, {"id": 3, "cx": 0.457, "cy": 0.4688, "s": 0.4652}, {"id": 4, "cx": 0.4922, "cy": 0.5781, "s": 0.5966}, {"id": 5, "cx": 0.4961, "cy": 0.5, "s": 0.4408}, {"id": 6, "cx": 0.5, "cy": 0.5273, "s": 0.62}, {"id": 7, "cx": 0.5, "cy": 0.3594, "s": 0.561}, {"id": 8, "cx": 0.4922, "cy": 0.5273, "s": 0.6104}, {"id": 9, "cx": 0.5117, "cy": 0.5312, "s": 0.5891}, {"id": 10, "cx": 0.4922, "cy": 0.4258, "s": 0.5806}, {"id": 11, "cx": 0.5, "cy": 0.5391, "s": 0.62}, {"id": 12, "cx": 0.4883, "cy": 0.3711, "s": 0.5966}, {"id": 13, "cx": 0.4961, "cy": 0.5117, "s": 0.578}, {"id": 14, "cx": 0.4961, "cy": 0.457, "s": 0.524}, {"id": 15, "cx": 0.4961, "cy": 0.5078, "s": 0.6043}, {"id": 16, "cx": 0.5117, "cy": 0.5234, "s": 0.5407}, {"id": 17, "cx": 0.4961, "cy": 0.5234, "s": 0.6047}, {"id": 18, "cx": 0.4922, "cy": 0.2734, "s": 0.4596}, {"id": 19, "cx": 0.4961, "cy": 0.3242, "s": 0.516}, {"id": 20, "cx": 0.5, "cy": 0.3242, "s": 0.4942}];
export const PALETA = ['#ffffff', '#e5e7eb', '#9ca3af', '#111827', '#f5cf5a', '#d9a82b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#92400e'];
export const ICONE_PADRAO = { e: 1, ec: ['#d9a82b', '#ffffff', '#1b3a6b'], b: 1, bc: ['#d9a82b', '#1b3a6b'] };

const HEX = /^#[0-9a-f]{6}$/;
const cor = (c, d) => (HEX.test(String(c || '').toLowerCase()) ? String(c).toLowerCase() : d);
export const icClone = (ic) => ({ e: ic.e, ec: [...ic.ec], b: ic.b, bc: [...ic.bc] });

export function icCodificar(ic) {
  const e = Math.min(N_EMBLEMAS, Math.max(1, Number(ic.e) || 1));
  const b = ic.b ? Math.min(N_BANDEIRAS, Math.max(1, Number(ic.b))) : 0;
  const h = (c, d) => cor(c, d).slice(1);
  return ['v2', e, h(ic.ec?.[0], '#d9a82b'), h(ic.ec?.[1], '#ffffff'), h(ic.ec?.[2], '#1b3a6b'), b, h(ic.bc?.[0], '#d9a82b'), h(ic.bc?.[1], '#1b3a6b')].join(':');
}
// Devolve o ícone ou null se o texto não for do formato novo (organizações antigas usam o escudo desenhado).
export function icDecodificar(txt) {
  const m = /^v2:(\d{1,2}):([0-9a-f]{6}):([0-9a-f]{6}):([0-9a-f]{6}):(\d{1,2}):([0-9a-f]{6}):([0-9a-f]{6})$/.exec(String(txt || ''));
  if (!m) return null;
  const e = Number(m[1]); const b = Number(m[5]);
  if (e < 1 || e > N_EMBLEMAS || b > N_BANDEIRAS) return null;
  return { e, ec: [`#${m[2]}`, `#${m[3]}`, `#${m[4]}`], b, bc: [`#${m[6]}`, `#${m[7]}`] };
}

const num2 = (n) => String(n).padStart(2, '0');
const DIR = new URL('../img/icones/', import.meta.url).href;
const camada = (cls, c, mascara, extra = '') => `<i class="${cls}" style="--c:${c};-webkit-mask-image:url(${mascara});mask-image:url(${mascara});${extra}"></i>`;

// Emblema sozinho (3 camadas).
export function emblemaHtml(ic, estilo = '') {
  const n = num2(ic.e);
  return `<span class="tc-emb" style="${estilo}">${[0, 1, 2].map((i) => camada('p', ic.ec[i], `${DIR}emb/e${n}-${i + 1}.webp`)).join('')}</span>`;
}
// Ícone completo, quadrado de `size` px.
export function icHtml(ic, size = 56, rotulo = '') {
  let pos = 'left:4%;top:4%;width:92%;height:92%';
  if (ic.b) { const f = BANDEIRAS[ic.b - 1]; pos = `left:${((f.cx - f.s / 2) * 100).toFixed(2)}%;top:${((f.cy - f.s / 2) * 100).toFixed(2)}%;width:${(f.s * 100).toFixed(2)}%;height:${(f.s * 100).toFixed(2)}%`; }
  let fundo = '';
  if (ic.b) {
    const n = num2(ic.b); const sombra = `background-image:url(${DIR}flag/f${n}-s.webp)`;
    fundo = [camada('f', ic.bc[0], `${DIR}flag/f${n}-1.webp`, sombra), camada('f', ic.bc[1], `${DIR}flag/f${n}-2.webp`, sombra)].join('');
  }
  return `<span class="tc-ic" style="--s:${size}px" role="img" aria-label="${esc(rotulo)}">${fundo}${emblemaHtml(ic, pos)}</span>`;
}
