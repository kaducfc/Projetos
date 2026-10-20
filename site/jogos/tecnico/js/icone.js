// Ícone da organização: um dos símbolos de img/simbolos/ (cada um aceita de 1 a 3 cores) ou só a escrita (v3, abaixo).
// Cada símbolo tem uma camada fixa (partes que não mudam de cor) e de 1 a 3 camadas recoloríveis. A imagem da camada guarda só o
// sombreado e o recorte; a cor escolhida entra por background-blend-mode: hard-light, então o relevo original é mantido.
// O símbolo viaja no campo `escudo` da organização em texto: v4:<símbolo>:<cor 1>[:<cor 2>[:<cor 3>]] (cores em hex sem #).
import { esc } from './regras.js';

// [nome, tem camada fixa (0/1), [[rótulo da cor, cor original], ...]] — a posição + 1 é o número do símbolo.
export const SIMBOLOS = [
  ["Tridente Abissal", 1, [["Lâminas", '#1467b3'], ["Metal escuro", '#12131d']]],
  ["Capuz Arcano", 0, [["Brilho", '#6b14a4'], ["Capuz", '#090211']]],
  ["Coroa Dourada", 0, [["Ouro", '#cf8015'], ["Fundo", '#0d0704']]],
  ["Vórtice Flamejante", 0, [["Chamas", '#de1903'], ["Núcleo", '#0c0505']]],
  ["Cristais de Jade", 1, [["Cor", '#075b60']]],
  ["Bússola Rúnica", 1, [["Gema", '#0d77c0'], ["Anel", '#231611']]],
  ["Lobo Gélido", 1, [["Pelagem", '#dddee6'], ["Sombra", '#070b15']]],
  ["Chifres Rubros", 0, [["Cor", '#b9040a']]],
  ["Redemoinho", 1, [["Cor", '#0362c1']]],
  ["Elmo Sombrio", 1, [["Brilho", '#d54103'], ["Armadura", '#140f0e']]],
  ["Flor Arcana", 1, [["Cor", '#6523a0']]],
  ["Naja", 0, [["Escamas", '#c6840d'], ["Corpo", '#0f0c08']]],
  ["Garras Sombrias", 1, [["Detalhes", '#472773'], ["Metal", '#11101a']]],
  ["Espinhos", 1, [["Cor", '#226219']]],
  ["Lâminas Carmesim", 0, [["Lâminas", '#a3030b'], ["Centro", '#150c0d']]],
  ["Espectro", 1, [["Capuz claro", '#dbd8dd'], ["Capa", '#0a0d16']]],
  ["Tridente Real", 1, [["Cor", '#035ac3']]],
  ["Fortaleza Vulcânica", 0, [["Lava", '#68362c'], ["Armadura", '#150908']]],
  ["Escudo Dourado", 0, [["Moldura", '#a96317'], ["Fundo", '#16120d']]],
  ["Fênix Rubra", 0, [["Pena", '#be040a'], ["Sombra", '#110203']]],
  ["Presas Violeta", 1, [["Cor", '#520e77']]],
  ["Águia", 1, [["Penas azuis", '#0b2c64'], ["Branco", '#e0e2ea']]],
  ["Folhas de Esmeralda", 1, [["Cor", '#497a26']]],
  ["Orbe Sombrio", 0, [["Orbe", '#422c62'], ["Corpo", '#0b0713']]],
  ["Asas Douradas", 0, [["Ouro", '#fcb40b'], ["Contorno", '#050300']]],
  ["Dragão Rubro", 0, [["Dragão", '#d90309'], ["Fundo", '#050000']]],
  ["Leão Rei", 0, [["Ouro", '#eea40c'], ["Contorno", '#050300']]],
  ["Lâminas Gêmeas", 1, [["Cor", '#00597d']]],
  ["Letra Q", 1, [["Cor", '#0d5710']]],
  ["Estrela Violeta", 0, [["Cor", '#73038b']]],
  ["Fênix Negra", 0, [["Fênix", '#e1090e'], ["Corpo", '#0a0606']]],
  ["Leão Branco", 1, [["Branco", '#fafbfb'], ["Contorno", '#020818']]],
  ["Letra R", 1, [["Contorno", '#d59932'], ["Letra", '#1d1b11']]],
  ["Asas Rubras", 0, [["Cor", '#bb0104']]],
  ["Escudo da Águia", 1, [["Escudo", '#022e5c'], ["Águia", '#f3f3f5']]],
  ["Lança Dourada", 0, [["Ouro", '#f0b135'], ["Fundo", '#0f0e0d']]],
  ["Montanha Rubra", 0, [["Lâminas", '#e50710'], ["Fundo", '#0f0c0e']]],
  ["Capuz Roxo", 1, [["Capuz", '#731fae'], ["Fundo", '#040615']]],
  ["Ciclone", 0, [["Vórtice", '#84cd02'], ["Fundo", '#010b09']]],
  ["Vitória", 1, [["Prata", '#f4f5f5'], ["Fundo", '#060e14']]],
  ["Demônio", 0, [["Rosto", '#e30107'], ["Contorno", '#0f0000']]],
  ["Dragão Glacial", 0, [["Branco", '#f6f8f9'], ["Azul", '#057dc4'], ["Sombra", '#7d9db6']]],
  ["Tridente Flamejante", 0, [["Ouro", '#dd8401'], ["Contorno", '#060300']]],
  ["Fênix Eclipse", 0, [["Fênix", '#f00317'], ["Fundo", '#141213']]],
  ["Coroa de Cristal", 0, [["Prata", '#e2e3e9'], ["Gema", '#01bcfc'], ["Metal escuro", '#0a0c10']]],
  ["Ascensão", 0, [["Cor", '#0094ee']]],
  ["Lua Sombria", 1, [["Cor", '#7e015f']]],
  ["Lobo Cinzento", 0, [["Pelagem", '#f4f4f4'], ["Contorno", '#111112']]],
  ["Asas de Fogo", 0, [["Cor", '#e37c01']]],
];
export const N_SIMBOLOS = SIMBOLOS.length;
export const PALETA = ['#ffffff', '#e5e7eb', '#9ca3af', '#111827', '#f5cf5a', '#d9a82b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#92400e'];

