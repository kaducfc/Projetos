import { Terreno } from '../nucleo/terreno.js';
import { Navegacao } from '../nucleo/navegacao.js';
import { regiaoDe } from '../nucleo/regioes.js';
import { MAPA } from '../config/mapa.js';
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
img.onload = ajustar; window.addEventListener('resize', ajustar); ajustar();
