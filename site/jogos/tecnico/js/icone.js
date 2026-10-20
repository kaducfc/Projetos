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

// ---------------------------------------------------------------- emblema de TEXTO (v3)
// Alguns times usam só a escrita como símbolo. O texto viaja no campo `escudo` em texto:
// v3:<texto>:<fonte 1-11>:<cor de cima>:<cor de baixo>:<espessura do contorno 0-8>:<cor do contorno>:<sombra 0-6>:<cor da sombra>:<placa 0-3>:<cor da placa>:<cor da borda da placa>
export const FONTES = [
  { id: 1, nome: 'Bebas Neue', css: "'Bebas Neue', Impact, sans-serif" },
  { id: 2, nome: 'Draco', css: "'TC Draco', Impact, sans-serif" },
  { id: 3, nome: 'Midnight Letters', css: "'TC Midnight', Impact, sans-serif" },
  { id: 4, nome: 'Midnight Letters Itálico', css: "'TC Midnight It', Impact, sans-serif" },
  { id: 5, nome: 'Polarized', css: "'TC Polarized', Impact, sans-serif" },
  { id: 6, nome: 'Polarized Itálico', css: "'TC Polarized It', Impact, sans-serif" },
  { id: 7, nome: 'Stifly', css: "'TC Stifly', Impact, sans-serif" },
  { id: 8, nome: 'Thernaly', css: "'TC Thernaly', Impact, sans-serif" },
  { id: 9, nome: 'Thernaly Itálico', css: "'TC Thernaly It', Impact, sans-serif" },
  { id: 10, nome: 'Victory Striker', css: "'TC Victory', Impact, sans-serif" },
  { id: 11, nome: 'Y224', css: "'TC Y224', Impact, sans-serif" },
];
export const FORMAS_PLACA = ['Sem placa', 'Elipse', 'Retângulo', 'Escudo'];
export const TEXTO_MAX = 14;
export const TEXTO_PADRAO = { t: 'TIME', f: 1, c: ['#ffffff', '#d9a82b'], ow: 3, oc: '#1b3a6b', sh: 2, sc: '#000000', pl: 0, pf: '#1b3a6b', pb: '#d9a82b' };
export const txClone = (tx) => ({ ...tx, c: [...tx.c] });
// Só letras, números, espaço e . & ! ' + - (o ":" separa os campos).
export const txLimpar = (t) => String(t ?? '').replace(/[^A-Za-z0-9À-ÿ .&!'+-]/g, '').replace(/\s{2,}/g, ' ').slice(0, TEXTO_MAX);

export function txCodificar(tx) {
  const t = txLimpar(tx.t).trim() || 'TIME';
  const f = Math.min(FONTES.length, Math.max(1, Number(tx.f) || 1));
  const h = (c, d) => cor(c, d).slice(1);
  const n = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
  return ['v3', t, f, h(tx.c?.[0], '#ffffff'), h(tx.c?.[1], '#d9a82b'), n(tx.ow, 8), h(tx.oc, '#1b3a6b'), n(tx.sh, 6), h(tx.sc, '#000000'), n(tx.pl, 3), h(tx.pf, '#1b3a6b'), h(tx.pb, '#d9a82b')].join(':');
}
export function txDecodificar(txt) {
  const m = /^v3:([A-Za-z0-9À-ÿ .&!'+-]{1,14}):([1-9]|1[01]):([0-9a-f]{6}):([0-9a-f]{6}):([0-8]):([0-9a-f]{6}):([0-6]):([0-9a-f]{6}):([0-3]):([0-9a-f]{6}):([0-9a-f]{6})$/.exec(String(txt || ''));
  if (!m) return null;
  return { t: m[1], f: Number(m[2]), c: [`#${m[3]}`, `#${m[4]}`], ow: Number(m[5]), oc: `#${m[6]}`, sh: Number(m[7]), sc: `#${m[8]}`, pl: Number(m[9]), pf: `#${m[10]}`, pb: `#${m[11]}` };
}

// Carrega as fontes do emblema de texto (e avisa quando terminar, para redesenhar com as medidas certas).
let fontesProntas = false;
export function carregarFontes() {
  if (typeof document === 'undefined' || !document.fonts?.load) return Promise.resolve(false);
  return Promise.all(FONTES.map((f) => document.fonts.load(`100px ${f.css}`, 'AaZz09').catch(() => null))).then(() => { fontesProntas = true; return true; });
}
let medidor = null;
function larguraTexto(t, css) {
  try {
    if (typeof document !== 'undefined') { medidor = medidor || document.createElement('canvas').getContext('2d'); medidor.font = `100px ${css}`; const w = medidor.measureText(t).width; if (w > 0) return w; }
  } catch { /* sem canvas: estimativa */ }
  return t.length * 58;
}
let seq = 0;
// Emblema de texto: SVG com contorno, sombra, degradê de duas cores e placa opcional. `size` é a altura de referência do ícone (como no emblema comum).
export function textoHtml(tx, size = 56, rotulo = '') {
  const fonte = FONTES.find((f) => f.id === tx.f) || FONTES[0];
  const t = txLimpar(tx.t).trim() || 'TIME';
  const w = larguraTexto(t, fonte.css);
  const mx = 10 + tx.ow * 2 + tx.sh + (tx.pl ? 26 : 0); const my = 14 + tx.ow * 2 + tx.sh + (tx.pl ? 20 : 0);
  const W = Math.round(w + mx * 2); const H = Math.round(100 + my * 2);
  const id = `tcg${++seq}`;
  const esc2 = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;');
  const grad = tx.c[0] !== tx.c[1];
  const fill = grad ? `url(#${id})` : tx.c[0];
  const base = `x="${W / 2}" y="${H / 2}" dy="0.34em" text-anchor="middle" font-family="${fonte.css.replace(/"/g, "'")}" font-size="100" stroke-linejoin="round" paint-order="stroke"`;
  const placa = [null,
    `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2 - 3}" ry="${H / 2 - 3}"`,
    `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="${Math.round(H * 0.16)}"`,
    `<path d="M3 3 H${W - 3} V${Math.round(H * 0.6)} Q${W - 3} ${Math.round(H * 0.86)} ${W / 2} ${H - 3} Q3 ${Math.round(H * 0.86)} 3 ${Math.round(H * 0.6)} Z"`][tx.pl];
  const placaSvg = placa ? `${placa} fill="${tx.pf}" stroke="${tx.pb}" stroke-width="6" stroke-linejoin="round"/>` : '';
  const sombra = tx.sh ? `<text ${base} transform="translate(${tx.sh * 1.6} ${tx.sh * 1.6})" fill="${tx.sc}" stroke="${tx.sc}" stroke-width="${tx.ow * 2}" opacity=".85">${esc2(t)}</text>` : '';
  const alt = size * 0.86; const escala = Math.min(alt / H, (size * 2.6) / W);
  return `<svg class="tc-ict" viewBox="0 0 ${W} ${H}" width="${Math.round(W * escala)}" height="${Math.round(H * escala)}" role="img" aria-label="${esc(rotulo || t)}" style="display:inline-block;vertical-align:middle;flex:none">
    ${grad ? `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.25" stop-color="${tx.c[0]}"/><stop offset="0.75" stop-color="${tx.c[1]}"/></linearGradient></defs>` : ''}${placaSvg}${sombra}
    <text ${base} fill="${fill}" stroke="${tx.ow ? tx.oc : 'none'}" stroke-width="${tx.ow * 2}">${esc2(t)}</text></svg>`;
}