const HEX = /^#[0-9a-f]{6}$/;
const cor = (c, d) => (HEX.test(String(c || '').toLowerCase()) ? String(c).toLowerCase() : d);
// Cores originais do símbolo.
export const simCoresPadrao = (s) => (SIMBOLOS[s - 1]?.[2] || []).map((c) => c[1]);
export const ICONE_PADRAO = { s: 1, c: simCoresPadrao(1) };
export const icClone = (ic) => ({ s: ic.s, c: [...ic.c] });
// Troca de símbolo: volta para as cores originais dele.
export const icTrocar = (s) => ({ s, c: simCoresPadrao(s) });

export function icCodificar(ic) {
  const s = Math.min(N_SIMBOLOS, Math.max(1, Number(ic.s) || 1));
  const pad = simCoresPadrao(s);
  return ['v4', s, ...pad.map((d, i) => cor(ic.c?.[i], d).slice(1))].join(':');
}
// Devolve o ícone ou null se o texto não for do formato de símbolo (organizações antigas e times do sistema usam outros formatos).
export function icDecodificar(txt) {
  const m = /^v4:(\d{1,2})((?::[0-9a-f]{6}){1,3})$/.exec(String(txt || ''));
  if (!m) return null;
  const s = Number(m[1]);
  if (s < 1 || s > N_SIMBOLOS) return null;
  const dados = m[2].slice(1).split(':').map((h) => `#${h}`);
  const pad = simCoresPadrao(s);
  return { s, c: pad.map((d, i) => dados[i] || d) };
}
// Símbolo "de fallback" para quem ainda não tem um (times do sistema e contas antigas): fixo pelo nome, com as duas cores do time.
export function icPorNome(nome, cor1, cor2) {
  let h = 2166136261; for (const ch of String(nome || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const s = ((h >>> 0) % N_SIMBOLOS) + 1; const ic = icTrocar(s);
  if (cor1) ic.c[0] = cor(cor1, ic.c[0]);
  if (cor2 && ic.c.length > 1) ic.c[1] = cor(cor2, ic.c[1]);
  return ic;
}

const num2 = (n) => String(n).padStart(2, '0');
const DIR = new URL('../img/simbolos/', import.meta.url).href;

// Ícone completo, quadrado de `size` px.
export function icHtml(ic, size = 56, rotulo = '') {
  const n = num2(ic.s); const info = SIMBOLOS[ic.s - 1];
  const fixa = info[1] ? `<i class="x" style="background-image:url(${DIR}s${n}-0.webp)"></i>` : '';
  const camadas = info[2].map((_, i) => { const u = `${DIR}s${n}-${i + 1}.webp`; return `<i class="p" style="--c:${ic.c[i]};background-image:url(${u});-webkit-mask-image:url(${u});mask-image:url(${u})"></i>`; }).join('');
  return `<span class="tc-ic" style="--s:${size}px" role="img" aria-label="${esc(rotulo)}">${fixa}${camadas}</span>`;
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
export const TEXTO_MAX = 10;
export const TEXTO_PADRAO = { t: 'TIME', f: 1, c: ['#ffffff', '#d9a82b'], ow: 3, oc: '#1b3a6b', sh: 2, sc: '#000000', pl: 0, pf: '#1b3a6b', pb: '#d9a82b' };
export const txClone = (tx) => ({ ...tx, c: [...tx.c] });
// Só letras, números, espaço e . & ! ' + - (o ":" separa os campos).
export const txLimpar = (t) => String(t ?? '').replace(/[^A-Za-z0-9À-ÿ .&!'+-]/g, '').replace(/\s{2,}/g, ' ').slice(0, TEXTO_MAX);

export function txCodificar(tx) {
  const t = txLimpar(tx.t).trim() || 'TIME';
  const f = Math.min(FONTES.length, Math.max(1, Number(tx.f) || 1));
  const h = (c, d) => cor(c, d).slice(1);
  const n = (v, max) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
  return ['v3', t, f, h(tx.c?.[0], '#ffffff'), h(tx.c?.[1], '#d9a82b'), n(tx.ow, 8), h(tx.oc, '#1b3a6b'), n(tx.sh, 6), h(tx.sc, '#000000'), 0, h(tx.pf, '#1b3a6b'), h(tx.pb, '#d9a82b')].join(':') // sem placa de fundo: a escrita é só a escrita;
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
