// Idiomas do site. O texto em português é a "chave": cada idioma tem um
// dicionário { 'texto em português': 'tradução' } em shared/i18n/<id>.js.
// O que não estiver no dicionário continua em português (nada quebra).
//
// Como funciona: o código do site continua escrevendo em português; este módulo
// traduz o que aparece na tela (textos, title, placeholder, aria-label, alt) e
// reage a tudo que o jogo desenhar depois. Trocar de idioma não recarrega a página.
//
// Chaves com {nome} valem para textos com valores no meio:
//   'Hoje: {pts} PDR': 'Today: {pts} PDR'
// Cada pedaço de texto (entre tags) é traduzido sozinho, então frases com <b> ou
// <a> no meio viram vários pedaços, na ordem em que aparecem.

export const LANGS = [
  { id: 'pt-BR', nome: 'Português', curto: 'PT' },
  { id: 'en', nome: 'English', curto: 'EN' },
  { id: 'de', nome: 'Deutsch', curto: 'DE' },
  { id: 'es', nome: 'Español', curto: 'ES' },
  { id: 'it', nome: 'Italiano', curto: 'IT' },
  { id: 'fr', nome: 'Français', curto: 'FR' },
];
export const IDIOMA_PADRAO = 'pt-BR';
const CHAVE = 'rift-lang';

const ATRIBUTOS = ['title', 'placeholder', 'aria-label', 'alt'];
const PULAR = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'SVG', 'CODE', 'PRE']);
const PULAR_SEL = '.nick, .avatar, [data-no-i18n], [translate="no"]';

let lang = IDIOMA_PADRAO;
let dict = new Map(); // chave exata → tradução
let modelos = []; // [{ re, partes, saida }] para chaves com {valores}
const ouvintes = new Set();

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[.*+?^$()|[\]\\]/g, '\\$&');

function lerSalvo() {
  try {
    const v = localStorage.getItem(CHAVE);
    if (LANGS.some((l) => l.id === v)) return v;
  } catch { /* sem storage */ }
  return IDIOMA_PADRAO;
}

function montar(d) {
  dict = new Map();
  modelos = [];
  for (const [k, v] of Object.entries(d || {})) {
    if (!/\{\w+\}/.test(k)) { dict.set(norm(k), v); continue; }
    const nomes = [];
    const re = new RegExp(`^${esc(norm(k)).replace(/\\?\{(\w+)\\?\}/g, (_, n) => { nomes.push(n); return '(.+?)'; })}$`);
    // Modelos só de {valores} e pontuação ('{c}: {v}') só valem se algum valor for traduzido.
    modelos.push({ re, nomes, saida: v, soVars: !/[A-Za-zÀ-ÿ]/.test(k.replace(/\{\w+\}/g, '')) });
  }
}

// Valor no meio de um modelo: traduz o texto inteiro ou, se for uma lista
// ("Mago, Assassino"), cada item.
function valor(v) {
  const direto = buscar(norm(v));
  if (direto != null) return direto;
  if (/, /.test(v)) return v.split(', ').map((x) => buscar(norm(x)) ?? x).join(', ');
  return v;
}

// Traduz um texto (já sem espaços sobrando). Devolve null se não houver tradução.
function buscar(texto) {
  if (!texto) return null;
  const direto = dict.get(texto);
  if (direto != null) return direto;
  for (const m of modelos) {
    const r = m.re.exec(texto);
    if (!r) continue;
    // Os valores do meio também são traduzidos, se existirem no dicionário (ex.: "Ferro 2").
    let mudou = false;
    const out = m.saida.replace(/\{(\w+)\}/g, (_, n) => {
      const i = m.nomes.indexOf(n);
      if (i < 0) return `{${n}}`;
      const v = valor(r[i + 1]);
      if (v !== r[i + 1]) mudou = true;
      return v;
    });
    if (m.soVars && !mudou) continue;
    return out;
  }
  return null;
}

// Para o código que monta textos: t('Entrar') ou t('Hoje: {pts} PDR', { pts: 5 }).
export function t(pt, vars = null) {
  let out = lang === IDIOMA_PADRAO ? null : buscar(norm(String(pt)));
  if (out == null) out = String(pt);
  return vars ? out.replace(/\{(\w+)\}/g, (_, n) => (n in vars ? vars[n] : `{${n}}`)) : out;
}

// Só para testes: usa um dicionário direto e traduz um texto solto.
export const __usarDicionario = (d, id = 'en') => { lang = id; montar(d); };
export const traduzirTexto = (pt) => buscar(norm(String(pt)));

export const getLang = () => lang;
export const langInfo = () => LANGS.find((l) => l.id === lang) || LANGS[0];
export const onLangChange = (fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn); };
// Para formatar números e datas no idioma escolhido.
export const localeAtual = () => lang;

// ------------------------------------------------------------------ tradução da página

