import { Terreno } from '../nucleo/terreno.js';
import { Navegacao } from '../nucleo/navegacao.js';
import { regiaoDe } from '../nucleo/regioes.js';
import { MAPA } from '../config/mapa.js';
import { MUNDO_MAPA } from '../nucleo/mapa-mundo.js';
import { AJUSTES } from '../config/ajustes.js';
import { telaParaMundo, mundoParaNorm } from '../nucleo/coord.js';
import { CAMADAS, desenharDepuracao } from '../render/depuracao.js';

const terreno = new Terreno(); const nav = new Navegacao(terreno);
const img = new Image(); img.src = '../' + MAPA.imagem.arquivo;
const cv = document.getElementById('c'); const ctx = cv.getContext('2d');
const camadas = { grade: true, rotas: true, estruturas: true, selva: true, bases: true };
const caixa = document.getElementById('camadas');
caixa.innerHTML = CAMADAS.filter(([k]) => ['grade', 'paredes', 'rotas', 'estruturas', 'selva', 'bases'].includes(k)).map(([k, n]) => `<label><input type="checkbox" data-k="${k}" ${camadas[k] ? 'checked' : ''}/>${n}</label>`).join('');
caixa.addEventListener('change', (e) => { camadas[e.target.dataset.k] = e.target.checked; desenhar(); });
let pontos = [], caminho = null;
function vista() { return { largura: cv.width, altura: cv.height }; }
function ajustar() { cv.width = Math.min(1487, cv.parentElement.clientWidth - 20); cv.height = Math.round(cv.width * MAPA.imagem.altura / MAPA.imagem.largura); desenhar(); }
function desenhar() {
  if (!img.complete) return;
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  desenharDepuracao(ctx, vista(), camadas, terreno, null, { caminho });
}
function pos(e) { const r = cv.getBoundingClientRect(); return telaParaMundo((e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height, vista()); }
cv.addEventListener('mousemove', (e) => {
  const m = pos(e); const n = mundoParaNorm(m.x, m.y); const reg = regiaoDe(terreno, m.x, m.y);
  document.getElementById('info').textContent = `normalizado  ${n.nx.toFixed(4)}, ${n.ny.toFixed(4)}\nmundo        ${m.x.toFixed(0)}, ${m.y.toFixed(0)}\ncélula       ${terreno.col(m.x)}, ${terreno.lin(m.y)}\nregião       ${JSON.stringify(reg)}`;
});
cv.addEventListener('click', (e) => {
  const m = pos(e); pontos.push(m);
  if (pontos.length === 2) { const perfil = document.getElementById('perfil').value; caminho = nav.caminho(pontos[0].x, pontos[0].y, pontos[1].x, pontos[1].y, perfil); if (caminho) caminho.unshift(pontos[0]); pontos = []; document.getElementById('info').textContent = caminho ? `caminho com ${caminho.length - 1} trechos` : 'sem caminho para esse perfil'; }
  desenhar();
});
document.getElementById('limpar').onclick = () => { caminho = null; pontos = []; desenhar(); };
// ------------------------------------------------------------------ editor
const U = MAPA.mundo.largura;
const itens = () => [...MUNDO_MAPA.estruturas.map((o) => ({ o, grupo: 'estruturas' })), ...MUNDO_MAPA.acampamentos.map((o) => ({ o, grupo: 'acampamentos' })), ...MUNDO_MAPA.covis.map((o) => ({ o, grupo: 'covis' }))];
const origem = new Map(); for (const { o } of itens()) origem.set(o.id, { x: o.x, y: o.y });
const rascunhoChave = 'tc.mapa.rascunho';
let modo = 'ver', arrastando = null, pilha = [], pintando = false, lote = null;
const modoAtual = () => document.querySelector('input[name=modo]:checked').value;
document.querySelectorAll('input[name=modo]').forEach((r) => r.addEventListener('change', () => { modo = modoAtual(); cv.style.cursor = modo === 'ver' ? 'crosshair' : modo === 'mover' ? 'grab' : 'cell'; }));
function salvarRascunho() { try { localStorage.setItem(rascunhoChave, JSON.stringify(gerar())); } catch { /* sem armazenamento */ } }
function gerar() {
  const out = { versao: 1, estruturas: {}, acampamentos: {}, covis: {}, celulas: {} };
  for (const { o, grupo } of itens()) { const a = origem.get(o.id); if (Math.abs(o.x - a.x) > 1 || Math.abs(o.y - a.y) > 1) out[grupo][o.id] = [+(o.x / U).toFixed(5), +(o.y / (MAPA.mundo.altura)).toFixed(5)]; }
  for (let i = 0; i < terreno.grade.length; i++) if (terreno.grade[i] !== terreno.original[i]) out.celulas[`${i % terreno.cols},${(i / terreno.cols) | 0}`] = terreno.grade[i];
  return out;
}
// carrega ajustes salvos (config/ajustes.js já foi aplicado ao terreno e às posições) e o rascunho local
try { const r = JSON.parse(localStorage.getItem(rascunhoChave) || 'null'); if (r) { for (const { o, grupo } of itens()) { const p = r[grupo]?.[o.id]; if (p) { o.x = p[0] * U; o.y = p[1] * MAPA.mundo.altura; } } for (const [k, t] of Object.entries(r.celulas || {})) { const [cx, cy] = k.split(',').map(Number); terreno.grade[cy * terreno.cols + cx] = t; } terreno.recalcularPerto(); } } catch { /* rascunho inválido */ }
function pegar(e) {
  const m = pos(e); const r = 14 * (MAPA.imagem.largura / cv.width) * 10; // 14 px de tela, em unidades do mundo
  let melhor = null, md = r; for (const { o, grupo } of itens()) { const d = Math.hypot(o.x - m.x, o.y - m.y); if (d < md) { md = d; melhor = { o, grupo }; } }
  return melhor;
}
function pintar(e) {
  const m = pos(e); const t = Number(document.getElementById('tipo').value), n = Number(document.getElementById('tam').value);
  const cx = terreno.col(m.x), cy = terreno.lin(m.y);
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) { const x = cx + dx - ((n - 1) >> 1), y = cy + dy - ((n - 1) >> 1); if (!terreno.dentro(x, y)) continue; const i = y * terreno.cols + x; if (terreno.grade[i] !== t) { lote.push([i, terreno.grade[i]]); terreno.grade[i] = t; } }
}
cv.addEventListener('mousedown', (e) => {
  if (modo === 'mover') { const p = pegar(e); if (p) { arrastando = { ...p, de: { x: p.o.x, y: p.o.y } }; cv.style.cursor = 'grabbing'; e.preventDefault(); } }
  else if (modo === 'pintar') { pintando = true; lote = []; pintar(e); desenhar(); e.preventDefault(); }
});
window.addEventListener('mousemove', (e) => {
  if (arrastando) { const m = pos(e); arrastando.o.x = Math.max(0, Math.min(MAPA.mundo.largura, m.x)); arrastando.o.y = Math.max(0, Math.min(MAPA.mundo.altura, m.y)); desenhar(); }
  else if (pintando) { pintar(e); desenhar(); }
});
window.addEventListener('mouseup', () => {
  if (arrastando) { pilha.push({ mover: arrastando.o, de: arrastando.de }); arrastando = null; cv.style.cursor = 'grab'; salvarRascunho(); }
  if (pintando) { pintando = false; if (lote.length) { pilha.push({ celulas: lote }); terreno.recalcularPerto(); salvarRascunho(); } lote = null; }
});
document.getElementById('desfazer').onclick = () => {
  const a = pilha.pop(); if (!a) return;
  if (a.mover) { a.mover.x = a.de.x; a.mover.y = a.de.y; } else for (let i = a.celulas.length - 1; i >= 0; i--) terreno.grade[a.celulas[i][0]] = a.celulas[i][1];
  terreno.recalcularPerto(); salvarRascunho(); desenhar();
};
document.getElementById('descartar').onclick = () => {
  if (!confirm('Descartar todos os ajustes feitos nesta tela?')) return;
  try { localStorage.removeItem(rascunhoChave); } catch { /* sem armazenamento */ }
  location.reload();
};
document.getElementById('exportar').onclick = () => {
  const g = gerar(); const txt = `export const AJUSTES = ${JSON.stringify(g)};`;
  const sa = document.getElementById('saida'); sa.value = txt; sa.select();
  try { navigator.clipboard.writeText(txt).catch(() => {}); } catch { /* copie à mão */ }
};
img.onload = ajustar; window.addEventListener('resize', ajustar); ajustar();