// Guarda o original (português) de cada pedaço traduzido, para poder voltar
// ao português ou ir para outro idioma sem perder nada.
const origTexto = new WeakMap(); // nó de texto → { pt, feito }
const origAttr = new WeakMap(); // elemento → { atributo: { pt, feito } }
let aplicando = false;

const pular = (el) => !el || PULAR.has(el.nodeName.toUpperCase()) || (el.closest && el.closest(PULAR_SEL));

function trocarTexto(no) {
  const reg = origTexto.get(no);
  const atual = no.data;
  // Se o jogo escreveu algo novo no nó, o novo texto é o novo original.
  const pt = reg && reg.feito === atual ? reg.pt : atual;
  if (!pt.trim()) return;
  const lead = pt.match(/^\s*/)[0];
  const trail = pt.match(/\s*$/)[0];
  const tr = lang === IDIOMA_PADRAO ? null : buscar(norm(pt));
  const novo = tr == null ? pt : lead + tr + trail;
  if (novo !== atual) no.data = novo;
  if (tr != null || reg) origTexto.set(no, { pt, feito: novo });
}

function trocarAtributos(el) {
  for (const a of ATRIBUTOS) {
    if (!el.hasAttribute(a)) continue;
    const mapa = origAttr.get(el) || {};
    const reg = mapa[a];
    const atual = el.getAttribute(a);
    const pt = reg && reg.feito === atual ? reg.pt : atual;
    const tr = lang === IDIOMA_PADRAO ? null : buscar(norm(pt));
    const novo = tr == null ? pt : tr;
    if (novo !== atual) el.setAttribute(a, novo);
    if (tr != null || reg) { mapa[a] = { pt, feito: novo }; origAttr.set(el, mapa); }
  }
}

function percorrer(raiz) {
  if (raiz.nodeType === 3) { if (!pular(raiz.parentElement)) trocarTexto(raiz); return; }
  if (raiz.nodeType !== 1 || pular(raiz)) return;
  trocarAtributos(raiz);
  for (const c of [...raiz.childNodes]) {
    if (c.nodeType === 3) trocarTexto(c);
    else if (c.nodeType === 1) percorrer(c);
  }
}

export function traduzir(raiz = document.body) {
  if (!raiz) return;
  aplicando = true;
  try { percorrer(raiz); } finally { aplicando = false; }
  observador?.takeRecords(); // descarta o que a própria tradução mexeu
}

function traduzirTitulo() {
  const el = document.querySelector('title');
  if (el) trocarTexto(el.firstChild || el);
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    const mapa = origAttr.get(meta) || {};
    const reg = mapa.content;
    const atual = meta.getAttribute('content') || '';
    const pt = reg && reg.feito === atual ? reg.pt : atual;
    const tr = lang === IDIOMA_PADRAO ? null : buscar(norm(pt));
    const novo = tr == null ? pt : tr;
    if (novo !== atual) meta.setAttribute('content', novo);
    origAttr.set(meta, { ...mapa, content: { pt, feito: novo } });
  }
}

let observador = null;
function observar() {
  if (observador || typeof MutationObserver === 'undefined' || !document.body) return;
  const fila = new Set();
  let agendado = false;
  const processar = () => {
    agendado = false;
    const itens = [...fila];
    fila.clear();
    aplicando = true;
    try { itens.forEach((n) => { if (n.isConnected) percorrer(n); }); } finally { aplicando = false; }
    observador.takeRecords();
  };
  observador = new MutationObserver((muts) => {
    if (aplicando || lang === IDIOMA_PADRAO) return;
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach((n) => fila.add(n));
      else if (m.type === 'characterData') fila.add(m.target);
      else if (m.type === 'attributes') fila.add(m.target);
    }
    if (!agendado && fila.size) { agendado = true; queueMicrotask(processar); }
  });
  observador.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
}

// ------------------------------------------------------------------ troca de idioma

async function carregar(id) {
  if (id === IDIOMA_PADRAO) { montar({}); return; }
  try {
    const mod = await import(`./i18n/${id}.js`);
    montar(mod.default);
  } catch (err) {
    console.warn('Site: não foi possível carregar o idioma', id, err);
    montar({});
  }
}

function aplicarNaPagina() {
  document.documentElement.lang = lang;
  if (typeof document === 'undefined' || !document.body) return;
  traduzirTitulo();
  traduzir(document.body);
}

export async function setLang(id) {
  if (!LANGS.some((l) => l.id === id) || id === lang) return;
  lang = id;
  try { localStorage.setItem(CHAVE, id); } catch { /* sem storage */ }
  await carregar(id);
  aplicarNaPagina();
  observar();
  ouvintes.forEach((fn) => { try { fn(id); } catch { /* ignora */ } });
}

// Início: lê a escolha salva e já carrega o dicionário antes da página ser desenhada.
lang = lerSalvo();
if (typeof document !== 'undefined') {
  await carregar(lang);
  document.documentElement.lang = lang;
  const iniciar = () => { aplicarNaPagina(); observar(); };
  if (lang !== IDIOMA_PADRAO) {
    if (document.body) iniciar();
    else document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  }
}
